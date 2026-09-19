# Protocol notebook MVP

## Agreed behavior

Every page uses one model. Parameters and results are optional. An empty parameter module has no path map. Projects contain pages with arbitrary nesting.

Panels are ordered, nestable groups; each can be skipped, which deactivates all descendants. Selectors are leaves with discrete options, one selected value, and a skip control. They cannot contain other selectors. A panel title in the parameter module opens a linked page (created on first opening). In rendered text, a panel reference opens a sibling-selection control instead. Changing that reference does not silently change unrelated panel inclusion.

Markdown reference syntax:

- `[Display label](#ref:node-id:value)` follows a selected value or panel reference.
- `[Display label](#ref:node-id:title)` references the selector/panel title.
- `[Page title](#page:page-id)` navigates to another page.
- `![Image description](asset:image-id.png)` embeds an image stored with the notebook.

IDs remain stable when labels change. Results are grouped by page, ordered active nodes, skip states, selected option IDs and labels, and references used in the protocol. Changing an option's value therefore does not recall results recorded for its previous value. Descendants of skipped panels are excluded. Drafts use the same grouping key. Saving an experiment captures parameter labels and resolved Markdown that never change afterwards; editing the template does not rewrite history, and older template snapshots are labeled. The written record of an experiment (name, observations, file paths, images) can be revised later from the record view, which stamps `editedAt` and leaves the captured configuration and protocol untouched.

The Results section on a page lists only the experiments recorded for the configuration currently selected. Everything recorded anywhere in the vault is reached through All experiments, which searches by name, page, notes, or selection and shows each record's captured configuration.

## Storage

The Mac MVP uses `data/vault` within this project. `notebook.json` stores structure and experiment records. `pages/<page-id>.md` stores each page's authoritative Markdown body. `assets/` stores copied images. Original source images are not modified.

Writes are serialized and journaled. `transaction.json` allows interrupted multi-file saves to finish on the next launch. `previous-save.json` contains the preceding complete notebook, including Markdown. The window waits for pending saves before closing. A visible save error keeps the window open.

The browser preview uses a separate IndexedDB notebook. It is clearly labeled and does not access or synchronize with the native vault. Use the Mac app for the actual notebook.

## Deliberate MVP limits

- The protocol is one editable surface with no modes. Click a block to edit it, Return starts a new block, Backspace at the start of an empty block removes it, and every block has a gutter with an add button and a drag handle. A block is edited without its Markdown markers, so a heading is typed as plain text. Inline marks (bold, links, references) remain Markdown inside the block being edited. `/` opens the block menu: text, heading, subheading, small heading, bulleted list, numbered list, checklist, quote, callout, warning callout, foldable section, code snippet, table, divider, link, image, parameter reference, page link. A callout is `> [!note] text` and a foldable section is `> [!toggle] title`, so both stay ordinary blockquotes in any other Markdown tool. `src/blocks.tsx` holds this editor and the Markdown/block conversion. Blocks are separated by blank lines; a fenced code block stays whole. Saving from Edit normalizes blank lines between blocks.
- Edit Markdown externally only while the app is closed; live external-change merging is not implemented.
- Local paths in results are stored as text references; existence checking and opening them are not implemented.
- Uploaded images: PNG, JPEG, WebP, GIF, up to 12 MB each. General binary attachments are represented by file paths.
- Each panel links to its own page; panel title and page title can be edited independently.
- No cloud sync, multi-user editing, true inline WYSIWYG (block markers are hidden while editing, but inline marks such as `**bold**` are not), page moves/deletion, project rename, or full-text search yet. Sidebar search finds page titles.
- The development vault path is tied to this project. Choosing portable vault folders is a later step before distribution.
- Existing snapshots are preserved; the preceding-save backup is not a substitute for independent backups.

## Design

For engineering protocol work: a restrained instrument-notebook layout, blue-gray navigation, white writing surface, nested blue/teal/amber/violet parameter bands, and matching live references. Avenir Next headings, system body text, and monospaced data annotations use local fonts. The colored parameter sequence and foldable side map are the visual signature.

Color, type, and radius values are defined once as custom properties on `:root` in `src/App.css` and referenced through `var()`. The type scale runs 11px to 40px: interface text sits at 13-15px and page body text at 16px, matching the defaults used by Notion and Obsidian. New styles should use a token rather than a literal value.

The parameter module holds three kinds of node: panels, selectors, and notes. A note is free Markdown text written directly in the module; click it to edit, and type `/` inside it to insert a panel or a selector after it. A selector can only be created inside a panel; notes and panels can sit at either level. Every node's gutter has an add button that starts a note below it, and Return on a drag handle does the same. Panels take their color from a fixed palette in creation order. Notes take no part in configuration identity, so writing or editing one never detaches a recorded result. They are also left out of the path map and the reference picker.

Panels, selectors, and notes are reordered by dragging their handle onto the upper or lower half of another node, which inserts above or below it, or by focusing the handle and pressing the arrow keys. Dragging is implemented with pointer events rather than HTML5 drag and drop, because the Mac app's WKWebView does not deliver the HTML5 drag events; anything new that drags should follow the same approach and be checked in the Mac app, not only in the browser preview. Reordering happens among siblings only, because nesting and order are part of a configuration's identity. Reordering therefore changes which recorded results match the current configuration, exactly as editing a selection does. When a reorder detaches results, the parameter section says how many and where to find them.

Recording an experiment asks for observations and a data saving path; experiments are not named, and a record is listed by its first written line. Observations are edited with the same block editor as the protocol, minus parameter references. In the Mac app, the data saving path is chosen with the system dialog. The browser preview has no dialog and types them instead.

The seeded demonstration workspace includes four example experiments: two on the default selections and two on other configurations, so the configuration-specific recall is visible without recording anything first.

The side map pans with the scroll wheel or by dragging, and the view is clamped so content cannot be lost off an edge. It opens full page from the control in its heading. The full page view unfolds every branch, keeps the same pan and zoom, and closes with its Close button, with Escape, or by clicking a node, which returns to the page and scrolls to that parameter. Folding state is shared between the rail and the full page view.
