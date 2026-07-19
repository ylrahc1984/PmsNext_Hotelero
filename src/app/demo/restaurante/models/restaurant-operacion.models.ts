export interface PuntoVentaUsuario {
  MPV07_CodPntVenta    : string;
  MPV07_NomPntVenta    : string;
  MPV07_CodComanda     : string;
  MPV10_CodLstPrecio   : string;
  MPV04_Moneda         : string;
  MPV07_ImpresoraA     : unknown;
  MPV07_ImpresoraB     : unknown;
}

export interface SelectedPointOfSale {
  codigo        : string;
  descripcion   : string;
  detalle       : PuntoVentaUsuario;
}

export interface UbicacionMesasResponse {
  datos         : UbicacionMesa[];
}

export interface UbicacionMesa {
  MPV09_CodUbicacion  : string;
  MPV09_CodPntVenta   : string;
  MPV09_Descripcion   : string;
  MPV09_TotMesas      : number;
  MPV09_Activo        : string;
  MPV09_Orden         : number;
  MPV09_Operador      : string;
}

export interface RestauranteMesaOperacionResponse {
  mesas       : RestauranteMesaOperacion[];
  respuesta   : string | null;
}

export interface RestauranteMesaOperacion {
  cpV05_IdMesa            : number;
  cpV05_NumMesa           : number;
  cpV05_CodUbicacion      : string;
  cpV05_CodPntVenta       : string;
  cpV05_Descripcion       : string;
  cpV05_PosX              : number | null;
  cpV05_PosY              : number | null;
  cpV05_Ancho             : number | null;
  cpV05_Alto              : number | null;
  cpV05_Forma             : string | null;
  cpV05_Estado            : string | null;
  ocupada                 : boolean;
  ppV07_TipNDP            : string | null;
  ppV07_SerieNDP          : string | null;
  ppV07_NumNDP            : string | null;
  ppV07_FecDocu           : string | null;
  ppV07_HorDocu           : string | null;
  ppV07_CodVendedor       : string | null;
  ppV07_TotalDocu         : number | null;
  estadoMesa              : string | null;
}

export interface MozoPuntoVenta {
  MPV11_CodUsuario  : string;
  MPV11_NomMozo     : string;
  MPV12_PntVenta    : string;
}

export interface SelectedRestaurantTableContext {
  puntoVenta      : SelectedPointOfSale;
  areaOperativa   : UbicacionMesa;
  mesa            : MesaVisual;
  mozo            : MozoPuntoVenta;
}

export type MesaEstado = 'LIBRE' | 'OCUPADA' | 'CUENTA' | 'RESERVADA' | 'LIMPIEZA';

export interface MesaVisual {
  idMesa        ?: number;
  numero        : number;
  nombre        : string;
  estado        : MesaEstado;
  personas      ?: number;
  consumo       ?: number;
  horaReserva   ?: string;
  notaPedido    ?: {
    tipNp         : string;
    serieNp       : string;
    numNp         : string;
    fecha         : string;
    hora          ?: string;
    codVendedor   ?: string;
  };
}
