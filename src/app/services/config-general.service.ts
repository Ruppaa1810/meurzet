import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

export interface BancoConfig {
  alias: string;
  cbu: string;
  titular: string;
  banco: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigGeneralService {
  private cache: Record<string, any> = {};
  private loaded = false;

  async cargar(): Promise<void> {
    if (this.loaded) return;
    const { data } = await supabase
      .from('configuracion_general')
      .select('clave, valor');
    if (data) {
      for (const row of data) {
        this.cache[row.clave] = typeof row.valor === 'string'
          ? JSON.parse(row.valor)
          : row.valor;
      }
    }
    this.loaded = true;
  }

  async getContacto(): Promise<string> {
    await this.cargar();
    return this.cache['contacto'] || '11 2345-6789';
  }

  async getBanco(): Promise<BancoConfig> {
    await this.cargar();
    return this.cache['banco'] || {
      alias: 'MEURZET.PAGOS',
      cbu: '1234567890123456789012',
      titular: 'Meurzet Viajes',
      banco: 'Meurzet S.A.',
    };
  }

  async getPorcentajeMinimoSenia(): Promise<number> {
    const { data } = await supabase
      .from('config_pagos')
      .select('porcentaje_minimo_seia')
      .limit(1)
      .maybeSingle();
    return (data as any)?.porcentaje_minimo_seia ?? 30;
  }

  async setContacto(contacto: string): Promise<void> {
    await supabase
      .from('configuracion_general')
      .upsert({ clave: 'contacto', valor: JSON.stringify(contacto), updated_at: new Date().toISOString() });
    this.cache['contacto'] = contacto;
  }

  async setBanco(banco: BancoConfig): Promise<void> {
    await supabase
      .from('configuracion_general')
      .upsert({ clave: 'banco', valor: banco, updated_at: new Date().toISOString() });
    this.cache['banco'] = banco;
  }

  invalidate(): void {
    this.loaded = false;
    this.cache = {};
  }
}
