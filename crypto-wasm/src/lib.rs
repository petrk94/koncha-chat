//! Small binding onto the *upstream* vodozemac Olm/Double Ratchet implementation.
//! All cryptographic operations, key generation and ratchet advancement are
//! delegated to vodozemac. Do not add a custom ratchet here.
//! Returns serialized sensitive session state: callers MUST seal it at rest.
//! This binding is unreviewed glue. It does not imply an audited messenger.
use vodozemac::{Curve25519PublicKey, olm::{Account, AccountPickle, Session, SessionPickle, SessionConfig, OlmMessage}};
use wasm_bindgen::prelude::*;
use serde_json::{json, Value};

fn js_error(error: impl core::fmt::Display) -> JsValue { JsValue::from_str(&error.to_string()) }
fn parse_account(raw: &str) -> Result<Account, JsValue> {
    if raw.len() > 262144 { return Err(js_error("account state is too large")); }
    let pickle: AccountPickle = serde_json::from_str(raw).map_err(js_error)?;
    Ok(Account::from_pickle(pickle))
}
fn parse_session(raw: &str) -> Result<Session, JsValue> {
    if raw.len() > 262144 { return Err(js_error("session state is too large")); }
    let pickle: SessionPickle = serde_json::from_str(raw).map_err(js_error)?;
    Ok(Session::from_pickle(pickle))
}
fn key(raw: &str) -> Result<Curve25519PublicKey, JsValue> {
    Curve25519PublicKey::from_base64(raw).map_err(js_error)
}
fn message(raw: &str) -> Result<OlmMessage, JsValue> {
    if raw.len() > 16000 { return Err(js_error("message is too large")); }
    serde_json::from_str(raw).map_err(js_error)
}
fn encode(v: Value) -> Result<String, JsValue> { serde_json::to_string(&v).map_err(js_error) }
fn check_text(s: &str) -> Result<(), JsValue> {
    if s.as_bytes().len() > 7500 { return Err(js_error("message plaintext exceeds bound")); }
    Ok(())
}

/// Brand-new Olm account. Return state and identity curve/ed25519 public keys.
#[wasm_bindgen]
pub fn create_account() -> Result<String, JsValue> {
    let account = Account::new();
    encode(json!({
      "account": account.pickle(),
      "curve": account.curve25519_key().to_base64(),
      "ed": account.ed25519_key().to_base64()
    }))
}

/// Generate one single-use prekey and atomically persist the changed account
/// BEFORE exposing that prekey in the invite. A caller rotates prekeys per link.
#[wasm_bindgen]
pub fn generate_prekey(account_state: &str) -> Result<String, JsValue> {
    let mut account = parse_account(account_state)?;
    account.generate_one_time_keys(1);
    let one = *account.one_time_keys().values().next().ok_or(js_error("no prekey generated"))?;
    account.mark_keys_as_published();
    encode(json!({
      "account": account.pickle(),
      "curve": account.curve25519_key().to_base64(),
      "ed": account.ed25519_key().to_base64(),
      "oneTimeKey": one.to_base64()
    }))
}

/// Invitation recipient (the first sender): 3DH and initial Olm prekey message.
#[wasm_bindgen]
pub fn start_outbound(account_state: &str, recipient_curve: &str, recipient_prekey: &str, plaintext: &str) -> Result<String, JsValue> {
    check_text(plaintext)?;
    let account = parse_account(account_state)?;
    let mut session = account.create_outbound_session(SessionConfig::version_1(), key(recipient_curve)?, key(recipient_prekey)?).map_err(js_error)?;
    let message = session.encrypt(plaintext).map_err(js_error)?;
    encode(json!({"session":session.pickle(),"message":message,"curve":account.curve25519_key().to_base64()}))
}

/// Inviter accepts exactly one prekey message from the peer. The caller must
/// validate room-binding and identity before committing this account/session.
#[wasm_bindgen]
pub fn accept_inbound(account_state: &str, sender_curve: &str, message_json: &str) -> Result<String, JsValue> {
    let mut account = parse_account(account_state)?;
    let m = message(message_json)?;
    let OlmMessage::PreKey(prekey) = m else { return Err(js_error("first message must be an Olm prekey")); };
    let result = account.create_inbound_session(SessionConfig::version_1(), key(sender_curve)?, &prekey).map_err(js_error)?;
    let text = String::from_utf8(result.plaintext).map_err(js_error)?;
    check_text(&text)?;
    encode(json!({"account":account.pickle(),"session":result.session.pickle(),"text":text}))
}

/// Advance the sending chain. Callers persist the returned pickle and queued
/// ciphertext in one durable transaction BEFORE the transport sends the packet.
#[wasm_bindgen]
pub fn seal_message(session_state: &str, plaintext: &str) -> Result<String, JsValue> {
    check_text(plaintext)?;
    let mut session = parse_session(session_state)?;
    let message = session.encrypt(plaintext).map_err(js_error)?;
    encode(json!({"session":session.pickle(),"message":message}))
}

/// Advance the receiving chain only after successful authentication. The app
/// must persist new session state and locally encrypted visible message together.
#[wasm_bindgen]
pub fn open_message(session_state: &str, message_json: &str) -> Result<String, JsValue> {
    let mut session = parse_session(session_state)?;
    let text = String::from_utf8(session.decrypt(&message(message_json)?).map_err(js_error)?).map_err(js_error)?;
    check_text(&text)?;
    encode(json!({"session":session.pickle(),"text":text}))
}
