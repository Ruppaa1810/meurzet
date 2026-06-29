import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PerfilService } from '../../../services/perfil.service';
import { PagoService, type PagoConReserva } from '../../../services/pago.service';
import { AuditoriaService } from '../../../services/auditoria.service';
import type { UserRole } from '../../../models/database.types';
import { Paginacion } from '../../../utils/paginacion';
import { PaginacionComponent } from '../../../components/paginacion';

@Component({
  selector: 'app-validaciones',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, PaginacionComponent],
  templateUrl: './validaciones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Validaciones implements OnInit, OnDestroy {
  pagos: PagoConReserva[] = [];
  loading = true;
  error = '';
  rol: UserRole | null = null;

  paginacion = new Paginacion(5);

  get paginatedPagos(): PagoConReserva[] {
    return this.paginacion.getPaginated(this.pagos);
  }

  mostrarModal = false;
  accion: 'aprobar' | 'rechazar' | null = null;
  pagoAccion: PagoConReserva | null = null;
  motivoRechazo = '';
  guardando = false;

  comprobanteUrl: string | null = null;
  comprobanteCargando = false;
  comprobanteError = false;

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private perfilService: PerfilService,
    private pagoService: PagoService,
    private auditoriaService: AuditoriaService,
    private cdr: ChangeDetectorRef,
  ) {}

  get puedeGestionar(): boolean {
    return this.rol === 'admin_mayorista' || this.rol === 'operador_admin';
  }

  async ngOnInit() {
    const { data } = await this.perfilService.getCurrentProfile();
    if (data) this.rol = data.rol;
    this.cargar();
  }

  ngOnDestroy() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  async cargar() {
    this.loading = true;
    this.error = '';
    this.paginacion.irAPagina(1);
    const { data, error } = await this.pagoService.getPagosPendientes();
    if (error) {
      this.error = `Error al cargar pagos: ${error.message}`;
    } else if (data) {
      this.pagos = data;
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  confirmarAprobar(pago: PagoConReserva) {
    this.pagoAccion = pago;
    this.accion = 'aprobar';
    this.motivoRechazo = '';
    this.mostrarModal = true;
  }

  confirmarRechazar(pago: PagoConReserva) {
    this.pagoAccion = pago;
    this.accion = 'rechazar';
    this.motivoRechazo = '';
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.pagoAccion = null;
    this.accion = null;
    this.motivoRechazo = '';
    this.guardando = false;
  }

  mostrarSuccessMensaje = '';

  async ejecutarAccion() {
    if (!this.puedeGestionar || !this.pagoAccion) return;
    if (this.accion === 'rechazar' && !this.motivoRechazo.trim()) return;

    this.guardando = true;
    const pago = this.pagoAccion;
    const reserva = pago.reserva;
    const reservaId = reserva?.id || pago.reserva_id;

    try {
      if (this.accion === 'aprobar') {
        const { error } = await this.pagoService.actualizarEstadoPago(pago.id, 'confirmado');
        if (error) { this.error = error.message; return; }
        await this.pagoService.recalcularEstadoFinanciero(reservaId, reserva?.viaje?.precio_base || 0);
        await this.auditoriaService.log(reserva?.id || 0, `Pago aprobado: $${pago.monto} (${pago.metodo_pago})`);
      } else {
        const { error } = await this.pagoService.actualizarEstadoPago(pago.id, 'rechazado');
        if (error) { this.error = error.message; return; }
        await this.pagoService.recalcularEstadoFinanciero(reservaId, reserva?.viaje?.precio_base || 0);
        await this.auditoriaService.log(reserva?.id || 0, `Pago rechazado: $${pago.monto} - Motivo: ${this.motivoRechazo.trim()}`);
      }

      this.pagos = this.pagos.filter(p => p.id !== pago.id);

      if (this.paginatedPagos.length === 0 && this.paginacion.currentPage > 1) {
        this.paginacion.irAPagina(this.paginacion.currentPage - 1);
      }

      const accionActual = this.accion;
      this.cerrarModal();
      this.mostrarSuccessMensaje = accionActual === 'aprobar'
        ? 'Pago aprobado correctamente'
        : 'Pago rechazado';
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

  pasajeroNombre(r: NonNullable<PagoConReserva['reserva']>): string {
    const d = (r.pasajero_datos || {}) as Record<string, any>;
    return [d['nombre'], d['apellido']].filter(Boolean).join(' ') || '-';
  }

  esResponsable(r: NonNullable<PagoConReserva['reserva']>): boolean {
    const d = (r.pasajero_datos || {}) as Record<string, any>;
    return d['es_responsable_financiero'] === true;
  }

  metodoPagoLabel(m: string): string {
    const map: Record<string, string> = {
      efectivo: 'Efectivo', transferencia: 'Transferencia',
      tarjeta_credito: 'Tarjeta de crédito', otro: 'Otro',
    };
    return map[m] || m;
  }

  tipoPagoLabel(p: import('../../../services/pago.service').PagoConReserva): string {
    if (p.tipo === 'seña') return 'Seña';
    return p.cuota_numero && p.cuotas_totales ? `Cuota ${p.cuota_numero}/${p.cuotas_totales}` : 'Cuota';
  }

  infoPlanPago(r: NonNullable<import('../../../services/pago.service').PagoConReserva['reserva']>): string {
    const d = (r.pasajero_datos || {}) as Record<string, any>;
    const pct = d['porcentaje_pago'] || 100;
    const cuotas = d['cuotas'] || 0;
    const recargo = d['recargo'] || 0;
    const parts: string[] = [`Seña: ${pct}%`];
    if (cuotas > 1) parts.push(`${cuotas} cuotas`);
    if (recargo > 0) parts.push(`${recargo}% recargo`);
    return parts.join(' · ');
  }

  private totalReserva(reserva: NonNullable<PagoConReserva['reserva']>): number {
    return reserva.viaje?.precio_base || 0;
  }
}
