export interface DetalleTarifaResponse {
  MR04_CodTarifa: string;
  MR04_CatHabita: string;
  MR04_TipHabita: string;
  MR04_NomHabita: string;
  MR04_Total: number;
  MR04_ImpInc: number;
  MR04_Area: string;
  MR04_Operador: string;
}

export interface DetalleTarifaRequest {
  proceso: number;
  codigo: string;
  categoriaHabitacion: string;
  tipoHabitacion: string;
  descripcion: string;
  precio: number;
  impuestoIncluido: number;
  centroCosto: string;
  operador: string;
  respuesta: string;
}
