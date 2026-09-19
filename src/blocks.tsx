import { useEffect, useRef, useState } from "react";
import type { Page } from "./model";
import { Icon, MarkdownView } from "./components";

// A document is Markdown on disk and a list of blocks on screen. A block being
// edited is shown without its Markdown markers, so a heading is typed as text
// rather than as "## text". The block currently open lives in state, which is
// how an empty block can exist at all: Markdown has no way to store one.
export type BlockType =
  | "paragraph"
  | "heading"
  | "subheading"
  | "small-heading"
  | "bullets"
  | "numbers"
  | "checklist"
  | "quote"
  | "callout"
  | "warning"
  | "toggle"
  | "code"
  | "table"
  | "divider";

export function splitBlocks(body: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && !line.trim()) {
      if (current.length) blocks.push(current.join("\n"));
      current = [];
    } else current.push(line);
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

export function blockType(md: string): BlockType {
  const first = md.split("\n")[0] || "";
  if (/^\s*```/.test(first)) return "code";
  if (/^>\s*\[!note\]/i.test(first)) return "callout";
  if (/^>\s*\[!warning\]/i.test(first)) return "warning";
  if (/^>\s*\[!toggle\]/i.test(first)) return "toggle";
  if (/^>/.test(first)) return "quote";
  if (/^###\s/.test(first)) return "small-heading";
  if (/^##\s/.test(first)) return "subheading";
  if (/^#\s/.test(first)) return "heading";
  if (/^\s*[-*]\s+\[[ xX]\]/.test(first)) return "checklist";
  if (/^\s*[-*]\s+/.test(first)) return "bullets";
  if (/^\s*\d+\.\s+/.test(first)) return "numbers";
  if (/^\s*\|/.test(first)) return "table";
  if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(first)) return "divider";
  return "paragraph";
}

export function toText(md: string, type: BlockType): string {
  const lines = md.split("\n");
  switch (type) {
    case "heading":
      return lines.map((line) => line.replace(/^#\s+/, "")).join("\n");
    case "subheading":
      return lines.map((line) => line.replace(/^##\s+/, "")).join("\n");
    case "small-heading":
      return lines.map((line) => line.replace(/^###\s+/, "")).join("\n");
    case "bullets":
    case "checklist":
      return lines.map((line) => line.replace(/^\s*[-*]\s+/, "")).join("\n");
    case "numbers":
      return lines.map((line) => line.replace(/^\s*\d+\.\s+/, "")).join("\n");
    case "quote":
      return lines.map((line) => line.replace(/^>\s?/, "")).join("\n");
    case "callout":
    case "warning":
    case "toggle":
      return lines
        .map((line, index) =>
          index === 0
            ? line.replace(/^>\s*\[![a-z]+\]\s*/i, "")
            : line.replace(/^>\s?/, ""),
        )
        .join("\n");
    case "code":
      return lines.filter((line) => !/^\s*```/.test(line)).join("\n");
    case "divider":
      return "";
    default:
      return md;
  }
}

export function toMarkdown(text: string, type: BlockType): string {
  const lines = text.split("\n");
  switch (type) {
    case "heading":
      return lines.map((line) => `# ${line}`).join("\n");
    case "subheading":
      return lines.map((line) => `## ${line}`).join("\n");
    case "small-heading":
      return lines.map((line) => `### ${line}`).join("\n");
    case "bullets":
      return lines.map((line) => `- ${line}`).join("\n");
    case "checklist":
      return lines
        .map((line) =>
          /^\[[ xX]\]/.test(line.trim()) ? `- ${line}` : `- [ ] ${line}`,
        )
        .join("\n");
    case "numbers":
      return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
    case "quote":
      return lines.map((line) => `> ${line}`).join("\n");
    case "callout":
    case "warning":
    case "toggle": {
      const tag =
        type === "callout" ? "note" : type === "warning" ? "warning" : "toggle";
      return lines
        .map((line, index) =>
          index === 0 ? `> [!${tag}] ${line}` : `> ${line}`,
        )
        .join("\n");
    }
    case "code":
      return ["```", ...lines, "```"].join("\n");
    case "divider":
      return "---";
    default:
      return text;
  }
}

