export type EstadoComision = 'PENDIENTE' | 'LIQUIDADO' | 'PAGADO' | 'ANULADO' | 'BORRADOR' | 'CERRADO' | string;
export type PrioridadComision = 'ALTA' | 'MEDIA' | 'BAJA' | number | string;

export interface FiltroFinanciero {
  busqueda: string;
  estado: string;
  desde: string;
  hasta: string;
  agencia: string;
  servicio: string;
}
