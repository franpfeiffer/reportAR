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
const schema={citizenReports:{externalId:'external',publicId:'public'}};
let input;
const id='12345678-1234-4123-8123-123456789012';
let storedId;
let classifierCalls=0;
const db={
 select:()=>({from:()=>({where:()=>({limit:async()=>storedId?[{id:storedId}]:[]})})}),
 insert:()=>({values:x=>{input=x;return {onConflictDoNothing:()=>({returning:async()=>{if(storedId)return [];storedId=id;return [{id}]}})}}}),
 update:()=>({set:x=>({where:async()=>{input={...input,...x}}})}),
};
const classification={
 unavailableClassification:category=>({category,declaredCategory:category,suggestedCategory:null,classificationProbability:null,classificationStatus:'UNAVAILABLE',classificationModel:null}),
 classifyReport:async(_description,category)=>{classifierCalls++;return {category:'INUNDACION',declaredCategory:category,suggestedCategory:'INUNDACION',classificationProbability:0.82,classificationStatus:'AUTO_ASSIGNED',classificationModel:'jev-test'};},
};
const route=compile('app/api/bot/reports/route.ts',p=>p==='@reportar/db'?{db}:p==='@reportar/db/schema'?schema:p==='drizzle-orm'?{eq:()=>true}:p==='@/lib/reports/bot-validation'?bot:p==='@/lib/reports/validation'?validation:p==='@/lib/reports/classification'?classification:require(p));
process.env.REPORTS_API_TOKEN='test-only-token';
async function send(body=payload,extra={}){return route.POST(new Request('http://localhost/api/bot/reports',{method:'POST',headers:{authorization:'Bearer test-only-token','idempotency-key':payload.external_id,...extra},body:typeof body==='string'?body:JSON.stringify(body)}));}
(async()=>{
 assert.equal((await send(payload,{authorization:'Bearer wrong'})).status,401);
 assert.equal((await send('{')).status,400);
 assert.equal((await send(payload,{'idempotency-key':'bad'})).status,422);
 assert.equal((await send('x'.repeat(20001))).status,413);
 const created=await send();assert.equal(created.status,201);assert.equal((await created.json()).id,id);assert.equal(input.telegramFileId,'large-photo');assert.equal(input.classificationStatus,'AUTO_ASSIGNED');assert.equal(classifierCalls,1);
 assert.equal((await send()).status,200);assert.equal(classifierCalls,1);
 delete process.env.REPORTS_API_TOKEN;assert.equal((await send()).status,503);
 console.log('Validation + endpoint tests passed (401/400/422/413/201/200/503)');
})().catch(e=>{console.error(e);process.exitCode=1});
