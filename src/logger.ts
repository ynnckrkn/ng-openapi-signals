/**
 * Minimal CLI logger with inline ANSI support.
 *
 * - Writes to `stderr` (keeps stdout clean for piping).
 * - Disables ANSI colors when not a TTY (piped/redirected).
 * - `detail()` only emits when `verbose` is enabled.
 *
 * No external logging dependency — keeps the CLI small.
 */

const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

const useColor = process.stderr.isTTY === true;

function paint(text: string, color: keyof typeof ANSI): string {
  return useColor ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

class Logger {
  /** When `true`, emits detail messages via `detail()`. */
  verbose = false;

  /** Sets the verbose flag (e.g. driven by `--verbose`). */
  setVerbose(value: boolean): void {
    this.verbose = value;
  }

  /** Success message (green ✓). */
  success(message: string): void {
    process.stderr.write(`${paint('✓', 'green')} ${message}\n`);
  }

  /** Warning message (yellow ⚠). */
  warn(message: string): void {
    process.stderr.write(`${paint('⚠', 'yellow')} ${message}\n`);
  }

  /** Error message (red ✗). */
  error(message: string): void {
    process.stderr.write(`${paint('✗', 'red')} ${message}\n`);
  }

  /** Informational message (cyan •). */
  info(message: string): void {
    process.stderr.write(`${paint('•', 'cyan')} ${message}\n`);
  }

  /** Detail message (gray, only when verbose). */
  detail(message: string): void {
    if (this.verbose) {
      process.stderr.write(`${paint('•', 'gray')} ${message}\n`);
    }
  }
}

/** Shared logger instance used by the CLI. */
export const logger = new Logger();