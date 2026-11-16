# Validación ejecutada

Fecha: 16 de noviembre de 2026. Los resultados son locales; no se atribuyen a CI ni a una sesión de Claude Code que no se haya ejecutado.

## Implementado y probado

- Instalación npm reproducible sin dependencias de ejecución (`npm ci --ignore-scripts --offline`).
- Compilación optimizada del motor Swift y diagnóstico de voces/herramientas.
- Trece pruebas automatizadas de contratos, referencias, posiciones, tiempos, correspondencia audio-guion, agrupación de palabras cortas, concurrencia y errores de procesos.
- Render de cinco escenas: caminar, agarrar un libro unido a la mano, señalar, empujar y caer. Dos stickman y aparición silenciosa del Observer en el borde de la última escena.
- Render completo del corto original `feather`, con 24 escenas y fuentes NASA/Harvard preservadas.
- Revisión independiente del MP4: 1080×1920, H.264/AAC, 30 fps, 69 segundos, 2.070 fotogramas decodificados y 20 controles técnicos aprobados. Pico de audio −2,3 dBFS.
- Inspección de hojas de fotogramas y del aterrizaje de los dos objetos: los extremos inferiores coinciden con la línea del suelo. También se inspeccionó la hoja del rig, incluido el libro y el Observer.
- Repetición con caché y cambio de una cámara: 23/24 escenas reutilizadas, 24/24 voces reutilizadas. Los identificadores de motor por medición están preservados.
- El video, modelo descargado y fotogramas generados permanecen locales; no se publicaron ni se subieron a YouTube.

## Preparado o parcialmente validado

- Las instrucciones y el comando de Claude Code están creados según su formato documentado. No se probaron desde una sesión autenticada real de Claude Code.
- Los workflows de GitHub prueban los contratos y compilan Swift. Su resultado remoto debe consultarse después de ejecutar CI.
- Las mejoras de error explícito en la plantilla histórica Remotion se revisaron estáticamente. Esa plantilla no se renderizó ni se comprobó con TypeScript en esta prueba, porque conserva dependencias y recursos externos propios.
- La voz y los subtítulos se generaron y verificaron con reconocimiento del audio, pero no se realizó una escucha editorial. La sincronización percibida, la interpretación y el ritmo requieren esa revisión; el estado sigue siendo `NEEDS_REVIEW`.

## Pendiente fuera del motor local

Kokoro, ElevenLabs, API autónoma de Anthropic, dashboard, producción programada y publicación. No se declaran integraciones completas ni se necesitan para repetir el corto local.

La mejora es una ruta operativa, medible y revisable. No demuestra ser "el mejor del mundo" ni permite garantizar automáticamente que cualquier guion será un buen video.
