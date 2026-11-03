import { expect, test } from 'claude-code/testing'

import {
  buildGroups,
  cloudGroup,
  filterGroup,
  folderName,
  folderOf,
  parseSession,
  repoName,
  runningIds,
} from './tree'
import type { Session } from './tree'

const s = (id: string, parent: string | null, over: Partial<Session> = {}): Session => ({
  id,
  cliId: `cli-${id}`,
  title: id,
  parent,
  folder: 'C:\\p\\app',
  createdAt: 0,
  lastActivityAt: 0,
  isArchived: false,
  isStarred: false,
  isRunning: false,
  badges: [],
  ...over,
})

const rowsOf = (sessions: Session[], cliId: string | null = null) =>
  buildGroups(sessions, cliId).flatMap(g => g.rows)

test('손자는 자기 부모 바로 아래, 한 단계 더 들어가고 선 정보를 갖는다', () => {
  const rows = rowsOf([
    s('1', null),
    s('2', '1', { createdAt: 1 }),
    s('3', '2', { createdAt: 2 }),
    s('4', '1', { createdAt: 3 }),
  ])
  expect(rows.map(r => [r.id, r.depth, r.isFirst, r.isLast, r.guides])).toEqual([
    ['1', 0, true, true, []],
    ['2', 1, true, false, []],
    ['3', 2, true, true, [true]],
    ['4', 1, false, true, []],
  ])
})

test('묶음은 폴더별로 모이고 현재 세션의 폴더가 맨 위에 온다', () => {
  const groups = buildGroups(
    [
      s('a', null, { folder: 'C:\\p\\one', lastActivityAt: 9 }),
      s('a1', 'a', { folder: 'C:\\p\\one' }),
      s('b', null, { folder: 'C:\\Users\\me\\two', lastActivityAt: 1 }),
      s('b1', 'b', { folder: 'C:\\Users\\me\\two' }),
    ],
    'cli-b1',
  )
  expect(groups.map(g => [g.name, g.path, g.rows.length])).toEqual([
    ['two', '~\\two', 2],
    ['one', 'C:\\p\\one', 2],
  ])
  expect(groups[0]?.rows[1]?.isCurrent).toBe(true)
})

test('묶음과 다른 폴더의 세션에는 그 폴더 이름이 붙는다', () => {
  const rows = rowsOf([
    s('a', null),
    s('b', 'a', { folder: 'C:\\p\\other' }),
    s('c', 'a', { folder: '' }),
  ])
  expect(rows.map(r => r.otherFolder)).toEqual([null, 'other', ''])
})

test('임시 폴더는 이 컴퓨터, worktree는 원래 프로젝트로 본다', () => {
  expect(folderOf('C:\\A\\Claude\\scratch-workspaces\\x\\y')).toBe('')
  expect(folderOf('C:\\dev\\app\\.claude\\worktrees\\task-1')).toBe('C:\\dev\\app')
  expect(folderName('')).toBe('')
})

test('보관된 끝 세션은 빠지고, 자식 없는 세션과 자식이 있는 보관 부모는 남는다', () => {
  const rows = rowsOf([
    s('solo', null),
    s('p', null, { isArchived: true }),
    s('c', 'p'),
    s('gone', 'p', { isArchived: true }),
  ])
  expect(rows.map(r => r.id).sort()).toEqual(['c', 'p', 'solo'])
})

test('보관 세션 보기를 켜면 보관된 끝 세션도 나온다', () => {
  const sessions = [s('p', null), s('gone', 'p', { isArchived: true })]
  const ids = (showArchived: boolean) =>
    buildGroups(sessions, null, new Map(), showArchived)
      .flatMap(g => g.rows)
      .map(r => [r.id, r.isArchived])
  expect(ids(false)).toEqual([['p', false]])
  expect(ids(true)).toEqual([
    ['p', false],
    ['gone', true],
  ])
})

test('부모가 지워진 자식은 묶음의 머리가 된다', () => {
  expect(rowsOf([s('orphan', 'missing'), s('kid', 'orphan')]).map(r => r.id)).toEqual([
    'orphan',
    'kid',
  ])
})

test('세션 파일에서 부모와 폴더를 읽는다', () => {
  const parsed = parseSession(
    JSON.stringify({
      sessionId: 'local_a',
      cliSessionId: 'x',
      title: 't',
      cwd: 'C:\\p\\app',
      spawnedFrom: { sessionId: 'local_b' },
    }),
  )
  expect(parsed?.parent).toBe('local_b')
  expect(parsed?.folder).toBe('C:\\p\\app')
  expect(parseSession('{}')).toBe(null)
})

