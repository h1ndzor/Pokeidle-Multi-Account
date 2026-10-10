// Controlador independente da interface, para testar sem instalar nada de verdade.
function createUpdates({ updater, enabled, version, disabledReason, notify, prepareInstall }) {
  let state = { phase: enabled ? 'idle' : 'disabled', version, nextVersion: '', percent: 0,
    message: enabled ? 'Pronto para verificar atualizações.' : disabledReason };
  const set = values => { state = { ...state, ...values }; notify(); };
  const fail = () => set({ phase: 'error', message: 'Não foi possível atualizar. Confira a conexão e tente verificar novamente.' });
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.on('checking-for-update', () => set({ phase: 'checking', message: 'Verificando novas versões…' }));
  updater.on('update-available', info => set({ phase: 'available', nextVersion: info.version, message: `Versão ${info.version} disponível.` }));
  updater.on('update-not-available', () => set({ phase: 'current', nextVersion: '', message: 'Você está na versão mais recente.' }));
  updater.on('download-progress', info => set({ phase: 'downloading', percent: Math.max(0, Math.min(100, Math.round(info.percent || 0))), message: 'Baixando atualização…' }));
  updater.on('update-downloaded', info => set({ phase: 'ready', nextVersion: info.version, percent: 100, message: 'Download concluído. Instale quando puder reiniciar o app.' }));
  updater.on('error', fail);
  return {
    getState: () => ({ ...state }),
    async action(action) {
      if (!enabled) return;
      try {
        if (action === 'check' && ['idle', 'current', 'error', 'available'].includes(state.phase)) {
          set({ phase: 'checking', percent: 0, message: 'Verificando novas versões…' });
          await updater.checkForUpdates();
        } else if (action === 'download' && state.phase === 'available') {
          set({ phase: 'downloading', percent: 0, message: 'Baixando atualização…' });
          await updater.downloadUpdate();
        } else if (action === 'install' && state.phase === 'ready') {
          set({ phase: 'installing', message: 'Preparando instalação…' });
          await prepareInstall();
          updater.quitAndInstall(false, true);
        }
      } catch { fail(); }
    }
  };
}
module.exports = { createUpdates };
