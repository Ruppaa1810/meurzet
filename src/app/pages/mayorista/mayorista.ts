import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import type { Viaje, Perfil } from '../../models/database.types';

@Component({
  selector: 'app-mayorista',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mayorista.html',
})
export class Mayorista implements OnInit {
  perfil: Perfil | null = null;
  viajes: Viaje[] = [];

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

    const { data } = await this.supabaseService.getViajes();
    if (data) this.viajes = data;
  }

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/']);
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }
}
