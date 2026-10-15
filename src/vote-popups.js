// Popups de votação usam a mesma sessão da conta, sem copiar cookies.
const { BrowserWindow } = require('electron');
const { webURL } = require('./browser-links');
function isVoteURL(value) {
  try {
    const url = webURL(value);
    return url.protocol === 'https:' && ['topidle.com', 'www.topidle.com'].includes(url.hostname) && url.pathname.startsWith('/jogo/');
  } catch { return false; }
}
function createVotePopups({ parent, session, accountId }) {
  const windows = new Set();
  function options() {
    return { parent, width: 1000, height: 760, minWidth: 500, minHeight: 400,
      title: `Votação — Conta ${accountId + 1}`, autoHideMenuBar: true,
      webPreferences: { session, nodeIntegration: false, contextIsolation: true, sandbox: true } };
  }
  function allowed(url) {
    if (url === 'about:blank') return true;
    try { return webURL(url).protocol === 'https:'; } catch { return false; }
  }
  function register(popup) {
    windows.add(popup);
    popup.setMenu(null);
    popup.on('closed', () => windows.delete(popup));
    const wc = popup.webContents;
    wc.on('page-title-updated', event => {
      event.preventDefault();
      let host = ''; try { host = new URL(wc.getURL()).hostname; } catch {}
      popup.setTitle(`Conta ${accountId + 1} — ${host || 'Votação'}`);
    });
    for (const event of ['will-navigate', 'will-redirect']) wc.on(event, (e, url) => { if (!allowed(url)) e.preventDefault(); });
    // Mantém window.opener, POST e window.close nos fluxos de autenticação.
    wc.setWindowOpenHandler(({ url }) => allowed(url) && windows.size < 8
      ? { action: 'allow', overrideBrowserWindowOptions: options() } : { action: 'deny' });
    wc.on('did-create-window', register);
  }
  return {
    response() { return windows.size < 8 ? { action: 'allow', overrideBrowserWindowOptions: options() } : { action: 'deny' }; },
    register,
    open(url) {
      if (!isVoteURL(url) || windows.size >= 8) return;
      const popup = new BrowserWindow(options()); register(popup);
      popup.loadURL(url).catch(() => { if (!popup.isDestroyed()) popup.setTitle(`Conta ${accountId + 1} — Falha ao carregar; tente recarregar`); });
    },
    close() { for (const popup of windows) if (!popup.isDestroyed()) popup.destroy(); windows.clear(); }
  };
}
module.exports = { isVoteURL, createVotePopups };
