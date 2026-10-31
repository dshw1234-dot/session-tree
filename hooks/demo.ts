import type { Group } from '../types'
import { cloudGroup } from './tree'
import type { Session } from './tree'

// `/session-tree demo`가 보여 주는 예시 데이터. 스크린샷에 실제 세션 제목이 나오지 않게 한다.
export const DEMO_CURRENT = 'demo-current'

const APP = 'C:\\Users\\me\\dev\\my-app'
const BLOG = 'C:\\Users\\me\\dev\\blog'

const session = (
  id: string,
  title: string,
  parent: string | null,
  folder: string,
  over: Partial<Session> = {},
): Session => ({
  id: `demo-${id}`,
  cliId: `demo-${id}`,
  title,
  parent: parent && `demo-${parent}`,
  folder,
  createdAt: 0,
  lastActivityAt: 0,
  isArchived: false,
  isStarred: false,
  isRunning: false,
  badges: [],
  ...over,
})

export const demoSessions = (): Session[] => [
  session('plan', 'Plan the v2 release', null, APP, { isStarred: true, lastActivityAt: 9 }),
  session('settings', 'Build the settings page', 'plan', APP, {
    createdAt: 1,
    isRunning: true,
    badges: ['worktree'],
  }),
  session('tests', 'Write the settings tests', 'settings', APP, { createdAt: 2, isRunning: true }),
  session('current', 'Review the API changes', 'plan', APP, {
    createdAt: 3,
    cliId: DEMO_CURRENT,
  }),
  session('fork', 'Plan the v2 release (fork)', 'plan', APP, {
    createdAt: 4,
    badges: ['fork'],
  }),
  session('login', 'Fix the login bug', null, APP, { lastActivityAt: 8, badges: ['worktree'] }),
  session('side', 'What does this error mean?', 'login', APP, { badges: ['side'] }),
  session('old', 'Old prototype', null, APP, { lastActivityAt: 1, isArchived: true }),
  session('post', 'Draft the launch post', null, BLOG, { lastActivityAt: 7 }),
  session('images', 'Make the post images', 'post', BLOG, { createdAt: 1 }),
  session('question', 'Quick question', null, '', { lastActivityAt: 6 }),
]

export const demoCloudGroup = (): Group | null =>
  cloudGroup('  Nightly dependency check [ab12cd]  ·  cloud  ·  idle')
