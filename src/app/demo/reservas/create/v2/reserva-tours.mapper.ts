import { ActividadModalSavePayload } from '../reserva-create-actividad-modal.component';
import { buildInitialReservaCreateForm } from '../reserva-create.builders';
import { DetalleForm, DetallePaxForm, ReservaCreateForm } from '../reserva-create.models';
import { formatDateToApiDate, normalizeReservaEstado, normalizeTimeInputValue, safeNumber, safeString, toDateInputValue } from '../reserva-create.utils';
import { FISCAL_CONFIG } from 'src/app/core/config/fiscal.config';
import { calculateTaxFromNetAmount as calculateFiscalTaxFromNetAmount, splitTaxInclusiveAmount } from 'src/app/core/config/fiscal.utils';
import {
  ReservaCreateV2Draft,
  ReservaCreateV2HeaderDraft,
  ReservaDraftBuildOptions,
  ReservaDraftCalculationOptions,
  ReservaDraftPassengerLine,
  ReservaDraftServiceLine,
  ReservaDraftTotals
} from './reserva-create-v2.models';
import {
  ReservaToursCompletaEncabezadoDto,
  ReservaToursCompletaPasajeroDto,
  ReservaToursCompletaResponseDto,
  ReservaToursCompletaServicioDto,
  ReservaToursDetallePasajeroDto,
  ReservaToursDetalleServicioDto,
  ReservaToursPayloadDto
} from './reserva-tours.models';

const DEFAULT_POST_PAGE_SIZE = 10;

function roundCurrency(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((safeNumber(value) + Number.EPSILON) * factor) / factor;
}

function normalizeDirecto(value: string): '0' | '1' {
  return (value || '').toString().trim() === '1' ? '1' : '0';
}

function getDefaultCalculationOptions(): ReservaDraftCalculationOptions {
  return {
    pricesIncludeTax      : FISCAL_CONFIG.pricesIncludeTax,
    taxRate               : FISCAL_CONFIG.taxRate,
    descuentoDefault      : 0,
    redondeoDecimales     : 2
  };
}

function getCalculationOptions(options?: Partial<ReservaDraftCalculationOptions>): ReservaDraftCalculationOptions {
  return {
    ...getDefaultCalculationOptions(),
    ...(options ?? {})
  };
}

function calculateTaxFromNetAmount(
  netAmount: number,
  directo: string,
  options?: Partial<ReservaDraftCalculationOptions>
): { neto: number; iva: number; total: number } {
  return calculateFiscalTaxFromNetAmount(netAmount, directo, getCalculationOptions(options));
}

function splitConfiguredAmount(
  configuredAmount: number,
  directo: string,
  options?: Partial<ReservaDraftCalculationOptions>
): { neto: number; iva: number; total: number } {
  return splitTaxInclusiveAmount(configuredAmount, directo, getCalculationOptions(options));
}

function normalizeTipoPax(code: string): string {
  return (code || '').toString().trim().toUpperCase();
}

function normalizeTipoServicio(code: string, fallback = ''): string {
  const normalized = safeString(code || fallback).trim().toUpperCase();
  if (!normalized) {
    return '';
  }
  if (normalized === 'TRF' || normalized === 'TRANSFER' || normalized === 'TRASLADO' || normalized === 'TRASLADOS') {
    return 'TRANS';
  }
  if (
    normalized === 'ACT' ||
    normalized === 'ACTIVIDAD' ||
    normalized === 'ACTIVIDADES' ||
    normalized === 'TOURS'
  ) {
    return 'TOUR';
  }
  return normalized;
}

function normalizeDetalleEstado(value: string, fallback = 'PEN'): string {
  const normalized = safeString(value).trim().toUpperCase();
  if (normalized === 'PENDIENTE') return 'PEN';
  if (normalized === 'CONFIRMADO' || normalized === 'CONFIRMADA') return 'CON';
  if (normalized === 'ANULADO' || normalized === 'ANULADA') return 'CAN';
  return normalized || fallback;
}

function normalizeReservaEstadoForPayload(value: string): string {
  const normalized = normalizeDetalleEstado(value, 'CON');
  if (normalized === 'PEN') {
    return 'CON';
  }
  return normalized;
}

function emptyToNull(value: unknown): string | null {
  const normalized = safeString(value).trim();
  return normalized ? normalized : null;
}

