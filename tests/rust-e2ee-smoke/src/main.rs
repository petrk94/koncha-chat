//! Isolated interoperability proof using upstream audited Olm (Double Ratchet).
//! NOT integrated into Koncha's JS clients or PHP relay. All strings are dummy.
use anyhow::{Result, bail};
use vodozemac::olm::{Account, OlmMessage, SessionConfig};

fn main() -> Result<()> {
    let alice = Account::new();
    let mut bob = Account::new();

    bob.generate_one_time_keys(1);
    let bob_otk = *bob.one_time_keys().values().next().expect("one-time prekey required");

    // Standard upstream Olm 3DH initiation and Double-Ratchet session.
    let mut alice_session = alice.create_outbound_session(
        SessionConfig::version_1(), bob.curve25519_key(), bob_otk)?;
    bob.mark_keys_as_published();

    let first = "こんにちは。これはテストです。";
    let initial = alice_session.encrypt(first)?;
    if let OlmMessage::PreKey(prekey) = initial {
        let inbound = bob.create_inbound_session(
            SessionConfig::version_1(), alice.curve25519_key(), &prekey)?;
        let mut bob_session = inbound.session;
        assert_eq!(inbound.plaintext, first.as_bytes());
        assert_eq!(alice_session.session_id(), bob_session.session_id());

        let reply = "Hello, this is a ratcheted test.";
        let encrypted_reply = bob_session.encrypt(reply)?;
        let got_reply = alice_session.decrypt(&encrypted_reply)?;
        assert_eq!(got_reply, reply.as_bytes());

        let followup = "A second message after receiving the reply.";
        let encrypted_followup = alice_session.encrypt(followup)?;
        let got_followup = bob_session.decrypt(&encrypted_followup)?;
        assert_eq!(got_followup, followup.as_bytes());

        println!("PASS: vodozemac Olm prekey handshake and bidirectional ratcheted text.");
        println!("NOT TESTED: Koncha device registration, PHP transport, session persistence or release audit.");
        Ok(())
    } else {
        bail!("New Olm session must start with a prekey message")
    }
}
