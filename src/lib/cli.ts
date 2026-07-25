/** Shared CLI helpers (clippy-style). */

export function writeError(message: string, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function fail(message: string, json?: boolean): never {
  writeError(message, json);
  process.exit(1);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
