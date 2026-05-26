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

@Injectable({ providedIn: 'root' })
export class ReservaStateService {
  viaje: Viaje | null = null;
  asientos: AsientoReserva[] = [];
  pasajeros: PasajeroData[] = [];
  porcentajePago: number = 100;
  precio: number = 0;
  reservaIds: number[] = [];

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
    this.porcentajePago = 30;
  }

  limpiar() {
    this.viaje = null;
    this.asientos = [];
    this.pasajeros = [];
    this.precio = 0;
    this.porcentajePago = 30;
    this.reservaIds = [];
  }
}
