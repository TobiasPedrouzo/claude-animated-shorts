# Implementación

> **Estado actual:** la dirección visual del prototipo fue rechazada. Este documento conserva información técnica del experimento; no acredita calidad de producción. Renderizar requiere `--experimental-native`; aprobación y exportación están deshabilitadas.

La base original queda preservada en `templates/` y `references/`, con su licencia MIT. El motor de producción nuevo está separado en `studio/`. Los fotogramas de estudio no son recursos de producción.

1. Esquema compartido, validación de objetos, personajes, acciones, fuentes y posiciones.
2. Motor determinista Swift/CoreGraphics/AVFoundation, narración local con marcadores del proveedor o tiempos obtenidos del audio con Whisper.
3. Caché por contenido de voz y escenas; recompilación del motor solo cuando cambia el código.
4. Ensamblaje nativo, sonido original, subtítulos por palabra, exportación local.
5. QA técnico que bloquea errores, hojas de contacto y aprobación visual independiente.
6. Interfaz de Claude Code y pruebas repetibles.

La prioridad es una ruta local reproducible. Las composiciones Three.js originales siguen siendo plantillas de referencia y no se presentan como un segundo motor terminado. No se publica ni se sube ningún video.
