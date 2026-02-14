export interface PickupListaItem {
  CR11_ID: number;
  CR11_Nombre: string;
  CR11_Duracion: string;
  CR11_Estado: number;
  CR11_Localizacion: string;
  CR11_Operador: string;
}

export interface PickupListaResponse {
  datos: PickupListaItem[];
}

export interface PickupUpsertRequest {
  accion: number;
  cR11_ID: number;
  cR11_Nombre: string;
  cR11_Duracion: string;
  cR11_Estado: number;
  cR11_Localizacion: string;
  cR11_Operador: string;
  respuesta: string;
}
