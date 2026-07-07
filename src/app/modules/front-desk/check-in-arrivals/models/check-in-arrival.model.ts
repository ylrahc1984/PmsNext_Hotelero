export interface CheckInArrival {
  numHabita: string;
  catHabita: string;
  tipHabita: string;
  codReserva: string;
  codTarifa: string;
  codPlan: string;
  descripcion: string;
  fechaIng: string;
  fechaSal: string;
  procesado: number;
  numPax: number;
  numChild: number;
  cpl: number;
  totNoches: number;
  totDias: number;
  folio: string;
  estado: string;
  codAgencia: string;
  nomAgencia: string;
  observacion: string;
}

export interface CheckInArrivalKpi {
  label: string;
  value: number;
  icon: string;
  accent: 'primary' | 'blue' | 'green' | 'amber' | 'burgundy' | 'muted';
}

export type CheckInArrivalSortColumn =
  | 'numHabita'
  | 'catHabita'
  | 'tipHabita'
  | 'codReserva'
  | 'nomAgencia'
  | 'descripcion'
  | 'fechaIng'
  | 'fechaSal'
  | 'totNoches'
  | 'numPax'
  | 'numChild'
  | 'codPlan'
  | 'estado';

export type CheckInArrivalSortDirection = 'asc' | 'desc';

