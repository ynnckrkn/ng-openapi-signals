import {Command} from 'commander';
import {generate} from './generate';
import {loadConfig, resolveConfig, validateConfig} from './config';
import {isGroupBy, isTransport} from './config';

const program = new Command();

program
  .name('ng-openapi-signals')
  .description('Signal-first OpenAPI client generator for Angular using resource() and fetch().')
  .version('0.6.1');

program
  .command('generate')
  .description('Generate an Angular signal-based OpenAPI client')
  .option('-i, --input <path>', 'Path to OpenAPI JSON/YAML file')
  .option('-o, --output <path>', 'Output directory')
  .option('-c, --config <path>', 'Path to config file (default: ng-openapi-signals.config.ts)')
  .option('--clean', 'Clean output directory before generation (default: true)')
  .option('--no-clean', 'Preserve existing files in output directory')
  .option('--group-by <mode>', 'Group APIs by tag or path (default: tag)')
  .option('--transport <type>', 'HTTP transport: fetch or httpClient (default: fetch)')
  .action(async (options) => {
    try {
      const fileConfig = await loadConfig(options.config);

      const cliConfig = {
        ...(options.input ? {input: options.input} : {}),
        ...(options.output ? {output: options.output} : {}),
        ...(options.clean !== undefined ? {clean: options.clean} : {}),
        ...(options.groupBy !== undefined && isGroupBy(options.groupBy)
          ? {groupBy: options.groupBy}
          : {}),
        ...(options.transport !== undefined && isTransport(options.transport)
          ? {runtime: {transport: options.transport}}
          : {}),
      };

      const config = resolveConfig(cliConfig, fileConfig);

      validateConfig(config);

      await generate(config);

      console.log(`Generated API client in ${config.output}`);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

program.parse();
