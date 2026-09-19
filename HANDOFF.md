# Protocol Notebook — shared development handoff

This is the shared working record for the user, Claude Code, and Codex. The code and current Git state are the implementation evidence; this document preserves decisions and continuity that are easy to lose between conversations.

## Current snapshot

- Last updated: **2026-09-18**, by Claude Code.
- Stage: functional local MVP plus a substantial editing overhaul on 2026-09-18, committed and pushed by the user. `main` and `origin/main` are level.
- Repository: [enochpage/protocol-notebook](https://github.com/enochpage/protocol-notebook) — public.
- Last published implementation: `f2676b8` on `main`. The overhaul went out as two commits: `5782931` for the code (`src/blocks.tsx` new, plus `components.tsx`, `App.tsx`, `Results.tsx`, `model.ts`, `App.css`, `tests/model.test.ts`, `src-tauri/tauri.conf.json`) and `f2676b8` for the documentation. The `interface-overhaul` branch they were made on can be deleted.
- `.claude/` stays untracked: it holds a local launch config and the humanizer skill, neither of which belongs to this project's source.
- Workspace: the actual local project folder is named `Notes_Taking`. Work in this checkout, not the separate synced ChatGPT project mirror. On another machine, use your own clone.
- The demo vault in `data/vault/` was deliberately regenerated on 2026-09-18 (user decision) and now carries four demonstration experiments. It is ignored by Git.
- No active implementation task is assigned. Ask for, or follow, the user's next requested improvement. The suggestions below are not an approved roadmap.

## What we are building

A local Mac notebook for daily engineering protocol optimization. The motivating example is lithography: keep one reusable procedure, choose materials and parameter values, and recall the experimental results for exactly that configuration.

The example lithography content demonstrates software behavior; it is not a validated fabrication procedure.

### Accepted decisions — preserve these

1. **One page model.** All pages are protocol-capable pages. Parameters and results can be left empty/disabled. No parameters means no flowchart.
2. **Projects and nested pages.** Pages can contain pages recursively. Metadata includes title, creation date, project, and custom properties.
3. **Panels are stages, not mutually exclusive choices.** Panels are ordered, nestable groups used unless skipped. Skipping a parent deactivates its descendants. Panels can contain panels, selectors, and notes. A note is prose written among the parameters; it never affects configuration identity (user decision, 2026-09-18).
4. **Selectors are leaves.** A parameter selector contains discrete options, chooses one option or is skipped, and cannot contain another selector.
5. **Two different title interactions.** In the upper parameter module, a panel title opens its linked page. In rendered protocol text, a panel reference opens a sibling-selection control instead.
6. **Shared live values.** Selecting a parameter through a protocol reference updates the upper selector and map too.
7. **Configuration-specific results.** Results and unfinished drafts belong to a page and its exact configuration. Returning to that configuration recalls them. Multiple experiments per configuration are supported.
8. **The captured snapshot is immutable; the written record is not.** Saving an experiment captures selected labels and the resolved protocol, and later template edits never rewrite them. The user's own name, observations, paths, and images on a saved experiment can be revised afterwards and carry an `editedAt` stamp (user decision, 2026-09-18).
9. **Map is generated, not a separate source of truth.** The right-side map starts at the highest panel tier and supports expanding, panning, and zooming. Stage arrows run vertically; selected parameter values branch horizontally.
10. **Local-first storage.** React provides the interface; Tauri/Rust provides the Mac shell and local storage bridge. Markdown remains the authoritative page text. No cloud service is required.

Implementation interpretation to review with the user: switching a sibling panel reference does **not** automatically skip/include sibling panels. Those inclusion controls remain independent. Do not silently change this behavior while implementing something else.

## Work completed

### Setup and design

- Chose Tauri + React + TypeScript + Vite for the Mac app.
- Created the dedicated local `Notes_Taking` project and registered it separately from the ChatGPT project mirror.
- Used existing Node/npm and Apple developer tools. Installed Rust/Cargo for the Mac user account after explicit approval, under `$HOME/.cargo/bin`, without changing shell startup files.
- Installed frontend/Tauri dependencies inside the project. Python/Miniconda is not part of this app's runtime.
- Refined the original idea with the user's corrections above before implementing the MVP.

### MVP implementation — completed by 2026-09-16

- Project sidebar, nested pages, editable page metadata, and page-title search.
- Colored nested panels, skip controls, discrete parameter selectors, and linked panel pages.
- Markdown editing/reading with tables, links, images, `/panel` and `/page` pickers, and interactive references.
- Configuration-specific drafts and experiment history, image attachments, path references, and saved protocol snapshots.
- Expandable/pannable/zoomable side map synchronized with selections.
- Native Markdown/JSON/image persistence, serialized saves, transaction recovery, preceding-save backup, and visible save status/errors.
- Independent IndexedDB storage for browser preview.
- Automated model/storage tests, interaction QA, and a packaged local debug Mac application.

### Interface overhaul — 2026-09-18, local and uncommitted

- Stylesheet tokenized; interface type raised to Notion/Obsidian sizes.
- Protocol, and result observations, edited as blocks with a `/` menu; no modes and no editor dependency.
- Parameter module gained notes, precise drag reordering, an automatic panel palette, and add-anywhere controls.
- Results scoped to the current configuration, with a vault-wide browser, editable records, and no experiment names.
- Map pans and opens full page; window default fits a 1470x956 display.
- Demo vault regenerated with four demonstration experiments.

### Repository

- Created the public GitHub repository and published the MVP as `7b9a554`.
- The remote uses HTTPS. Private notebook data, dependencies, and generated bundles are excluded from Git.
- No release binary, deployment, CI workflow, distribution signing, or license selection has been added.

## Architecture and important files

| File                        | Responsibility                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/model.ts`              | Types, tree operations, reference resolution, configuration/draft identity, experiment snapshots, demonstration data |
| `src/App.tsx`               | App shell, project/page navigation, metadata, dialogs, and page/reference actions                                    |
| `src/blocks.tsx`            | `BlockDocument`: the block editor used by the protocol and by result observations, plus Markdown/block conversion    |
| `src/components.tsx`        | Parameter module with notes and dragging, Markdown rendering with callouts, reference picker, images, and path map   |
| `src/Results.tsx`           | Configuration-specific drafts, the vault-wide experiment browser, editable records, and the path picker              |
| `src/useNotebook.ts`        | Loading, debounced serialized saves, save errors, and close-time flushing                                            |
| `src/storage.ts`            | Native command adapter and separate browser IndexedDB adapter                                                        |
| `src/App.css`               | Notebook layout, local fonts, colored panels, references, and map styling                                            |
| `src-tauri/src/lib.rs`      | Tauri startup, plugins, command registration, and native vault location                                              |
| `src-tauri/src/vault.rs`    | Validated filesystem operations, Markdown storage, assets, journal recovery, and backups                             |
| `src-tauri/tauri.conf.json` | Application/window configuration and content security policy                                                         |
| `tests/model.test.ts`       | TypeScript model regression tests                                                                                    |
| `docs/MVP.md`               | Detailed behavior, reference syntax, storage, and deliberate limits                                                  |
| `docs/qa/README.md`         | Dated verification evidence and its boundaries                                                                       |

### Data contracts to handle carefully

- Workspace schema is version 1: projects, pages, runs, drafts, and active page ID.
- Panels/selectors/options/pages have stable IDs. Display labels are not reference identifiers.
- Configuration identity includes ordered active nodes, explicit skip states, selected option IDs **and their labels**, plus reference bindings used by the protocol. Descendants of skipped panels are excluded.
- Page identity also scopes draft/result lookup. Editing an option's value must not recall an experiment recorded with the old value.
- Saved runs preserve resolved Markdown, the original template, selected labels, notes, paths, and attachment metadata. Preserve them when evolving the schema.
- Reference syntax is documented in docs/MVP.md; retain compatibility when changing the editor.
- Parameter nodes are panels, selectors, or `kind: "text"` notes. Notes are excluded from configuration identity, the path map, and the reference picker, so writing one can never detach a recorded result. Keep that exclusion if the node model grows.
- A saved run may carry an optional `editedAt`. Its written record (title, notes, paths, attachments) is editable; its `configuration`, `selections`, `protocol`, `template`, and `createdAt` are not. Experiments are no longer named on capture, and `runLabel()` derives a display label from the first written line, preferring `title` when an older record has one.

### Storage and safety

Native storage is in `data/vault/` in the source project used to build the application:

- `notebook.json`: structure and records; page bodies live separately.
- `pages/<page-id>.md`: authoritative Markdown bodies.
- `assets/`: copied images; originals are not modified.
- `transaction.json`: pending save for recovery on next load.
- `previous-save.json`: one preceding complete state, including Markdown; not a full backup system.

The native vault location is currently compiled from the source project path. The app bundle is not yet a portable distribution with a vault picker. Do not move/delete the source folder assuming the packaged app is fully independent of it.

Browser preview uses a separate `protocol-notebook-v1` IndexedDB database. Browser QA does not prove native filesystem behavior. Never publish either notebook's contents as development evidence without reviewing them for private data.

## Run and verify

Run commands from the repository root. Existing dependencies are already installed on the original Mac. For a fresh clone, follow README.md; do not install global tools without discussing scope with the user.

```sh
# Native app with live development updates
PATH="$HOME/.cargo/bin:$PATH" npm run tauri dev

# Browser-only preview: http://127.0.0.1:1420
npm run dev

# Automated checks
npm test
npm run build
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml

# Local development app bundle
PATH="$HOME/.cargo/bin:$PATH" npm run tauri build -- --debug --bundles app
```

Bundle output: `src-tauri/target/debug/bundle/macos/Protocol Notebook.app`. It does not require a running frontend development server. Avoid opening a packaged app and native development app simultaneously against the same vault.

Use a Node version compatible with the locked toolchain and the test command's direct TypeScript execution. Check installed versions before troubleshooting; do not assume older session version numbers are still current.

### Last application verification: 2026-09-16

Recorded in [docs/qa/README.md](docs/qa/README.md):

- 9 TypeScript domain tests passed.
- 2 Rust storage tests passed.
- TypeScript/production frontend build passed.
- Tauri debug Mac app bundle built.
- Browser interactions checked project/page creation, nested parameters, reference insertion, synchronized selections, incomplete-selector blocking, configuration-specific result recall/drafts, and saved image reload.
- Native packaged app checked selection persistence on disk and close/reopen recovery through the actual interface.

**Boundaries:** native image upload/reopen was not exercised end to end; that image interaction was checked in the browser only. Force-kill durability, external concurrent editing, signing, and synchronization were not verified. No real fabrication process was validated.

The interactive browser and native checks above are historical passes from 2026-09-16, not claims of fresh execution.

### Verification: 2026-09-18 (Claude Code)

Two rounds this day. Early in the day, on the unchanged `7b9a554` code with Node v26.7.0, npm 11.19.0 and cargo 1.98.1: `npm test` 9 passed, `npm run build` passed, `cargo test` 2 passed.

After the editing overhaul, repeatedly through the day and last at its end: `npx tsc --noEmit` clean, `npm test` 12 passed, `npm run build` passed. Browser QA at 1320x860 and 1180x820 covered the block editor, the `/` menu, notes among parameters, the results form and experiment browser, the full page map, and the responsive breakpoints.

Mac app QA, driven against a debug `.app` bundle through accessibility: dragged a panel above another and back, dragged a protocol block below a list and back, and saw the path map and the detached-results warning update. `cargo test` was not rerun after the overhaul; no Rust code changed.

**Boundaries.** The 2026-09-16 boundaries still stand, including the unverified native image upload/reopen path. The folder and file pickers have never been clicked, only type-checked. Keyboard selection inside the `/` menu was exercised through dispatched events because the browser pane delivers Return and arrow keys malformed. Browser QA cannot prove webview behavior: dragging was implemented twice, and the HTML5 version passed in the browser while doing nothing in the Mac app.

## Known limitations and potential next steps (optional)

These are discussion ideas, not must-do tasks, commitments, or a fixed sequence. The user chooses whether and when to pursue any of them. Do not implement this list automatically.

- A hands-on trial could help refine parameter/reference interactions, especially sibling reference selection versus panel inclusion.
- A native image upload/save/reopen check could close a gap in the existing verification.
- A user-chosen portable vault location with migration safeguards could make future distribution more practical.
- Independent backups, external-edit conflict handling, and quit/interruption checks could strengthen data protection.
- Inline marks are still Markdown while a block is open (bold reads as `**bold**`, a table is edited as raw pipes). True inline WYSIWYG would need an editor dependency, which the user declined on 2026-09-18.
- Clicking a rendered block places the caret at the end of it rather than at the clicked character.
- The `/` menu inside a parameter note offers only Panel and Selector, not the text block types.

Other current limits: result paths are text references, not validated/openable files; image uploads support PNG/JPEG/GIF/WebP up to 12 MB; panel and linked-page titles are independently editable; no page move/delete, project rename, full-text search, cloud sync, or multi-user editing.

## Switching between assistants

1. Finish or pause the current assistant before another edits the same checkout.
2. Start the other assistant in the actual repository directory.
3. Read `AGENTS.md`, this file, and the relevant code; inspect Git status/diff.
4. Work on the user's current task, preserving existing local changes.
5. Update the snapshot and append a session entry before stopping. Separate unfinished user-requested work from optional assistant suggestions. If interrupted during an approved task, record its resume point without turning unrelated ideas into requirements.
6. Use Git commits as code checkpoints. Review files before committing and publishing; never include the private vault. Do not push just because this document requests upkeep.

`CLAUDE.md` imports the shared instructions in `AGENTS.md`; Codex uses `AGENTS.md` directly. Both are directed to this same handoff instead of maintaining competing progress summaries. This is a cooperation workflow, not a guarantee that an assistant will follow every instruction. The user can explicitly ask it to update the handoff.

Reference: [Claude Code project instructions and imports](https://code.claude.com/docs/en/memory), [Codex repository instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

### Session entry format

```markdown
### YYYY-MM-DD — Assistant — Short task title

- Request:
- Changes and decisions:
- Verification actually run and outcome:
- Unverified or blocked:
- Git state / commit (if any):
- Remaining user-requested work (if any):
- Potential next steps (optional, not approved tasks):
```

## Session log

### 2026-09-16 — Codex — MVP and public repository

- Built the MVP summarized above and published implementation commit `7b9a554`.
- Verification: automated frontend/model/Rust checks, browser interaction QA, native selection save/reopen, and debug app packaging; see dated QA evidence.
- Unverified: native image interaction, interruption edge cases, and distribution readiness.
- Potential next step (optional): user evaluation and a scoped follow-up request.

### 2026-09-18 — Codex — Shared assistant handoff

- Request: document completed work so Claude Code and Codex can alternate and continue updating the same record.
- Added HANDOFF.md, shared AGENTS.md instructions, and a small CLAUDE.md entry point; linked them from README.md.
- Clarified in docs/MVP.md that selected option labels participate in configuration identity.
- Verification: compared the handoff with source, package scripts, Git state, and existing QA records; checked documentation formatting, local links, and whitespace.
- Application tests were not rerun for this documentation-only change. No application behavior or notebook data changed.
- Git state: documentation changes left local, uncommitted and unpushed.
- Potential next step (optional): continue in Claude Code using this repository and shared handoff when the user is ready.

### 2026-09-18 — Codex — Clarify optional future work

- Request: keep assistant-suggested next steps optional rather than treating them as mandatory future tasks.
- Updated shared instructions, the potential-next-steps section, and the session template to separate suggestions from explicitly requested work. Removed the implied ordered roadmap.
- Verification: reviewed the documentation changes and checked whitespace; no application code changed or application tests rerun.
- Git state: documentation changes remain local, uncommitted and unpushed.
- Remaining user-requested work: none for this documentation clarification. Future implementation requires a user request.

### 2026-09-18 — Claude Code — Baseline re-verification and documentation commit

- Request: run a current baseline check before taking on new work, and decide what is safe to publish versus keep local.
- Changes and decisions: no application code changed. Updated this handoff's snapshot and added the automated re-verification record below the historical QA section. Reviewed the pending documentation changes for private content and committed them; the private vault, build output, and dependencies stay excluded by `.gitignore`.
- Publishing rule applied: project documentation, shared assistant instructions, and this handoff are publishable. Notebook/vault contents (`data/`), build artifacts (`dist/`, `src-tauri/target/`, `src-tauri/gen/`), dependencies, local absolute paths, and machine configuration stay local. Future session entries must follow the same rule, since this handoff is published.
- Verification actually run and outcome: `npm test` 9 passed; `npm run build` passed; `cargo test` 2 passed. Scanned all pending documentation for absolute paths, personal identifiers, credentials, and vault content; none found. Confirmed `data/` is ignored and unstaged.
- Unverified or blocked: interactive browser QA, native packaged-app behavior, the Tauri bundle build, and the known native image upload/reopen gap were not exercised in this session.
- Git state / commit: documentation committed on `main`. Not pushed by this session; pushing awaits the user's go-ahead.
- Remaining user-requested work: none assigned. Awaiting the user's choice of next task.
- Potential next steps (optional, not approved tasks): the open sibling-reference versus panel-inclusion interpretation still needs the user's review through hands-on use; the native image upload/reopen check remains the clearest verification gap.

### 2026-09-18 — Claude Code — Interface overhaul: tokens, type, block editing, results

- Request: a series of interface improvements across one working day, each asked for in turn — design tokens and larger type; a full page protocol map; demonstration results; editable saved records; results scoped to the current configuration; a folder picker; drag reordering; Notion-style block editing for the protocol, the parameter module, and result observations; and a set of smaller corrections.
- Changes, styling: `src/App.css` now defines color, type scale and radius as tokens on `:root` and reads them through `var()` (133 of ~160 color literals and every font-size and radius replaced; 34 literals remain, mostly panel tone variants). Type runs 11-40px with interface text at 13-15px and body at 16px, matching Notion and Obsidian. Sidebar 262px, map rail 292px. Page property rows lost their leading icons.
- Changes, protocol editor: new `src/blocks.tsx` holds `BlockDocument`, which renders Markdown as blocks and edits one at a time with its markers stripped, so a heading is typed as text. Return starts a block, Backspace at the start of an empty one removes it, lists continue and end on an empty item, every block has an add button and a drag handle, and `/` opens a menu of seventeen block types. Callouts and foldable sections are written as `> [!note]` and `> [!toggle]`, parsed in `MarkdownView`, and stay ordinary blockquotes elsewhere. The old Read/Edit/Markdown toggle is gone. No editor dependency was added; the user chose that explicitly.
- Changes, parameters: added a third node kind, `kind: "text"` notes, which hold Markdown and take no part in configuration identity. Selectors are confined to panels; notes sit at either level. Panels take their color from `PALETTE` in creation order and the Add panel dialog no longer asks. Every node has a gutter with an add button (Return on the handle does the same) and a drag handle. `reorderSiblings()` takes an `after` flag so a drop inserts above or below rather than swapping. The selector count beside the heading is gone.
- Changes, results: the page section lists only the current configuration; a new All experiments modal browses the whole vault with configuration chips and search. Saved records are editable through `editRun()`, which stamps `editedAt` and leaves the captured configuration, selections, protocol and template untouched. Experiments are no longer named; `runLabel()` lists them by their first written line. The draft form is Observations (a `BlockDocument`) plus "Data saving path", which the Mac app fills from the system dialog through `@tauri-apps/plugin-dialog`.
- Changes, map and window: the map pans with the wheel and clamps to its content, opens full page from its heading, and unfolds every branch there. `.path-rail` needed `min-height: 0`, without which it grew to fit an unfolded map and pushed its own controls off screen. The window default went from 1440x980 to 1320x860 centered, because 980 was taller than this display and the bottom of the window sat off screen.
- Decisions taken with the user: amend accepted decision 8 so the captured snapshot stays immutable while the written record is editable; warn when a reorder detaches results rather than removing order from the configuration key; add text nodes to the parameter tree rather than merging parameters into the page body; regenerate the demo vault rather than edit it; and add no editor dependency.
- Two bugs worth remembering. The map problem was `min-height: auto` on a flex/grid child, not panning. The reorder problem was HTML5 drag and drop, which WKWebView does not deliver the way Chromium does; both drag surfaces now use pointer events with the drag state in refs, and `dragDropEnabled: false` was added to the window config. Browser QA passed the broken version, which is why dragging must be checked in the Mac app.
- Verification actually run and outcome: see the verification section above. In short, `npx tsc --noEmit` clean, `npm test` 12 passed (three new tests: editing a record keeps its snapshot, reordering stays within a parent, notes never change a configuration key), `npm run build` passed, browser QA through the day, and a Mac app check of both drag surfaces against a debug bundle.
- Unverified or blocked: the folder and file dialogs have never been clicked; `cargo test` was not rerun after the overhaul, though no Rust changed; the native image upload/reopen gap from 2026-09-16 is still open.
- Git state: committed in two commits (implementation `5782931`, documentation `f2676b8`), merged to `main` and pushed by the user. A debug `.app` sits in `src-tauri/target/debug/bundle/`, which Git ignores.
- Data note: the demo page's "Preparation" heading and paragraph are missing from the vault. They had already gone before the Mac app testing began, so they were removed during ordinary use rather than by a test. The user was offered a restore and has not answered.
- Remaining user-requested work: none outstanding.
- Potential next steps (optional, not approved tasks): dark mode, now that colors are tokenized and only one block needs writing; an editor dependency if inline WYSIWYG is wanted; mapping a click to a caret position inside a block; Markdown block types inside parameter notes.
