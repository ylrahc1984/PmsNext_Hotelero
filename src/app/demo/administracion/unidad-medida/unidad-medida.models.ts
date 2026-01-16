export interface UnidadMedidaDto {
  CAC04_UnmMed: string;
  CAC04_Descripcion: string;
  CAC04_Operador: string;
}

export interface UnidadMedidaPost {
  proceso: number;
  codUMed: string;
  descripcion: string;
  operador: string;
  respuesta: string;
}

export interface UnidadMedidaResponse {
  respuesta?: string;
}
