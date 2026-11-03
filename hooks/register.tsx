import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Badge, Group, Lang, Row } from '../types'
import { DEMO_CURRENT, demoCloudGroup, demoSessions } from './demo'
import { STRINGS } from './strings'
import {
  buildGroups,
  CLOUD_KEY,
  cloudGroup,
  filterGroup,
  parseSession,
  repoName,
  runningIds,
} from './tree'
import type { Session } from './tree'

const PANE = 'session-tree'
const SESSIONS_DIR = 'Claude\\claude-code-sessions'
const LIST_SESSIONS_TOOL = 'mcp__ccd_session_mgmt__list_sessions'
const NOTE_NO_MATCH = 'no-match'
const REFRESH_MS = 60_000
const COLLAPSED_KEY = 'collapsed'
const SHOW_ARCHIVED_KEY = 'showArchived'
const HIDE_ICON_KEY = 'hideIcon'
const LANG_KEY = 'lang'
const GEAR = '⚙'
const OPEN_ICON = '◨'
const CLOSE_ICON = '□'
const NOTE_LOADING = 'loading'
const NOTE_EMPTY = 'empty'

const groups = atom({ plugin: 'session-tree', key: 'groups' } as const, [], {
  shape: 'groups-4',
})
const searchQuery = atom(
  { plugin: 'session-tree', key: 'searchQuery' } as const,
  '' as string,
)
const collapsed = atom(
  { plugin: 'session-tree', key: 'collapsed' } as const,
  [] as string[],
)
const note = atom(
  { plugin: 'session-tree', key: 'note' } as const,
  NOTE_LOADING as string | null,
)
const lang = atom(
  { plugin: 'session-tree', key: 'lang' } as const,
  'en' as Lang,
)
const isSettingsOpen = atom(
  { plugin: 'session-tree', key: 'isSettingsOpen' } as const,
  false as boolean,
)
const showArchived = atom(
  { plugin: 'session-tree', key: 'showArchived' } as const,
  false as boolean,
)
const isIconHidden = atom(
  { plugin: 'session-tree', key: 'isIconHidden' } as const,
  false as boolean,
)
const isPaneOpen = atom(
  { plugin: 'session-tree', key: 'isPaneOpen' } as const,
  false as boolean,
)
const archivedCount = atom(
  { plugin: 'session-tree', key: 'archivedCount' } as const,
  0 as number,
)

// 묶음의 첫 세션은 보라, 그 아래 단계는 청록, 더 아래는 모두 회색
const PURPLE = { fill: '#3C3489', text: '#E4E2FB', soft: '#AFA9EC' }
const TEAL = { fill: '#085041', text: '#CDEFE3', soft: '#5DCAA5' }
const GRAY = { fill: '#444441', text: '#F1EFE8', soft: '#B4B2A9' }
const ARCHIVED = { text: '#9C9A92', soft: '#6F6E69' }
const CURRENT = '#EF9F27'
const STAR = '#F2C94C'
const RUNNING = '#7BE0A8'
const CONNECTOR = '#9C9A92'

const colorsOf = (row: Row) =>
  row.depth === 0 ? PURPLE : row.depth === 1 ? TEAL : GRAY

const BADGE_COLORS: Record<Badge, string> = {
  worktree: '#85B7EB',
  fork: '#F0997B',
  side: '#ED93B1',
}

// 연결선 칸은 글자 3칸이고 데스크톱에서 약 28px이다. 그림을 칸 너비에 맞춰야 세로선이 눌리지 않는다.
const SLOT_PX = 28
const SLOT_TALL = 400
// 같은 묶음 안의 세션 간격, 독립된 세션과 폴더 제목 아래의 간격, 카드 안쪽 위아래 여백
const GAP_PX = 9
const FAMILY_GAP_PX = 15
const CARD_PAD_PX = 2
const LINE_X = 8
const lineSvg = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SLOT_PX}" height="${SLOT_TALL}"><path d="${d}" fill="none" stroke="${CONNECTOR}" stroke-width="1.5" stroke-linecap="round"/></svg>`
const VERTICAL = `M${LINE_X} 0V${SLOT_TALL}`
const PASS = lineSvg(VERTICAL)
// 자식이 부모에게 보고하는 방향: 첫 자식 칸 맨 위에 부모 쪽을 가리키는 화살촉을 그린다
const HEAD = `M${LINE_X - 4} 6L${LINE_X} 0L${LINE_X + 4} 6`
const gapSvg = (row: Row) => lineSvg(`${VERTICAL}${row.isFirst ? HEAD : ''}`)
// 카드 옆 칸을 위아래 절반으로 나눈다. 가로선이 아래 절반의 맨 위에 있어 카드 높이와 상관없이 가운데에 닿는다.
const lowerSvg = (row: Row) =>
  lineSvg(`M${LINE_X} 1H${SLOT_PX}${row.isLast ? '' : VERTICAL}`)
