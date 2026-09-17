// Execute through private Railway SSH only. Never prints credentials or cookies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='http://127.0.0.1:3101';
const origin=process.env.PAPERCLIP_PUBLIC_URL;
const headers={'Content-Type':'application/json',Origin:origin,'X-Forwarded-Proto':'https','X-Forwarded-Host':new URL(origin).host};
const credentials=JSON.parse(readFileSync('/paperclip/private/owner.json','utf8'));
let response=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers,body:JSON.stringify(credentials)});
assert.equal(response.status,200,'Owner login');
const cookies=response.headers.getSetCookie();
assert(cookies.some(c=>/; Secure/i.test(c)),'Secure cookie');
const cookie=cookies.map(c=>c.split(';')[0]).join('; ');
response=await fetch(base+'/api/companies',{headers:{...headers,Cookie:cookie}});
assert.equal(response.status,200,'Authenticated access');
response=await fetch(base+'/api/companies');assert.equal(response.status,403,'Anonymous denied');
response=await fetch(base+'/api/auth/sign-up/email',{method:'POST',headers,body:JSON.stringify({email:'signup-probe@example.com',password:credentials.password,name:'Probe'})});
assert.equal((await response.json()).code,'EMAIL_PASSWORD_SIGN_UP_DISABLED');
response=await fetch(base+'/api/auth/sign-out',{method:'POST',headers:{...headers,Cookie:cookie},body:'{}'});assert.equal(response.status,200);
console.log('Internal owner login, secure cookies, authenticated access, signup lock, and sign-out verified.');
