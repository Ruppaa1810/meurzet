import { Injectable } from '@angular/core';
import type { MetodoPago, Viaje } from '../models/database.types';
import type { AsientoReserva, PasajeroData } from './reserva-state.service';
import { ConfigGeneralService } from './config-general.service';
import { embarqueLabel } from '../utils/embarques';

/**
 * resumen: se le pasa al cliente antes de que pague (lleva datos bancarios y vencimiento).
 * reserva: constancia con el estado de cuenta actualizado.
 */
export type TipoComprobante = 'resumen' | 'reserva';

export interface CuotaComprobante {
  numero: number;
  total: number;
  monto: number;
  pagada: boolean;
  /** El vendedor subió el comprobante y falta que la agencia lo apruebe. */
  enValidacion?: boolean;
}

export interface DatosComprobante {
  tipo: TipoComprobante;
  codigo: string;
  estado: { label: string; tono: 'ok' | 'warn' | 'info' };
  viaje: Pick<Viaje, 'origen' | 'destino' | 'fecha_salida' | 'fecha_llegada'>;
  asientos: AsientoReserva[];
  pasajeros: PasajeroData[];
  precioUnitario: number;
  senia: number;
  seniaPagada: boolean;
  seniaEnValidacion?: boolean;
  recargo: number;
  total: number;
  pagado: number;
  pendiente: number;
  cuotas: CuotaComprobante[];
  metodoPago: string;
  vencimiento?: string;
}

const METODOS: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta_credito: 'Tarjeta de crédito',
  otro: 'Otro',
};

/** Los datos del pasajero los escribe el vendedor: se escapan antes de meterlos en el HTML. */
function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const $ = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const CSS = `
.cmp { width: 720px; box-sizing: border-box; margin: 0 auto; background: #fff; color: #1e293b;
  font-family: 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; line-height: 1.45;
  border: 1px solid #e7dccb; border-radius: 14px; overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cmp * { box-sizing: border-box; }
.cmp-head { background: #384752; color: #fff; padding: 22px 28px; display: flex; align-items: center; justify-content: space-between; }
.cmp-brand { display: flex; align-items: center; gap: 12px; }
.cmp-brand img { width: 46px; height: 46px; border-radius: 50%; background: #fff; object-fit: cover; }
.cmp-brand b { display: block; font-size: 18px; color: #e4912e; letter-spacing: .3px; }
.cmp-brand span { font-size: 12px; color: #eec997; }
.cmp-code { text-align: right; }
.cmp-code small { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #eec997; }
.cmp-code b { font-family: 'Courier New', monospace; font-size: 22px; letter-spacing: 1px; }
.cmp-status { padding: 10px 28px; font-size: 12px; font-weight: 600; display: flex; justify-content: space-between; }
.cmp-status.ok { background: #ecfdf3; color: #15803d; }
.cmp-status.warn { background: #fff7ed; color: #c2410c; }
.cmp-status.info { background: #eff6ff; color: #1d4ed8; }
.cmp-status span:last-child { font-weight: 400; color: #64748b; }
.cmp-sec { padding: 18px 28px; border-top: 1px solid #f1e9dc; }
.cmp-h { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #af4f35; margin: 0 0 10px; }
.cmp-route { display: flex; align-items: center; gap: 14px; font-size: 22px; font-weight: 800; color: #384752; }
.cmp-route i { flex: 1; height: 2px; background: #e4912e; position: relative; }
.cmp-trip { display: flex; gap: 28px; margin-top: 10px; }
.cmp-trip small { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; }
.cmp-trip b { color: #384752; }
.cmp table { width: 100%; border-collapse: collapse; }
.cmp th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; font-weight: 600; padding: 0 8px 6px 0; border-bottom: 1px solid #e2e8f0; }
.cmp td { padding: 9px 8px 9px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.cmp tr:last-child td { border-bottom: 0; }
.cmp .seat { display: inline-block; min-width: 34px; text-align: center; font-weight: 800; color: #af4f35; background: #fdf3ea; border-radius: 6px; padding: 2px 6px; }
.cmp .muted { color: #64748b; font-size: 11px; }
.cmp .r { text-align: right; white-space: nowrap; }
.cmp .ok { color: #15803d; font-weight: 600; }
.cmp .pend { color: #c2410c; font-weight: 600; }
.cmp-pay { display: flex; gap: 20px; }
.cmp-pay > div:first-child { flex: 1; }
.cmp-box { width: 230px; background: #f8f5f0; border-radius: 10px; padding: 14px 16px; }
.cmp-box div { display: flex; justify-content: space-between; margin-bottom: 6px; }
.cmp-box .big { font-size: 17px; font-weight: 800; }
.cmp-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin: 10px 0 4px; }
.cmp-box .cmp-bar { display: flex; justify-content: flex-start; margin: 10px 0 4px; }
.cmp-bar i { display: block; height: 100%; background: #16a34a; }
.cmp-bar i.val { background: #93c5fd; }
.cmp .val { color: #1d4ed8; font-weight: 600; }
.cmp-bank { display: flex; flex-wrap: wrap; gap: 8px 28px; }
.cmp-bank small { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; }
.cmp-bank .alias { font-size: 16px; font-weight: 800; color: #af4f35; }
.cmp-bank .cbu { font-family: 'Courier New', monospace; font-weight: 700; }
.cmp-note { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #fff7ed; color: #9a3412; font-size: 12px; }
.cmp-foot { padding: 14px 28px; background: #f8f5f0; color: #64748b; font-size: 11px; display: flex; justify-content: space-between; gap: 16px; }
@media print { .cmp { width: 100%; border: 0; border-radius: 0; } }
`;

