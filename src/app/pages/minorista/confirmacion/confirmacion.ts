import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './confirmacion.html',
  styleUrl: './confirmacion.css',
})
export class Confirmacion implements OnInit {
  origen = '';
  destino = '';
  fecha = '';
  asiento = 0;
  piso = 1;
  categoria = '';
  precio = 0;
  pasajero = '';
  tipoPago = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    const q = this.route.snapshot.queryParams;
    this.origen = q['origen'] || '';
    this.destino = q['destino'] || '';
    this.fecha = q['fecha'] || '';
    this.asiento = Number(q['asiento']);
    this.piso = Number(q['piso']);
    this.categoria = q['categoria'] || '';
    this.precio = Number(q['precio']);
    this.pasajero = q['pasajero'] || '';
    this.tipoPago = q['tipoPago'] || '';
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  get pisoLabel(): string {
    return this.piso === 1 ? 'Baja' : 'Alta';
  }

  get fechaLabel(): string {
    return new Date(this.fecha).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }
}
