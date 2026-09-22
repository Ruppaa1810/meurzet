import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { ComisionConfig, Comision } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class ComisionService {

  async getConfigByVendedor(vendedorId: string) {
    return await supabase
      .from('comisiones_config')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .single<ComisionConfig>();
  }

  async getConfigsAll() {
    return await supabase
      .from('comisiones_config')
      .select('*, perfiles:vendedor_id(nombre, email)')
      .order('created_at', { ascending: false });
  }

  async upsertConfig(vendedorId: string, porcentaje: number) {
    return await supabase
      .from('comisiones_config')
      .upsert({ vendedor_id: vendedorId, porcentaje }, { onConflict: 'vendedor_id' })
      .select()
      .single<ComisionConfig>();
  }

  async crearComision(data: { reserva_id: number; pago_id: number; vendedor_id: string; monto_base: number; porcentaje: number }) {
    const monto_comision = Math.round(data.monto_base * data.porcentaje / 100);
    return await supabase
      .from('comisiones')
      .insert({ ...data, monto_comision })
      .select()
      .single<Comision>();
  }

  async getComisionesByVendedor(vendedorId: string, estado?: string) {
    let query = supabase
      .from('comisiones')
      .select('*, reserva:reserva_id(pasajero_datos, viaje:viaje_id(origen, destino, fecha_salida))')
      .eq('vendedor_id', vendedorId)
      .order('created_at', { ascending: false });
    if (estado) query = query.eq('estado', estado);
    return await query;
  }

  async getComisionesAll(estado?: string) {
    let query = supabase
      .from('comisiones')
      .select('*, perfiles:vendedor_id(nombre, email), reservas:reserva_id(id, pasajero_datos), pagos_movimientos:pago_id(monto, metodo_pago)')
      .order('created_at', { ascending: false });
    if (estado) query = query.eq('estado', estado);
    return await query;
  }

  async marcarComoPagada(ids: number[]) {
    return await supabase
      .from('comisiones')
      .update({ estado: 'pagado', pagado_at: new Date().toISOString() })
      .in('id', ids);
  }

  async getResumenByVendedor(vendedorId: string) {
    const { data } = await supabase
      .from('comisiones')
      .select('monto_comision, estado')
      .eq('vendedor_id', vendedorId);
    if (!data) return { totalGenerado: 0, totalPendiente: 0, totalPagado: 0 };
    const totalGenerado = data.reduce((s, c) => s + c.monto_comision, 0);
    const totalPendiente = data.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.monto_comision, 0);
    const totalPagado = data.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.monto_comision, 0);
    return { totalGenerado, totalPendiente, totalPagado };
  }

  async getResumenAll() {
    const { data } = await supabase
      .from('comisiones')
      .select('monto_comision, estado');
    if (!data) return { totalGenerado: 0, totalPendiente: 0, totalPagado: 0 };
    const totalGenerado = data.reduce((s, c) => s + c.monto_comision, 0);
    const totalPendiente = data.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.monto_comision, 0);
    const totalPagado = data.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.monto_comision, 0);
    return { totalGenerado, totalPendiente, totalPagado };
  }
}
