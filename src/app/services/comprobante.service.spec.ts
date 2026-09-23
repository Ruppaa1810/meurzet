import { describe, it, expect, beforeEach } from 'vitest';
import { ComprobanteService, DatosComprobante } from './comprobante.service';

const config: any = {
  getContacto: async () => '343 456-7890',
  getBanco: async () => ({ alias: 'MEURZET.PAGOS', cbu: '0170123400000012345678', titular: 'Meurzet Viajes', banco: 'Banco Galicia' }),
};

function datos(extra: Partial<DatosComprobante> = {}): DatosComprobante {
  return {
    tipo: 'reserva',
    codigo: 'MEU-000175',
    estado: { label: 'Reserva confirmada', tono: 'info' },
    viaje: { origen: 'Paraná', destino: 'Mendoza', fecha_salida: '2026-10-12T08:30:00-03:00', fecha_llegada: '2026-10-12T22:30:00-03:00' },
    asientos: [{ asientoId: 1, nroAsiento: 12, piso: 1, categoria: 'semicama' }],
    pasajeros: [{ nombre: 'Carlos', apellido: 'Rodríguez', documento: '30333444', email: '', telefono: '' }],
    precioUnitario: 100000, senia: 30000, seniaPagada: true, recargo: 10, total: 107000, pagado: 55667, pendiente: 51333,
    cuotas: [1, 2, 3].map(n => ({ numero: n, total: 3, monto: 25667, pagada: n === 1 })),
    metodoPago: 'transferencia',
    ...extra,
  };
}

describe('ComprobanteService.generarHTML', () => {
  let svc: ComprobanteService;
  beforeEach(() => { svc = new ComprobanteService(config); });

  it('muestra código, viaje, asiento y plan de pagos', async () => {
    const html = await svc.generarHTML(datos());
    expect(html).toContain('MEU-000175');
    expect(html).toContain('Paraná');
    expect(html).toContain('>12<');
    expect(html).toContain('Cuota 2 de 3');
    expect(html).toContain('Recargo por cuotas (10%)');
    expect(html).toContain('$ 51.333');
  });

  it('escapa los datos que carga el vendedor', async () => {
    const html = await svc.generarHTML(datos({ pasajeros: [{ nombre: '<img src=x onerror=alert(1)>', apellido: 'X', documento: '1', email: '', telefono: '' }] }));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('el resumen previo al pago lleva datos bancarios, seña a pagar y vencimiento', async () => {
    const html = await svc.generarHTML(datos({ tipo: 'resumen', seniaPagada: false, pagado: 0, pendiente: 107000, vencimiento: '23/09/2026, 20:15' }));
    expect(html).toContain('Resumen de reserva');
    expect(html).toContain('MEURZET.PAGOS');
    expect(html).toContain('Seña a pagar ahora');
    expect(html).toContain('23/09/2026, 20:15');
    expect(html).not.toContain('✓ Pagada');
  });

  it('pagado completo: sin datos bancarios', async () => {
    const html = await svc.generarHTML(datos({ pagado: 107000, pendiente: 0, cuotas: datos().cuotas.map(c => ({ ...c, pagada: true })) }));
    expect(html).not.toContain('Cómo pagar');
    expect(html).toContain('Pagado ✓');
  });

  it('columna de embarque solo si algún pasajero tiene', async () => {
    expect(await svc.generarHTML(datos())).not.toContain('Lugar de embarque');
    const conEmbarque = await svc.generarHTML(datos({
      pasajeros: [{ nombre: 'A', apellido: 'B', documento: '1', email: '', telefono: '', lugar_embarque: { id: 3, nombre: 'Terminal Nogoyá', direccion: 'Av. Sarmiento 567', ciudad: 'Nogoyá' } }],
    }));
    expect(conEmbarque).toContain('Terminal Nogoyá — Av. Sarmiento 567, Nogoyá');
  });

  it('saldo en un solo pago se muestra como "Saldo"', async () => {
    const html = await svc.generarHTML(datos({ recargo: 0, total: 100000, cuotas: [{ numero: 1, total: 1, monto: 70000, pagada: false }] }));
    expect(html).toContain('<td>Saldo</td>');
    expect(html).not.toContain('Recargo');
  });
});
