import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { DetalleListaPrecioV2Service } from './detalle-lista-precio-v2.service';
import { ServiciosService, ServicioUI } from '../servicios/servicios.service';
import {
  DetalleListaPrecioV2State,
  EditableField,
  Moneda,
  PaginacionDto,
  PrecioTipoPaxVm,
  ReglaPrecioDetalleDto,
  ReglaPrecioCreateDto,
  ReglaPrecioListItemDto,
  ReglaPrecioVm,
  ReglasFiltroVm,
  ServicioResumenDto,
  TipoPax,
  TipoPaxDto
} from './detalle-lista-precio-v2.models';
import {
  createEditableField,
  mapDtoToVm,
  mapVmToPreciosBody,
  mapVmToUpdateReglaBody,
  mergeDetalleIntoVm
} from './detalle-lista-precio-v2.mappers';
import { normalizeTipoPax, toBackendTipoPax } from './detalle-lista-precio-v2.utils';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_TIPO_TARIFA = 'A';
const DEFAULT_MONEDA: Moneda = 'USD';
const DEFAULT_TIPO_PAX: TipoPax[] = ['PAx', 'CHL', 'NAC'];
const DEFAULT_TIPO_PAX_LABELS: Record<TipoPax, string> = {
  PAx: 'PAX',
  CHL: 'CHL',
  NAC: 'NAC'
};

