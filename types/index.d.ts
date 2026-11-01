export type Badge = 'worktree' | 'fork' | 'side'
export type Lang = 'ko' | 'en'

export type Row = {
  id: string
  title: string
  depth: number
  // 조상 단계마다 세로선이 이어지는지. 길이는 depth - 1이다.
  guides: boolean[]
  isFirst: boolean
  isLast: boolean
  isArchived: boolean
  isCurrent: boolean
  isStarred: boolean
  isRunning: boolean
  // 클라우드 세션은 짧은 id만 알 수 있어 눌러서 열지 못한다
  canOpen: boolean
  badges: Badge[]
  // 묶음의 폴더와 다른 폴더에서 도는 세션에만 붙는다. 빈 문자열은 이 컴퓨터다.
  otherFolder: string | null
}

export type Group = {
  key: string
  name: string
  path: string
  rows: Row[]
}

declare module 'claude-code' {
  interface PluginState {
    'session-tree': {
      groups: Shaped<Group[]>
      collapsed: string[]
      note: string | null
      showArchived: boolean
      isIconHidden: boolean
      archivedCount: number
      lang: Lang
      isSettingsOpen: boolean
      searchQuery: string
      latestVersion: string | null
    }
  }
}
