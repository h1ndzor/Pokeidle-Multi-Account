const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { webURL, isTwitchURL, openBrowserLink, detectBrowsers } = require('../src/browser-links');

test('permite somente links web sem credenciais', () => {
  for (const value of ['file:///C:/Windows', 'javascript:alert(1)', 'data:text/html,test', '--flag', 'https://user:pass@example.com']) {
    assert.throws(() => webURL(value));
  }
  assert.equal(webURL('https://www.twitch.tv/channel?a=1&b=2').hostname, 'www.twitch.tv');
  assert.equal(isTwitchURL('https://twitch.tv.evil.example'), false);
  assert.equal(isTwitchURL('https://www.twitch.tv/channel'), true);
});
test('navegador padrão recebe somente a URL validada', async () => {
  const calls = [];
  await openBrowserLink('https://www.twitch.tv/test?a=1&b=2', 'default', { browsers: [], openExternal: async url => calls.push(url) });
  assert.deepEqual(calls, ['https://www.twitch.tv/test?a=1&b=2']);
  await assert.rejects(openBrowserLink('file:///C:/test', 'default', { browsers: [], openExternal: async () => assert.fail('não deveria abrir') }));
});
test('navegador específico usa argumentos separados sem terminal', async () => {
  const executable = 'C:/Program Files/Browser/browser.exe';
  const url = 'https://example.com/?text=%22&x=1';
  await openBrowserLink(url, 'chrome', { browsers: [{ id: 'chrome', executable }], launch: (file, args, options) => {
    assert.equal(file, executable); assert.deepEqual(args, [url]); assert.equal(options.shell, false);
    const child = new EventEmitter(); child.unref = () => {};
    process.nextTick(() => child.emit('spawn')); return child;
  } });
});
test('navegador ausente ou falha ao iniciar produz erro', async () => {
  await assert.rejects(openBrowserLink('https://example.com', 'firefox', { browsers: [] }), /não encontrado/);
  await assert.rejects(openBrowserLink('https://example.com', 'chrome', {
    browsers: [{ id: 'chrome', executable: 'chrome.exe' }], launch: () => {
      const child = new EventEmitter(); process.nextTick(() => child.emit('error', new Error('ENOENT'))); return child;
    }
  }), /Não foi possível/);
});
test('detecção verifica instalações nos diretórios conhecidos', () => {
  const result = detectBrowsers({ LOCALAPPDATA: 'C:/Local' }, file => file.endsWith('chrome.exe'));
  assert(result.find(b => b.id === 'chrome').executable);
  assert.equal(result.find(b => b.id === 'firefox').executable, null);
});
