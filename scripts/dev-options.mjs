/**
 * Platform-neutral KASA dev argument handling.
 *
 * Some Windows PowerShell/npm combinations pass
 *   npm run dev -- --port 3001
 * to the npm script as a bare positional 3001 (node scripts/dev.mjs 3001).
 * Recognise that unambiguous form as well as Next's standard flags.
 */
export function parseDevOptions(argv=[],env={}){
 let portValue=env.KASA_DEV_PORT||'3000',hasPortOption=false;
 const passthrough=[];
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];
  if(arg==='-p'||arg==='--port'){
   if(hasPortOption)throw new Error('Specify only one dev port.');
   if(i+1>=argv.length)throw new Error('The dev port option requires a value.');
   portValue=argv[++i];hasPortOption=true;
  }else if(arg.startsWith('--port=')||arg.startsWith('-p=')){
   if(hasPortOption)throw new Error('Specify only one dev port.');
   portValue=arg.slice(arg.indexOf('=')+1);hasPortOption=true;
  }else if(i===0&&/^\d+$/.test(arg)){
   // npm on the user's Windows setup stripped '--port' but kept 3001.
   if(hasPortOption)throw new Error('Specify only one dev port.');
   portValue=arg;hasPortOption=true;
  }else passthrough.push(arg);
 }
 const value=String(portValue||'');
 const port=Number(value);
 if(!/^[0-9]+$/.test(value)||!Number.isInteger(port)||port<1024||port>65535){
  throw new Error('Use a TCP port between 1024 and 65535, e.g. npm run dev:3001 or npm run dev -- 3001.');
 }
 return {port,distDir:`.next-dev-${port}`,passthrough};
}
