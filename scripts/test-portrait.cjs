const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'poke-vote-test-'));
fs.writeFileSync(path.join(tmp,'main.cjs'),`const e=require('electron');e.app.setPath('appData',${JSON.stringify(tmp)});global.links=[];e.shell.openExternal=async url=>global.links.push(url);e.app.whenReady().then(()=>{for(let i=1;i<=4;i++)e.session.fromPartition('persist:pokeidle-account-'+i).protocol.handle('https',()=>new Response('<html><title>Fixture</title><body>Test</body></html>',{headers:{'content-type':'text/html'}}));});require(${JSON.stringify(path.join(root,'src/main.js'))});`);

(async()=>{let app;try{
 app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(tmp,'main.cjs')]});
 let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}await page.waitForSelector('.account');
 const cmd=(n,v)=>page.evaluate(([n,v])=>window.poke.command(n,v),[n,v]);
 await cmd('health-options',{alerts:false,autoRecover:false});
 await cmd('identity',{id:0,name:'Principal nome muito lon',color:'#abcdef'});await cmd('zoom',{id:0,step:-1});
 for(const [width,height] of [[1360,900],[1101,900],[1100,900],[1080,1800],[864,1440],[720,1280],[620,960],[604,480]]) {
  await app.evaluate(({BrowserWindow},[w,h])=>BrowserWindow.getAllWindows()[0].setContentSize(w,h),[width,height]);await page.waitForTimeout(100);
  const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,bar:document.querySelector('header').getBoundingClientRect().height,overflow:[...document.querySelectorAll('.top,nav,.account,.controls')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className||e.tagName)}));
  assert.deepEqual(dimensions.overflow,[],JSON.stringify(dimensions));
  const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.slice(0,4).map(v=>v.getBounds()));
  assert.equal(bounds[0].y,dimensions.bar);assert.equal(bounds[0].width+bounds[1].width,dimensions.width);assert.equal(bounds[0].height+bounds[2].height+dimensions.bar,dimensions.height);assert.equal(bounds[2].y,bounds[0].y+bounds[0].height);
  await cmd('address');
  const panel=await page.evaluate(()=>({overflow:document.querySelector('#settings-panel').scrollWidth>document.querySelector('#settings-panel').clientWidth+1,height:document.querySelector('header').getBoundingClientRect().height}));
  assert.equal(panel.overflow,false,'Painel '+width);assert(panel.height<=dimensions.height-180);
  await page.locator('#update-check').scrollIntoViewIfNeeded();assert(await page.locator('#update-check').isVisible());
  await cmd('address');assert.equal((await cmd('state')).accounts[0].zoom,0.9);
 }
 await cmd('focus',{id:0});assert.equal((await cmd('state')).accounts[0].zoom,1);
 await app.evaluate(async ({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents?.getURL().endsWith('/toggle.html')).webContents;await wc.executeJavaScript("window.poke.command('toggle-header')");});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds().y),0);
 console.log('PASS: 8 tamanhos, controles sem overflow, configurações acessíveis, grid 2x2 exato, zoom preservado e barra oculta.');
}finally{if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1});
