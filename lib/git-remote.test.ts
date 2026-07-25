import { describe, expect, it } from 'vitest';
import {
  classifyManifestRepo,
  classifyRemoteUrl,
  isValidRepoRef,
  parseGitConfigRemotes,
  parseRemoteUrl,
  pickRemote,
  redactRemoteUrl,
} from './git-remote';

describe('parseRemoteUrl', () => {
  it.each([
    ['https://github.com/homeofe/aahp-hub.git', 'github.com', 'homeofe', 'aahp-hub'],
    ['https://github.com/elvatis/elvatis-defense', 'github.com', 'elvatis', 'elvatis-defense'],
    ['git@github.com:homeofe/supply-chain-guard.git', 'github.com', 'homeofe', 'supply-chain-guard'],
    ['ssh://git@github.com/elvatis/atlas.git', 'github.com', 'elvatis', 'atlas'],
    ['ssh://git@code.home.io:2222/emre/gaming-llm.git', 'code.home.io', 'emre', 'gaming-llm'],
    ['git://github.com/owner/repo.git', 'github.com', 'owner', 'repo'],
    ['https://x-token:secret@github.com/owner/repo.git', 'github.com', 'owner', 'repo'],
    ['HTTPS://GitHub.com/Owner/Repo', 'github.com', 'Owner', 'Repo'],
  ])('parses %s', (url, host, owner, name) => {
    expect(parseRemoteUrl(url)).toEqual({ host, owner, name });
  });

  it.each([
    'C:\\Users\\root\\Workspace\\repo',
    'C:/Users/root/Workspace/repo',
    '/home/emre/src/repo',
    'file:///home/emre/src/repo',
    '../sibling-repo',
    'https://github.com/only-one-segment',
    'https://github.com/too/many/segments',
    '',
    '   ',
  ])('rejects %s', (url) => {
    expect(parseRemoteUrl(url)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parseRemoteUrl(null)).toBeNull();
    expect(parseRemoteUrl(42)).toBeNull();
  });
});

describe('classifyRemoteUrl', () => {
  it('maps a GitHub origin to owner/name', () => {
    expect(classifyRemoteUrl('https://github.com/homeofe/aahp-hub.git')).toEqual({
      kind: 'github',
      repo: 'homeofe/aahp-hub',
      host: 'github.com',
      url: 'https://github.com/homeofe/aahp-hub.git',
      remoteName: 'origin',
      source: 'git-remote',
    });
  });

  it('treats a migrated Forgejo project as not applicable rather than an error', () => {
    const remote = classifyRemoteUrl('ssh://git@code.home.io:2222/emre/gaming-llm.git');
    expect(remote.kind).toBe('other-host');
    expect(remote.repo).toBeNull();
    expect(remote.host).toBe('code.home.io');
  });

  it('treats a checkout with no remote as not applicable', () => {
    expect(classifyRemoteUrl(null).kind).toBe('none');
    expect(classifyRemoteUrl('   ').kind).toBe('none');
  });

  it('flags an origin it cannot map instead of inventing a repository', () => {
    const remote = classifyRemoteUrl('https://github.com/too/many/segments');
    expect(remote.kind).toBe('unmappable');
    expect(remote.repo).toBeNull();
  });

  it('never exposes credentials embedded in the origin URL', () => {
    const remote = classifyRemoteUrl('https://user:ghp_secret@github.com/owner/repo.git');
    expect(remote.repo).toBe('owner/repo');
    expect(remote.url).toBe('https://github.com/owner/repo.git');
    expect(remote.url).not.toContain('ghp_secret');
  });

  it('rejects a repository name that would not survive a strict pattern', () => {
    expect(classifyRemoteUrl('https://github.com/owner/re"po').kind).toBe('unmappable');
  });
});

describe('isValidRepoRef', () => {
  it.each([
    ['homeofe', 'aahp-hub'],
    ['elvatis', 'ai.elvatis.com'],
    ['swiss-german-software-agency', 'tennis-coach-admin'],
  ])('accepts %s/%s', (owner, name) => {
    expect(isValidRepoRef(owner, name)).toBe(true);
  });

  it.each([
    ['owner', '..'],
    ['owner', '.'],
    ['owner', 'na"me'],
    ['owner', 'na me'],
    ['own er', 'name'],
    ['owner', ''],
    ['-owner', 'name'],
    ['owner', '$(rm -rf /)'],
  ])('rejects %s/%s', (owner, name) => {
    expect(isValidRepoRef(owner, name)).toBe(false);
  });
});

describe('classifyManifestRepo', () => {
  it('accepts a declared owner/name as a fallback and records the source', () => {
    expect(classifyManifestRepo('elvatis/openclaw-todo')).toMatchObject({
      kind: 'github',
      repo: 'elvatis/openclaw-todo',
      source: 'manifest',
    });
  });

  it.each([null, 42, 'not-a-repo', 'a/b/c', ''])('rejects %s', (value) => {
    expect(classifyManifestRepo(value).kind).toBe('none');
  });
});

describe('parseGitConfigRemotes', () => {
  const config = `[core]
\trepositoryformatversion = 0
\tbare = false
[remote "origin"]
\turl = https://github.com/homeofe/aahp-hub.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[remote "upstream"]
\turl = git@github.com:elvatis/aahp-hub.git
[branch "main"]
\tremote = origin
`;

  it('reads every remote url', () => {
    const remotes = parseGitConfigRemotes(config);
    expect(remotes.get('origin')).toBe('https://github.com/homeofe/aahp-hub.git');
    expect(remotes.get('upstream')).toBe('git@github.com:elvatis/aahp-hub.git');
    expect(remotes.size).toBe(2);
  });

  it('ignores comments and non-remote sections', () => {
    const remotes = parseGitConfigRemotes('# url = https://github.com/evil/repo\n[core]\n\turl = nope\n');
    expect(remotes.size).toBe(0);
  });

  it('returns an empty map for a config with no remotes', () => {
    expect(parseGitConfigRemotes('[core]\n\tbare = false\n').size).toBe(0);
  });
});

describe('pickRemote', () => {
  it('prefers origin', () => {
    const remotes = new Map([
      ['upstream', 'https://github.com/a/b'],
      ['origin', 'https://github.com/c/d'],
    ]);
    expect(pickRemote(remotes)).toEqual({ name: 'origin', url: 'https://github.com/c/d' });
  });

  it('falls back to upstream, then to the first remote', () => {
    expect(pickRemote(new Map([['upstream', 'u'], ['other', 'o']]))).toEqual({ name: 'upstream', url: 'u' });
    expect(pickRemote(new Map([['other', 'o']]))).toEqual({ name: 'other', url: 'o' });
    expect(pickRemote(new Map())).toBeNull();
  });
});

describe('redactRemoteUrl', () => {
  it('strips credentials from a URL', () => {
    expect(redactRemoteUrl('https://user:token@github.com/a/b.git')).toBe('https://github.com/a/b.git');
  });

  it('leaves a credential-free URL alone', () => {
    expect(redactRemoteUrl('https://github.com/a/b.git')).toBe('https://github.com/a/b.git');
  });
});
