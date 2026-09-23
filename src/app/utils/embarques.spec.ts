import { describe, it, expect } from 'vitest';
import { embarqueLabel, lugaresDelViaje } from './embarques';
import type { LugarEmbarque, Viaje } from '../models/database.types';

const lugar = (id: number, nombre: string, direccion: string | null = null, ciudad: string | null = null): LugarEmbarque =>
  ({ id, nombre, direccion, ciudad, activo: true, created_at: '' });

describe('lugaresDelViaje', () => {
  const lugares = [lugar(1, 'Retiro'), lugar(2, 'Lacloteca'), lugar(3, 'Nogoyá')];

  it('respeta el orden cargado en el viaje, no el de la lista', () => {
    const viaje = { lugares_embarque_ids: [3, 1] } as Viaje;
    expect(lugaresDelViaje(viaje, lugares).map(l => l.nombre)).toEqual(['Nogoyá', 'Retiro']);
  });

  it('ignora ids de lugares borrados o inactivos', () => {
    const viaje = { lugares_embarque_ids: [2, 99] } as Viaje;
    expect(lugaresDelViaje(viaje, lugares).map(l => l.id)).toEqual([2]);
  });

  it('viaje sin embarques o nulo', () => {
    expect(lugaresDelViaje(null, lugares)).toEqual([]);
    expect(lugaresDelViaje({ lugares_embarque_ids: [] } as unknown as Viaje, lugares)).toEqual([]);
  });
});

describe('embarqueLabel', () => {
  it('nombre con dirección y ciudad', () => {
    expect(embarqueLabel(lugar(1, 'Terminal Nogoyá', 'Av. Sarmiento 567', 'Nogoyá'))).toBe('Terminal Nogoyá — Av. Sarmiento 567, Nogoyá');
  });

  it('solo nombre si no hay ubicación', () => {
    expect(embarqueLabel(lugar(1, 'Parada Federal'))).toBe('Parada Federal');
  });

  it('vacío si el pasajero no tiene embarque', () => {
    expect(embarqueLabel(null)).toBe('');
    expect(embarqueLabel(undefined)).toBe('');
  });
});
