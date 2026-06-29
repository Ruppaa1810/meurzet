import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ReservaService } from './reserva.service';
import { AuditoriaService } from './auditoria.service';
import { NotificacionesService } from './notificaciones.service';
import { supabase } from './supabase-client';

function buildChain() {
  const methods = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lt', 'single', 'maybeSingle', 'insert', 'update', 'delete'];
  const chain: any = {};
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('ReservaService', () => {
  let service: ReservaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReservaService,
        { provide: AuditoriaService, useValue: { log: () => {} } },
        { provide: NotificacionesService, useValue: { notificarReservaAprobada: () => {}, notificarReservaRechazada: () => {} } },
      ],
    });
    service = TestBed.inject(ReservaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('crearReserva inserts into reservas', async () => {
    const chain = buildChain();
    chain.single.mockResolvedValue({ data: { id: 1 }, error: null });
    const spy = vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const res = await service.crearReserva({ viaje_id: 1, estado: 'pendiente_comprobante', vendedor_id: '123', asiento_viaje_id: 10 } as any);
    expect(spy).toHaveBeenCalledWith('reservas');
    expect(res.data?.id).toBe(1);
  });

  it('getReservasConfirmadasEnRango queries with date range', async () => {
    const desde = new Date('2026-01-01');
    const hasta = new Date('2026-01-02');
    const chain = buildChain();
    chain.lt.mockResolvedValue({ count: 5, error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const res = await service.getReservasConfirmadasEnRango(desde, hasta);
    expect(chain.eq).toHaveBeenCalledWith('estado', 'aprobado');
    expect(chain.gte).toHaveBeenCalledWith('created_at', desde.toISOString());
    expect(chain.lt).toHaveBeenCalledWith('created_at', hasta.toISOString());
    expect(res.count).toBe(5);
  });

  it('getActividadReciente returns last 10 items', async () => {
    const chain = buildChain();
    chain.limit.mockResolvedValue({ data: [{ id: 1 }], error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const res = await service.getActividadReciente();
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(res.data).toEqual([{ id: 1 }]);
  });

  it('getTotalVendido sums precio_base of approved reservas', async () => {
    const chain = buildChain();
    chain.eq.mockResolvedValue({ data: [{ viaje: { precio_base: 10000 } }, { viaje: { precio_base: 15000 } }], error: null });
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);
    const total = await service.getTotalVendido();
    expect(total).toBe(25000);
  });
});
