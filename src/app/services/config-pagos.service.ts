import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { ConfigPagoOpcion } from '../models/database.types';

export interface OpcionCuota {
  cuotas: number;
  recargo: number;
}

@Injectable({ providedIn: 'root' })
export class ConfigPagosService {
  async getOpciones(): Promise<ConfigPagoOpcion[]> {
    const { data } = await supabase
      .from('config_pagos')
      .select('*')
      .eq('activo', true)
      .order('cuotas', { ascending: true });
    return data || [];
  }

  async getOpcionesCuotas(): Promise<OpcionCuota[]> {
    const opciones = await this.getOpciones();
    return opciones.map(o => ({ cuotas: o.cuotas, recargo: o.recargo }));
  }

  async getOpcionesAdmin(): Promise<ConfigPagoOpcion[]> {
    const { data } = await supabase
      .from('config_pagos')
      .select('*')
      .order('cuotas', { ascending: true });
    return data || [];
  }

  async crearOpcion(cuotas: number, recargo: number) {
    return await supabase
      .from('config_pagos')
      .insert({ cuotas, recargo })
      .select()
      .single<ConfigPagoOpcion>();
  }

  async actualizarOpcion(id: number, cuotas: number, recargo: number) {
    return await supabase
      .from('config_pagos')
      .update({ cuotas, recargo })
      .eq('id', id)
      .select()
      .single<ConfigPagoOpcion>();
  }

  async toggleActivo(id: number, activo: boolean) {
    return await supabase
      .from('config_pagos')
      .update({ activo })
      .eq('id', id);
  }

  async eliminarOpcion(id: number) {
    return await supabase
      .from('config_pagos')
      .delete()
      .eq('id', id);
  }
}
