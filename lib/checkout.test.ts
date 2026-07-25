import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCommand } from './exec';
import {
  parsePorcelainStatus,
  readCheckoutStatus,
  readCheckoutStatuses,
  readProjectRemote,
  resetCheckoutCacheForTests,
} from './checkout';

const created: string[] = [];

async function tempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'aahp-hub-checkout-'));
  created.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('parsePorcelainStatus', () => {
  it('reads branch, upstream and drift counters', () => {
    const status = parsePorcelainStatus(
      [
        '# branch.oid 729673acf005b0d2c3aed31c316cc3578ed12ee7',
        '# branch.head main',
        '# branch.upstream origin/main',
        '# branch.ab +2 -36',
      ].join('\n'),
    );
    expect(status).toEqual({
      branch: 'main',
      detached: false,
      head: '729673acf005b0d2c3aed31c316cc3578ed12ee7',
      upstream: 'origin/main',
      ahead: 2,
      behind: 36,
      dirtyFiles: 0,
    });
  });

  it('distinguishes "no upstream" from "in sync"', () => {
    const status = parsePorcelainStatus(
      ['# branch.oid abc', '# branch.head feature/x'].join('\n'),
    );
    expect(status.upstream).toBeNull();
    expect(status.behind).toBeNull();
    expect(status.ahead).toBeNull();
  });

  it('counts modified, renamed and unmerged entries but not header lines', () => {
    const status = parsePorcelainStatus(
      [
        '# branch.oid abc',
        '# branch.head main',
        '# branch.upstream origin/main',
        '# branch.ab +0 -0',
        '1 .M N... 100644 100644 100644 aaa bbb .ai/handoff/STATUS.md',
        '1 .M N... 100644 100644 100644 ccc ddd lib/manifest.ts',
        '2 R. N... 100644 100644 100644 eee fff R100 new.ts\told.ts',
        'u UU N... 100644 100644 100644 100644 ggg hhh iii conflict.ts',
      ].join('\n'),
    );
    expect(status.dirtyFiles).toBe(4);
    expect(status.behind).toBe(0);
  });

  it('reports a detached HEAD', () => {
    const status = parsePorcelainStatus(['# branch.oid abc', '# branch.head (detached)'].join('\n'));
    expect(status.detached).toBe(true);
    expect(status.branch).toBeNull();
  });

  it('handles an initial commit and CRLF output', () => {
    const status = parsePorcelainStatus('# branch.oid (initial)\r\n# branch.head main\r\n');
    expect(status.head).toBeNull();
    expect(status.branch).toBe('main');
  });
});

describe('readProjectRemote', () => {
  it('returns "none" when the directory is not a git checkout', async () => {
    const dir = await tempProject();
    expect(await readProjectRemote(dir)).toMatchObject({ kind: 'none', repo: null });
  });

  it('falls back to the manifest declaration when there is no checkout', async () => {
    const dir = await tempProject();
    expect(await readProjectRemote(dir, 'acme/atlas')).toMatchObject({
      kind: 'github',
      repo: 'acme/atlas',
      source: 'manifest',
    });
  });

  it('prefers the git remote over a stale manifest declaration', async () => {
    const dir = await tempProject();
    await mkdir(join(dir, '.git'), { recursive: true });
    await writeFile(
      join(dir, '.git', 'config'),
      '[remote "origin"]\n\turl = ssh://git@forge.internal.example:2222/team/sample-app.git\n',
      'utf8',
    );
    // The manifest still claims GitHub; the remote says the project moved.
    const remote = await readProjectRemote(dir, 'acme/sample-app');
    expect(remote.kind).toBe('other-host');
    expect(remote.host).toBe('forge.internal.example');
    expect(remote.repo).toBeNull();
  });

  it('resolves a worktree that points at a shared common dir', async () => {
    const dir = await tempProject();
    const common = join(dir, 'main-repo', '.git');
    const worktree = join(dir, 'wt');
    await mkdir(join(common, 'worktrees', 'wt'), { recursive: true });
    await mkdir(worktree, { recursive: true });
    await writeFile(
      join(common, 'config'),
      '[remote "origin"]\n\turl = https://github.com/homeofe/aahp-hub.git\n',
      'utf8',
    );
    await writeFile(join(common, 'worktrees', 'wt', 'commondir'), '../..\n', 'utf8');
    await writeFile(join(worktree, '.git'), `gitdir: ${join(common, 'worktrees', 'wt')}\n`, 'utf8');

    expect(await readProjectRemote(worktree)).toMatchObject({
      kind: 'github',
      repo: 'homeofe/aahp-hub',
      source: 'git-remote',
    });
  });
});

describe('readCheckoutStatus', () => {
  it('degrades to an error string instead of throwing when the path does not exist', async () => {
    const dir = await tempProject();
    const status = await readCheckoutStatus(join(dir, 'no-such-directory'));
    expect(status.error).toBeTruthy();
    // Crucially: unknown drift is null, never a fabricated zero.
    expect(status.behind).toBeNull();
    expect(status.ahead).toBeNull();
  });
});

describe('readCheckoutStatuses', () => {
  it('serves repeat reads from a short-lived memo and re-reads when forced', async () => {
    resetCheckoutCacheForTests();
    const dir = await tempProject();
    const project = join(dir, 'late-repo');

    const first = await readCheckoutStatuses([project]);
    expect(first.get(project)?.error).toBeTruthy();

    await mkdir(project, { recursive: true });
    const init = await runCommand('git', ['init', '--quiet', project], { timeoutMs: 20_000 });
    expect(init.spawnError).toBeNull();

    // Still the memoised answer: no new git process was spawned.
    const cached = await readCheckoutStatuses([project]);
    expect(cached.get(project)?.error).toBeTruthy();

    const forced = await readCheckoutStatuses([project], { force: true });
    expect(forced.get(project)?.error).toBeNull();
    expect(forced.get(project)?.branch).toBeTruthy();
  });
});