@Injectable({ providedIn: 'root' })
export class ComprobanteService {
  constructor(private configGeneral: ConfigGeneralService) {}

  /** HTML del comprobante (con sus estilos), listo para imprimir, convertir en imagen o previsualizar. */
  async generarHTML(d: DatosComprobante): Promise<string> {
    const [contacto, banco] = await Promise.all([this.configGeneral.getContacto(), this.configGeneral.getBanco()]);
    const logo = new URL('logo.jpeg', document.baseURI).href;
    const conEmbarque = d.pasajeros.some(p => p?.lugar_embarque);
    const subtotal = d.precioUnitario * d.asientos.length;
    const progreso = d.total > 0 ? Math.min(100, Math.round(d.pagado / d.total * 100)) : 0;
    const titulo = d.tipo === 'resumen' ? 'Resumen de reserva' : 'Comprobante de reserva';
    const mostrarBanco = d.tipo === 'resumen' || d.pendiente > 0;

    const pasajeros = d.asientos.map((a, i) => {
      const p = d.pasajeros[i];
      return `<tr>
        <td><span class="seat">${esc(a.nroAsiento)}</span><div class="muted">Planta ${a.piso === 1 ? 'baja' : 'alta'}</div></td>
        <td><b>${esc(p?.nombre)} ${esc(p?.apellido)}</b>${p?.es_responsable_financiero && d.asientos.length > 1 ? '<div class="muted">Responsable del pago</div>' : ''}</td>
        <td>${esc(p?.documento) || '—'}</td>
        ${conEmbarque ? `<td>${esc(embarqueLabel(p?.lugar_embarque)) || '—'}</td>` : ''}
      </tr>`;
    }).join('');

    const resumen = d.tipo === 'resumen';
    // En el resumen todavía no se pagó nada: se indica qué se paga ahora y qué después
    const estadoPago = (pagada: boolean, enValidacion = false, ahora = false) => resumen
      ? (ahora ? '<span class="pend">Pagar ahora</span>' : '<span class="muted">Después</span>')
      : pagada ? '<span class="ok">✓ Pagada</span>'
      : enValidacion ? '<span class="val">En validación</span>'
      : '<span class="pend">Pendiente</span>';
    const plan = [
      `<tr><td>Seña</td><td class="r">${$(d.senia)}</td><td class="r">${estadoPago(d.seniaPagada, d.seniaEnValidacion, true)}</td></tr>`,
      ...d.cuotas.map(c => `<tr><td>${c.total === 1 ? 'Saldo' : `Cuota ${c.numero} de ${c.total}`}</td><td class="r">${$(c.monto)}</td><td class="r">${estadoPago(c.pagada, c.enValidacion)}</td></tr>`),
    ].join('');
    // Pagos que el cliente ya hizo pero la agencia todavía no confirmó
    const informado = (d.seniaEnValidacion && !d.seniaPagada ? d.senia : 0)
      + d.cuotas.filter(c => c.enValidacion && !c.pagada).reduce((s, c) => s + c.monto, 0);
    const resta = Math.max(0, d.pendiente - informado);
    const recuadro = resumen
      ? `<div><span>Total</span><b>${$(d.total)}</b></div>
        <div style="margin:12px 0 0"><span>Seña a pagar ahora</span></div>
        <div><b class="big pend">${$(d.senia)}</b></div>
        ${d.cuotas.length ? `<div class="muted" style="margin:0">Resto: ${d.cuotas.length === 1 ? `${$(d.cuotas[0].monto)} en un pago` : `${d.cuotas.length} cuotas de ${$(d.cuotas[0].monto)}`}</div>` : ''}`
      : `<div><span>Total</span><b>${$(d.total)}</b></div>
        <div><span>Pagado</span><b class="ok">${$(d.pagado)}</b></div>
        ${informado ? `<div><span>En validación</span><b class="val">${$(informado)}</b></div>` : ''}
        <div class="cmp-bar"><i style="width:${progreso}%"></i>${informado ? `<i class="val" style="width:${Math.min(100 - progreso, Math.round(informado / d.total * 100))}%"></i>` : ''}</div>
        <div style="margin:10px 0 0"><span>${resta > 0 ? 'Resta pagar' : 'Saldo'}</span><b class="big ${resta > 0 ? 'pend' : 'ok'}">${resta > 0 ? $(resta) : informado ? 'Todo informado' : 'Pagado ✓'}</b></div>
        ${informado ? '<div class="muted" style="margin:4px 0 0">Lo informado se suma como pagado cuando la agencia lo confirma.</div>' : ''}`;

    return `<style>${CSS}</style>
<div class="cmp">
  <div class="cmp-head">
    <div class="cmp-brand"><img src="${logo}" alt=""><div><b>Meurzet Viajes</b><span>${titulo}</span></div></div>
    <div class="cmp-code"><small>Código de reserva</small><b>${esc(d.codigo)}</b></div>
  </div>
  <div class="cmp-status ${d.estado.tono}"><span>${esc(d.estado.label)}</span><span>Emitido el ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span></div>

  <div class="cmp-sec">
    <p class="cmp-h">Viaje</p>
    <div class="cmp-route"><span>${esc(d.viaje.origen)}</span><i></i><span>${esc(d.viaje.destino)}</span></div>
    <div class="cmp-trip">
      <div><small>Salida</small><b>${fechaLarga(d.viaje.fecha_salida)} · ${hora(d.viaje.fecha_salida)} hs</b></div>
      <div><small>Llegada estimada</small><b>${hora(d.viaje.fecha_llegada)} hs</b></div>
      <div><small>Pasajeros</small><b>${d.asientos.length}</b></div>
    </div>
  </div>

  <div class="cmp-sec">
    <p class="cmp-h">Pasajeros</p>
    <table>
      <thead><tr><th style="width:70px">Asiento</th><th>Pasajero</th><th>DNI</th>${conEmbarque ? '<th>Lugar de embarque</th>' : ''}</tr></thead>
      <tbody>${pasajeros}</tbody>
    </table>
  </div>

  <div class="cmp-sec">
    <p class="cmp-h">Pago</p>
    <div class="cmp-pay">
      <div>
        <table>
          <colgroup><col><col style="width:110px"><col style="width:100px"></colgroup>
          <tbody>
            <tr><td>${d.asientos.length} pasaje${d.asientos.length > 1 ? 's' : ''} × ${$(d.precioUnitario)}</td><td class="r">${$(subtotal)}</td><td></td></tr>
            ${d.total > subtotal ? `<tr><td>Recargo por cuotas (${d.recargo}%)</td><td class="r">+ ${$(d.total - subtotal)}</td><td></td></tr>` : ''}
            <tr><td><b>Total</b></td><td class="r"><b>${$(d.total)}</b></td><td></td></tr>
          </tbody>
        </table>
        <p class="cmp-h" style="margin:16px 0 4px;color:#94a3b8">Plan de pagos</p>
        <table>
          <colgroup><col><col style="width:110px"><col style="width:100px"></colgroup>
          <tbody>${plan}</tbody>
        </table>
      </div>
      <div class="cmp-box" style="align-self:flex-start">
        ${recuadro}
        <div class="muted" style="margin:8px 0 0">Medio de pago: ${METODOS[d.metodoPago as MetodoPago] ?? esc(d.metodoPago)}</div>
      </div>
    </div>
  </div>

  ${mostrarBanco ? `
  <div class="cmp-sec">
    <p class="cmp-h">Cómo pagar</p>
    <div class="cmp-bank">
      <div><small>Alias</small><span class="alias">${esc(banco.alias)}</span></div>
      <div><small>CBU</small><span class="cbu">${esc(banco.cbu)}</span></div>
      <div><small>Titular</small><b>${esc(banco.titular)}</b></div>
      <div><small>Banco</small><b>${esc(banco.banco)}</b></div>
    </div>
    <div class="cmp-note">
      ${d.tipo === 'resumen'
        ? `Transferí <b>${$(d.senia)}</b> de seña y mandale el comprobante a tu vendedor.${d.vencimiento ? ` La reserva se mantiene hasta el <b>${esc(d.vencimiento)} hs</b>.` : ''}`
        : 'Cuando pagues cada cuota, mandale el comprobante a tu vendedor.'}
      Indicá el código <b>${esc(d.codigo)}</b> como referencia.
    </div>
  </div>` : ''}

  <div class="cmp-foot">
    <span>Consultas: ${esc(contacto)}</span>
    <span>Conservá este comprobante · Código ${esc(d.codigo)}</span>
  </div>
</div>`;
  }

