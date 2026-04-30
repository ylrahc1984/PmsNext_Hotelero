export type CierreCajaEstado = 'ABIERTO' | 'CERRADO' | 'ANULADO';

export interface CierreCajaLinea {
  orden: number;
  frmPago: string;
  descripcion: string;
  tipoPago: string;
  montoSistema: number;
  montoDeclarado: number;
  diferencia: number;
}

export interface CierreCajaRecord {
  id: string;
  usuario: string;
  operador: string;
  pntVenta: string;
  caja: string;
  turno: string;
  fecha: string;
  horaApertura: string;
  horaCierre: string;
  montoApertura: number;
  estado: CierreCajaEstado;
  observaciones: string;
  lineas: CierreCajaLinea[];
  totalSistema: number;
  totalDeclarado: number;
  diferenciaTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CierreCajaListFilters {
  fecha?: string;
  estado?: string;
  pntVenta?: string;
  usuario?: string;
}

export interface ReporteCierreEncabezado {
  numCierre: string;
  fecha: string;
  hora: string;
  pntVenta: string;
  usuario: string;
  fondoCaja: number;
}

export interface CierreCajaReporteEncabezado {
  numCierre: string;
  fechaApertura: string;
  horaApertura: string;
  fechaCierre: string;
  puntoVenta: string;
  tipoCierre: string;
  usuario: string;
  fondoCaja: number;
}

export interface CierreCajaDocumento {
  tipoDocumento: string;
  serie: string;
  numeroDocumento: string;
  fechaDocumento: string;
  hora: string;
  codCliente: string;
  rucCliente: string;
  nombreCliente: string;
  numMesa: string;
  numPax: number;
  codMozo: string;
  moneda: string;
  tipoCambio: number;
  subTotal: number;
  descuento: number;
  neto: number;
  impuesto: number;
  exonerado: number;
  propinas: number;
  totalDocumento: number;
  totalPago: number;
  estado: string;
  usuarioCreacion: string;
}

export interface CierreCajaNotaPedido {
  tipoNDP: string;
  serieNDP: string;
  numeroNDP: string;
  puntoVenta: string;
  fechaDocumento: string;
  hora: string;
  codVendedor: string;
  codCliente: string;
  rucCliente: string;
  nombreCliente: string;
  direccionCliente: string;
  moneda: string;
  tipoCambio: number;
  exonerado: number;
  subTotal: number;
  impuesto: number;
  totalDocumento: number;
  totalPago: number;
  estadoDocumento: string;
  cantidadItems: number;
  numReferencia: string;
  observaciones: string;
  operador: string;
}

export interface CierreCajaFormaPagoReporte {
  codFormaPago: string;
  descFormaPago: string;
  moneda: string;
  monto: number;
}

export interface CierreCajaDenominacionReporte {
  numCierre: string;
  codDenominacion: string;
  denominacion: string;
  moneda: string;
  cantidad: number;
  totalMonedaNacional: number;
  totalMonedaExtranjera: number;
}

export interface CierreCajaResumenFormaPago {
  numCierre: string;
  codFormaPago: string;
  descFormaPago: string;
  tipoFormaPago: string;
  medioPago: string;
  moneda: string;
  total: number;
  detalles: string;
}

export interface CierreCajaResumenReporte {
  totalVentasBruto: number;
  totalDescuentos: number;
  totalVentasNeto: number;
  totalImpuestos: number;
  totalVentasFinal: number;
  totalNotasCredito: number;
  totalNotasPedido: number;
  ventaNetaFinal: number;
  totalSoles: number;
  totalDolares: number;
  totalesPorFormaPago: Record<string, number>;
  cantidadFacturas: number;
  cantidadBoletas: number;
  cantidadNotasCredito: number;
  cantidadNotasPedido: number;
  totalDocumentos: number;
  totalEfectivoMN: number;
  totalEfectivoME: number;
  fondoCaja: number;
  efectivoEnCaja: number;
}

export interface CierreCajaReporteDetalle {
  encabezado: CierreCajaReporteEncabezado;
  documentos: CierreCajaDocumento[];
  notasCredito: CierreCajaDocumento[];
  formasPagoDocumentos: CierreCajaFormaPagoReporte[];
  denominaciones: CierreCajaDenominacionReporte[];
  resumenFormasPago: CierreCajaResumenFormaPago[];
  notasPedido: CierreCajaNotaPedido[];
  formasPagoNotasPedido: CierreCajaFormaPagoReporte[];
  resumen: CierreCajaResumenReporte;
  nombreEmpresa: string;
  rucEmpresa: string;
}

export interface CierreCajaUpsertInput {
  usuario: string;
  operador: string;
  pntVenta: string;
  caja: string;
  turno: string;
  fecha: string;
  horaApertura: string;
  horaCierre?: string;
  montoApertura: number;
  estado?: CierreCajaEstado;
  observaciones?: string;
  lineas: CierreCajaLinea[];
}

export interface Denominacion {
  orden: number;
  nombre: string;
  mon: string;
  valor: number;
  cantidad: number;
  totalMN: number;
  totalME: number;
  mp: number;
}

export interface DenominacionResumen {
  totalMonedaNacional: number;
  totalMonedaExtranjera: number;
  totalGeneral: number;
  denominaciones: Denominacion[];
}

export interface DenominacionBatchItem {
  id: number;
  cantidad: number;
  monPrincip: number;
}

export interface TmpFormaPago {
  frmPago: string;
  descripcion: string;
  moneda: string;
  total: number;
  valor: string;
}

export interface TmpFormaPagoPayload {
  proceso: number;
  codFrmPago: string;
  moneda: string;
  valor: number;
  operador: string;
  respuesta: string;
}

export interface EjecutarCierrePayload {
  nomTabla: string;
  fechaIng: string;
  pntVenta: string;
  fechaCie: string;
  concepto: string;
  fondo: number;
  usuario: string;
  usuCierre: string;
  respuesta: string;
}
