import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { UserRole } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private async invokeWithTimeout<T>(fn: string, body: any, timeoutMs = 15000): Promise<{ data: T | null; error: Error | null }> {
    const { data, error } = await Promise.race([
      supabase.functions.invoke(fn, { body }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ]);
    if (error) return { data: null, error };
    if (data?.error) return { data: null, error: new Error(data.error) };
    return { data: data.data, error: null };
  }

  async crearVendedorMinorista(email: string, password: string, nombre: string, agenciaNombre: string, rol: UserRole = 'vendedor_minorista', createdBy?: string) {
    return await this.invokeWithTimeout('admin-create-user', {
      email, password, nombre, agencia_nombre: agenciaNombre, rol, created_by: createdBy,
    });
  }

  async actualizarAuthUser(userId: string, data: { email?: string; password?: string }) {
    const { data: res, error } = await Promise.race([
      supabase.functions.invoke('admin-update-user', { method: 'PUT', body: { userId, ...data } }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      ),
    ]);
    if (error) return { error };
    if (res?.error) return { error: new Error(res.error) };
    return { error: null };
  }
}
