import 'server-only';
import {isIP} from 'node:net';
import {storage} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';

// Matches the maximum accepted in the existing acceptance pack upload endpoint.
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const DEFAULT_HOSTS = ['storage.googleapis.com', 'firebasestorage.googleapis.com'];

export type CustomPdfSource = {type:'link'|'upload'; url:string};

function authorizedRemoteUrl(raw:string):URL {
  let target:URL;
  try {target = new URL(raw);} catch {throw new HttpError(400,'Invalid custom PDF URL.');}
  const hostname = target.hostname.toLowerCase();
  const allowed = new Set([
    ...DEFAULT_HOSTS,
    ...(process.env.KASA_ALLOWED_PDF_HOSTS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
  ]);
  if (target.protocol!=='https:' || target.port || target.username || target.password ||
      isIP(hostname)!==0 || !allowed.has(hostname)) {
    throw new HttpError(403,'Custom PDF URL must use an approved public HTTPS host.');
  }
  return target;
}

function checkPdf(buffer:Buffer):Buffer {
  if (buffer.length < 5 || buffer.length>MAX_PDF_BYTES || buffer.subarray(0,5).toString('ascii')!=='%PDF-') {
    throw new HttpError(422,'Custom acceptance pack is not a valid PDF.');
  }
  return buffer;
}

/** Only allow uploaded KASA acceptance PDFs or PDFs from expressly approved HTTPS hosts. */
export async function loadCustomAcceptancePdf(source:CustomPdfSource):Promise<Buffer> {
  if(source.type==='upload') {
    // Reject arbitrary object reads, remote URLs, traversal and other bucket paths.
    if(!/^acceptance-pack\/[a-f0-9-]{36}-[a-zA-Z0-9._-]{1,140}$/.test(source.url) ||
       source.url.includes('..')) {
      throw new HttpError(403,'Unrecognized acceptance pack upload path.');
    }
    const object = storage.bucket().file(source.url);
    const [metadata] = await object.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_PDF_BYTES)
      throw new HttpError(413,'Custom acceptance pack exceeds the permitted size.');
    const [data] = await object.download();
    return checkPdf(data);
  }
  if(source.type!=='link') throw new HttpError(400,'Invalid acceptance pack source.');
  const target = authorizedRemoteUrl(source.url);
  const response = await fetch(target, {
    redirect:'error',
    signal:AbortSignal.timeout(8000),
    headers:{Accept:'application/pdf'}
  });
  if(!response.ok || !response.body) throw new HttpError(502,'Custom acceptance pack is unavailable.');
  const reportedSize = Number(response.headers.get('content-length') || 0);
  if (reportedSize > MAX_PDF_BYTES) throw new HttpError(413,'Custom acceptance pack exceeds the permitted size.');
  const reader = response.body.getReader();
  const buffers:Buffer[]=[];
  let total=0;
  try {
    for(;;) {
      const {done,value} = await reader.read();
      if(done) break;
      total += value.byteLength;
      if(total>MAX_PDF_BYTES) throw new HttpError(413,'Custom acceptance pack exceeds the permitted size.');
      buffers.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return checkPdf(Buffer.concat(buffers,total));
}
