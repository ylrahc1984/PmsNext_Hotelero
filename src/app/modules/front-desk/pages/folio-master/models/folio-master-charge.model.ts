export interface FolioMasterChargeHeader {
  tipCrgHab: string;
  numCrgHab: string;
  codReserva: string;
  numHab: string;
  pntVenta: string;
  fecha: string;
  hora: string;
  numDocu: string;
  nombrePax: string;
  mtoTot: number;
  moneda: string;
  cierre: number | string;
  numCierre: number | string;
  estado: number | string;
  operador: string;
  folio: string;
}

export interface FolioMasterChargeLine {
  tipCrgHab: string;
  numCrgHab: string;
  codRsv: string;
  numHab: string;
  pntVenta: string;
  fecha: string;
  hora: string;
  grupo: string;
  categoria: string;
  codConsumo: string;
  nomConsumo: string;
  cantidad: number;
  subTotal: number;
  porDescuento: number;
  descuento: number;
  precioSinImpNeto: number;
  impuestos: number;
  precio: number;
  total: number;
  moneda: string;
  tipNPedido: string;
  numNPedido: string;
  codMozo: string;
  incluido: number | string;
  exonerado: number | string;
  orden: number;
  estado: number | string;
  comentario: string;
  precioLista: number;
  operador: string;
}

export interface FolioMasterChargeDetail {
  mensaje: string;
  encabezado: FolioMasterChargeHeader | null;
  detalles: FolioMasterChargeLine[];
}
