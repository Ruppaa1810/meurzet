import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Admin } from './pages/admin/admin';
import { AdminDashboard } from './pages/admin/dashboard/dashboard';
import { Validaciones } from './pages/admin/validaciones/validaciones';
import { Minorista } from './pages/minorista/minorista';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Login },
  {
    path: 'admin',
    component: Admin,
    canActivate: [AuthGuard],
    data: { roles: ['admin_mayorista', 'operador_admin'] },
    children: [
      { path: '', component: AdminDashboard },
      { path: 'validaciones', component: Validaciones },
      { path: 'flota', loadComponent: () => import('./pages/admin/flota/flota').then(m => m.Flota) },
      { path: 'viajes', loadComponent: () => import('./pages/admin/viajes/viajes').then(m => m.Viajes) },
      { path: 'minoristas', loadComponent: () => import('./pages/admin/gestion-minoristas/gestion-minoristas').then(m => m.GestionMinoristas), canActivate: [AuthGuard], data: { roles: ['admin_mayorista'] } },
      { path: 'mayoristas', loadComponent: () => import('./pages/admin/gestion-mayoristas/gestion-mayoristas').then(m => m.GestionMayoristas), canActivate: [AuthGuard], data: { roles: ['admin_mayorista'] } },
    ]
  },
  {
    path: 'minorista',
    component: Minorista,
    canActivate: [AuthGuard],
    data: { roles: ['vendedor_minorista'] },
    children: [
      { path: 'inicio', loadComponent: () => import('./pages/minorista/inicio/inicio').then(m => m.Inicio) },
      { path: 'seleccion/:viajeId', loadComponent: () => import('./pages/minorista/seleccion/seleccion').then(m => m.Seleccion) },
      { path: 'reserva', loadComponent: () => import('./pages/minorista/reserva/reserva').then(m => m.Reserva) },
      { path: 'confirmacion', loadComponent: () => import('./pages/minorista/confirmacion/confirmacion').then(m => m.Confirmacion) },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' }
    ]
  }
];