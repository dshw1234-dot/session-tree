import type { Badge, Group, Row } from '../types'

export type Session = {
  id: string
  cliId: string | null
  title: string
  parent: string | null
  folder: string
  createdAt: number
  lastActivityAt: number
  isArchived: boolean
  isStarred: boolean
  isRunning: boolean
  badges: Badge[]
}

type Node = Session & { children: Node[] }

// 앱이 세션마다 만든 임시 폴더는 '이 컴퓨터'(빈 문자열)로, worktree는 원래 프로젝트로 본다
export function folderOf(cwd: unknown): string {
  if (typeof cwd !== 'string' || /[\\/]scratch-workspaces[\\/]/.test(cwd)) return ''

  return cwd.replace(/[\\/]\.claude[\\/]worktrees[\\/].*$/, '')
}

// 빈 이름과 빈 제목은 그릴 때 현재 언어의 말로 바꾼다
export const folderName = (folder: string): string =>
  folder.split(/[\\/]/).pop() ?? ''

// 사이드바처럼 git 저장소는 origin 주소의 저장소 이름으로 부른다
export function repoName(gitConfig: string): string | null {
  const url = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(gitConfig)?.[1]

  return url?.replace(/\.git$/, '').split(/[\\/:]/).pop() || null
}

function badgesOf(j: {
  cwd?: unknown
  worktreeName?: unknown
  forkedFromSessionId?: unknown
  spawnedFrom?: { userFork?: unknown; btw?: unknown }
}): Badge[] {
  const badges: Badge[] = []
  const isWorktree =
    !!j.worktreeName ||
    (typeof j.cwd === 'string' && /[\\/]\.claude[\\/]worktrees[\\/]/.test(j.cwd))
  if (isWorktree) badges.push('worktree')
  if (j.spawnedFrom?.btw) badges.push('side')
  else if (j.spawnedFrom?.userFork || j.forkedFromSessionId) badges.push('fork')

  return badges
}

export function parseSession(text: string): Session | null {
  const j = JSON.parse(text)
  if (typeof j?.sessionId !== 'string') return null

  return {
    id: j.sessionId,
    cliId: typeof j.cliSessionId === 'string' ? j.cliSessionId : null,
    title: typeof j.title === 'string' ? j.title : '',
    parent:
      typeof j.spawnedFrom?.sessionId === 'string' && !j.detached
        ? j.spawnedFrom.sessionId
        : null,
    folder: folderOf(j.cwd),
    createdAt: Number(j.createdAt) || 0,
    lastActivityAt: Number(j.lastActivityAt) || 0,
    isArchived: !!j.isArchived,
    isStarred: !!j.isStarred,
    isRunning: false,
    badges: badgesOf(j),
  }
}

// 보관된 세션은 그 아래에 안 보관된 세션이 있을 때만 남긴다
function prune(node: Node): Node | null {
  const children = node.children.flatMap(c => prune(c) ?? [])
  if (node.isArchived && children.length === 0) return null

  return { ...node, children }
}

const matches = (title: string, query: string) =>
  title.toLowerCase().includes(query.trim().toLowerCase())

// 제목이 맞는 세션과 그 조상만 남긴다. 찾은 세션이 나무의 어디에 있는지 보이게 하려는 것이다.
function search(node: Node, query: string): Node | null {
  const children = node.children.flatMap(c => search(c, query) ?? [])
  if (!matches(node.title, query) && children.length === 0) return null

  return { ...node, children }
}

const latest = (n: Node): number =>
  Math.max(n.lastActivityAt, ...n.children.map(latest))

const holds = (n: Node, cliId: string | null): boolean =>
  n.cliId === cliId || n.children.some(c => holds(c, cliId))

