// 룩스 앤 움브라 — 기록 코드: progress packed into a short text code. Pure (no DOM), so node tests can import it.
//
// One entry per stage, in stage order: null (not cleared) or { s: [shard1, shard2, shard3] } (cleared).
// Bytes before scrambling:   crc32(4) | marker(1) | stage count N(1) | N nibbles (cleared bit, 3 shard bits)
// The CRC covers marker, N and the nibbles, seeded with a fixed salt. Everything after the CRC is XOR-ed with a keystream
// from a fixed seed mixed with the CRC, so different states never share a prefix and the text looks random.
// Text: Crockford base32 in groups of 4 joined by "-". Stage revisions and times stay outside this progress-only code.

const MARKER = 0xB7;
const SALT = 0x4C55584F;     // fixed secret salt for the checksum
const SEED = 0x9E3779B1;     // fixed seed for the keystream
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crc32(bytes, init) {
  let c = init >>> 0;
  for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}
function keystream(seed, n) {  // mulberry32
  let a = seed >>> 0; const out = [];
  for (let i = 0; i < n; i++) { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); out.push(((t ^ (t >>> 14)) >>> 0) & 255); }
  return out;
}
const toBase32 = bytes => {
  let bits = 0, acc = 0, out = '';
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { out += ALPHABET[(acc >> (bits - 5)) & 31]; bits -= 5; } acc &= (1 << bits) - 1; }
  if (bits) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
};
const fromBase32 = text => {   // null when a character is not base32 or the padding bits are not zero
  let bits = 0, acc = 0; const out = [];
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch); if (v < 0) return null;
    acc = (acc << 5) | v; bits += 5;
    if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; acc &= (1 << bits) - 1; }
  }
  return acc === 0 ? out : null;
};

// build a code from raw parts (tests use it to make codes with another marker)
export function buildCode(entries, marker = MARKER) {
  const n = entries.length;
  const plain = [marker, n];
  for (let i = 0; i < n; i += 2) {
    const nib = e => (e ? 8 | (e.s[0] ? 4 : 0) | (e.s[1] ? 2 : 0) | (e.s[2] ? 1 : 0) : 0);
    plain.push((nib(entries[i]) << 4) | (i + 1 < n ? nib(entries[i + 1]) : 0));
  }
  const crc = crc32(plain, SALT);
  const head = [crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
  const ks = keystream((SEED ^ crc) >>> 0, plain.length);
  const text = toBase32([...head, ...plain.map((b, i) => b ^ ks[i])]);
  return text.match(/.{1,4}/g).join('-');
}
export const encodeProgress = entries => buildCode(entries);

// -> { ok: true, entries } | { ok: false, error: 'format' | 'marker' | 'more' }
export function decodeProgress(text, maxStages) {
  const clean = String(text).toUpperCase().replace(/[\s-]+/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  const bytes = fromBase32(clean);
  if (!bytes || bytes.length < 6) return { ok: false, error: 'format' };
  const crc = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const ks = keystream((SEED ^ crc) >>> 0, bytes.length - 4);
  const plain = bytes.slice(4).map((b, i) => b ^ ks[i]);
  if (crc32(plain, SALT) !== crc) return { ok: false, error: 'format' };
  if (plain[0] !== MARKER) return { ok: false, error: 'marker' };
  const n = plain[1];
  if (plain.length !== 2 + Math.ceil(n / 2) || clean.length !== Math.ceil((bytes.length * 8) / 5)) return { ok: false, error: 'format' };
  if (n > maxStages) return { ok: false, error: 'more' };
  const entries = [];
  for (let i = 0; i < n; i++) {
    const nib = (plain[2 + (i >> 1)] >> (i % 2 ? 0 : 4)) & 15;
    entries.push(nib & 8 ? { s: [!!(nib & 4), !!(nib & 2), !!(nib & 1)] } : null);
  }
  return { ok: true, entries };
}

// the two admin codes (normal codes): every stage cleared with all shards, and a blank record
export const ADMIN_ALL = 'GRC6-3NQ7-KKJR-TE3Z-YZTK-EKMA-A687-D0AY-EZJ0-11XH-4230-JQZM-2FHN-ZTF1-PZMH-TB0V-F4AQ-YTNQ-MM';
export const ADMIN_RESET = 'WCJ1-054V-R0H5-XBYZ-4HZ0-5TC3-GPWZ-Q8R0-CHZG-11EB-S0XA-RNNT-4XB8-2NCG-V59K-3KJB-PFRX-Z0B8-H4';

// ---------- helpers shared by the game and the tests ----------
export const normalizeCode = text => String(text).toUpperCase().replace(/[\s-]+/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
export const isAdminCode = text => { const t = normalizeCode(text); return t === normalizeCode(ADMIN_ALL) || t === normalizeCode(ADMIN_RESET); };
export const countStars = entries => entries.reduce((a, e) => a + (e ? e.s.filter(Boolean).length : 0), 0);
export const countCleared = entries => entries.filter(Boolean).length;

// Importing replaces the whole record: a stage is cleared exactly when the code says so, stars follow the code, and the
// local best time survives only for stages that stay cleared (the rest get the "no time yet" value 99). `ids` are stage ids in order.
export function importProgress(entries, ids, old) {
  const out = {};
  ids.forEach((id, i) => { const e = entries[i]; if (e) out[id] = { s: [...e.s], best: old[id] ? old[id].best : 99 }; });
  return out;
}
export const progressEntries = (progress, ids) => ids.map(id => (progress[id] ? { s: [...progress[id].s] } : null));
