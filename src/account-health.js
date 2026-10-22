// Eventos do navegador, não um detector de progresso da caça.
function createHealth({ options, online, reload, notify, changed, later = setTimeout, cancel = clearTimeout }) {
  let timer, stable, stopped = false, incident = false, canRetry = false;
  let state = { problem: false, message: 'Aguardando página', attempts: 0, nextRetry: null };
  function clearRetry() { if (timer) cancel(timer); timer = null; state.nextRetry = null; }
  function schedule() {
    clearRetry();
    if (stopped || !state.problem || !canRetry || !options().autoRecover || state.attempts >= 3) return;
    const delay = [15000, 30000, 60000][state.attempts];
    state.nextRetry = Date.now() + delay;
    timer = later(() => {
      timer = null; state.nextRetry = null;
      if (stopped || !options().autoRecover || !state.problem) return;
      if (!online()) { schedule(); changed(); return; }
      state.attempts++; changed(); reload();
      // Uma carga que não termina também tem limite de tentativas.
      schedule(); changed();
    }, delay);
    timer?.unref?.();
  }
  return {
    state: () => ({ ...state }),
    fail(message, recoverable = true) {
      if (stopped) return;
      if (stable) cancel(stable); stable = null;
      const first = !incident; incident = true;
      state.problem = true; state.message = message; canRetry = recoverable;
      if (first && options().alerts) notify(message);
      if (!timer) schedule();
      if (!recoverable) clearRetry();
      changed();
    },
    loaded() {
      if (stopped) return;
      clearRetry(); state.problem = false; state.message = 'Página carregada (caça não verificada)';
      if (stable) cancel(stable);
      stable = later(() => { incident = false; state.attempts = 0; stable = null; changed(); }, 60000);
      stable?.unref?.(); changed();
    },
    manual() { clearRetry(); if (stable) cancel(stable); stable = null; incident = false; state.attempts = 0; state.problem = false; state.message = 'Recarregando…'; changed(); },
    configure() { schedule(); changed(); },
    stop() { stopped = true; clearRetry(); if (stable) cancel(stable); }
  };
}
module.exports = { createHealth };
