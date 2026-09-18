# Shared development instructions

This repository is Protocol Notebook, a Mac-first, local-first Tauri + React application.

## Start here

- Read [HANDOFF.md](HANDOFF.md) before continuing work. It contains the current status, accepted product decisions, verification history, and next-step candidates.
- Read [docs/MVP.md](docs/MVP.md) for behavior and storage details; inspect the relevant code before making changes.
- Check the current branch, Git status, and recent commits. Documentation is context, not proof that the current checkout still matches an older session.
- Follow the user's current request. A proposed task in the handoff is not authorization to implement it.
- Record assistant-suggested future work only as potential next steps, not mandatory tasks or a fixed sequence. Keep it separate from work explicitly requested by the user.
- Use one assistant at a time in a shared checkout. Concurrent work needs explicitly coordinated ownership or separate worktrees.

## Preserve the product and the user's data

- Every page uses the same model. Parameters and results are optional; do not introduce separate ordinary/protocol page types without approval.
- Panels are ordered, independently skippable groups. Selectors choose one option or skip; they contain only options.
- Preserve stable IDs, configuration-specific drafts/results, and immutable saved experiment snapshots. Changes to schema or configuration keys need a compatibility/migration plan and tests.
- Markdown files are the authoritative page bodies. Browser preview storage and native vault storage are independent.
- Never commit or upload personal notes, vault contents, result images, credentials, or local machine configuration. Keep `data/` and build output ignored.
- Do not overwrite existing Box source files. Work on local copies; finished Box outputs must use new filenames.
- Preserve unrelated working-tree changes. Never reset or discard the user's work.
- Explain dependency additions and their scope before installing them; obtain approval for new global/system installations.
- Do not run two native app instances against the same vault. Close the app before external Markdown edits.

## Verify and hand off

- For behavior changes, run the relevant checks listed in HANDOFF.md. For UI changes, exercise the actual interaction; for native persistence changes, verify the native app, not just the browser.
- Record what actually ran, its outcome, and anything not verified. Do not carry an old test pass forward as a new result.
- Before ending a substantive session, update the current snapshot in HANDOFF.md and append a dated session-log entry with changes, decisions, checks, unresolved user-requested work, and optional potential next steps.
- Keep HANDOFF.md concise and update docs/MVP.md when accepted behavior changes. Link detailed evidence instead of pasting transcripts.
- Updating documentation does not authorize publishing, pushing, deployment, or a broader feature change. Report uncommitted/unpushed work clearly.
