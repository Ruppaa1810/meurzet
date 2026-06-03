# Plan: Agregar módulo "Auditoría" (Operadores)

## Resumen
Cambiar el módulo Auditoría existente (actualmente orientado a vendedores) para que audite **operadores** con métricas de control: ediciones a vendedores y última acción. También se corrige el acceso rápido en dashboard y el enlace en sidebar.

---

## Pasos

### 1. Reescribir `src/app/pages/admin/auditoria/auditoria.ts`
- Eliminar interfaz `VendedorAuditoria` y toda la lógica de vendedores.
- Crear interfaz `OperadorAuditoria` con:
  - `nombre: string`
  - `edicionesAVendedores: number`
  - `ultimaAccion: string` (ej: "Hoy 10:30 - Aprobó comprobante de María")
  - `diasSinActividad?: number` (opcional, para detectar inactividad)
- Datos simulados para 4 operadores:
  | Operador | Ediciones a vendedores | Última acción | Dias sin actividad |
  |----------|----------------------|---------------|-------------------|
  | Ana | 5 | Hoy 11:05 - Editó datos de vendedor "Carlos" | — |
  | Roberto | 2 | Hoy 09:30 - Aprobó comprobante de Lucía | — |
  | Laura | 0 | Ayer 16:45 - Rechazó comprobante de Pedro | — |
  | Diego | 4 | Hace 8 días - Editó datos de vendedor "María" | 8 |
- Propiedades computadas:
  - `operadoresActivos`: cantidad de operadores
  - `totalEdiciones`: suma de ediciones de todos los operadores
- Método `getAuditoria(op)` con reglas:
  - Si `diasSinActividad >= 7` → "⚠️ Sin actividad reciente"
  - Si `edicionesAVendedores > 3` → "📝 Muchas ediciones a vendedores"
  - Si `edicionesAVendedores` entre 1 y 3 → "🟢 Normal"
  - Si `edicionesAVendedores === 0` y sin inactividad → "✅ Sin observaciones"
  - (Si aplican ambas condiciones, concatenar ambos mensajes)

### 2. Reescribir `src/app/pages/admin/auditoria/auditoria.html`
- Título: "Auditoría de Operadores"
- Subtítulo: "Control de actividad de operadores"
- **Tarjetas resumen** (grid 2 columnas, mismo estilo que dashboard):
  - "Operadores activos" → `{{ operadoresActivos }}`
  - "Ediciones a vendedores" → `{{ totalEdiciones }}` (total acumulado)
- **Tabla** (mismo estilo que flota/dashboard):
  - Columnas EXACTAS:
    1. **Operador**
    2. **Ediciones a vendedores**
    3. **Última acción**
    4. **Auditoría** (texto plano generado por `getAuditoria()`, sin botones)

### 3. Actualizar descripción en dashboard (`dashboard.html`)
- Cambiar descripción de "Revisar métricas y bloqueos de vendedores" → "Control de actividad y ediciones de operadores"

### 4. No tocar ni routes ni admin.html ni sidebar
- La ruta, sidebar y acceso rápido ya están agregados de la implementación anterior, solo se actualiza el contenido del módulo y la descripción.

---

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `src/app/pages/admin/auditoria/auditoria.ts` | **Reescribir** - cambiar de vendedores a operadores |
| `src/app/pages/admin/auditoria/auditoria.html` | **Reescribir** - cambiar títulos, tarjetas, columnas de tabla |
| `src/app/pages/admin/dashboard/dashboard.html` | **Editar** - descripción del acceso rápido |
