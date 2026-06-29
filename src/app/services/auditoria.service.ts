import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';
import type { AuditoriaPasaje } from '../models/database.types';

export interface AuditoriaConVendedor extends AuditoriaPasaje {
  perfil?: { nombre: string } | null;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  async log(asientoViajeId: number, accion: string) {
    const session = await supabase.auth.getSession();
    const vendedorId = session.data.session?.user?.id;
    if (!vendedorId) return { error: new Error('Sesión expirada') };

    return await supabase
      .from('auditoria_pasajes')
      .insert({ asiento_viaje_id: asientoViajeId, vendedor_id: vendedorId, accion })
      .select()
      .single<AuditoriaPasaje>();
  }

  async getAll(limit = 50) {
    return await supabase
      .from('auditoria_pasajes')
      .select('*, perfil:vendedor_id(nombre)')
      .order('fecha', { ascending: false })
      .limit(limit) as unknown as { data: AuditoriaConVendedor[] | null; error: any };
  }
}
