'use strict';

// free@home channel functionID (hex string, no 0x prefix) -> Homey driver id.
// Compared case-insensitively (uppercase). Only the device types verified on
// real hardware are mapped; any other fid returns null and is skipped.
// functionID semantics derived from homebridge-freeathome-local-api (MIT) — see LICENSE.
const MAP = {
  '7': 'switch', '20': 'switch', // on/off actuators
  '12': 'light', '1810': 'light', // dimmers
};

exports.MAP = MAP;
exports.driverForFunctionId = (fid) => MAP[String(fid == null ? '' : fid).toUpperCase()] || null;
