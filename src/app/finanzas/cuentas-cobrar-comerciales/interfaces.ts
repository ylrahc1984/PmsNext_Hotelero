export interface CuentaCobrarComercial {
  PPV05_TipNDP: string;
  PPV05_SerieNDP: string;
  PPV05_NumNDP: string;
  PPV05_FecDocu: string;
  PPV05_FechaVen: string;
  PPV05_CodVendedor: string;
  PPV05_CodCliente: string;
  PPV05_RucCliente: string;
  PPV05_NomCliente: string;
  PPV05_DirCliente: string;
  PPV05_Exonerado: number;
  PPV05_SubTotal: number;
  PPV05_Impuesto: number;
  PPV05_TotalDocu: number;
  PPV05_TotalPago: number;
  Saldo: number;
  PPV05_EstDocu: string;
  PPV05_Moneda: string;
  PPV05_TCambio: number;
  PPV05_Items: number;
  PPV05_NReferencia: string;
  PPV05_Observaciones: string;
  PPV05_Operador: string;
  PPV07_FrmPago: string;
  PPV07_Referencia: string;
  PPV07_Vencimiento: string;
}

export interface CuentasCobrarComercialesPaginacion {
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
}

export interface CuentasCobrarComercialesResponse {
  datos: CuentaCobrarComercial[];
  paginacion: CuentasCobrarComercialesPaginacion;
}

export interface CuentasCobrarComercialesQuery {
  fechaInicial: string;
  fechaFinal: string;
  pageNumber: number;
  pageSize: number;
}
