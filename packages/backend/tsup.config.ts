import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  platform: 'node',
  target: 'es2022',
  loader: {
    '.json': 'copy',
    '.yaml': 'text',
    '.png': 'base64',
  },
  external: [
    '@prisma/client',
    '.prisma/client',
    'bun:sqlite',
    'nodemailer',
    'ssh2',
    'cpu-features',
  ],
  noExternal: [
  ],
});
