'use strict';

const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
// serial (12 alnum) / chXXXX / [io]dpXXXX  — hex channel + datapoint ids.
const DP_KEY_RE = /^([A-Za-z0-9]{12})\/(ch[0-9a-f]{4})\/([io]dp[0-9a-f]{4})$/;

const PING_INTERVAL = 30000;
const MAX_BACKOFF = 30000;
const MAX_ATTEMPT = 10;

// Thin free@home Local API client: one HTTP-Basic REST connection + one
// receive-only WebSocket, using only Node built-ins + `ws` (no global fetch,
// so it runs on any Homey Node runtime). Emits: 'open', 'close'(code,reason),
// 'error'(err), 'frame'(raw), 'datapoint'({serial,channel,datapoint,value}).
class FreeAtHomeClient extends EventEmitter {

  constructor({ host, user, pass, tls = false, logger = console } = {}) {
    super();
    this.host = host;
    this.user = user;
    this.pass = pass;
    this.tls = !!tls;
    this.logger = logger;
    this._ws = null;
    this._stopped = false;
    this._attempt = 0;
    this._reconnectTimer = null;
    this._pingTimer = null;
  }

  _restUrl(path) {
    return `${this.tls ? 'https' : 'http'}://${this.host}/fhapi/v1/api/rest/${path}`;
  }

  _wsUrl() {
    return `${this.tls ? 'wss' : 'ws'}://${this.host}/fhapi/v1/api/ws`;
  }

  _authHeader() {
    return 'Basic ' + Buffer.from(`${this.user}:${this.pass}`).toString('base64');
  }

  // --- REST (http/https, no external fetch) ---
  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(this._restUrl(path));
      const lib = this.tls ? https : http;
      const headers = { Authorization: this._authHeader() };
      if (body != null) {
        headers['Content-Type'] = 'text/plain';
        headers['Content-Length'] = Buffer.byteLength(body);
      }
      const req = lib.request(
        {
          method,
          hostname: url.hostname,
          port: url.port || (this.tls ? 443 : 80),
          path: url.pathname + url.search,
          headers,
          rejectUnauthorized: false,
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
            else reject(new Error(`HTTP ${res.statusCode} for ${method} ${path}`));
          });
        }
      );
      req.on('error', reject);
      if (body != null) req.write(body);
      req.end();
    });
  }

  async getConfiguration() {
    return JSON.parse(await this._request('GET', 'configuration'));
  }

  async getDatapoint(serial, channel, datapoint) {
    const raw = await this._request('GET', `datapoint/${EMPTY_UUID}/${serial}.${channel}.${datapoint}`);
    try {
      const j = JSON.parse(raw);
      const bucket = j[EMPTY_UUID];
      if (bucket && Array.isArray(bucket.values) && bucket.values.length > 0) return bucket.values[0];
    } catch (_) { /* fall through */ }
    return null;
  }

  async setDatapoint(serial, channel, datapoint, value) {
    await this._request('PUT', `datapoint/${EMPTY_UUID}/${serial}.${channel}.${datapoint}`, String(value));
    return true;
  }

  // --- WebSocket ---
  _parseFrame(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return []; }
    const bucket = msg && msg[EMPTY_UUID];
    if (!bucket || !bucket.datapoints) return [];
    const out = [];
    for (const [key, value] of Object.entries(bucket.datapoints)) {
      const m = DP_KEY_RE.exec(key);
      if (!m) continue;
      out.push({ serial: m[1], channel: m[2], datapoint: m[3], value });
    }
    return out;
  }

  connect() {
    this._stopped = false;
    this._open();
  }

  _open() {
    // Never keep more than one live socket: tear down any previous one and its
    // handlers before opening a new one (guards against reconnect races where a
    // slow socket connects after we have moved on).
    if (this._ws) {
      try { this._ws.removeAllListeners(); this._ws.close(1000); } catch (_) { /* ignore */ }
      this._ws = null;
    }

    let ws;
    try {
      ws = new WebSocket(this._wsUrl(), { headers: { Authorization: this._authHeader() }, rejectUnauthorized: false });
    } catch (err) {
      this.emit('error', err);
      this._scheduleReconnect();
      return;
    }
    this._ws = ws;

    // Ignore events from a socket that is no longer the active one.
    const isStale = () => this._ws !== ws;

    ws.on('open', () => {
      if (isStale()) return;
      this._attempt = 0;
      this._startPing();
      this.emit('open');
    });
    ws.on('message', (data) => {
      if (isStale()) return;
      const raw = data.toString();
      this.emit('frame', raw);
      for (const evt of this._parseFrame(raw)) this.emit('datapoint', evt);
    });
    ws.on('error', (err) => { if (!isStale()) this.emit('error', err); });
    ws.on('close', (code, reason) => {
      if (isStale()) return;
      this._stopPing();
      this.emit('close', code, reason);
      if (!this._stopped && code !== 1000) this._scheduleReconnect();
    });
  }

  _scheduleReconnect() {
    if (this._stopped || this._reconnectTimer) return;
    const delay = Math.min(200 * Math.pow(2, this._attempt), MAX_BACKOFF);
    this._attempt = Math.min(this._attempt + 1, MAX_ATTEMPT);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._stopped) this._open();
    }, delay);
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      try { if (this._ws && this._ws.readyState === WebSocket.OPEN) this._ws.ping(); } catch (_) { /* ignore */ }
    }, PING_INTERVAL);
  }

  _stopPing() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
  }

  disconnect() {
    this._stopped = true;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    this._stopPing();
    if (this._ws) {
      try { this._ws.removeAllListeners(); this._ws.close(1000); } catch (_) { /* ignore */ }
      this._ws = null;
    }
    // Drop our own EventEmitter listeners so a discarded client (e.g. after a
    // settings change) does not leak handlers across restarts.
    this.removeAllListeners();
  }
}

module.exports = { FreeAtHomeClient, EMPTY_UUID };
