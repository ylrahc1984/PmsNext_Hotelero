import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, filter, firstValueFrom, map, take } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { ReservasService } from '../services/reservas.service';
import { ReservaDetalle } from '../services/reserva-detalle.service';
import { DetallePax, DetalleToursCompletoService } from '../services/detalle-tours-completo.service';
import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import { FormaPagoService } from '../../administracion/forma-pago/forma-pago.service';
import { FormaPago } from '../../administracion/forma-pago/forma-pago.models';
import { MonedaService, MonedaUI } from '../../administracion/monedas/moneda.service';

// Tarifa
import { ListaPrecioService } from '../../catalogos/listas-precios/lista-precio.service';
import { PlanesTarifasService, PlanTarifaUI } from '../../catalogos/listas-precios/planes-tarifas.service';

// Tarifa models
import { ListaPrecioUI } from '../../catalogos/listas-precios/lista-precio.models';

import { ClienteService } from '../../catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from '../../catalogos/agencias-comisionistas/cliente.models';
import { ServiciosService, ServicioUI } from '../../catalogos/servicios/servicios.service';
import { IdiomasService } from '../../catalogos/idiomas/idiomas.service';
import { IdiomaDto } from '../../catalogos/idiomas/idiomas.models';
import { FormaReservasService } from '../../catalogos/forma-reservas/forma-reservas.service';
import { FormaReservaDto } from '../../catalogos/forma-reservas/forma-reservas.models';

import { showAlertWithFocusRestore } from './reserva-create.alert';
import { buildInitialActividadDetalleForm, buildInitialDetalleForm, buildInitialReservaCreateForm } from './reserva-create.builders';
import { clearReservaCreateDraftCod, getReservaCreateDraftCod, setReservaCreateDraftCod } from './reserva-create.draft-storage';
import { ActividadDetalleForm, DetalleForm, DetallePaxForm, ReservaCreateForm, ReservaEstado } from './reserva-create.models';
import {
  extractCodReserva,
  extractGoogleDisplayText,
  hasCoordinates,
  normalizeTimeInputValue,
  normalizeReservaEstado,
  parseCodigoValue,
  parseNumericId,
  safeNumber,
  safeJsonStringify,
  safeString,
  toDateInputValue
} from './reserva-create.utils';
import { ReservaCreateTarifaService, ReglaTarifaPaxAplicada, ModoPrecio } from './reserva-create.tarifa.service';
import { ServicioPrecioApiItem } from './reserva-create.tarifa.models';
import { TipoPaxService, TipoPaxUI } from '../services/tipo-pax.service';
import { ReservaCreateClienteModalComponent } from './reserva-create-cliente-modal.component';
import { ReservaCreateDetalleModalComponent } from './reserva-create-detalle-modal.component';
import { ActividadModalSavePayload, ReservaCreateActividadModalComponent } from './reserva-create-actividad-modal.component';

type ReservaDetalleCompleto = ReservaDetalle & { detallesPax: DetallePax[] };

@Component({
  selector: 'app-reserva-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    ReservaCreateClienteModalComponent,
    ReservaCreateDetalleModalComponent,
    ReservaCreateActividadModalComponent
  ],
  templateUrl: './reserva-create.component.html',
  styleUrls: ['./reserva-create.component.scss']
})
export class ReservaCreateComponent implements OnInit, CanDeactivateReservaCreate {
  form: ReservaCreateForm = buildInitialReservaCreateForm();
  detalles: ReservaDetalleCompleto[] = [];
  detalleForm: DetalleForm = buildInitialDetalleForm();
  actividadForm: ActividadDetalleForm = buildInitialActividadDetalleForm();
  showDetalleModal = false;
  showActividadModal = false;
  editingDetalleId: number | null = null;
  editingActividadId: number | null = null;
  guardado = false;

  idiomas: IdiomaDto[] = [];
  formasReservacion: FormaReservaDto[] = [];
  formasPagoApi: FormaPago[] = [];
  listaPrecios: ListaPrecioUI[] = [];
  planesTarifas: PlanTarifaUI[] = [];
  monedas: MonedaUI[] = [];
  servicios: ServicioUI[] = [];
  serviciosPrecio: ServicioPrecioApiItem[] = [];
  tiposPax: TipoPaxUI[] = [];

  reglaTarifaError = '';
  allowManualPricing = false;

  showClienteModal = false;
  selectedCliente: ClienteUI | null = null;
  serviciosLoading = false;
  serviciosPrecioLoading = false;
  guardandoDetalle = false;
  guardandoActividad = false;
  detalleServicioSearch = '';
  directoUpdating = false;

  private reservasService = inject(ReservasService);
  private detalleService = inject(DetalleToursCompletoService);
  private router = inject(Router);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  private formaPagoService = inject(FormaPagoService);
  private monedaService = inject(MonedaService);
  private listaPrecioService = inject(ListaPrecioService);
  private planesTarifasService = inject(PlanesTarifasService);
  private tarifaService = inject(ReservaCreateTarifaService);
  private tipoPaxService = inject(TipoPaxService);
  private clienteService = inject(ClienteService);
  private serviciosService = inject(ServiciosService);
  private authService = inject(AuthService);
  private idiomasService = inject(IdiomasService);
  private formaReservasService = inject(FormaReservasService);

  private lastDetalleCodPlan = '';
  private lastDetalleCodLstPrecio = '';
  private lastActividadCodPlan = '';
  private lastActividadCodLstPrecio = '';

  private resolveTipoServicioValue(value: unknown, fallback = ''): string {
    const normalized = safeString(value || fallback).trim().toUpperCase();
    if (!normalized) return '';
    if (normalized === 'TRF' || normalized === 'TRANSFER' || normalized === 'TRASLADO' || normalized === 'TRASLADOS') {
      return 'TRANS';
    }
    if (normalized === 'ACT' || normalized === 'ACTIVIDAD' || normalized === 'ACTIVIDADES' || normalized === 'TOURS') {
      return 'TOUR';
    }
    return normalized;
  }

  private isLikelyPlaceId(value: unknown): boolean {
    const v = safeString(value).trim();
    if (!v) return false;
    // Place IDs suelen verse como "ChIJ..." y no contienen espacios/comas.
    if (/\s|,/.test(v)) return false;
    if (v.length < 10) return false;
    return v.startsWith('ChI') || v.startsWith('GhI') || v.startsWith('E') || v.startsWith('g');
  }

  private resolveDefaultPlanId(): string {
    const plan = (this.planesTarifas ?? [])[0];
    return plan ? String(plan.planId) : '';
  }

  private resolveDefaultListaPrecio(): string {
    const lista = (this.listaPrecios ?? [])[0];
    return lista ? String(lista.codigo) : '';
  }

  private resolvePlanTarifarioNombre(codPlan: unknown): string {
    const normalized = safeString(codPlan).trim();
    if (!normalized) return '';
    const match = (this.planesTarifas ?? []).find((item) => safeString(item?.planId).trim() === normalized);
    return match ? safeString(match.planId) : normalized;
  }

  private updateHeaderTarifaSnapshot(codPlan: string, codLstPrecio: string): void {
    const plan = (codPlan || '').toString().trim();
    const lista = (codLstPrecio || '').toString().trim();
    if (plan) {
      this.form.codPlan = plan;
    }
    if (lista) {
      this.form.codLstPrecio = lista;
    }
  }

  
  codReservaActual: string | null = null;
  loading = false;
  creandoBorrador = false;
  guardandoEncabezado = false;
  confirmando = false;

  showCancelDecisionModal = false;
  cancelDecisionBusy = false;
  cancelDecisionTitle = 'Reserva en borrador';
  cancelDecisionMessage = '';

  private allowNavigation = false;
  private internalNavigation = false;
  private pendingExitResolver: ((allow: boolean) => void) | null = null;
  private pendingExitPromise: Promise<boolean> | null = null;
  private pendingExitMode: 'toListado' | 'allowNext' | 'toUrl' | null = null;
  private pendingExitUrl: string | null = null;
  private draftCreationPromise: Promise<string | null> | null = null;

  /**
   * Punto de entrada del componente.
   * - Carga catálogos (idiomas, formas de reservación, formas de pago, monedas, listas de precios).
   * - Inicializa el flujo de creación/recuperación de reserva (borrador o edición por URL).
   */
  ngOnInit(): void {
    this.cargarIdiomas();
    this.cargarFormasReservacion();
    this.cargarPlanesTarifas();
    void this.cargarListasPrecios();
    this.cargarTiposPax();
    this.cargarMonedaReservaciones();
    this.cargarFormasPago();

    // Luego de cargar catálogos, inicializamos la reserva (borrador o edición).
    this.initReserva();
  }

  private async cargarListasPrecios(): Promise<void> {
    try {
      const pageSize = 200;
      let pageNumber = 1;
      let totalPages = 1;
      const all: ListaPrecioUI[] = [];

      do {
        const res = await firstValueFrom(this.listaPrecioService.getListas({ pageNumber, pageSize }));
        const data = res?.data ?? [];
        all.push(...data);
        totalPages = Number(res?.totalPages ?? 1) || 1;
        pageNumber += 1;
      } while (pageNumber <= totalPages);

      this.listaPrecios = all;
    } catch {
      this.listaPrecios = [];
    }
  }


  /// Carga catálogo de formas de pago para reservaciones y establece un valor por defecto (priorizando el primer registro).
  private cargarFormasPago(): void {
    this.formaPagoService.getAll().subscribe({
      next: (res) => {
        this.formasPagoApi = res;
        // Set default Forma de Pago if not already set
        if (this.formasPagoApi.length > 0 && !this.form.formaPago) {
          this.form.formaPago = this.formasPagoApi[0].codigo;
        }
      },
      error: () => {
        this.formasPagoApi = [];
      }
    });
  }
  /// Carga catálogo de monedas para reservaciones y establece un valor por defecto (priorizando la moneda local).
  private cargarMonedaReservaciones(): void {
    this.monedaService.getAll().subscribe({
      next: (res) => {
        this.monedas = res;
        if (this.monedas.length > 0 && !this.form.moneda) {
          this.form.moneda = this.monedas[0].codMoneda;
        }
      },
      error: () => {
        this.monedas = [];
      }
    });
  }
  /**
   * Carga catálogo de formas de reservación y establece un valor por defecto
   * (priorizando el primer registro activo).
   */
  private cargarFormasReservacion(): void {
    this.formaReservasService.getAll().subscribe({
      next: (res) => {
        const list = (res ?? []).filter((i) => !!i);
        this.formasReservacion = this.mergeFormasReservacion(list);
        if (!this.form.formaReservacion) {
          const firstActive = this.formasReservacion.find((i) => !!i.CA54_Activo) ?? this.formasReservacion[0];
          this.form.formaReservacion = (firstActive?.CA54_Codigo ?? '').trim();
        }
      },
      error: () => {
        this.formasReservacion = [];
      }
    });
  }
  /**
   * Carga catálogo de idiomas y establece un valor por defecto
   * (priorizando el primer registro activo).
   */
  private cargarIdiomas(): void {
    this.idiomasService.getAll().subscribe({
      next: (res) => {
        const list = (res ?? []).filter((i) => !!i);
        this.idiomas = this.mergeIdiomas(list);
        if (!this.form.idioma) {
          const firstActive = this.idiomas.find((i) => !!i.CA53_Activo) ?? this.idiomas[0];
          this.form.idioma = (firstActive?.CA53_Codigo ?? '').trim();
        }
      },
      error: () => {
        this.idiomas = [];
      }
    });
  }

