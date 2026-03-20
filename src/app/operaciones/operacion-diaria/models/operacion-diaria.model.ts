export interface OperacionDiariaResponse {
  totalRegistros          : number;
  bloques                 : BloqueHora[];
  totalesGenerales        : TotalesGenerales;
  resumenActividadPorHora : ResumenActividadHora[];
}

export interface BloqueHora {
  bloqueHora    : string;
  totalesHora   : TotalesHora;
  detalles      : OperacionDetalle[];
}

export interface TotalesHora {
  totalHora         : number;
  paxHora           : number;
  cantidadServicios : number;
}

export interface TotalesGenerales {
  totalGeneral    : number;
  totalPaxGeneral : number;
  totalServicios  : number;
}

export interface OperacionDetalle {
  prV02_ID                : number;
  prV02_CodReserva        : string;
  prV02_FecServicio       : string;
  prV02_HoraServicio      : string;
  codAgencia              : string;
  agencia                 : string;
  cliente                 : string;
  lugarPickup             : string;
  formaPago               : string;
  planTarifa              : string;
  tipoTarifa              : string;
  totalServicio           : number;
  estado                  : string;
  procesado               : number | boolean | null;
  facturado               : 0 | 1;
  totalPax                : number;
  codServicio             : string;
  nomServicio             : string;
  observacion             : string;
  chofer                  : string | null;
  usuario                 : string;
  observacionOperacion    : string | null;
}

export interface ResumenActividadHora {
  bloqueHora          : string;
  codServicio         : string;
  nomServicio         : string;
  totalActividadHora  : number;
  paxActividadHora    : number;
  cantidadServicios   : number;
}

export interface ActualizarObservacionOperacionPayload {
  codReserva        : string;
  nuevaObservacion  : string;
  usuario           : string;
  resultado         : string;
}

export interface ActualizarObservacionOperacionResponse {
  mensaje     : string;
  exito       : boolean;
}
