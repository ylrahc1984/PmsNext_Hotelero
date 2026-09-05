import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { GuestIdentityDocument, RoomingListGuest } from '../check-in-arrivals/models/check-in-arrival.model';
import { CheckInArrivalsService } from '../check-in-arrivals/services/check-in-arrivals.service';
import { GuestIdentityDocumentService } from '../check-in-arrivals/services/guest-identity-document.service';
import {
  InHouseGuest,
  InHouseKpi,
  InHouseResponse,
  InHouseSortColumn,
  InHouseSortDirection
} from './models/in-house-guest.model';
import { InHouseGuestsService } from './services/in-house-guests.service';

interface InHouseFilterForm {
  fechaIni: string;
  fechaFin: string;
  busqueda: string;
  estado: string;
  plan: string;
  agencia: string;
}

interface PaginationOption {
  label: string;
  value: number;
}

interface OccupancyQuickItem {
  label: string;
  value: number;
  className: string;
}

interface TimelineItem {
  time: string;
  title: string;
  detail: string;
  accent: 'primary' | 'green' | 'amber' | 'burgundy';
}

interface InHouseGuestPassportRow {
  roomingGuest: RoomingListGuest;
  document: GuestIdentityDocument | null;
  loading: boolean;
  error: string;
  viewing: boolean;
}

