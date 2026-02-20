export interface Documento {
  PPV00_TipoDocu: string;
  PPV00_NumDocu: string;
  PPV00_FechaDocu: string;
  PPV00_NomCliente: string;
  PPV00_TotalDocu: number;
  PPV00_TotalPago: number;
  PPV00_EstadoDocumento: string;
  PPV15_EstadoElectronico: string;
  PPV00_Moneda: string;
}

export interface ConsultaDocumentosResponse {
  totalRegistros: number;
  detalle: Documento[];
}

export interface ConsultaDocumentosFiltros {
  tipoDocu?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  nombreCliente?: string;
  condicionVenta?: string;
  estadoDocu?: string;
  pageNumber: number;
  pageSize: number;
}
