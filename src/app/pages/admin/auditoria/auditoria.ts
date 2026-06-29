import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditoriaService, AuditoriaConVendedor } from '../../../services/auditoria.service';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auditoria.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auditoria implements OnInit {
  entradas: AuditoriaConVendedor[] = [];
  loading = true;

  filtroTipo = '';
  filtroFecha = '';
  fechaBuffer = '';

  constructor(
    private auditoriaService: AuditoriaService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.loading = true;
    const { data } = await this.auditoriaService.getAll(100);
    this.entradas = data || [];
    this.loading = false;
    this.cdr.detectChanges();
  }

  get entradasFiltradas(): AuditoriaConVendedor[] {
    return this.entradas.filter(e => {
      if (this.filtroTipo && e.accion !== this.filtroTipo) return false;
      if (this.filtroFecha) {
        const d = new Date(e.fecha || '');
        const diaSel = new Date(this.filtroFecha + 'T00:00:00');
        if (d.toDateString() !== diaSel.toDateString()) return false;
      }
      return true;
    });
  }

  limpiarFiltros() {
    this.filtroTipo = '';
    this.filtroFecha = '';
    this.fechaBuffer = '';
    this.cdr.detectChanges();
  }

  accionClass(accion: string): string {
    const map: Record<string, string> = {
      bloqueo: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      liberacion: 'bg-blue-100 text-blue-700 border-blue-200',
      aprobacion: 'bg-green-100 text-green-700 border-green-200',
      rechazo: 'bg-red-100 text-red-700 border-red-200',
    };
    return map[accion] || 'bg-slate-100 text-slate-700 border-slate-200';
  }

  accionLabel(accion: string): string {
    const map: Record<string, string> = {
      bloqueo: 'Bloqueo', liberacion: 'Liberación',
      aprobacion: 'Aprobación', rechazo: 'Rechazo',
    };
    return map[accion] || accion;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
