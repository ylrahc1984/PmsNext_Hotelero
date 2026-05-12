export interface NotaCredito {
  PFD07_TipNotaCredito    : string;
  PFD07_SerieNotaCredito  : string;
  PFD07_NumNotaCredito    : string;
  PFD07_FechaNotaCredito  : string;
  PFD07_CodCliente        : string;
  PFD07_NomCliente        : string;
  MPV00_RucClien          : string;
  PFD07_SubTotal          : number;
  PFD07_Impuesto          : number;
  PFD07_Total             : number;
  PFD07_Moneda            : string;
  TCambio                 : number;
  PFD07_Comentario        : string;
  PFD07_Asiento           : string;
  PFD07_Operador          : string;
  PFD07_IdNC              : string;
  RN                      : number;
}

export interface Paginacion {
  totalRegistros  : number;
  paginaActual    : number;
  pageSize        : number;
}

export interface NotaCreditoResponse {
  datos     : NotaCredito[];
  paginacion: Paginacion;
}

export interface NotaCreditoDetalleResponse {
  encabezado?: NotaCreditoDetalleEncabezado[] | NotaCreditoDetalleEncabezado;
  detalle?: NotaCreditoDetalleLinea[];
  impuestos?: NotaCreditoDetalleImpuesto[];
  data?: NotaCreditoDetalleResponse;
  datos?: NotaCreditoDetalleResponse;
}

export interface NotaCreditoDetalleEncabezado {
  PFD07_TipNotaCredito?: string;
  PFD07_SerieNotaCredito?: string;
  PFD07_NumNotaCredito?: string;
  PFD07_FechaNotaCredito?: string;
  PFD07_CodCliente?: string;
  PFD07_NomCliente?: string;
  MPV00_RucClien?: string;
  PFD07_SubTotal?: number;
  PFD07_Impuesto?: number;
  PFD07_Total?: number;
  PFD07_Moneda?: string;
  TCambio?: number;
  PFD07_Comentario?: string;
  PFD07_Asiento?: string;
  PFD07_Operador?: string;
  PFD07_IdNC?: string;
  PFD07_TipDocCli?: string;
  PFD07_SerieDocCli?: string;
  PFD07_NumDocCli?: string;
  PFD07_NElectronico?: string;
}

export interface NotaCreditoDetalleLinea {
  PFD08_TipNC?: string;
  PFD08_SerieNC?: string;
  PFD08_NumeroNC?: string;
  PFD08_Codigo?: string;
  PFD08_Articulo?: string;
  PFD08_Almacen?: string;
  PFD08_Cantidad?: number;
  PFD08_UndMedida?: string;
  PFD08_Exento?: number;
  PFD08_SubTotal?: number;
  PFD08_MtoIndi?: number;
  PFD08_PorImpto?: number;
  PFD08_MtoImpto?: number;
  PFD08_Total?: number;
  PFD08_Incluido?: string;
  PFD08_Grabado?: string;
  PFD08_Moneda?: string;
  PFD08_Tcambio?: number;
  PFD08_Orden?: number;
  PFD08_PntVenta?: string;
  PFD08_CCosto?: string;
  PFD08_Operador?: string;
}

export interface NotaCreditoDetalleImpuesto {
  PFD09_Descripcion?: string;
  PFD09_PorImpu?: number;
  PFD09_Monto?: number;
}

export interface NotaCreditoDetalle {
  pfD08_TipNC       : string;
  pfD08_SerieNC     : string;
  pfD08_NumeroNC    : string;
  pfD08_Codigo      : string;
  pfD08_Articulo    : string;
  pfD08_Almacen     : string;
  pfD08_Cantidad    : number;
  pfD08_UndMedida   : string;
  pfD08_Exento      : number;
  pfD08_SubTotal    : number;
  pfD08_MtoIndi     : number;
  pfD08_PorImpto    : number;
  pfD08_MtoImpto    : number;
  pfD08_Total       : number;
  pfD08_Incluido    : string;
  pfD08_Grabado     : string;
  pfD08_Moneda      : string;
  pfD08_Tcambio     : number;
  pfD08_Orden       : number;
  pfD08_PntVenta    : string;
  pfD08_CCosto      : string;
  pfD08_Operador    : string;
}

export interface NotaCreditoRequest {
  proceso           : number;
  tipNC             : string;
  serieNC           : string;
  numNC             : string;
  fecha             : string;
  fechaFin          : string;
  motivoAnulacion   ?: string;
  observacion       ?: string;
  codCliente         : string;
  nomCliente         : string;
  tipDocCli          : string;
  serieDocCli        : string;
  numDocCli          : string;
  nElectronico       : string;
  total              : number;
  moneda             : string;
  tCambio            : number;
  comentario         : string;
  asiento            : string;
  idNC               : string;
  operador           : string;
  detalle            : NotaCreditoDetalle[];
}
