'use strict';

const test = require('node:test');
const assert = require('node:assert');
const R = require('../lib/router');

test('routeKey builds the <serial>/<channel> registry key', () => {
  assert.equal(R.routeKey('ABB700D2010C', 'ch0006'), 'ABB700D2010C/ch0006');
});
