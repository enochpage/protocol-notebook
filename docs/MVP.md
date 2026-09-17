# Protocol notebook MVP

## Agreed behavior

Every page uses one model. Parameters and results are optional. An empty parameter module has no path map. Projects contain pages with arbitrary nesting.

Panels are ordered, nestable groups; each can be skipped, which deactivates all descendants. Selectors are leaves with discrete options, one selected value, and a skip control. They cannot contain other selectors. A panel title in the parameter module opens a linked page (created on first opening). In rendered text, a panel reference opens a sibling-selection control instead. Changing that reference does not silently change unrelated panel inclusion.

Markdown reference syntax:

- `[Display label](#ref:node-id:value)` follows a selected value or panel reference.
- `[Display label](#ref:node-id:title)` references the selector/panel title.
- `[Page title](#page:page-id)` navigates to another page.
- `![Image description](asset:image-id.png)` embeds an image stored with the notebook.

IDs remain stable when labels change. Results are grouped by page, ordered active nodes, skip states, selected option IDs, and references used in the protocol. Descendants of skipped panels are excluded. Drafts use the same grouping key. Saving an experiment captures immutable parameter labels and resolved Markdown; changing the template does not rewrite history. Older template snapshots are labeled.

## Storage

The Mac MVP uses `data/vault` within this project. `notebook.json` stores structure and experiment records. `pages/<page-id>.md` stores each page's authoritative Markdown body. `assets/` stores copied images. Original source images are not modified.

Writes are serialized and journaled. `transaction.json` allows interrupted multi-file saves to finish on the next launch. `previous-save.json` contains the preceding complete notebook, including Markdown. The window waits for pending saves before closing. A visible save error keeps the window open.

The browser preview uses a separate IndexedDB notebook. It is clearly labeled and does not access or synchronize with the native vault. Use the Mac app for the actual notebook.

## Deliberate MVP limits

- Markdown editing and rendered interactive reading are separate modes.
- Edit Markdown externally only while the app is closed; live external-change merging is not implemented.
- Local paths in results are stored as text references; existence checking and opening them are not implemented.
- Uploaded images: PNG, JPEG, WebP, GIF, up to 12 MB each. General binary attachments are represented by file paths.
- Each panel links to its own page; panel title and page title can be edited independently.
- No cloud sync, multi-user editing, rich-text WYSIWYG, page moves/deletion, project rename, or full-text search yet. Sidebar search finds page titles.
- The development vault path is tied to this project. Choosing portable vault folders is a later step before distribution.
- Existing snapshots are preserved; the preceding-save backup is not a substitute for independent backups.

## Design

For engineering protocol work: a restrained instrument-notebook layout, blue-gray navigation, white writing surface, nested blue/teal/amber/violet parameter bands, and matching live references. Avenir Next headings, system body text, and monospaced data annotations use local fonts. The colored parameter sequence and foldable side map are the visual signature.
