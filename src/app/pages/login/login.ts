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
  showPassword = false;
  remember = false;

  loading = false;
  message = '';
  showForgotPassword = false;
  forgotEmail = '';
  resetMessage = '';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
  ) {
    const saved = localStorage.getItem('meurzet_email');
    if (saved) {
      this.email = saved;
      this.remember = true;
    }
  }

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

      if (this.remember) {
        localStorage.setItem('meurzet_email', this.email);
      } else {
        localStorage.removeItem('meurzet_email');
      }

      const { data: perfil, error: perfilError } = await this.supabaseService.getPerfil(userId);
      if (perfilError || !perfil) {
        this.message = 'Perfil no encontrado';
        this.loading = false;
        return;
      }
      this.redirigirSegunRol(perfil.rol);
    } catch {
      this.message = 'Error inesperado';
    }

    this.loading = false;
  }

  async sendResetEmail() {
    if (!this.forgotEmail) {
      this.resetMessage = 'Ingresá tu correo electrónico';
      return;
    }
    this.loading = true;
    this.resetMessage = '';
    const { error } = await this.supabaseService.resetPassword(this.forgotEmail);
    this.loading = false;
    if (error) {
      this.resetMessage = error.message;
    } else {
      this.resetMessage = 'Te enviamos un enlace para restablecer tu contraseña';
    }
  }

  cancelForgotPassword() {
    this.showForgotPassword = false;
    this.forgotEmail = '';
    this.resetMessage = '';
  }

  private redirigirSegunRol(rol: string) {
    if (rol === 'operador_admin' || rol === 'admin_mayorista') {
      this.router.navigate(['/admin']);
    } else if (rol === 'vendedor_minorista') {
      this.router.navigate(['/minorista']);
    } else {
      this.message = 'Rol no reconocido';
    }
  }
}
