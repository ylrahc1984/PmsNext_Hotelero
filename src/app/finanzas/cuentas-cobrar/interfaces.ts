export type EstadoDocumentoFiltro = '' | 'C' | 'P';

export interface EstadoCuentaCliente {
  tipoDocu             : string;
  serie                : string;
  numDocu              : string;
  numeroConsecutivo   ?: string;
  fechaDocu            : string;
  codCliente           : string;
  nomCliente           : string;
  direccion            : string;
  totalDocu            : number;
  totalPago            : number;
  saldo                : number;
  moneda               : string;
  tCambio              : number;
  estadoElectronico    : string;
  codReserva           ?: string;
}

export interface EstadoCuentaResponse {
  data          : EstadoCuentaCliente[];
  pageNumber    : number;
  pageSize      : number;
  totalRecords  : number;
}

export interface EstadoCuentaQuery {
  fechaInicial        : string;
  fechaFinal          : string;
  codCliente          : string;
  estadoDocumento     : EstadoDocumentoFiltro;
  pageNumber          : number;
  pageSize            : number;
}
