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
