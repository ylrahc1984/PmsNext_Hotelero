export interface ProduccionAgenciaResumen {
  reservasBrutas: number;
  reservasVigentes: number;
  reservasCanceladas: number;
  habitacionesBrutas: number;
  habitacionesVigentes: number;
  habitacionesCanceladas: number;
  roomNightsBrutos: number;
  roomNightsVigentes: number;
  roomNightsCancelados: number;
  roomNightsCHK: number;
  roomNightsCCR: number;
  roomNightsABI: number;
  roomNightsWLT: number;
  roomNightsANU: number;
  totalAdultos: number;
  totalNinos: number;
  totalHuespedes: number;
  porcentajeCancelacionReservas: number;
  porcentajeCancelacionHabitaciones: number;
  porcentajeCancelacionRoomNights: number;
}

export interface ProduccionAgenciaDetalle {
  codAgencia: string;
  nomAgencia: string;
  reservasBrutas: number;
  reservasVigentes: number;
  reservasCanceladas: number;
  habitacionesBrutas: number;
  habitacionesVigentes: number;
  habitacionesCanceladas: number;
  roomNightsBrutos: number;
  roomNightsVigentes: number;
  roomNightsCancelados: number;
  roomNightsCHK: number;
  roomNightsCCR: number;
  roomNightsABI: number;
  roomNightsWLT: number;
  roomNightsANU: number;
  totalAdultos: number;
  totalNinos: number;
  totalHuespedes: number;
  estanciaPromedio: number;
  habitacionesPorReserva: number;
  paxPorHabitacion: number;
  porcentajeCancelacionReservas: number;
  porcentajeCancelacionHabitaciones: number;
  porcentajeCancelacionRoomNights: number;
  porcentajeParticipacion: number;
}

export interface ProduccionAgenciaData {
  fechaInicio: string;
  fechaFin: string;
  resumen: ProduccionAgenciaResumen;
  agencias: ProduccionAgenciaDetalle[];
}

export interface ProduccionAgenciaResponse {
  success: boolean;
  message: string;
  data: ProduccionAgenciaData;
}

export interface ProduccionAgenciaFilters {
  fechaInicio: string;
  fechaFin: string;
}
