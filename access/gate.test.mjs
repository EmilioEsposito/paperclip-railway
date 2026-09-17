import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {createGate,accessVerifier} from './gate.mjs';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk=await exportJWK(publicKey);jwk.kid='test';
const issuer='https://test.cloudflareaccess.com',audience='paperclip-test',email='owner@example.com';
const verify=accessVerifier({issuer,audience,email,keySet:createLocalJWKSet({keys:[jwk]})});
async function token(overrides={},key=privateKey){
 return new SignJWT({type:'app',email,sub:'owner',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60,iss:issuer,aud:audience,...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(key);
}
test('valid signature, issuer, audience, expiry and exact owner are mandatory',async()=>{
 assert.equal((await verify({headers:{'cf-access-jwt-assertion':await token()}})).email,email);
 await assert.rejects(verify({headers:{}}));
 for(const overrides of [{aud:'another-app'},{iss:'https://other.example'},{exp:0},{email:'intruder@example.com'},{type:'service'},{exp:undefined}])
  await assert.rejects(verify({headers:{'cf-access-jwt-assertion':await token(overrides)}}));
 const other=await generateKeyPair('RS256');
 await assert.rejects(verify({headers:{'cf-access-jwt-assertion':await token({},other.privateKey)}}));
 await assert.rejects(verify({headers:{'cf-access-jwt-assertion':'forged'}}));
});
test('HTTP and WebSocket gates reject bypass and preserve authenticated proxying',async t=>{
 const upstream=http.createServer((req,res)=>{
  if(req.url==='/api/health'){res.end('sensitive health details');return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:req.url,host:req.headers.host,proto:req.headers['x-forwarded-proto'],jwt:req.headers['cf-access-jwt-assertion']??null}));
 });
 upstream.on('upgrade',(req,socket)=>{socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');socket.end();});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const gate=createGate({verify,upstreamPort:upstream.address().port,publicHost:'paperclip.example.com'});
 await new Promise(r=>gate.listen(0,'127.0.0.1',r));
 t.after(()=>{gate.closeAllConnections();gate.close();upstream.closeAllConnections();upstream.close();});
 const port=gate.address().port,base=`http://127.0.0.1:${port}`;
 for(const path of ['/','/api/companies','/api/health','/_health?x=1','//_health']) assert.equal((await fetch(base+path)).status,403);
 assert.equal(await (await fetch(base+'/_health')).text(),'ok');
 assert.equal((await fetch(base+'/',{headers:{'cf-access-jwt-assertion':'forged','cf-access-authenticated-user-email':email}})).status,403);
 const jwt=await token();
 const r=await fetch(base+'/api/companies',{headers:{'cf-access-jwt-assertion':jwt,'x-forwarded-host':'attacker.example','x-forwarded-proto':'http'}});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{url:'/api/companies',host:'paperclip.example.com',proto:'https',jwt:null});
 for(const [credential,status] of [['',403],[jwt,101]]){
  const response=await new Promise((resolve,reject)=>{
   const s=net.connect(port,'127.0.0.1',()=>s.write(`GET /socket HTTP/1.1\r\nHost: test\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n${credential?'Cf-Access-Jwt-Assertion: '+credential+'\r\n':''}\r\n`));
   s.setTimeout(3000,()=>{s.destroy();reject(new Error('socket timeout'));});
   s.once('data',d=>{resolve(d.toString());s.destroy();});s.on('error',reject);
  });
  assert.match(response,new RegExp(`^HTTP/1.1 ${status}`));
 }
});