function parseComparableDate(value: unknown): Date | null {
  const normalized = toDateInputValue(value);
  if (!normalized) {
    return null;
  }

  const [yyyy, mm, dd] = normalized.split('-').map((part) => Number(part));
  if (!yyyy || !mm || !dd) {
    return null;
  }

  const parsed = new Date(Date.UTC(yyyy, mm - 1, dd));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculatePayloadDateRange(
  header: ReservaCreateV2HeaderDraft,
  servicios: ReservaDraftServiceLine[]
): { fecIngresa: string; fecSalida: string; totDias: number; totNoches: number } {
  const dates = servicios
    .map((item) => parseComparableDate(item.fecServicio))
    .filter((item): item is Date => !!item)
    .sort((a, b) => a.getTime() - b.getTime());

  const fallbackStart = formatDateToApiDate(header.fecIngresa || header.fecha);
  const fallbackEnd = formatDateToApiDate(header.fecSalida || header.fecha);
  if (!dates.length) {
    return {
      fecIngresa: fallbackStart,
      fecSalida: fallbackEnd || fallbackStart,
      totDias: 0,
      totNoches: 0
    };
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const diffDays = Math.max(0, Math.round((last.getTime() - first.getTime()) / 86400000));

  return {
    fecIngresa: formatDateToApiDate(header.fecIngresa || first),
    fecSalida: formatDateToApiDate(header.fecSalida || last),
    totDias: diffDays + 1,
    totNoches: diffDays
  };
}

function isNinoTipoPax(code: string): boolean {
  const normalized = normalizeTipoPax(code);
  return normalized === 'CHL' || normalized.startsWith('NIN');
}

function isAdultoTipoPax(code: string): boolean {
  const normalized = normalizeTipoPax(code);
  return !!normalized && !isNinoTipoPax(normalized);
}

function buildPassengerLineFromTotal(
  tipoPax: string,
  cantidad: number,
  configuredSubtotal: number,
  directo: string,
  options?: Partial<ReservaDraftCalculationOptions>,
  extra?: Partial<ReservaDraftPassengerLine>
): ReservaDraftPassengerLine {
  const settings = getCalculationOptions(options);
  const qty = Math.max(0, safeNumber(cantidad));
  const subtotal = roundCurrency(configuredSubtotal, settings.redondeoDecimales);
  const configuredUnitPrice = qty > 0 ? roundCurrency(subtotal / qty, settings.redondeoDecimales) : 0;
  const subtotalSplit = splitConfiguredAmount(subtotal, directo, settings);
  const unitSplit = splitConfiguredAmount(configuredUnitPrice, directo, settings);

  return {
    tipoPax                 : normalizeTipoPax(tipoPax),
    cantidad                : qty,
    precioUnitarioNeto      : unitSplit.neto,
    precioUnitarioIVA       : unitSplit.iva,
    precioUnitarioTotal     : unitSplit.total,
    subtotalNeto            : subtotalSplit.neto,
    subtotalIVA             : subtotalSplit.iva,
    subtotalTotal           : subtotalSplit.total,
    reglaPrecioId           : safeNumber(extra?.reglaPrecioId),
    precioPaxExtra          : safeNumber(extra?.precioPaxExtra),
    manual                  : !!extra?.manual,
    error                   : safeString(extra?.error)
  };
}

function getPrecioUnitarioFallback(item?: {
  cantidad?: number;
  subtotalNeto?: number;
  subtotalTotal?: number;
  precioUnitarioNeto?: number;
  precioUnitarioTotal?: number;
}): number {
  const { redondeoDecimales } = getDefaultCalculationOptions();
  const explicit = safeNumber(item?.precioUnitarioNeto);
  if (explicit > 0) return explicit;
  const explicitTotal = safeNumber(item?.precioUnitarioTotal);
  if (explicitTotal > 0) return explicitTotal;
  const qty = safeNumber(item?.cantidad);
  if (qty <= 0) return 0;
  const netSubtotal = safeNumber(item?.subtotalNeto);
  if (netSubtotal > 0) {
    return roundCurrency(netSubtotal / qty, redondeoDecimales);
  }
  return roundCurrency(safeNumber(item?.subtotalTotal) / qty, redondeoDecimales);
}

function getActividadPrecioUnitario(paxItems: ReservaDraftPassengerLine[], tipo: 'ADULTO' | 'NINO'): number {
  const match = paxItems.find((item) => {
    if (tipo === 'NINO') return isNinoTipoPax(item.tipoPax);
    return isAdultoTipoPax(item.tipoPax);
  });
  return getPrecioUnitarioFallback(match);
}

export function buildInitialReservaCreateV2HeaderDraft(form?: Partial<ReservaCreateForm>, options?: ReservaDraftBuildOptions): ReservaCreateV2HeaderDraft {
  const base = buildInitialReservaCreateForm();
  const source = form ?? {};
  return {
    ...base,
    ...source,
    codReserva      : safeString((source as ReservaCreateV2HeaderDraft).codReserva),
    fecConfirma     : safeString((source as ReservaCreateV2HeaderDraft).fecConfirma),
    fecAnulada      : safeString((source as ReservaCreateV2HeaderDraft).fecAnulada),
    fecIngresa      : safeString((source as ReservaCreateV2HeaderDraft).fecIngresa),
    fecSalida       : safeString((source as ReservaCreateV2HeaderDraft).fecSalida),
    fecPrepago      : safeString((source as ReservaCreateV2HeaderDraft).fecPrepago),
    descripcion     : safeString((source as ReservaCreateV2HeaderDraft).descripcion),
    tCambio         : safeNumber((source as ReservaCreateV2HeaderDraft).tCambio),
    folio           : safeString((source as ReservaCreateV2HeaderDraft).folio),
    procesado       : safeNumber((source as ReservaCreateV2HeaderDraft).procesado),
    cntHabitaciones : safeNumber((source as ReservaCreateV2HeaderDraft).cntHabitaciones),
    operador        : safeString(options?.operador ?? (source as ReservaCreateV2HeaderDraft).operador),
    estado          : options?.estado ?? source.estado ?? 'PEN',
    directo         : normalizeDirecto(source.directo || '0'),
    totalRsv        : safeNumber(source.totalRsv)
  };
}

export function buildInitialReservaCreateV2Draft(form?: Partial<ReservaCreateForm>, options?: ReservaDraftBuildOptions): ReservaCreateV2Draft {
  return {
    header: buildInitialReservaCreateV2HeaderDraft(form, options),
    servicios: []
  };
}

function inferDraftSourceFromTipoServicio(tipoServicio: string): 'transfer' | 'actividad' {
  const normalized = normalizeTipoServicio(tipoServicio);
  if (normalized.includes('TOUR') || normalized.includes('ACT')) {
    return 'actividad';
  }
  return 'transfer';
}

function mapReservaToursCompletaEncabezadoToHeaderDraft(
  encabezado: ReservaToursCompletaEncabezadoDto | null | undefined
): ReservaCreateV2HeaderDraft {
  const estado = normalizeReservaEstado(safeString(encabezado?.PRV01_Estado));
  const header = buildInitialReservaCreateV2HeaderDraft(
    {
      fecha                 : toDateInputValue(encabezado?.PRV01_FecCreacion),
      codAgencia            : safeString(encabezado?.PRV01_CodAgencia),
      idContacto            : safeNumber(encabezado?.PRV01_IdContacto),
      nomContactoAgencia    : safeString(encabezado?.PRV01_NomContactoAgencia),
      nomCliente            : safeString(encabezado?.PRV01_NomCliente),
      telCliente            : safeString(encabezado?.PRV01_TelCliente),
      emailCliente          : safeString(encabezado?.PRV01_EmailCliente),
      idioma                : safeString(encabezado?.PRV01_Idioma),
      formaReservacion      : safeString(encabezado?.PRV01_FormaReserva),
      formaPago             : safeString(encabezado?.PRV01_FormaPago),
      codLstPrecio          : safeString(encabezado?.PRV01_CodLstPrecio),
      codPlan               : safeString(encabezado?.PRV01_CodPlan),
      moneda                : safeString(encabezado?.PRV01_Moneda),
      directo               : safeString(encabezado?.PRV01_Directo || '0'),
      estado                ,
      totalRsv              : safeNumber(encabezado?.PRV01_TotalRsv),
      comentarios           : safeString(encabezado?.PRV01_Observacion)
    },
    { estado, operador: safeString(encabezado?.PRV01_Operador) }
  );

  return {
    ...header,
    codReserva      : safeString(encabezado?.PRV01_CodReserva),
    fecConfirma     : toDateInputValue(encabezado?.PRV01_FecConfirma),
    fecAnulada      : toDateInputValue(encabezado?.PRV01_FecAnulada),
    fecIngresa      : toDateInputValue(encabezado?.PRV01_FecIngresa),
    fecSalida       : toDateInputValue(encabezado?.PRV01_FecSalida),
    fecPrepago      : toDateInputValue(encabezado?.PRV01_FecPrepago),
    descripcion     : safeString(encabezado?.PRV01_Descripcion),
    tCambio         : safeNumber(encabezado?.PRV01_TCambio),
    folio           : safeString(encabezado?.PRV01_Folio),
    procesado       : safeNumber(encabezado?.PRV01_Procesado),
    cntHabitaciones : safeNumber(encabezado?.PRV01_CntHabitaciones),
    operador        : safeString(encabezado?.PRV01_Operador)
  };
}

function mapReservaToursCompletaPasajeroToDraftPassenger(
  pasajero: ReservaToursCompletaPasajeroDto
): ReservaDraftPassengerLine {
  return {
    tipoPax               : normalizeTipoPax(safeString(pasajero?.PRV03_TipoPax)),
    cantidad              : safeNumber(pasajero?.PRV03_Cantidad),
    precioUnitarioNeto    : safeNumber(pasajero?.PRV03_PrecioUnitarioNeto),
    precioUnitarioIVA     : safeNumber(pasajero?.PRV03_PrecioUnitarioIVA),
    precioUnitarioTotal   : safeNumber(pasajero?.PRV03_PrecioUnitarioTotal),
    subtotalNeto          : safeNumber(pasajero?.PRV03_SubtotalNeto),
    subtotalIVA           : safeNumber(pasajero?.PRV03_SubtotalIVA),
    subtotalTotal         : safeNumber(pasajero?.PRV03_SubtotalTotal)
  };
}

function mapReservaToursCompletaServicioToDraftServiceLine(
  servicio: ReservaToursCompletaServicioDto,
  header: ReservaCreateV2HeaderDraft,
  pasajeros: ReservaToursCompletaPasajeroDto[]
): ReservaDraftServiceLine {
  const paxLines = (pasajeros ?? []).map(mapReservaToursCompletaPasajeroToDraftPassenger);
  const subTotal = safeNumber(servicio?.PRV02_SubTotal) || paxLines.reduce((sum, item) => sum + safeNumber(item.subtotalNeto), 0);
  const neto = safeNumber(servicio?.PRV02_Neto) || subTotal;
  const impuesto = safeNumber(servicio?.PRV02_Impuesto) || paxLines.reduce((sum, item) => sum + safeNumber(item.subtotalIVA), 0);
  const montoServicio = safeNumber(servicio?.PRV02_MontoServicio) || paxLines.reduce((sum, item) => sum + safeNumber(item.subtotalTotal), 0);
  const planTarifa = safeString(servicio?.PRV02_PlanTarifario) || safeString(header.codPlan);

  return {
    linea             : Math.max(1, safeNumber(servicio?.PRV02_Linea)),
    source            : inferDraftSourceFromTipoServicio(servicio?.PRV02_TipoServicio),
    tipoServicio      : normalizeTipoServicio(servicio?.PRV02_TipoServicio),
    codServicio       : safeString(servicio?.PRV02_CodServicio),
    nomServicio       : safeString(servicio?.PRV02_NomServicio),
    fecServicio       : toDateInputValue(servicio?.PRV02_FecServicio),
    horaServicio      : normalizeTimeInputValue(servicio?.PRV02_HoraServicio, { zeroAsEmpty: true }),
    horaPickup        : normalizeTimeInputValue(servicio?.PRV02_HoraPickup, { zeroAsEmpty: true }),
    origenTexto       : safeString(servicio?.PRV02_OrigenTexto),
    zonaOrigen        : safeString(servicio?.PRV02_ZonaOrigen),
    origenGoogle      : safeString(servicio?.PRV02_OrigenGoogle),
    origenPlaceId     : safeString(servicio?.PRV02_OrigenPlaceId),
    origenLat         : safeNumber(servicio?.PRV02_OrigenLat),
    origenLng         : safeNumber(servicio?.PRV02_OrigenLng),
    destinoTexto      : safeString(servicio?.PRV02_DestinoTexto),
    zonaDestino       : safeString(servicio?.PRV02_ZonaDestino),
    destinoGoogle     : safeString(servicio?.PRV02_DestinoGoogle),
    destinoPlaceId    : safeString(servicio?.PRV02_DestinoPlaceId),
    destinoLat        : safeNumber(servicio?.PRV02_DestinoLat),
    destinoLng        : safeNumber(servicio?.PRV02_DestinoLng),
    adultos           : safeNumber(servicio?.PRV02_Adultos),
    ninos             : safeNumber(servicio?.PRV02_Ninos),
    totalPax          : safeNumber(servicio?.PRV02_TotalPax),
    planTarifa        ,
    codLstPrecio      : safeString(servicio?.PRV02_CodLstPrecio) || safeString(header.codLstPrecio),
    codPlan           : planTarifa,
    idReglaPrecio     : safeNumber(servicio?.PRV02_IdReglaPrecio),
    precioAdulto      : safeNumber(servicio?.PRV02_PrecioAdulto),
    precioNino        : safeNumber(servicio?.PRV02_PrecioNino),
    precioPaxExtra    : safeNumber(servicio?.PRV02_PrecioPaxExtra),
    montoServicio     ,
    codSuplidor       : safeString(servicio?.PRV02_CodSuplidor),
    subTotal          ,
    porDescuento      : safeNumber(servicio?.PRV02_PorDescuento),
    descuento         : safeNumber(servicio?.PRV02_Descuento),
    neto              ,
    impuesto          ,
    estado            : normalizeDetalleEstado(servicio?.PRV02_Estado),
    observacion       : safeString(servicio?.PRV02_Observacion),
    pasajeros         : paxLines
  };
}

export function mapReservaToursCompletaToDraft(response: ReservaToursCompletaResponseDto): ReservaCreateV2Draft {
  const header = mapReservaToursCompletaEncabezadoToHeaderDraft(response?.encabezado);
  const pasajerosByDetalleId = new Map<number, ReservaToursCompletaPasajeroDto[]>();

  for (const pasajero of response?.pasajeros ?? []) {
    const detalleId = safeNumber(pasajero?.PRV03_PRV02_ID);
    if (!detalleId) {
      continue;
    }
    const current = pasajerosByDetalleId.get(detalleId) ?? [];
    current.push(pasajero);
    pasajerosByDetalleId.set(detalleId, current);
  }

  const servicios = (response?.servicios ?? [])
    .map((servicio) =>
      mapReservaToursCompletaServicioToDraftServiceLine(
        servicio,
        header,
        pasajerosByDetalleId.get(safeNumber(servicio?.PRV02_ID)) ?? []
      )
    )
    .sort((a, b) => a.linea - b.linea);

  return {
    header: {
      ...header,
      totalRsv: safeNumber(header.totalRsv) || calculateDraftTotals(servicios).totalServicios
    },
    servicios
  };
}

export function mapDetallePaxFormToDraftPassengers(
  paxItems: DetallePaxForm[],
  directo: string,
  options?: Partial<ReservaDraftCalculationOptions>
): ReservaDraftPassengerLine[] {
  return (paxItems ?? [])
    .map((item) =>
      buildPassengerLineFromTotal(
        item.tipoPax,
        item.cantidad,
        item.precioTotal,
        directo,
        options,
        {
          reglaPrecioId: item.reglaPrecioId,
          precioPaxExtra: item.precioPaxExtra,
          manual: item.manual,
          error: item.error
        }
      )
    )
    .filter((item) => !!item.tipoPax && item.cantidad > 0);
}

export function mapDetalleFormToDraftServiceLine(
  detalleForm: DetalleForm,
  linea: number,
  directo: string,
  options?: Partial<ReservaDraftCalculationOptions>
): ReservaDraftServiceLine {
  const settings = getCalculationOptions(options);
  const pasajeros = mapDetallePaxFormToDraftPassengers(detalleForm?.detallesPax ?? [], directo, settings);
  const subTotal = roundCurrency(
    pasajeros.reduce((sum, item) => sum + safeNumber(item.subtotalNeto), 0),
    settings.redondeoDecimales
  );
  const adultosLine = pasajeros.find((item) => isAdultoTipoPax(item.tipoPax));
  const ninosLine = pasajeros.find((item) => isNinoTipoPax(item.tipoPax));
  const descuento = roundCurrency(settings.descuentoDefault, settings.redondeoDecimales);
  const neto = roundCurrency(Math.max(0, subTotal - descuento), settings.redondeoDecimales);
  const split = calculateTaxFromNetAmount(neto, directo, settings);

  return {
    linea             ,
    source            : 'transfer',
    tipoServicio      : normalizeTipoServicio(detalleForm?.tipoServicio, 'TRANS'),
    codServicio       : safeString(detalleForm?.codServicio),
    nomServicio       : safeString(detalleForm?.nomServicio),
    fecServicio       : safeString(detalleForm?.fechaServicio),
    horaServicio      : safeString(detalleForm?.horaInicio || detalleForm?.horaPickup),
    horaPickup        : safeString(detalleForm?.horaPickup),
    origenTexto       : safeString(detalleForm?.origenLugar),
    zonaOrigen        : safeString(detalleForm?.origenZona),
    origenGoogle      : safeString(detalleForm?.origenGoogle),
    origenPlaceId     : safeString(detalleForm?.origenPlaceId),
    origenLat         : safeNumber(detalleForm?.origenLat),
    origenLng         : safeNumber(detalleForm?.origenLng),
    destinoTexto      : safeString(detalleForm?.destinoLugar),
    zonaDestino       : safeString(detalleForm?.destinoZona),
    destinoGoogle     : safeString(detalleForm?.destinoGoogle),
    destinoPlaceId    : safeString(detalleForm?.destinoPlaceId),
    destinoLat        : safeNumber(detalleForm?.destinoLat),
    destinoLng        : safeNumber(detalleForm?.destinoLng),
    adultos           : pasajeros.filter((item) => isAdultoTipoPax(item.tipoPax)).reduce((sum, item) => sum + item.cantidad, 0),
    ninos             : pasajeros.filter((item) => isNinoTipoPax(item.tipoPax)).reduce((sum, item) => sum + item.cantidad, 0),
    totalPax          : pasajeros.reduce((sum, item) => sum + item.cantidad, 0),
    planTarifa        : safeString(detalleForm?.planTarifa),
    codLstPrecio      : safeString(detalleForm?.codLstPrecio),
    codPlan           : safeString(detalleForm?.codPlan),
    idReglaPrecio     : safeNumber(adultosLine?.reglaPrecioId || ninosLine?.reglaPrecioId),
    precioAdulto      : getPrecioUnitarioFallback(adultosLine),
    precioNino        : getPrecioUnitarioFallback(ninosLine),
    precioPaxExtra    : safeNumber(adultosLine?.precioPaxExtra || ninosLine?.precioPaxExtra),
    montoServicio     : split.total,
    codSuplidor       : '',
    subTotal          ,
    porDescuento      : 0,
    descuento         ,
    neto              : split.neto,
    impuesto          : split.iva,
    estado            : normalizeDetalleEstado(detalleForm?.estado),
    observacion       : safeString(detalleForm?.observaciones),
    pasajeros           
  };
}

export function mapActividadSavePayloadToDraftServiceLines(
  saveData: ActividadModalSavePayload,
  lineaInicial: number,
  directo: string,
  options?: Partial<ReservaDraftCalculationOptions>,
  tipoServicioBase?: string
): ReservaDraftServiceLine[] {
  const settings = getCalculationOptions(options);
  const pickup = (saveData?.pickups ?? [])[0];

  const activityItems = (saveData?.payload ?? []).filter((item) => safeNumber(item?.montoServicio) > 0);
  const baseLines = activityItems.map((item, index) => {
    const pasajeros = (item.detallesPax ?? [])
      .map((pax) => buildPassengerLineFromTotal(pax.tipoPax, pax.cantidad, pax.precioNeto, directo, settings))
      .filter((pax) => !!pax.tipoPax && pax.cantidad > 0);

    const subTotal = roundCurrency(
      pasajeros.reduce((sum, pax) => sum + safeNumber(pax.subtotalNeto), 0) || safeNumber(item.montoServicio),
      settings.redondeoDecimales
    );

    return {
      index,
      item,
      pasajeros,
      subTotal
    };
  });

  const subTotalGeneral = roundCurrency(
    baseLines.reduce((sum, line) => sum + safeNumber(line.subTotal), 0),
    settings.redondeoDecimales
  );
  const totalGeneralSinDescuento = roundCurrency(
    baseLines.reduce((sum, line) => sum + calculateTaxFromNetAmount(line.subTotal, directo, settings).total, 0),
    settings.redondeoDecimales
  );
  const descuentoTotalSolicitado = roundCurrency(
    Math.min(safeNumber(saveData?.descuentoMonto), totalGeneralSinDescuento),
    settings.redondeoDecimales
  );
  const hayDescuento = descuentoTotalSolicitado > 0 && totalGeneralSinDescuento > 0;
  const descuentoFinalTotal = hayDescuento
    ? descuentoTotalSolicitado
    : roundCurrency(settings.descuentoDefault, settings.redondeoDecimales);
  let descuentoFinalPendiente = descuentoFinalTotal;

  return baseLines.map((line, index) => {
    const lineTotalSinDescuento = calculateTaxFromNetAmount(line.subTotal, directo, settings).total;
    const descuentoFinalLinea =
      hayDescuento && totalGeneralSinDescuento > 0
        ? index === baseLines.length - 1
          ? roundCurrency(descuentoFinalPendiente, settings.redondeoDecimales)
          : roundCurrency((lineTotalSinDescuento / totalGeneralSinDescuento) * descuentoFinalTotal, settings.redondeoDecimales)
        : roundCurrency(settings.descuentoDefault, settings.redondeoDecimales);
    descuentoFinalPendiente = roundCurrency(Math.max(0, descuentoFinalPendiente - descuentoFinalLinea), settings.redondeoDecimales);

    const descuento = lineTotalSinDescuento > 0
      ? roundCurrency(Math.min(line.subTotal, descuentoFinalLinea * (line.subTotal / lineTotalSinDescuento)), settings.redondeoDecimales)
      : 0;
    const neto = roundCurrency(Math.max(0, line.subTotal - descuento), settings.redondeoDecimales);
    const split = calculateTaxFromNetAmount(neto, directo, settings);
    const porDescuento = line.subTotal > 0
      ? roundCurrency((descuento / line.subTotal) * 100, settings.redondeoDecimales)
      : 0;

    return {
      linea             : lineaInicial + line.index,
      source             : 'actividad',
      tipoServicio       : normalizeTipoServicio(line.item.tipoServicio || tipoServicioBase || '', 'TOUR'),
      codServicio        : safeString(line.item.codServicio),
      nomServicio        : safeString(line.item.nomServicio),
      fecServicio        : safeString(line.item.fecServicio || saveData?.fechaServicio),
      horaServicio       : safeString(line.item.horaServicio || saveData?.horaInicio || saveData?.horaPickup),
      horaPickup         : safeString(line.item.horaPickup || saveData?.horaPickup),
      origenTexto        : safeString(pickup?.direccion),
      zonaOrigen         : safeString(pickup?.zona),
      origenGoogle       : safeString(pickup?.google),
      origenPlaceId      : safeString(pickup?.placeId),
      origenLat          : safeNumber(pickup?.lat),
      origenLng          : safeNumber(pickup?.lng),
      destinoTexto       : '',
      zonaDestino        : '',
      destinoGoogle      : '',
      destinoPlaceId     : '',
      destinoLat         : 0,
      destinoLng         : 0,
      adultos            : line.pasajeros.filter((pax) => isAdultoTipoPax(pax.tipoPax)).reduce((sum, pax) => sum + pax.cantidad, 0),
      ninos              : line.pasajeros.filter((pax) => isNinoTipoPax(pax.tipoPax)).reduce((sum, pax) => sum + pax.cantidad, 0),
      totalPax           : line.pasajeros.reduce((sum, pax) => sum + pax.cantidad, 0),
      planTarifa         : safeString(saveData?.planTarifario),
      codLstPrecio       : safeString(saveData?.codLstPrecio),
      codPlan            : safeString(saveData?.codPlan),
      idReglaPrecio      : safeNumber(line.item.reglaPrecioID),
      precioAdulto       : getActividadPrecioUnitario(line.pasajeros, 'ADULTO'),
      precioNino         : getActividadPrecioUnitario(line.pasajeros, 'NINO'),
      precioPaxExtra     : 0,
      montoServicio      : split.total,
      codSuplidor        : '',
      subTotal           : line.subTotal,
      porDescuento,
      descuento,
      neto               : split.neto,
      impuesto           : split.iva,
      estado             : 'PEN',
      observacion        : safeString(saveData?.observaciones),
      pasajeros          : line.pasajeros
    } as ReservaDraftServiceLine;
  });

}
export function replaceDraftServiceLine(draft: ReservaCreateV2Draft, nextLine: ReservaDraftServiceLine): ReservaCreateV2Draft {
  const servicios = [...(draft?.servicios ?? [])];
  const index = servicios.findIndex((item) => item.linea === nextLine.linea);
  if (index >= 0) {
    servicios[index] = nextLine;
  } else {
    servicios.push(nextLine);
  }

  return {
    ...draft,
    servicios: servicios.sort((a, b) => a.linea - b.linea)
  };
}

export function removeDraftServiceLine(draft: ReservaCreateV2Draft, linea: number): ReservaCreateV2Draft {
  return {
    ...draft,
    servicios: (draft?.servicios ?? []).filter((item) => item.linea !== linea)
  };
}

export function getNextDraftLinea(servicios: ReservaDraftServiceLine[]): number {
  const max = (servicios ?? []).reduce((current, item) => Math.max(current, safeNumber(item?.linea)), 0);
  return max + 1;
}

export function calculateDraftTotals(servicios: ReservaDraftServiceLine[]): ReservaDraftTotals {
  const { redondeoDecimales } = getDefaultCalculationOptions();
  return (servicios ?? []).reduce<ReservaDraftTotals>(
    (acc, item) => ({
      totalServicios: roundCurrency(acc.totalServicios + safeNumber(item?.montoServicio), redondeoDecimales),
      totalNeto: roundCurrency(acc.totalNeto + safeNumber(item?.neto), redondeoDecimales),
      totalImpuesto: roundCurrency(acc.totalImpuesto + safeNumber(item?.impuesto), redondeoDecimales)
    }),
    { totalServicios: 0, totalNeto: 0, totalImpuesto: 0 }
  );
}

function mapDraftServiceLineToDto(item: ReservaDraftServiceLine): ReservaToursDetalleServicioDto {
  return {
    linea               : safeNumber(item.linea),
    tipoServicio        : normalizeTipoServicio(item.tipoServicio),
    codServicio         : safeString(item.codServicio),
    nomServicio         : safeString(item.nomServicio),
    fecServicio         : formatDateToApiDate(item.fecServicio),
    horaServicio        : safeString(item.horaServicio),
    horaPickup          : safeString(item.horaPickup),
    origenTexto         : safeString(item.origenTexto),
    zonaOrigen          : safeString(item.zonaOrigen),
    origenGoogle        : safeString(item.origenGoogle),
    origenPlaceId       : safeString(item.origenPlaceId),
    origenLat           : safeNumber(item.origenLat),
    origenLng           : safeNumber(item.origenLng),
    destinoTexto        : safeString(item.destinoTexto),
    zonaDestino         : safeString(item.zonaDestino),
    destinoGoogle       : safeString(item.destinoGoogle),
    destinoPlaceId      : safeString(item.destinoPlaceId),
    destinoLat          : safeNumber(item.destinoLat),
    destinoLng          : safeNumber(item.destinoLng),
    adultos             : safeNumber(item.adultos),
    ninos               : safeNumber(item.ninos),
    totalPax            : safeNumber(item.totalPax),
    planTarifa          : safeString(item.planTarifa),
    codLstPrecio        : safeString(item.codLstPrecio),
    idReglaPrecio       : safeNumber(item.idReglaPrecio),
    precioAdulto        : safeNumber(item.precioAdulto),
    precioNino          : safeNumber(item.precioNino),
    precioPaxExtra      : safeNumber(item.precioPaxExtra),
    montoServicio       : safeNumber(item.montoServicio),
    codSuplidor         : safeString(item.codSuplidor),
    subTotal            : safeNumber(item.subTotal),
    porDescuento        : safeNumber(item.porDescuento),
    descuento           : safeNumber(item.descuento),
    neto                : safeNumber(item.neto),
    impuesto            : safeNumber(item.impuesto),
    estado              : normalizeDetalleEstado(item.estado),
    observacion         : safeString(item.observacion)
  };
}

function mapDraftPassengerLineToDto(linea: number, item: ReservaDraftPassengerLine): ReservaToursDetallePasajeroDto {
  return {
    linea                 : safeNumber(linea),
    tipoPax               : safeString(item.tipoPax),
    cantidad              : safeNumber(item.cantidad),
    precioUnitarioNeto    : safeNumber(item.precioUnitarioNeto),
    precioUnitarioIVA     : safeNumber(item.precioUnitarioIVA),
    precioUnitarioTotal   : safeNumber(item.precioUnitarioTotal),
    subtotalNeto          : safeNumber(item.subtotalNeto),
    subtotalIVA           : safeNumber(item.subtotalIVA),
    subtotalTotal         : safeNumber(item.subtotalTotal)
  };
}

export function buildReservaToursPayloadFromDraft(
  draft: ReservaCreateV2Draft,
  tipo: number,
  codReserva?: string
): ReservaToursPayloadDto {
  const header = draft?.header ?? buildInitialReservaCreateV2HeaderDraft();
  const servicios = (draft?.servicios ?? []).sort((a, b) => a.linea - b.linea);
  const totals = calculateDraftTotals(servicios);
  const dateRange = calculatePayloadDateRange(header, servicios);

  return {
    tipo              : safeNumber(tipo),
    codReserva        : emptyToNull(codReserva ?? header.codReserva),
    codAgencia        : safeString(header.codAgencia),
    idContacto        : safeNumber(header.idContacto),
    nomCliente        : safeString(header.nomCliente),
    telCliente        : safeString(header.telCliente),
    emailCliente      : safeString(header.emailCliente),
    idioma            : safeString(header.idioma),
    formaReserva      : safeString(header.formaReservacion),
    formaPago         : safeString(header.formaPago),
    codLstPrecio      : safeString(header.codLstPrecio),
    codPlan           : safeString(header.codPlan),
    fecCreacion       : formatDateToApiDate(header.fecha),
    fecConfirma       : emptyToNull(formatDateToApiDate(header.fecConfirma)),
    fecAnulada        : emptyToNull(formatDateToApiDate(header.fecAnulada)),
    fecIngresa        : dateRange.fecIngresa,
    fecSalida         : dateRange.fecSalida,
    fecPrepago        : emptyToNull(formatDateToApiDate(header.fecPrepago)),
    totNoches         : dateRange.totNoches,
    totDias           : dateRange.totDias,
    descripcion       : safeString(header.descripcion),
    tCambio           : safeNumber(header.tCambio),
    folio             : safeString(header.folio),
    estado            : normalizeReservaEstadoForPayload(header.estado),
    moneda            : safeString(header.moneda),
    totalRsv          : totals.totalServicios,
    observacion       : safeString(header.comentarios),
    procesado         : safeNumber(header.procesado),
    directo           : normalizeDirecto(header.directo),
    cntHabitaciones   : safeNumber(header.cntHabitaciones),
    operador          : safeString(header.operador),
    detalleServicios  : servicios.map(mapDraftServiceLineToDto),
    detallePasajeros  : servicios.flatMap((item) => (item.pasajeros ?? []).map((pax) => mapDraftPassengerLineToDto(item.linea, pax))),
    pageNumber        : 1,
    pageSize          : DEFAULT_POST_PAGE_SIZE,
    respuesta         : ''
  };
}









