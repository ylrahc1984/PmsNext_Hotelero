export interface RoomRackRoom {
  CR05_NumHab         : number;
  CR05_CateHab        : string;
  CR05_TipoHab        : string;
  CR05_CodGrp         : string;
  CR05_TotCamas       : number;
  CR05_NumPax         : number;
  CR05_EstHab         : 'B' | 'D' | 'O' | string;
  RSV                 : string;
  CR05_Clean          : 'L' | 'S' | string;
  CR05_Anexo          : string;
  CR05_Activo         : 'S' | 'N' | string;
  CR05_Operador       : string;
  CR05_Descripcion    : string;
}

export type RoomRackNavigationState = RoomRackRoom;
