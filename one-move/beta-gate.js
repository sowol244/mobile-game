// BETA password gate. Only a salted PBKDF2-SHA256 hash of the 4-digit code is stored here, never the code itself.
// (A 4-digit code has just 10,000 possibilities, so this keeps casual readers out; it is not strong protection.)
export const ITER = 200000;
export const SALT_HEX = "cd534796791f264d3f25810c5757d6aa";
export const HASH_HEX = "419cfdda122ee3d3e1b821318bf3044ea6c5b9788a36ca3d71c8db06bff50b5a";

const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
const unhex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));

// Same result as node: crypto.pbkdf2Sync(pin, salt, iter, 32, "sha256")
export async function derive(pin, saltHex = SALT_HEX, iter = ITER, subtle = globalThis.crypto && globalThis.crypto.subtle) {
  const key = await subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: iter }, key, 256));
}
// Compares every character, so the time taken does not depend on where the first difference is.
export function sameHex(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
// "ok" | "bad" | "unsupported" (no crypto.subtle, e.g. a non-secure page). Override the last four arguments in tests only.
export async function check(pin, saltHex = SALT_HEX, hashHex = HASH_HEX, iter = ITER, subtle = globalThis.crypto && globalThis.crypto.subtle) {
  if (!subtle || !subtle.deriveBits) return "unsupported";
  if (!/^\d{4}$/.test(pin)) return "bad";
  return sameHex(await derive(pin, saltHex, iter, subtle), hashHex) ? "ok" : "bad";
}
