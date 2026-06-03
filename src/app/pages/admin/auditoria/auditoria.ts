import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditoriaService, AuditoriaConVendedor } from '../../../services/auditoria.service';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auditoria.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auditoria implements OnInit {
  registros: AuditoriaConVendedor[] = [];
  registrosFiltrados: AuditoriaConVendedor[] = [];
  filtroAccion: string = 'todas';
  loading = true;

  constructor(
    private auditoriaService: AuditoriaService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data } = await this.auditoriaService.getAll(100);
      if (data) this.registros = data;
    } catch {
    }
    this.aplicarFiltro();
    this.loading = false;
    this.cdr.detectChanges();
  }

  get totalAcciones(): number {
    return this.registros.length;
  }

  get operadoresUnicos(): number {
    return new Set(this.registros.map(r => r.vendedor_id)).size;
  }

  aplicarFiltro(tipo?: string) {
    if (tipo) this.filtroAccion = tipo;
    if (this.filtroAccion === 'todas') {
      this.registrosFiltrados = [...this.registros];
    } else {
      this.registrosFiltrados = this.registros.filter(r => r.accion === this.filtroAccion);
    }
  }

  accionLabel(accion: string): string {
    const map: Record<string, string> = {
      bloqueo: 'Bloqueo',
      liberacion: 'Liberación',
      aprobacion: 'Aprobación',
      rechazo: 'Rechazo',
    };
    return map[accion] || accion;
  }

  accionClass(accion: string): string {
    const map: Record<string, string> = {
      bloqueo: 'bg-yellow-100 text-yellow-700',
      liberacion: 'bg-blue-100 text-blue-700',
      aprobacion: 'bg-green-100 text-green-700',
      rechazo: 'bg-red-100 text-red-700',
    };
    return map[accion] || 'bg-slate-100 text-slate-700';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
