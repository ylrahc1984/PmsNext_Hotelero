export interface ReporteVentasIvaFiltros {
  Proceso         : number;
  FechaInicial    : string;
  FechaFinal      : string;
  Moneda          : string;
}

export interface ReporteVentasIvaRow {
  fecha           : string;
  tDoc            : string;
  nDocumento      : string;
  codCliente      : string;
  nomClien        : string;
  exento          : number;
  subtotaL_1      : number;
  imP_1           : number;
  subtotaL_2      : number;
  imP_2           : number;
  subtotaL_4      : number;
  imP_4           : number;
  subtotaL_13     : number;
  imP_13          : number;
  exoneracion     : number;
  total           : number;
  tcambio         : number;
  moneda          : string;
}
