import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { RegistroAuditoria, UserRole } from '../models/database.types';

export interface RegistroConUsuario extends RegistroAuditoria {
  usuario: { nombre: string; email: string | null; rol: UserRole } | null;
}

/** La auditoría la escriben triggers en la base (migración 025): acá solo se lee. */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  async getUltimos(limit = 500) {
    return await supabase
      .from('auditoria')
      .select('*, usuario:usuario_id(nombre, email, rol)')
      .order('fecha', { ascending: false })
      .limit(limit) as unknown as { data: RegistroConUsuario[] | null; error: any };
  }
}
