export type FinancialReportCurrency = 'USD' | 'COL';

export interface FinancialSummary {
  fechaDesde: string;
  fechaHasta: string;
  moneda: FinancialReportCurrency;
  ingresoNeto: number;
  gastoNeto: number;
  resultadoOperativo: number;
  margenOperativoPorcentaje: number;
}

export interface RevenueCenter {
  codCentroCosto: string;
  centroCosto: string;
  cantidadLineas: number;
  cantidadDocumentos: number;
  ingresoNeto: number;
  participacionPorcentaje: number;
  moneda: FinancialReportCurrency;
}

export interface RevenueBySource {
  origen: string;
  cantidadDocumentos: number;
  ingresoNeto: number;
  impuesto: number;
  total: number;
  moneda: FinancialReportCurrency;
}

export interface ExpenseSummary {
  cantidadCompras: number;
  cantidadLineas: number;
  gastoNeto: number;
  impuesto: number;
  exoneracion: number;
  totalCompras: number;
  moneda: FinancialReportCurrency;
}

export interface DailyFinancialEvolution {
  fecha: string;
  ingresos: number;
  gastos: number;
  resultado: number;
  moneda: FinancialReportCurrency;
}

export interface ReporteFinancieroResponse {
  resumen: FinancialSummary;
  centrosIngreso: RevenueCenter[];
  ingresosPorOrigen: RevenueBySource[];
  resumenGastos: ExpenseSummary;
  evolucionDiaria: DailyFinancialEvolution[];
}

