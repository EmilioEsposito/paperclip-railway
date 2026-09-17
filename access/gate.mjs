import http from 'node:http';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export function accessVerifier({issuer, audience, email, keySet}) {
  if (!issuer || !audience || !email) throw new Error('Missing Access configuration');
  const keys = keySet ?? createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
  return async (req) => {
    const token = req.headers['cf-access-jwt-assertion'];
    if (typeof token !== 'string' || token.length > 16384) throw new Error('Access token required');
    const {payload} = await jwtVerify(token, keys, {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp','iat','sub','email'],
    });
    if (payload.email !== email || payload.type !== 'app') throw new Error('Identity not allowed');
    return payload;
  };
}

export function createGate({verify, upstreamPort, publicHost}) {
  const headersFor = (req, upgrade=false) => {
    const headers = {...req.headers};
    // Never let caller-controlled forwarding headers override the canonical origin.
    for (const name of Object.keys(headers)) {
      if (name.startsWith('x-forwarded-') || name.startsWith('cf-access-') || name === 'forwarded') delete headers[name];
    }
    headers.host = publicHost;
    headers['x-forwarded-host'] = publicHost;
    headers['x-forwarded-proto'] = 'https';
    if (!upgrade) { delete headers.upgrade; headers.connection = 'close'; }
    return headers;
  };
  const denied = res => { res.writeHead(403, {'Content-Type':'text/plain','Cache-Control':'no-store'}); res.end('Cloudflare Access authentication required.'); };
  const server = http.createServer(async (req,res) => {
    // A dedicated, data-free readiness response is the only anonymous route.
    if (req.method === 'GET' && req.url === '/_health') {
      const probe = http.get({hostname:'127.0.0.1',port:upstreamPort,path:'/api/health'}, upstream => {
        upstream.resume(); res.writeHead(upstream.statusCode === 200 ? 200 : 503, {'Cache-Control':'no-store'});res.end(upstream.statusCode === 200 ? 'ok' : 'unavailable');
      });
      probe.setTimeout(3000,()=>probe.destroy());
      probe.on('error',()=>{res.writeHead(503);res.end('unavailable');});
      return;
    }
    try { await verify(req); } catch { denied(res); return; }
    const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers:headersFor(req)}, response=>{
      res.writeHead(response.statusCode,response.headers);response.pipe(res);
    });
    upstream.on('error',()=>{if(!res.headersSent) res.writeHead(502);res.end();});
    req.on('aborted',()=>upstream.destroy());
    req.pipe(upstream);
  });
  server.on('upgrade',async (req,socket,head)=>{
    try {await verify(req);} catch {socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers:headersFor(req,true)});
    upstream.on('upgrade',(response,peer,peerHead)=>{
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
      for(let i=0;i<response.rawHeaders.length;i+=2) socket.write(`${response.rawHeaders[i]}: ${response.rawHeaders[i+1]}\r\n`);
      socket.write('\r\n');
      if(peerHead.length) socket.write(peerHead);
      if(head.length) peer.write(head);
      peer.pipe(socket).pipe(peer);
      peer.on('error',()=>socket.destroy());socket.on('error',()=>peer.destroy());
      socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());
    });
    upstream.on('response',response=>{response.resume();socket.end(`HTTP/1.1 ${response.statusCode} Rejected\r\nConnection: close\r\n\r\n`);});
    upstream.on('error',()=>socket.destroy());
    socket.on('error',()=>upstream.destroy());upstream.end();
  });
  return server;
}
