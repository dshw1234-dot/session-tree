import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'session-tree',
  component: 'Pane',
  requestId: 'session-tree',
  props: {
    title: '세션 가계도',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const ROOT = 'C:\\AD\\Claude\\claude-code-sessions'
const FILES: Record<string, object> = {
  'local_aa.json': { sessionId: 'local_aa', cliSessionId: 'cli-a', title: '부모', cwd: 'C:\p\앱' },
  'local_bb.json': {
    sessionId: 'local_bb',
    cliSessionId: 'cli-b',
    title: '자식',
    cwd: 'C:\p\앱',
    spawnedFrom: { sessionId: 'local_aa' },
  },
  'local_cc.json': {
    sessionId: 'local_cc',
    cliSessionId: 'cli-c',
    title: '옛 세션',
    cwd: 'C:\p\앱',
    isArchived: true,
  },
}

test('세션 파일을 읽어 그리고, 누르면 그 세션을 연다', async ($, on) => {
  const ran: (readonly string[])[] = []
  on('command.register', () => ({ value: { command: 'session-tree' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('env.get', () => ({ value: 'C:\\AD' }))
  on('session.id', () => ({ value: 'cli-b' }))
  on('fs.list', (_, e) => ({
    value:
      e.path === ROOT
        ? Object.keys(FILES).map(name => ({
            name,
            kind: 'file' as const,
            size: 1,
            mtimeMs: 1,
            isLink: false,
          }))
        : [],
  }))
  on('fs.read', (_, e) => ({
    value: JSON.stringify(FILES[String(e.path).split('\\').pop() ?? '']),
  }))
  on('process.run', (_, e) => {
    ran.push(e.argv)

    return {
      value: {
        exitCode: 0,
        stdout: '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('command.run', () => ({ text: '' }))
  on('clock.every', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('tool.check', () => ({ decision: 'allow' as const }))
  on('tool.call', (_, e) => ({
    result: {},
    text:
      e.tool === 'ListAgents'
        ? '  구름 세션 [ee994d]  ·  cloud  ·  idle'
        : JSON.stringify([{ sessionId: 'local_aa', isRunning: true }]),
  }))
  const stored: unknown[] = []
  on('store.get', (_, e) => ({ value: e.key === 'lang' ? 'ko' : undefined }))
  on('store.set', (_, e) => {
    stored.push(e.value)

    return { value: undefined }
  })

  await $.command.run({ command: 'session-tree', args: '' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /지금 여기/ }))?.text).toContain('지금 여기')
    await ui.press({ key: 'local_bb' })
    await ui.unmount()
  }
  expect(ran[0]?.[2]).toBe('claude://claude.ai/epitaxy/local_bb')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /앱/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /구름 세션/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /자식/ })).toBeTruthy()
  await ui.press({ key: 'folder:C:\p\앱' })
  expect(await ui.find({ type: 'Text', text: /자식/ })).toBeFalsy()
  expect(stored.at(-1)).toEqual(['C:\p\앱'])
  await ui.press({ key: 'folder:C:\p\앱' })
  expect(await ui.find({ type: 'Text', text: /자식/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /옛 세션/ })).toBeFalsy()

  // 설정창은 톱니바퀴를 눌러야 펼쳐진다
  expect(await ui.find({ type: 'Text', text: /^설정$/ })).toBeFalsy()
  await ui.press({ key: 'settings' })
  expect(await ui.find({ type: 'Text', text: /^설정$/ })).toBeTruthy()

  await ui.press({ key: 'archived' })
  expect(await ui.find({ type: 'Text', text: /옛 세션/ })).toBeTruthy()
  expect(stored.at(-1)).toBe(true)

  // 영문으로 바꾸면 화면이 바뀌고 그 값이 기본값으로 저장된다
  await ui.press({ key: 'language' })
  expect(stored.at(-1)).toBe('en')
  expect(await ui.find({ type: 'Text', text: /you are here/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /지금 여기/ })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /^Settings$/ })).toBeTruthy()

  // 실행 중 표시
  expect(await ui.find({ type: 'Text', text: /running/ })).toBeTruthy()

  // 검색은 맞는 세션과 조상만 남긴다
  await ui.input({ key: 'search', text: '자식' })
  expect(await ui.find({ type: 'Text', text: /자식/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /옛 세션/ })).toBeFalsy()
  await ui.input({ key: 'search', text: '없는 말' })
  expect(await ui.find({ type: 'Text', text: /No matching/ })).toBeTruthy()
  await ui.input({ key: 'search', text: '' })

  // 예시 화면은 실제 세션 대신 예시 데이터를 보여 준다
  await $.command.run({ command: 'session-tree', args: 'demo' } as never)
  expect(await ui.find({ type: 'Text', text: /Plan the v2 release/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /자식/ })).toBeFalsy()
  await $.command.run({ command: 'session-tree', args: '' } as never)
  expect(await ui.find({ type: 'Text', text: /자식/ })).toBeTruthy()
  await ui.unmount()
})

const BAND = {
  plugin: 'session-tree',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('입력창 위 아이콘으로 패널을 열고 닫는다', async ($, on) => {
  const open: string[] = []
  on('ui.open', (_, e) => {
    if (!open.includes(e.id)) open.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    open.splice(open.indexOf(e.id), 1)

    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: open.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })),
  }))
  on('env.get', () => ({ value: 'C:\AD' }))
  on('session.id', () => ({ value: 'cli-a' }))
  on('fs.list', () => ({ value: [] }))
  on('tool.check', () => ({ decision: 'deny' as const }))
  on('command.register', () => ({ value: { command: 'session-tree' } }))
  on('clock.every', () => ({ value: undefined }))
  on('store.get', () => ({ value: undefined }))
  // 터미널에서는 아이콘을 그리지 않고 아래로 넘긴다
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)

    return <Text>아래</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'toggle-pane' })
  expect(open).toEqual(['session-tree'])
  await ui.press({ key: 'toggle-pane' })
  expect(open).toEqual([])
  await ui.unmount()

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await terminal.find({ type: 'Button' })).toBeFalsy()
  await terminal.unmount()

  // 같은 명령을 다시 입력하면 닫히고, 예시 화면은 열린 패널을 닫지 않는다
  await $.command.run({ command: 'session-tree', args: '' } as never)
  expect(open).toEqual(['session-tree'])
  await $.command.run({ command: 'session-tree', args: 'demo' } as never)
  expect(open).toContain('session-tree')
  await $.command.run({ command: 'session-tree', args: '' } as never)
  expect(open).toEqual([])
})

test('설정에서 입력창 위 아이콘을 숨기고 그 값을 저장한다', async ($, on) => {
  const stored: unknown[] = []
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)

    return <Text>아래</Text>
  })
  on('store.get', () => ({ value: undefined }))
  on('store.set', (_, e) => {
    stored.push(e.value)

    return { value: undefined }
  })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Button' })).toBeTruthy()

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'icon' })
  expect(stored.at(-1)).toBe(true)
  expect(await band.find({ type: 'Button' })).toBeFalsy()

  await pane.press({ key: 'icon' })
  expect(stored.at(-1)).toBe(false)
  expect(await band.find({ type: 'Button' })).toBeTruthy()
  await pane.unmount()
  await band.unmount()
})
