export interface ImpuestoUI {
  codigo: string;
  nombre: string;
  porcentaje: number;
  tipoImpu: string;
  grabado: number;
  orden: number;
  ctaContav: string;
  ctaContac: string;
  idTributacion: string;
  ctaRifa: string;
  operador?: string;
}

export interface ImpuestoApi {
  CA03_CodImpu: string;
  CA03_NomImpu: string;
  CA03_MtoImpu: number;
  CA03_Orden: number;
  CA03_TipoImp: string;
  CA03_Grabado: number;
  CA03_CtaContaV: string;
  CA03_CtaContaC: string;
  CA03_IdTributacion: string;
  CA03_CTarifa: string;
  CA03_Operador: string;
  respuesta?: string;
}

export interface ImpuestoPayload {
  tipo: number;
  codigo: string;
  nombre: string;
  porcentaje: number;
  ctaContav: string;
  ctaContac: string;
  tipoImpu: string;
  grabado: number;
  orden: number;
  idTributacion: string;
  ctaRifa: string;
  operador: string;
  respuesta: string;
}

export interface ImpuestoResponse {
  respuesta?: string;
}
