import {database} from './vercel-database';
import {S3Client,GetObjectCommand,HeadObjectCommand,PutObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {head as blobHead,get as blobGet,put as blobPut,del as blobDelete,BlobNotFoundError} from '@vercel/blob';
function privateBlobStorage(){return {
 async head(key:string){try{const result=await blobHead(key);return {size:result.size};}catch(error){if(error instanceof BlobNotFoundError)return null;throw error;}},
 async get(key:string,options?:{range:{offset:number;length:number}}){
  const range=options?.range;
  const result=await blobGet(key,{access:'private',useCache:false,headers:range?{Range:`bytes=${range.offset}-${range.offset+range.length-1}`} : undefined});
  if(!result)return null;
  if(result.statusCode!==200)throw new Error('Unexpected storage response.');
  const contentRange=result.headers.get('content-range');
  if(range&&!contentRange?.startsWith(`bytes ${range.offset}-${range.offset+range.length-1}/`)){
   await result.stream.cancel();throw new Error('Storage did not return the requested range.');
  }
  return {body:result.stream,size:contentRange?Number(contentRange.split('/')[1]):result.blob.size,writeHttpMetadata(headers:Headers){headers.set('Content-Type',result.blob.contentType);}};
 },
 async put(key:string,data:ArrayBuffer|ReadableStream,options?:{httpMetadata:{contentType:string}}){
  await blobPut(key,data instanceof ArrayBuffer?Buffer.from(data):data,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:options?.httpMetadata.contentType});
 },
 async delete(keys:string|string[]){await blobDelete(keys);},
};}
let client:S3Client|undefined;
function config(){
 const {R2_ENDPOINT,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BUCKET_NAME}=process.env;
 if(!R2_ENDPOINT||!R2_ACCESS_KEY_ID||!R2_SECRET_ACCESS_KEY||!R2_BUCKET_NAME)throw new Error('Private storage is not configured.');
 return {client:client??=new S3Client({region:'auto',endpoint:R2_ENDPOINT,credentials:{accessKeyId:R2_ACCESS_KEY_ID,secretAccessKey:R2_SECRET_ACCESS_KEY}}),Bucket:R2_BUCKET_NAME};
}
function missing(error:unknown){return (error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===404;}
function uploadedObjects(){if(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID)return privateBlobStorage();return {
 async head(Key:string){const {client,Bucket}=config();try{const r=await client.send(new HeadObjectCommand({Bucket,Key}));return {size:r.ContentLength??0};}catch(e){if(missing(e))return null;throw e;}},
 async get(Key:string,options?:{range:{offset:number;length:number}}){const {client,Bucket}=config();const range=options?.range;try{
 const r=await client.send(new GetObjectCommand({Bucket,Key,Range:range?`bytes=${range.offset}-${range.offset+range.length-1}`:undefined}));
 return {body:r.Body?.transformToWebStream()??null,size:r.ContentRange?Number(r.ContentRange.split('/')[1]):r.ContentLength??0,writeHttpMetadata(h:Headers){if(r.ContentType)h.set('Content-Type',r.ContentType);}};
 }catch(e){if(missing(e))return null;throw e;}},
 async put(Key:string,data:ArrayBuffer|ReadableStream,options?:{httpMetadata:{contentType:string}}){const {client,Bucket}=config();const bytes=data instanceof ArrayBuffer?data:await new Response(data).arrayBuffer();await client.send(new PutObjectCommand({Bucket,Key,Body:new Uint8Array(bytes),ContentType:options?.httpMetadata.contentType}));},
 async delete(keys:string|string[]){const {client,Bucket}=config();await Promise.all((Array.isArray(keys)?keys:[keys]).map(Key=>client.send(new DeleteObjectCommand({Bucket,Key}))));},
};}

// Original practice clips are under 1 MiB and were installed transactionally with their lessons.
export function objectStorage() {
 const uploads=uploadedObjects();
 return {
  put:uploads.put,
  async head(key:string) {
   if(!key.startsWith('practice/'))return uploads.head(key);
   return database().prepare('SELECT length(bytes) AS size FROM academy_practice_files WHERE id=?').bind(key).first<{size:number}>();
  },
  async get(key:string,options?:{range:{offset:number;length:number}}) {
   if(!key.startsWith('practice/'))return uploads.get(key,options);
   const range=options?.range;
   const select=range?'substr(bytes,?,?)':'bytes';
   const args=range?[range.offset+1,range.length,key]:[key];
   const row=await database().prepare('SELECT length(bytes) AS size,'+select+' AS content FROM academy_practice_files WHERE id=?')
    .bind(...args).first<{size:number;content:ArrayBuffer}>();
   if(!row)return null;
   return {size:row.size,body:new Uint8Array(row.content),writeHttpMetadata:(h:Headers)=>h.set('Content-Type','video/mp4')};
  },
  async delete(keys:string|string[]) {
   const all=Array.isArray(keys)?keys:[keys];
   const regular=all.filter(key=>!key.startsWith('practice/'));
   if(regular.length) await uploads.delete(regular);
   for(const key of all.filter(key=>key.startsWith('practice/'))) {
    await database().prepare('DELETE FROM academy_practice_files WHERE id=? AND NOT EXISTS(SELECT 1 FROM lessons WHERE video_key=?)').bind(key,key).run();
   }
  },
 };
}
