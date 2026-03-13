import esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/cli.mjs',
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);
    // Only apply workaround if NOT in a real TTY
    if (typeof process.stdin.isTTY === 'undefined' || !process.stdout.isTTY) {
      (function() {
        const originalStdin = process.stdin;
        originalStdin.setRawMode = function(enabled) { return this; };
        Object.defineProperty(originalStdin, 'isRaw', { get() { return true; }, set() {}, configurable: true });
        Object.defineProperty(originalStdin, 'isTTY', { get() { return true; }, set() {}, configurable: true });
      })();
    }`,
  },
  alias: {
    '@pokemon/i18n': resolve(__dirname, '../i18n/src/index.js'),
    '@pokemon/core': resolve(__dirname, '../core/src/types.js'),
    '@pokemon/battle': resolve(__dirname, '../battle/src/index.js'),
  },
  nodePaths: [resolve(__dirname, 'node_modules')],
  plugins: [
    {
      name: 'stub-devtools',
      setup(build) {
        build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
          path: 'react-devtools-core',
          namespace: 'stub',
        }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export default { connectToDevTools: () => {} }',
          loader: 'js',
        }));
      },
    },
  ],
});

// Copy yoga.wasm
const wasmSearch = resolve(__dirname, '../../node_modules/.pnpm');
import { readdirSync, statSync } from 'fs';
function findWasm(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('yoga-wasm-web@')) {
      const wasmPath = resolve(dir, entry, 'node_modules/yoga-wasm-web/dist/yoga.wasm');
      try { statSync(wasmPath); return wasmPath; } catch {}
    }
  }
  return null;
}
const wasmSrc = findWasm(wasmSearch);
if (!wasmSrc) throw new Error('yoga.wasm not found');
mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
copyFileSync(wasmSrc, resolve(__dirname, 'dist/yoga.wasm'));

console.log('Build complete: dist/cli.mjs');
