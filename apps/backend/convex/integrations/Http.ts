/** External response parsing is bounded and never includes provider bodies or credentials in errors. */
export async function providerJson(url:string,init:RequestInit,maxBytes=500000) {
 const response=await fetch(url,{...init,redirect:"error",signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Provider returned HTTP ${response.status}`);
 const reader=response.body?.getReader();if(!reader)throw new Error("Empty provider response");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error("Provider result exceeds size limit");}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export function object(value:unknown):Record<string,unknown>{if(!value || typeof value!=="object" || Array.isArray(value))throw new Error("Malformed provider response");return value as Record<string,unknown>;}
export function text(value:unknown,max=100000){if(typeof value!=="string" || value.length>max)throw new Error("Invalid provider field");return value;}
