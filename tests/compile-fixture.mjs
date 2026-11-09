import ts from 'typescript';
import {readFile} from 'node:fs/promises';

export function moduleUrl(source) {
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}

export async function compile(path, imports) {
  let source = await readFile(path, 'utf8');
  for (const [from, to] of Object.entries(imports)) source = source.replaceAll("'" + from + "'", JSON.stringify(to));
  const compiled=ts.transpileModule(source, {
    fileName:path,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX },
  }).outputText;
  return moduleUrl(compiled.replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime'))));
}
