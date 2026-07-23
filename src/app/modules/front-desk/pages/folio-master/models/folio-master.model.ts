export interface FolioMaster {
  PRV09_NumFolio: string;
  PRV09_CodReserva: string;
  PRV09_CodAgen: string;
  PRV09_DesAgen: string;
  PRV09_CodTarifa: string;
  PRV09_CodPlan: string;
  PRV09_FechaIng: string;
  PRV09_FechaSal: string;
  PRV09_Noches: number;
  PRV09_NumPax: number;
  PRV09_TarxNoc: number;
  PRV09_MonedaTar: string;
  PRV09_Estado: number;
  PRV09_Operador: string;
  PRV01_CodReserva: string;
  PRV01_CodAgencia: string;
  PRV01_CodTarifa: string;
  PRV01_CodPlan: string;
  PRV01_FecIngresa: string;
  PRV01_FecSalida: string;
  PRV01_FecCreacion: string;
  PRV01_FecConfirma: string;
  PRV01_FecPrepago: string;
  PRV01_FecAnulada: string;
  PRV01_TotNoches: number;
  PRV01_TotDias: number;
  PRV01_Descripcion: string;
  PRV01_TCambio: number;
  PRV01_Folio: string;
  PRV01_Estado: string;
  PRV01_Moneda: string;
  PRV01_TotalRsv: number;
  PRV01_Observacion: string;
  PRV01_Procesado: number;
  PRV01_Directo: string;
  PRV01_Operador: string;
  PRV01_CntHabitaciones: number;
  PRV01_CodCliente: Record<string, unknown> | null;
  PRV01_CodCHM: Record<string, unknown> | null;
  PRV01_Prepago: Record<string, unknown> | null;
}

export interface FolioMasterStatus {
  value: number;
  label: string;
  helper: string;
}
