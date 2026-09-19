import { useRef, useState } from "react";
import {
  configuration,
  createRun,
  draftKey,
  editRun,
  emptyDraft,
  resolveProtocol,
  runLabel,
} from "./model";
import type { Draft, Page, Run, Workspace } from "./model";
import { AssetImage, Icon, MarkdownView, Modal } from "./components";
import { BlockDocument } from "./blocks";
import { native, saveAsset } from "./storage";

// The Mac app picks paths with the system dialog; the browser preview types them.
function PathField({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const choose = async (directory: boolean) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const chosen = await open({
        directory,
        multiple: false,
        title: directory ? "Choose a folder" : "Choose a file",
      });
      if (typeof chosen !== "string") return;
      const existing = value.replace(/\s+$/, "");
      onChange(existing ? `${existing}\n${chosen}` : chosen);
    } catch (err) {
      onError(String(err));
    }
  };
  return (
    <div className="field path-field">
      <div className="field-heading">
        <label htmlFor="result-paths">Data saving path</label>
        {native && (
          <span className="field-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => choose(true)}
            >
              <Icon name="folder" size={14} />
              Choose folder
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => choose(false)}
            >
              <Icon name="page" size={14} />
              Choose file
            </button>
          </span>
        )}
      </div>
      <textarea
        id="result-paths"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={
          native
            ? "Choose a folder or file above, or paste a path or link"
            : "Paste a local file path or web link, one per line"
        }
      />
    </div>
  );
}
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
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<Run | null>(null);
  const [revision, setRevision] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [insertion, setInsertion] = useState<{
    text: string;
    token: number;
  } | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const revisionUpload = useRef<HTMLInputElement>(null);
  const inline = useRef<HTMLInputElement>(null);
  const change = (patch: Partial<Draft>) =>
    update((w) => ({
      ...w,
      drafts: {
        ...w.drafts,
        [key]: { ...(w.drafts[key] || emptyDraft()), ...patch },
      },
    }));
  const vault = [...workspace.runs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const found = vault.filter((run) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return [run.title, run.pageTitle, run.notes, ...run.selections]
      .join(" ")
      .toLowerCase()
      .includes(text);
  });
  const closeRecord = () => {
    setView(null);
    setRevision(null);
  };
  const saveRevision = () => {
    if (!view || !revision) return;
    const revised = editRun(view, revision);
    update((w) => ({
      ...w,
      runs: w.runs.map((run) => (run.id === view.id ? revised : run)),
    }));
    setView(revised);
    setRevision(null);
  };
  return (
    <section className="section results-section">
      <div className="section-heading">
        <div>
          <span className="section-index">03</span>
          <h2>Results</h2>
          <span className="count-badge">{runs.length}</span>
        </div>
        <div className="heading-actions">
          <button className="text-button" onClick={() => setBrowsing(true)}>
            <Icon name="clock" size={14} />
            All experiments
            {workspace.runs.length > 0 && (
              <span className="count-badge">{workspace.runs.length}</span>
            )}
          </button>
          <button
            className="quiet"
            disabled={!!config.missing.length}
            onClick={() => setRecording((v) => !v)}
          >
            <Icon name="plus" size={14} />
            Record experiment
          </button>
        </div>
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
          {!recording && !runs.length && (
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
              <div className="field">
                <label>Observations</label>
                <BlockDocument
                  value={draft.notes}
                  change={(notes) => change({ notes })}
                  offer={["link", "image", "page"]}
                  onAction={(action) => {
                    if (action === "image") upload.current?.click();
                  }}
                  insertion={insertion}
                  placeholder="What happened? Type / for blocks."
                />
              </div>
              <PathField
                value={draft.paths}
                onChange={(paths) => change({ paths })}
                onError={setError}
              />
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
            {runs.map((run) => (
              <button
                key={run.id}
                className="run-card"
                onClick={() => setView(run)}
              >
                <span className="run-icon">
                  <Icon name="flask" size={17} />
                </span>
                <span>
                  <strong>{runLabel(run)}</strong>
                  <small>
                    {new Date(run.createdAt).toLocaleString()} ·{" "}
                    {run.attachments.length} images
                  </small>
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
        <p className="muted history-note">
          {total - runs.length}{" "}
          {total - runs.length === 1 ? "experiment" : "experiments"} on this
          page
          {total - runs.length === 1 ? " belongs" : " belong"} to other
          configurations. Open All experiments to see them.
        </p>
      )}
      <input
        ref={inline}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Insert an image into the observations"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          try {
            const id = await saveAsset(file);
            setInsertion({
              text: `![${file.name.replace(/[\[\]]/g, "")}](asset:${id})`,
              token: Date.now(),
            });
          } catch (err) {
            setError(String(err));
          } finally {
            setUploading(false);
          }
          e.target.value = "";
        }}
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {view && (
        <Modal title={runLabel(view)} close={closeRecord} wide>
          <div className="run-date">
            {new Date(view.createdAt).toLocaleString()} · {view.pageTitle}
            {view.editedAt && (
              <> · edited {new Date(view.editedAt).toLocaleString()}</>
            )}
          </div>
          <div className="snapshot-label">Saved configuration</div>
          <div className="snapshot-options">
            {view.selections.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </div>
          {revision ? (
            <>
              <div className="field">
                <label>Observations</label>
                <BlockDocument
                  value={revision.notes}
                  change={(notes) => setRevision({ ...revision, notes })}
                  offer={["link", "image", "page"]}
                  onAction={(action) => {
                    if (action === "image") inline.current?.click();
                  }}
                  insertion={insertion}
                  placeholder="What happened? Type / for blocks."
                />
              </div>
              <PathField
                value={revision.paths}
                onChange={(paths) => setRevision({ ...revision, paths })}
                onError={setError}
              />
              <div className="attachment-grid">
                {revision.attachments.map((asset) => (
                  <div key={asset.id} className="attachment">
                    <AssetImage id={asset.id} alt={asset.name} />
                    <span>{asset.name}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove image ${asset.name}`}
                      onClick={() =>
                        setRevision({
                          ...revision,
                          attachments: revision.attachments.filter(
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
                  onClick={() => revisionUpload.current?.click()}
                >
                  <Icon name="photo" size={15} />
                  {uploading ? "Copying image…" : "Add image"}
                </button>
                <span className="spacer" />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRevision(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={uploading}
                  onClick={saveRevision}
                >
                  Save changes
                </button>
              </div>
              <p className="muted">
                The selections and protocol above were captured when the
                experiment was saved and stay as they are.
              </p>
              <input
                ref={revisionUpload}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Attach an image to this experiment"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const id = await saveAsset(file);
                    setRevision((current) =>
                      current
                        ? {
                            ...current,
                            attachments: [
                              ...current.attachments,
                              { id, name: file.name },
                            ],
                          }
                        : current,
                    );
                  } catch (err) {
                    setError(String(err));
                  } finally {
                    setUploading(false);
                  }
                  e.target.value = "";
                }}
              />
            </>
          ) : (
            <>
              <div className="record-heading">
                <h3>Observations</h3>
                <button
                  className="text-button"
                  onClick={() =>
                    setRevision({
                      title: "",
                      notes: view.notes,
                      paths: view.paths,
                      attachments: [...view.attachments],
                    })
                  }
                >
                  <Icon name="edit" size={14} />
                  Edit record
                </button>
              </div>
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
            </>
          )}
        </Modal>
      )}
      {browsing && (
        <Modal
          title="All experiments"
          close={() => {
            setBrowsing(false);
            setQuery("");
          }}
          wide
        >
          <div className="search-field">
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, page, notes, or selection…"
              aria-label="Search experiments"
            />
          </div>
          <div className="run-list">
            {found.map((run) => (
              <button
                key={run.id}
                className="run-card"
                onClick={() => {
                  setBrowsing(false);
                  setView(run);
                }}
              >
                <span className="run-icon">
                  <Icon name="flask" size={17} />
                </span>
                <span>
                  <strong>{runLabel(run)}</strong>
                  <small>
                    {run.pageTitle} · {new Date(run.createdAt).toLocaleString()}
                    {run.editedAt && " · edited"}
                  </small>
                  <span className="run-selections">
                    {run.selections.map((item, index) => (
                      <span key={index}>{item}</span>
                    ))}
                  </span>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
          {!found.length && (
            <p className="muted">
              {vault.length
                ? "No experiment matches that search."
                : "No experiments recorded yet. Complete a configuration and record one."}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
