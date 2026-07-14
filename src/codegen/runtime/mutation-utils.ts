export function generateMutationUtils(): string {
  return `import { Signal, signal, computed } from '@angular/core';

export type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface Mutation<TBody, TResult> {
  readonly result: Signal<TResult | undefined>;
  readonly error: Signal<unknown | undefined>;
  readonly status: Signal<MutationStatus>;
  readonly isLoading: Signal<boolean>;
  mutate(body: TBody, signal?: AbortSignal): Promise<TResult>;
  reset(): void;
}

export function createMutation<TBody, TResult>(
  fn: (body: TBody, signal?: AbortSignal) => Promise<TResult>,
): Mutation<TBody, TResult> {
  const result = signal<TResult | undefined>(undefined);
  const error = signal<unknown | undefined>(undefined);
  const status = signal<MutationStatus>('idle');
  const isLoading = computed(() => status() === 'loading');

  async function mutate(body: TBody, signal?: AbortSignal): Promise<TResult> {
    status.set('loading');
    error.set(undefined);
    try {
      const res = await fn(body, signal);
      result.set(res);
      status.set('success');
      return res;
    } catch (e) {
      error.set(e);
      status.set('error');
      throw e;
    }
  }

  function reset(): void {
    result.set(undefined);
    error.set(undefined);
    status.set('idle');
  }

  return { result, error, status, isLoading, mutate, reset };
}
`;
}