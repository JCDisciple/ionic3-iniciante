// Resolve os aliases do tsconfig (@shared/*, @/*) quando os testes rodam no Node.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const aliases = [
  ['@shared/', path.join(root, 'supabase/functions/_shared/')],
  ['@/', path.join(root, 'src/')],
];

registerHooks({
  resolve(specifier, context, nextResolve) {
    for (const [prefix, target] of aliases) {
      if (specifier.startsWith(prefix)) {
        let file = path.join(target, specifier.slice(prefix.length));
        if (!path.extname(file)) file += '.ts';
        return nextResolve(pathToFileURL(file).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
