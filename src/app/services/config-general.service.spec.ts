import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigGeneralService } from './config-general.service';
import { supabase } from './supabase-client';

function mockFilas(filas: { clave: string; valor: unknown }[]) {
  vi.spyOn(supabase, 'from').mockReturnValue({ select: vi.fn().mockResolvedValue({ data: filas, error: null }) } as any);
}

describe('ConfigGeneralService', () => {
  let svc: ConfigGeneralService;
  beforeEach(() => {
    vi.restoreAllMocks();
    svc = new ConfigGeneralService();
  });

  it('lee el contacto tal como lo devuelve Supabase para una columna JSONB', async () => {
    // Este caso rompía con "Unexpected non-whitespace character after JSON at position 3"
    mockFilas([{ clave: 'contacto', valor: '11 2345-6789' }]);
    expect(await svc.getContacto()).toBe('11 2345-6789');
  });

  it('acepta el formato viejo guardado con JSON.stringify', async () => {
    mockFilas([{ clave: 'contacto', valor: '"343 456-7890"' }]);
    expect(await svc.getContacto()).toBe('343 456-7890');
  });

  it('devuelve el banco guardado como objeto', async () => {
    const banco = { alias: 'MI.ALIAS', cbu: '123', titular: 'Yo', banco: 'Nación' };
    mockFilas([{ clave: 'banco', valor: banco }]);
    expect(await svc.getBanco()).toEqual(banco);
  });
});
