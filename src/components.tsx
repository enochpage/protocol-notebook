import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { flatten, nodeTitle, refLabel, uid } from "./model";
import { BlockDocument } from "./blocks";
import type { Page, ParameterNode, Panel, Selector, Workspace } from "./model";
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
    grip: (
      <>
        <circle cx="9" cy="6" r="1.4" />
        <circle cx="15" cy="6" r="1.4" />
        <circle cx="9" cy="12" r="1.4" />
        <circle cx="15" cy="12" r="1.4" />
        <circle cx="9" cy="18" r="1.4" />
        <circle cx="15" cy="18" r="1.4" />
      </>
    ),
    expand: (
      <>
        <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
      </>
    ),
    shrink: (
      <>
        <path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5" />
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
  node?: Panel | Selector;
  kind: "panel" | "selector";
  save: (node: ParameterNode) => void;
  close: () => void;
}) {
  const [title, setTitle] = useState(node?.title || "");
  // An existing panel keeps its color; a new one is given the next in the palette.
  const color = node?.kind === "panel" ? node.color : "";
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
        <p className="muted">
          All included panels run in order. Add nested panels, selectors, and
          notes after creating this panel.
        </p>
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
// `> [!note] text` and `> [!toggle] title` stay valid Markdown elsewhere and
// render here as a callout or a foldable section.
const CALLOUT = /^>\s*\[!(note|tip|warning|toggle)\]\s*(.*)$/i;
type Segment =
  | { kind: "markdown"; text: string }
  | { kind: string; title: string; body: string; callout: true };
function segments(body: string): Segment[] {
  const parts: Segment[] = [];
  const lines = body.split("\n");
  let plain: string[] = [];
  let fenced = false;
  const flushPlain = () => {
    if (plain.join("\n").trim())
      parts.push({ kind: "markdown", text: plain.join("\n") });
    plain = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^\s*```/.test(line)) fenced = !fenced;
    const marker = fenced ? null : line.match(CALLOUT);
    if (!marker) {
      plain.push(line);
      continue;
    }
    flushPlain();
    const inner: string[] = [];
    let next = index + 1;
    while (next < lines.length && /^>/.test(lines[next])) {
      inner.push(lines[next].replace(/^>\s?/, ""));
      next++;
    }
    parts.push({
      callout: true,
      kind: marker[1].toLowerCase(),
      title: marker[2].trim(),
      body: inner.join("\n"),
    });
    index = next - 1;
  }
  flushPlain();
  return parts;
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
  const render = (text: string, key?: number) => (
    <Markdown
      key={key}
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
      {text}
    </Markdown>
  );
  return (
    <div className="markdown">
      {segments(body).map((part, index) =>
        "callout" in part ? (
          part.kind === "toggle" ? (
            <details className="md-toggle" key={index}>
              <summary>{part.title || "Details"}</summary>
              <MarkdownView
                body={part.body}
                page={page}
                navigate={navigate}
                pick={pick}
              />
            </details>
          ) : (
            <div className={`md-callout callout-${part.kind}`} key={index}>
              <Icon
                name={part.kind === "warning" ? "skip" : "help"}
                size={16}
              />
              <div>
                {part.title && <strong>{part.title}</strong>}
                <MarkdownView
                  body={part.body}
                  page={page}
                  navigate={navigate}
                  pick={pick}
                />
              </div>
            </div>
          )
        ) : (
          render(part.text, index)
        ),
      )}
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
                  node.kind !== "text" &&
                  (node.title.toLowerCase().includes(search.toLowerCase()) ||
                    (node.kind === "selector" &&
                      node.options.some((o) =>
                        o.label.toLowerCase().includes(search.toLowerCase()),
                      ))),
              )
              .map(({ node, depth }) => (
                <div key={node.id} style={{ paddingLeft: depth * 14 }}>
                  <button
                    onClick={() =>
                      insert(
                        node.id,
                        nodeTitle(node),
                        node.kind === "panel" ? "value" : "title",
                      )
                    }
                  >
                    <Icon name={node.kind === "panel" ? "layers" : "more"} />
                    <span>
                      {nodeTitle(node)}
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
  reorder,
  move,
}: {
  page: Page;
  update: (id: string, fn: (node: ParameterNode) => ParameterNode) => void;
  add: (
    kind: "panel" | "selector" | "text",
    parent: string | null,
    afterId?: string,
  ) => void;
  edit: (node: ParameterNode) => void;
  remove: (node: ParameterNode) => void;
  openPanel: (panel: Panel) => void;
  reorder: (id: string, targetId: string, after: boolean) => void;
  move: (id: string, direction: number) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  // Refs as well as state: a pointer move can arrive before React has
  // re-rendered, and the handler must still know what is being dragged.
  const held = useRef<string | null>(null);
  const target = useRef<{ id: string; after: boolean } | null>(null);
  const [writing, setWriting] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [noteSlash, setNoteSlash] = useState<{
    id: string;
    start: number;
    query: string;
  } | null>(null);
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const commitNote = () => {
    if (!writing) return;
    const { id, text } = writing;
    update(id, (node) => (node.kind === "text" ? { ...node, text } : node));
    setWriting(null);
    setNoteSlash(null);
  };
  const noteCommand = (
    kind: "panel" | "selector",
    node: ParameterNode,
    parentId: string | null,
  ) => {
    if (!writing || !noteSlash) return;
    const text =
      writing.text.slice(0, noteSlash.start) +
      writing.text.slice(noteSlash.start + 1 + noteSlash.query.length);
    update(node.id, (current) =>
      current.kind === "text" ? { ...current, text } : current,
    );
    setWriting(null);
    setNoteSlash(null);
    add(kind, parentId, node.id);
  };
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () =>
      new Set(
        flatten(page.nodes)
          .filter(({ node }) => node.kind === "panel" && node.skipped)
          .map(({ node }) => node.id),
      ),
  );
  // Pointer events rather than HTML5 drag and drop: WKWebView, which the Mac
  // app runs on, does not deliver dragover/drop reliably.
  const pointerDrag = (node: ParameterNode) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      held.current = node.id;
      target.current = null;
      setDragging(node.id);
      setOver(null);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (held.current !== node.id) return;
      const element = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-node]") as HTMLElement | null;
      const id = element?.dataset.node;
      if (!element || !id || id === node.id) {
        target.current = null;
        setOver(null);
        return;
      }
      const box = element.getBoundingClientRect();
      const next = { id, after: e.clientY > box.top + box.height / 2 };
      target.current = next;
      setOver(next);
    },
    onPointerUp: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      const moved = held.current;
      const landing = target.current;
      held.current = null;
      target.current = null;
      setDragging(null);
      setOver(null);
      if (moved && landing && landing.id !== moved)
        reorder(moved, landing.id, landing.after);
    },
    onPointerCancel: () => {
      held.current = null;
      target.current = null;
      setDragging(null);
      setOver(null);
    },
  });
  const handle = (node: ParameterNode, parentId: string | null) => (
    <span className="node-gutter">
      <button
        className="drag-handle node-add"
        aria-label={`Add a note below ${nodeTitle(node)}`}
        title="Add a note below. Type / in it for a panel or selector."
        onClick={() => add("text", parentId, node.id)}
      >
        <Icon name="plus" size={13} />
      </button>
      <button
        className={`drag-handle ${dragging === node.id ? "is-holding" : ""}`}
        aria-label={`Move ${nodeTitle(node)}. Arrow keys move it, Return adds a note below.`}
        title="Drag to move. Arrow keys move it, Return adds a note below."
        {...pointerDrag(node)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            move(node.id, e.key === "ArrowUp" ? -1 : 1);
          }
          if (e.key === "Enter") {
            e.preventDefault();
            add("text", parentId, node.id);
          }
        }}
      >
        <Icon name="grip" size={14} />
      </button>
    </span>
  );
  const render = (
    node: ParameterNode,
    inactive: boolean,
    inheritedColor = "blue",
    parentId: string | null = null,
  ): ReactNode => {
    if (node.kind === "text") {
      const open = writing?.id === node.id;
      return (
        <div
          key={node.id}
          id={`parameter-${node.id}`}
          data-node={node.id}
          className={`note-block ${dragging === node.id ? "is-dragging" : ""} ${over?.id === node.id && dragging !== node.id ? (over.after ? "drop-below" : "drop-above") : ""}`}
        >
          {handle(node, parentId)}
          {open ? (
            <textarea
              className="note-editor"
              aria-label="Note"
              autoFocus
              ref={grow}
              value={writing.text}
              placeholder="Write a note. Type / to add a panel or selector."
              onChange={(e) => {
                setWriting({ id: node.id, text: e.target.value });
                grow(e.target);
                const caret = e.target.selectionStart;
                const found = e.target.value
                  .slice(0, caret)
                  .match(/(?:^|\s)\/([a-z]*)$/i);
                setNoteSlash(
                  found
                    ? {
                        id: node.id,
                        start: caret - found[1].length - 1,
                        query: found[1],
                      }
                    : null,
                );
              }}
              onBlur={() => {
                if (!noteSlash) commitNote();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (noteSlash) setNoteSlash(null);
                  else commitNote();
                }
              }}
            />
          ) : (
            <div
              className="note-view"
              role="button"
              tabIndex={0}
              title="Click to write here"
              onClick={() => setWriting({ id: node.id, text: node.text })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setWriting({ id: node.id, text: node.text });
                }
              }}
            >
              {node.text.trim() ? (
                <MarkdownView body={node.text} page={page} />
              ) : (
                <span className="note-placeholder">
                  Write a note. Type / to add a panel or selector.
                </span>
              )}
            </div>
          )}
          <button
            className="icon-button remove-node"
            aria-label="Remove this note"
            onClick={() => remove(node)}
          >
            <Icon name="close" size={13} />
          </button>
          {noteSlash?.id === node.id && (
            <div
              className="slash-menu note-menu"
              onMouseDown={(e) => e.preventDefault()}
            >
              {(["panel", "selector"] as const)
                .filter(
                  (kind) =>
                    !noteSlash.query || kind.startsWith(noteSlash.query),
                )
                .map((kind) => (
                  <button
                    key={kind}
                    onClick={() => noteCommand(kind, node, parentId)}
                  >
                    <strong>{kind === "panel" ? "Panel" : "Selector"}</strong>
                    <small>
                      {kind === "panel"
                        ? "A stage that can hold more panels"
                        : "One value chosen from a list"}
                    </small>
                  </button>
                ))}
            </div>
          )}
        </div>
      );
    }
    const disabled = inactive || node.skipped;
    const color = node.kind === "panel" ? node.color : inheritedColor;
    return (
      <div
        key={node.id}
        id={`parameter-${node.id}`}
        data-node={node.id}
        className={`${node.kind}-block tone-${color} ${disabled ? "is-skipped" : ""} ${dragging === node.id ? "is-dragging" : ""} ${over?.id === node.id && dragging !== node.id ? (over.after ? "drop-below" : "drop-above") : ""}`}
      >
        <div className="parameter-heading">
          {handle(node, parentId)}
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
                update(node.id, (n) =>
                  n.kind === "text" ? n : { ...n, skipped: !n.skipped },
                )
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
              {node.children.map((child) =>
                render(child, disabled, color, node.id),
              )}
              <div className="add-child">
                <button onClick={() => add("panel", node.id)}>
                  <Icon name="plus" size={12} />
                  Panel
                </button>
                <button onClick={() => add("selector", node.id)}>
                  <Icon name="plus" size={12} />
                  Selector
                </button>
                <button onClick={() => add("text", node.id)}>
                  <Icon name="plus" size={12} />
                  Note
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
      {page.nodes.map((node) => render(node, false, "blue", null))}
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
        <button className="text-button" onClick={() => add("text", null)}>
          Add note
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
  const [picker, setPicker] = useState<"panel" | "page" | null>(null);
  const [insertion, setInsertion] = useState<{
    text: string;
    token: number;
  } | null>(null);
  const [error, setError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const insert = (text: string) => setInsertion({ text, token: Date.now() });
  return (
    <section className="section protocol-section">
      <div className="section-heading">
        <div>
          <span className="section-index">02</span>
          <h2>Protocol</h2>
        </div>
        <span className="subtle-label">
          Click a block to edit it · / for blocks
        </span>
      </div>
      <BlockDocument
        value={page.body}
        change={change}
        page={page}
        navigate={navigate}
        pick={pick}
        onAction={(action) => {
          if (action === "image") upload.current?.click();
          else setPicker(action === "reference" ? "panel" : "page");
        }}
        insertion={insertion}
        placeholder="Write your protocol, or type / for blocks"
      />
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
              setPicker(null);
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
  const [fullPage, setFullPage] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const inBounds = (next: { x: number; y: number; zoom: number }) => {
    const box = viewport.current;
    const content = world.current;
    if (!box || !content) return next;
    const slack = 48;
    const width = content.offsetWidth * next.zoom;
    const height = content.offsetHeight * next.zoom;
    const limit = (value: number, visible: number, total: number) =>
      Math.min(slack, Math.max(Math.min(0, visible - total - slack), value));
    return {
      ...next,
      x: limit(next.x, box.clientWidth, width),
      y: limit(next.y, box.clientHeight, height),
    };
  };
  const branchIds = flatten(page.nodes)
    .filter(({ node }) => node.kind === "panel" && node.children.length > 0)
    .map(({ node }) => node.id);
  const allOpen =
    branchIds.length > 0 && branchIds.every((id) => expanded.has(id));
  const setFull = (next: boolean) => {
    setFullPage(next);
    setPosition({ x: 0, y: 0, zoom: 1 });
    if (next) setExpanded(new Set(branchIds));
  };
  useEffect(() => {
    if (!fullPage) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [fullPage]);
  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const render = (node: ParameterNode, inactive = false): ReactNode =>
    node.kind === "text" ? null : (
      <div
        className={`map-step ${inactive || node.skipped ? "map-skipped" : ""}`}
        key={node.id}
      >
        <div
          className={`map-node tone-${node.kind === "panel" ? node.color : "blue"}`}
        >
          <button
            className="map-label"
            onClick={() => {
              if (fullPage) setFull(false);
              requestAnimationFrame(() =>
                document
                  .getElementById(`parameter-${node.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
              );
            }}
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
    <aside className={`path-rail ${fullPage ? "map-full" : ""}`}>
      <div className="map-heading">
        <span>
          <Icon name="map" size={16} />
          Protocol path
        </span>
        <span className="map-heading-actions">
          <span className="live-dot" title="Updates with your selections" />
          <button
            className="icon-button map-fullscreen-toggle"
            aria-pressed={fullPage}
            aria-label={
              fullPage ? "Close the full page map" : "Open the map full page"
            }
            title={fullPage ? "Close full page (Esc)" : "Open full page"}
            onClick={() => setFull(!fullPage)}
          >
            <Icon name={fullPage ? "shrink" : "expand"} size={15} />
            {fullPage && <span>Close</span>}
          </button>
        </span>
      </div>
      <p className="map-subtitle">Your current configuration</p>
      <div
        className="map-viewport"
        ref={viewport}
        onWheel={(e) =>
          setPosition((p) =>
            inBounds(
              e.ctrlKey || e.metaKey
                ? {
                    ...p,
                    zoom: Math.min(2, Math.max(0.4, p.zoom - e.deltaY * 0.004)),
                  }
                : { ...p, x: p.x - e.deltaX, y: p.y - e.deltaY },
            ),
          )
        }
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
            setPosition((p) =>
              inBounds({
                ...p,
                x: e.clientX - drag.current!.x,
                y: e.clientY - drag.current!.y,
              }),
            );
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
          ref={world}
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
              setPosition((p) =>
                inBounds({ ...p, zoom: Math.max(0.4, p.zoom - 0.15) }),
              )
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
              setPosition((p) =>
                inBounds({ ...p, zoom: Math.min(2, p.zoom + 0.15) }),
              )
            }
          >
            +
          </button>
        </div>
        <button
          className="text-button map-unfold"
          onClick={() => {
            setExpanded(allOpen ? new Set() : new Set(branchIds));
            setPosition((p) => ({ ...p, y: 0 }));
          }}
          disabled={branchIds.length === 0}
        >
          {allOpen ? "Fold all branches" : "Unfold all branches"}
        </button>
        <p>
          {fullPage
            ? "Drag to pan · Esc to close"
            : "Drag to pan · + to unfold"}
        </p>
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
