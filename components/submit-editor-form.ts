import {encodeEditorForm} from '@/lib/editor-form';

type SaveResult = {error?: string; code?: string; courseId?: string; message?: string};
export async function submitEditorForm(url: string, fields: FormData) {
  const body = await encodeEditorForm(fields);
  let response: Response;
  try {
    response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body,
      signal: AbortSignal.timeout(60000)});
  } catch {
    throw Error('The website could not confirm the save. Your edits are still here. Check your connection and try again.');
  }
  let result: SaveResult | undefined;
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) result = data as SaveResult;
  } catch { /* A proxy can return HTML or plain text instead of the API response. */ }
  if (!result) {
    if (response.status === 401 || response.status === 403 || response.redirected) {
      result = {error: 'Please sign in again in a new tab, then return here to save.'};
    } else if (response.status === 413) {
      throw Error('The image is too large to upload. Choose a smaller file and save again. Your edits are still here.');
    } else throw Error('The website could not confirm the save. Keep this editor open and try again.');
  }
  if (response.redirected) throw Error(result.error || 'Sign in again before saving. Your edits are still here.');
  return {response, result};
}
