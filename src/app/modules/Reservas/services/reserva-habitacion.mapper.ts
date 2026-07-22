import {
  ReservaHabitacionDetalle,
  ReservaHabitacionItem,
  ReservaHabitacionRequest,
  ReservaInclusionItem,
  ReservaServicioItem
} from '../interfaces/reserva-habitacion.interface';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';

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
  static fromDetalle(detalle: ReservaHabitacionDetalle): ReservaHabitacionFormValue {
    const noches = Number(detalle.totNoches ?? 0) || 0;
    const habitaciones: ReservaHabitacionItem[] = (detalle.habitaciones ?? []).map((item) => {
      const cantidadNinos = Number(item.numChild ?? 0) || 0;
      const precioNino = cantidadNinos > 0 && noches > 0 ? (Number(item.totChild ?? 0) || 0) / cantidadNinos / noches : 0;

      return {
        categoria: String(item.catHabita ?? '').trim(),
        tipo: String(item.tipHabita ?? '').trim(),
        cantidad: Number(item.cantHab ?? 0) || 0,
        pax: Number(item.numPax ?? 0) || 0,
        precio: Number(item.precio ?? 0) || 0,
        cantidadNinos,
        precioNino,
        total: Number(item.total ?? 0) || 0
      };
    });

    const inclusiones: ReservaInclusionItem[] = (detalle.inclusiones ?? []).map((item) => ({
      codServ: String(item.codServ ?? '').trim(),
      desServ: String(item.desServ ?? '').trim(),
      tipPax: String(item.tipPax ?? '').trim(),
      precio: Number(item.precio ?? 0) || 0,
      cantidad: Number(item.cantidad ?? 0) || 0,
      totServ: Number(item.totServ ?? 0) || 0,
      cCosto: String(item.cCosto ?? '').trim()
    }));

    const servicios: ReservaServicioItem[] = (detalle.servicios ?? []).map((item) => ({
      codSrv: String(item.codSrv ?? item.codServ ?? '').trim(),
      descripcion: String(item.descripcion ?? item.desServ ?? '').trim(),
      cantidad: Number(item.cantidad ?? 0) || 0,
      precio: Number(item.precio ?? 0) || 0,
      impuesto: Number(item.impuesto ?? 0) || 0,
      tipPax: String(item.tipPax ?? '').trim(),
      total: Number(item.total ?? item.totServ ?? 0) || 0
    }));

    return {
      codReserva: String(detalle.codReserva ?? '').trim(),
      codAgencia: String(detalle.codAgencia ?? '').trim(),
      codTarifa: String(detalle.codTarifa ?? '').trim(),
      codPlan: String(detalle.codPlan ?? '').trim(),
      fecIngreso: this.toInputDate(detalle.fecIngreso ?? detalle.fecIngresa ?? ''),
      fecSalida: this.toInputDate(detalle.fecSalida ?? ''),
      fecCreacion: this.toInputDate(detalle.fecCreacion ?? ''),
      fecConfirma: this.toInputDate(detalle.fecConfirma ?? ''),
      fecPrepago: this.toInputDate(detalle.fecPrepago ?? ''),
      fecAnulada: this.toInputDate(detalle.fecAnulada ?? ''),
      totNoches: Number(detalle.totNoches ?? 0) || 0,
      totDias: Number(detalle.totDias ?? 0) || 0,
      descripcion: String(detalle.descripcion ?? '').trim(),
      tCambio: Number(detalle.tCambio ?? 0) || 0,
      folio: String(detalle.folio ?? '').trim(),
      estado: this.normalizeEstado(String(detalle.estado ?? 'ABI')),
      moneda: String(detalle.moneda ?? '').trim(),
      totalRsv: Number(detalle.totalRsv ?? 0) || 0,
      observaciones: String(detalle.observaciones ?? detalle.observacion ?? '').trim(),
      procesa: String(detalle.procesa ?? detalle.procesado ?? 0),
      directo: String(detalle.directo ?? '').trim().toUpperCase() === 'S',
      operador: String(detalle.operador ?? '').trim(),
      habitaciones,
      inclusiones,
      servicios
    };
  }

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
      fecIngreso: normalizePmsDateDDMMYYYY(value.fecIngreso),
      fecSalida: normalizePmsDateDDMMYYYY(value.fecSalida),
      fecCreacion: normalizePmsDateDDMMYYYY(value.fecCreacion),
      fecConfirma: normalizePmsDateDDMMYYYY(value.fecConfirma),
      fecPrepago: normalizePmsDateDDMMYYYY(value.fecPrepago),
      fecAnulada: normalizePmsDateDDMMYYYY(value.fecAnulada),
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
        numPax: resolveNumPax(item.categoria, item.tipo) || Number(item.pax) || 0,
        numChild: Number(item.cantidadNinos) || 0,
        totChild: (Number(item.cantidadNinos) || 0) * (Number(item.precioNino) || 0) * noches,
        cCosto: 'HOSPED',
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
            exonera: '0',
            cpl: 0,
            impInc: 0,
            cCosto: (item.cCosto ?? '').trim(),
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

  private static toInputDate(value: string): string {
    const text = String(value ?? '').trim();
    if (!text || text.startsWith('1900-01-01') || text.startsWith('01/01/1900')) {
      return '';
    }
    return toPmsDateInputValue(text);
  }
}
