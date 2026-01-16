export interface ClienteDto {
  MPV00_CodClien: string;
  MPV00_NomClien: string;
  MPV00_RucClien: string;
  MPV00_Contacto: string;
  MPV00_DirClien: string;
  MPV00_PrvClien: string;
  MPV00_CiuClien: string;
  MPV00_Email: string;
  MPV00_Te1Clien: string;
  MPV00_Te2Clien: string;
  MPV00_TipClien: string;
  MPV00_MtoCredito: number;
  MPV00_ZONA: string;
  MPV00_TCliente: string;
}

export interface ClientePost {
  proceso: number;
  codigo: string;
  nombreCli: string;
  ruc: string;
  contacto: string;
  direccion: string;
  provincia: string;
  ciudad: string;
  pais: string;
  zona: string;
  email: string;
  telefono1: string;
  telefono2: string;
  fax: string;
  tipoCli: string;
  mtoCredito: number;
  idProvincia: string;
  idCanton: string;
  idDistrito: string;
  tCliente: string;
  enviarCorreo: boolean;
  operador: string;
  respuesta: string;
  pageNumber: number;
  pageSize: number;
}

export interface ClienteUI {
  codigo: string;
  nombre: string;
  ruc: string;
  contacto: string;
  direccion: string;
  provincia: string;
  ciudad: string;
  pais: string;
  zona: string;
  email: string;
  telefono1: string;
  telefono2: string;
  fax: string;
  tipoCli: string;
  mtoCredito: number;
  idProvincia: string;
  idCanton: string;
  idDistrito: string;
  tCliente: string;
  enviarCorreo: boolean;
}

