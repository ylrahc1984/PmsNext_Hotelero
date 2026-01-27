import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { GooglePlaceSelection, GooglePlacesAutocompleteDirective } from './google-places-autocomplete.directive';
import { Reserva, ReservasService } from './reservas.service';
import { ReservaDetalleService, ReservaDetalle } from './reserva-detalle.service';
import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import { FormaPagoService } from '../administracion/forma-pago/forma-pago.service';
import { FormaPago } from '../administracion/forma-pago/forma-pago.models';
import { MonedaService, MonedaUI } from '../administracion/monedas/moneda.service';
import { ListaPrecioService } from '../catalogos/listas-precios/lista-precio.service';
import { ListaPrecioUI } from '../catalogos/listas-precios/lista-precio.models';
import { ReglaTarifa, ReglasTarifariasService } from '../catalogos/listas-precios/listas-precios.service';
import { ClienteService } from '../catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from '../catalogos/agencias-comisionistas/cliente.models';
import { ServiciosService, ServicioUI } from '../catalogos/servicios/servicios.service';

type ReservaEstado = 'PEN' | 'CON' | 'CAN';

interface ReservaCreateForm {
  fecha: string;
  codAgencia: string;
  nomCliente: string;
  telCliente: string;
  emailCliente: string;
  idioma: string;
  formaReservacion: string;
  formaPago: string;
  codLstPrecio: string;
  moneda: string;
  estado: ReservaEstado;
  totalRsv: number;
  comentarios: string;
}

// No se usa DetalleForm para la API, pero se mantiene para el modal local
interface DetalleForm {
  codServicio: string;
  nomServicio: string;
  tipoServicio: string;
  fechaServicio: string;
  horaPickup: string;
  horaInicio: string;
  adultos: number;
  ninos: number;
  totalPax: number;
  origenLugar: string;
  origenZona: string;
  origenDireccionGoogle: string;
  origenLat: number;
  origenLng: number;
  origenPlaceId: string;
  destinoLugar: string;
  destinoZona: string;
  destinoDireccionGoogle: string;
  destinoLat: number;
  destinoLng: number;
  destinoPlaceId: string;
  tarifa: string;
  costoNeto: number;
  costoRack: number;
  montoServicio: number;
  estado: string;
  observaciones?: string;
}

@Component({
  selector: 'app-reserva-create',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, GooglePlacesAutocompleteDirective],
  templateUrl: './reserva-create.component.html',
  styleUrls: ['./reserva-create.component.scss']
})
export class ReservaCreateComponent implements OnInit, CanDeactivateReservaCreate {
  private static readonly DRAFT_STORAGE_KEY = 'reserva_create_draft_cod';

  form: ReservaCreateForm = this.buildInitialForm();
  detalles: ReservaDetalle[] = [];
  detalleForm: DetalleForm = this.buildDetalleForm();
  showDetalleModal = false;
  editingDetalleId: number | null = null;
  guardado = false;

  idiomas = ['Español', 'Inglés', 'Francés'];
  formasReservacion = ['Correo Electrónico', 'Teléfono', 'WhatsApp', 'Web'];
  formasPago = ['Prepago', 'Crédito', 'Efectivo', 'Transferencia'];
  formasPagoApi: FormaPago[] = [];
  listaPrecios: ListaPrecioUI[] = [];
  monedas: MonedaUI[] = [];
  clientes: ClienteUI[] = [];
  servicios: ServicioUI[] = [];
  tarifas = ['A', 'B', 'C', 'D'];
  zonas = ['San Jose', 'Alajuela', 'Monteverde', 'Liberia', 'La Fortuna', 'Tamarindo', 'Sarapiqui'];

  reglaTarifaAplicada: ReglaTarifa | null = null;
  reglaTarifaError = '';
  private reglasTarifaCache = new Map<string, ReglaTarifa[]>();

  origenAutocompleteMessage = '';
  destinoAutocompleteMessage = '';
  copiedLink: 'origen' | 'destino' | null = null;
  copyError = '';
  copyErrorTarget: 'origen' | 'destino' | null = null;
  showClienteModal = false;
  clienteSearchTerm = '';
  clientesLoading = false;
  clientePage = 1;
  clientePageSize = 10;
  clienteTotalPages = 1;
  clienteTotalRegistros = 0;
  selectedCliente: ClienteUI | null = null;
  serviciosLoading = false;

  private reservasService = inject(ReservasService);
  private detalleService = inject(ReservaDetalleService);
  private router = inject(Router);
  private formaPagoService = inject(FormaPagoService);
  private monedaService = inject(MonedaService);
  private listaPrecioService = inject(ListaPrecioService);
  private reglasTarifariasService = inject(ReglasTarifariasService);
  private clienteService = inject(ClienteService);
  private serviciosService = inject(ServiciosService);
  private authService = inject(AuthService);

  
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

