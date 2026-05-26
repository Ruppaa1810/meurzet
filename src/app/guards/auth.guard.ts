import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { AuthStore } from '../services/auth-store.service';
import type { UserRole } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private authStore: AuthStore,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const session = (await this.supabaseService.supabase.auth.getSession()).data.session;
    if (!session) {
      this.router.navigate(['/']);
      return false;
    }

    const { data: perfil } = await this.supabaseService.getPerfil(session.user.id);
    if (!perfil) {
      this.router.navigate(['/']);
      return false;
    }

    this.authStore.rol = perfil.rol;

    const allowedRoles = route.data['roles'] as UserRole[] | undefined;
    if (allowedRoles && !allowedRoles.includes(perfil.rol)) {
      this.router.navigate(['/']);
      return false;
    }

    return true;
  }
}
