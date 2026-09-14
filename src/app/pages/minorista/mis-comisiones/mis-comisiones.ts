import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComisionService } from '../../../services/comision.service';
import { PerfilService } from '../../../services/perfil.service';
import type { Comision } from '../../../models/database.types';

@Component({
  selector: 'app-mis-comisiones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-comisiones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisComisiones implements OnInit {
  comisiones: Comision[] = [];
  loading = true;
  resumen = { totalGenerado: 0, totalPendiente: 0, totalPagado: 0 };

  constructor(
    private comisionService: ComisionService,
    private perfilService: PerfilService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    const { data: perfil } = await this.perfilService.getCurrentProfile();
    if (perfil?.id) {
      const { data } = await this.comisionService.getComisionesByVendedor(perfil.id);
      this.comisiones = data || [];
      this.resumen = await this.comisionService.getResumenByVendedor(perfil.id);
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  formatPrecio(v: number): string {
    return `$ ${v.toLocaleString('es-AR')}`;
  }

  formatFecha(f: string): string {
    return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  pasajeroLabel(c: Comision): string {
    return '-';
  }
}
