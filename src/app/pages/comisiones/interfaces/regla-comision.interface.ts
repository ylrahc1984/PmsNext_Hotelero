export interface ReglaComision {
  AD17_Id: number;
  AD17_EmpresaId: number;
  AD17_CodAgencia: string;
  AD17_CodServicio: string;
  AD17_TipPax: string;
  AD17_TipoComision: string;
  AD17_ValorComision: number;
  AD17_Prioridad: number;
  AD17_FechaInicio: string;
  AD17_FechaFin: string;
  AD17_Activo: boolean;
  AD17_Observaciones: string;
  AD17_Operador: string;
  AD17_FechaRegistro: string;
}

export interface ReglaComisionPayload {
  proceso: number;
  aD17_Id: number;
  aD17_EmpresaId: number;
  aD17_CodAgencia: string;
  aD17_CodServicio: string;
  aD17_TipPax: string;
  aD17_TipoComision: string;
  aD17_ValorComision: number;
  aD17_Prioridad: number;
  aD17_FechaInicio: string;
  aD17_FechaFin: string;
  aD17_Activo: boolean;
  aD17_Observaciones: string;
  aD17_Operador: string;
  fechaOperacion: string;
}

export interface ReglaComisionResponse {
  mensaje: string;
}
