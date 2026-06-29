import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../services/auth.service';
import { PerfilService } from '../../../services/perfil.service';
import { ReservaService } from '../../../services/reserva.service';
import { ViajeService } from '../../../services/viaje.service';
import { StorageService } from '../../../services/storage.service';
import { PagoService } from '../../../services/pago.service';
import { ComprobanteService, DatosComprobante } from '../../../services/comprobante.service';
import type { Reserva, Viaje, PagoMovimiento, MetodoPago, EstadoFinanciero } from '../../../models/database.types';
import { estadoFinancieroLabel, estadoFinancieroClass, estadoFinancieroDot } from '../../../utils/estado-financiero';

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

  // Filtros
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

  // Modal registro de pago
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
    private viajeService: ViajeService,
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

      const { data: raw } = await this.reservaService.getReservasPorVendedor(perfil.id);
      if (!raw) return;

      const viajeIds = [...new Set(raw.map(r => r.viaje_id).filter(Boolean))] as number[];
      const viajesMap = new Map<number, { label: string; precio: number }>();

      for (const id of viajeIds) {
        const { data } = await this.viajeService.getViajePorId(id);
        if (data) viajesMap.set(id, { label: `${data.origen} → ${data.destino}`, precio: data.precio_base });
      }

      this.reservas = await Promise.all(raw.map(async r => {
        const d = (r.pasajero_datos || {}) as Record<string, any>;
        const nom = [d['nombre'], d['apellido']].filter(Boolean).join(' ') || '-';
        const viajeInfo = viajesMap.get(r.viaje_id!);
        const monto = viajeInfo?.precio || 0;
        const { data: pagos } = await this.pagoService.getPagosPorReserva(r.id);
        return { ...r, viajeLabel: viajeInfo?.label || `Viaje #${r.viaje_id}`, pasajeroNombre: nom, monto, uploading: false, uploadMsg: '', uploadOk: false, pagos: pagos || [], mostrandoPagos: false };
      }));
      this.armarGrupos();
    } catch {
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  private armarGrupos() {
    const map = new Map<string, ReservaGroup>();
    const order = ['rechazado', 'pendiente_comprobante', 'pendiente_validacion', 'aprobado', ''];
    for (const r of this.reservas) {
      const pd = r.pasajero_datos as Record<string, any>;
      const gid: string = pd?.['grupo_id'] || `single-${r.id}`;
      if (!map.has(gid)) {
        map.set(gid, {
          grupoId: gid,
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
      const g = map.get(gid)!;
      g.reservas.push(r);
      if (order.indexOf(r.estado || '') < order.indexOf(g.estado)) {
        g.estado = r.estado || '';
      }
      if (r.uploadOk) g.uploadOk = true;
    }
    this.grupos = Array.from(map.values());
  }

  // Financial state per reserva — uses DB-calculated estado_financiero with fallback
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

  // Group-level financial state (derived from actual pagos)
  estadoFinancieroGrupo(g: ReservaGroup): EstadoFinanciero {
    const pagado = this.montoPagadoGroup(g);
    const totalFinal = this.totalFinalGrupo(g);
    if (pagado <= 0) return 'pendiente';
    if (pagado >= totalFinal) return 'pagado_total';
    return 'pagado_parcial';
  }

  efGrupoLabel(g: ReservaGroup): string {
    return estadoFinancieroLabel(this.estadoFinancieroGrupo(g));
  }

  efGrupoClass(g: ReservaGroup): string {
    return estadoFinancieroClass(this.estadoFinancieroGrupo(g));
  }

  efGrupoDot(g: ReservaGroup): string {
    return estadoFinancieroDot(this.estadoFinancieroGrupo(g));
  }

  get montoTotalPagado(): number {
    return this.reservas.reduce((sum, r) => sum + (r.pagos?.filter(p => p.estado_pago === 'confirmado').reduce((s, p) => s + p.monto, 0) || 0), 0);
  }

  togglePagos(r: ReservaView) {
    r.mostrandoPagos = !r.mostrandoPagos;
  }

  toggleAccion(id: string) {
    this.accionAbierta = this.accionAbierta === id ? null : id;
    this.cdr.detectChanges();
  }

  cerrarAccion() {
    this.accionAbierta = null;
    this.cdr.detectChanges();
  }

  progresoPago(r: ReservaView): number {
    const pd = r.pasajero_datos as Record<string, any>;
    const pct = typeof pd?.['porcentaje_pago'] === 'number' ? pd['porcentaje_pago'] : 1;
    const cuotas = pd?.['cuotas'] || 0;
    const recargo = pd?.['recargo'] || 0;
    const totalBase = r.monto;
    const montoAPagar = Math.round(totalBase * pct / 100);
    const saldoBase = Math.max(0, totalBase - montoAPagar);
    const saldoConRecargo = cuotas > 1 ? Math.round(saldoBase * (1 + recargo / 100)) : saldoBase;
    const totalFinal = montoAPagar + saldoConRecargo;
    const pagado = r.pagos.filter(p => p.estado_pago === 'confirmado').reduce((s, p) => s + p.monto, 0);
    return totalFinal > 0 ? Math.min(100, Math.round(pagado / totalFinal * 100)) : 0;
  }

  metodoPagoStr(mp: string): string {
    const map: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta_credito: 'Tarjeta de crédito',
      otro: 'Otro',
    };
    return map[mp] || mp;
  }

  toggleDetalle(g: ReservaGroup) {
    g.detalleAbierto = !g.detalleAbierto;
    this.cdr.detectChanges();
  }

  togglePagosGroup(g: ReservaGroup) {
    g.mostrandoPagos = !g.mostrandoPagos;
    this.cdr.detectChanges();
  }

  // Base total (sin recargo)
  totalBaseGroup(g: ReservaGroup): number {
    return g.reservas.reduce((s, r) => s + r.monto, 0);
  }

  // Total final con recargo y señal aplicados
  totalFinalGrupo(g: ReservaGroup): number {
    const pd0 = g.reservas[0]?.pasajero_datos as Record<string, any>;
    const pct = typeof pd0?.['porcentaje_pago'] === 'number' ? pd0['porcentaje_pago'] : 100;
    const cuotas = pd0?.['cuotas'] || 0;
    const recargo = pd0?.['recargo'] || 0;
    const totalBase = this.totalBaseGroup(g);
    const montoAPagar = Math.round(totalBase * pct / 100);
    const saldoBase = Math.max(0, totalBase - montoAPagar);
    const saldoConRecargo = cuotas > 1 ? Math.round(saldoBase * (1 + recargo / 100)) : saldoBase;
    return montoAPagar + saldoConRecargo;
  }

  montoPagadoGroup(g: ReservaGroup): number {
    return g.reservas.reduce((s, r) => s + r.pagos.filter(p => p.estado_pago === 'confirmado').reduce((sp, pp) => sp + pp.monto, 0), 0);
  }

  saldoPendienteGroup(g: ReservaGroup): number {
    return Math.max(0, this.totalFinalGrupo(g) - this.montoPagadoGroup(g));
  }

  progresoPagoGroup(g: ReservaGroup): number {
    const total = this.totalFinalGrupo(g);
    return total > 0 ? Math.min(100, Math.round(this.montoPagadoGroup(g) / total * 100)) : 0;
  }

  // Cuotas
  cuotasAcordadas(g: ReservaGroup): number {
    const pd0 = g.reservas[0]?.pasajero_datos as Record<string, any>;
    return pd0?.['cuotas'] || 0;
  }

  cuotasPagadas(g: ReservaGroup): number {
    return g.reservas.reduce((s, r) => s + r.pagos.filter(p => p.estado_pago === 'confirmado').length, 0);
  }

  // ---- Payment Plan Helpers ----

  todosPagos(g: ReservaGroup): PagoMovimiento[] {
    const pagos: PagoMovimiento[] = [];
    for (const r of g.reservas) {
      for (const p of r.pagos) pagos.push(p);
    }
    return pagos;
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

  // ---- Modal de registro de pago (ahora sobre cuotas existentes) ----

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
    if (!this.pagoCuotaSeleccionada) return;

    this.pagoGuardando = true;

    try {
      const { error } = await this.pagoService.confirmarPago(
        this.pagoCuotaSeleccionada.id,
        this.pagoMetodo,
        this.pagoReferencia || null,
      );
      if (error) throw error;

      await this.pagoService.recalcularEstadoFinanciero(this.pagoCuotaSeleccionada.reserva_id, this.totalFinalGrupo(this.pagoGrupo!) / this.pagoGrupo!.reservas.length);

      for (const r of this.pagoGrupo!.reservas) {
        const { data } = await this.pagoService.getPagosPorReserva(r.id);
        if (data) r.pagos = data;
      }

      this.cerrarModalPago();
      this.cdr.detectChanges();
    } catch (e: any) {
      this.cerrarModalPago();
    } finally {
      this.pagoGuardando = false;
      this.cdr.detectChanges();
    }
  }

  verComprobanteGroup(g: ReservaGroup) {
    const r0 = g.reservas[0];
    const viajeInfo = { origen: '', destino: '', fecha_salida: '', fecha_llegada: '' };
    const pd0 = r0.pasajero_datos as Record<string, any>;
    const totalFinal = this.totalFinalGrupo(g);
    const montoPagado = this.montoPagadoGroup(g);
    const montoPendiente = this.saldoPendienteGroup(g);
    const cuotas = this.cuotasAcordadas(g);
    const montoPorCuota = cuotas > 1 && totalFinal > this.totalBaseGroup(g) ? Math.round((totalFinal - Math.round(this.totalBaseGroup(g) * (typeof pd0?.['porcentaje_pago'] === 'number' ? pd0['porcentaje_pago'] : 100) / 100)) / cuotas) : 0;
    const comprobante: DatosComprobante = {
      codigo: `GRUPO-${g.grupoId.substring(0, 8).toUpperCase()}`,
      viaje: { ...viajeInfo, ...r0, precio_base: totalFinal } as any,
      asientos: g.reservas.map(r => ({ asientoId: r.asiento_viaje_id || 0, nroAsiento: r.asiento_viaje_id || 0, piso: 1, categoria: '' })),
      pasajeros: g.reservas.map(r => ({ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' })),
      total: totalFinal,
      montoPagado,
      montoPendiente,
      pagoLabel: this.estadoLabel(r0.estado || ''),
      metodoPago: pd0?.['metodo_pago'] || 'transferencia',
      cuotasCount: cuotas,
      montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    this.comprobanteService.abrirParaImprimir(comprobante);
  }

  verSaldoPendienteGroup(g: ReservaGroup) {
    const r0 = g.reservas[0];
    const viajeInfo = { origen: '', destino: '', fecha_salida: '', fecha_llegada: '' };
    const pd0 = r0.pasajero_datos as Record<string, any>;
    const totalBase = this.totalBaseGroup(g);
    const montoPagado = this.montoPagadoGroup(g);
    const montoPendiente = this.saldoPendienteGroup(g);
    const cuotas = this.cuotasAcordadas(g);
    const montoPorCuota = cuotas > 1 ? Math.round(this.totalFinalGrupo(g) / (g.reservas.length * cuotas)) : 0;
    const comprobante: DatosComprobante = {
      codigo: `GRUPO-${g.grupoId.substring(0, 8).toUpperCase()}`,
      viaje: { ...viajeInfo, ...r0, precio_base: totalBase } as any,
      asientos: g.reservas.map(r => ({ asientoId: r.asiento_viaje_id || 0, nroAsiento: r.asiento_viaje_id || 0, piso: 1, categoria: '' })),
      pasajeros: g.reservas.map(r => ({ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' })),
      total: totalBase,
      montoPagado,
      montoPendiente,
      pagoLabel: this.estadoLabel(r0.estado || ''),
      metodoPago: pd0?.['metodo_pago'] || 'transferencia',
      cuotasCount: cuotas,
      montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    this.comprobanteService.abrirSaldoParaImprimir(comprobante);
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
      if (!userId) {
        g.uploadMsg = 'Sesión expirada';
        return;
      }

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
    const pd0 = g.reservas[0]?.pasajero_datos as Record<string, any>;
    const pct = typeof pd0?.['porcentaje_pago'] === 'number' ? pd0['porcentaje_pago'] : 100;
    return `${pct}%`;
  }

  estructuraPago(g: ReservaGroup): string {
    const pd0 = g.reservas[0]?.pasajero_datos as Record<string, any>;
    const pct = typeof pd0?.['porcentaje_pago'] === 'number' ? pd0['porcentaje_pago'] : 100;
    const cuotas = pd0?.['cuotas'] || 0;
    const recargo = pd0?.['recargo'] || 0;
    const parts: string[] = [`Seña: ${pct}%`];
    if (cuotas > 1) {
      if (recargo > 0) parts.push(`Recargo: ${recargo}%`);
      const montoPorCuota = this.saldoPendienteGroup(g) > 0
        ? Math.round(this.totalFinalGrupo(g) / (g.reservas.length * cuotas))
        : 0;
      parts.push(`${cuotas} cuota${cuotas > 1 ? 's' : ''} de ${this.formatPrecio(montoPorCuota)}`);
    }
    return parts.join(' · ');
  }

  verComprobante(r: ReservaView) {
    const viajeInfo = { origen: '', destino: '', fecha_salida: '', fecha_llegada: '' };
    const pd = r.pasajero_datos as Record<string, any>;
    const pct = typeof pd?.['porcentaje_pago'] === 'number' ? pd['porcentaje_pago'] : 1;
    const montoPagado = r.pagos?.filter(p => p.estado_pago === 'confirmado').reduce((s, p) => s + p.monto, 0) || 0;
    const metodoPago = pd?.['metodo_pago'] || 'transferencia';
    const cuotas = pd?.['cuotas'] || 0;
    const recargo = pd?.['recargo'] || 0;
    const totalBase = r.monto;
    const montoAPagar = Math.round(totalBase * pct / 100);
    const saldoBase = Math.max(0, totalBase - montoAPagar);
    const saldoConRecargo = cuotas > 1 ? Math.round(saldoBase * (1 + recargo / 100)) : saldoBase;
    const totalFinal = montoAPagar + saldoConRecargo;
    const montoPendiente = Math.max(0, totalFinal - montoPagado);
    const montoPorCuota = cuotas > 1 ? Math.round(saldoConRecargo / cuotas) : 0;
    const comprobante: DatosComprobante = {
      codigo: `MEU-${String(r.id).padStart(6, '0')}`,
      viaje: { ...viajeInfo, ...r, precio_base: totalBase } as any,
      asientos: [{ asientoId: r.asiento_viaje_id || 0, nroAsiento: 0, piso: 1, categoria: '' }],
      pasajeros: [{ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' }],
      total: totalFinal,
      montoPagado,
      montoPendiente,
      pagoLabel: this.efLabel(r),
      metodoPago,
      cuotasCount: cuotas,
      montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    this.comprobanteService.abrirParaImprimir(comprobante);
  }

  verSaldoPendiente(r: ReservaView) {
    const viajeInfo = { origen: '', destino: '', fecha_salida: '', fecha_llegada: '' };
    const pd = r.pasajero_datos as Record<string, any>;
    const pct = typeof pd?.['porcentaje_pago'] === 'number' ? pd['porcentaje_pago'] : 1;
    const montoPagado = r.pagos?.filter(p => p.estado_pago === 'confirmado').reduce((s, p) => s + p.monto, 0) || 0;
    const metodoPago = pd?.['metodo_pago'] || 'transferencia';
    const cuotas = pd?.['cuotas'] || 0;
    const recargo = pd?.['recargo'] || 0;
    const totalBase = r.monto;
    const montoAPagar = Math.round(totalBase * pct / 100);
    const saldoBase = Math.max(0, totalBase - montoAPagar);
    const saldoConRecargo = cuotas > 1 ? Math.round(saldoBase * (1 + recargo / 100)) : saldoBase;
    const totalFinal = montoAPagar + saldoConRecargo;
    const montoPendiente = Math.max(0, totalFinal - montoPagado);
    const montoPorCuota = cuotas > 1 ? Math.round(saldoConRecargo / cuotas) : 0;
    const comprobante: DatosComprobante = {
      codigo: `MEU-${String(r.id).padStart(6, '0')}`,
      viaje: { ...viajeInfo, ...r, precio_base: totalBase } as any,
      asientos: [{ asientoId: r.asiento_viaje_id || 0, nroAsiento: 0, piso: 1, categoria: '' }],
      pasajeros: [{ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' }],
      total: totalBase,
      montoPagado,
      montoPendiente,
      pagoLabel: this.efLabel(r),
      metodoPago,
      cuotasCount: cuotas,
      montoPorCuota,
      fecha: new Date().toLocaleString('es-AR'),
    };
    this.comprobanteService.abrirSaldoParaImprimir(comprobante);
  }

  metodoPagoLabel(r: ReservaView): string {
    const datos = r.pasajero_datos as Record<string, any>;
    const mp = datos?.['metodo_pago'] || 'transferencia';
    return this.metodoPagoStr(mp);
  }

  metodoPagoGroup(g: ReservaGroup): string {
    const datos = g.reservas[0]?.pasajero_datos as Record<string, any>;
    const mp = datos?.['metodo_pago'] || 'transferencia';
    return this.metodoPagoStr(mp);
  }

  saldoPendiente(r: ReservaView): number {
    const pd = r.pasajero_datos as Record<string, any>;
    const pct = typeof pd?.['porcentaje_pago'] === 'number' ? pd['porcentaje_pago'] : 1;
    const cuotas = pd?.['cuotas'] || 0;
    const recargo = pd?.['recargo'] || 0;
    const totalBase = r.monto;
    const montoAPagar = Math.round(totalBase * pct / 100);
    const saldoBase = Math.max(0, totalBase - montoAPagar);
    const saldoConRecargo = cuotas > 1 ? Math.round(saldoBase * (1 + recargo / 100)) : saldoBase;
    const totalFinal = montoAPagar + saldoConRecargo;
    const pagado = r.pagos
      .filter(p => p.estado_pago === 'confirmado')
      .reduce((s, p) => s + p.monto, 0);
    return Math.max(0, totalFinal - pagado);
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
    return estado === 'aprobado' ? 'bg-green-500'
      : estado === 'rechazado' ? 'bg-red-500'
      : 'bg-amber-500';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
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
      if (!userId) {
        reserva.uploadMsg = 'Sesión expirada';
        return;
      }

      const basePath = `${userId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await this.storageService.subirComprobante(basePath, file);
      if (uploadError) {
        reserva.uploadMsg = 'Error al subir: ' + uploadError.message;
        return;
      }

      const { data: signedUrl, error: signedError } = await this.storageService.getComprobanteUrl(basePath);
      if (signedError || !signedUrl?.signedUrl) {
        reserva.uploadMsg = 'Error al generar enlace del comprobante';
        return;
      }

      const { error: updateError } = await this.reservaService.actualizarComprobanteSingle(reserva.id, signedUrl.signedUrl);

      if (updateError) {
        reserva.uploadMsg = 'Error al actualizar: ' + updateError.message;
        return;
      }

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
