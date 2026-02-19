import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
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

// Valores por defecto usados en filtros y precios.
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
  imports: [CommonModule, SharedModule, FormsModule, ReactiveFormsModule],
  templateUrl: './detalle-lista-precio-v2.component.html',
  styleUrls: ['./detalle-lista-precio-v2.component.scss']
})
export class DetalleListaPrecioV2Component implements OnInit, OnDestroy {
  // Inyecciones de dependencias.
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(DetalleListaPrecioV2Service);
  private readonly serviciosService = inject(ServiciosService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  // Identificadores de la lista seleccionada.
  codLstPrecio = '';
  desLstPrecio = '';

  // Filtros de busqueda/paginacion.
  filtros: ReglasFiltroVm = {
    codLstPrecio: '',
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    soloActivos: true
  };

  // Estado UI de reglas y paginacion.
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

  // Catalogos y seleccion actual.
  servicios: ServicioResumenDto[] = [];
  selectedServicio = '';
  tipoPaxCatalog: TipoPaxCatalogItem[] = [];

  // Opciones de pagina para el selector.
  pageSizeOptions = [10, 20, 50];

  // Bandera de creacion para evitar doble submit.
  isCreating = false;

  // Timers de guardado y cache de forms por regla/tipo.
  private readonly saveTimers: Record<number, ReturnType<typeof setTimeout>> = {};
  private readonly precioForms = new Map<number, Map<TipoPax, FormGroup>>();

  // Inicializa estado, lee codLstPrecio y dispara cargas iniciales.
  ngOnInit(): void {
    const codLstPrecio = (this.route.snapshot.paramMap.get('codLstPrecio') || this.route.snapshot.paramMap.get('id') || '').trim();
    if (!codLstPrecio) {
      this.volverAListas();
      return;
    }

    this.hydrateDescripcion();
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

  // Limpia timers pendientes.
  ngOnDestroy(): void {
    Object.values(this.saveTimers).forEach((timer) => clearTimeout(timer));
  }

  // Expose reglas actuales para la plantilla.
  get reglas(): ReglaPrecioVm[] {
    return this.state.reglas;
  }

  // Expose paginacion actual.
  get paginacion(): PaginacionDto {
    return this.state.paginacion;
  }

  // Calcula total de paginas en base a la paginacion.
  get totalPages(): number {
    const total = this.paginacion.totalRegistros ?? 0;
    const size = this.paginacion.pageSize || DEFAULT_PAGE_SIZE;
    return Math.max(1, Math.ceil(total / size));
  }

  // Optimiza ngFor usando el id de regla.
  trackByReglaId(_: number, regla: ReglaPrecioVm): number {
    return regla.id;
  }

  // Optimiza ngFor usando el tipo de pax.
  trackByPrecioTipo(_: number, precio: PrecioTipoPaxVm): TipoPax {
    return precio.tipoPax;
  }

  // Devuelve el form group de precio para regla/tipo.
  getPrecioFormGroup(reglaId: number, tipoPax: TipoPax): FormGroup | null {
    return this.precioForms.get(reglaId)?.get(tipoPax) ?? null;
  }

  // Aplica cambios de filtros y recarga reglas.
  onFiltroChange(): void {
    this.filtros = {
      ...this.filtros,
      pageNumber: 1,
      pageSize: this.toNumber(this.filtros.pageSize, DEFAULT_PAGE_SIZE)
    };
    this.loadReglas();
  }

  // Handler de cambio de page size.
  onPageSizeChange(): void {
    this.onFiltroChange();
  }

  // Navega a una pagina relativa si es valida.
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

  // Carga reglas desde servicio y actualiza estado.
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
          this.prunePrecioForms(reglas);
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

  // Carga catalogo de servicios activos.
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

  // Actualiza servicio seleccionado y limpia filtro si aplica.
  onServicioFilterChange(codServicio: string): void {
    this.selectedServicio = codServicio;
    if (this.filtros.codServicio) {
      this.filtros = {
        ...this.filtros,
        codServicio: undefined
      };
    }
  }

  // Crea una nueva regla con precios por defecto.
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
          this.ensurePrecioForms(withDefaults);
        },
        error: () => {
          this.state = {
            ...this.state,
            error: 'No se pudo crear la regla.'
          };
        }
      });
  }

  // Expande/colapsa regla y carga detalle si aplica.
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

  // Guarda cambios de cabecera de una regla.
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

  // Desactiva una regla via servicio.
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

  // Actualiza un campo editable y agenda guardado si aplica.
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

  // Asegura forms de precios por tipo dentro de la regla.
  private ensurePrecioForms(regla: ReglaPrecioVm): void {
    if (!regla.precios?.length) {
      return;
    }
    let byTipo = this.precioForms.get(regla.id);
    if (!byTipo) {
      byTipo = new Map<TipoPax, FormGroup>();
      this.precioForms.set(regla.id, byTipo);
    }

    regla.precios.forEach((precio) => {
      const existing = byTipo?.get(precio.tipoPax);
      if (!existing) {
        byTipo?.set(precio.tipoPax, this.buildPrecioFormGroup(regla.id, precio));
      } else {
        this.patchPrecioFormGroup(existing, precio);
      }
    });
  }

  // Construye el form group para una fila de precios.
  private buildPrecioFormGroup(reglaId: number, precio: PrecioTipoPaxVm): FormGroup {
    const porcentaje = this.normalizePercent(precio.porcentajeComision.value);
    const neto = this.calculateNeto(precio.precio.value, porcentaje);
    const form = this.fb.group({
      precio: [precio.precio.value],
      paxExtra: [precio.paxExtra.value],
      cantPaxMax: [precio.cantPaxMax.value],
      porcentajeComision: [porcentaje],
      montoComision: [neto]
    });
    this.bindPrecioFormGroup(reglaId, precio.tipoPax, form);
    return form;
  }

  // Sincroniza form group con la vm de precios.
  private patchPrecioFormGroup(form: FormGroup, precio: PrecioTipoPaxVm): void {
    const porcentaje = this.normalizePercent(precio.porcentajeComision.value);
    const neto = this.calculateNeto(precio.precio.value, porcentaje);
    form.patchValue(
      {
        precio: precio.precio.value,
        paxExtra: precio.paxExtra.value,
        cantPaxMax: precio.cantPaxMax.value,
        porcentajeComision: porcentaje,
        montoComision: neto
      },
      { emitEvent: false }
    );
  }

  // Vincula cambios del form con la regla.
  private bindPrecioFormGroup(reglaId: number, tipoPax: TipoPax, form: FormGroup): void {
    ['precio', 'porcentajeComision', 'paxExtra', 'cantPaxMax'].forEach((controlName) => {
      const control = form.get(controlName);
      if (!control) {
        return;
      }
      control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.handlePrecioFormChange(reglaId, tipoPax, form);
      });
    });
    this.handlePrecioFormChange(reglaId, tipoPax, form);
  }

  // Calcula neto y actualiza vm a partir del form.
  private handlePrecioFormChange(reglaId: number, tipoPax: TipoPax, form: FormGroup): void {
    const raw = form.getRawValue() as {
      precio: unknown;
      paxExtra: unknown;
      cantPaxMax: unknown;
      porcentajeComision: unknown;
      montoComision: unknown;
    };
    const precioRack = this.toNumber(raw.precio, 0);
    const porcentaje = this.normalizePercent(raw.porcentajeComision);
    const neto = this.calculateNeto(precioRack, porcentaje);

    if (this.toNumber(raw.montoComision, 0) !== neto) {
      form.patchValue({ montoComision: neto }, { emitEvent: false });
    }

    this.updatePrecioFromForm(reglaId, tipoPax, {
      precio: precioRack,
      paxExtra: this.toNumber(raw.paxExtra, 0),
      cantPaxMax: this.toNumber(raw.cantPaxMax, 1),
      porcentajeComision: porcentaje,
      montoComision: neto
    });
  }

  // Actualiza los precios en la regla.
  private updatePrecioFromForm(
    reglaId: number,
    tipoPax: TipoPax,
    values: {
      precio: number;
      paxExtra: number;
      cantPaxMax: number;
      porcentajeComision: number;
      montoComision: number;
    }
  ): void {
    this.updateRegla(reglaId, (current) => {
      const precios = current.precios.map((precio) => {
        if (precio.tipoPax !== tipoPax) {
          return precio;
        }
        const porcentajeField = precio.porcentajeComision;
        const montoField = precio.montoComision;
        const updated: PrecioTipoPaxVm = {
          ...precio,
          precio: this.updateField(precio.precio, values.precio),
          paxExtra: this.updateField(precio.paxExtra, values.paxExtra),
          cantPaxMax: this.updateField(precio.cantPaxMax, values.cantPaxMax),
          porcentajeComision: this.updateField(porcentajeField, values.porcentajeComision),
          montoComision: this.updateField(montoField, values.montoComision)
        };
        return this.validatePrecio(updated);
      });

      return {
        ...current,
        precios,
        preciosError: ''
      };
    });
  }

  // Recalcula el neto para todos los precios.
  private recalculateNetoForRegla(reglaId: number): ReglaPrecioVm | null {
    const updated = this.updateRegla(reglaId, (current) => {
      const precios = current.precios.map((precio) => {
        const porcentajeField = precio.porcentajeComision;
        const montoField = precio.montoComision;
        const porcentaje = this.normalizePercent(porcentajeField.value);
        const neto = this.calculateNeto(precio.precio.value, porcentaje);
        return {
          ...precio,
          porcentajeComision: this.updateField(porcentajeField, porcentaje),
          montoComision: this.updateField(montoField, neto)
        };
      });

      return {
        ...current,
        precios,
        preciosError: ''
      };
    });

    if (updated) {
      const byTipo = this.precioForms.get(reglaId);
      updated.precios.forEach((precio) => {
        const form = byTipo?.get(precio.tipoPax);
        if (form) {
          form.patchValue({ montoComision: precio.montoComision.value }, { emitEvent: false });
        }
      });
    }

    return updated;
  }

  // Guarda precios de una regla.
  savePrecios(reglaId: number): void {
    const regla = this.findRegla(reglaId);
    if (!regla || regla.savingPrecios) {
      return;
    }

    const recalculated = this.recalculateNetoForRegla(reglaId) ?? regla;
    const validated = this.validatePrecios(recalculated);
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

  // Detecta si hay cambios pendientes en precios.
  isPreciosDirty(regla: ReglaPrecioVm): boolean {
    return regla.precios.some((precio) =>
      [precio.precio, precio.paxExtra, precio.cantPaxMax, precio.porcentajeComision, precio.montoComision]
        .filter(Boolean)
        .some((field) => (field as EditableField<unknown>).dirty)
    );
  }

  // Resuelve el label visible del servicio.
  getServicioLabel(codServicio: string): string {
    const servicio = this.servicios.find((item) => this.getServicioCodigo(item) === codServicio);
    if (!servicio) {
      return codServicio;
    }
    const nombre = servicio.NomServicio || servicio.NomReceta || servicio.DesServicio || servicio.Descripcion || '';
    return nombre || codServicio;
  }

  // Navega al listado principal de listas de precios.
  volverAListas(): void {
    this.router.navigate(['/catalogos/listas-precios']);
  }

  // Lee descripcion desde query params o history state.
  private hydrateDescripcion(): void {
    const queryDescripcion = (this.route.snapshot.queryParamMap.get('desLstPrecio') || '').trim();
    const navState = this.router.getCurrentNavigation()?.extras.state as { desLstPrecio?: string } | undefined;
    const historyState = (history?.state ?? {}) as { desLstPrecio?: string };
    const stateDescripcion = `${navState?.desLstPrecio ?? historyState?.desLstPrecio ?? ''}`.trim();
    const descripcion = queryDescripcion || stateDescripcion;
    if (descripcion) {
      this.desLstPrecio = descripcion;
    }
  }

  // Carga detalle de una regla especifica.
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
          const updated = this.updateRegla(reglaId, (current) => this.ensurePrecios(mergeDetalleIntoVm(current, detalle)));
          if (updated) {
            this.ensurePrecioForms(updated);
          }
        },
        error: () => {
          this.updateRegla(reglaId, (current) => ({
            ...current,
            error: 'No se pudo cargar el detalle de la regla.'
          }));
        }
      });
  }

  // Precarga detalle para reglas sin cargar.
  private preloadDetalles(reglas: ReglaPrecioVm[]): void {
    reglas.forEach((regla) => {
      if (!regla.detalleLoaded && !regla.loadingDetalle) {
        this.loadDetalle(regla.id);
      }
    });
  }

  // Elimina forms de reglas que ya no existen.
  private prunePrecioForms(reglas: ReglaPrecioVm[]): void {
    const ids = new Set(reglas.map((regla) => regla.id));
    Array.from(this.precioForms.keys()).forEach((reglaId) => {
      if (!ids.has(reglaId)) {
        this.precioForms.delete(reglaId);
      }
    });
  }

  // Actualiza una regla dentro del state.
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

  // Busca una regla por id.
  private findRegla(reglaId: number): ReglaPrecioVm | undefined {
    return this.reglas.find((regla) => regla.id === reglaId);
  }

  // Agenda guardado con debounce.
  private scheduleSave(reglaId: number): void {
    if (this.saveTimers[reglaId]) {
      clearTimeout(this.saveTimers[reglaId]);
    }
    this.saveTimers[reglaId] = setTimeout(() => this.saveRegla(reglaId), 600);
  }

  // Valida la regla y agrega errores de campos.
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

  // Valida rango horario.
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

  // Determina si la regla tiene errores.
  private hasReglaErrors(regla: ReglaPrecioVm): boolean {
    return Boolean(regla.cantMinPax.error || regla.cantMaxPax.error || regla.horaDesde.error || regla.horaHasta.error);
  }

  // Determina si la regla tiene cambios.
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

  private setFieldValue<T>(field: EditableField<T>, value: T, resetOriginal: boolean): EditableField<T> {
    if (resetOriginal) {
      return {
        ...field,
        value,
        original: value,
        dirty: false,
        error: ''
      };
    }
    return this.updateField(field, value);
  }

  private updateField<T>(field: EditableField<T>, value: T): EditableField<T> {
    const dirty = !this.isEqual(value, field.original);
    return {
      ...field,
      value,
      dirty
    };
  }

  // Comparador simple de igualdad.
  private isEqual(a: unknown, b: unknown): boolean {
    return a === b;
  }

  // Valida campos de precio individuales.
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

  // Valida lista de precios y setea error global.
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

  // Resetea estado dirty al guardar regla.
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

  // Resetea estado dirty al guardar precios.
  private markPreciosSaved(regla: ReglaPrecioVm): ReglaPrecioVm {
    const precios = regla.precios.map((precio) => ({
      ...precio,
      precio: this.resetField(precio.precio),
      paxExtra: this.resetField(precio.paxExtra),
      cantPaxMax: this.resetField(precio.cantPaxMax),
      porcentajeComision: this.resetField(precio.porcentajeComision),
      montoComision: this.resetField(precio.montoComision)
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

  // Asegura precios para todos los tipos de pax.
  private ensurePrecios(regla: ReglaPrecioVm): ReglaPrecioVm {
    if (regla.precios.length === 0) {
      return {
        ...regla,
        precios: DEFAULT_TIPO_PAX.map((tipo) => this.normalizePrecio(this.buildPrecioDefault(tipo), true))
      };
    }
    const byTipo = new Map(regla.precios.map((item) => [item.tipoPax, item]));
    const normalized = DEFAULT_TIPO_PAX.map((tipo) => byTipo.get(tipo) ?? this.buildPrecioDefault(tipo)).map((precio) =>
      this.normalizePrecio(precio, true)
    );
    return {
      ...regla,
      precios: normalized
    };
  }

  // Normaliza porcentaje y neto para un precio.
  private normalizePrecio(precio: PrecioTipoPaxVm, resetOriginal: boolean): PrecioTipoPaxVm {
    const porcentajeField = precio.porcentajeComision;
    const porcentaje = this.normalizePercent(porcentajeField.value);
    const montoField = precio.montoComision;
    const neto = this.calculateNeto(precio.precio.value, porcentaje);
    return {
      ...precio,
      porcentajeComision: this.setFieldValue(porcentajeField, porcentaje, resetOriginal),
      montoComision: this.setFieldValue(montoField, neto, resetOriginal)
    };
  }

  // Construye precio default por tipo de pax.
  private buildPrecioDefault(tipo: TipoPax): PrecioTipoPaxVm {
    return {
      tipoPax: tipo,
      tipoPaxCodigo: toBackendTipoPax(tipo),
      precio: createEditableField(0),
      paxExtra: createEditableField(0),
      cantPaxMax: createEditableField(1),
      porcentajeComision: createEditableField(0),
      montoComision: createEditableField(0)
    };
  }

  // Construye precio desde defaults del backend.
  private buildPrecioFromDefaults(item: {
    TipoPax?: TipoPax | string;
    tipoPax?: string;
    Precio?: unknown;
    precio?: unknown;
    PaxExtra?: unknown;
    paxExtra?: unknown;
    CantPaxMax?: unknown;
    cantPaxMax?: unknown;
    PorcentajeComision?: unknown;
    porcentajeComision?: unknown;
    MontoComision?: unknown;
    montoComision?: unknown;
  }): PrecioTipoPaxVm {
    const rawTipo = item.TipoPax ?? item.tipoPax ?? '';
    const normalized = normalizeTipoPax(rawTipo);
    return {
      tipoPax: normalized,
      tipoPaxCodigo: `${rawTipo ?? ''}`.trim() || toBackendTipoPax(normalized),
      precio: createEditableField(this.toNumber(item.Precio ?? item.precio, 0)),
      paxExtra: createEditableField(this.toNumber(item.PaxExtra ?? item.paxExtra, 0)),
      cantPaxMax: createEditableField(this.toNumber(item.CantPaxMax ?? item.cantPaxMax, 1)),
      porcentajeComision: createEditableField(this.toNumber(item.PorcentajeComision ?? item.porcentajeComision, 0)),
      montoComision: createEditableField(this.toNumber(item.MontoComision ?? item.montoComision, 0))
    };
  }

  // Mapea respuesta de crear regla a view model.
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

  // Extrae id de una respuesta generica.
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

  // Obtiene el codigo del servicio.
  private getServicioCodigo(servicio: ServicioResumenDto): string {
    return (servicio.CodServicio || servicio.CodReceta || '').trim();
  }

  // Obtiene el usuario operador actual.
  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }

  // Carga catalogo de tipos de pax.
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

  // Mapea dto de tipos pax a catalogo.
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

  // Devuelve tipos pax por defecto.
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

  // Mapea servicio UI a resumen.
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

  // Convierte a numero con fallback.
  private toNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // Normaliza porcentaje a numero.
  private normalizePercent(value: unknown): number {
    return this.toNumber(value ?? 0, 0);
  }

  // Calcula precio neto desde rack y porcentaje.
  private calculateNeto(precioRack: number, porcentaje: number): number {
    const rack = this.toNumber(precioRack, 0);
    const percent = this.normalizePercent(porcentaje);
    const neto = rack - (rack * percent) / 100;
    return this.roundToTwo(neto);
  }

  // Redondea a dos decimales.
  private roundToTwo(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Number(value.toFixed(2));
  }

  // Convierte HH:mm(:ss) a segundos.
  private parseTime(value: string): number | null {
    const parts = value.split(':').map((part) => Number(part));
    if (parts.length < 2 || parts.some((p) => Number.isNaN(p))) {
      return null;
    }
    const [hours, minutes, seconds] = [parts[0], parts[1], parts[2] ?? 0];
    return hours * 3600 + minutes * 60 + seconds;
  }
}

// Campos editables de la regla usados por onFieldChange.
type ReglaFieldKey =
  | 'cantMinPax'
  | 'cantMaxPax'
  | 'horaDesde'
  | 'horaHasta'
  | 'moneda'
  | 'observaciones'
  | 'activo';

// Catalogo local de tipos pax para UI.
interface TipoPaxCatalogItem {
  code: string;
  label: string;
  tipoPax: TipoPax;
}
