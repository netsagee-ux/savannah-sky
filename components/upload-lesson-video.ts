import {lessonVideoTypes,maxLessonBytes,mediaPartBytes,classroomVideoLimit} from '@/lib/lesson-upload';

type Staged={course:string;pathname:string;parts?:Set<number>};
const staged=new WeakMap<File,Staged>();

async function sendPart(file:File,type:string,pathname:string,part:number){
  const params=new URLSearchParams({key:pathname,size:String(file.size),part:String(part)});
  for(let attempt=0;attempt<3;attempt++){
    let response:Response|undefined;
    try{
      response=await fetch('/api/admin/video-part?'+params,{method:'POST',headers:{'Content-Type':type},
        body:file.slice(part*mediaPartBytes,(part+1)*mediaPartBytes)});
    }catch{ /* Keep the same upload key when retrying a lost response. */ }
    if(response?.ok)return;
    if(response?.status===401||response?.status===403)throw Error('Your staff session needs attention. Open staff sign-in in another tab, then retry here.');
    if(response && response.status<500 && ![408,429].includes(response.status))throw Error('This part could not be saved. Check the file and try again.');
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
  throw Error('Upload paused. Keep this page open and press Save lesson to resume.');
}

async function uploadParts(file:File,type:string,key:Staged,report:(message:string)=>void){
  const completed=key.parts!,count=Math.ceil(file.size/mediaPartBytes);
  const update=()=>report('Uploading private video · '+Math.floor(completed.size/count*100)+'%');
  async function send(part:number){
    await sendPart(file,type,key.pathname,part);completed.add(part);update();
  }
  update();
  // Part zero creates the file record. All subsequent parts can arrive out of order.
  if(!completed.has(0))await send(0);
  const remaining=Array.from({length:count-1},(_,i)=>i+1).filter(part=>!completed.has(part));
  let next=0,failure:Error|undefined;
  async function worker(){
    while(!failure && next<remaining.length){
      try{await send(remaining[next++]);}catch(reason){failure=reason as Error;}
    }
  }
  await Promise.all(Array.from({length:Math.min(3,remaining.length)},worker));
  if(failure)throw failure;
}

export async function uploadLessonVideo(form:FormData,report:(message:string)=>void,direct:boolean){
  const file=form.get('video');
  if(!(file instanceof File)||!file.size)return;
  const type=file.type||(/\.mp4$/i.test(file.name)?'video/mp4':/\.webm$/i.test(file.name)?'video/webm':'');
  if(!lessonVideoTypes.includes(type)||file.size>maxLessonBytes)throw Error('Choose an MP4 or WebM file up to 1 GB.');
  if(!direct&&file.size>classroomVideoLimit)throw Error('Choose an MP4 or WebM up to 256 MB.');
  const course=String(form.get('courseId'));
  let key=staged.get(file);
  if(key?.course!==course)key=undefined;
  if(direct && !key){
    try{
      const {upload}=await import('@vercel/blob/client');
      const pathname='lessons/uploads/'+course+'/'+crypto.randomUUID()+(type==='video/webm'?'.webm':'.mp4');
      report('Uploading private video…');
      const result=await upload(pathname,file,{access:'private',handleUploadUrl:'/api/admin/video-upload',multipart:true,contentType:type,
        onUploadProgress:({percentage})=>report('Uploading private video · '+Math.round(percentage)+'%')});
      key={course,pathname:result.pathname};staged.set(file,key);
    }catch{
      if(file.size>classroomVideoLimit)throw Error('The private video store could not accept this upload. Keep the editor open, check your staff sign-in and retry.');
      report('Switching to the academy’s private database upload…');
    }
  }
  if(!key){
    key={course,pathname:'classroom/'+course+'/'+crypto.randomUUID(),parts:new Set()};
    staged.set(file,key);
  }
  if(key.parts)await uploadParts(file,type,key,report);
  form.delete('video');form.set('uploadedVideoKey',key.pathname);report('Saving lesson…');
}
