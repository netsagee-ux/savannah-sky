import {createClient} from '@libsql/client';
import {createHash} from 'node:crypto';
const courses=[
  {id:'gel-foundations',title:'Gel Polish Foundations',level:'Beginner',lesson:'Three-stroke brush control',
    description:'Rehearse a smooth centre stroke and two side strokes on a detached practice tip.',
    notes:'Set a detached tip on a stand. Rehearse the centre stroke with a clean dry brush. Repeat along the left and right sides, keeping your brush inside the outline. Compare the spacing of the three paths.'},
  {id:'builder-gel',title:'Builder Gel Technique',level:'Intermediate',lesson:'Read the side profile',
    description:'Study the silhouette of a structured nail and practise tracing a balanced upper contour.',
    notes:'Work from the side view shown in the film. Trace the upper contour on paper, mark the high point, then compare both ends of your outline to the guide.'},
  {id:'nail-art',title:'Modern Nail Art',level:'Creative',lesson:'Build a balanced French line',
    description:'Map three guide marks on a practice tip and join them into an even French smile line.',
    notes:'Use a detached practice tip or a drawing of one. Mark the centre and the two shoulders. Join the marks with two arcs. Rotate the tip and compare both sides.'},
];

const hashes = {"gel-foundations": "deda77e954b316d58b758d424f60c79701bb329af44d1cd7fc8368d274dcf9e2", "builder-gel": "6465fc0d39214d1d3e597b7c667534dbd8f06b2ff642b5987c092ebd5f50a21b", "nail-art": "2c932427b1726ac1487aac0ce7e3362958edc25ad2a9c37ec3f0be6d2750628c"};
const marker='release:practice-recordings:v1';

export async function installPractice(files) {
  const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
  try {
    if((await db.execute({sql:'SELECT id FROM settings WHERE id=?',args:[marker]})).rows.length) return 'installed';
    const media=[];
    for(const course of courses) {
      const file=files.get(course.id);
      if(!(file instanceof File)||file.size>400000)throw Error('Invalid media package.');
      const bytes=Buffer.from(await file.arrayBuffer());
      if(createHash('sha256').update(bytes).digest('hex')!==hashes[course.id])throw Error('Media checksum mismatch.');
      media.push(bytes);
    }
    const tx=await db.transaction('write');
    try {
      if(!(await tx.execute({sql:'SELECT id FROM settings WHERE id=?',args:[marker]})).rows.length){
        await tx.execute('CREATE TABLE IF NOT EXISTS academy_practice_files (id TEXT PRIMARY KEY, bytes BLOB NOT NULL)');
        for (const [i,c] of courses.entries()) {
          const old=(await tx.execute({sql:'SELECT * FROM courses WHERE id=?',args:[c.id]})).rows[0];
          const isDraftTemplate=old?.access_policy?.startsWith('Draft: add the training content');
          if(!old){
            await tx.execute({sql:'INSERT INTO courses(id,title,description,level,price,published) VALUES(?,?,?,?,NULL,1)',args:[c.id,c.title,c.description,c.level]});
          } else if(isDraftTemplate){
            await tx.execute({sql:'UPDATE courses SET description=?,published=1,price=NULL,requirements=NULL,access_policy=NULL,outcomes=NULL WHERE id=?',args:[c.description,c.id]});
          } else {
            await tx.execute({sql:'UPDATE courses SET published=1 WHERE id=?',args:[c.id]});
          }
          const key='practice/'+c.id+'.mp4';
          await tx.execute({sql:'INSERT INTO academy_practice_files(id,bytes) VALUES(?,?)',args:[key,media[i]]});
          await tx.execute({sql:`INSERT INTO lessons(id,course_id,title,body,video_key,position)
            SELECT ?,?,?,?,?,COALESCE(MAX(position),0)+1 FROM lessons WHERE course_id=?`,args:['studio-'+c.id,c.id,c.lesson,c.notes,key,c.id]});

        }
        await tx.execute({sql:'INSERT INTO settings(id,value) VALUES(?,?)',args:[marker,'complete']});
      }
      await tx.commit();
    } finally {tx.close();}
    return 'installed';
  } finally {db.close();}
}
