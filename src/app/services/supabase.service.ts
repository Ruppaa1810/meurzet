import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { Viaje, MapaAsientoViaje, Perfil, Reserva, Unidad } from '../models/database.types';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  supabase: SupabaseClient;

  constructor() {

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
    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
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
    const { error: e1 } = await this.supabase
      .from('reservas')
      .update({ estado: 'aprobado', motivo_rechazo: null })
      .eq('id', reservaId);
    if (e1) return { error: e1 };
    const { error: e2 } = await this.supabase
      .from('mapa_asientos_viaje')
      .update({ estado: 'confirmado', vendedor_bloqueo_id: null, bloqueado_hasta: null })
      .eq('id', asientoViajeId);
    return { error: e2 };
  }

  async rechazarReserva(reservaId: number, asientoViajeId: number, motivo: string) {
    const { error: e1 } = await this.supabase
      .from('reservas')
      .update({ estado: 'rechazado', motivo_rechazo: motivo })
      .eq('id', reservaId);
    if (e1) return { error: e1 };
    const { error: e2 } = await this.supabase
      .from('mapa_asientos_viaje')
      .update({ estado: 'libre', vendedor_bloqueo_id: null, bloqueado_hasta: null })
      .eq('id', asientoViajeId);
    return { error: e2 };
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