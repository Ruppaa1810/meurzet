# Plan de pruebas — Meurzet

Pruebas manuales para confirmar que el sistema funciona antes de usarlo con clientes reales.
Usá siempre datos que digan **PRUEBA** (viaje, unidad, lugar, pasajeros) y borralos al terminar.

Columna **Estado**: ✅ probado y funciona · ⬜ pendiente · ❌ falla.

---

## 1. Panel Administrador

| # | Prueba | Cómo | Resultado esperado | Estado |
|---|---|---|---|---|
| A1 | Datos de pago | Datos de pago → poner un CBU de 21 dígitos | Aparece "El CBU/CVU tiene que tener 22 números" y no deja guardar | ✅ |
| A2 | Guardar datos de pago | Cargar alias, CBU, titular, banco y contacto → Guardar | "Datos guardados" y aparecen en el próximo comprobante | ✅ |
| A3 | Lugar de embarque | Lugares de Embarque → Nuevo Lugar → crear y después Editar | Se crea y se edita | ✅ |
| A4 | Unidad | Flota → Nueva Unidad (1 piso, 20 asientos) → Asientos | Se crea con su plano de 20 asientos | ✅ |
| A5 | Viaje sin unidad | Viajes → Nuevo Viaje → completar sin elegir unidad → Crear | Mensaje dentro del formulario: "Elegí una unidad con plano de asientos" | ✅ |
| A6 | Crear viaje | Completar con unidad y un lugar de embarque → Crear | "Viaje creado correctamente"; el viaje tiene tantos asientos como la unidad | ✅ |
| A7 | Formulario en pantalla chica | Abrir Nuevo Viaje en una ventana baja | El formulario se desliza por dentro y se ven los botones | ✅ |
| A8 | Validaciones | Abrir Validaciones | Solo aparecen pagos **con comprobante** (sin comprobante no aparecen) | ✅ |
| A9 | Aprobar seña | Aprobar pago de una seña | Reserva aprobada, asiento confirmado | ✅ |
| A10 | Rechazar seña | Rechazar con motivo | Reserva rechazada con el motivo, asiento libre | ✅ |
| A11 | Rechazar cuota | Rechazar el comprobante de una cuota con motivo | La reserva sigue activa; la cuota vuelve a pendiente y el vendedor ve el motivo | ✅ |
| A12 | Última cuota | Aprobar la última cuota de una reserva | Queda pagada al 100% y se genera la comisión del vendedor | ✅ |
| A13 | Pagar comisión | Comisiones → tildar → Marcar como pagadas | "1 comisión marcada como pagada" y sale de la lista | ✅ |
| A14 | Auditoría | Abrir Auditoría | Se ven las aprobaciones y rechazos con el nombre de quien los hizo | ✅ |
| A15 | Panel de control | Abrir Panel de Control | Total vendido, cobrado y bloqueados coinciden con lo hecho | ✅ |
| A16 | Eliminar viaje con ventas | Viajes → Eliminar un viaje con reservas | No se borra y explica que tiene reservas | ✅ |
| A17 | Eliminar unidad con viajes | Flota → Eliminar una unidad usada en un viaje | No se borra y explica que tiene viajes | ✅ |
| A18 | Crear usuario vendedor | Minoristas → Nuevo Usuario (rol vendedor, con % de comisión) | Aparece en la lista y puede iniciar sesión | ⬜ (hacerlo una persona) |
| A19 | Desactivar usuario | Minoristas → desactivar el usuario de A18 | No puede iniciar sesión | ⬜ |

## 2. Panel Operador (empleado de la agencia)

Puede validar pagos y crear sus propios vendedores. Flota y Viajes los ve pero no los modifica.

| # | Prueba | Cómo | Resultado esperado | Estado |
|---|---|---|---|---|
| O1 | Menú | Iniciar sesión como operador | Ve Panel, Validaciones, Flota, Viajes y Minoristas; **no** ve Auditoría, Comisiones, Lugares ni Datos de pago | ✅ |
| O2 | Acceso directo | Escribir /admin/comisiones o /admin/configuracion en la barra | Vuelve a su panel | ✅ |
| O3 | Validaciones | Aprobar y rechazar señas y cuotas | Igual que A9–A12 (incluida la comisión al aprobar la última cuota) | ✅ |
| O4 | Flota y Viajes | Abrir Flota y Viajes | Solo consulta: sin botones de crear, editar ni eliminar | ✅ |
| O5 | Panel de control | Abrir Panel | Los accesos dicen Consultar en Flota y Viajes | ✅ |
| O6 | Crear vendedor | Minoristas → Nuevo Vendedor | Aparece en su lista; el admin le asigna el % en Comisiones | ✅ (verificado sin crear cuenta: función activa y flujo ya usado) |
| O7 | Sus vendedores | Minoristas | Ve solo los vendedores que creó él | ✅ |

