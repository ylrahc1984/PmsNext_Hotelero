import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { ReservasService } from './reservas.service';
import { ReservaDetalleService, ReservaDetalle } from './reserva-detalle.service';
import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import { FormaPagoService } from '../administracion/forma-pago/forma-pago.service';
import { FormaPago } from '../administracion/forma-pago/forma-pago.models';
import { MonedaService, MonedaUI } from '../administracion/monedas/moneda.service';

// Tarifa
import { ListaPrecioService } from '../catalogos/listas-precios/lista-precio.service';

// Tarifa engine
import { ReglaTarifa } from '../catalogos/listas-precios/listas-precios.service';

// Tarifa models
import { ListaPrecioUI } from '../catalogos/listas-precios/lista-precio.models';

import { ClienteService } from '../catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from '../catalogos/agencias-comisionistas/cliente.models';
import { ServiciosService, ServicioUI } from '../catalogos/servicios/servicios.service';
import { IdiomasService } from '../catalogos/idiomas/idiomas.service';
import { IdiomaDto } from '../catalogos/idiomas/idiomas.models';
import { FormaReservasService } from '../catalogos/forma-reservas/forma-reservas.service';
import { FormaReservaDto } from '../catalogos/forma-reservas/forma-reservas.models';

import { showAlertWithFocusRestore } from './reserva-create.alert';
import { buildInitialDetalleForm, buildInitialReservaCreateForm } from './reserva-create.builders';
import { clearReservaCreateDraftCod, getReservaCreateDraftCod, setReservaCreateDraftCod } from './reserva-create.draft-storage';
import { DetalleForm, ReservaCreateForm, ReservaEstado } from './reserva-create.models';
import {
  extractCodReserva,
  extractGoogleDisplayText,
  hasCoordinates,
  normalizeReservaEstado,
  parseCodigoValue,
  parseNumericId,
  safeNumber,
  safeJsonStringify,
  safeString,
  toDateInputValue
} from './reserva-create.utils';
import { ReservaCreateTarifaService } from './reserva-create.tarifa.service';
import { computeAdultosExtra } from './reserva-create.tarifa-engine';
import { ReservaCreateClienteModalComponent } from './reserva-create-cliente-modal.component';
import { ReservaCreateDetalleModalComponent } from './reserva-create-detalle-modal.component';

@Component({
  selector: 'app-reserva-create',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, ReservaCreateClienteModalComponent, ReservaCreateDetalleModalComponent],
  templateUrl: './reserva-create.component.html',
  styleUrls: ['./reserva-create.component.scss']
})
export class ReservaCreateComponent implements OnInit, CanDeactivateReservaCreate {
  form: ReservaCreateForm = buildInitialReservaCreateForm();
  detalles: ReservaDetalle[] = [];
  detalleForm: DetalleForm = buildInitialDetalleForm();
  showDetalleModal = false;
  editingDetalleId: number | null = null;
  guardado = false;

  idiomas: IdiomaDto[] = [];
  formasReservacion: FormaReservaDto[] = [];
  formasPagoApi: FormaPago[] = [];
  listaPrecios: ListaPrecioUI[] = [];
  monedas: MonedaUI[] = [];
  servicios: ServicioUI[] = [];
  tarifas = ['A', 'B', 'C', 'D'];
  zonas = ['San Jose', 'Alajuela', 'Monteverde', 'Liberia', 'La Fortuna', 'Tamarindo', 'Sarapiqui'];

  // Resultado de la última aplicación de regla tarifaria al detalleForm.
  reglaTarifaAplicada: ReglaTarifa | null = null;
  reglaTarifaError = '';
  allowManualPricing = false;

  showClienteModal = false;
  selectedCliente: ClienteUI | null = null;
  serviciosLoading = false;

  private reservasService = inject(ReservasService);
  private detalleService = inject(ReservaDetalleService);
  private router = inject(Router);
  private formaPagoService = inject(FormaPagoService);
  private monedaService = inject(MonedaService);
  private listaPrecioService = inject(ListaPrecioService);
  private tarifaService = inject(ReservaCreateTarifaService);
  private clienteService = inject(ClienteService);
  private serviciosService = inject(ServiciosService);
  private authService = inject(AuthService);
  private idiomasService = inject(IdiomasService);
  private formaReservasService = inject(FormaReservasService);

