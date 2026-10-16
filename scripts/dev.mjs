#!/usr/bin/env node
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {parseDevOptions} from './dev-options.mjs';

function requestedHost(args){
 let host='0.0.0.0';
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='-H'||arg==='--hostname'){
   host=args[++i];
  }else if(arg.startsWith('--hostname='))host=arg.slice('--hostname='.length);
 }
 if(!host||host.startsWith('-'))throw new Error('Specify a valid hostname, e.g. --hostname 127.0.0.1.');
 return host;
}
async function availablePort(port,host){
 return new Promise((resolve,reject)=>{
  const server=createServer();
  server.once('error',error=>{
   if(error.code==='EADDRINUSE')resolve(false);
   else reject(error);
  });
  server.listen({port,host,exclusive:true},()=>{
   server.close(()=>resolve(true));
  });
 });
}
async function main(){
 const {port,distDir,passthrough}=parseDevOptions(process.argv.slice(2),process.env);
 const host=requestedHost(passthrough);
 // Preflight and Next must bind the same interface. Previously KASA checked
 // IPv4 while Next chose IPv6 (::), so the preflight could falsely succeed.
 if(!(await availablePort(port,host))){
  console.error(`[KASA] Port ${port} is already in use. Another development server may still be running.`);
  console.error('[KASA] Stop the old server with Ctrl+C, or explicitly select a different port:');
  console.error('[KASA]   npm run dev -- --port 3001');
  process.exitCode=1;return;
 }
 const require=createRequire(import.meta.url);
 const nextCli=require.resolve('next/dist/bin/next');
 console.log(`[KASA] Development: http://localhost:${port}`);
 console.log(`[KASA] Binding interface: ${host}`);
 console.log(`[KASA] Isolated Next.js cache: ${distDir} (production build remains .next)`);
 const hasExplicitHost=passthrough.some(arg=>arg==='-H'||arg==='--hostname'||arg.startsWith('--hostname='));
 const child=spawn(process.execPath,[nextCli,'dev','--port',String(port),...(hasExplicitHost?[]:['--hostname',host]),...passthrough],{
  cwd:process.cwd(),stdio:'inherit',
  env:{...process.env,KASA_NEXT_LOCAL_DEV:'1',KASA_NEXT_LOCAL_DEV_PORT:String(port)},
  windowsHide:false
 });
 child.once('error',error=>{console.error('[KASA] Unable to start development:',error.message);process.exitCode=1;});
 child.once('exit',(code,signal)=>{
  if(code!==null)process.exitCode=code;
  else if(signal)process.exitCode=0;
 });
}
main().catch(error=>{
 console.error('[KASA] Development startup failed:',error instanceof Error?error.message:error);
 process.exitCode=1;
});
