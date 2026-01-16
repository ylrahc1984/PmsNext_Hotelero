export interface CentroCostoUI {
  codGrupo: string;
  descripcion: string;
  impuesto: number;
  orden: number;
  tcCto: string;
  operador?: string;
  impuestoValor?: number;
}

export interface CentroCostoApi {
  CA10_CodCCto: string;
  CA10_CentroCosto: string;
  CA10_Impuesto: number;
  CA10_Orden: number;
  CA10_TipCCto: string;
  CA10_Operador: string;
  Impuesto?: number;
  respuesta?: string;
}

export interface CentroCostoPayload {
  proceso: number;
  codGrupo: string;
  descripcion: string;
  impuesto: number;
  orden: number;
  tcCto: string;
  operador: string;
  respuesta: string;
}

export interface CentroCostoResponse {
  respuesta?: string;
}

export interface CentroCostoPagination {
  totalRegistros: number;
  paginaActual: number;
  totalPaginas: number;
}

export interface CentroCostoListResponse {
  datos: CentroCostoApi[];
  paginacion: CentroCostoPagination;
}
