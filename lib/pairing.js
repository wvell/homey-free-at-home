'use strict';

// Resolve a channel's actual datapoint id (idpNNNN / odpNNNN) by its pairingID,
// because addressing is device-model-specific and must NOT be hardcoded.
//
// The free@home pairingID mapping is derived from the MIT-licensed
// homebridge-freeathome-local-api by Philip Gerke (see LICENSE).
// All values here are verified against the live SysAP: lighting on/off + brightness.
const PID = {
  ON_OFF_IN: 1, BRIGHTNESS_IN: 17,
  ON_OFF_OUT: 256, BRIGHTNESS_OUT: 272,
};

function findByPid(map, pid) {
  for (const [dpId, dp] of Object.entries(map || {})) {
    if (dp && dp.pairingID === pid) return dpId;
  }
  return null;
}

exports.PID = PID;
exports.inputByPairingId = (channel, pid) => findByPid(channel && channel.inputs, pid);
exports.outputByPairingId = (channel, pid) => findByPid(channel && channel.outputs, pid);

// Current cached value of an output datapoint, resolved by pairingID.
exports.outputValueByPairingId = (channel, pid) => {
  const dpId = findByPid(channel && channel.outputs, pid);
  return dpId ? channel.outputs[dpId].value : undefined;
};

// Decide the Homey capabilities for a light channel, inferred from the
// datapoints it exposes: on/off always, dim when a brightness datapoint exists.
exports.capabilitiesForChannel = (channel) => {
  const caps = [];
  const hasIn = (pid) => !!findByPid(channel && channel.inputs, pid);
  const hasOut = (pid) => !!findByPid(channel && channel.outputs, pid);
  if (hasIn(PID.ON_OFF_IN) || hasOut(PID.ON_OFF_OUT)) caps.push('onoff');
  if (hasIn(PID.BRIGHTNESS_IN) || hasOut(PID.BRIGHTNESS_OUT)) caps.push('dim');
  return caps;
};
