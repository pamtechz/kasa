import type { NextConfig } from 'next';
// Each development port receives its own generated output. The production
// build continues to use .next, preventing npm run build from deleting files
// belonging to an active local development server.
const activeDevPort = process.env.KASA_NEXT_LOCAL_DEV === '1'
  ? process.env.KASA_NEXT_LOCAL_DEV_PORT
  : undefined;
const validatedDevPort = Number(activeDevPort);
const isolatedDevelopmentDir = activeDevPort
  && Number.isInteger(validatedDevPort)
  && validatedDevPort >= 1024
  && validatedDevPort <= 65535
  && String(validatedDevPort) === activeDevPort
  ? `.next-dev-${activeDevPort}`
  : '.next';

const nextConfig: NextConfig = {
  distDir: isolatedDevelopmentDir,
  reactStrictMode:true,
  poweredByHeader:false,
  outputFileTracingIncludes:{'/*':['./public/kasa-logo-white.png']},
  async headers(){return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains; preload'}
  ]}];}
};
export default nextConfig;
