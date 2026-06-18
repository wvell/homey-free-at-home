'use strict';

const Homey = require('homey');
const { FreeAtHomeClient, EMPTY_UUID } = require('./lib/client');
const { routeKey } = require('./lib/router');

const OFFLINE_MESSAGE = 'free@home System Access Point unreachable';

// One shared client (REST + a single WebSocket) for the whole app. Devices
// register themselves; incoming WS datapoint events are routed to the owning
// device by `<serial>/<chXXXX>`.
module.exports = class FreeAtHomeApp extends Homey.App {

  async onInit() {
    this._devices = new Map(); // "<serial>/<ch>" -> Homey device
    this._config = null;
    this._client = null;
    this._restartTimer = null;

    // Saving the settings page fires one 'set' per key (host/user/pass/tls);
    // debounce so the burst triggers a single reconnect instead of four.
    this.homey.settings.on('set', (key) => {
      if (!['host', 'user', 'pass', 'tls'].includes(key)) return;
      if (this._restartTimer) this.homey.clearTimeout(this._restartTimer);
      this._restartTimer = this.homey.setTimeout(() => {
        this._restartTimer = null;
        this.log('Connection settings changed — reconnecting');
        this._restart().catch((e) => this.error(e));
      }, 800);
    });

    await this._start();
  }

  async onUninit() {
    if (this._client) this._client.disconnect();
  }

  _readSettings() {
    return {
      host: this.homey.settings.get('host'),
      user: this.homey.settings.get('user'),
      pass: this.homey.settings.get('pass'),
      tls: !!this.homey.settings.get('tls'),
    };
  }

  async _restart() {
    // disconnect() drops the client's listeners, so its 'close' event won't fire.
    // Mark devices unavailable here so they don't linger as "available" while we reconnect.
    this._setAllUnavailable('Reconnecting to the free@home System Access Point…');
    if (this._client) { this._client.disconnect(); this._client = null; }
    await this._start();
  }

  async _start() {
    const s = this._readSettings();
    if (!s.host || !s.user || !s.pass) {
      this.log('Not configured yet — set host / user / password in the app settings.');
      this._setStatus('Not configured — enter the System Access Point IP, user id and password, then Save.');
      this._setAllUnavailable('free@home System Access Point not configured');
      return;
    }

    const client = new FreeAtHomeClient({
      host: s.host, user: s.user, pass: s.pass, tls: s.tls,
      logger: { log: (...a) => this.log(...a), error: (...a) => this.error(...a) },
    });
    this._client = client;

    client.on('datapoint', (evt) => this._route(evt));
    client.on('open', () => {
      this.log('WebSocket connected');
      this._setStatus('Connected — loading devices…');
      this._onConnected().catch((e) => this.error(e));
    });
    client.on('close', (code) => {
      this.log('WebSocket closed:', code);
      this._setStatus('Offline — reconnecting…');
      this._setAllUnavailable(OFFLINE_MESSAGE);
    });
    client.on('error', (err) => this.error('WebSocket error:', err.message));

    try {
      this._config = await client.getConfiguration();
      this.log(`Configuration loaded (${this._deviceCount()} free@home devices)`);
      this._setStatus(`Configuration loaded — ${this._deviceCount()} devices. Connecting…`);
    } catch (e) {
      this.error('Failed to load configuration:', e.message);
      this._setStatus(`Connection error: ${e.message}`);
    }
    client.connect();
  }

  // Publish a human-readable status to app settings for the settings page.
  // (Key 'status' is ignored by the reconnect trigger above.)
  _setStatus(text) {
    try { this.homey.settings.set('status', text); } catch (_) { /* ignore */ }
  }

  async _onConnected() {
    try {
      // Re-fetch on every (re)connect: a drop may have outlasted a config change,
      // so refresh before reseeding devices. (_start does the first, pre-connect fetch.)
      this._config = await this._client.getConfiguration();
      this._setStatus(`Connected — ${this._deviceCount()} free@home devices.`);
    } catch (e) {
      this.error('Re-seed configuration failed:', e.message);
      this._setStatus(`Connected, but the device list could not be fetched: ${e.message}`);
    }
    for (const device of this._devices.values()) {
      device.setAvailable().catch(() => {});
      if (typeof device.reseed === 'function') device.reseed().catch((e) => this.error(e));
    }
  }

  _route(evt) {
    const device = this._devices.get(routeKey(evt.serial, evt.channel));
    if (device) device.onDatapoint(evt);
  }

  _setAllUnavailable(message) {
    for (const device of this._devices.values()) device.setUnavailable(message).catch(() => {});
  }

  _deviceCount() {
    const sys = this._config && this._config[EMPTY_UUID];
    return sys ? Object.keys(sys.devices || {}).length : 0;
  }

  // --- public API used by drivers/devices ---
  getClient() { return this._client; }
  getConfig() { return this._config; }

  getChannel(serial, channel) {
    const sys = this._config && this._config[EMPTY_UUID];
    return sys && sys.devices[serial] ? sys.devices[serial].channels[channel] : null;
  }

  registerDevice(device) { this._devices.set(device.getData().id, device); }
  unregisterDevice(device) { this._devices.delete(device.getData().id); }

};