@Component({
  selector: 'app-in-house-guests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './in-house-guests.component.html',
  styleUrls: ['./in-house-guests.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InHouseGuestsComponent implements OnInit, OnDestroy {
  private readonly inHouseService = inject(InHouseGuestsService);
  private readonly roomingService = inject(CheckInArrivalsService);
  private readonly documentService = inject(GuestIdentityDocumentService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  readonly pageSizeOptions: PaginationOption[] = [
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 }
  ];

  readonly columns: { label: string; key: InHouseSortColumn }[] = [
    { label: 'Habitacion', key: 'numHabita' },
    { label: 'Huespedes', key: 'paxIn' },
    { label: 'Agencia', key: 'nomAgencia' },
    { label: 'Entrada', key: 'fechaIng' },
    { label: 'Salida', key: 'fechaSal' },
    { label: 'Noches', key: 'noches' },
    { label: 'Adultos', key: 'numPax' },
    { label: 'Ninos', key: 'numChild' },
    { label: 'Plan', key: 'plan' },
    { label: 'Estado', key: 'estado' },
    { label: 'Reserva', key: 'codReserva' }
  ];

  readonly occupancyQuickItems: OccupancyQuickItem[] = [
    { label: 'Ocupadas', value: 68, className: 'occupancy-segment--busy' },
    { label: 'Salidas', value: 12, className: 'occupancy-segment--departure' },
    { label: 'Llegadas', value: 18, className: 'occupancy-segment--arrival' },
    { label: 'Disponibles', value: 42, className: 'occupancy-segment--available' }
  ];

  readonly timelineItems: TimelineItem[] = [
    { time: '08:00', title: 'Revision de desayunos', detail: 'Validar planes CP y MAP activos.', accent: 'primary' },
    { time: '11:00', title: 'Extensiones pendientes', detail: 'Habitaciones con salida proxima.', accent: 'amber' },
    { time: '14:00', title: 'Room status operativo', detail: 'Cruce visual con Room Rack.', accent: 'green' },
    { time: '18:00', title: 'Cierre de novedades', detail: 'Confirmar cambios del dia.', accent: 'burgundy' }
  ];

  readonly filtersForm = this.fb.nonNullable.group<InHouseFilterForm>({
    fechaIni: this.formatDateInput(new Date()),
    fechaFin: this.formatDateInput(new Date()),
    busqueda: '',
    estado: 'Todos',
    plan: 'Todos',
    agencia: 'Todas'
  });

  response: InHouseResponse = this.emptyResponse();
  guests: InHouseGuest[] = [];
  filteredGuests: InHouseGuest[] = [];
  pagedGuests: InHouseGuest[] = [];
  kpis: InHouseKpi[] = [];
  selectedGuest: InHouseGuest | null = null;

  loading = false;
  reloading = false;
  errorMessage = '';
  page = 1;
  pageSize = 10;
  totalPages = 1;
  sortColumn: InHouseSortColumn = 'numHabita';
  sortDirection: InHouseSortDirection = 'asc';
  passportRows: InHouseGuestPassportRow[] = [];
  passportLoading = false;
  passportError = '';
  passportViewerUrl = '';
  passportViewerTitle = '';
  private passportViewerObjectUrl = '';
  private passportLoadId = 0;

  ngOnInit(): void {
    this.buscar();
  }

  ngOnDestroy(): void {
    this.closePassportViewer();
  }

  buscar(): void {
    const filters = this.filtersForm.getRawValue();

    this.loading = this.guests.length === 0;
    this.reloading = this.guests.length > 0;
    this.errorMessage = '';

    this.inHouseService
      .getInHouseGuests(this.formatDateApi(filters.fechaIni), this.formatDateApi(filters.fechaFin), 'carga')
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar la lista de huespedes In House.', error);
          this.errorMessage = 'No se pudo cargar la lista de huespedes In House.';
          return of(this.emptyResponse());
        }),
        finalize(() => {
          this.loading = false;
          this.reloading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.response = this.normalizeResponse(response);
        this.guests = this.response.pax;
        this.selectedGuest = this.guests[0] ?? null;
        this.page = 1;
        this.refreshView();
        this.loadPassportsForSelectedGuest();
      });
  }

  limpiar(): void {
    this.filtersForm.setValue({
      fechaIni: this.formatDateInput(new Date()),
      fechaFin: this.formatDateInput(new Date()),
      busqueda: '',
      estado: 'Todos',
      plan: 'Todos',
      agencia: 'Todas'
    });
    this.buscar();
  }

  aplicarBusqueda(): void {
    this.page = 1;
    this.refreshView();
  }

  seleccionarGuest(guest: InHouseGuest): void {
    this.selectedGuest = guest;
    this.loadPassportsForSelectedGuest();
  }

  ordenar(column: InHouseSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.refreshView();
  }

  cambiarPageSize(value: string): void {
    this.pageSize = Number(value) || 10;
    this.page = 1;
    this.refreshView();
  }

  paginaAnterior(): void {
    if (this.page <= 1) {
      return;
    }

    this.page -= 1;
    this.refreshPage();
  }

  paginaSiguiente(): void {
    if (this.page >= this.totalPages) {
      return;
    }

    this.page += 1;
    this.refreshPage();
  }

  getSortIcon(column: InHouseSortColumn): string {
    if (this.sortColumn !== column) {
      return 'unfold_more';
    }

    return this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  getRangeLabel(): string {
    if (this.filteredGuests.length === 0) {
      return '0 de 0';
    }

    const start = (this.page - 1) * this.pageSize + 1;
    const end = Math.min(this.page * this.pageSize, this.filteredGuests.length);
    return `${start}-${end} de ${this.filteredGuests.length}`;
  }

  isSelected(guest: InHouseGuest): boolean {
    return !!this.selectedGuest && this.getGuestKey(this.selectedGuest) === this.getGuestKey(guest);
  }

  getGuestNames(guest: InHouseGuest | null): string[] {
    if (!guest) {
      return [];
    }

    return guest.paxIn
      .split('/')
      .map((name) => this.toTitleCase(name.trim()))
      .filter(Boolean);
  }

  getVisibleGuestNames(guest: InHouseGuest): string[] {
    return this.getGuestNames(guest).slice(0, 3);
  }

  getHiddenGuestCount(guest: InHouseGuest): number {
    return Math.max(0, this.getGuestNames(guest).length - 3);
  }

  getPlanCode(guest: InHouseGuest | null): 'AI' | 'MAP' | 'CP' | 'RO' {
    if (!guest) {
      return 'RO';
    }

    if (this.isYes(guest.fullPen)) {
      return 'AI';
    }

    if (this.isYes(guest.media)) {
      return 'MAP';
    }

    if (this.isYes(guest.desayuno)) {
      return 'CP';
    }

    return 'RO';
  }

  getPlanBadgeClass(guest: InHouseGuest | null): string {
    const classes = {
      AI: 'text-bg-primary',
      MAP: 'text-bg-success',
      CP: 'text-bg-info',
      RO: 'text-bg-secondary'
    };

    return classes[this.getPlanCode(guest)];
  }

  getAgenciaOptions(): string[] {
    return [...new Set(this.guests.map((guest) => guest.nomAgencia).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    );
  }

  formatDisplayDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || '-';
  }

  getPassportGuestName(row: InHouseGuestPassportRow): string {
    const guest = row.roomingGuest;
    return this.toTitleCase(`${guest.nombre || ''} ${guest.apellidos || ''}`.trim()) || 'Huesped';
  }

  getPassportGuestDocument(row: InHouseGuestPassportRow): string {
    const guest = row.roomingGuest;
    const parts = [guest.tipDocu, guest.numDocu].map((value) => this.toStringValue(value)).filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Sin documento personal';
  }

  getPassportDocumentMeta(row: InHouseGuestPassportRow): string {
    const document = row.document;
    if (!document) return 'Sin pasaporte registrado';
    const parts = [
      document.nombreArchivo,
      this.formatFileSize(document.tamanoBytes),
      this.formatDocumentDate(document.fechaModificacion || document.fechaCreacion)
    ].filter(Boolean);
    return parts.join(' · ');
  }

  viewPassport(row: InHouseGuestPassportRow): void {
    const idDocumento = row.document?.idDocumento;
    if (!idDocumento || row.viewing) return;

    row.viewing = true;
    this.documentService.getContent(idDocumento).pipe(
      finalize(() => {
        row.viewing = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (blob) => {
        this.closePassportViewer();
        this.passportViewerObjectUrl = URL.createObjectURL(blob);
        this.passportViewerUrl = this.passportViewerObjectUrl;
        this.passportViewerTitle = `${this.getPassportGuestName(row)} · Pasaporte`;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('No se pudo visualizar el pasaporte del huesped.', error);
        this.toast.error('No fue posible visualizar el pasaporte del huesped.');
      }
    });
  }

  closePassportViewer(): void {
    if (this.passportViewerObjectUrl) URL.revokeObjectURL(this.passportViewerObjectUrl);
    this.passportViewerObjectUrl = '';
    this.passportViewerUrl = '';
    this.passportViewerTitle = '';
  }

  cambiarHabitacion(item: InHouseGuest): void {
    console.log('Cambiar Habitacion', item);
  }

  agregarConsumo(item: InHouseGuest): void {
    console.log('Agregar Consumo', item);
  }

  verCuenta(item: InHouseGuest): void {
    console.log('Ver Cuenta', item);
  }

  extenderEstadia(item: InHouseGuest): void {
    console.log('Extender Estadia', item);
  }

  agregarAcompanante(item: InHouseGuest): void {
    console.log('Agregar Acompanante', item);
  }

  editarHuesped(item: InHouseGuest): void {
    console.log('Editar Huesped', item);
  }

  imprimirHoja(item: InHouseGuest): void {
    console.log('Imprimir Hoja', item);
  }

  verReserva(item: InHouseGuest): void {
    console.log('Ver Reserva', item);
  }

  checkOut(item: InHouseGuest): void {
    console.log('Check Out', item);
  }

  volverRoomRack(): void {
    this.router.navigate(['/front-desk/room-rack']);
  }

  trackByGuest(_: number, guest: InHouseGuest): string {
    return this.getGuestKey(guest);
  }

  trackByKpi(_: number, kpi: InHouseKpi): string {
    return kpi.label;
  }

  trackByColumn(_: number, column: { key: InHouseSortColumn }): string {
    return column.key;
  }

  trackByName(_: number, name: string): string {
    return name;
  }

  trackByOccupancy(_: number, item: OccupancyQuickItem): string {
    return item.label;
  }

  trackByTimeline(_: number, item: TimelineItem): string {
    return `${item.time}-${item.title}`;
  }

  private refreshView(): void {
    this.filteredGuests = this.sortGuests(this.filterGuests(this.guests));
    this.kpis = this.buildKpis(this.filteredGuests);
    this.totalPages = Math.max(1, Math.ceil(this.filteredGuests.length / this.pageSize));
    this.page = Math.min(this.page, this.totalPages);
    this.refreshPage();
    this.syncSelectedGuest();
  }

  private refreshPage(): void {
    const start = (this.page - 1) * this.pageSize;
    this.pagedGuests = this.filteredGuests.slice(start, start + this.pageSize);
  }

  private syncSelectedGuest(): void {
    if (!this.selectedGuest) {
      this.selectedGuest = this.filteredGuests[0] ?? null;
      return;
    }

    const selectedKey = this.getGuestKey(this.selectedGuest);
    this.selectedGuest = this.filteredGuests.find((guest) => this.getGuestKey(guest) === selectedKey) ?? this.filteredGuests[0] ?? null;
  }

  private loadPassportsForSelectedGuest(): void {
    this.closePassportViewer();
    const selected = this.selectedGuest;
    const loadId = ++this.passportLoadId;
    this.passportRows = [];
    this.passportError = '';

    if (!selected?.codReserva || !selected?.numHabita) {
      this.passportLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.passportLoading = true;
    this.roomingService.getRoomingList(selected.codReserva, selected.numHabita).pipe(
      catchError((error) => {
        console.error('No se pudo cargar el rooming list para pasaportes.', error);
        this.passportError = 'No fue posible consultar los pasaportes de esta habitacion.';
        return of([] as RoomingListGuest[]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((roomingGuests) => {
      if (loadId !== this.passportLoadId) return;
      this.passportRows = roomingGuests.map((roomingGuest) => ({
        roomingGuest,
        document: null,
        loading: true,
        error: '',
        viewing: false
      }));

      if (!this.passportRows.length) {
        this.passportLoading = false;
        this.cdr.markForCheck();
        return;
      }

      forkJoin(
        this.passportRows.map((row) =>
          this.documentService.getByRooming(row.roomingGuest.numInterno).pipe(
            catchError((error) => {
              console.error('No se pudo cargar la metadata del pasaporte.', error);
              row.error = 'No fue posible verificar el documento.';
              return of(null);
            })
          )
        )
      ).pipe(
        finalize(() => {
          if (loadId === this.passportLoadId) {
            this.passportLoading = false;
            this.passportRows.forEach((row) => row.loading = false);
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe((documents) => {
        if (loadId !== this.passportLoadId) return;
        this.passportRows = this.passportRows.map((row, index) => ({ ...row, document: documents[index] }));
      });
    });
  }

  private filterGuests(guests: InHouseGuest[]): InHouseGuest[] {
    const term = this.normalizeText(this.filtersForm.controls.busqueda.value);
    const plan = this.filtersForm.controls.plan.value;
    const agencia = this.filtersForm.controls.agencia.value;

    return guests.filter((guest) => {
      if (plan !== 'Todos' && this.getPlanCode(guest) !== plan) {
        return false;
      }

      if (agencia !== 'Todas' && guest.nomAgencia !== agencia) {
        return false;
      }

      if (!term) {
        return true;
      }

      const searchable = [
        guest.numHabita,
        guest.paxIn,
        guest.codReserva,
        guest.nomAgencia
      ].map((value) => this.normalizeText(value));

      return searchable.some((value) => value.includes(term));
    });
  }

  private sortGuests(guests: InHouseGuest[]): InHouseGuest[] {
    return [...guests].sort((left, right) => {
      const leftValue = this.getSortValue(left, this.sortColumn);
      const rightValue = this.getSortValue(right, this.sortColumn);
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });

      return this.sortDirection === 'asc' ? result : result * -1;
    });
  }

  private getSortValue(guest: InHouseGuest, column: InHouseSortColumn): string {
    if (column === 'plan') {
      return this.getPlanCode(guest);
    }

    if (column === 'estado') {
      return 'Hospedado';
    }

    if (column === 'fechaIng' || column === 'fechaSal') {
      return toPmsDateInputValue(guest[column]);
    }

    const value = guest[column];
    return value == null ? '' : String(value);
  }

  private buildKpis(guests: InHouseGuest[]): InHouseKpi[] {
    return [
      { label: 'Habitaciones', value: this.countRooms(guests), icon: 'hotel', accent: 'primary' },
      { label: 'Adultos', value: this.sumNumeric(guests, 'numPax'), icon: 'groups', accent: 'blue' },
      { label: 'Ninos', value: this.sumNumeric(guests, 'numChild'), icon: 'child_care', accent: 'burgundy' },
      { label: 'Total Huespedes', value: this.sumNumeric(guests, 'numPax') + this.sumNumeric(guests, 'numChild'), icon: 'diversity_3', accent: 'green' },
      { label: 'Desayunos incluidos', value: this.countYes(guests, 'desayuno'), icon: 'free_breakfast', accent: 'amber' },
      { label: 'Media Pension', value: this.countYes(guests, 'media'), icon: 'restaurant', accent: 'cyan' },
      { label: 'Pension Completa', value: this.countYes(guests, 'fullPen'), icon: 'room_service', accent: 'muted' }
    ];
  }

  private countRooms(guests: InHouseGuest[]): number {
    return new Set(guests.map((guest) => guest.numHabita).filter(Boolean)).size;
  }

  private sumNumeric(guests: InHouseGuest[], key: 'numPax' | 'numChild'): number {
    return guests.reduce((total, guest) => total + (Number(guest[key]) || 0), 0);
  }

  private countYes(guests: InHouseGuest[], key: 'desayuno' | 'media' | 'fullPen'): number {
    return guests.filter((guest) => this.isYes(guest[key])).length;
  }

  private normalizeResponse(response: InHouseResponse): InHouseResponse {
    const pax = (response.pax ?? []).map((guest) => this.normalizeGuest(guest));
    return {
      pax,
      totalHabitaciones: Number(response.totalHabitaciones) || this.countRooms(pax),
      totalAdultos: Number(response.totalAdultos) || this.sumNumeric(pax, 'numPax'),
      totalNinos: Number(response.totalNinos) || this.sumNumeric(pax, 'numChild'),
      totalHuespedes: Number(response.totalHuespedes) || this.sumNumeric(pax, 'numPax') + this.sumNumeric(pax, 'numChild'),
      respuesta: this.toStringValue(response.respuesta)
    };
  }

  private normalizeGuest(guest: InHouseGuest): InHouseGuest {
    return {
      numHabita: this.toStringValue(guest.numHabita),
      paxIn: this.toStringValue(guest.paxIn),
      fechaIng: normalizePmsDateDDMMYYYY(guest.fechaIng),
      fechaSal: normalizePmsDateDDMMYYYY(guest.fechaSal),
      noches: Number(guest.noches) || 0,
      desayuno: this.toStringValue(guest.desayuno),
      media: this.toStringValue(guest.media),
      fullPen: this.toStringValue(guest.fullPen),
      numPax: Number(guest.numPax) || 0,
      numChild: Number(guest.numChild) || 0,
      varios: this.toStringValue(guest.varios),
      codReserva: this.toStringValue(guest.codReserva),
      nomAgencia: this.toStringValue(guest.nomAgencia)
    };
  }

  private getGuestKey(guest: InHouseGuest): string {
    return `${guest.numHabita}-${guest.codReserva}-${guest.paxIn}`;
  }

  private emptyResponse(): InHouseResponse {
    return {
      pax: [],
      totalHabitaciones: 0,
      totalAdultos: 0,
      totalNinos: 0,
      totalHuespedes: 0,
      respuesta: ''
    };
  }

  private isYes(value: string): boolean {
    return this.normalizeText(value) === 'si';
  }

  private toTitleCase(value: string): string {
    return value
      .toLocaleLowerCase('es')
      .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'));
  }

  private toStringValue(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }

  private formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private formatDocumentDate(value: string): string {
    if (!value) return '';
    const normalized = value.includes('/') ? value.split('/').reverse().join('-') : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private formatDateInput(date: Date): string {
    return toPmsDateInputValue(date);
  }

  private formatDateApi(value: string): string {
    return normalizePmsDateDDMMYYYY(value);
  }
}
