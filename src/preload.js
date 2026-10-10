// Ponte limitada: o HTML não recebe acesso ao Node.js nem ao sistema de arquivos.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('poke', {
  command: (name, value) => ipcRenderer.invoke('command', name, value),
  onState: callback => ipcRenderer.on('state', (_event, state) => callback(state))
});
