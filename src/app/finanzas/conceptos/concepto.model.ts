export interface Concepto {
  codConcepto: string;
  concepto: string;
  tipMov: string;
  cuenta?: string;
  descripcion?: string;
  operador: string;
  empresa: string;
}

export interface ConceptosResponse {
  totalRegistros: number;
  data: Concepto[];
}
