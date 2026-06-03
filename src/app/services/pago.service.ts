import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { PagoMovimiento, EstadoPagoMovimiento, EstadoFinanciero } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class PagoService {
  async getPagosPorReserva(reservaId: number) {
    return await supabase
      .from('pagos_movimientos')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: false });
  }

  async crearPago(data: Omit<PagoMovimiento, 'id' | 'created_at'>) {
    return await supabase
      .from('pagos_movimientos')
      .insert(data)
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