  /** Abre el comprobante en una pestaña nueva y lanza el diálogo de impresión (desde ahí se guarda como PDF). */
  async imprimir(d: DatosComprobante) {
    // Se abre antes del await: si no, el navegador lo toma como popup no pedido y lo bloquea
    const w = window.open('', '_blank');
    if (!w) return;
    const html = await this.generarHTML(d);
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(d.codigo)} · Meurzet Viajes</title>
<style>@page { size: A4; margin: 12mm; } body { margin: 0; padding: 24px; background: #f4f4f3; } @media print { body { padding: 0; background: #fff; } }</style>
</head><body>${html}<script>window.onload = () => setTimeout(() => window.print(), 300);</script></body></html>`);
    w.document.close();
    w.focus();
  }

  /** Descarga el comprobante como imagen PNG, para mandarlo por WhatsApp. */
  async descargarImagen(d: DatosComprobante) {
    const cont = document.createElement('div');
    cont.style.cssText = 'position:fixed;left:-10000px;top:0;padding:16px;background:#f4f4f3';
    cont.innerHTML = await this.generarHTML(d);
    document.body.appendChild(cont);
    try {
      await Promise.all([...cont.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cont, { scale: 2, useCORS: true, backgroundColor: '#f4f4f3', logging: false });
      const a = document.createElement('a');
      a.download = `${d.tipo === 'resumen' ? 'resumen' : 'comprobante'}-${d.codigo.toLowerCase()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } finally {
      cont.remove();
    }
  }
}
