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

  it('getReservasPanel filtra por vendedores solo cuando se pasan (operador)', async () => {
    const desde = new Date('2026-01-01');
    const chain = buildChain();
    vi.spyOn(supabase, 'from').mockReturnValue(chain as any);

    await service.getReservasPanel(desde, ['v1', 'v2']);
    expect(chain.gte).toHaveBeenCalledWith('created_at', desde.toISOString());
    expect(chain.in).toHaveBeenCalledWith('vendedor_id', ['v1', 'v2']);

    chain.in.mockClear();
    await service.getReservasPanel(desde, null);
    expect(chain.in).not.toHaveBeenCalled();
  });
});
