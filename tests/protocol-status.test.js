import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOTYPE_PROTOCOL, requireForwardSecureProtocol } from '../public/protocol-status.js';

test('current 0.5 encryption never claims forward secrecy or independent audit', () => {
  assert.equal(PROTOTYPE_PROTOCOL.encryptedOnDevice,true);
  assert.equal(PROTOTYPE_PROTOCOL.forwardSecret,false);
  assert.equal(PROTOTYPE_PROTOCOL.productionReady,false);
  assert.throws(()=>requireForwardSecureProtocol(),/not available/);
});
