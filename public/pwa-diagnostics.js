/* Feature probes (not a substitute for testing real iOS/Android devices). */
export function pwaFeatureReport(env = globalThis) {
  const win = env.window || env;
  const nav = env.navigator || {};
  const matches = typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches;
  return {
    secureContext: env.isSecureContext === true,
    online: nav.onLine !== false,
    standalone: Boolean(matches || nav.standalone === true),
    serviceWorker: Boolean(nav.serviceWorker),
    push: Boolean(env.PushManager),
    notifications: typeof env.Notification !== 'undefined' ? env.Notification.permission : 'unsupported',
    localStorage: Boolean(env.indexedDB),
    webAssembly: typeof env.WebAssembly !== 'undefined',
    webGPU: Boolean(nav.gpu),
  };
}
export function formatPwaReport(report, lang = 'de') {
  const labels = {
    de: ['HTTPS/Sicherer Kontext', 'Netzwerk', 'Installiert (Standalone)', 'Service Worker', 'Web Push API', 'Benachrichtigungen', 'IndexedDB', 'WebAssembly', 'WebGPU'],
    en: ['Secure context', 'Network', 'Installed (standalone)', 'Service Worker', 'Web Push API', 'Notifications', 'IndexedDB', 'WebAssembly', 'WebGPU'],
    ja: ['安全な接続', 'ネットワーク', 'インストール済み', 'Service Worker', 'Web Push API', '通知', 'IndexedDB', 'WebAssembly', 'WebGPU'],
  }[lang] || ['Secure context', 'Network', 'Installed', 'Service worker', 'Push', 'Notifications', 'IndexedDB', 'WebAssembly', 'WebGPU'];
  return Object.values(report).map((value, i) => `${labels[i]}: ${typeof value === 'boolean' ? (value ? '✓' : '–') : value}`).join('\n');
}
