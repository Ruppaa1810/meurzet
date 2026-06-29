import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import { AuditoriaService } from './auditoria.service';
import { NotificacionesService } from './notificaciones.service';
import type { Reserva } from '../models/database.types';

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

  async getReservasPendientes() {
    return await supabase
      .from('reservas')
      .select('*, viaje:viaje_id(*)')
      .in('estado', ['pendiente_comprobante', 'pendiente_validacion'])
      .order('created_at', { ascending: false });
  }

  async getReservasConfirmadasEnRango(desde: Date, hasta: Date) {
    return await supabase
      .from('reservas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'aprobado')
      .gte('created_at', desde.toISOString())
      .lt('created_at', hasta.toISOString());
  }

  async getActividadReciente() {
    return await supabase
      .from('reservas')
      .select('id, estado, created_at, viaje:viaje_id(origen, destino)')
      .order('created_at', { ascending: false })
      .limit(10);
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
      .select('id, agencia_nombre')
      .eq('id', reserva.vendedor_id)
      .single<{ id: string; agencia_nombre: string | null }>();
    const email = perfil?.agencia_nombre || '';

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

  async getTotalVendido(): Promise<number> {
    const { data } = await supabase
      .from('reservas')
      .select('viaje:viaje_id(precio_base)')
      .eq('estado', 'aprobado');
    return (data || []).reduce((sum: number, r: any) => sum + (r.viaje?.precio_base || 0), 0);
  }

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
