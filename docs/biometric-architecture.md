# Arquitectura biométrica — Sprint E.2

KitchenMind usa `BiometricProvider` como frontera con hardware/SDK. El dominio no depende de una marca.

## Datos que sí conserva

- person_id
- provider
- external_template_id
- device_id opcional
- estado
- fechas de enrolamiento/revocación
- actor de auditoría

## Datos prohibidos

KitchenMind no persiste imágenes de huellas, WSQ, bitmaps, base64, plantillas ISO crudas ni blobs biométricos en D1, R2, localStorage, IndexedDB, logs o analítica.

## Hardware

El adapter físico específico permanece `PENDING DEVICE SELECTION`. El contrato de plataforma, enrolamiento y revocación sí están desacoplados del fabricante.
