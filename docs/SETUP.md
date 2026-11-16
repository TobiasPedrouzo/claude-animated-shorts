# Instalación local

## Requisitos

- macOS y herramientas de desarrollo de Apple completas (`swiftc` con acceso a Foundation, AppKit y AVFoundation).
- Node.js ≥22 y Python 3.
- FFmpeg y ffprobe. Se usan para conversión del audio para análisis y para revisión independiente; el video lo codifica y ensambla AVFoundation.
- whisper.cpp con `whisper-cli` en PATH. Se probó con 1.9.5.
- Voz Samantha en-US instalada. `npm run doctor` enumera las voces disponibles; se puede seleccionar otra en-US en el JSON.

Con Homebrew ya instalado, las dependencias auxiliares se pueden instalar con `brew install node ffmpeg whisper-cpp`. No se instalan servicios de pago ni se configura una cuenta de IA.

```sh
npm ci --ignore-scripts
npm run setup:models
npm run doctor
npm test
npm run smoke
npm run demo
```

La descarga usa el modelo `base.en` publicado por el proyecto whisper.cpp. Se verifica SHA-256 `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`. Fuente: [modelo](https://huggingface.co/ggerganov/whisper.cpp), [uso de whisper.cpp](https://github.com/ggml-org/whisper.cpp).

## Configuración

- `SHORTS_WHISPER_MODEL`: ruta a un modelo local compatible de Whisper. El modelo predeterminado está en `.cache/models/ggml-base.en.bin`.
- `SHORTS_SDKROOT`: SDK específico de Apple, solo cuando el SDK predeterminado no funciona.
- `SHORTS_SDK_OVERLAY`: superposición local de archivos del SDK, para diagnóstico de una instalación incompleta. No cambia el sistema.
- `.build/local-config.json`: alternativa local con `sdk` y `overlay`. No se versiona ni se exporta.

Durante la prueba en esta Mac se encontraron encabezados ausentes del SDK. Se usó una corrección temporal aislada dentro de `.build/` y el SDK macOS 15.5. Esa corrección no forma parte del código distribuido. Una instalación completa normal no debería necesitarla. Ante errores de compilación, leer `.build/compile.log`; no prometer un render si el motor no compiló.

En entornos con acceso restringido a los servicios del sistema, el codificador de AVFoundation puede devolver `Cannot Encode`. La ejecución debe tener acceso al servicio local de codificación de macOS. No se cambia a FFmpeg como sustituto del render sin avisar.

## Fallos y recuperación

- `status.json` conserva etapas y errores; cada voz/escena tiene su registro.
- El proyecto queda bloqueado mientras se ejecuta. Cada entrada compartida de caché también tiene un bloqueo para evitar escrituras simultáneas entre proyectos. Si una interrupción abrupta deja `outputs/<id>/.lock`, comprobar que no siga habiendo un trabajo activo antes de quitar únicamente ese bloqueo.
- Un fallo de reconocimiento nunca produce subtítulos inventados. Se intenta una segunda lectura con contexto; si continúa la diferencia con el guion, hay que revisar pronunciación, voz o texto.
- Las cachés completadas sobreviven a un fallo. Los archivos `.partial` no se usan como recursos válidos.
- No borrar `.cache/` para medir una ejecución "fría" sin necesidad: se pueden distinguir aciertos y fallos en `run.json`.

## Claude Code

`CLAUDE.md` dirige a `.claude/skills/stickman-shorts/SKILL.md`; `/short` aporta un acceso directo. Se sigue el formato de [skills de Claude Code](https://code.claude.com/docs/en/skills). La suscripción de Claude Code y el consumo de la API de Anthropic son cosas distintas; esta versión no hace llamadas a esa API.
