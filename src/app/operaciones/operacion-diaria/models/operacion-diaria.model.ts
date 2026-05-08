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

export interface BloqueHoraAgrupado {
  bloqueHora          : string;
  totalesHora         : TotalesHora;
  reservas            : ReservaOperacionAgrupada[];
  cantidadReservas    : number;
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

export interface ServicioResumen {
  codServicio       : string;
  nomServicio       : string;
  paxTotal          : number;
}

export interface ReservaOperacionAgrupada {
  reservaKey                    : string;
  numeroReserva                 : string;
  fechaServicio                 : string;
  cliente                       : string;
  agencia                       : string;
  codAgencia                    : string;
  pickupPrincipal               : string;
  pickupReferencia              : string;
  usuarioResponsable            : string;
  servicios                     : ServicioResumen[];
  serviciosPreview              : ServicioResumen[];
  serviciosExtraCount           : number;
  cantidadServicios             : number;
  paxTotal                      : number;
  totalReserva                  : number;
  estadoOperacionLabel          : string;
  estadoOperacionBadge          : string;
  estadoFacturacionLabel        : string;
  estadoFacturacionBadge        : string;
  estadoTransporteLabel         : string;
  estadoTransporteBadge         : string;
  indicadorConChofer            : boolean;
  indicadorObservacionCliente   : boolean;
  indicadorObservacionOperacion : boolean;
  detallePrincipal              : OperacionDetalle;
  detalles                      : OperacionDetalle[];
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
