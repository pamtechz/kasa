/**
 * Platform-neutral dev CLI parsing. Keep port and distDir coupled so two
 * servers never share generated manifests when run on separate ports.
 */
export function parseDevOptions(argv=[],env={}){
 let portValue=env.KASA_DEV_PORT||'3000', hasPortOption=false;
 const passthrough=[];
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];
  if(arg==='-p'||arg==='--port'){
   if(hasPortOption)throw new Error('Specify only one dev port.');
   portValue=argv[++i];hasPortOption=true;
  }else if(arg.startsWith('--port=')){
   if(hasPortOption)throw new Error('Specify only one dev port.');
   portValue=arg.slice('--port='.length);hasPortOption=true;
  }else passthrough.push(arg);
 }
 const value=String(portValue||'');
 const port=Number(value);
 if(!/^[0-9]+$/.test(value)||!Number.isInteger(port)||port<1024||port>65535){
  throw new Error('Use a TCP port between 1024 and 65535, e.g. npm run dev -- --port 3001.');
 }
 return {port,distDir:`.next-dev-${port}`,passthrough};
}
