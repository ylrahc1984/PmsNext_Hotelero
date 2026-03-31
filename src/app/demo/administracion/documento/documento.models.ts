export interface DocumentoDto {
  CA04_CodDocu              : string;
  CA04_NomDocu              : string;
  CA04_Serie                : number;
  CA04_Numero               : number;
  CA04_Visible              : number;
  CA04_Auto                 : number;
  CA04_Compra               : number;
  CA04_Venta                : number;
  CA04_Docu                 : number;
  CA04_NotaC                : number;
  CA04_NotaD                : number;
  CA04_Guia                 : string;
  CA04_Observacion1         : string;
  CA04_Observacion2         : string;
  CA04_NFactElectronica     : number;
  CA404_TDocFE              : string;
  CA04_Operador             : string;
}

export interface DocumentoPost {
  proceso                 : number;
  codigo                  : string;
  descripcion             : string;
  serie                   : number;
  numero                  : number;
  visible                 : number;
  auto                    : number;
  compra                  : number;
  venta                   : number;
  docu                    : number;
  notaC                   : number;
  notaD                   : number;
  guia                    : number;
  observaciones1          : string;
  observaciones2          : string;
  nFactElectronica        : number;
  tDocFE                  : string;
  operador                : string;
  respuesta               : string;
}

export interface DocumentoResponse {
  respuesta?: string;
}
