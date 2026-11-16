import { createHash } from "node:crypto";
import { normalize } from "./alignment.mjs";
export const ACTIONS = [
  "idle",
  "walk",
  "point",
  "grab",
  "push",
  "fall",
  "celebrate",
  "surprise",
];
export const PROPS = [
  "hammer",
  "feather",
  "machine",
  "table",
  "ball",
  "arrow",
  "air",
  "moon",
  "book",
  "chamber",
];
export const BACKGROUNDS = ["paper", "lab", "moon"];
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const finite = (x, min, max) =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
export const digest = (obj) =>
  createHash("sha256").update(JSON.stringify(obj)).digest("hex");
export function validatePlan(p) {
  assert(p && p.version === 1, "version debe ser 1");
  assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.id), "id inválido");
  assert(
    typeof p.title === "string" && p.title.length > 0 && p.title.length <= 140,
    "title inválido",
  );
  assert(p.language === "en-US", "El contenido del canal debe estar en en-US");
  assert(
    p.voice?.provider === "apple",
    "Este motor requiere voz apple con marcadores verificables",
  );
  assert(finite(p.voice.rate, 0.4, 0.6), "voice.rate fuera de rango 0.4–0.6");
  assert(
    typeof p.voice.name === "string" && p.voice.name.length > 0,
    "voice.name obligatorio",
  );
  assert(
    Array.isArray(p.sources) && Array.isArray(p.facts),
    "sources y facts obligatorios",
  );
  const sourceIds = new Set();
  for (const s of p.sources) {
    assert(
      typeof s.id === "string" && !sourceIds.has(s.id),
      "source id duplicado",
    );
    sourceIds.add(s.id);
    assert(/^https:\/\//.test(s.url), "Fuente debe usar HTTPS");
    assert(
      typeof s.evidence === "string" && s.evidence.length > 0,
      "Fuente sin evidencia",
    );
  }
  const factIds = new Set();
  for (const f of p.facts) {
    assert(!factIds.has(f.id) && typeof f.id === "string", "fact id duplicado");
    factIds.add(f.id);
    assert(sourceIds.has(f.source), "Fuente de hecho no definida");
    assert(typeof f.claim === "string" && f.claim.length > 0, "Hecho vacío");
  }
  assert(
    Array.isArray(p.scenes) && p.scenes.length > 0 && p.scenes.length <= 60,
    "Se requieren 1–60 escenas",
  );
  const ids = new Set();
  let count = 0;
  for (const s of p.scenes) {
    assert(
      typeof s.id === "string" && /^[a-z0-9-]+$/.test(s.id) && !ids.has(s.id),
      "scene id inválido o duplicado",
    );
    ids.add(s.id);
    assert(
      typeof s.narration === "string" &&
        s.narration.trim().length > 0 &&
        s.narration.length <= 800,
      "Narración vacía o excesiva",
    );
    count += s.narration.trim().split(/\s+/).length;
    assert(
      BACKGROUNDS.includes(s.background),
      "Fondo no definido: " + s.background,
    );
    assert(["cut", "match"].includes(s.transition), "Transición no definida");
    assert(
      Array.isArray(s.facts) && s.facts.every((id) => factIds.has(id)),
      "Referencia factual no definida",
    );
    assert(
      s.dramatization === true || s.facts.length > 0,
      "Escena sin evidencia ni indicación de dramatización",
    );
    assert(
      Array.isArray(s.characters) &&
        s.characters.length > 0 &&
        s.characters.length <= 4,
      "Se requieren 1–4 personajes",
    );
    const cast = new Set();
    for (const c of s.characters) {
      assert(
        typeof c.id === "string" && !cast.has(c.id),
        "Personaje duplicado",
      );
      cast.add(c.id);
      assert(
        ["stickman", "observer"].includes(c.kind),
        "Tipo de personaje desconocido",
      );
      assert(ACTIONS.includes(c.action), "Acción no definida: " + c.action);
      assert(
        finite(c.x, 140, 940) && finite(c.toX, 140, 940),
        "Posición de personaje fuera de escena",
      );
      assert(finite(c.scale, 0.4, 1.4), "Escala inválida");
      assert(/^#[0-9a-f]{6}$/i.test(c.accent), "Color inválido");
      if (c.kind === "observer")
        assert(
          c.action === "idle",
          "El Observer usa únicamente su pose canónica",
        );
    }
    assert(Array.isArray(s.props), "props obligatorio");
    const propIds = new Set();
    for (const o of s.props) {
      assert(
        typeof o.id === "string" && !propIds.has(o.id),
        "Prop id duplicado",
      );
      propIds.add(o.id);
      assert(PROPS.includes(o.kind), "Objeto no definido: " + o.kind);
      assert(
        finite(o.x, 80, 1000) &&
          finite(o.y, 340, 1410) &&
          finite(o.toY, 340, 1410),
        "Objeto fuera de escena",
      );
      assert(finite(o.scale, 0.3, 2), "Escala de objeto inválida");
      if (o.motion !== undefined)
        assert(
          ["ease", "gravity"].includes(o.motion),
          "Movimiento de objeto desconocido",
        );
      if (o.toX !== undefined)
        assert(finite(o.toX, 80, 1000), "Objeto sale de escena");
      if (o.attachTo !== undefined)
        assert(cast.has(o.attachTo), "Objeto unido a personaje inexistente");
      if (o.releaseAt !== undefined)
        assert(finite(o.releaseAt, 0, 1), "releaseAt fuera de rango");
    }
    assert(
      s.camera &&
        ["hold", "pan", "follow", "shake", "zoom"].includes(s.camera.mode),
      "Cámara desconocida",
    );
    assert(finite(s.camera.zoom, 1, 1.15), "Zoom inseguro");
    assert(finite(s.camera.pan, -60, 60), "Pan inseguro");
    assert(
      ["none", "click", "whoosh", "impact"].includes(s.sound),
      "Sonido desconocido",
    );
  }
  assert(count <= 1600, "Guion demasiado largo");
  return p;
}
export function compileTimeline(p, voices, fps = 30) {
  let frame = 0;
  const words = [];
  const scenes = p.scenes.map((s, i) => {
    const v = voices[i];
    assert(
      v && finite(v.duration, 0.01, 120) && v.words.length > 0,
      "Faltan marcadores de voz",
    );
    assert(
      normalize(v.words.map((w) => w.text).join(" ")) ===
        normalize(s.narration),
      "Los subtítulos no corresponden a la narración",
    );
    const n = Math.ceil((v.duration + 0.035) * fps),
      start = frame / fps;
    let prev = -1;
    for (const w of v.words) {
      assert(
        finite(w.start, 0, v.duration) &&
          finite(w.end, w.start, v.duration + 0.001) &&
          w.end > w.start &&
          w.start >= prev,
        "Marcadores inválidos",
      );
      prev = w.end;
      words.push({ ...w, start: w.start + start, end: w.end + start });
    }
    const result = {
      ...s,
      start,
      end: (frame + n) / fps,
      frames: n,
      voiceDuration: v.duration,
    };
    frame += n;
    return result;
  });
  return { ...p, fps, duration: frame / fps, frames: frame, scenes, words };
}
export function srt(words) {
  const stamp = (t) => {
    const n = Math.round(t * 1000);
    return `${String(Math.floor(n / 3600000)).padStart(2, "0")}:${String(Math.floor(n / 60000) % 60).padStart(2, "0")}:${String(Math.floor(n / 1000) % 60).padStart(2, "0")},${String(n % 1000).padStart(3, "0")}`;
  };
  return words
    .map(
      (w, i) => `${i + 1}\n${stamp(w.start)} --> ${stamp(w.end)}\n${w.text}\n`,
    )
    .join("\n");
}
