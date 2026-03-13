import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import { FormaPagoService } from '../../../administracion/forma-pago/forma-pago.service';
import { FormaPago } from '../../../administracion/forma-pago/forma-pago.models';
import { MonedaService, MonedaUI } from '../../../administracion/monedas/moneda.service';
import { ListaPrecioService } from '../../../catalogos/listas-precios/lista-precio.service';
import { ListaPrecioUI } from '../../../catalogos/listas-precios/lista-precio.models';
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
import { ReservaCreateActividadModalComponent, ActividadModalSavePayload } from '../reserva-create-actividad-modal.component';
import { ReservaCreateClienteModalComponent } from '../reserva-create-cliente-modal.component';
import { ContactoRapidoModalSavePayload, ReservaCreateContactoRapidoModalComponent } from '../reserva-create-contacto-rapido-modal.component';
import { ReservaCreateDetalleModalComponent } from '../reserva-create-detalle-modal.component';
import { ActividadDetalleForm, DetalleForm, DetallePaxForm, ReservaCreateForm } from '../reserva-create.models';
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

  idiomas: IdiomaDto[] = [];
  formasReservacion: FormaReservaDto[] = [];
  formasPagoApi: FormaPago[] = [];
  listaPrecios: ListaPrecioUI[] = [];
  planesTarifas: PlanTarifaUI[] = [];
  monedas: MonedaUI[] = [];
  servicios: ServicioUI[] = [];
  serviciosPrecio: ServicioPrecioApiItem[] = [];
  tiposPax: TipoPaxUI[] = [];

  showClienteModal = false;
  showContactoRapidoModal = false;
  showDetalleModal = false;
  showActividadModal = false;
  selectedCliente: ClienteUI | null = null;
  contactosCliente: ClienteContactoUI[] = [];

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

  editingDetalleLinea: number | null = null;
  editingActividadLinea: number | null = null;
  codReservaActual: string | null = null;
  loadingReserva = false;
  private allowNavigation = false;

  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private formaPagoService = inject(FormaPagoService);
  private monedaService = inject(MonedaService);
  private listaPrecioService = inject(ListaPrecioService);
  private planesTarifasService = inject(PlanesTarifasService);
  private clienteService = inject(ClienteService);
  private tipoPaxService = inject(TipoPaxService);
  private serviciosService = inject(ServiciosService);
  private idiomasService = inject(IdiomasService);
  private formaReservasService = inject(FormaReservasService);
  private tarifaService = inject(ReservaCreateTarifaService);
  private contactoRapidoService = inject(ReservaContactoRapidoService);
  private reservaToursService = inject(ReservaToursV2Service);
  private clienteDetailRequestId = 0;

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
    this.cargarIdiomas();
    this.cargarFormasReservacion();
    this.cargarPlanesTarifas();
    void this.cargarListasPrecios();
    this.cargarTiposPax();
    this.cargarMonedas();
    this.cargarFormasPago();

    const restoredDraft = this.restoreStoredDraft(this.codReservaActual);
    if (restoredDraft) {
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

  get totalRack(): number {
    return calculateDraftTotals(this.detalles).totalServicios;
  }

  get cantidadServicios(): number {
    return this.detalles.length;
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
        linea: item.linea,
        codServicio: item.codServicio,
        nomServicio: item.nomServicio,
        planTarifa: item.planTarifa,
        codPlan: payload.codPlan,
        codLstPrecio: item.codLstPrecio
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

  async onClienteSelected(cliente: ClienteUI): Promise<void> {
    this.selectedCliente = cliente;
    this.form.codAgencia = cliente.codigo;
    this.showClienteModal = false;
    this.contactosCliente = [];
    this.applyContactoSeleccionado(null, false);
    this.syncDraftHeader();
    await this.cargarClienteDetalle(cliente.codigo);
  }

  limpiarSeleccionCliente(): void {
    this.selectedCliente = null;
    this.form.codAgencia = '';
    this.contactosCliente = [];
    this.applyContactoSeleccionado(null, false);
    this.syncDraftHeader();
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
    }

    this.showActividadModal = true;
    this.cargarServicios('TOURS');
  }

  cerrarModalActividad(): void {
    this.showActividadModal = false;
    this.editingActividadLinea = null;
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

  private syncDraftHeader(): void {
    this.draft = {
      ...this.draft,
      header: {
        ...this.draft.header,
        ...this.form,
        codReserva: this.codReservaActual || this.draft.header?.codReserva || '',
        totalRsv: this.totalRack,
        folio: this.draft.header?.folio || '',
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
        this.contactosCliente = [];
        this.applyContactoSeleccionado(null, false);
        if (!options?.silent) {
          this.showAlert('Atención', 'No se pudo cargar el detalle del cliente seleccionado.', 'warning');
        }
        this.syncDraftHeader();
        return;
      }

      this.selectedCliente = cliente;
      this.contactosCliente = this.sortContactosCliente(cliente.contactos ?? []);
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
    this.draft = {
      ...this.draft,
      servicios: (this.draft.servicios ?? []).map((line) => {
        const detalleForm = this.mapDraftServiceLineToDetalleForm(line);
        const recalculated = mapDetalleFormToDraftServiceLine(detalleForm, line.linea, directo);
        return {
          ...recalculated,
          source: line.source,
          tipoServicio: line.tipoServicio || recalculated.tipoServicio
        };
      })
    };
  }

  private mapDraftServiceLineToDetalleForm(line: ReservaDraftServiceLine): DetalleForm {
    const selectedPlan = line.planTarifa || line.codPlan;
    return {
      codPlan: selectedPlan,
      planTarifa: selectedPlan || this.resolvePlanTarifarioNombre(selectedPlan),
      codLstPrecio: line.codLstPrecio,
      codServicio: line.codServicio,
      nomServicio: line.nomServicio,
      tipoServicio: line.tipoServicio,
      fechaServicio: line.fecServicio,
      horaPickup: normalizeTimeInputValue(line.horaPickup, { zeroAsEmpty: true }),
      horaInicio: normalizeTimeInputValue(line.horaServicio, { zeroAsEmpty: true }) || normalizeTimeInputValue(line.horaPickup, { zeroAsEmpty: true }),
      origenLugar: line.origenTexto,
      origenZona: line.zonaOrigen,
      origenDireccionGoogle: line.origenTexto,
      origenGoogle: line.origenGoogle,
      origenLat: line.origenLat,
      origenLng: line.origenLng,
      origenPlaceId: line.origenPlaceId,
      destinoLugar: line.destinoTexto,
      destinoZona: line.zonaDestino,
      destinoDireccionGoogle: line.destinoTexto,
      destinoGoogle: line.destinoGoogle,
      destinoLat: line.destinoLat,
      destinoLng: line.destinoLng,
      destinoPlaceId: line.destinoPlaceId,
      montoServicio: line.neto,
      detallesPax: (line.pasajeros ?? []).map((pax) => ({
        tipoPax: pax.tipoPax,
        cantidad: pax.cantidad,
        precioTotal: pax.subtotalNeto,
        precioUnitario: pax.precioUnitarioNeto,
        reglaPrecioId: pax.reglaPrecioId,
        precioPaxExtra: pax.precioPaxExtra,
        manual: pax.manual,
        error: pax.error
      })),
      estado: line.estado || 'PEN',
      observaciones: line.observacion || ''
    };
  }

  private mapDraftServiceLineToActividadForm(line: ReservaDraftServiceLine): ActividadDetalleForm {
    const pickup = line.origenTexto || line.origenPlaceId || line.origenGoogle
      ? {
          direccion: line.origenTexto,
          zona: line.zonaOrigen,
          google: line.origenGoogle,
          placeId: line.origenPlaceId,
          lat: line.origenLat,
          lng: line.origenLng
        }
      : {
          direccion: line.destinoTexto,
          zona: line.zonaDestino,
          google: line.destinoGoogle,
          placeId: line.destinoPlaceId,
          lat: line.destinoLat,
          lng: line.destinoLng
        };

    const selectedPlan = line.planTarifa || line.codPlan;
    return {
      codPlan: selectedPlan,
      planTarifa: selectedPlan || this.resolvePlanTarifarioNombre(selectedPlan),
      codLstPrecio: line.codLstPrecio,
      codServicio: line.codServicio,
      nomServicio: line.nomServicio,
      tipoServicio: line.tipoServicio,
      fechaServicio: line.fecServicio,
      horaPickup: line.horaPickup || line.horaServicio,
      horaInicio: line.horaServicio || line.horaPickup || '',
      observaciones: line.observacion,
      pickups: [pickup],
      detallesPax: (line.pasajeros ?? []).map((pax) => ({
        tipoPax: pax.tipoPax,
        cantidad: pax.cantidad,
        precioUnitario: pax.precioUnitarioNeto
      })),
      actividades: [
        {
          codServicio: line.codServicio,
          nomServicio: line.nomServicio,
          reglaPrecioID: line.idReglaPrecio,
          tarifas: (line.pasajeros ?? []).map((pax) => ({
            tipoPax: pax.tipoPax,
            tipo: pax.tipoPax,
            precio: pax.precioUnitarioNeto,
            cantidad: pax.cantidad,
            total: pax.subtotalNeto
          })),
          totalLinea: line.neto
        }
      ],
      totalGeneral: line.neto,
      montoServicio: line.neto
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
      if (!this.form.codLstPrecio && this.listaPrecios.length > 0) {
        this.form.codLstPrecio = String(this.listaPrecios[0].codigo);
      }
    } catch {
      this.listaPrecios = [];
    }
  }

  private cargarFormasPago(): void {
    this.formaPagoService.getAll().subscribe({
      next: (res) => {
        this.formasPagoApi = res ?? [];
        if (this.formasPagoApi.length > 0 && !this.form.formaPago) {
          this.form.formaPago = this.formasPagoApi[0].codigo;
        }
      },
      error: () => {
        this.formasPagoApi = [];
      }
    });
  }

  private cargarMonedas(): void {
    this.monedaService.getAll().subscribe({
      next: (res) => {
        this.monedas = res ?? [];
        if (this.monedas.length > 0 && !this.form.moneda) {
          this.form.moneda = this.monedas[0].codMoneda;
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
    return this.listaPrecios?.[0] ? String(this.listaPrecios[0].codigo) : '';
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















