// Processo principal: cria as janelas e mantém as quatro sessões vivas.
const { app, BrowserWindow, WebContentsView, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { browserIds, detectBrowsers, webURL, isTwitchURL, openBrowserLink } = require('./browser-links');
const { isVoteURL, createVotePopups } = require('./vote-popups');
const browsers = detectBrowsers();
app.setName('PokeIdle Multi');
if (process.platform === 'win32') app.setAppUserModelId('local.pokeidle.multi');
const { autoUpdater: applicationUpdater } = require('electron-updater');
const { createUpdates } = require('./app-updates');
let updates;

// Nome estável: desenvolvimento e aplicativo instalado usam os mesmos dados.
app.setPath('userData', path.join(app.getPath('appData'), 'PokeIdleMulti'));
const configPath = path.join(app.getPath('userData'), 'preferences.json');
const uiPath = path.join(__dirname, 'index.html');
const togglePath = path.join(__dirname, 'toggle.html');
let config = { economy: false, enabled: [true, true, true, true], url: 'https://pokeidle.io', zoom: [1, 1, 1, 1], zoomFull: [1, 1, 1, 1], muted: [false, false, false, false], browsers: ['default', 'default', 'default', 'default'] };
try {
  const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.economy = saved.economy === true;
  if (Array.isArray(saved.enabled) && saved.enabled.length === 4) config.enabled = saved.enabled.map(v => v !== false);
  if (Array.isArray(saved.muted) && saved.muted.length === 4) config.muted = saved.muted.map(value => value === true);
  if (Array.isArray(saved.browsers) && saved.browsers.length === 4) {
    config.browsers = saved.browsers.map(b => browserIds.includes(b) ? b : 'default');
  }
  if (Array.isArray(saved.zoomFull) && saved.zoomFull.length === 4) {
    config.zoomFull = saved.zoomFull.map(z => Number.isFinite(z) ? Math.min(2, Math.max(0.5, z)) : 1);
  }
  if (new URL(saved.url).protocol === 'https:') config.url = saved.url;
  if (Array.isArray(saved.zoom) && saved.zoom.length === 4) {
    config.zoom = saved.zoom.map(z => Number.isFinite(z) ? Math.min(2, Math.max(0.5, z)) : 1);
  }
} catch { /* Primeira execução: usamos os valores padrão. */ }
let win;
let accounts = [];
let selected = null; // null significa grid; 0 a 3 significa uma conta ampliada.
let addressOpen = false;
let headerHidden = false;
let toggleView;
let closing = false;
let lastActiveAccount = 0;

function refreshAccount(id, ignoreCache = false) {
  const account = accounts[id];
  if (!account || closing || (!account.view || account.view.webContents.isDestroyed())) return;
  const wc = account.view.webContents;
  // Uma recarga solicitada pelo usuário pode prosseguir apesar de beforeunload.
  account.reloadUntil = Date.now() + 10000;
  account.linkStatus = '';
  account.status = ignoreCache ? 'Buscando versão nova…' : 'Recarregando…';
  publish();
  if (!wc.getURL()) loadAccount(account);
  else if (ignoreCache) wc.reloadIgnoringCache();
  else wc.reload();
}
function installReloadKeys(wc, accountId) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat || input.alt) return;
    const key = input.key.toLowerCase();
    if (key !== 'f5' && !(key === 'r' && (input.control || input.meta))) return;
    event.preventDefault();
    const id = accountId ?? selected ?? lastActiveAccount;
    refreshAccount(id, key === 'f5' ? Boolean(input.control || input.shift) : Boolean(input.shift));
  });
}

