export interface TipoClienteDto {
  CPV00_Codigo: string;
  CPV00_Descripcion: string;
  CPV00_Operador: string;
}

export interface TipoClientePost {
  proceso: number;
  codTipo: string;
  tipoCliente: string;
  operador: string;
  respuesta: string;
}

export interface TipoClienteResponse {
  respuesta?: string;
}
