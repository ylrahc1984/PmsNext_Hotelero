# PMSNext Hotelero — inventario funcional para publicación web

Fecha de revisión: 31 de agosto de 2026  
Fuente: menú principal, rutas, componentes, servicios y controles de acceso del frontend.

## 1. Resumen ejecutivo

PMSNext Hotelero es una plataforma web de gestión integral que conecta la operación del alojamiento con reservas, recepción, restaurante, clientes, compras, finanzas, reportes y cierre diario. El sistema trabaja con una fecha operativa centralizada, contexto de empresa, control de acceso por módulos y flujos que comparten información entre departamentos.

Su mayor fortaleza comercial es la continuidad del dato: una reserva alimenta la recepción; la estadía concentra huéspedes, cargos y documentos; los consumos del restaurante pueden trasladarse a la habitación; las ventas y compras llegan a finanzas; y la gerencia obtiene indicadores operativos, comerciales y financieros.

Propuesta de valor sugerida:

> Controle toda la operación de su hotel desde una sola plataforma: reservas, habitaciones, huéspedes, restaurante, facturación, compras, finanzas y análisis en tiempo real.

## 2. Estado de las opciones superiores del menú

Leyenda:

- **Disponible:** opción visible con pantallas funcionales.
- **Disponible por licencia:** se muestra o habilita de acuerdo con los módulos contratados.
- **Parcial / interno:** existen pantallas funcionales, pero el menú superior está bloqueado o parte de sus opciones todavía está en preparación.
- **En preparación:** opción bloqueada, oculta o conectada a una pantalla temporal.

| Nivel superior | Estado observado | Alcance principal |
|---|---|---|
| Dashboard | Disponible | Visión ejecutiva y operativa del hotel |
| Front Desk | Disponible por licencia `FRONT` | Habitaciones, llegadas, huéspedes alojados, cargos, folios, caja y documentos |
| Reservas | Disponible por licencia `RESER` | Consulta, creación, calendario, forecast, tarifas, agencias y clientes |
| Housekeeping | Parcial / interno | Limpieza operativa disponible; panel independiente y asignación aún restringidos |
| Restaurante | Disponible por licencia `PNTVT` o `PVTCH` | POS, mesas, pedidos, cargos, facturación, caja y análisis |
| Clientes / Huéspedes | Disponible parcialmente | Análisis de huéspedes activo; perfiles, historial, preferencias, documentos y CRM ocultos |
| Operaciones | Parcial / interno | Actividades, forecast, centro operacional, traslados, pickup y órdenes de trabajo implementados, pero menú bloqueado |
| Compras e Inventario | Disponible por licencia `INVCO` | Proveedores, productos, servicios, órdenes, recepción, pagos y catálogos |
| Finanzas | Disponible por licencia `BANCO` o `CONTA` | CxC, CxP, facturación, recibos, bancos, IVA y comisiones |
| Mantenimiento | En preparación | Menú diseñado, pero bloqueado y sin rutas funcionales publicables |
| Reportes | Disponible parcialmente | Reportes operativos, financieros, comerciales y de restaurante activos |
| Operación | Disponible | Validaciones y cierre diario de la jornada hotelera |
| Administración | Disponible por licencia `CONFI` | Usuarios, seguridad, catálogos, parámetros y migraciones |

## 3. Recorrido funcional detallado

### 3.1 Dashboard

El Dashboard funciona como un centro de operaciones hoteleras y reúne:

- Estado general: ocupación actual, habitaciones disponibles, ocupadas y bloqueadas.
- Proyección de ocupación al cierre.
- Llegadas y salidas del día, con desglose operativo y cantidad de huéspedes.
- Alertas por salidas vencidas, check-ins pendientes, cancelaciones, no-shows y habitaciones fuera de servicio.
- Resumen de Housekeeping.
- Resumen de restaurante: mesas ocupadas, pedidos activos, tickets abiertos, ventas del día y room service.
- Forecast de ocupación para los próximos siete días, con promedio y pico.
- Producción diaria de reservas y distribución por estado.
- Indicadores del día: huéspedes alojados, inventario disponible y porcentaje de ocupación.
- Visualización del tipo de cambio asociado al contexto operativo.

Mensaje comercial sugerido: **“Toda la operación del hotel, resumida en un solo panel.”**

