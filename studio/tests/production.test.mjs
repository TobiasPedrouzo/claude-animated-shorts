import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePlan, compileTimeline, srt } from "../lib/plan.mjs";
import { reconcile } from "../lib/alignment.mjs";
import { workers, run, withCacheLock } from "../lib/jobs.mjs";
const example = JSON.parse(
  await readFile(new URL("../../examples/smoke.json", import.meta.url), "utf8"),
);
const copy = () => structuredClone(example);
test("prepared smoke and full factual story validate", async () => {
  validatePlan(copy());
  validatePlan(
    JSON.parse(
      await readFile(
        new URL("../../examples/feather.json", import.meta.url),
        "utf8",
      ),
    ),
  );
});
test("unknown actions and missing props stop before production", () => {
  let p = copy();
  p.scenes[0].characters[0].action = "teleport";
  assert.throws(() => validatePlan(p), /Acción/);
  p = copy();
  p.scenes[0].props[0].kind = "undefined_asset";
  assert.throws(() => validatePlan(p), /Objeto/);
});
test("reject missing evidence and undefined fact references", () => {
  let p = copy();
  p.scenes[0].dramatization = false;
  assert.throws(() => validatePlan(p), /evidencia/);
  p = copy();
  p.scenes[0].facts = ["made-up"];
  assert.throws(() => validatePlan(p), /factual/);
});
test("reject malformed numeric positions and unsafe camera", () => {
  for (const value of [NaN, Infinity, "300", -1, 1100]) {
    const p = copy();
    p.scenes[0].characters[0].x = value;
    assert.throws(() => validatePlan(p));
  }
  const p = copy();
  p.scenes[0].camera.zoom = 2;
  assert.throws(() => validatePlan(p), /Zoom/);
});
test("Observer identity cannot be assigned unsupported motion", () => {
  const p = copy();
  p.scenes[0].characters[0].kind = "observer";
  assert.throws(() => validatePlan(p), /Observer/);
});
test("audio duration determines frame coverage and caption placement", () => {
  const p = copy();
  p.scenes = p.scenes.slice(0, 2);
  for (const s of p.scenes) s.narration = "Test";
  const voice = {
    duration: 1.013,
    words: [{ text: "Test", start: 0.1, end: 0.7 }],
  };
  const t = compileTimeline(p, [voice, voice]);
  assert.equal(t.scenes[0].frames, 32);
  assert.equal(t.scenes[1].start, 32 / 30);
  assert.equal(t.frames, 64);
  assert.equal(t.words[1].start, 32 / 30 + 0.1);
  assert.match(srt(t.words), /00:00:01,167/);
});
test("no estimated caption fallback on missing or overlapping timing", () => {
  const p = copy();
  p.scenes = p.scenes.slice(0, 1);
  p.scenes[0].narration = "a b";
  assert.throws(() => compileTimeline(p, [{ duration: 1, words: [] }]));
  assert.throws(
    () =>
      compileTimeline(p, [
        {
          duration: 1,
          words: [
            { text: "a", start: 0.2, end: 0.6 },
            { text: "b", start: 0.3, end: 0.7 },
          ],
        },
      ]),
    /Marcadores/,
  );
});
const recognized = (text) => ({
  text,
  offsets: { from: 100, to: 450 },
  tokens: [{ text, offsets: { from: 100, to: 450 }, p: 0.97 }],
});
test("audio transcript comparison preserves script spelling and punctuation", () => {
  const r = reconcile("Hammer!", [recognized(" hammer.")], 1);
  assert.deepEqual(r.words, [{ text: "Hammer!", start: 0.1, end: 0.45 }]);
  assert.equal(r.confidence, 0.97);
});
test("transcription mismatches and ambiguous word intervals block delivery", () => {
  assert.throws(
    () => reconcile("Feather", [recognized("hammer")], 1),
    /no coincide/,
  );
  assert.throws(
    () => reconcile("the heavy hammer", [recognized("the heavy hammer")], 1),
    /ambigua/,
  );
});
test("worker pool bounds resource usage and reports failures", async () => {
  let active = 0,
    max = 0,
    done = 0;
  await workers([1, 2, 3, 4], 2, async () => {
    active++;
    max = Math.max(max, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    done++;
  });
  assert.equal(max, 2);
  assert.equal(done, 4);
  await assert.rejects(
    workers([1, 2, 3], 1, async () => {
      throw Error("stop");
    }),
    /stop/,
  );
});
test("subprocess failures are not silently treated as success", async () => {
  await assert.rejects(
    run(process.execPath, ["-e", "process.exit(3)"]),
    /salida 3/,
  );
});

test("short words without individual boundaries use a two-word cue", () => {
  const a = recognized(" a");
  a.offsets = { from: 100, to: 100 };
  a.tokens[0].offsets = { from: 100, to: 100 };
  const b = recognized(" feather");
  b.offsets = { from: 100, to: 450 };
  const r = reconcile("a feather", [a, b], 1);
  assert.equal(r.words.length, 1);
  assert.equal(r.words[0].text, "a feather");
  assert.equal(r.words[0].start, 0.1);
  assert.equal(r.words[0].end, 0.45);
});

test("shared cache locks serialize different production jobs", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "shorts-cache-lock-"),
  );
  const lock = path.join(directory, "asset.lock");
  let active = 0,
    max = 0,
    completed = 0;
  try {
    await Promise.all(
      [1, 2, 3].map(() =>
        withCacheLock(lock, async () => {
          active++;
          max = Math.max(max, active);
          await new Promise((resolve) => setTimeout(resolve, 10));
          active--;
          completed++;
        }),
      ),
    );
    assert.equal(max, 1);
    assert.equal(completed, 3);
    await assert.rejects(fs.stat(lock));
    await assert.rejects(
      withCacheLock(lock, async () => {
        throw Error("failed asset");
      }),
      /failed asset/,
    );
    await assert.rejects(fs.stat(lock));
  } finally {
    await fs.rm(directory, { recursive: true });
  }
});
