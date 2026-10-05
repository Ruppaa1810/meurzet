import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { UserRole } from '../models/database.types';

/**
 * Si la función responde con error (4xx/5xx), supabase-js devuelve un error genérico
 * ("Edge Function returned a non-2xx status code"); el motivo real viene en el cuerpo de la respuesta.
 */
async function errorReal(error: any): Promise<Error> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return new Error(body.error);
  } catch { /* sin cuerpo JSON: se usa el error original */ }
  return error;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private async invokeWithTimeout<T>(fn: string, body: any, timeoutMs = 15000): Promise<{ data: T | null; error: Error | null }> {
    const { data, error } = await Promise.race([
      supabase.functions.invoke(fn, { body }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ]);
    if (error) return { data: null, error: await errorReal(error) };
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
    if (error) return { error: await errorReal(error) };
    if (res?.error) return { error: new Error(res.error) };
    return { error: null };
  }
}
