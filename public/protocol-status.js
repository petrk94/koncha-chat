/**
 * Accurate security capability representation. Neither a device signature nor
 * a room-key AES-GCM envelope creates a Double Ratchet session.
 * This must not be changed to 'true' until an audited browser protocol is
 * integrated, interoperability-tested, and the legacy room mode retired.
 */
export const PROTOTYPE_PROTOCOL = Object.freeze({
  id: 'koncha-shared-room-key-v1',
  encryptedOnDevice: true,
  signedByDevice: true,
  forwardSecret: false,
  postCompromiseSecure: false,
  independentlyAudited: false,
  productionReady: false,
});
export function requireForwardSecureProtocol(protocol = PROTOTYPE_PROTOCOL) {
  if (!protocol.forwardSecret || !protocol.postCompromiseSecure || !protocol.independentlyAudited) {
    throw new Error('Forward-secure, independently reviewed E2EE is not available');
  }
  return protocol;
}
