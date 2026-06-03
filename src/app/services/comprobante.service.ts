import { Injectable } from '@angular/core';
import type { Viaje } from '../models/database.types';
import type { AsientoReserva, PasajeroData } from './reserva-state.service';

export interface DatosComprobante {
  codigo: string;
  viaje: Viaje;
  asientos: AsientoReserva[];
  pasajeros: PasajeroData[];
  total: number;
  montoPagado: number;
  pagoLabel: string;
  fecha: string;
}

@Injectable({ providedIn: 'root' })
export class ComprobanteService {
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
}
