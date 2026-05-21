export interface ComisionLog {
  AD24_Id?: number;
  AD24_Fecha?: string;
  AD24_Operador?: string;
  AD24_Accion?: string;
  AD24_TablaAfectada?: string;
  AD24_RegistroId?: number | string;
  AD24_Cambios?: string;
  AD24_ValorAnterior?: string;
  AD24_ValorNuevo?: string;
  [key: string]: unknown;
}