function toRows(
  root: Node,
  cliId: string | null,
  nameOf: (folder: string) => string,
): Row[] {
  const rows: Row[] = []
  const walk = (
    n: Node,
    depth: number,
    guides: boolean[],
    isFirst: boolean,
    isLast: boolean,
  ) => {
    rows.push({
      id: n.id,
      title: n.title,
      depth,
      guides,
      isFirst,
      isLast,
      isArchived: n.isArchived,
      isCurrent: n.cliId === cliId,
      isStarred: n.isStarred,
      isRunning: n.isRunning,
      canOpen: true,
      badges: n.badges,
      otherFolder: n.folder === root.folder ? null : nameOf(n.folder),
    })
    const below = depth === 0 ? [] : [...guides, !isLast]
    n.children.forEach((c, i) =>
      walk(c, depth + 1, below, i === 0, i === n.children.length - 1),
    )
  }
  walk(root, 0, [], true, true)

  return rows
}

// 사이드바처럼 안 보관된 세션을 모두 보인다. showArchived면 보관된 세션도 보인다.
// 묶음은 머리 세션의 폴더 아래로 모으고, 현재 세션의 폴더와 묶음이 맨 위, 나머지는 최근 활동 순이다.
export function buildGroups(
  sessions: Session[],
  cliId: string | null,
  repoNames: ReadonlyMap<string, string> = new Map(),
  showArchived = false,
  query = '',
): Group[] {
  const nameOf = (folder: string) => repoNames.get(folder) ?? folderName(folder)
  const nodes = new Map<string, Node>(
    sessions.map(s => [s.id, { ...s, children: [] }]),
  )
  const roots: Node[] = []
  for (const node of nodes.values()) {
    const parent = node.parent ? nodes.get(node.parent) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  for (const node of nodes.values()) {
    node.children.sort((a, b) => a.createdAt - b.createdAt)
  }

  const rank = (a: Node, b: Node) =>
    Number(holds(b, cliId)) - Number(holds(a, cliId)) || latest(b) - latest(a)
  const families = (showArchived ? roots : roots.flatMap(r => prune(r) ?? []))
    .flatMap(r => (query.trim() ? search(r, query) ?? [] : r))
    .sort(rank)

  const groups = new Map<string, Group>()
  for (const family of families) {
    const group = groups.get(family.folder) ?? {
      key: family.folder,
      name: nameOf(family.folder),
      path: family.folder.replace(
        /^(?:[A-Za-z]:[\\/]Users[\\/][^\\/]+|\/Users\/[^/]+|\/home\/[^/]+)/,
        '~',
      ),
      rows: [],
    }
    group.rows.push(...toRows(family, cliId, nameOf))
    groups.set(family.folder, group)
  }

  return [...groups.values()]
}

export const CLOUD_KEY = 'cloud'

// ListAgents 도구의 답에서 클라우드 세션 줄만 고른다. 폴더와 부모 정보는 이 답에 없다.
export function cloudGroup(listAgentsText: string): Group | null {
  const rows: Row[] = []
  for (const line of listAgentsText.split('\n')) {
    const m = /^\s*(.+?) \[([0-9a-f]+)\]\s+·\s+cloud\b/.exec(line)
    if (!m?.[1] || !m[2]) continue
    rows.push({
      id: `cloud:${m[2]}`,
      title: m[1],
      depth: 0,
      guides: [],
      isFirst: true,
      isLast: true,
      isArchived: false,
      isCurrent: false,
      isStarred: false,
      isRunning: false,
      canOpen: false,
      badges: [],
      otherFolder: null,
    })
  }

  return rows.length ? { key: CLOUD_KEY, name: '', path: '', rows } : null
}

export function filterGroup(group: Group, query: string): Group | null {
  const rows = group.rows.filter(r => matches(r.title, query))

  return rows.length ? { ...group, rows } : null
}

// list_sessions 도구의 답에서 지금 실행 중인 세션의 id를 고른다. 현재 세션은 이 답에 없다.
export function runningIds(listSessionsText: string): Set<string> {
  try {
    const list: unknown = JSON.parse(listSessionsText)
    if (!Array.isArray(list)) return new Set()

    return new Set(
      list.flatMap(s =>
        s?.isRunning === true && typeof s.sessionId === 'string' ? [s.sessionId] : [],
      ),
    )
  } catch {
    return new Set()
  }
}
