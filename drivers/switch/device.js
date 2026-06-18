'use strict';

const FahDevice = require('../../lib/FahDevice');
const { PID } = require('../../lib/pairing');
const C = require('../../lib/convert');

module.exports = class SwitchDevice extends FahDevice {

  async mapInitialState() {
    await this.loadCapability('onoff', PID.ON_OFF_OUT, C.fahToOnoff);
  }

  registerListeners() {
    this.registerCapabilityListener('onoff', (value) => this.writePid(PID.ON_OFF_IN, C.onoffToFah(value)));
  }

  async handleDatapoint(evt) {
    await this.applyDatapoint(evt, PID.ON_OFF_OUT, 'onoff', C.fahToOnoff);
  }

};
