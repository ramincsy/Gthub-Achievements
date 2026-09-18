import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  communityTier,
  mergedPullCounts,
  mergeCommitSha,
  landedPairCommits,
  pairAuthorLogin,
  pairPathStats,
  renderProgress,
  collectMergedPulls,
  collectPairPullCommits
} from '../scripts/progress.mjs';

const tiers = [2, 16, 128, 1024];

test('community tiers stay informational and never invent an official catalog', () => {
  assert.deepEqual(communityTier(0, tiers), { count: 0, reached: null, next: 2, remaining: 2 });
  assert.deepEqual(communityTier(2, tiers), { count: 2, reached: 2, next: 16, remaining: 14 });
  assert.deepEqual(communityTier(1024, tiers), { count: 1024, reached: 1024, next: null, remaining: 0 });
});

test('counts merged PRs per author and ignores closed-unmerged work', () => {
  const stats = mergedPullCounts([
    { merged_at: '2026-09-18T00:00:00Z', user: { login: 'ramincsy' } },
    { merged_at: '2026-09-18T00:00:00Z', user: { login: 'backrebital-lgtm' } },
    { merged_at: '2026-09-18T00:00:00Z', user: { login: 'outsider' } },
    { merged_at: null, state: 'closed', user: { login: 'ramincsy' } }
  ], ['ramincsy', 'backrebital-lgtm']);
  assert.deepEqual(stats, { counts: { ramincsy: 1, 'backrebital-lgtm': 1 }, merged: 3, closedUnmerged: 1 });
});

test('progress report is read-only and labels community thresholds as unofficial', async () => {
  const config = JSON.parse(await readFile(new URL('../config/achievements.json', import.meta.url), 'utf8'));
  const report = renderProgress({
    repository: 'ramincsy/Gthub-Achievements',
    counts: { ramincsy: 2, 'backrebital-lgtm': 0 },
    merged: 2,
    closedUnmerged: 1,
    tiers: config.pullShark.tiers,
    pairTiers: config.pairExtraordinaire.tiers,
    pair: {
      counts: { ramincsy: 0, 'backrebital-lgtm': 1 },
      pairCommits: 1,
      pairPulls: 1,
      malformedTrailers: 0
    },
    generatedAt: '2026-09-18T00:00:00Z'
  });
  assert.match(report, /گزارش جامعه/);
  assert.match(report, /Issue یا PR نمی‌سازد/);
  assert.match(report, /Pair Extraordinaire/);
  assert.match(report, /انسان مستقل نیست/);
  assert.match(report, /1, 10, 24, 48/);
  assert.match(report, /روی شاخهٔ پیش‌فرض نشسته‌اند/);
  assert.match(report, /trailer خودِ نویسنده را حذف/);
  assert.match(report, /نویسندهٔ GitHub آن‌ها عضو نیست/);
  assert.doesNotMatch(report, /workflow_dispatch.*creat/i);
  const routes = [];
  await collectMergedPulls(async route => {
    routes.push(route);
    return [];
  }, 'ramincsy/Gthub-Achievements');
  assert.equal(routes.length, 1);
  assert.match(routes[0], /\/pulls\?state=closed&per_page=100&page=1$/);
});

