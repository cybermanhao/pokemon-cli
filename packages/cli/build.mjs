import esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// DEV=true 时：react-devtools-core 作为外部模块加载，支持 React DevTools GUI 连接
// 否则：stub 掉，零开销
const isDevMode = process.env.DEV === 'true';

const stubDevtoolsPlugin = {
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
};

await esbuild.build({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/cli.mjs',
  external: isDevMode ? ['react-devtools-core'] : [],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);
    // Add missing methods to stdin for non-TTY environments (PowerShell, ConEmu, Git Bash)
    (function() {
      try {
        const stdin = process.stdin;
        if (typeof stdin.ref !== 'function') stdin.ref = function() {};
        if (typeof stdin.unref !== 'function') stdin.unref = function() {};
        if (typeof stdin.setRawMode !== 'function') stdin.setRawMode = function(enabled) { return this; };
        if (!stdin.isRaw) Object.defineProperty(stdin, 'isRaw', { get: () => true, set: () => {}, configurable: true });
        if (!stdin.isTTY) Object.defineProperty(stdin, 'isTTY', { get: () => true, set: () => {}, configurable: true });
      } catch(e) { console.error('Stdin patch error:', e); }
    })();`,
  },
  alias: {
    '@pokemon/i18n': resolve(__dirname, '../i18n/src/index.js'),
    '@pokemon/battle': resolve(__dirname, '../battle/src/index.js'),
    '@pokemon/animation': resolve(__dirname, '../animation/src/index.js'),
  },
  nodePaths: [resolve(__dirname, 'node_modules')],
  plugins: isDevMode ? [] : [stubDevtoolsPlugin],
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
