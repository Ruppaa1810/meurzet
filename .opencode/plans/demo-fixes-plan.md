# Plan de Correcciones para Demo - Meurzet Viajes

## Estado: Pendiente de aprobación para implementación

## Día 0: Infraestructura ✅ COMPLETADO
- nginx SPA routing: Ya configurado en `deeplink-sistema.conf`
- storage unhealthy: Solo problema de health check, servicio funciona correctamente

---

## DÍA 1: Bugs Críticos

### 1.1 Fix email notifications (reserva.service.ts)
**Problema:** `reserva.service.ts:68` usa `perfil?.agencia_nombre` como email destinatario
**Solución:** Agregar campo `email` a tabla `perfiles` y usarlo para notificaciones

**Archivos a modificar:**
1. `src/app/models/database.types.ts` — Agregar `email: string | null` a interfaz `Perfil`
2. `supabase/functions/admin-create-user/index.ts` — Guardar email en perfiles al crear usuario
3. `supabase/functions/admin-update-user/index.ts` — Actualizar email en perfiles si cambia
4. `src/app/services/reserva.service.ts:68` — Cambiar `perfil?.agencia_nombre` → `perfil?.email`
5. `src/app/services/perfil.service.ts:46` — Agregar `email` al tipo de actualización
6. `supabase/migrations/009_email_en_perfiles.sql` — Nueva migración para agregar columna

### 1.2 Fix RLS overly-permissive (005_validaciones_pagos.sql)
**Problema:** Cualquier usuario autenticado puede UPDATE en `pagos_movimientos`
**Solución:** Restringir a solo `admin_mayorista` y `operador_admin`

**Archivos a modificar:**
1. `supabase/migrations/010_rls_pagos_restrict.sql` — Nueva política UPDATE restrictiva

### 1.3 Fix servicioLabel() hardcoded (inicio.ts)
**Problema:** `inicio.ts:82-83` siempre retorna "Cama Ejecutivo"
**Solución:** Derivar de las categorías reales de asientos del viaje

**Archivos a modificar:**
1. `src/app/pages/minorista/inicio/inicio.ts` — Modificar `servicioLabel()` para leer categorías reales
2. `src/app/services/asiento.service.ts` — Agregar método para obtener categorías por viaje
3. `src/app/pages/minorista/inicio/inicio.html` — Actualizar template si es necesario

### 1.4 Fix developer text visible (inicio.html)
**Problema:** `inicio.html:9` muestra "Ejecutá el script seed.sql en Supabase"
**Solución:** Cambiar a mensaje amigable

**Archivos a modificar:**
1. `src/app/pages/minorista/inicio/inicio.html:9` — Cambiar texto

### 1.5 Fix audit log wrong ID (validaciones.ts)
**Problema:** `validaciones.ts:116,121` pasa `reserva.id` en vez de `asiento_viaje_id`
**Solución:** Obtener y pasar el `asiento_viaje_id` correcto del pago/reserva

**Archivos a modificar:**
1. `src/app/pages/admin/validaciones/validaciones.ts` — Corregir parámetro en `auditoriaService.log()`

---

## DÍA 2: Configurabilidad

### 2.1 Teléfono configurable
**Problema:** `11 2345-6789` hardcodeado en `comprobante.service.ts:32` y `confirmacion.ts:223`
**Solución:** Mover a tabla `configuracion_general` en Supabase

**Archivos a modificar:**
1. `src/app/services/comprobante.service.ts` — Leer teléfono de config en vez de hardcodear
2. `src/app/pages/minorista/confirmacion/confirmacion.ts` — Leer teléfono de config
3. `supabase/migrations/008_config_general.sql` — Tabla de configuración general
4. Nuevo servicio: `src/app/services/config-general.service.ts` — Para leer config general

### 2.2 Monto mínimo configurable
**Problema:** 30% hardcodeado en `reserva-state.service.ts:44`
**Solución:** Nuevo campo `porcentaje_minimo_seña` en tabla `config_pagos`

**Archivos a modificar:**
1. `supabase/migrations/008_config_general.sql` — Agregar campo a config_pagos
2. `src/app/services/config-pagos.service.ts` — Leer el nuevo campo
3. `src/app/services/reserva-state.service.ts` — Usar valor configurable

### 2.3 Datos bancarios configurables
**Problema:** alias, CBU, titular hardcodeados en `environment.ts`
**Solución:** Mover a tabla `configuracion_general`

**Archivos a modificar:**
1. `supabase/migrations/008_config_general.sql` — Campos bancarios
2. Nuevo servicio o extender `config-general.service.ts`
3. `src/app/pages/minorista/confirmacion/confirmacion.ts` — Leer de config

---

## DÍA 3: UX y Funcionalidad

### 3.1 Dashboard date filters
**Problema:** Botones Hoy/Semana/Mes no funcionan
**Solución:** Implementar filtrado por rango de fechas

**Archivos a modificar:**
1. `src/app/pages/admin/dashboard/dashboard.ts` — Agregar lógica de filtro
2. `src/app/pages/admin/dashboard/dashboard.html` — Conectar botones a handlers

### 3.2 Validación de fechas en viajes
**Problema:** No verifica `fecha_llegada > fecha_salida` ni `precio > 0`
**Solución:** Agregar validaciones al formulario

**Archivos a modificar:**
1. `src/app/pages/admin/viajes/viajes.ts` — Agregar validaciones

### 3.3 Error handling en catch vacíos
**Problema:** 6+ componentes con `catch {}` vacíos
**Solución:** Agregar feedback al usuario

**Archivos a modificar:**
1. `src/app/pages/admin/dashboard/dashboard.ts:85`
2. `src/app/pages/minorista/seleccion/seleccion.ts` (varios)
3. `src/app/pages/minorista/perfil/perfil.ts:43`
4. `src/app/pages/minorista/mis-reservas/mis-reservas.ts:146`
5. `src/app/pages/minorista/inicio/inicio.ts:42`

### 3.4 Limpiar console.warn
**Archivos a modificar:**
1. `src/app/services/notificaciones.service.ts:43`
2. `src/app/pages/minorista/reserva/reserva.ts:229`

---

## DÍA 4: Seguridad y Performance

### 4.1 XSS escaping en comprobantes
**Problema:** Datos de usuario se insertan sin escaping en HTML
**Solución:** Agregar función `escapeHtml()` y usarla en templates

### 4.2 N+1 queries en gestión minoristas
**Problema:** Consulta individual por cada vendedor
**Solución:** Batch query o agregación

### 4.3 Signed URLs reducir expiración
**Problema:** 1 año de expiración
**Solución:** Reducir a 30 días

### 4.4 Actualizar Deno std
**Problema:** std@0.168.0 obsoleto
**Solución:** Actualizar a versión reciente

---

## DÍA 5: Build + Deploy + Test

1. `npm run build` — Verificar que compila sin errores
2. Deploy via SSH: copiar `dist/` a `/www/wwwroot/meurzetviajes.com/sistema/`
3. Smoke test completo:
   - Login admin → crear viaje → verificar asientos
   - Login minorista → buscar viaje → seleccionar asiento → crear reserva
   - Login admin → validar reserva → verificar email
   - Verificar comprobantes y documentos de saldo
