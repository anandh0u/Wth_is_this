const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('path'); const fs=require('fs');
app.setPath('userData',path.join(app.getPath('temp'),'lui-render-smoke'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const state={boredom:45,mood:'annoyed',settings:{petWalkingEnabled:true},events:[],notes:[],todos:[]};
ipcMain.handle('get-state',()=>state);
ipcMain.handle('list-data',(_,type)=>state[type]||[]);
ipcMain.handle('add-event',(_,input)=>{state.events.push({id:'test',status:'scheduled',...input});return state.events;});
ipcMain.handle('ask-lui',()=>({line:'Test response.',action:'none'}));
app.whenReady().then(async()=>{
 const errors=[]; const root=path.join(__dirname,'..');
 const win=new BrowserWindow({show:false,width:824,height:520,webPreferences:{preload:path.join(root,'desktop/preload.js'),contextIsolation:true}});
 win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
 try {
 await win.loadFile(path.join(root,'desktop/index.html'));
 const result=await win.webContents.executeJavaScript(`(async()=>{
   document.querySelector('[data-view="schedule"]').click();
   const save=document.querySelector('#task-form button');
   if(getComputedStyle(save).color==='rgba(0, 0, 0, 0)') throw Error('Save invisible');
   document.querySelector('[name=name]').value='Smoke meeting';
   document.querySelector('[name=date]').value='2026-10-12';
   document.querySelector('[name=time]').value='10:30';
   document.querySelector('#task-form').requestSubmit();
   await new Promise(r=>setTimeout(r,150));
   if(!document.querySelector('#tasks').classList.contains('active'))throw Error('Submit did not navigate');
   if(!document.querySelector('#task-list').textContent.includes('Smoke meeting'))throw Error('Event missing');
   document.querySelector('[data-view=graph]').click();
   return {submit:true,graph:true,images:[...document.images].every(i=>i.complete && i.naturalWidth>0)};
 })()`);
 fs.mkdirSync(path.join(root,'dist/verification'),{recursive:true});
 fs.writeFileSync(path.join(root,'dist/verification/graph.png'),(await win.webContents.capturePage()).toPNG());
 await win.loadFile(path.join(root,'desktop/pet.html'));
 await new Promise(r=>setTimeout(r,1500));
 const pet=await win.webContents.executeJavaScript(`({loaded:document.querySelector('#lui-frame').src.startsWith('data:image/png'),mode:document.querySelector('#lui').dataset.mode})`);
 fs.writeFileSync(path.join(root,'dist/verification/pet.png'),(await win.webContents.capturePage()).toPNG());
 console.log(JSON.stringify({ui:result,pet,errors}));
 if(errors.length||!result.images||!pet.loaded)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=1;}finally{app.quit();}
});
