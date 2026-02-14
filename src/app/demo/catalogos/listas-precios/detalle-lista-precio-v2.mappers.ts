import {
  EditableField,
  Moneda,
  PrecioTipoPaxDto,
  PrecioTipoPaxVm,
  ReglaPrecioDetalleDto,
  ReglaPrecioListItemDto,
  ReglaPrecioPreciosUpdateDto,
  ReglaPrecioVm
} from './detalle-lista-precio-v2.models';
import { normalizeTipoPax, toBackendTipoPax } from './detalle-lista-precio-v2.utils';

const defaultMoneda: Moneda = 'USD';

export const createEditableField = <T>(value: T): EditableField<T> => ({
  value,
  original: value,
  dirty: false,
  error: ''
});

const coerceString = (value: unknown): string => (value ?? '').toString().trim();

const coerceNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return normalized === 'S' || normalized === '1' || normalized === 'TRUE';
  }
  return false;
};

const normalizeMoneda = (value: unknown): Moneda => {
  const normalized = coerceString(value).toUpperCase();
  return normalized === 'CRC' ? 'CRC' : 'USD';
};

const normalizeTipoTarifa = (value: unknown): string => {
  const text = coerceString(value);
  return text || 'A';
};


const getPrecioValue = (item: Record<string, unknown>, key: string, altKey: string): unknown =>
  item[key] ?? item[altKey];

const buildPrecioVm = (item: PrecioTipoPaxDto | Record<string, unknown>): PrecioTipoPaxVm => {
  const record = item as Record<string, unknown>;
  const rawTipo =
    getPrecioValue(record, 'TipoPax', 'tipoPax') ??
    getPrecioValue(record, 'TipoPaxCodigo', 'tipoPaxCodigo');
  const rawPrecio = getPrecioValue(record, 'Precio', 'precio');
  const rawPaxExtra =
    getPrecioValue(record, 'PaxExtra', 'paxExtra') ??
    getPrecioValue(record, 'PrecioExtra', 'precioExtra');
  const rawCantMax =
    getPrecioValue(record, 'CantPaxMax', 'cantPaxMax') ??
    getPrecioValue(record, 'CantMaxPax', 'cantMaxPax');
  const rawPorcentaje = getPrecioValue(record, 'PorcentajeComision', 'porcentajeComision');
  const rawMonto = getPrecioValue(record, 'MontoComision', 'montoComision');

  return {
    tipoPax: normalizeTipoPax(rawTipo),
    tipoPaxCodigo: coerceString(rawTipo) || toBackendTipoPax(normalizeTipoPax(rawTipo)),
    precio: createEditableField(coerceNumber(rawPrecio, 0)),
    paxExtra: createEditableField(coerceNumber(rawPaxExtra, 0)),
    cantPaxMax: createEditableField(coerceNumber(rawCantMax, 1)),
    porcentajeComision:
      rawPorcentaje !== undefined ? createEditableField(coerceNumber(rawPorcentaje, 0)) : undefined,
    montoComision: rawMonto !== undefined ? createEditableField(coerceNumber(rawMonto, 0)) : undefined
  };
};

const mergeEditableField = <T>(field: EditableField<T>, value: T): EditableField<T> => {
  if (field.dirty) {
    return field;
  }
  return createEditableField(value);
};

export const mapDtoToVm = (item: ReglaPrecioListItemDto): ReglaPrecioVm => {
  return {
    id: coerceNumber(item.ReglaPrecioID, 0),
    codLstPrecio: coerceString(item.CodLstPrecio),
    desLstPrecio: coerceString(item.DesLstPrecio),
    codServicio: coerceString(item.CodServicio),
    tipoTarifa: createEditableField(normalizeTipoTarifa(item.TipoTarifa)),
    cantMinPax: createEditableField(coerceNumber(item.CantMinPax, 0)),
    cantMaxPax: createEditableField(coerceNumber(item.CantMaxPax, 0)),
    horaDesde: createEditableField(coerceString(item.HoraDesde)),
    horaHasta: createEditableField(coerceString(item.HoraHasta)),
    moneda: createEditableField(normalizeMoneda(item.Moneda) ?? defaultMoneda),
    observaciones: createEditableField(coerceString(item.Observaciones ?? '')),
    activo: createEditableField(coerceBoolean(item.Activo)),
    operador: coerceString(item.Operador),
    fechaRegistro: coerceString(item.FechaRegistro),
    precios: [],
    expanded: false,
    loadingDetalle: false,
    detalleLoaded: false,
    saving: false,
    savingPrecios: false,
    error: '',
    preciosError: '',
    dirty: false
  };
};

