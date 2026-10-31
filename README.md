# Session Tree

[한국어](README.ko.md)

A side panel for the Claude desktop app that shows which session started which. The sidebar lists your sessions; Session Tree draws them as a family tree, grouped by folder, so you can see the shape of your work at a glance.

![Session Tree panel showing sessions grouped by folder](docs/screenshot.png)

*The screenshot uses the sample data from `/session-tree demo`.*

## Features

- **Family tree:** arrows point from each child session to the parent it reports to.
- **Folders:** sessions are grouped like the sidebar, and each folder can be collapsed.
- **Session types:** worktree, fork and side chat sessions are labelled.
- **Status:** starred sessions get a ★ and running sessions get a ● marker.
- **Search:** filter by title. Matching sessions stay in place under their parents.
- **Archived sessions:** hidden by default, with a button to show them.
- **Click to open:** click a card to open that session in the app.
- **Korean and English:** your choice is remembered.

It refreshes by itself every minute while the panel is open.

## Install

Requires the Claude desktop app and the Claude Code CLI. In a terminal:

```bash
claude plugin marketplace add dshw1234-dot/session-tree
claude plugin install session-tree@session-tree --scope user
```

Start a new session and type `/session-tree`. The ⚙ button at the top right opens the settings.

To get updates automatically, turn on auto-update for this marketplace under **Marketplaces** in `/plugin` in a terminal. To update by hand:

```bash
claude plugin update session-tree@session-tree
```

## Token use

Drawing the panel, refreshing it and pressing its buttons make no model calls. The one small cost is the line `/session-tree` leaves in the conversation, which the model reads on your next message.

## What it reads and sends

- It reads the session files the desktop app keeps on your computer, and each project's `.git/config` for its repository name.
- It calls the `ListAgents` and `list_sessions` tools for cloud sessions and running status, but only when they are already allowed, so it never opens a permission prompt.
- Once per session, while the panel is open, it requests this repository's `plugin.json` from `raw.githubusercontent.com` to check for a new version. It sends none of your data.

## Limitations

- **Tested on Windows only.** macOS and Linux support is written but has not been run on those systems. Reports are welcome.
- **It can break when the app updates.** The session files are the app's internal format, not a public API.
- **Cloud sessions show titles only.** They have no folder, no parent and no click-to-open, because that information isn't available to a mod.
- **Running status doesn't cover the session you are in,** and it can lag by up to a minute.

## Development

```bash
claude plugin validate .
claude plugin test .
```

`hooks/tree.ts` builds the tree, `hooks/register.tsx` draws the panel and `hooks/strings.ts` holds the text in both languages.

## License

[MIT](LICENSE)
