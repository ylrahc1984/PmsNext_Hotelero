export interface DocumentoFacturadoApi {
  tipoDocu: string;
  serie?: string;
  serieDocu?: string;
  numDocu: string;
  numeroConsecutivo: string;
  rucCliente: string;
  nomCliente: string;
  fechaDocu: string;
  subTotal: number;
  descuento: number;
  neto: number;
  impuesto: number;
  exonerado: number;
  totalDocu: number;
  moneda: string;
  estDocu: string;
  frmPago: string;
  operador: string;
  habitacion: string;
  codReserva: string;
  propinas: number;
  numPax: string;
  nc: string;
  xmlRespuesta: string;
  codCliente: string;
  tCambio: number;
  clave: string;
  tDocFE: string;
  pntVenta: string;
}

export interface Documento extends DocumentoFacturadoApi {
  // Alias de compatibilidad usados por detalle, impresión y nota de crédito.
  PPV00_TipoDocu: string;
  PPV00_Serie: string;
  PPV00_NumDocu: string;
  PPV00_FechaDocu: string;
  PPV00_NomCliente: string;
  PPV00_TotalDocu: number;
  PPV00_TotalPago: number;
  PPV00_EstadoDocumento: string;
  PPV15_EstadoElectronico: string;
  PPV00_Moneda: string;
  PPV00_UsuarioCreacion: string;
}

export interface DocumentosFacturadosPaginacion {
  paginaActual: number;
  tamanoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  tienePaginaAnterior: boolean;
  tienePaginaSiguiente: boolean;
}

export interface DocumentosFacturadosApiResponse {
  documentos?: DocumentoFacturadoApi[];
  paginacion?: Partial<DocumentosFacturadosPaginacion>;
  mensaje?: string;
}

export interface ConsultaDocumentosResponse {
  documentos: Documento[];
  paginacion: DocumentosFacturadosPaginacion;
  mensaje: string;
}

export interface ConsultaDocumentosFiltros {
  proceso: number;
  fechaDocu: string;
  fechaPago: string;
  fechaVen?: string;
  operador: string;
  tipDocu?: string;
  serieDocu?: string;
  numDocu?: string;
  codReserva?: string;
  codCliente?: string;
  nomClie?: string;
  pntVenta?: string;
  pageNumber: number;
  pageSize: number;
}
