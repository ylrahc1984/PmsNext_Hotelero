export interface DashboardOperativoItem {
  Seccion: string;
  Indicador: string;
  SubIndicador: string;
  Valor: number | null;
  Unidad: string;
  EstadoDato: string;
  ReglaAplicada: string;
  FechaOperativa: string;
  GeneradoEn: string;
}

export type DashboardTone = 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'violet' | 'slate';

export interface DashboardMetricView {
  id: string;
  label: string;
  description: string;
  icon: string;
  tone: DashboardTone;
  rawValue: number | null;
  value: string;
  unit: string;
  state: string;
  rule: string;
  available: boolean;
}

export interface DashboardProcessColumnView {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: DashboardTone;
  metrics: DashboardMetricView[];
}

export interface DashboardProcessView {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  tone: DashboardTone;
  columns: DashboardProcessColumnView[];
  footers: DashboardMetricView[];
}

export interface DashboardAlertView {
  id: string;
  icon: string;
  title: string;
  detail: string;
  tone: 'critical' | 'warning' | 'notice' | 'success';
}

export interface DashboardForecastBarView {
  id: string;
  label: string;
  value: string;
  height: number;
}

export interface DashboardForecastView {
  bars: DashboardForecastBarView[];
  average: number | null;
  peak: number | null;
}

export interface DashboardHousekeepingView {
  pending: number;
  clean: number;
  inProgress: number;
  inspection: number;
  departuresToday: number;
  arrivals: number;
}
