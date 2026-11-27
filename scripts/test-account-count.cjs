const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'poke-vote-test-'));
fs.writeFileSync(path.join(tmp,'main.cjs'),`const e=require('electron');e.app.setPath('appData',${JSON.stringify(tmp)});global.links=[];e.shell.openExternal=async url=>global.links.push(url);e.app.whenReady().then(()=>{for(let i=1;i<=4;i++)e.session.fromPartition('persist:pokeidle-account-'+i).protocol.handle('https',()=>new Response('<html><title>Fixture</title><body>Test</body></html>',{headers:{'content-type':'text/html'}}));});require(${JSON.stringify(path.join(root,'src/main.js'))});`);

(async()=>{
 let app;
 async function launch(){
  app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(tmp,'main.cjs')]});
  let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.waitForSelector('.account');return page;
 }
 try {
  let page=await launch();
  const cmd=(n,v)=>page.evaluate(([n,v])=>window.poke.command(n,v),[n,v]);
  await page.waitForFunction(async ()=>(await window.poke.command('state')).accounts.every(a=>a.status==='Pronta'));
  const ids=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.slice(0,3).map(v=>v.webContents.id));
  await app.evaluate(async ({session})=>session.fromPartition('persist:pokeidle-account-4').cookies.set({url:'https://pokeidle.io',name:'preserved',value:'yes',expirationDate:Date.now()/1000+3600}));
  await cmd('focus',{id:3});
  await cmd('address');
  await page.locator('#account-count').selectOption('3');
  await page.waitForFunction(() => !document.querySelector('#account-count').disabled);
  await page.waitForFunction(async ()=>(await window.poke.command('state')).accountCount===3);
  let state=await cmd('state');assert.equal(state.selected,null);assert.equal(state.accounts[3].enabled,false);
  assert.equal(await page.locator('#accounts .account:visible').count(),3);
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.length),5);
  assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.slice(0,3).map(v=>v.webContents.id)),ids);
  await assert.rejects(cmd('enabled',{id:3,enabled:true}));
  await assert.rejects(cmd('account-count',2));
  await app.close();app=null;page=await launch();state=await cmd('state');assert.equal(state.accountCount,3);assert.equal(state.accounts[3].enabled,false);
  await cmd('account-count',4);await page.waitForFunction(async ()=>(await window.poke.command('state')).accounts[3].status==='Pronta');
  assert.equal(await page.locator('#accounts .account:visible').count(),4);
  assert.equal(await app.evaluate(async ({session})=>(await session.fromPartition('persist:pokeidle-account-4').cookies.get({name:'preserved'}))[0].value),'yes');
  await cmd('enabled',{id:3,enabled:false});await cmd('account-count',3);assert.equal((await cmd('state')).accountCount,3);
  await cmd('account-count',4);assert.equal((await cmd('state')).accounts[3].enabled,true);
  console.log('PASS: seletor 3/4, encerramento da quarta, persistência, cookies, validação e primeiras contas preservadas.');
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
