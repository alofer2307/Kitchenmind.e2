# Asistencia offline — Sprint E.2

La capacidad offline real depende del bridge local/hardware. El navegador no finge reconocimiento offline.

Cuando el bridge lo soporta:

1. captura identificación externa y timestamp;
2. guarda evento en cola segura sin huella cruda;
3. envía lotes al regresar Internet;
4. KitchenMind deduplica por idempotencia;
5. el bridge confirma únicamente los eventos aceptados.

Los lotes E.2 aceptan exclusivamente asistencia.
