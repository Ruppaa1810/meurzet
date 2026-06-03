import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import type { Reserva, Viaje, UserRole } from '../../../models/database.types';

type ReservaConViaje = Reserva & { viaje?: Viaje };

@Component({
  selector: 'app-validaciones',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './validaciones.html',
})
export class Validaciones implements OnInit, OnDestroy {
  reservas: ReservaConViaje[] = [];
  loading = true;
  error = '';
  rol: UserRole | null = null;

  // Paginación
  currentPage = 1;
  readonly itemsPerPage = 3;

  get paginatedReservas(): ReservaConViaje[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.reservas.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.reservas.length / this.itemsPerPage));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  irAPagina(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Modal de confirmación
  mostrarModal = false;
  accion: 'aprobar' | 'rechazar' | null = null;
  reservaAccion: ReservaConViaje | null = null;
  motivoRechazo = '';
  guardando = false;

  // Modal de comprobante
  comprobanteUrl: string | null = null;
  comprobanteCargando = false;
  comprobanteError = false;

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

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

  ngOnDestroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  async cargar() {
    this.loading = true;
    this.error = '';
    this.currentPage = 1;
    const { data, error } = await this.supabaseService.getReservasPendientes();
    if (error) {
      this.error = `Error al cargar reservas: ${error.message}`;
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
    if (!this.puedeGestionar) return;
    if (!reserva?.asiento_viaje_id) {
      this.error = `La reserva #${reserva?.id} no tiene un asiento asignado`;
      this.cerrarModal();
      return;
    }

    if (this.accion === 'rechazar' && !this.motivoRechazo.trim()) return;

    this.guardando = true;

    try {
      if (this.accion === 'aprobar') {
        const { error } = await this.supabaseService.aprobarReserva(reserva.id, reserva.asiento_viaje_id);
        if (error) { this.error = error.message; return; }
        this.reservas = this.reservas.filter(r => r.id !== reserva.id);
        if (this.paginatedReservas.length === 0 && this.currentPage > 1) {
          this.currentPage--;
        }
      } else {
        const { error } = await this.supabaseService.rechazarReserva(reserva.id, reserva.asiento_viaje_id, this.motivoRechazo.trim());
        if (error) { this.error = error.message; return; }
        this.reservas = this.reservas.filter(r => r.id !== reserva.id);
        if (this.paginatedReservas.length === 0 && this.currentPage > 1) {
          this.currentPage--;
        }
      }

      const accionActual = this.accion;
      this.cerrarModal();
      this.mostrarSuccessMensaje = accionActual === 'aprobar'
        ? `Reserva #${reserva.id} aprobada correctamente`
        : `Reserva #${reserva.id} rechazada`;
      this.timeoutId = setTimeout(() => this.mostrarSuccessMensaje = '', 5000);
    } catch (e: any) {
      this.error = e?.message || 'Error inesperado';
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  verComprobante(url: string) {
    this.comprobanteUrl = url;
    this.comprobanteCargando = true;
    this.comprobanteError = false;
  }

  cerrarComprobante() {
    this.comprobanteUrl = null;
    this.comprobanteCargando = false;
    this.comprobanteError = false;
  }
  
}
