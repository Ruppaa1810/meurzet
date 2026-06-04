import { Injectable } from '@angular/core';
import type { Viaje, MetodoPago } from '../models/database.types';
import type { AsientoReserva, PasajeroData } from './reserva-state.service';

function metodoPagoLabel(mp: string): string {
  const map: Record<MetodoPago, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta_credito: 'Tarjeta de crédito',
    otro: 'Otro',
  };
  return map[mp as MetodoPago] || mp;
}

export interface DatosComprobante {
  codigo: string;
  viaje: Viaje;
  asientos: AsientoReserva[];
  pasajeros: PasajeroData[];
  total: number;
  montoPagado: number;
  montoPendiente: number;
  pagoLabel: string;
  metodoPago: string;
  cuotasCount: number;
  montoPorCuota: number;
  fecha: string;
}

@Injectable({ providedIn: 'root' })
export class ComprobanteService {
  private contacto = '11 2345-6789';

  generarHTML(datos: DatosComprobante): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante ${datos.codigo}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
    .header { text-align: center; border-bottom: 2px solid #af4f35; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { color: #af4f35; margin: 0 0 4px; font-size: 20px; }
    .header p { color: #64748b; margin: 0; font-size: 12px; }
    .codigo { font-size: 24px; font-weight: bold; color: #af4f35; text-align: center; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    .total-row { font-weight: bold; background: #fff5f2; }
    .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .badge-info { background: #dbeafe; color: #1d4ed8; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin: 12px 0; }
    .info-grid .label { color: #64748b; }
    .info-grid .value { font-weight: 500; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Meurzet Viajes</h1>
    <p>Comprobante de reserva</p>
  </div>

  <div class="codigo">${datos.codigo}</div>

  <div class="info-grid">
    <div><span class="label">Origen:</span> <span class="value">${datos.viaje.origen}</span></div>
    <div><span class="label">Destino:</span> <span class="value">${datos.viaje.destino}</span></div>
    <div><span class="label">Salida:</span> <span class="value">${new Date(datos.viaje.fecha_salida).toLocaleString('es-AR')}</span></div>
    <div><span class="label">Llegada:</span> <span class="value">${new Date(datos.viaje.fecha_llegada).toLocaleString('es-AR')}</span></div>
    <div><span class="label">Tipo de pago:</span> <span class="value">${datos.pagoLabel}</span></div>
    <div><span class="label">Método de pago:</span> <span class="value">${metodoPagoLabel(datos.metodoPago)}</span></div>
    <div><span class="label">Emitido:</span> <span class="value">${datos.fecha}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Asiento</th>
        <th>Pasajero</th>
        <th>Documento</th>
        <th>Email</th>
        <th>Piso</th>
      </tr>
    </thead>
    <tbody>
      ${datos.asientos.map((a, i) => `
        <tr>
          <td>#${a.nroAsiento}</td>
          <td>${datos.pasajeros[i]?.nombre || ''} ${datos.pasajeros[i]?.apellido || ''}</td>
          <td>${datos.pasajeros[i]?.documento || ''}</td>
          <td>${datos.pasajeros[i]?.email || ''}</td>
          <td>${a.piso === 1 ? 'Baja' : 'Alta'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div style="text-align: right; font-size: 14px; margin-top: 8px;">
    <span style="color: #64748b;">Total:</span>
    <strong style="color: #af4f35;">$ ${datos.total.toLocaleString('es-AR')}</strong>
  </div>
  <div style="text-align: right; font-size: 12px; color: #64748b;">
    Monto pagado: $ ${datos.montoPagado.toLocaleString('es-AR')}
  </div>
  ${datos.montoPendiente > 0 ? `
  <div style="text-align: right; font-size: 12px; color: #e4912e; font-weight: 600;">
    Saldo pendiente: $ ${datos.montoPendiente.toLocaleString('es-AR')}
  </div>
  ${datos.cuotasCount > 1 ? `
  <div style="text-align: right; font-size: 11px; color: #64748b;">
    A pagar en ${datos.cuotasCount} cuotas de $ ${datos.montoPorCuota.toLocaleString('es-AR')} cada una
  </div>` : ''}` : ''}

  <div class="footer">
    <p>Meurzet Viajes — Este comprobante es válido como constancia de reserva.</p>
    <p>${datos.fecha}</p>
  </div>
</body>
</html>`;
  }

  descargar(datos: DatosComprobante) {
    const html = this.generarHTML(datos);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprobante-${datos.codigo.toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  abrirParaImprimir(datos: DatosComprobante) {
    const html = this.generarHTML(datos);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  generarHTMLSaldo(datos: DatosComprobante): string {
    const saldoBase = datos.total - datos.montoPagado;
    const recargoMonto = datos.montoPendiente - Math.max(0, saldoBase);
    const recargoPct = saldoBase > 0 ? Math.round(recargoMonto / saldoBase * 100) : 0;
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Saldo Pendiente ${datos.codigo}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
    .header { text-align: center; border-bottom: 2px solid #af4f35; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { color: #af4f35; margin: 0 0 4px; font-size: 20px; }
    .header .sub { color: #64748b; margin: 0; font-size: 12px; }
    .codigo { font-size: 24px; font-weight: bold; color: #af4f35; text-align: center; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin: 12px 0; }
    .info-grid .label { color: #64748b; }
    .info-grid .value { font-weight: 500; }
    .breakdown { max-width: 380px; margin: 20px auto; font-size: 13px; }
    .breakdown .row { display: flex; justify-content: space-between; padding: 7px 0; }
    .breakdown .row + .row { border-top: 1px solid #e2e8f0; }
    .breakdown .lbl { color: #64748b; }
    .breakdown .val { font-weight: 500; color: #1e293b; }
    .breakdown .paid { color: #16a34a; }
    .breakdown .sep { border-top: 2px dashed #cbd5e1; margin: 8px 0; }
    .breakdown .total-row { font-size: 16px; font-weight: 700; color: #af4f35; }
    .breakdown .check { color: #16a34a; font-weight: 700; }
    .breakdown .cuota-row { font-size: 11px; color: #64748b; text-align: center; padding-top: 8px; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .contacto { text-align: center; font-size: 11px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Meurzet Viajes</h1>
    <p class="sub">Saldo Pendiente de Reserva</p>
  </div>
  <div class="codigo">${datos.codigo}</div>
  <div class="info-grid">
    <div><span class="label">Origen:</span> <span class="value">${datos.viaje.origen}</span></div>
    <div><span class="label">Destino:</span> <span class="value">${datos.viaje.destino}</span></div>
    <div><span class="label">Salida:</span> <span class="value">${new Date(datos.viaje.fecha_salida).toLocaleString('es-AR')}</span></div>
    <div><span class="label">Llegada:</span> <span class="value">${new Date(datos.viaje.fecha_llegada).toLocaleString('es-AR')}</span></div>
  </div>
  <table>
    <thead><tr>
      <th>Asiento</th>
      <th>Pasajero</th>
      <th>Documento</th>
      <th>Piso</th>
    </tr></thead>
    <tbody>
      ${datos.asientos.map((a, i) => `
        <tr>
          <td>#${a.nroAsiento}</td>
          <td>${datos.pasajeros[i]?.nombre || ''} ${datos.pasajeros[i]?.apellido || ''}</td>
          <td>${datos.pasajeros[i]?.documento || ''}</td>
          <td>${a.piso === 1 ? 'Baja' : 'Alta'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="breakdown">
    <div class="row">
      <span class="lbl">Total base</span>
      <span class="val">$ ${datos.total.toLocaleString('es-AR')}</span>
    </div>
    <div class="row">
      <span class="lbl paid">Seña pagada</span>
      <span class="val paid">$ ${datos.montoPagado.toLocaleString('es-AR')} <span class="check">&#10003;</span></span>
    </div>
    <div class="sep"></div>
    <div class="row">
      <span class="lbl">Saldo a financiar</span>
      <span class="val">$ ${Math.max(0, saldoBase).toLocaleString('es-AR')}</span>
    </div>
    ${recargoPct > 0 ? `
    <div class="row">
      <span class="lbl">Recargo ${recargoPct}%</span>
      <span class="val">+$ ${recargoMonto.toLocaleString('es-AR')}</span>
    </div>` : ''}
    <div class="row total-row">
      <span>Total restante</span>
      <span>$ ${datos.montoPendiente.toLocaleString('es-AR')}</span>
    </div>
    ${datos.cuotasCount > 1 ? `
    <div class="cuota-row">En ${datos.cuotasCount} cuotas de $ ${datos.montoPorCuota.toLocaleString('es-AR')} cada una</div>` : ''}
  </div>
  <div class="contacto">&#128222; Contacto: ${this.contacto}</div>
  <div class="footer">
    <p>Meurzet Viajes — Documento informativo de saldo pendiente</p>
    <p>${datos.fecha}</p>
  </div>
</body>
</html>`;
  }

  descargarSaldo(datos: DatosComprobante) {
    const html = this.generarHTMLSaldo(datos);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saldo-${datos.codigo.toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  abrirSaldoParaImprimir(datos: DatosComprobante) {
    const html = this.generarHTMLSaldo(datos);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  }
}
