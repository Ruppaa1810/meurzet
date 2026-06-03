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
  sidebarOpen = false;
  private touchStartX = 0;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  get tituloPagina(): string {
    if (this.router.url.includes('validaciones')) return 'Validaciones';
    if (this.router.url.includes('flota')) return 'Gestión de Flota';
    if (this.router.url.includes('viajes')) return 'Gestión de Viajes';
    return 'Administración';
  }

  get esAdmin(): boolean {
    return this.perfil?.rol === 'admin_mayorista';
  }

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

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    if (this.sidebarOpen && dx < -60) {
      this.closeSidebar();
    } else if (!this.sidebarOpen && this.touchStartX < 40 && dx > 60) {
      this.sidebarOpen = true;
    }
  }

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/'], { replaceUrl: true });
  }
}
