import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { Viaje, MapaAsientoViaje, Perfil, Reserva } from '../models/database.types';

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

  // ===========================================================================
  // STORAGE (Comprobantes de pago)
  // ===========================================================================

  async subirComprobante(filePath: string, file: File) {
    return await this.supabase.storage
      .from('comprobantes')
      .upload(filePath, file);
  }

}