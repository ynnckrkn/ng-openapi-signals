import type {GeneratorConfig} from './types';
import {generateProvidersFetch} from './runtime/providers-fetch';
import {generateProvidersHttpClient} from './runtime/providers-http-client';
import {generateApiError} from './runtime/api-error';
import {generateApiFetchClient} from './runtime/api-fetch-client';
import {generateApiHttpClient} from './runtime/api-http-client';
import {generateSignalUtils} from './runtime/signal-utils';
import {generateMutationUtils} from './runtime/mutation-utils';
import {generateDateUtils} from './runtime/date-utils';

export function generateRuntimeFiles(config: GeneratorConfig): Record<string, string> {
  const transport = config.runtime?.transport ?? 'fetch';
  const signalMutations = config.runtime?.signalMutations === true;
  const dateTransformer = config.runtime?.dateTransformer === true;
  const mutationUtilsFile = signalMutations
    ? {'mutation-utils.ts': generateMutationUtils()}
    : {};
  const dateUtilsFile = dateTransformer
    ? {'date-utils.ts': generateDateUtils()}
    : {};

  if (transport === 'httpClient') {
    return {
      'providers.ts': generateProvidersHttpClient(config),
      'api-error.ts': generateApiError(config),
      'api-http-client.ts': generateApiHttpClient(config),
      'signal-utils.ts': generateSignalUtils(),
      ...mutationUtilsFile,
      ...dateUtilsFile,
    };
  }

  return {
    'providers.ts': generateProvidersFetch(config),
    'api-error.ts': generateApiError(config),
    'api-fetch-client.ts': generateApiFetchClient(config),
    'signal-utils.ts': generateSignalUtils(),
    ...mutationUtilsFile,
    ...dateUtilsFile,
  };
}
