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

  async crearViajeConAsientos(params: {
    p_origen: string;
    p_destino: string;
    p_fecha_salida: string;
    p_fecha_llegada: string;
    p_precio_base: number;
    p_activo: boolean;
    p_unidad_id: number | null;
  }) {
    return await supabase.rpc('crear_viaje_con_asientos', params);
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
