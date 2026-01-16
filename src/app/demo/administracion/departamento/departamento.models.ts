export interface DepartamentoUI {
  idDepartamento: number;
  departamento: string;
  operador?: string;
}

export interface DepartamentoApi {
  MA02_IDDepartamento: number;
  MA02_Departamento: string;
  MA02_Operador: string;
  respuesta?: string;
}

export interface DepartamentoPayload {
  tipo: number;
  idDepartamento: number;
  departamento: string;
  operador: string;
  respuesta: string;
}

export interface DepartamentoResponse {
  respuesta?: string;
}
