import {Command} from 'commander';
import {generate} from './generate';

const program = new Command();

program
  .name('ng-openapi-signals')
  .description('Signal-first OpenAPI client generator for Angular using resource() and fetch().')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate an Angular signal-based OpenAPI client')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI JSON/YAML file')
  .requiredOption('-o, --output <path>', 'Output directory')
  .action(async (options) => {
    try {
      await generate({
        input: options.input,
        output: options.output,
      });

      console.log(`Generated API client in ${options.output}`);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

program.parse();
