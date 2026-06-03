import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { Unidad } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class UnidadService {
  async getUnidades() {
    return await supabase
      .from('unidades')
      .select('*')
      .order('created_at', { ascending: false });
  }

  async getUnidadesCount() {
    return await supabase
      .from('unidades')
      .select('id', { count: 'exact', head: true });
  }

  async createUnidad(data: Omit<Unidad, 'id' | 'created_at'>) {
    return await supabase
      .from('unidades')
      .insert(data)
      .select()
      .single<Unidad>();
  }

  async updateUnidad(id: number, data: Partial<Unidad>) {
    return await supabase
      .from('unidades')
      .update(data)
      .eq('id', id)
      .select()
      .single<Unidad>();
  }

  async deleteUnidad(id: number) {
    return await supabase
      .from('unidades')
      .delete()
      .eq('id', id);
  }

  async getBloqueadosPorVendedor() {
    return await supabase
      .from('mapa_asientos_viaje')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'bloqueado');
  }
}
