import type { Badge, Lang } from '../types'

type Strings = {
  title: string
  commandDescription: string
  opened: string
  closed: string
  settings: string
  otherLanguage: string
  refresh: string
  autoRefresh: string
  showArchived: (count: number) => string
  hideArchived: string
  showIcon: string
  hideIcon: string
  search: string
  noMatch: string
  running: string
  loading: string
  empty: string
  readFailed: string
  thisComputer: string
  cloud: string
  untitled: string
  here: string
  archived: string
  sessions: (count: number) => string
  badges: Record<Badge, string>
}

export const STRINGS: Record<Lang, Strings> = {
  ko: {
    title: '세션 가계도',
    commandDescription: '세션 가계도 패널을 열거나 닫습니다',
    opened: '세션 가계도 패널을 열었습니다.',
    closed: '세션 가계도 패널을 닫았습니다.',
    settings: '설정',
    otherLanguage: 'English',
    refresh: '새로 고침',
    autoRefresh: '1분마다 자동으로 새로 고칩니다',
    showArchived: count => `보관 세션 보기 (${count})`,
    hideArchived: '보관 세션 숨기기',
    showIcon: '입력창 아래 아이콘 보이기',
    hideIcon: '입력창 아래 아이콘 숨기기',
    search: '세션 검색',
    noMatch: '검색 결과가 없습니다.',
    running: '실행 중',
    loading: '불러오는 중…',
    empty: '세션이 없습니다.',
    readFailed: '세션 파일을 읽지 못했습니다. Claude 데스크톱 앱이 필요합니다',
    thisComputer: '이 컴퓨터',
    cloud: '클라우드',
    untitled: '(제목 없음)',
    here: '지금 여기',
    archived: '보관됨',
    sessions: count => `${count}개`,
    badges: { worktree: '워크트리', fork: '포크', side: '사이드 채팅' },
  },
  en: {
    title: 'Session tree',
    commandDescription: 'Open or close the session tree panel',
    opened: 'Opened the session tree panel.',
    closed: 'Closed the session tree panel.',
    settings: 'Settings',
    otherLanguage: '한국어',
    refresh: 'Refresh',
    autoRefresh: 'Refreshes automatically every minute',
    showArchived: count => `Show archived (${count})`,
    hideArchived: 'Hide archived',
    showIcon: 'Show icon under the prompt',
    hideIcon: 'Hide icon under the prompt',
    search: 'Search sessions',
    noMatch: 'No matching sessions.',
    running: 'running',
    loading: 'Loading…',
    empty: 'No sessions.',
    readFailed: 'Could not read the session files. The Claude desktop app is required',
    thisComputer: 'This computer',
    cloud: 'Cloud',
    untitled: '(untitled)',
    here: 'you are here',
    archived: 'archived',
    sessions: count => `${count} ${count === 1 ? 'session' : 'sessions'}`,
    badges: { worktree: 'worktree', fork: 'fork', side: 'side chat' },
  },
}
