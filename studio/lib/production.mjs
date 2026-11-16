import { readFile } from "node:fs/promises";

export async function requireProductionApproval() {
  const status = JSON.parse(
    await readFile(
      new URL("../production-status.json", import.meta.url),
      "utf8",
    ),
  );
  if (status.nativeRendererStatus !== "approved") {
    throw new Error(
      "La dirección visual del motor nativo está rechazada. No está habilitado para producción, aprobación ni exportación. Solo se permiten pruebas explícitas con --experimental-native.",
    );
  }
}
