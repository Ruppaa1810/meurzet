import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reserva } from './reserva';

describe('Reserva.confirmarReserva: pagos que se crean', () => {
  let comp: Reserva;
  let pagoService: { crearPago: ReturnType<typeof vi.fn>; recalcularEstadoFinanciero: ReturnType<typeof vi.fn> };
  const state: any = {
    viaje: { id: 1, precio_base: 100000 },
    asientos: [{ asientoId: 10, nroAsiento: 5, piso: 1, categoria: 'semicama' }],
    pasajeros: [{ nombre: 'Ana', apellido: 'Paz', documento: '123', email: '', telefono: '', es_responsable_financiero: true }],
    lugaresEmbarque: [],
    total: 100000,
    porcentajePago: 30,
    tipoPagoMode: 'parcial',
    montoPersonalizado: 0,
  };

  beforeEach(() => {
    pagoService = {
      crearPago: vi.fn().mockResolvedValue({ error: null }),
      recalcularEstadoFinanciero: vi.fn().mockResolvedValue({ error: null }),
    };
    comp = new Reserva(
      { navigate: vi.fn() } as any,
      { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'v1' } } } }) } as any,
      {
        checkAsientoTieneReserva: vi.fn().mockResolvedValue({ data: null }),
        crearReserva: vi.fn().mockResolvedValue({ data: { id: 99 }, error: null }),
      } as any,
      pagoService as any,
      state,
      null as any,
      { detectChanges: () => {} } as any,
    );
  });

  const cuotasCreadas = () => pagoService.crearPago.mock.calls.map(c => c[0]).filter(p => p.tipo === 'cuota');

  it('con 1 cuota, el saldo entero va en esa cuota (antes se creaba en $0)', async () => {
    comp.cuotasCount = 1;
    await comp.confirmarReserva();
    expect(cuotasCreadas()).toEqual([expect.objectContaining({ monto: 70000, cuota_numero: 1, cuotas_totales: 1 })]);
  });

  it('con 3 cuotas y recargo divide el saldo con recargo', async () => {
    comp.cuotasCount = 3;
    comp.cuotasRecargo = 10;
    await comp.confirmarReserva();
    expect(cuotasCreadas().map(p => p.monto)).toEqual([25667, 25667, 25667]);
  });

  it('pago total: no crea cuotas', async () => {
    state.tipoPagoMode = 'total';
    state.porcentajePago = 100;
    await comp.confirmarReserva();
    expect(cuotasCreadas()).toEqual([]);
    state.tipoPagoMode = 'parcial';
    state.porcentajePago = 30;
  });
});
