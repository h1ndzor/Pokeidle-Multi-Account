const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdates } = require('../src/app-updates');
function fixture(enabled = true) {
  const updater = new EventEmitter(), calls = [];
  updater.checkForUpdates = async () => { calls.push('check'); updater.emit('update-available', { version: '0.2.0' }); };
  updater.downloadUpdate = async () => { calls.push('download'); updater.emit('download-progress', { percent: 65 }); updater.emit('update-downloaded', { version: '0.2.0' }); };
  updater.quitAndInstall = () => calls.push('install');
  const control = createUpdates({ updater, enabled, version: '0.1.0', disabledReason: 'disabled', notify() {}, prepareInstall: async () => calls.push('flush') });
  return { updater, calls, control };
}
test('consulta, baixa e só instala após solicitação explícita', async () => {
  const { updater, calls, control } = fixture();
  await control.action('install'); assert.deepEqual(calls, []);
  await control.action('check'); assert.equal(control.getState().phase, 'available');
  await control.action('download'); assert.equal(control.getState().phase, 'ready');
  assert.deepEqual(calls, ['check', 'download']);
  assert.equal(updater.autoInstallOnAppQuit, false);
  await control.action('install'); await control.action('install');
  assert.deepEqual(calls, ['check', 'download', 'flush', 'install']);
});
test('modo de desenvolvimento não consulta nem instala', async () => {
  const {calls,control}=fixture(false);
  for(const action of ['check','download','install']) await control.action(action);
  assert.deepEqual(calls,[]); assert.equal(control.getState().phase,'disabled');
});
test('falha de rede pode ser tentada novamente', async () => {
  const {updater,control}=fixture();
  const original=updater.checkForUpdates;
  updater.checkForUpdates=async()=>{throw Error('offline');};
  await control.action('check');assert.equal(control.getState().phase,'error');
  updater.checkForUpdates=original;await control.action('check');assert.equal(control.getState().phase,'available');
});
test('não duplica download nem perde o instalador pronto ao verificar', async () => {
  const {updater,control,calls}=fixture(); let finish;
  await control.action('check');
  updater.downloadUpdate=()=>new Promise(resolve=>{calls.push('download');finish=resolve;});
  const pending=control.action('download');await control.action('download');await control.action('check');
  assert.deepEqual(calls,['check','download']);
  updater.emit('update-downloaded',{version:'0.2.0'});finish();await pending;
  await control.action('check');assert.equal(control.getState().phase,'ready');
});
