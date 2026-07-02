export interface CategoriaVisible {
  MPV00_CodCategoria    : string;
  MPV00_NomCategoria    : string;
  MPV00_VisiblePnt      : number;
  MPV00_Orden           : number;
  MPV00_Operador        : string;
}

export interface ProductoMenu {
  MPV05_CodLstPrecio      : string;
  MPV01_CodCategoria      : string;
  MPV01_CodGrupo          : string;
  MPV05_CodProducto       : string;
  MPV05_DesProducto       : string;
  MPV05_NomCorto          : string;
  MPV05_PrecioTotal       : number;
  MPV05_CostoProdu        : number;
  MPV05_Impuesto          : number;
  MPV05_Moneda            : string;
}
