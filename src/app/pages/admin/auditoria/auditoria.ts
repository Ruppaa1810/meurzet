import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditoriaService, RegistroConUsuario } from '../../../services/auditoria.service';
import type { RegistroAuditoria, UserRole } from '../../../models/database.types';

const CATEGORIAS: Record<RegistroAuditoria['categoria'], { label: string; clase: string }> = {
  ventas: { label: 'Ventas', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  pagos: { label: 'Pagos', clase: 'bg-green-50 text-green-700 border-green-200' },
  viajes: { label: 'Viajes y flota', clase: 'bg-sky-50 text-sky-700 border-sky-200' },
  usuarios: { label: 'Usuarios', clase: 'bg-purple-50 text-purple-700 border-purple-200' },
  configuracion: { label: 'Configuración', clase: 'bg-slate-100 text-slate-700 border-slate-200' },
  sesiones: { label: 'Sesiones', clase: 'bg-white text-slate-500 border-slate-200' },
};

const ROLES: Record<UserRole, string> = {
  admin_mayorista: 'Admin',
  operador_admin: 'Operador',
  vendedor_minorista: 'Vendedor',
};

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './auditoria.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auditoria implements OnInit {
  registros: RegistroConUsuario[] = [];
  loading = true;
  error = '';

  categorias = Object.entries(CATEGORIAS).map(([valor, c]) => ({ valor, label: c.label }));
  filtroCategoria = '';
  filtroUsuario = '';
  filtroFecha = '';
  busqueda = '';

  constructor(
    private auditoriaService: AuditoriaService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    const { data, error } = await this.auditoriaService.getUltimos();
    if (error) this.error = error.message;
    this.registros = data ?? [];
    this.loading = false;
    this.cdr.detectChanges();
  }

  /** Quienes aparecen en la auditoría, para filtrar por persona. */
  get usuarios(): { id: string; label: string }[] {
    const vistos = new Map<string, string>();
    for (const r of this.registros) {
      if (r.usuario_id && !vistos.has(r.usuario_id)) vistos.set(r.usuario_id, this.quien(r));
    }
    return [...vistos].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  get filtrados(): RegistroConUsuario[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.registros.filter(r =>
      (!this.filtroCategoria || r.categoria === this.filtroCategoria) &&
      (!this.filtroUsuario || r.usuario_id === this.filtroUsuario) &&
      (!this.filtroFecha || new Date(r.fecha).toDateString() === new Date(this.filtroFecha + 'T00:00:00').toDateString()) &&
      (!q || `${r.detalle} ${this.quien(r)}`.toLowerCase().includes(q)));
  }

  get hayFiltros(): boolean {
    return !!(this.filtroCategoria || this.filtroUsuario || this.filtroFecha || this.busqueda);
  }

  limpiarFiltros() {
    this.filtroCategoria = this.filtroUsuario = this.filtroFecha = this.busqueda = '';
  }

  quien(r: RegistroConUsuario): string {
    if (!r.usuario) return 'Sistema (automático)';
    return `${r.usuario.nombre} · ${r.usuario.email ?? ''}`;
  }

  rol(r: RegistroConUsuario): string {
    return r.usuario ? ROLES[r.usuario.rol] : '';
  }

  categoria(r: RegistroConUsuario) {
    return CATEGORIAS[r.categoria] ?? CATEGORIAS.configuracion;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