test('저장소는 origin 저장소 이름으로 부른다', () => {
  expect(
    repoName('[remote "origin"]\n\turl = https://github.com/me/my-app-src.git\n'),
  ).toBe('my-app-src')
  expect(repoName('[core]\n\tbare = false\n')).toBe(null)
  const groups = buildGroups(
    [s('a', null)],
    null,
    new Map([['C:\\p\\app', 'real-name']]),
  )
  expect(groups[0]?.name).toBe('real-name')
})

test('워크트리, 포크, 사이드 채팅을 표시한다', () => {
  const badges = (over: object) =>
    parseSession(JSON.stringify({ sessionId: 'local_a', ...over }))?.badges
  expect(badges({ cwd: 'C:\\a\\.claude\\worktrees\\x' })).toEqual(['worktree'])
  expect(badges({ spawnedFrom: { sessionId: 'p', userFork: true } })).toEqual(['fork'])
  expect(
    badges({ spawnedFrom: { sessionId: 'p', userFork: true, btw: true } }),
  ).toEqual(['side'])
  expect(badges({ spawnedFrom: { sessionId: 'p', sideSession: true } })).toEqual([])
})

test('검색은 맞는 세션과 그 조상만 남기고 선 정보를 다시 계산한다', () => {
  const sessions = [
    s('p', null, { title: 'Parent' }),
    s('a', 'p', { title: 'Alpha', createdAt: 1 }),
    s('b', 'p', { title: 'Beta', createdAt: 2 }),
    s('lone', null, { title: 'Other' }),
  ]
  const rows = buildGroups(sessions, null, new Map(), false, ' beta ').flatMap(g => g.rows)
  expect(rows.map(r => [r.id, r.isFirst, r.isLast])).toEqual([
    ['p', true, true],
    ['b', true, true],
  ])
  expect(buildGroups(sessions, null, new Map(), false, 'zzz')).toEqual([])
})

test('클라우드 묶음도 검색으로 거른다', () => {
  const group = cloudGroup('  Alpha [aa11]  ·  cloud  ·  idle\n  Beta [bb22]  ·  cloud  ·  idle')
  expect(group && filterGroup(group, 'beta')?.rows.map(r => r.title)).toEqual(['Beta'])
  expect(group && filterGroup(group, 'zzz')).toBe(null)
})

test('즐겨찾기를 읽고, 실행 중인 세션을 도구의 답에서 고른다', () => {
  expect(parseSession(JSON.stringify({ sessionId: 'a', isStarred: true }))?.isStarred).toBe(true)
  expect(parseSession(JSON.stringify({ sessionId: 'a' }))?.isStarred).toBe(false)
  expect([
    ...runningIds(
      JSON.stringify([
        { sessionId: 'x', isRunning: true },
        { sessionId: 'y', isRunning: false },
      ]),
    ),
  ]).toEqual(['x'])
  expect(runningIds('오류').size).toBe(0)
})

test('macOS와 Linux 홈 폴더도 ~로 줄이고, / 경로의 worktree를 원래 프로젝트로 본다', () => {
  const pathOf = (folder: string) => buildGroups([s('a', null, { folder })], null)[0]?.path
  expect(pathOf('/Users/me/app')).toBe('~/app')
  expect(pathOf('/home/me/app')).toBe('~/app')
  expect(folderOf('/Users/me/app/.claude/worktrees/x')).toBe('/Users/me/app')
  expect(folderName('/Users/me/app')).toBe('app')
})

test('ListAgents 답에서 클라우드 세션만 고른다', () => {
  const group = cloudGroup(
    [
      'Peer sessions (3):',
      '  로컬 세션 [841714]  ·  interactive  ·  idle  ·  Claude Desktop session',
      '  원격 [ae0cd2]  ·  Remote Control  ·  offline',
      '  GitHub와 Supabase 무료 플랜 검토 [ee994d]  ·  cloud  ·  idle',
    ].join('\n'),
  )
  expect(group?.rows.map(r => [r.title, r.canOpen])).toEqual([
    ['GitHub와 Supabase 무료 플랜 검토', false],
  ])
  expect(cloudGroup('없음')).toBe(null)
})