type Command = {
  id: string;
  label: string;
  hint: string;
  type?: BlockType;
  text?: string;
  action?: "reference" | "page" | "image" | "link";
};
const COMMANDS: Command[] = [
  { id: "text", label: "Text", hint: "Plain paragraph", type: "paragraph" },
  { id: "heading", label: "Heading", hint: "Largest title", type: "heading" },
  {
    id: "subheading",
    label: "Subheading",
    hint: "Section title",
    type: "subheading",
  },
  {
    id: "small-heading",
    label: "Small heading",
    hint: "Smallest title",
    type: "small-heading",
  },
  {
    id: "bullets",
    label: "Bulleted list",
    hint: "Return adds an item",
    type: "bullets",
  },
  {
    id: "numbers",
    label: "Numbered list",
    hint: "Renumbers itself",
    type: "numbers",
  },
  {
    id: "checklist",
    label: "Checklist",
    hint: "Boxes to tick",
    type: "checklist",
  },
  { id: "quote", label: "Quote", hint: "Indented remark", type: "quote" },
  {
    id: "callout",
    label: "Callout",
    hint: "Highlighted note",
    type: "callout",
  },
  {
    id: "warning",
    label: "Warning callout",
    hint: "Caution or safety note",
    type: "warning",
  },
  {
    id: "toggle",
    label: "Foldable section",
    hint: "Title that opens",
    type: "toggle",
  },
  { id: "code", label: "Code snippet", hint: "Monospaced block", type: "code" },
  {
    id: "table",
    label: "Table",
    hint: "Two columns",
    type: "table",
    text: "| Step | Observation |\n| --- | --- |\n|  |  |",
  },
  { id: "divider", label: "Divider", hint: "Horizontal rule", type: "divider" },
  { id: "link", label: "Link", hint: "Web address", action: "link" },
  {
    id: "image",
    label: "Image",
    hint: "Copy one into the notebook",
    action: "image",
  },
  {
    id: "reference",
    label: "Parameter reference",
    hint: "A live value from this page",
    action: "reference",
  },
  { id: "page", label: "Page link", hint: "Another page", action: "page" },
];

type Open = { index: number; text: string; type: BlockType; fresh: boolean };

