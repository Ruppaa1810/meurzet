import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  async notificarReservaCreada(reservaId: number, destinatarioEmail: string, datos: { origen: string; destino: string; fecha: string; asientos: number; total: number }) {
    const html = `
      <h2>Nueva reserva registrada</h2>
      <p><strong>Código:</strong> MEU-${String(reservaId).padStart(6, '0')}</p>
      <p><strong>Origen:</strong> ${datos.origen}</p>
      <p><strong>Destino:</strong> ${datos.destino}</p>
      <p><strong>Fecha:</strong> ${new Date(datos.fecha).toLocaleString('es-AR')}</p>
      <p><strong>Asientos:</strong> ${datos.asientos}</p>
      <p><strong>Total:</strong> $ ${datos.total.toLocaleString('es-AR')}</p>
      <p>La reserva está pendiente de comprobante de pago.</p>
    `;
    return this.enviar(destinatarioEmail, `Reserva MEU-${String(reservaId).padStart(6, '0')} creada`, html);
  }

  async notificarReservaAprobada(reservaId: number, destinatarioEmail: string) {
    const html = `
      <h2>Reserva aprobada</h2>
      <p>Tu reserva <strong>MEU-${String(reservaId).padStart(6, '0')}</strong> fue aprobada.</p>
      <p>Los asientos están confirmados. Gracias por viajar con Meurzet.</p>
    `;
    return this.enviar(destinatarioEmail, `Reserva MEU-${String(reservaId).padStart(6, '0')} aprobada`, html);
  }

  async notificarReservaRechazada(reservaId: number, destinatarioEmail: string, motivo: string) {
    const html = `
      <h2>Reserva rechazada</h2>
      <p>Tu reserva <strong>MEU-${String(reservaId).padStart(6, '0')}</strong> fue rechazada.</p>
      <p><strong>Motivo:</strong> ${motivo}</p>
      <p>Contactanos si necesitas más información.</p>
    `;
    return this.enviar(destinatarioEmail, `Reserva MEU-${String(reservaId).padStart(6, '0')} rechazada`, html);
  }

  private async enviar(to: string, subject: string, html: string) {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html },
    });
    if (error) console.warn('Error al enviar email:', error.message);
    return { error };
  }
}
