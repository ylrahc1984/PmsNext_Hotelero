export interface NotaCredito {
  PFD07_TipNotaCredito: string;
  PFD07_SerieNotaCredito: string;
  PFD07_NumNotaCredito: string;
  PFD07_FechaNotaCredito: string;
  PFD07_CodCliente: string;
  PFD07_NomCliente: string;
  MPV00_RucClien: string;
  PFD07_SubTotal: number;
  PFD07_Impuesto: number;
  PFD07_Total: number;
  PFD07_Moneda: string;
  TCambio: number;
  PFD07_Comentario: string;
  RN: number;
}

export interface Paginacion {
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
}

export interface NotaCreditoResponse {
  datos: NotaCredito[];
  paginacion: Paginacion;
}

export interface NotaCreditoDetalle {
  pfD08_TipNC: string;
  pfD08_SerieNC: string;
  pfD08_NumeroNC: string;
  pfD08_Codigo: string;
  pfD08_Articulo: string;
  pfD08_Almacen: string;
  pfD08_Cantidad: number;
  pfD08_UndMedida: string;
  pfD08_Exento: number;
  pfD08_SubTotal: number;
  pfD08_MtoIndi: number;
  pfD08_PorImpto: number;
  pfD08_MtoImpto: number;
  pfD08_Total: number;
  pfD08_Incluido: string;
  pfD08_Grabado: string;
  pfD08_Moneda: string;
  pfD08_Tcambio: number;
  pfD08_Orden: number;
  pfD08_PntVenta: string;
  pfD08_CCosto: string;
  pfD08_Operador: string;
}

export interface NotaCreditoRequest {
  proceso: number;
  tipNC: string;
  serieNC: string;
  numNC: string;
  fecha: string;
  fechaFin: string;
  motivoAnulacion?: string;
  observacion?: string;
  codCliente: string;
  nomCliente: string;
  tipDocCli: string;
  serieDocCli: string;
  numDocCli: string;
  nElectronico: string;
  total: number;
  moneda: string;
  tCambio: number;
  comentario: string;
  asiento: string;
  idNC: string;
  operador: string;
  detalle: NotaCreditoDetalle[];
}
