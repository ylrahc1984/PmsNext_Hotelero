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
  esCpl: boolean;
  operador: string;
  habitaciones: ReservaHabitacionItem[];
  inclusiones: ReservaInclusionItem[];
  servicios: ReservaServicioItem[];
};

export class ReservaHabitacionMapper {
  static fromDetalle(detalle: ReservaHabitacionDetalle): ReservaHabitacionFormValue {
    const noches = Number(detalle.totNoches ?? 0) || 0;
    const cplState = this.resolveCplState(detalle);
    const habitaciones: ReservaHabitacionItem[] = (detalle.habitaciones ?? []).map((item) => {
      const cantidadHabitaciones = Number(item.cantHab ?? 0) || 0;
      const numPaxTotal = Number(item.numPax ?? 0) || 0;
      const cantidadNinos = Number(item.numChild ?? 0) || 0;
      const cpl = this.normalizeCpl(item.cpl);
      const precioNino = cantidadNinos > 0 && noches > 0 ? (Number(item.totChild ?? 0) || 0) / cantidadNinos / noches : 0;

      return {
        categoria: String(item.catHabita ?? '').trim(),
        tipo: String(item.tipHabita ?? '').trim(),
        cantidad: cantidadHabitaciones,
        // El API persiste numPax como el total de pax de la línea. El
        // formulario trabaja con pax por habitación para poder multiplicar
        // correctamente por cantHab al recalcular el plan de alimentos.
        pax: cantidadHabitaciones > 0 ? numPaxTotal / cantidadHabitaciones : numPaxTotal,
        precio: cpl ? 0 : Number(item.precio ?? 0) || 0,
        cantidadNinos,
        precioNino: cpl ? 0 : precioNino,
        total: cpl ? 0 : Number(item.total ?? 0) || 0,
        impuesto: cpl ? 0 : Number(item.impuesto ?? 0) || 0,
        cCosto: String(item.cCosto ?? '').trim() || 'HOSPED',
        cpl: cpl === 1
      };
    });

    const inclusiones: ReservaInclusionItem[] = (detalle.inclusiones ?? []).map((item) => {
      const cpl = this.normalizeCpl(item.cpl);
      return {
        codServ: String(item.codServ ?? '').trim(),
        desServ: String(item.desServ ?? '').trim(),
        tipPax: String(item.tipPax ?? '').trim(),
        precio: cpl ? 0 : Number(item.precio ?? 0) || 0,
        cantidad: Number(item.cantidad ?? 0) || 0,
        totServ: cpl ? 0 : Number(item.totServ ?? 0) || 0,
        cCosto: String(item.cCosto ?? '').trim(),
        cpl: cpl === 1
      };
    });

    const servicios: ReservaServicioItem[] = (detalle.servicios ?? []).map((item) => ({
      codSrv: String(item.codSrv ?? item.codServ ?? '').trim(),
      descripcion: String(item.descripcion ?? item.desServ ?? '').trim(),
      cantidad: Number(item.cantidad ?? 0) || 0,
      precio: Number(item.precio ?? 0) || 0,
      impuesto: Number(item.impuesto ?? 0) || 0,
      tipPax: String(item.tipPax ?? '').trim(),
      total: Number(item.total ?? item.totServ ?? 0) || 0,
      cCosto: String(item.cCosto ?? '').trim()
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
      esCpl: cplState.esCpl,
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
    const defaultCpl = value.esCpl ? 1 : 0;

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
      habitaciones: value.habitaciones.map((item, index) => {
        const cpl = this.normalizeCpl(item.cpl ?? defaultCpl);
        const cantidadHabitaciones = this.toInteger(item.cantidad);
        const paxInformadosEnFormulario = Number(item.pax);
        const paxPorHabitacion = this.toInteger(
          Number.isFinite(paxInformadosEnFormulario) && paxInformadosEnFormulario > 0
            ? paxInformadosEnFormulario
            : resolveNumPax(item.categoria, item.tipo)
        );
        return ({
        catHabita: item.categoria.trim(),
        tipHabita: item.tipo.trim(),
        cantHab: cantidadHabitaciones,
        precio: cpl ? 0 : Number(item.precio) || 0,
        moneda,
        total: cpl ? 0 : Number(item.total) || 0,
        cpl,
        impuesto: 1,
        // La tabla muestra pax por habitación × cantidad de habitaciones;
        // el API espera ese total entero en numPax.
        numPax: paxPorHabitacion * cantidadHabitaciones,
        numChild: Number(item.cantidadNinos) || 0,
        totChild: cpl ? 0 : (Number(item.cantidadNinos) || 0) * (Number(item.precioNino) || 0) * noches,
        cCosto: (item.cCosto ?? '').trim() || 'HOSPED',
        orden: index + 1
      }); }),
      inclusiones: includeMealPlan
        ? value.inclusiones.map((item, index) => {
            const cpl = this.normalizeCpl(item.cpl ?? defaultCpl);
            return ({
            codServ: item.codServ.trim(),
            desServ: item.desServ.trim(),
            tipPax: item.tipPax.trim(),
            precio: cpl ? 0 : Number(item.precio) || 0,
            cantidad: Number(item.cantidad) || 0,
            totServ: cpl ? 0 : Number(item.totServ) || 0,
            exonera: '0',
            cpl,
            impInc: 1,
            cCosto: (item.cCosto ?? '').trim(),
            orden: index + 1
          }); })
        : [],
      servicios: value.servicios.map((item) => ({
        codSrv: item.codSrv.trim(),
        descripcion: item.descripcion.trim(),
        moneda,
        cantidad: Number(item.cantidad) || 0,
        precio: Number(item.precio) || 0,
        total: Number(item.total) || 0,
        impuesto: 1,
        tipPax: item.tipPax.trim(),
        cCosto: (item.cCosto ?? '').trim()
      }))
    };
  }

  static resolveCplState(detalle: ReservaHabitacionDetalle): { esCpl: boolean; inconsistent: boolean } {
    const roomValues = (detalle.habitaciones ?? []).map((item) => this.normalizeCpl(item.cpl));
    const values = roomValues.length
      ? roomValues
      : (detalle.inclusiones ?? []).map((item) => this.normalizeCpl(item.cpl));
    const uniqueValues = new Set(values);
    return {
      esCpl: values.length > 0 && values.every((value) => value === 1),
      inconsistent: uniqueValues.size > 1
    };
  }

  private static normalizeCpl(value: unknown): number {
    return Number(value ?? 0) === 1 ? 1 : 0;
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

  private static toInteger(value: unknown): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
  }
}
