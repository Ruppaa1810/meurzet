import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import type { Perfil } from '../../models/database.types';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  perfil: Perfil | null = null;
  viajesActivos = 0;
  totalUnidades = 0;
  reservasHoy = 0;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}

  async ngOnInit() {
    const session = await this.supabaseService.supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (userId) {
      const { data } = await this.supabaseService.getPerfil(userId);
      this.perfil = data;
    }

    const [viajesRes, unidadesRes] = await Promise.all([
      this.supabaseService.getViajes(),
      this.supabaseService.supabase.from('unidades').select('id'),
    ]);

    if (viajesRes.data) this.viajesActivos = viajesRes.data.length;
    if (unidadesRes.data) this.totalUnidades = unidadesRes.data.length;
  }

  get nombreUsuario(): string {
    return this.perfil?.nombre || 'Administrador';
  }

  get emailUsuario(): string {
    return this.perfil?.agencia_nombre || 'admin@meurzet.com';
  }

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/']);
  }
}
