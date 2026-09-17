import test from "node:test";
import assert from "node:assert/strict";
import {
  appendNode,
  configuration,
  createRun,
  draftKey,
  emptyDraft,
  flatten,
  mapNode,
  moveNode,
  newPage,
  refLabel,
  removeNode,
  resolveProtocol,
  seedWorkspace,
} from "../src/model.ts";

test("every page starts with the same optional modules", () => {
  const p = newPage("project", null, "Notes");
  assert.deepEqual(p.nodes, []);
  assert.equal(p.resultsEnabled, false);
  assert.equal(configuration(p).missing.length, 0);
});
test("restoring choices returns the same configuration, independent of titles", () => {
  const p = seedWorkspace().pages[0];
  const original = configuration(p).key;
  p.nodes = mapNode(p.nodes, "temperature", (n) =>
    n.kind === "selector" ? { ...n, selectedId: "temperature-2" } : n,
  );
  assert.notEqual(configuration(p).key, original);
  p.nodes = mapNode(p.nodes, "temperature", (n) =>
    n.kind === "selector"
      ? { ...n, title: "Bake temperature", selectedId: "temperature-1" }
      : n,
  );
  assert.equal(configuration(p).key, original);
  assert.match(resolveProtocol(p), /95 °C/);
});
test("skipped parents exclude dormant descendants from result matching and completion", () => {
  const p = seedWorkspace().pages[0];
  const original = configuration(p).key;
  p.nodes = mapNode(p.nodes, "negative-type", (n) =>
    n.kind === "selector" ? { ...n, selectedId: null } : n,
  );
  assert.equal(configuration(p).missing.length, 0);
  assert.equal(configuration(p).key, original);
  p.nodes = mapNode(p.nodes, "negative", (n) => ({ ...n, skipped: false }));
  assert.deepEqual(configuration(p).missing, ["Resist"]);
  p.nodes = mapNode(p.nodes, "negative-type", (n) => ({ ...n, skipped: true }));
  assert.equal(configuration(p).missing.length, 0);
});
test("changing the value of an existing parameter option creates a different configuration", () => {
  const p = seedWorkspace().pages[0];
  const original = configuration(p).key;
  p.nodes = mapNode(p.nodes, "temperature", (n) =>
    n.kind === "selector"
      ? {
          ...n,
          options: n.options.map((o) =>
            o.id === n.selectedId ? { ...o, label: "200 °C" } : o,
          ),
        }
      : n,
  );
  assert.notEqual(configuration(p).key, original);
});
test("result drafts stay separate and experiment snapshots cannot change with the template", () => {
  const p = seedWorkspace().pages[0];
  const key = draftKey(p);
  const draft = {
    ...emptyDraft(),
    notes: "Edges look sharp",
    attachments: [{ id: "image.png", name: "Microscope image" }],
  };
  const run = createRun(p, draft);
  const original = run.protocol;
  draft.attachments[0].name = "Renamed outside snapshot";
  p.body = "# Entirely different procedure";
  p.nodes = mapNode(p.nodes, "temperature", (n) =>
    n.kind === "selector" ? { ...n, selectedId: "temperature-0" } : n,
  );
  assert.notEqual(draftKey(p), key);
  assert.equal(run.protocol, original);
  assert.equal(run.attachments[0].name, "Microscope image");
});
test("panel references switch siblings without changing their include/skip settings", () => {
  const p = seedWorkspace().pages[0];
  const before = configuration(p).key;
  p.bindings.positive = "negative";
  assert.equal(refLabel(p, "positive"), "Negative photoresist · skipped");
  assert.equal(
    flatten(p.nodes).find((e) => e.node.id === "positive")?.node.skipped,
    false,
  );
  assert.notEqual(configuration(p).key, before);
});
test("missing referenced nodes and missing selections prevent a result from being recorded", () => {
  const p = seedWorkspace().pages[0];
  p.nodes = removeNode(p.nodes, "temperature");
  assert.ok(configuration(p).missing.includes("Missing protocol reference"));
  assert.throws(() =>
    createRun(p, { ...emptyDraft(), notes: "Cannot be misfiled" }),
  );
});
test("selectors remain leaves and panels can be nested and reordered", () => {
  const p = seedWorkspace().pages[0];
  const child = {
    id: "nested",
    kind: "panel" as const,
    title: "Nested",
    skipped: false,
    pageId: null,
    color: "blue",
    children: [],
  };
  p.nodes = appendNode(p.nodes, "positive", child);
  assert.equal(flatten(p.nodes).find((e) => e.node.id === "nested")?.depth, 2);
  const before = JSON.stringify(p.nodes);
  p.nodes = appendNode(p.nodes, "temperature", child);
  assert.equal(JSON.stringify(p.nodes), before);
  const key = configuration(p).key;
  p.nodes = moveNode(p.nodes, "bake", -1);
  assert.notEqual(configuration(p).key, key);
});
test("empty experiments are rejected and completed protocols can record repeated runs", () => {
  const p = seedWorkspace().pages[0];
  assert.throws(() => createRun(p, emptyDraft()));
  const draft = { ...emptyDraft(), notes: "Observation" };
  const a = createRun(p, draft);
  const b = createRun(p, draft);
  assert.equal(a.configuration, b.configuration);
  assert.notEqual(a.id, b.id);
});
