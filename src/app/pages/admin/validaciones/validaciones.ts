import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PerfilService } from '../../../services/perfil.service';
import { ReservaService } from '../../../services/reserva.service';
import { PagoService } from '../../../services/pago.service';
import type { Reserva, Viaje, UserRole } from '../../../models/database.types';

type ReservaConViaje = Reserva & { viaje?: Viaje };

interface GrupoValidacion {
  grupoId: string;
  reservas: ReservaConViaje[];
  estado: string;
  expanded: boolean;
  comprobanteUrl: string | null;
}

@Component({
  selector: 'app-validaciones',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './validaciones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Validaciones implements OnInit, OnDestroy {
  private _reservas: ReservaConViaje[] = [];
  grupos: GrupoValidacion[] = [];
  loading = true;
  error = '';
  rol: UserRole | null = null;

  // Paginación (por grupos)
  currentPage = 1;
  readonly itemsPerPage = 5;

  get paginatedGrupos(): GrupoValidacion[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.grupos.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.grupos.length / this.itemsPerPage));
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
  grupoAccion: GrupoValidacion | null = null;
  motivoRechazo = '';
  guardando = false;

  // Modal de comprobante
  comprobanteUrl: string | null = null;
  comprobanteCargando = false;
  comprobanteError = false;

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private perfilService: PerfilService,
    private reservaService: ReservaService,
    private pagoService: PagoService,
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
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  async cargar() {
    this.loading = true;
    this.error = '';
    this.currentPage = 1;
    const { data, error } = await this.reservaService.getReservasPendientes();
    if (error) {
      this.error = `Error al cargar reservas: ${error.message}`;
    } else if (data) {
      this._reservas = data;
      this.armarGrupos();
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  private armarGrupos() {
    const map = new Map<string, GrupoValidacion>();
    const order = ['pendiente_comprobante', 'pendiente_validacion'];

    for (const r of this._reservas) {
      const pd = r.pasajero_datos as Record<string, any>;
      const gid: string = pd?.['grupo_id'] || `single-${r.id}`;

      if (!map.has(gid)) {
        map.set(gid, {
          grupoId: gid,
          reservas: [],
          estado: '',
          expanded: !gid.startsWith('single-'),
          comprobanteUrl: null,
        });
      }

      const g = map.get(gid)!;
      g.reservas.push(r);

      if (order.indexOf(r.estado || '') < order.indexOf(g.estado || '')) {
        g.estado = r.estado || '';
      }

      if (r.comprobante_url && !g.comprobanteUrl) {
        g.comprobanteUrl = r.comprobante_url;
      }
    }

    this.grupos = Array.from(map.values());
  }

  confirmarAprobar(grupo: GrupoValidacion) {
    this.grupoAccion = grupo;
    this.accion = 'aprobar';
    this.motivoRechazo = '';
    this.mostrarModal = true;
  }

  confirmarRechazar(grupo: GrupoValidacion) {
    this.grupoAccion = grupo;
    this.accion = 'rechazar';
    this.motivoRechazo = '';
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.grupoAccion = null;
    this.accion = null;
    this.motivoRechazo = '';
    this.guardando = false;
  }

  toggleExpand(g: GrupoValidacion) {
    g.expanded = !g.expanded;
    this.cdr.detectChanges();
  }

  mostrarSuccessMensaje = '';

  get reservasAProcesar(): ReservaConViaje[] {
    if (!this.grupoAccion) return [];
    return this.accion === 'aprobar'
      ? this.grupoAccion.reservas.filter(r => r.estado === 'pendiente_validacion')
      : this.grupoAccion.reservas;
  }

  async ejecutarAccion() {
    if (!this.puedeGestionar || !this.grupoAccion) return;

    if (this.accion === 'rechazar' && !this.motivoRechazo.trim()) return;

    const aProcesar = this.reservasAProcesar;
    if (aProcesar.length === 0) {
      this.error = 'No hay reservas pendientes para procesar en este grupo';
      this.cerrarModal();
      return;
    }

    this.guardando = true;

    try {
      const idsProcesados = new Set<number>();

      for (const reserva of aProcesar) {
        if (!reserva.asiento_viaje_id) {
          this.error = `La reserva #${reserva.id} no tiene un asiento asignado`;
          continue;
        }

        if (this.accion === 'aprobar') {
          const { error } = await this.reservaService.aprobarReserva(reserva.id, reserva.asiento_viaje_id);
          if (error) { this.error = error.message; return; }
          await this.pagoService.actualizarEstadoPagoPorReserva(reserva.id, 'confirmado');
          await this.pagoService.recalcularEstadoFinanciero(reserva.id, this.totalReserva(reserva));
        } else {
          const { error } = await this.reservaService.rechazarReserva(reserva.id, reserva.asiento_viaje_id, this.motivoRechazo.trim());
          if (error) { this.error = error.message; return; }
          await this.pagoService.actualizarEstadoPagoPorReserva(reserva.id, 'rechazado');
          await this.pagoService.recalcularEstadoFinanciero(reserva.id, this.totalReserva(reserva));
        }

        idsProcesados.add(reserva.id);
      }

      this._reservas = this._reservas.filter(r => !idsProcesados.has(r.id));
      this.armarGrupos();

      if (this.paginatedGrupos.length === 0 && this.currentPage > 1) {
        this.currentPage--;
      }

      const accionActual = this.accion;
      const count = aProcesar.length;
      this.cerrarModal();
      this.mostrarSuccessMensaje = accionActual === 'aprobar'
        ? `${count} reserva${count > 1 ? 's' : ''} aprobada${count > 1 ? 's' : ''} correctamente`
        : `${count} reserva${count > 1 ? 's' : ''} rechazada${count > 1 ? 's' : ''}`;
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

  totalGrupo(g: GrupoValidacion): number {
    return g.reservas.reduce((s, r) => s + (r.viaje?.precio_base || 0), 0);
  }

  puedeAprobarGrupo(g: GrupoValidacion): boolean {
    return g.reservas.some(r => r.estado === 'pendiente_validacion');
  }

  estadoLabel(estado: string | null): string {
    const map: Record<string, string> = {
      pendiente_comprobante: 'Esperando comprobante',
      pendiente_validacion: 'Pendiente de validación',
    };
    return estado ? map[estado] || estado : 'Desconocido';
  }

  pasajeroNombre(r: ReservaConViaje): string {
    const d = (r.pasajero_datos || {}) as Record<string, any>;
    return [d['nombre'], d['apellido']].filter(Boolean).join(' ') || '-';
  }

  private totalReserva(reserva: ReservaConViaje): number {
    return reserva.viaje?.precio_base || 0;
  }
}
