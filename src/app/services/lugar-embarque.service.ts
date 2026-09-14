import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { LugarEmbarque } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class LugarEmbarqueService {

  async getLugares() {
    return await supabase
      .from('lugares_embarque')
      .select('*')
      .eq('activo', true)
      .order('nombre');
  }

  async getLugaresAll() {
    return await supabase
      .from('lugares_embarque')
      .select('*')
      .order('nombre');
  }

  async createLugar(data: Pick<LugarEmbarque, 'nombre' | 'direccion' | 'ciudad'>) {
    return await supabase
      .from('lugares_embarque')
      .insert(data)
      .select()
      .single<LugarEmbarque>();
  }

  async updateLugar(id: number, data: Partial<Pick<LugarEmbarque, 'nombre' | 'direccion' | 'ciudad' | 'activo'>>) {
    return await supabase
      .from('lugares_embarque')
      .update(data)
      .eq('id', id)
      .select()
      .single<LugarEmbarque>();
  }

  async deleteLugar(id: number) {
    return await supabase
      .from('lugares_embarque')
      .delete()
      .eq('id', id);
  }
}
