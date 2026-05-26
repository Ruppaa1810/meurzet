import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Admin } from './pages/admin/admin';
import { Mayorista } from './pages/mayorista/mayorista';
import { Minorista } from './pages/minorista/minorista';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'admin', component: Admin },
  { path: 'mayorista', component: Mayorista },
  {
    path: 'minorista',
    component: Minorista,
    children: [
      { path: 'inicio', loadComponent: () => import('./pages/minorista/inicio/inicio').then(m => m.Inicio) },
      { path: 'seleccion/:viajeId', loadComponent: () => import('./pages/minorista/seleccion/seleccion').then(m => m.Seleccion) },
      { path: 'reserva', loadComponent: () => import('./pages/minorista/reserva/reserva').then(m => m.Reserva) },
      { path: 'confirmacion', loadComponent: () => import('./pages/minorista/confirmacion/confirmacion').then(m => m.Confirmacion) },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' }
    ]
  }
];