import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import type { Perfil, UserRole } from '../../../models/database.types';

interface VendedorConReservas extends Perfil {
  totalReservas: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

@Component({
  selector: 'app-gestion-minoristas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-minoristas.html',
})
export class GestionMinoristas implements OnInit, OnDestroy {
  vendedores: VendedorConReservas[] = [];
  loading = false;
  mensaje = '';
  buscando = '';

  mostrarModal = false;
  guardando = false;
  successMensaje = '';
  private successTimeout: any = null;
  editando: VendedorConReservas | null = null;
  formEmail = '';
  formPassword = '';
  formNombre = '';
  formAgencia = '';

  rol: UserRole | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  get esAdmin(): boolean {
    return this.rol === 'admin_mayorista';
  }

  async ngOnInit() {
    const { data } = await this.supabaseService.getCurrentProfile();
    if (data) this.rol = data.rol;
    await this.cargar();
  }

  ngOnDestroy() {
    this.dismissSuccess();
  }

  get totalReservasGlobal(): number {
    return this.vendedores.reduce((t, v) => t + v.totalReservas, 0);
  }

  get totalPendientesGlobal(): number {
    return this.vendedores.reduce((t, v) => t + v.pendientes, 0);
  }

  get totalAprobadasGlobal(): number {
    return this.vendedores.reduce((t, v) => t + v.aprobadas, 0);
  }

  get vendedoresFiltrados(): VendedorConReservas[] {
    if (!this.buscando.trim()) return this.vendedores;
    const q = this.buscando.toLowerCase();
    return this.vendedores.filter(v =>
      v.nombre.toLowerCase().includes(q) ||
      (v.agencia_nombre || '').toLowerCase().includes(q)
    );
  }

  async cargar() {
    this.loading = true;
    this.mensaje = '';
    this.successMensaje = '';

    const { data: perfiles, error } = await this.supabaseService.getVendedoresMinoristas();
    if (error) { this.mensaje = error.message; this.loading = false; return; }

    const vendedores: VendedorConReservas[] = (perfiles ?? []).map(p => ({
      ...p,
      totalReservas: 0,
      pendientes: 0,
      aprobadas: 0,
      rechazadas: 0,
    }));

    for (const v of vendedores) {
      const { data: reservas } = await this.supabaseService.getReservasPorVendedor(v.id);
      if (reservas) {
        v.totalReservas = reservas.length;
        v.pendientes = reservas.filter(r => r.estado === 'pendiente_comprobante' || r.estado === 'pendiente_validacion').length;
        v.aprobadas = reservas.filter(r => r.estado === 'aprobado').length;
        v.rechazadas = reservas.filter(r => r.estado === 'rechazado').length;
      }
    }

    this.vendedores = vendedores;
    this.loading = false;
    this.cdr.detectChanges();
  }

  async toggleActivo(v: VendedorConReservas) {
    if (!this.esAdmin) return;
    const nuevoEstado = !v.activo;
    const { error } = await this.supabaseService.togglePerfilActivo(v.id, nuevoEstado);
    if (error) { this.mensaje = error.message; return; }
    v.activo = nuevoEstado;
  }

  abrirNuevo() {
    if (!this.esAdmin) return;
    this.editando = null;
    this.formEmail = '';
    this.formPassword = '';
    this.formNombre = '';
    this.formAgencia = '';
    this.mensaje = '';
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  abrirEditar(v: VendedorConReservas) {
    if (!this.esAdmin) return;
    this.editando = v;
    this.formEmail = '';
    this.formPassword = '';
    this.formNombre = v.nombre;
    this.formAgencia = v.agencia_nombre ?? '';
    this.mensaje = '';
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.editando = null;
    this.guardando = false;
  }

  dismissSuccess() {
    this.successMensaje = '';
    if (this.successTimeout) { clearTimeout(this.successTimeout); this.successTimeout = null; }
  }

  private mostrarSuccess(msg: string) {
    this.dismissSuccess();
    this.successMensaje = msg;
    this.cdr.detectChanges();
    this.successTimeout = setTimeout(() => this.dismissSuccess(), 5000);
  }

  async guardar() {
    if (!this.formNombre.trim()) { this.mensaje = 'El nombre es obligatorio'; return; }
    this.mensaje = '';
    this.guardando = true;

    const esEdicion = !!this.editando;
    try {
      if (esEdicion) {
        const { error } = await this.supabaseService.actualizarPerfil(this.editando!.id, {
          nombre: this.formNombre.trim(),
          agencia_nombre: this.formAgencia.trim() || null,
        });
        if (error) { this.mensaje = error.message; return; }
      } else {
        if (!this.formEmail.trim() || !this.formPassword.trim()) {
          this.mensaje = 'Email y contraseña son obligatorios';
          return;
        }
        const { error } = await this.supabaseService.crearVendedorMinorista(
          this.formEmail.trim(),
          this.formPassword,
          this.formNombre.trim(),
          this.formAgencia.trim(),
        );
        if (error) { this.mensaje = error.message; return; }
      }

      this.cerrarModal();
      await this.cargar();
      if (!this.mensaje) {
        this.mostrarSuccess(esEdicion ? 'Vendedor actualizado correctamente' : 'Vendedor creado correctamente');
      }
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado';
    } finally {
      this.guardando = false;
    }
  }
}
