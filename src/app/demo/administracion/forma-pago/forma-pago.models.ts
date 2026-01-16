export type TipoFrm = 'A' | 'V' | 'C';
export type TipoPago = 'CE' | 'CR' | 'PP' | 'TC';

export interface FormaPago {
  codigo: string;
  descripcion: string;
  tipoFrm: TipoFrm;
  tipoPago: TipoPago;
  nDias: number;
  orden: number;
}

export interface FormaPagoApi {
  CA05_Codigo: string;
  CA05_Descripcion: string;
  CA05_Tipo: TipoFrm;
  CA05_TipPago: TipoPago;
  CA05_NDias: number;
  CA05_Orden: number;
  CA05_IdTributacion?: string;
  CA05_IdMedioPago?: string;
  CA05_Operador?: string;
  respuesta?: string;
}

export interface FormaPagoResponse {
  respuesta?: string;
}

export interface FormaPagoPayload {
  proceso: number;
  codigo: string;
  descripcion: string;
  tipoFrm: TipoFrm;
  tipoPago: TipoPago;
  nDias: number;
  orden: number;
  operador: string;
  respuesta: string;
}
