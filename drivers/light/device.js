'use strict';

const FahDevice = require('../../lib/FahDevice');
const { PID } = require('../../lib/pairing');
const C = require('../../lib/convert');

module.exports = class LightDevice extends FahDevice {

  async mapInitialState() {
    await this.loadCapability('onoff', PID.ON_OFF_OUT, C.fahToOnoff);

    if (this.hasCapability('dim')) {
      const b = this.readPid(PID.BRIGHTNESS_OUT);
      // '0' is reported when switched off; keep the last dim value.
      if (b != null && b !== '' && b !== '0') await this.setCapabilityValue('dim', C.fahToDim(b)).catch(() => {});
    }
  }

  registerListeners() {
    // Couple onoff + dim so Homey's toggle and slider never disagree: dimming to 0
    // turns the light off, dimming up turns it on (Homey lights best-practice).
    if (this.hasCapability('dim')) {
      this.registerMultipleCapabilityListener(['onoff', 'dim'], async ({ dim, onoff }) => {
        if (dim !== undefined) {
          if (dim > 0) {
            await this.writePid(PID.BRIGHTNESS_IN, C.dimToFah(dim));
            await this.writePid(PID.ON_OFF_IN, C.onoffToFah(true));
          } else {
            await this.writePid(PID.ON_OFF_IN, C.onoffToFah(false));
          }
          await this.setCapabilityValue('onoff', dim > 0).catch(() => {});
        } else if (onoff !== undefined) {
          await this.writePid(PID.ON_OFF_IN, C.onoffToFah(onoff));
        }
      }, 300);
    } else if (this.hasCapability('onoff')) {
      this.registerCapabilityListener('onoff', (v) => this.writePid(PID.ON_OFF_IN, C.onoffToFah(v)));
    }
  }

  async handleDatapoint(evt) {
    const pid = this.pidOfDatapoint(evt.datapoint);
    if (pid === PID.ON_OFF_OUT && this.hasCapability('onoff')) {
      await this.setCapabilityValue('onoff', C.fahToOnoff(evt.value)).catch(() => {});
    } else if (pid === PID.BRIGHTNESS_OUT && this.hasCapability('dim')) {
      // free@home reports brightness 0 when off; preserve the last dim value.
      if (evt.value !== '0') await this.setCapabilityValue('dim', C.fahToDim(evt.value)).catch(() => {});
    }
  }

};
