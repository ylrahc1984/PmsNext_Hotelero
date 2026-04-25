import type { FormArray, FormControl, FormGroup } from '@angular/forms';

export type DetalleForm = {
  reglaPrecioId       : FormControl<number>;
  orden               : FormControl<number>;
  fechaConsumo        : FormControl<string>;
  lstPrecio           : FormControl<string>;
  planTarifa          : FormControl<string>;
  codProdu            : FormControl<string>;
  areaProdu           : FormControl<string>;
  descripcion         : FormControl<string>;
  cantidad            : FormControl<number>;
  uMedida             : FormControl<string>;
  pUndLst             : FormControl<number>;
  uniSinImp           : FormControl<number>;
  porDescu            : FormControl<number>;
  porImp              : FormControl<number>;
  porExonera          : FormControl<number>;
  mtoImpVarios        : FormControl<number>;
  saldoPendiente      : FormControl<number>;
  almacen             : FormControl<string>;
  area                : FormControl<string>; //Lista de Precios
  tipComanda          : FormControl<string>;
  comanda             : FormControl<string>;
  pntVenta            : FormControl<string>;
  mozo                : FormControl<string>;
  numHabita           : FormControl<string>;
};

export type PagoForm = {
  orden           : FormControl<number>;
  frmPago         : FormControl<string>;
  tipo            : FormControl<string>;
  tCambio         : FormControl<number>;
  monto           : FormControl<number | string>;
  moneda          : FormControl<string>;
  referencia      : FormControl<string>;
  numTarjeta      : FormControl<string>;
  vencimiento     : FormControl<string>;
};

export type NuevaFacturaForm = {
  tipDocu               : FormControl<string>;
  codCliente            : FormControl<string>;
  rucCliente            : FormControl<string>;
  nomCliente            : FormControl<string>;
  correoCliente         : FormControl<string>;
  codReserva            : FormControl<string>;
  fechaInicio           : FormControl<string>;
  fechaFin              : FormControl<string>;
  voucherRsv            : FormControl<string>;
  nProveedor            : FormControl<string>;
  habitacion            : FormControl<string>;
  master                : FormControl<string>;
  fechaDocu             : FormControl<string>;
  pntVenta              : FormControl<string>;
  numMesa               : FormControl<string>;
  numPax                : FormControl<number>;
  codVendedor           : FormControl<string>;
  condicionVenta        : FormControl<string>;
  moneda                : FormControl<string>;
  codigoActividad       : FormControl<string>;
  observacion           : FormControl<string>;
  planTarifario         : FormControl<string>;
  listaPrecio           : FormControl<string>;
  tCambio               : FormControl<number>;
  operador              : FormControl<string>;
  respuesta             : FormControl<string>;
  serie                 : FormControl<string>;
  numero                : FormControl<string>;
  detalle               : FormArray<FormGroup<DetalleForm>>;
  pagos                 : FormArray<FormGroup<PagoForm>>;
};

export interface LineaCalculo {
  subtotal    : number;
  descuento   : number;
  base        : number;
  impuesto    : number;
  total       : number;
}

export interface TotalesResumen {
  subtotal    : number;
  descuento   : number;
  impuesto    : number;
  total       : number;
}

export interface ConfirmarFacturaResponse {
  serie     ?: string;
  numero    ?: string;
  mensaje   ?: string;
  respuesta ?: string;
  data?: {
    serie?: string;
    numero?: string;
  };
}

export interface DetalleFacturaPayload {
  orden             : number;
  fechaConsumo      : string;
  codProdu          : string;
  areaProdu         : string;
  descripcion       : string;
  cantidad          : number;
  uMedida           : string;
  pUndLst           : number;
  uniSinImp         : number;
  porDescu          : number;
  porImp            : number;
  porExonera        : number;
  mtoImpVarios      : number;
  almacen           : string;
  area              : string;
  tipComanda        : string;
  comanda           : string;
  pntVenta          : string;
  mozo              : string;
  numHabita         : string;
  lstPrecio         : string;
  planTarifa        : string;
}

export interface PagoFacturaPayload {
  orden         : number;
  frmPago       : string;
  tipo          : string;
  moneda        : string;
  monto         : number;
  tCambio       : number;
  referencia    : string;
  numTarjeta    : string;
  vencimiento   : string;
}

export interface ConfirmarFacturaPayload {
  tipDocu               : string;
  codCliente            : string;
  rucCliente            : string;
  nomCliente            : string;
  condicionVenta        : string;
  codReserva            : string;
  fechaInicio           : string;
  fechaFin              : string;
  voucherRsv            : string;
  nProveedor            : string;
  habitacion            : string;
  master                : string;
  fechaDocu             : string;
  pntVenta              : string;
  numMesa               : string;
  numPax                : number;
  codVendedor           : string;
  moneda                : string;
  tCambio               : number;
  codigoActividad       : string;
  observacion           : string;
  operador              : string;
  detalle               : DetalleFacturaPayload[];
  pagos                 : PagoFacturaPayload[];
  respuesta             : string;
  serie                 : string;
  numero                : string;
}
