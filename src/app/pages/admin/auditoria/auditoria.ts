import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface OperadorAuditoria {
  nombre: string;
  edicionesAVendedores: number;
  ultimaAccion: string;
  diasSinActividad?: number;
}

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auditoria.html',
})
export class Auditoria {
  operadores: OperadorAuditoria[] = [
    { nombre: 'Ana', edicionesAVendedores: 5, ultimaAccion: 'Hoy 11:05 - Editó datos de vendedor "Carlos"' },
    { nombre: 'Roberto', edicionesAVendedores: 2, ultimaAccion: 'Hoy 09:30 - Aprobó comprobante de Lucía' },
    { nombre: 'Laura', edicionesAVendedores: 0, ultimaAccion: 'Ayer 16:45 - Rechazó comprobante de Pedro' },
    { nombre: 'Diego', edicionesAVendedores: 4, ultimaAccion: 'Hace 8 días - Editó datos de vendedor "María"', diasSinActividad: 8 },
  ];

  get operadoresActivos(): number {
    return this.operadores.length;
  }

  get totalEdiciones(): number {
    return this.operadores.reduce((acc, o) => acc + o.edicionesAVendedores, 0);
  }

  getAuditoria(o: OperadorAuditoria): string {
    const partes: string[] = [];

    if (o.diasSinActividad && o.diasSinActividad >= 7) {
      partes.push('⚠️ Sin actividad reciente');
    }

    if (o.edicionesAVendedores > 3) {
      partes.push('📝 Muchas ediciones a vendedores');
    } else if (o.edicionesAVendedores >= 1 && o.edicionesAVendedores <= 3) {
      partes.push('🟢 Normal');
    }

    if (partes.length === 0) {
      return '✅ Sin observaciones';
    }

    return partes.join(' ');
  }
}
