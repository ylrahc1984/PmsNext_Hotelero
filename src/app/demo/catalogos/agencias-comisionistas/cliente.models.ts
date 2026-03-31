export interface ClienteContactoDto {
  id              ?: number;
  nomContacto     ?: string;
  cargo           ?: unknown;
  email           ?: string;
  telefono1       ?: string;
  telefono2       ?: string;
  movil           ?: string;
  ext             ?: string;
  principal       ?: boolean;
  activo          ?: boolean;
  observacion     ?: string;
  accion          ?: string;
  operador        ?: string;
  fechaRegistro   ?: string;
}

export interface ClienteDetalleDto {
  codigo                  ?: string;
  nombreCli               ?: string;
  ruc                     ?: string;
  contacto                ?: string;
  direccion               ?: string;
  pais                    ?: string;
  zona                    ?: string;
  email                   ?: string;
  telefono1               ?: string;
  telefono2               ?: string;
  fax                     ?: string;
  tipoCli                 ?: string;
  mtoCredito              ?: number;
  idProvincia             ?: string;
  idCanton                ?: string;
  idDistrito              ?: string;
  tCliente                ?: string;
  enviarCorreo            ?: boolean;
  operador                ?: string;
  codigoActividad         ?: string;
  nombreActividad         ?: string;
  MPV32_CodActividad      ?: string;
  MPV32_NombreActividad   ?: string;
}

export interface ClienteDetalleResponse {
  cliente     ?: ClienteDetalleDto | null;
  contactos   ?: ClienteContactoDto[] | null;
  datos       ?: ClienteDto[] | ClienteDto | null;
}

export interface ClienteDto {
  MPV00_CodClien          : string;
  MPV00_NomClien          : string;
  MPV00_RucClien          : string;
  MPV00_Contacto          : string;
  ContactoPrincipal       ?: string;
  EmailPrincipal          ?: string;
  TelefonoPrincipal       ?: string;
  CargoPrincipal          ?: unknown;
  MPV00_DirClien          : string;
  MPV00_PrvClien          ?: string;
  MPV00_CiuClien          ?: string;
  MPV00_PaiClien          ?: string;
  MPV00_Email             : string;
  MPV00_Te1Clien          : string;
  MPV00_Te2Clien          : string;
  MPV00_FaxClien          ?: string;
  MPV00_TipClien          : string;
  MPV00_MtoCredito        : number;
  MPV00_ZONA              ?: string;
  MPV00_Zona              ?: string;
  MPV00_IdProvincia       ?: string;
  MPV00_IdCanton          ?: string;
  MPV00_IdDistrito        ?: string;
  MPV00_TCliente          : string;
  MPV00_BanderaCorreo     ?: number;
  TotalContactos          ?: number;
  contactos               ?: ClienteContactoDto[];
  MPV32_CodActividad      ?: string;
  MPV32_NombreActividad   ?: string;
  MPV00_Operador          ?: string;
}

export interface ClienteContactoPost {
  id            : number;
  nomContacto   : string;
  cargo         : string;
  email         : string;
  telefono1     : string;
  telefono2     : string;
  movil         : string;
  ext           : string;
  principal     : boolean;
  activo        : boolean;
  observacion   : string;
  accion        : string;
  operador      : string;
  fechaRegistro : string | null;
}

export interface ClientePost {
  proceso         : number;
  codigo          : string;
  nombreCli       : string;
  ruc             : string;
  contacto        : string;
  direccion       : string;
  provincia       : string;
  ciudad          : string;
  pais            : string;
  zona            : string;
  email           : string;
  telefono1       : string;
  telefono2       : string;
  fax             : string;
  tipoCli         : string;
  mtoCredito      : number;
  idProvincia     : string;
  idCanton        : string;
  idDistrito      : string;
  tCliente        : string;
  enviarCorreo    : boolean;
  operador        : string;
  contactos       : ClienteContactoPost[];
  nombreContacto  : string;
  respuesta       : string;
  pageNumber      : number;
  pageSize        : number;
}

export interface ClienteContactoUI {
  id              : number;
  nomContacto     : string;
  cargo           : string;
  email           : string;
  telefono1       : string;
  telefono2       : string;
  movil           : string;
  ext             : string;
  principal       : boolean;
  activo          : boolean;
  observacion     : string;
  accion          : string;
  operador        : string;
  fechaRegistro   : string | null;
}

export interface ClienteUI {
  codigo              : string;
  nombre              : string;
  ruc                 : string;
  contacto            : string;
  nombreContacto      : string;
  contactoPrincipal   : string;
  emailPrincipal      : string;
  telefonoPrincipal   : string;
  cargoPrincipal      : string;
  direccion           : string;
  provincia           : string;
  ciudad              : string;
  pais                : string;
  zona                : string;
  email               : string;
  telefono1           : string;
  telefono2           : string;
  fax                 : string;
  tipoCli             : string;
  mtoCredito          : number;
  idProvincia         : string;
  idCanton            : string;
  idDistrito          : string;
  tCliente            : string;  
  enviarCorreo        : boolean; // Es importante por que define si es o no Factura Electrónica o Tiquete Electrónico
  totalContactos      : number;
  contactos           : ClienteContactoUI[];
  operador            ?: string;
  codigoActividad     ?: string;
  nombreActividad     ?: string;
}
