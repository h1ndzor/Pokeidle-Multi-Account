// Processo de interface: desenha os botões e envia comandos ao main.js.
const container = document.querySelector('#accounts');
const message = document.querySelector('#message');
const browserOptions = document.querySelector('#browser-options');
let browserChoices = ['default', 'default', 'default', 'default'];
let savingBrowsers = false;
async function command(name, value) {
  try { message.textContent = ''; render(await window.poke.command(name, value)); return true; }
  catch (error) { message.textContent = error.message; return false; }
}
async function saveBrowsers(choices) {
  if (savingBrowsers) return;
  savingBrowsers = true;
  document.querySelectorAll('#browser-options select, #apply-all').forEach(el => { el.disabled = true; });
  const saved = await command('browsers', choices);
  document.querySelector('#save-status').textContent = saved ? 'Preferências salvas' : 'Não foi possível salvar';
  if (!saved) {
    try { render(await window.poke.command('state')); } catch { /* Mantém a mensagem original. */ }
  }
  savingBrowsers = false;
  document.querySelectorAll('#browser-options select, #apply-all').forEach(el => { el.disabled = false; });
}
for (let id = 0; id < 4; id++) {
  const card = document.createElement('section');
  card.className = 'account';
  card.innerHTML = `<div class="controls"><button class="select">Conta ${id + 1}</button><button class="minus" aria-label="Diminuir zoom da conta ${id + 1}">−</button><button class="zoom" title="Restaurar zoom para 100%">100%</button><button class="plus" aria-label="Aumentar zoom da conta ${id + 1}">+</button><button class="refresh" aria-label="Recarregar conta ${id + 1}">↻</button></div><small class="status">Carregando…</small>`;
  card.querySelector('.select').onclick = () => command('focus', { id });
  const mute = document.createElement('button');
  mute.className = 'mute';
  mute.onclick = () => command('mute', { id });
  card.querySelector('.controls').append(mute);
  card.querySelector('.refresh').title = 'Recarregar (F5). Shift+clique: buscar versão nova sem cache (Ctrl+F5).';
  card.querySelector('.refresh').onclick = event => command('refresh', { id, ignoreCache: event.shiftKey });
  for (const [selector, step] of [['.minus', -1], ['.plus', 1], ['.zoom', 0]]) {
    card.querySelector(selector).onclick = () => command('zoom', { id, step });
  }
  container.append(card);
  const label = document.createElement('label');
  label.textContent = `Conta ${id + 1}`;
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Navegador da Conta ${id + 1}`);
  select.onchange = () => {
    const choices = [...browserChoices]; choices[id] = select.value; void saveBrowsers(choices);
  };
  label.append(select); browserOptions.append(label);
}
function render(state) {
  if (state.update) {
    const update = state.update;
    document.querySelector('#app-version').textContent = `v${update.version}`;
    document.querySelector('#update-status').textContent = update.message + (update.phase === 'downloading' ? ` ${update.percent}%` : '');
    document.querySelector('#update-check').disabled = !['idle', 'current', 'available', 'error'].includes(update.phase);
    document.querySelector('#update-download').hidden = update.phase !== 'available';
    document.querySelector('#update-install').hidden = update.phase !== 'ready';
    document.querySelector('#settings').textContent = ['available', 'ready'].includes(update.phase) ? 'Configurações •' : 'Configurações';
  }
  document.querySelector('header').hidden = state.headerHidden;
  document.querySelector('header').classList.toggle('expanded', state.addressOpen);
  document.querySelector('#settings-panel').hidden = !state.addressOpen;
  document.querySelector('#settings').setAttribute('aria-expanded', String(state.addressOpen));
  if (document.activeElement !== document.querySelector('#url')) document.querySelector('#url').value = state.url;
  document.querySelector('#mode').textContent = state.selected === null ? '4 contas · grid 2 × 2' : `Conta ${state.selected + 1} ampliada · outras 3 em segundo plano`;
  state.accounts.forEach(account => {
    const card = container.children[account.id];
    card.classList.toggle('active', state.selected === account.id);
    card.querySelector('.select').setAttribute('aria-pressed', String(state.selected === account.id));
    card.querySelector('.zoom').textContent = `${Math.round(account.zoom * 100)}%`;
    const mute = card.querySelector('.mute');
    mute.textContent = account.muted ? '🔇' : '🔊';
    mute.title = `${account.muted ? 'Ativar' : 'Silenciar'} som da Conta ${account.id + 1}`;
    mute.setAttribute('aria-label', mute.title);
    mute.setAttribute('aria-pressed', String(account.muted));
    const status = account.linkStatus || account.status;
    card.querySelector('.select').title = `Conta ${account.id + 1}: ${status}`;
    card.querySelector('.status').textContent = status;
    card.querySelector('.status').title = status;
    const select = browserOptions.children[account.id].querySelector('select');
    if (!select.options.length) {
      const options = [{ id: 'default', name: 'Padrão do Windows', available: true }, ...state.browsers,
        { id: 'internal', name: 'No aplicativo (substitui o jogo)', available: true }];
      options.forEach(browser => {
        const option = document.createElement('option');
        option.value = browser.id;
        option.textContent = browser.name + (browser.available ? '' : ' — não encontrado');
        option.disabled = !browser.available;
        select.append(option);
      });
    }
    select.value = account.browser;
  });
  browserChoices = state.accounts.map(a => a.browser);
}
document.querySelector('#grid').onclick = () => command('grid');
document.querySelector('#settings').onclick = () => command('address');
document.querySelector('#apply-all').onclick = () => saveBrowsers(Array(4).fill(browserChoices[0]));
document.querySelector('#address').onsubmit = event => {
  event.preventDefault(); command('url', document.querySelector('#url').value.trim());
};
window.poke.onState(render);
document.querySelector('#update-check').onclick = () => command('update', 'check');
document.querySelector('#update-download').onclick = () => command('update', 'download');
document.querySelector('#update-install').onclick = () => command('update', 'install');
command('state');
