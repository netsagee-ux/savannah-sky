import ts from 'typescript';
import {readFile} from 'node:fs/promises';

export function moduleUrl(source) {
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}

export async function compile(path, imports) {
  let source = await readFile(path, 'utf8');
  for (const [from, to] of Object.entries(imports)) source = source.replaceAll("'" + from + "'", JSON.stringify(to));
  return moduleUrl(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
