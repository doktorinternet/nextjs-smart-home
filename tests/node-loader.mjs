import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  if (specifier.startsWith('@/')) {
    let target = resolvePath(process.cwd(), specifier.slice(2));
    if (!/\.(mjs|js|ts|tsx)$/.test(target)) target += '.ts';
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
