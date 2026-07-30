import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { RoomCategory } from 'src/app/modules/front-desk/settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from 'src/app/modules/front-desk/settings/room-categories/services/room-categories.service';
import { RoomType } from 'src/app/modules/front-desk/settings/room-types/models/room-type.model';
import { RoomTypesService } from 'src/app/modules/front-desk/settings/room-types/services/room-types.service';
import { WalkInAgenciaOption, WalkInOption, WalkInTarifaOption } from 'src/app/modules/front-desk/walk-in/models/walk-in.model';
import { WalkInService } from 'src/app/modules/front-desk/walk-in/services/walk-in.service';
import { ReservaHabitacionResponse } from 'src/app/modules/Reservas/interfaces/reserva-habitacion.interface';
import { ReservaHabitacionService } from 'src/app/modules/Reservas/services/reserva-habitacion.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ReservaImportacionMapper } from './mappers/reserva-importacion.mapper';
import {
  ESTADOS_RESERVA_PMS,
  FiltrosMigracion,
  HabitacionImportacion,
  HomologacionCategoria,
  HomologacionEstado,
  HomologacionTarifa,
  ReservaImportacion,
  ResumenImportacion
} from './models/reserva-importacion.model';
import { ExcelReservasReaderService } from './services/excel-reservas-reader.service';
import { calculateHeaderNightlyPrice } from './utils/reserva-price.util';
import { CatalogosValidacion, ReservaImportacionValidator } from './validators/reserva-importacion.validator';

