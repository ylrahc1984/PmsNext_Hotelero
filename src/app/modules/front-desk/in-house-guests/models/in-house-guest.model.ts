export interface InHouseGuest {
  numHabita: string;
  paxIn: string;
  fechaIng: string;
  fechaSal: string;
  noches: number;
  desayuno: string;
  media: string;
  fullPen: string;
  numPax: number;
  numChild: number;
  varios: string;
  codReserva: string;
  nomAgencia: string;
}

export interface InHouseResponse {
  pax: InHouseGuest[];
  totalHabitaciones: number;
  totalAdultos: number;
  totalNinos: number;
  totalHuespedes: number;
  respuesta: string;
}

export interface InHouseKpi {
  label: string;
  value: number;
  icon: string;
  accent: 'primary' | 'blue' | 'green' | 'amber' | 'burgundy' | 'muted' | 'cyan';
}

export type InHouseSortColumn =
  | 'numHabita'
  | 'paxIn'
  | 'nomAgencia'
  | 'fechaIng'
  | 'fechaSal'
  | 'noches'
  | 'numPax'
  | 'numChild'
  | 'plan'
  | 'estado'
  | 'codReserva';

export type InHouseSortDirection = 'asc' | 'desc';