### 3.2 Front Desk

#### Habitaciones y Room Rack

- Mapa visual de habitaciones y filtros por estado.
- Vista rápida de disponibilidad, ocupación y condición operativa.
- Acciones rápidas para enviar a limpieza, solicitar repaso o bloquear una habitación.
- Registro y extensión de bloqueos, con fechas, motivo, observación y operador.
- Acceso a walk-in, arribos, huéspedes alojados, factura directa y gestión de estadía.

#### Llegadas y check-in

- Consulta de arribos por fecha, habitación, reserva, agencia o descripción.
- Indicadores de llegadas y estados.
- Check-in operativo desde el listado.
- Rooming list y registro de acompañantes.
- Gestión de etiquetas especiales de la reserva.
- Generación de hoja de registro.
- Acceso a modalidad de self check-in desde la operación.

#### Huéspedes In House y gestión de estadía

- Consulta de huéspedes actualmente alojados por fechas, estado, plan y agencia.
- Detalle de habitación, reserva, estancia, acompañantes y plan.
- Información de agencia, tarifa, folio master, fechas y saldo actual.
- Registro y administración de huéspedes de la habitación.
- Observaciones y comentarios operativos.
- Etiquetas de reserva para alertas, preferencias o coordinación interna.
- Cargos separados entre hospedaje/alimentos y extras.
- Consulta, impresión PDF, impresión POS y anulación de cargos.
- Creación de cargos desde catálogos y listas de precios.
- Transferencia de cargos y operaciones sobre la estancia.
- Facturación de habitación con cliente, múltiples formas de pago, moneda, impuestos, propina, saldo y cambio.
- Timeline operativo de la estancia.

#### Folios Master

- Consulta de cargos de hospedaje pendientes.
- Búsqueda por folio, reserva, agencia, descripción o tarifa.
- Indicadores y paginación.
- Consulta detallada, facturación y creación de recibos comerciales.

#### Limpieza de habitaciones

- Lista de habitaciones por atender.
- Resumen por estados de limpieza.
- Búsqueda por habitación o huésped.
- Actualización operativa y exportación a PDF.

#### Pronóstico de ocupación

- KPIs de ocupación.
- Filtros por rango y criterios hoteleros.
- Resumen gráfico por categoría.
- Detalle diario de inventario y ocupación.

#### Caja y documentos

- Apertura, gestión, consulta y detalle de cierres de caja.
- Consulta y detalle de documentos emitidos.
- Emisión y consulta de notas de crédito.
- Factura directa.
- Recibos comerciales.

#### Configuración de Front Desk

- Grupos de habitaciones.
- Categorías y tipos de habitación.
- Inventario maestro de habitaciones.
- Tipos de PAX.
- Nacionalidades.
- Planes de alimentación.
- Recibos comerciales.

No deben anunciarse todavía como funciones terminadas: Rooming–Asignaciones independiente, Estado de Habitaciones independiente, Motivos de Bloqueo, Estados y Parámetros de Front Desk, ya que sus rutas actuales son temporales.

### 3.3 Reservas

#### Consulta y gestión

- Consulta por rango de fechas, agencia y estado.
- Visualización de reserva, descripción, agencia, ingreso, salida, noches, habitaciones, total, prepago y operador.
- Creación, edición y detalle de reservas.
- Administración de etiquetas.
- Gestión de prepagos con historial, alta, edición, consulta y eliminación controlada.

#### Creación de reserva

- Datos generales y contacto.
- Selección de agencia y tarifa.
- Asignación de habitaciones y ocupación.
- Planes de alimentación e inclusiones.
- Servicios extras.
- Resumen económico.
- Etiquetas con notas y alertas.
- Búsqueda paginada de tarifas y agencias.
- Protección de borradores/cambios antes de abandonar la pantalla.

#### Calendario de habitaciones

- Línea de tiempo de disponibilidad, ocupación, bloqueos, ingresos y salidas.
- Colores por estado operativo.
- Ventanas de fechas configurables.
- Acceso a nueva reserva.
- Consulta rápida del detalle de una reserva.
- Flujo de reasignación mediante bandeja temporal sin alterar las fechas.

#### Forecast, tarifas y canales

