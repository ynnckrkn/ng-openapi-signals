import {defineConfig} from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts', 'src/config.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  tsconfig: 'tsconfig.build.json',
  dts: true,
  clean: true,
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});