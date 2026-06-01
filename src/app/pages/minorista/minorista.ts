import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import type { Perfil } from '../../models/database.types';

@Component({
  selector: 'app-minorista',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './minorista.html',
})
export class Minorista implements OnInit {
  perfil: Perfil | null = null;
  sidebarOpen = false;
  private touchStartX = 0;

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
    return this.perfil?.nombre || 'Vendedor';
  }

  get agenciaNombre(): string {
    return this.perfil?.agencia_nombre || 'minorista@meurzet.com';
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
    }
  }

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/']);
  }
}
