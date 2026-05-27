export interface ComisionPreviewRow {
  OrigenDocumento             : string;
  TipoDocumento               : string;
  SerieDocumento              : string;
  NumeroDocumento             : string;
  FechaDocumento              : string;
  CodReserva                  : string;
  CodAgencia                  : string;
  NomAgencia                  : string;
  PRV02_ID                    : number;
  CodServicio                 : string;
  NomServicio                 : string;
  TipoPax                     : string;
  CantidadPax                 : number;
  Moneda                      : string;
  TipoCambio                  : number;
  MontoBase                   : number;
  TipoComision                : string;
  ValorComision               : number;
  PorcentajeAplicado          : number;
  MontoComision               : number;
  ReglaId                     : number;
  PrioridadRegla              : number;
  TipoRelacionReserva         : string;
  EstadoDocumento             : string;
  FormaPago                   : string;
}

export interface ComisionPreviewResumen {
  totalRegistros        : number;
  totalMontoBase        : number;
  totalMontoComision    : number;
}

export interface ComisionPreviewResponse {
  datos     : ComisionPreviewRow[];
  resumen   : ComisionPreviewResumen;
}

export interface ComisionPreviewParams {
  empresaId         : number;
  fechaInicio       : string;
  fechaFin          : string;
  operador          : string;
  codAgencia        ?: string;
}
