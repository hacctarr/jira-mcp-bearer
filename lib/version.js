import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The package version, read from package.json at module load. Keeps the MCP
 * server version and the outbound User-Agent in sync with the published
 * package so a release never silently reports a stale version. Falls back to
 * '0.0.0' if package.json cannot be read (should not happen in a packaged
 * install).
 */
export const VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
