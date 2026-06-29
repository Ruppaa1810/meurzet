import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import html2canvas from 'html2canvas';
import { environment } from '../../../../environments/environment';
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

  get datosComprobante(): DatosComprobante {
    return {
      codigo: this.codigoReserva,
      viaje: this.reservaState.viaje!,
      asientos: this.reservaState.asientos,
      pasajeros: this.reservaState.pasajeros,
      total: this.totalFinal,
      montoPagado: this.montoAPagar,
      montoPendiente: this.montoPendiente,
      pagoLabel: this.pagoLabel,
      metodoPago: this.reservaState.metodoPago,
      cuotasCount: this.reservaState.cuotasSeleccionadas,
      montoPorCuota: this.montoPorCuota,
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

  readonly banco = environment.banco;

  aliasCopiado = false;
  cbuCopiado = false;
  compartiendo = false;

  async copiarAlias() {
    try {
      await navigator.clipboard.writeText(environment.banco.alias);
      this.aliasCopiado = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.aliasCopiado = false; this.cdr.detectChanges(); }, 2500);
    } catch {}
  }

  async copiarCBU() {
    try {
      await navigator.clipboard.writeText(environment.banco.cbu);
      this.cbuCopiado = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.cbuCopiado = false; this.cdr.detectChanges(); }, 2500);
    } catch {}
  }

  get vencimiento(): string {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  get contacto(): string {
    return '11 2345-6789';
  }

  private generarResumenHTML(): string {
    const v = this.reservaState.viaje!;
    const salida = new Date(v.fecha_salida).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const llegada = new Date(v.fecha_llegada).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const pasajerosHtml = this.reservaState.asientos.map((a, i) => {
      const p = this.reservaState.pasajeros[i];
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;">#${a.nroAsiento} · ${a.piso === 1 ? 'Baja' : 'Alta'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;">${p?.nombre || ''} ${p?.apellido || ''}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${p?.documento || ''}</td>
        </tr>`;
    }).join('');

    return `
<div style="width:480px;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f3;padding:24px;">
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #eec997;">
    <div style="background:#384752;padding:20px;text-align:center;">
      <img src="/logo.jpeg" style="width:50px;height:50px;border-radius:50%;object-fit:cover;background:#fff;margin-bottom:8px;" />
      <h1 style="color:#e4912e;font-size:18px;margin:0 0 2px;">Meurzet Viajes</h1>
      <p style="color:#eec997;font-size:11px;margin:0;">Resumen de Reserva</p>
    </div>
    <div style="text-align:center;padding:16px 20px;border-bottom:1px solid #eec997;">
      <p style="font-size:22px;font-weight:700;color:#384752;letter-spacing:1px;margin:0;font-family:'Courier New',monospace;">${this.codigoReserva}</p>
    </div>
    <div style="padding:16px 20px;border-bottom:1px solid #eec997;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
        <div><span style="color:#969fa3;">Origen:</span> <span style="font-weight:500;color:#384752;">${v.origen}</span></div>
        <div><span style="color:#969fa3;">Destino:</span> <span style="font-weight:500;color:#384752;">${v.destino}</span></div>
        <div><span style="color:#969fa3;">Salida:</span> <span style="font-weight:500;color:#384752;">${salida} hs</span></div>
        <div><span style="color:#969fa3;">Llegada:</span> <span style="font-weight:500;color:#384752;">${llegada} hs</span></div>
      </div>
    </div>
    <div style="padding:0 20px;">
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <thead><tr style="background:#f4f4f3;">
          <th style="padding:6px 10px;text-align:left;font-size:10px;color:#969fa3;font-weight:600;">Asiento</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;color:#969fa3;font-weight:600;">Pasajero</th>
          <th style="padding:6px 10px;text-align:left;font-size:10px;color:#969fa3;font-weight:600;">Doc.</th>
        </tr></thead>
        <tbody>${pasajerosHtml}</tbody>
      </table>
    </div>
    <div style="background:#fff5f2;padding:16px 20px;border-top:1px solid #eec997;border-bottom:1px solid #eec997;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;font-size:12px;">
        <div><span style="color:#969fa3;font-size:10px;">Total base</span><p style="font-weight:700;color:#384752;margin:2px 0 0;">${this.formatPrecio(this.total)}</p></div>
        <div><span style="color:#969fa3;font-size:10px;">Seña a pagar</span><p style="font-weight:700;color:#e4912e;margin:2px 0 0;">${this.formatPrecio(this.montoAPagar)}</p></div>
      </div>
      ${this.montoPendiente > 0 ? `
      <div style="border-top:1px solid #eec997;margin-top:10px;padding-top:10px;text-align:center;">
        <span style="color:#969fa3;font-size:10px;">Saldo a financiar${this.recargoPorcentaje > 0 ? ` + ${this.recargoPorcentaje}% recargo` : ''}</span>
        <p style="font-weight:700;color:#1aa7c4;margin:2px 0 0;font-size:15px;">${this.formatPrecio(this.montoPendiente)}</p>
        ${this.reservaState.cuotasSeleccionadas > 1 ? `<p style="color:#969fa3;font-size:10px;margin:2px 0 0;">${this.reservaState.cuotasSeleccionadas} cuotas de ${this.formatPrecio(this.montoPorCuota)}</p>` : ''}
      </div>` : ''}
      ${this.totalFinal !== this.total ? `
      <div style="border-top:1px solid #eec997;margin-top:10px;padding-top:10px;text-align:center;">
        <span style="color:#969fa3;font-size:10px;">Total a pagar</span>
        <p style="font-weight:700;color:#384752;margin:2px 0 0;font-size:16px;">${this.formatPrecio(this.totalFinal)}</p>
      </div>` : ''}
    </div>
    <div style="padding:16px 20px;border-bottom:1px solid #eec997;">
      <p style="font-size:11px;font-weight:600;color:#384752;margin:0 0 8px;text-align:center;">📌 Datos para transferencia</p>
      <div style="font-size:11px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div><span style="color:#969fa3;">Banco:</span> <span style="font-weight:500;">${environment.banco.banco}</span></div>
        <div><span style="color:#969fa3;">Titular:</span> <span style="font-weight:500;">${environment.banco.titular}</span></div>
        <div style="grid-column:1"><span style="color:#969fa3;">Alias:</span> <span style="font-weight:700;color:#e4912e;">${environment.banco.alias}</span></div>
        <div style="grid-column:2">
          <span style="color:#969fa3;">CBU:</span>
          <span style="font-weight:500;font-family:'Courier New',monospace;font-size:10px;">${environment.banco.cbu}</span>
        </div>
      </div>
      <p style="font-size:10px;color:#969fa3;margin:8px 0 0;text-align:center;">Referencia: <strong style="color:#384752;">${this.codigoReserva}</strong></p>
    </div>
    <div style="padding:12px 20px;text-align:center;background:#f4f4f3;font-size:10px;color:#64748b;">
      <p style="margin:0 0 4px;">⏳ Vence: ${this.vencimiento} hs</p>
      <p style="margin:0;">📞 Contacto: ${this.contacto}</p>
    </div>
    <div style="padding:10px 20px;text-align:center;font-size:9px;color:#969fa3;">
      Transferí el monto de la seña y enviá el comprobante a tu vendedor
    </div>
  </div>
</div>`;
  }

  async compartirResumen() {
    if (this.compartiendo) return;
    this.compartiendo = true;
    this.cdr.detectChanges();

    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.innerHTML = this.generarResumenHTML();
    document.body.appendChild(div);

    try {
      const canvas = await html2canvas(div, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f4f4f3',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `resumen-${this.codigoReserva.toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      this.mensaje = 'Error al generar la imagen';
    } finally {
      document.body.removeChild(div);
      this.compartiendo = false;
      this.cdr.detectChanges();
    }
  }
}
