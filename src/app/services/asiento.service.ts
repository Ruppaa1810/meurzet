import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import { AuditoriaService } from './auditoria.service';

@Injectable({ providedIn: 'root' })
export class AsientoService {
  constructor(private auditoria: AuditoriaService) {}

  async getAsientosPorViaje(viajeId: number) {
    return await supabase
      .from('mapa_asientos_viaje')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('nro_asiento', { ascending: true });
  }

  async getAsientoPorNumero(viajeId: number, nroAsiento: number) {
    return await supabase
      .from('mapa_asientos_viaje')
      .select('id')
      .eq('viaje_id', viajeId)
      .eq('nro_asiento', nroAsiento)
      .single<{ id: number }>();
  }

  async bloquearAsiento(viajeId: number, nroAsiento: number, vendedorId: string) {
    const res = await supabase.rpc('bloquear_asiento', {
      p_viaje_id: viajeId,
      p_nro_asiento: nroAsiento,
      p_vendedor_id: vendedorId,
    });
    if (!res.error) {
      const { data } = await this.getAsientoPorNumero(viajeId, nroAsiento);
      if (data) this.auditoria.log(data.id, 'bloqueo');
    }
    return res;
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

  async liberarAsiento(viajeId: number, nroAsiento: number) {
    const { data } = await this.getAsientoPorNumero(viajeId, nroAsiento);
    const res = await supabase.rpc('liberar_asiento', {
      p_viaje_id: viajeId,
      p_nro_asiento: nroAsiento,
    });
    if (!res.error && data) {
      this.auditoria.log(data.id, 'liberacion');
    }
    return res;
  }
}
