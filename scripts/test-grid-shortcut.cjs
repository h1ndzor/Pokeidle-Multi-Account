const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'poke-vote-test-'));
fs.writeFileSync(path.join(tmp,'main.cjs'),`const e=require('electron');e.app.setPath('appData',${JSON.stringify(tmp)});global.links=[];e.shell.openExternal=async url=>global.links.push(url);e.app.whenReady().then(()=>{for(let i=1;i<=4;i++)e.session.fromPartition('persist:pokeidle-account-'+i).protocol.handle('https',()=>new Response('<html><title>Fixture</title><body>Test</body></html>',{headers:{'content-type':'text/html'}}));});require(${JSON.stringify(path.join(root,'src/main.js'))});`);

(async()=>{
 let app;
 try {
  app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(tmp,'main.cjs')]});
  let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForSelector('.account');
  const cmd=(name,value)=>page.evaluate(([n,v])=>window.poke.command(n,v),[name,value]);
  const shortcut=()=>app.evaluate(({BrowserWindow})=>{const view=BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents?.getURL().endsWith('/grid-shortcut.html'));return {visible:view.getVisible(),bounds:view.getBounds()};});
  assert.equal((await shortcut()).visible,false);
  await cmd('zoom',{id:0,step:-1});await cmd('focus',{id:0});await cmd('zoom',{id:0,step:1});
  assert.equal((await cmd('focus',{id:0})).selected,null);
  assert.equal((await cmd('state')).accounts[0].zoom,0.9);
  await cmd('focus',{id:0});assert.equal((await cmd('state')).accounts[0].zoom,1.1);
  assert.equal((await shortcut()).visible,false);
  await app.evaluate(async ({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents?.getURL().endsWith('/toggle.html')).webContents;await wc.executeJavaScript("window.poke.command('toggle-header')");});
  assert.deepEqual(await shortcut(),{visible:true,bounds:{x:0,y:0,width:36,height:36}});
  await app.evaluate(async ({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents?.getURL().endsWith('/grid-shortcut.html')).webContents;await wc.executeJavaScript("document.querySelector('button').click();void 0");});
  await page.waitForFunction(async ()=>(await window.poke.command('state')).selected===null);
  assert.equal((await shortcut()).visible,false);assert.equal((await cmd('state')).headerHidden,true);assert.equal((await cmd('state')).accounts[0].zoom,0.9);
  await cmd('focus',{id:1});await cmd('enabled',{id:2,enabled:false});await cmd('enabled',{id:2,enabled:true});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.at(-1).webContents.getURL().endsWith('/grid-shortcut.html')),true);
  const denied=await app.evaluate(async ({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].contentView.children.at(-1).webContents;return wc.executeJavaScript("window.poke.command('economy',true).then(()=>false,()=>true)");});assert(denied);
  console.log('PASS: segundo clique, zoom restaurado, atalho só com barra oculta e conta ampliada, volta ao grid, sobreposição e IPC limitado.');
 } finally {if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
