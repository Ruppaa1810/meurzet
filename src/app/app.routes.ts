import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Admin } from './pages/admin/admin';
import { Mayorista } from './pages/mayorista/mayorista';
import { Minorista } from './pages/minorista/minorista';

export const routes: Routes = [

  {
    path: '',
    component: Login
  },

  {
    path: 'admin',
    component: Admin
  },

  {
    path: 'mayorista',
    component: Mayorista
  },

  {
    path: 'minorista',
    component: Minorista
  }

];