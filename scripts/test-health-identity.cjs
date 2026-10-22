const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'poke-vote-test-'));
fs.writeFileSync(path.join(tmp,'main.cjs'),`const e=require('electron');e.app.setPath('appData',${JSON.stringify(tmp)});global.links=[];e.shell.openExternal=async url=>global.links.push(url);e.app.whenReady().then(()=>{for(let i=1;i<=4;i++)e.session.fromPartition('persist:pokeidle-account-'+i).protocol.handle('https',()=>new Response('<html><title>Fixture</title><body>Test</body></html>',{headers:{'content-type':'text/html'}}));});require(${JSON.stringify(path.join(root,'src/main.js'))});`);

(async()=>{let app;
 async function launch(){app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(tmp,'main.cjs')]});let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}await page.waitForSelector('.account');return page;}
 try{let page=await launch();const cmd=(n,v)=>page.evaluate(([n,v])=>window.poke.command(n,v),[n,v]);
 await cmd('health-options',{alerts:false,autoRecover:false});
 await cmd('identity',{id:0,name:'Minha Principal',color:'#123456'});
 assert.equal(await page.locator('.select').first().textContent(),'Minha Principal');
 await assert.rejects(cmd('identity',{id:0,name:'',color:'red'}));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({type:'keyDown',keyCode:'2',modifiers:['control','alt']}));
 await page.waitForFunction(async ()=>(await window.poke.command('state')).selected===1);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[1].webContents.sendInputEvent({type:'keyDown',keyCode:'5',modifiers:['control','alt']}));
 await page.waitForFunction(async ()=>(await window.poke.command('state')).selected===null);
 await page.waitForTimeout(300);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.emit('did-fail-load',{},-105,'ERR_NAME_NOT_RESOLVED','https://pokeidle.io',true));
 let state=await cmd('state');assert(state.accounts[0].health.problem);assert.equal(state.accounts[0].health.nextRetry,null);
 await cmd('health-options',{alerts:false,autoRecover:true});state=await cmd('state');assert(state.accounts[0].health.nextRetry);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.emit('did-finish-load'));
 assert((await cmd('state')).accounts[0].health.problem); // página de erro não confirma recuperação
 await cmd('refresh',{id:0});await page.waitForFunction(async ()=>(await window.poke.command('state')).accounts[0].status==='Pronta');assert.equal((await cmd('state')).accounts[0].health.problem,false);
 await cmd('address');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1000,650));
 assert.equal(await page.evaluate(()=>document.querySelector('#settings-panel').scrollWidth>document.querySelector('#settings-panel').clientWidth),false);
 await app.close();app=null;page=await launch();state=await cmd('state');assert.equal(state.accounts[0].name,'Minha Principal');assert.equal(state.accounts[0].color,'#123456');assert.equal(state.autoRecover,true);assert.equal(state.alerts,false);
 console.log('PASS: nomes/cores, validação, atalhos na interface e no jogo, falhas, recuperação opcional, página de erro, persistência e layout.');
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
