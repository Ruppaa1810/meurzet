import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PerfilService } from '../../services/perfil.service';
import { AuthService } from '../../services/auth.service';
import type { Perfil } from '../../models/database.types';

@Component({
  selector: 'app-minorista',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './minorista.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Minorista implements OnInit, OnDestroy {
  perfil: Perfil | null = null;
  sidebarOpen = false;
  isLargeScreen = window.innerWidth >= 1024;
  private touchStartX = 0;
  private resizeListener!: () => void;

  constructor(
    private perfilService: PerfilService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.resizeListener = this.onResize.bind(this);
    window.addEventListener('resize', this.resizeListener);

    const { data } = await this.perfilService.getCurrentProfile();
    this.perfil = data;
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeListener);
  }

  private onResize() {
    this.isLargeScreen = window.innerWidth >= 1024;
  }

  readonly navInferior = [
    { ruta: '/minorista/vender', label: 'Vender', icono: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { ruta: '/minorista/mis-reservas', label: 'Reservas', icono: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { ruta: '/minorista/mis-comisiones', label: 'Comisiones', icono: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { ruta: '/minorista/perfil', label: 'Perfil', icono: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ];

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
    await this.authService.signOut();
    this.router.navigate(['/'], { replaceUrl: true });
  }
}
