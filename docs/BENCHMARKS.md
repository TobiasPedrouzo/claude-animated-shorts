# Mediciones de producción

Medido localmente el 16 de noviembre de 2026 en esta Mac arm64. Node 26.13.1, Swift 6.2, FFmpeg 9.0.2 y whisper.cpp 1.9.5. Voz Samantha y modelo base.en. Cada tiempo incluye las etapas realmente ejecutadas y QA; la descarga inicial del modelo y la reparación temporal del SDK no se cuentan como producción de video.

| Caso | Tiempo | Voces reutilizadas | Escenas reutilizadas | Escenas renderizadas |
|---|---:|---:|---:|---:|
| Primera producción completa (revisión inicial) | 63.55 s | 0/24 | 0/24 | 24 |
| Recompilación + escenas nuevas con voz reutilizada | 28.95 s | 24/24 | 0/24 | 24 |
| Cambio de una cámara | 16.13 s | 24/24 | 23/24 | 1 |
| Ajuste final de motor y una frase | 33.54 s | 23/24 | 0/24 | 24 |
| Repetición sin cambios (final) | 5.47 s | 24/24 | 24/24 | 0 |

| Producción completa con el motor final (compilación incluida) | 68.37 s | 0/24 | 0/24 | 24 |

El MP4 final dura **69.00 segundos**, mide **1080×1920** y se decodificaron sus **2070 fotogramas**. Pasaron 20 controles técnicos. No se encontraron fotogramas negros/vacíos ni tramos congelados con el análisis espacial configurado; el pico de audio fue -2.3 dBFS.

Las primeras mediciones pertenecen a revisiones anteriores del mismo motor; cada fila conserva su identificador de motor y el SHA-256 del video en `evidence/benchmarks.json`. El caso de una cámara usa un ID de producción separado y modifica únicamente un parámetro de una escena. La ejecución reutilizó 23 escenas y las 24 voces. Algunas verificaciones se ejecutaron simultáneamente: estos valores son observaciones, no garantías ni una comparativa controlada contra otro producto.

No se borraron cachés compartidas para obtener cifras. No se midió Remotion en el mismo equipo, por lo que no se afirma una mejora porcentual contra ese motor.

El pase técnico no significa aprobación artística. La narración y su sincronización todavía deben escucharse en una revisión editorial real; la integración de instrucciones en Claude Code está preparada, pero no se probó desde una sesión autenticada de Claude Code.
