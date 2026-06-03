import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PerfilService } from '../services/perfil.service';
import type { UserRole } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private authService: AuthService,
    private perfilService: PerfilService,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const session = (await this.authService.getSession()).data.session;
    if (!session) {
      this.router.navigate(['/'], { replaceUrl: true });
      return false;
    }

    const { data: perfil } = await this.perfilService.getPerfil(session.user.id);
    if (!perfil) {
      this.router.navigate(['/'], { replaceUrl: true });
      return false;
    }

    const allowedRoles = route.data['roles'] as UserRole[] | undefined;
    if (allowedRoles && !allowedRoles.includes(perfil.rol)) {
      this.router.navigate(['/'], { replaceUrl: true });
      return false;
    }

    return true;
  }
}