function save() {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const temporary = `${configPath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(config, null, 2));
  fs.renameSync(temporary, configPath);
}
// O zoom antigo passa a ser o zoom do grid; ampliada começa em 100%.
function currentZoom() { return selected === null ? config.zoom : config.zoomFull; }
let usage = null;
let metricsTimer;
function measureUsage() {
  const metrics = app.getAppMetrics();
  const summarize = items => ({ cpu: items.reduce((n, p) => n + p.cpu.percentCPUUsage, 0), memory: items.reduce((n, p) => n + p.memory.workingSetSize / 1024, 0) });
  usage = { total: summarize(metrics), accounts: accounts.map(a => {
    if (!a.view) return null;
    const pid = a.view.webContents.getOSProcessId();
    return metrics.find(p => p.pid === pid) ? summarize(metrics.filter(p => p.pid === pid)) : null;
  }) };
}
function updateMetrics() {
  clearInterval(metricsTimer); metricsTimer = null; usage = null;
  if (!addressOpen || headerHidden || closing || win.isMinimized()) return;
  measureUsage(); // Primeira amostra inicia o intervalo de CPU.
  metricsTimer = setInterval(() => { measureUsage(); publish(); }, 3000);
  metricsTimer.unref();
}
function state() {
  return { economy: config.economy, usage, update: updates?.getState(), url: config.url, selected, addressOpen, headerHidden, browsers: browsers.map(b => ({ id: b.id, name: b.name, available: Boolean(b.executable) })), accounts: accounts.map((a, i) => ({
    id: i, enabled: Boolean(a.view), muted: config.muted[i], zoom: currentZoom()[i], zoomMode: selected === null ? 'grid' : 'ampliada', status: a.status, linkStatus: a.linkStatus, browser: config.browsers[i]
  })) };
}
function publish() {
  if (win && !win.isDestroyed() && !closing) win.webContents.send('state', state());
  if (toggleView && !toggleView.webContents.isDestroyed() && !closing) toggleView.webContents.send('state', { headerHidden });
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  const top = headerHidden ? 0 : (addressOpen ? 360 : 44);
  if (toggleView) toggleView.setBounds({ x: width - 36, y: 7, width: 30, height: 28 });
  const available = Math.max(1, height - top);
  accounts.forEach(({ view }, i) => {
    if (!view) return;
    if (view.webContents.getBackgroundThrottling() !== config.economy) view.webContents.setBackgroundThrottling(config.economy);
    const zoom = currentZoom()[i];
    if (view.webContents.getZoomFactor() !== zoom) view.webContents.setZoomFactor(zoom);
    const visible = selected === null || selected === i;
    view.setVisible(visible);
    if (!visible) return; // Ocultar não fecha nem recria a página.
    const left = Math.floor(width / 2);
    const upper = Math.floor(available / 2);
    view.setBounds(selected !== null
      ? { x: 0, y: top, width, height: available }
      : { x: i % 2 ? left : 0, y: top + (i > 1 ? upper : 0),
          width: i % 2 ? width - left : left, height: i > 1 ? available - upper : upper });
  });
}
function loadAccount(account) {
  if (!account.view) return;
  account.view.webContents.loadURL(config.url).catch(() => {
    account.status = 'Falha ao carregar. Use ↻ para tentar novamente.';
    publish();
  });
}
function isWebURL(url) {
  try { webURL(url); return true; } catch { return false; }
}

async function openAccountLink(id, url) {
  const account = accounts[id];
  if (!account?.view || closing) return;
  try {
    webURL(url);
    if (id > 0 && isVoteURL(url)) { account.votePopups.open(url); return; }
    if (config.browsers[id] === 'internal') await account.view.webContents.loadURL(url);
    else await openBrowserLink(url, config.browsers[id], { browsers, openExternal: shell.openExternal });
    account.linkStatus = config.browsers[id] === 'internal' ? '' : 'Link enviado ao navegador';
  } catch (error) { account.linkStatus = error.message; }
  publish();
}

function createAccount(i) {
    const view = new WebContentsView({ webPreferences: {
      partition: `persist:pokeidle-account-${i + 1}`,
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      backgroundThrottling: config.economy
    } });
    const account = { view, status: 'Carregando…', linkStatus: '' };
    const wc = view.webContents;
    account.votePopups = createVotePopups({ parent: win, session: wc.session, accountId: i });
    wc.on('did-create-window', account.votePopups.register);
    wc.setAudioMuted(config.muted[i]);
    installReloadKeys(wc, i);
    wc.on('focus', () => { lastActiveAccount = i; });
    wc.on('will-prevent-unload', event => {
      if (closing || account.reloadUntil > Date.now()) { event.preventDefault(); return; }
      const answer = dialog.showMessageBoxSync(win, {
        type: 'question', title: `Conta ${i + 1}`,
        message: 'O jogo pediu confirmação para recarregar ou sair desta página.',
        detail: 'Continuar pode descartar alterações ainda não salvas pelo jogo.',
        buttons: ['Continuar', 'Ficar na página'], defaultId: 1, cancelId: 1
      });
      if (answer === 0) event.preventDefault();
    });
    wc.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    wc.session.setPermissionCheckHandler(() => false);
    wc.on('will-navigate', (event, url) => {
      if (!isWebURL(url)) event.preventDefault();
      else if (i > 0 && isVoteURL(url)) { event.preventDefault(); account.votePopups.open(url); }
      else if (config.browsers[i] !== 'internal' && isTwitchURL(url)) {
        event.preventDefault(); void openAccountLink(i, url);
      }
    });
    wc.on('will-redirect', (event, url) => { if (!isWebURL(url)) event.preventDefault(); });
    // Links de nova aba/janela usam a escolha da conta; o jogo permanece aberto.
    wc.setWindowOpenHandler(({ url }) => {
      if (i > 0 && isVoteURL(url)) return account.votePopups.response();
      void openAccountLink(i, url);
      return { action: 'deny' };
    });
    wc.on('context-menu', (_event, params) => {
      const items = [
        { label: 'Recarregar esta conta (F5)', click: () => refreshAccount(i) },
        { label: 'Buscar versão nova sem cache (Ctrl+F5)', click: () => refreshAccount(i, true) }
      ];
      if (isWebURL(params.linkURL)) items.push({ type: 'separator' }, {
        label: 'Abrir link conforme Configurações', click: () => void openAccountLink(i, params.linkURL)
      });
      Menu.buildFromTemplate(items).popup({ window: win });
    });
    wc.on('did-start-loading', () => { account.status = 'Carregando…'; publish(); });
    wc.on('did-finish-load', () => {
      if (!wc.getURL()) return;
      account.reloadUntil = 0;
      wc.setZoomFactor(currentZoom()[i]); account.status = 'Pronta'; publish();
    });
    wc.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) { account.status = `Erro: ${description}`; publish(); }
    });
    wc.on('render-process-gone', () => { account.status = 'Página interrompida. Use ↻.'; publish(); });
    win.contentView.addChildView(view);
    return account;
}
const changingAccounts = new Set();
async function setAccountEnabled(id, enabled) {
  if (changingAccounts.has(id)) throw new Error('Aguarde a alteração desta conta.');
  changingAccounts.add(id);
  try {
  const old = accounts[id];
  if (Boolean(old.view) === enabled) return;
  if (!enabled) await old.view.webContents.session.cookies.flushStore();
  if (closing || !win || win.isDestroyed()) return;
  const previous = config.enabled[id]; config.enabled[id] = enabled;
  try { save(); } catch (error) { config.enabled[id] = previous; throw error; }
  if (enabled) {
    accounts[id] = createAccount(id);
    // O botão flutuante deve continuar acima das páginas recém-criadas.
    win.contentView.removeChildView(toggleView); win.contentView.addChildView(toggleView);
    loadAccount(accounts[id]);
  } else {
    old.votePopups.close(); win.contentView.removeChildView(old.view);
    old.view.webContents.close();
    accounts[id] = { view: null, status: 'Desativada', linkStatus: '' };
    if (selected === id) selected = null;
  }
  layout(); updateMetrics();
  } finally { changingAccounts.delete(id); }
}
function createWindow() {
  closing = false;
  win = new BrowserWindow({ width: 1360, height: 900, minWidth: 1000, minHeight: 600,
    title: 'PokeIdle Multi', backgroundColor: '#101722',
    webPreferences: { preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true } });
  Menu.setApplicationMenu(null);
  accounts = Array.from({ length: 4 }, (_, i) => config.enabled[i] ? createAccount(i) : { view: null, status: 'Desativada', linkStatus: '' });
  win.webContents.on('will-navigate', event => event.preventDefault());
  installReloadKeys(win.webContents);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(uiPath);
  // Uma view pequena fica acima das páginas nativas, inclusive com o cabeçalho oculto.
  toggleView = new WebContentsView({ webPreferences: {
    preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true
  } });
  win.contentView.addChildView(toggleView);
  toggleView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  installReloadKeys(toggleView.webContents);
  toggleView.webContents.on('will-navigate', event => event.preventDefault());
  toggleView.webContents.loadFile(togglePath);
  layout();
  accounts.forEach(loadAccount);
  win.on('resize', layout);
  for (const name of ['minimize', 'restore', 'show']) win.on(name, () => { layout(); updateMetrics(); publish(); });
  win.on('close', event => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    // Garante que as gravações pendentes de cookies sejam enviadas ao disco.
    Promise.allSettled(accounts.filter(a => a.view).map(a => a.view.webContents.session.cookies.flushStore()))
      .finally(() => win.destroy());
  });
  win.on('closed', () => {
    // WebContentsView exige limpeza explícita quando a janela termina.
    clearInterval(metricsTimer);
    accounts.filter(a => a.view).forEach(({ view, votePopups }) => { votePopups.close(); if (!view.webContents.isDestroyed()) view.webContents.close(); });
    if (toggleView && !toggleView.webContents.isDestroyed()) toggleView.webContents.close();
    toggleView = null;
    accounts = []; win = null;
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    const configured = fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
    updates = createUpdates({
      updater: applicationUpdater, enabled: app.isPackaged && configured, version: app.getVersion(),
      disabledReason: !app.isPackaged ? 'Disponível no aplicativo instalado. Você está no modo de desenvolvimento.' : 'Canal de atualizações ainda não configurado nesta versão.',
      notify: publish,
      prepareInstall: async () => {
        await Promise.all(accounts.filter(a => a.view).map(a => a.view.webContents.session.cookies.flushStore()));
      }
    });
    // Permite ao instalador encerrar o app sem o fluxo normal de fechamento interceptar.
    require('electron').autoUpdater.on('before-quit-for-update', () => { closing = true; });
    // Apenas a interface local recebe acesso a estes comandos.
    ipcMain.handle('command', async (event, command, value) => {
      const fromToggle = toggleView && event.sender === toggleView.webContents &&
        event.senderFrame === toggleView.webContents.mainFrame && event.senderFrame.url === pathToFileURL(togglePath).href;
      if (fromToggle) {
        if (command === 'toggle-header') { headerHidden = !headerHidden; layout(); updateMetrics(); publish(); }
        else if (command !== 'state') throw new Error('Comando inválido');
        return { headerHidden };
      }
      if (!win || event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          event.senderFrame.url !== pathToFileURL(uiPath).href) throw new Error('Origem inválida');
      if (command === 'state') return state();
      if (command === 'update') {
        if (!['check', 'download', 'install'].includes(value)) throw new Error('Ação inválida');
        void updates.action(value);
        return state();
      }
      if (command === 'grid') { selected = null; layout(); }
      else if (command === 'address') { addressOpen = !addressOpen; layout(); updateMetrics(); }
      else if (command === 'economy') {
        if (typeof value !== 'boolean') throw new Error('Valor inválido');
        const previous = config.economy; config.economy = value;
        try { save(); } catch (error) { config.economy = previous; throw error; }
        layout();
      }
      else if (command === 'close-popups') { accounts.forEach(a => a.votePopups?.close()); }
      else if (command === 'enabled') {
        if (!Number.isInteger(value?.id) || value.id < 0 || value.id > 3 || typeof value.enabled !== 'boolean') throw new Error('Conta inválida');
        await setAccountEnabled(value.id, value.enabled);
      }
      else if (command === 'browsers') {
        if (!Array.isArray(value) || value.length !== 4 || !value.every(b => browserIds.includes(b))) {
          throw new Error('Escolha um navegador válido para cada conta.');
        }
        const previous = config.browsers;
        config.browsers = [...value];
        try { save(); } catch (error) { config.browsers = previous; throw error; }
      }
      else if (command === 'url') {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Informe um endereço HTTPS válido.');
        config.url = url.href; save(); accounts.forEach(loadAccount);
      } else {
        const id = value?.id;
        if (!Number.isInteger(id) || id < 0 || id > 3) throw new Error('Conta inválida');
        if (!accounts[id].view) throw new Error('Ative esta conta em Configurações.');
        const wc = accounts[id].view.webContents;
        if (command === 'focus') { selected = id; layout(); wc.focus(); }
        else if (command === 'refresh') { refreshAccount(id, value.ignoreCache === true); }
        else if (command === 'mute') {
          const previous = config.muted[id];
          config.muted[id] = !previous;
          try { save(); } catch (error) { config.muted[id] = previous; throw error; }
          wc.setAudioMuted(config.muted[id]);
        }
        else if (command === 'zoom') {
          if (![0, -1, 1].includes(value.step)) throw new Error('Zoom inválido');
          const zooms = currentZoom();
          const previous = zooms[id];
          zooms[id] = value.step === 0 ? 1 : Math.min(2, Math.max(0.5, Math.round((previous + value.step * 0.1) * 10) / 10));
          try { save(); } catch (error) { zooms[id] = previous; throw error; }
          wc.setZoomFactor(zooms[id]);
        } else throw new Error('Comando inválido');
      }
      publish(); return state();
    });
    createWindow();
    if (app.isPackaged && configured) {
      const timer = setTimeout(() => { if (!closing) void updates.action('check'); }, 10000);
      timer.unref();
    }
  });
  app.on('window-all-closed', () => app.quit());
}
