'use strict';

const test = require('node:test');
const assert = require('node:assert');
const C = require('../lib/convert');

test('onoff fah->homey', () => {
  assert.equal(C.fahToOnoff('1'), true);
  assert.equal(C.fahToOnoff('0'), false);
  assert.equal(C.fahToOnoff(''), false);
});

test('onoff homey->fah', () => {
  assert.equal(C.onoffToFah(true), '1');
  assert.equal(C.onoffToFah(false), '0');
});

test('dim fah->homey 0..1', () => {
  assert.equal(C.fahToDim('0'), 0);
  assert.equal(C.fahToDim('100'), 1);
  assert.equal(C.fahToDim('50'), 0.5);
});

test('dim homey->fah 0..100 integer string', () => {
  assert.equal(C.dimToFah(0), '0');
  assert.equal(C.dimToFah(1), '100');
  assert.equal(C.dimToFah(0.5), '50');
  assert.equal(C.dimToFah(0.337), '34');
  assert.equal(C.dimToFah(2), '100'); // clamps
  assert.equal(C.dimToFah(-1), '0');
});