- Forecast de ocupación por fecha y categoría.
- Consulta de tarifas y planes, con pantalla de detalle.
- Gestión de agencias/canales y mercados.
- Catálogo de clientes para facturación.

La ruta independiente de “Disponibilidad” todavía está en preparación; la disponibilidad utilizable se representa actualmente en el calendario y los flujos de reserva.

### 3.4 Housekeeping

Existe funcionalidad operativa real, pero el módulo superior está bloqueado en el menú.

Capacidades ya observables:

- Centro operativo de limpieza.
- KPIs y filtros de Housekeeping.
- Estado de habitaciones.
- Camareras activas y habitaciones prioritarias.
- Lista de limpieza accesible desde Front Desk.
- Actualización de estados y exportación a PDF.

La asignación de camareras, supervisión y otras rutas independientes aún aparecen como temporales. Para la web pública conviene presentarlo como **“módulo en expansión”** o excluirlo hasta su liberación comercial.

### 3.5 Restaurante

#### Punto de venta y operación de mesas

- Selección del punto de venta asignado al usuario.
- Áreas operativas y salones.
- Plano de mesas y estado de ocupación.
- Selección de salonero.
- Flujo especial para room service sin mesa física.
- Menú por categorías y productos.
- Configuración de cantidad, puesto de mesa, tiempo del plato y comentarios.
- Pedido actual y consumo acumulado de la mesa.
- Acciones operativas sobre mesa y cuenta.

#### Facturación y cargos

- Facturación de mesa.
- Selección o creación del cliente de facturación.
- Múltiples formas de pago.
- Resumen de subtotal, impuestos, propina y total.
- Cargo a habitación.
- Cargo a colaboradores.
- Cargos incluidos.
- Consulta y detalle de documentos.
- Cierre de caja.

#### Análisis

- Productos más vendidos.
- Detalle y concentración Pareto de productos.
- Ventas por mesero.

#### Configuración de restaurante

- Catálogo comercial de productos, servicios y experiencias.
- Listas de precios y reglas comerciales.
- Categorías de productos.
- Puntos de venta.
- Saloneros.

Hay rutas históricas/temporales para comandador, cocina/barra y pedidos activos. La operación publicable debe basarse en el POS actual de puntos de venta, salones, mesas, productos y facturación.

### 3.6 Clientes / Huéspedes

La opción pública activa es Análisis de Huéspedes:

- Segmentación y filtros de huéspedes.
- Indicadores de composición y contacto.
- Distribución por nacionalidad.
- Disponibilidad de datos de contacto.
- Detalle de identidad, contacto y estancia.
- Consulta de estancias dentro del período analizado.

Perfil de huéspedes, historial, preferencias, documentos de identificación y CRM están definidos en el menú, pero permanecen ocultos. No deben presentarse aún como módulos independientes terminados.

### 3.7 Operaciones

El menú superior está bloqueado, aunque las siguientes pantallas y rutas sí tienen implementación:

- Actividades diarias por reserva y servicio.
- Estados consolidados de operación, facturación y transporte.
- Confirmación y reversión de check-in operativo.
- Observaciones del cliente y comentarios de recepción.
- Impresión de vouchers POS.
- Forecast de actividades.
- Centro operacional con KPIs, timeline, matriz de carga y mapa de calor por bloques horarios.
- Filtros por fecha, búsqueda, agencia y chofer.
- Lista Pickup con creación y edición.
- Órdenes de trabajo con alta, edición y detalle.
- Asignación de traslados asociada a las órdenes.

Recomendación: validar la política comercial antes de anunciar este módulo. Técnicamente tiene un alcance importante, pero el menú actual comunica que todavía no está habilitado para el usuario final.

### 3.8 Compras e Inventario

- Maestro de proveedores con alta y edición.
- Maestro de productos con formulario detallado.
- Catálogo de servicios de compra.
- Órdenes de compra.
- Consulta y recepción de facturas.
- Compras diferenciadas de artículos y servicios.
- Edición y detalle de compras recibidas.
- Compras por correo y consulta de su detalle.
- Historia de pagos a proveedores.
- Configuración de líneas de producto, categorías y almacenes.

Mensaje comercial sugerido: **“Del proveedor a la recepción de factura, con trazabilidad de compras y pagos.”**

### 3.9 Finanzas

#### Cuentas y documentos

