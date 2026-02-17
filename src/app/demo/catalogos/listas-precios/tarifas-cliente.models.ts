export interface TarifaClienteDto {
  cpV03_IdTarxCliente?: number;
  cpV03_CodCliente?: string;
  cpV03_CodTari?: string;
  cpV03_Usuario?: string;
  [key: string]: unknown;
}

export interface TarifaClientePost {
  accion: number;
  cpV03_IdTarxCliente: number;
  cpV03_CodCliente: string;
  cpV03_CodTari: string;
  cpV03_Usuario: string;
}

export interface TarifaClienteUI {
  id: number;
  codCliente: string;
  codTari: string;
  usuario: string;
}
