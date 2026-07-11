import {readFile, readdir, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {generateFiles, formatFiles} from './generate';
import type {GeneratorConfig} from './codegen/types';

/**
 * Result of comparing generated files against the files on disk.
 *
 * - `matched` — generated files whose disk content is identical.
 * - `outdated` — generated files that exist on disk but differ.
 * - `missing` — generated files that do not exist on disk yet.
 * - `stale`   — files on disk that are no longer produced by the spec.
 */
export interface CheckResult {
  matched: string[];
  outdated: string[];
  missing: string[];
  stale: string[];
}

/** Whether the check passed (no outdated or missing files). */
export function checkPassed(result: CheckResult): boolean {
  return result.outdated.length === 0 && result.missing.length === 0;
}

/**
 * Compares the in-memory generated output against the existing files on
 * disk, without writing anything. Used by `--check` for CI verification.
 */
export async function checkFiles(
  config: GeneratorConfig,
): Promise<CheckResult> {
  const generated = await formatFiles(await generateFiles(config));

  const diskFiles = await listFiles(config.output);
  const generatedNames = new Set(Object.keys(generated));
  const diskSet = new Set(diskFiles);

  const matched: string[] = [];
  const outdated: string[] = [];
  const missing: string[] = [];

  for (const fileName of Object.keys(generated)) {
    if (!diskSet.has(fileName)) {
      missing.push(fileName);
      continue;
    }

    const onDisk = await readFile(join(config.output, fileName), 'utf8');

    if (onDisk === generated[fileName]) {
      matched.push(fileName);
    } else {
      outdated.push(fileName);
    }
  }

  const stale = diskFiles.filter((name) => !generatedNames.has(name));

  return {matched, outdated, missing, stale};
}

/** Recursively lists all files under `dir` as paths relative to `dir` (forward slashes). */
async function listFiles(dir: string): Promise<string[]> {
  let entries: string[];

  try {
    await stat(dir);
    entries = await readdir(dir, {withFileTypes: true});
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await listFiles(fullPath);

      for (const nestedFile of nested) {
        files.push(`${entry.name}/${nestedFile}`);
      }
    } else {
      files.push(entry.name);
    }
  }

  return files;
}