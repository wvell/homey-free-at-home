'use strict';

const Homey = require('homey');
const { inputByPairingId, outputValueByPairingId } = require('./pairing');

// Base device: one free@home channel. Identity `data.id = "<serial>/<chXXXX>"`.
// Subclasses implement mapInitialState/registerListeners/handleDatapoint.
module.exports = class FahDevice extends Homey.Device {

  async onInit() {
    const [serial, channel] = this.getData().id.split('/');
    this.serial = serial;
    this.channelId = channel;
    this.channel = this.homey.app.getChannel(serial, channel);

    this.homey.app.registerDevice(this);

    if (!this.channel) {
      this.log(`Channel ${this.getData().id} not in config yet; will refresh on connect`);
    } else {
      try { await this.mapInitialState(); } catch (e) { this.error('mapInitialState:', e.message); }
    }
    try { this.registerListeners(); } catch (e) { this.error('registerListeners:', e.message); }

    if (!this.homey.app.getClient()) {
      this.setUnavailable('free@home System Access Point not configured').catch(() => {});
    } else if (!this.channel && !this.homey.app.getConfig()) {
      // Configured, but the configuration has not loaded yet — will recover on connect.
      this.setUnavailable('free@home configuration not loaded yet; retrying…').catch(() => {});
    }
  }

  // --- subclass hooks ---
  async mapInitialState() {} // load capability values from cached outputs
  registerListeners() {} // registerCapabilityListener(...)
  async handleDatapoint(/* evt */) {} // react to a WS datapoint event

  // Called by the app when a WS datapoint for this channel arrives.
  onDatapoint(evt) {
    Promise.resolve(this.handleDatapoint(evt)).catch((e) => this.error('handleDatapoint:', e.message));
  }

  // Re-fetch channel + reseed state after a (re)connect.
  async reseed() {
    this.channel = this.homey.app.getChannel(this.serial, this.channelId);
    if (this.channel) {
      try { await this.mapInitialState(); } catch (e) { this.error('reseed:', e.message); }
    }
  }

  // --- helpers for subclasses ---

  // free@home reports '' / null to mean "no value yet"; skip those writes.
  // setCapabilityValue can reject if the capability is absent on this channel,
  // so swallow — the caller has already gated on hasCapability where it matters.
  async _setIfPresent(capability, value, convert) {
    if (value == null || value === '') return;
    await this.setCapabilityValue(capability, convert(value)).catch(() => {});
  }

  // Load a capability's value from its cached OUTPUT datapoint (by pairingID).
  async loadCapability(capability, pid, convert) {
    if (this.hasCapability(capability)) await this._setIfPresent(capability, this.readPid(pid), convert);
  }

  // Push an incoming WS datapoint into a capability when it maps to `pid`.
  async applyDatapoint(evt, pid, capability, convert) {
    if (this.hasCapability(capability) && this.pidOfDatapoint(evt.datapoint) === pid) {
      await this._setIfPresent(capability, evt.value, convert);
    }
  }

  // Write an INPUT datapoint resolved by pairingID.
  async writePid(pid, value) {
    const client = this.homey.app.getClient();
    if (!client) throw new Error('Not connected to the free@home System Access Point.');
    const dp = inputByPairingId(this.channel, pid);
    if (!dp) { this.error(`No input datapoint for pairingID ${pid} on ${this.getData().id}`); return; }
    await client.setDatapoint(this.serial, this.channelId, dp, value);
  }

  // Current cached value of an output datapoint by pairingID.
  readPid(pid) { return outputValueByPairingId(this.channel, pid); }

  // pairingID of an incoming datapoint id (searches outputs then inputs).
  pidOfDatapoint(dpId) {
    const out = this.channel && this.channel.outputs && this.channel.outputs[dpId];
    if (out) return out.pairingID;
    const inp = this.channel && this.channel.inputs && this.channel.inputs[dpId];
    if (inp) return inp.pairingID;
    return undefined;
  }

  async onDeleted() {
    this.homey.app.unregisterDevice(this);
  }

};
