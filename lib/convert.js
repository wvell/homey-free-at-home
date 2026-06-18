'use strict';

// Pure conversion layer between free@home (everything is a STRING) and Homey
// capability value types. Kept dependency-free and fully unit-tested — this is
// where off-by-one / inversion / type bugs love to hide.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// --- on/off ---
exports.fahToOnoff = (v) => v === '1' || v === 'true';
exports.onoffToFah = (b) => (b ? '1' : '0');

// --- dim: Homey 0..1  <->  free@home "0".."100" ---
exports.fahToDim = (v) => clamp(parseInt(v, 10) || 0, 0, 100) / 100;
exports.dimToFah = (n) => String(Math.round(clamp(n, 0, 1) * 100));
