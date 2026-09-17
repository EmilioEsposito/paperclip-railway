import {spawn} from 'node:child_process';
import {createGate,accessVerifier} from './gate.mjs';
const publicHost = new URL(process.env.PAPERCLIP_PUBLIC_URL).host;
const verify=accessVerifier({issuer:process.env.CF_ACCESS_ISSUER,audience:process.env.CF_ACCESS_AUD,email:process.env.CF_ACCESS_EMAIL});
const child=spawn('node',['--import','./server/node_modules/tsx/dist/loader.mjs','server/dist/index.js'],{
  cwd:'/app',stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:'3101',PAPERCLIP_BIND:'loopback',TRUST_PROXY:'loopback'},
});
const gate=createGate({verify,upstreamPort:3101,publicHost});
gate.listen(Number(process.env.PORT||3100),'0.0.0.0');
gate.on('error',()=>{child.kill('SIGTERM');process.exitCode=1;});
child.on('exit',code=>{gate.close();process.exit(code || 1);});
for(const sig of ['SIGTERM','SIGINT']) process.on(sig,()=>{gate.close();child.kill(sig);setTimeout(()=>process.exit(0),8000).unref();});