  ngOnInit(): void {
    this.initReserva();

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

    this.listaPrecioService.getListas({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: (res) => {
        this.listaPrecios = res.data ?? [];
        if (this.listaPrecios.length > 0 && !this.form.codLstPrecio) {
          this.form.codLstPrecio = this.listaPrecios[0].codigo;
        }
      },
      error: () => {
        this.listaPrecios = [];
      }
    });
  }

  private initReserva(): void {
    // Si viene codReserva por ruta, cargar para edición
    const url = window.location.pathname;
    const match = url.match(/reservas\/(.+?)\/(editar|detalle)/);
    if (match) {
      this.codReservaActual = match[1];
      this.setDraftCod(this.codReservaActual);
      this.cargarEncabezado(this.codReservaActual);
      this.cargarDetalle(this.codReservaActual);
      return;
    }

    // Caso crítico: refresh / reopen. Si hay un borrador en storage, lo retomamos para NO crear otro código.
    const storedDraft = this.getDraftCod();
    if (storedDraft) {
      this.resumeDraft(storedDraft);
      return;
    }

    // Nuevo flujo: crear automáticamente un borrador (PEN) al iniciar.
    // Esperamos al usuario autenticado si aún no está en memoria (evita operador vacío).
    const operador = this.getOperador();
    if (operador && operador !== 'Sistema') {
      this.crearBorrador();
      return;
    }

    this.authService.currentUser$.pipe(filter((u) => !!u), take(1)).subscribe(() => this.crearBorrador());

    // Fallback: no bloqueamos la operación si por alguna razón el user no llega (e.g. user_data no persistido).
    setTimeout(() => this.crearBorrador(), 1200);
  }

