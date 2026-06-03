import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { Viaje, MapaAsientoViaje, Perfil, Reserva, Unidad, UserRole } from '../models/database.types';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  supabase: SupabaseClient;
  isPasswordRecovery = false;

  constructor() {
    this.isPasswordRecovery = localStorage.getItem('meurzet_recovery') === 'true';
    if (this.isPasswordRecovery) {
      localStorage.removeItem('meurzet_recovery');
    }

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

  }

  // ===========================================================================
  // AUTH
  // ===========================================================================

  async login(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async resetPassword(email: string) {
    const res = await Promise.race([
      this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?recovery=true`,
      }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      ),
    ]);
    return res;
  }

  // ===========================================================================
  // PERFILES
  // ===========================================================================

  async getPerfil(userId: string) {
    return await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single<Perfil>();
  }

  async getCurrentProfile(): Promise<{ data: Perfil | null }> {
    const session = await this.supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) return { data: null };
    return this.getPerfil(userId);
  }

  async getVendedoresMinoristas() {
    return await this.supabase
      .from('perfiles')
      .select('*')
      .in('rol', ['vendedor_minorista', 'operador_admin'])
      .order('created_at', { ascending: false });
  }

  async togglePerfilActivo(id: string, activo: boolean) {
    return await this.supabase
      .from('perfiles')
      .update({ activo })
      .eq('id', id)
      .select()
      .single<Perfil>();
  }

  async crearVendedorMinorista(email: string, password: string, nombre: string, agenciaNombre: string, rol: UserRole = 'vendedor_minorista', createdBy?: string) {
    const adminHeaders = {
      'apikey': environment.serviceRoleKey,
      'Authorization': `Bearer ${environment.serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const fetchWithTimeout = (url: string, opts: RequestInit, ms = 15000) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
    };

    try {
      // 1. Crear usuario via Auth Admin API
      const authRes = await fetchWithTimeout(`${environment.supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          email, password, email_confirm: true,
          user_metadata: { nombre, agencia_nombre: agenciaNombre, rol },
        }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) return { data: null, error: new Error(authData.msg || authData.error || 'Error al crear usuario') };

      const userId = authData.id;

      // 2. Insertar perfil (POST directo con service_role, que bypass RLS)
      const perfilRes = await fetchWithTimeout(`${environment.supabaseUrl}/rest/v1/perfiles?on_conflict=id`, {
        method: 'POST',
        headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: userId, nombre, agencia_nombre: agenciaNombre,
          rol, activo: true,
          ...(createdBy ? { created_by: createdBy } : {}),
        }),
      });
      if (!perfilRes.ok) {
        const errBody = await perfilRes.json();
        return { data: null, error: new Error(errBody.message || errBody.error || 'Error al insertar perfil') };
      }

      return { data: { id: userId, email, nombre, agencia_nombre: agenciaNombre }, error: null };
    } catch (err: any) {
      if (err.name === 'AbortError') return { data: null, error: new Error('La operación tardó demasiado. Probablemente el usuario se creó igual, recargá la página.') };
      return { data: null, error: new Error(err.message || 'Error de conexión') };
    }
  }

  async actualizarPerfil(id: string, datos: Partial<Pick<Perfil, 'nombre' | 'agencia_nombre' | 'rol'>>) {
    return await this.supabase
      .from('perfiles')
      .update(datos)
      .eq('id', id)
      .select()
      .single<Perfil>();
  }

  async actualizarAuthUser(userId: string, data: { email?: string; password?: string }) {
    const adminHeaders = {
      'apikey': environment.serviceRoleKey,
      'Authorization': `Bearer ${environment.serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const fetchWithTimeout = (url: string, opts: RequestInit, ms = 15000) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
    };

    try {
      const body: any = {};
      if (data.email) body.email = data.email;
      if (data.password) body.password = data.password;

      if (Object.keys(body).length === 0) return { error: null };

      const res = await fetchWithTimeout(`${environment.supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify(body),
      });
      const resData = await res.json();
      if (!res.ok) return { error: new Error(resData.msg || resData.error || 'Error al actualizar usuario') };
      return { error: null };
    } catch (err: any) {
      if (err.name === 'AbortError') return { error: new Error('La operación tardó demasiado') };
      return { error: new Error(err.message || 'Error de conexión') };
    }
  }

  // ===========================================================================
  // VIAJES
  // ===========================================================================

  async getViajes() {
    return await this.supabase
      .from('viajes')
      .select('*')
      .eq('activo', true)
      .order('fecha_salida', { ascending: true });
  }

  async getViajesAdmin() {
    return await this.supabase
      .from('viajes')
      .select('*')
      .order('fecha_salida', { ascending: false });
  }

  async getViajePorId(viajeId: number) {
    return await this.supabase
      .from('viajes')
      .select('*')
      .eq('id', viajeId)
      .single<Viaje>();
  }

  // ===========================================================================
  // ASIENTOS (Mapa de asientos por viaje)
  // ===========================================================================

  async getAsientosPorViaje(viajeId: number) {
    return await this.supabase
      .from('mapa_asientos_viaje')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('nro_asiento', { ascending: true });
  }

  // Llama a la función almacenada bloquear_asiento() en Supabase
  async bloquearAsiento(viajeId: number, nroAsiento: number, vendedorId: string) {
    return await this.supabase.rpc('bloquear_asiento', {
      p_viaje_id: viajeId,
      p_nro_asiento: nroAsiento,
      p_vendedor_id: vendedorId
    });
  }

  async liberarAsiento(viajeId: number, nroAsiento: number) {
    return await this.supabase.rpc('liberar_asiento', {
      p_viaje_id: viajeId,
      p_nro_asiento: nroAsiento,
    });
  }

  // ===========================================================================
  // RESERVAS
  // ===========================================================================

  async crearReserva(reserva: Omit<Reserva, 'id' | 'created_at'>) {
    return await this.supabase
      .from('reservas')
      .insert(reserva)
      .select()
      .single<Reserva>();
  }

  async getReservasPorVendedor(vendedorId: string) {
    return await this.supabase
      .from('reservas')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .order('created_at', { ascending: false });
  }

  async getReservasPendientes() {
    return await this.supabase
      .from('reservas')
      .select('*, viaje:viaje_id(*)')
      .in('estado', ['pendiente_comprobante', 'pendiente_validacion'])
      .order('created_at', { ascending: false });
  }

  async aprobarReserva(reservaId: number, asientoViajeId: number) {
    return await this.supabase.rpc('aprobar_reserva', {
      p_reserva_id: reservaId,
      p_asiento_viaje_id: asientoViajeId,
    });
  }

  async rechazarReserva(reservaId: number, asientoViajeId: number, motivo: string) {
    return await this.supabase.rpc('rechazar_reserva', {
      p_reserva_id: reservaId,
      p_asiento_viaje_id: asientoViajeId,
      p_motivo: motivo,
    });
  }

  // ===========================================================================
  // UNIDADES (Flota)
  // ===========================================================================

  async getUnidades() {
    return await this.supabase
      .from('unidades')
      .select('*')
      .order('created_at', { ascending: false });
  }

  async createUnidad(data: Omit<Unidad, 'id' | 'created_at'>) {
    return await this.supabase
      .from('unidades')
      .insert(data)
      .select()
      .single<Unidad>();
  }

  async updateUnidad(id: number, data: Partial<Unidad>) {
    return await this.supabase
      .from('unidades')
      .update(data)
      .eq('id', id)
      .select()
      .single<Unidad>();
  }

  async deleteUnidad(id: number) {
    return await this.supabase
      .from('unidades')
      .delete()
      .eq('id', id);
  }

  // ===========================================================================
  // VIAJES (CRUD)
  // ===========================================================================

  async createViaje(data: Omit<Viaje, 'id' | 'created_at'>) {
    return await this.supabase
      .from('viajes')
      .insert(data)
      .select()
      .single<Viaje>();
  }

  async updateViaje(id: number, data: Partial<Viaje>) {
    return await this.supabase
      .from('viajes')
      .update(data)
      .eq('id', id)
      .select()
      .single<Viaje>();
  }

  async deleteViaje(id: number) {
    return await this.supabase
      .from('viajes')
      .delete()
      .eq('id', id);
  }

  // ===========================================================================
  // DASHBOARD
  // ===========================================================================

  async getUnidadesCount() {
    return await this.supabase
      .from('unidades')
      .select('id', { count: 'exact', head: true });
  }

  async getReservasConfirmadasHoy() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await this.supabase
      .from('reservas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'aprobado')
      .gte('created_at', today.toISOString());
  }

  async getBloqueadosPorVendedor() {
    return await this.supabase
      .from('mapa_asientos_viaje')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'bloqueado');
  }

  async getActividadReciente() {
    return await this.supabase
      .from('reservas')
      .select('id, estado, created_at, viaje:viaje_id(origen, destino)')
      .order('created_at', { ascending: false })
      .limit(10);
  }

  // ===========================================================================
  // STORAGE (Comprobantes de pago)
  // ===========================================================================

  async subirComprobante(filePath: string, file: File) {
    return await this.supabase.storage
      .from('comprobantes')
      .upload(filePath, file);
  }
}