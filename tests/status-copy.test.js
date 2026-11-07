import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../public/i18n.js';

// Privacy/security-relevant UI copy must follow capabilities, not the original scaffold.
test('DE/EN/JA diagnostics do not promise working Web Push or local AI inference', () => {
  for (const lang of ['de', 'en', 'ja']) {
    const push = translate('pwaCaution', lang);
    const ai = translate('localAIInstalled', lang);
    assert.ok(push.length > 40, `${lang}: Push deployment caveat was lost`);
    assert.ok(ai.length > 15, `${lang}: AI inference caveat was lost`);
  }
  assert.match(translate('pwaCaution', 'de'), /nicht auf realen Geräten geprüft/);
  assert.match(translate('pwaCaution', 'en'), /not been verified/);
  assert.match(translate('pwaCaution', 'ja'), /未検証/);
  assert.match(translate('localAIInstalled', 'de'), /noch nicht geprüft/);
  assert.match(translate('localAIInstalled', 'en'), /not verified/);
  assert.match(translate('localAIInstalled', 'ja'), /未検証/);
});
