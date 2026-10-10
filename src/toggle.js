const button = document.querySelector('#toggle');
function render(state) {
  button.textContent = state.headerHidden ? '☰' : '⌃';
  const label = state.headerHidden ? 'Mostrar controles' : 'Esconder controles';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-expanded', String(!state.headerHidden));
}
button.onclick = async () => {
  try { render(await window.poke.command('toggle-header')); }
  catch { button.title = 'Não foi possível alternar os controles. Tente novamente.'; }
};
window.poke.onState(render);
window.poke.command('state').then(render).catch(() => {});
