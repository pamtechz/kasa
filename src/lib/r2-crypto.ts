import 'server-only';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

export function r2EncryptionReady():boolean{
 const raw=process.env.R2_CREDENTIALS_KEY||'';
 return /^[A-Za-z0-9+/]{43}=$/.test(raw)&&Buffer.from(raw,'base64').length===32;
}
function key():Buffer{
 const raw=process.env.R2_CREDENTIALS_KEY||'';
 if(!/^[A-Za-z0-9+/]{43}=$/.test(raw))throw Error('R2_CREDENTIALS_KEY must be an exact 32-byte base64 secret.');
 const decoded=Buffer.from(raw,'base64');
 if(decoded.length!==32)throw Error('Invalid R2_CREDENTIALS_KEY length.');
 return decoded;
}
/** AES-256-GCM binds encrypted credentials to their Firestore connection ID. */
export function encryptR2Secrets(connectionId:string,value:{accessKeyId:string;secretAccessKey:string}):string{
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(Buffer.from(connectionId));
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function decryptR2Secrets(connectionId:string,encrypted:string):{accessKeyId:string;secretAccessKey:string}{
 const parts=encrypted.split('.');
 if(parts.length!==4||parts[0]!=='v1')throw Error('Unknown encrypted credential format.');
 const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(parts[1],'base64url'));
 decipher.setAAD(Buffer.from(connectionId));
 decipher.setAuthTag(Buffer.from(parts[2],'base64url'));
 const result=JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8'));
 if(typeof result.accessKeyId!=='string'||typeof result.secretAccessKey!=='string')throw Error('Invalid encrypted R2 credentials.');
 return result;
}
