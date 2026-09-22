import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { PerfilService } from '../../../services/perfil.service';
import { ReservaService } from '../../../services/reserva.service';
import { StorageService } from '../../../services/storage.service';
import { PagoService } from '../../../services/pago.service';
import { ComprobanteService, DatosComprobante } from '../../../services/comprobante.service';
import { ComisionService } from '../../../services/comision.service';
import type { Reserva, PagoMovimiento, EstadoFinanciero, Comision } from '../../../models/database.types';
import { estadoFinancieroLabel, estadoFinancieroClass, estadoFinancieroDot } from '../../../utils/estado-financiero';
import { calcularFinanciero, montoPagadoConfirmado, parsearPagoPasajero } from '../../../utils/calculo-financiero';
import { embarqueLabel } from '../../../utils/embarques';

interface ReservaView extends Reserva {
  viajeLabel: string;
  pasajeroNombre: string;
  monto: number;
  uploading: boolean;
  uploadMsg: string;
  uploadOk: boolean;
  pagos: PagoMovimiento[];
}

interface ReservaGroup {
  grupoId: string;
  viajeLabel: string;
  reservas: ReservaView[];
  estado: string;
  uploading: boolean;
  uploadMsg: string;
  uploadOk: boolean;
}

/** Una cuota del grupo: junta la cuota N de cada asiento. */
interface CuotaGrupo {
  numero: number;
  total: number;
  monto: number;
  estado: 'pendiente' | 'en_validacion' | 'pagada';
  idsAInformar: number[];
}

type Filtro = 'todas' | 'accion' | 'curso' | 'pagadas' | 'rechazadas';
type Etapa = 'falta_comprobante' | 'en_validacion' | 'pagando' | 'cuota_en_validacion' | 'saldo' | 'pagada' | 'rechazada';

