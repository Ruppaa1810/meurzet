import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Accion {
  tipo: 'bloqueo' | 'liberacion' | 'aprobacion' | 'rechazo';
  descripcion: string;
  fecha: string;
  asiento: number;
}

interface Operador {
  nombre: string;
  foto?: string;
  edicionesAVendedores: number;
  ultimaAccion: string;
  diasSinActividad?: number;
  expandido?: boolean;
  acciones: Accion[];
  filtroAnio?: string;
  filtroMes?: string;
}

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auditoria.html',
})
export class Auditoria {
  operadores: Operador[] = [
    {
      nombre: 'Ana García', edicionesAVendedores: 5, diasSinActividad: 0,
      ultimaAccion: 'Hoy 11:05 - Editó datos de vendedor "Carlos"',
      acciones: [
        { tipo: 'liberacion', descripcion: 'Editó datos de vendedor "Carlos"', fecha: '2026-06-08T11:05:00', asiento: 4521 },
        { tipo: 'bloqueo', descripcion: 'Bloqueó asiento de vendedor "María"', fecha: '2026-06-08T10:30:00', asiento: 4518 },
        { tipo: 'aprobacion', descripcion: 'Aprobó comprobante de Lucía', fecha: '2026-06-08T09:15:00', asiento: 4502 },
        { tipo: 'rechazo', descripcion: 'Rechazó comprobante de Pedro', fecha: '2026-06-07T17:20:00', asiento: 4489 },
        { tipo: 'bloqueo', descripcion: 'Bloqueó asiento de vendedor "Sofía"', fecha: '2026-06-07T14:00:00', asiento: 4475 },
      ],
    },
    {
      nombre: 'Roberto Méndez', edicionesAVendedores: 2, diasSinActividad: 0,
      ultimaAccion: 'Hoy 09:30 - Aprobó comprobante de Lucía',
      acciones: [
        { tipo: 'aprobacion', descripcion: 'Aprobó comprobante de Lucía', fecha: '2026-06-08T09:30:00', asiento: 4502 },
        { tipo: 'liberacion', descripcion: 'Liberó asiento de vendedor "Juan"', fecha: '2026-06-07T11:00:00', asiento: 4450 },
      ],
    },
    {
      nombre: 'Laura Fernández', edicionesAVendedores: 0, diasSinActividad: 1,
      ultimaAccion: 'Ayer 16:45 - Rechazó comprobante de Pedro',
      acciones: [
        { tipo: 'rechazo', descripcion: 'Rechazó comprobante de Pedro', fecha: '2026-06-07T16:45:00', asiento: 4489 },
      ],
    },
    {
      nombre: 'Diego Pérez', foto: '', edicionesAVendedores: 4, diasSinActividad: 8,
      ultimaAccion: 'Hace 8 días - Editó datos de vendedor "María"',
      acciones: [
        { tipo: 'bloqueo', descripcion: 'Bloqueó asiento de vendedor "María"', fecha: '2026-05-31T14:20:00', asiento: 4401 },
        { tipo: 'bloqueo', descripcion: 'Bloqueó asiento de vendedor "José"', fecha: '2026-05-31T12:10:00', asiento: 4398 },
        { tipo: 'liberacion', descripcion: 'Liberó asiento de vendedor "Ana"', fecha: '2026-05-30T16:00:00', asiento: 4385 },
        { tipo: 'aprobacion', descripcion: 'Aprobó comprobante de "Luis"', fecha: '2026-05-30T10:30:00', asiento: 4372 },
      ],
    },
  ];

  readonly meses = [
    { value: '', label: 'Todos' },
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  get aniosDisponibles(): string[] {
    const anios = new Set<string>();
    for (const op of this.operadores) {
      for (const a of op.acciones) {
        anios.add(a.fecha.slice(0, 4));
      }
    }
    return Array.from(anios).sort();
  }

  get operadoresActivos(): number {
    return this.operadores.length;
  }

  get totalEdiciones(): number {
    return this.operadores.reduce((acc, o) => acc + o.edicionesAVendedores, 0);
  }

  accionesFiltradas(o: Operador): Accion[] {
    return o.acciones.filter(a => {
      if (o.filtroAnio && a.fecha.slice(0, 4) !== o.filtroAnio) return false;
      if (o.filtroMes && a.fecha.slice(5, 7) !== o.filtroMes) return false;
      return true;
    });
  }

  auditoriaEstado(o: Operador): { clase: string; texto: string } {
    if (o.diasSinActividad && o.diasSinActividad >= 7) {
      return { clase: 'bg-red-100 text-red-700 border-red-200', texto: 'Sin actividad reciente' };
    }
    if (o.edicionesAVendedores > 3) {
      return { clase: 'bg-amber-100 text-amber-700 border-amber-200', texto: 'Muchas ediciones' };
    }
    if (o.edicionesAVendedores >= 1) {
      return { clase: 'bg-green-100 text-green-700 border-green-200', texto: 'Normal' };
    }
    return { clase: 'bg-slate-100 text-slate-500 border-slate-200', texto: 'Sin observaciones' };
  }

  accionClass(tipo: string): string {
    const map: Record<string, string> = {
      bloqueo: 'bg-yellow-100 text-yellow-700',
      liberacion: 'bg-blue-100 text-blue-700',
      aprobacion: 'bg-green-100 text-green-700',
      rechazo: 'bg-red-100 text-red-700',
    };
    return map[tipo] || 'bg-slate-100 text-slate-700';
  }

  accionLabel(tipo: string): string {
    const map: Record<string, string> = {
      bloqueo: 'Bloqueo', liberacion: 'Liberación',
      aprobacion: 'Aprobación', rechazo: 'Rechazo',
    };
    return map[tipo] || tipo;
  }

  initChar(nombre: string): string {
    return nombre.charAt(0).toUpperCase();
  }

  toggleExpandido(o: Operador) {
    o.expandido = !o.expandido;
  }
}
