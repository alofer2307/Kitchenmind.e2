# KitchenMind PIRA — auditoría documental y matriz de brechas (2026-11-08)

> Estado: **auditoría documental parcial**. No es inspección física, dictamen oficial de COESPRIS ni aprobación para abandonar formatos impresos. No se han cargado resultados médicos al repositorio ni se modifican tablas o registros productivos.

## Fuentes, clasificación y método
1. Requisitos confirmados durante 23 sesiones de entrevistas KitchenMind PIRA y aclaración de filtros sanitarios (laboratorios/expediente semestral).
2. Archivo real de PIRA `Bitacoras_Calidad_e_Higiene_FINAL.pdf` (23 páginas). Se enumeran páginas **del archivo**, no 23 bitácoras distintas. Los horarios y valores impresos son ejemplos/documentos de PIRA: **NO** se establecen automáticamente como parámetros aprobados para cada sucursal.
3. Norma vigente **NOM-251-SSA1-2009**, DOF oficial: https://sidof.segob.gob.mx/notas/docFuente/5133449. **Capítulo 5** general y **capítulo 7** para servicios de alimentos. **Capítulo 6** aplica a fábricas; NO extrapolar sin justificación su regla 6.6.1, incluyendo retención = 1.5 veces vida de anaquel.
4. COESPRIS Chihuahua: https://www.chihuahua.gob.mx/info/calidad-microbiologica-de-alimentos y catálogo NOM https://chihuahua.gob.mx/coespris/normasoficiales. Pendiente cotejar lista/acta de verificación vigente específica, contrato de la planta y procedimientos firmados de PIRA.
5. Datos clínicos sensibles: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf (ley federal vigente). No usar bucket general de evidencias de Calidad para expediente médico antes de diseñar acceso segregado.

**Clasificación:** A = implementado en código (sin garantizar ejecución); B = requisito confirmado pero no implementado/verificado; C = falta validar fuente/documento; NA = no aplica autorizado por sede, nunca equivale a cumplimiento.

## Reconciliación del documento de 23 páginas

| Páginas | Formato PIRA observado | Correspondencia inicial en código | Brecha concreta |
|---|---|---|---|
| 1 | Índice de puntos a monitorear | Biblioteca de plantillas | Verificar inventario real por sede/equipo |
| 2–4 | Higiene personal y técnica de lavado por personal/turno | HIGIENE_PERSONAL | Revisión individual y diferenciada, turnos sin Calidad |
| 5 | Calibración termómetro análogo en hielo | Plantilla no específica | Estado inicial, ajuste, instrumento, hora, responsable |
| 6 | Cloro para retenes y atomizadores | CLORO_AGUA demasiado genérica | Área, solución, medición, concentración por control |
| 7 | Cloro de frutas/verduras | DESINFECCION_FV | No imponer 50 ppm impreso sin procedimiento aprobado |
| 8 | Cocción de cárnicos | COCCION/TEMP_ALIMENTOS | Producto, lote, T inicial/final, recocción, criterio por alimento |
| 9 | Liberación de lotes de producción | Sin equivalencia exacta | Producto, organolépticos, lote, cantidad, firmantes/autorización |
| 10 | Cloro cepillos de manos y residual del agua | CLORO_AGUA | Distintos controles/frecuencias y responsable |
| 11–12 | Barra caliente/fría, T1 y T2 por preparación/turno | MANT_CALIENTE/TEMP_ALIMENTOS | T1/T2, horas reales, menú, turno, individualización |
| 13 | Limpieza profunda de instalaciones | LIMPIEZA_PROFUNDA | Elementos únicos y próxima fecha desde última ejecución **real**; realizado vs verificado |
| 14 | Máquina lavaloza y cloro área loza/utensilios | No específico | MAXION: impreso «NO HAY MAQUINA LAVALOZA»: mostrar **No aplica** con autorización, sin inventar medición |
| 15 | Descarte y aprovechamiento de materia prima | Sin equivalencia exacta | Cantidad, motivo, área, turno, destino |
| 16 | PEPS almacén/refrigerador/congelador | PEPS/CADUCIDADES | Diferenciar áreas, productos incorrectos, acciones/seguimiento |
| 17–18 | Congelador y cámara fría: equipo y controles de productos | CONGELADOR/CUARTO_FRIO | Separar lectura equipo vs lectura aleatoria de alimento, sin fabricar dato |
| 19–20 | Recepción perecederos: carnes, lácteos, cereales, congelados | RECEPCION_MP | Lote, empaque, caducidad, transporte, temperatura, decisión |
| 21 | Recepción fruta/verdura, desinfección de rejas, huevo, contenedores | RECEPCION_MP/DESINFECCION_FV | Matriz por proceso y validación de concentraciones aparentemente distintas |
| 22 | Devolución a proveedor | RECHAZO_PRODUCTO parcial | Factura, proveedor, motivo, cantidad, evidencia, firma externa si corresponde |
| 23 | Recepción no perecederos, químicos/desechables | RECEPCION_MP parcial | Flujo específico y segregación de químicos |

