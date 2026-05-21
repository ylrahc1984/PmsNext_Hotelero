export interface ComisionCalculada {
  AD21_Id?: number;
  AD21_DocumentoId?: number;
  AD21_TipoDocumento?: string;
  AD21_NumeroDocumento?: string;
  AD21_FechaDocumento?: string;
  AD21_AgenciaId?: number;
  AD21_NombreAgencia?: string;
  AD21_ServicioId?: number;
  AD21_NombreServicio?: string;
  AD21_MontoBase?: number;
  AD21_Porcentaje?: number;
  AD21_MontoComision?: number;
  AD21_Estado?: string;
  AD21_FechaCalculo?: string;
  [key: string]: unknown;
}
