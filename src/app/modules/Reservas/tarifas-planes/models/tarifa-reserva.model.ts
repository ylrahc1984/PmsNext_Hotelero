export interface TarifaReservaResponse {
  MR03_CodTarifa: string;
  MR03_NomTarifa: string;
  MR03_Moneda: string;
  MR03_FecInicial: string;
  MR03_FecFin: string;
  MR03_Activo: number;
  MR03_Operador: string;
}

export interface TarifaReservaRequest {
  proceso: number;
  codigo: string;
  descripcion: string;
  moneda: string;
  fechaInicial: string;
  fechaFin: string;
  activo: number;
  operador: string;
  respuesta: string;
}
