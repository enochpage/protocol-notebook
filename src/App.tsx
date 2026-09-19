import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  appendNode,
  configuration,
  flatten,
  mapNode,
  moveNode,
  nextColor,
  nodeTitle,
  reorderSiblings,
  newPage,
  now,
  removeNode,
  uid,
} from "./model";
import type { Page, Panel, ParameterNode, Workspace } from "./model";
import {
  Editor,
  Icon,
  Modal,
  NameForm,
  NodeForm,
  ParameterModule,
  PathMap,
} from "./components";
import { Results } from "./Results";
import { native } from "./storage";
import { useNotebook } from "./useNotebook";
import "./App.css";

type Dialog =
  | { type: "project" }
  | { type: "page"; projectId: string; parentId: string | null }
  | {
      type: "node";
      kind: "panel" | "selector";
      parentId: string | null;
      afterId?: string;
      node?: ParameterNode;
    }
  | { type: "reference"; id: string; refType: string }
  | { type: "remove"; node: ParameterNode }
  | { type: "help" };
function App() {
  const { workspace, setWorkspace, error, status, flush } = useNotebook();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [search, setSearch] = useState("");
  const [mapVisible, setMapVisible] = useState(() => window.innerWidth >= 1100);
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set());
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [reorderNotice, setReorderNotice] = useState("");
  const close = useCallback(() => setDialog(null), []);
  const scroll = useRef<HTMLElement>(null);
  const update = useCallback(
    (fn: (w: Workspace) => Workspace) => setWorkspace((w) => (w ? fn(w) : w)),
    [setWorkspace],
  );
  const page =
    workspace?.pages.find((p) => p.id === workspace.activePageId) ||
    workspace?.pages[0];
  const changePage = (fn: (p: Page) => Page) => {
    if (page)
      update((w) => ({
        ...w,
        pages: w.pages.map((p) =>
          p.id === page.id ? { ...fn(p), updatedAt: now() } : p,
        ),
      }));
  };
  // Order is part of a configuration's identity, so moving a panel can detach
  // results recorded under the previous order.
  const rearrange = (fn: (p: Page) => Page) => {
    if (!page || !workspace) return;
    const next = fn(page);
    const wasKey = configuration(page).key;
    const nowKey = configuration(next).key;
    const detached = workspace.runs.filter(
      (run) => run.pageId === page.id && run.configuration === wasKey,
    ).length;
    changePage(() => next);
    setReorderNotice(
      wasKey !== nowKey && detached
        ? `${detached} ${detached === 1 ? "experiment" : "experiments"} recorded under the previous order no longer ${detached === 1 ? "matches" : "match"} these selections. ${detached === 1 ? "It is" : "They are"} still in All experiments.`
        : "",
    );
  };
  const changeNode = (id: string, fn: (node: ParameterNode) => ParameterNode) =>
    changePage((p) => ({ ...p, nodes: mapNode(p.nodes, id, fn) }));
  const navigate = (id: string) => {
    if (workspace?.pages.some((p) => p.id === id)) {
      update((w) => ({ ...w, activePageId: id }));
      setDialog(null);
      setMobileSidebar(false);
      scroll.current?.scrollTo(0, 0);
    }
  };
  const openPanel = (panel: Panel) => {
    if (panel.pageId && workspace?.pages.some((p) => p.id === panel.pageId)) {
      navigate(panel.pageId);
      return;
    }
    if (!page) return;
    const detail = newPage(page.projectId, page.id, panel.title);
    update((w) => ({
      ...w,
      activePageId: detail.id,
      pages: [
        ...w.pages.map((p) =>
          p.id === page.id
            ? {
                ...p,
                nodes: mapNode(p.nodes, panel.id, (n) =>
                  n.kind === "panel" ? { ...n, pageId: detail.id } : n,
                ),
              }
            : p,
        ),
        detail,
      ],
    }));
    scroll.current?.scrollTo(0, 0);
  };
  if (!workspace)
    return (
      <div className="loading-screen">
        <Icon name="layers" size={36} />
        <h1>Protocol notebook</h1>
        <p>{error || "Opening your workspace…"}</p>
        {error && (
          <button className="primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        )}
      </div>
    );
  const project = workspace.projects.find((p) => p.id === page?.projectId);
  const matches = (p: Page): boolean =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    workspace.pages.filter((child) => child.parentId === p.id).some(matches);
  const tree = (
    projectId: string,
    parentId: string | null,
    depth = 0,
  ): ReactNode =>
    workspace.pages
      .filter(
        (p) =>
          p.projectId === projectId && p.parentId === parentId && matches(p),
      )
      .map((p) => {
        const children = workspace.pages.some(
          (child) => child.parentId === p.id,
        );
        const collapsed = collapsedPages.has(p.id) && !search;
        return (
          <div key={p.id}>
            <div
              className={`page-row ${p.id === page?.id ? "selected-page" : ""}`}
              style={{ paddingLeft: 12 + depth * 15 }}
            >
              <button
                className={`tree-toggle ${children ? "" : "invisible"}`}
                aria-label={`${collapsed ? "Expand" : "Collapse"} ${p.title} pages`}
                aria-expanded={!collapsed}
                disabled={!children}
                onClick={() =>
                  setCollapsedPages((s) => {
                    const next = new Set(s);
                    next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                    return next;
                  })
                }
              >
                <Icon name={collapsed ? "chevron" : "down"} size={12} />
              </button>
              <button
                className="page-link"
                onClick={() => navigate(p.id)}
                title={p.title}
              >
                <Icon name="page" size={15} />
                <span>{p.title}</span>
              </button>
              <button
                className="page-add"
                aria-label={`Add child page to ${p.title}`}
                onClick={() => {
                  setCollapsedPages(
                    (s) => new Set([...s].filter((id) => id !== p.id)),
                  );
                  setDialog({ type: "page", projectId, parentId: p.id });
                }}
              >
                <Icon name="plus" size={13} />
              </button>
            </div>
            {!collapsed && tree(projectId, p.id, depth + 1)}
          </div>
        );
      });
  const ancestors: Page[] = [];
  let ancestor = page?.parentId;
  const seen = new Set<string>();
  while (ancestor && !seen.has(ancestor)) {
    seen.add(ancestor);
    const p = workspace.pages.find((p) => p.id === ancestor);
    if (!p) break;
    ancestors.unshift(p);
    ancestor = p.parentId;
  }
  const config = page ? configuration(page) : null;
  let modal: ReactNode = null;
  if (dialog?.type === "project")
    modal = (
      <Modal title="New project" close={close}>
        <NameForm
          label="Project name"
          close={close}
          submit={(title) => {
            const id = uid();
            const first = newPage(id, null, "Untitled page");
            update((w) => ({
              ...w,
              projects: [...w.projects, { id, title }],
              pages: [...w.pages, first],
              activePageId: first.id,
            }));
            close();
          }}
        />
      </Modal>
    );
  if (dialog?.type === "page")
    modal = (
      <Modal title="New page" close={close}>
        <NameForm
          label="Page title"
          close={close}
          submit={(title) => {
            const next = newPage(dialog.projectId, dialog.parentId, title);
            update((w) => ({
              ...w,
              pages: [...w.pages, next],
              activePageId: next.id,
            }));
            close();
          }}
        />
      </Modal>
    );
  if (dialog?.type === "node" && page)
    modal = (
      <Modal
        title={`${dialog.node ? "Edit" : "Add"} ${dialog.kind}`}
        close={close}
      >
        <NodeForm
          kind={dialog.kind}
          node={dialog.node?.kind === "text" ? undefined : dialog.node}
          close={close}
          save={(node) => {
            changePage((p) => ({
              ...p,
              nodes: dialog.node
                ? mapNode(p.nodes, node.id, () => node)
                : appendNode(
                    p.nodes,
                    dialog.parentId,
                    node.kind === "panel" && !node.color
                      ? { ...node, color: nextColor(p.nodes) }
                      : node,
                    dialog.afterId,
                  ),
            }));
            close();
          }}
        />
        {dialog.node && (
          <div className="reorder-actions">
            <span>Order within this group</span>
            <button
              className="quiet"
              onClick={() => {
                changePage((p) => ({
                  ...p,
                  nodes: moveNode(p.nodes, dialog.node!.id, -1),
                }));
                close();
              }}
            >
              Move up
            </button>
            <button
              className="quiet"
              onClick={() => {
                changePage((p) => ({
                  ...p,
                  nodes: moveNode(p.nodes, dialog.node!.id, 1),
                }));
                close();
              }}
            >
              Move down
            </button>
          </div>
        )}
      </Modal>
    );
  if (dialog?.type === "remove" && page)
    modal = (
      <Modal title={`Remove ${nodeTitle(dialog.node)}?`} close={close}>
        <p>
          This removes the {dialog.node.kind}
          {dialog.node.kind === "panel"
            ? " and its nested parameters"
            : ""}{" "}
          from this page. Saved experiments and linked pages remain available.
          Any text references will be marked as missing.
        </p>
        <div className="form-actions">
          <button className="quiet" onClick={close}>
            Cancel
          </button>
          <button
            className="danger"
            onClick={() => {
              changePage((p) => ({
                ...p,
                nodes: removeNode(p.nodes, dialog.node.id),
              }));
              close();
            }}
          >
            Remove {dialog.node.kind}
          </button>
        </div>
      </Modal>
    );
  if (dialog?.type === "reference" && page) {
    const all = flatten(page.nodes);
    const original = all.find((item) => item.node.id === dialog.id);
    const target = all.find(
      (item) => item.node.id === (page.bindings[dialog.id] || dialog.id),
    );
    modal = (
      <Modal
        title={(target && nodeTitle(target.node)) || "Missing reference"}
        close={close}
      >
        {!target || !original ? (
          <p className="notice">
            The referenced item has been removed. Edit the protocol and insert a
            replacement using /panel.
          </p>
        ) : target.node.kind === "selector" ? (
          <>
            <p className="muted">
              This selection also updates the parameter module and matching
              results.
            </p>
            <div className="reference-choice-list">
              {target.node.options.map((option) => (
                <button
                  key={option.id}
                  className={
                    target.node.kind === "selector" &&
                    option.id === target.node.selectedId
                      ? "chosen"
                      : ""
                  }
                  onClick={() => {
                    changeNode(target.node.id, (n) =>
                      n.kind === "selector"
                        ? { ...n, selectedId: option.id, skipped: false }
                        : n,
                    );
                    close();
                  }}
                >
                  <span>{option.label}</span>
                  {target.node.kind === "selector" &&
                    option.id === target.node.selectedId && (
                      <Icon name="check" size={16} />
                    )}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => {
                changeNode(target.node.id, (n) =>
                  n.kind === "text" ? n : { ...n, skipped: !n.skipped },
                );
                close();
              }}
            >
              {target.node.skipped ? "Include selector" : "Skip selector"}
            </button>
            {target.inactive && (
              <p className="notice">
                A parent panel is skipped. Include it in the parameter module to
                activate this selector.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              Use another panel from the same parent in this text reference.
              Other panels keep their include/skip settings.
            </p>
            <div className="reference-choice-list">
              {all
                .filter(
                  (item) =>
                    item.node.kind === "panel" &&
                    item.parent?.id === original.parent?.id,
                )
                .map(({ node, inactive }) => (
                  <button
                    key={node.id}
                    className={node.id === target.node.id ? "chosen" : ""}
                    onClick={() => {
                      changePage((p) => ({
                        ...p,
                        bindings: { ...p.bindings, [dialog.id]: node.id },
                      }));
                      close();
                    }}
                  >
                    <span>
                      {nodeTitle(node)}
                      {((node.kind !== "text" && node.skipped) || inactive) && (
                        <small>Skipped in module</small>
                      )}
                    </span>
                    {node.id === target.node.id && (
                      <Icon name="check" size={16} />
                    )}
                  </button>
                ))}
            </div>
            <button
              className="text-button"
              onClick={() => {
                changeNode(target.node.id, (n) =>
                  n.kind === "text" ? n : { ...n, skipped: !n.skipped },
                );
                close();
              }}
            >
              {target.node.kind !== "text" && target.node.skipped
                ? "Include this panel"
                : "Skip this panel"}
            </button>
          </>
        )}
      </Modal>
    );
  }
  if (dialog?.type === "help")
    modal = (
      <Modal title="Your protocol notebook" close={close}>
        <div className="help-content">
          <p>Every page has the same sections. Use only the ones you need.</p>
          <h3>Build your parameters</h3>
          <p>
            Panels are ordered stages. Nest panels and selectors inside them, or
            skip a whole branch. Selectors contain discrete values and can also
            be skipped. Panel titles open linked pages.
          </p>
          <h3>Write with references</h3>
          <p>
            In Edit mode, type /panel for a searchable parameter tree, or /page
            for a page link. Switch to Read and click a reference to change its
            value or choose a sibling panel.
          </p>
          <h3>Record experiments</h3>
          <p>
            Finish or skip each active selector, then record a result. Each
            configuration keeps its own draft and experiment history. Saved
            experiments preserve the exact text and choices used.
          </p>
          <h3>Where your work lives</h3>
          <p>
            {native
              ? "The Mac app saves Markdown pages, metadata, and copied images in the project's data/vault folder. A previous-save backup and interrupted-save recovery journal protect notebook saves."
              : "This browser preview saves its own notebook in this browser. It is separate from the Mac app’s Markdown vault. Use the Mac app for your working notebook."}
          </p>
          <p>
            For this MVP, edit Markdown externally only while the app is closed.
            File paths are stored as references; attached images are copied into
            the notebook.
          </p>
        </div>
      </Modal>
    );
  return (
    <div
      className={`app-shell ${page?.nodes.length && mapVisible ? "with-map" : ""} ${mobileSidebar ? "sidebar-open" : ""}`}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="layers" size={22} />
          </span>
          <div>
            Protocol notebook<small>PERSONAL WORKSPACE</small>
          </div>
        </div>
        <div className="sidebar-search">
          <Icon name="search" size={15} />
          <input
            value={search}
            aria-label="Search pages"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a page…"
          />
        </div>
        <div className="workspace-label">
          <span>PROJECTS</span>
          <button
            className="icon-button"
            aria-label="New project"
            onClick={() => setDialog({ type: "project" })}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
        <nav className="project-navigation" aria-label="Projects and pages">
          {workspace.projects.map((p) => (
            <div className="project-group" key={p.id}>
              <div className="project-heading">
                <Icon name="folder" size={16} />
                <span>{p.title}</span>
                <button
                  className="icon-button"
                  aria-label={`Add page to ${p.title}`}
                  onClick={() =>
                    setDialog({ type: "page", projectId: p.id, parentId: null })
                  }
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
              {tree(p.id, null)}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="storage-label">
            <span className="storage-dot" />
            <span>
              {native ? "Local notebook" : "Browser preview"}
              <small>
                {native
                  ? "Markdown files on your Mac"
                  : "Separate from the Mac notebook"}
              </small>
            </span>
          </div>
          <button
            className="help-button"
            onClick={() => setDialog({ type: "help" })}
          >
            <Icon name="help" size={16} />
            How this notebook works
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle sidebar"
            onClick={() => setMobileSidebar((v) => !v)}
          >
            <Icon name="layers" />
          </button>
          <div className="breadcrumbs">
            <span>{project?.title || "Workspace"}</span>
            {ancestors.map((p) => (
              <span key={p.id}>
                <Icon name="chevron" size={12} />
                <button onClick={() => navigate(p.id)}>{p.title}</button>
              </span>
            ))}
            {page && (
              <span>
                <Icon name="chevron" size={12} />
                <b>{page.title || "Untitled"}</b>
              </span>
            )}
          </div>
          <div className="top-actions">
            <span className={`save-status ${error ? "save-error" : ""}`}>
              <span />
              {status}
            </span>
            {page?.nodes.length ? (
              <button
                className={`icon-button ${mapVisible ? "pressed" : ""}`}
                aria-label="Toggle protocol path"
                aria-pressed={mapVisible}
                onClick={() => setMapVisible((v) => !v)}
              >
                <Icon name="map" />
              </button>
            ) : null}
          </div>
        </header>
        {error && (
          <div className="save-error-banner" role="alert">
            Your latest changes have not been saved: {error}
            <button onClick={() => void flush().catch(() => {})}>
              Retry save
            </button>
          </div>
        )}
        <main ref={scroll} className="page-scroll">
          {page ? (
            <article className="notebook-page" key={page.id}>
              <div className="page-eyebrow">
                <span className="document-symbol">
                  <Icon name="page" size={21} />
                </span>
                <span>
                  {ancestors.length ? "NESTED PAGE" : "PROJECT NOTEBOOK"}
                </span>
                {page.id === "lithography" && (
                  <span className="demo-badge">Example</span>
                )}
              </div>
              <input
                className="page-title"
                aria-label="Page title"
                value={page.title}
                placeholder="Untitled page"
                onChange={(e) =>
                  changePage((p) => ({ ...p, title: e.target.value }))
                }
              />
              <div className="page-properties">
                <div>
                  <span>Project</span>
                  <b>{project?.title}</b>
                </div>
                <div>
                  <span>Created</span>
                  <b>
                    {new Date(page.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </b>
                </div>
                {page.properties.map((property) => (
                  <div key={property.id} className="custom-property">
                    <input
                      aria-label="Property name"
                      value={property.name}
                      onChange={(e) =>
                        changePage((p) => ({
                          ...p,
                          properties: p.properties.map((prop) =>
                            prop.id === property.id
                              ? { ...prop, name: e.target.value }
                              : prop,
                          ),
                        }))
                      }
                    />
                    <input
                      aria-label={property.name || "Property value"}
                      value={property.value}
                      placeholder="Empty"
                      onChange={(e) =>
                        changePage((p) => ({
                          ...p,
                          properties: p.properties.map((prop) =>
                            prop.id === property.id
                              ? { ...prop, value: e.target.value }
                              : prop,
                          ),
                        }))
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label={`Remove property ${property.name}`}
                      onClick={() =>
                        changePage((p) => ({
                          ...p,
                          properties: p.properties.filter(
                            (prop) => prop.id !== property.id,
                          ),
                        }))
                      }
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                ))}
                <button
                  className="add-property"
                  onClick={() =>
                    changePage((p) => ({
                      ...p,
                      properties: [
                        ...p.properties,
                        { id: uid(), name: "Property", value: "" },
                      ],
                    }))
                  }
                >
                  <Icon name="plus" size={12} />
                  Add property
                </button>
              </div>
              <section className="section parameter-section">
                <div className="section-heading">
                  <div>
                    <span className="section-index">01</span>
                    <h2>Parameters</h2>
                  </div>
                  {page.nodes.length > 0 && (
                    <span className="subtle-label">
                      {config?.missing.length
                        ? `${config.missing.length} to choose`
                        : "All set"}
                    </span>
                  )}
                </div>
                {reorderNotice && (
                  <p className="notice reorder-notice" role="status">
                    <Icon name="clock" size={14} />
                    {reorderNotice}
                    <button
                      className="text-button"
                      onClick={() => setReorderNotice("")}
                    >
                      Dismiss
                    </button>
                  </p>
                )}
                <ParameterModule
                  page={page}
                  update={changeNode}
                  add={(kind, parentId, afterId) => {
                    if (kind === "text") {
                      const note: ParameterNode = {
                        id: uid(),
                        kind: "text",
                        text: "",
                      };
                      changePage((p) => ({
                        ...p,
                        nodes: appendNode(p.nodes, parentId, note, afterId),
                      }));
                      return;
                    }
                    setDialog({ type: "node", kind, parentId, afterId });
                  }}
                  edit={(node) =>
                    setDialog({
                      type: "node",
                      kind: node.kind === "text" ? "panel" : node.kind,
                      node,
                      parentId: null,
                    })
                  }
                  remove={(node) => setDialog({ type: "remove", node })}
                  openPanel={openPanel}
                  reorder={(id, targetId, after) =>
                    rearrange((p) => ({
                      ...p,
                      nodes: reorderSiblings(p.nodes, id, targetId, after),
                    }))
                  }
                  move={(id, direction) =>
                    rearrange((p) => ({
                      ...p,
                      nodes: moveNode(p.nodes, id, direction),
                    }))
                  }
                />
              </section>
              <Editor
                page={page}
                workspace={workspace}
                change={(body) => changePage((p) => ({ ...p, body }))}
                navigate={navigate}
                pick={(id, refType) =>
                  setDialog({ type: "reference", id, refType })
                }
                setOption={(id, option) =>
                  changeNode(id, (n) =>
                    n.kind === "selector" ? { ...n, selectedId: option } : n,
                  )
                }
              />
              {page.resultsEnabled ? (
                <Results
                  key={page.id + config?.key}
                  page={page}
                  workspace={workspace}
                  update={update}
                />
              ) : (
                <button
                  className="enable-results"
                  onClick={() =>
                    changePage((p) => ({ ...p, resultsEnabled: true }))
                  }
                >
                  <Icon name="flask" size={17} />
                  Add results to this page
                  <Icon name="plus" size={14} />
                </button>
              )}
              <footer className="page-footnote">
                {native
                  ? "Stored locally. Yours to keep."
                  : "Preview notebook · saved in this browser"}
                <span>Protocol notebook / MVP</span>
              </footer>
            </article>
          ) : (
            <div className="empty-workspace">
              <h1>A place for your next experiment</h1>
              <button
                className="primary"
                onClick={() => setDialog({ type: "project" })}
              >
                Create a project
              </button>
            </div>
          )}
        </main>
      </div>
      {page && page.nodes.length > 0 && mapVisible && (
        <PathMap key={page.id} page={page} />
      )}
      {modal}
    </div>
  );
}
export default App;
