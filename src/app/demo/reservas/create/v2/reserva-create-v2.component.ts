import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import { MonedaService, MonedaUI } from '../../../administracion/monedas/moneda.service';
import { ListaPrecioService } from '../../../catalogos/listas-precios/lista-precio.service';
import { ListaPrecioUI } from '../../../catalogos/listas-precios/lista-precio.models';
import { TarifasClienteService } from '../../../catalogos/listas-precios/tarifas-cliente.service';
import { PlanesTarifasService, PlanTarifaUI } from '../../../catalogos/listas-precios/planes-tarifas.service';
import { ClienteContactoUI, ClienteUI } from '../../../catalogos/agencias-comisionistas/cliente.models';
import { ClienteService } from '../../../catalogos/agencias-comisionistas/cliente.service';
import { ServiciosService, ServicioUI } from '../../../catalogos/servicios/servicios.service';
import { IdiomasService } from '../../../catalogos/idiomas/idiomas.service';
import { IdiomaDto } from '../../../catalogos/idiomas/idiomas.models';
import { FormaReservasService } from '../../../catalogos/forma-reservas/forma-reservas.service';
import { FormaReservaDto } from '../../../catalogos/forma-reservas/forma-reservas.models';
import { TipoPaxService, TipoPaxUI } from '../../services/tipo-pax.service';
import { ReservaCreateTarifaService, ModoPrecio, ReglaTarifaPaxAplicada } from '../reserva-create.tarifa.service';
import { ServicioPrecioApiItem } from '../reserva-create.tarifa.models';
import { showAlertWithFocusRestore } from '../reserva-create.alert';
import { buildInitialActividadDetalleForm, buildInitialDetalleForm, buildInitialReservaCreateForm } from '../reserva-create.builders';
import { FISCAL_CONFIG } from 'src/app/core/config/fiscal.config';
import { calculateTaxFromNetAmount } from 'src/app/core/config/fiscal.utils';
import { ReservaCreateActividadModalComponent, ActividadModalSavePayload } from '../reserva-create-actividad-modal.component';
import { ReservaCreateClienteModalComponent } from '../reserva-create-cliente-modal.component';
import { ContactoRapidoModalSavePayload, ReservaCreateContactoRapidoModalComponent } from '../reserva-create-contacto-rapido-modal.component';
import { ReservaCreateDetalleModalComponent } from '../reserva-create-detalle-modal.component';
import { ActividadDetalleForm, ActividadPickupForm, DetalleForm, DetallePaxForm, ReservaCreateForm } from '../reserva-create.models';
import { normalizeTimeInputValue, safeNumber, safeString } from '../reserva-create.utils';
import { ReservaContactoRapidoService } from './reserva-contacto-rapido.service';
import { ReservaCreateV2Draft, ReservaDraftServiceLine } from './reserva-create-v2.models';
import {
  clearReservaCreateV2StoredDraft,
  getReservaCreateV2StoredDraft,
  setReservaCreateV2StoredDraft
} from './reserva-create-v2.draft-storage';
import {
  buildInitialReservaCreateV2Draft,
  buildReservaToursPayloadFromDraft,
  calculateDraftTotals,
  getNextDraftLinea,
  mapActividadSavePayloadToDraftServiceLines,
  mapDetalleFormToDraftServiceLine,
  mapReservaToursCompletaToDraft,
  removeDraftServiceLine,
  replaceDraftServiceLine
} from './reserva-tours.mapper';
import { ReservaToursV2Service } from './reserva-tours-v2.service';

type FormaPagoLocalOption = {
  codigo      : string;
  descripcion : string;
};

type DescuentoModo = 'porcentaje' | 'monto';

@Component({
  selector: 'app-reserva-create-v2',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    ReservaCreateClienteModalComponent,
    ReservaCreateContactoRapidoModalComponent,
    ReservaCreateDetalleModalComponent,
    ReservaCreateActividadModalComponent
  ],
  templateUrl: './reserva-create-v2.component.html',
  styleUrls: ['../reserva-create.component.scss', './reserva-create-v2.component.scss']
})
export class ReservaCreateV2Component implements OnInit, CanDeactivateReservaCreate {
  form: ReservaCreateForm = buildInitialReservaCreateForm();
  draft: ReservaCreateV2Draft = buildInitialReservaCreateV2Draft();
  detalleForm: DetalleForm = buildInitialDetalleForm();
  actividadForm: ActividadDetalleForm = buildInitialActividadDetalleForm();
  agenciaSearchTerm = '';
  agenciaSearchOpen = false;
  
  get listaPreciosDisponibles(): ListaPrecioUI[] {
    return this.listasPreciosAsignadas.length ? this.listasPreciosAsignadas : this.listaPreciosVigentes;
  }
  get listaPreciosParaActividad(): ListaPrecioUI[] {
    return this.listaPreciosDisponibles;
  }
  
  agenciaSearchResults            : ClienteUI[] = [];
  idiomas                         : IdiomaDto[] = [];
  formasReservacion               : FormaReservaDto[] = [];
  formasPagoApi                   : FormaPagoLocalOption[] = [];
  listaPrecios                    : ListaPrecioUI[] = [];
  listaPreciosVigentes            : ListaPrecioUI[] = [];
  listasPreciosAsignadas          : ListaPrecioUI[] = [];
  planesTarifas                   : PlanTarifaUI[] = [];
  monedas                         : MonedaUI[] = [];
  servicios                       : ServicioUI[] = [];
  serviciosPrecio                 : ServicioPrecioApiItem[] = [];
  tiposPax                        : TipoPaxUI[] = [];
  contactosCliente                : ClienteContactoUI[] = [];

  showClienteModal = false;
  showContactoRapidoModal = false;
  showDetalleModal = false;
  showActividadModal = false;
  showDescuentoGlobalModal = false;
  showDescuentoLineaModal = false;
  selectedCliente: ClienteUI | null = null;

  contactosLoading = false;
  serviciosLoading = false;
  serviciosPrecioLoading = false;
  guardandoContactoRapido = false;
  guardandoReserva = false;
  guardandoDetalle = false;
  guardandoActividad = false;
  detalleServicioSearch = '';
  reglaTarifaError = '';
  allowManualPricing = false;
  descuentoGlobalModo: DescuentoModo = 'monto';
  descuentoGlobalValor: number | null = null;
  descuentoGlobalError = '';
  descuentoLineaModo: DescuentoModo = 'monto';
  descuentoLineaValor: number | null = null;
  descuentoLineaError = '';
  descuentoLineaSeleccionada: ReservaDraftServiceLine | null = null;

  editingDetalleLinea: number | null = null;
  editingActividadLinea: number | null = null;
  codReservaActual: string | null = null;
  loadingReserva = false;
  private allowNavigation = false;
  private readonly agenciaSearchMinLength = 2;
  agenciaSearchLoading = false;
  private agenciaSearchRequestId = 0;
  private agenciaSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private agenciaSearchBlurTimer: ReturnType<typeof setTimeout> | null = null;

  protected router                     = inject(Router);
  private route                        = inject(ActivatedRoute);
  private authService                  = inject(AuthService);
  private monedaService                = inject(MonedaService);
  private listaPrecioService           = inject(ListaPrecioService);
  private planesTarifasService         = inject(PlanesTarifasService);
  private clienteService               = inject(ClienteService);
  private tarifasClienteService        = inject(TarifasClienteService);
  private tipoPaxService               = inject(TipoPaxService);
  private serviciosService             = inject(ServiciosService);
  private idiomasService               = inject(IdiomasService);
  private formaReservasService         = inject(FormaReservasService);
  private tarifaService                = inject(ReservaCreateTarifaService);
  private contactoRapidoService        = inject(ReservaContactoRapidoService);
  private reservaToursService          = inject(ReservaToursV2Service);
  private listaPreciosAsignadasCodigos = new Set<string>();
  private tarifasClienteRequestId      = 0;

  private clienteDetailRequestId       = 0;

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

  private resolvePlanTarifarioNombre(codPlan: unknown): string {
    const normalized = safeString(codPlan).trim();
    if (!normalized) return '';
    const match = (this.planesTarifas ?? []).find((item) => safeString(item?.planId).trim() === normalized);
    return match ? safeString(match.planId) : normalized;
  }

