export interface ConfigComisionEmpresa {
  proceso?: number;
  aD14_EmpresaId?: number;
  aD14_Activo?: boolean;
  aD14_TipoCorte?: string;
  aD14_DiaCorte?: number;
  aD14_RequiereFacturaPagada?: boolean;
  aD14_BaseCalculo?: string;
  aD14_IncluyeImpuestos?: boolean;
  aD14_PermiteLiquidacionParcial?: boolean;
  aD14_MonedaBase?: string;
  aD14_Operador?: string;
  [key: string]: unknown;
}

export interface AgenciaComision {
  aD15_Id: number;
  aD15_EmpresaId: number;
  aD15_CodAgencia: string;
  MPV00_NomClien?: string;
  aD15_Comisiona: boolean;
  aD15_TipoComisionDefault: string;
  aD15_ValorDefault: number;
  aD15_FechaInicio: string;
  aD15_FechaFin: string;
  aD15_Activo: boolean;
  aD15_Observaciones: string;
  aD15_Operador: string;
}

export type AgenciaComisionPayload = AgenciaComision & { proceso: number };

export interface AgenciaComisionResponse {
  mensaje: string;
}

export interface ServicioComisionable {
  AD16_Id: number;
  AD16_EmpresaId: number;
  AD16_CodServicio: string;
  AD16_NombreServicio?: string;
  AD16_Comisionable: boolean;
  AD16_PermiteOverride: boolean;
  AD16_Activo: boolean;
  AD16_Observaciones: string;
  AD16_Operador: string;
  AD16_FechaRegistro: string;
}

export interface ServicioComisionablePayload {
  proceso: number;
  aD16_Id: number;
  aD16_EmpresaId: number;
  aD16_CodServicio: string;
  aD16_Comisionable: boolean;
  aD16_PermiteOverride: boolean;
  aD16_Activo: boolean;
  aD16_Observaciones: string;
  aD16_Operador: string;
}

export interface ServicioComisionableResponse {
  mensaje: string;
}
