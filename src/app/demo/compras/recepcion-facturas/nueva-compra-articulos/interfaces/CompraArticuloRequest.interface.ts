import { CompraArticuloDetalle } from './CompraArticuloDetalle.interface';

export interface CompraArticuloRequest {
  proceso: number;
  tipDocu: string;
  fechaIngreso: string;
  moneda: string;
  tCambio: number;
  codProve: string;
  rucProve: string;
  nomProve: string;
  tipDocProve: string;
  serie: string;
  numFactura: string;
  fechaFactura: string;
  fechaVenci: string;
  totDeta: number;
  totNeto: number;
  exonera: number;
  subTotal: number;
  totImpu: number;
  totalDocu: number;
  totPago: number;
  docFlete: string;
  montoFlete: number;
  docPercep: string;
  montoPercep: number;
  frmPago: string;
  numOrdenCmp: string;
  operador: string;
  detalle: CompraArticuloDetalle[];
}
