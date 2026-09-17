export type Option = { id: string; label: string };
export type Panel = {
  id: string;
  kind: "panel";
  title: string;
  color: string;
  skipped: boolean;
  pageId: string | null;
  children: ParameterNode[];
};
export type Selector = {
  id: string;
  kind: "selector";
  title: string;
  skipped: boolean;
  selectedId: string | null;
  options: Option[];
};
export type ParameterNode = Panel | Selector;
export type Page = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  properties: { id: string; name: string; value: string }[];
  body: string;
  nodes: ParameterNode[];
  bindings: Record<string, string>;
  resultsEnabled: boolean;
};
export type Attachment = { id: string; name: string };
export type Draft = {
  title: string;
  notes: string;
  paths: string;
  attachments: Attachment[];
};
export type Run = Draft & {
  id: string;
  pageId: string;
  createdAt: string;
  configuration: string;
  protocol: string;
  template: string;
  pageTitle: string;
  selections: string[];
};
export type Workspace = {
  version: 1;
  projects: { id: string; title: string }[];
  pages: Page[];
  runs: Run[];
  drafts: Record<string, Draft>;
  activePageId: string;
};
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const emptyDraft = (): Draft => ({
  title: "",
  notes: "",
  paths: "",
  attachments: [],
});
export function newPage(
  projectId: string,
  parentId: string | null,
  title: string,
): Page {
  return {
    id: uid(),
    projectId,
    parentId,
    title,
    createdAt: now(),
    updatedAt: now(),
    properties: [],
    body: "",
    nodes: [],
    bindings: {},
    resultsEnabled: false,
  };
}
export function flatten(
  nodes: ParameterNode[],
  parent: Panel | null = null,
  depth = 0,
  inactive = false,
): {
  node: ParameterNode;
  parent: Panel | null;
  depth: number;
  inactive: boolean;
}[] {
  return nodes.flatMap((node) => [
    { node, parent, depth, inactive },
    ...(node.kind === "panel"
      ? flatten(node.children, node, depth + 1, inactive || node.skipped)
      : []),
  ]);
}
export function mapNode(
  nodes: ParameterNode[],
  id: string,
  change: (node: ParameterNode) => ParameterNode,
): ParameterNode[] {
  return nodes.map((node) =>
    node.id === id
      ? change(node)
      : node.kind === "panel"
        ? { ...node, children: mapNode(node.children, id, change) }
        : node,
  );
}
export function removeNode(
  nodes: ParameterNode[],
  id: string,
): ParameterNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.kind === "panel"
        ? { ...node, children: removeNode(node.children, id) }
        : node,
    );
}
export function appendNode(
  nodes: ParameterNode[],
  parentId: string | null,
  child: ParameterNode,
): ParameterNode[] {
  return parentId
    ? mapNode(nodes, parentId, (node) =>
        node.kind === "panel"
          ? { ...node, children: [...node.children, child] }
          : node,
      )
    : [...nodes, child];
}
export function moveNode(
  nodes: ParameterNode[],
  id: string,
  direction: number,
): ParameterNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const next = [...nodes];
    const target = index + direction;
    if (target >= 0 && target < next.length)
      [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  return nodes.map((node) =>
    node.kind === "panel"
      ? { ...node, children: moveNode(node.children, id, direction) }
      : node,
  );
}
export function refLabel(page: Page, origin: string, type = "value"): string {
  const target = page.bindings[origin] || origin;
  const entry = flatten(page.nodes).find((item) => item.node.id === target);
  if (!entry) return "Missing reference";
  const { node, inactive } = entry;
  if (node.skipped || inactive) return `${node.title} · skipped`;
  return node.kind === "selector" && type !== "title"
    ? node.options.find((option) => option.id === node.selectedId)?.label ||
        `${node.title} · choose a value`
    : node.title;
}
export function resolveProtocol(page: Page): string {
  return page.body.replace(
    /\[([^\]]*)\]\(#ref:([a-zA-Z0-9_-]+):(value|title)\)/g,
    (_all, _label, id, type) => refLabel(page, id, type),
  );
}
export function configuration(page: Page): {
  key: string;
  missing: string[];
  summary: string[];
} {
  const active = flatten(page.nodes).filter((item) => !item.inactive);
  const missing = active
    .filter(
      ({ node }) =>
        node.kind === "selector" &&
        !node.skipped &&
        !node.options.some((option) => option.id === node.selectedId),
    )
    .map(({ node }) => node.title);
  const usedRefs = [
    ...page.body.matchAll(/\]\(#ref:([a-zA-Z0-9_-]+):(value|title)\)/g),
  ].map((match) => match[1]);
  const bindings = [...new Set(usedRefs)]
    .sort()
    .map((origin) => [origin, page.bindings[origin] || origin]);
  for (const [, target] of bindings)
    if (!flatten(page.nodes).some((item) => item.node.id === target))
      missing.push("Missing protocol reference");
  // Include order and explicit skips, but never dormant descendants of a skipped panel.
  const key = JSON.stringify({
    nodes: active.map(({ node }) => [
      node.id,
      node.skipped
        ? "skip"
        : node.kind === "selector"
          ? [
              node.selectedId,
              node.options.find((option) => option.id === node.selectedId)
                ?.label ?? null,
            ]
          : "use",
    ]),
    bindings,
  });
  const summary = active.map(({ node }) =>
    node.skipped
      ? `${node.title}: skipped`
      : node.kind === "selector"
        ? `${node.title}: ${refLabel(page, node.id)}`
        : node.title,
  );
  return { key, missing, summary };
}
export function draftKey(page: Page): string {
  return `${page.id}:${configuration(page).key}`;
}
export function createRun(page: Page, draft: Draft): Run {
  const config = configuration(page);
  if (config.missing.length)
    throw new Error(
      "Complete the active parameters before saving an experiment.",
    );
  if (
    !draft.title.trim() &&
    !draft.notes.trim() &&
    !draft.paths.trim() &&
    !draft.attachments.length
  )
    throw new Error("Add an observation, image, or file path first.");
  return structuredClone({
    ...draft,
    id: uid(),
    pageId: page.id,
    pageTitle: page.title,
    createdAt: now(),
    configuration: config.key,
    protocol: resolveProtocol(page),
    template: page.body,
    selections: config.summary,
  });
}
export function seedWorkspace(): Workspace {
  const page = newPage("microfabrication", null, "Lithography process");
  page.id = "lithography";
  page.properties = [
    { id: "status", name: "Status", value: "Exploring" },
    { id: "substrate", name: "Substrate", value: "Silicon wafer" },
  ];
  const panel = (
    id: string,
    title: string,
    color: string,
    children: ParameterNode[] = [],
    skipped = false,
  ): Panel => ({
    id,
    title,
    color,
    children,
    kind: "panel",
    skipped,
    pageId: `page-${id}`,
  });
  const selector = (
    id: string,
    title: string,
    labels: string[],
    selected = 0,
  ): Selector => ({
    id,
    title,
    kind: "selector",
    skipped: false,
    options: labels.map((label, i) => ({ id: `${id}-${i}`, label })),
    selectedId: `${id}-${selected}`,
  });
  page.nodes = [
    panel("resist", "Photoresist", "blue", [
      panel("positive", "Positive photoresist", "blue", [
        selector("resist-type", "Resist", ["AZ 1512", "S1813", "AZ 5214E"]),
      ]),
      panel(
        "negative",
        "Negative photoresist",
        "blue",
        [selector("negative-type", "Resist", ["SU-8 2005", "SU-8 2010"])],
        true,
      ),
    ]),
    panel("bake", "Soft bake", "amber", [
      selector("temperature", "Temperature", ["65 °C", "95 °C", "115 °C"], 1),
      selector("duration", "Duration", ["30 s", "60 s", "90 s"], 1),
    ]),
    panel("exposure", "Exposure", "teal", [
      selector(
        "dose",
        "Exposure dose",
        ["60 mJ/cm²", "80 mJ/cm²", "100 mJ/cm²"],
        1,
      ),
    ]),
  ];
  page.body =
    "> Demonstration only. These values illustrate the notebook; validate your own process before use.\n\n## Preparation\n\nRecord the substrate condition and confirm that the wafer is ready for coating.\n\n## Coat & bake\n\n1. Apply [Positive photoresist](#ref:positive:value), using [AZ 1512](#ref:resist-type:value). Record the coating method and thickness.\n2. Perform [Soft bake](#ref:bake:title) at [95 °C](#ref:temperature:value) for [60 s](#ref:duration:value).\n3. Inspect the coating before continuing.\n\n## Exposure\n\nExpose at [80 mJ/cm²](#ref:dose:value). Record the mask, equipment, and any deviations.\n\n| Checkpoint | Observation |\n| --- | --- |\n| Film uniformity | To be recorded |\n| Pattern quality | To be recorded |";
  page.resultsEnabled = true;
  const details = flatten(page.nodes)
    .filter(({ node }) => node.kind === "panel")
    .map(({ node }) => {
      const p = newPage(page.projectId, page.id, node.title);
      p.id = `page-${node.id}`;
      p.body = `# ${node.title}\n\nKeep material specifications, equipment notes, and references here.\n\nThis page can also have its own parameter module and results whenever you need them.`;
      return p;
    });
  return {
    version: 1,
    projects: [{ id: "microfabrication", title: "Microfabrication" }],
    pages: [page, ...details],
    runs: [],
    drafts: {},
    activePageId: page.id,
  };
}
