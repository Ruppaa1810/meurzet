import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { PerfilService } from '../../services/perfil.service';
import { traducirError } from '../../utils/errors';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  email = '';
  password = '';
  showPassword = false;
  remember = false;

  loading = false;
  message = '';
  isSuccessMessage = false;
  showForgotPassword = false;
  forgotEmail = '';
  resetMessage = '';
  resetEnviado = false;

  // Restablecer contraseña desde link
  showRecoveryForm = false;
  newPassword = '';
  newPasswordConfirm = '';
  recoveryLoading = false;
  recoveryError = '';

  constructor(
    private authService: AuthService,
    private perfilService: PerfilService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    const saved = localStorage.getItem('meurzet_email');
    if (saved) {
      this.email = saved;
      this.remember = true;
    }

    if (window.location.hash.includes('type=recovery') || this.authService.isPasswordRecovery) {
      this.showRecoveryForm = true;
      this.showForgotPassword = false;
    }
  }

  async login() {
    this.loading = true;
    this.message = '';

    try {
      const { data, error } = await this.authService.login(this.email, this.password);

      if (error) {
        this.message = traducirError(error.message);
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

      const { data: perfil, error: perfilError } = await this.perfilService.getPerfil(userId);
      if (perfilError || !perfil) {
        this.message = 'Perfil no encontrado';
        this.loading = false;
        return;
      }
      this.redirigirSegunRol(perfil.rol);
    } catch (e: any) {
      this.message = traducirError(e?.message || 'Error inesperado');
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
    this.resetEnviado = false;
    try {
      const { error } = await this.authService.resetPassword(this.forgotEmail);
      if (error) {
        this.resetMessage = traducirError(error.message);
      } else {
        this.resetEnviado = true;
        this.resetMessage = 'Te enviamos un enlace para restablecer tu contraseña';
      }
    } catch (e: any) {
      this.resetMessage = traducirError(e?.message || 'Error inesperado');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async updatePassword() {
    if (!this.newPassword.trim()) {
      this.recoveryError = 'Ingresá una contraseña nueva';
      return;
    }
    if (this.newPassword.length < 6) {
      this.recoveryError = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }
    if (this.newPassword !== this.newPasswordConfirm) {
      this.recoveryError = 'Las contraseñas no coinciden';
      return;
    }

    this.recoveryLoading = true;
    this.recoveryError = '';

    try {
      const { error } = await this.authService.updatePassword(this.newPassword);
      if (error) {
        this.recoveryError = traducirError(error.message);
        return;
      }
      this.showRecoveryForm = false;
      this.isSuccessMessage = true;
      this.message = 'Contraseña actualizada correctamente. Ya podés iniciar sesión.';
    } catch (e: any) {
      this.recoveryError = traducirError(e?.message || 'Error inesperado');
    } finally {
      this.recoveryLoading = false;
      this.cdr.detectChanges();
    }
  }

  cancelForgotPassword() {
    this.showForgotPassword = false;
    this.forgotEmail = '';
    this.resetMessage = '';
    this.resetEnviado = false;
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