  /**
   * Carga catálogo de planes tarifarios y establece un valor por defecto.
   */
  private cargarPlanesTarifas(): void {
    this.planesTarifasService.getPlanesTarifas(1, 50).subscribe({
      next: (planes) => {
        this.planesTarifas = planes ?? [];
        const currentPlanId = Number(this.form.codPlan ?? 0) || 0;
        const currentExists =
          currentPlanId > 0 && this.planesTarifas.some((plan) => Number(plan?.planId ?? 0) === currentPlanId);
        if (!currentExists && this.planesTarifas.length > 0) {
          this.form.codPlan = String(this.planesTarifas[0].planId);
        }
      },
      error: () => {
        this.planesTarifas = [];
      }
    });
  }

  /**
   * Carga catálogo de tipo pax para el modal de detalle.
   */
  private cargarTiposPax(): void {
    this.tipoPaxService.getTiposPax().subscribe({
      next: (tipos) => {
        this.tiposPax = tipos ?? [];
        this.ensureDetallePaxDefaults();
      },
      error: () => {
        this.tiposPax = [];
      }
    });
  }

  get tiposPaxBase(): TipoPaxUI[] {
    return this.tiposPax ?? [];
  }

  /**
   * Inicializa el contexto de la reserva en tres escenarios:
   * 1) Si la URL trae un código (editar/detalle), carga encabezado y detalle.
   * 2) Si existe un borrador en sessionStorage, lo retoma.
   * 3) Si no hay nada, queda en modo local hasta que una acción requiera persistencia.
   */
  private initReserva(): void {
    // Si viene codReserva por ruta, cargar para edición
    const url = window.location.pathname;
    const match = url.match(/reservas\/(.+?)\/(editar|detalle)/);
    if (match) {
      this.codReservaActual = match[1];
      setReservaCreateDraftCod(this.codReservaActual);
      this.cargarEncabezado(this.codReservaActual);
      this.cargarDetalle(this.codReservaActual);
      return;
    }

    // Caso crítico: refresh / reopen. Si hay un borrador en storage, lo retomamos para NO crear otro código.
    const storedDraft = getReservaCreateDraftCod();
    if (storedDraft) {
      this.resumeDraft(storedDraft);
    }
  }

  /**
   * Retoma un borrador existente (estado PEN).
   * - Si el backend indica que ya no es PEN, descarta el draft local y deja el formulario en modo local.
   * - Si es válido, estabiliza la URL (nueva -> /editar) y carga encabezado/detalle.
   */
  private resumeDraft(codReserva: string): void {
    this.codReservaActual = codReserva;
    this.loading = true;

    this.reservasService.getReservaByCod(codReserva).subscribe({
      next: (res) => {
        const estado = normalizeReservaEstado((res.PRV01_Estado as any) ?? 'PEN');
        if (estado !== 'PEN') {
          clearReservaCreateDraftCod();
          this.codReservaActual = null;
          this.loading = false;
          return;
        }

        // URL estable para sobrevivir refresh (evita crear otro borrador).
        this.navigateInternal(['/operaciones/reservas', codReserva, 'editar'], { replaceUrl: true });

        this.cargarEncabezado(codReserva);
        this.cargarDetalle(codReserva);
        this.guardado = true;
        this.loading = false;
      },
      error: () => {
        clearReservaCreateDraftCod();
        this.codReservaActual = null;
        this.loading = false;
      }
    });
  }

  /**
   * Crea un borrador en backend solo cuando una acción necesita persistencia.
   */
  private async crearBorrador(): Promise<string | null> {
    if (this.codReservaActual) {
      return this.codReservaActual;
    }

    this.creandoBorrador = true;
    const operador = await this.resolveDraftOperador();

    const payload = {
      estado: 'PEN',
      directo: (this.form.directo || '0').toString(),
      totNoches: 0,
      totDias: 0,
      cntHabitaciones: 0,
      fecCreacion: this.form.fecha,
      operador
    };

    try {
      const res = await firstValueFrom(this.reservasService.crearReserva(payload).pipe(take(1)));
      const cod = extractCodReserva(res);
      if (!cod) {
        console.warn('[ReservaCreate] Crear borrador sin codReserva. Response:', res);
        this.showAlert('Error', 'No se recibió el código de reserva al crear el borrador.', 'error');
        return null;
      }

      this.codReservaActual = cod;
      setReservaCreateDraftCod(cod);
      this.navigateInternal(['/operaciones/reservas', cod, 'editar'], { replaceUrl: true });
      this.form.estado = 'PEN';
      this.guardado = true;
      return cod;
    } catch (err) {
      console.error('[ReservaCreate] Crear borrador error:', err);
      this.logHttpError('Crear borrador', err, { payload });
      this.showAlert('Error', 'No se pudo crear el borrador de la reserva.', 'error');
      return null;
    } finally {
      this.creandoBorrador = false;
    }
  }

  private async ensureDraftCreated(): Promise<string | null> {
    if (this.codReservaActual) {
      return this.codReservaActual;
    }

    if (!this.draftCreationPromise) {
      this.draftCreationPromise = this.crearBorrador();
    }

    try {
      return await this.draftCreationPromise;
    } finally {
      this.draftCreationPromise = null;
    }
  }

