import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { flatten, refLabel, uid } from "./model";
import type { Page, ParameterNode, Panel, Workspace } from "./model";
import { loadAsset, native, saveAsset } from "./storage";

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m5 9 7 7 7-7" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    page: (
      <>
        <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    edit: (
      <>
        <path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1" />
        <path d="m3 17 6-6 5 5 3-3 4 4" />
      </>
    ),
    link: (
      <>
        <path
          d="m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
          transform="translate(1 0) scale(.9)"
        />
      </>
    ),
    map: (
      <>
        <rect x="8" y="2" width="8" height="5" rx="1" />
        <rect x="8" y="17" width="8" height="5" rx="1" />
        <path d="M12 7v10M12 12h8M18 10l2 2-2 2" />
      </>
    ),
    folder: <path d="M3 7V4h7l2 3h9v13H3z" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    flask: (
      <>
        <path d="M8 3h8M9 3v6l-6 10a1 1 0 0 0 1 2h16a1 1 0 0 0 1-2L15 9V3M7 15h10" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />
      </>
    ),
    skip: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m6 6 12 12" />
      </>
    ),
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 16v1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.page}
    </svg>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const selector =
      'button:not(:disabled),input,textarea,select,a[href],[tabindex="0"]';
    (
      el?.querySelector("[autofocus],input,textarea") as HTMLElement | null
    )?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const items = [...(el?.querySelectorAll<HTMLElement>(selector) || [])];
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      }
      if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function NameForm({
  label,
  initial = "",
  submit,
  close,
}: {
  label: string;
  initial?: string;
  submit: (name: string) => void;
  close: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) submit(name.trim());
      }}
    >
      <label className="field">
        {label}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={160}
        />
      </label>
      <div className="form-actions">
        <button type="button" className="quiet" onClick={close}>
          Cancel
        </button>
        <button className="primary" disabled={!name.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}
