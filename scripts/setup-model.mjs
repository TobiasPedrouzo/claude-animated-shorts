import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, ".cache/models/ggml-base.en.bin");
const expected =
  "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002";
const sha = (b) => createHash("sha256").update(b).digest("hex");
try {
  try {
    if (sha(await readFile(target)) === expected) {
      console.log("Modelo local verificado; no se descarga de nuevo.");
      process.exit(0);
    }
  } catch {}
  await mkdir(path.dirname(target), { recursive: true });
  console.log("Descargando base.en (~142 MiB)…");
  const response = await fetch(
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
    { signal: AbortSignal.timeout(180000) },
  );
  if (!response.ok) throw Error(`Descarga fallida: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha(bytes) !== expected)
    throw Error(
      "El checksum del modelo cambió. Se requiere revisar la versión antes de instalar.",
    );
  await writeFile(target + ".partial", bytes);
  await rename(target + ".partial", target);
  console.log("Modelo descargado y verificado.");
} catch (e) {
  await unlink(target + ".partial").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
}
