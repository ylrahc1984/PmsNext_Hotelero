export interface ListaPrecioDto {
  MPV04_CodLstPrecio: string;
  MPV04_DesLstPrecio: string;
  MPV04_Moneda: string;
  MPV04_Simbolo: string;
  MPV04_Vigente: string;
  MPV04_FechaDesde: string;
  MPV04_FechaHasta: string;
  MPV04_Observaciones: string;
  NombrePlan: string;
  MPV04_Operador: string;
}

export interface ListaPrecioPost {
  proceso: number;
  codLstPrecio: string;
  desLstPrecio: string;
  moneda: string;
  simbolo: string;
  vigencia: string;
  fechaDesde: string;
  fechaHasta: string;
  observaciones: string;
  planRate: string;
  operador: string;
  respuesta: string;
}

export interface ListaPrecioUI {
  codigo: string;
  descripcion: string;
  moneda: string;
  simbolo: string;
  vigente: string;
  fechaDesde: string;
  fechaHasta: string;
  observaciones: string;
  planRate: string ;
  operador: string;

}

