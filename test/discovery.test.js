'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = require('../lib/discovery');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/configuration.json'), 'utf8'));

test('counts per driver match the real install', () => {
  assert.equal(D.discoverChannels(cfg, 'switch').length, 16);
  assert.equal(D.discoverChannels(cfg, 'light').length, 3); // 3 dimmers (Hue not handled here)
  // Untested device types are no longer mapped, so they surface nothing.
  assert.equal(D.discoverChannels(cfg, 'scene').length, 0);
  assert.equal(D.discoverChannels(cfg, 'button').length, 0);
});

test('entry shape for a dimmer', () => {
  const e = D.discoverChannels(cfg, 'light').find((x) => x.data.id === 'ABB700D2010C/ch0006');
  assert.ok(e, 'dimmer should be discovered');
  assert.ok(e.name.length > 0);
  assert.equal(e.settings.serial, 'ABB700D2010C');
  assert.equal(e.settings.channel, 'ch0006');
  assert.equal(e.settings.functionId, '12');
  assert.deepEqual(e.capabilities.sort(), ['dim', 'onoff']);
});

test('switch entry has only onoff', () => {
  const e = D.discoverChannels(cfg, 'switch')[0];
  assert.deepEqual(e.capabilities, ['onoff']);
  assert.ok(e.data.id.includes('/ch'));
});

test('unmapped fids (media 5A) are not surfaced under any driver', () => {
  const all = [].concat(...['switch', 'light'].map((d) => D.discoverChannels(cfg, d)));
  assert.ok(!all.some((e) => e.data.id.startsWith('A000CD60FC52'))); // a media device (fid 5A, unmapped)
});
