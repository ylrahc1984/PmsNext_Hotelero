export interface ActividadDto {
  MPV32_ID: number;
  MPV32_Cedula: string;
  MPV32_CodigoAMH: string;
  MPV32_NombreActividad: string;
  MPV32_Principal: number;
  MPV32_Operador: string;
}

export interface ActividadPost {
  proceso: number;
  id: number;
  cedula: string;
  codigoAMH: string;
  descripcion: string;
  principal: number;
  operador: string;
  respuesta: string;
}

export interface ActividadResponse {
  respuesta?: string;
}
