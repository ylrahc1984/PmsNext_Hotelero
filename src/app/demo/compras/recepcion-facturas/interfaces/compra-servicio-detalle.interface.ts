export interface CompraServicioDetalleEncabezado {
  PAC00_TipDocu: string;
  PAC00_NumDocu: string;
  PAC00_TipEntra: string;
  PAC00_Fecha: string;
  PAC00_Moneda: string;
  PAC00_TCambio: number;
  PAC00_CodProve: string;
  PAC00_RucProve: string;
  PAC00_NomProve: string;
  PAC00_TipDocPrv: string;
  PAC00_Serie: string;
  PAC00_NumFactura: string;
  PAC00_FecFactu: string;
  PAC00_FecVen: string;
  PAC00_TotDeta: number;
  PAC00_Neto: number;
  PAC00_Exento: number;
  PAC00_SubTotal: number;
  PAC00_Impuesto: number;
  PAC00_TotalDocu: number;
  PAC00_TotPagado: number;
  PAC00_DocFlete: string;
  PAC00_MontoFlete: number;
  PAC00_DocPercep: string;
  PAC00_MontoPercep: number;
  PAC00_Estado: string;
  PAC00_FrmPago: string;
  PAC00_Concepto: string;
  PAC00_Asiento: string;
  PAC00_NumOrden: string;
  PAC00_Operador: string;
}

export interface CompraServicioDetalleLinea {
  PAC02_TipDocu: string;
  PAC02_NumDocu: string;
  PAC02_Fecha: string;
  PAC02_CodProdu: string;
  PAC02_Producto: string;
  PAC02_Cantidad: number;
  PAC02_Exento: number;
  PAC02_SubTotal: number;
  PAC02_PorImp: number;
  PAC02_Impuesto: number;
  PAC02_Total: number;
  PAC02_Moneda: string;
  PAC02_Grabado: string;
  PAC02_Tcambio: number;
  PAC02_Orden: number;
}

export interface CompraServicioPagoProveedor {
  PAC05_NumInterno: number;
  PAC05_IdOperacion: string;
  PAC05_TipDocu: string;
  PAC05_NumDocu: string;
  PAC05_TipoDocPrv: string;
  PAC05_SerieDocPrv: string;
  PAC05_NumFacturaPrv: string;
  PAC05_Fecha: string;
  PAC05_Hora: string;
  PAC05_TipoPago: string;
  PAC05_Moneda: string;
  PAC05_Monto: number;
  PAC05_TCambio: number;
  PAC05_Estado: string;
  PAC05_Descripcion: string;
  PAC05_Asiento: string;
  PAC05_Operador: string;
}

export interface CompraServicioDetalleData {
  encabezado: CompraServicioDetalleEncabezado;
  detalle: CompraServicioDetalleLinea[];
  pagosProveedor: CompraServicioPagoProveedor[];
}

export interface CompraServicioDetalleResponse {
  success: boolean;
  message?: string;
  data: CompraServicioDetalleData | null;
}
