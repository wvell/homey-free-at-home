'use strict';

const test = require('node:test');
const assert = require('node:assert');
const F = require('../lib/functionIds');

test('fid -> driver', () => {
  assert.equal(F.driverForFunctionId('7'), 'switch');
  assert.equal(F.driverForFunctionId('12'), 'light');
  assert.equal(F.driverForFunctionId('1810'), 'light');
});

test('untested / unmapped fids return null', () => {
  assert.equal(F.driverForFunctionId('40'), null); // Hue ambiance (use the Hue app)
  assert.equal(F.driverForFunctionId('9'), null); // blinds (not shipped)
  assert.equal(F.driverForFunctionId('23'), null); // thermostat (not shipped)
  assert.equal(F.driverForFunctionId('11'), null); // motion (not shipped)
  assert.equal(F.driverForFunctionId('5A'), null); // media
  assert.equal(F.driverForFunctionId(''), null);
  assert.equal(F.driverForFunctionId(null), null);
  assert.equal(F.driverForFunctionId(undefined), null);
});
