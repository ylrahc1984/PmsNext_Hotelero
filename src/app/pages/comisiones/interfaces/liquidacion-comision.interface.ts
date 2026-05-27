export interface LiquidacionComision {
  AD22_Id?: number;
  AD22_NumeroLiquidacion?: string;
  AD22_AgenciaId?: number;
  AD22_NombreAgencia?: string;
  AD22_FechaInicio?: string;
  AD22_FechaFin?: string;
  AD22_FechaLiquidacion?: string;
  AD22_Moneda?: string;
  AD22_Subtotal?: number;
  AD22_Impuestos?: number;
  AD22_Total?: number;
  AD22_Estado?: string;
  AD22_Observaciones?: string;
  [key: string]: unknown;
}

export interface LiquidacionResumen {
  AD19_Id: string;
  AD19_EmpresaId: number;
  AD19_CodAgencia: string;
  AD19_NomAgencia: string;
  AD19_FechaInicio: string;
  AD19_FechaFin: string;
  AD19_FechaLiquidacion: string;
  AD19_TotalFacturado: number;
  AD19_TotalComision: number;
  AD19_Estado: string;
  AD19_Observaciones?: string;
  AD19_Operador: string;
  TotalLineas: number;
  TotalDocumentos: number;
  TotalReservas: number;
  TotalPax: number;
}

export interface LiquidacionCabecera {
  AD19_Id: string;
  AD19_EmpresaId: number;
  AD19_CodAgencia: string;
  AD19_NomAgencia: string;
  AD19_FechaInicio: string;
  AD19_FechaFin: string;
  AD19_FechaLiquidacion: string;
  AD19_TotalFacturado: number;
  AD19_TotalComision: number;
  AD19_Estado: string;
  AD19_Observaciones?: string;
  AD19_Operador: string;
}

export interface LiquidacionDetalleLinea {
  AD20_Id: number;
  AD20_LiquidacionId: string;
  AD20_TipoDocumento: string;
  AD20_SerieDocumento: string;
  AD20_NumeroDocumento: string;
  AD20_FechaDocumento: string;
  AD20_CodReserva: string;
  AD20_CodServicio: string;
  AD20_NomServicio: string;
  AD20_TipoPax: string;
  AD20_CantidadPax: number;
  AD20_MontoBase: number;
  AD20_TipoComision: string;
  AD20_ValorComision: number;
  AD20_PorcentajeAplicado: number;
  AD20_MontoComision: number;
  AD20_Estado: string;
  AD20_FormaPago: string;
  AD20_FechaRegistro: string;
}

export interface LiquidacionDetalleResponse {
  cabecera: LiquidacionCabecera;
  detalle: LiquidacionDetalleLinea[];
}

export interface LiquidacionListFilters {
  empresaId?: number;
  agencia?: string;
  estado?: string;
  fechaInicio?: string;
  fechaFin?: string;
  busqueda?: string;
}

export interface LiquidacionDetalle {
  AD23_Id?: number;
  AD23_LiquidacionId?: number;
  AD23_ComisionCalculadaId?: number;
  AD23_DocumentoId?: number;
  AD23_NumeroDocumento?: string;
  AD23_NombreServicio?: string;
  AD23_MontoBase?: number;
  AD23_MontoComision?: number;
  AD23_Estado?: string;
  [key: string]: unknown;
}

export interface LiquidacionTotales {
  totalDocumentos?: number;
  montoBase?: number;
  montoComision?: number;
  impuestos?: number;
  total?: number;
  [key: string]: unknown;
}

export interface LiquidacionComisionRequest {
  proceso?: number;
  aD19_Id?: string | null;
  aD19_EmpresaId: number;
  aD19_CodAgencia: string;
  aD19_NomAgencia: string;
  aD19_FechaInicio: string;
  aD19_FechaFin: string;
  aD19_TotalFacturado: number;
  aD19_TotalComision: number;
  aD19_MonedaBase?: string;
  aD19_Estado?: string;
  aD19_Observaciones?: string;
  aD19_Operador: string;
  detalle: LiquidacionComisionDetalleRequest[];
}

export interface LiquidacionComisionDetalleRequest {
  tipoDocumento: string;
  serieDocumento: string;
  numeroDocumento: string;
  fechaDocumento: string;
  codReserva: string;
  codServicio: string;
  nomServicio: string;
  tipoPax: string;
  cantidadPax: number;
  montoBase: number;
  tipoComision: string;
  valorComision: number;
  porcentajeAplicado: number;
  montoComision: number;
  estado: string;
  formaPago: string;
}
