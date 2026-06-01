import { Injectable } from '@angular/core';
import type { Viaje, MapaAsientoViaje } from '../models/database.types';

export interface AsientoReserva {
  asientoId: number;
  nroAsiento: number;
  piso: number;
  categoria: string;
}

export interface PasajeroData {
  nombre: string;
  apellido: string;
  documento: string;
  email: string;
  telefono: string;
}

export type TipoPagoMode = 'total' | 'parcial' | 'personalizado';

@Injectable({ providedIn: 'root' })
export class ReservaStateService {
  viaje: Viaje | null = null;
  asientos: AsientoReserva[] = [];
  pasajeros: PasajeroData[] = [];
  tipoPagoMode: TipoPagoMode = 'parcial';
  montoPersonalizado: number = 0;
  precio: number = 0;
  reservaIds: number[] = [];

  get total(): number {
    return this.precio * this.asientos.length;
  }

  get montoMinimo(): number {
    return Math.round(this.total * 0.3);
  }

  get porcentajePago(): number {
    if (this.tipoPagoMode === 'total') return 100;
    if (this.tipoPagoMode === 'parcial') return 30;
    if (this.total === 0) return 0;
    return Math.min(100, Math.round(this.montoPersonalizado / this.total * 100));
  }

  iniciar(viaje: Viaje, asientos: MapaAsientoViaje[]) {
    this.viaje = viaje;
    this.asientos = asientos.map(a => ({
      asientoId: a.id,
      nroAsiento: a.nro_asiento,
      piso: a.piso,
      categoria: a.categoria,
    }));
    this.pasajeros = asientos.map(() => ({
      nombre: '', apellido: '', documento: '', email: '', telefono: '',
    }));
    this.precio = viaje.precio_base;
    this.tipoPagoMode = 'parcial';
    this.montoPersonalizado = 0;
  }

  limpiar() {
    this.viaje = null;
    this.asientos = [];
    this.pasajeros = [];
    this.precio = 0;
    this.tipoPagoMode = 'parcial';
    this.montoPersonalizado = 0;
    this.reservaIds = [];
  }
}
