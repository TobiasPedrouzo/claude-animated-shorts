# Rechazo de la dirección visual del prototipo nativo

La demo `feather` no es una muestra de calidad aprobada. La dirección visual fue rechazada y el motor se conserva únicamente como experimento técnico. La rama principal original no se reemplazó; el PR permanece en borrador.

## Problemas concretos

- Composición con grandes áreas vacías y acción concentrada en una franja de la pantalla.
- Escenas casi idénticas que cambian una pose o un objeto sin una puesta en escena específica.
- Movimiento mecánico, interpretación limitada e interacciones que no sostienen la narración.
- Objetos y explicaciones presentados como diagramas repetidos, con poca continuidad dramática.
- Cámara e iluminación demasiado limitadas para el nivel buscado.
- Los controles verificaron archivo, geometría y tiempos. No demostraron una buena historia visual ni una locución convincente.

El error de criterio fue presentar funcionamiento técnico y velocidad como evidencia de una mejora de calidad, y relegar la base visual original a una referencia mientras el sustituto era mucho más limitado.

## Efecto operativo

`studio/production-status.json` registra el rechazo. `render` requiere ahora `--experimental-native`; `npm run demo` no produce un video automáticamente. `demo:experimental` y `smoke` identifican explícitamente pruebas. Aprobación y exportación del prototipo quedan bloqueadas. Las cachés, fuentes y pruebas se conservan para recuperar componentes útiles sin consolidar su estética.

## Criterio de corrección

Mantener los personajes stickman solicitados y recuperar la riqueza de dirección del repositorio original: escenas diseñadas para cada acción, planos con intención, ocupación útil de la pantalla, profundidad, iluminación, actuación, contacto físico y continuidad. El render sigue sujeto al requisito local Swift/AVFoundation; adaptar técnicas no significa copiar la estética de otra persona ni cambiar de tecnología silenciosamente.

Evaluar primero una secuencia corta con cambios de plano y una interacción completa. Revisar imagen en movimiento y audio reales. No repetir una producción de 60 segundos con la composición rechazada. No declarar una nueva dirección aceptada por pasar pruebas técnicas, conseguir más fps o asignar puntuaciones sin evidencia.