const ETAPAS: Record<Etapa, { label: string; clase: string; accion: boolean }> = {
  falta_comprobante:   { label: 'Falta comprobante', clase: 'bg-amber-50 text-amber-700 border-amber-200', accion: true },
  en_validacion:       { label: 'En validación', clase: 'bg-blue-50 text-blue-700 border-blue-200', accion: false },
  pagando:             { label: 'Pagando cuotas', clase: 'bg-amber-50 text-amber-700 border-amber-200', accion: true },
  cuota_en_validacion: { label: 'Cuota en validación', clase: 'bg-blue-50 text-blue-700 border-blue-200', accion: false },
  saldo:               { label: 'Saldo pendiente', clase: 'bg-amber-50 text-amber-700 border-amber-200', accion: false },
  pagada:              { label: 'Pagada', clase: 'bg-green-50 text-green-700 border-green-200', accion: false },
  rechazada:           { label: 'Rechazada', clase: 'bg-red-50 text-red-700 border-red-200', accion: false },
};

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mis-reservas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisReservas implements OnInit {
  Math = Math;
  embarqueLabel = embarqueLabel;
  reservas: ReservaView[] = [];
  grupos: ReservaGroup[] = [];
  loading = true;

  filtro: Filtro = 'todas';
  busqueda = '';

  readonly filtros: { valor: Filtro; label: string }[] = [
    { valor: 'todas', label: 'Todas' },
    { valor: 'accion', label: 'Requieren acción' },
    { valor: 'curso', label: 'En curso' },
    { valor: 'pagadas', label: 'Pagadas' },
    { valor: 'rechazadas', label: 'Rechazadas' },
  ];

  private coincideFiltro(g: ReservaGroup, f: Filtro): boolean {
    const e = this.etapa(g);
    switch (f) {
      case 'accion': return ETAPAS[e].accion;
      case 'curso': return e !== 'pagada' && e !== 'rechazada';
      case 'pagadas': return e === 'pagada';
      case 'rechazadas': return e === 'rechazada';
      default: return true;
    }
  }

  get gruposFiltrados(): ReservaGroup[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.grupos
      .filter(g => this.coincideFiltro(g, this.filtro))
      .filter(g => !q || [g.viajeLabel, ...g.reservas.flatMap(r => [r.pasajeroNombre, this.pasajeroDatos(r)['documento']])]
        .join(' ').toLowerCase().includes(q))
      // Lo que requiere acción primero; el resto mantiene el orden por fecha
      .sort((a, b) => Number(ETAPAS[this.etapa(b)].accion) - Number(ETAPAS[this.etapa(a)].accion));
  }

  cantidadPorFiltro(f: Filtro): number {
    return this.grupos.filter(g => this.coincideFiltro(g, f)).length;
  }

  setFiltro(f: Filtro) {
    this.filtro = f;
    this.cdr.detectChanges();
  }

  selectedGroup: ReservaGroup | null = null;

  comisionesPorReserva = new Map<number, Comision>();
  porcentajeComision = 0;

  grupoCuota: ReservaGroup | null = null;
  cuotaSeleccionada: CuotaGrupo | null = null;
  cuotaSubiendo = false;
  cuotaError = '';

  constructor(
    private authService: AuthService,
    private perfilService: PerfilService,
    private reservaService: ReservaService,
    private storageService: StorageService,
    private pagoService: PagoService,
    private comprobanteService: ComprobanteService,
    private comisionService: ComisionService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data: perfil } = await this.perfilService.getCurrentProfile();
      if (!perfil?.id) return;

      const [{ data: raw }, { data: comisiones }, { data: config }] = await Promise.all([
        this.reservaService.getReservasPorVendedorConViaje(perfil.id),
        this.comisionService.getComisionesByVendedor(perfil.id),
        this.comisionService.getConfigByVendedor(perfil.id),
      ]);
      if (!raw) return;
      this.comisionesPorReserva = new Map((comisiones ?? []).map(c => [c.reserva_id, c]));
      this.porcentajeComision = config?.activo ? config.porcentaje : 0;

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

  calcGrupo(g: ReservaGroup) {
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

  private derivarFallback(r: ReservaView): EstadoFinanciero {
    if (r.estado === 'aprobado') return r.tipo_pago === 'total' ? 'pagado_total' : 'pagado_parcial';
    if (r.estado === 'rechazado') return 'reembolso_pendiente';
    return 'pendiente';
  }

  get montoTotalPagado(): number {
    return this.reservas.reduce((sum, r) => sum + montoPagadoConfirmado(r.pagos), 0);
  }

  abrirDetalle(g: ReservaGroup) {
    this.selectedGroup = g;
    document.body.style.overflow = 'hidden';
    this.cdr.detectChanges();
  }

  cerrarDetalle() {
    this.selectedGroup = null;
    document.body.style.overflow = '';
    this.cdr.detectChanges();
  }

  pasajeroDatos(r: ReservaView): Record<string, any> {
    return (r.pasajero_datos || {}) as Record<string, any>;
  }

  esGrupo(g: ReservaGroup): boolean {
    return g.reservas.length > 1;
  }

  fechaSalida(g: ReservaGroup): string {
    const v = (g.reservas[0] as any)?.viaje;
    return v?.fecha_salida || '';
  }

  fechaLlegada(g: ReservaGroup): string {
    const v = (g.reservas[0] as any)?.viaje;
    return v?.fecha_llegada || '';
  }

  categoriaAsiento(g: ReservaGroup): string {
    const v = (g.reservas[0] as any)?.viaje;
    return v?.categoria || '';
  }

  formatFechaHora(fecha: string): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  pagoEstadoClass(estado: string): string {
    return estado === 'confirmado' ? 'bg-green-100 text-green-700'
      : estado === 'rechazado' ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';
  }

  pagoEstadoLabel(estado: string): string {
    return estado === 'confirmado' ? 'Confirmado' : estado === 'rechazado' ? 'Rechazado' : 'Pendiente';
  }

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

  todosPagos(g: ReservaGroup): PagoMovimiento[] {
    return g.reservas.flatMap(r => r.pagos);
  }

  pagosSena(g: ReservaGroup): PagoMovimiento[] {
    return this.todosPagos(g).filter(p => p.tipo === 'seña');
  }

  pagosCuotas(g: ReservaGroup): PagoMovimiento[] {
    return this.todosPagos(g).filter(p => p.tipo === 'cuota');
  }

  senaConfirmada(g: ReservaGroup): boolean {
    return this.pagosSena(g).every(p => p.estado_pago === 'confirmado');
  }

  cuotasGrupo(g: ReservaGroup): CuotaGrupo[] {
    const porNumero = new Map<number, PagoMovimiento[]>();
    for (const p of this.pagosCuotas(g)) {
      const n = p.cuota_numero ?? 1;
      porNumero.set(n, [...(porNumero.get(n) ?? []), p]);
    }
    return [...porNumero.entries()].sort(([a], [b]) => a - b).map(([numero, pagos]) => {
      const pendientes = pagos.filter(p => p.estado_pago === 'pendiente');
      const aInformar = pendientes.filter(p => !p.comprobante_url);
      return {
        numero,
        total: pagos[0].cuotas_totales ?? porNumero.size,
        monto: pagos.reduce((s, p) => s + p.monto, 0),
        estado: aInformar.length ? 'pendiente' : pendientes.length ? 'en_validacion' : 'pagada',
        idsAInformar: aInformar.map(p => p.id),
      };
    });
  }

  proximaCuota(g: ReservaGroup): CuotaGrupo | undefined {
    return this.cuotasGrupo(g).find(c => c.estado !== 'pagada');
  }

  etapa(g: ReservaGroup): Etapa {
    if (g.estado === 'rechazado') return 'rechazada';
    if (this.hayPendienteComprobante(g)) return 'falta_comprobante';
    if (g.reservas.some(r => r.estado === 'pendiente_validacion')) return 'en_validacion';
    if (this.calcGrupo(g).montoPendiente <= 0) return 'pagada';
    const proxima = this.proximaCuota(g);
    if (proxima?.estado === 'pendiente') return 'pagando';
    if (proxima?.estado === 'en_validacion') return 'cuota_en_validacion';
    return 'saldo';
  }

  etapaInfo(g: ReservaGroup) {
    return ETAPAS[this.etapa(g)];
  }

  /** Qué tiene que hacer o esperar el vendedor, en una línea. */
  etapaDetalle(g: ReservaGroup): string {
    const c = this.proximaCuota(g);
    switch (this.etapa(g)) {
      case 'falta_comprobante': return 'Subí el comprobante de la seña que te pasó el cliente';
      case 'en_validacion': return 'El admin está revisando el comprobante de la seña';
      case 'pagando': return `Cuota ${c!.numero}/${c!.total} de ${this.formatPrecio(c!.monto)}: informala cuando el cliente pague`;
      case 'cuota_en_validacion': return `El admin está revisando el comprobante de la cuota ${c!.numero}/${c!.total}`;
      case 'saldo': return `El cliente debe ${this.formatPrecio(this.saldoPendienteGroup(g))}`;
      case 'pagada': return 'El cliente pagó todo';
      case 'rechazada': return this.motivoRechazo(g) || 'La reserva fue rechazada';
    }
  }

  /** El responsable financiero es quien paga: es el contacto que le importa al vendedor. */
  cliente(g: ReservaGroup): { nombre: string; telefono: string } {
    const r = g.reservas.find(r => this.pasajeroDatos(r)['es_responsable_financiero']) ?? g.reservas[0];
    return { nombre: r.pasajeroNombre, telefono: this.pasajeroDatos(r)['telefono'] || '' };
  }

  comisionGrupo(g: ReservaGroup): { estado: 'proxima' | 'a_cobrar' | 'cobrada'; monto: number } | null {
    const generadas = g.reservas.map(r => this.comisionesPorReserva.get(r.id)).filter((c): c is Comision => !!c);
    if (generadas.length) {
      return {
        estado: generadas.every(c => c.estado === 'pagado') ? 'cobrada' : 'a_cobrar',
        monto: generadas.reduce((s, c) => s + c.monto_comision, 0),
      };
    }
    if (this.etapa(g) === 'rechazada' || this.porcentajeComision <= 0) return null;
    return { estado: 'proxima', monto: Math.round(this.calcGrupo(g).totalFinal * this.porcentajeComision / 100) };
  }

  get resumen() {
    const activos = this.grupos.filter(g => this.etapa(g) !== 'rechazada');
    const comisiones = activos.map(g => this.comisionGrupo(g)).filter(c => !!c);
    const sumar = (estado: string) => comisiones.filter(c => c.estado === estado).reduce((s, c) => s + c.monto, 0);
    return {
      accion: this.cantidadPorFiltro('accion'),
      saldoClientes: activos.reduce((s, g) => s + this.saldoPendienteGroup(g), 0),
      comisionesACobrar: sumar('a_cobrar'),
      comisionesProximas: sumar('proxima'),
    };
  }

  abrirInformarCuota(g: ReservaGroup) {
    this.grupoCuota = g;
    this.cuotaSeleccionada = this.proximaCuota(g) ?? null;
    this.cuotaError = '';
    this.cdr.detectChanges();
  }

  cerrarInformarCuota() {
    this.grupoCuota = null;
    this.cuotaSeleccionada = null;
    this.cuotaSubiendo = false;
    this.cuotaError = '';
    this.cdr.detectChanges();
  }

  async informarCuota(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    const g = this.grupoCuota;
    const cuota = this.cuotaSeleccionada;
    if (!file || !g || !cuota) return;

    this.cuotaSubiendo = true;
    this.cuotaError = '';
    this.cdr.detectChanges();
    try {
      const userId = (await this.authService.getSession()).data.session?.user?.id;
      if (!userId) { this.cuotaError = 'Sesión expirada'; return; }

      const path = `${userId}/${Date.now()}_cuota${cuota.numero}_${file.name}`;
      const { error: uploadError } = await this.storageService.subirComprobante(path, file);
      if (uploadError) { this.cuotaError = 'Error al subir: ' + uploadError.message; return; }
      const { data: signed, error: signedError } = await this.storageService.getComprobanteUrl(path);
      if (signedError || !signed?.signedUrl) { this.cuotaError = 'Error al generar el enlace del comprobante'; return; }

      const { error } = await this.pagoService.informarPagoCuotas(cuota.idsAInformar, signed.signedUrl);
      if (error) { this.cuotaError = error.message; return; }

      for (const p of this.pagosCuotas(g)) {
        if (cuota.idsAInformar.includes(p.id)) p.comprobante_url = signed.signedUrl;
      }
      this.cerrarInformarCuota();
    } catch (e: any) {
      this.cuotaError = e?.message || 'Error inesperado';
    } finally {
      this.cuotaSubiendo = false;
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
      pasajeros: g.reservas.map(r => ({ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '', lugar_embarque: this.pasajeroDatos(r)['lugar_embarque'] })),
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
      pasajeros: g.reservas.map(r => ({ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '', lugar_embarque: this.pasajeroDatos(r)['lugar_embarque'] })),
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

  esEsperandoAprobacion(g: ReservaGroup): boolean {
    return g.reservas.every(r => r.estado === 'pendiente_validacion');
  }

  motivoRechazo(g: ReservaGroup): string {
    for (const r of g.reservas) {
      if (r.motivo_rechazo) return r.motivo_rechazo;
    }
    return '';
  }

  asientosLabel(g: ReservaGroup): string {
    const count = g.reservas.length;
    return `${count} asiento${count > 1 ? 's' : ''}`;
  }

  pagoPromedio(g: ReservaGroup): string {
    const { porcentajePago } = parsearPagoPasajero(g.reservas[0]?.pasajero_datos as Record<string, unknown>);
    return `${porcentajePago}%`;
  }

  verComprobante(r: ReservaView) {
    const c = this.calcReserva(r);
    const { metodoPago } = parsearPagoPasajero(r.pasajero_datos as Record<string, unknown>);
    const comprobante: DatosComprobante = {
      codigo: `MEU-${String(r.id).padStart(6, '0')}`,
      viaje: { origen: '', destino: '', fecha_salida: '', fecha_llegada: '', ...r, precio_base: r.monto } as any,
      asientos: [{ asientoId: r.asiento_viaje_id || 0, nroAsiento: 0, piso: 1, categoria: '' }],
      pasajeros: [{ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '', lugar_embarque: this.pasajeroDatos(r)['lugar_embarque'] }],
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
      pasajeros: [{ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '', lugar_embarque: this.pasajeroDatos(r)['lugar_embarque'] }],
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
      pendiente_comprobante: 'Pendiente comprobante',
      pendiente_validacion: 'Esperando aprobación',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
    };
    return estado ? map[estado] || estado : 'Desconocido';
  }

  estadoBadgeClass(estado: string | null): string {
    return estado === 'aprobado' ? 'bg-green-50 text-green-700 border border-green-200'
      : estado === 'rechazado' ? 'bg-red-50 text-red-700 border border-red-200'
      : estado === 'pendiente_validacion' ? 'bg-blue-50 text-blue-700 border border-blue-200'
      : 'bg-amber-50 text-amber-700 border border-amber-200';
  }

  estadoDotClass(estado: string | null): string {
    return estado === 'aprobado' ? 'bg-green-500'
      : estado === 'rechazado' ? 'bg-red-500'
      : estado === 'pendiente_validacion' ? 'bg-blue-500'
      : 'bg-amber-500';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  private metodoPagoStr(mp: string): string {
    const map: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta_credito: 'Tarjeta de crédito', otro: 'Otro' };
    return map[mp] || mp;
  }

  metodoPagoDirecto(mp: string): string {
    return this.metodoPagoStr(mp);
  }
}
