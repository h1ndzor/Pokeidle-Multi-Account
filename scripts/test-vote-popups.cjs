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
  const result=await app.evaluate(async ({BrowserWindow})=>{
   const w=BrowserWindow.getAllWindows()[0];const views=w.contentView.children.filter(v=>v.webContents&&v.webContents.getURL().startsWith('https://pokeidle.io'));
   if(views.length!==4)throw Error('Views não prontas');
   const opens=[];
   for(let id=1;id<4;id++){
    const wc=views[id].webContents;
    await wc.session.cookies.set({url:'https://topidle.com',name:'account',value:String(id),expirationDate:Date.now()/1000+3600});
    const popupPromise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Popup não abriu')),10000);wc.once('did-create-window',popup=>{clearTimeout(timer);resolve(popup)});});
    await wc.executeJavaScript(`window.open('https://topidle.com/jogo/pokeidle-io-5f9969?playerIdentifier=Player${id}');void 0`,true);
    const popup=await popupPromise;
    if(popup.webContents.isLoading())await new Promise(r=>popup.webContents.once('did-finish-load',r));
    if(popup.webContents.session!==wc.session)throw Error('Sessão incorreta');
    const cookies=await popup.webContents.session.cookies.get({url:'https://topidle.com'});
    if(cookies.find(c=>c.name==='account')?.value!==String(id))throw Error('Cookie misturado');
    if(!popup.webContents.getURL().includes('playerIdentifier=Player'+id))throw Error('Identificador perdido');
    opens.push(popup.webContents.getURL());
    const authPromise=new Promise(r=>popup.webContents.once('did-create-window',r));
    await popup.webContents.executeJavaScript("window.open('https://discord.com/oauth2/authorize');void 0",true);
    const auth=await authPromise;
    if(auth.webContents.isLoading())await new Promise(r=>auth.webContents.once('did-finish-load',r));
    if(auth.webContents.session!==wc.session)throw Error('OAuth perdeu sessão');
    const closed=new Promise(r=>auth.once('closed',r));await auth.webContents.executeJavaScript('window.close();void 0').catch(()=>{});await closed;
    const voteClosed=new Promise(r=>popup.once('closed',r));await popup.webContents.executeJavaScript('window.close();void 0').catch(()=>{});await voteClosed;
    if(!wc.getURL().startsWith('https://pokeidle.io'))throw Error('Jogo navegou');
   }
   await views[0].webContents.executeJavaScript("window.open('https://www.twitch.tv/example');void 0",true);
   return {opens,links:global.links,cookies1:await views[0].webContents.session.cookies.get({url:'https://topidle.com'})};
  });
  assert.equal(result.opens.length,3);assert.deepEqual(result.links,['https://www.twitch.tv/example']);assert.equal(result.cookies1.length,0);
  console.log('PASS: 3 popups, cookies isolados, identificadores, popup OAuth, window.close, jogo preservado e Twitch externa.');
 } finally {if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
