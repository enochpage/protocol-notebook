# MVP verification — 2026-09-16

## Automated checks

- `npm test`: 9 domain tests passed. Covers optional page modules, configuration recall, dormant branches, edited parameter values, isolated drafts, immutable experiment snapshots, sibling references, missing references, selector leaves, ordered panels, and repeated experiments.
- `npm run build`: TypeScript and production frontend build passed.
- `cargo test`: 2 Rust tests passed. Covers Markdown round trips, reading external edits on open, interrupted transaction recovery, duplicate identifiers, and path traversal rejection.
- `tauri build --debug --bundles app`: standalone macOS application bundle built successfully.

## Interactive browser checks

Verified through the rendered interface:

- Save a result at 95 °C, change to 65 °C, observe the result disappear, return to 95 °C, and see the result return.
- Change a temperature through an inline protocol reference and observe the upper selector and expanded flowchart update together.
- Open a linked panel page; its empty parameter module has no map and its results remain optional.
- Create a project, edit a page title, create a nested page, add a panel and selector, and choose an option.
- Incomplete selectors prevent experiment recording.
- Type `/panel`, select an option, and render the corresponding clickable value in the protocol.
- Keep a result draft isolated to its configuration; switch away and return to recover it.
- Upload the project's own 128x128 PNG test icon, save an experiment, reload, and verify that the image still decodes at 128 pixels wide.
- No browser error or warning logs observed during the checked flows.

Browser QA data is isolated in the preview's IndexedDB notebook, under a clearly named MVP verification project and QA-labeled experiments.

## Native Mac checks

Opened the packaged `.app` at `tauri://localhost`. Changed the temperature through the native window and independently verified the selected ID in `data/vault/notebook.json`. Restored the demonstration default (95 °C), expanded the path map, and observed “Saved on this Mac.” Closed and reopened the app; the notebook and selections loaded successfully. The native notebook contains only the demonstration project, with no fabricated experimental results.

Screenshot: [Native notebook and expanded path](native-notebook.jpeg).

## Verification boundaries

No real engineering data was imported. No actual fabrication protocol was validated. The native image command was compiled; the full image upload/reload interaction was exercised in the browser preview. This is an MVP for local evaluation; external concurrent editing, force-kill durability, distribution signing, and synchronization are outside this verification.
