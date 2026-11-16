# Reglas de trabajo

- La comunicación con el usuario es en español; guiones y contenido del canal en inglés estadounidense natural.
- El motor de producción es Swift/CoreGraphics/AVFoundation local. FFmpeg se usa para inspección independiente, no como sustituto silencioso del render nativo.
- Nunca publicar públicamente. Cualquier prueba privada de YouTube necesita autorización separada y credenciales.
- Preservar el Observer: figura encapuchada, silueta casi negra, rostro oculto, dos ojos pálidos cian, sin boca ni nariz.
- No declarar QA visual/creativo aprobado sin una revisión real de fotogramas y narración. Distinguir QA técnico de aceptación editorial.
- Ejecutar `npm test`, una prueba de render y comprobar metadatos y fotogramas representativos tras cambiar el motor.
- Nunca incorporar fotogramas de `references/frames` o `references/sheets` en videos producidos.
