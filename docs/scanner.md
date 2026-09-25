# Scanner Engine

`ScannerInput` acepta lectores USB HID y Bluetooth HID que se comportan como teclado.

## Conectar un lector

1. Vincular el lector con la tablet o computadora.
2. Configurarlo para enviar `ENTER` después del código.
3. Abrir el kiosco correspondiente.
4. Escanear un identificador de prueba y confirmar el resultado visual.

El componente mantiene el foco, limpia el campo después de cada lectura, evita el doble envío inmediato y genera una clave única por intento. La regla de negocio del módulo genera además una clave idempotente por evento o periodo.

## Cámara

`CameraScannerProvider` define el contrato de una implementación futura. La cámara no está ligada al componente ni a una marca de hardware.

## Configurar un dispositivo

Cada kiosco usa un `deviceId` estable en su configuración. Los eventos conservan ese identificador, la fuente del escaneo y su clave idempotente.
