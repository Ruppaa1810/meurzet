import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { PagoMovimiento, Reserva, Viaje, EstadoPagoMovimiento, EstadoFinanciero } from '../models/database.types';

export type PagoConReserva = PagoMovimiento & {
  reserva: (Reserva & { viaje?: Viaje }) | null;
};

@Injectable({ providedIn: 'root' })
export class PagoService {
  async getPagosPorReserva(reservaId: number) {
    return await supabase
      .from('pagos_movimientos')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: false });
  }

  async getPagosPendientes() {
    return await supabase
      .from('pagos_movimientos')
      .select('*, reserva:reserva_id(*, viaje:viaje_id(*))')
      .eq('estado_pago', 'pendiente')
      .order('created_at', { ascending: false }) as unknown as { data: PagoConReserva[] | null; error: any };
  }

  async countPagosPendientes(): Promise<number> {
    const { count } = await supabase
      .from('pagos_movimientos')
      .select('*', { count: 'exact', head: true })
      .eq('estado_pago', 'pendiente');
    return count ?? 0;
  }

  async crearPago(data: Omit<PagoMovimiento, 'id' | 'created_at'>) {
    return await supabase
      .from('pagos_movimientos')
      .insert(data)
      .select()
      .single<PagoMovimiento>();
  }

  async confirmarPago(id: number, metodo_pago: string, referencia: string | null) {
    return await supabase
      .from('pagos_movimientos')
      .update({ estado_pago: 'confirmado', metodo_pago, referencia })
      .eq('id', id)
      .select()
      .single<PagoMovimiento>();
  }

  async actualizarEstadoPago(id: number, estado: EstadoPagoMovimiento) {
    return await supabase
      .from('pagos_movimientos')
      .update({ estado_pago: estado })
      .eq('id', id)
      .select()
      .single<PagoMovimiento>();
  }

  async getTotalPagado(reservaId: number): Promise<number> {
    const { data } = await supabase
      .from('pagos_movimientos')
      .select('monto')
      .eq('reserva_id', reservaId)
      .eq('estado_pago', 'confirmado');
    return (data || []).reduce((sum, p) => sum + p.monto, 0);
  }

  async actualizarEstadoPagoPorReserva(reservaId: number, estado: EstadoPagoMovimiento) {
    return await supabase
      .from('pagos_movimientos')
      .update({ estado_pago: estado })
      .eq('reserva_id', reservaId);
  }

  async getTotalCobrado(): Promise<number> {
    const { data } = await supabase
      .from('pagos_movimientos')
      .select('monto')
      .eq('estado_pago', 'confirmado');
    return (data || []).reduce((sum, p) => sum + p.monto, 0);
  }

  async recalcularEstadoFinanciero(reservaId: number, precioTotal: number) {
    const totalPagado = await this.getTotalPagado(reservaId);
    let estado: EstadoFinanciero;
    if (totalPagado <= 0) {
      estado = 'pendiente';
    } else if (totalPagado >= precioTotal) {
      estado = 'pagado_total';
    } else {
      estado = 'pagado_parcial';
    }
    const { error } = await supabase
      .from('reservas')
      .update({ estado_financiero: estado, monto_pagado: totalPagado })
      .eq('id', reservaId);
    return { estado, totalPagado, error };
  }
}