  private isLikelyPlaceId(value: unknown): boolean {
    const v = safeString(value).trim();
    if (!v) return false;
    // Place IDs suelen verse como "ChIJ..." y no contienen espacios/comas.
    if (/\s|,/.test(v)) return false;
    if (v.length < 10) return false;
    return v.startsWith('ChI') || v.startsWith('GhI') || v.startsWith('E') || v.startsWith('g');
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

  /**
   * Punto de entrada del componente.
   * - Carga catálogos (idiomas, formas de reservación, formas de pago, monedas, listas de precios).
   * - Inicializa el flujo de creación/recuperación de reserva (borrador o edición por URL).
   */
  ngOnInit(): void {
    this.cargarIdiomas();
    this.cargarFormasReservacion();
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
   * Inicializa el contexto de la reserva en tres escenarios:
   * 1) Si la URL trae un código (editar/detalle), carga encabezado y detalle.
   * 2) Si existe un borrador en sessionStorage, lo retoma.
   * 3) Si no hay nada, crea un borrador automáticamente (PEN) apenas haya usuario/operador.
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

  /**
   * Retoma un borrador existente (estado PEN).
   * - Si el backend indica que ya no es PEN, descarta el draft local y crea uno nuevo.
   * - Si es válido, estabiliza la URL (nueva -> /editar) y carga encabezado/detalle.
   */
  private resumeDraft(codReserva: string): void {
    this.codReservaActual = codReserva;
    this.loading = true;

    this.reservasService.getReservaByCod(codReserva).subscribe({
      next: (res) => {
        const estado = normalizeReservaEstado((res.PRV01_Estado as any) ?? 'PEN');
        if (estado !== 'PEN') {
          // Ya no es borrador: no lo reutilizamos.
          clearReservaCreateDraftCod();
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
        clearReservaCreateDraftCod();
        this.codReservaActual = null;
        this.loading = false;
        this.crearBorrador();
      }
    });
  }

  /**
   * Crea automáticamente un borrador en backend (estado PEN) si aún no existe `codReservaActual`.
   * Guarda el código en sessionStorage para sobrevivir refresh y estabiliza la URL a /editar.
   */
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
        const cod = extractCodReserva(res);
        if (!cod) {
          this.creandoBorrador = false;
          this.showAlert('Error', 'No se recibió el código de reserva al crear el borrador.', 'error');
          return;
        }
        this.codReservaActual = cod;
        setReservaCreateDraftCod(cod);
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
        const idiomaCodigo = parseCodigoValue(idiomaRaw);
        const formaCodigo = parseCodigoValue(formaRaw);
        const idiomaId = parseNumericId(idiomaRaw);
        const formaId = parseNumericId(formaRaw);
        this.form = {
          fecha: toDateInputValue(res.PRV01_FecCreacion) || this.form.fecha || '',
          codAgencia: safeString((res as any).PRV01_CodAgencia),
          nomCliente: safeString((res as any).PRV01_NomCliente),
          telCliente: safeString((res as any).PRV01_TelCliente),
          emailCliente: safeString((res as any).PRV01_EmailCliente),
          idioma: idiomaCodigo ?? '',
          formaReservacion: formaCodigo ?? '',
          formaPago: safeString((res as any).PRV01_FormaPago),
          codLstPrecio: safeString((res as any).PRV01_CodLstPrecio),
          moneda: safeString((res as any).PRV01_Moneda),
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

  /**
   * Carga el detalle (servicios) de la reserva desde API y lo asigna a `detalles`.
   */
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

  /**
   * Abre el modal de detalle/servicio.
   * - Si recibe un detalle, mapea API -> `DetalleForm` para editar.
   * - Si no recibe detalle, inicializa un `DetalleForm` nuevo.
   * - Protege el flujo cuando la reserva no existe o está CON/CAN.
   */
  abrirModalDetalle(detalle?: ReservaDetalle): void {
    if (!this.codReservaActual) {
      this.showAlert('Atención', 'Espere la creación del borrador para agregar servicios.', 'warning');
      return;
    }
    
    if (this.form.estado === 'CAN') {
      this.showAlert('Atención', 'No se pueden modificar servicios en una reserva anulada.', 'warning');
      return;
    }

    if (detalle) {
      // Mapear campos de ReservaDetalle (API) a DetalleForm (modal) preservando defaults (ej: tarifa='A').
      const baseForm = buildInitialDetalleForm();

      const origenGoogleText = extractGoogleDisplayText((detalle as any).PRV02_OrigenGoogle);
      const destinoGoogleText = extractGoogleDisplayText((detalle as any).PRV02_DestinoGoogle);

      const apiOrigenPlaceId = safeString(detalle.PRV02_OrigenPlaceId);
      const apiDestinoPlaceId = safeString(detalle.PRV02_DestinoPlaceId);

      const origenDireccionGoogle = origenGoogleText || (!this.isLikelyPlaceId(apiOrigenPlaceId) ? apiOrigenPlaceId : '');
      const destinoDireccionGoogle = destinoGoogleText || (!this.isLikelyPlaceId(apiDestinoPlaceId) ? apiDestinoPlaceId : '');
      this.detalleForm = {
        ...baseForm,
        codServicio: detalle.PRV02_CodServicio || '',
        nomServicio: detalle.PRV02_NomServicio || '',
        tipoServicio: detalle.PRV02_TipoServicio || '',
        fechaServicio: toDateInputValue(detalle.PRV02_FecServicio) || baseForm.fechaServicio || '',
        horaPickup: detalle.PRV02_HoraServicio || '',
        horaInicio: detalle.PRV02_HoraServicio || '',
        adultos: detalle.PRV02_Adultos || baseForm.adultos,
        ninos: detalle.PRV02_Ninos || 0,
        totalPax: detalle.PRV02_TotalPax || 0,
        origenLugar: detalle.PRV02_OrigenTexto || '',
        origenDireccionGoogle,
        origenGoogle: safeJsonStringify((detalle as any).PRV02_OrigenGoogle),
        origenLat: detalle.PRV02_OrigenLat || 0,
        origenLng: detalle.PRV02_OrigenLng || 0,
        // Ahora estos campos guardan el Place ID real (técnico).
        origenPlaceId: this.isLikelyPlaceId(apiOrigenPlaceId) ? apiOrigenPlaceId : '',
        destinoLugar: detalle.PRV02_DestinoTexto || '',
        destinoDireccionGoogle,
        destinoGoogle: safeJsonStringify((detalle as any).PRV02_DestinoGoogle),
        destinoLat: detalle.PRV02_DestinoLat || 0,
        destinoLng: detalle.PRV02_DestinoLng || 0,
        destinoPlaceId: this.isLikelyPlaceId(apiDestinoPlaceId) ? apiDestinoPlaceId : '',
        costoNeto: detalle.PRV02_MontoServicio || 0,
        costoRack: (detalle.PRV02_PrecioAdulto || 0) + (detalle.PRV02_PrecioNino || 0) + (detalle.PRV02_PrecioPaxExtra || 0),
        montoServicio: detalle.PRV02_MontoServicio || 0,
        estado: detalle.PRV02_Estado || baseForm.estado,
        observaciones: detalle.PRV02_Observacion || ''
      };
      this.editingDetalleId = detalle.PRV02_ID;
    } else {
      this.detalleForm = buildInitialDetalleForm();
      this.editingDetalleId = null;
      // this.recalcularCosto(); // El cálculo se puede hacer al guardar
    }
    this.allowManualPricing = false;
    this.reglaTarifaError = '';
    this.showDetalleModal = true;
    if (!this.servicios.length) {
      this.cargarServicios();
    }
  }

  /**
   * Cierra el modal de detalle/servicio (sin persistir cambios del formulario local).
   */
  cerrarModalDetalle(): void {
    this.showDetalleModal = false;
  }

  /**
   * Dispara un recálculo "silencioso" del costo basado en reglas tarifarias,
   * actualizando los campos calculados del `DetalleForm` cuando aplique.
   */
  recalcularCosto(): void {
    void this.applyReglaTarifaToDetalleForm({ silent: true });
  }

  /**
   * Construye un enlace de Google Maps para un detalle ya persistido (lista de servicios).
   */
  getDetalleMapsLink(detalle: ReservaDetalle, tipo: 'origen' | 'destino'): string {
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
   * - Construye el payload esperado por `ReservaDetalleService`.
   */
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
      if (!reglaAplicada && !this.allowManualPricing) {
        this.showAlert(
          'Atención',
          this.reglaTarifaError ||
            'No se encontró una regla tarifaria que aplique para la lista de precios, servicio, tarifa, cantidad de adultos y hora Pick-Up seleccionados.',
          'warning'
        );
        return;
      }

      if (!reglaAplicada && this.allowManualPricing) {
        const neto = Number(this.detalleForm.costoNeto ?? 0) || 0;
        const rack = Number(this.detalleForm.costoRack ?? 0) || 0;
        if (neto <= 0 && rack <= 0) {
          this.showAlert('Atención', 'No hay regla tarifaria. Ingrese Costo Neto y/o Costo Rack para continuar.', 'warning');
          return;
        }
      }

      const totalPax = (this.detalleForm.adultos || 0) + (this.detalleForm.ninos || 0);
      const ninosCount = Number(this.detalleForm.ninos ?? 0) || 0;
      const paxExtraCount =
        this.reglaTarifaAplicada && typeof this.detalleForm.adultos === 'number'
          ? computeAdultosExtra(this.detalleForm.adultos, this.reglaTarifaAplicada)
          : 0;
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
        // Nuevos campos: guardar el JSON/metadata de Google y el Place ID real.
        origenGoogle: (this.detalleForm.origenGoogle || '').toString(),
        destinoGoogle: (this.detalleForm.destinoGoogle || '').toString(),
        origenPlaceId: (this.detalleForm.origenPlaceId || '').toString(),
        destinoPlaceId: (this.detalleForm.destinoPlaceId || '').toString(),
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
        // Si no hay niños, no se debe guardar precioNino.
        precioNino: ninosCount > 0 ? this.reglaTarifaAplicada?.precioNino ?? 0 : 0,
        // Si NO excede el máximo de la regla, no se debe guardar precioPaxExtra.
        // Solo se envía cuando hay adultos extra (adultos > cantMaxPax).
        precioPaxExtra: paxExtraCount > 0 ? this.reglaTarifaAplicada?.precioAdultoExtra ?? 0 : 0,
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

  /**
   * Elimina un detalle del backend y recarga la lista de detalles.
   */
  eliminarDetalle(detalle: ReservaDetalle): void {
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
        error: () => {
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
  guardarReserva(formRef?: any): void {
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
    if (!this.codReservaActual) {
      this.showAlert('Atención', 'Espere la creación del borrador para guardar.', 'warning');
      this.crearBorrador();
      return;
    }

    if (this.form.estado === 'CON') {
      this.confirmando = true;
      const payload = this.buildEncabezadoPayload('CON');
      this.reservasService.actualizarReserva(this.codReservaActual, payload).subscribe({
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
      this.confirmarReserva(formRef);
    });
  }

  /**
   * Confirma una reserva.
   * - Primero guarda el encabezado actual (estado PEN) para confirmar con datos actualizados.
   * - Luego llama al endpoint de confirmación y cambia estado a CON.
   */
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
      this.showValidationErrors(formRef);
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
   * Se usa para "estabilizar" la URL (nueva -> /editar) sin warnings/loops.
   */
  private navigateInternal(commands: any[], extras?: any): void {
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

  /**
   * Aplica la selección de un servicio desde el catálogo al formulario del modal.
   */
  seleccionarServicio(servicio: ServicioUI): void {
    this.detalleForm.codServicio = servicio.codReceta;
    this.detalleForm.nomServicio = servicio.nomReceta;
    this.detalleForm.tipoServicio = servicio.codGrupo || servicio.codCateg || '';
  }

  /**
   * Handler del cambio de servicio en el modal:
   * - Actualiza nombre/tipo de servicio en `DetalleForm`.
   * - Dispara recálculo de costo (reglas tarifarias).
   */
  onServicioChange(codServicio: string): void {
    const servicio = this.servicios.find((item) => item.codReceta === codServicio);
    if (servicio) {
      this.seleccionarServicio(servicio);
      this.allowManualPricing = false;
      this.reglaTarifaError = '';
      this.recalcularCosto();
      return;
    }
    this.detalleForm.nomServicio = '';
    this.detalleForm.tipoServicio = '';
    this.reglaTarifaAplicada = null;
    this.reglaTarifaError = '';
    this.allowManualPricing = false;
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
    // Sumar PRV02_PrecioAdulto + PRV02_PrecioNino + PRV02_PrecioPaxExtra de los detalles
    return this.detalles.reduce((sum, d) => sum + ((d.PRV02_PrecioAdulto || 0) + (d.PRV02_PrecioNino || 0) + (d.PRV02_PrecioPaxExtra || 0)), 0);
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

  /**
   * Wrapper de alertas para estandarizar UX y evitar warnings de foco/aria cuando hay modales abiertos.
   */
  private showAlert(title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info'): void {
    showAlertWithFocusRestore({
      title,
      text,
      icon,
      shouldRestoreFocus: () => this.showDetalleModal || this.showClienteModal || this.showCancelDecisionModal
    });
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
      observacion: this.form.comentarios,
      codLstPrecio: this.form.codLstPrecio,
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
   * Handler cuando cambia la lista de precios en el encabezado:
   * - Limpia caché de reglas tarifarias.
   * - Si el modal de detalle está abierto, recalcula costo con la nueva lista.
   */
  onListaPrecioChange(): void {
    this.tarifaService.clearCache();
    this.allowManualPricing = false;
    this.reglaTarifaError = '';
    if (this.showDetalleModal) {
      this.recalcularCosto();
    }
  }

  /**
   * Aplica reglas tarifarias al `DetalleForm` actual (si el modal está abierto).
   * Actualiza `reglaTarifaAplicada`, `reglaTarifaError` y campos calculados (costo/monto).
   */
  private async applyReglaTarifaToDetalleForm(options?: { silent?: boolean }): Promise<boolean> {
    if (!this.showDetalleModal) return false;

    const codLstPrecio = (this.form.codLstPrecio || '').trim();
    const codServicio = (this.detalleForm.codServicio || '').trim();
    const tarifa = (this.detalleForm.tarifa || '').trim().toUpperCase();
    const moneda = this.getSelectedMonedaForReglas();

    if (!codLstPrecio || !codServicio || !tarifa) {
      this.reglaTarifaAplicada = null;
      this.reglaTarifaError = '';
      this.allowManualPricing = false;
      return false;
    }

    const adultos = Number(this.detalleForm.adultos ?? 0) || 0;
    const ninos = Number(this.detalleForm.ninos ?? 0) || 0;
    const totalPax = adultos + ninos;
    this.detalleForm.totalPax = totalPax;

    const horaReferencia = (this.detalleForm.horaPickup || this.detalleForm.horaInicio || '').trim();
    const result = await this.tarifaService.applyReglaTarifa({
      codLstPrecio,
      codServicio,
      tarifa,
      adultos,
      ninos,
      horaPickup: horaReferencia,
      moneda
    });

    if (result.ok === false) {
      this.reglaTarifaAplicada = null;
      this.reglaTarifaError = result.error || '';

      // Solo habilitamos edición manual cuando el problema es "no hay coincidencia" de reglas.
      // Si falta hora o es inválida, se mantiene bloqueado para que el usuario corrija inputs primero.
      const isNoMatch =
        !!result.error &&
        (result.error.includes('No hay una regla tarifaria') || result.error.includes('No se pudo seleccionar una regla'));
      this.allowManualPricing = isNoMatch;

      if (this.allowManualPricing) {
        // En creación, limpiamos montos para evitar dejar valores viejos que no corresponden.
        // En edición, preservamos montos existentes (solo habilitamos edición).
        if (!this.editingDetalleId) {
          this.detalleForm.costoRack = 0;
          this.detalleForm.costoNeto = 0;
          this.detalleForm.montoServicio = 0;
        }
      }
      return false;
    }

    this.reglaTarifaAplicada = result.regla;
    this.reglaTarifaError = '';
    this.allowManualPricing = false;

    this.detalleForm.costoRack = result.montoServicio;
    this.detalleForm.costoNeto = result.montoServicio;
    this.detalleForm.montoServicio = result.montoServicio;

    return true;
  }

  /**
   * Determina la moneda a utilizar para filtrar reglas tarifarias:
   * - Prioriza la moneda configurada en la lista de precios seleccionada.
   * - Si no existe, usa la moneda del formulario.
   */
  private getSelectedMonedaForReglas(): string {
    const cod = (this.form.codLstPrecio || '').trim();
    const fromLista = this.listaPrecios.find((lp) => (lp.codigo || '').trim() === cod)?.moneda;
    return ((fromLista || this.form.moneda || '') as string).trim().toUpperCase();
  }
}
