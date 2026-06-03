import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import { AdminApiService } from './admin-api.service';
import type { Perfil, UserRole } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class PerfilService {
  constructor(private adminApi: AdminApiService) {}

  async getPerfil(userId: string) {
    return await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single<Perfil>();
  }

  async getCurrentProfile(): Promise<{ data: Perfil | null }> {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) return { data: null };
    return this.getPerfil(userId);
  }

  async getVendedoresMinoristas() {
    return await supabase
      .from('perfiles')
      .select('*')
      .in('rol', ['vendedor_minorista', 'operador_admin'])
      .order('created_at', { ascending: false });
  }

  async togglePerfilActivo(id: string, activo: boolean) {
    return await supabase
      .from('perfiles')
      .update({ activo })
      .eq('id', id)
      .select()
      .single<Perfil>();
  }

  async crearVendedorMinorista(email: string, password: string, nombre: string, agenciaNombre: string, rol: UserRole = 'vendedor_minorista', createdBy?: string) {
    return await this.adminApi.crearVendedorMinorista(email, password, nombre, agenciaNombre, rol, createdBy);
  }

  async actualizarPerfil(id: string, datos: Partial<Pick<Perfil, 'nombre' | 'agencia_nombre' | 'rol'>>) {
    return await supabase
      .from('perfiles')
      .update(datos)
      .eq('id', id)
      .select()
      .single<Perfil>();
  }

  async actualizarAuthUser(userId: string, data: { email?: string; password?: string }) {
    return await this.adminApi.actualizarAuthUser(userId, data);
  }
}
