import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import type { Perfil } from '../../models/database.types';

@Component({
  selector: 'app-minorista',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './minorista.html',
})
export class Minorista implements OnInit, OnDestroy {
  perfil: Perfil | null = null;
  sidebarOpen = false;
  isLargeScreen = window.innerWidth >= 1024;
  private touchStartX = 0;
  private resizeListener!: () => void;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.resizeListener = this.onResize.bind(this);
    window.addEventListener('resize', this.resizeListener);

    const { data } = await this.supabaseService.getCurrentProfile();
    this.perfil = data;
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeListener);
  }

  private onResize() {
    this.isLargeScreen = window.innerWidth >= 1024;
  }

  get hideSidebar(): boolean {
    return this.router.url.includes('/minorista/seleccion/')
      || this.router.url.includes('/minorista/reserva')
      || this.router.url.includes('/minorista/confirmacion');
  }

  get contentMargin(): string {
    return this.hideSidebar || !this.isLargeScreen ? '0' : '260px';
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
    } else if (!this.sidebarOpen && this.touchStartX < 40 && dx > 60) {
      this.sidebarOpen = true;
    }
  }

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/'], { replaceUrl: true });
  }
}
