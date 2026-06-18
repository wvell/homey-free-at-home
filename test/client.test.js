'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { FreeAtHomeClient, EMPTY_UUID } = require('../lib/client');

const c = new FreeAtHomeClient({ host: '192.168.1.100', user: 'u', pass: 'p', tls: false });

test('rest datapoint URL', () => {
  assert.equal(
    c._restUrl(`datapoint/${EMPTY_UUID}/ABB1.ch0000.idp0000`),
    'http://192.168.1.100/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/ABB1.ch0000.idp0000'
  );
});

test('basic auth header', () => {
  assert.equal(c._authHeader(), 'Basic ' + Buffer.from('u:p').toString('base64'));
});

test('ws url', () => {
  assert.equal(c._wsUrl(), 'ws://192.168.1.100/fhapi/v1/api/ws');
});

test('tls flips both schemes', () => {
  const s = new FreeAtHomeClient({ host: 'h', user: 'u', pass: 'p', tls: true });
  assert.ok(s._restUrl('configuration').startsWith('https://'));
  assert.ok(s._wsUrl().startsWith('wss://'));
});

test('parse WS frame -> datapoint events', () => {
  const frame = JSON.stringify({
    [EMPTY_UUID]: { datapoints: { 'ABB700D2010C/ch0006/odp0000': '1', 'ABB700D2010C/ch0006/odp0001': '50' } },
  });
  assert.deepEqual(c._parseFrame(frame), [
    { serial: 'ABB700D2010C', channel: 'ch0006', datapoint: 'odp0000', value: '1' },
    { serial: 'ABB700D2010C', channel: 'ch0006', datapoint: 'odp0001', value: '50' },
  ]);
});

test('parse ignores malformed keys and non-datapoint frames', () => {
  assert.deepEqual(c._parseFrame('not json'), []);
  assert.deepEqual(c._parseFrame(JSON.stringify({ [EMPTY_UUID]: { devicesAdded: ['x'] } })), []);
  const frame = JSON.stringify({ [EMPTY_UUID]: { datapoints: { 'bad/key': '1' } } });
  assert.deepEqual(c._parseFrame(frame), []);
});