El documento **no** acredita por sí solo que todos estos controles se ejecuten actualmente, ni que los valores impresos sean criterios vigentes y correctos. Existen prácticas acordadas en entrevista no representadas totalmente en este juego de formatos: muestras testigo físicas, programas de mantenimiento, registros externos de fumigación, análisis microbiológicos, expediente médico laboral, indicadores de sincronización y modo auditoría.

## Matriz de requisitos y riesgo antes de retirar el papel

| ID | Prioridad | Estado | Requisito / criterio de aceptación |
|---|---|---|---|
| P0-01 | Crítica | B | Aislamiento multiempresa/multisucursal en cada endpoint y archivo; probar acceso de usuario A a sucursal B (403/404) |
| P0-02 | Crítica | B | Registros offline idempotentes con usuario de PIN, dispositivo, captura real, hora servidor, cola cifrada, reintento, conflictos y alerta; ensayo sin red + reconexión + cambio de turno |
| P0-03 | Crítica | B | Guardar evidencias PDF/JPG de Calidad en almacén privado seguro; README indica R2 no conectado en Vercel. Verificar subida y recuperación antes de uso |
| P0-04 | Crítica | B | Solo supervisora Calidad puede cerrar/verificar incidentes; gerente y encargado documentan correcciones. En código actual `quality.corrective.manage` gobierna verificación, no distinción por cargo suficiente |
| P0-05 | Crítica | B | Exp. sanitario laboral en almacenamiento aparte, con mínimo acceso a resultados clínicos, auditoría de accesos, aviso de privacidad, retención y habilitación por profesionales; nunca tratar antidoping/copro semestral como obligación automática NOM |
| P0-06 | Alta | B | Respaldo independiente varias veces/día, monitoreo/alerta y prueba restauración; sincronización no es respaldo |
| P0-07 | Alta | B | Modo auditoría: buscar cualquier fecha/sucursal, vista inmutable, PDF de cada bitácora, usuario+fecha+archivo de descarga; alcance respetado |
| P0-08 | Alta | B | Parámetros controlados exclusivamente por jefatura central Calidad, versionados, solo futuros; «No aplica» por equipo con justificación y autoridad, sin métricas falsamente cumplidas |
| P0-09 | Alta | B | Calidad solo primer turno en Maxion: turnos sin Calidad no generan registros sanitarios ficticios; tareas de turno sí continúan |
| P0-10 | Alta | B | Limpieza profunda: realizado por encargado y verificado por Calidad; próximo vencimiento basado en última ejecución **real** |
| P0-11 | Alta | B | Medición atrasada conserva vencimiento/hora real sin retrofechado; faltante pendiente, cero indicadores falsos |
| P0-12 | Alta | B | Historial de todos los registros inclusive bitácoras desactivadas, versiones anteriores y correcciones con motivo; retención normativa por tipo aún pendiente |
| P1-01 | Media | A parcial | Catálogo de incidentes sin gravedad obligatoria y sin fotos obligatorias; NO asumir que la lógica de acciones automáticas ya respeta totalmente ese flujo |
| P1-02 | Media | A parcial | No ofrecer plantilla inicial digital de muestras testigo; conservar práctica física 3/dish congeladas 3 días como PIRA **sin juicio normativo**, pendiente validación |
| P1-03 | Media | A parcial | Exportación de bitácora histórica por ID mantiene seleccionado ante límite de 150 filas; no sustituye la búsqueda por fecha/sucursal |
| P1-04 | Media | B | Compartida: PIN individual, cambio manual, bloqueo a 15 min, login offline autorizable, contador de pendientes, batería baja, entrega de turno |
| P1-05 | Media | B | Guardar certificaciones externas: fumigación, agua, laboratorio de alimentos, mantenimiento, capacitación; caducidades y responsables |
| P1-06 | Media | B | Control PEPS: corregir etiqueta válida y avisar, nunca modificar fecha de caducidad para ocultar vencimiento |
| P1-07 | Media | B | Programación inicial copiando otra sucursal, Calidad central revisa ajustes, sin asumir equivalencia de maquinaria |

