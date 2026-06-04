import { Injectable } from '@angular/core';
import type { ConfigCuota, ConfigPagos } from '../models/config-pagos.types';

const STORAGE_KEY = 'meurzet_config_pagos';

const OPCIONES_DEFAULT: ConfigCuota[] = [
  { cuotas: 1, recargo: 0 },
  { cuotas: 3, recargo: 5 },
  { cuotas: 6, recargo: 10 },
  { cuotas: 12, recargo: 20 },
];

@Injectable({ providedIn: 'root' })
export class ConfigPagosService {
  async getOpcionesCuotas(): Promise<ConfigCuota[]> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return OPCIONES_DEFAULT;
    try {
      const config: ConfigPagos = JSON.parse(raw);
      return config.opcionesCuotas.length ? config.opcionesCuotas : OPCIONES_DEFAULT;
    } catch {
      return OPCIONES_DEFAULT;
    }
  }

  async setOpcionesCuotas(opciones: ConfigCuota[]): Promise<void> {
    const config: ConfigPagos = { opcionesCuotas: opciones };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}
