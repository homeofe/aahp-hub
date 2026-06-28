import { homedir } from 'node:os';

/**
 * Replace the user's home-directory prefix in an absolute path with `~`, so
 * paths emitted to clients (e.g. the SSE stream, the spawned-command echo) do
 * not leak the OS username or the home-directory layout.
 *
 * Returns the input unchanged when it does not live under a home directory, and
 * is defensive against empty / non-string input.
 */
export function redactHome(p: string): string {
  if (typeof p !== 'string' || p.length === 0) return p;
  const isWin = process.platform === 'win32';
  // On Windows treat `/` and `\` as equivalent and compare case-insensitively,
  // so a forward-slash path (e.g. from an env-var override) is still redacted.
  // Normalization preserves length, so slicing the original `p` stays correct.
  const norm = (s: string): string =>
    isWin ? s.replace(/\//g, '\\').toLowerCase() : s;
  const hay = norm(p);
  const homes = [process.env['HOME'], homedir()].filter(
    (h): h is string => typeof h === 'string' && h.length > 0,
  );
  for (const home of homes) {
    const needle = norm(home);
    if (hay === needle) return '~';
    if (hay.startsWith(needle + '/') || hay.startsWith(needle + '\\')) {
      return '~' + p.slice(home.length);
    }
  }
  return p;
}
