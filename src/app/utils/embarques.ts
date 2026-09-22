import type { LugarEmbarque, Viaje } from '../models/database.types';

/** Copia del lugar guardada en pasajero_datos, para que la reserva no cambie si después se edita o borra el lugar. */
export type EmbarquePasajero = Pick<LugarEmbarque, 'id' | 'nombre' | 'direccion' | 'ciudad'>;

/** Lugares de un viaje, en el orden en que los cargó el admin. */
export function lugaresDelViaje(viaje: Viaje | null | undefined, lugares: LugarEmbarque[]): LugarEmbarque[] {
  return (viaje?.lugares_embarque_ids ?? [])
    .map(id => lugares.find(l => l.id === id))
    .filter((l): l is LugarEmbarque => !!l);
}

export function embarqueLabel(e: EmbarquePasajero | null | undefined): string {
  if (!e) return '';
  const ubicacion = [e.direccion, e.ciudad].filter(Boolean).join(', ');
  return ubicacion ? `${e.nombre} — ${ubicacion}` : e.nombre;
}
