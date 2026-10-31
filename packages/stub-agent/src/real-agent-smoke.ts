// User-authorized staging acceptance. Credentials live in a temporary 0600
// JSON file, never argv, logs or the repository. All posts contain test text.
import { readFile,writeFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const [phase,file]=process.argv.slice(2);
if(!file?.startsWith('/private/tmp/agent-social-m3-')) throw new Error('Expected an ephemeral M3 credentials file');
const state=JSON.parse(await readFile(file,'utf8'));
const base='http://localhost:4317/api/v1/agent';
async function call(token:string,operation:string,body?:unknown) {
  const response=await fetch(`${base}/${operation}`,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
if(phase==='create') {
  for(const token of [state.a,state.b]) assert.equal((await call(token,'manifest',{protocol_version:'p0a.1',transport:'longpoll'})).status,200);
  const posted=await call(state.a,'post',{body:'M3 staging acceptance: public observation.'});
  assert.equal(posted.status,200);state.postId=posted.data.id;
  const inquiry=await call(state.b,'inquire',{postId:state.postId,question:'M3 test: may I receive an approved short reply?'});
  assert.equal(inquiry.status,200);state.inquiryId=inquiry.data.inquiryId;
  const event=await call(state.a,'events?timeout=0');
  assert.equal(event.status,200);
  const received=event.data.events.find((e:{type:string;payload:{inquiryId:string}})=>e.type==='inquiry.received'&&e.payload.inquiryId===state.inquiryId);
  assert.ok(received);state.consentId=received.payload.consentId;
  assert.equal((await call(state.b,'transfers')).data.length,0);
  assert.equal((await call(state.a,'decide',{consentId:state.consentId,approve:true})).status,403);
  const inquiryView=await call(state.b,'inquiries');
  assert.ok(!JSON.stringify(inquiryView.data).includes('summary_draft'));
  await writeFile(file,JSON.stringify(state),{mode:0o600});
  console.log('PASS manifest, post, inquiry, pending draft isolation, no transfer before approval, agent consent denied');
} else if(phase==='approved') {
  const result=await call(state.b,'events?timeout=1000');
  const delivered=result.data.events.find((e:{type:string;payload:{inquiryId:string}})=>e.type==='transfer.delivered'&&e.payload.inquiryId===state.inquiryId);
  assert.ok(delivered);assert.equal(delivered.payload.body,'M3 staging acceptance: owner approved this exact reply.');
  state.cursor=result.data.cursor;
  const transfers=await call(state.b,'transfers');
  assert.ok(transfers.data.some((t:{consent_id:string})=>t.consent_id===state.consentId));
  await writeFile(file,JSON.stringify(state),{mode:0o600});
  console.log('PASS human approval, exact approved transfer and event delivery');
} else if(phase==='watch') {
  const started=Date.now();
  console.log('Polling started; waiting for token rotation/revocation');
  const result=await call(state.b,`events?cursor=${state.cursor}&timeout=20000`);
  assert.equal(result.status,401);
  console.log(`PASS live poll rejected revoked credential after ${Date.now()-started} ms`);
} else if(phase==='rotated') {
  assert.equal((await call(state.b,'feed')).status,401);
  assert.equal((await call(state.bNew,'feed')).status,200);
  state.b=state.bNew;delete state.bNew;
  await writeFile(file,JSON.stringify(state),{mode:0o600});
  console.log('PASS old token rejected, new token accepted');
} else if(phase==='revoked') {
  for(const token of [state.a,state.b]) assert.equal((await call(token,'feed')).status,401);
  console.log('PASS all test tokens revoked');
} else { throw new Error('Unknown acceptance phase'); }
