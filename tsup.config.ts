import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/config.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  tsconfig: 'tsconfig.dts.json',
  dts: true,
  clean: true,
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
