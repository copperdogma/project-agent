import path from "path";

async function run() {
  process.env.VAULT_ROOT = path.resolve("fixtures/example-vault");
  process.env.TIMEZONE = "America/Edmonton";

  const { listProjects } = await import(new URL("../dist/list.js", import.meta.url));
  const { getDocument } = await import(new URL("../dist/document.js", import.meta.url));
  const { buildSnapshot } = await import(new URL("../dist/snapshot.js", import.meta.url));

  const items = listProjects();
  if (!Array.isArray(items) || items.length < 1) throw new Error("fixtures: expected at least one project");
  const ex = items.find((x) => x.slug === "example-one");
  if (!ex) throw new Error("fixtures: example-one not listed");

  const doc = await getDocument("example-one");
  if (!doc.content.includes("# Uncategorized")) throw new Error("fixtures: getDocument did not return expected content");

  const snap = await buildSnapshot("example-one");
  if (!snap.toc || snap.toc.length < 2) throw new Error("fixtures: snapshot toc missing");

  // eslint-disable-next-line no-console
  console.log("OK: fixtures example vault test passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("fixtures test failed", err);
  process.exit(1);
});


