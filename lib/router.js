'use strict';

// The device-registry key for a free@home channel: the single definition of the
// `<serial>/<chXXXX>` convention shared by the app's WS routing and each device's
// data.id. Kept in its own (unit-tested) module so it stays Homey-free.
const routeKey = (serial, channel) => `${serial}/${channel}`;

module.exports = { routeKey };
