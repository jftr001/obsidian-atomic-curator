# Atomic Curator

> Turn raw highlights and messy notes into clean, self-contained **atomic notes** — with AI, following Zettelkasten principles. For [Obsidian](https://obsidian.md).

<!--
  GIF GOES HERE. Record a ~15s screen capture in Obsidian:
  1. Open a note full of book highlights.
  2. Run "Curate active note into atomic notes".
  3. Show the preview modal, then the new atomic notes appearing.
  Save it as assets/demo.gif and the line below will display it.
-->
![Atomic Curator demo](assets/demo.gif)

---

Most AI note plugins **chat** with your notes. Atomic Curator does the opposite job: it **curates**. You paste in a pile of book highlights or messy meeting notes, and it gives you back a set of true atomic notes — one idea each, self-contained, with a declarative title — ready to drop into your Zettelkasten.

## Why

Highlighting is easy. Turning highlights into notes you'll actually reuse is the hard, slow part of personal knowledge management. Atomic Curator does the mechanical part of that work so you can focus on thinking:

- **One idea per note.** A passage with three ideas becomes three notes.
- **Declarative titles.** Titles are full sentences that state the claim (`Spaced repetition beats massed practice for retention.`) — not vague topics (`Spaced repetition`).
- **Rewritten, not copied.** Bodies are restated in clear prose, not pasted verbatim.
- **You stay in control.** Every note is shown in a preview before anything is written. Uncheck what you don't want.

## Features

- ✅ Curate the active note into atomic notes with one command.
- ✅ Preview-and-pick modal — nothing is created without your approval.
- ✅ Auto-suggested tags (optional) and back-links to the source note.
- ✅ Bring your own Anthropic API key — no middle-man server, no subscription.
- ✅ Choose your model: Haiku (fast/cheap), Sonnet (balanced), or Opus (best).
- ✅ Custom instructions field — enforce your own naming or language conventions.

## How it works

1. Open a note containing raw highlights or messy text.
2. Run **Curate active note into atomic notes** (command palette, or the atom icon in the ribbon).
3. Review the proposed atomic notes in the preview modal and uncheck any you don't want.
4. Click **Create** — each selected note is written as its own file in your output folder.

## Installation

### From the Community Plugins store
*Pending review — coming soon.*

### Via BRAT (test it now)
1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. In BRAT, **Add Beta Plugin** → `juanftrx/obsidian-atomic-curator`.
3. Enable **Atomic Curator** in Community Plugins.

### Manual
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases).
2. Copy them into `<your vault>/.obsidian/plugins/atomic-curator/`.
3. Reload Obsidian and enable the plugin.

## Setup

Open **Settings → Atomic Curator** and paste your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com)). Pick a model and an output folder, and you're ready.

## Privacy

Your API key is stored locally in your vault and is **only** sent to Anthropic to perform curation. The plugin has no server and collects nothing. Note that the content of the note you curate is sent to Anthropic's API as the input to be processed.

## Roadmap

Atomic Curator started as a personal curation system. Planned next:

- **MOC reconciliation** — place new atomic notes into the right Map of Content automatically.
- **Note audit** — scan a folder of notes for atomicity, title quality, and duplicates.
- **Pedagogical summaries** — generate a teaching summary from a cluster of notes.

## Contributing

Issues and PRs welcome. To build locally:

```bash
npm install
npm run dev      # watch mode
npm run build    # production build
```

## License

[MIT](LICENSE)