const extractDetallePrecios = (detalle: ReglaPrecioDetalleDto | Record<string, unknown>): Record<string, unknown>[] => {
  const record = detalle as Record<string, unknown>;
  const precios = (record['Precios'] ?? record['precios'] ?? []) as Record<string, unknown>[];
  return Array.isArray(precios) ? precios : [];
};

const extractDetalleRegla = (detalle: ReglaPrecioDetalleDto | Record<string, unknown>): Record<string, unknown> => {
  const record = detalle as Record<string, unknown>;
  const regla = (record['regla'] ?? record['Regla'] ?? record) as Record<string, unknown>;
  return regla && typeof regla === 'object' ? regla : record;
};

export const mergeDetalleIntoVm = (vm: ReglaPrecioVm, detalle: ReglaPrecioDetalleDto): ReglaPrecioVm => {
  const regla = extractDetalleRegla(detalle);
  const precios = extractDetallePrecios(detalle).map(buildPrecioVm);
  return {
    ...vm,
    id: coerceNumber(regla['ReglaPrecioID'], vm.id),
    codLstPrecio: coerceString(regla['CodLstPrecio']) || vm.codLstPrecio,
    desLstPrecio: coerceString(regla['DesLstPrecio']) || vm.desLstPrecio,
    codServicio: coerceString(regla['CodServicio']) || vm.codServicio,
    tipoTarifa: mergeEditableField(vm.tipoTarifa, normalizeTipoTarifa(regla['TipoTarifa'])),
    cantMinPax: mergeEditableField(vm.cantMinPax, coerceNumber(regla['CantMinPax'], 0)),
    cantMaxPax: mergeEditableField(vm.cantMaxPax, coerceNumber(regla['CantMaxPax'], 0)),
    horaDesde: mergeEditableField(vm.horaDesde, coerceString(regla['HoraDesde'])),
    horaHasta: mergeEditableField(vm.horaHasta, coerceString(regla['HoraHasta'])),
    moneda: mergeEditableField(vm.moneda, normalizeMoneda(regla['Moneda'] ?? regla['MonedaLista'])),
    observaciones: mergeEditableField(vm.observaciones, coerceString(regla['Observaciones'] ?? '')),
    activo: mergeEditableField(vm.activo, coerceBoolean(regla['Activo'])),
    operador: coerceString(regla['Operador']) || vm.operador,
    fechaRegistro: coerceString(regla['FechaRegistro']) || vm.fechaRegistro,
    precios,
    detalleLoaded: true,
    loadingDetalle: false,
    preciosError: ''
  };
};

export const mapVmToUpdateReglaBody = (vm: ReglaPrecioVm): Record<string, unknown> => {
  return {
    ReglaPrecioID: vm.id,
    CodLstPrecio: vm.codLstPrecio,
    CodServicio: vm.codServicio,
    TipoTarifa: vm.tipoTarifa.value,
    CantMinPax: vm.cantMinPax.value,
    CantMaxPax: vm.cantMaxPax.value,
    HoraDesde: vm.horaDesde.value,
    HoraHasta: vm.horaHasta.value,
    Moneda: vm.moneda.value,
    Observaciones: vm.observaciones.value,
    Activo: vm.activo.value
  };
};

export const mapVmToPreciosBody = (vm: ReglaPrecioVm, operador?: string): ReglaPrecioPreciosUpdateDto => {
  return {
    reglaPrecioId: vm.id,
    operador: operador || undefined,
    precios: vm.precios.map((precio) => ({
      tipoPax: precio.tipoPaxCodigo || toBackendTipoPax(precio.tipoPax),
      precio: precio.precio.value,
      paxExtra: precio.paxExtra.value,
      cantPaxMax: precio.cantPaxMax.value,
      porcentajeComision: precio.porcentajeComision?.value ?? undefined,
      montoComision: precio.montoComision?.value ?? undefined
    }))
  };
};
