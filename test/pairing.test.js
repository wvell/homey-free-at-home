'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../lib/pairing');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/configuration.json'), 'utf8'));
const sys = cfg['00000000-0000-0000-0000-000000000000'];
const chan = (s, c) => sys.devices[s].channels[c];

test('resolve input/output datapoints by pairingID on a real dimmer', () => {
  const ch = chan('ABB700D2010C', 'ch0006'); // a real dimmer channel
  assert.equal(P.inputByPairingId(ch, P.PID.ON_OFF_IN), 'idp0000');
  assert.equal(P.inputByPairingId(ch, P.PID.BRIGHTNESS_IN), 'idp0002');
  assert.equal(P.outputByPairingId(ch, P.PID.ON_OFF_OUT), 'odp0000');
  assert.equal(P.outputByPairingId(ch, P.PID.BRIGHTNESS_OUT), 'odp0001');
});

test('outputValueByPairingId reads the cached value', () => {
  const ch = chan('ABB700D2010C', 'ch0006');
  assert.equal(P.outputValueByPairingId(ch, P.PID.ON_OFF_OUT), '1');
  assert.equal(P.outputValueByPairingId(ch, P.PID.BRIGHTNESS_OUT), '100');
});

test('capabilitiesForChannel infers caps for dimmer and switch', () => {
  assert.deepEqual(P.capabilitiesForChannel(chan('ABB700D2010C', 'ch0006')).sort(), ['dim', 'onoff']);
  assert.deepEqual(P.capabilitiesForChannel(chan('ABB700D46D9D', 'ch0006')), ['onoff']); // switch actuator
});

test('missing pairingID returns null', () => {
  assert.equal(P.inputByPairingId(chan('ABB700D46D9D', 'ch0006'), 9999), null);
  assert.equal(P.inputByPairingId(null, 1), null);
});
