import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PagoService } from './pago.service';
import { supabase } from './supabase-client';

function buildChain() {
  const methods = ['select', 'eq', 'in', 'order', 'single', 'update', 'insert'];
  const chain: any = {};
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  return chain;
}

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
