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