## Normativa contrastada y pendientes
- **NOM-251 §3.42:** definición de registros admite información electrónica o no. Esto **no** equivale a certificación automática de registros/firma.
- **§5.1:** condiciones instalaciones; **§5.6.2 y §5.6.9:** caducidades y PEPS; **§5.9:** mantenimiento/limpieza; **§5.10:** plagas; **§5.12:** signos de enfermedad e higiene; **§5.14.1:** capacitación de buenas prácticas al menos anual.
- **§7.3:** cocción, recalentamiento, barra caliente/fría; parámetros de producto deben relacionarse con la categoría correcta y criterios vigentes; **§7.5:** limpieza y desinfección; **§7.6:** higiene personal.
- **§6.6.1:** es de *fábricas*; no usar su periodo de conservación como cifra general de comedores industriales.
- **No demostrado**: que NOM-251 ordene filtro copro/antidoping cada seis meses, que muestras testigo 3 días sean suficientes, ni que un PIN sea firma legal certificada.
- **No evaluado físicamente**: fauna nociva, grietas/drenajes, plaguicidas, almacenamiento, prácticas reales, potable, calibración, constancias y eficacia de limpieza. La app no corrige por sí misma no conformidades del comedor.

## Criterios de salida antes de desplegar para operación sanitaria
1. Aprobación de jefatura central Calidad de matriz de bitácoras/equipos/turnos y criterios, con referencia a versión de procedimiento.
2. Prueba de rol/sucursal/tenant (incluida restricción cierre de incidentes), pruebas con tabletas offline, pérdidas de red, reloj desajustado y pérdida del equipo.
3. Evidencias R2 u otro almacén privado operativo, con acceso seguro, verificación hash, descarga y restauración.
4. Respaldos automáticos y restauración demostrada; exportar PDF e historial por rango completo.
5. Dictamen jurídico y de privacidad sobre archivos clínicos y periodo de retención por documento.
6. Ensayo con registros ficticios en cinco turnos y sucursales; revisión documental por Calidad y simulación de visita sanitaria.
7. Revisión de PR, CI en verde, despliegue preview, smoke test y autorización del cambio a producción.
8. **Hasta completar lo anterior: coexistencia con bitácoras oficiales, sin afirmar cumplimiento ni eliminar el papel.**

## Registro del cambio 2026-11-08
Rama `feat/pira-calidad-acuerdos-auditoria-20261108`:
- Corregido catálogo inicial de muestras e incidencias, respetando decisiones.
- Mejorada prioridad en obtención de bitácoras históricas por ID.
- Añadido nombre/alcance de documento a bitácora de exportaciones.
- Añadidas pruebas de regresión y este registro de brechas.
- No se realizó migración de BD, importación de información clínica ni publicación en producción.
