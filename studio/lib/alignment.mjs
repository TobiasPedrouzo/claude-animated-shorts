import path from "node:path";
import { readFile, writeFile, stat } from "node:fs/promises";
const small = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const tens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
function number(n) {
  if (n < 20) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? small[n % 10] : "");
  if (n < 1000)
    return (
      small[Math.floor(n / 100)] + "hundred" + (n % 100 ? number(n % 100) : "")
    );
  if (n >= 1900 && n < 2000) return "nineteen" + number(n - 1900);
  return String(n);
}
export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\d+/g, (n) => number(Number(n)))
    .replace(/[^a-z]/g, "");
}
export function reconcile(narration, transcription, duration) {
  const heard = transcription
    .filter((s) => normalize(s.text))
    .map((s) => {
      const tokens = (s.tokens || []).filter(
        (t) => normalize(t.text) && t.offsets?.to > t.offsets?.from,
      );
      const start =
        (tokens.length
          ? Math.min(...tokens.map((t) => t.offsets.from))
          : s.offsets.from) / 1000;
      const end =
        (tokens.length
          ? Math.max(...tokens.map((t) => t.offsets.to))
          : s.offsets.to) / 1000;
      return {
        text: s.text.trim(),
        key: normalize(s.text),
        start,
        end,
        confidence: tokens.length
          ? tokens.reduce((a, t) => a + t.p, 0) / tokens.length
          : null,
      };
    });
  const original = narration.trim().split(/\s+/),
    source = original.map(normalize).join(""),
    recognized = heard.map((w) => w.key).join("");
  if (source !== recognized)
    throw Error(
      `La transcripción no coincide con el guion. Revisa pronunciación/alineación.\nGuion: ${narration}\nAudio reconocido: ${heard.map((w) => w.text).join(" ")}`,
    );
  let offset = 0;
  for (const w of heard) {
    w.a = offset;
    offset += w.key.length;
    w.b = offset;
  }
  offset = 0;
  const mapped = [];
  for (const text of original) {
    const key = normalize(text),
      a = offset,
      b = a + key.length;
    offset = b;
    if (!key) continue;
    const overlapping = heard.filter((w) => w.b > a && w.a < b);
    const start = overlapping[0].start,
      end = Math.min(duration, overlapping.at(-1).end);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > duration + 0.01
    )
      throw Error("Tiempos de audio inválidos");
    mapped.push({ text, start, end });
  }
  // Preserve real audio boundaries. When a short word has no interval, display a two-word cue rather than inventing its duration.
  const words = [];
  for (let i = 0; i < mapped.length; i++) {
    let cue = { ...mapped[i] };
    if (
      cue.end <= cue.start ||
      (i + 1 < mapped.length && mapped[i + 1].start < cue.end - 0.001)
    ) {
      if (i + 1 < mapped.length) {
        const next = mapped[++i];
        cue = {
          text: cue.text + " " + next.text,
          start: Math.min(cue.start, next.start),
          end: Math.max(cue.end, next.end),
        };
      } else if (words.length && words.at(-1).text.split(/\s+/).length === 1) {
        const prev = words.pop();
        cue = {
          text: prev.text + " " + cue.text,
          start: prev.start,
          end: Math.max(prev.end, cue.end),
        };
      }
    }
    if (
      cue.end <= cue.start ||
      cue.text.split(/\s+/).length > 2 ||
      (words.length && cue.start < words.at(-1).end - 0.001)
    )
      throw Error(
        "Alineación ambigua: requiere revisión manual, no se estiman tiempos",
      );
    words.push(cue);
  }

  const confidence =
    heard
      .filter((w) => w.confidence !== null)
      .reduce((a, w) => a + w.confidence, 0) /
    heard.filter((w) => w.confidence !== null).length;
  if (!Number.isFinite(confidence) || confidence < 0.55)
    throw Error("Confianza insuficiente para subtitular sin revisión");
  return { words, confidence };
}
export async function alignAudio({ audio, report, narration, run, root, log }) {
  const model =
    process.env.SHORTS_WHISPER_MODEL ||
    path.join(root, ".cache/models/ggml-base.en.bin");
  try {
    if ((await stat(model)).size < 10000000) throw Error();
  } catch {
    throw Error(
      "Falta el modelo local de Whisper. Sigue docs/SETUP.md o configura SHORTS_WHISPER_MODEL.",
    );
  }
  const raw = JSON.parse(await readFile(report, "utf8"));
  if (raw.words.length) return raw;
  const wav = audio + ".align.wav",
    prefix = audio + ".whisper";
  await run("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    audio,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    wav,
  ]);
  let aligned, result, lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const output = prefix + (attempt ? ".retry" : "");
    const args = [
      "-m",
      model,
      "-f",
      wav,
      "-l",
      "en",
      "-ml",
      "1",
      "-sow",
      "-ojf",
      "-of",
      output,
      "-ng",
    ];
    if (attempt) args.push("--prompt", narration);
    await run("whisper-cli", args, {
      log: log + (attempt ? ".retry" : ""),
      timeout: 180000,
    });
    result = JSON.parse(await readFile(output + ".json", "utf8"));
    try {
      aligned = reconcile(narration, result.transcription, raw.duration);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!aligned) throw lastError;

  const value = {
    ...raw,
    ...aligned,
    timing: "whisper.cpp-audio-word-timestamps-exact-transcript-check",
    groupedCues: aligned.words.filter((w) => w.text.split(/\s+/).length > 1)
      .length,
    model: path.basename(model),
  };
  await writeFile(report, JSON.stringify(value, null, 2) + "\n");
  return value;
}
