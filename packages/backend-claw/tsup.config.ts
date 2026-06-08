import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  platform: 'node',
  target: 'es2022',
  loader: {
    '.json': 'copy',
    '.yaml': 'text',
  },
  external: [
    '@prisma/client',
    '.prisma/client',
    'bun:sqlite',
    'ssh2',
    'cpu-features',
    'electron',
    'chromium-bidi',
    'playwright',
    'playwright-core',
  ],
  // Copy built-in skills from src/skills/ into dist/skills/ so they can be seeded at runtime
  onSuccess: 'cp -r src/skills dist/skills && echo "✓ Built-in skills copied to dist/skills/"',
});
