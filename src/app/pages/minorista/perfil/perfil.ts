import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PerfilService } from '../../../services/perfil.service';
import { AuthService } from '../../../services/auth.service';
import type { Perfil as PerfilType } from '../../../models/database.types';
import { traducirError } from '../../../utils/errors';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './perfil.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Perfil implements OnInit {
  perfil: PerfilType | null = null;
  loading = true;
  savingProfile = false;
  savingPassword = false;
  profileMessage = '';
  passwordMessage = '';

  editNombre = '';
  editAgencia = '';
  newPassword = '';
  newPasswordConfirm = '';

  constructor(
    private perfilService: PerfilService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data } = await this.perfilService.getCurrentProfile();
      this.perfil = data;
      if (data) {
        this.editNombre = data.nombre;
        this.editAgencia = data.agencia_nombre || '';
      }
    } catch {
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  async guardarPerfil() {
    if (!this.perfil?.id || !this.editNombre.trim()) return;
    this.savingProfile = true;
    this.profileMessage = '';
    try {
      const { error } = await this.perfilService.actualizarPerfil(this.perfil.id, {
        nombre: this.editNombre.trim(),
        agencia_nombre: this.editAgencia.trim() || null,
      });
      if (error) {
        this.profileMessage = 'Error al guardar';
        return;
      }
      this.profileMessage = 'Datos actualizados correctamente';
    } catch {
      this.profileMessage = 'Error al guardar';
    } finally {
      this.savingProfile = false;
      this.cdr.detectChanges();
    }
  }

  async cambiarPassword() {
    if (!this.newPassword.trim()) {
      this.passwordMessage = 'Ingresá una contraseña nueva';
      return;
    }
    if (this.newPassword.length < 6) {
      this.passwordMessage = 'Mínimo 6 caracteres';
      return;
    }
    if (this.newPassword !== this.newPasswordConfirm) {
      this.passwordMessage = 'Las contraseñas no coinciden';
      return;
    }
    this.savingPassword = true;
    this.passwordMessage = '';
    try {
      const { error } = await this.authService.updatePassword(this.newPassword);
      if (error) {
        this.passwordMessage = traducirError(error.message);
        return;
      }
      this.passwordMessage = 'Contraseña actualizada correctamente';
      this.newPassword = '';
      this.newPasswordConfirm = '';
    } catch {
      this.passwordMessage = 'Error al cambiar la contraseña';
    } finally {
      this.savingPassword = false;
      this.cdr.detectChanges();
    }
  }
}
