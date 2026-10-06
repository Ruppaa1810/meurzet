import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { PagoMovimiento, Reserva, Viaje, EstadoPagoMovimiento, EstadoFinanciero } from '../models/database.types';
import { totalVentaReserva } from '../utils/calculo-financiero';

export type PagoConReserva = PagoMovimiento & {
  reserva: (Reserva & { viaje?: Viaje }) | null;
};

/** Pago de toda la venta: el del responsable financiero con el monto de todos los asientos sumado. */
export type PagoGrupo = PagoConReserva & { pagos: PagoConReserva[] };

/**
 * Cada asiento tiene su propia seña y sus cuotas, pero el cliente paga todo junto con un solo comprobante:
 * la seña (o la cuota N) de todos los asientos de la venta se valida como un solo pago.
 */
export function agruparPagos(pagos: PagoConReserva[]): PagoGrupo[] {
  const grupos = new Map<string, PagoConReserva[]>();
  for (const p of pagos) {
    const gid = (p.reserva?.pasajero_datos as Record<string, unknown> | undefined)?.['grupo_id'];
    const key = gid ? `${gid}|${p.tipo}|${p.cuota_numero ?? ''}` : `pago-${p.id}`;
    grupos.set(key, [...(grupos.get(key) ?? []), p]);
  }
  return [...grupos.values()].map(ps => {
    const rep = ps.find(p => (p.reserva?.pasajero_datos as Record<string, unknown> | undefined)?.['es_responsable_financiero']) ?? ps[0];
    return { ...rep, monto: ps.reduce((s, p) => s + p.monto, 0), pagos: ps };
  });
}

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

  /**
   * Pagos para que la agencia apruebe: solo los que tienen comprobante subido.
   * La cuota lleva su propio comprobante; la seña usa el de la reserva.
   */
  async getPagosPendientes(vendedorIds: string[] | null = null) {
    const res = await supabase
      .from('pagos_movimientos')
      .select('*, reserva:reserva_id(*, viaje:viaje_id(*))')
      .eq('estado_pago', 'pendiente')
      .order('created_at', { ascending: false }) as unknown as { data: PagoConReserva[] | null; error: any };
    // Con vendedorIds (operador): solo los pagos de sus vendedores
    const data = res.data?.filter(p =>
      (p.tipo === 'cuota' ? !!p.comprobante_url : !!p.reserva?.comprobante_url) &&
      (!vendedorIds || vendedorIds.includes(p.reserva?.vendedor_id ?? '')),
    );
    return { ...res, data: data ? agruparPagos(data) : null };
  }

  async countPagosPendientes(vendedorIds: string[] | null = null): Promise<number> {
    return (await this.getPagosPendientes(vendedorIds)).data?.length ?? 0;
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
