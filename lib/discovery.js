'use strict';

const { driverForFunctionId } = require('./functionIds');
const { capabilitiesForChannel } = require('./pairing');

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

// Default Homey capability set per driver. The `light` driver overrides this
// per-channel via capabilitiesForChannel (dim is optional).
const DEFAULT_CAPS = {
  switch: ['onoff'],
  light: ['onoff'],
};

// A channel is "configured" (worth showing) if it has a real display name or a room.
function isConfigured(ch) {
  const name = (ch.displayName || '').trim();
  return (name && name !== 'Ⓐ') || !!ch.room;
}

// Walk the cached configuration and return pairable entries for one driver.
// Entry shape matches Homey's onPairListDevices contract.
function discoverChannels(config, driverId) {
  const sys = config && config[EMPTY_UUID];
  const out = [];
  if (!sys || !sys.devices) return out;

  for (const [serial, dev] of Object.entries(sys.devices)) {
    for (const [chId, ch] of Object.entries(dev.channels || {})) {
      if (driverForFunctionId(ch.functionID) !== driverId) continue;
      if (!isConfigured(ch)) continue;

      let capabilities = DEFAULT_CAPS[driverId] || [];
      if (driverId === 'light') capabilities = capabilitiesForChannel(ch);

      const rawName = (ch.displayName || '').trim();
      const name = rawName && rawName !== 'Ⓐ' ? rawName : `${dev.displayName || serial} ${chId}`;
      out.push({
        name,
        data: { id: `${serial}/${chId}` },
        settings: {
          serial,
          channel: chId,
          functionId: String(ch.functionID).toUpperCase(),
        },
        capabilities,
      });
    }
  }
  return out;
}

exports.discoverChannels = discoverChannels;
