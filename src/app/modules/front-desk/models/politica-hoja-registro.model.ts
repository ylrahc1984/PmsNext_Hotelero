export type RegistrationSheetLanguage = 'ES' | 'EN';

export interface PoliticaHojaRegistro {
  idPolitica: number;
  codigo: string;
  idioma: string;
  orden: number;
  texto: string;
  activo: boolean | null;
  fechaCreacion: string | null;
  operadorCreacion: string | null;
  fechaModificacion: string | null;
  operadorModificacion: string | null;
}

export interface PoliticasResponse {
  success: boolean;
  message: string;
  data: PoliticaHojaRegistro[];
}