- Estado de cuenta de clientes hoteleros.
- Cuentas por cobrar comerciales.
- Cuentas por pagar.
- Facturación directa.
- Recibos.
- Consulta y detalle de documentos.
- Notas de crédito.

#### Bancos

- Depósitos asociados a cuentas por cobrar.
- Retiros asociados a cuentas por pagar.
- Alta, edición y consulta de movimientos.
- Catálogos de bancos, cuentas bancarias y conceptos bancarios.

#### Control fiscal y análisis

- Reporte de ventas hoteleras por IVA, incluyendo notas de crédito.
- Reporte de compras por IVA.

#### Comisiones

- Motor de reglas de comisión.
- Definición por contexto, porcentaje/base y vigencia.
- Agencias comisionables.
- Servicios comisionables.
- Vista analítica de comisiones calculadas.
- Liquidaciones y documentos liquidados.
- Timeline financiero de la liquidación.
- Auditoría de comisiones.
- Configuración general del corte financiero y base de cálculo.

### 3.10 Mantenimiento

El menú proyecta las siguientes capacidades:

- Reporte de incidentes.
- Órdenes de mantenimiento.
- Mantenimiento preventivo y correctivo.
- Habitaciones fuera de servicio.
- Historial de reparaciones.

Sin embargo, el módulo está bloqueado y no se encontraron rutas funcionales equivalentes. Debe considerarse **roadmap**, no funcionalidad disponible para publicación actual.

### 3.11 Reportes

#### Reporte operativo hotelero

- Estado operativo.
- Forecast de ocupación.
- Movimientos del día.
- Focos operativos y lectura recomendada.

#### Reporte financiero

- Centros de ingreso.
- Comparación de ingresos y gastos.
- Composición de ingresos.
- Resumen de compras.
- Lectura ejecutiva del período.

#### Reporte comercial

- Producción por canal.
- Captación semanal.
- Distribución por mercado.
- Oportunidades, acciones y causas de variación.

#### Reporte de restaurante

- Platos más vendidos.
- Ventas y comandas.
- Indicadores de rendimiento.
- Lecturas clave y recomendadas.

Los reportes independientes de ocupación, Housekeeping y mantenimiento están ocultos y usan pantallas temporales. No deben listarse como reportes terminados.

### 3.12 Operación — cierre diario

- Estado actual de la jornada hotelera.
- Paso 1: validaciones del hotel antes del cierre.
- Resumen del análisis y alertas de inconsistencias.
- Paso 2: ejecución controlada del cierre de jornada.
- Uso de fecha operativa central para gobernar acciones posteriores.

Mensaje comercial sugerido: **“Cierre su jornada con validaciones previas y control de la fecha operativa.”**

### 3.13 Administración

#### Usuarios y seguridad

- Consulta, creación y edición de usuarios.
- Cambio de contraseña.
- Asignación de propiedades o empresas al usuario.
- Acceso condicionado por módulos contratados.
- Sesión autenticada con renovación de credenciales.

#### Configuración financiera y fiscal

- Monedas y tipos de cambio.
- Formas de pago.
- Impuestos.
- Definición de documentos fiscales y operativos.

#### Configuración administrativa

- Departamentos.
- Centros de costos.
- Tipos de cliente.
- Contadores o correlativos documentales.
- Unidades de medida.
- Parámetros generales.

#### Migraciones

- Importación de información desde sistemas anteriores.
- Flujo guiado de migración de reservas.
- Carga de archivo, homologación con catálogos, validación, revisión e importación secuencial.

Roles y permisos detallados, catálogos generales y auditoría del sistema tienen rutas temporales; la funcionalidad publicable de seguridad debe limitarse a usuarios, propiedades y acceso modular observado.

## 4. Capacidades transversales demostrables

- Aplicación web moderna y adaptable construida en Angular.
- Contexto de empresa activa para separar la operación por propiedad/unidad.
- Acceso por módulos contratados y por usuario.
- Fecha operativa hotelera distinta de la fecha calendario cuando el cierre lo requiere.
- Políticas que bloquean acciones incompatibles con el estado de la jornada.
- Manejo de múltiples monedas y tipos de cambio.
- Exportación y generación de documentos PDF.
- Impresión directa de comprobantes POS mediante QZ Tray.
- Tableros, gráficos y tablas analíticas.
- Exportación/importación de hojas de cálculo en flujos compatibles.
- Integración entre reservas, habitación, restaurante, facturación, compras y finanzas.

