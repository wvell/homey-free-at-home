'use strict';

const Homey = require('homey');
const { discoverChannels } = require('./discovery');

// Base driver: pairing lists the channels in the cached configuration whose
// functionID maps to this driver.
module.exports = class FahDriver extends Homey.Driver {

  // Driver id == folder name == discovery key. `this.id` is the conventional
  // SDK v3 property; fall back to the (documented) manifest id to be safe.
  get driverId() {
    return this.id || (this.manifest && this.manifest.id);
  }

  async onInit() {
    this.log(`Driver "${this.driverId}" ready`);
  }

  async onPairListDevices() {
    const config = this.homey.app.getConfig();
    if (!config) {
      throw new Error(
        'Not connected to the free@home System Access Point. Open the app settings, enter the '
        + 'host, Local-API user id and password, enable the Local API on the System Access Point, '
        + 'then try again.',
      );
    }
    const devices = discoverChannels(config, this.driverId);
    this.log(`Pairing "${this.driverId}": ${devices.length} channel(s) found`);
    return devices;
  }

};
