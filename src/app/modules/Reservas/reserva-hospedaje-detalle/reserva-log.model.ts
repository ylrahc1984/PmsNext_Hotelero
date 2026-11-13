export interface ReservaLogEntry {
  id: number;
  codReserva: string;
  fecha: string;
  hora: string;
  detalle1: string;
  detalle2: string;
  operador: string;
}

export interface ReservaLogResponse {
  success: boolean;
  message: string;
  data: ReservaLogEntry[];
  totalRegistros: number;
}
