import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class AsientoService {
  async getAsientosPorViaje(viajeId: number) {
    return await supabase
      .from('mapa_asientos_viaje')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('nro_asiento', { ascending: true });
  }

  async bloquearAsiento(viajeId: number, nroAsiento: number, vendedorId: string) {
    return await supabase.rpc('bloquear_asiento', {
      p_viaje_id: viajeId,
      p_nro_asiento: nroAsiento,
      p_vendedor_id: vendedorId,
    });
  }

  async getConteoLibresPorViaje(viajeIds: number[]): Promise<Record<number, number>> {
    if (viajeIds.length === 0) return {};
    const { data } = await supabase
      .from('mapa_asientos_viaje')
      .select('viaje_id, estado')
      .in('viaje_id', viajeIds);
    const counts: Record<number, number> = {};
    for (const a of data ?? []) {
      if (a.estado === 'libre') {
        counts[a.viaje_id!] = (counts[a.viaje_id!] ?? 0) + 1;
      }
    }
    return counts;
  }

  async getCategoriasPorViaje(viajeIds: number[]): Promise<Record<number, string>> {
    if (viajeIds.length === 0) return {};
    const { data } = await supabase
      .from('mapa_asientos_viaje')
      .select('viaje_id, categoria')
      .in('viaje_id', viajeIds);
    const cats: Record<number, Set<string>> = {};
    for (const a of data ?? []) {
      if (!cats[a.viaje_id!]) cats[a.viaje_id!] = new Set();
      cats[a.viaje_id!].add(a.categoria);
    }
    const result: Record<number, string> = {};
    const labels: Record<string, string> = {
      semicama: 'Semi Cama',
      cama_ejecutivo: 'Cama Ejecutivo',
      cama_suite: 'Cama Suite',
    };
    for (const [id, set] of Object.entries(cats)) {
      const arr = Array.from(set);
      result[Number(id)] = arr.length === 1 ? (labels[arr[0]] || arr[0]) : 'Mixto';
    }
    return result;
  }

  async liberarAsiento(viajeId: number, nroAsiento: number) {
    return await supabase.rpc('liberar_asiento', {
      p_viaje_id: viajeId,
      p_nro_asiento: nroAsiento,
    });
  }
}
