// Processo de interface: desenha os botões e envia comandos ao main.js.
const container = document.querySelector('#accounts');
const message = document.querySelector('#message');
const browserOptions = document.querySelector('#browser-options');
let browserChoices = ['default', 'default', 'default', 'default'];
let savingBrowsers = false;
async function command(name, value) {
  try { message.textContent = ''; render(await window.poke.command(name, value)); return true; }
  catch (error) { message.textContent = error.message; try { render(await window.poke.command('state')); } catch {} return false; }
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
for (let id = 0; id < 4; id++) {
  const label = document.createElement('label');
  const input = document.createElement('input'); input.type = 'checkbox';
  input.onchange = async () => { input.disabled = true; await command('enabled', { id, enabled: input.checked }); input.disabled = false; };
  label.append(input, document.createTextNode('Conta ' + (id + 1)));
  document.querySelector('#account-power').append(label);
}
document.querySelector('#economy').onchange = event => command('economy', event.target.checked);
document.querySelector('#close-popups').onclick = () => command('close-popups');
for (let id = 0; id < 4; id++) {
  const form = document.createElement('form'); form.className = 'identity';
  const name = document.createElement('input'); name.maxLength = 24; name.required = true; name.setAttribute('aria-label', 'Nome da conta ' + (id + 1));
  const color = document.createElement('input'); color.type = 'color'; color.setAttribute('aria-label', 'Cor da conta ' + (id + 1));
  const button = document.createElement('button'); button.textContent = 'Salvar';
  form.append(name, color, button); form.onsubmit = async event => { event.preventDefault(); button.disabled = true; await command('identity', { id, name: name.value, color: color.value }); button.disabled = false; };
  document.querySelector('#identities').append(form);
}
for (const id of ['health-alerts', 'health-recover']) document.getElementById(id).onchange = () => command('health-options', { alerts: document.querySelector('#health-alerts').checked, autoRecover: document.querySelector('#health-recover').checked });
document.querySelector('#account-count').onchange = async event => {
  const select = event.target; select.disabled = true;
  try { await command('account-count', Number(select.value)); }
  finally { select.disabled = false; }
};
function render(state) {
  document.querySelector('#account-count').value = String(state.accountCount);
  document.documentElement.style.setProperty('--account-count', state.accountCount);
  document.querySelector('#health-alerts').checked = state.alerts;
  document.querySelector('#health-recover').checked = state.autoRecover;
  document.querySelector('#health-status').textContent = state.accounts.map(a => a.name + ': ' + (a.health ? a.health.message + (a.health.nextRetry ? ' · próxima tentativa às ' + new Date(a.health.nextRetry).toLocaleTimeString() : '') + (a.health.attempts ? ' · tentativas: ' + a.health.attempts + '/3' : '') : 'Desativada')).join('\n');
  document.querySelector('#economy').checked = state.economy;
  const format = value => value ? value.cpu.toFixed(1) + '% CPU · ' + value.memory.toFixed(0) + ' MB RAM' : 'Sem processo ativo';
  document.querySelector('#usage').textContent = state.usage ? 'Total do app: ' + format(state.usage.total) + '\n' + state.usage.accounts.map((a, i) => state.accounts[i].name + ': ' + format(a)).join('\n') : 'Aguardando medição…';
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
  document.querySelector('#mode').textContent = state.selected === null ? `${state.accountCount} contas · grid 2 × 2` : `${state.accounts[state.selected].name} ampliada`;
  state.accounts.forEach(account => {
    const card = container.children[account.id];
    const outsideMode = account.id >= state.accountCount;
    card.hidden = outsideMode;
    browserOptions.children[account.id].hidden = outsideMode;
    document.querySelectorAll('#identities .identity')[account.id].hidden = outsideMode;
    document.querySelectorAll('#account-power label')[account.id].hidden = outsideMode;
    card.querySelector('.select').textContent = account.name;
    card.style.setProperty('--account-color', account.color);
    card.classList.toggle('attention', account.health?.problem === true);
    document.querySelectorAll('#account-power label')[account.id].lastChild.textContent = account.name;
    browserOptions.children[account.id].firstChild.textContent = account.name;
    const identity = document.querySelectorAll('.identity')[account.id];
    if (!identity.contains(document.activeElement)) { identity.children[0].value = account.name; identity.children[1].value = account.color; }
    card.classList.toggle('off', !account.enabled);
    card.querySelectorAll('button').forEach(button => { button.disabled = !account.enabled; });
    document.querySelectorAll('#account-power input')[account.id].checked = account.enabled;
    card.classList.toggle('active', state.selected === account.id);
    card.querySelector('.select').setAttribute('aria-pressed', String(state.selected === account.id));
    card.querySelector('.zoom').textContent = `${Math.round(account.zoom * 100)}%`;
    card.querySelector('.zoom').title = `Zoom no modo ${account.zoomMode}. Clique para restaurar 100% somente neste modo.`;
    const mute = card.querySelector('.mute');
    mute.textContent = account.muted ? '🔇' : '🔊';
    mute.title = `${account.muted ? 'Ativar' : 'Silenciar'} som da Conta ${account.id + 1}`;
    mute.setAttribute('aria-label', mute.title);
    mute.setAttribute('aria-pressed', String(account.muted));
    const status = account.health?.problem ? account.health.message : account.linkStatus || account.status;
    card.querySelector('.select').title = `${account.name}: ${status}`;
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
