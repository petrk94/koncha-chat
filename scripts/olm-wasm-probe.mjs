/**
 * Isolated proof that the audited Matrix Rust crypto WASM code can create
 * independent device identities. NOT an E2EE Koncha transport implementation.
 * A full Olm/Megolm relay and session state machine is required before use.
 *
 * Run in a network-enabled development environment:
 * npm install --no-save --no-package-lock @matrix-org/matrix-sdk-crypto-wasm@19.0.0
 * node scripts/olm-wasm-probe.mjs
 */
import assert from 'node:assert/strict';
import { initAsync, OlmMachine, UserId, DeviceId } from '@matrix-org/matrix-sdk-crypto-wasm';

await initAsync();
const alice = await OlmMachine.initialize(new UserId('@alice:koncha.invalid'), new DeviceId('ALICE01'));
const bob = await OlmMachine.initialize(new UserId('@bob:koncha.invalid'), new DeviceId('BOB01'));
try {
  const a = alice.identityKeys, b = bob.identityKeys;
  assert.ok(a?.ed25519 && a?.curve25519 && b?.ed25519 && b?.curve25519,
    'Rust crypto did not produce Olm device identity keys');
  const toString = key => typeof key.toBase64 === 'function' ? key.toBase64() : String(key);
  const aKey = toString(a.curve25519), bKey = toString(b.curve25519);
  assert.ok(aKey.length >= 40 && bKey.length >= 40 && aKey !== bKey,
    'Device identity keys missing or identical');
  // Do not log public keys: even these can become long-term correlation identifiers.
  console.log('PASS: Matrix Rust crypto WASM: two distinct device identities created.');
  console.log('NOT TESTED: prekey upload, session initiation, Double Ratchet messages, recovery or audit.');
} finally {
  alice.close();
  bob.close();
}
