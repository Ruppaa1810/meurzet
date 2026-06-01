import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import type { Perfil } from '../../models/database.types';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin.html',
})
export class Admin implements OnInit {
  perfil: Perfil | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    const { data } = await this.supabaseService.getCurrentProfile();
    this.perfil = data;
    this.cdr.detectChanges();
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
