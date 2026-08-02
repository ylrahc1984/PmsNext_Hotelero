export interface RoomChargeDetailPayload {
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
  precio: number;
  total: number;
  moneda: string;
  tipNPedido: string;
  numNPedido: string;
  codMozo: string;
  incluido: number;
  exonerado: number;
  orden: number;
  comentario: string;
  operador: string;
}

export interface RoomChargePayload {
  proceso: number;
  tipCrgHab: string;
  numCrgHab: string;
  codRsv: string;
  numHab: string;
  pntVenta: string;
  fecha: string;
  hora: string;
  numDocu: string;
  nombrePax: string;
  mtoTotal: number;
  moneda: string;
  cierre: number;
  numCierre: number;
  operador: string;
  detalle: RoomChargeDetailPayload[];
}

export interface RoomChargeAnnulPayload {
  tipCrgHab: string;
  numCrgHab: string;
  codRsv: string;
  numHab: string;
  motivo: string;
  operador: string;
}

export interface MutableRoomChargeHeader {
  tipCrgHab: string;
  numCrgHab: string;
  codReserva: string;
  numHab: string;
  pntVenta: string;
  fecha: string;
  hora: string;
  numDocu: string;
  nombrePax: string;
  moneda: string;
  cierre: number | string;
  numCierre: number | string;
}

export interface MutableRoomChargeLine {
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
  precio: number;
  total: number;
  moneda: string;
  tipNPedido: string;
  numNPedido: string;
  codMozo: string;
  incluido: number | string;
  exonerado: number | string;
  orden: number;
  comentario: string;
}

export interface RoomChargeUpdateFallback {
  tipCrgHab?: string;
  numCrgHab?: string;
  codRsv?: string;
  numHab?: string;
  moneda?: string;
}
