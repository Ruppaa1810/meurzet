import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { PagoMovimiento, Reserva, Viaje, EstadoPagoMovimiento, EstadoFinanciero } from '../models/database.types';
import { totalVentaReserva } from '../utils/calculo-financiero';

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

  async getPagosPorReservas(reservaIds: number[]) {
    if (reservaIds.length === 0) return { data: [] as PagoMovimiento[], error: null };
    return await supabase
      .from('pagos_movimientos')
      .select('*')
      .in('reserva_id', reservaIds)
      .order('created_at', { ascending: false });
  }

  // Las cuotas solo llegan a validación cuando el vendedor subió su comprobante
  private static readonly PARA_VALIDAR = 'tipo.neq.cuota,comprobante_url.not.is.null';

  async getPagosPendientes() {
    return await supabase
      .from('pagos_movimientos')
      .select('*, reserva:reserva_id(*, viaje:viaje_id(*))')
      .or(PagoService.PARA_VALIDAR)
      .eq('estado_pago', 'pendiente')
      .order('created_at', { ascending: false }) as unknown as { data: PagoConReserva[] | null; error: any };
  }

  async countPagosPendientes(): Promise<number> {
    const { count } = await supabase
      .from('pagos_movimientos')
      .select('*', { count: 'exact', head: true })
      .or(PagoService.PARA_VALIDAR)
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

  async informarPagoCuotas(pagoIds: number[], comprobanteUrl: string) {
    return await supabase.rpc('informar_pago_cuotas', { p_pago_ids: pagoIds, p_comprobante_url: comprobanteUrl });
  }

  async rechazarComprobanteCuota(id: number, motivo: string) {
    return await supabase
      .from('pagos_movimientos')
      .update({ comprobante_url: null, motivo_rechazo: motivo })
      .eq('id', id);
  }

  /** Genera la comisión del vendedor cuando la reserva queda pagada al 100%. Se llama al aprobar un pago. */
  async generarComisionSiCorresponde(reservaId: number) {
    const { data: reserva } = await supabase
      .from('reservas')
      .select('vendedor_id, pasajero_datos, viaje:viaje_id(precio_base)')
      .eq('id', reservaId)
      .single<{ vendedor_id: string | null; pasajero_datos: Record<string, unknown>; viaje: { precio_base: number } | null }>();
    if (!reserva?.vendedor_id || !reserva.viaje) return;

    const { data: pagos } = await supabase
      .from('pagos_movimientos')
      .select('*')
      .eq('reserva_id', reservaId)
      .eq('estado_pago', 'confirmado')
      .order('created_at', { ascending: false });
    const { totalFinal, montoPendiente } = totalVentaReserva(reserva.viaje.precio_base, reserva.pasajero_datos, pagos ?? []);
    if (!pagos?.length || montoPendiente > 0) return;

    const { data: existente } = await supabase.from('comisiones').select('id').eq('reserva_id', reservaId).limit(1);
    if (existente?.length) return;

    const { data: config } = await supabase
      .from('comisiones_config')
      .select('porcentaje')
      .eq('vendedor_id', reserva.vendedor_id)
      .eq('activo', true)
      .maybeSingle();
    if (!config || config.porcentaje <= 0) return;

    return await supabase.from('comisiones').insert({
      reserva_id: reservaId,
      pago_id: pagos[0].id,
      vendedor_id: reserva.vendedor_id,
      monto_base: totalFinal,
      porcentaje: config.porcentaje,
      monto_comision: Math.round(totalFinal * config.porcentaje / 100),
    });
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
