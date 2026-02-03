import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/validators.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@prisma/client'],
});