  private async resolveDraftOperador(): Promise<string> {
    const current = (this.getOperador() || '').trim();
    if (current) {
      return current;
    }

    const waitedUser = await Promise.race([
      firstValueFrom(this.authService.currentUser$.pipe(filter((u) => !!u), take(1))),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200))
    ]).catch(() => null);

    return (waitedUser as { usuario?: string } | null)?.usuario?.trim() || current || 'Sistema';
  }

  /**
   * Carga el encabezado de la reserva desde API y lo mapea a `form`.
   * - Normaliza el estado a PEN/CON/CAN.
   * - Resuelve idioma/forma de reservación cuando la API devuelve ID numérico.
   * - Precarga `selectedCliente` si hay `codAgencia`.
   */
  cargarEncabezado(codReserva: string): void {
    this.loading = true;
    this.reservasService.getReservaByCod(codReserva).subscribe({
      next: (res) => {
        const estadoNormalizado = normalizeReservaEstado((res.PRV01_Estado as any) ?? 'PEN');
        const idiomaRaw = (res as any).PRV01_Idioma;
        const formaRaw = (res as any).PRV01_FormaReserva;
        const codPlanRaw = (res as any).PRV01_CodPlan;
        const idiomaCodigo = parseCodigoValue(idiomaRaw);
        const formaCodigo = parseCodigoValue(formaRaw);
        const codPlanCodigo = parseCodigoValue(codPlanRaw);
        const idiomaId = parseNumericId(idiomaRaw);
        const formaId = parseNumericId(formaRaw);
        const codPlanId = parseNumericId(codPlanRaw);
        const codLstPrecioApi = safeString((res as any).PRV01_CodLstPrecio);
        const directoValue = safeString((res as any).PRV01_Directo).trim();
        const directoNormalized = directoValue === '1' ? '1' : '0';
        this.form = {
          fecha: toDateInputValue(res.PRV01_FecCreacion) || this.form.fecha || '',
          codAgencia: safeString((res as any).PRV01_CodAgencia),
          idContacto: safeNumber((res as any).PRV01_IdContacto),
          nomContactoAgencia: safeString((res as any).PRV01_NomContactoAgencia),
          nomCliente: safeString((res as any).PRV01_NomCliente),
          telCliente: safeString((res as any).PRV01_TelCliente),
          emailCliente: safeString((res as any).PRV01_EmailCliente),
          idioma: idiomaCodigo ?? '',
          formaReservacion: formaCodigo ?? '',
          formaPago: safeString((res as any).PRV01_FormaPago),
          codLstPrecio: codLstPrecioApi,
          codPlan: codPlanCodigo ?? safeString(codPlanRaw),
          moneda: safeString((res as any).PRV01_Moneda),
          directo: directoNormalized,
          estado: estadoNormalizado,
          totalRsv: safeNumber((res as any).PRV01_TotalRsv),
          comentarios: safeString((res as any).PRV01_Observacion)
        };
        if (!this.form.idioma && idiomaId != null) {
          this.resolveIdiomaCodigoFromId(idiomaId);
        }
        if (!this.form.formaReservacion && formaId != null) {
          this.resolveFormaReservacionCodigoFromId(formaId);
        }
        if (!this.form.codPlan && codPlanId != null) {
          this.form.codPlan = String(codPlanId);
        }
        if (codPlanId != null) {
          this.resolveCodPlanFromId(codPlanId);
        }
        if (this.form.codAgencia) {
          this.clienteService.getClienteByCodigo(this.form.codAgencia).subscribe({
            next: (cliente) => {
              this.selectedCliente = cliente;
            },
            error: () => {
              this.selectedCliente = null;
            }
          });
        } else {
          this.selectedCliente = null;
        }
        this.loading = false;
      },
      error: (err) => {
        this.logHttpError('Cargar encabezado', err, { codReserva });
        this.showAlert('Error', 'No se pudo cargar el encabezado.', 'error');
        this.loading = false;
      }
    });
  }

  /**
   * Carga el detalle (servicios) de la reserva desde API y lo asigna a `detalles`.
   */
  cargarDetalle(codReserva: string): void {
    this.loading = true;
    this.detalleService.getDetalleByReserva(codReserva).subscribe({
      next: (res) => {
        const detalleList = Array.isArray(res?.detalle) ? res.detalle : res?.detalle ? [res.detalle] : [];
        const paxList = Array.isArray(res?.detallesPax) ? res.detallesPax : res?.detallesPax ? [res.detallesPax] : [];
        this.detalles = (detalleList ?? []).map((item) => ({
          ...item,
          detallesPax: (paxList ?? []).filter((pax) => Number(pax?.PRV03_PRV02_ID) === Number(item?.PRV02_ID))
        }));
        this.syncTotalReservaFromDetalles();
        this.loading = false;
      },
      error: (err) => {
        this.logHttpError('Cargar detalle', err, { codReserva });
        this.showAlert('Error', 'No se pudo cargar el detalle.', 'error');
        this.loading = false;
      }
    });
  }

  private syncTotalReservaFromDetalles(): void {
    this.form.totalRsv = this.totalRack;
  }

  private getDefaultTipoPaxCode(): string {
    const list = this.tiposPax ?? [];
    const pax = list.find((item) => item.code === 'PAX')?.code;
    return (pax || list[0]?.code || 'PAX').toString().trim().toUpperCase();
  }

  private buildDefaultDetallePax(): DetallePaxForm {
    return {
      tipoPax: this.getDefaultTipoPaxCode(),
      cantidad: 1,
      precioTotal: 0
    };
  }

  private ensureDetallePaxDefaults(): void {
    const list = this.detalleForm?.detallesPax ?? [];
    if (!list.length) {
      this.detalleForm.detallesPax = [this.buildDefaultDetallePax()];
      return;
    }

    const defaultTipo = this.getDefaultTipoPaxCode();
    let changed = false;
    for (const item of list) {
      if (!item.tipoPax && defaultTipo) {
        item.tipoPax = defaultTipo;
        changed = true;
      }
    }
    if (changed) {
      this.detalleForm.detallesPax = [...list];
    }
  }

  private mapDetallePaxFromApi(list: DetallePax[]): DetallePaxForm[] {
    return (list ?? [])
      .map((item) => {
        const cantidad = Number(item?.PRV03_Cantidad ?? 0) || 0;
        const unitario = Number(item?.PRV03_PrecioUnitarioTotal ?? 0) || 0;
        const subtotal = Number(item?.PRV03_SubtotalTotal ?? 0) || 0;
        const precioTotal = subtotal || (unitario * cantidad);
        return {
          tipoPax: (item?.PRV03_TipoPax || '').toString().trim().toUpperCase(),
          cantidad,
          precioTotal: Number(precioTotal ?? 0) || 0,
          precioUnitario: unitario || (cantidad > 0 ? (Number(precioTotal ?? 0) || 0) / cantidad : 0)
        } as DetallePaxForm;
      })
      .filter((item) => !!item.tipoPax);
  }

  private sumPaxPrecioTotal(paxList: Array<{ precioTotal?: number }>): number {
    return (paxList ?? []).reduce((sum, item) => sum + (Number(item?.precioTotal ?? 0) || 0), 0);
  }

  private getDetallePaxItemsForPayload(): DetallePaxForm[] {
    return (this.detalleForm?.detallesPax ?? [])
      .map((item) => ({
        ...item,
        tipoPax: (item?.tipoPax || '').toString().trim().toUpperCase(),
        cantidad: Number(item?.cantidad ?? 0) || 0,
        precioTotal: Number(item?.precioTotal ?? 0) || 0,
        precioUnitario: Number(item?.precioUnitario ?? 0) || 0,
        precioPaxExtra: Number(item?.precioPaxExtra ?? 0) || 0,
        reglaPrecioId: Number(item?.reglaPrecioId ?? 0) || 0
      }))
      .filter((item) => !!item.tipoPax && item.cantidad > 0);
  }

  private getDetallePaxItemsForTarifa(): Array<{ tipoPax: string; cantidad: number }> {
    return this.getDetallePaxItemsForPayload().map((item) => ({
      tipoPax: item.tipoPax,
      cantidad: item.cantidad
    }));
  }

  private mergeTarifaResultados(resultados: ReglaTarifaPaxAplicada[]): void {
    if (!resultados?.length) return;
    const map = new Map(resultados.map((item) => [item.tipoPax, item]));

    this.detalleForm.detallesPax = (this.detalleForm.detallesPax ?? []).map((row) => {
      const tipo = (row.tipoPax || '').toString().trim().toUpperCase();
      const result = map.get(tipo);
      if (!result) return row;

      if (result.error) {
        return {
          ...row,
          manual: true,
          error: result.error
        };
      }

      return {
        ...row,
        precioTotal: Number(result.precioTotal ?? 0) || 0,
        precioUnitario: Number(result.precioUnitario ?? 0) || 0,
        precioPaxExtra: Number(result.precioPaxExtra ?? 0) || 0,
        reglaPrecioId: Number(result.reglaPrecioId ?? 0) || 0,
        manual: false,
        error: ''
      };
    });
  }

  private findDuplicatedTiposPax(codes: string[]): string[] {
    const seen = new Set<string>();
    const duplicated = new Set<string>();
    for (const raw of codes ?? []) {
      const code = (raw || '').toString().trim().toUpperCase();
      if (!code) continue;
      if (seen.has(code)) duplicated.add(code);
      seen.add(code);
    }
    return Array.from(duplicated.values());
  }

  private isNinoTipoPax(code: string): boolean {
    return (code || '').toString().trim().toUpperCase() === 'CHL';
  }

  private isAdultoTipoPax(code: string): boolean {
    const normalized = (code || '').toString().trim().toUpperCase();
    if (!normalized) return false;
    return normalized !== 'CHL';
  }

  private getModoPrecioPorPlan(planId: number): ModoPrecio {
    const normalized = Number(planId ?? 0) || 0;
    if (!normalized) return 'R';
    const plan = (this.planesTarifas ?? []).find((item) => Number(item?.planId ?? 0) === normalized);
    const tipo = (plan?.tipoTarifa || '').toString().trim().toUpperCase();
    return tipo === 'N' ? 'N' : 'R';
  }

  private pickLineaAdultos(paxItems: DetallePaxForm[]): DetallePaxForm | undefined {
    return paxItems.find((item) => this.isAdultoTipoPax(item.tipoPax)) ?? paxItems[0];
  }

  private getPrecioUnitarioFallback(item?: DetallePaxForm): number {
    if (!item) return 0;
    const cantidad = Number(item.cantidad ?? 0) || 0;
    const total = Number(item.precioTotal ?? 0) || 0;
    if (cantidad <= 0) return 0;
    return Number((total / cantidad).toFixed(2));
  }

  private normalizeActividadTipoPax(code: string): string {
    const normalized = (code || '')
      .toString()
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized === 'PAX' || normalized === 'ADT' || normalized === 'ADL') return 'ADULTO';
    if (normalized === 'CHL') return 'NINO';
    if (normalized === 'NAC') return 'NACIONAL';
    if (normalized.startsWith('ADULT')) return 'ADULTO';
    if (normalized.startsWith('NIN')) return 'NINO';
    if (normalized.startsWith('NAC')) return 'NACIONAL';
    return normalized;
  }

  private getActividadPrecioUnitario(
    detalles: Array<{ tipoPax: string; cantidad: number; precioNeto: number }>,
    tipoObjetivo: 'ADULTO' | 'NINO'
  ): number {
    const match = (detalles ?? []).find((item) => this.normalizeActividadTipoPax(item?.tipoPax || '') === tipoObjetivo);
    if (!match) return 0;

    const cantidad = Number(match.cantidad ?? 0) || 0;
    const precioNeto = Number(match.precioNeto ?? 0) || 0;
    if (cantidad <= 0) return 0;

    return Number((precioNeto / cantidad).toFixed(2));
  }

  getDetallePaxSummary(detalle: ReservaDetalleCompleto): string {
    const list = detalle?.detallesPax ?? [];
    if (!list.length) {
      const total = Number(detalle?.PRV02_TotalPax ?? 0) || 0;
      return total > 0 ? `${total}` : '-';
    }
    return list
      .map((item) => `${(item.PRV03_TipoPax || '').toString().trim().toUpperCase()}: ${Number(item.PRV03_Cantidad ?? 0) || 0}`)
      .join(', ');
  }

  /**
   * Abre el modal de detalle/servicio.
   * - Si recibe un detalle, mapea API -> `DetalleForm` para editar.
   * - Si no recibe detalle, inicializa un `DetalleForm` nuevo.
   * - Protege el flujo cuando la reserva no existe o está CON/CAN.
   */
  async abrirModalDetalle(detalle?: ReservaDetalleCompleto): Promise<void> {
    if (this.form.estado === 'CAN') {
      this.showAlert('Atención', 'No se pueden modificar servicios en una reserva anulada.', 'warning');
      return;
    }

    if (!detalle) {
      const codReserva = await this.ensureDraftCreated();
      if (!codReserva) {
        return;
      }
    }

    if (detalle) {
      // Mapear campos de ReservaDetalle (API) a DetalleForm (modal) preservando defaults.
      const baseForm = buildInitialDetalleForm();

      const origenGoogleText = extractGoogleDisplayText((detalle as any).PRV02_OrigenGoogle);
      const destinoGoogleText = extractGoogleDisplayText((detalle as any).PRV02_DestinoGoogle);

      const apiOrigenPlaceId = safeString(detalle.PRV02_OrigenPlaceId);
      const apiDestinoPlaceId = safeString(detalle.PRV02_DestinoPlaceId);

      const origenDireccionGoogle = origenGoogleText || (!this.isLikelyPlaceId(apiOrigenPlaceId) ? apiOrigenPlaceId : '');
      const destinoDireccionGoogle = destinoGoogleText || (!this.isLikelyPlaceId(apiDestinoPlaceId) ? apiDestinoPlaceId : '');
      const detallesPaxForm = this.mapDetallePaxFromApi(detalle.detallesPax ?? []);
      const detalleListaPrecio = safeString((detalle as any).PRV02_CodLstPrecio);
      const defaultPlan = this.lastDetalleCodPlan || this.form.codPlan || this.resolveDefaultPlanId();
      const defaultLista = detalleListaPrecio || this.lastDetalleCodLstPrecio || this.form.codLstPrecio || this.resolveDefaultListaPrecio();
      const detallePlanTarifa = safeString((detalle as any).PRV02_PlanTarifario).trim();
      const selectedPlan = detallePlanTarifa || defaultPlan;
      const horaPickup = normalizeTimeInputValue((detalle as any).PRV02_HoraPickup, { zeroAsEmpty: true });
      const horaInicio = normalizeTimeInputValue(detalle.PRV02_HoraServicio, { zeroAsEmpty: true }) || horaPickup;
      this.detalleForm = {
        ...baseForm,
        codPlan: selectedPlan,
        planTarifa: selectedPlan || this.resolvePlanTarifarioNombre(selectedPlan),
        codLstPrecio: defaultLista,
        codServicio: detalle.PRV02_CodServicio || '',
        nomServicio: detalle.PRV02_NomServicio || '',
        tipoServicio: this.resolveTipoServicioValue(detalle.PRV02_TipoServicio),
        fechaServicio: toDateInputValue(detalle.PRV02_FecServicio) || baseForm.fechaServicio || '',
        horaPickup,
        horaInicio,
        origenLugar: detalle.PRV02_OrigenTexto || '',
        origenZona: detalle.PRV02_ZonaOrigen || '',
        origenDireccionGoogle,
        origenGoogle: safeJsonStringify((detalle as any).PRV02_OrigenGoogle),
        origenLat: detalle.PRV02_OrigenLat || 0,
        origenLng: detalle.PRV02_OrigenLng || 0,
        // Ahora estos campos guardan el Place ID real (técnico).
        origenPlaceId: this.isLikelyPlaceId(apiOrigenPlaceId) ? apiOrigenPlaceId : '',
        destinoLugar: detalle.PRV02_DestinoTexto || '',
        destinoZona: detalle.PRV02_ZonaDestino || '',
        destinoDireccionGoogle,
        destinoGoogle: safeJsonStringify((detalle as any).PRV02_DestinoGoogle),
        destinoLat: detalle.PRV02_DestinoLat || 0,
        destinoLng: detalle.PRV02_DestinoLng || 0,
        destinoPlaceId: this.isLikelyPlaceId(apiDestinoPlaceId) ? apiDestinoPlaceId : '',
        montoServicio: this.sumPaxPrecioTotal(detallesPaxForm) || detalle.PRV02_MontoServicio || 0,
        detallesPax: detallesPaxForm.length ? detallesPaxForm : baseForm.detallesPax,
        estado: detalle.PRV02_Estado || baseForm.estado,
        observaciones: detalle.PRV02_Observacion || ''
      };
      this.editingDetalleId = detalle.PRV02_ID;
    } else {
      this.detalleForm = buildInitialDetalleForm();
      this.detalleForm.codPlan = this.lastDetalleCodPlan || this.form.codPlan || this.resolveDefaultPlanId();
      this.detalleForm.planTarifa = this.resolvePlanTarifarioNombre(this.detalleForm.codPlan);
      this.detalleForm.codLstPrecio = this.lastDetalleCodLstPrecio || this.form.codLstPrecio || this.resolveDefaultListaPrecio();
      this.editingDetalleId = null;
      // this.recalcularCosto(); // El cálculo se puede hacer al guardar
    }
    this.allowManualPricing = false;
    this.reglaTarifaError = '';
    this.ensureDetallePaxDefaults();
    this.showDetalleModal = true;
    if (!this.servicios.length) {
      this.cargarServicios('TRANS');
    }
    this.detalleServicioSearch = '';
    this.cargarServiciosPrecio();
  }

  /**
   * Cierra el modal de detalle/servicio (sin persistir cambios del formulario local).
   */
  cerrarModalDetalle(): void {
    this.showDetalleModal = false;
  }

  /**
   * Abre el modal de actividad turística (nuevo flujo).
   */
  async abrirModalActividad(): Promise<void> {
    const codReserva = await this.ensureDraftCreated();
    if (!codReserva) {
      return;
    }

    if (this.form.estado === 'CAN') {
      this.showAlert('Atención', 'No se pueden modificar servicios en una reserva anulada.', 'warning');
      return;
    }

    this.actividadForm = buildInitialActividadDetalleForm();
    this.actividadForm.codPlan = this.lastActividadCodPlan || this.form.codPlan || this.resolveDefaultPlanId();
    this.actividadForm.planTarifa = this.resolvePlanTarifarioNombre(this.actividadForm.codPlan);
    this.actividadForm.codLstPrecio = this.lastActividadCodLstPrecio || this.form.codLstPrecio || this.resolveDefaultListaPrecio();
    this.editingActividadId = null;
    this.showActividadModal = true;
    /*
    if (!this.servicios.length) {
      this.cargarServicios('TOURS');
    }
      */
  }

  /**
   * Cierra el modal de actividad turística (sin persistir).
   */
  cerrarModalActividad(): void {
    this.showActividadModal = false;
  }

  /**
   * Handler para el cambio de servicio en actividad.
   */
  onActividadServicioChange(codServicio: string): void {
    const servicio = this.servicios.find((item) => item.codReceta === codServicio);
    if (servicio) {
      this.actividadForm.codServicio = servicio.codReceta;
      this.actividadForm.nomServicio = servicio.nomReceta;
      this.actividadForm.tipoServicio = this.resolveTipoServicioValue(
        this.actividadForm.tipoServicio,
        servicio.codGrupo || servicio.codCateg || ''
      );
      return;
    }
    this.actividadForm.codServicio = codServicio || '';
    this.actividadForm.nomServicio = '';
    this.actividadForm.tipoServicio = '';
  }

  /**
   * Guarda actividades dinámicas usando el endpoint existente de detalle de tours.
   */
  async guardarActividadDetalle(saveData: ActividadModalSavePayload): Promise<void> {
    if (this.guardandoActividad) {
      return;
    }

    const codReserva = (await this.ensureDraftCreated()) ?? '';
    if (!codReserva) {
      return;
    }

    const codLstPrecio = (saveData?.codLstPrecio || '').toString().trim();
    const codPlan = (saveData?.codPlan || '').toString().trim();
    if (!codLstPrecio) {
      this.showAlert('Atención', 'Seleccione una lista de precios en el encabezado del modal de actividades.', 'warning');
      return;
    }

    this.lastActividadCodLstPrecio = codLstPrecio;
    this.lastActividadCodPlan = codPlan;
    this.updateHeaderTarifaSnapshot(codPlan, codLstPrecio);

    const payloadItems = (saveData?.payload ?? []).filter((item) => {
      const monto = Number(item?.montoServicio ?? 0) || 0;
      const tienePax = (item?.detallesPax ?? []).some((pax) => (Number(pax?.cantidad ?? 0) || 0) > 0);
      return monto > 0 && tienePax;
    });
    if (!payloadItems.length) {
      this.showAlert('Atención', 'Agregue al menos una actividad con cantidades mayores a cero.', 'warning');
      return;
    }

    const pickup = saveData?.pickups?.[0] ?? null;

    const currentMaxLinea = this.detalles.reduce((max, item) => {
      const value = Number(item?.PRV02_Linea ?? 0) || 0;
      return value > max ? value : max;
    }, 0);
    const baseLinea = currentMaxLinea + 1;

    this.guardandoActividad = true;

    try {
      console.groupCollapsed(
        `[ReservaCreate] Guardar actividad -> POST /detalle-tours-completo (${payloadItems.length} registro(s))`
      );
      console.log('codReserva:', codReserva);
      console.log('payload modal (saveData):', saveData);
      console.log('items a persistir (monto > 0 y con pax):', payloadItems);
      console.groupEnd();

      for (let i = 0; i < payloadItems.length; i++) {
        const item = payloadItems[i];
        const totalPax = (item.detallesPax ?? []).reduce((sum, pax) => sum + (Number(pax?.cantidad ?? 0) || 0), 0);
        const precioAdulto = this.getActividadPrecioUnitario(item.detallesPax ?? [], 'ADULTO');
        const precioNino = this.getActividadPrecioUnitario(item.detallesPax ?? [], 'NINO');

        const payload = {
          id: 0,
          codReserva,
          linea: baseLinea + i,
          tipoServicio: 'ACT',
          codServicio: item.codServicio || '',
          nomServicio: item.nomServicio || '',
          fecServicio: item.fecServicio,
          horaServicio: item.horaServicio || saveData?.horaInicio || '',
          horaPickup: item.horaPickup || saveData?.horaPickup || '',
          origenTexto: pickup?.direccion || '',
          destinoTexto: '',
          origenZona: pickup?.zona || '',
          destinoZona: '',
          origenGoogle: pickup?.google || '',
          destinoGoogle: '',
          origenPlaceId: pickup?.placeId || '',
          destinoPlaceId: '',
          origenLat: pickup?.lat || 0,
          origenLng: pickup?.lng || 0,
          destinoLat: 0,
          destinoLng: 0,
          adultos: Number(item.adultos ?? 0) || 0,
          ninos: Number(item.ninos ?? 0) || 0,
          totalPax,
          planTarifario: saveData?.planTarifario || this.resolvePlanTarifarioNombre(codPlan),
          codLstPrecio,
          idReglaPrecio: Number(item.reglaPrecioID ?? 0) || 0,
          precioAdulto,
          precioNino,
          precioPaxExtra: 0,
          montoServicio: Number(item.montoServicio ?? 0) || 0,
          codSuplidor: '',
          estado: 'PEN',
          observacion: saveData?.observaciones || '',
          detallesPax: item.detallesPax ?? [],
          detallesPaxJson: safeJsonStringify(item.detallesPax ?? []),
          operador: this.getOperador(),
          respuesta: ''
        };

        console.groupCollapsed(
          `[ReservaCreate] POST ${i + 1}/${payloadItems.length} - codServicio: ${payload.codServicio} - linea: ${payload.linea}`
        );
        console.log('request payload:', payload);

        try {
          const response = await firstValueFrom(this.detalleService.crearDetalle(payload));
          console.log('response:', response);
          console.groupEnd();
        } catch (itemError) {
          console.error('error:', itemError);
          console.groupEnd();
          throw itemError;
        }
      }

      this.cargarDetalle(this.codReservaActual!);
      this.cerrarModalActividad();
      this.showAlert('Éxito', `Actividades guardadas correctamente (${payloadItems.length}).`, 'success');
    } catch (err) {
      this.logHttpError('Guardar actividad', err, { saveData });
      this.showAlert('Error', 'No se pudieron guardar las actividades.', 'error');
    } finally {
      this.guardandoActividad = false;
    }
  }

  /**
   * Dispara un recálculo "silencioso" del costo basado en reglas tarifarias,
   * actualizando los campos calculados del `DetalleForm` cuando aplique.
   */
  recalcularCosto(): void {
    void this.applyReglaTarifaToDetalleForm();
  }

  /**
   * Construye un enlace de Google Maps para un detalle ya persistido (lista de servicios).
   */
  getDetalleMapsLink(detalle: ReservaDetalleCompleto, tipo: 'origen' | 'destino'): string {
    const lat = tipo === 'origen' ? detalle.PRV02_OrigenLat : detalle.PRV02_DestinoLat;
    const lng = tipo === 'origen' ? detalle.PRV02_OrigenLng : detalle.PRV02_DestinoLng;
    if (!hasCoordinates(lat, lng)) {
      return '';
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  /**
   * Guarda (crea/actualiza) el detalle del servicio en backend.
   * - Valida formulario del modal.
   * - Aplica regla tarifaria antes de persistir (usa los precios resultantes).
   * - Construye el payload esperado por `DetalleToursCompletoController`.
   */
  async guardarDetalle(detalleFormRef: any): Promise<void> {
    if (this.guardandoDetalle) {
      return;
    }

    if (detalleFormRef?.invalid) {
      detalleFormRef.control?.markAllAsTouched?.();
      return;
    }
    const codReserva = (await this.ensureDraftCreated()) ?? '';
    if (!codReserva) {
      return;
    }

    const paxItems = this.getDetallePaxItemsForPayload();
    if (!paxItems.length) {
      this.showAlert('Atención', 'Agregue al menos un tipo de pax con cantidad mayor a cero.', 'warning');
      return;
    }

    const duplicated = this.findDuplicatedTiposPax(paxItems.map((item) => item.tipoPax));
    if (duplicated.length) {
      this.showAlert('Atención', `No puede repetir tipos de pax: ${duplicated.join(', ')}.`, 'warning');
      return;
    }

    const codPlan = (this.detalleForm.codPlan || '').toString().trim();
    const codLstPrecio = (this.detalleForm.codLstPrecio || '').toString().trim();
    if (!codPlan) {
      this.showAlert('Atención', 'Seleccione un plan tarifario en el encabezado del modal.', 'warning');
      return;
    }
    if (!codLstPrecio) {
      this.showAlert('Atención', 'Seleccione una lista de precios en el encabezado del modal.', 'warning');
      return;
    }

    this.lastDetalleCodPlan = codPlan;
    this.lastDetalleCodLstPrecio = codLstPrecio;
    this.updateHeaderTarifaSnapshot(codPlan, codLstPrecio);

    this.guardandoDetalle = true;
    let payload: any = null;

    try {
      try {
        const reglaAplicada = await this.applyReglaTarifaToDetalleForm();
        if (!reglaAplicada && !this.allowManualPricing) {
          this.showAlert(
            'Atención',
            this.reglaTarifaError ||
              'No se encontró una regla tarifaria que aplique para la lista de precios, servicio, pax y hora Pick-Up seleccionados.',
            'warning'
          );
          return;
        }
      } catch {
        this.showAlert('Error', 'Ocurrió un error al aplicar la regla tarifaria antes de guardar el detalle.', 'error');
        return;
      }

      const invalidPrice = paxItems.some((item) => Number(item.precioTotal ?? 0) <= 0);
      if (invalidPrice) {
        this.showAlert('Atención', 'Ingrese el precio total para cada tipo de pax.', 'warning');
        return;
      }

      const totalPax = paxItems.reduce((sum, item) => sum + (Number(item.cantidad ?? 0) || 0), 0);
      const adultos = paxItems
        .filter((item) => this.isAdultoTipoPax(item.tipoPax))
        .reduce((sum, item) => sum + (Number(item.cantidad ?? 0) || 0), 0);
      const ninos = paxItems
        .filter((item) => this.isNinoTipoPax(item.tipoPax))
        .reduce((sum, item) => sum + (Number(item.cantidad ?? 0) || 0), 0);
      const montoServicio = this.sumPaxPrecioTotal(paxItems);
      this.detalleForm.montoServicio = montoServicio;

      const existing = this.editingDetalleId ? this.detalles.find((d) => d.PRV02_ID === this.editingDetalleId) : null;
      const linea = existing?.PRV02_Linea ?? (this.detalles.length + 1);

      const adultosLine = this.pickLineaAdultos(paxItems);
      const ninosLine = paxItems.find((item) => this.isNinoTipoPax(item.tipoPax));
      const idReglaPrecio = adultosLine?.reglaPrecioId ?? ninosLine?.reglaPrecioId ?? 0;
      const precioAdulto = adultosLine?.precioUnitario ?? this.getPrecioUnitarioFallback(adultosLine);
      const precioNino = ninosLine?.precioUnitario ?? this.getPrecioUnitarioFallback(ninosLine);
      const precioPaxExtra = adultosLine?.precioPaxExtra ?? 0;

      const detallesPaxPayload = paxItems.map((item) => ({
        tipoPax: item.tipoPax,
        cantidad: item.cantidad,
        precioNeto: Number(item.precioTotal ?? 0) || 0
      }));

      payload = {
        id: this.editingDetalleId ?? 0,
        codReserva,
        linea,
        tipoServicio: this.detalleForm.tipoServicio || '',
        codServicio: this.detalleForm.codServicio || '',
        nomServicio: this.detalleForm.nomServicio || '',
        fecServicio: this.detalleForm.fechaServicio,
        horaServicio: this.detalleForm.horaInicio || this.detalleForm.horaPickup || '',
        horaPickup: this.detalleForm.horaPickup || '',
        origenTexto: this.detalleForm.origenLugar || '',
        destinoTexto: this.detalleForm.destinoLugar || '',
        origenZona: this.detalleForm.origenZona || '',
        destinoZona: this.detalleForm.destinoZona || '',
        // Google metadata + Place ID
        origenGoogle: (this.detalleForm.origenGoogle || '').toString(),
        destinoGoogle: (this.detalleForm.destinoGoogle || '').toString(),
        origenPlaceId: (this.detalleForm.origenPlaceId || '').toString(),
        destinoPlaceId: (this.detalleForm.destinoPlaceId || '').toString(),
        origenLat: this.detalleForm.origenLat || 0,
        origenLng: this.detalleForm.origenLng || 0,
        destinoLat: this.detalleForm.destinoLat || 0,
        destinoLng: this.detalleForm.destinoLng || 0,
        adultos,
        ninos,
        totalPax,
        planTarifa: this.detalleForm.planTarifa || this.resolvePlanTarifarioNombre(codPlan),
        codLstPrecio,
        idReglaPrecio,
        precioAdulto: precioAdulto || 0,
        precioNino: precioNino || 0,
        precioPaxExtra: precioPaxExtra || 0,
        montoServicio,
        codSuplidor: '',
        estado: (this.detalleForm.estado || 'PEN').toString(),
        observacion: this.detalleForm.observaciones || '',
        detallesPax: detallesPaxPayload,
        detallesPaxJson: safeJsonStringify(detallesPaxPayload),
        operador: this.getOperador(),
        respuesta: ''
      };

      console.log('[ReservaCreate] Payload DetalleToursCompleto', payload);

      const request$ = this.editingDetalleId
        ? this.detalleService.actualizarDetalle(this.editingDetalleId, payload)
        : this.detalleService.crearDetalle(payload);

      await firstValueFrom(request$);
      this.cargarDetalle(this.codReservaActual!);
      this.cerrarModalDetalle();
    } catch (err) {
      this.logHttpError('Guardar detalle', err, { payload });
      this.showAlert('Error', 'No se pudo guardar el detalle.', 'error');
    } finally {
      this.guardandoDetalle = false;
    }
  }

  /**
   * Elimina un detalle del backend y recarga la lista de detalles.
   */
  eliminarDetalle(detalle: ReservaDetalleCompleto): void {
    if (this.form.estado !== 'PEN') {
      this.showAlert('Atención', 'No se pueden eliminar servicios en una reserva confirmada o anulada.', 'warning');
      return;
    }

    const codReserva = (this.codReservaActual || '').trim();
    const id = Number((detalle as any)?.PRV02_ID);

    if (!codReserva) {
      this.showAlert('Atención', 'No hay una reserva creada para eliminar servicios.', 'warning');
      return;
    }
    if (!Number.isFinite(id) || id <= 0) {
      this.showAlert('Error', 'No se pudo identificar el detalle a eliminar.', 'error');
      return;
    }

    Swal.fire({
      title: `Eliminar servicio #${id} - ${codReserva}`,
      text: 'Esta acción eliminará el servicio de la reserva. ¿Desea continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.detalleService.eliminarDetalle(id, codReserva).pipe(take(1)).subscribe({
        next: () => this.cargarDetalle(codReserva),
        error: (err) => {
          this.logHttpError('Eliminar detalle', err, { id, codReserva });
          this.showAlert('Error', 'No se pudo eliminar el detalle.', 'error');
        }
      });
    });
  }

  /**
   * Guarda la reserva según estado:
   * - CAN: bloquea cambios.
   * - CON: guarda encabezado (sin reconfirmar) y vuelve al listado.
   * - PEN: confirma con modal (guardar + confirmar).
   */
  async guardarReserva(formRef?: any): Promise<void> {
    // PEN: guardar + confirmar (flujo actual).
    // CON: solo guardar cambios del encabezado (no reconfirma).
    // CAN: no permite cambios.
    if (this.form.estado === 'CAN') {
      this.showAlert('Atención', 'La reserva está anulada y no puede modificarse.', 'warning');
      return;
    }
    if (formRef && formRef.invalid) {
      this.showValidationErrors(formRef);
      return;
    }
    const codReserva = (await this.ensureDraftCreated()) ?? '';
    if (!codReserva) {
      return;
    }

      if (this.form.estado === 'CON') {
        this.confirmando = true;
        const payload = this.buildEncabezadoPayload('CON');
        console.log('[ReservaCreate] Guardar cambios (CON) payload', payload);
        this.reservasService.actualizarReserva(codReserva, payload).subscribe({
          next: () => {
            this.confirmando = false;
          this.showAlert('Éxito', 'Cambios guardados correctamente.', 'success');
          setTimeout(() => this.router.navigate(['/operaciones/reservas']), 400);
        },
        error: () => {
          this.confirmando = false;
          this.showAlert('Error', 'No se pudieron guardar los cambios.', 'error');
        }
      });
      return;
    }

    Swal.fire({
      title: 'Guardar y confirmar reserva',
      text: 'Esta acción guardará los cambios y confirmará la reserva. ¿Desea continuar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;
      void this.confirmarReserva(formRef);
    });
  }

  /**
   * Confirma una reserva.
   * - Primero guarda el encabezado actual (estado PEN) para confirmar con datos actualizados.
   * - Luego llama al endpoint de confirmación y cambia estado a CON.
   */
  async confirmarReserva(formRef?: any): Promise<void> {
    if (this.form.estado === 'CON') {
      this.showAlert('Información', 'La reserva ya está confirmada.', 'info');
      return;
    }
    if (this.form.estado === 'CAN') {
      this.showAlert('Atención', 'La reserva está anulada y no puede confirmarse.', 'warning');
      return;
    }
    if (formRef && formRef.invalid) {
      this.showValidationErrors(formRef);
      return;
    }
    const codReserva = (await this.ensureDraftCreated()) ?? '';
    if (!codReserva) {
      return;
    }

      this.confirmando = true;

      // Primero guardamos el encabezado para asegurar que el backend confirme con datos actuales.
      const payload = this.buildEncabezadoPayload('PEN');
      console.log('[ReservaCreate] Guardar encabezado (PEN) antes de confirmar payload', payload);
      this.reservasService.actualizarReserva(codReserva, payload).subscribe({
      next: () => {
        this.reservasService.confirmarReserva(codReserva).subscribe({
          next: () => {
            this.form.estado = 'CON';
            clearReservaCreateDraftCod();
            this.confirmando = false;
            this.showAlert('Éxito', 'Reserva confirmada correctamente.', 'success');
            setTimeout(() => this.router.navigate(['/operaciones/reservas']), 400);
          },
          error: () => {
            this.confirmando = false;
            this.showAlert('Error', 'No se pudo confirmar la reserva.', 'error');
          }
        });
      },
      error: () => {
        this.confirmando = false;
        this.showAlert('Error', 'No se pudo guardar el encabezado antes de confirmar.', 'error');
      }
    });
  }

  /**
   * Acción de "volver/cancelar" desde la UI. Delegado al flujo de salida controlada.
   */
  cancelar(): void {
    void this.requestExit('toListado');
  }

  /**
   * Hook del guard CanDeactivate:
   * - Si está en borrador (PEN) y existe `codReservaActual`, bloquea navegación y dispara flujo
   *   de decisión (guardar borrador / seguir editando / descartar).
   * - En otros estados permite salir.
   */
  canDeactivate(_nextUrl?: string): boolean | Promise<boolean> {
    // Esta navegación ocurre desde el propio componente para estabilizar la URL (nueva -> editar).
    // No debe disparar el flujo de salida/cancelación.
    if (this.internalNavigation) return true;

    if (this.allowNavigation) return true;

    // Si no es borrador (PEN), no hay nada que proteger.
    if (this.form.estado !== 'PEN') return true;

    // Si aún no existe encabezado, no bloqueamos la navegación.
    if (!this.codReservaActual) return true;

    // Evita congelar la UI por el spinner global (NavigationStart) mientras un guard devuelve una Promise.
    // Cancelamos la navegación actual y ejecutamos el flujo (modal / delete / guardar) fuera del ciclo de navegación.
    this.startExitToUrl(_nextUrl ?? '/reservas');
    return false;
  }

  /**
   * Navegación interna del componente que no debe disparar el flujo CanDeactivate.
   * Se usa para "estabilizar" la URL (nueva -> /editar) sin reconstruir el componente.
   */
  private navigateInternal(commands: any[], extras?: any): void {
    const { replaceUrl, ...navigationExtras } = extras ?? {};
    if (replaceUrl) {
      const tree = this.router.createUrlTree(commands, navigationExtras);
      this.location.replaceState(this.router.serializeUrl(tree));
      return;
    }

    this.internalNavigation = true;
    void this.router.navigate(commands, extras).finally(() => {
      this.internalNavigation = false;
    });
  }

  /**
   * Flujo central de salida desde el componente cuando hay un borrador (PEN):
   * - Si el borrador no tiene detalle, elimina automáticamente el borrador en backend.
   * - Si tiene detalle (o no se pudo verificar), muestra un modal de decisión.
   * Retorna si se debe permitir la navegación.
   */
  private async requestExit(mode: 'toListado' | 'allowNext'): Promise<boolean> {
    if (this.allowNavigation) return true;
    if (this.cancelDecisionBusy) return false;

    // Si no es borrador (PEN), salir directo.
    if (this.form.estado !== 'PEN') {
      if (mode === 'toListado') {
        this.navigateToListado();
        return false;
      }
      return true;
    }

    const codReserva = this.codReservaActual;
    if (!codReserva) {
      if (mode === 'toListado') {
        this.navigateToListado();
        return false;
      }
      return true;
    }

    this.cancelDecisionBusy = true;

    let detalleCount: number | null = null;
    let verifyFailed = false;
    try {
      const response = await firstValueFrom(this.detalleService.getDetalleByReserva(codReserva).pipe(take(1)));
      const detalleList = Array.isArray(response?.detalle) ? response.detalle : response?.detalle ? [response.detalle] : [];
      detalleCount = detalleList.length;
    } catch {
      verifyFailed = true;
    }

    // Borrador sin detalle: eliminar automáticamente.
    if (!verifyFailed && (detalleCount ?? 0) <= 0) {
      try {
        await firstValueFrom(this.reservasService.eliminarReservaBorrador(codReserva).pipe(take(1)));
        this.cancelDecisionBusy = false;
        clearReservaCreateDraftCod();
        if (mode === 'toListado') {
          this.navigateToListado();
          return false;
        }
        this.allowNavigation = true;
        return true;
      } catch {
        this.cancelDecisionBusy = false;
        this.showAlert('Error', 'No se pudo eliminar la reserva borrador.', 'error');
        return false;
      }
    }

    this.cancelDecisionBusy = false;

    // Borrador con detalle (o no se pudo verificar): pedir decisión.
    this.pendingExitMode = mode;
    const shouldAllow = await this.openCancelDecisionModalAndWait(detalleCount, verifyFailed);
    return shouldAllow;
  }

  /**
   * Variante del flujo de salida cuando la navegación viene por URL destino (guard).
   * Evita promesas largas dentro del guard: cancela la navegación y maneja la salida fuera.
   */
  private startExitToUrl(targetUrl: string): void {
    if (this.cancelDecisionBusy) return;
    if (this.showCancelDecisionModal) return;

    void (async () => {
      const codReserva = this.codReservaActual;
      if (!codReserva) {
        this.allowNavigation = true;
        void this.router.navigateByUrl(targetUrl);
        return;
      }

      this.cancelDecisionBusy = true;

      let detalleCount: number | null = null;
      let verifyFailed = false;
      try {
        const response = await firstValueFrom(this.detalleService.getDetalleByReserva(codReserva).pipe(take(1)));
        const detalleList = Array.isArray(response?.detalle) ? response.detalle : response?.detalle ? [response.detalle] : [];
        detalleCount = detalleList.length;
      } catch {
        verifyFailed = true;
      }

      // Borrador sin detalle: eliminar automáticamente y continuar.
      if (!verifyFailed && (detalleCount ?? 0) <= 0) {
        try {
          await firstValueFrom(this.reservasService.eliminarReservaBorrador(codReserva).pipe(take(1)));
          this.cancelDecisionBusy = false;
          clearReservaCreateDraftCod();
          this.allowNavigation = true;
          void this.router.navigateByUrl(targetUrl);
          return;
        } catch {
          this.cancelDecisionBusy = false;
          this.showAlert('Error', 'No se pudo eliminar la reserva borrador.', 'error');
          return;
        }
      }

      this.cancelDecisionBusy = false;

      this.pendingExitMode = 'toUrl';
      this.pendingExitUrl = targetUrl;
      this.openCancelDecisionModal(detalleCount, verifyFailed);
    })();
  }

  /**
   * Abre el modal de decisión para borrador (PEN) con un mensaje contextual (cantidad de servicios).
   */
  private openCancelDecisionModal(detalleCount: number | null, verifyFailed = false): void {
    this.cancelDecisionTitle = 'Reserva en borrador (PEN)';
    if (verifyFailed) {
      this.cancelDecisionMessage =
        'No se pudo verificar el detalle de la reserva. Para evitar pérdida de información, elija una opción.';
    } else {
      const n = detalleCount ?? 0;
      const label = n === 1 ? '1 servicio agregado' : `${n} servicios agregados`;
      this.cancelDecisionMessage =
        `Esta reserva está en estado borrador (PEN) y tiene ${label}. ¿Qué desea hacer?`;
    }
    this.showCancelDecisionModal = true;
  }

  /**
   * Abre el modal de decisión y devuelve una Promise que se resuelve cuando el usuario elige una opción.
   * Se usa para coordinar CanDeactivate con una UI no bloqueante.
   */
  private openCancelDecisionModalAndWait(detalleCount: number | null, verifyFailed = false): Promise<boolean> {
    if (this.pendingExitPromise) {
      return this.pendingExitPromise;
    }

    this.openCancelDecisionModal(detalleCount, verifyFailed);
    this.pendingExitPromise = new Promise<boolean>((resolve) => {
      this.pendingExitResolver = resolve;
    });
    return this.pendingExitPromise;
  }

  /**
   * Opción del modal: "Guardar borrador".
   * - Persiste encabezado en backend como PEN.
   * - Luego permite/dirige la navegación pendiente según el modo.
   */
  onCancelDecisionGuardarBorrador(): void {
    const codReserva = this.codReservaActual;
    if (!codReserva) {
      this.showCancelDecisionModal = false;
      const mode = this.pendingExitMode;
      const url = this.pendingExitUrl;
      this.pendingExitMode = null;
      this.pendingExitUrl = null;
      this.resolvePendingExit(false);
      if (mode === 'toListado') this.navigateToListado();
      if (mode === 'toUrl' && url) {
        this.allowNavigation = true;
        void this.router.navigateByUrl(url);
      }
      return;
    }

    this.cancelDecisionBusy = true;
    const payload = this.buildEncabezadoPayload('PEN');
    this.reservasService.actualizarReserva(codReserva, payload).pipe(take(1)).subscribe({
      next: () => {
        this.cancelDecisionBusy = false;
        this.showCancelDecisionModal = false;
        const mode = this.pendingExitMode;
        const url = this.pendingExitUrl;
        this.pendingExitMode = null;
        this.pendingExitUrl = null;

        if (mode === 'allowNext') {
          this.allowNavigation = true;
          this.resolvePendingExit(true);
          return;
        }

        this.resolvePendingExit(false);

        if (mode === 'toUrl' && url) {
          clearReservaCreateDraftCod();
          this.allowNavigation = true;
          void this.router.navigateByUrl(url);
          return;
        }

        this.navigateToListado();
      },
      error: () => {
        this.cancelDecisionBusy = false;
        this.showAlert('Error', 'No se pudo guardar el borrador.', 'error');
      }
    });
  }

  /**
   * Opción del modal: "Seguir editando". Cierra el modal y mantiene al usuario en la pantalla.
   */
  onCancelDecisionSeguirEditando(): void {
    if (this.cancelDecisionBusy) return;
    this.showCancelDecisionModal = false;
    this.pendingExitMode = null;
    this.pendingExitUrl = null;
    this.resolvePendingExit(false);
  }

  /**
   * Opción del modal: "Descartar reserva".
   * - Elimina el borrador en backend.
   * - Limpia el draft en storage y vuelve al listado (o permite navegación pendiente).
   */
  onCancelDecisionDescartar(): void {
    const codReserva = this.codReservaActual;
    if (!codReserva) {
      this.showCancelDecisionModal = false;
      const mode = this.pendingExitMode;
      this.pendingExitMode = null;
      this.pendingExitUrl = null;
      this.resolvePendingExit(false);
      if (mode === 'toListado') this.navigateToListado();
      if (mode === 'toUrl') this.navigateToListado();
      return;
    }

    this.cancelDecisionBusy = true;
    this.reservasService.eliminarReservaBorrador(codReserva).pipe(take(1)).subscribe({
      next: () => {
        this.cancelDecisionBusy = false;
        this.showCancelDecisionModal = false;
        const mode = this.pendingExitMode;
        this.pendingExitMode = null;
        this.pendingExitUrl = null;

        clearReservaCreateDraftCod();

        if (mode === 'allowNext') {
          this.allowNavigation = true;
          this.resolvePendingExit(true);
          return;
        }

        this.resolvePendingExit(false);

        // En "volver" del navegador / navegación a otra ruta, si el usuario descarta el borrador
        // siempre volvemos al listado principal de reservas.
        if (mode === 'toUrl') {
          this.navigateToListado();
          return;
        }

        this.navigateToListado();
      },
      error: () => {
        this.cancelDecisionBusy = false;
        this.showAlert('Error', 'No se pudo descartar la reserva borrador.', 'error');
      }
    });
  }

  /**
   * Navega al listado de reservas y habilita la navegación (salida controlada).
   */
  private navigateToListado(): void {
    this.allowNavigation = true;
    clearReservaCreateDraftCod();
    this.router.navigate(['/reservas']);
  }

  /**
   * Resuelve el "pending exit" (promise) del flujo CanDeactivate y limpia flags internos.
   */
  private resolvePendingExit(allow: boolean): void {
    const resolve = this.pendingExitResolver;
    this.pendingExitResolver = null;
    this.pendingExitPromise = null;
    this.pendingExitMode = null;
    this.pendingExitUrl = null;
    if (resolve) resolve(allow);
  }

  /**
   * Abre el modal de selección de cliente (agencia/comisionista).
   */
  abrirModalClientes(): void {
    this.showClienteModal = true;
  }

  /**
   * Carga catálogo de servicios para el selector del modal de detalle.
   */
  cargarServicios(CentroCosto:string ): void {
    this.serviciosLoading = true;
    this.serviciosService.getServicios(1, 1, 200, CentroCosto).subscribe({
      next: (res) => {
        this.servicios = res.data ?? [];
        this.serviciosLoading = false;
      },
      error: () => {
        this.servicios = [];
        this.serviciosLoading = false;
      }
    });
  }

  /**
   * Carga servicios segun lista de precios y tipo de tarifa para el modal de detalle.
   */
  private cargarServiciosPrecio(nombreServicio?: string, validateSelection: boolean = true): void {
    const codLstPrecio = (this.detalleForm.codLstPrecio || '').toString().trim();
    const search = (nombreServicio ?? this.detalleServicioSearch).toString().trim();
    if (nombreServicio !== undefined) {
      this.detalleServicioSearch = search;
    }

    if (!codLstPrecio) {
      this.serviciosPrecio = [];
      this.serviciosPrecioLoading = false;
      if (validateSelection) {
        this.ensureDetalleServicioSeleccionado();
      }
      return;
    }

    this.serviciosPrecioLoading = true;
    this.tarifaService
      .getServiciosPorListaPrecio({
        codLstPrecio,
        soloActivos: true,
        nombreServicio: search,
        pageNumber: 1,
        pageSize: 50
      })
      .subscribe({
        next: (items) => {
          this.serviciosPrecio = items ?? [];
          this.serviciosPrecioLoading = false;
          if (validateSelection) {
            this.ensureDetalleServicioSeleccionado();
          }
        },
        error: () => {
          this.serviciosPrecio = [];
          this.serviciosPrecioLoading = false;
          if (validateSelection) {
            this.ensureDetalleServicioSeleccionado();
          }
        }
      });
  }

  onDetalleServicioSearch(term: string): void {
    this.cargarServiciosPrecio(term, false);
  }

  /**
   * Handler del cambio de servicio en el modal:
   * - Actualiza nombre/tipo de servicio en `DetalleForm`.
   * - Dispara recálculo de costo (reglas tarifarias).
   */
  onServicioChange(codServicio: string): void {
    const servicioPrecio = this.serviciosPrecio.find((item) => item.CodServicio === codServicio);
    if (servicioPrecio) {
      const servicioCatalogo = this.servicios.find((item) => item.codReceta === codServicio);
      this.detalleForm.codServicio = servicioPrecio.CodServicio;
      this.detalleForm.nomServicio = servicioPrecio.NomServicio;
      this.detalleForm.tipoServicio = this.resolveTipoServicioValue(
        servicioPrecio.TipoServicio,
        servicioCatalogo?.codGrupo || servicioCatalogo?.codCateg || ''
      );
      this.allowManualPricing = false;
      this.reglaTarifaError = '';
      this.detalleForm.detallesPax = (this.detalleForm.detallesPax ?? []).map((item) => ({
        ...item,
        manual: false,
        error: ''
      }));
      this.recalcularCosto();
      return;
    }
    this.detalleForm.nomServicio = '';
    this.detalleForm.tipoServicio = '';
    this.reglaTarifaError = '';
    this.allowManualPricing = false;
  }

  private ensureDetalleServicioSeleccionado(): void {
    const selected = (this.detalleForm.codServicio || '').toString().trim();
    if (!selected) return;
    const exists = this.serviciosPrecio.some((item) => item.CodServicio === selected);
    if (!exists) {
      this.detalleForm.codServicio = '';
      this.onServicioChange('');
    }
  }

  /**
   * Limpia la agencia/comisionista seleccionada del encabezado.
   */
  limpiarSeleccionCliente(): void {
    this.form.codAgencia = '';
    this.selectedCliente = null;
  }

  /**
   * Recibe el cliente elegido desde el componente modal y lo aplica al encabezado.
   */
  onClienteSelected(cliente: ClienteUI): void {
    this.form.codAgencia = cliente.codigo;
    this.selectedCliente = cliente;
    this.showClienteModal = false;
  }

  /**
   * Total neto calculado a partir de `PRV02_MontoServicio` en los detalles.
   */
  get totalNeto(): number {
    // Sumar PRV02_MontoServicio de los detalles
    return this.detalles.reduce((sum, d) => sum + (d.PRV02_MontoServicio || 0), 0);
  }

  /**
   * Total rack calculado sumando componentes de precio del detalle.
   */
  get totalRack(): number {
    // Con el nuevo modelo, el total se calcula desde PRV02_MontoServicio.
    return this.detalles.reduce((sum, d) => sum + (d.PRV02_MontoServicio || 0), 0);
  }

  /**
   * Cantidad de servicios agregados a la reserva.
   */
  get cantidadServicios(): number {
    return this.detalles.length;
  }

  /**
   * Etiqueta de estado de reserva para UI.
   */
  get estadoLabel(): string {
    switch (this.form.estado) {
      case 'CON':
        return 'CONFIRMADA';
      case 'CAN':
        return 'ANULADA';
      default:
        return 'PENDIENTE';
    }
  }

  /**
   * Clase CSS del badge de estado para UI.
   */
  get estadoBadgeClass(): string {
    switch (this.form.estado) {
      case 'CON':
        return 'bg-success';
      case 'CAN':
        return 'bg-danger';
      default:
        return 'bg-warning';
    }
  }

  get directoSwitchChecked(): boolean {
    return (this.form.directo || '0').toString() === '1';
  }

  get directoSwitchDisabled(): boolean {
    const estado = (this.form.estado || '').toString();
    const allowed = estado === 'PEN' || estado === 'CON';
    return !this.codReservaActual || !allowed || this.directoUpdating;
  }

  /**
   * Wrapper de alertas para estandarizar UX y evitar warnings de foco/aria cuando hay modales abiertos.
   */
  private showAlert(title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info'): void {
    showAlertWithFocusRestore({
      title,
      text,
      icon,
      shouldRestoreFocus: () =>
        this.showDetalleModal || this.showActividadModal || this.showClienteModal || this.showCancelDecisionModal
    });
  }

  private logHttpError(context: string, error: any, extra?: any): void {
    const status = error?.status;
    const statusText = error?.statusText;
    const message = error?.message;
    const apiError = error?.error;
    const traceId = apiError?.traceId ?? apiError?.traceid ?? null;
    console.groupCollapsed(`[ReservaCreate] ${context} - Error${status ? ` (${status})` : ''}`);
    if (status || statusText) console.log('status:', status, statusText);
    if (message) console.log('message:', message);
    if (traceId) console.log('traceId:', traceId);
    if (apiError) console.log('apiError:', apiError);
    if (extra) console.log('extra:', extra);
    console.groupEnd();
  }

  /**
   * Construye el payload de encabezado esperado por la API/servicio de reservas.
   * Nota: `totalRsv` se envía como `totalRack` (regla de negocio actual).
   */
  private buildEncabezadoPayload(estado: ReservaEstado): any {
    return {
      codAgencia: this.form.codAgencia,
      nomCliente: this.form.nomCliente,
      telCliente: this.form.telCliente,
      emailCliente: this.form.emailCliente,
      idioma: (this.form.idioma || '').trim(),
      formaReserva: (this.form.formaReservacion || '').trim(),
      formaPago: this.form.formaPago,
      estado,
      totNoches: 0,
      totDias: 0,
      directo: (this.form.directo || '0').toString(),
      folio: 'S/F',
      cntHabitaciones: 0,
      observacion: this.form.comentarios,
      codLstPrecio: this.form.codLstPrecio,
      codPlan: (this.form.codPlan || '1').toString(),
      moneda: this.form.moneda,
      fecCreacion: this.form.fecha,
      operador: this.getOperador(),
      totalRsv: this.totalRack
    };
  }

  /**
   * Obtiene el usuario/operador actual desde AuthService.
   */
  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  /**
   * Marca todos los controles como touched y muestra un resumen de campos requeridos faltantes.
   */
  private showValidationErrors(formRef: any): void {
    try {
      formRef?.control?.markAllAsTouched?.();
    } catch {
      // ignore
    }

    const labels: Record<string, string> = {
      codAgencia: 'Agencia / Comisionista',
      codLstPrecio: 'Lista de Precios',
      codPlan: 'Plan Tarifario',
      nomCliente: 'Cliente Final',
      idioma: 'Idioma',
      formaReservacion: 'Forma de Reservación',
      formaPago: 'Forma de Pago',
      moneda: 'Moneda'
    };

    const controls = (formRef?.controls ?? {}) as Record<string, any>;
    const missing = Object.keys(controls)
      .filter((key) => controls[key]?.invalid)
      .map((key) => labels[key] ?? key);

    const unique = Array.from(new Set(missing));
    if (!unique.length) return;
    this.showAlert('Validación', `Revise los campos requeridos: ${unique.join(', ')}.`, 'warning');
  }

  /**
   * Cuando el encabezado viene con `idioma` como ID numérico, resuelve el código consultando por ID
   * y actualiza el catálogo local (merge sin duplicados).
   */
  private resolveIdiomaCodigoFromId(idIdioma: number): void {
    if (!Number.isFinite(idIdioma) || idIdioma <= 0) return;
    this.idiomasService.getById(idIdioma).pipe(take(1)).subscribe({
      next: (idioma) => {
        if (!idioma) return;
        this.idiomas = this.mergeIdiomas([idioma, ...(this.idiomas ?? [])]);
        this.form.idioma = (idioma.CA53_Codigo ?? '').trim();
      },
      error: () => {
        // ignore
      }
    });
  }

  /**
   * Cuando el encabezado viene con `formaReservacion` como ID numérico, resuelve el código consultando por ID
   * y actualiza el catálogo local (merge sin duplicados).
   */
  private resolveFormaReservacionCodigoFromId(idFormaReservacion: number): void {
    if (!Number.isFinite(idFormaReservacion) || idFormaReservacion <= 0) return;
    this.formaReservasService.getById(idFormaReservacion).pipe(take(1)).subscribe({
      next: (forma) => {
        if (!forma) return;
        this.formasReservacion = this.mergeFormasReservacion([forma, ...(this.formasReservacion ?? [])]);
        this.form.formaReservacion = (forma.CA54_Codigo ?? '').trim();
      },
      error: () => {
        // ignore
      }
    });
  }

  /**
   * Cuando el encabezado viene con `codPlan` como ID numérico, garantiza que el plan exista en el combo
   * y deja seleccionado el valor para sincronizar la lista de precios ligada.
   */
  private resolveCodPlanFromId(idCodPlan: number): void {
    if (!Number.isFinite(idCodPlan) || idCodPlan <= 0) return;
    const exists = (this.planesTarifas ?? []).some((item) => Number(item?.planId ?? 0) === idCodPlan);
    if (exists) {
      this.form.codPlan = String(idCodPlan);
      return;
    }

    this.planesTarifasService.getPlanById(idCodPlan).pipe(take(1)).subscribe({
      next: (plan) => {
        if (!plan) return;
        this.planesTarifas = this.mergePlanesTarifas([plan, ...(this.planesTarifas ?? [])]);
        this.form.codPlan = String(plan.planId);
      },
      error: () => {
        // ignore
      }
    });
  }

  /**
   * Une idiomas (sin duplicados por ID) y ordena por clave (código + nombre).
   */
  private mergeIdiomas(items: IdiomaDto[]): IdiomaDto[] {
    const mapById = new Map<number, IdiomaDto>();
    for (const item of items ?? []) {
      if (!item) continue;
      const id = Number(item.CA53_IdIdioma);
      if (!Number.isFinite(id) || id <= 0) continue;
      mapById.set(id, item);
    }
    return Array.from(mapById.values()).sort((a, b) => {
      const aKey = `${(a.CA53_Codigo || '').trim()} ${(a.CA53_Nombre || '').trim()}`.trim().toUpperCase();
      const bKey = `${(b.CA53_Codigo || '').trim()} ${(b.CA53_Nombre || '').trim()}`.trim().toUpperCase();
      return aKey.localeCompare(bKey);
    });
  }

  /**
   * Une formas de reservación (sin duplicados por ID) y ordena por clave (código + descripción).
   */
  private mergeFormasReservacion(items: FormaReservaDto[]): FormaReservaDto[] {
    const mapById = new Map<number, FormaReservaDto>();
    for (const item of items ?? []) {
      if (!item) continue;
      const id = Number(item.CA54_IdFormaReservacion);
      if (!Number.isFinite(id) || id <= 0) continue;
      mapById.set(id, item);
    }
    return Array.from(mapById.values()).sort((a, b) => {
      const aKey = `${(a.CA54_Codigo || '').trim()} ${(a.CA54_Descripcion || '').trim()}`.trim().toUpperCase();
      const bKey = `${(b.CA54_Codigo || '').trim()} ${(b.CA54_Descripcion || '').trim()}`.trim().toUpperCase();
      return aKey.localeCompare(bKey);
    });
  }

  /**
   * Une planes tarifarios (sin duplicados por planId) y ordena por nombre.
   */
  private mergePlanesTarifas(items: PlanTarifaUI[]): PlanTarifaUI[] {
    const mapById = new Map<number, PlanTarifaUI>();
    for (const item of items ?? []) {
      if (!item) continue;
      const id = Number(item.planId);
      if (!Number.isFinite(id) || id <= 0) continue;
      mapById.set(id, item);
    }

    return Array.from(mapById.values()).sort((a, b) => {
      const aKey = `${(a.nombrePlan || '').trim()} ${(a.tipoTarifaDescripcion || '').trim()}`.trim().toUpperCase();
      const bKey = `${(b.nombrePlan || '').trim()} ${(b.tipoTarifaDescripcion || '').trim()}`.trim().toUpperCase();
      return aKey.localeCompare(bKey);
    });
  }

  onDirectoSwitchChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const nextValue = input.checked ? '1' : '0';
    const previousValue = (this.form.directo || '0').toString();

    if (nextValue === previousValue) {
      return;
    }

    const codReserva = (this.codReservaActual || '').toString().trim();
    if (!codReserva || this.directoSwitchDisabled) {
      this.form.directo = previousValue;
      input.checked = previousValue === '1';
      return;
    }

    const actionLabel = nextValue === '1' ? 'desactivar' : 'activar';
    const actionText =
      nextValue === '1'
        ? 'Se desactivará el cálculo de impuestos y se recalcularán los montos en backend.'
        : 'Se activará el cálculo de impuestos y se recalcularán los montos en backend.';

    void Swal.fire({
      title: `¿Desea ${actionLabel} el cálculo de impuestos?`,
      text: actionText,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        this.form.directo = previousValue;
        input.checked = previousValue === '1';
        return;
      }

      this.directoUpdating = true;
      this.form.directo = nextValue;

      this.reservasService.cambiarEstadoDirecto(codReserva, nextValue).pipe(take(1)).subscribe({
        next: () => {
          this.directoUpdating = false;
          // El cambio de "directo" recalcula montos en backend, pero no debe sobrescribir
          // cambios locales aún no guardados del encabezado.
          this.cargarDetalle(codReserva);
        },
        error: (err) => {
          this.directoUpdating = false;
          this.form.directo = previousValue;
          input.checked = previousValue === '1';
          this.logHttpError('Cambiar estado directo', err, { codReserva, directo: nextValue });
          this.showAlert('Error', 'No se pudo actualizar el estado de impuestos.', 'error');
        }
      });
    });
  }

  /**
   * Handler cuando cambia el contexto tarifario dentro del modal de detalle.
   */
  onDetalleTarifaContextChange(): void {
    this.allowManualPricing = false;
    this.reglaTarifaError = '';
    this.cargarServiciosPrecio();
    if (this.showDetalleModal) {
      this.recalcularCosto();
    }
  }

  /**
   * Aplica reglas tarifarias al `DetalleForm` actual (si el modal está abierto).
   * Actualiza errores, precios por tipo pax y el total del servicio.
   */
  private async applyReglaTarifaToDetalleForm(): Promise<boolean> {
    if (!this.showDetalleModal) return false;

    const planId = Number(this.detalleForm.codPlan ?? 0) || 0;
    const codLstPrecio = (this.detalleForm.codLstPrecio || '').trim();
    const codServicio = (this.detalleForm.codServicio || '').trim();
    const detallesPax = this.getDetallePaxItemsForTarifa();

    if (!planId || !codLstPrecio || !codServicio) {
      this.reglaTarifaError = '';
      this.allowManualPricing = false;
      return false;
    }

    if (!detallesPax.length) {
      this.reglaTarifaError = '';
      this.allowManualPricing = false;
      return false;
    }

    const modoPrecio = this.getModoPrecioPorPlan(planId);
    const horaReferencia = normalizeTimeInputValue(this.detalleForm.horaPickup, { zeroAsEmpty: true });
    const result = await this.tarifaService.applyReglaTarifaPorTipos({
      planId,
      codLstPrecio,
      codServicio,
      horaPickup: horaReferencia,
      detallesPax,
      modoPrecio
    });

    if (result.ok === false) {
      this.reglaTarifaError = result.error || '';
      if (result.detalles?.length) {
        this.mergeTarifaResultados(result.detalles);
      }

      const isNoMatch = !!result.error && result.error.includes('No hay una regla tarifaria');
      this.allowManualPricing = isNoMatch;
      this.detalleForm.montoServicio = this.sumPaxPrecioTotal(this.detalleForm.detallesPax);
      return false;
    }

    this.reglaTarifaError = '';
    this.allowManualPricing = false;
    this.mergeTarifaResultados(result.detalles);
    this.detalleForm.montoServicio = result.montoServicio;

    return true;
  }

}
