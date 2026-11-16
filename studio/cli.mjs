#!/usr/bin/env node
import path from "node:path";
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  cp,
  stat,
} from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  ROOT,
  readJSON,
  writeJSON,
  exists,
  run,
  build,
  render,
  fileHash,
} from "./lib/jobs.mjs";
import { validatePlan } from "./lib/plan.mjs";
import { requireProductionApproval } from "./lib/production.mjs";
const help = `Stickman Shorts Studio — producción local\n\n npm run shorts -- doctor\n npm run shorts -- init --id mi-corto\n npm run shorts -- validate --project examples/feather.json\n npm run shorts -- render --project examples/feather.json [--profile preview|final] [--concurrency 2]\n npm run shorts -- qa --id feather --profile final\n npm run shorts -- status --id feather\n npm run shorts -- list\n npm run shorts -- preview --id feather\n npm run shorts -- review --id feather --file review.json\n npm run shorts -- export --id feather --destination /ruta/local\n\nClaude Code crea y verifica el storyboard; el motor no inventa investigación.\nEl motor nativo fue rechazado visualmente: producción, aprobación y exportación deshabilitadas. Para pruebas técnicas se requiere --experimental-native. No hay publicación automática.`;
try {
  const { positionals, values: v } = parseArgs({
    allowPositionals: true,
    options: {
      id: { type: "string" },
      project: { type: "string" },
      profile: { type: "string", default: "final" },
      concurrency: { type: "string", default: "2" },
      file: { type: "string" },
      destination: { type: "string" },
      help: { type: "boolean" },
      "experimental-native": { type: "boolean", default: false },
    },
  });
  const command = positionals[0];
  const id = () => {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(v.id || ""))
      throw Error("--id obligatorio e inválido");
    return v.id;
  };
  const out = () => {
    if (!["preview", "final"].includes(v.profile))
      throw Error("Perfil inválido");
    return path.join(ROOT, "outputs", id(), v.profile);
  };
  switch (command) {
    case "build":
      console.log(await build());
      break;
    case "doctor": {
      const checks = [];
      for (const [name, args] of [
        ["node", ["--version"]],
        ["swiftc", ["--version"]],
        ["ffmpeg", ["-version"]],
        ["ffprobe", ["-version"]],
        ["python3", ["--version"]],
        ["whisper-cli", ["--version"]],
      ]) {
        try {
          checks.push({
            name,
            ok: true,
            version: (await run(name, args)).split("\n")[0],
          });
        } catch (e) {
          checks.push({ name, ok: false, error: e.message });
        }
      }
      const model =
        process.env.SHORTS_WHISPER_MODEL ||
        path.join(ROOT, ".cache/models/ggml-base.en.bin");
      try {
        const sha = await fileHash(model);
        const size = (await stat(model)).size;
        const valid =
          size > 10000000 &&
          (process.env.SHORTS_WHISPER_MODEL ||
            sha ===
              "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002");
        checks.push({
          name: "alignment-model",
          ok: Boolean(valid),
          sha256: sha,
        });
      } catch {
        checks.push({
          name: "alignment-model",
          ok: false,
          error: "Ejecutar npm run setup:models",
        });
      }
      if (process.platform !== "darwin")
        checks.push({
          name: "macOS",
          ok: false,
          error: "El motor nativo requiere macOS",
        });
      try {
        const e = await build(),
          voices = (await run(e.bin, ["voices"])).trim().split("\n");
        checks.push({ name: "native-engine", ok: true, voices });
      } catch (e) {
        checks.push({ name: "native-engine", ok: false, error: e.message });
      }
      console.log(JSON.stringify(checks, null, 2));
      if (checks.some((x) => !x.ok)) process.exitCode = 1;
      break;
    }
    case "init": {
      const p = await readJSON(path.join(ROOT, "examples/smoke.json"));
      p.id = id();
      p.title = "New original story";
      const target = path.join(ROOT, "projects", p.id + ".json");
      if (await exists(target)) throw Error("El proyecto ya existe");
      await writeJSON(target, p);
      console.log(target);
      break;
    }
    case "validate":
      if (!v.project) throw Error("--project obligatorio");
      validatePlan(await readJSON(path.resolve(v.project)));
      console.log("Storyboard válido");
      break;
    case "render":
      if (!v.project) throw Error("--project obligatorio");
      console.log(
        JSON.stringify(
          await render(path.resolve(v.project), {
            profile: v.profile,
            concurrency: Number(v.concurrency),
            experimentalNative: v["experimental-native"],
          }),
          null,
          2,
        ),
      );
      break;
    case "list": {
      const folder = path.join(ROOT, "outputs");
      if (!(await exists(folder))) {
        console.log("Sin producciones");
        break;
      }
      for (const n of await readdir(folder)) console.log(n);
      break;
    }
    case "status":
      console.log(
        JSON.stringify(
          await readJSON(path.join(out(), "status.json")),
          null,
          2,
        ),
      );
      break;
    case "preview":
      console.log(path.join(out(), "video.mp4"));
      await run("open", [path.join(out(), "video.mp4")]);
      break;
    case "qa":
      await run("python3", [
        path.join(ROOT, "studio/qa.py"),
        path.join(out(), "video.mp4"),
        path.join(out(), "timeline.json"),
        path.join(out(), "qa"),
        v.profile,
      ]);
      console.log(await readFile(path.join(out(), "qa/report.json"), "utf8"));
      break;
    case "review": {
      await requireProductionApproval();
      if (!v.file) throw Error("--file obligatorio");
      const folder = out(),
        review = await readJSON(v.file),
        sha = await fileHash(path.join(folder, "video.mp4")),
        qa = await readJSON(path.join(folder, "qa/report.json"));
      if (!qa.technicalPassed || qa.videoSHA256 !== sha)
        throw Error("El QA técnico no corresponde a este video");
      if (
        review.videoSHA256 !== sha ||
        review.approved !== true ||
        typeof review.reviewer !== "string" ||
        !review.reviewer.trim()
      )
        throw Error("Revisión no aprobada, sin autor o de otro video");
      const dimensions = [
        "hook",
        "clarity",
        "continuity",
        "characterConsistency",
        "captions",
        "narration",
        "pacing",
        "facts",
        "ending",
      ];
      if (
        !dimensions.every(
          (k) =>
            Number.isFinite(review.scores?.[k]) &&
            review.scores[k] >= 8 &&
            review.scores[k] <= 10,
        )
      )
        throw Error(
          "Cada dimensión debe tener una valoración explícita de 8–10 para aprobar",
        );
      if (
        !Array.isArray(review.sceneNotes) ||
        review.sceneNotes.length < 1 ||
        !Array.isArray(review.framesInspected) ||
        review.framesInspected.length < 3 ||
        !review.audioListened
      )
        throw Error("Falta evidencia de revisión visual y auditiva");
      await writeJSON(path.join(folder, "review.json"), review);
      await writeJSON(path.join(folder, "status.json"), {
        state: "READY",
        at: new Date().toISOString(),
        videoSHA256: sha,
      });
      console.log("Aprobación editorial guardada");
      break;
    }
    case "export": {
      await requireProductionApproval();
      if (!v.destination) throw Error("--destination obligatorio");
      const folder = out(),
        sha = await fileHash(path.join(folder, "video.mp4")),
        review = await readJSON(path.join(folder, "review.json")),
        qa = await readJSON(path.join(folder, "qa/report.json"));
      if (
        v.profile !== "final" ||
        !qa.technicalPassed ||
        qa.videoSHA256 !== sha ||
        review.videoSHA256 !== sha ||
        !review.approved
      )
        throw Error("Se requiere un final con QA y revisión vigentes");
      const dest = path.resolve(v.destination);
      await mkdir(dest, { recursive: true });
      for (const name of [
        "video.mp4",
        "captions.srt",
        "timeline.json",
        "review.json",
        "run.json",
      ]) {
        const target = path.join(dest, name);
        if (await exists(target)) throw Error("El destino ya contiene " + name);
      }
      for (const name of [
        "video.mp4",
        "captions.srt",
        "timeline.json",
        "review.json",
        "run.json",
      ])
        await cp(path.join(folder, name), path.join(dest, name));
      await cp(path.join(folder, "qa"), path.join(dest, "qa"), {
        recursive: true,
      });
      console.log(dest);
      break;
    }
    default:
      console.log(help);
      if (command && !v.help) process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
