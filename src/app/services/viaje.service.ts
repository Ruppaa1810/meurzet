import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { Viaje } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class ViajeService {
  async getViajes() {
    return await supabase
      .from('viajes')
      .select('*')
      .eq('activo', true)
      .order('fecha_salida', { ascending: true });
  }

  async getViajesAdmin() {
    return await supabase
      .from('viajes')
      .select('*')
      .order('fecha_salida', { ascending: false });
  }

  async getViajePorId(viajeId: number) {
    return await supabase
      .from('viajes')
      .select('*')
      .eq('id', viajeId)
      .single<Viaje>();
  }

  async createViaje(data: Omit<Viaje, 'id' | 'created_at'>) {
    return await supabase
      .from('viajes')
      .insert(data)
      .select()
      .single<Viaje>();
  }

  async updateViaje(id: number, data: Partial<Viaje>) {
    return await supabase
      .from('viajes')
      .update(data)
      .eq('id', id)
      .select()
      .single<Viaje>();
  }

  async deleteViaje(id: number) {
    return await supabase
      .from('viajes')
      .delete()
      .eq('id', id);
  }
}
