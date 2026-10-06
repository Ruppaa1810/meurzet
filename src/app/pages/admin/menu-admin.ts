import type { UserRole } from '../../models/database.types';

export interface SeccionAdmin {
  ruta: string;
  titulo: string;
  descripcion: string;
  roles: UserRole[];
  icono: string[];
}

const STAFF: UserRole[] = ['admin_mayorista', 'operador_admin'];
const ADMIN: UserRole[] = ['admin_mayorista'];

// Lo usan el menú lateral y los accesos rápidos del panel, así siempre muestran lo mismo
export const SECCIONES_ADMIN: SeccionAdmin[] = [
  {
    ruta: 'validaciones', titulo: 'Validaciones', descripcion: 'Revisar comprobantes de pago', roles: STAFF,
    icono: ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
  },
  {
    ruta: 'flota', titulo: 'Flota', descripcion: 'Unidades y planos de asientos', roles: STAFF,
    icono: ['M8 17a2 2 0 11-4 0 2 2 0 014 0zM20 17a2 2 0 11-4 0 2 2 0 014 0z', 'M4 17h2m10 0h2a2 2 0 002-2v-3a2 2 0 00-2-2h-3V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h6m2 0h2'],
  },
  {
    ruta: 'viajes', titulo: 'Viajes', descripcion: 'Crear y editar viajes', roles: STAFF,
    icono: ['M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z', 'M15 11a3 3 0 11-6 0 3 3 0 016 0z'],
  },
  {
    ruta: 'auditoria', titulo: 'Auditoría', descripcion: 'Actividad de los usuarios', roles: ADMIN,
    icono: ['M15 12a3 3 0 11-6 0 3 3 0 016 0z', 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'],
  },
  {
    ruta: 'minoristas', titulo: 'Minoristas', descripcion: 'Vendedores y usuarios', roles: STAFF,
    icono: ['M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
  },
  {
    ruta: 'comisiones', titulo: 'Comisiones', descripcion: 'Porcentajes y pagos a vendedores', roles: ADMIN,
    icono: ['M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
  },
  {
    ruta: 'lugares-embarque', titulo: 'Lugares de Embarque', descripcion: 'Dónde suben los pasajeros', roles: STAFF,
    icono: ['M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6'],
  },
  {
    ruta: 'configuracion', titulo: 'Datos de pago', descripcion: 'Cuenta bancaria y contacto', roles: ADMIN,
    icono: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  },
  {
    ruta: 'perfil', titulo: 'Mi cuenta', descripcion: 'Tus datos y contraseña', roles: STAFF,
    icono: ['M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'],
  },
];

export function seccionesPara(rol: UserRole | undefined): SeccionAdmin[] {
  return rol ? SECCIONES_ADMIN.filter(s => s.roles.includes(rol)) : [];
}
