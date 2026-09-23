import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';
import { ReservaService } from '../../../services/reserva.service';
import { ReservaStateService } from '../../../services/reserva-state.service';
import { ComprobanteService, DatosComprobante, TipoComprobante } from '../../../services/comprobante.service';
import { ConfigGeneralService, BancoConfig } from '../../../services/config-general.service';
import { estadoFinancieroLabel, estadoFinancieroClass, estadoFinancieroDot, derivarEstadoFinanciero } from '../../../utils/estado-financiero';
import { embarqueLabel } from '../../../utils/embarques';

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './confirmacion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Confirmacion implements OnInit {
  subiendo = false;
  comprobanteSubido = false;
  mensaje = '';
  previewHtml: SafeHtml | null = null;
  embarqueLabel = embarqueLabel;

  constructor(
    public reservaState: ReservaStateService,
    private authService: AuthService,
    private storageService: StorageService,
    private reservaService: ReservaService,
    private comprobanteService: ComprobanteService,
    private configGeneral: ConfigGeneralService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
  ) {}

  banco: BancoConfig = { alias: '', cbu: '', titular: '', banco: '' };
  contacto = '';

  async ngOnInit() {
    if (!this.reservaState.viaje || this.reservaState.asientos.length === 0) {
      this.router.navigate(['/minorista/vender'], { replaceUrl: true });
    }
    this.banco = await this.configGeneral.getBanco();
    this.contacto = await this.configGeneral.getContacto();
    this.cdr.detectChanges();
  }

  get fechaActual(): string {
    return new Date().toLocaleString('es-AR');
  }

  get estadoFinanciero() {
    return derivarEstadoFinanciero('pendiente_comprobante', this.reservaState.tipoPagoMode === 'total' ? 'total' : 'parcial');
  }

  get estadoFinancieroLabel() {
    return estadoFinancieroLabel(this.estadoFinanciero);
  }

  get estadoFinancieroClass() {
    return estadoFinancieroClass(this.estadoFinanciero);
  }

  get estadoFinancieroDot() {
    return estadoFinancieroDot(this.estadoFinanciero);
  }

  get codigoReserva(): string {
    const id = this.reservaState.reservaIds[0];
    return id ? `MEU-${String(id).padStart(6, '0')}` : '---';
  }

  get total(): number {
    return this.reservaState.total;
  }

  get montoAPagar(): number {
    if (this.reservaState.tipoPagoMode === 'personalizado') return this.reservaState.montoPersonalizado;
    return Math.round(this.total * this.reservaState.porcentajePago / 100);
  }

  get pagoLabel(): string {
    if (this.reservaState.tipoPagoMode === 'total') return 'Pago Total';
    if (this.reservaState.tipoPagoMode === 'personalizado') return `Personalizado (${this.reservaState.porcentajePago}%)`;
    return `Seña (${this.reservaState.porcentajePago}%)`;
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  pisoLabel(piso: number): string {
    return piso === 1 ? 'Baja' : 'Alta';
  }

  get recargoPorcentaje(): number {
    return this.reservaState.recargoAplicado;
  }

  get saldoBase(): number {
    return Math.max(0, this.total - this.montoAPagar);
  }

  get totalFinal(): number {
    if (this.reservaState.cuotasSeleccionadas <= 1 || this.reservaState.recargoAplicado <= 0) return this.total;
    return this.montoAPagar + Math.round(this.saldoBase * (1 + this.reservaState.recargoAplicado / 100));
  }

  get montoPendiente(): number {
    return Math.max(0, this.totalFinal - this.montoAPagar);
  }

  get montoPorCuota(): number {
    return this.reservaState.cuotasSeleccionadas > 1
      ? Math.round(this.montoPendiente / this.reservaState.cuotasSeleccionadas)
      : 0;
  }

  /** resumen: antes de que el cliente pague. reserva: con la seña ya enviada a validar. */
  datosComprobante(tipo: TipoComprobante): DatosComprobante {
    const n = this.montoPendiente > 0 ? Math.max(1, this.reservaState.cuotasSeleccionadas) : 0;
    return {
      tipo,
      codigo: this.codigoReserva,
      estado: tipo === 'resumen'
        ? { label: 'Reserva pendiente de pago de la seña', tono: 'warn' }
        : { label: 'Seña informada · en validación por la agencia', tono: 'info' },
      viaje: this.reservaState.viaje!,
      asientos: this.reservaState.asientos,
      pasajeros: this.reservaState.pasajeros,
      precioUnitario: this.reservaState.precio,
      senia: this.montoAPagar,
      seniaPagada: false,
      recargo: this.recargoPorcentaje,
      total: this.totalFinal,
      pagado: 0,
      pendiente: this.totalFinal,
      cuotas: Array.from({ length: n }, (_, i) => ({ numero: i + 1, total: n, monto: Math.round(this.montoPendiente / n), pagada: false })),
      metodoPago: this.reservaState.metodoPago,
      vencimiento: tipo === 'resumen' ? this.vencimiento : undefined,
    };
  }

  descargarComprobante() {
    this.comprobanteService.descargarImagen(this.datosComprobante('reserva'));
  }

  imprimirComprobante() {
    this.comprobanteService.imprimir(this.datosComprobante('reserva'));
  }

  async subirComprobante(event: Event, fileInput?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.reservaState.reservaIds.length === 0) return;

    this.subiendo = true;
    this.mensaje = '';
    this.comprobanteSubido = false;
    this.cdr.detectChanges();

    try {
      const userId = (await this.authService.getSession()).data.session?.user?.id;
      if (!userId) {
        this.mensaje = 'Sesión expirada';
        return;
      }

      const basePath = `${userId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await this.storageService.subirComprobante(basePath, file);
      if (uploadError) {
        this.mensaje = 'Error al subir el comprobante: ' + uploadError.message;
        return;
      }

      const { data: signedUrl, error: signedError } = await this.storageService.getComprobanteUrl(basePath);
      if (signedError || !signedUrl?.signedUrl) {
        this.mensaje = 'Error al generar enlace del comprobante';
        return;
      }

      const { error: updateError } = await this.reservaService.actualizarComprobante(this.reservaState.reservaIds, signedUrl.signedUrl);
      if (updateError) {
        this.mensaje = 'Error al actualizar reserva: ' + updateError.message;
        return;
      }

      this.comprobanteSubido = true;
      this.mensaje = '';
      this.cdr.detectChanges();
      await this.verComprobante();
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado al subir el comprobante';
    } finally {
      this.subiendo = false;
      if (fileInput) fileInput.value = '';
      this.cdr.detectChanges();
    }
  }

  async verComprobante() {
    const html = await this.comprobanteService.generarHTML(this.datosComprobante('reserva'));
    // El HTML lo arma el servicio con los datos del pasajero escapados
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(
      `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#f4f4f3">${html}</body></html>`);
    this.cdr.detectChanges();
  }

  cerrarPreview() {
    this.previewHtml = null;
    this.cdr.detectChanges();
  }

  aliasCopiado = false;
  cbuCopiado = false;
  compartiendo = false;

  async copiarAlias() {
    try {
      await navigator.clipboard.writeText(this.banco.alias);
      this.aliasCopiado = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.aliasCopiado = false; this.cdr.detectChanges(); }, 2500);
    } catch {}
  }

  async copiarCBU() {
    try {
      await navigator.clipboard.writeText(this.banco.cbu);
      this.cbuCopiado = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.cbuCopiado = false; this.cdr.detectChanges(); }, 2500);
    } catch {}
  }

  get vencimiento(): string {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async compartirResumen() {
    if (this.compartiendo) return;
    this.compartiendo = true;
    this.cdr.detectChanges();
    try {
      await this.comprobanteService.descargarImagen(this.datosComprobante('resumen'));
    } catch {
      this.mensaje = 'Error al generar la imagen';
    } finally {
      this.compartiendo = false;
      this.cdr.detectChanges();
    }
  }
}
