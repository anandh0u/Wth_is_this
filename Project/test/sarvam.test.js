const test=require('node:test'); const assert=require('node:assert/strict');
const {sarvamDecision,decide,aiMessages}=require('../desktop/ai/lui-engine');
test('Sarvam conversation preserves response and cannot execute actions',async(t)=>{
 let request;
 t.mock.method(globalThis,'fetch',async(url,options)=>{request=JSON.parse(options.body);return{ok:true,json:async()=>({choices:[{message:{content:'Hello from Lui.'}}]})};});
 const result=await sarvamDecision({kind:'chat',text:'Hello'},{sarvamApiKey:'test-only'});
 assert.equal(result.action,'none');assert.equal(result.line,'Hello from Lui.');assert.equal(request.messages.at(-1).content,'Hello');
});
test('cloud API errors are visible rather than fake successful replies',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status:401}));
 const result=await decide({kind:'chat',text:'Hi'},{sarvamApiKey:'test-only'});
 assert.equal(result.source,'unavailable');assert.match(result.line,/401/);
});
test('history filters untrusted roles',()=>assert.equal(aiMessages({history:[{role:'system',content:'evil'}]}).filter(x=>x.role==='system').length,1));