test('pair path counts well-formed peer noreply trailers and skips placeholders', () => {
  const participants = ['ramincsy', 'backrebital-lgtm'];
  const stats = pairPathStats([
    {
      number: 9,
      commits: [{
        sha: 'aaa',
        authorLogin: 'ramincsy',
        authorEmail: '34828058+ramincsy@users.noreply.github.com',
        message: 'Shared docs\n\nCo-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      }]
    },
    {
      number: 10,
      commits: [{
        sha: 'bbb',
        authorLogin: 'ramincsy',
        authorEmail: '34828058+ramincsy@users.noreply.github.com',
        message: 'Fake pair\n\nCo-authored-by: backrebital-lgtm <name@example.com>'
      }]
    },
    {
      number: 11,
      commits: [{
        sha: 'ccc',
        authorLogin: 'ramincsy',
        authorEmail: '34828058+ramincsy@users.noreply.github.com',
        message: 'Self trailer\n\nCo-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>'
      }]
    }
  ], participants);
  assert.deepEqual(stats, {
    counts: { ramincsy: 0, 'backrebital-lgtm': 1 },
    pairCommits: 1,
    pairPulls: 1,
    malformedTrailers: 2
  });
});

test('pair path attributes both members when a bot authored the commit', () => {
  const stats = pairPathStats([{
    number: 12,
    commits: [{
      sha: 'ddd',
      authorLogin: 'cursor[bot]',
      authorEmail: 'cursoragent@cursor.com',
      message: [
        'Shared fix',
        '',
        'Co-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>',
        'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      ].join('\n')
    }]
  }], ['ramincsy', 'backrebital-lgtm']);
  assert.equal(stats.pairCommits, 1);
  assert.equal(stats.pairPulls, 1);
  assert.deepEqual(stats.counts, { ramincsy: 1, 'backrebital-lgtm': 1 });
});

test('squash landing uses the merge commit, not PR-branch trailers that squash rewrote', () => {
  const branch = {
    sha: '379fddf000000000000000000000000000000000',
    authorLogin: 'cursor[bot]',
    authorEmail: 'cursoragent@cursor.com',
    parentCount: 1,
    message: [
      'feat: count pair-path candidate commits',
      '',
      'Co-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>',
      'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
    ].join('\n')
  };
  const landed = {
    sha: '953756b1d60d1645f13a51d48b2d21ffc1202140',
    authorLogin: 'ramincsy',
    authorEmail: '34828058+ramincsy@users.noreply.github.com',
    parentCount: 1,
    message: [
      'feat: count pair-path commits and document verified noreply trailers (#18)',
      '',
      'Co-authored-by: Cursor Agent <cursoragent@cursor.com>',
      'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
    ].join('\n')
  };
  assert.deepEqual(landedPairCommits(landed, [branch]).map(c => c.sha), [landed.sha]);
  const fromBranch = pairPathStats([{ number: 18, commits: [branch] }], ['ramincsy', 'backrebital-lgtm']);
  const fromLanded = pairPathStats([{ number: 18, commits: landedPairCommits(landed, [branch]) }], ['ramincsy', 'backrebital-lgtm']);
  assert.deepEqual(fromBranch.counts, { ramincsy: 1, 'backrebital-lgtm': 1 });
  assert.deepEqual(fromLanded, {
    counts: { ramincsy: 0, 'backrebital-lgtm': 1 },
    pairCommits: 1,
    pairPulls: 1,
    malformedTrailers: 0
  });
});

test('merge commits count non-merge PR commits and skip the merge commit itself', () => {
  const merge = {
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    parentCount: 2,
    authorLogin: 'ramincsy',
    message: 'Merge pull request #9'
  };
  const feature = {
    sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    parentCount: 1,
    authorLogin: 'ramincsy',
    authorEmail: '34828058+ramincsy@users.noreply.github.com',
    message: 'Shared docs\n\nCo-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
  };
  const ontoMain = {
    sha: 'cccccccccccccccccccccccccccccccccccccccc',
    parentCount: 2,
    authorLogin: 'backrebital-lgtm',
    message: 'Merge branch \'main\' into feature'
  };
  const landed = landedPairCommits(merge, [feature, ontoMain]);
  assert.deepEqual(landed.map(c => c.sha), [feature.sha]);
  const stats = pairPathStats([{ number: 9, commits: landed }], ['ramincsy', 'backrebital-lgtm']);
  assert.equal(stats.pairCommits, 1);
  assert.deepEqual(stats.counts, { ramincsy: 0, 'backrebital-lgtm': 1 });
});

test('collectPairPullCommits reads the merge commit SHA and only lists PR commits for merge commits', async () => {
  const routes = [];
  const squashSha = '953756b1d60d1645f13a51d48b2d21ffc1202140';
  const mergeSha = 'a'.repeat(40);
  const pulls = [
    { number: 8, merged_at: '2026-09-18T00:00:00Z', merge_commit_sha: squashSha },
    { number: 7, merged_at: null, merge_commit_sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
    { number: 9, merged_at: '2026-09-18T01:00:00Z', merge_commit_sha: mergeSha }
  ];
  const pages = await collectPairPullCommits(async route => {
    routes.push(route);
    if (route.endsWith(`/commits/${squashSha}`)) {
      return {
        sha: squashSha,
        parents: [{ sha: 'parent' }],
        commit: { message: 'squash', author: { email: 'a@b.co' } },
        author: { login: 'ramincsy' }
      };
    }
    if (route.endsWith(`/commits/${mergeSha}`)) {
      return {
        sha: mergeSha,
        parents: [{ sha: 'p1' }, { sha: 'p2' }],
        commit: { message: 'Merge pull request #9', author: { email: 'a@b.co' } },
        author: { login: 'ramincsy' }
      };
    }
    if (route.includes('/pulls/9/commits')) {
      return [{
        sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        parents: [{ sha: 'p1' }],
        commit: { message: 'ok', author: { email: 'a@b.co' } },
        author: { login: 'ramincsy' }
      }];
    }
    throw new Error(`unexpected route ${route}`);
  }, 'ramincsy/Gthub-Achievements', pulls);
  assert.deepEqual(pages.map(item => ({ number: item.number, method: item.mergeMethod, shas: item.commits.map(c => c.sha) })), [
    { number: 8, method: 'squash-or-rebase', shas: [squashSha] },
    { number: 9, method: 'merge', shas: ['bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'] }
  ]);
  assert.equal(routes.length, 3);
  assert.equal(routes[0], `/repos/ramincsy/Gthub-Achievements/commits/${squashSha}`);
  assert.equal(routes[1], `/repos/ramincsy/Gthub-Achievements/commits/${mergeSha}`);
  assert.match(routes[2], /\/pulls\/9\/commits\?per_page=100&page=1$/);
  await assert.rejects(collectPairPullCommits(async () => [], '../evil/x', []), /repository/);
  await assert.rejects(collectPairPullCommits(async () => [], 'ramincsy/Gthub-Achievements', [
    { number: 18, merged_at: '2026-09-18T00:00:00Z' }
  ]), /missing a merge commit SHA/);
});

test('mergeCommitSha accepts only a full git SHA', () => {
  const sha = '953756b1d60d1645f13a51d48b2d21ffc1202140';
  assert.equal(mergeCommitSha(sha), sha);
  assert.equal(mergeCommitSha(`  ${sha}  `), sha);
  assert.equal(mergeCommitSha(sha.toUpperCase()), sha.toUpperCase());
  assert.equal(mergeCommitSha('main'), null);
  assert.equal(mergeCommitSha('379fddf'), null);
  assert.equal(mergeCommitSha(''), null);
});

test('landedPairCommits fails closed when the merge commit SHA is missing', () => {
  assert.throws(() => landedPairCommits({}), /missing a merge commit/);
  assert.throws(() => landedPairCommits(null), /missing a merge commit/);
  assert.throws(() => landedPairCommits({ parentCount: 2, message: 'Merge pull request #9' }), /missing a merge commit/);
});

test('pair path counts the squash-landed SHAs of #18/#19/#21/#22, not PR-branch SHAs', () => {
  const participants = ['ramincsy', 'backrebital-lgtm'];
  const ramincsy = {
    authorLogin: 'ramincsy',
    authorEmail: '34828058+ramincsy@users.noreply.github.com',
    parentCount: 1
  };
  const branchSha = '379fddf9ed6307ed6ef1a077c3cbb3fbb36d455b';
  const landed = [
    {
      number: 18,
      ...ramincsy,
      sha: '953756b1d60d1645f13a51d48b2d21ffc1202140',
      message: [
        'feat: count pair-path commits and document verified noreply trailers (#18)',
        '',
        'Co-authored-by: Cursor Agent <cursoragent@cursor.com>',
        'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      ].join('\n')
    },
    {
      number: 19,
      ...ramincsy,
      sha: '05c53383bc6183431e0af2f6875f1ea8ccba2d5c',
      message: [
        'feat: validate local Co-authored-by trailers and document Quickdraw/YOLO honesty (#19)',
        '',
        'Co-authored-by: Cursor Agent <cursoragent@cursor.com>',
        'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>',
        'Co-authored-by: backrebital-lgtm <backrebital@gmail.com>'
      ].join('\n')
    },
    {
      number: 21,
      ...ramincsy,
      sha: '45f82b4bb56127e6ae3fba09febea34bddffccdb',
      message: [
        'feat: request peer review on bot PRs that already carry member trailers (#21)',
        '',
        'Co-authored-by: Cursor Agent <cursoragent@cursor.com>',
        'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      ].join('\n')
    },
    {
      number: 22,
      ...ramincsy,
      sha: 'd6ebb0b46f8e8f7b2560884dc9f20c7cdc8ae804',
      message: [
        'feat: count pair-path commits that landed on the default branch (#22)',
        '',
        'Co-authored-by: Cursor Agent <cursoragent@cursor.com>',
        'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      ].join('\n')
    }
  ];

  for (const commit of landed) {
    assert.deepEqual(landedPairCommits(commit, [{ sha: branchSha, parentCount: 1 }]).map(item => item.sha), [commit.sha]);
  }

  const nineteen = pairPathStats([{ number: 19, commits: [landed[1]] }], participants);
  assert.deepEqual(nineteen, {
    counts: { ramincsy: 0, 'backrebital-lgtm': 1 },
    pairCommits: 1,
    pairPulls: 1,
    malformedTrailers: 0
  });

  const stats = pairPathStats(landed.map(commit => ({
    number: commit.number,
    commits: landedPairCommits(commit, [{ sha: branchSha, parentCount: 1 }])
  })), participants);
  assert.deepEqual(stats, {
    counts: { ramincsy: 0, 'backrebital-lgtm': 4 },
    pairCommits: 4,
    pairPulls: 4,
    malformedTrailers: 0
  });
});

test('pair path does not count a self-trailer when GitHub omits author.login but the git email is that member noreply', () => {
  const stats = pairPathStats([{
    number: 23,
    commits: [{
      sha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      authorLogin: '',
      authorEmail: 'ramincsy@users.noreply.github.com',
      message: [
        'docs: unlinked author object',
        '',
        'Co-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>',
        'Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>'
      ].join('\n')
    }]
  }], ['ramincsy', 'backrebital-lgtm']);
  assert.equal(pairAuthorLogin({
    authorLogin: '',
    authorEmail: 'ramincsy@users.noreply.github.com'
  }), 'ramincsy');
  assert.deepEqual(stats, {
    counts: { ramincsy: 0, 'backrebital-lgtm': 1 },
    pairCommits: 1,
    pairPulls: 1,
    malformedTrailers: 0
  });
});

test('collectPairPullCommits fails closed when the merge commit payload SHA does not match', async () => {
  const sha = '76374a76a386880ff16be54f16461d8cb9b648d5';
  await assert.rejects(collectPairPullCommits(async () => ({
    sha: 'd6ebb0b46f8e8f7b2560884dc9f20c7cdc8ae804',
    parents: [{ sha: 'parent' }],
    commit: { message: 'squash', author: { email: 'a@b.co' } },
    author: { login: 'ramincsy' }
  }), 'ramincsy/Gthub-Achievements', [
    { number: 23, merged_at: '2026-09-18T19:28:37Z', merge_commit_sha: sha }
  ]), /missing a merge commit/);
});

test('collectPairPullCommits fails closed when the merge commit payload has no SHA', async () => {
  const sha = 'd6ebb0b46f8e8f7b2560884dc9f20c7cdc8ae804';
  await assert.rejects(collectPairPullCommits(async () => ({
    sha: '',
    parents: [{ sha: 'parent' }],
    commit: { message: 'squash', author: { email: 'a@b.co' } },
    author: { login: 'ramincsy' }
  }), 'ramincsy/Gthub-Achievements', [
    { number: 22, merged_at: '2026-09-18T19:12:45Z', merge_commit_sha: sha }
  ]), /missing a merge commit/);
});