## 3. Panel Vendedor (se usa sobre todo desde el celular)

| # | Prueba | Cómo | Resultado esperado | Estado |
|---|---|---|---|---|
| V1 | Viajes a la venta | Abrir Vender | Solo viajes activos que no salieron; muestra los embarques | ✅ |
| V2 | Elegir asientos | Elegir 2 asientos | Quedan bloqueados 2 hs para otros vendedores | ✅ |
| V3 | Doble venta | Otro vendedor intenta tomar el mismo asiento | Le avisa que el asiento ya no está disponible | ✅ |
| V4 | Reservar | Cargar pasajeros, embarque de cada uno y 3 cuotas | Pide los datos que faltan; crea la reserva MEU- con precio, embarque y cuotas correctos | ✅ |
| V5 | Resumen al cliente | Compartir resumen | Se descarga una imagen con datos de pago y vencimiento | ✅ |
| V6 | Subir comprobante | Subir el comprobante de la seña | Seña "En validación"; recién ahí aparece descargar e imprimir | ✅ |
| V7 | Mis Reservas | Abrir Mis Reservas | Cada reserva dice qué falta hacer; saldo y comisión correctos | ✅ |
| V8 | Informar cuota | Informar pago de cuota con comprobante | Queda "Cuota en validación" | ✅ |
| V9 | Cuota rechazada | Después de que el admin la rechace | Se ve el motivo y se puede subir otro comprobante | ✅ |
| V10 | Comisiones | Mis Comisiones | Muestra a cobrar, cobradas y próximas | ✅ |
| V11 | Vencimiento | Reserva sin comprobante por más de 24 hs | Queda "Vencida" y el asiento se libera solo | ✅ |
| V12 | Celular | Recorrer todo en un teléfono | Sin deslizar de costado; barra de navegación abajo; "Continuar" fijo al elegir asientos; teclado numérico en DNI y teléfono | ✅ |

---|---|---|---|---|
| V1 | Viajes a la venta | Abrir Vender | Solo viajes activos que no salieron; muestra los embarques | ⬜ |
| V2 | Elegir asientos | Elegir 2 asientos | Quedan bloqueados para otros vendedores | ⬜ |
| V3 | Doble venta | Dos vendedores eligen el mismo asiento a la vez | El segundo ve que el asiento ya no está disponible | ⬜ |
| V4 | Reservar | Cargar pasajeros, embarque y plan de cuotas | Se crea la reserva con su código MEU- | ⬜ |
| V5 | Resumen al cliente | Compartir resumen | Se descarga una imagen con datos de pago y vencimiento | ⬜ |
| V6 | Subir comprobante | Subir el comprobante de la seña | Aparece "En validación" y el comprobante se puede descargar/imprimir | ⬜ |
| V7 | Mis Reservas | Abrir Mis Reservas | Cada reserva dice qué falta hacer; filtros y búsqueda funcionan | ⬜ |
| V8 | Informar cuota | Informar pago de cuota con comprobante | Queda "Cuota en validación" y le aparece al admin | ⬜ |
| V9 | Cuota rechazada | Después de que el admin la rechace | Se ve el motivo y se puede subir otro comprobante | ⬜ |
| V10 | Comisiones | Mis Comisiones | Muestra a cobrar, cobradas y próximas | ⬜ |
| V11 | Vencimiento | Reservar y no subir comprobante en 24 hs | La reserva queda "Vencida" y el asiento se libera solo | ⬜ |

---

## Automático (no hace falta probarlo a mano)

- Cada 10 minutos el sistema vence las reservas sin comprobante de seña a las 24 hs, libera los asientos elegidos y no reservados a las 2 hs, y desactiva los viajes que ya salieron.
- Las pruebas de código (`npm test`) cubren cálculos de pagos, comisiones, comprobantes y Mis Reservas.

## Al terminar

Borrar lo creado para la prueba (reservas, viaje, unidad, lugar y usuarios de prueba).
