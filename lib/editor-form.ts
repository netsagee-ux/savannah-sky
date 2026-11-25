// Keep small editor uploads below Vercel's default request limit, including
// base64 overhead. Lesson recordings and private photo sets upload separately.
export const maxEditorBodyBytes = 4_400_000;
export const maxEditorFileBytes = 3 * 1024 * 1024;
const maxTextBytes = 192 * 1024;
const maxEntries = 1000;
const encoder = new TextEncoder();
const incomplete = 'Your changes could not be read completely. Keep this editor open and try saving again.';
const tooLarge = 'This upload is too large. Use images up to 3 MB (2 MB for shop photos and qualification files). Upload lesson videos separately.';

export class FormSubmissionError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'invalid_form') { super(message); }
}
type Upload = {field: string; name: string; type: string; size: number; data: string};
type EditorBody = {version: 1; fields: [string, string][]; files: Upload[]};
function validName(name: unknown): name is string {
  return typeof name === 'string' && name.length > 0 && name.length <= 128 && !/[\r\n\0]/.test(name);
}
function checkForm(form: FormData) {
  let count = 0, textBytes = 0, fileBytes = 0;
  for (const [name, value] of form) {
    if (!validName(name) || ++count > maxEntries) throw new FormSubmissionError(incomplete);
    if (typeof value === 'string') textBytes += encoder.encode(name + value).byteLength;
    else fileBytes += value.size;
  }
  if (fileBytes > maxEditorFileBytes) throw new FormSubmissionError(tooLarge, 413, 'upload_too_large');
  if (textBytes > maxTextBytes) throw new FormSubmissionError('There is too much text in this form. Shorten the content and save again.', 413);
}

/** Serialize explicitly: never depend on a browser's multipart boundaries.
 * Arrays retain repeated fields (course dates, assignments and photo captions).
 * Empty file inputs are omitted so a text-only edit keeps the existing image.
 */
export async function encodeEditorForm(form: FormData): Promise<string> {
  checkForm(form);
  const payload: EditorBody = {version: 1, fields: [], files: []};
  for (const [field, value] of form) {
    if (typeof value === 'string') payload.fields.push([field, value]);
    else if (value.size) {
      const bytes = new Uint8Array(await value.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      payload.files.push({field, name: value.name, type: value.type, size: bytes.length, data: btoa(binary)});
    }
  }
  const body = JSON.stringify(payload);
  if (encoder.encode(body).byteLength > maxEditorBodyBytes) throw new FormSubmissionError(tooLarge, 413, 'upload_too_large');
  return body;
}

async function readBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length') || 0) > maxEditorBodyBytes) {
    throw new FormSubmissionError(tooLarge, 413, 'upload_too_large');
  }
  if (!request.body) throw new FormSubmissionError(incomplete);
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxEditorBodyBytes) {
        await reader.cancel();
        throw new FormSubmissionError(tooLarge, 413, 'upload_too_large');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof FormSubmissionError) throw error;
    throw new FormSubmissionError(incomplete);
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/** Called only after the route's existing authentication and origin checks. */
export async function readEditorForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') || '';
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (!['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'].includes(type)) {
    throw new FormSubmissionError('Reload the editor before saving. This request format is not supported.', 415);
  }
  const bytes = await readBody(request);
  try {
    let form: FormData;
    if (type === 'application/json') {
      const payload: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
      if (!payload || typeof payload !== 'object') throw Error();
      const {version, fields, files} = payload as EditorBody;
      if (version !== 1 || !Array.isArray(fields) || !Array.isArray(files) || fields.length + files.length > maxEntries) throw Error();
      form = new FormData();
      for (const row of fields) {
        if (!Array.isArray(row) || row.length !== 2 || !validName(row[0]) || typeof row[1] !== 'string') throw Error();
        form.append(row[0], row[1]);
      }
      let fileBytes = 0;
      for (const file of files) {
        if (!file || !validName(file.field) || typeof file.name !== 'string' || file.name.length > 255 || /[\r\n\0]/.test(file.name) ||
          typeof file.type !== 'string' || file.type.length > 127 || !Number.isSafeInteger(file.size) || file.size < 1 ||
          typeof file.data !== 'string' || file.data.length !== 4 * Math.ceil(file.size / 3)) throw Error();
        fileBytes += file.size;
        if (fileBytes > maxEditorFileBytes) throw new FormSubmissionError(tooLarge, 413, 'upload_too_large');
        // Reject non-canonical/truncated base64 instead of accepting partial files.
        const binary = atob(file.data);
        if (binary.length !== file.size || btoa(binary) !== file.data) throw Error();
        const data = Uint8Array.from(binary, character => character.charCodeAt(0));
        form.append(file.field, new File([data], file.name, {type: file.type}));
      }
    } else {
      // Open tabs from an earlier deployment can still save. Buffer the entire
      // body before parsing and never attempt to parse an already-consumed stream.
      form = await new Response(bytes, {headers: {'Content-Type': contentType}}).formData();
    }
    checkForm(form);
    return form;
  } catch (error) {
    if (error instanceof FormSubmissionError) throw error;
    // Only metadata is logged; course text, files and account data stay private.
    console.warn('Editor request could not be decoded', {type, bytes: bytes.byteLength});
    throw new FormSubmissionError(incomplete);
  }
}
