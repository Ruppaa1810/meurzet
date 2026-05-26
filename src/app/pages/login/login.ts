import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';

  loading = false;
  message = '';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}

  async login() {
    this.loading = true;
    this.message = '';

    try {
      const { data, error } = await this.supabaseService.login(this.email, this.password);

      if (error) {
        this.message = error.message;
        this.loading = false;
        return;
      }

      const userId = data.user?.id;

      if (!userId) {
        this.message = 'Usuario inválido';
        this.loading = false;
        return;
      }

      await this.redirigirSegunRol(userId);
    } catch (err) {
      console.error(err);
      this.message = 'Error inesperado';
    }

    this.loading = false;
  }

  private async redirigirSegunRol(userId: string) {
    const { data: perfil, error: perfilError } = await this.supabaseService.getPerfil(userId);

    if (perfilError || !perfil) {
      this.message = 'Perfil no encontrado';
      return;
    }

    const rol = perfil.rol;

    if (rol === 'operador_admin') {
      this.router.navigate(['/admin']);
    } else if (rol === 'admin_mayorista') {
      this.router.navigate(['/mayorista']);
    } else if (rol === 'vendedor_minorista') {
      this.router.navigate(['/minorista']);
    } else {
      this.message = 'Rol no reconocido';
    }
  }
}
