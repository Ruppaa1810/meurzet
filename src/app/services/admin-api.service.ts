import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { UserRole } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  async crearVendedorMinorista(email: string, password: string, nombre: string, agenciaNombre: string, rol: UserRole = 'vendedor_minorista', createdBy?: string) {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email, password, nombre, agencia_nombre: agenciaNombre, rol, created_by: createdBy },
    });
    if (error) return { data: null, error };
    if (data?.error) return { data: null, error: new Error(data.error) };
    return { data: data.data, error: null };
  }

  async actualizarAuthUser(userId: string, data: { email?: string; password?: string }) {
    const { data: res, error } = await supabase.functions.invoke('admin-update-user', {
      method: 'PUT',
      body: { userId, ...data },
    });
    if (error) return { error };
    if (res?.error) return { error: new Error(res.error) };
    return { error: null };
  }
}
