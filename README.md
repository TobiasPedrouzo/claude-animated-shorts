# Stickman Shorts Studio

Estudio local para crear Shorts originales con personajes stickman, narración en inglés estadounidense y subtítulos sincronizados con el audio. Claude Code dirige la investigación y el guion; un motor determinista Swift/CoreGraphics/AVFoundation produce los videos en la Mac.

El repositorio original de [Mr omi](https://github.com/mromidev/claude-animated-shorts) se conserva en `templates/` y `references/`, con su licencia MIT. Sus plantillas del puente son una referencia separada del motor operativo nuevo.

## Empezar

Requiere macOS con Apple Silicon o Intel, herramientas de desarrollo de Apple completas, Node.js 22+, Python 3, FFmpeg/ffprobe y whisper.cpp. No hay dependencias npm de ejecución ni generación de video de pago.

```sh
npm ci --ignore-scripts
npm run setup:models
npm run doctor
npm test
npm run smoke
npm run demo
```

La descarga del modelo local de reconocimiento (~142 MiB) ocurre una vez y verifica su checksum. La voz predeterminada es Samantha en-US, instalada en macOS. Más detalles en [SETUP](docs/SETUP.md).

## Crear otro video

En Claude Code, abrir esta carpeta y pedir:

> Usa /stickman-shorts para crear un Short original sobre un invento sorprendente. Verifica los hechos, renderiza una vista previa y revisa imagen y narración antes del final.

También está disponible `/short <tema>`. La integración de instrucciones está preparada; su ejecución desde una sesión real de Claude Code se debe verificar en ese entorno. El motor local se prueba de forma independiente.

```sh
npm run shorts -- init --id mi-corto
# Editar projects/mi-corto.json siguiendo examples/feather.json
npm run shorts -- validate --project projects/mi-corto.json
npm run shorts -- render --project projects/mi-corto.json --profile preview
npm run shorts -- render --project projects/mi-corto.json --profile final
```

El esquema está en [`studio/story.schema.json`](studio/story.schema.json), los tipos en [`studio/lib/types.ts`](studio/lib/types.ts), y la validación semántica detecta referencias inexistentes, intervalos inválidos y recursos no definidos.

## Velocidad y detalle

- Se compila el motor solo cuando cambia su código o configuración.
- Las voces y escenas se guardan por contenido. Una cámara nueva no obliga a regenerar narración; una escena modificada no obliga a renderizar las demás.
- Dos escenas se renderizan en paralelo de forma predeterminada; `--concurrency` permite 1–4.
- `preview` usa 540×960; `final`, 1080×1920, ambos a 30 fps.
- El ensamblaje nativo fija la duración y frecuencia de fotogramas. La narración determina la línea de tiempo.
- Los subtítulos usan marcadores del proveedor cuando existen; si no, reconocimiento local del audio y comprobación contra el texto. Las palabras cortas sin intervalo individual pueden agruparse de a dos. No se reparte el guion uniformemente sobre la duración.
- Se comprueban los límites reales de subtítulos, personajes y objetos en cada fotograma antes de codificar.

Ver [BENCHMARKS](docs/BENCHMARKS.md) para mediciones y sus límites. No se afirma una comparación de velocidad contra Remotion que no se haya medido.

## Calidad y entrega

Cada producción queda en `outputs/<id>/<preview|final>/`:

```text
video.mp4                 MP4 H.264/AAC
captions.srt              subtítulos externos
timeline.json             escenas, fuentes, hechos y tiempos
run.json                  tiempo medido, caché y SHA-256 del video
status.json               estado, historial y errores
qa/report.json            controles técnicos ejecutados
qa/contact.png            muestra del video completo
qa/scene-01.png …          un fotograma por escena
```

Los controles decodifican el video completo y verifican resolución, frecuencia, duración, cobertura, pistas de audio, niveles, fotogramas negros/vacíos/congelados y geometría de subtítulos/personajes/objetos. La imagen se analiza a resolución reducida para mantener un consumo de memoria acotado; defectos pequeños, colisiones semánticas y calidad artística requieren inspección.

**Un pase técnico no aprueba la calidad editorial.** El resultado queda en `NEEDS_REVIEW`. Tras inspeccionar fotogramas y escuchar el audio, se puede completar `examples/review.json` y registrar una revisión ligada al SHA-256 exacto del video:

```sh
npm run shorts -- review --id feather --file projects/feather-review.json
npm run shorts -- export --id feather --destination /ruta/local/de/entrega
```

La exportación rechaza vistas previas y revisiones obsoletas. Nunca se publica ni sube un video automáticamente.

## Alcance actual

Implementado: motor local, rig por articulaciones con IK, ocho acciones, diez objetos procedurales, cámara, identidad canónica del Observer, voz local, subtítulos del audio, sonido y música originales con reducción bajo narración, caché por escena, CLI, QA y ejemplos reproducibles.

La composición Three.js/Remotion original sigue disponible como plantilla y requiere sus dependencias y recursos externos; se añadió un error explícito ante recursos faltantes. No se presenta como un segundo motor terminado. La voz local es funcional, pero la calidad de locución comercial sigue siendo una decisión editorial. No se han integrado Kokoro, ElevenLabs, orquestación con la API de Anthropic, un dashboard, calendario de producción ni YouTube. No se necesitan para ejecutar el motor local.

## Estructura

```text
studio/native/            motor Swift y audio/ensamblaje AVFoundation
studio/lib/               validación, alineación y trabajos con caché
studio/cli.mjs            comandos
studio/qa.py              revisión técnica independiente
studio/tests/             pruebas automatizadas
examples/                 corto factual, prueba del rig y formato de revisión
.claude/                  instrucciones y comando del director
scripts/                  instalación verificable del modelo local
docs/                     instalación, arquitectura y evidencia
.github/workflows/        pruebas y compilación nativa en CI
templates/ references/    base original y material de estudio
```

Las imágenes de referencia son material de estudio; nunca se incluyen en videos producidos.
