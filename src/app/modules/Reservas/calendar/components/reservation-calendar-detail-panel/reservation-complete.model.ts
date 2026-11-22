export type ReservationCompleteRecord = Record<string, unknown>;

export interface ReservationCompleteContact {
  prV19_Nombre?: string | null;
  prV19_Email?: string | null;
  prV19_Telefono?: string | null;
}

export interface ReservationCompleteResponse {
  encabezado: ReservationCompleteRecord | null;
  contactos: ReservationCompleteContact[];
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
