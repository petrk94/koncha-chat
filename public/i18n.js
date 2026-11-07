// UI strings are local resources: no remote localization service.
export const LANGUAGES = ['de', 'en', 'ja'];
export function browserLanguage(preferences = globalThis.navigator?.languages || [globalThis.navigator?.language || 'en']) {
  for (const preference of preferences) {
    const code = String(preference).toLowerCase().split('-')[0];
    if (LANGUAGES.includes(code)) return code;
  }
  return 'en';
}
const dictionary = {
  de: {
    tagline:'Sprich, wie du bist.',prototype:'TESTVERSION · NICHT SICHER',language:'Sprache',reset:'Zurücksetzen',welcome:'Willkommen bei Koncha',onboardTitle:'Privat sprechen. Sprachen verbinden.',onboardLead:'Ein experimenteller Messenger ohne öffentliche Kontaktsuche, Telefonnummer oder zentrale Benutzerregistrierung.',testOnly:'Nur für Testnachrichten.',notAudited:'Keine geprüfte Identitätsbindung, keine Forward Secrecy. Nicht für vertrauliche Nachrichten geeignet.',storageTitle:'Wo liegen deine Daten?',localTitle:'Nur im Browser',localText:'Anzeigename, zufällige Gerätekennung, Raumschlüssel und verschlüsselte Nachrichten in IndexedDB. Browserdaten können unwiederbringlich verloren gehen.',serverTitle:'Auf deinem Test-Relay',serverText:'Raum-ID, Zugangsprüfsumme, verschlüsselte Nachrichten und Zeitstempel. Nachrichtendaten werden nach 24 Stunden beim nächsten Zugriff bereinigt; Logs und Backups können länger bestehen.',noAccountTitle:'Keine zentrale Registrierung',noAccountText:'Keine E-Mail und kein Passwort. Keine Wiederherstellung oder Synchronisierung zwischen Browsern. Jeder Browser ist ein eigenes Testgerät.',nicknameLabel:'Dein lokaler Anzeigename',nicknamePlaceholder:'z. B. Yuki oder Alex',ack:'Ich verstehe die Risiken und die lokale Speicherung dieses Testprototyps.',start:'Lokale Identität erstellen',lobbyEyebrow:'Dein privater Raum',lobbyTitle:'Ein Gespräch beginnt mit Vertrauen.',lobbyLead:'Lade genau eine Person mit einem einmaligen, 60 Minuten gültigen Link ein. Der Link wird nach Verwendung ungültig.',deviceIdentity:'Lokale Gerätekennung',createRoom:'Neuen Testraum erstellen',pending:'Einladung erkannt',joinTitle:'Du wurdest eingeladen.',joinHint:'Die Einladung ist einmalig. Öffne sie nur, wenn du den Absender kennst.',join:'Einladung annehmen',recentRoomTitle:'Letztes Gespräch',recentRoomHint:'Auf diesem Browser lokal gespeichert.',resume:'Gespräch fortsetzen',httpsHint:'Für zwei physische Geräte brauchst du HTTPS. localhost erreicht nur den lokalen Rechner.',iosHint:'iPhone: Safari → Teilen → Zum Home-Bildschirm. Android: Browsermenü → App installieren.',chatEyebrow:'Dein Gespräch',experimental:'Testmodus',sidebarHint:'Einmalige Einladungen. Keine Kontaktsuche. Dies ist noch kein authentifizierter Messenger.',newInvite:'Einladung erzeugen',leave:'Zurück',revoke:'Widerrufen',roomWarning:'Experimentelle Verschlüsselung, keine überprüfte Absenderidentität. Keine Geheimnisse senden.',chatName:'Privater Testraum',connecting:'Verbinde…',connected:'Verbunden',offline:'Offline / Fehler',preferences:'Gesprächseinstellungen öffnen',preferencesTitle:'Gesprächseinstellungen',romaji:'Kana als Romaji anzeigen (ohne Kanji)',enterSend:'Enter sendet · Shift+Enter neue Zeile',translateToggle:'Eingehende Nachrichten lokal übersetzen',sourceLanguage:'Originalsprache',targetLanguage:'Übersetzung nach',translationHint:'Nur in unterstützten Browsern. Keine Cloud-Übersetzung.',screenshotHint:'Screenshots lassen sich im Browser nicht zuverlässig verhindern oder erkennen.',emptyTitle:'Hier beginnt euer Gespräch.',emptyText:'Sende eine Testnachricht oder teile eine einmalige Einladung.',messageLabel:'Nachricht',messagePlaceholder:'Nachricht schreiben…',send:'Senden',composerTip:'Nur Testnachrichten. Keine Cloud-KI. Keine verifizierte Ende-zu-Ende-Sicherheit.',footer:'Experimental · Local-first · Ohne Tracking',invalidName:'Bitte einen Namen eingeben.',confirmAck:'Bitte den Testhinweis bestätigen.',localError:'Lokale Speicherung fehlgeschlagen',roomError:'Raum konnte nicht geöffnet werden',serverError:'Server nicht erreichbar',sendError:'Nachricht konnte nicht gesendet werden',unsupported:'Browser benötigt HTTPS, Web Crypto und IndexedDB',resetConfirm:'ALLE lokalen Koncha-Daten samt Schlüsseln und Chats löschen? Nachrichten auf dem Server bleiben davon unberührt.',resetError:'Zurücksetzen fehlgeschlagen',inviteCopied:'Einmalige Einladung kopiert. Sie gilt nur 60 Minuten.',inviteCreated:'Einladung erzeugt. Link bitte direkt kopieren und vertraulich teilen.',inviteExpires:'Einladung läuft ab in',inviteExpired:'Dieser Einladungslink ist abgelaufen. Bitte um einen neuen Link bitten.',inviteUnavailable:'Dieser Einladungslink wurde bereits verwendet oder widerrufen. Bitte um einen neuen Link bitten.',inviteInvalid:'Einladungslink ist ungültig.',invitationError:'Einladung konnte nicht eingelöst werden',revokeDone:'Einladung widerrufen.',revokeError:'Einladung konnte nicht widerrufen werden',inviteMissing:'Noch keine Einladung aktiv.',inviteNotice:'Wer den Link zuerst einlöst, erhält Zugang. Bereits verbundene Geräte behalten Zugriff.',translationUnsupported:'Lokale Übersetzung ist in diesem Browser nicht verfügbar. Safari, Firefox und mobile Browser bieten sie derzeit nicht an.',translationAvailable:'Lokale Übersetzung aktiv. Nur Testnachrichten übersetzen.',translationDownload:'Das lokale Sprachmodell wird geladen…',translationFailed:'Übersetzung konnte nicht aktiviert werden.',chooseDifferent:'Bitte unterschiedliche Quell- und Zielsprachen wählen.',languageLabel:'Sprache',copyPrompt:'Einmaliger Einladungslink:',localeChanged:'Sprache geändert',oldInvite:'Alte Einladungslinks sind nicht mehr gültig. Bitte neuen Link erzeugen.',inviteSecurity:'Einmalig · 60 Minuten',noTranslation:'Übersetzung nicht verfügbar',chatOpen:'Gespräch öffnen',emojiLabel:'Emoji auswählen'
  },
  en: {
    tagline:'Talk your way.',prototype:'EXPERIMENT · NOT SECURE',language:'Language',reset:'Reset',welcome:'Welcome to Koncha',onboardTitle:'Speak privately. Connect across languages.',onboardLead:'An experimental messenger without public contact search, phone numbers or central user accounts.',testOnly:'Test messages only.',notAudited:'No verified identity binding and no forward secrecy. Do not use for confidential conversations.',storageTitle:'Where is data stored?',localTitle:'Only in this browser',localText:'Display name, random device ID, room secret and encrypted messages in IndexedDB. Clearing browser storage can permanently remove access.',serverTitle:'On your test relay',serverText:'Room ID, access verifier, encrypted messages and timestamps. Messages expire after 24 hours on next access; logs and backups may last longer.',noAccountTitle:'No central account',noAccountText:'No email or password. No recovery or synchronization between browsers. Each browser is a separate test device.',nicknameLabel:'Local display name',nicknamePlaceholder:'e.g. Yuki or Alex',ack:'I understand the risks and local storage of this experimental prototype.',start:'Create local identity',lobbyEyebrow:'Your private space',lobbyTitle:'Every conversation starts with trust.',lobbyLead:'Invite exactly one person using a single-use link valid for 60 minutes. It stops working when redeemed.',deviceIdentity:'Local device identifier',createRoom:'Create test conversation',pending:'Invitation found',joinTitle:'You have been invited.',joinHint:'This is a one-time invitation. Accept only if you trust the sender.',join:'Accept invitation',recentRoomTitle:'Previous conversation',recentRoomHint:'Saved locally in this browser.',resume:'Continue conversation',httpsHint:'Two physical devices need HTTPS. localhost is only accessible on the same computer.',iosHint:'iPhone: Safari → Share → Add to Home Screen. Android: Browser menu → Install app.',chatEyebrow:'Your conversation',experimental:'Test mode',sidebarHint:'One-time invitations. No contact lookup. This is not yet an authenticated messenger.',newInvite:'Create invitation',leave:'Back',revoke:'Revoke',roomWarning:'Experimental encryption, no verified sender identity. Do not send secrets.',chatName:'Private test conversation',connecting:'Connecting…',connected:'Connected',offline:'Offline / error',preferences:'Open chat settings',preferencesTitle:'Chat preferences',romaji:'Show kana as romaji (no kanji)',enterSend:'Enter sends · Shift+Enter new line',translateToggle:'Translate incoming messages locally',sourceLanguage:'Source language',targetLanguage:'Translate to',translationHint:'Only in supported browsers. No cloud translation.',screenshotHint:'Websites cannot reliably prevent or detect screenshots.',emptyTitle:'Your conversation starts here.',emptyText:'Send a test message or share a one-time invitation.',messageLabel:'Message',messagePlaceholder:'Write a message…',send:'Send',composerTip:'Test messages only. No cloud AI. No verified end-to-end security.',footer:'Experimental · Local-first · No tracking',invalidName:'Please enter a name.',confirmAck:'Please confirm the prototype warning.',localError:'Local storage failed',roomError:'Could not open conversation',serverError:'Server unavailable',sendError:'Could not send message',unsupported:'Browser requires HTTPS, Web Crypto and IndexedDB',resetConfirm:'Delete ALL local Koncha data, including keys and chats? Server messages are NOT deleted.',resetError:'Reset failed',inviteCopied:'One-time link copied. Valid for 60 minutes.',inviteCreated:'Invitation created. Share the link privately.',inviteExpires:'Invitation expires in',inviteExpired:'This invitation has expired. Ask for a new invitation.',inviteUnavailable:'This invitation was already used or revoked. Ask for a new invitation.',inviteInvalid:'Invalid invitation link.',invitationError:'Unable to redeem invitation',revokeDone:'Invitation revoked.',revokeError:'Unable to revoke invitation',inviteMissing:'No active invitation.',inviteNotice:'Whoever redeems the link first gains access. Existing devices retain access.',translationUnsupported:'Local translation is unavailable in this browser. Safari, Firefox and mobile browsers do not currently support this API.',translationAvailable:'Local translation enabled. Use test messages only.',translationDownload:'Downloading local language model…',translationFailed:'Could not enable local translation.',chooseDifferent:'Choose different source and target languages.',languageLabel:'Language',copyPrompt:'One-time invite URL:',localeChanged:'Language changed',oldInvite:'Old invitation URLs are no longer valid. Create a new invitation.',inviteSecurity:'Single use · 60 min',noTranslation:'Translation unavailable',chatOpen:'Open chat',emojiLabel:'Choose emoji'
  },
  ja: {
    tagline:'あなたらしく話そう。',prototype:'試作版・安全性未検証',language:'言語',reset:'初期化',welcome:'Konchaへようこそ',onboardTitle:'プライバシーを守り、言葉をつなぐ。',onboardLead:'電話番号・公開連絡先検索・中央アカウント登録のない試験的なメッセンジャーです。',testOnly:'テストメッセージ専用。',notAudited:'本人確認や前方秘匿性は実装・検証されていません。機密情報を送らないでください。',storageTitle:'データの保存場所',localTitle:'このブラウザー内',localText:'表示名、ランダムな端末ID、ルームの鍵、暗号化されたメッセージをIndexedDBに保存します。ブラウザーデータを削除すると復元できません。',serverTitle:'テスト用中継サーバー',serverText:'ルームID、認証用ハッシュ、暗号化されたメッセージ、時刻を保存します。メッセージは24時間後、次回アクセス時に削除します。ログやバックアップは別です。',noAccountTitle:'中央アカウントなし',noAccountText:'メールアドレスやパスワードは不要。復旧・ブラウザー間の同期機能はありません。ブラウザーごとに別の端末として扱います。',nicknameLabel:'この端末での表示名',nicknamePlaceholder:'例：ゆき、Alex',ack:'この試作版のリスクと端末内保存について理解しました。',start:'ローカルIDを作成',lobbyEyebrow:'プライベートルーム',lobbyTitle:'信頼から始まる会話。',lobbyLead:'60分間だけ有効な使い捨てリンクで、1人を招待できます。使用後は無効になります。',deviceIdentity:'ローカル端末ID',createRoom:'テストルームを作成',pending:'招待リンクを確認',joinTitle:'招待が届きました。',joinHint:'このリンクは一度だけ使用できます。送信者が信頼できる場合のみ開いてください。',join:'招待を承諾する',recentRoomTitle:'前回の会話',recentRoomHint:'このブラウザーに保存されています。',resume:'会話を再開',httpsHint:'別々の端末で使うにはHTTPSが必要です。localhostは同じ端末内でのみ利用できます。',iosHint:'iPhone：Safariの共有 → ホーム画面に追加。Android：ブラウザーのメニュー → アプリをインストール。',chatEyebrow:'あなたの会話',experimental:'テストモード',sidebarHint:'招待は一度限り。連絡先検索はありません。本人認証はまだありません。',newInvite:'招待リンクを作成',leave:'戻る',revoke:'無効にする',roomWarning:'実験段階の暗号化で、送信者の本人確認はできません。秘密を送らないでください。',chatName:'プライベートテストルーム',connecting:'接続中…',connected:'接続中',offline:'オフライン・エラー',preferences:'会話の設定を開く',preferencesTitle:'会話の設定',romaji:'かなをローマ字で表示（漢字は非対応）',enterSend:'Enterで送信・Shift+Enterで改行',translateToggle:'受信メッセージを端末内で翻訳',sourceLanguage:'元の言語',targetLanguage:'翻訳先',translationHint:'対応ブラウザーのみ。クラウド翻訳は使用しません。',screenshotHint:'ブラウザーではスクリーンショットを確実に禁止・検出できません。',emptyTitle:'ここから会話が始まります。',emptyText:'テストメッセージを送るか、招待リンクを共有しましょう。',messageLabel:'メッセージ',messagePlaceholder:'メッセージを入力…',send:'送信',composerTip:'テストメッセージ専用。クラウドAIなし。E2EEの安全性未検証。',footer:'実験版・端末保存優先・追跡なし',invalidName:'名前を入力してください。',confirmAck:'試作版の注意事項を確認してください。',localError:'ローカル保存に失敗しました',roomError:'ルームを開けません',serverError:'サーバーに接続できません',sendError:'送信できません',unsupported:'HTTPS・Web Crypto・IndexedDBが必要です',resetConfirm:'この端末のすべてのKonchaデータ（鍵と会話を含む）を削除しますか？サーバー上のメッセージは削除されません。',resetError:'削除できません',inviteCopied:'使い捨てリンクをコピーしました。60分間有効です。',inviteCreated:'招待を作成しました。信頼できる相手にのみ共有してください。',inviteExpires:'招待の残り時間',inviteExpired:'招待リンクの有効期限が切れました。新しいリンクを依頼してください。',inviteUnavailable:'この招待リンクは使用済み、または無効化されています。新しいリンクを依頼してください。',inviteInvalid:'無効な招待リンクです。',invitationError:'招待を受け取れませんでした',revokeDone:'招待を無効にしました。',revokeError:'招待を無効にできませんでした',inviteMissing:'有効な招待はありません。',inviteNotice:'最初に使った人が入室できます。既存の端末のアクセス権は残ります。',translationUnsupported:'このブラウザーでは端末内翻訳を利用できません。Safari、Firefox、モバイルブラウザーは未対応です。',translationAvailable:'端末内翻訳を有効にしました。テスト用に限って利用してください。',translationDownload:'言語モデルをダウンロードしています…',translationFailed:'翻訳を有効にできませんでした。',chooseDifferent:'元の言語と翻訳先を変えてください。',languageLabel:'言語',copyPrompt:'使い捨て招待リンク：',localeChanged:'言語を変更しました',oldInvite:'旧形式の招待リンクは使用できません。新しいリンクを作成してください。',inviteSecurity:'一度限り・60分',noTranslation:'翻訳できません',chatOpen:'会話を開く',emojiLabel:'絵文字を選ぶ'
  }
};
// Short copy for the chat-first UI and the dedicated invitation route.
// A handle is a locally selected label, NOT a unique or authenticated account ID.
Object.assign(dictionary.de, {
  alphaMark:'Alpha · Testversion', yourIdentity:'Deine Identität', onboardNewTitle:'Wie möchtest du heißen?',
  onboardInvitedTitle:'Wie möchtest du im Chat heißen?', identityLead:'Dein Name wird bei Einladungen angezeigt. Er ist frei wählbar und nicht amtlich geprüft.',
  handleLabel:'Benutzername', handleHint:'Lokal auf diesem Gerät. Nicht einzigartig oder verifiziert.',
  reset:'Lokale Daten löschen', newConversation:'Koncha', lobbySimpleTitle:'Neues Gespräch',
  lobbySimpleLead:'Beginne einen privaten Chat und lade eine Person ein.', thisDevice:'Dieses Gerät', newChat:'Neuen Chat beginnen',
  inviteLabel:'Persönliche Einladung', invitePageTitle:'Du wurdest eingeladen',
  invitePageLead:'Eine Person möchte mit dir chatten.', inviteFromDescription:'Diese Person lädt dich zu einem privaten Gespräch ein.',
  unverified:'Nicht verifiziert', inviteIdentityCaution:'Der Name ist eine Angabe des Einladenden, kein Identitätsnachweis. Vergleiche ihn im Zweifel über einen anderen Kanal.',
  checkingInvite:'Gültigkeit wird geprüft…', inviteMinutes:'Noch {minutes} Min. gültig', inviteInactive:'Nicht mehr gültig',
  decline:'Ablehnen', conversations:'Gespräche', chatName:'Privater Chat', chatSubtitle:'Privates Gespräch',
  sidebarBottom:'Lokal · Experimentell', inviteSection:'Einladung', invitePrivacyHint:'Einmalig und 60 Minuten gültig. Neue Links ersetzen alte.',
  reading:'Darstellung', translationTitle:'Übersetzung', safetyDetails:'Sicherheit und Daten',
  invalidHandle:'Benutzername: 3–24 Zeichen, beginnt mit einem Buchstaben; erlaubt sind a–z, 0–9, Punkt, Bindestrich und Unterstrich.',
  identityMismatch:'Die Angaben zum Einladenden stimmen nicht überein. Bitte einen neuen Link auf einem bekannten Weg anfordern.'
});
Object.assign(dictionary.en, {
  alphaMark:'Alpha · Test version', yourIdentity:'Your identity', onboardNewTitle:'What should we call you?',
  onboardInvitedTitle:'How should you appear in this chat?', identityLead:'Your name is shown in invitations. It is self-declared, not verified.',
  handleLabel:'Username', handleHint:'Stored on this device only. Not unique or verified.',
  reset:'Delete local data', newConversation:'Koncha', lobbySimpleTitle:'New conversation',
  lobbySimpleLead:'Start a private chat and invite one person.', thisDevice:'This device', newChat:'Start a chat',
  inviteLabel:'Personal invitation', invitePageTitle:'You have been invited',
  invitePageLead:'Someone wants to chat with you.', inviteFromDescription:'This person is inviting you to a private conversation.',
  unverified:'Unverified', inviteIdentityCaution:'The name is self-declared, not proof of identity. Confirm with the sender through another channel if needed.',
  checkingInvite:'Checking invitation…', inviteMinutes:'Valid for {minutes} more min', inviteInactive:'No longer valid',
  decline:'Decline', conversations:'Conversations', chatName:'Private chat', chatSubtitle:'Private conversation',
  sidebarBottom:'Local · Experimental', inviteSection:'Invitation', invitePrivacyHint:'Single-use, valid for 60 minutes. A new invitation invalidates the previous one.',
  reading:'Display', translationTitle:'Translation', safetyDetails:'Security and data',
  invalidHandle:'Username must be 3–24 characters, start with a letter and use only a–z, 0–9, dots, underscores or hyphens.',
  identityMismatch:'The invitation sender details do not match. Request a new link through a trusted channel.'
});
Object.assign(dictionary.ja, {
  alphaMark:'アルファ・試作版', yourIdentity:'あなたのプロフィール', onboardNewTitle:'表示名を設定',
  onboardInvitedTitle:'チャットでの表示名', identityLead:'招待リンクに表示される名前です。本人確認は行われません。',
  handleLabel:'ユーザー名', handleHint:'この端末だけに保存します。一意でも本人確認済みでもありません。',
  reset:'ローカルデータを削除', newConversation:'Koncha', lobbySimpleTitle:'新しいチャット',
  lobbySimpleLead:'プライベートチャットを作成して、相手を招待します。', thisDevice:'この端末', newChat:'チャットを始める',
  inviteLabel:'個人招待', invitePageTitle:'チャットに招待されました',
  invitePageLead:'あなたにチャットの招待が届いています。', inviteFromDescription:'この人からプライベートチャットに招待されています。',
  unverified:'本人未確認', inviteIdentityCaution:'名前は招待者の自己申告であり、本人確認ではありません。必要に応じて別の方法で確認してください。',
  checkingInvite:'招待を確認しています…', inviteMinutes:'残り{minutes}分', inviteInactive:'無効な招待',
  decline:'辞退する', conversations:'チャット', chatName:'プライベートチャット', chatSubtitle:'プライベート会話',
  sidebarBottom:'端末内保存 · 試作版', inviteSection:'招待', invitePrivacyHint:'1回限り、60分間有効。新しい招待を作ると以前のリンクは無効になります。',
  reading:'表示', translationTitle:'翻訳', safetyDetails:'セキュリティとデータ',
  invalidHandle:'ユーザー名は英字で始まる3～24文字で、英小文字・数字・ピリオド・ハイフン・アンダースコアのみ使用できます。',
  identityMismatch:'招待者の情報が一致しません。信頼できる方法で新しいリンクを依頼してください。'
});
// Alerts contain no message text or sender identity, including on lock screens.
Object.assign(dictionary.de, {
  alertSettingsTitle:'Benachrichtigungen', soundSetting:'Ton bei neuen Nachrichten im Hintergrund',
  enableNotifications:'Systembenachrichtigungen aktivieren',
  notificationsHint:'Nur solange Koncha geöffnet bleibt. Browserfreigabe erforderlich.',
  pushNotYet:'Keine Benachrichtigungen bei vollständig geschlossener App (Web Push folgt später).',
  notificationsReady:'Systembenachrichtigungen erlaubt. Nur bei geöffnetem Tab.',
  notificationsDenied:'Vom Browser blockiert. Bitte in den Website-Einstellungen freigeben.',
  notificationsUnavailable:'Auf diesem Gerät derzeit nicht verfügbar.',
  notificationTitle:'Neue Koncha-Nachricht', notificationBody:'Öffne Koncha, um die Nachricht zu lesen.'
});
Object.assign(dictionary.en, {
  alertSettingsTitle:'Notifications', soundSetting:'Play a sound for new messages in the background',
  enableNotifications:'Enable system notifications',
  notificationsHint:'Only while Koncha remains open. Browser permission required.',
  pushNotYet:'No notifications when the app is fully closed (Web Push is planned).',
  notificationsReady:'System notifications enabled. Only while the tab remains open.',
  notificationsDenied:'Blocked by your browser. Change permission in site settings.',
  notificationsUnavailable:'Not currently available on this device.',
  notificationTitle:'New Koncha message', notificationBody:'Open Koncha to read the message.'
});
Object.assign(dictionary.ja, {
  alertSettingsTitle:'通知', soundSetting:'バックグラウンドで新着メッセージの音を鳴らす',
  enableNotifications:'システム通知を有効にする',
  notificationsHint:'Konchaを開いている間のみ。ブラウザーの許可が必要です。',
  pushNotYet:'アプリを完全に閉じた後のプッシュ通知は未対応です。',
  notificationsReady:'通知を許可しました。タブが開いている間のみ有効です。',
  notificationsDenied:'ブラウザーで拒否されています。サイト設定を変更してください。',
  notificationsUnavailable:'この端末では利用できません。',
  notificationTitle:'Konchaの新着メッセージ', notificationBody:'Konchaを開いてメッセージを確認してください。'
});
export function translate(key, language = 'de') {
  return dictionary[language]?.[key] || dictionary.en[key] || key;
}
export function applyLanguage(root, language) {
  root.documentElement.lang = language;
  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = translate(element.dataset.i18n, language);
  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = translate(element.dataset.i18nPlaceholder, language);
}
