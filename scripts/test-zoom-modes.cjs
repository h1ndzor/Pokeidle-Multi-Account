const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'poke-vote-test-'));
fs.writeFileSync(path.join(tmp,'main.cjs'),`const e=require('electron');e.app.setPath('appData',${JSON.stringify(tmp)});global.links=[];e.shell.openExternal=async url=>global.links.push(url);e.app.whenReady().then(()=>{for(let i=1;i<=4;i++)e.session.fromPartition('persist:pokeidle-account-'+i).protocol.handle('https',()=>new Response('<html><title>Fixture</title><body>Test</body></html>',{headers:{'content-type':'text/html'}}));});require(${JSON.stringify(path.join(root,'src/main.js'))});`);

fs.mkdirSync(path.join(tmp,'PokeIdleMulti'),{recursive:true});
fs.writeFileSync(path.join(tmp,'PokeIdleMulti/preferences.json'),JSON.stringify({url:'https://pokeidle.io',zoom:[0.7,0.8,0.9,1]}));
(async()=>{
 let app;
 async function launch(){
  app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(tmp,'main.cjs')]});
  let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForSelector('.account');return page;
 }
 try{
  let page=await launch();
  const cmd=(name,value)=>page.evaluate(([n,v])=>window.poke.command(n,v),[name,value]);
  const zooms=s=>s.accounts.map(a=>a.zoom);
  assert.deepEqual(zooms(await cmd('state')),[0.7,0.8,0.9,1]);
  assert.deepEqual(zooms(await cmd('focus',{id:0})),[1,1,1,1]);
  await cmd('zoom',{id:0,step:1});
  await cmd('focus',{id:1});await cmd('zoom',{id:1,step:-1});
  assert.deepEqual(zooms(await cmd('state')),[1.1,0.9,1,1]);
  assert.deepEqual(zooms(await cmd('grid')),[0.7,0.8,0.9,1]);
  await cmd('zoom',{id:2,step:0});
  await cmd('focus',{id:0});
  const actual=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents&&v.webContents.getURL().startsWith('https://pokeidle.io')).map(v=>v.webContents.getZoomFactor()));
  assert.equal(actual.length,4);actual.forEach((n,i)=>assert(Math.abs(n-[1.1,0.9,1,1][i])<0.001));
  await cmd('refresh',{id:0});
  await new Promise(r=>setTimeout(r,500));
  const refreshed=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.getZoomFactor());assert(Math.abs(refreshed-1.1)<0.001);
  await app.close();app=null;page=await launch();
  assert.deepEqual(zooms(await cmd('state')),[0.7,0.8,1,1]);
  assert.deepEqual(zooms(await cmd('focus',{id:1})),[1.1,0.9,1,1]);
  console.log('PASS: migração, grid/ampliada independentes, troca de conta, reset, zoom real, recarga e persistência após reiniciar.');
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