export function NodeForm({
  node,
  kind,
  save,
  close,
}: {
  node?: ParameterNode;
  kind: "panel" | "selector";
  save: (node: ParameterNode) => void;
  close: () => void;
}) {
  const [title, setTitle] = useState(node?.title || "");
  const [color, setColor] = useState(
    node?.kind === "panel" ? node.color : "blue",
  );
  const [options, setOptions] = useState(
    node?.kind === "selector"
      ? node.options
      : [
          { id: uid(), label: "" },
          { id: uid(), label: "" },
        ],
  );
  const valid =
    !!title.trim() && (kind === "panel" || options.some((o) => o.label.trim()));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const base = {
          id: node?.id || uid(),
          title: title.trim(),
          skipped: node?.skipped || false,
        };
        if (kind === "panel")
          save({
            ...base,
            kind,
            color,
            pageId: node?.kind === "panel" ? node.pageId : null,
            children: node?.kind === "panel" ? node.children : [],
          });
        else {
          const clean = options
            .filter((o) => o.label.trim())
            .map((o) => ({ ...o, label: o.label.trim() }));
          save({
            ...base,
            kind,
            options: clean,
            selectedId:
              node?.kind === "selector" &&
              clean.some((o) => o.id === node.selectedId)
                ? node.selectedId
                : null,
          });
        }
      }}
    >
      <label className="field">
        {kind === "panel" ? "Panel title" : "Selector title"}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          maxLength={160}
          placeholder={
            kind === "panel" ? "e.g. Surface preparation" : "e.g. Temperature"
          }
        />
      </label>
      {kind === "panel" ? (
        <>
          <label className="field">
            Color
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="blue">Slate blue</option>
              <option value="teal">Sea glass</option>
              <option value="amber">Amber</option>
              <option value="violet">Wisteria</option>
            </select>
          </label>
          <p className="muted">
            All included panels run in order. Add nested panels and selectors
            after creating this panel.
          </p>
        </>
      ) : (
        <>
          <label className="field">Parameter options</label>
          <p className="muted">
            One value at a time. Include units in the label, such as 95 °C.
          </p>
          <div className="option-edit-list">
            {options.map((option, index) => (
              <div key={option.id}>
                <input
                  aria-label={`Option ${index + 1}`}
                  value={option.label}
                  onChange={(e) =>
                    setOptions(
                      options.map((o) =>
                        o.id === option.id
                          ? { ...o, label: e.target.value }
                          : o,
                      ),
                    )
                  }
                  placeholder={index === 0 ? "65 °C" : "95 °C"}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() =>
                    setOptions(options.filter((o) => o.id !== option.id))
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setOptions([...options, { id: uid(), label: "" }])}
          >
            <Icon name="plus" size={14} />
            Add option
          </button>
        </>
      )}
      <div className="form-actions">
        <button type="button" className="quiet" onClick={close}>
          Cancel
        </button>
        <button className="primary" disabled={!valid}>
          {node ? "Save changes" : `Add ${kind}`}
        </button>
      </div>
    </form>
  );
}
export function AssetImage({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let resolved = "";
    loadAsset(id)
      .then((value) => {
        resolved = value;
        if (!disposed) setUrl(value);
        else if (value.startsWith("blob:")) URL.revokeObjectURL(value);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      if (resolved.startsWith("blob:")) URL.revokeObjectURL(resolved);
    };
  }, [id]);
  return failed ? (
    <span className="notice">Image unavailable: {alt}</span>
  ) : url ? (
    <img src={url} alt={alt} loading="lazy" />
  ) : (
    <span className="muted">Loading image…</span>
  );
}
export function MarkdownView({
  body,
  page,
  navigate,
  pick,
}: {
  body: string;
  page?: Page;
  navigate?: (id: string) => void;
  pick?: (id: string, type: string) => void;
}) {
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) =>
          /^asset:[a-zA-Z0-9_.-]+$/.test(url) ? url : defaultUrlTransform(url)
        }
        components={{
          a: ({ href = "", children }) => {
            if (href.startsWith("#ref:") && page && pick) {
              const [, id, type] = href.split(":");
              const label = refLabel(page, id, type);
              return (
                <button
                  className={`ref-chip ${label.includes("skipped") ? "ref-skipped" : ""}`}
                  onClick={() => pick(id, type)}
                  title="Change this reference"
                >
                  {label}
                  <Icon name="down" size={12} />
                </button>
              );
            }
            if (href.startsWith("#page:") && navigate)
              return (
                <button
                  className="page-inline"
                  onClick={() => navigate(href.slice(6))}
                >
                  <Icon name="page" size={14} />
                  {children}
                </button>
              );
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (native && /^https?:/.test(href)) {
                    e.preventDefault();
                    void openUrl(href).catch(() => {});
                  }
                }}
              >
                {children}
              </a>
            );
          },
          img: ({ src = "", alt = "" }) =>
            src.startsWith("asset:") ? (
              <AssetImage id={src.slice(6)} alt={alt} />
            ) : (
              <img src={src} alt={alt} loading="lazy" />
            ),
        }}
      >
        {body}
      </Markdown>
    </div>
  );
}
export function ReferencePicker({
  page,
  workspace,
  mode,
  insert,
}: {
  page: Page;
  workspace: Workspace;
  mode: "panel" | "page";
  insert: (id: string, title: string, type: string, option?: string) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <>
      <div className="search-field">
        <Icon name="search" />
        <input
          autoFocus
          aria-label="Find reference"
          placeholder={
            mode === "panel" ? "Find a panel or parameter…" : "Find a page…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="reference-list">
        {mode === "page"
          ? workspace.pages
              .filter((p) =>
                p.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => insert(p.id, p.title, "page")}
                >
                  <Icon name="page" />
                  <span>
                    {p.title}
                    <small>
                      {
                        workspace.projects.find(
                          (project) => project.id === p.projectId,
                        )?.title
                      }
                    </small>
                  </span>
                </button>
              ))
          : flatten(page.nodes)
              .filter(
                ({ node }) =>
                  node.title.toLowerCase().includes(search.toLowerCase()) ||
                  (node.kind === "selector" &&
                    node.options.some((o) =>
                      o.label.toLowerCase().includes(search.toLowerCase()),
                    )),
              )
              .map(({ node, depth }) => (
                <div key={node.id} style={{ paddingLeft: depth * 14 }}>
                  <button
                    onClick={() =>
                      insert(
                        node.id,
                        node.title,
                        node.kind === "panel" ? "value" : "title",
                      )
                    }
                  >
                    <Icon name={node.kind === "panel" ? "layers" : "more"} />
                    <span>
                      {node.title}
                      <small>
                        {node.kind === "panel"
                          ? "Panel reference"
                          : "Selector title"}
                      </small>
                    </span>
                  </button>
                  {node.kind === "selector" && (
                    <div className="reference-options">
                      <button
                        className="small-choice"
                        onClick={() =>
                          insert(node.id, refLabel(page, node.id), "value")
                        }
                      >
                        Current value ↗
                      </button>
                      {node.options.map((option) => (
                        <button
                          className="small-choice"
                          key={option.id}
                          onClick={() =>
                            insert(node.id, option.label, "value", option.id)
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
        {mode === "panel" && !page.nodes.length && (
          <p className="empty-copy">
            Add a panel or selector in the parameter module first.
          </p>
        )}
      </div>
    </>
  );
}
export function ParameterModule({
  page,
  update,
  add,
  edit,
  remove,
  openPanel,
}: {
  page: Page;
  update: (id: string, fn: (node: ParameterNode) => ParameterNode) => void;
  add: (kind: "panel" | "selector", parent: string | null) => void;
  edit: (node: ParameterNode) => void;
  remove: (node: ParameterNode) => void;
  openPanel: (panel: Panel) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () =>
      new Set(
        flatten(page.nodes)
          .filter(({ node }) => node.kind === "panel" && node.skipped)
          .map(({ node }) => node.id),
      ),
  );
  const render = (
    node: ParameterNode,
    inactive: boolean,
    inheritedColor = "blue",
  ): ReactNode => {
    const disabled = inactive || node.skipped;
    const color = node.kind === "panel" ? node.color : inheritedColor;
    return (
      <div
        key={node.id}
        id={`parameter-${node.id}`}
        className={`${node.kind}-block tone-${color} ${disabled ? "is-skipped" : ""}`}
      >
        <div className="parameter-heading">
          {node.kind === "panel" && (
            <button
              className="icon-button collapse-node"
              aria-label={`${collapsed.has(node.id) ? "Expand" : "Collapse"} ${node.title}`}
              aria-expanded={!collapsed.has(node.id)}
              onClick={() =>
                setCollapsed((s) => {
                  const next = new Set(s);
                  next.has(node.id) ? next.delete(node.id) : next.add(node.id);
                  return next;
                })
              }
            >
              <Icon
                name={collapsed.has(node.id) ? "chevron" : "down"}
                size={13}
              />
            </button>
          )}
          {node.kind === "panel" ? (
            <button
              className="panel-title"
              onClick={() => openPanel(node)}
              title={`Open ${node.title} page`}
            >
              {node.title}
              <span className="title-arrow">↗</span>
            </button>
          ) : (
            <span className="selector-title">{node.title}</span>
          )}
          <div className="node-actions">
            <button
              className={`skip-toggle ${node.skipped ? "skipped" : ""}`}
              disabled={inactive}
              aria-label={`${node.skipped ? "Include" : "Skip"} ${node.title}`}
              aria-pressed={node.skipped}
              onClick={() =>
                update(node.id, (n) => ({ ...n, skipped: !n.skipped }))
              }
            >
              {node.skipped ? "Skipped" : "Skip"}
            </button>
            <button
              className="icon-button"
              aria-label={`Edit ${node.title}`}
              onClick={() => edit(node)}
            >
              <Icon name="edit" size={13} />
            </button>
            <button
              className="icon-button remove-node"
              aria-label={`Remove ${node.title}`}
              onClick={() => remove(node)}
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        </div>
        {node.kind === "selector" ? (
          <div
            className="parameter-options"
            role="group"
            aria-label={node.title}
          >
            {node.options.map((option) => (
              <button
                key={option.id}
                disabled={disabled}
                className={`parameter-option ${option.id === node.selectedId ? "selected" : ""}`}
                aria-pressed={option.id === node.selectedId && !disabled}
                onClick={() =>
                  update(node.id, (n) =>
                    n.kind === "selector" ? { ...n, selectedId: option.id } : n,
                  )
                }
              >
                {option.id === node.selectedId && !disabled && (
                  <Icon name="check" size={12} />
                )}
                {option.label}
              </button>
            ))}
            {!node.selectedId && !disabled && (
              <span className="choose-hint">Choose a value</span>
            )}
          </div>
        ) : (
          !collapsed.has(node.id) && (
            <div className="panel-contents">
              {node.children.map((child) => render(child, disabled, color))}
              <div className="add-child">
                <button onClick={() => add("panel", node.id)}>
                  <Icon name="plus" size={12} />
                  Panel
                </button>
                <button onClick={() => add("selector", node.id)}>
                  <Icon name="plus" size={12} />
                  Selector
                </button>
              </div>
            </div>
          )
        )}
      </div>
    );
  };
  return (
    <div className="parameter-module">
      {page.nodes.map((node) => render(node, false))}
      {!page.nodes.length && (
        <p className="empty-copy">
          Add the stages and variables for this page. Leave this empty when you
          only need notes.
        </p>
      )}
      <div className="module-add">
        <button className="quiet" onClick={() => add("panel", null)}>
          <Icon name="plus" size={14} />
          Add panel
        </button>
        <button className="text-button" onClick={() => add("selector", null)}>
          Add selector
        </button>
      </div>
    </div>
  );
}
export function Editor({
  page,
  workspace,
  change,
  navigate,
  pick,
  setOption,
}: {
  page: Page;
  workspace: Workspace;
  change: (body: string) => void;
  navigate: (id: string) => void;
  pick: (id: string, type: string) => void;
  setOption: (id: string, option: string) => void;
}) {
  const [editing, setEditing] = useState(!page.body);
  const [picker, setPicker] = useState<"panel" | "page" | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const upload = useRef<HTMLInputElement>(null);
  const markSelection = () => {
    if (input.current)
      selection.current = {
        start: input.current.selectionStart,
        end: input.current.selectionEnd,
      };
  };
  const insert = (text: string) => {
    const { start, end } = selection.current;
    change(page.body.slice(0, start) + text + page.body.slice(end));
    setPicker(null);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(
        start + text.length,
        start + text.length,
      );
    });
  };
  return (
    <section className="section protocol-section">
      <div className="section-heading">
        <div>
          <span className="section-index">02</span>
          <h2>Protocol</h2>
        </div>
        <div className="segmented">
          <button
            className={!editing ? "active" : ""}
            onClick={() => setEditing(false)}
          >
            Read
          </button>
          <button
            className={editing ? "active" : ""}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        </div>
      </div>
      {editing ? (
        <>
          <div className="editor-tools">
            <span>Markdown</span>
            <button
              onClick={() => {
                markSelection();
                setPicker("panel");
              }}
            >
              /panel
            </button>
            <button
              onClick={() => {
                markSelection();
                setPicker("page");
              }}
            >
              /page
            </button>
            <button
              onClick={() => {
                markSelection();
                upload.current?.click();
              }}
            >
              <Icon name="photo" size={14} />
              Image
            </button>
          </div>
          <textarea
            ref={input}
            className="markdown-editor"
            aria-label="Protocol Markdown"
            value={page.body}
            placeholder={
              "# Procedure\n\nWrite your protocol. Type /panel to insert a variable."
            }
            onChange={(e) => {
              const value = e.target.value;
              change(value);
              const end = e.target.selectionStart;
              const match = value.slice(0, end).match(/\/(panel|page)$/);
              if (match) {
                selection.current = { start: end - match[0].length, end };
                setPicker(match[1] as "panel" | "page");
              }
            }}
          />
          <p className="editor-hint">
            References stay linked when names or selections change. ⌘S saves
            your notebook.
          </p>
        </>
      ) : page.body ? (
        <MarkdownView
          body={page.body}
          page={page}
          navigate={navigate}
          pick={pick}
        />
      ) : (
        <button className="empty-editor" onClick={() => setEditing(true)}>
          Start writing your protocol…
        </button>
      )}
      <input
        ref={upload}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Insert protocol image"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const id = await saveAsset(file);
            insert(`![${file.name.replace(/[\[\]]/g, "")}](asset:${id})`);
          } catch (err) {
            setError(String(err));
          }
          e.target.value = "";
        }}
      />
      {error && <p className="notice error">{error}</p>}
      {picker && (
        <Modal
          title={
            picker === "panel" ? "Insert a parameter reference" : "Link a page"
          }
          close={() => setPicker(null)}
        >
          <ReferencePicker
            page={page}
            workspace={workspace}
            mode={picker}
            insert={(id, title, type, option) => {
              if (option) setOption(id, option);
              insert(
                `[${title.replace(/[\[\]]/g, "")}](${type === "page" ? "#page:" + id : "#ref:" + id + ":" + type})`,
              );
            }}
          />
        </Modal>
      )}
    </section>
  );
}
export function PathMap({ page }: { page: Page }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const render = (node: ParameterNode, inactive = false): ReactNode => (
    <div
      className={`map-step ${inactive || node.skipped ? "map-skipped" : ""}`}
      key={node.id}
    >
      <div
        className={`map-node tone-${node.kind === "panel" ? node.color : "blue"}`}
      >
        <button
          className="map-label"
          onClick={() =>
            document
              .getElementById(`parameter-${node.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        >
          {node.kind === "panel" ? (
            <span className="map-dot" />
          ) : (
            <Icon name="more" size={13} />
          )}
          {node.title}
        </button>
        {node.kind === "panel" && node.children.length > 0 && (
          <button
            className="map-expand"
            aria-label={`${expanded.has(node.id) ? "Collapse" : "Expand"} ${node.title} in map`}
            onClick={() => toggle(node.id)}
          >
            {expanded.has(node.id) ? "−" : "+"}
          </button>
        )}
        {node.kind === "selector" && (
          <>
            <span className="horizontal-line" />
            <span className="map-value">
              {node.skipped || inactive
                ? "Skipped"
                : node.options.find((o) => o.id === node.selectedId)?.label ||
                  "Choose"}
            </span>
          </>
        )}
      </div>
      {node.kind === "panel" && expanded.has(node.id) && (
        <div className="map-children">
          {node.children.map((child) =>
            render(child, inactive || node.skipped),
          )}
        </div>
      )}
    </div>
  );
  return (
    <aside className="path-rail">
      <div className="map-heading">
        <span>
          <Icon name="map" size={16} />
          Protocol path
        </span>
        <span className="live-dot" title="Updates with your selections" />
      </div>
      <p className="map-subtitle">Your current configuration</p>
      <div
        className="map-viewport"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setPosition((p) => ({
              ...p,
              x: e.clientX - drag.current!.x,
              y: e.clientY - drag.current!.y,
            }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="map-world"
          style={
            {
              transform: `translate(${position.x}px, ${position.y}px) scale(${position.zoom})`,
            } as CSSProperties
          }
        >
          <div className="map-terminal">START</div>
          <div className="map-chain">
            {page.nodes.map((node) => render(node))}
          </div>
          <div className="map-terminal end">RECORD RESULTS</div>
        </div>
      </div>
      <div className="map-bottom">
        <div className="map-controls">
          <button
            aria-label="Zoom out"
            onClick={() =>
              setPosition((p) => ({ ...p, zoom: Math.max(0.4, p.zoom - 0.15) }))
            }
          >
            −
          </button>
          <button
            onClick={() => setPosition({ x: 0, y: 0, zoom: 1 })}
            aria-label="Reset map view"
          >
            {Math.round(position.zoom * 100)}%
          </button>
          <button
            aria-label="Zoom in"
            onClick={() =>
              setPosition((p) => ({ ...p, zoom: Math.min(2, p.zoom + 0.15) }))
            }
          >
            +
          </button>
        </div>
        <p>Drag to pan · + to unfold</p>
        <div className="map-legend">
          <span>
            <i />
            Included
          </span>
          <span>
            <i className="skipped-dot" />
            Skipped
          </span>
        </div>
      </div>
    </aside>
  );
}
