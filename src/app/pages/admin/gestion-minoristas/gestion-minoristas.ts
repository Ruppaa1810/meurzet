import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerfilService } from '../../../services/perfil.service';
import { ReservaService } from '../../../services/reserva.service';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  formRol: UserRole = 'vendedor_minorista';

  rol: UserRole | null = null;
  userId: string | null = null;
  expandedId: string | null = null;

  constructor(
    private perfilService: PerfilService,
    private reservaService: ReservaService,
    private cdr: ChangeDetectorRef,
  ) {}

  get esAdmin(): boolean {
    return this.rol === 'admin_mayorista';
  }

  get puedeGestionar(): boolean {
    return this.rol === 'admin_mayorista' || this.rol === 'operador_admin';
  }

  get puedeCrear(): boolean {
    return this.rol === 'admin_mayorista' || this.rol === 'operador_admin';
  }

  get vendedoresCreados(): VendedorConReservas[] {
    if (!this.userId) return [];
    return this.vendedores.filter(v => v.created_by === this.userId && v.rol === 'vendedor_minorista');
  }

  get totalCreados(): number { return this.vendedoresCreados.length; }
  get totalReservasCreados(): number { return this.vendedoresCreados.reduce((t, v) => t + v.totalReservas, 0); }
  get pendientesCreados(): number { return this.vendedoresCreados.reduce((t, v) => t + v.pendientes, 0); }
  get aprobadasCreados(): number { return this.vendedoresCreados.reduce((t, v) => t + v.aprobadas, 0); }
  get rechazadasCreados(): number { return this.vendedoresCreados.reduce((t, v) => t + v.rechazadas, 0); }

  get vendedoresFiltrados(): VendedorConReservas[] {
    let base = this.vendedores;
    if (!this.esAdmin) {
      base = base.filter(v => v.created_by === this.userId && v.rol === 'vendedor_minorista');
    }
    if (!this.buscando.trim()) return base;
    const q = this.buscando.toLowerCase();
    return base.filter(v =>
      v.nombre.toLowerCase().includes(q) ||
      (v.agencia_nombre || '').toLowerCase().includes(q)
    );
  }

  vendedoresPorOperador(operadorId: string): VendedorConReservas[] {
    return this.vendedores.filter(v => v.created_by === operadorId && v.rol === 'vendedor_minorista');
  }

  async ngOnInit() {
    const { data } = await this.perfilService.getCurrentProfile();
    if (data) {
      this.rol = data.rol;
      this.userId = data.id;
    }
    await this.cargar();
  }

  ngOnDestroy() {
    this.dismissSuccess();
  }

  toggleExpand(v: VendedorConReservas) {
    this.expandedId = this.expandedId === v.id ? null : v.id;
  }

  async cargar() {
    this.loading = true;
    this.mensaje = '';
    this.successMensaje = '';

    const { data: perfiles, error } = await this.perfilService.getVendedoresMinoristas();
    if (error) { this.mensaje = error.message; this.loading = false; return; }

    const vendedores: VendedorConReservas[] = (perfiles ?? []).map(p => ({
      ...p,
      totalReservas: 0,
      pendientes: 0,
      aprobadas: 0,
      rechazadas: 0,
    }));

    for (const v of vendedores) {
      const { data: reservas } = await this.reservaService.getReservasPorVendedor(v.id);
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
    if (!this.puedeGestionar) return;
    const nuevoEstado = !v.activo;
    const { error } = await this.perfilService.togglePerfilActivo(v.id, nuevoEstado);
    if (error) { this.mensaje = error.message; return; }
    v.activo = nuevoEstado;
  }

  abrirNuevo() {
    if (!this.puedeCrear) return;
    this.editando = null;
    this.formEmail = '';
    this.formPassword = '';
    this.formNombre = '';
    this.formAgencia = '';
    this.formRol = 'vendedor_minorista';
    this.mensaje = '';
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  abrirEditar(v: VendedorConReservas) {
    if (!this.puedeGestionar) return;
    this.editando = v;
    this.formEmail = '';
    this.formPassword = '';
    this.formNombre = v.nombre;
    this.formAgencia = v.agencia_nombre ?? '';
    this.formRol = v.rol;
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
        if (this.formEmail.trim() || this.formPassword.trim()) {
          const { error: authErr } = await this.perfilService.actualizarAuthUser(
            this.editando!.id,
            {
              email: this.formEmail.trim() || undefined,
              password: this.formPassword || undefined,
            },
          );
          if (authErr) { this.mensaje = authErr.message; return; }
        }

        const updateData: any = { nombre: this.formNombre.trim() };
        if (this.esAdmin) updateData.rol = this.formRol;
        if (this.formRol !== 'operador_admin') {
          updateData.agencia_nombre = this.formAgencia.trim() || null;
        }
        const { error } = await this.perfilService.actualizarPerfil(this.editando!.id, updateData);
        if (error) { this.mensaje = error.message; return; }
      } else {
        if (!this.formEmail.trim() || !this.formPassword.trim()) {
          this.mensaje = 'Email y contraseña son obligatorios';
          return;
        }
        const { error } = await this.perfilService.crearVendedorMinorista(
          this.formEmail.trim(),
          this.formPassword,
          this.formNombre.trim(),
          this.formAgencia.trim(),
          this.formRol,
          this.userId ?? undefined,
        );
        if (error) { this.mensaje = error.message; return; }
      }

      this.cerrarModal();
      await this.cargar();
      if (!this.mensaje) {
        this.mostrarSuccess(esEdicion ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      }
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado';
    } finally {
      this.guardando = false;
    }
  }
}
