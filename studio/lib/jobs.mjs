import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  stat,
  readdir,
  open,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validatePlan, compileTimeline, digest, srt } from "./plan.mjs";
import { alignAudio } from "./alignment.mjs";
export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const readJSON = async (p) => JSON.parse(await readFile(p, "utf8"));
export async function writeJSON(p, obj) {
  await mkdir(path.dirname(p), { recursive: true });
  const temp = p + `.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(obj, null, 2) + "\n");
  await rename(temp, p);
}
export async function exists(p) {
  try {
    return (await stat(p)).size > 0;
  } catch {
    return false;
  }
}
export async function withCacheLock(lockPath, operation, timeout = 600000) {
  const deadline = Date.now() + timeout;
  let handle;
  while (!handle) {
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() > deadline)
        throw Error("Caché ocupada; revisar el bloqueo: " + lockPath);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}
export function run(command, args, { cwd = ROOT, log, timeout = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1500).unref();
    }, timeout);
    child.stdout.on("data", (d) => {
      stdout += d;
      if (stdout.length > 300000) stdout = stdout.slice(-300000);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 300000) stderr = stderr.slice(-300000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      try {
        if (log) {
          await mkdir(path.dirname(log), { recursive: true });
          await writeFile(log, stdout + "\n" + stderr);
        }
      } catch (e) {
        reject(e);
        return;
      }
      if (code === 0 && !timedOut) resolve(stdout);
      else
        reject(
          new Error(
            `${command}: ${timedOut ? "tiempo agotado" : `salida ${code}`}\n${(stderr || stdout).slice(-2400)}`,
          ),
        );
    });
  });
}
export async function engineHash() {
  const names = (await readdir(path.join(ROOT, "studio/native")))
    .filter((x) => x.endsWith(".swift"))
    .sort();
  return digest(
    await Promise.all(
      names.map((n) => readFile(path.join(ROOT, "studio/native", n), "utf8")),
    ),
  );
}
export async function build() {
  await mkdir(path.join(ROOT, ".build"), { recursive: true });
  const sourceHash = await engineHash();
  const version = await run("swiftc", ["--version"]);
  const local = await readJSON(
    path.join(ROOT, ".build/local-config.json"),
  ).catch(() => ({}));
  const sdk = process.env.SHORTS_SDKROOT || local.sdk || "",
    overlay = process.env.SHORTS_SDK_OVERLAY || local.overlay || "";
  const key = digest({
    sourceHash,
    version,
    sdk,
    overlay: overlay ? await readFile(overlay, "utf8") : "",
  });
  const bin = path.join(ROOT, ".build", `studio-${key.slice(0, 16)}`);
  if (await exists(bin)) return { bin, key, cached: true };
  const names = (await readdir(path.join(ROOT, "studio/native")))
    .filter((x) => x.endsWith(".swift"))
    .map((n) => path.join(ROOT, "studio/native", n))
    .sort();
  const args = [
    "-O",
    "-swift-version",
    "5",
    "-module-cache-path",
    path.join(ROOT, ".build/module-cache"),
    ...names,
    "-o",
    bin + ".partial",
  ];
  if (sdk) args.unshift("-sdk", sdk);
  if (overlay) args.unshift("-vfsoverlay", overlay);
  let compiled = false;
  await withCacheLock(bin + ".lock", async () => {
    if (await exists(bin)) return;
    console.log("Compilando motor nativo…");
    await run("swiftc", args, {
      log: path.join(ROOT, ".build/compile.log"),
      timeout: 300000,
    });
    await rename(bin + ".partial", bin);
    compiled = true;
  });
  return { bin, key, cached: !compiled };
}
export async function workers(items, count, fn) {
  let i = 0;
  let error;
  await Promise.all(
    Array.from({ length: Math.min(count, items.length) }, async () => {
      while (!error) {
        const at = i++;
        if (at >= items.length) return;
        try {
          await fn(items[at], at);
        } catch (e) {
          error = e;
          return;
        }
      }
    }),
  );
  if (error) throw error;
}
export async function fileHash(p) {
  return createHash("sha256")
    .update(await readFile(p))
    .digest("hex");
}
export async function render(
  project,
  { profile = "final", concurrency = 2 } = {},
) {
  if (!["preview", "final"].includes(profile))
    throw Error("Perfil debe ser preview o final");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw Error("concurrency debe ser 1–4");
  const p = validatePlan(await readJSON(project)),
    out = path.join(ROOT, "outputs", p.id, profile);
  await mkdir(out, { recursive: true });
  const lock = path.join(ROOT, "outputs", p.id, ".lock");
  let lockFile;
  try {
    lockFile = await import("node:fs/promises").then((fs) =>
      fs.open(lock, "wx"),
    );
  } catch {
    throw Error(
      "El proyecto tiene otro trabajo activo; comprueba su estado antes de eliminar .lock",
    );
  }
  const runID =
    new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.pid;
  const started = performance.now(),
    stats = {
      voiceHits: 0,
      sceneHits: 0,
      sceneMisses: 0,
      voiceMisses: 0,
      profile,
    },
    events = [];
  const status = async (state, detail = {}) => {
    const e = { at: new Date().toISOString(), state, ...detail };
    events.push(e);
    await writeJSON(path.join(out, "status.json"), { ...e, events });
    await writeJSON(path.join(out, "history", runID + ".json"), {
      runID,
      events,
      stats,
    });
    console.log(state, detail.message || "");
  };
  try {
    await status("VALIDATED");
    const engine = await build();
    stats.buildCached = engine.cached;
    const voiceDir = path.join(ROOT, ".cache/voice"),
      sceneDir = path.join(ROOT, ".cache/scenes");
    await mkdir(voiceDir, { recursive: true });
    await mkdir(sceneDir, { recursive: true });
    const voices = [],
      audioPaths = [],
      videoPaths = [];
    const model =
      process.env.SHORTS_WHISPER_MODEL ||
      path.join(ROOT, ".cache/models/ggml-base.en.bin");
    const speechVersion = digest({
      speech: await readFile(
        path.join(ROOT, "studio/native/Speech.swift"),
        "utf8",
      ),
      model: await fileHash(model),
      alignment: await readFile(
        path.join(ROOT, "studio/lib/alignment.mjs"),
        "utf8",
      ),
      system:
        process.platform + process.arch + (await import("node:os")).release(),
    });
    const sourcePlan = path.join(out, "source.json");
    await writeJSON(sourcePlan, p);
    await status("NARRATING");
    // Serial voice requests avoid contention in the operating system's speech service.
    for (let i = 0; i < p.scenes.length; i++) {
      const key = digest({
          speechVersion,
          voice: p.voice,
          text: p.scenes[i].narration,
        }),
        audio = path.join(voiceDir, key + ".caf"),
        report = path.join(voiceDir, key + ".json");
      let hit = false;
      await withCacheLock(audio + ".lock", async () => {
        if ((await exists(audio)) && (await exists(report))) {
          stats.voiceHits++;
          hit = true;
        } else {
          await run(
            engine.bin,
            [
              "speech",
              sourcePlan,
              String(i),
              audio + ".partial.caf",
              report + ".partial.json",
            ],
            { log: path.join(out, `voice-${i}.log`), timeout: 140000 },
          );
          const result = await alignAudio({
            audio: audio + ".partial.caf",
            report: report + ".partial.json",
            narration: p.scenes[i].narration,
            run,
            root: ROOT,
            log: path.join(out, `alignment-${i}.log`),
          });
          if (result.duration <= 0 || !result.words.length)
            throw Error("Síntesis vacía");
          await rename(audio + ".partial.caf", audio);
          await rename(report + ".partial.json", report);
          stats.voiceMisses++;
        }
      });
      voices[i] = await readJSON(report);
      audioPaths[i] = audio;
      console.log(
        `Voz ${i + 1}/${p.scenes.length}${hit ? " (caché activa)" : ""}`,
      );
    }
    const timeline = compileTimeline(p, voices),
      timelinePath = path.join(out, "timeline.json");
    await writeJSON(timelinePath, timeline);
    await writeFile(path.join(out, "captions.srt"), srt(timeline.words));
    const width = profile === "final" ? 1080 : 540,
      height = (width * 16) / 9;
    await status("RENDERING");
    await workers(p.scenes, concurrency, async (s, i) => {
      const scene = timeline.scenes[i],
        key = digest({
          engine: engine.key,
          s,
          voice: voices[i],
          fps: 30,
          width,
          height,
        }),
        video = path.join(sceneDir, key + ".mp4");
      videoPaths[i] = video;
      await withCacheLock(video + ".lock", async () => {
        if ((await exists(video)) && (await exists(video + ".layout.json"))) {
          stats.sceneHits++;
          return;
        }
        const job = path.join(out, `scene-${i}.job.json`);
        await writeJSON(job, {
          scene,
          words: voices[i].words,
          frames: scene.frames,
          fps: 30,
          width,
          height,
        });
        await run(engine.bin, ["render", job, video + ".partial.mp4"], {
          log: path.join(out, `scene-${i}.log`),
          timeout: 300000,
        });
        await rename(video + ".partial.mp4", video);
        await rename(
          video + ".partial.mp4.layout.json",
          video + ".layout.json",
        );
        stats.sceneMisses++;
        console.log(`Escena ${i + 1}/${p.scenes.length}`);
      });
    });
    timeline.layoutReports = await Promise.all(
      videoPaths.map((v) => readJSON(v + ".layout.json")),
    );
    await writeJSON(timelinePath, timeline);
    const output = path.join(out, "video.mp4"),
      assemblyKey = digest({
        engine: engine.key,
        timeline,
        videoPaths,
        audioPaths,
      }),
      assemblyCache = path.join(out, "assembly-key.json");
    const cachedAssembly =
      (await exists(output)) &&
      (await exists(assemblyCache)) &&
      (await readJSON(assemblyCache)).key === assemblyKey;
    stats.assemblyCached = cachedAssembly;
    if (!cachedAssembly) {
      await status("MIXING");
      const soundtrack = path.join(out, "soundtrack.caf");
      await run(engine.bin, ["soundtrack", timelinePath, soundtrack], {
        log: path.join(out, "soundtrack.log"),
      });
      const job = path.join(out, "assembly.json");
      await writeJSON(job, {
        plan: timeline,
        videos: videoPaths,
        voices: audioPaths,
        soundtrack,
        output: output + ".partial.mp4",
      });
      await run(engine.bin, ["assemble", job], {
        log: path.join(out, "export.log"),
        timeout: 650000,
      });
      await rename(output + ".partial.mp4", output);
      await writeJSON(assemblyCache, { key: assemblyKey });
    }
    await status("CHECKING");
    await run(
      "python3",
      [
        path.join(ROOT, "studio/qa.py"),
        output,
        timelinePath,
        path.join(out, "qa"),
        profile,
      ],
      { log: path.join(out, "qa.log"), timeout: 300000 },
    );
    const qa = await readJSON(path.join(out, "qa/report.json"));
    stats.seconds = Number(((performance.now() - started) / 1000).toFixed(3));
    stats.videoSHA256 = await fileHash(output);
    stats.engine = engine.key;
    stats.output = output;
    stats.qa = qa.technicalPassed;
    await writeJSON(path.join(out, "run.json"), stats);
    await status("NEEDS_REVIEW", {
      message:
        "QA técnico aprobado. Falta revisar imagen, narración y continuidad.",
      videoSHA256: stats.videoSHA256,
    });
    return { out, output, stats };
  } catch (e) {
    await status("FAILED", { message: e.message });
    throw e;
  } finally {
    await lockFile.close();
    await import("node:fs/promises").then((fs) => fs.unlink(lock));
  }
}
