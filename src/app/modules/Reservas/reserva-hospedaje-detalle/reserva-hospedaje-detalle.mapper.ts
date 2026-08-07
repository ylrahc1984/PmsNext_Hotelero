import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';

import {
  ReservaCompletaDto,
  ReservaCompletaServicioAdicionalDto,
  ReservaHospedajeDetalle,
  ReservaHospedajeServicioDetalle
} from './reserva-hospedaje-detalle.model';

export function mapReservaCompletaToHospedajeDetalle(response: ReservaCompletaDto | null | undefined): ReservaHospedajeDetalle {
  const encabezado = response?.encabezado ?? {};
  const fecIngreso = normalizeDate(encabezado.prV01_FecIngresa);
  const observacion = text(encabezado.prV01_Observacion);

  return {
    codReserva: text(encabezado.prV01_CodReserva),
    codAgencia: text(encabezado.prV01_CodAgencia),
    nomAgencia: text(encabezado.mR01_NomAgencia),
    codTarifa: text(encabezado.prV01_CodTarifa),
    nomTarifa: text(encabezado.mR03_NomTarifa),
    codPlan: text(encabezado.prV01_CodPlan),
    planAlimenticio: text(encabezado.mR06_PlanAlimenticio),
    fecIngresa: fecIngreso,
    fecIngreso,
    fecSalida: normalizeDate(encabezado.prV01_FecSalida),
    fecCreacion: normalizeDate(encabezado.prV01_FecCreacion),
    fecConfirma: normalizeDate(encabezado.prV01_FecConfirma),
    fecPrepago: normalizeDate(encabezado.prV01_FecPrepago),
    fecAnulada: normalizeDate(encabezado.prV01_FecAnulada),
    totNoches: number(encabezado.prV01_TotNoches),
    totDias: number(encabezado.prV01_TotDias),
    descripcion: text(encabezado.prV01_Descripcion),
    tCambio: number(encabezado.prV01_TCambio),
    folio: text(encabezado.prV01_Folio),
    estado: text(encabezado.prV01_Estado),
    moneda: text(encabezado.prV01_Moneda),
    totalRsv: number(encabezado.prV01_TotalRsv),
    observacion,
    observaciones: observacion,
    procesado: number(encabezado.prV01_Procesado),
    directo: boolean(encabezado.prV01_Directo),
    operador: text(encabezado.prV01_Operador),
    habitaciones: array(response?.detalleHabitaciones).map((item) => ({
      codReserva: text(item.prV02_CodReserva),
      catHabita: text(item.prV02_CatHabita),
      tipHabita: text(item.prV02_TipHabita),
      cantHab: number(item.prV02_CantHab),
      precio: number(item.prV02_Precio),
      moneda: text(item.prV02_Moneda),
      porDesc: number(item.prV02_PorDesc),
      total: number(item.prV02_Total),
      cpl: number(item.prV02_Cpl),
      impuesto: number(item.prV02_Impuesto),
      numPax: number(item.prV02_NumPax),
      numChild: number(item.prV02_NumChild),
      totChild: number(item.prV02_TotChild),
      cCosto: text(item.prV02_CCosto),
      orden: number(item.prV02_Orden),
      operador: text(item.prV02_Operador)
    })),
    inclusiones: array(response?.serviciosIncluidos).map((item) => ({
      codReserva: text(item.prV03_CodReserva),
      codServ: text(item.prV03_CodServ),
      desServ: text(item.prV03_DesServ),
      tipPax: text(item.prV03_TipPax),
      precio: number(item.prV03_Precio),
      cantidad: number(item.prV03_Cantidad),
      totServ: number(item.prV03_TotServ),
      moneda: text(item.prV03_Moneda),
      exonera: text(item.prV03_Exonera),
      cpl: number(item.prV03_Cpl),
      impInc: number(item.prV03_ImpInc),
      cCosto: text(item.prV03_CCosto),
      idOrden: number(item.prV03_IdOrden),
      operador: text(item.prV03_Operador)
    })),
    servicios: array(response?.serviciosAdicionales).map(mapServicioAdicional),
    desgloseHabitaciones: array(response?.desgloseHabitaciones).map((item) => ({
      numHabita: text(item.prV06_NumHabita),
      catHabita: text(item.prV06_CatHabita),
      tipHabita: text(item.prV06_TipHabita),
      fechaIngreso: normalizeDate(item.prV06_FechaIng),
      fechaSalida: normalizeDate(item.prV06_FechaSal),
      procesado: number(item.prV06_Procesado),
      numPax: number(item.prV06_NumPax),
      numChild: number(item.prV06_NumChild),
      cpl: number(item.prV06_Cpl),
      orden: number(item.prV06_Orden),
      habOrigen: text(item.prV06_HabOrigen),
      operador: text(item.prV06_Operador)
    }))
  };
}

function mapServicioAdicional(item: ReservaCompletaServicioAdicionalDto): ReservaHospedajeServicioDetalle {
  const codSrv = text(read(item, 'prV04_CodSrv', 'prV04_CodServ', 'codSrv', 'codServ'));
  const descripcion = text(read(item, 'prV04_Descripcion', 'prV04_DesServ', 'descripcion', 'desServ'));
  const cantidad = number(read(item, 'prV04_Cantidad', 'cantidad'));
  const precio = number(read(item, 'prV04_Precio', 'precio'));
  const totalValue = read(item, 'prV04_Total', 'prV04_TotServ', 'total', 'totServ');
  const total = totalValue === undefined ? cantidad * precio : number(totalValue);

  return {
    codReserva: text(read(item, 'prV04_CodReserva', 'codReserva')),
    codSrv,
    codServ: codSrv,
    descripcion,
    desServ: descripcion,
    moneda: text(read(item, 'prV04_Moneda', 'moneda')),
    cantidad,
    precio,
    total,
    totServ: total,
    impuesto: number(read(item, 'prV04_Impuesto', 'impuesto')),
    tipPax: text(read(item, 'prV04_TipPax', 'tipPax')),
    cCosto: text(read(item, 'prV04_CCosto', 'cCosto')),
    idOrden: number(read(item, 'prV04_IdOrden', 'prV04_Orden', 'idOrden', 'orden')),
    operador: text(read(item, 'prV04_Operador', 'operador'))
  };
}

function read(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined) {
      return record[key];
    }
  }
  return undefined;
}

function array<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function number(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function boolean(value: unknown): boolean {
  const normalized = text(value).toUpperCase();
  return normalized === '1' || normalized === 'S' || normalized === 'SI' || normalized === 'TRUE';
}

function normalizeDate(value: unknown): string {
  const raw = text(value);
  if (!raw || /^1900-01-01(?:T|$)/.test(raw) || /^01\/01\/1900(?:\s|$)/.test(raw)) {
    return '';
  }
  return normalizePmsDateDDMMYYYY(raw);
}
