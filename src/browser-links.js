// Somente executáveis conhecidos e URLs web; nunca montamos comandos de terminal.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const browserDefinitions = [
  { id: 'chrome', name: 'Google Chrome', relative: 'Google/Chrome/Application/chrome.exe' },
  { id: 'edge', name: 'Microsoft Edge', relative: 'Microsoft/Edge/Application/msedge.exe' },
  { id: 'firefox', name: 'Mozilla Firefox', relative: 'Mozilla Firefox/firefox.exe' }
];
const browserIds = ['default', 'internal', ...browserDefinitions.map(b => b.id)];
function detectBrowsers(env = process.env, exists = fs.existsSync) {
  const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean);
  return browserDefinitions.map(b => ({ ...b,
    executable: roots.map(root => path.join(root, b.relative)).find(exists) || null
  }));
}
function webURL(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Este tipo de link não pode ser aberto.');
  }
  return url;
}
function isTwitchURL(value) {
  try { const host = webURL(value).hostname; return host === 'twitch.tv' || host.endsWith('.twitch.tv'); }
  catch { return false; }
}
async function openBrowserLink(value, browser, { openExternal, browsers, launch = spawn }) {
  const url = webURL(value).href;
  if (browser === 'default') {
    if (url.length > 2081) throw new Error('Link longo demais para abrir pelo Windows.');
    await openExternal(url);
    return;
  }
  const installed = browsers.find(b => b.id === browser && b.executable);
  if (!installed) throw new Error('Navegador não encontrado. Escolha outro em Configurações.');
  await new Promise((resolve, reject) => {
    const child = launch(installed.executable, [url], {
      shell: false, detached: true, stdio: 'ignore'
    });
    child.once('error', () => reject(new Error('Não foi possível iniciar o navegador. Confira as Configurações.')));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
module.exports = { browserIds, detectBrowsers, webURL, isTwitchURL, openBrowserLink };
