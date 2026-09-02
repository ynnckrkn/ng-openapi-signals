import {describe, it, expect} from 'vitest';
import {createMutation} from '../examples/generated/mutation-utils';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

describe('createMutation in-flight guards', () => {
  it('normal single-call behaviour is unchanged', async () => {
    const mutation = createMutation<{name: string}, {id: string}>((body) =>
      Promise.resolve({id: body.name}),
    );

    expect(mutation.status()).toBe('idle');
    expect(mutation.isLoading()).toBe(false);

    const result = await mutation.mutate({name: 'abc'});

    expect(result).toEqual({id: 'abc'});
    expect(mutation.status()).toBe('success');
    expect(mutation.isLoading()).toBe(false);
    expect(mutation.result()).toEqual({id: 'abc'});
    expect(mutation.error()).toBeUndefined();
  });

  it('errors set error/status and rethrow', async () => {
    const boom = new Error('boom');
    const mutation = createMutation<string, string>(() => Promise.reject(boom));

    await expect(mutation.mutate('x')).rejects.toThrow('boom');

    expect(mutation.status()).toBe('error');
    expect(mutation.error()).toBe(boom);
  });

  it('a late stale success does not overwrite the newer call result', async () => {
    const first = deferred<string>();
    const second = deferred<string>();

    const mutation = createMutation<string, string>((body) =>
      body === 'first' ? first.promise : second.promise,
    );

    const p1 = mutation.mutate('first').catch(() => undefined);
    const p2 = mutation.mutate('second').catch(() => undefined);

    expect(mutation.status()).toBe('loading');

    // The newer call finishes first.
    second.resolve('second-result');
    await p2;

    expect(mutation.result()).toBe('second-result');
    expect(mutation.status()).toBe('success');

    // The stale call finishes afterwards — it must NOT touch state.
    first.resolve('first-result');
    await p1;

    expect(mutation.result()).toBe('second-result');
    expect(mutation.status()).toBe('success');
    expect(mutation.error()).toBeUndefined();
  });

  it('a late stale error does not overwrite the newer call success', async () => {
    const first = deferred<string>();
    const second = deferred<string>();

    const mutation = createMutation<string, string>((body) =>
      body === 'first' ? first.promise : second.promise,
    );

    const p1 = mutation.mutate('first').catch((e) => e);
    const p2 = mutation.mutate('second').catch(() => undefined);

    second.resolve('second-result');
    await p2;

    first.reject(new Error('stale failure'));
    const thrown = await p1;
    expect((thrown as Error).message).toBe('stale failure');

    // The stale error must not overwrite the newer success.
    expect(mutation.result()).toBe('second-result');
    expect(mutation.status()).toBe('success');
    expect(mutation.error()).toBeUndefined();
  });

  it('still resolves/rejects the stale promise to its own caller', async () => {
    const first = deferred<string>();
    const second = deferred<string>();

    const mutation = createMutation<string, string>((body) =>
      body === 'first' ? first.promise : second.promise,
    );

    const returned1 = mutation.mutate('first').catch((e) => e);
    const returned2 = mutation.mutate('second').catch((e) => e);

    second.resolve('second-result');
    first.resolve('first-result');

    expect(await returned2).toBe('second-result');
    expect(await returned1).toBe('first-result');
  });

  it('reset() invalidates in-flight calls — a late success does not repopulate state', async () => {
    const pending = deferred<string>();
    const mutation = createMutation<string, string>(() => pending.promise);

    const p = mutation.mutate('body').catch(() => undefined);

    mutation.reset();
    expect(mutation.status()).toBe('idle');
    expect(mutation.result()).toBeUndefined();
    expect(mutation.error()).toBeUndefined();

    pending.resolve('late-result');
    await p;

    expect(mutation.status()).toBe('idle');
    expect(mutation.result()).toBeUndefined();
    expect(mutation.isLoading()).toBe(false);
  });

  it('reset() invalidates in-flight calls — a late error does not repopulate state', async () => {
    const pending = deferred<string>();
    const mutation = createMutation<string, string>(() => pending.promise);

    const p = mutation.mutate('body').catch((e) => e);

    mutation.reset();

    pending.reject(new Error('late failure'));
    const thrown = await p;
    expect((thrown as Error).message).toBe('late failure');

    expect(mutation.status()).toBe('idle');
    expect(mutation.error()).toBeUndefined();
  });

  it('a call started after reset() reports its state normally', async () => {
    const first = deferred<string>();
    const second = deferred<string>();

    const mutation = createMutation<string, string>(
      (body) => (body === 'first' ? first.promise : second.promise),
    );

    const stale = mutation.mutate('first').catch(() => undefined);
    mutation.reset();

    const fresh = mutation.mutate('second').catch((e) => e);
    expect(mutation.status()).toBe('loading');

    second.resolve('second-result');
    await fresh;
    first.resolve('first-result');
    await stale;

    expect(mutation.status()).toBe('success');
    expect(mutation.result()).toBe('second-result');
  });
});