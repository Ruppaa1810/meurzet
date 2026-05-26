import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import { AuthStore } from '../../services/auth-store.service';
import type { Perfil } from '../../models/database.types';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  perfil: Perfil | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private authStore: AuthStore,
  ) {}

  async ngOnInit() {
    const session = await this.supabaseService.supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (userId) {
      const { data } = await this.supabaseService.getPerfil(userId);
      this.perfil = data;
    }
  }

  get esAdmin(): boolean {
    return this.authStore.rol === 'admin_mayorista';
  }

  get nombreUsuario(): string {
    return this.perfil?.nombre || 'Administrador';
  }

  get agenciaNombre(): string {
    return this.perfil?.agencia_nombre || 'admin@meurzet.com';
  }

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/']);
  }
}
