export interface ReporteComprasIvaFiltros {
  fechaIngreso: string;
  fechaFactura: string;
  codProveedor: string;
  nomProveedor: string;
  rucProveedor: string;
}

export interface ReporteComprasIvaRow {
  PAC40_CodActividad: unknown;
  PAC40_RucProve: string;
  PAC40_NomProve: string;
  PAC40_NumFactura: string;
  PAC40_Fecha: string;
  PAC40_Moneda: string;
  PAC40_TCambio: number;
  SubTotal_Gravado_13: number;
  Impuesto_13: number;
  SubTotal_Gravado_4: number;
  Impuesto_4: number;
  SubTotal_Gravado_1: number;
  Impuesto_1: number;
  SubTotal_Gravado_0: number;
  SubTotal_Exento: number;
  Monto_Exonerado: number;
  Total_SubTotal_Factura: number;
  Total_Impuesto_Factura: number;
  Total_Factura: number;
}
