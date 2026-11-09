import {createCipheriv, createDecipheriv, createHmac, randomBytes} from 'node:crypto';
import {db} from './server';
import {studentCoursePath} from './student-course-link';

const purpose = Buffer.from('savannah-sky/course-invitation/v1');
const prefix = 's1_';

function encryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) throw Error('Course invitations are temporarily unavailable.');
  return createHmac('sha256', secret).update(purpose).digest();
}

function seal(orderId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(purpose);
  const encrypted = Buffer.concat([cipher.update(orderId, 'utf8'), cipher.final()]);
  return prefix + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function orderFromCourseLink(value: string): string | null {
  if (!value.startsWith(prefix)) return value; // Earlier account-protected links.
  const encoded = value.slice(prefix.length);
  if (encoded.length > 240 || !/^[\w-]+$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, 'base64url');
  if (bytes.length <= 28 || bytes.toString('base64url') !== encoded) return null;
  const key = encryptionKey();
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0,12));
    cipher.setAAD(purpose);
    cipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
  } catch { return null; }
}

// Keep one invitation for the order, including concurrent staff actions and receipt retries.
export async function paidInvitationPath(id: string) {
  const database = db();
  const order = await database.prepare(`SELECT id FROM orders o WHERE id=? AND status='paid'
    AND mode IN ('whatsapp','live','sumup') AND user_id NOT LIKE 'withdrawn/%' AND (
      user_id LIKE 'guest/%' OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id=o.course_id AND
        (e.id='buyer/'||o.user_id||'/'||o.course_id OR (e.id NOT LIKE 'buyer/%' AND e.email=o.email))))`).bind(id).first();
  if (!order) return null;
  const name = 'course_invite:' + id;
  const read = () => database.prepare('SELECT value FROM settings WHERE id=?').bind(name).first<{value:string}>();
  const saved = await read();
  if (saved && orderFromCourseLink(saved.value) === id) return studentCoursePath(saved.value);
  const ticket = seal(id);
  if (saved) {
    await database.prepare('UPDATE settings SET value=? WHERE id=? AND value=?').bind(ticket,name,saved.value).run();
  } else {
    await database.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind(name,ticket).run();
  }
  const current = await read();
  if (!current) throw Error('Could not create course invitation.');
  return studentCoursePath(current.value);
}
