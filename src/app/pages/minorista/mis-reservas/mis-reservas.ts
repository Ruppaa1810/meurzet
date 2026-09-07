import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../services/auth.service';
import { PerfilService } from '../../../services/perfil.service';
import { ReservaService } from '../../../services/reserva.service';
import { StorageService } from '../../../services/storage.service';
import { PagoService } from '../../../services/pago.service';
import { ComprobanteService, DatosComprobante } from '../../../services/comprobante.service';
import type { Reserva, PagoMovimiento, EstadoFinanciero } from '../../../models/database.types';
import { estadoFinancieroLabel, estadoFinancieroClass, estadoFinancieroDot } from '../../../utils/estado-financiero';
import { calcularFinanciero, montoPagadoConfirmado, parsearPagoPasajero } from '../../../utils/calculo-financiero';

interface ReservaView extends Reserva {
  viajeLabel: string;
  pasajeroNombre: string;
  monto: number;
  uploading: boolean;
  uploadMsg: string;
  uploadOk: boolean;
  pagos: PagoMovimiento[];
  mostrandoPagos: boolean;
}

interface ReservaGroup {
  grupoId: string;
  viajeLabel: string;
  reservas: ReservaView[];
  estado: string;
  mostrandoPagos: boolean;
  detalleAbierto: boolean;
  uploading: boolean;
  uploadMsg: string;
  uploadOk: boolean;
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-reservas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisReservas implements OnInit {
  Math = Math;
  reservas: ReservaView[] = [];
  grupos: ReservaGroup[] = [];
  loading = true;
  accionAbierta: string | null = null;

  filtroEstado = '';
  filtroFecha = '';
  fechaBuffer = '';

  estadosFiltro = [
    { valor: '', label: 'Todos' },
    { valor: 'pendiente_comprobante', label: 'Pendiente' },
    { valor: 'aprobado', label: 'Aprobado' },
    { valor: 'rechazado', label: 'Rechazado' },
  ];

  get gruposFiltrados(): ReservaGroup[] {
    return this.grupos.filter(g => {
      if (this.filtroEstado && g.estado !== this.filtroEstado) return false;
      if (this.filtroFecha) {
        const f = new Date(g.reservas[0]?.created_at || '');
        const diaSel = new Date(this.filtroFecha + 'T00:00:00');
        if (f.toDateString() !== diaSel.toDateString()) return false;
      }
      return true;
    });
  }

  hayFiltrosActivos(): boolean {
    return !!this.filtroEstado || !!this.filtroFecha;
  }

  limpiarFiltros() {
    this.filtroEstado = '';
    this.filtroFecha = '';
    this.fechaBuffer = '';
    this.cdr.detectChanges();
  }

  setFiltroEstado(valor: string) {
    this.filtroEstado = valor;
    this.cdr.detectChanges();
  }

  aplicarFecha() {
    this.filtroFecha = this.fechaBuffer;
    this.cdr.detectChanges();
  }

  mostrarModalPago = false;
  pagoGrupo: ReservaGroup | null = null;
  pagoMonto = 0;
  pagoMetodo = 'transferencia';
  pagoReferencia = '';
  pagoGuardando = false;

  constructor(
    private authService: AuthService,
    private perfilService: PerfilService,
    private reservaService: ReservaService,
    private storageService: StorageService,
    private pagoService: PagoService,
    private comprobanteService: ComprobanteService,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener('document:click')
  documentClick() {
    this.accionAbierta = null;
  }

  async ngOnInit() {
    try {
      const { data: perfil } = await this.perfilService.getCurrentProfile();
      if (!perfil?.id) return;

      const { data: raw } = await this.reservaService.getReservasPorVendedorConViaje(perfil.id);
      if (!raw) return;

      const reservaIds = raw.map(r => r.id);
      const { data: todosPagos } = await this.pagoService.getPagosPorReservas(reservaIds);
      const pagosMap = new Map<number, PagoMovimiento[]>();
      for (const p of todosPagos || []) {
        const list = pagosMap.get(p.reserva_id) || [];
        list.push(p);
        pagosMap.set(p.reserva_id, list);
      }

      this.reservas = raw.map(r => {
        const viaje = (r as any).viaje;
        const d = (r.pasajero_datos || {}) as Record<string, any>;
        const nom = [d['nombre'], d['apellido']].filter(Boolean).join(' ') || '-';
        return {
          ...r,
          viajeLabel: viaje ? `${viaje.origen} → ${viaje.destino}` : `Viaje #${r.viaje_id}`,
          pasajeroNombre: nom,
          monto: viaje?.precio_base || 0,
          uploading: false,
          uploadMsg: '',
          uploadOk: false,
          pagos: pagosMap.get(r.id) || [],
          mostrandoPagos: false,
        };
      });
      this.armarGrupos();
    } catch {}
    this.loading = false;
    this.cdr.detectChanges();
  }

  private armarGrupos() {
    const map = new Map<string, ReservaGroup>();
    const order = ['rechazado', 'pendiente_comprobante', 'pendiente_validacion', 'aprobado', ''];
    for (const r of this.reservas) {
      const { grupoId: gid } = parsearPagoPasajero(r.pasajero_datos as Record<string, unknown>);
      const key = gid || `single-${r.id}`;
      if (!map.has(key)) {
        map.set(key, {
          grupoId: key,
          viajeLabel: r.viajeLabel,
          reservas: [],
          estado: '',
          mostrandoPagos: false,
          detalleAbierto: false,
          uploading: false,
          uploadMsg: '',
          uploadOk: false,
        });
      }
      const g = map.get(key)!;
      g.reservas.push(r);
      if (order.indexOf(r.estado || '') < order.indexOf(g.estado)) {
        g.estado = r.estado || '';
      }
      if (r.uploadOk) g.uploadOk = true;
    }
    this.grupos = Array.from(map.values());
  }

  private calcGrupo(g: ReservaGroup) {
    const { porcentajePago, cuotas, recargo } = parsearPagoPasajero(g.reservas[0]?.pasajero_datos as Record<string, unknown>);
    const totalBase = this.totalBaseGroup(g);
    const pagado = montoPagadoConfirmado(this.todosPagos(g));
    return calcularFinanciero(totalBase, porcentajePago, cuotas, recargo, pagado);
  }

  private calcReserva(r: ReservaView) {
    const { porcentajePago, cuotas, recargo } = parsearPagoPasajero(r.pasajero_datos as Record<string, unknown>);
    const pagado = montoPagadoConfirmado(r.pagos);
    return calcularFinanciero(r.monto, porcentajePago, cuotas, recargo, pagado);
  }

  efLabel(r: ReservaView): string {
    return estadoFinancieroLabel(r.estado_financiero || this.derivarFallback(r));
  }

  efClass(r: ReservaView): string {
    return estadoFinancieroClass(r.estado_financiero || this.derivarFallback(r));
  }

  efDot(r: ReservaView): string {
    return estadoFinancieroDot(r.estado_financiero || this.derivarFallback(r));
  }

  private derivarFallback(r: ReservaView): EstadoFinanciero {
    if (r.estado === 'aprobado') return r.tipo_pago === 'total' ? 'pagado_total' : 'pagado_parcial';
    if (r.estado === 'rechazado') return 'reembolso_pendiente';
    return 'pendiente';
  }

  estadoFinancieroGrupo(g: ReservaGroup): EstadoFinanciero {
    const c = this.calcGrupo(g);
    if (c.porcentajePagado <= 0) return 'pendiente';
    if (c.porcentajePagado >= 100) return 'pagado_total';
    return 'pagado_parcial';
  }

  efGrupoLabel(g: ReservaGroup): string { return estadoFinancieroLabel(this.estadoFinancieroGrupo(g)); }
  efGrupoClass(g: ReservaGroup): string { return estadoFinancieroClass(this.estadoFinancieroGrupo(g)); }
  efGrupoDot(g: ReservaGroup): string { return estadoFinancieroDot(this.estadoFinancieroGrupo(g)); }

  get montoTotalPagado(): number {
    return this.reservas.reduce((sum, r) => sum + montoPagadoConfirmado(r.pagos), 0);
  }

  togglePagos(r: ReservaView) { r.mostrandoPagos = !r.mostrandoPagos; }

  toggleAccion(id: string) {
    this.accionAbierta = this.accionAbierta === id ? null : id;
    this.cdr.detectChanges();
  }

  cerrarAccion() {
    this.accionAbierta = null;
    this.cdr.detectChanges();
  }

  progresoPago(r: ReservaView): number {
    return this.calcReserva(r).porcentajePagado;
  }

  metodoPagoStr(mp: string): string {
    const map: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta_credito: 'Tarjeta de crédito', otro: 'Otro' };
    return map[mp] || mp;
  }

  toggleDetalle(g: ReservaGroup) { g.detalleAbierto = !g.detalleAbierto; this.cdr.detectChanges(); }
  togglePagosGroup(g: ReservaGroup) { g.mostrandoPagos = !g.mostrandoPagos; this.cdr.detectChanges(); }

  totalBaseGroup(g: ReservaGroup): number {
    return g.reservas.reduce((s, r) => s + r.monto, 0);
  }

  totalFinalGrupo(g: ReservaGroup): number {
    return this.calcGrupo(g).totalFinal;
  }

  montoPagadoGroup(g: ReservaGroup): number {
    return montoPagadoConfirmado(this.todosPagos(g));
  }

  saldoPendienteGroup(g: ReservaGroup): number {
    return this.calcGrupo(g).montoPendiente;
  }

  progresoPagoGroup(g: ReservaGroup): number {
    return this.calcGrupo(g).porcentajePagado;
  }

  cuotasAcordadas(g: ReservaGroup): number {
    return parsearPagoPasajero(g.reservas[0]?.pasajero_datos as Record<string, unknown>).cuotas;
  }

  cuotasPagadas(g: ReservaGroup): number {
    return this.todosPagos(g).filter(p => p.tipo === 'cuota' && p.estado_pago === 'confirmado').length;
  }

  todosPagos(g: ReservaGroup): PagoMovimiento[] {
    return g.reservas.flatMap(r => r.pagos);
  }

  pagosSeña(g: ReservaGroup): PagoMovimiento[] {
    return this.todosPagos(g).filter(p => p.tipo === 'seña');
  }

  pagosCuotas(g: ReservaGroup): PagoMovimiento[] {
    return this.todosPagos(g).filter(p => p.tipo === 'cuota');
  }

  señaConfirmada(g: ReservaGroup): boolean {
    return this.pagosSeña(g).every(p => p.estado_pago === 'confirmado');
  }

  cuotasConfirmadas(g: ReservaGroup): number {
    return this.pagosCuotas(g).filter(p => p.estado_pago === 'confirmado').length;
  }

  cuotasPendientesList(g: ReservaGroup): PagoMovimiento[] {
    return this.pagosCuotas(g).filter(p => p.estado_pago === 'pendiente');
  }

  cuotasPendientesModal: PagoMovimiento[] = [];
  pagoCuotaSeleccionada: PagoMovimiento | null = null;

  abrirModalPago(g: ReservaGroup) {
    this.pagoGrupo = g;
    this.cuotasPendientesModal = this.cuotasPendientesList(g);
    this.pagoCuotaSeleccionada = null;
    this.pagoMonto = 0;
    this.pagoMetodo = 'transferencia';
    this.pagoReferencia = '';
    this.mostrarModalPago = true;
    this.accionAbierta = null;
    this.cdr.detectChanges();
  }

  seleccionarCuotaModal(p: PagoMovimiento) {
    this.pagoCuotaSeleccionada = p;
    this.pagoMonto = p.monto;
  }

  cerrarModalPago() {
    this.mostrarModalPago = false;
    this.pagoGrupo = null;
    this.cuotasPendientesModal = [];
    this.pagoCuotaSeleccionada = null;
    this.pagoMonto = 0;
    this.pagoMetodo = 'transferencia';
    this.pagoReferencia = '';
    this.pagoGuardando = false;
  }

  async registrarPago() {
    if (!this.pagoCuotaSeleccionada || !this.pagoGrupo) return;

    this.pagoGuardando = true;

    try {
      const { error } = await this.pagoService.confirmarPago(
        this.pagoCuotaSeleccionada.id,
        this.pagoMetodo,
        this.pagoReferencia || null,
      );
      if (error) throw error;

      const reservaIndividual = this.pagoGrupo.reservas.find(r => r.id === this.pagoCuotaSeleccionada!.reserva_id);
      const precioFinal = reservaIndividual ? this.calcReserva(reservaIndividual).totalFinal : this.totalFinalGrupo(this.pagoGrupo) / this.pagoGrupo.reservas.length;
      await this.pagoService.recalcularEstadoFinanciero(this.pagoCuotaSeleccionada.reserva_id, precioFinal);

      for (const r of this.pagoGrupo.reservas) {
        const { data } = await this.pagoService.getPagosPorReserva(r.id);
        if (data) r.pagos = data;
      }

      this.cerrarModalPago();
      this.cdr.detectChanges();
    } catch {
      this.cerrarModalPago();
    } finally {
      this.pagoGuardando = false;
      this.cdr.detectChanges();
    }
  }

  verComprobanteGroup(g: ReservaGroup) {
    const r0 = g.reservas[0];
    const c = this.calcGrupo(g);
    const { metodoPago } = parsearPagoPasajero(r0.pasajero_datos as Record<string, unknown>);
    const comprobante: DatosComprobante = {
      codigo: `GRUPO-${g.grupoId.substring(0, 8).toUpperCase()}`,
      viaje: { origen: '', destino: '', fecha_salida: '', fecha_llegada: '', ...r0, precio_base: c.totalFinal } as any,
      asientos: g.reservas.map(r => ({ asientoId: r.asiento_viaje_id || 0, nroAsiento: r.asiento_viaje_id || 0, piso: 1, categoria: '' })),
      pasajeros: g.reservas.map(r => ({ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' })),
      total: c.totalFinal,
      montoPagado: c.totalFinal - c.montoPendiente,
      montoPendiente: c.montoPendiente,
      pagoLabel: this.estadoLabel(r0.estado || ''),
      metodoPago,
      cuotasCount: c.montoPorCuota > 0 ? Math.round(c.saldoConRecargo / c.montoPorCuota) : 0,
      montoPorCuota: c.montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    this.comprobanteService.abrirParaImprimir(comprobante);
  }

  async verSaldoPendienteGroup(g: ReservaGroup) {
    const r0 = g.reservas[0];
    const c = this.calcGrupo(g);
    const { metodoPago } = parsearPagoPasajero(r0.pasajero_datos as Record<string, unknown>);
    const comprobante: DatosComprobante = {
      codigo: `GRUPO-${g.grupoId.substring(0, 8).toUpperCase()}`,
      viaje: { origen: '', destino: '', fecha_salida: '', fecha_llegada: '', ...r0, precio_base: this.totalBaseGroup(g) } as any,
      asientos: g.reservas.map(r => ({ asientoId: r.asiento_viaje_id || 0, nroAsiento: r.asiento_viaje_id || 0, piso: 1, categoria: '' })),
      pasajeros: g.reservas.map(r => ({ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' })),
      total: this.totalBaseGroup(g),
      montoPagado: c.totalFinal - c.montoPendiente,
      montoPendiente: c.montoPendiente,
      pagoLabel: this.estadoLabel(r0.estado || ''),
      metodoPago,
      cuotasCount: c.montoPorCuota > 0 ? Math.round(c.saldoConRecargo / c.montoPorCuota) : 0,
      montoPorCuota: c.montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    await this.comprobanteService.abrirSaldoParaImprimir(comprobante);
  }

  async subirComprobanteGroup(g: ReservaGroup, event: Event, fileInput?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    g.uploading = true;
    g.uploadMsg = '';
    this.cdr.detectChanges();

    try {
      const userId = (await this.authService.getSession()).data.session?.user?.id;
      if (!userId) { g.uploadMsg = 'Sesión expirada'; return; }

      const basePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await this.storageService.subirComprobante(basePath, file);
      if (uploadError) { g.uploadMsg = 'Error al subir: ' + uploadError.message; return; }

      const { data: signedUrl, error: signedError } = await this.storageService.getComprobanteUrl(basePath);
      if (signedError || !signedUrl?.signedUrl) { g.uploadMsg = 'Error al generar enlace'; return; }

      for (const r of g.reservas) {
        if (r.estado === 'pendiente_comprobante') {
          const { error } = await this.reservaService.actualizarComprobanteSingle(r.id, signedUrl.signedUrl);
          if (!error) r.estado = 'pendiente_validacion';
        }
      }

      g.uploadOk = true;
      g.uploadMsg = '';
      this.armarGrupos();
    } catch (e: any) {
      g.uploadMsg = e?.message || 'Error inesperado';
    } finally {
      g.uploading = false;
      if (fileInput) fileInput.value = '';
      this.cdr.detectChanges();
    }
  }

  hayPendienteComprobante(g: ReservaGroup): boolean {
    return g.reservas.some(r => r.estado === 'pendiente_comprobante');
  }

  asientosLabel(g: ReservaGroup): string {
    const count = g.reservas.length;
    return `${count} asiento${count > 1 ? 's' : ''}`;
  }

  pagoPromedio(g: ReservaGroup): string {
    const { porcentajePago } = parsearPagoPasajero(g.reservas[0]?.pasajero_datos as Record<string, unknown>);
    return `${porcentajePago}%`;
  }

  estructuraPago(g: ReservaGroup): string {
    const { porcentajePago, cuotas, recargo } = parsearPagoPasajero(g.reservas[0]?.pasajero_datos as Record<string, unknown>);
    const c = this.calcGrupo(g);
    const parts: string[] = [`Seña: ${porcentajePago}%`];
    if (cuotas > 1) {
      if (recargo > 0) parts.push(`Recargo: ${recargo}%`);
      parts.push(`${cuotas} cuota${cuotas > 1 ? 's' : ''} de ${this.formatPrecio(c.montoPorCuota)}`);
    }
    return parts.join(' · ');
  }

  verComprobante(r: ReservaView) {
    const c = this.calcReserva(r);
    const { metodoPago } = parsearPagoPasajero(r.pasajero_datos as Record<string, unknown>);
    const comprobante: DatosComprobante = {
      codigo: `MEU-${String(r.id).padStart(6, '0')}`,
      viaje: { origen: '', destino: '', fecha_salida: '', fecha_llegada: '', ...r, precio_base: r.monto } as any,
      asientos: [{ asientoId: r.asiento_viaje_id || 0, nroAsiento: 0, piso: 1, categoria: '' }],
      pasajeros: [{ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' }],
      total: c.totalFinal,
      montoPagado: c.totalFinal - c.montoPendiente,
      montoPendiente: c.montoPendiente,
      pagoLabel: this.efLabel(r),
      metodoPago,
      cuotasCount: c.montoPorCuota > 0 ? Math.round(c.saldoConRecargo / c.montoPorCuota) : 0,
      montoPorCuota: c.montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    this.comprobanteService.abrirParaImprimir(comprobante);
  }

  async verSaldoPendiente(r: ReservaView) {
    const c = this.calcReserva(r);
    const { metodoPago } = parsearPagoPasajero(r.pasajero_datos as Record<string, unknown>);
    const comprobante: DatosComprobante = {
      codigo: `MEU-${String(r.id).padStart(6, '0')}`,
      viaje: { origen: '', destino: '', fecha_salida: '', fecha_llegada: '', ...r, precio_base: r.monto } as any,
      asientos: [{ asientoId: r.asiento_viaje_id || 0, nroAsiento: 0, piso: 1, categoria: '' }],
      pasajeros: [{ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' }],
      total: r.monto,
      montoPagado: c.totalFinal - c.montoPendiente,
      montoPendiente: c.montoPendiente,
      pagoLabel: this.efLabel(r),
      metodoPago,
      cuotasCount: c.montoPorCuota > 0 ? Math.round(c.saldoConRecargo / c.montoPorCuota) : 0,
      montoPorCuota: c.montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    await this.comprobanteService.abrirSaldoParaImprimir(comprobante);
  }

  metodoPagoLabel(r: ReservaView): string {
    return this.metodoPagoStr(parsearPagoPasajero(r.pasajero_datos as Record<string, unknown>).metodoPago);
  }

  metodoPagoGroup(g: ReservaGroup): string {
    return this.metodoPagoStr(parsearPagoPasajero(g.reservas[0]?.pasajero_datos as Record<string, unknown>).metodoPago);
  }

  saldoPendiente(r: ReservaView): number {
    return this.calcReserva(r).montoPendiente;
  }

  estadoLabel(estado: string | null): string {
    const map: Record<string, string> = {
      pendiente_comprobante: 'Pendiente de comprobante',
      pendiente_validacion: 'Pendiente de validación',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
    };
    return estado ? map[estado] || estado : 'Desconocido';
  }

  estadoBadgeClass(estado: string | null): string {
    return estado === 'aprobado' ? 'bg-green-50 text-green-700 border border-green-200'
      : estado === 'rechazado' ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-amber-50 text-amber-700 border border-amber-200';
  }

  estadoDotClass(estado: string | null): string {
    return estado === 'aprobado' ? 'bg-green-500' : estado === 'rechazado' ? 'bg-red-500' : 'bg-amber-500';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  async subirComprobante(reserva: ReservaView, event: Event, fileInput?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    reserva.uploading = true;
    reserva.uploadMsg = '';
    reserva.uploadOk = false;
    this.cdr.detectChanges();

    try {
      const userId = (await this.authService.getSession()).data.session?.user?.id;
      if (!userId) { reserva.uploadMsg = 'Sesión expirada'; return; }

      const basePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await this.storageService.subirComprobante(basePath, file);
      if (uploadError) { reserva.uploadMsg = 'Error al subir: ' + uploadError.message; return; }

      const { data: signedUrl, error: signedError } = await this.storageService.getComprobanteUrl(basePath);
      if (signedError || !signedUrl?.signedUrl) { reserva.uploadMsg = 'Error al generar enlace del comprobante'; return; }

      const { error: updateError } = await this.reservaService.actualizarComprobanteSingle(reserva.id, signedUrl.signedUrl);
      if (updateError) { reserva.uploadMsg = 'Error al actualizar: ' + updateError.message; return; }

      reserva.estado = 'pendiente_validacion';
      reserva.uploadOk = true;
      reserva.uploadMsg = '';
    } catch (e: any) {
      reserva.uploadMsg = e?.message || 'Error inesperado';
    } finally {
      reserva.uploading = false;
      if (fileInput) fileInput.value = '';
      this.cdr.detectChanges();
    }
  }
}
