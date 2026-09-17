import { useRef, useState } from "react";
import {
  configuration,
  createRun,
  draftKey,
  emptyDraft,
  resolveProtocol,
} from "./model";
import type { Draft, Page, Run, Workspace } from "./model";
import { AssetImage, Icon, MarkdownView, Modal } from "./components";
import { saveAsset } from "./storage";

export function Results({
  page,
  workspace,
  update,
}: {
  page: Page;
  workspace: Workspace;
  update: (fn: (w: Workspace) => Workspace) => void;
}) {
  const config = configuration(page);
  const key = draftKey(page);
  const draft = workspace.drafts[key] || emptyDraft();
  const runs = workspace.runs.filter(
    (run) => run.pageId === page.id && run.configuration === config.key,
  );
  const total = workspace.runs.filter((run) => run.pageId === page.id).length;
  const [recording, setRecording] = useState(!!workspace.drafts[key]);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const change = (patch: Partial<Draft>) =>
    update((w) => ({
      ...w,
      drafts: {
        ...w.drafts,
        [key]: { ...(w.drafts[key] || emptyDraft()), ...patch },
      },
    }));
  const displayed = showAll
    ? workspace.runs.filter((run) => run.pageId === page.id)
    : runs;
  return (
    <section className="section results-section">
      <div className="section-heading">
        <div>
          <span className="section-index">03</span>
          <h2>Results</h2>
          <span className="count-badge">{runs.length}</span>
        </div>
        <button
          className="quiet"
          disabled={!!config.missing.length}
          onClick={() => setRecording((v) => !v)}
        >
          <Icon name="plus" size={14} />
          Record experiment
        </button>
      </div>
      <div className="configuration-state">
        <span className={config.missing.length ? "pending-dot" : "live-dot"} />
        <span>
          {config.missing.length
            ? `Choose values for: ${config.missing.join(", ")}`
            : "Configuration complete"}
          <small>
            {config.missing.length
              ? "Complete or skip each active selector to record results."
              : `${runs.length} ${runs.length === 1 ? "experiment matches" : "experiments match"} these selections`}
          </small>
        </span>
      </div>
      {!config.missing.length && (
        <>
          {!recording && !runs.length && !showAll && (
            <div className="empty-results">
              <Icon name="flask" size={25} />
              <div>
                <h3>A new combination to explore</h3>
                <p>
                  Add observations, images, or file paths. They will return
                  whenever you choose this configuration.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => setRecording(true)}
              >
                Record the first experiment
                <Icon name="arrow" size={14} />
              </button>
            </div>
          )}
          {recording && (
            <form
              className="experiment-form"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const run = createRun(page, draft);
                  update((w) => {
                    const drafts = { ...w.drafts };
                    delete drafts[key];
                    return { ...w, drafts, runs: [run, ...w.runs] };
                  });
                  setRecording(false);
                  setError("");
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <div className="draft-label">
                <Icon name="edit" size={13} />
                Draft for this configuration · saved automatically
              </div>
              <label className="field">
                Experiment name
                <input
                  value={draft.title}
                  onChange={(e) => change({ title: e.target.value })}
                  placeholder="e.g. First exposure trial"
                />
              </label>
              <label className="field">
                Observations
                <textarea
                  value={draft.notes}
                  onChange={(e) => change({ notes: e.target.value })}
                  rows={5}
                  placeholder="What happened? What would you change next? Markdown supported."
                />
              </label>
              <label className="field">
                File or folder paths
                <textarea
                  value={draft.paths}
                  onChange={(e) => change({ paths: e.target.value })}
                  rows={2}
                  placeholder="Paste a local file path or web link, one per line"
                />
              </label>
              <div className="attachment-grid">
                {draft.attachments.map((asset) => (
                  <div key={asset.id} className="attachment">
                    <AssetImage id={asset.id} alt={asset.name} />
                    <span>{asset.name}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove image ${asset.name}`}
                      onClick={() =>
                        change({
                          attachments: draft.attachments.filter(
                            (a) => a.id !== asset.id,
                          ),
                        })
                      }
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="quiet"
                  disabled={uploading}
                  onClick={() => upload.current?.click()}
                >
                  <Icon name="photo" size={15} />
                  {uploading ? "Copying image…" : "Add image"}
                </button>
                <span className="spacer" />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRecording(false)}
                >
                  Close draft
                </button>
                <button className="primary" disabled={uploading}>
                  Save experiment
                </button>
              </div>
              <input
                ref={upload}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Attach result image"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const id = await saveAsset(file);
                    update((w) => ({
                      ...w,
                      drafts: {
                        ...w.drafts,
                        [key]: {
                          ...(w.drafts[key] || emptyDraft()),
                          attachments: [
                            ...(w.drafts[key]?.attachments || []),
                            { id, name: file.name },
                          ],
                        },
                      },
                    }));
                  } catch (err) {
                    setError(String(err));
                  } finally {
                    setUploading(false);
                  }
                  e.target.value = "";
                }}
              />
            </form>
          )}
          <div className="run-list">
            {displayed.map((run) => (
              <button
                key={run.id}
                className="run-card"
                onClick={() => setView(run)}
              >
                <span className="run-icon">
                  <Icon name="flask" size={17} />
                </span>
                <span>
                  <strong>{run.title || "Untitled experiment"}</strong>
                  <small>
                    {new Date(run.createdAt).toLocaleString()} ·{" "}
                    {run.attachments.length} images
                  </small>
                  {run.configuration !== config.key && (
                    <small className="other-config">
                      Different configuration
                    </small>
                  )}
                  {(run.template !== page.body ||
                    run.protocol !== resolveProtocol(page)) && (
                    <small className="other-config">
                      Earlier protocol snapshot
                    </small>
                  )}
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        </>
      )}
      {total > runs.length && !config.missing.length && (
        <button
          className="text-button history-toggle"
          onClick={() => setShowAll((v) => !v)}
        >
          <Icon name="clock" size={14} />
          {showAll
            ? "Show only this configuration"
            : `Browse all ${total} experiments on this page`}
        </button>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {view && (
        <Modal
          title={view.title || "Experiment record"}
          close={() => setView(null)}
          wide
        >
          <div className="run-date">
            {new Date(view.createdAt).toLocaleString()} · {view.pageTitle}
          </div>
          <div className="snapshot-label">Saved configuration</div>
          <div className="snapshot-options">
            {view.selections.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </div>
          <h3>Observations</h3>
          <MarkdownView body={view.notes || "*No written observations.*"} />
          <div className="attachment-grid">
            {view.attachments.map((asset) => (
              <figure key={asset.id}>
                <AssetImage id={asset.id} alt={asset.name} />
                <figcaption>{asset.name}</figcaption>
              </figure>
            ))}
          </div>
          {view.paths && (
            <>
              <h3>File references</h3>
              <pre className="file-paths">{view.paths}</pre>
              <p className="muted">
                Paths are references to the original files; images above are
                stored with the notebook.
              </p>
            </>
          )}
          <details className="snapshot-protocol">
            <summary>View the exact protocol used</summary>
            <MarkdownView body={view.protocol} />
          </details>
        </Modal>
      )}
    </section>
  );
}
