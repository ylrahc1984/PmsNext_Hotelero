export interface ContadorUI {
  codigo: string;
  descripcion: string;
  serie: number;
  contador: number;
  largo: number;
  auto: number;
  frmCod: number;
  operador?: string;
}

export interface ContadorApi {
  CA09_CodContador: string;
  CA09_Descripcion: string;
  CA09_Serie: number;
  CA09_Numero: number;
  CA09_Largo: number;
  CA09_Auto: number;
  CA09_AntCod: number;
  CA09_Operador: string;
  respuesta?: string;
}

export interface ContadorPayload {
  tipo: number;
  codigo: string;
  descripcion: string;
  serie: number;
  contador: number;
  largo: number;
  auto: number;
  frmCod: number;
  operador: string;
  respuesta: string;
}

export interface ContadorResponse {
  respuesta?: string;
}
