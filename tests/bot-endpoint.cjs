/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness for transpiled handlers. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
function compile(file, requireFn) {
 const exports = {};
 const js = ts.transpileModule(fs.readFileSync(root+'/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js, {exports, require:requireFn, process, Buffer, Response, Request, console});
 return exports;
}
const validation = compile('lib/reports/validation.ts',require);
const bot = compile('lib/reports/bot-validation.ts',p=>p==='./validation'?validation:require(p));
const payload={source:'telegram',external_id:'telegram:123:42',category:'inundacion',description:'Agua acumulada en la esquina',address:'Belgrano 123',reporter:{telegram_user_id:'456',telegram_chat_id:'123'},photo:{telegram_file_id:'large-photo'},reported_at:'2026-10-24T12:00:00Z'};
const parsed=bot.parseBotReport(payload,payload.external_id);
assert.equal(parsed.category,'INUNDACION');assert.equal(parsed.telegramFileId,'large-photo');
assert.equal(bot.parseBotReport({...payload,category:'arbolado'},payload.external_id).category,'ARBOLADO');
for(const bad of [{...payload,description:'corto'},{...payload,category:'unknown'},{...payload,photo:{}},{...payload,reported_at:'invalid'},{...payload,reporter:{telegram_user_id:'456',telegram_chat_id:'999'}}]) assert.throws(()=>bot.parseBotReport(bad,payload.external_id));
const schema={citizenReports:Object.fromEntries(['externalId','publicId','telegramFileId','photoStorageKey','photoUrl','photoUploadTokenHash','photoContentType','photoFilename','updatedAt'].map(key=>[key,key]))};
const reports=new Map();
const idFor=number=>`12345678-1234-4123-8123-${String(number).padStart(12,'0')}`;
let nextId=1;
let insertCalls=0;
let classifierCalls=0;
let photoStorageFailures=0;
let photoStorageCalls=0;
const pick=(row,projection)=>Object.fromEntries(Object.entries(projection).map(([key,column])=>[key,row[column]]));
const conditionMatches=(row,condition)=>{
 const conditions=Array.isArray(condition)?condition:[condition];
 return conditions.every(entry=>entry?.isNull?row[entry.column]==null:!entry?.column||row[entry.column]===entry.value);
};
const db={
 select:projection=>({from:()=>({where:condition=>({limit:async()=>{
  const row=Array.from(reports.values()).find(entry=>conditionMatches(entry,condition));
  return row?[pick(row,projection)]:[];
 }})})}),
 insert:()=>({values:values=>({onConflictDoNothing:()=>({returning:async projection=>{
  insertCalls++;
  if(reports.has(values.externalId))return [];
  const id=idFor(nextId++);
  reports.set(values.externalId,{...values,publicId:id});
  return [pick(reports.get(values.externalId),projection)];
 }})})}),
 update:()=>({set:values=>{
  let updated;
  const builder={where:condition=>{
   const row=Array.from(reports.values()).find(entry=>conditionMatches(entry,condition));
   if(row){Object.assign(row,values);updated=row;}
   return builder;
  },returning:async projection=>updated?[pick(updated,projection)]:[]};
  return builder;
 }}),
};
const classification={
 unavailableClassification:declaredCategory=>({declaredCategory,urgency:null,suggestedUrgency:null,urgentProbability:null,urgencyClassificationStatus:'UNAVAILABLE',urgencyClassificationModel:null}),
 classifyReport:async(_description,declaredCategory)=>{classifierCalls++;return {declaredCategory,urgency:'URGENTE',suggestedUrgency:'URGENTE',urgentProbability:0.82,urgencyClassificationStatus:'AUTO_ASSIGNED',urgencyClassificationModel:'jev-test'};},
};
const photoStorage={storeTelegramPhoto:async reportId=>{
 photoStorageCalls++;
 if(photoStorageFailures>0){photoStorageFailures--;throw new Error('storage unavailable');}
 return {key:`reports/${reportId}/telegram-abcdefabcdefabcdefabcdef.jpg`,contentType:'image/jpeg',filename:'foto.jpg'};
}};
const route=compile('app/api/bot/reports/route.ts',p=>p==='@reportar/db'?{db}:p==='@reportar/db/schema'?schema:p==='drizzle-orm'?{eq:(column,value)=>({column,value}),and:(...conditions)=>conditions,isNull:column=>({column,isNull:true})}:p==='@/lib/reports/bot-validation'?bot:p==='@/lib/reports/validation'?validation:p==='@/lib/reports/classification'?classification:p==='@/lib/reports/telegram-photo'?photoStorage:require(p));
process.env.REPORTS_API_TOKEN='test-only-token';
async function send(body=payload,extra={}){return route.POST(new Request('http://localhost/api/bot/reports',{method:'POST',headers:{authorization:'Bearer test-only-token','idempotency-key':body?.external_id||payload.external_id,...extra},body:typeof body==='string'?body:JSON.stringify(body)}));}
(async()=>{
 assert.equal((await send(payload,{authorization:'Bearer wrong'})).status,401);
 assert.equal((await send('{')).status,400);
 assert.equal((await send(payload,{'idempotency-key':'bad'})).status,422);
 assert.equal((await send('x'.repeat(20001))).status,413);
 const created=await send();const createdBody=await created.json();assert.equal(created.status,201);assert.deepEqual({...createdBody},{id:idFor(1),status:'received',photo_status:'stored'});
 const stored=reports.get(payload.external_id);assert.equal(stored.telegramFileId,'large-photo');assert.equal(stored.category,'INUNDACION');assert.equal(stored.urgency,'URGENTE');assert.equal(stored.urgencyClassificationStatus,'AUTO_ASSIGNED');assert.equal(stored.declaredCategory,'INUNDACION');assert.equal(stored.photoStorageKey,`reports/${idFor(1)}/telegram-abcdefabcdefabcdefabcdef.jpg`);assert.equal(classifierCalls,1);
 const changedDuplicate=await send({...payload,description:'Texto cambiado en el reintento',photo:{telegram_file_id:'different-photo'}});assert.equal(changedDuplicate.status,200);assert.deepEqual(await changedDuplicate.json(),{id:idFor(1),status:'received',photo_status:'stored'});assert.equal(stored.description,'Agua acumulada en la esquina');assert.equal(stored.telegramFileId,'large-photo');assert.equal(photoStorageCalls,1);assert.equal(insertCalls,1);assert.equal(classifierCalls,1);
 const retryPayload={...payload,external_id:'telegram:124:43',reporter:{...payload.reporter,telegram_chat_id:'124'},photo:{telegram_file_id:'retry-photo'}};
 photoStorageFailures=1;
 const partial=await send(retryPayload);assert.equal(partial.status,201);assert.deepEqual(await partial.json(),{id:idFor(2),status:'received',photo_status:'failed'});assert.equal(reports.has(retryPayload.external_id),true);assert.equal(reports.get(retryPayload.external_id).photoStorageKey,undefined);
 const retried=await send(retryPayload);assert.equal(retried.status,200);assert.deepEqual(await retried.json(),{id:idFor(2),status:'received',photo_status:'stored'});assert.equal(reports.get(retryPayload.external_id).telegramFileId,'retry-photo');assert.equal(photoStorageCalls,3);assert.equal(insertCalls,2);assert.equal(classifierCalls,2);
 const noPhoto={...payload,external_id:'telegram:125:44',reporter:{...payload.reporter,telegram_chat_id:'125'},photo:null};
 const noPhotoResponse=await send(noPhoto);assert.equal(noPhotoResponse.status,201);assert.deepEqual(await noPhotoResponse.json(),{id:idFor(3),status:'received'});
 const concurrent={...payload,external_id:'telegram:126:45',reporter:{...payload.reporter,telegram_chat_id:'126'}};
 const concurrentResponses=await Promise.all([send(concurrent),send(concurrent)]);
 const concurrentBodies=await Promise.all(concurrentResponses.map(response=>response.json()));
 assert.deepEqual(concurrentResponses.map(response=>response.status).sort(),[200,201]);
 assert.equal(concurrentBodies[0].id,concurrentBodies[1].id);assert.equal(concurrentBodies[0].photo_status,'stored');assert.equal(concurrentBodies[1].photo_status,'stored');
 assert.equal(reports.has(concurrent.external_id),true);assert.equal(insertCalls,5);assert.equal(classifierCalls,4);
 // The form uses the same Blob capability as the web, never Telegram/S3.
 const callsBeforeBlob=photoStorageCalls;
 const blobPayload={...noPhoto,external_id:'telegram:125:46',expectsPhoto:true};
 const blobCreated=await send(blobPayload);const blobBody=await blobCreated.json();
 assert.equal(blobCreated.status,201);assert.equal(blobBody.status,'received');assert.equal(blobBody.photo_status,'pending');
 assert.match(blobBody.photoUploadToken,/^[a-f0-9]{64}$/);
 const blobRow=reports.get(blobPayload.external_id);
 assert.equal(blobRow.photoUploadTokenHash,require('node:crypto').createHash('sha256').update(blobBody.photoUploadToken).digest('hex'));
 assert.equal(blobRow.expectsPhoto,undefined);
 const again=await send(blobPayload);assert.equal(again.status,200);assert.deepEqual(await again.json(),blobBody);
 assert.equal(photoStorageCalls,callsBeforeBlob);
 // Lost attach response: retrying creation discovers the existing photo and
 // never recreates the consumed capability or overwrites the report.
 blobRow.photoUrl=`https://store.public.blob.vercel-storage.com/reports/${blobBody.id}/foto.heic`;
 blobRow.photoUploadTokenHash=null;
 const attached=await send(blobPayload);assert.deepEqual(await attached.json(),{id:blobBody.id,status:'received',photo_status:'stored'});
 assert.equal(blobRow.photoUploadTokenHash,null);
 assert.equal(photoStorageCalls,callsBeforeBlob);
 assert.equal((await send({...noPhoto,expectsPhoto:'true'})).status,422);
 assert.equal((await send({...payload,expectsPhoto:true})).status,422);
 delete process.env.REPORTS_API_TOKEN;assert.equal((await send()).status,503);
 console.log('Validation + endpoint tests passed (auth, limits, create, duplicate, concurrent idempotency, photo retry, text-only)');
})().catch(e=>{console.error(e);process.exitCode=1});
