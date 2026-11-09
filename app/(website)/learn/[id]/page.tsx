import {readQuiz} from '@/lib/lesson-quiz';
import {notFound} from 'next/navigation';
import {db, enrolled} from '@/lib/server';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import LessonPlayer from '@/components/lesson-player';
import CoursePlaylist from '@/components/course-playlist';

export const dynamic='force-dynamic';

export default async function Learn({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const user=await requireChatGPTUser('/learn/'+encodeURIComponent(id));
  let lesson;
  try {
    lesson=await db().prepare("SELECT l.*,(SELECT value FROM settings WHERE id='quiz:'||l.id) AS quiz_json,c.title AS course_title FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?").bind(id).first<any>();
  } catch {return <section className="section notice">The learning space is temporarily unavailable. Please try again.</section>;}
  if (!lesson) notFound();
  if (!await enrolled(lesson.course_id)) return <section className="section"><div className="empty"><h1>Private course</h1><p>Sign in with the account used for your enrolment to open this lesson.</p><a className="button" href="/dashboard">My learning</a></div></section>;
  const list=(await db().prepare(`SELECT l.id,l.title,EXISTS(SELECT 1 FROM progress p WHERE p.user_id=? AND p.lesson_id=l.id) AS completed
    FROM lessons l WHERE l.course_id=? ORDER BY l.position,l.id`).bind(user.userId,lesson.course_id).all()).results as {id:string;title:string;completed:number}[];
  const index=list.findIndex(item=>item.id===id);
  if (index===-1) notFound();
  const safe={id,title:lesson.title,body:lesson.body,questions:readQuiz(lesson).map(({question,options})=>({question,options})),hasVideo:!!lesson.video_key,hasThumbnail:!!lesson.thumbnail_key};
  return <CoursePlaylist title={lesson.course_title} courseId={lesson.course_id} list={list} index={index}>
    <LessonPlayer key={id} lesson={safe} completed={Boolean(list[index].completed)}/>
  </CoursePlaylist>;
}