  ngOnInit(): void {
    this.codReservaActual = safeString(this.route.snapshot.paramMap.get('id')).trim() || null;
    if (!safeString(this.form.moneda).trim()) {
      this.form.moneda = 'USD';
    }
    this.cargarIdiomas();
    this.cargarFormasReservacion();
    this.cargarPlanesTarifas();
    void this.cargarListasPrecios();
    this.cargarTiposPax();
    this.cargarMonedas();
    this.cargarFormasPago();

    const restoredDraft = this.restoreStoredDraft(this.codReservaActual);
    if (restoredDraft) {
      this.syncAgenciaSearchTermFromCurrentState();
      if (safeString(this.form.codAgencia).trim()) {
        void this.cargarClienteDetalle(this.form.codAgencia, { preserveSelection: true, silent: true });
      }
      this.syncDraftHeader();
      return;
    }

    if (this.codReservaActual) {
      void this.cargarReservaCompleta(this.codReservaActual);
      return;
    }

    if (safeString(this.form.codAgencia).trim()) {
      void this.cargarClienteDetalle(this.form.codAgencia, { preserveSelection: true, silent: true });
    }
    this.syncDraftHeader();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.allowNavigation || !this.hasMeaningfulDraft()) {
      return;
    }
    event.preventDefault();
    event.returnValue = true;
  }

  canDeactivate(_nextUrl?: string): boolean | Promise<boolean> {
    if (this.allowNavigation) {
      return true;
    }

    if (!this.hasMeaningfulDraft()) {
      return true;
    }

    const confirmed = window.confirm(
      'Tiene un borrador local pendiente. Si sale ahora, el borrador local se descartará. ¿Desea continuar?'
    );

    if (!confirmed) {
      return false;
    }

    this.allowNavigation = true;
    this.clearStoredDraft();
    return true;
  }

  get tiposPaxBase(): TipoPaxUI[] {
    return this.tiposPax ?? [];
  }

  get detalles(): ReservaDraftServiceLine[] {
    return this.draft.servicios ?? [];
  }

  get draftTotals(): { totalServicios: number; totalNeto: number; totalImpuesto: number } {
    return calculateDraftTotals(this.detalles);
  }

  get totalRack(): number {
    return this.draftTotals.totalServicios;
  }

  get subtotalReserva(): number {
    return roundTo2(this.detalles.reduce((sum, item) => sum + safeNumber(item?.subTotal), 0));
  }

  get totalDescuentoReserva(): number {
    return roundTo2(this.detalles.reduce((sum, item) => sum + safeNumber(item?.descuento), 0));
  }

  get totalNetoReserva(): number {
    return this.draftTotals.totalNeto;
  }

  get totalImpuestosReserva(): number {
    return this.draftTotals.totalImpuesto;
  }

  get cantidadServicios(): number {
    return this.detalles.length;
  }

  get hayDescuentosAplicados(): boolean {
    return this.detalles.some((item) => safeNumber(item?.descuento) > 0 || safeNumber(item?.porDescuento) > 0);
  }

  get selectedContactoCliente(): ClienteContactoUI | null {
    const selectedId = safeNumber(this.form.idContacto);
    return this.contactosCliente.find((item) => safeNumber(item.id) === selectedId) ?? null;
  }

  get estadoLabel(): string {
    if (!this.codReservaActual) {
      return 'LOCAL';
    }
    switch (this.form.estado) {
      case 'CON':
        return 'CONFIRMADA';
      case 'CAN':
        return 'ANULADA';
      default:
        return 'PENDIENTE';
    }
  }

  get estadoBadgeClass(): string {
    if (!this.codReservaActual) {
      return 'bg-info';
    }
    switch (this.form.estado) {
      case 'CON':
        return 'bg-success';
      case 'CAN':
        return 'bg-danger';
      default:
        return 'bg-warning';
    }
  }

  onHeaderChange(): void {
    this.syncDraftHeader();
  }

  async guardarReserva(formRef?: any): Promise<void> {
    if (this.guardandoReserva) return;
    if (formRef?.invalid) {
      this.showValidationErrors(formRef);
      return;
    }
    if (!this.detalles.length) {
      this.showAlert('Atención', 'Agregue al menos un servicio antes de guardar.', 'warning');
      return;
    }

    this.guardandoReserva = true;
    this.syncDraftHeader();

    try {
      const isEditing = !!safeString(this.codReservaActual).trim();
      const payload = buildReservaToursPayloadFromDraft(this.draft, isEditing ? 2 : 1, this.codReservaActual || undefined);
      if (isEditing) {
        payload.estado = 'CON';
        payload.codReserva = this.codReservaActual;
      }

      this.logReservaPayload(isEditing ? 'PUT' : 'POST', payload);

      const response = await firstValueFrom(
        (isEditing
          ? this.reservaToursService.actualizarReserva(this.codReservaActual!, payload)
          : this.reservaToursService.crearReserva(payload)
        ).pipe(take(1))
      );
      const respuesta = safeString(response?.respuesta).trim().toUpperCase();
      const backendMessage = safeString(response?.mensaje).trim();
      const codReserva = safeString(response?.codReserva || response?.CodReserva || response?.PRV01_CodReserva || this.codReservaActual);
      if (respuesta && respuesta !== 'OK') {
        this.showAlert('Error', backendMessage || `El backend rechazó la ${isEditing ? 'actualización' : 'creación'} de la reserva.`, 'error');
        return;
      }
      if (!codReserva) {
        this.showAlert('Error', backendMessage || 'El endpoint no devolvió `codReserva`.', 'error');
        return;
      }
      if (isEditing) {
        this.form.estado = 'CON';
      }
      this.allowNavigation = true;
      this.clearStoredDraft();
      this.showAlert(
        'Éxito',
        backendMessage || `Reserva ${codReserva} ${isEditing ? 'actualizada' : 'guardada'} correctamente.`,
        'success'
      );
      await this.router.navigate(['/operaciones/reservas']);
    } catch (error) {
      console.error('[ReservaCreateV2] guardarReserva', error);
      this.showAlert('Error', 'No se pudo guardar la reserva unificada.', 'error');
    } finally {
      this.guardandoReserva = false;
    }
  }

  private logReservaPayload(method: 'POST' | 'PUT', payload: ReturnType<typeof buildReservaToursPayloadFromDraft>): void {
    const detalleServicios = payload?.detalleServicios ?? [];
    console.groupCollapsed('[ReservaCreateV2] ' + method + ' reserva payload - ' + detalleServicios.length + ' servicio(s)');
    console.log('payload completo:', payload);
    console.table(
      detalleServicios.map((item) => ({
        linea           : item.linea,
        codServicio     : item.codServicio,
        nomServicio     : item.nomServicio,
        planTarifa      : item.planTarifa,
        codPlan         : payload.codPlan,
        codLstPrecio    : item.codLstPrecio
      }))
    );
    console.groupEnd();
  }

  async cancelar(): Promise<void> {
    if (this.allowNavigation) {
      await this.router.navigate(['/operaciones/reservas']);
      return;
    }

    if (!this.hasMeaningfulDraft()) {
      this.allowNavigation = true;
      this.clearStoredDraft();
      await this.router.navigate(['/operaciones/reservas']);
      return;
    }

    const result = await Swal.fire({
      title: 'Borrador local pendiente',
      text: 'Tiene cambios locales sin enviar al backend. ¿Desea descartar el borrador y salir?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, descartar',
      cancelButtonText: 'Seguir editando'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.allowNavigation = true;
    this.clearStoredDraft();
    await this.router.navigate(['/operaciones/reservas']);
  }

  abrirModalClientes(): void {
    this.showClienteModal = true;
  }

  onAgenciaSearchTermChange(value: string): void {
    this.agenciaSearchTerm = safeString(value);
    this.clearAgenciaSearchBlurTimer();

    if (this.shouldClearSelectedCliente(this.agenciaSearchTerm)) {
      this.clearSelectedClienteState();
    }

    const term = this.agenciaSearchTerm.trim();
    if (this.agenciaSearchDebounceTimer) {
      clearTimeout(this.agenciaSearchDebounceTimer);
      this.agenciaSearchDebounceTimer = null;
    }

    if (term.length < this.agenciaSearchMinLength) {
      this.cancelAgenciaSearchRequests();
      this.agenciaSearchResults = [];
      this.agenciaSearchOpen = false;
      return;
    }

    this.agenciaSearchDebounceTimer = setTimeout(() => {
      void this.buscarAgenciasDirecto(term);
    }, 280);
  }

  onAgenciaSearchFocus(): void {
    this.clearAgenciaSearchBlurTimer();
    if (this.agenciaSearchResults.length && this.agenciaSearchTerm.trim().length >= this.agenciaSearchMinLength) {
      this.agenciaSearchOpen = true;
    }
  }

  onAgenciaSearchBlur(): void {
    this.clearAgenciaSearchBlurTimer();
    this.agenciaSearchBlurTimer = setTimeout(() => {
      this.agenciaSearchOpen = false;
    }, 180);
  }

  onAgenciaSearchEnter(event: Event): void {
    event.preventDefault();
    this.clearAgenciaSearchBlurTimer();
    if (this.agenciaSearchResults.length) {
      void this.seleccionarAgenciaBusqueda(this.agenciaSearchResults[0]);
      return;
    }
    const term = this.agenciaSearchTerm.trim();
    if (term.length >= this.agenciaSearchMinLength) {
      void this.buscarAgenciasDirecto(term);
    }
  }

  onAgenciaSuggestionMouseDown(cliente: ClienteUI, event: MouseEvent): void {
    event.preventDefault();
    void this.seleccionarAgenciaBusqueda(cliente);
  }

  async onClienteSelected(cliente: ClienteUI): Promise<void> {
    this.selectedCliente = cliente;
    this.form.codAgencia = cliente.codigo;
    this.syncAgenciaSearchTermFromCurrentState();
    this.cancelAgenciaSearchRequests();
    this.agenciaSearchResults = [];
    this.agenciaSearchOpen = false;
    this.showClienteModal = false;
    this.contactosCliente = [];
    this.applyContactoSeleccionado(null, false);
    this.resetListasPreciosAsignadas();
    this.syncDraftHeader();
    await this.cargarClienteDetalle(cliente.codigo);
  }

  limpiarSeleccionCliente(): void {
    this.clearSelectedClienteState();
    this.agenciaSearchTerm = '';
    this.cancelAgenciaSearchRequests();
    this.agenciaSearchResults = [];
    this.agenciaSearchOpen = false;
  }

  onContactoSeleccionado(contactId: number | string): void {
    const contactoId = safeNumber(contactId);
    const contacto = this.contactosCliente.find((item) => safeNumber(item.id) === contactoId) ?? null;
    this.applyContactoSeleccionado(contacto);
  }

  abrirModalContactoRapido(): void {
    if (!safeString(this.form.codAgencia).trim()) {
      return;
    }
    this.showContactoRapidoModal = true;
  }

  cerrarModalContactoRapido(): void {
    if (this.guardandoContactoRapido) {
      return;
    }
    this.showContactoRapidoModal = false;
  }

  async guardarContactoRapido(payload: ContactoRapidoModalSavePayload): Promise<void> {
    if (this.guardandoContactoRapido) {
      return;
    }

    const codAgencia = safeString(payload.codAgencia).trim();
    const nomContacto = safeString(payload.nomContacto).trim();
    if (!codAgencia || !nomContacto) {
      this.showAlert('Atención', 'Debe indicar el nombre del contacto.', 'warning');
      return;
    }

    this.guardandoContactoRapido = true;
    try {
      const response = await firstValueFrom(
        this.contactoRapidoService
          .crearContactoRapido({
            codAgencia,
            nomContacto,
            marcarPrincipal: this.contactosCliente.length === 0
          })
          .pipe(take(1))
      );
      const contactoId = safeNumber(response?.idContactoCreado || response?.contacto?.id);
      if (!contactoId) {
        this.showAlert('Error', 'El endpoint no devolvió `idContactoCreado`.', 'error');
        return;
      }
      await this.cargarClienteDetalle(codAgencia, { preferredContactId: contactoId });
      this.showContactoRapidoModal = false;
      this.showAlert('Éxito', safeString(response?.mensaje) || 'Contacto creado correctamente.', 'success');
    } catch (error) {
      console.error('[ReservaCreateV2] guardarContactoRapido', error);
      this.showAlert('Error', 'No se pudo crear el contacto rápido.', 'error');
    } finally {
      this.guardandoContactoRapido = false;
    }
  }

  async abrirModalDetalle(detalle?: ReservaDraftServiceLine): Promise<void> {
    this.editingActividadLinea = null;
    this.editingDetalleLinea = detalle?.linea ?? null;
    this.allowManualPricing = false;
    this.reglaTarifaError = '';

    if (detalle) {
      this.detalleForm = this.mapDraftServiceLineToDetalleForm(detalle);
    } else {
      this.detalleForm = buildInitialDetalleForm();
      this.detalleForm.codPlan = this.form.codPlan || this.resolveDefaultPlanId();
      this.detalleForm.codLstPrecio = this.form.codLstPrecio || this.resolveDefaultListaPrecio();
    }

    this.ensureDetallePaxDefaults();
    this.showDetalleModal = true;
    if (!this.servicios.length) {
      this.cargarServicios('TRANS');
    }
    this.detalleServicioSearch = '';
    this.cargarServiciosPrecio();
  }

  cerrarModalDetalle(): void {
    this.showDetalleModal = false;
    this.editingDetalleLinea = null;
  }

  async guardarDetalle(detalleFormRef: any): Promise<void> {
    if (this.guardandoDetalle) return;
    if (detalleFormRef?.invalid) {
      detalleFormRef.control?.markAllAsTouched?.();
      return;
    }

    const paxItems = this.getDetallePaxItemsForPayload();
    if (!paxItems.length) {
      this.showAlert('Atención', 'Agregue al menos un tipo de pax con cantidad mayor a cero.', 'warning');
      return;
    }

    this.guardandoDetalle = true;
    try {
      const reglaAplicada = await this.applyReglaTarifaToDetalleForm();
      if (!reglaAplicada && !this.allowManualPricing) {
        this.showAlert(
          'Atención',
          this.reglaTarifaError || 'No se pudo aplicar la regla tarifaria al servicio seleccionado.',
          'warning'
        );
        return;
      }

      const nextLinea = this.editingDetalleLinea ?? getNextDraftLinea(this.detalles);
      const line = mapDetalleFormToDraftServiceLine(this.detalleForm, nextLinea, this.form.directo || '0');
      this.draft = replaceDraftServiceLine(this.draft, line);
      this.reindexDraftServicios();
      this.syncDraftHeader();
      this.cerrarModalDetalle();
    } catch (error) {
      console.error('[ReservaCreateV2] guardarDetalle', error);
      this.showAlert('Error', 'No se pudo preparar el servicio para el borrador local.', 'error');
    } finally {
      this.guardandoDetalle = false;
    }
  }

  async abrirModalActividad(detalle?: ReservaDraftServiceLine): Promise<void> {
    this.editingDetalleLinea = null;
    this.editingActividadLinea = detalle?.linea ?? null;
    if (detalle) {
      this.actividadForm = this.mapDraftServiceLineToActividadForm(detalle);
    } else {
      this.actividadForm = buildInitialActividadDetalleForm();
      this.actividadForm.codPlan = this.form.codPlan || this.resolveDefaultPlanId();
      this.actividadForm.codLstPrecio = this.form.codLstPrecio || this.resolveDefaultListaPrecio();
      this.applyActividadDefaultsFromLastDetalle();
    }

    if (this.selectedCliente?.codigo) {
      void this.cargarListasPreciosAsignadasParaCliente(this.selectedCliente.codigo);
    } else {
      this.resetListasPreciosAsignadas();
    }
    this.showActividadModal = true;
    this.cargarServicios('TOURS');
  }

  cerrarModalActividad(): void {
    this.showActividadModal = false;
    this.editingActividadLinea = null;
    this.actividadForm = buildInitialActividadDetalleForm();
  }

  async guardarActividadDetalle(saveData: ActividadModalSavePayload): Promise<void> {
    if (this.guardandoActividad) return;
    this.guardandoActividad = true;

    try {
      const baseDraft = this.editingActividadLinea != null ? removeDraftServiceLine(this.draft, this.editingActividadLinea) : this.draft;
      const nextLinea = this.editingActividadLinea ?? getNextDraftLinea(baseDraft.servicios);
      const lines = mapActividadSavePayloadToDraftServiceLines(
        saveData,
        nextLinea,
        this.form.directo || '0',
        undefined,
        this.actividadForm.tipoServicio
      );
      let nextDraft = baseDraft;
      for (const line of lines) {
        nextDraft = replaceDraftServiceLine(nextDraft, line);
      }
      this.draft = nextDraft;
      this.reindexDraftServicios();
      this.syncDraftHeader();
      this.cerrarModalActividad();
    } catch (error) {
      console.error('[ReservaCreateV2] guardarActividadDetalle', error);
      this.showAlert('Error', 'No se pudo preparar la actividad para el borrador local.', 'error');
    } finally {
      this.guardandoActividad = false;
    }
  }

  editarLinea(detalle: ReservaDraftServiceLine): void {
    if (detalle.source === 'actividad') {
      void this.abrirModalActividad(detalle);
      return;
    }
    void this.abrirModalDetalle(detalle);
  }

  eliminarLinea(detalle: ReservaDraftServiceLine): void {
    void Swal.fire({
      title: `Eliminar servicio #${detalle.linea}`,
      text: 'Esta acción eliminará el servicio del borrador local. ¿Desea continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.draft = removeDraftServiceLine(this.draft, detalle.linea);
      this.reindexDraftServicios();
      this.syncDraftHeader();
    });
  }

  abrirModalDescuentoGlobal(): void {
    if (!this.detalles.length) {
      this.showAlert('Atención', 'Agregue al menos un servicio antes de aplicar descuento.', 'warning');
      return;
    }
    this.descuentoGlobalModo = 'monto';
    this.descuentoGlobalValor = null;
    this.descuentoGlobalError = '';
    this.showDescuentoGlobalModal = true;
  }

  cerrarModalDescuentoGlobal(): void {
    this.showDescuentoGlobalModal = false;
    this.descuentoGlobalError = '';
  }

  aplicarDescuentoGlobal(): void {
    const valor = safeNumber(this.descuentoGlobalValor);
    if (valor <= 0) {
      this.descuentoGlobalError = 'Ingrese un descuento mayor a cero.';
      return;
    }

    const totalSinDescuento = this.getTotalDocumentoSinDescuento();
    if (totalSinDescuento <= 0) {
      this.descuentoGlobalError = 'No hay base disponible para aplicar descuento.';
      return;
    }

    if (this.descuentoGlobalModo === 'porcentaje' && valor > 100) {
      this.descuentoGlobalError = 'El porcentaje no puede ser mayor a 100.';
      return;
    }

    if (this.descuentoGlobalModo === 'monto' && valor > totalSinDescuento) {
      this.descuentoGlobalError = 'El monto no puede superar el total del documento.';
      return;
    }

    let descuentoFinalPendiente = this.descuentoGlobalModo === 'monto'
      ? roundTo2(valor)
      : roundTo2(totalSinDescuento * valor / 100);

    const descuentoFinalTotal = descuentoFinalPendiente;
    const serviciosConBase = this.detalles.filter((line) => this.getLineTotalSinDescuento(line) > 0);
    this.draft = {
      ...this.draft,
      servicios: this.detalles.map((line) => {
        if (!serviciosConBase.some((item) => item.linea === line.linea)) {
          return this.recalculateDraftServiceLineTotals(line, 0, 0);
        }

        const isLast = line.linea === serviciosConBase[serviciosConBase.length - 1]?.linea;
        const lineTotalSinDescuento = this.getLineTotalSinDescuento(line);
        const descuentoFinalLinea = this.descuentoGlobalModo === 'monto'
          ? isLast
            ? descuentoFinalPendiente
            : roundTo2(descuentoFinalTotal * (lineTotalSinDescuento / totalSinDescuento))
          : roundTo2(lineTotalSinDescuento * valor / 100);

        if (this.descuentoGlobalModo === 'monto') {
          descuentoFinalPendiente = roundTo2(Math.max(0, descuentoFinalPendiente - descuentoFinalLinea));
        }

        const descuentoBase = this.convertFinalDiscountToBaseDiscount(line, descuentoFinalLinea);
        const porcentaje = safeNumber(line.subTotal) > 0 ? roundTo2((descuentoBase / safeNumber(line.subTotal)) * 100) : 0;
        return this.recalculateDraftServiceLineTotals(line, descuentoBase, porcentaje);
      })
    };

    this.syncDraftHeader();
    this.cerrarModalDescuentoGlobal();
  }

  desaplicarDescuentos(): void {
    if (!this.hayDescuentosAplicados) {
      return;
    }
    this.draft = {
      ...this.draft,
      servicios: this.detalles.map((line) => this.recalculateDraftServiceLineTotals(line, 0, 0))
    };
    this.syncDraftHeader();
  }

  abrirModalDescuentoLinea(detalle: ReservaDraftServiceLine): void {
    this.descuentoLineaSeleccionada = detalle;
    this.descuentoLineaModo = 'monto';
    this.descuentoLineaValor = null;
    this.descuentoLineaError = '';
    this.showDescuentoLineaModal = true;
  }

  cerrarModalDescuentoLinea(): void {
    this.showDescuentoLineaModal = false;
    this.descuentoLineaSeleccionada = null;
    this.descuentoLineaError = '';
  }

  aplicarDescuentoLinea(): void {
    const line = this.descuentoLineaSeleccionada;
    if (!line) {
      this.descuentoLineaError = 'Seleccione una línea válida.';
      return;
    }

    const valor = safeNumber(this.descuentoLineaValor);
    if (valor <= 0) {
      this.descuentoLineaError = 'Ingrese un descuento mayor a cero.';
      return;
    }

    const totalLineaSinDescuento = this.getLineTotalSinDescuento(line);
    if (totalLineaSinDescuento <= 0) {
      this.descuentoLineaError = 'La línea no tiene base disponible para descuento.';
      return;
    }

    if (this.descuentoLineaModo === 'porcentaje' && valor > 100) {
      this.descuentoLineaError = 'El porcentaje no puede ser mayor a 100.';
      return;
    }

    if (this.descuentoLineaModo === 'monto' && valor > totalLineaSinDescuento) {
      this.descuentoLineaError = 'El monto no puede superar el total de la línea.';
      return;
    }

    const descuentoFinal = this.descuentoLineaModo === 'monto'
      ? roundTo2(valor)
      : roundTo2(totalLineaSinDescuento * valor / 100);
    const descuentoBase = this.convertFinalDiscountToBaseDiscount(line, descuentoFinal);
    const porcentaje = safeNumber(line.subTotal) > 0 ? roundTo2((descuentoBase / safeNumber(line.subTotal)) * 100) : 0;

    this.draft = {
      ...this.draft,
      servicios: this.detalles.map((item) =>
        item.linea === line.linea
          ? this.recalculateDraftServiceLineTotals(item, descuentoBase, porcentaje)
          : item
      )
    };
    this.syncDraftHeader();
    this.cerrarModalDescuentoLinea();
  }

  quitarDescuentoLinea(detalle: ReservaDraftServiceLine): void {
    this.draft = {
      ...this.draft,
      servicios: this.detalles.map((item) =>
        item.linea === detalle.linea
          ? this.recalculateDraftServiceLineTotals(item, 0, 0)
          : item
      )
    };
    this.syncDraftHeader();
  }

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

  onDetalleServicioSearch(term: string): void {
    this.cargarServiciosPrecio(term, false);
  }

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

  onDetalleTarifaContextChange(): void {
    this.allowManualPricing = false;
    this.reglaTarifaError = '';
    this.cargarServiciosPrecio();
    if (this.showDetalleModal) {
      this.recalcularCosto();
    }
  }

  recalcularCosto(): void {
    void this.applyReglaTarifaToDetalleForm();
  }

  onDirectoLocalChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    this.form.directo = input.checked ? '1' : '0';
    this.recalculateServiciosForDirecto();
    this.syncDraftHeader();
  }

  getDetallePaxSummary(detalle: ReservaDraftServiceLine): string {
    return (detalle.pasajeros ?? []).map((item) => `${item.tipoPax}: ${item.cantidad}`).join(', ') || '-';
  }

  getDetalleDescuentoLabel(detalle: ReservaDraftServiceLine): string {
    const monto = safeNumber(detalle?.descuento);
    const porcentaje = safeNumber(detalle?.porDescuento);
    if (monto <= 0) {
      return '-';
    }
    if (porcentaje > 0) {
      return `${porcentaje.toFixed(2)}% (-${monto.toFixed(2)})`;
    }
    return `-${monto.toFixed(2)}`;
  }

  getDetalleDescuentoTooltip(detalle: ReservaDraftServiceLine): string {
    const subtotal = safeNumber(detalle?.subTotal);
    const descuento = safeNumber(detalle?.descuento);
    const neto = safeNumber(detalle?.neto);
    const impuesto = safeNumber(detalle?.impuesto);
    const total = safeNumber(detalle?.montoServicio);
    const porcentaje = safeNumber(detalle?.porDescuento);
    const moneda = safeString(this.form?.moneda).trim();
    const suffix = moneda ? ` ${moneda}` : '';

    return [
      `Base: ${subtotal.toFixed(2)}${suffix}`,
      `Descuento: ${descuento.toFixed(2)}${suffix}${porcentaje > 0 ? ` (${porcentaje.toFixed(2)}%)` : ''}`,
      `Neto: ${neto.toFixed(2)}${suffix}`,
      `Impuesto: ${impuesto.toFixed(2)}${suffix}`,
      `Total: ${total.toFixed(2)}${suffix}`
    ].join('\n');
  }

  private syncDraftHeader(): void {
    this.draft = {
      ...this.draft,
      header: {
        ...this.draft.header,
        ...this.form,
        codReserva: this.codReservaActual || this.draft.header?.codReserva || '',
        totalRsv: this.totalRack,
        folio: safeString(this.form.folio),
        operador: this.getOperador()
      }
    };
    this.persistStoredDraft();
  }

  private persistStoredDraft(): void {
    if (!this.hasMeaningfulDraft()) {
      this.clearStoredDraft();
      return;
    }
    setReservaCreateV2StoredDraft(this.draft, this.selectedCliente);
  }

  private clearStoredDraft(): void {
    clearReservaCreateV2StoredDraft();
  }

  private restoreStoredDraft(expectedCodReserva: string | null): boolean {
    const stored = getReservaCreateV2StoredDraft();
    if (!stored?.draft) {
      return false;
    }

    const storedCodReserva = safeString(stored.draft.header?.codReserva).trim();
    const expected = safeString(expectedCodReserva).trim();
    if (expected) {
      if (storedCodReserva !== expected) {
        return false;
      }
    } else if (storedCodReserva) {
      return false;
    }

    this.draft = stored.draft;
    this.form = {
      ...buildInitialReservaCreateForm(),
      ...(stored.draft.header ?? {})
    };
    this.selectedCliente = stored.selectedCliente ?? null;
    this.syncAgenciaSearchTermFromCurrentState();
    this.codReservaActual = storedCodReserva || null;
    return true;
  }

  private async cargarReservaCompleta(codReserva: string): Promise<void> {
    const normalized = safeString(codReserva).trim();
    if (!normalized) {
      return;
    }

    this.loadingReserva = true;
    try {
      const response = await firstValueFrom(this.reservaToursService.getReservaCompleta(normalized).pipe(take(1)));
      const nextDraft = mapReservaToursCompletaToDraft(response);
      this.codReservaActual = safeString(nextDraft.header.codReserva || normalized).trim() || normalized;
      this.draft = nextDraft;
      this.form = {
        ...buildInitialReservaCreateForm(),
        ...(nextDraft.header ?? {})
      };
      this.selectedCliente = null;
      this.syncAgenciaSearchTermFromCurrentState();
      if (safeString(this.form.codAgencia).trim()) {
        await this.cargarClienteDetalle(this.form.codAgencia, { preserveSelection: true, silent: true });
      }
      this.syncDraftHeader();
    } catch (error) {
      console.error('[ReservaCreateV2] cargarReservaCompleta', error);
      this.showAlert('Error', 'No se pudo cargar la reserva para edición en V2.', 'error');
    } finally {
      this.loadingReserva = false;
    }
  }

  private async cargarClienteDetalle(
    codigo: string,
    options?: { preserveSelection?: boolean; preferredContactId?: number; silent?: boolean }
  ): Promise<void> {
    const normalized = safeString(codigo).trim();
    if (!normalized) {
      this.resetListasPreciosAsignadas();
      this.contactosCliente = [];
      this.applyContactoSeleccionado(null, false);
      this.syncDraftHeader();
      return;
    }

    const currentRequest = ++this.clienteDetailRequestId;
    this.contactosLoading = true;
    try {
      const cliente = await firstValueFrom(this.clienteService.getClienteByCodigo(normalized).pipe(take(1)));
      if (currentRequest !== this.clienteDetailRequestId) {
        return;
      }
      if (!cliente) {
        this.resetListasPreciosAsignadas();
        this.contactosCliente = [];
        this.applyContactoSeleccionado(null, false);
        if (!options?.silent) {
          this.showAlert('Atención', 'No se pudo cargar el detalle del cliente seleccionado.', 'warning');
        }
        this.syncDraftHeader();
        return;
      }

      this.selectedCliente = cliente;
      this.syncAgenciaSearchTermFromCurrentState();
      this.contactosCliente = this.sortContactosCliente(cliente.contactos ?? []);
      void this.cargarListasPreciosAsignadasParaCliente(cliente.codigo);
      const preferredId = safeNumber(options?.preferredContactId || (options?.preserveSelection ? this.form.idContacto : 0));
      const selectedContacto =
        this.contactosCliente.find((item) => safeNumber(item.id) === preferredId) ?? this.resolveContactoPorDefecto(this.contactosCliente);
      this.applyContactoSeleccionado(selectedContacto, false);
      this.syncDraftHeader();
    } catch (error) {
      if (currentRequest !== this.clienteDetailRequestId) {
        return;
      }
      console.error('[ReservaCreateV2] cargarClienteDetalle', error);
      this.contactosCliente = [];
      this.applyContactoSeleccionado(null, false);
      this.syncDraftHeader();
      if (!options?.silent) {
        this.showAlert('Error', 'No se pudo cargar el detalle del cliente seleccionado.', 'error');
      }
    } finally {
      if (currentRequest === this.clienteDetailRequestId) {
        this.contactosLoading = false;
      }
    }
  }

  private applyContactoSeleccionado(contacto: ClienteContactoUI | null, syncHeader = true): void {
    this.form.idContacto = safeNumber(contacto?.id);
    this.form.nomContactoAgencia = safeString(contacto?.nomContacto);
    if (syncHeader) {
      this.syncDraftHeader();
    }
  }

  private syncAgenciaSearchTermFromCurrentState(): void {
    if (this.selectedCliente) {
      this.agenciaSearchTerm = this.buildAgenciaSearchLabel(this.selectedCliente);
      return;
    }
    this.agenciaSearchTerm = safeString(this.form.codAgencia).trim();
  }

  private buildAgenciaSearchLabel(cliente: ClienteUI | null): string {
    if (!cliente) {
      return '';
    }
    const codigo = safeString(cliente.codigo).trim();
    const nombre = safeString(cliente.nombre).trim();
    const contacto = safeString(cliente.contacto).trim();
    return [codigo, nombre].filter(Boolean).join(' - ') || codigo || contacto;
  }

  private shouldClearSelectedCliente(nextTerm: string): boolean {
    if (!this.selectedCliente) {
      return false;
    }
    const normalizedTerm = safeString(nextTerm).trim();
    const selectedLabel = this.buildAgenciaSearchLabel(this.selectedCliente);
    const selectedCode = safeString(this.selectedCliente.codigo).trim();
    return normalizedTerm !== selectedLabel && normalizedTerm !== selectedCode;
  }

  private clearSelectedClienteState(syncHeader = true): void {
    this.selectedCliente = null;
    this.form.codAgencia = '';
    this.contactosCliente = [];
    this.applyContactoSeleccionado(null, false);
    if (syncHeader) {
      this.syncDraftHeader();
    }
  }

  private async cargarListasPreciosAsignadasParaCliente(codigo?: string): Promise<void> {
    const normalized = safeString(codigo).trim();
    if (!normalized) {
      this.resetListasPreciosAsignadas();
      return;
    }
    const currentRequest = ++this.tarifasClienteRequestId;
    this.listaPreciosAsignadasCodigos.clear();
    this.listasPreciosAsignadas = [];
    try {
      const asignaciones = await firstValueFrom(this.tarifasClienteService.getAsignaciones(normalized).pipe(take(1)));
      if (currentRequest !== this.tarifasClienteRequestId) {
        return;
      }
      const codigos = new Set<string>();
      for (const item of asignaciones ?? []) {
        const code = safeString(item.codTari);
        if (code) {
          codigos.add(code);
        }
      }
      this.listaPreciosAsignadasCodigos = codigos;
    } catch (error) {
      if (currentRequest !== this.tarifasClienteRequestId) {
        return;
      }
      console.error('[ReservaCreateV2] cargarListasPreciosAsignadasParaCliente', error);
      this.listaPreciosAsignadasCodigos.clear();
    } finally {
      if (currentRequest === this.tarifasClienteRequestId) {
        this.actualizarListasPreciosAsignadasCache();
      }
    }
  }

  private actualizarListasPreciosAsignadasCache(): void {
    if (!this.listaPreciosAsignadasCodigos.size) {
      this.listasPreciosAsignadas = [];
      return;
    }
    const activos = this.listaPrecios.filter((lista) => {
      const codigo = safeString(lista.codigo);
      return (
        codigo &&
        this.listaPreciosAsignadasCodigos.has(codigo) &&
        safeString(lista.vigente).toUpperCase() === 'S'
      );
    });
    this.listasPreciosAsignadas = activos;
  }

  private resetListasPreciosAsignadas(): void {
    this.listaPreciosAsignadasCodigos.clear();
    this.listasPreciosAsignadas = [];
  }

  private clearAgenciaSearchBlurTimer(): void {
    if (this.agenciaSearchBlurTimer) {
      clearTimeout(this.agenciaSearchBlurTimer);
      this.agenciaSearchBlurTimer = null;
    }
  }

  private cancelAgenciaSearchRequests(): void {
    if (this.agenciaSearchDebounceTimer) {
      clearTimeout(this.agenciaSearchDebounceTimer);
      this.agenciaSearchDebounceTimer = null;
    }
    this.agenciaSearchRequestId += 1;
    this.agenciaSearchLoading = false;
  }

  private async buscarAgenciasDirecto(term: string): Promise<void> {
    const normalized = safeString(term).trim();
    if (normalized.length < this.agenciaSearchMinLength) {
      this.agenciaSearchResults = [];
      this.agenciaSearchOpen = false;
      this.agenciaSearchLoading = false;
      return;
    }

    const currentRequest = ++this.agenciaSearchRequestId;
    this.agenciaSearchLoading = true;
    try {
      const response = await firstValueFrom(this.clienteService.getClientes(1, 8, normalized).pipe(take(1)));
      if (currentRequest !== this.agenciaSearchRequestId || this.agenciaSearchTerm.trim() !== normalized) {
        return;
      }
      this.agenciaSearchResults = response.data ?? [];
      this.agenciaSearchOpen = true;
    } catch (error) {
      if (currentRequest !== this.agenciaSearchRequestId) {
        return;
      }
      console.error('[ReservaCreateV2] buscarAgenciasDirecto', error);
      this.agenciaSearchResults = [];
      this.agenciaSearchOpen = true;
    } finally {
      if (currentRequest === this.agenciaSearchRequestId) {
        this.agenciaSearchLoading = false;
      }
    }
  }

  private async seleccionarAgenciaBusqueda(cliente: ClienteUI): Promise<void> {
    this.clearAgenciaSearchBlurTimer();
    this.cancelAgenciaSearchRequests();
    this.agenciaSearchResults = [];
    this.agenciaSearchOpen = false;
    await this.onClienteSelected(cliente);
  }

  private resolveContactoPorDefecto(contactos: ClienteContactoUI[]): ClienteContactoUI | null {
    return contactos.find((item) => item.principal) ?? contactos[0] ?? null;
  }

  private sortContactosCliente(contactos: ClienteContactoUI[]): ClienteContactoUI[] {
    return [...(contactos ?? [])]
      .filter((item) => item.activo !== false)
      .sort((a, b) => {
        const principalDelta = Number(!!b.principal) - Number(!!a.principal);
        if (principalDelta !== 0) {
          return principalDelta;
        }
        return safeString(a.nomContacto).localeCompare(safeString(b.nomContacto));
      });
  }

  private hasMeaningfulDraft(): boolean {
    if ((this.draft.servicios ?? []).length > 0) {
      return true;
    }

    const header = this.draft.header ?? this.form;
    return !!(
      safeString(header.codAgencia).trim() ||
      safeString(header.nomCliente).trim() ||
      safeString(header.telCliente).trim() ||
      safeString(header.emailCliente).trim() ||
      safeString(header.comentarios).trim()
    );
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private reindexDraftServicios(): void {
    this.draft = {
      ...this.draft,
      servicios: [...(this.draft.servicios ?? [])]
        .sort((a, b) => a.linea - b.linea)
        .map((item, index) => ({ ...item, linea: index + 1 }))
    };
  }

  private recalculateServiciosForDirecto(): void {
    const directo = this.form.directo || '0';
    const settings = {
      pricesIncludeTax: FISCAL_CONFIG.pricesIncludeTax,
      taxRate: FISCAL_CONFIG.taxRate,
      redondeoDecimales: 2
    };
    this.draft = {
      ...this.draft,
      servicios: (this.draft.servicios ?? []).map((line) => {
        const lineSubtotal = roundTo2(
          safeNumber(line.subTotal) ||
            (line.pasajeros ?? []).reduce((sum, pax) => sum + safeNumber(pax.subtotalNeto), 0)
        );
        const descuento = roundTo2(Math.min(Math.max(0, safeNumber(line.descuento)), lineSubtotal));
        const lineNeto = roundTo2(Math.max(0, lineSubtotal - descuento));
        const lineTotals = calculateTaxFromNetAmount(lineNeto, directo, settings);

        const pasajeros = (line.pasajeros ?? []).map((pax) => {
          const cantidad = safeNumber(pax.cantidad);
          const subtotalNeto = roundTo2(safeNumber(pax.subtotalNeto));
          const paxTotals = calculateTaxFromNetAmount(subtotalNeto, directo, settings);
          const subtotalIVA = paxTotals.iva;
          const subtotalTotal = paxTotals.total;
          const precioUnitarioNeto =
            cantidad > 0 ? roundTo2(subtotalNeto / cantidad) : roundTo2(safeNumber(pax.precioUnitarioNeto));
          const precioUnitarioIVA = cantidad > 0 ? roundTo2(subtotalIVA / cantidad) : 0;
          const precioUnitarioTotal = roundTo2(precioUnitarioNeto + precioUnitarioIVA);

          return {
            ...pax,
            precioUnitarioNeto,
            precioUnitarioIVA,
            precioUnitarioTotal,
            subtotalNeto,
            subtotalIVA,
            subtotalTotal
          };
        });

        return {
          ...line,
          subTotal: lineSubtotal,
          descuento,
          neto: lineTotals.neto,
          impuesto: lineTotals.iva,
          montoServicio: lineTotals.total,
          pasajeros
        };
      })
    };
  }

  private recalculateDraftServiceLineTotals(
    line: ReservaDraftServiceLine,
    descuentoBase = safeNumber(line.descuento),
    porDescuento = safeNumber(line.porDescuento)
  ): ReservaDraftServiceLine {
    const settings = {
      pricesIncludeTax: FISCAL_CONFIG.pricesIncludeTax,
      taxRate: FISCAL_CONFIG.taxRate,
      redondeoDecimales: 2
    };
    const subTotal = roundTo2(
      safeNumber(line.subTotal) ||
        (line.pasajeros ?? []).reduce((sum, pax) => sum + safeNumber(pax.subtotalNeto), 0)
    );
    const descuento = roundTo2(Math.min(Math.max(0, descuentoBase), subTotal));
    const neto = roundTo2(Math.max(0, subTotal - descuento));
    const totals = calculateTaxFromNetAmount(neto, this.form.directo || '0', settings);

    return {
      ...line,
      subTotal,
      porDescuento: descuento > 0 ? roundTo2(porDescuento) : 0,
      descuento,
      neto: totals.neto,
      impuesto: totals.iva,
      montoServicio: totals.total
    };
  }

  private getLineTotalSinDescuento(line: ReservaDraftServiceLine): number {
    const settings = {
      pricesIncludeTax: FISCAL_CONFIG.pricesIncludeTax,
      taxRate: FISCAL_CONFIG.taxRate,
      redondeoDecimales: 2
    };
    const subTotal = roundTo2(safeNumber(line.subTotal));
    if (subTotal <= 0) return 0;
    return calculateTaxFromNetAmount(subTotal, this.form.directo || '0', settings).total;
  }

  private getTotalDocumentoSinDescuento(): number {
    return roundTo2(this.detalles.reduce((sum, line) => sum + this.getLineTotalSinDescuento(line), 0));
  }

  private convertFinalDiscountToBaseDiscount(line: ReservaDraftServiceLine, finalDiscount: number): number {
    const subTotal = roundTo2(safeNumber(line.subTotal));
    const totalSinDescuento = this.getLineTotalSinDescuento(line);
    if (subTotal <= 0 || totalSinDescuento <= 0) return 0;
    return roundTo2(Math.min(subTotal, Math.max(0, finalDiscount) * (subTotal / totalSinDescuento)));
  }

  private mapDraftServiceLineToDetalleForm(line: ReservaDraftServiceLine): DetalleForm {
    const selectedPlan = line.planTarifa || line.codPlan;
    return {
      codPlan                   : selectedPlan,
      planTarifa                : selectedPlan || this.resolvePlanTarifarioNombre(selectedPlan),
      codLstPrecio              : line.codLstPrecio,
      codServicio               : line.codServicio,
      nomServicio               : line.nomServicio,
      tipoServicio              : line.tipoServicio,
      fechaServicio             : line.fecServicio,
      horaPickup                : normalizeTimeInputValue(line.horaPickup, { zeroAsEmpty: true }),
      horaInicio                : normalizeTimeInputValue(line.horaServicio, { zeroAsEmpty: true }) || normalizeTimeInputValue(line.horaPickup, { zeroAsEmpty: true }),
      origenLugar               : line.origenTexto,
      origenZona                : line.zonaOrigen,
      origenDireccionGoogle     : line.origenTexto,
      origenGoogle              : line.origenGoogle,
      origenLat                 : line.origenLat,
      origenLng                 : line.origenLng,
      origenPlaceId             : line.origenPlaceId,
      destinoLugar              : line.destinoTexto,
      destinoZona               : line.zonaDestino,
      destinoDireccionGoogle    : line.destinoTexto,
      destinoGoogle             : line.destinoGoogle,
      destinoLat                : line.destinoLat,
      destinoLng                : line.destinoLng,
      destinoPlaceId            : line.destinoPlaceId,
      montoServicio             : line.neto,
      detallesPax               : (line.pasajeros ?? []).map((pax) => ({
        tipoPax           : pax.tipoPax,
        cantidad          : pax.cantidad,
        precioTotal       : pax.subtotalNeto,
        precioUnitario    : pax.precioUnitarioNeto,
        reglaPrecioId     : pax.reglaPrecioId,
        precioPaxExtra    : pax.precioPaxExtra,
        manual            : pax.manual,
        error             : pax.error
      })),
      estado: line.estado || 'PEN',
      observaciones: line.observacion || ''
    };
  }

  private mapDraftServiceLineToActividadForm(line: ReservaDraftServiceLine): ActividadDetalleForm {
    const pickup = this.mapDraftServiceLineToActividadPickup(line);

    const selectedPlan = line.planTarifa || line.codPlan;
    return {
      codPlan           : selectedPlan,
      planTarifa        : selectedPlan || this.resolvePlanTarifarioNombre(selectedPlan),
      codLstPrecio      : line.codLstPrecio,
      codServicio       : line.codServicio,
      nomServicio       : line.nomServicio,
      tipoServicio      : line.tipoServicio,
      fechaServicio     : line.fecServicio,
      horaPickup        : line.horaPickup || line.horaServicio,
      horaInicio        : line.horaServicio || line.horaPickup || '',
      observaciones     : line.observacion,
      pickups           : [pickup],
      detallesPax       : (line.pasajeros ?? []).map((pax) => ({
        tipoPax         : pax.tipoPax,
        cantidad        : pax.cantidad,
        precioUnitario  : pax.precioUnitarioNeto
      })),
      actividades: [
        {
          codServicio     : line.codServicio,
          nomServicio     : line.nomServicio,
          reglaPrecioID   : line.idReglaPrecio,
          tarifas         : (line.pasajeros ?? []).map((pax) => ({
            tipoPax   : pax.tipoPax,
            tipo      : pax.tipoPax,
            precio    : pax.precioUnitarioNeto,
            cantidad  : pax.cantidad,
            total     : pax.subtotalNeto
          })),
          totalLinea: line.neto
        }
      ],
      totalGeneral: line.neto,
      montoServicio: line.neto
    };
  }

  private applyActividadDefaultsFromLastDetalle(): void {
    const baseDetalle = this.resolveLastDetalleForActividadDefaults();
    if (!baseDetalle) {
      return;
    }

    const fechaServicio = safeString(baseDetalle.fecServicio).trim();
    const horaInicio =
      normalizeTimeInputValue(baseDetalle.horaServicio, { zeroAsEmpty: true }) ||
      normalizeTimeInputValue(baseDetalle.horaPickup, { zeroAsEmpty: true });
    const horaPickup =
      normalizeTimeInputValue(baseDetalle.horaPickup, { zeroAsEmpty: true }) ||
      normalizeTimeInputValue(baseDetalle.horaServicio, { zeroAsEmpty: true });

    if (fechaServicio) {
      this.actividadForm.fechaServicio = fechaServicio;
    }
    if (horaInicio) {
      this.actividadForm.horaInicio = horaInicio;
    }
    if (horaPickup) {
      this.actividadForm.horaPickup = horaPickup;
    }

    this.actividadForm.pickups = [this.mapDraftServiceLineToActividadPickup(baseDetalle)];
  }

  private resolveLastDetalleForActividadDefaults(): ReservaDraftServiceLine | null {
    const ordered = [...(this.detalles ?? [])].sort((a, b) => a.linea - b.linea);
    if (!ordered.length) {
      return null;
    }

    const lastActividad = [...ordered].reverse().find((item) => item.source === 'actividad');
    if (lastActividad) {
      return lastActividad;
    }

    return ordered[ordered.length - 1] ?? null;
  }

  private mapDraftServiceLineToActividadPickup(line: ReservaDraftServiceLine): ActividadPickupForm {
    if (line.origenTexto || line.origenPlaceId || line.origenGoogle) {
      return {
        direccion : line.origenTexto,
        zona      : line.zonaOrigen,
        google    : line.origenGoogle,
        placeId   : line.origenPlaceId,
        lat       : line.origenLat,
        lng       : line.origenLng
      };
    }

    return {
      direccion : line.destinoTexto,
      zona      : line.zonaDestino,
      google    : line.destinoGoogle,
      placeId   : line.destinoPlaceId,
      lat       : line.destinoLat,
      lng       : line.destinoLng
    };
  }
  private async cargarListasPrecios(): Promise<void> {
    try {
      const pageSize = 200;
      let pageNumber = 1;
      let totalPages = 1;
      const all: ListaPrecioUI[] = [];
      do {
        const res = await firstValueFrom(this.listaPrecioService.getListas({ pageNumber, pageSize }));
        all.push(...(res?.data ?? []));
        totalPages = Number(res?.totalPages ?? 1) || 1;
        pageNumber += 1;
      } while (pageNumber <= totalPages);
      this.listaPrecios = all;
      this.listaPreciosVigentes = this.listaPrecios.filter((item) => safeString(item.vigente).toUpperCase() === 'S');
      if (!this.form.codLstPrecio) {
        const defaultLista = this.listaPreciosParaActividad[0];
        if (defaultLista) {
          this.form.codLstPrecio = String(defaultLista.codigo);
        }
      }
    } catch {
      this.listaPrecios = [];
      this.listaPreciosVigentes = [];
    } finally {
      this.actualizarListasPreciosAsignadasCache();
    }
  }

  private cargarFormasPago(): void {
    this.formasPagoApi = [
      { codigo: 'EFECT', descripcion: 'EFECTIVO' },
      { codigo: 'TARJE', descripcion: 'TARJETA' },
      { codigo: 'PREPA', descripcion: 'PREPAGO' },
      { codigo: 'CREDI', descripcion: 'CREDITO' }
    ];

    if (this.formasPagoApi.length > 0 && !safeString(this.form.formaPago).trim()) {
      this.form.formaPago = this.formasPagoApi[0].codigo;
    }
  }

  private cargarMonedas(): void {
    this.monedaService.getAll().subscribe({
      next: (res) => {
        this.monedas = res ?? [];
        const usdOption = (this.monedas ?? []).find((item) => safeString(item?.codMoneda).toUpperCase() === 'USD');
        if (!safeString(this.form.moneda).trim()) {
          this.form.moneda = usdOption?.codMoneda || this.monedas[0]?.codMoneda || 'USD';
        }
      },
      error: () => {
        this.monedas = [];
      }
    });
  }

  private cargarFormasReservacion(): void {
    this.formaReservasService.getAll().subscribe({
      next: (res) => {
        const list = (res ?? []).filter((item) => !!item);
        this.formasReservacion = this.mergeFormasReservacion(list);
        if (!this.form.formaReservacion) {
          const firstActive = this.formasReservacion.find((item) => !!item.CA54_Activo) ?? this.formasReservacion[0];
          this.form.formaReservacion = (firstActive?.CA54_Codigo ?? '').trim();
        }
      },
      error: () => {
        this.formasReservacion = [];
      }
    });
  }

  private cargarIdiomas(): void {
    this.idiomasService.getAll().subscribe({
      next: (res) => {
        const list = (res ?? []).filter((item) => !!item);
        this.idiomas = this.mergeIdiomas(list);
        if (!this.form.idioma) {
          const firstActive = this.idiomas.find((item) => !!item.CA53_Activo) ?? this.idiomas[0];
          this.form.idioma = (firstActive?.CA53_Codigo ?? '').trim();
        }
      },
      error: () => {
        this.idiomas = [];
      }
    });
  }

  private cargarPlanesTarifas(): void {
    this.planesTarifasService.getPlanesTarifas(1, 50).subscribe({
      next: (planes) => {
        this.planesTarifas = planes ?? [];
        if (!this.form.codPlan && this.planesTarifas.length > 0) {
          this.form.codPlan = String(this.planesTarifas[0].planId);
        }
      },
      error: () => {
        this.planesTarifas = [];
      }
    });
  }

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

  cargarServicios(centroCosto: string): void {
    this.serviciosLoading = true;
    this.serviciosService.getServicios(1, 1, 200, centroCosto).subscribe({
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

  private cargarServiciosPrecio(nombreServicio?: string, validateSelection: boolean = true): void {
    const codLstPrecio = safeString(this.detalleForm.codLstPrecio).trim();
    const search = safeString(nombreServicio ?? this.detalleServicioSearch).trim();
    if (nombreServicio !== undefined) {
      this.detalleServicioSearch = search;
    }
    if (!codLstPrecio) {
      this.serviciosPrecio = [];
      this.serviciosPrecioLoading = false;
      if (validateSelection) this.ensureDetalleServicioSeleccionado();
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
          if (validateSelection) this.ensureDetalleServicioSeleccionado();
        },
        error: () => {
          this.serviciosPrecio = [];
          this.serviciosPrecioLoading = false;
          if (validateSelection) this.ensureDetalleServicioSeleccionado();
        }
      });
  }

  private ensureDetalleServicioSeleccionado(): void {
    const selected = safeString(this.detalleForm.codServicio).trim();
    if (!selected) return;
    if (!this.serviciosPrecio.some((item) => item.CodServicio === selected)) {
      this.detalleForm.codServicio = '';
      this.onServicioChange('');
    }
  }

  private getDefaultTipoPaxCode(): string {
    const pax = (this.tiposPax ?? []).find((item) => item.code === 'PAX');
    return (pax?.code || this.tiposPax[0]?.code || 'PAX').toString().trim().toUpperCase();
  }

  private ensureDetallePaxDefaults(): void {
    const list = this.detalleForm.detallesPax ?? [];
    if (!list.length) {
      this.detalleForm.detallesPax = [{ tipoPax: this.getDefaultTipoPaxCode(), cantidad: 1, precioTotal: 0 }];
      return;
    }
    this.detalleForm.detallesPax = list.map((item) => ({
      ...item,
      tipoPax: item.tipoPax || this.getDefaultTipoPaxCode()
    }));
  }

  private getDetallePaxItemsForPayload(): DetallePaxForm[] {
    return (this.detalleForm.detallesPax ?? [])
      .map((item) => ({
        ...item,
        tipoPax: safeString(item.tipoPax).trim().toUpperCase(),
        cantidad: safeNumber(item.cantidad),
        precioTotal: safeNumber(item.precioTotal),
        precioUnitario: safeNumber(item.precioUnitario),
        precioPaxExtra: safeNumber(item.precioPaxExtra),
        reglaPrecioId: safeNumber(item.reglaPrecioId)
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
      const tipo = safeString(row.tipoPax).trim().toUpperCase();
      const result = map.get(tipo);
      if (!result) return row;
      if (result.error) return { ...row, manual: true, error: result.error };
      return {
        ...row,
        precioTotal: safeNumber(result.precioTotal),
        precioUnitario: safeNumber(result.precioUnitario),
        precioPaxExtra: safeNumber(result.precioPaxExtra),
        reglaPrecioId: safeNumber(result.reglaPrecioId),
        manual: false,
        error: ''
      };
    });
  }

  private getModoPrecioPorPlan(planId: number): ModoPrecio {
    const plan = (this.planesTarifas ?? []).find((item) => safeNumber(item?.planId) === safeNumber(planId));
    return safeString(plan?.tipoTarifa).trim().toUpperCase() === 'N' ? 'N' : 'R';
  }

  private sumPaxPrecioTotal(list: Array<{ precioTotal?: number }>): number {
    return roundTo2((list ?? []).reduce((sum, item) => sum + safeNumber(item?.precioTotal), 0));
  }

  private async applyReglaTarifaToDetalleForm(): Promise<boolean> {
    if (!this.showDetalleModal) return false;
    const planId = safeNumber(this.detalleForm.codPlan);
    const codLstPrecio = safeString(this.detalleForm.codLstPrecio).trim();
    const codServicio = safeString(this.detalleForm.codServicio).trim();
    const detallesPax = this.getDetallePaxItemsForTarifa();

    if (!planId || !codLstPrecio || !codServicio || !detallesPax.length) {
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
      if (result.detalles?.length) this.mergeTarifaResultados(result.detalles);
      this.allowManualPricing = !!result.error && result.error.includes('No hay una regla tarifaria');
      this.detalleForm.montoServicio = this.sumPaxPrecioTotal(this.detalleForm.detallesPax);
      return false;
    }

    this.reglaTarifaError = '';
    this.allowManualPricing = false;
    this.mergeTarifaResultados(result.detalles);
    this.detalleForm.montoServicio = safeNumber(result.montoServicio);
    return true;
  }

  private resolveDefaultPlanId(): string {
    return this.planesTarifas?.[0] ? String(this.planesTarifas[0].planId) : '';
  }

  private resolveDefaultListaPrecio(): string {
    const defaultLista = this.listaPreciosParaActividad[0];
    return defaultLista ? String(defaultLista.codigo) : '';
  }

  private mergeIdiomas(items: IdiomaDto[]): IdiomaDto[] {
    const mapById = new Map<number, IdiomaDto>();
    for (const item of items ?? []) {
      if (!item) continue;
      const id = Number(item.CA53_IdIdioma);
      if (!Number.isFinite(id) || id <= 0) continue;
      mapById.set(id, item);
    }
    return Array.from(mapById.values()).sort((a, b) => {
      const aKey = `${safeString(a.CA53_Codigo)} ${safeString(a.CA53_Nombre)}`.trim().toUpperCase();
      const bKey = `${safeString(b.CA53_Codigo)} ${safeString(b.CA53_Nombre)}`.trim().toUpperCase();
      return aKey.localeCompare(bKey);
    });
  }

  private mergeFormasReservacion(items: FormaReservaDto[]): FormaReservaDto[] {
    const mapById = new Map<number, FormaReservaDto>();
    for (const item of items ?? []) {
      if (!item) continue;
      const id = Number(item.CA54_IdFormaReservacion);
      if (!Number.isFinite(id) || id <= 0) continue;
      mapById.set(id, item);
    }
    return Array.from(mapById.values()).sort((a, b) => {
      const aKey = `${safeString(a.CA54_Codigo)} ${safeString(a.CA54_Descripcion)}`.trim().toUpperCase();
      const bKey = `${safeString(b.CA54_Codigo)} ${safeString(b.CA54_Descripcion)}`.trim().toUpperCase();
      return aKey.localeCompare(bKey);
    });
  }

  private showValidationErrors(formRef: any): void {
    try {
      formRef?.control?.markAllAsTouched?.();
    } catch {
      return;
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
    if (unique.length) {
      this.showAlert('Validación', `Revise los campos requeridos: ${unique.join(', ')}.`, 'warning');
    }
  }

  private showAlert(title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info'): void {
    showAlertWithFocusRestore({
      title,
      text,
      icon,
      shouldRestoreFocus: () => this.showDetalleModal || this.showActividadModal || this.showClienteModal || this.showContactoRapidoModal
    });
  }
}

function roundTo2(value: number): number {
  return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
}
