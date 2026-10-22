const button = document.querySelector('#back-grid');
button.onclick = async () => {
  try { await window.poke.command('back-grid'); }
  catch { button.title = 'Não foi possível voltar ao grid. Tente novamente.'; }
};
