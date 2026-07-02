export interface RestaurantePedidoItem {
  codRsv        : string;
  numHab        : string;
  pntVenta      : string;
  fecha         : Date;
  hora          : string;
  grupo         : string;
  categoria     : string;
  codConsumo    : string;
  nomConsumo    : string;
  cantidad      : number;
  precio        : number;
  total         : number;
  moneda        : string;
  tipNPedido    : string;
  numNPedido    : string;
  codMozo       : string;
  pax           : number;
  modificar     : string;
  tiempo        : number;
  incluido      : number;
  exonerado     : number;
  orden         : number;
  comentario    : string;
  operador      : string;
  puestoMesa    : number;
  impuesto      ?: number;
}
