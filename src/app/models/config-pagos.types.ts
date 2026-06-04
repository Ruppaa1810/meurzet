export interface ConfigCuota {
  cuotas: number;
  recargo: number;
}

export interface ConfigPagos {
  opcionesCuotas: ConfigCuota[];
}