@Component({
  selector: 'app-detalle-lista-precio-v2',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './detalle-lista-precio-v2.component.html',
  styleUrls: ['./detalle-lista-precio-v2.component.scss']
})
export class DetalleListaPrecioV2Component implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(DetalleListaPrecioV2Service);
  private readonly serviciosService = inject(ServiciosService);
  private readonly auth = inject(AuthService);

  codLstPrecio = '';
  desLstPrecio = '';

  filtros: ReglasFiltroVm = {
    codLstPrecio: '',
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    soloActivos: true
  };

  state: DetalleListaPrecioV2State = {
    reglas: [],
    paginacion: {
      totalRegistros: 0,
      paginaActual: 1,
      pageSize: DEFAULT_PAGE_SIZE
    },
    loading: false,
    error: ''
  };

  servicios: ServicioResumenDto[] = [];
  selectedServicio = '';
  tipoPaxCatalog: TipoPaxCatalogItem[] = [];

  pageSizeOptions = [10, 20, 50];

  isCreating = false;

  private readonly saveTimers: Record<number, ReturnType<typeof setTimeout>> = {};

  ngOnInit(): void {
    const codLstPrecio = (this.route.snapshot.paramMap.get('codLstPrecio') || this.route.snapshot.paramMap.get('id') || '').trim();
    if (!codLstPrecio) {
      this.volverAListas();
      return;
    }

    this.codLstPrecio = codLstPrecio;
    this.filtros = {
      ...this.filtros,
      codLstPrecio,
      pageNumber: 1
    };

    this.loadTiposPax();
    this.loadServicios();
    this.loadReglas();
  }

  ngOnDestroy(): void {
    Object.values(this.saveTimers).forEach((timer) => clearTimeout(timer));
  }

  get reglas(): ReglaPrecioVm[] {
    return this.state.reglas;
  }

  get paginacion(): PaginacionDto {
    return this.state.paginacion;
  }

  get totalPages(): number {
    const total = this.paginacion.totalRegistros ?? 0;
    const size = this.paginacion.pageSize || DEFAULT_PAGE_SIZE;
    return Math.max(1, Math.ceil(total / size));
  }

  trackByReglaId(_: number, regla: ReglaPrecioVm): number {
    return regla.id;
  }

  trackByPrecioTipo(_: number, precio: PrecioTipoPaxVm): TipoPax {
    return precio.tipoPax;
  }

  onFiltroChange(): void {
    this.filtros = {
      ...this.filtros,
      pageNumber: 1,
      pageSize: this.toNumber(this.filtros.pageSize, DEFAULT_PAGE_SIZE)
    };
    this.loadReglas();
  }

  onPageSizeChange(): void {
    this.onFiltroChange();
  }

  goToPage(delta: number): void {
    const next = (this.paginacion.paginaActual ?? 1) + delta;
    if (next < 1 || next > this.totalPages) {
      return;
    }
    this.filtros = {
      ...this.filtros,
      pageNumber: next
    };
    this.loadReglas();
  }

  loadReglas(): void {
    this.state = {
      ...this.state,
      loading: true,
      error: ''
    };

    this.service
      .getReglas(this.filtros)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const reglas = (response?.datos ?? []).map((item) => mapDtoToVm(item));
          const des = response?.datos?.[0]?.DesLstPrecio ?? '';
          this.desLstPrecio = this.desLstPrecio || des;
          this.state = {
            ...this.state,
            reglas,
            paginacion: response?.paginacion ?? this.state.paginacion,
            loading: false,
            error: ''
          };
          this.preloadDetalles(reglas);
        },
        error: () => {
          this.state = {
            ...this.state,
            reglas: [],
            loading: false,
            error: 'No se pudieron cargar las reglas de precios.'
          };
        }
      });
  }

  loadServicios(): void {
    this.serviciosService
      .getServiciosActivosAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!this.selectedServicio && this.servicios.length > 0) {
            this.selectedServicio = this.getServicioCodigo(this.servicios[0]);
          }
        })
      )
      .subscribe({
        next: (servicios) => {
          this.servicios = (servicios ?? []).map((item) => this.mapServicio(item));
        },
        error: () => {
          this.servicios = [];
        }
      });
  }

  onServicioFilterChange(codServicio: string): void {
    this.selectedServicio = codServicio;
    if (this.filtros.codServicio) {
      this.filtros = {
        ...this.filtros,
        codServicio: undefined
      };
    }
  }

  addRegla(): void {
    if (!this.selectedServicio || this.isCreating) {
      return;
    }

    this.isCreating = true;
    const preciosBase = this.getTipoPaxDefaults();
    const body: ReglaPrecioCreateDto = {
      codLstPrecio: this.codLstPrecio,
      codServicio: this.selectedServicio,
      tipoTarifa: DEFAULT_TIPO_TARIFA,
      moneda: DEFAULT_MONEDA,
      cantMinPax: 1,
      cantMaxPax: 1,
      horaDesde: '08:00',
      horaHasta: '09:00',
      observaciones: '',
      operador: this.getOperador(),
      precios: preciosBase.map((tipo) => ({
        tipoPax: tipo.code,
        precio: 0,
        paxExtra: 0,
        cantPaxMax: 1,
        porcentajeComision: 0,
        montoComision: 0
      }))
    };

    this.service
      .createRegla(body)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isCreating = false;
        })
      )
      .subscribe({
        next: (response) => {
          const vm = this.mapCreateResponse(response, body);
          if (!vm) {
            this.loadReglas();
            return;
          }
          const withDefaults = this.ensurePrecios(vm);
          this.state = {
            ...this.state,
            reglas: [{ ...withDefaults, expanded: true }, ...this.reglas],
            error: ''
          };
        },
        error: () => {
          this.state = {
            ...this.state,
            error: 'No se pudo crear la regla.'
          };
        }
      });
  }

  toggleExpand(reglaId: number): void {
    const regla = this.findRegla(reglaId);
    if (!regla) {
      return;
    }
    const nextExpanded = !regla.expanded;

    this.updateRegla(reglaId, (current) => ({
      ...current,
      expanded: nextExpanded
    }));

    if (nextExpanded && !regla.detalleLoaded && !regla.loadingDetalle) {
      this.loadDetalle(reglaId);
    }
  }

  saveRegla(reglaId: number): void {
    const regla = this.findRegla(reglaId);
    if (!regla || regla.saving || !regla.dirty) {
      return;
    }

    const validated = this.validateRegla(regla);
    if (this.hasReglaErrors(validated)) {
      this.updateRegla(reglaId, () => validated);
      return;
    }

    this.updateRegla(reglaId, (current) => ({ ...current, saving: true, error: '' }));
    const body = mapVmToUpdateReglaBody(validated);

    this.service
      .updateRegla(reglaId, body)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.updateRegla(reglaId, (current) => ({ ...current, saving: false }));
        })
      )
      .subscribe({
        next: () => {
          this.updateRegla(reglaId, (current) => this.markReglaSaved(current));
        },
        error: () => {
          this.updateRegla(reglaId, (current) => ({
            ...current,
            error: 'No se pudo guardar la regla.'
          }));
        }
      });
  }

  desactivarRegla(reglaId: number): void {
    const regla = this.findRegla(reglaId);
    if (!regla || regla.saving) {
      return;
    }

    this.updateRegla(reglaId, (current) => ({ ...current, saving: true, error: '' }));

    this.service
      .desactivarRegla(reglaId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.updateRegla(reglaId, (current) => ({ ...current, saving: false }));
        })
      )
      .subscribe({
        next: () => {
          this.updateRegla(reglaId, (current) => {
            const nextActivo = createEditableField(false);
            return {
              ...current,
              activo: nextActivo,
              dirty: this.computeReglaDirty({ ...current, activo: nextActivo }),
              error: ''
            };
          });
        },
        error: () => {
          this.updateRegla(reglaId, (current) => ({
            ...current,
            error: 'No se pudo desactivar la regla.'
          }));
        }
      });
  }

  onFieldChange(reglaId: number, field: ReglaFieldKey, value: unknown): void {
    const updated = this.updateRegla(reglaId, (current) => {
      const next = { ...current };
      switch (field) {
        case 'cantMinPax':
          next.cantMinPax = this.updateField(current.cantMinPax, this.toNumber(value, 0));
          break;
        case 'cantMaxPax':
          next.cantMaxPax = this.updateField(current.cantMaxPax, this.toNumber(value, 0));
          break;
        case 'horaDesde':
          next.horaDesde = this.updateField(current.horaDesde, `${value ?? ''}`.trim());
          break;
        case 'horaHasta':
          next.horaHasta = this.updateField(current.horaHasta, `${value ?? ''}`.trim());
          break;
        case 'moneda':
          next.moneda = this.updateField(current.moneda, (value as Moneda) ?? DEFAULT_MONEDA);
          break;
        case 'observaciones':
          next.observaciones = this.updateField(current.observaciones, `${value ?? ''}`);
          break;
        case 'activo':
          next.activo = this.updateField(current.activo, !!value);
          break;
        default:
          break;
      }

      return this.validateRegla({
        ...next,
        dirty: this.computeReglaDirty(next)
      });
    });

    if (!updated) {
      return;
    }

    if (!this.hasReglaErrors(updated) && updated.dirty) {
      this.scheduleSave(reglaId);
    }
  }

  onPrecioChange(reglaId: number, tipoPax: TipoPax, field: PrecioFieldKey, value: unknown): void {
    this.updateRegla(reglaId, (current) => {
      const precios = current.precios.map((precio) => {
        if (precio.tipoPax !== tipoPax) {
          return precio;
        }
        const next = { ...precio };
        switch (field) {
          case 'precio':
            next.precio = this.updateField(precio.precio, this.toNumber(value, 0));
            break;
          case 'paxExtra':
            next.paxExtra = this.updateField(precio.paxExtra, this.toNumber(value, 0));
            break;
          case 'cantPaxMax':
            next.cantPaxMax = this.updateField(precio.cantPaxMax, this.toNumber(value, 1));
            break;
          case 'porcentajeComision':
            if (precio.porcentajeComision) {
              next.porcentajeComision = this.updateField(precio.porcentajeComision, this.toNullableNumber(value));
            }
            break;
          case 'montoComision':
            if (precio.montoComision) {
              next.montoComision = this.updateField(precio.montoComision, this.toNullableNumber(value));
            }
            break;
          default:
            break;
        }
        return this.validatePrecio(next);
      });

      return {
        ...current,
        precios,
        preciosError: ''
      };
    });
  }

  savePrecios(reglaId: number): void {
    const regla = this.findRegla(reglaId);
    if (!regla || regla.savingPrecios) {
      return;
    }

    const validated = this.validatePrecios(regla);
    if (validated.preciosError) {
      this.updateRegla(reglaId, () => validated);
      return;
    }

    this.updateRegla(reglaId, (current) => ({ ...current, savingPrecios: true, preciosError: '' }));

    this.service
      .updatePrecios(reglaId, mapVmToPreciosBody(validated, this.getOperador()))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.updateRegla(reglaId, (current) => ({ ...current, savingPrecios: false }));
        })
      )
      .subscribe({
        next: () => {
          this.updateRegla(reglaId, (current) => ({
            ...this.markPreciosSaved(current),
            expanded: false
          }));
        },
        error: () => {
          this.updateRegla(reglaId, (current) => ({
            ...current,
            preciosError: 'No se pudieron guardar los precios.'
          }));
        }
      });
  }

  isPreciosDirty(regla: ReglaPrecioVm): boolean {
    return regla.precios.some((precio) =>
      [precio.precio, precio.paxExtra, precio.cantPaxMax, precio.porcentajeComision, precio.montoComision]
        .filter(Boolean)
        .some((field) => (field as EditableField<unknown>).dirty)
    );
  }

  getServicioLabel(codServicio: string): string {
    const servicio = this.servicios.find((item) => this.getServicioCodigo(item) === codServicio);
    if (!servicio) {
      return codServicio;
    }
    const nombre = servicio.NomServicio || servicio.NomReceta || servicio.DesServicio || servicio.Descripcion || '';
    return nombre || codServicio;
  }

  volverAListas(): void {
    this.router.navigate(['/catalogos/listas-precios']);
  }

  private loadDetalle(reglaId: number): void {
    this.updateRegla(reglaId, (current) => ({ ...current, loadingDetalle: true }));

    this.service
      .getReglaDetalle(reglaId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.updateRegla(reglaId, (current) => ({ ...current, loadingDetalle: false }));
        })
      )
      .subscribe({
        next: (detalle) => {
          this.updateRegla(reglaId, (current) => this.ensurePrecios(mergeDetalleIntoVm(current, detalle)));
        },
        error: () => {
          this.updateRegla(reglaId, (current) => ({
            ...current,
            error: 'No se pudo cargar el detalle de la regla.'
          }));
        }
      });
  }

  private preloadDetalles(reglas: ReglaPrecioVm[]): void {
    reglas.forEach((regla) => {
      if (!regla.detalleLoaded && !regla.loadingDetalle) {
        this.loadDetalle(regla.id);
      }
    });
  }

  private updateRegla(reglaId: number, updater: (current: ReglaPrecioVm) => ReglaPrecioVm): ReglaPrecioVm | null {
    let updated: ReglaPrecioVm | null = null;
    this.state = {
      ...this.state,
      reglas: this.state.reglas.map((regla) => {
        if (regla.id !== reglaId) {
          return regla;
        }
        updated = updater(regla);
        return updated;
      })
    };
    return updated;
  }

  private findRegla(reglaId: number): ReglaPrecioVm | undefined {
    return this.reglas.find((regla) => regla.id === reglaId);
  }

  private scheduleSave(reglaId: number): void {
    if (this.saveTimers[reglaId]) {
      clearTimeout(this.saveTimers[reglaId]);
    }
    this.saveTimers[reglaId] = setTimeout(() => this.saveRegla(reglaId), 600);
  }

  private validateRegla(regla: ReglaPrecioVm): ReglaPrecioVm {
    const min = this.toNumber(regla.cantMinPax.value, 0);
    const max = this.toNumber(regla.cantMaxPax.value, 0);
    let paxError = '';
    if (min < 0 || max < 0) {
      paxError = 'Los pax no pueden ser negativos.';
    } else if (min > max) {
      paxError = 'CantMinPax no puede ser mayor que CantMaxPax.';
    }

    const horaError = this.validateHora(regla.horaDesde.value, regla.horaHasta.value);

    return {
      ...regla,
      cantMinPax: { ...regla.cantMinPax, error: paxError },
      cantMaxPax: { ...regla.cantMaxPax, error: paxError },
      horaDesde: { ...regla.horaDesde, error: horaError },
      horaHasta: { ...regla.horaHasta, error: horaError }
    };
  }

  private validateHora(desde: string, hasta: string): string {
    if (!desde || !hasta) {
      return '';
    }
    const desdeSec = this.parseTime(desde);
    const hastaSec = this.parseTime(hasta);
    if (desdeSec === null || hastaSec === null) {
      return 'Formato de hora invalido.';
    }
    if (desdeSec > hastaSec) {
      return 'Hora desde debe ser menor o igual que hora hasta.';
    }
    return '';
  }

  private hasReglaErrors(regla: ReglaPrecioVm): boolean {
    return Boolean(regla.cantMinPax.error || regla.cantMaxPax.error || regla.horaDesde.error || regla.horaHasta.error);
  }

  private computeReglaDirty(regla: ReglaPrecioVm): boolean {
    return [
      regla.tipoTarifa,
      regla.cantMinPax,
      regla.cantMaxPax,
      regla.horaDesde,
      regla.horaHasta,
      regla.moneda,
      regla.observaciones,
      regla.activo
    ].some((field) => field.dirty);
  }

  private updateField<T>(field: EditableField<T>, value: T): EditableField<T> {
    const dirty = !this.isEqual(value, field.original);
    return {
      ...field,
      value,
      dirty
    };
  }

  private isEqual(a: unknown, b: unknown): boolean {
    return a === b;
  }

  private validatePrecio(precio: PrecioTipoPaxVm): PrecioTipoPaxVm {
    const precioError = precio.precio.value < 0 ? 'Precio >= 0.' : '';
    const paxExtraError = precio.paxExtra.value < 0 ? 'PaxExtra >= 0.' : '';
    const cantError = precio.cantPaxMax.value <= 0 ? 'CantPaxMax > 0.' : '';

    return {
      ...precio,
      precio: { ...precio.precio, error: precioError },
      paxExtra: { ...precio.paxExtra, error: paxExtraError },
      cantPaxMax: { ...precio.cantPaxMax, error: cantError }
    };
  }

  private validatePrecios(regla: ReglaPrecioVm): ReglaPrecioVm {
    let hasError = false;
    const precios = regla.precios.map((precio) => {
      const validated = this.validatePrecio(precio);
      const hasFieldError = Boolean(
        validated.precio.error || validated.paxExtra.error || validated.cantPaxMax.error
      );
      if (hasFieldError) {
        hasError = true;
      }
      return validated;
    });

    return {
      ...regla,
      precios,
      preciosError: hasError ? 'Revise los precios antes de guardar.' : ''
    };
  }

  private markReglaSaved(regla: ReglaPrecioVm): ReglaPrecioVm {
    return {
      ...regla,
      tipoTarifa: this.resetField(regla.tipoTarifa),
      cantMinPax: this.resetField(regla.cantMinPax),
      cantMaxPax: this.resetField(regla.cantMaxPax),
      horaDesde: this.resetField(regla.horaDesde),
      horaHasta: this.resetField(regla.horaHasta),
      moneda: this.resetField(regla.moneda),
      observaciones: this.resetField(regla.observaciones),
      activo: this.resetField(regla.activo),
      dirty: false,
      error: ''
    };
  }

  private markPreciosSaved(regla: ReglaPrecioVm): ReglaPrecioVm {
    const precios = regla.precios.map((precio) => ({
      ...precio,
      precio: this.resetField(precio.precio),
      paxExtra: this.resetField(precio.paxExtra),
      cantPaxMax: this.resetField(precio.cantPaxMax),
      porcentajeComision: precio.porcentajeComision ? this.resetField(precio.porcentajeComision) : undefined,
      montoComision: precio.montoComision ? this.resetField(precio.montoComision) : undefined
    }));
    return {
      ...regla,
      precios,
      preciosError: ''
    };
  }

  private resetField<T>(field: EditableField<T>): EditableField<T> {
    return {
      ...field,
      original: field.value,
      dirty: false,
      error: ''
    };
  }

  private ensurePrecios(regla: ReglaPrecioVm): ReglaPrecioVm {
    if (regla.precios.length === 0) {
      return {
        ...regla,
        precios: DEFAULT_TIPO_PAX.map((tipo) => this.buildPrecioDefault(tipo))
      };
    }
    const byTipo = new Map(regla.precios.map((item) => [item.tipoPax, item]));
    const normalized = DEFAULT_TIPO_PAX.map((tipo) => byTipo.get(tipo) ?? this.buildPrecioDefault(tipo));
    return {
      ...regla,
      precios: normalized
    };
  }

  private buildPrecioDefault(tipo: TipoPax): PrecioTipoPaxVm {
    return {
      tipoPax: tipo,
      tipoPaxCodigo: toBackendTipoPax(tipo),
      precio: createEditableField(0),
      paxExtra: createEditableField(0),
      cantPaxMax: createEditableField(1)
    };
  }

  private buildPrecioFromDefaults(item: {
    TipoPax?: TipoPax | string;
    tipoPax?: string;
    Precio?: unknown;
    precio?: unknown;
    PaxExtra?: unknown;
    paxExtra?: unknown;
    CantPaxMax?: unknown;
    cantPaxMax?: unknown;
  }): PrecioTipoPaxVm {
    const rawTipo = item.TipoPax ?? item.tipoPax ?? '';
    const normalized = normalizeTipoPax(rawTipo);
    return {
      tipoPax: normalized,
      tipoPaxCodigo: `${rawTipo ?? ''}`.trim() || toBackendTipoPax(normalized),
      precio: createEditableField(this.toNumber(item.Precio ?? item.precio, 0)),
      paxExtra: createEditableField(this.toNumber(item.PaxExtra ?? item.paxExtra, 0)),
      cantPaxMax: createEditableField(this.toNumber(item.CantPaxMax ?? item.cantPaxMax, 1))
    };
  }

  private mapCreateResponse(
    response: ReglaPrecioDetalleDto | ReglaPrecioListItemDto,
    defaults: ReglaPrecioCreateDto
  ): ReglaPrecioVm | null {
    if (response && typeof response === 'object' && 'ReglaPrecioID' in response) {
      const base = mapDtoToVm(response as ReglaPrecioListItemDto);
      if ('Precios' in response) {
        return mergeDetalleIntoVm(base, response as ReglaPrecioDetalleDto);
      }
      return base;
    }

    const id = this.extractId(response);
    if (!id) {
      return null;
    }

    const dto: ReglaPrecioListItemDto = {
      ReglaPrecioID: id,
      CodLstPrecio: `${defaults.codLstPrecio ?? ''}`,
      DesLstPrecio: this.desLstPrecio,
      CodServicio: `${defaults.codServicio ?? ''}`,
      TipoTarifa: `${defaults.tipoTarifa ?? DEFAULT_TIPO_TARIFA}`,
      CantMinPax: this.toNumber(defaults.cantMinPax, 1),
      CantMaxPax: this.toNumber(defaults.cantMaxPax, 1),
      HoraDesde: `${defaults.horaDesde ?? ''}`,
      HoraHasta: `${defaults.horaHasta ?? ''}`,
      Moneda: `${defaults.moneda ?? DEFAULT_MONEDA}`,
      Observaciones: `${defaults.observaciones ?? ''}`,
      Activo: true,
      Operador: '',
      FechaRegistro: ''
    };
    const vm = mapDtoToVm(dto);
    const precios = (defaults.precios ?? []).map((p) =>
      this.buildPrecioFromDefaults({ tipoPax: p.tipoPax, precio: p.precio, paxExtra: p.paxExtra, cantPaxMax: p.cantPaxMax })
    );
    return {
      ...vm,
      precios: precios ?? [],
      detalleLoaded: true
    };
  }

  private extractId(value: unknown): number {
    if (!value || typeof value !== 'object') {
      return 0;
    }
    const record = value as Record<string, unknown>;
    const candidates = ['ReglaPrecioID', 'ReglaPrecioId', 'reglaPrecioId', 'id'];
    for (const key of candidates) {
      const candidate = Number(record[key]);
      if (Number.isFinite(candidate) && candidate > 0) {
        return candidate;
      }
    }
    return 0;
  }

  private getServicioCodigo(servicio: ServicioResumenDto): string {
    return (servicio.CodServicio || servicio.CodReceta || '').trim();
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }

  private loadTiposPax(): void {
    this.service
      .getTiposPax()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tipos) => {
          this.tipoPaxCatalog = this.mapTiposPax(tipos);
        },
        error: () => {
          this.tipoPaxCatalog = [];
        }
      });
  }

  private mapTiposPax(tipos: TipoPaxDto[]): TipoPaxCatalogItem[] {
    const sorted = [...(tipos ?? [])].sort((a, b) => (a.CR03_Orden ?? 0) - (b.CR03_Orden ?? 0));
    const mapped = sorted.map((item) => {
      const code = (item.CR03_CodTipo || '').trim().toUpperCase();
      const normalized = normalizeTipoPax(code);
      return {
        code: code || toBackendTipoPax(normalized),
        label: (item.CR03_Descripcion || '').trim() || DEFAULT_TIPO_PAX_LABELS[normalized],
        tipoPax: normalized
      } as TipoPaxCatalogItem;
    });

    const byTipo = new Map<TipoPax, TipoPaxCatalogItem>();
    mapped.forEach((item) => {
      if (!byTipo.has(item.tipoPax)) {
        byTipo.set(item.tipoPax, item);
      }
    });
    DEFAULT_TIPO_PAX.forEach((tipo) => {
      if (!byTipo.has(tipo)) {
        byTipo.set(tipo, {
          code: toBackendTipoPax(tipo),
          label: DEFAULT_TIPO_PAX_LABELS[tipo],
          tipoPax: tipo
        });
      }
    });
    return Array.from(byTipo.values());
  }

  private getTipoPaxDefaults(): TipoPaxCatalogItem[] {
    if (this.tipoPaxCatalog.length > 0) {
      return this.tipoPaxCatalog;
    }
    return DEFAULT_TIPO_PAX.map((tipo) => ({
      code: toBackendTipoPax(tipo),
      label: DEFAULT_TIPO_PAX_LABELS[tipo],
      tipoPax: tipo
    }));
  }

  private mapServicio(servicio: ServicioUI): ServicioResumenDto {
    const codigo = (servicio.codReceta || '').trim();
    return {
      CodServicio: codigo,
      CodReceta: codigo,
      NomServicio: servicio.nomReceta,
      NomReceta: servicio.nomReceta,
      Descripcion: servicio.descripcion
    };
  }

  private toNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return this.toNumber(value, 0);
  }

  private parseTime(value: string): number | null {
    const parts = value.split(':').map((part) => Number(part));
    if (parts.length < 2 || parts.some((p) => Number.isNaN(p))) {
      return null;
    }
    const [hours, minutes, seconds] = [parts[0], parts[1], parts[2] ?? 0];
    return hours * 3600 + minutes * 60 + seconds;
  }
}

type ReglaFieldKey =
  | 'cantMinPax'
  | 'cantMaxPax'
  | 'horaDesde'
  | 'horaHasta'
  | 'moneda'
  | 'observaciones'
  | 'activo';

type PrecioFieldKey = 'precio' | 'paxExtra' | 'cantPaxMax' | 'porcentajeComision' | 'montoComision';

interface TipoPaxCatalogItem {
  code: string;
  label: string;
  tipoPax: TipoPax;
}
