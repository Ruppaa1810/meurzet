import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import { AuditoriaService } from './auditoria.service';
import { NotificacionesService } from './notificaciones.service';
import type { Reserva } from '../models/database.types';
import { totalVentaReserva } from '../utils/calculo-financiero';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  constructor(
    private auditoria: AuditoriaService,
    private notificaciones: NotificacionesService,
  ) {}

  async crearReserva(reserva: Omit<Reserva, 'id' | 'created_at'>) {
    return await supabase
      .from('reservas')
      .insert(reserva)
      .select()
      .single<Reserva>();
  }

  async getReservasPorVendedor(vendedorId: string) {
    return await supabase
      .from('reservas')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .order('created_at', { ascending: false });
  }

  async getReservasPorVendedorConViaje(vendedorId: string) {
    return await supabase
      .from('reservas')
      .select('*, viaje:viaje_id(origen, destino, precio_base, fecha_salida, fecha_llegada), asiento:asiento_viaje_id(nro_asiento, piso, categoria)')
      .eq('vendedor_id', vendedorId)
      .order('created_at', { ascending: false });
  }

  /** Reservas desde una fecha; con vendedorIds, solo las de esos vendedores. */
  async getReservasPanel(desde: Date, vendedorIds: string[] | null) {
    let q = supabase
      .from('reservas')
      .select('id, estado, created_at, vendedor_id, pasajero_datos, viaje:viaje_id(origen, destino, precio_base)')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false });
    if (vendedorIds) q = q.in('vendedor_id', vendedorIds);
    return await q;
  }

  async contarEsperandoComprobante(vendedorIds: string[] | null): Promise<number> {
    let q = supabase
      .from('reservas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente_comprobante');
    if (vendedorIds) q = q.in('vendedor_id', vendedorIds);
    return (await q).count ?? 0;
  }

  async getReservasPendientes() {
    return await supabase
      .from('reservas')
      .select('*, viaje:viaje_id(*)')
      .in('estado', ['pendiente_comprobante', 'pendiente_validacion'])
      .order('created_at', { ascending: false });
  }

  private async notificar(reservaId: number, tipo: 'aprobada' | 'rechazada', motivo?: string) {
    const { data: reserva } = await supabase
      .from('reservas')
      .select('vendedor_id')
      .eq('id', reservaId)
      .single<{ vendedor_id: string }>();
    if (!reserva?.vendedor_id) return;

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('id, email, agencia_nombre')
      .eq('id', reserva.vendedor_id)
      .single<{ id: string; email: string | null; agencia_nombre: string | null }>();
    const email = perfil?.email || perfil?.agencia_nombre || '';

    if (tipo === 'aprobada') {
      this.notificaciones.notificarReservaAprobada(reservaId, email);
    } else if (tipo === 'rechazada' && motivo) {
      this.notificaciones.notificarReservaRechazada(reservaId, email, motivo);
    }
  }

  async aprobarReserva(reservaId: number, asientoViajeId: number) {
    const res = await supabase.rpc('aprobar_reserva', {
      p_reserva_id: reservaId,
      p_asiento_viaje_id: asientoViajeId,
    });
    if (!res.error) {
      this.auditoria.log(asientoViajeId, 'aprobacion');
      this.notificar(reservaId, 'aprobada');
    }
    return res;
  }

  async rechazarReserva(reservaId: number, asientoViajeId: number, motivo: string) {
    const res = await supabase.rpc('rechazar_reserva', {
      p_reserva_id: reservaId,
      p_asiento_viaje_id: asientoViajeId,
      p_motivo: motivo,
    });
    if (!res.error) {
      this.auditoria.log(asientoViajeId, 'rechazo');
      this.notificar(reservaId, 'rechazada', motivo);
    }
    return res;
  }

  async checkAsientoTieneReserva(asientoViajeId: number) {
    return await supabase
      .from('reservas')
      .select('id')
      .eq('asiento_viaje_id', asientoViajeId)
      .in('estado', ['pendiente_comprobante', 'pendiente_validacion', 'aprobado'])
      .maybeSingle();
  }

  /** Total de las ventas aprobadas, con el precio al que se vendieron y el recargo por cuotas. */
  async actualizarComprobante(ids: number[], url: string) {
    return await supabase
      .from('reservas')
      .update({ comprobante_url: url, estado: 'pendiente_validacion' })
      .in('id', ids);
  }

  async actualizarComprobanteSingle(id: number, url: string) {
    return await supabase
      .from('reservas')
      .update({ comprobante_url: url, estado: 'pendiente_validacion' })
      .eq('id', id);
  }
}
