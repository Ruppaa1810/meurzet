import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { Unidad } from '../models/database.types';

export interface SeatConfig {
  nro: number;
  piso: number;
  categoria: 'semicama' | 'cama_ejecutivo' | 'cama_suite';
}

@Injectable({ providedIn: 'root' })
export class UnidadService {
  async getUnidades() {
    return await supabase
      .from('unidades')
      .select('*')
      .order('created_at', { ascending: false });
  }

  async getUnidad(id: number) {
    return await supabase
      .from('unidades')
      .select('*')
      .eq('id', id)
      .single<Unidad>();
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

  async generarAsientosParaViaje(viajeId: number, unidadId: number) {
    const { data: unidad } = await this.getUnidad(unidadId);
    if (!unidad) return { error: new Error('Unidad no encontrada') };

    const seats: SeatConfig[] = (unidad.layout_config?.['asientos'] as SeatConfig[]) ?? [];
    if (seats.length === 0) return { error: new Error('La unidad no tiene configuración de asientos') };

    const rows = seats.map(s => ({
      viaje_id: viajeId,
      nro_asiento: s.nro,
      piso: s.piso,
      categoria: s.categoria,
      estado: 'libre' as const,
    }));

    return await supabase
      .from('mapa_asientos_viaje')
      .insert(rows)
      .select();
  }
}
