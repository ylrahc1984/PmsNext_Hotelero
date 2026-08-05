export interface ReporteVentasIvaFiltros {
  fechaInicial : string;
  fechaFinal   : string;
  moneda       : string;
  pntVenta     : string;
}

export interface ReporteVentasIvaRow {
  fecha         : string;
  tDoc          : string;
  nDocumento    : string;
  codCliente    : string;
  nomClien      : string;
  exento        : number;
  subtotal      : number;
  imP_IVA       : number;
  imP_SRV       : number;
  exoneracion   : number;
  total         : number;
  tcambio       : number;
  moneda        : string;
}

export interface ReporteVentasIvaResumen {
  totalExento         : number;
  totalSubtotal       : number;
  totalIVA            : number;
  totalSRV            : number;
  totalExoneracion    : number;
  totalGeneral        : number;
  cantidadDocumentos  : number;
}

export interface ReporteVentasIvaResponse {
  detalle : ReporteVentasIvaRow[];
  resumen : ReporteVentasIvaResumen;
}

export const EMPTY_REPORTE_VENTAS_IVA_RESUMEN: ReporteVentasIvaResumen = {
  totalExento        : 0,
  totalSubtotal      : 0,
  totalIVA           : 0,
  totalSRV           : 0,
  totalExoneracion   : 0,
  totalGeneral       : 0,
  cantidadDocumentos : 0
};