@Component({
  selector: 'app-migracion-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './migracion-reservas.component.html',
  styleUrl: './migracion-reservas.component.scss'
})
export class MigracionReservasComponent implements OnInit, CanDeactivateReservaCreate {
  private readonly excelReader = inject(ExcelReservasReaderService);
  private readonly walkInService = inject(WalkInService);
  private readonly categoryService = inject(RoomCategoriesService);
  private readonly typeService = inject(RoomTypesService);
  private readonly reservasService = inject(ReservaHabitacionService);
  private readonly toast = inject(ToastService);
  private readonly operationalPolicy = inject(OperationalPolicyService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly exchangeRateService = inject(TipoCambioService);

  readonly steps = ['Archivo', 'Homologación', 'Revisión', 'Validación', 'Importación'];
  readonly estadosPms = ESTADOS_RESERVA_PMS;
  readonly pageSize = 20;

  step = 0;
  file: File | null = null;
  sheetName = '';
  detectedRoomLines = 0;
  ignoredRows = 0;
  dragActive = false;
  private dragDepth = 0;
  reading = false;
  loadingMasters = false;
  importing = false;
  importFinished = false;
  currentImport = 0;
  importTotal = 0;
  currentReservation = '';
  page = 1;
  expandedId = '';

  reservas: ReservaImportacion[] = [];
  tarifaMappings: HomologacionTarifa[] = [];
  categoryMappings: HomologacionCategoria[] = [];
  stateMappings: HomologacionEstado[] = [];
  agencias: WalkInAgenciaOption[] = [];
  tarifas: WalkInTarifaOption[] = [];
  planes: WalkInOption[] = [];
  categorias: RoomCategory[] = [];
  tiposPorCategoria = new Map<string, RoomType[]>();

  filtros: FiltrosMigracion = {
    busqueda: '',
    validacion: 'TODAS',
    tarifaOrigen: '',
    agencia: '',
    categoria: '',
    plan: '',
    fechaEntrada: ''
  };

  ngOnInit(): void {
    void this.loadMasters();
  }

  get summary(): ResumenImportacion {
    const departureDates = this.reservas.map((item) => item.fechaSalida).filter(Boolean).sort();
    return {
      reservas: this.reservas.length,
      lineasHabitacion: this.detectedRoomLines,
      habitaciones: this.reservas.reduce((sum, item) => sum + item.habitaciones, 0),
      noches: this.reservas.reduce((sum, item) => sum + item.noches, 0),
      pax: this.reservas.reduce((sum, item) => sum + item.pax, 0),
      total: this.reservas.reduce((sum, item) => sum + item.total, 0),
      depositado: this.reservas.reduce((sum, item) => sum + item.depositado, 0),
      pendientesHomologacion: this.reservas.filter(
        (item) =>
          !item.codAgencia ||
          !item.codTarifa ||
          !item.codPlan ||
          !item.estadoPms ||
          item.detalleHabitaciones.some((room) => !room.catHabita)
      ).length,
      categoriasHomologadas: this.categoryMappings.filter((item) => !!item.catHabita).length,
      advertencias: this.reservas.filter((item) => item.estadoValidacion === 'ADVERTENCIA').length,
      errores: this.reservas.filter((item) => item.estadoValidacion === 'ERROR').length,
      listas: this.reservas.filter((item) => item.estadoValidacion === 'VALIDA' || item.estadoValidacion === 'ADVERTENCIA').length,
      fechaMinima: this.reservas.map((item) => item.fechaEntrada).filter(Boolean).sort()[0] ?? '',
      fechaMaxima: departureDates[departureDates.length - 1] ?? ''
    };
  }

  get pendingMappingRules(): number {
    const commercial = this.tarifaMappings.filter(
      (mapping) => !mapping.codAgencia || !mapping.codTarifa || !mapping.codPlan
    ).length;
    const states = this.stateMappings.filter((mapping) => !mapping.estadoPms).length;
    const categories = this.categoryMappings.filter((mapping) => !mapping.catHabita).length;
    return commercial + states + categories;
  }

  get filteredReservations(): ReservaImportacion[] {
    const query = this.filtros.busqueda.trim().toLowerCase();
    return this.reservas.filter((item) => {
      const matchesSearch = !query || `${item.numeroExterno} ${item.nombre} ${item.otaId}`.toLowerCase().includes(query);
      const matchesValidation =
        this.filtros.validacion === 'TODAS' ||
        (this.filtros.validacion === 'REVISION'
          ? item.estadoValidacion !== 'VALIDA' || this.hasPendingMapping(item)
          : item.estadoValidacion === this.filtros.validacion);
      const matchesOrigin = !this.filtros.tarifaOrigen || item.tarifaOrigen === this.filtros.tarifaOrigen;
      const matchesAgency = !this.filtros.agencia || item.codAgencia === this.filtros.agencia;
      const matchesCategory =
        !this.filtros.categoria || item.detalleHabitaciones.some((room) => room.catHabita === this.filtros.categoria);
      const matchesDate = !this.filtros.fechaEntrada || item.fechaEntrada === this.filtros.fechaEntrada;
      const matchesPlan = !this.filtros.plan || item.codPlan === this.filtros.plan;
      return matchesSearch && matchesValidation && matchesOrigin && matchesAgency && matchesCategory && matchesPlan && matchesDate;
    });
  }

  get pagedReservations(): ReservaImportacion[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredReservations.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredReservations.length / this.pageSize));
  }

  get selectedCount(): number {
    return this.reservas.filter((item) => item.seleccionado && item.estadoValidacion !== 'ERROR' && item.estadoImportacion !== 'IMPORTADA').length;
  }

  get importedCount(): number {
    return this.reservas.filter((item) => item.estadoImportacion === 'IMPORTADA').length;
  }

  get importErrorCount(): number {
    return this.reservas.filter((item) => item.estadoImportacion === 'ERROR').length;
  }

  get omittedCount(): number {
    return this.reservas.filter((item) => item.estadoImportacion === 'OMITIDA').length;
  }

  get importedTotal(): number {
    return this.reservas
      .filter((item) => item.estadoImportacion === 'IMPORTADA')
      .reduce((sum, item) => sum + item.total, 0);
  }

  get prepaidReservationCount(): number {
    return this.reservas.filter((item) => item.depositado > 0).length;
  }

  get progress(): number {
    return this.importTotal ? Math.round((this.currentImport / this.importTotal) * 100) : 0;
  }

  get selectedReservations(): ReservaImportacion[] {
    return this.reservas.filter(
      (item) => item.seleccionado && item.estadoValidacion !== 'ERROR' && item.estadoImportacion !== 'IMPORTADA'
    );
  }

  get selectedRooms(): number {
    return this.selectedReservations.reduce((sum, item) => sum + item.habitaciones, 0);
  }

  get selectedTotal(): number {
    return this.selectedReservations.reduce((sum, item) => sum + item.total, 0);
  }

  async onFileInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) await this.loadFile(input.files[0]);
    input.value = '';
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    this.dragActive = false;
    const dropped = this.extractDroppedFile(event.dataTransfer);
    if (!dropped) {
      this.toast.warning('No se detectó un archivo. Arrástrelo desde el Explorador de archivos de Windows.');
      return;
    }
    await this.loadFile(dropped);
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.importing || this.reading) return;
    this.dragDepth++;
    this.dragActive = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragActive = false;
  }

  async loadFile(file: File): Promise<void> {
    if (this.importing) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.toast.warning(`El archivo "${file.name}" no es compatible. Debe guardarlo en formato .xlsx.`);
      return;
    }
    this.reading = true;
    try {
      const result = await this.excelReader.read(file);
      this.file = file;
      this.sheetName = result.nombreHoja;
      this.detectedRoomLines = result.lineasHabitacion;
      this.ignoredRows = result.filasIgnoradas;
      this.reservas = result.reservas;
      const operationalDate = toPmsDateInputValue(await firstValueFrom(this.operationalDateService.ensureLoaded()));
      this.reservas.forEach((item) => {
        if (!item.fechaCreacion) item.fechaCreacion = operationalDate;
      });
      this.buildMappings();
      this.applyAutomaticCategoryMappings();
      this.applyValidation();
      this.step = 0;
      this.importFinished = false;
      this.page = 1;
      this.toast.success(
        `${result.reservas.length} reservas reconstruidas a partir de ${result.lineasHabitacion} líneas de habitación.`
      );
    } catch (error) {
      this.toast.blockingError(this.messageFromError(error));
    } finally {
      this.reading = false;
    }
  }

  removeFile(): void {
    if (this.importing) return;
    this.reset();
  }

  reset(): void {
    this.file = null;
    this.sheetName = '';
    this.detectedRoomLines = 0;
    this.ignoredRows = 0;
    this.reservas = [];
    this.tarifaMappings = [];
    this.categoryMappings = [];
    this.stateMappings = [];
    this.step = 0;
    this.importFinished = false;
    this.expandedId = '';
    this.page = 1;
  }

  canAdvance(): boolean {
    if (this.step === 0) return this.reservas.length > 0 && !this.reading;
    if (this.step === 1) return this.pendingMappingRules === 0;
    if (this.step === 2) return true;
    if (this.step === 3) return this.selectedCount > 0 && this.reservas.every((item) => !item.seleccionado || item.estadoValidacion !== 'ERROR');
    return false;
  }

  next(): void {
    if (!this.canAdvance() || this.importing) return;
    if (this.step === 1 || this.step === 2) this.applyValidation();
    this.step = Math.min(4, this.step + 1);
    this.page = 1;
  }

  previous(): void {
    if (!this.importing) this.step = Math.max(0, this.step - 1);
  }

  goToStep(index: number): void {
    if (this.importing || index > this.step) return;
    this.step = index;
  }

  updateTariffMapping(mapping: HomologacionTarifa): void {
    const affectedReservations = this.reservas.filter((item) => item.tarifaOrigen === mapping.origen);
    affectedReservations
      .forEach((item) => {
        item.codAgencia = mapping.codAgencia;
        item.codTarifa = mapping.codTarifa;
        item.codPlan = mapping.codPlan;
        item.directo = mapping.directo;
        const tariff = this.tarifas.find((rate) => rate.codigo === mapping.codTarifa);
        item.moneda = tariff?.moneda?.trim().toUpperCase() ?? '';
        item.detalleHabitaciones.forEach((room) => (room.moneda = item.moneda));
      });
    this.resolveRoomPrices(affectedReservations);
    void this.resolveExchangeRateForMapping(mapping);
    this.applyValidation();
  }

  updateCategoryMapping(mapping: HomologacionCategoria, manual = true): void {
    if (manual) mapping.coincidencia = mapping.catHabita ? 'MANUAL' : 'PENDIENTE';
    this.reservas.forEach((reservation) => {
      reservation.detalleHabitaciones
        .filter((room) => this.normalized(room.categoriaOrigen ?? '') === this.normalized(mapping.origen))
        .forEach((room) => {
          room.catHabita = mapping.catHabita;
          room.homologacionCategoria = mapping.coincidencia;
          this.determineRoomType(room);
        });
    });
    this.recalculateDerivedReservations();
    this.applyValidation();
    void this.resolveRoomPrices(
      this.reservas.filter((reservation) =>
        reservation.detalleHabitaciones.some(
          (room) => this.normalized(room.categoriaOrigen ?? '') === this.normalized(mapping.origen)
        )
      )
    );
  }

  updateStateMapping(mapping: HomologacionEstado): void {
    this.reservas
      .filter((item) => item.estadoOrigen === mapping.origen)
      .forEach((item) => (item.estadoPms = mapping.estadoPms));
    this.applyValidation();
  }

  typesFor(category: string): RoomType[] {
    return this.tiposPorCategoria.get(category) ?? [];
  }

  onRoomCategoryChange(reserva: ReservaImportacion, room: HabitacionImportacion): void {
    room.homologacionCategoria = room.catHabita ? 'MANUAL' : 'PENDIENTE';
    this.determineRoomType(room);
    this.applyValidation();
    void this.resolveRoomPrices([reserva]);
  }

  onRoomPaxChange(reserva: ReservaImportacion, room: HabitacionImportacion): void {
    this.determineRoomType(room);
    this.recalculateReservation(reserva);
    this.applyValidation();
    void this.resolveRoomPrices([reserva]);
  }

  onRoomTypeChange(reserva: ReservaImportacion): void {
    void this.resolveRoomPrices([reserva]);
    this.applyValidation();
  }

  recalculateRooms(reserva: ReservaImportacion): void {
    reserva.detalleHabitaciones.forEach((room, index) => {
      room.orden = index + 1;
      room.moneda = reserva.moneda;
      room.total = this.round(Number(room.cantHab || 0) * Number(room.precio || 0) * Number(reserva.noches || 0));
    });
    this.recalculateReservation(reserva);
    this.applyValidation();
  }

  distributedTotal(reserva: ReservaImportacion): number {
    return this.round(reserva.detalleHabitaciones.reduce((sum, room) => sum + Number(room.total || 0), 0));
  }

  distributedPax(reserva: ReservaImportacion): number {
    return reserva.detalleHabitaciones.reduce((sum, room) => sum + Number(room.numPax || 0), 0);
  }

  distributedRooms(reserva: ReservaImportacion): number {
    return reserva.detalleHabitaciones.reduce((sum, room) => sum + Number(room.cantHab || 0), 0);
  }

  toggleExpanded(reserva: ReservaImportacion): void {
    this.expandedId = this.expandedId === reserva.id ? '' : reserva.id;
  }

  selectAll(): void {
    this.reservas.forEach((item) => (item.seleccionado = item.estadoValidacion !== 'ERROR' && item.estadoImportacion !== 'IMPORTADA'));
  }

  selectVisible(): void {
    this.pagedReservations.forEach((item) => (item.seleccionado = item.estadoValidacion !== 'ERROR' && item.estadoImportacion !== 'IMPORTADA'));
  }

  clearSelection(): void {
    this.reservas.forEach((item) => (item.seleccionado = false));
  }

  toggleSelection(reserva: ReservaImportacion): void {
    if (reserva.estadoValidacion === 'ERROR' || reserva.estadoImportacion === 'IMPORTADA') reserva.seleccionado = false;
  }

  applyValidation(): void {
    const catalogs = this.validationCatalogs();
    this.reservas.forEach((item) => {
      const previousState = item.estadoValidacion;
      ReservaImportacionValidator.validate(item, catalogs);
      if (
        previousState === 'ERROR' &&
        item.estadoValidacion !== 'ERROR' &&
        item.estadoImportacion === 'PENDIENTE'
      ) {
        item.seleccionado = true;
      }
    });
    const duplicates = new Map<string, number>();
    this.reservas.forEach((item) => {
      const key = item.numeroExterno.trim().toUpperCase();
      if (key) duplicates.set(key, (duplicates.get(key) ?? 0) + 1);
    });
    this.reservas.forEach((item) => {
      if ((duplicates.get(item.numeroExterno.trim().toUpperCase()) ?? 0) > 1) {
        item.errores.push(`El número externo ${item.numeroExterno} aparece repetido dentro del archivo.`);
        item.estadoValidacion = 'ERROR';
        item.seleccionado = false;
      }
    });
  }

  resetFilters(): void {
    this.filtros = {
      busqueda: '',
      validacion: 'TODAS',
      tarifaOrigen: '',
      agencia: '',
      categoria: '',
      plan: '',
      fechaEntrada: ''
    };
    this.page = 1;
  }

  changePage(delta: number): void {
    this.page = Math.min(this.totalPages, Math.max(1, this.page + delta));
  }

  async importSelected(retryErrors = false): Promise<void> {
    if (this.importing) return;
    this.applyValidation();
    if (retryErrors) {
      this.reservas.forEach((item) => {
        item.seleccionado = item.estadoImportacion === 'ERROR' && item.estadoValidacion !== 'ERROR';
      });
    }
    const queue = this.selectedReservations;
    if (!queue.length) {
      this.toast.warning('No hay reservas elegibles para importar.');
      return;
    }

    const allowed = await this.operationalPolicy.require(OperationalAction.CreateOperation, { refresh: true });
    if (!allowed) return;
    const confirmation = await Swal.fire({
      icon: 'question',
      title: `Crear ${queue.length} reservas`,
      html: 'Las reservas se procesarán individualmente mediante el proceso normal.<br><strong>Los prepagos del archivo no serán migrados.</strong>',
      showCancelButton: true,
      confirmButtonText: 'Sí, importar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed) return;

    this.importing = true;
    this.importFinished = false;
    this.currentImport = 0;
    this.importTotal = queue.length;
    let connectivityFailure = false;

    for (const reserva of queue) {
      if (connectivityFailure) {
        reserva.estadoImportacion = 'OMITIDA';
        reserva.mensajeImportacion = 'Omitida por pérdida de conectividad durante el lote.';
        continue;
      }
      reserva.estadoImportacion = 'PROCESANDO';
      reserva.mensajeImportacion = '';
      this.currentReservation = `${reserva.numeroExterno} — ${reserva.nombre}`;
      try {
        const availabilityError = await this.validateAvailability(reserva);
        if (availabilityError) {
          reserva.estadoImportacion = 'ERROR';
          reserva.mensajeImportacion = availabilityError;
          continue;
        }
        const response = await firstValueFrom(
          this.reservasService.createReserva(ReservaImportacionMapper.toRequest(reserva))
        );
        this.applyApiResult(reserva, response);
      } catch (error) {
        reserva.estadoImportacion = 'ERROR';
        reserva.mensajeImportacion = this.messageFromError(error);
        connectivityFailure = error instanceof HttpErrorResponse && error.status === 0;
      } finally {
        this.currentImport++;
      }
    }

    this.importing = false;
    this.importFinished = true;
    this.currentReservation = '';
    if (connectivityFailure) {
      this.toast.connectivityIssue('El lote se detuvo porque se perdió la comunicación con el backend.');
    } else {
      this.toast.success(`Importación finalizada: ${this.importedCount} importadas, ${this.importErrorCount} con error.`);
    }
  }

  canDeactivate(): boolean {
    if (this.importing) return false;
    if (!this.reservas.length || this.importFinished) return true;
    return window.confirm('Hay una migración en preparación. ¿Desea salir y perder el estado temporal?');
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.importing || (this.reservas.length > 0 && !this.importFinished)) event.preventDefault();
  }

  trackByReservation(_index: number, item: ReservaImportacion): string {
    return item.id;
  }

  private async loadMasters(): Promise<void> {
    this.loadingMasters = true;
    try {
      const masters = await firstValueFrom(
        forkJoin({
          agencies: this.walkInService.getAgenciasPaginadas(1, 1000),
          rates: this.walkInService.getTarifasReserva(),
          plans: this.walkInService.getPlanes(),
          categories: this.categoryService.getRoomCategories()
        })
      );
      this.agencias = masters.agencies.datos.filter((item) => item.activo !== false);
      this.tarifas = masters.rates.filter((item) => item.activo !== false);
      this.planes = masters.plans;
      this.categorias = masters.categories;

      const typeRequests = this.categorias.map((category) =>
        this.typeService.getRoomTypesByCategory(category.CR01_CodCate)
      );
      const types = typeRequests.length ? await firstValueFrom(forkJoin(typeRequests)) : [];
      this.categorias.forEach((category, index) => {
        this.tiposPorCategoria.set(
          category.CR01_CodCate,
          (types[index] ?? []).filter((item) => Number(item.CR02_Activo ?? 0) === 1)
        );
      });
      this.applyAutomaticCategoryMappings();
      this.reservas.forEach((reservation) =>
        reservation.detalleHabitaciones.forEach((room) => this.determineRoomType(room))
      );
      void this.resolveRoomPrices(this.reservas);
      this.applyValidation();
    } catch (error) {
      this.toast.blockingError(`No fue posible cargar los maestros PMS: ${this.messageFromError(error)}`);
    } finally {
      this.loadingMasters = false;
    }
  }

  private buildMappings(): void {
    const tariffCount = new Map<string, number>();
    const tariffReservations = new Map<string, Set<string>>();
    const categoryCount = new Map<string, { lines: number; code: string; description: string }>();
    const stateCount = new Map<string, number>();
    this.reservas.forEach((item) => {
      const roomQuantity = item.detalleHabitaciones.reduce((sum, room) => sum + room.cantHab, 0);
      tariffCount.set(item.tarifaOrigen, (tariffCount.get(item.tarifaOrigen) ?? 0) + roomQuantity);
      if (!tariffReservations.has(item.tarifaOrigen)) tariffReservations.set(item.tarifaOrigen, new Set());
      tariffReservations.get(item.tarifaOrigen)?.add(item.numeroExterno);
      item.detalleHabitaciones.forEach((room) => {
        const origin = room.categoriaOrigen ?? '';
        const current = categoryCount.get(origin);
        categoryCount.set(origin, {
          lines: (current?.lines ?? 0) + room.cantHab,
          code: room.codigoCategoriaOrigen ?? '',
          description: room.descripcionCategoriaOrigen ?? ''
        });
      });
      stateCount.set(item.estadoOrigen, (stateCount.get(item.estadoOrigen) ?? 0) + 1);
    });
    this.tarifaMappings = [...tariffCount.entries()].map(([origen, lineas]) => ({
      origen,
      lineas,
      reservas: tariffReservations.get(origen)?.size ?? 0,
      codAgencia: '',
      codTarifa: '',
      codPlan: '',
      directo: 'N'
    }));
    this.categoryMappings = [...categoryCount.entries()].map(([origen, data]) => ({
      origen,
      codigoOrigen: data.code,
      descripcionOrigen: data.description,
      lineas: data.lines,
      catHabita: '',
      coincidencia: 'PENDIENTE'
    }));
    this.stateMappings = [...stateCount.entries()].map(([origen, cantidad]) => ({ origen, cantidad, estadoPms: '' }));
  }

  private validationCatalogs(): CatalogosValidacion {
    return {
      agencias: new Set(this.agencias.map((item) => item.codigo)),
      tarifas: new Set(this.tarifas.map((item) => item.codigo)),
      planes: new Set(this.planes.map((item) => item.codigo)),
      categorias: new Set(this.categorias.map((item) => item.CR01_CodCate)),
      tiposPorCategoria: new Map(
        [...this.tiposPorCategoria.entries()].map(([category, types]) => [
          category,
          new Set(types.map((item) => item.CR02_TipHabita))
        ])
      ),
      tiposPorCategoriaYPax: new Map(
        [...this.tiposPorCategoria.entries()].map(([category, types]) => {
          const byPax = new Map<number, Set<string>>();
          types.forEach((type) => {
            const pax = Number(type.CR02_NumPax);
            if (!byPax.has(pax)) byPax.set(pax, new Set());
            byPax.get(pax)?.add(type.CR02_TipHabita);
          });
          return [category, byPax];
        })
      )
    };
  }

  private hasPendingMapping(reserva: ReservaImportacion): boolean {
    return (
      !reserva.codAgencia ||
      !reserva.codTarifa ||
      !reserva.codPlan ||
      reserva.detalleHabitaciones.some((room) => !room.catHabita || !room.tipHabita)
    );
  }

  private applyAutomaticCategoryMappings(): void {
    if (!this.categoryMappings.length || !this.categorias.length) return;
    this.categoryMappings.forEach((mapping) => {
      if (mapping.catHabita) return;
      const matches = this.categorias.filter(
        (category) =>
          this.normalized(category.CR01_CodCate) === this.normalized(mapping.codigoOrigen ?? '') ||
          this.normalized(category.CR01_Categoria) === this.normalized(mapping.descripcionOrigen ?? '')
      );
      if (matches.length === 1) {
        mapping.catHabita = matches[0].CR01_CodCate;
        mapping.coincidencia = 'AUTOMATICA';
        this.updateCategoryMapping(mapping, false);
      }
    });
  }

  private determineRoomType(room: HabitacionImportacion): void {
    const matches = this.typesFor(room.catHabita).filter((type) => Number(type.CR02_NumPax) === Number(room.numPax));
    if (matches.length === 1) {
      room.tipHabita = matches[0].CR02_TipHabita;
    } else if (!matches.some((type) => type.CR02_TipHabita === room.tipHabita)) {
      room.tipHabita = '';
    }
  }

  private recalculateDerivedReservations(): void {
    this.reservas.forEach((reservation) => this.recalculateReservation(reservation));
  }

  private recalculateReservation(reserva: ReservaImportacion): void {
    this.applyHeaderTotalPriceDistribution(reserva);
    reserva.detalleHabitaciones.forEach((room, index) => {
      room.orden = index + 1;
      room.moneda = reserva.moneda;
      room.total = this.round(Number(room.cantHab || 0) * Number(room.precio || 0) * Number(reserva.noches || 0));
    });
    const lastRoom = reserva.detalleHabitaciones[reserva.detalleHabitaciones.length - 1];
    if (lastRoom) {
      const detailTotal = reserva.detalleHabitaciones.reduce((sum, room) => sum + Number(room.total || 0), 0);
      lastRoom.total = this.round(Number(lastRoom.total || 0) + this.round(Number(reserva.total) - detailTotal));
    }
    reserva.lineasHabitacion = reserva.detalleHabitaciones.length;
  }

  private async resolveExchangeRateForMapping(mapping: HomologacionTarifa): Promise<void> {
    const tariff = this.tarifas.find((item) => item.codigo === mapping.codTarifa);
    const currency = tariff?.moneda?.trim().toUpperCase() ?? '';
    if (!currency) {
      this.applyValidation();
      return;
    }
    try {
      let rate = 1;
      if (currency !== 'COL') {
        const operationalDate = await firstValueFrom(this.operationalDateService.ensureLoaded());
        const values = await firstValueFrom(this.exchangeRateService.fetchTipoCambio(operationalDate, currency.toLowerCase()));
        rate = Number(values[0]?.venta || values[0]?.compra || 0);
      }
      if (!Number.isFinite(rate) || rate <= 0) throw new Error(`No existe tipo de cambio para ${currency}.`);
      this.reservas
        .filter((item) => item.tarifaOrigen === mapping.origen && item.codTarifa === mapping.codTarifa)
        .forEach((item) => (item.tipoCambio = rate));
    } catch (error) {
      this.toast.warning(this.messageFromError(error));
    } finally {
      this.applyValidation();
    }
  }

  private resolveRoomPrices(reservations: ReservaImportacion[]): void {
    reservations.forEach((reservation) => {
      this.recalculateReservation(reservation);
    });
    this.applyValidation();
  }

  private applyHeaderTotalPriceDistribution(reservation: ReservaImportacion): void {
    reservation.parserAdvertencias = reservation.parserAdvertencias.filter(
      (warning) =>
        !warning.startsWith('No se encontró precio tarifario en todas las líneas;') &&
        !warning.startsWith('No se encontró precio tarifario;')
    );

    const nightlyPrice = calculateHeaderNightlyPrice(
      Number(reservation.total),
      reservation.detalleHabitaciones.length,
      Number(reservation.noches)
    );
    if (nightlyPrice === null) return;
    reservation.detalleHabitaciones.forEach((room) => (room.precio = nightlyPrice));
  }

  private normalized(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private applyApiResult(reserva: ReservaImportacion, response: ReservaHabitacionResponse): void {
    const responseText = `${response?.respuesta ?? ''} ${response?.mensaje ?? ''}`.trim();
    const functionalError = response?.ok === false || /\b(ERROR|FALLO|FAILED)\b/i.test(responseText);
    if (functionalError) {
      reserva.estadoImportacion = 'ERROR';
      reserva.mensajeImportacion = responseText || 'El backend rechazó la reserva.';
      return;
    }
    reserva.estadoImportacion = 'IMPORTADA';
    reserva.codReservaPms = String(response?.codReserva ?? response?.datos?.codReserva ?? '').trim();
    reserva.mensajeImportacion = response?.mensaje || response?.respuesta || 'Reserva creada correctamente.';
    reserva.seleccionado = false;
  }

  private async validateAvailability(reserva: ReservaImportacion): Promise<string> {
    const quantities = new Map<string, number>();
    reserva.detalleHabitaciones.forEach((room) => {
      quantities.set(room.catHabita, (quantities.get(room.catHabita) ?? 0) + Number(room.cantHab || 0));
    });
    const checks = [...quantities.entries()].map(([categoria, cantHab]) =>
      this.reservasService.consultarDisponibilidadCategoria({
        proceso: 1,
        fechaIni: reserva.fechaEntrada,
        fechaSal: reserva.fechaSalida,
        categoria,
        cantHab
      })
    );
    if (!checks.length) return 'La reserva no posee habitaciones para validar.';

    const results = await firstValueFrom(forkJoin(checks));
    const failed = results.find((result) => !result.success);
    if (failed) return failed.message || 'El backend no pudo validar la disponibilidad.';
    if (results.some((result) => result.totalFechasInsuficientes > 0 || result.data.length > 0)) {
      return 'La disponibilidad cambió: no hay suficientes habitaciones para una o más fechas del período.';
    }
    return '';
  }

  private messageFromError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      return String(body?.mensaje ?? body?.message ?? body?.respuesta ?? error.message ?? 'Error de comunicación con el backend.');
    }
    return error instanceof Error ? error.message : String(error ?? 'Error desconocido.');
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private extractDroppedFile(dataTransfer: DataTransfer | null): File | null {
    if (!dataTransfer) return null;
    if (dataTransfer.files?.length) return dataTransfer.files.item(0);
    const fileItem = Array.from(dataTransfer.items ?? []).find((item) => item.kind === 'file');
    return fileItem?.getAsFile() ?? null;
  }
}
