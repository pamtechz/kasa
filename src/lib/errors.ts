import {NextResponse} from 'next/server';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function fail(error:unknown){
 if(error instanceof HttpError) return NextResponse.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
 console.error('API error',error instanceof Error ? error.message : 'Unknown');
 return NextResponse.json({error:'Unable to complete this request.'},{status:500,headers:{'Cache-Control':'no-store'}});
}
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
