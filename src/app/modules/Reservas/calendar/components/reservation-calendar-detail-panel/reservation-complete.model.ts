export type ReservationCompleteRecord = Record<string, unknown>;

export interface ReservationCompleteResponse {
  encabezado: ReservationCompleteRecord | null;
  detalleHabitaciones: ReservationCompleteRecord[];
  serviciosIncluidos: ReservationCompleteRecord[];
  serviciosAdicionales: ReservationCompleteRecord[];
  desgloseHabitaciones: ReservationCompleteRecord[];
}

export interface ReservationCompleteDisplayEntry {
  key: string;
  label: string;
  value: string;
  wide: boolean;
}