export function BlockDocument({
  value,
  change,
  page,
  navigate,
  pick,
  offer = ["link", "image", "reference", "page"],
  onAction,
  insertion,
  placeholder = "Write something, or type / for blocks",
}: {
  value: string;
  change: (markdown: string) => void;
  page?: Page;
  navigate?: (id: string) => void;
  pick?: (id: string, type: string) => void;
  offer?: string[];
  onAction?: (action: "reference" | "page" | "image") => void;
  // Text chosen outside the document (a reference, a page link, an image).
  insertion?: { text: string; token: number } | null;
  placeholder?: string;
}) {
  const blocks = splitBlocks(value);
  const [open, setOpen] = useState<Open | null>(null);
  const [slash, setSlash] = useState<{
    start: number;
    query: string;
    active: number;
  } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  // Refs too: pointer moves can outrun React's re-render.
  const held = useRef<number | null>(null);
  const landing = useRef<number | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  const waiting = useRef(false);
  const handled = useRef(0);

  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  // The document with the open block folded back in.
  const settle = (state: Open | null = open): string[] => {
    if (!state) return blocks;
    const next = [...blocks];
    const text = state.text.replace(/\s+$/, "");
    const keep = text || state.type === "divider";
    const md = keep ? toMarkdown(text, state.type) : "";
    if (state.fresh) {
      if (md) next.splice(state.index, 0, md);
    } else if (md) next[state.index] = md;
    else next.splice(state.index, 1);
    return next;
  };
  const close = () => {
    const next = settle();
    setOpen(null);
    setSlash(null);
    const joined = next.join("\n\n");
    if (joined !== value) change(joined);
  };
  const openBlock = (list: string[], index: number, at?: number) => {
    const md = list[index] ?? "";
    const type = blockType(md);
    const text = toText(md, type);
    caret.current = at ?? text.length;
    setOpen({ index, text, type, fresh: false });
    setSlash(null);
  };
  const edit = (index: number) => {
    if (open && !open.fresh && open.index === index) return;
    const next = settle();
    let target = index;
    if (open) {
      const shorter = next.length < blocks.length && open.index < index;
      const longer = next.length > blocks.length && open.index <= index;
      if (shorter) target -= 1;
      if (longer) target += 1;
    }
    if (next.join("\n\n") !== value) change(next.join("\n\n"));
    openBlock(next, Math.max(0, Math.min(target, next.length - 1)));
  };
  const addAt = (index: number, type: BlockType = "paragraph", text = "") => {
    const next = settle();
    const at = Math.min(Math.max(index, 0), next.length);
    if (next.join("\n\n") !== value) change(next.join("\n\n"));
    caret.current = text.length;
    setOpen({ index: at, text, type, fresh: true });
    setSlash(null);
  };
  const remove = (index: number) => {
    const next = [...blocks];
    next.splice(index, 1);
    setOpen(null);
    change(next.join("\n\n"));
  };
  const move = (from: number, to: number) => {
    const next = settle();
    const [moved] = next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, moved);
    setOpen(null);
    change(next.join("\n\n"));
  };

  useEffect(() => {
    const el = editor.current;
    if (!el || !open) return;
    el.focus();
    const at = caret.current ?? el.value.length;
    el.setSelectionRange(at, at);
    caret.current = null;
    grow(el);
  }, [open?.index, open?.fresh, open?.type]);

  useEffect(() => {
    if (!insertion || insertion.token === handled.current) return;
    handled.current = insertion.token;
    waiting.current = false;
    if (!open) {
      addAt(blocks.length, "paragraph", insertion.text);
      return;
    }
    const at = caret.current ?? open.text.length;
    const text = open.text.slice(0, at) + insertion.text + open.text.slice(at);
    caret.current = at + insertion.text.length;
    setOpen({ ...open, text });
    requestAnimationFrame(() => {
      const el = editor.current;
      if (!el) return;
      el.focus();
      const position = at + insertion.text.length;
      el.setSelectionRange(position, position);
      grow(el);
    });
  }, [insertion?.token]);

  const available = COMMANDS.filter(
    (command) => !command.action || offer.includes(command.action),
  );
  const matching = (query: string) =>
    available.filter(
      (command) =>
        !query ||
        command.label.toLowerCase().includes(query.toLowerCase()) ||
        command.id.includes(query.toLowerCase()),
    );
  const runCommand = (command: Command) => {
    if (!open || !slash) return;
    const before = open.text.slice(0, slash.start);
    const after = open.text.slice(slash.start + 1 + slash.query.length);
    const rest = (before + after).trim();
    setSlash(null);
    if (command.action) {
      if (command.action === "link") {
        const link = "[label](https://)";
        setOpen({ ...open, text: before + link + after });
        requestAnimationFrame(() => {
          const el = editor.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(before.length + 1, before.length + 6);
        });
        return;
      }
      caret.current = before.length;
      waiting.current = true;
      setOpen({ ...open, text: before + after });
      onAction?.(command.action);
      return;
    }
    const type = command.type || "paragraph";
    const text = command.text || "";
    if (!rest) {
      // An empty block simply becomes the chosen kind.
      caret.current = text.length;
      setOpen({ ...open, text, type });
      return;
    }
    const next = settle({ ...open, text: rest });
    const at = open.index + 1;
    if (next.join("\n\n") !== value) change(next.join("\n\n"));
    caret.current = text.length;
    setOpen({ index: at, text, type, fresh: true });
  };

  // What is rendered: the stored blocks, plus the new block being written.
  const rendered: { md: string; index: number; virtual?: boolean }[] =
    blocks.map((md, index) => ({ md, index }));
  if (open?.fresh)
    rendered.splice(open.index, 0, {
      md: "",
      index: open.index,
      virtual: true,
    });

  const marker = (type: BlockType) => (type === "checklist" ? "[ ] " : "");

  return (
    <div className="doc">
      {rendered.map((entry, position) => {
        const isOpen =
          open !== null &&
          (open.fresh ? !!entry.virtual : entry.index === open.index);
        const type = isOpen && open ? open.type : blockType(entry.md);
        return (
          <div
            key={`${entry.index}-${position}`}
            data-block={position}
            className={`doc-block type-${type} ${dragIndex === position ? "is-dragging" : ""}`}
          >
            {dropAt === position && <div className="doc-drop" />}
            <div className="doc-gutter">
              <button
                className="doc-add"
                aria-label={`Add a block below block ${position + 1}`}
                title="Add a block below"
                onClick={() => addAt(entry.index + 1)}
              >
                <Icon name="plus" size={14} />
              </button>
              <button
                className={`doc-handle ${dragIndex === position ? "is-holding" : ""}`}
                aria-label={`Move block ${position + 1}`}
                title="Drag to move. Arrow keys move it, Delete removes it."
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  held.current = position;
                  landing.current = null;
                  setDragIndex(position);
                  setDropAt(null);
                }}
                onPointerMove={(e) => {
                  if (held.current !== position) return;
                  const element = document
                    .elementFromPoint(e.clientX, e.clientY)
                    ?.closest("[data-block]") as HTMLElement | null;
                  if (!element) return;
                  const over = Number(element.dataset.block);
                  const box = element.getBoundingClientRect();
                  const at =
                    e.clientY < box.top + box.height / 2 ? over : over + 1;
                  landing.current = at;
                  setDropAt(at);
                }}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  const from = held.current;
                  const to = landing.current;
                  held.current = null;
                  landing.current = null;
                  setDragIndex(null);
                  setDropAt(null);
                  if (
                    from !== null &&
                    to !== null &&
                    to !== from &&
                    to !== from + 1
                  )
                    move(from, to);
                }}
                onPointerCancel={() => {
                  held.current = null;
                  landing.current = null;
                  setDragIndex(null);
                  setDropAt(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" && entry.index > 0) {
                    e.preventDefault();
                    move(entry.index, entry.index - 1);
                  }
                  if (
                    e.key === "ArrowDown" &&
                    entry.index < blocks.length - 1
                  ) {
                    e.preventDefault();
                    move(entry.index, entry.index + 2);
                  }
                  if (e.key === "Backspace" || e.key === "Delete") {
                    e.preventDefault();
                    remove(entry.index);
                  }
                }}
              >
                <Icon name="grip" size={14} />
              </button>
            </div>
            {isOpen && open ? (
              <div className="doc-editing">
                <textarea
                  ref={editor}
                  className="doc-editor"
                  aria-label={`Block ${position + 1}`}
                  value={open.text}
                  placeholder={
                    open.type === "toggle"
                      ? "Title of the foldable section"
                      : open.type === "code"
                        ? "Code"
                        : placeholder
                  }
                  onChange={(e) => {
                    setOpen({ ...open, text: e.target.value });
                    grow(e.target);
                    const found = e.target.value
                      .slice(0, e.target.selectionStart)
                      .match(/(?:^|\s)\/([a-z-]*)$/i);
                    setSlash(
                      found
                        ? {
                            start:
                              e.target.selectionStart - found[1].length - 1,
                            query: found[1],
                            active: 0,
                          }
                        : null,
                    );
                  }}
                  onSelect={(e) => {
                    caret.current = (
                      e.target as HTMLTextAreaElement
                    ).selectionStart;
                  }}
                  onBlur={() => {
                    if (!slash && !waiting.current) close();
                  }}
                  onKeyDown={(e) => {
                    const el = e.currentTarget;
                    if (slash) {
                      const list = matching(slash.query);
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setSlash(null);
                        return;
                      }
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        const step = e.key === "ArrowDown" ? 1 : -1;
                        setSlash({
                          ...slash,
                          active:
                            (slash.active + step + list.length) % list.length,
                        });
                        return;
                      }
                      if (
                        (e.key === "Enter" || e.key === "Tab") &&
                        list[slash.active]
                      ) {
                        e.preventDefault();
                        runCommand(list[slash.active]);
                        return;
                      }
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      close();
                      return;
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      const listy =
                        open.type === "bullets" ||
                        open.type === "numbers" ||
                        open.type === "checklist";
                      if (open.type === "code" || open.type === "table") return;
                      const at = el.selectionStart;
                      const line =
                        open.text.slice(0, at).split("\n").at(-1) || "";
                      if (listy && line.replace(/^\[[ xX]\]\s*/, "").trim()) {
                        e.preventDefault();
                        const lead = marker(open.type);
                        const text =
                          open.text.slice(0, at) +
                          "\n" +
                          lead +
                          open.text.slice(at);
                        caret.current = at + 1 + lead.length;
                        setOpen({ ...open, text });
                        requestAnimationFrame(() => {
                          const current = editor.current;
                          if (!current) return;
                          const position = at + 1 + lead.length;
                          current.setSelectionRange(position, position);
                          grow(current);
                        });
                        return;
                      }
                      e.preventDefault();
                      const before = open.text.slice(0, at);
                      const after = open.text.slice(at);
                      const trimmed = listy
                        ? before.split("\n").slice(0, -1).join("\n")
                        : before;
                      const next = settle({ ...open, text: trimmed });
                      const kept = !!trimmed.trim() || open.type === "divider";
                      const landing = kept ? open.index + 1 : open.index;
                      if (next.join("\n\n") !== value)
                        change(next.join("\n\n"));
                      caret.current = 0;
                      setOpen({
                        index: Math.min(landing, next.length),
                        text: after.trim(),
                        type: "paragraph",
                        fresh: true,
                      });
                      return;
                    }
                    if (
                      e.key === "Backspace" &&
                      el.selectionStart === 0 &&
                      el.selectionEnd === 0
                    ) {
                      if (open.type !== "paragraph") {
                        e.preventDefault();
                        setOpen({ ...open, type: "paragraph" });
                        return;
                      }
                      if (!open.text.trim()) {
                        e.preventDefault();
                        const next = settle();
                        const previous = Math.max(0, open.index - 1);
                        if (next.join("\n\n") !== value)
                          change(next.join("\n\n"));
                        if (!next.length) {
                          setOpen(null);
                          return;
                        }
                        openBlock(next, Math.min(previous, next.length - 1));
                      }
                    }
                  }}
                />
                {slash && (
                  <div
                    className="slash-menu"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {matching(slash.query).map((command, order) => (
                      <button
                        key={command.id}
                        className={order === slash.active ? "active" : ""}
                        onMouseEnter={() =>
                          setSlash({ ...slash, active: order })
                        }
                        onClick={() => runCommand(command)}
                      >
                        <strong>{command.label}</strong>
                        <small>{command.hint}</small>
                      </button>
                    ))}
                    {!matching(slash.query).length && (
                      <p className="muted">Nothing matches “{slash.query}”.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="doc-view"
                role="button"
                tabIndex={0}
                onClick={() => edit(entry.index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAt(entry.index + 1);
                  }
                }}
              >
                <MarkdownView
                  body={entry.md}
                  page={page}
                  navigate={navigate}
                  pick={pick}
                />
              </div>
            )}
          </div>
        );
      })}
      {dropAt === rendered.length && <div className="doc-drop" />}
      <button
        className="doc-append"
        onClick={() => addAt(blocks.length + (open?.fresh ? 1 : 0))}
      >
        <Icon name="plus" size={14} />
        {rendered.length ? "Add a block" : placeholder}
      </button>
    </div>
  );
}
