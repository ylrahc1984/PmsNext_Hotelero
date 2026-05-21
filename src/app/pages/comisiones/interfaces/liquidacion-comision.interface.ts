export interface LiquidacionComision {
  AD22_Id?: number;
  AD22_NumeroLiquidacion?: string;
  AD22_AgenciaId?: number;
  AD22_NombreAgencia?: string;
  AD22_FechaInicio?: string;
  AD22_FechaFin?: string;
  AD22_FechaLiquidacion?: string;
  AD22_Moneda?: string;
  AD22_Subtotal?: number;
  AD22_Impuestos?: number;
  AD22_Total?: number;
  AD22_Estado?: string;
  AD22_Observaciones?: string;
  [key: string]: unknown;
}

export interface LiquidacionDetalle {
  AD23_Id?: number;
  AD23_LiquidacionId?: number;
  AD23_ComisionCalculadaId?: number;
  AD23_DocumentoId?: number;
  AD23_NumeroDocumento?: string;
  AD23_NombreServicio?: string;
  AD23_MontoBase?: number;
  AD23_MontoComision?: number;
  AD23_Estado?: string;
  [key: string]: unknown;
}

export interface LiquidacionTotales {
  totalDocumentos?: number;
  montoBase?: number;
  montoComision?: number;
  impuestos?: number;
  total?: number;
  [key: string]: unknown;
}
