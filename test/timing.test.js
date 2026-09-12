const test = require('node:test'); const assert = require('node:assert/strict');
const { reminderState, idleMemeDue } = require('../desktop/timing');
const now = Date.parse('2026-09-12T10:00:00Z');
const event = { status:'scheduled', startsAt: new Date(now).toISOString() };
test('reminder fires at scheduled time, not before',()=>{ assert.equal(reminderState(event,now-1),'skip'); assert.equal(reminderState(event,now),'due'); });
test('void and already-notified meetings never fire',()=>{ assert.equal(reminderState({...event,status:'void'},now),'skip'); assert.equal(reminderState({...event,notifiedAt:'yes'},now),'skip'); });
test('old meetings are marked missed without a notification burst',()=>assert.equal(reminderState(event,now+300001),'missed'));
test('invalid meeting time is ignored',()=>assert.equal(reminderState({...event,startsAt:'invalid'},now),'skip'));
test('idle audio respects toggle, lock, threshold and cooldown',()=>{
 const input={enabled:true,idleSeconds:60,threshold:60,lastPlayed:0,now:120000,locked:false};
 assert.equal(idleMemeDue(input),true);
 for(const patch of [{enabled:false},{locked:true},{idleSeconds:59},{lastPlayed:1}]) assert.equal(idleMemeDue({...input,...patch}),false);
});
