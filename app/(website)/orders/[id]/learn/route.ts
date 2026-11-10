import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { studentOrder } from '@/lib/course-orders';
import { db, enrolled } from '@/lib/server';
import { orderFromCourseLink } from '@/lib/course-invitation';
import { studentCoursePath } from '@/lib/student-course-link';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id: ticket} = await params;
  const headers = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex'};
  const redirectTo = (path: string) => new Response(null, {
    status: 303, headers: {...headers, Location: new URL(path, request.url).href},
  });
  try {
    const id = orderFromCourseLink(ticket);
    if (!id) return new Response('Invalid course invitation.', {status:404, headers});
    const user = await getChatGPTUser();
    if (!user) return redirectTo(chatGPTSignInPath(studentCoursePath(ticket)));
    const order = await studentOrder(id, user);
    if (!order) return new Response('This link belongs to the student account used to buy the course.', {status: 404, headers});
    if (order.classroom) return redirectTo('/orders/' + encodeURIComponent(id));
    if (order.status !== 'paid' || !['whatsapp', 'live','sumup'].includes(order.mode) || !await enrolled(order.course_id)) {
      return redirectTo('/orders/' + encodeURIComponent(id));
    }
    const next = await db().prepare(
      'SELECT l.id FROM lessons l WHERE l.course_id=? ORDER BY EXISTS ' +
      '(SELECT 1 FROM progress p WHERE p.user_id=? AND p.lesson_id=l.id), l.position, l.id LIMIT 1'
    ).bind(order.course_id, user.userId).first<{id: string}>();
    return redirectTo(next ? '/learn/' + encodeURIComponent(next.id) : '/courses/' + encodeURIComponent(order.course_id));
  } catch {
    return new Response('Course access could not be checked. Please reopen this link in a moment.', {status: 503, headers});
  }
}
