import {
  ReservaHabitacionItem,
  ReservaHabitacionRequest,
  ReservaInclusionItem,
  ReservaServicioItem
} from '../interfaces/reserva-habitacion.interface';

export interface ReservaHabitacionFormValue {
  codReserva: string;
  codAgencia: string;
  codTarifa: string;
  codPlan: string;
  fecIngreso: string;
  fecSalida: string;
  fecCreacion: string;
  fecConfirma: string;
  fecPrepago: string;
  fecAnulada: string;
  totNoches: number;
  totDias: number;
  descripcion: string;
  tCambio: number;
  folio: string;
  estado: string;
  moneda: string;
  totalRsv: number;
  observaciones: string;
  procesa: string;
  directo: boolean;
  operador: string;
  habitaciones: ReservaHabitacionItem[];
  inclusiones: ReservaInclusionItem[];
  servicios: ReservaServicioItem[];
};

export class ReservaHabitacionMapper {
  static toRequest(value: ReservaHabitacionFormValue, totalRsv: number, proceso = 0, resolveNumPax: (categoria: string, tipo: string) => number = () => 0): ReservaHabitacionRequest {
    const moneda = value.moneda.trim();
    const noches = Number(value.totNoches) || 0;
    const includeMealPlan = !this.isNoMealPlan(value.codPlan);

    return {
      proceso,
      codReserva: this.normalizeAutoCode(value.codReserva),
      codAgencia: value.codAgencia.trim(),
      codTarifa: value.codTarifa.trim(),
      codPlan: value.codPlan.trim(),
      fecIngreso: this.toApiDate(value.fecIngreso),
      fecSalida: this.toApiDate(value.fecSalida),
      fecCreacion: this.toApiDate(value.fecCreacion),
      fecConfirma: this.toApiDate(value.fecConfirma),
      fecPrepago: this.toApiDate(value.fecPrepago),
      fecAnulada: this.toApiDate(value.fecAnulada),
      totNoches: Number(value.totNoches) || 0,
      totDias: Number(value.totDias) || 0,
      descripcion: value.descripcion.trim(),
      tCambio: Number(value.tCambio) || 0,
      folio: value.folio.trim(),
      estado: this.normalizeEstado(value.estado),
      moneda: value.moneda.trim(),
      totalRsv,
      observaciones: value.observaciones.trim(),
      procesa: Number(value.procesa) || 0,
      directo: 'N',
      operador: value.operador.trim(),
      habitaciones: value.habitaciones.map((item, index) => ({
        catHabita: item.categoria.trim(),
        tipHabita: item.tipo.trim(),
        cantHab: Number(item.cantidad) || 0,
        precio: Number(item.precio) || 0,
        moneda,
        total: Number(item.total) || 0,
        cpl: 0,
        impuesto: 0,
        numPax: resolveNumPax(item.categoria, item.tipo),
        numChild: Number(item.cantidadNinos) || 0,
        totChild: (Number(item.cantidadNinos) || 0) * (Number(item.precioNino) || 0) * noches,
        cCosto: '',
        orden: index + 1
      })),
      inclusiones: includeMealPlan
        ? value.inclusiones.map((item, index) => ({
            codServ: item.codServ.trim(),
            desServ: item.desServ.trim(),
            tipPax: item.tipPax.trim(),
            precio: Number(item.precio) || 0,
            cantidad: Number(item.cantidad) || 0,
            totServ: Number(item.totServ) || 0,
            exonera: 'N',
            cpl: 0,
            impInc: 0,
            cCosto: '',
            orden: index + 1
          }))
        : [],
      servicios: value.servicios.map((item) => ({
        codSrv: item.codSrv.trim(),
        descripcion: item.descripcion.trim(),
        moneda,
        cantidad: Number(item.cantidad) || 0,
        precio: Number(item.precio) || 0,
        total: (Number(item.cantidad) || 0) * (Number(item.precio) || 0),
        impuesto: Number(item.impuesto) || 0,
        tipPax: item.tipPax.trim(),
        cCosto: ''
      }))
    };
  }

  private static normalizeAutoCode(value: string): string {
    const code = value.trim();
    return code.toUpperCase() === 'AUTO' ? '' : code;
  }

  private static normalizeEstado(value: string): ReservaHabitacionRequest['estado'] {
    const estado = value.trim().toUpperCase();

    switch (estado) {
      case 'ABI':
      case 'ABIERTO':
      case 'PENDIENTE':
        return 'ABI';
      case 'WLI':
        return 'WLI';
      case 'WLT':
      case 'LISTA DE ESPERA':
        return 'WLT';
      case 'CCR':
      case 'CONFIRMADA':
      case 'CONFIRMADO':
        return 'CCR';
      case 'CHK':
      case 'CHECK IN':
        return 'CHK';
      case 'ANU':
      case 'ANULADA':
      case 'ANULADO':
      case 'CANCELADA':
        return 'ANU';
      default:
        return 'ABI';
    }
  }

  private static isNoMealPlan(codPlan: string): boolean {
    return codPlan.trim().toUpperCase() === 'SPL';
  }

  private static toApiDate(value: string): string {
    const text = value.trim();
    if (!text) {
      return '';
    }

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    return text;
  }
}
