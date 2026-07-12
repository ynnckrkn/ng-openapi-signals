import {defineConfig} from '../src/config';

export default defineConfig({
  input: 'examples/openapi.yml',
  output: 'examples/generated',
  clean: true,
  groupBy: 'tag',
});