## 5. Estructura recomendada para la página web

### Encabezado principal

**Título:** El PMS que conecta toda la operación de su hotel  
**Texto:** Administre reservas, habitaciones, huéspedes, restaurante, facturación, compras y finanzas desde una plataforma web integrada.  
**CTA principal:** Solicitar demostración  
**CTA secundario:** Conocer los módulos

### Bloque de beneficios

1. **Operación conectada** — La información fluye desde la reserva hasta el cierre diario.
2. **Control en tiempo real** — Ocupación, llegadas, salidas, alertas y producción en un solo panel.
3. **Experiencia del huésped** — Centralice acompañantes, observaciones, etiquetas, consumos y documentos.
4. **Finanzas integradas** — Controle facturación, caja, cuentas, bancos, IVA y comisiones.
5. **Decisiones con datos** — Analice desempeño operativo, financiero, comercial y de restaurante.
6. **Configuración flexible** — Adapte catálogos, monedas, impuestos, habitaciones y accesos a su operación.

### Módulos que pueden publicarse hoy

- Dashboard ejecutivo.
- Front Desk.
- Reservas.
- Restaurante y punto de venta.
- Análisis de huéspedes.
- Compras e inventario.
- Finanzas y comisiones.
- Reportes gerenciales.
- Cierre diario.
- Administración y configuración.

### Módulos que requieren validación antes de publicarse

- Housekeeping como módulo independiente.
- Operaciones como módulo habilitado comercialmente.
- Mantenimiento.
- CRM completo de huéspedes.
- Reportes independientes de ocupación, Housekeeping y mantenimiento.
- Roles/permisos avanzados y auditoría general.

## 6. Mensajes comerciales listos para reutilizar

- “Conozca la ocupación, las llegadas, las salidas y las alertas de su hotel desde un dashboard operativo.”
- “Gestione cada estancia desde el Room Rack hasta la facturación y el check-out.”
- “Venda habitaciones, planes de alimentación y servicios extra desde una reserva integrada.”
- “Lleve los consumos del restaurante directamente a la habitación del huésped.”
- “Controle caja, documentos, cuentas por cobrar, cuentas por pagar y movimientos bancarios.”
- “Automatice reglas, cálculo, liquidación y auditoría de comisiones.”
- “Organice proveedores, productos, órdenes de compra, recepción de facturas y pagos.”
- “Convierta la operación diaria en indicadores claros para la gerencia.”
- “Ejecute el cierre hotelero con validaciones y una fecha operativa controlada.”

## 7. Precauciones de publicación

- No presentar opciones bloqueadas, ocultas o temporales como funcionalidad disponible.
- Evitar afirmar “tiempo real” para datos externos si no se define la frecuencia de actualización; sí puede usarse para vistas operativas que consultan el backend al cargar/actualizar.
- No prometer channel manager, motor de reservas web, contabilidad general completa, nómina o mantenimiento hasta verificar integraciones/backend fuera de este frontend.
- Confirmar los países y requisitos fiscales soportados antes de anunciar facturación electrónica o cumplimiento tributario específico.
- Confirmar si la selección de empresa representa operación multi-hotel comercial antes de usar el término “multi-propiedad”.
- Validar disponibilidad productiva de self check-in, ya que el flujo está expuesto desde arribos pero su alcance externo no se evaluó en este recorrido.

## 8. Fuentes principales dentro del proyecto

- Menú y estados: `src/app/theme/layout/admin/navigation/navigation.ts`
- Rutas generales: `src/app/app-routing.module.ts`
- Front Desk: `src/app/modules/front-desk/front-desk.routes.ts`
- Finanzas: `src/app/finanzas/finanzas-routing.module.ts`
- Comisiones: `src/app/pages/comisiones/comisiones.routes.ts`
- Cierre diario: `src/app/modules/operacion/cierre-diario/cierre-diario.routes.ts`
- Control modular: `src/app/core/services/module-access.service.ts`
- Contexto operativo: `src/app/core/services/operational-context.service.ts`
- Política operativa: `src/app/core/services/operational-policy.service.ts`
- Contexto de empresa: `src/app/core/services/empresa-context.service.ts`

