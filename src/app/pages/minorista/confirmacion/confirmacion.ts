import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';
import { ReservaService } from '../../../services/reserva.service';
import { ReservaStateService } from '../../../services/reserva-state.service';
import { ComprobanteService, DatosComprobante } from '../../../services/comprobante.service';
import { estadoFinancieroLabel, estadoFinancieroClass, estadoFinancieroDot, derivarEstadoFinanciero } from '../../../utils/estado-financiero';

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
  mostrarPreview = false;

  constructor(
    public reservaState: ReservaStateService,
    private authService: AuthService,
    private storageService: StorageService,
    private reservaService: ReservaService,
    private comprobanteService: ComprobanteService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (!this.reservaState.viaje || this.reservaState.asientos.length === 0) {
      this.router.navigate(['/minorista/vender'], { replaceUrl: true });
    }
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

  get totalConRecargo(): number {
    return this.reservaState.recargoAplicado > 0
      ? Math.round(this.total * (1 + this.reservaState.recargoAplicado / 100))
      : this.total;
  }

  get montoPendiente(): number {
    return Math.max(0, this.totalConRecargo - this.montoAPagar);
  }

  get datosComprobante(): DatosComprobante {
    return {
      codigo: this.codigoReserva,
      viaje: this.reservaState.viaje!,
      asientos: this.reservaState.asientos,
      pasajeros: this.reservaState.pasajeros,
      total: this.totalConRecargo,
      montoPagado: this.montoAPagar,
      montoPendiente: this.montoPendiente,
      pagoLabel: this.pagoLabel,
      metodoPago: this.reservaState.metodoPago,
      fecha: new Date().toLocaleString('es-AR'),
    };
  }

  descargarComprobante() {
    this.comprobanteService.descargar(this.datosComprobante);
  }

  imprimirComprobante() {
    this.comprobanteService.abrirParaImprimir(this.datosComprobante);
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
      setTimeout(() => { this.mostrarPreview = true; this.cdr.detectChanges(); }, 500);
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado al subir el comprobante';
    } finally {
      this.subiendo = false;
      if (fileInput) fileInput.value = '';
      this.cdr.detectChanges();
    }
  }

  cerrarPreview() {
    this.mostrarPreview = false;
    this.cdr.detectChanges();
  }
}
