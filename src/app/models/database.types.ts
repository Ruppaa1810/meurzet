// =============================================================================
// ENUMS (Coinciden exactamente con los tipos personalizados de PostgreSQL)
// =============================================================================
export type UserRole = 'admin_mayorista' | 'operador_admin' | 'vendedor_minorista';
export type EstadoAsiento = 'libre' | 'bloqueado' | 'confirmado';
export type CategoriaAsiento = 'semicama' | 'cama_ejecutivo' | 'cama_suite';
export type EstadoValidacion = 'pendiente_comprobante' | 'pendiente_validacion' | 'aprobado' | 'rechazado';
export type TipoPago = 'parcial' | 'total';

// =============================================================================
// INTERFACES DE TABLAS (Coinciden 1:1 con el esquema de Supabase)
// =============================================================================

export interface Perfil {
  id: string;
  nombre: string;
  agencia_nombre: string | null;
  rol: UserRole;
  activo: boolean | null;
  created_at: string;
}

export interface Unidad {
  id: number;
  patente: string;
  pisos: 1 | 2;
  asientos_totales: number;
  layout_config: Record<string, unknown>;
  created_at: string;
}

export interface Viaje {
  id: number;
  unidad_id: number | null;
  origen: string;
  destino: string;
  fecha_salida: string;
  fecha_llegada: string;
  precio_base: number;
  activo: boolean | null;
  created_at: string;
}

export interface MapaAsientoViaje {
  id: number;
  viaje_id: number | null;
  nro_asiento: number;
  piso: number;
  categoria: CategoriaAsiento;
  estado: EstadoAsiento;
  vendedor_bloqueo_id: string | null;
  bloqueado_hasta: string | null;
}

export interface Reserva {
  id: number;
  viaje_id: number | null;
  vendedor_id: string | null;
  pasajero_datos: Record<string, unknown>;
  comprobante_url: string | null;
  tipo_pago: TipoPago | null;
  estado: EstadoValidacion | null;
  motivo_rechazo: string | null;
  created_at: string;
}

export interface AuditoriaPasaje {
  id: number;
  asiento_viaje_id: number | null;
  vendedor_id: string | null;
  accion: string;
  fecha: string;
}
