import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PagoService } from './pago.service';
import { supabase } from './supabase-client';

function buildChain() {
  const methods = ['select', 'eq', 'in', 'or', 'order', 'single', 'update', 'insert'];
  const chain: any = {};
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  return chain;
}

/** Query encadenable que al hacer await devuelve `result`, sin importar qué métodos se llamen antes. */
function query(result: unknown) {
  const q: any = { then: (ok: any, err: any) => Promise.resolve(result).then(ok, err) };
  for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'single', 'maybeSingle', 'update', 'insert']) {
    q[m] = vi.fn().mockReturnValue(q);
  }
  return q;
}

describe('PagoService.generarComisionSiCorresponde', () => {
  let service: PagoService;
  // Venta de $100.000: seña 30% + 3 cuotas con 10% de recargo = $107.000
  const reserva = { vendedor_id: 'v1', pasajero_datos: { porcentaje_pago: 30, cuotas: 3, recargo: 10 }, viaje: { precio_base: 100000 } };
  const pagosCompletos = [{ id: 9, monto: 25667 }, { id: 8, monto: 25667 }, { id: 7, monto: 25666 }, { id: 6, monto: 30000 }]
    .map(p => ({ ...p, estado_pago: 'confirmado' }));

  function mockTablas(t: { pagos: unknown[]; comisionExistente?: unknown[]; config?: unknown }) {
    const tablas: Record<string, any> = {
      reservas: query({ data: reserva, error: null }),
      pagos_movimientos: query({ data: t.pagos, error: null }),
      comisiones: query({ data: t.comisionExistente ?? [], error: null }),
      comisiones_config: query({ data: t.config === undefined ? { porcentaje: 10 } : t.config, error: null }),
    };
    vi.spyOn(supabase, 'from').mockImplementation(((tabla: string) => tablas[tabla]) as any);
    return tablas;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PagoService);
  });

  it('genera la comisión sobre el total de la venta cuando se pagó todo', async () => {
    const t = mockTablas({ pagos: pagosCompletos });
    await service.generarComisionSiCorresponde(1);
    expect(t['comisiones'].insert).toHaveBeenCalledWith({
      reserva_id: 1, pago_id: 9, vendedor_id: 'v1', monto_base: 107000, porcentaje: 10, monto_comision: 10700,
    });
  });

  it('no genera nada si todavía falta cobrar', async () => {
    const t = mockTablas({ pagos: pagosCompletos.slice(1) });
    await service.generarComisionSiCorresponde(1);
    expect(t['comisiones'].insert).not.toHaveBeenCalled();
  });

  it('no duplica la comisión si ya existe', async () => {
    const t = mockTablas({ pagos: pagosCompletos, comisionExistente: [{ id: 3 }] });
    await service.generarComisionSiCorresponde(1);
    expect(t['comisiones'].insert).not.toHaveBeenCalled();
  });

  it('no genera si el vendedor no tiene comisión configurada', async () => {
    const t = mockTablas({ pagos: pagosCompletos, config: null });
    await service.generarComisionSiCorresponde(1);
    expect(t['comisiones'].insert).not.toHaveBeenCalled();
  });
});

describe('PagoService', () => {
  let service: PagoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PagoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('countPagosPendientes returns count of pending payments', async () => {
    const chain = buildChain();
    chain.eq.mockResolvedValue({ count: 3, error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const count = await service.countPagosPendientes();
    expect(chain.eq).toHaveBeenCalledWith('estado_pago', 'pendiente');
    expect(chain.or).toHaveBeenCalledWith('tipo.neq.cuota,comprobante_url.not.is.null');
    expect(count).toBe(3);
  });

  it('crearPago inserts into pagos_movimientos', async () => {
    const chain = buildChain();
    chain.single.mockResolvedValue({ data: { id: 1, monto: 5000 }, error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const res = await service.crearPago({ reserva_id: 1, monto: 5000, estado_pago: 'pendiente', metodo_pago: 'efectivo' } as any);
    expect(chain.single).toHaveBeenCalled();
    expect(res.data?.monto).toBe(5000);
  });

  it('recalcularEstadoFinanciero returns pendiente when no payments', async () => {
    const chain = buildChain();
    // getTotalPagado does .select('monto').eq().eq() - first eq returns chain, second returns result
    chain.eq
      .mockReturnValueOnce(chain)
      .mockResolvedValue({ data: [], error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const result = await service.recalcularEstadoFinanciero(1, 10000);
    expect(result.estado).toBe('pendiente');
    expect(result.totalPagado).toBe(0);
  });

  it('recalcularEstadoFinanciero returns pagado_total when fully paid', async () => {
    const chain = buildChain();
    chain.eq
      .mockReturnValueOnce(chain)
      .mockResolvedValue({ data: [{ monto: 8000 }, { monto: 2000 }], error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const result = await service.recalcularEstadoFinanciero(1, 10000);
    expect(result.estado).toBe('pagado_total');
    expect(result.totalPagado).toBe(10000);
  });

  it('recalcularEstadoFinanciero returns pagado_parcial when partially paid', async () => {
    const chain = buildChain();
    chain.eq
      .mockReturnValueOnce(chain)
      .mockResolvedValue({ data: [{ monto: 3000 }], error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const result = await service.recalcularEstadoFinanciero(1, 10000);
    expect(result.estado).toBe('pagado_parcial');
    expect(result.totalPagado).toBe(3000);
  });
});