const spaceSvg = (px: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="${px}"><rect width="1" height="${px}" fill="none"/></svg>`

type Platform = { root: string; sep: string; opener: string[] }

// 데스크톱 앱이 세션 파일을 두는 곳. 앱은 Windows와 macOS에만 있다. macOS 경로와 여는 명령은 실기 확인 전이다.
async function findPlatform($: EngineInterface): Promise<Platform> {
  const appData = await $.env.get('APPDATA')
  if (appData) {
    return {
      root: `${appData}\\${SESSIONS_DIR}`,
      sep: '\\',
      opener: ['rundll32', 'url.dll,FileProtocolHandler'],
    }
  }
  const home = await $.env.get('HOME')

  return {
    root: `${home}/Library/Application Support/${SESSIONS_DIR.replace('\\', '/')}`,
    sep: '/',
    opener: ['open'],
  }
}

async function sessionFiles($: EngineInterface, dir: string, sep: string) {
  const found: { path: string; mtimeMs: number }[] = []
  for (const entry of await $.fs.list(dir)) {
    const path = `${dir}${sep}${entry.name}`
    if (entry.kind === 'dir') found.push(...(await sessionFiles($, path, sep)))
    else if (/^local_.*\.json$/.test(entry.name)) {
      found.push({ path, mtimeMs: entry.mtimeMs })
    }
  }

  return found
}

// 바뀐 파일만 다시 읽는다. 앱이 쓰는 도중이라 읽지 못한 파일은 이전 값을 쓴다.
const cache = new Map<string, { mtimeMs: number; session: Session | null }>()
const repoNames = new Map<string, string>()

let platform: Platform | null = null
let lastSessions: Session[] = []
let lastCloud: Group | null = null
let lastCliId: string | null = null
let isDemo = false

async function loadRepoNames(
  $: EngineInterface,
  sessions: Session[],
  sep: string,
) {
  for (const folder of new Set(sessions.map(s => s.folder))) {
    if (!folder || repoNames.has(folder)) continue
    const config = await $.fs
      .read(`${folder}${sep}.git${sep}config`)
      .catch(() => '')
    const name = repoName(config)
    if (name) repoNames.set(folder, name)
  }
}

// $.tool.call은 권한 창을 띄울 수 있다. 1분마다 창이 뜨지 않게 이미 허용된 도구만 부른다.
async function callIfAllowed(
  $: EngineInterface,
  tool: string,
  input: Record<string, unknown>,
) {
  try {
    const { decision } = await $.tool.check({ tool, input })
    if (decision !== 'allow') return null
    const { text } = await $.tool.call({ tool, ...input } as never)

    return String(text ?? '')
  } catch {
    return null
  }
}

async function rebuild($: EngineInterface) {
  const query = await read($, searchQuery)
  const local = buildGroups(
    lastSessions,
    lastCliId,
    repoNames,
    await read($, showArchived),
    query,
  )
  const cloud = lastCloud && filterGroup(lastCloud, query)
  const next = cloud ? [...local, cloud] : local
  await update($, archivedCount, () => lastSessions.filter(s => s.isArchived).length)
  await update($, groups, () => next)
  await update($, note, () =>
    next.length ? null : query ? NOTE_NO_MATCH : NOTE_EMPTY,
  )
}

async function refresh($: EngineInterface) {
  if (isDemo) {
    lastSessions = demoSessions()
    lastCloud = demoCloudGroup()
    lastCliId = DEMO_CURRENT
    await rebuild($)

    return
  }
  try {
    platform ??= await findPlatform($)
    const { root, sep } = platform
    const files = await sessionFiles($, root, sep)
    await Promise.all(
      files.map(async ({ path, mtimeMs }) => {
        if (cache.get(path)?.mtimeMs === mtimeMs) return
        try {
          const session = parseSession(await $.fs.read(path))
          cache.set(path, { mtimeMs, session })
        } catch {
          // 다음 갱신 때 다시 읽는다
        }
      }),
    )
    const live = new Set(files.map(f => f.path))
    for (const path of cache.keys()) if (!live.has(path)) cache.delete(path)

    const sessions = [...cache.values()].flatMap(c => c.session ?? [])
    await loadRepoNames($, sessions, sep)
    const running = runningIds(
      (await callIfAllowed($, LIST_SESSIONS_TOOL, { limit: 500 })) ?? '',
    )
    lastSessions = sessions.map(s => ({ ...s, isRunning: running.has(s.id) }))
    lastCloud = cloudGroup((await callIfAllowed($, 'ListAgents', {})) ?? '')
    lastCliId = await $.session.id()
    await rebuild($)
  } catch (err) {
    await update($, note, () => String(err))
  }
}

// 사용자가 고른 언어가 기본값이다. 고른 적이 없으면 Claude Code 언어 설정과 시스템 언어를 따른다.
async function resolveLang($: EngineInterface): Promise<Lang> {
  const stored = await $.store.get(LANG_KEY)
  if (stored === 'ko' || stored === 'en') return stored
  try {
    const rows = await $.config.list()
    const setting = rows.find(row => row.key === 'language')?.value
    if (typeof setting === 'string' && setting) {
      return /^(ko|korean|한국어)/i.test(setting) ? 'ko' : 'en'
    }
  } catch {
    // 설정을 읽지 못하면 시스템 언어를 본다
  }
  const system = await $.env.get('LANG').catch(() => undefined)

  return system?.startsWith('ko') ? 'ko' : 'en'
}

// 패널이 열려 있을 때만 파일을 읽는다. 패널을 열지 않은 세션은 파일을 읽지 않는다.
async function refreshIfOpen($: EngineInterface) {
  const panes = await $.ui.panes().catch(() => [])
  const isOpen = panes.some(pane => pane.id === PANE)
  // 모드를 다시 불러와도 패널은 열린 채 남아 있을 수 있어 아이콘 모양도 여기서 맞춘다
  await update($, isPaneOpen, () => isOpen)
  if (isOpen) await refresh($)
}

// 그리는 도중에는 상태를 쓸 수 없어 세션 시작과 명령 실행에서 시작한다
let isStarted = false

async function start($: EngineInterface) {
  if (isStarted) return
  isStarted = true
  const resolved = await resolveLang($)
  await update($, lang, () => resolved)
  const stored = await $.store.get(COLLAPSED_KEY)
  if (Array.isArray(stored)) {
    await update($, collapsed, () => stored.map(String))
  }
  if ((await $.store.get(SHOW_ARCHIVED_KEY)) === true) {
    await update($, showArchived, () => true)
  }
  if ((await $.store.get(HIDE_ICON_KEY)) === true) {
    await update($, isIconHidden, () => true)
  }
  await refreshIfOpen($)
  $.clock.every(REFRESH_MS, () => void refreshIfOpen($))
}

async function toggleFolder($: EngineInterface, key: string) {
  const list = await read($, collapsed)
  const next = list.includes(key) ? list.filter(k => k !== key) : [...list, key]
  await update($, collapsed, () => next)
  await $.store.set(COLLAPSED_KEY, next)
}

async function toggleArchived($: EngineInterface) {
  const next = !(await read($, showArchived))
  await update($, showArchived, () => next)
  await $.store.set(SHOW_ARCHIVED_KEY, next)
  await rebuild($)
}

async function toggleIcon($: EngineInterface) {
  const next = !(await read($, isIconHidden))
  await update($, isIconHidden, () => next)
  await $.store.set(HIDE_ICON_KEY, next)
}

async function toggleLang($: EngineInterface) {
  const next: Lang = (await read($, lang)) === 'ko' ? 'en' : 'ko'
  await update($, lang, () => next)
  await $.store.set(LANG_KEY, next)
  await $.ui.open({ id: PANE, title: STRINGS[next].title })
}

async function toggleSettings($: EngineInterface) {
  const next = !(await read($, isSettingsOpen))
  await update($, isSettingsOpen, () => next)
}

async function openPane($: EngineInterface) {
  await $.ui.open({ id: PANE, title: STRINGS[await read($, lang)].title })
  await update($, isPaneOpen, () => true)
  await refresh($)
}

// 패널이 열려 있으면 닫고 true를 돌려준다
async function closeIfOpen($: EngineInterface) {
  const panes = await $.ui.panes()
  if (!panes.some(pane => pane.id === PANE)) return false
  await $.ui.close({ id: PANE })
  await update($, isPaneOpen, () => false)

  return true
}

async function setQuery($: EngineInterface, value: string) {
  await update($, searchQuery, () => value)
  await rebuild($)
}

async function openSession($: EngineInterface, id: string) {
  if (!/^local_[0-9a-f-]+$/.test(id)) return
  platform ??= await findPlatform($)
  await $.process.run([...platform.opener, `claude://claude.ai/epitaxy/${id}`])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await start($)
    await $.command.register({
      name: 'session-tree',
      description: STRINGS[await read($, lang)].commandDescription,
    })

    return next(e)
  })

  on('command.run', { command: 'session-tree' }, async ($, e) => {
    await start($)
    // `/session-tree demo`는 실제 세션 대신 예시 데이터를 보여 준다 (스크린샷용)
    isDemo = e.args.trim() === 'demo'
    const t = STRINGS[await read($, lang)]
    if (!isDemo && (await closeIfOpen($))) return { text: t.closed }
    await openPane($)

    return { text: t.opened }
  })

  // 패널의 X로 닫아도 아이콘이 따라 바뀐다
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    await update($, isPaneOpen, () => false)

    return result
  })

  // 데스크톱 입력창 아래 상태 줄의 흐린 아이콘. 앱은 이 자리에서 label이 있는 Button만 살려 둔다.
  // 아래에 깔린 다른 mod가 이 자리에 그린 버튼도 옆에 남긴다.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const below = await next(e)
    if (e.surface !== 'desktop' || (await read($, isIconHidden))) return below
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="row">
        <Button
          key="toggle-pane"
          label={(await read($, isPaneOpen)) ? CLOSE_ICON : OPEN_ICON}
          dimColor
          onPress={async () => {
            if (!(await closeIfOpen($))) await openPane($)
          }}
        />
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const Input = 'Input' in ui ? ui.Input : null
    const Svg = 'Svg' in ui ? ui.Svg : null
    const list = await read($, groups)
    const folded = await read($, collapsed)
    const message = await read($, note)
    const isShowingArchived = await read($, showArchived)
    const archived = await read($, archivedCount)
    const isHidingIcon = await read($, isIconHidden)
    const isOpen = await read($, isSettingsOpen)
    const query = await read($, searchQuery)
    const t = STRINGS[await read($, lang)]
    const noteText =
      message === NOTE_LOADING
        ? t.loading
        : message === NOTE_EMPTY
          ? t.empty
          : message === NOTE_NO_MATCH
            ? t.noMatch
            : message && `${t.readFailed}: ${message}`

    const line = (source: string) =>
      Svg && (
        <Box position="absolute" top={0} left={0}>
          <Svg source={source} alt="연결선" width={SLOT_PX} height={SLOT_TALL} />
        </Box>
      )

    const slot = (source: string | null) => (
      <Box width={3} flexShrink={0} overflow="hidden" position="relative">
        {source && line(source)}
      </Box>
    )

    // alt가 비면 앱이 그림을 버려 간격이 사라진다
    const space = (px: number) =>
      Svg && <Svg source={spaceSvg(px)} alt="간격" width={1} height={px} />

    const elbow = (row: Row) => (
      <Box width={3} flexShrink={0} flexDirection="column">
        <Box overflow="hidden" position="relative">
          {space(GAP_PX)}
          {line(gapSvg(row))}
        </Box>
        <Box flexGrow={1} overflow="hidden" position="relative">
          {line(PASS)}
        </Box>
        <Box flexGrow={1} overflow="hidden" position="relative">
          {line(lowerSvg(row))}
        </Box>
      </Box>
    )

    const drawRow = (row: Row) => {
      const colors = colorsOf(row)
      const title = (
        <Text
          color={row.isArchived ? ARCHIVED.text : colors.text}
          bold={row.isCurrent}
        >
          {row.title || t.untitled}
        </Text>
      )
      const soft = row.isArchived ? ARCHIVED.soft : colors.soft

      return (
        <Box
          flexDirection="row"
          alignItems="stretch"
          paddingLeft={Svg ? 0 : row.depth * 2}
        >
          {Svg && row.guides.map(isOn => slot(isOn ? PASS : null))}
          {Svg && row.depth > 0 && elbow(row)}
          <Box flexDirection="column" flexShrink={1}>
            {space(row.depth > 0 ? GAP_PX : FAMILY_GAP_PX)}
            {/* 데스크톱은 borderStyle을 모두 실선으로 그린다. 보관 세션은 채움을 빼서 구분한다. */}
            <Box
              flexDirection="column"
              borderStyle={!Svg && row.isArchived ? 'dashed' : 'round'}
              borderColor={row.isCurrent ? CURRENT : soft}
              {...(row.isArchived ? {} : { backgroundColor: colors.fill })}
              paddingX={1}
              paddingY={0}
            >
              {space(CARD_PAD_PX)}
              {row.canOpen ? (
                <Button key={row.id} plain onPress={() => openSession($, row.id)}>
                  {row.isStarred && <Text color={STAR}>★ </Text>}
                  {title}
                  {row.badges.map(b => (
                    <Text color={BADGE_COLORS[b]}> [{t.badges[b]}]</Text>
                  ))}
                  {row.otherFolder !== null && (
                    <Text color={soft}> · {row.otherFolder || t.thisComputer}</Text>
                  )}
                  {row.isRunning && <Text color={RUNNING}> · ● {t.running}</Text>}
                  {row.isCurrent && <Text color={CURRENT}> · {t.here}</Text>}
                  {row.isArchived && <Text color={ARCHIVED.text}> · {t.archived}</Text>}
                </Button>
              ) : (
                title
              )}
              {space(CARD_PAD_PX)}
            </Box>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap="sm">
        <Box flexDirection="row" alignItems="center">
          <Box flexGrow={1} flexShrink={1}>
            {Input && (
              <Input
                key="search"
                placeholder={t.search}
                value={query}
                onInput={(value: string) => setQuery($, value)}
                onSubmit={(value: string) => setQuery($, value)}
              />
            )}
          </Box>
          <Button key="settings" label={GEAR} plain onPress={() => toggleSettings($)} />
        </Box>
        {isOpen && (
          <Box
            flexDirection="column"
            gap="xs"
            borderStyle="round"
            borderColor={CONNECTOR}
            paddingX={1}
          >
            <Text bold>{t.settings}</Text>
            <Box flexDirection="row" flexWrap="wrap">
              <Button key="language" label={t.otherLanguage} onPress={() => toggleLang($)} />
              <Button key="refresh" label={t.refresh} onPress={() => refresh($)} />
              <Button
                key="archived"
                label={isShowingArchived ? t.hideArchived : t.showArchived(archived)}
                onPress={() => toggleArchived($)}
              />
              <Button
                key="icon"
                label={isHidingIcon ? t.showIcon : t.hideIcon}
                onPress={() => toggleIcon($)}
              />
            </Box>
            <Text dimColor>{t.autoRefresh}</Text>
          </Box>
        )}
        {noteText && <Text dimColor>{noteText}</Text>}
        {list.map(group => {
          const isFolded = folded.includes(group.key)

          return (
            <Box
              flexDirection="column"
              borderStyle="dashed"
              borderColor={CONNECTOR}
              paddingX={1}
            >
              <Button
                key={`folder:${group.key}`}
                plain
                onPress={() => toggleFolder($, group.key)}
              >
                {isFolded ? '▸ ' : '▾ '}
                <Text bold>
                  {group.key === CLOUD_KEY ? t.cloud : group.name || t.thisComputer}
                </Text>
                <Text dimColor> · {t.sessions(group.rows.length)}</Text>
                {!isFolded && group.path && <Text dimColor> · {group.path}</Text>}
              </Button>
              {!isFolded && group.rows.map(drawRow)}
            </Box>
          )
        })}
      </Box>
    )
  })
}
