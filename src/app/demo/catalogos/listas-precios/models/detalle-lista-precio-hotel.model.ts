export interface DetalleListaPrecioHotelModel {
  MPV05_ID?: number;
  MPV05_CodLstPrecio: string;
  MPV01_CodGrupo: string;
  MPV00_NomCategoria: string;
  MPV05_CodProducto: string;
  MPV05_DesProducto: string;
  MPV05_NomCorto: string;
  MPV01_UMedida: string;
  MPV05_PrecioTotal: number;
  MPV05_CostoProdu: number;
  MPV05_Impuesto: number;
  MPV05_Moneda: string;
  MPV05_Orden: number;
  MPV01_CodCategoria: string;
  MPV05_Operador: string;
}

export interface RecetaNoEnListaHotelModel {
  MPV01_CodCategoria: string;
  MPV01_CodGrupo: string;
  MPV01_CodReceta: string;
  MPV01_NomReceta: string;
  MPV01_NomCorto: string;
  MPV01_UMedida: string;
  MPV01_NumPorciones: number;
  MPV01_CtoReceta: number;
  MPV01_CtoProduccion: number;
  MPV01_CtoNeto: number;
  MPV01_Utilidad: number;
  MPV01_TotalCUtilidad: number;
  MPV01_CtoTotal: number;
  MPV01_Descripcion: string;
  MPV01_Visible: number;
  MPV01_UrlImagen: string;
  MPV01_Operador: string;
  MPV01_CABYS: string;
  MPV01_Compuesto: string;
}

export interface RecetasNoEnListaResult {
  data: RecetaNoEnListaHotelModel[];
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
  totalPages: number;
}

export interface AgregarDetalleListaPrecioPayload {
  proceso: number;
  codLstPrecio: string;
  codProducto: string;
  desProducto: string;
  nomCorto: string;
  precioTotal: number;
  cstoProdu: number;
  impuesto: number;
  moneda: string;
  orden: number;
  operador: string;
  pageNumber: number;
  pageSize: number;
  respuesta: string;
}
