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
  let page=await launch();const cmd=(n,v)=>page.evaluate(([n,v])=>window.poke.command(n,v),[n,v]);
  assert.equal((await cmd('state')).economy,false);
  await cmd('economy',true);await cmd('focus',{id:0});
  const throttling=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents&&v.webContents.getURL().startsWith('https://pokeidle.io')).map(v=>v.webContents.getBackgroundThrottling()));
  assert.deepEqual(throttling,[true,true,true,true]);
  await app.evaluate(async ({session})=>session.fromPartition('persist:pokeidle-account-2').cookies.set({url:'https://pokeidle.io',name:'preserved',value:'yes',expirationDate:Date.now()/1000+3600}));
  await cmd('focus',{id:1});await cmd('enabled',{id:1,enabled:false});
  let state=await cmd('state');assert.equal(state.selected,null);assert.equal(state.accounts[1].enabled,false);
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.length),5);
  await cmd('enabled',{id:1,enabled:true});
  const cookie=await app.evaluate(async ({session})=>(await session.fromPartition('persist:pokeidle-account-2').cookies.get({name:'preserved'}))[0].value);assert.equal(cookie,'yes');
  await cmd('address');await page.waitForTimeout(3200);state=await cmd('state');assert(state.usage.total.memory>0);assert.equal(state.usage.accounts.length,4);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1000,650));
  await page.locator('#close-popups').scrollIntoViewIfNeeded();assert(await page.locator('#close-popups').isVisible());
  await app.evaluate(async ({BrowserWindow})=>{
    const w=BrowserWindow.getAllWindows()[0];const views=w.contentView.children.filter(v=>v.webContents?.getURL().startsWith('https://pokeidle.io'));
    const created=new Promise(r=>views[1].webContents.once('did-create-window',r));
    await views[1].webContents.executeJavaScript("window.open('https://topidle.com/jogo/test?playerIdentifier=test');void 0",true);await created;
  });
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),2);
  await cmd('close-popups');
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);
await cmd('address');assert.equal((await cmd('state')).usage,null);
  for(let id=0;id<4;id++)await cmd('enabled',{id,enabled:false});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.length),2);
  await app.close();app=null;page=await launch();state=await cmd('state');assert(state.economy);assert(state.accounts.every(a=>!a.enabled));
  await cmd('enabled',{id:2,enabled:true});await cmd('focus',{id:2});await cmd('economy',false);await page.waitForFunction(async ()=>(await window.poke.command('state')).accounts[2].status==='Pronta');
  for (let attempt=0;attempt<100;attempt++) {
    const ready=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.some(v=>v.webContents?.getURL().startsWith('https://pokeidle.io')));
    if(ready)break;await page.waitForTimeout(50);
  }
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents&&v.webContents.getURL().startsWith('https://pokeidle.io')).webContents.getBackgroundThrottling()),false);
  console.log('PASS: economia, descarregamento real, cookies preservados, métricas, painel, todas desligadas, reinício e reativação.');
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});