  private resumeDraft(codReserva: string): void {
    this.codReservaActual = codReserva;
    this.loading = true;

    this.reservasService.getReservaByCod(codReserva).subscribe({
      next: (res) => {
        const estado = this.normalizeEstado((res.PRV01_Estado as any) ?? 'PEN');
        if (estado !== 'PEN') {
          // Ya no es borrador: no lo reutilizamos.
          this.clearDraftCod();
          this.codReservaActual = null;
          this.loading = false;
          this.crearBorrador();
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
        // Borrador inválido/ya no existe: limpiamos y creamos uno nuevo.
        this.clearDraftCod();
        this.codReservaActual = null;
        this.loading = false;
        this.crearBorrador();
      }
    });
  }

  private crearBorrador(): void {
    if (this.creandoBorrador || this.codReservaActual) {
      return;
    }
    this.creandoBorrador = true;

    // En el borrador, el backend debe generar el CodReserva. Enviamos un payload mínimo.
    const payload = {
      estado: 'PEN',
      fecCreacion: this.form.fecha,
      operador: this.getOperador()
    };

    this.reservasService.crearReserva(payload).subscribe({
      next: (res) => {
        const cod = this.extractCodReserva(res);
        if (!cod) {
          this.creandoBorrador = false;
          this.showAlert('Error', 'No se recibió el código de reserva al crear el borrador.', 'error');
          return;
        }
        this.codReservaActual = cod;
        this.setDraftCod(cod);
        // URL estable para sobrevivir refresh (evita crear otro borrador).
        this.navigateInternal(['/operaciones/reservas', cod, 'editar'], { replaceUrl: true });
        this.form.estado = 'PEN';
        this.guardado = true;
        this.creandoBorrador = false;
      },
      error: () => {
        this.creandoBorrador = false;
        this.showAlert('Error', 'No se pudo crear el borrador de la reserva.', 'error');
      }
    });
  }

  cargarEncabezado(codReserva: string): void {
    this.loading = true;
    this.reservasService.getReservaByCod(codReserva).subscribe({
      next: (res) => {
        const estadoNormalizado = this.normalizeEstado((res.PRV01_Estado as any) ?? 'PEN');
        this.form = {
          fecha: this.toDateInputValue(res.PRV01_FecCreacion) || this.form.fecha || '',
          codAgencia: res.PRV01_CodAgencia,
          nomCliente: res.PRV01_NomCliente,
          telCliente: res.PRV01_TelCliente,
          emailCliente: res.PRV01_EmailCliente,
          idioma: res.PRV01_Idioma,
          formaReservacion: res.PRV01_FormaReserva,
          formaPago: res.PRV01_FormaPago,
          codLstPrecio: res.PRV01_CodLstPrecio,
          moneda: res.PRV01_Moneda,
          estado: estadoNormalizado,
          totalRsv: res.PRV01_TotalRsv || 0,
          comentarios: res.PRV01_Observacion
        };
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
      error: () => {
        this.showAlert('Error', 'No se pudo cargar el encabezado.', 'error');
        this.loading = false;
      }
    });
  }

  cargarDetalle(codReserva: string): void {
    this.loading = true;
    this.detalleService.getDetalle(codReserva).subscribe({
      next: (res) => {
        this.detalles = res;
        this.loading = false;
      },
      error: () => {
        this.showAlert('Error', 'No se pudo cargar el detalle.', 'error');
        this.loading = false;
      }
    });
  }

  abrirModalDetalle(detalle?: ReservaDetalle): void {
    if (!this.codReservaActual) {
      this.showAlert('Atención', 'Espere la creación del borrador para agregar servicios.', 'warning');
      return;
    }
    if (this.form.estado === 'CON' || this.form.estado === 'CAN') {
      this.showAlert('Atención', 'No se pueden modificar servicios en una reserva confirmada o anulada.', 'warning');
      return;
    }
    if (detalle) {
      // Mapear campos de ReservaDetalle (API) a DetalleForm (modal)
      this.detalleForm = {
        codServicio: detalle.PRV02_CodServicio || '',
        nomServicio: detalle.PRV02_NomServicio || '',
        tipoServicio: detalle.PRV02_TipoServicio || '',
        fechaServicio: this.toDateInputValue(detalle.PRV02_FecServicio) || this.detalleForm.fechaServicio || '',
        horaPickup: '', // No hay campo directo en API, dejar vacío o mapear si existe
        horaInicio: detalle.PRV02_HoraServicio || '',
        adultos: detalle.PRV02_Adultos || 1,
        ninos: detalle.PRV02_Ninos || 0,
        totalPax: detalle.PRV02_TotalPax || 0,
        origenLugar: detalle.PRV02_OrigenTexto || '',
        origenZona: '', // No hay campo directo en API
        origenDireccionGoogle: '', // No hay campo directo en API
        origenLat: detalle.PRV02_OrigenLat || 0,
        origenLng: detalle.PRV02_OrigenLng || 0,
        origenPlaceId: detalle.PRV02_OrigenPlaceId || '',
        destinoLugar: detalle.PRV02_DestinoTexto || '',
        destinoZona: '', // No hay campo directo en API
        destinoDireccionGoogle: '', // No hay campo directo en API
        destinoLat: detalle.PRV02_DestinoLat || 0,
        destinoLng: detalle.PRV02_DestinoLng || 0,
        destinoPlaceId: detalle.PRV02_DestinoPlaceId || '',
        tarifa: '', // No hay campo directo en API
        costoNeto: detalle.PRV02_MontoServicio || 0,
        costoRack: (detalle.PRV02_PrecioAdulto || 0) + (detalle.PRV02_PrecioNino || 0) + (detalle.PRV02_PrecioPaxExtra || 0),
        montoServicio: detalle.PRV02_MontoServicio || 0,
        estado: detalle.PRV02_Estado || 'Pendiente',
        observaciones: detalle.PRV02_Observacion || ''
      };
      this.editingDetalleId = detalle.PRV02_ID;
    } else {
      this.detalleForm = this.buildDetalleForm();
      this.editingDetalleId = null;
      // this.recalcularCosto(); // El cálculo se puede hacer al guardar
    }
    this.resetAutocompleteState();
    this.showDetalleModal = true;
    if (!this.servicios.length) {
      this.cargarServicios();
    }
  }

  cerrarModalDetalle(): void {
    this.resetAutocompleteState();
    this.showDetalleModal = false;
  }

  recalcularCosto(): void {
    void this.applyReglaTarifaToDetalleForm({ silent: true });
  }

  onPlaceSelected(tipo: 'origen' | 'destino', selection: GooglePlaceSelection): void {
    if (tipo === 'origen') {
      this.detalleForm.origenDireccionGoogle = selection.formattedAddress;
      this.detalleForm.origenLat = selection.lat;
      this.detalleForm.origenLng = selection.lng;
      this.detalleForm.origenPlaceId = selection.placeId;
      this.origenAutocompleteMessage = '';
    } else {
      this.detalleForm.destinoDireccionGoogle = selection.formattedAddress;
      this.detalleForm.destinoLat = selection.lat;
      this.detalleForm.destinoLng = selection.lng;
      this.detalleForm.destinoPlaceId = selection.placeId;
      this.destinoAutocompleteMessage = '';
    }
    this.copyError = '';
    this.copiedLink = null;
    this.copyErrorTarget = null;
  }

  onPlaceSelectionError(tipo: 'origen' | 'destino', message: string): void {
    const normalizedMessage =
      message || 'Seleccione una opción del listado de Google para obtener coordenadas.';
    if (tipo === 'origen') {
      this.origenAutocompleteMessage = normalizedMessage;
      this.detalleForm.origenPlaceId = '';
      this.detalleForm.origenLat = 0;
      this.detalleForm.origenLng = 0;
    } else {
      this.destinoAutocompleteMessage = normalizedMessage;
      this.detalleForm.destinoPlaceId = '';
      this.detalleForm.destinoLat = 0;
      this.detalleForm.destinoLng = 0;
    }
    this.copyError = '';
    this.copyErrorTarget = null;
    this.copiedLink = null;
  }

  getMapsLink(tipo: 'origen' | 'destino'): string {
    const lat = tipo === 'origen' ? this.detalleForm.origenLat : this.detalleForm.destinoLat;
    const lng = tipo === 'origen' ? this.detalleForm.origenLng : this.detalleForm.destinoLng;
    if (!this.hasCoordinates(lat, lng)) {
      return '';
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  getDetalleMapsLink(detalle: ReservaDetalle, tipo: 'origen' | 'destino'): string {
    const lat = tipo === 'origen' ? detalle.PRV02_OrigenLat : detalle.PRV02_DestinoLat;
    const lng = tipo === 'origen' ? detalle.PRV02_OrigenLng : detalle.PRV02_DestinoLng;
    if (!this.hasCoordinates(lat, lng)) {
      return '';
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  async copyMapsLink(tipo: 'origen' | 'destino'): Promise<void> {
    const link = this.getMapsLink(tipo);
    const lat = tipo === 'origen' ? this.detalleForm.origenLat : this.detalleForm.destinoLat;
    const lng = tipo === 'origen' ? this.detalleForm.origenLng : this.detalleForm.destinoLng;
    if (!this.hasCoordinates(lat, lng) || !link) {
      this.copyError = 'Seleccione una opción del listado de Google para obtener coordenadas.';
      this.copyErrorTarget = tipo;
      this.copiedLink = null;
      return;
    }

    if (!navigator?.clipboard?.writeText) {
      this.copyError = 'Copiado no disponible en este navegador.';
      this.copyErrorTarget = tipo;
      this.copiedLink = null;
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      this.copyError = '';
      this.copyErrorTarget = null;
      this.copiedLink = tipo;
      setTimeout(() => (this.copiedLink = null), 2000);
    } catch {
      this.copyError = 'No se pudo copiar el enlace. Intente manualmente.';
      this.copyErrorTarget = tipo;
      this.copiedLink = null;
    }
  }

  async guardarDetalle(detalleFormRef: any): Promise<void> {
    if (detalleFormRef?.invalid) {
      detalleFormRef.control?.markAllAsTouched?.();
      return;
    }
    if (!this.codReservaActual) {
      this.showAlert('Atención', 'Espere la creación del borrador para agregar servicios.', 'warning');
      return;
    }

    try {
      const reglaAplicada = await this.applyReglaTarifaToDetalleForm();
      if (!reglaAplicada) {
        this.showAlert(
          'Atención',
          this.reglaTarifaError ||
            'No se encontró una regla tarifaria que aplique para la lista de precios, servicio, tarifa, cantidad de adultos y hora Pick-Up seleccionados.',
          'warning'
        );
        return;
      }

      const totalPax = (this.detalleForm.adultos || 0) + (this.detalleForm.ninos || 0);
      const existing = this.editingDetalleId ? this.detalles.find((d) => d.PRV02_ID === this.editingDetalleId) : null;
      const linea = existing?.PRV02_Linea ?? (this.detalles.length + 1);
      const montoServicio =
        (typeof this.detalleForm.montoServicio === 'number' && this.detalleForm.montoServicio > 0
          ? this.detalleForm.montoServicio
          : (typeof this.detalleForm.costoNeto === 'number' ? this.detalleForm.costoNeto : 0)) || 0;

      const payload = {
        id: this.editingDetalleId ?? 0,
        codReserva: this.codReservaActual,
        linea,
        tipoServicio: this.detalleForm.tipoServicio || '',
        codServicio: this.detalleForm.codServicio || '',
        nomServicio: this.detalleForm.nomServicio || '',
        fecServicio: this.detalleForm.fechaServicio,
        // Por negocio, la referencia principal es la hora Pick-Up.
        horaServicio: this.detalleForm.horaPickup || this.detalleForm.horaInicio || '',
        origenTexto: this.detalleForm.origenLugar || '',
        destinoTexto: this.detalleForm.destinoLugar || '',
        origenPlaceId: this.detalleForm.origenPlaceId || '',
        destinoPlaceId: this.detalleForm.destinoPlaceId || '',
        origenLat: this.detalleForm.origenLat || 0,
        origenLng: this.detalleForm.origenLng || 0,
        destinoLat: this.detalleForm.destinoLat || 0,
        destinoLng: this.detalleForm.destinoLng || 0,
        adultos: this.detalleForm.adultos || 0,
        ninos: this.detalleForm.ninos || 0,
        totalPax,
        codLstPrecio: this.form.codLstPrecio || '',
        idReglaPrecio: this.reglaTarifaAplicada?.id ?? 0,
        precioAdulto: this.reglaTarifaAplicada?.precioBase ?? 0,
        precioNino: this.reglaTarifaAplicada?.precioNino ?? 0,
        precioPaxExtra: this.reglaTarifaAplicada?.precioAdultoExtra ?? 0,
        montoServicio,
        codSuplidor: '',
        estado: (this.detalleForm.estado || 'PEN').toString(),
        observacion: this.detalleForm.observaciones || '',
        operador: this.getOperador(),
        respuesta: ''
      };

      const request$ = this.editingDetalleId ? this.detalleService.actualizarDetalle(payload) : this.detalleService.crearDetalle(payload);
      request$.subscribe({
        next: () => {
          this.cargarDetalle(this.codReservaActual!);
          this.cerrarModalDetalle();
        },
        error: () => {
          this.showAlert('Error', 'No se pudo guardar el detalle.', 'error');
        }
      });
    } catch {
      this.showAlert('Error', 'Ocurrió un error al aplicar la regla tarifaria antes de guardar el detalle.', 'error');
    }
  }

  eliminarDetalle(detalle: ReservaDetalle): void {
    if (this.codReservaActual && detalle.PRV02_ID) {
      this.detalleService.eliminarDetalle(detalle.PRV02_ID, this.codReservaActual).subscribe({
        next: () => this.cargarDetalle(this.codReservaActual!),
        error: () => {
          this.showAlert('Error', 'No se pudo eliminar el detalle.', 'error');
        }
      });
    }
  }

  guardarReserva(formRef?: any): void {
    // Nuevo UX: un solo botón ("Guardar cambios") que guarda y confirma (evita doble paso).
    if (this.form.estado === 'CON' || this.form.estado === 'CAN') {
      this.showAlert('Atención', 'No se puede confirmar una reserva confirmada o anulada.', 'warning');
      return;
    }
    if (formRef && formRef.invalid) {
      formRef.control.markAllAsTouched();
      return;
    }
    if (!this.codReservaActual) {
      this.showAlert('Atención', 'Espere la creación del borrador para guardar.', 'warning');
      this.crearBorrador();
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
      this.confirmarReserva(formRef);
    });
  }

  confirmarReserva(formRef?: any): void {
    if (this.form.estado === 'CON') {
      this.showAlert('Información', 'La reserva ya está confirmada.', 'info');
      return;
    }
    if (this.form.estado === 'CAN') {
      this.showAlert('Atención', 'La reserva está anulada y no puede confirmarse.', 'warning');
      return;
    }
    if (formRef && formRef.invalid) {
      formRef.control.markAllAsTouched();
      return;
    }
    if (!this.codReservaActual) {
      this.showAlert('Atención', 'No hay una reserva creada para confirmar.', 'warning');
      return;
    }

    this.confirmando = true;

    // Primero guardamos el encabezado para asegurar que el backend confirme con datos actuales.
    const payload = this.buildEncabezadoPayload('PEN');
    this.reservasService.actualizarReserva(this.codReservaActual, payload).subscribe({
      next: () => {
        this.reservasService.confirmarReserva(this.codReservaActual!).subscribe({
          next: () => {
            this.form.estado = 'CON';
            this.clearDraftCod();
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

  cancelar(): void {
    void this.requestExit('toListado');
  }

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

  private navigateInternal(commands: any[], extras?: any): void {
    this.internalNavigation = true;
    void this.router.navigate(commands, extras).finally(() => {
      this.internalNavigation = false;
    });
  }

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
      const detalles = await firstValueFrom(this.detalleService.getDetalle(codReserva).pipe(take(1)));
      detalleCount = Array.isArray(detalles) ? detalles.length : 0;
    } catch {
      verifyFailed = true;
    }

    // Borrador sin detalle: eliminar automáticamente.
    if (!verifyFailed && (detalleCount ?? 0) <= 0) {
      try {
        await firstValueFrom(this.reservasService.eliminarReservaBorrador(codReserva).pipe(take(1)));
        this.cancelDecisionBusy = false;
        this.clearDraftCod();
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
        const detalles = await firstValueFrom(this.detalleService.getDetalle(codReserva).pipe(take(1)));
        detalleCount = Array.isArray(detalles) ? detalles.length : 0;
      } catch {
        verifyFailed = true;
      }

      // Borrador sin detalle: eliminar automáticamente y continuar.
      if (!verifyFailed && (detalleCount ?? 0) <= 0) {
        try {
          await firstValueFrom(this.reservasService.eliminarReservaBorrador(codReserva).pipe(take(1)));
          this.cancelDecisionBusy = false;
          this.clearDraftCod();
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
          this.clearDraftCod();
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

  onCancelDecisionSeguirEditando(): void {
    if (this.cancelDecisionBusy) return;
    this.showCancelDecisionModal = false;
    this.pendingExitMode = null;
    this.pendingExitUrl = null;
    this.resolvePendingExit(false);
  }

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

        this.clearDraftCod();

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

  private navigateToListado(): void {
    this.allowNavigation = true;
    this.clearDraftCod();
    this.router.navigate(['/reservas']);
  }

  private resolvePendingExit(allow: boolean): void {
    const resolve = this.pendingExitResolver;
    this.pendingExitResolver = null;
    this.pendingExitPromise = null;
    this.pendingExitMode = null;
    this.pendingExitUrl = null;
    if (resolve) resolve(allow);
  }

  abrirModalClientes(): void {
    this.showClienteModal = true;
    this.clientePage = 1;
    this.buscarClientes();
  }

  cerrarModalClientes(): void {
    this.showClienteModal = false;
  }

  buscarClientes(): void {
    this.clientesLoading = true;
    this.clienteService.getClientes(this.clientePage, this.clientePageSize, this.clienteSearchTerm).subscribe({
      next: (res) => {
        this.clientes = res.data ?? [];
        this.clienteTotalRegistros = res.totalRegistros ?? 0;
        this.clienteTotalPages = res.totalPages ?? 1;
        this.clientesLoading = false;
      },
      error: () => {
        this.clientes = [];
        this.clienteTotalRegistros = 0;
        this.clienteTotalPages = 1;
        this.clientesLoading = false;
      }
    });
  }

  limpiarBusquedaClientes(): void {
    this.clienteSearchTerm = '';
    this.clientePage = 1;
    this.buscarClientes();
  }

  seleccionarCliente(cliente: ClienteUI): void {
    this.form.codAgencia = cliente.codigo;
    this.selectedCliente = cliente;
    this.showClienteModal = false;
  }

  cargarServicios(): void {
    this.serviciosLoading = true;
    this.serviciosService.getServicios(1, 1, 200).subscribe({
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

  seleccionarServicio(servicio: ServicioUI): void {
    this.detalleForm.codServicio = servicio.codReceta;
    this.detalleForm.nomServicio = servicio.nomReceta;
    this.detalleForm.tipoServicio = servicio.codGrupo || servicio.codCateg || '';
  }

  onServicioChange(codServicio: string): void {
    const servicio = this.servicios.find((item) => item.codReceta === codServicio);
    if (servicio) {
      this.seleccionarServicio(servicio);
      this.recalcularCosto();
      return;
    }
    this.detalleForm.nomServicio = '';
    this.detalleForm.tipoServicio = '';
    this.reglaTarifaAplicada = null;
    this.reglaTarifaError = '';
  }

  limpiarSeleccionCliente(): void {
    this.form.codAgencia = '';
    this.selectedCliente = null;
  }

  paginaAnteriorClientes(): void {
    if (this.clientePage > 1) {
      this.clientePage -= 1;
      this.buscarClientes();
    }
  }

  paginaSiguienteClientes(): void {
    if (this.clientePage < this.clienteTotalPages) {
      this.clientePage += 1;
      this.buscarClientes();
    }
  }

  get totalNeto(): number {
    // Sumar PRV02_MontoServicio de los detalles
    return this.detalles.reduce((sum, d) => sum + (d.PRV02_MontoServicio || 0), 0);
  }

  get totalRack(): number {
    // Sumar PRV02_PrecioAdulto + PRV02_PrecioNino + PRV02_PrecioPaxExtra de los detalles
    return this.detalles.reduce((sum, d) => sum + ((d.PRV02_PrecioAdulto || 0) + (d.PRV02_PrecioNino || 0) + (d.PRV02_PrecioPaxExtra || 0)), 0);
  }

  get cantidadServicios(): number {
    return this.detalles.length;
  }

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

  private resetAutocompleteState(): void {
    this.origenAutocompleteMessage = '';
    this.destinoAutocompleteMessage = '';
    this.copiedLink = null;
    this.copyError = '';
    this.copyErrorTarget = null;
  }

  private showAlert(title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info'): void {
    // SweetAlert2 aplica `aria-hidden="true"` sobre el app mientras el popup está abierto.
    // Si un modal interno (Bootstrap) mantiene el foco, el navegador reporta el warning de aria-hidden.
    // Mitigación: mover el foco fuera del modal antes de abrir SweetAlert2.
    const active = (document?.activeElement as HTMLElement | null) ?? null;
    const shouldRestoreFocus = !!active && typeof active.focus === 'function';
    try {
      active?.blur?.();
    } catch {
      // ignore
    }

    Swal.fire({ title, text, icon }).then(() => {
      // Restaurar foco solo si el elemento sigue en el DOM y algún modal sigue abierto.
      if (!shouldRestoreFocus) return;
      if (!active?.isConnected) return;
      if (!(this.showDetalleModal || this.showClienteModal || this.showCancelDecisionModal)) return;
      try {
        active.focus();
      } catch {
        // ignore
      }
    });
  }

  private hasCoordinates(lat?: number, lng?: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0)
    );
  }

  private normalizeEstado(estado: string): ReservaEstado {
    const v = (estado || '').toString().trim().toUpperCase();
    if (v === 'PEN' || v === 'PENDIENTE') return 'PEN';
    if (v === 'CON' || v === 'CONFIRMADA' || v === 'CONFIRMADO') return 'CON';
    if (v === 'CAN' || v === 'ANULADA' || v === 'ANULADO') return 'CAN';
    return 'PEN';
  }

  private extractCodReserva(res: any): string | null {
    // La API puede devolver PRV01_CodReserva o { datos: [{ CodReserva: '...' }] }
    return (
      res?.PRV01_CodReserva ||
      res?.CodReserva ||
      res?.datos?.[0]?.CodReserva ||
      res?.datos?.[0]?.PRV01_CodReserva ||
      null
    );
  }

  private buildEncabezadoPayload(estado: ReservaEstado): any {
    return {
      codAgencia: this.form.codAgencia,
      nomCliente: this.form.nomCliente,
      telCliente: this.form.telCliente,
      emailCliente: this.form.emailCliente,
      idioma: this.form.idioma,
      formaReserva: this.form.formaReservacion,
      formaPago: this.form.formaPago,
      estado,
      observacion: this.form.comentarios,
      codLstPrecio: this.form.codLstPrecio,
      moneda: this.form.moneda,
      fecCreacion: this.form.fecha,
      operador: this.getOperador(),
      totalRsv: this.totalRack
    };
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private getDraftCod(): string | null {
    try {
      const v = sessionStorage.getItem(ReservaCreateComponent.DRAFT_STORAGE_KEY);
      return v && v.trim() ? v.trim() : null;
    } catch {
      return null;
    }
  }

  private setDraftCod(codReserva: string): void {
    try {
      if (codReserva && codReserva.trim()) {
        sessionStorage.setItem(ReservaCreateComponent.DRAFT_STORAGE_KEY, codReserva.trim());
      }
    } catch {
      // ignore
    }
  }

  private clearDraftCod(): void {
    try {
      sessionStorage.removeItem(ReservaCreateComponent.DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private generateDetalleId(): number {
    // Usar el máximo PRV02_ID existente + 1
    const ids = this.detalles.map(d => d.PRV02_ID);
    const maxId = ids.length ? Math.max(...ids) : 0;
    return maxId + 1;
  }

  private buildInitialForm(): ReservaCreateForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      fecha: today,
      codAgencia: '',
      nomCliente: '',
      telCliente: '',
      emailCliente: '',
      idioma: 'Español',
      formaReservacion: 'Correo Electrónico',
      formaPago: '',
      codLstPrecio: '',
      moneda: '',
      estado: 'PEN',
      totalRsv: 0,
      comentarios: ''
    };
  }

  private buildDetalleForm(): DetalleForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      codServicio: '',
      nomServicio: '',
      tipoServicio: '',
      fechaServicio: today,
      horaPickup: '',
      horaInicio: '',
      adultos: 1,
      ninos: 0,
      totalPax: 0,
      origenLugar: '',
      origenZona: '',
      origenDireccionGoogle: '',
      origenLat: 0,
      origenLng: 0,
      origenPlaceId: '',
      destinoLugar: '',
      destinoZona: '',
      destinoDireccionGoogle: '',
      destinoLat: 0,
      destinoLng: 0,
      destinoPlaceId: '',
      tarifa: 'A',
      costoNeto: 0,
      costoRack: 0,
      montoServicio: 0,
      estado: 'Pendiente',
      observaciones: ''
    };
  }

  private toDateInputValue(value: unknown): string {
    if (!value) {
      return '';
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
    }

    const raw = String(value).trim();
    if (!raw) {
      return '';
    }

    const isoLike = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (isoLike) {
      return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
    }

    // Formato común en sistemas ES: dd/MM/yyyy
    const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }

  onListaPrecioChange(): void {
    this.reglasTarifaCache.clear();
    if (this.showDetalleModal) {
      this.recalcularCosto();
    }
  }

  private async applyReglaTarifaToDetalleForm(options?: { silent?: boolean }): Promise<boolean> {
    if (!this.showDetalleModal) return false;

    const codLstPrecio = (this.form.codLstPrecio || '').trim();
    const codServicio = (this.detalleForm.codServicio || '').trim();
    const tarifa = (this.detalleForm.tarifa || '').trim().toUpperCase();
    const moneda = this.getSelectedMonedaForReglas();

    if (!codLstPrecio || !codServicio || !tarifa) {
      this.reglaTarifaAplicada = null;
      this.reglaTarifaError = '';
      return false;
    }

    const adultos = Number(this.detalleForm.adultos ?? 0) || 0;
    const ninos = Number(this.detalleForm.ninos ?? 0) || 0;
    const totalPax = adultos + ninos;
    this.detalleForm.totalPax = totalPax;

    const horaReferencia = (this.detalleForm.horaPickup || this.detalleForm.horaInicio || '').trim();
    if (!horaReferencia) {
      this.reglaTarifaAplicada = null;
      this.reglaTarifaError = 'Debe indicar la hora Pick-Up para aplicar la tarifa.';
      return false;
    }

    const horaMin = this.timeToMinutes(horaReferencia);
    if (horaMin == null) {
      this.reglaTarifaAplicada = null;
      this.reglaTarifaError = 'Hora Pick-Up inválida.';
      return false;
    }

    const reglas = await this.getReglasTarifa(codLstPrecio, codServicio);
    const candidatas = (reglas ?? [])
      .filter((r) => !!r.activa)
      .filter((r) => !moneda || (r.moneda || '').trim().toUpperCase() === moneda)
      .filter((r) => (r.tarifa || '').toString().toUpperCase() === tarifa)
      .filter((r) => this.matchAdultosEnRango(adultos, r.cantMinPax, r.cantMaxPax))
      .filter((r) => this.matchHoraEnRango(horaMin, r.horaInicio, r.horaFin));

    if (!candidatas.length) {
      this.reglaTarifaAplicada = null;
      this.reglaTarifaError = 'No hay una regla tarifaria que coincida con adultos y hora Pick-Up.';
      return false;
    }

    const selected = this.pickMostSpecificRegla(candidatas);
    if (!selected) {
      this.reglaTarifaAplicada = null;
      this.reglaTarifaError = 'No se pudo seleccionar una regla tarifaria.';
      return false;
    }

    const incluidos = Number(selected.cantMinPax ?? 0) || 0;
    const paxExtra = Math.max(0, adultos - Math.max(0, incluidos));
    const montoServicio =
      (Number(selected.precioBase ?? 0) || 0) +
      (ninos * (Number(selected.precioNino ?? 0) || 0)) +
      (paxExtra * (Number(selected.precioAdultoExtra ?? 0) || 0));

    this.reglaTarifaAplicada = selected;
    this.reglaTarifaError = '';

    this.detalleForm.costoRack = montoServicio;
    this.detalleForm.costoNeto = montoServicio;
    this.detalleForm.montoServicio = montoServicio;

    return true;
  }

  private async getReglasTarifa(codLstPrecio: string, codServicio: string): Promise<ReglaTarifa[]> {
    const key = `${codLstPrecio}::${codServicio}`;
    const cached = this.reglasTarifaCache.get(key);
    if (cached) return cached;

    const reglas = await firstValueFrom(
      this.reglasTarifariasService.getByListaPrecioAndServicio(codLstPrecio, codServicio).pipe(take(1))
    );
    const normalized = (reglas ?? []).filter((r) => (r.codLstPrecio || '').trim() === codLstPrecio);
    this.reglasTarifaCache.set(key, normalized);
    return normalized;
  }

  private getSelectedMonedaForReglas(): string {
    const cod = (this.form.codLstPrecio || '').trim();
    const fromLista = this.listaPrecios.find((lp) => (lp.codigo || '').trim() === cod)?.moneda;
    return ((fromLista || this.form.moneda || '') as string).trim().toUpperCase();
  }

  private matchAdultosEnRango(adultos: number, min: number, max: number): boolean {
    const minN = Number(min ?? 0) || 0;
    const maxN = Number(max ?? 0) || 0;
    if (minN > 0 && adultos < minN) return false;
    if (maxN > 0 && adultos > maxN) return false;
    return true;
  }

  // Rango horario: [desde, hasta) para evitar solapamientos (ej: 09:00 cae en la regla 09:00-10:00).
  private matchHoraEnRango(horaMin: number, desde: string, hasta: string): boolean {
    const start = this.timeToMinutes(desde);
    const end = this.timeToMinutes(hasta);
    if (start == null || end == null) return false;
    return horaMin >= start && horaMin < end;
  }

  private timeToMinutes(value: string): number | null {
    const v = (value || '').trim();
    if (!v) return null;
    const parts = v.split(':');
    if (parts.length < 2) return null;
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  private pickMostSpecificRegla(reglas: ReglaTarifa[]): ReglaTarifa | null {
    const sorted = [...(reglas ?? [])].sort((a, b) => {
      const aMin = Number(a.cantMinPax ?? 0) || 0;
      const aMax = Number(a.cantMaxPax ?? 0) || 0;
      const bMin = Number(b.cantMinPax ?? 0) || 0;
      const bMax = Number(b.cantMaxPax ?? 0) || 0;

      const aWidth = aMax > 0 && aMin > 0 ? aMax - aMin : Number.POSITIVE_INFINITY;
      const bWidth = bMax > 0 && bMin > 0 ? bMax - bMin : Number.POSITIVE_INFINITY;
      if (aWidth !== bWidth) return aWidth - bWidth;

      if (aMin !== bMin) return bMin - aMin;
      if (aMax !== bMax) return aMax - bMax;

      const aStart = this.timeToMinutes(a.horaInicio) ?? Number.POSITIVE_INFINITY;
      const aEnd = this.timeToMinutes(a.horaFin) ?? Number.POSITIVE_INFINITY;
      const bStart = this.timeToMinutes(b.horaInicio) ?? Number.POSITIVE_INFINITY;
      const bEnd = this.timeToMinutes(b.horaFin) ?? Number.POSITIVE_INFINITY;
      const aTimeWidth = Number.isFinite(aStart) && Number.isFinite(aEnd) ? aEnd - aStart : Number.POSITIVE_INFINITY;
      const bTimeWidth = Number.isFinite(bStart) && Number.isFinite(bEnd) ? bEnd - bStart : Number.POSITIVE_INFINITY;
      if (aTimeWidth !== bTimeWidth) return aTimeWidth - bTimeWidth;

      const aDate = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
      const bDate = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
      if (aDate !== bDate) return bDate - aDate;

      return (b.id ?? 0) - (a.id ?? 0);
    });

    return sorted[0] ?? null;
  }
}
