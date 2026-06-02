import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import type { Reserva, Viaje, UserRole } from '../../../models/database.types';

type ReservaConViaje = Reserva & { viaje?: Viaje };

@Component({
  selector: 'app-validaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validaciones.html',

})
export class Validaciones implements OnInit {
  reservas: ReservaConViaje[] = [];
  loading = true;
  error = '';
  rol: UserRole | null = null;

  // Modal de confirmación
  mostrarModal = false;
  accion: 'aprobar' | 'rechazar' | null = null;
  reservaAccion: ReservaConViaje | null = null;
  motivoRechazo = '';
  guardando = false;

  // Modal de comprobante
  comprobanteUrl: string | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  get puedeGestionar(): boolean {
    return this.rol === 'admin_mayorista' || this.rol === 'operador_admin';
  }

  async ngOnInit() {
    const { data } = await this.supabaseService.getCurrentProfile();
    if (data) this.rol = data.rol;
    this.cargar();
  }

  async cargar() {
    this.loading = true;
    this.error = '';
    const { data, error } = await this.supabaseService.getReservasPendientes();
    if (error) {
      this.error = 'Error al cargar reservas';
    } else if (data) {
      this.reservas = data;
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  confirmarAprobar(reserva: ReservaConViaje) {
    this.reservaAccion = reserva;
    this.accion = 'aprobar';
    this.motivoRechazo = '';
    this.mostrarModal = true;
  }

  confirmarRechazar(reserva: ReservaConViaje) {
    this.reservaAccion = reserva;
    this.accion = 'rechazar';
    this.motivoRechazo = '';
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.reservaAccion = null;
    this.accion = null;
    this.motivoRechazo = '';
    this.guardando = false;
  }

  mostrarSuccessMensaje = '';

  async ejecutarAccion() {
    const reserva = this.reservaAccion;
    if (!this.puedeGestionar || !reserva?.asiento_viaje_id) return;

    if (this.accion === 'rechazar' && !this.motivoRechazo.trim()) return;

    this.guardando = true;

    try {
      if (this.accion === 'aprobar') {
        const { error } = await this.supabaseService.aprobarReserva(reserva.id, reserva.asiento_viaje_id);
        if (error) { this.error = error.message; return; }
        this.reservas = this.reservas.filter(r => r.id !== reserva.id);
      } else {
        const { error } = await this.supabaseService.rechazarReserva(reserva.id, reserva.asiento_viaje_id, this.motivoRechazo.trim());
        if (error) { this.error = error.message; return; }
        this.reservas = this.reservas.filter(r => r.id !== reserva.id);
      }

      this.cerrarModal();
      this.mostrarSuccessMensaje = this.accion === 'aprobar'
        ? `Reserva #${reserva.id} aprobada correctamente`
        : `Reserva #${reserva.id} rechazada`;
      setTimeout(() => this.mostrarSuccessMensaje = '', 5000);
    } catch (e: any) {
      this.error = e?.message || 'Error inesperado';
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  verComprobante(url: string) {
    this.comprobanteUrl = url;
  }

  cerrarComprobante() {
    this.comprobanteUrl = null;
  }
}
