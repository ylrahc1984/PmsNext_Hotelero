import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  signal
} from '@angular/core';
import { finalize, Subscription } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { CalendarReservation } from '../../interfaces/calendar.interface';
import {
  ReservationCompleteDisplayEntry,
  ReservationCompleteRecord,
  ReservationCompleteResponse
} from './reservation-complete.model';
import { ReservationCompleteService } from './reservation-complete.service';

const BREAKDOWN_HIDDEN_FIELDS = new Set([
  'prV06_Orden',
  'prV06_HabOrigen',
  'prV06_Operador',
  'prV06_Cpl',
  'prV06_TipHabita'
]);

const BREAKDOWN_FIELD_ORDER = [
  'prV06_NumHabita',
  'prV06_CatHabita',
  'prV06_FechaIng',
  'prV06_FechaSal',
  'prV06_NumPax',
  'prV06_NumChild',
  'prV06_Procesado'
];

@Component({
  selector: 'app-reservation-calendar-detail-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-calendar-detail-panel.component.html',
  styleUrls: ['./reservation-calendar-detail-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationCalendarDetailPanelComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) reservation!: CalendarReservation;
  @Input() canEdit = false;
  @Input() canAssign = false;
  @Input() canMoveToTray = false;
  @Input() canUnassign = false;

  @Output() closed = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<void>();
  @Output() assignRequested = new EventEmitter<void>();
  @Output() moveToTrayRequested = new EventEmitter<void>();
  @Output() unassignRequested = new EventEmitter<void>();

  readonly detail = signal<ReservationCompleteResponse | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  private request?: Subscription;

  constructor(private readonly reservationCompleteService: ReservationCompleteService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reservation']) {
      this.loadDetail();
    }
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  retry(): void {
    this.loadDetail();
  }

  requestMoveToTray(): void {
    this.moveToTrayRequested.emit();
  }

  requestUnassign(): void {
    if (this.canUnassign) {
      this.unassignRequested.emit();
    }
  }

  requestEdit(): void {
    if (this.canEditReservation()) {
      this.editRequested.emit();
    }
  }

  requestAssign(): void {
    if (this.canAssign) {
      this.assignRequested.emit();
    }
  }

  canEditReservation(): boolean {
    const state = (
      this.detail()?.encabezado?.['prV01_Estado']?.toString() ||
      this.reservation?.reservationState ||
      ''
    ).trim().toUpperCase();

    return this.canEdit && !!this.reservation?.reservationCode?.trim() && !['CHK', 'ANU'].includes(state);
  }

  entries(record: ReservationCompleteRecord | null | undefined): ReservationCompleteDisplayEntry[] {
    if (!record) {
      return [];
    }

    return Object.entries(record).map(([key, value]) => ({
      key,
      label: this.fieldLabel(key),
      value: this.formatValue(key, value),
      wide: /descripcion|observacion|comentario|rooming|email|direccion/i.test(key)
    }));
  }

  records(value: ReservationCompleteRecord[] | null | undefined): ReservationCompleteRecord[] {
    return Array.isArray(value) ? value : [];
  }

  breakdownEntries(record: ReservationCompleteRecord): ReservationCompleteDisplayEntry[] {
    return this.entries(record)
      .filter((entry) => !BREAKDOWN_HIDDEN_FIELDS.has(entry.key))
      .sort((left, right) => {
        const leftIndex = BREAKDOWN_FIELD_ORDER.indexOf(left.key);
        const rightIndex = BREAKDOWN_FIELD_ORDER.indexOf(right.key);
        return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
      });
  }

  trackEntry(_: number, entry: ReservationCompleteDisplayEntry): string {
    return entry.key;
  }

  trackRecord(index: number): number {
    return index;
  }

  reservationStateLabel(): string {
    const state = this.detail()?.encabezado?.['prV01_Estado']?.toString().trim() || this.reservation.reservationState || this.reservation.status;
    const labels: Record<string, string> = {
      ABI: 'Abierta',
      CON: 'Confirmada',
      CCR: 'Confirmada',
      CHK: 'Check-in',
      OUT: 'Check-out',
      ANU: 'Anulada'
    };
    return labels[state.toUpperCase()] || state;
  }

  reservationDescription(): string {
    return this.detail()?.encabezado?.['prV01_Descripcion']?.toString().trim() || this.reservation.guestName;
  }

  agencyName(): string {
    return this.detail()?.encabezado?.['mR01_NomAgencia']?.toString().trim() || this.reservation.source || 'Directo';
  }

  roomNumberLabel(): string {
    return this.reservation?.roomNumber?.trim()
      || this.findRoomDetailValue('prV06_NumHabita')
      || 'Sin asignar';
  }

  roomCategoryLabel(): string {
    return this.reservation?.categoryCode?.trim()
      || this.findRoomDetailValue('prV06_CatHabita')
      || this.findRoomDetailValue('prV02_CatHabita')
      || 'Sin categoría';
  }

  arrivalDateLabel(): string {
    return this.summaryDate('prV01_FecIngresa', this.reservation.startDate);
  }

  departureDateLabel(): string {
    return this.summaryDate('prV01_FecSalida', this.reservation.endDate);
  }

  totalLabel(): string {
    const header = this.detail()?.encabezado;
    const total = Number(header?.['prV01_TotalRsv'] ?? 0);
    const currency = header?.['prV01_Moneda']?.toString().trim() || '';
    return `${currency} ${Number.isFinite(total) ? total.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`.trim();
  }

  private loadDetail(): void {
    const reservationCode = this.reservation?.reservationCode?.trim();
    this.request?.unsubscribe();
    this.detail.set(null);
    this.errorMessage.set('');

    if (!reservationCode) {
      this.loading.set(false);
      this.errorMessage.set('La reserva seleccionada no tiene un código válido para consultar el detalle completo.');
      return;
    }

    this.loading.set(true);
    this.request = this.reservationCompleteService
      .getByReservationCode(reservationCode)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.detail.set(this.normalizeResponse(response)),
        error: (error) => {
          console.error('[RoomCalendar][RESERVATION_COMPLETE][HTTP_ERROR] No fue posible cargar el detalle completo.', {
            reservationCode,
            status: error?.status ?? null,
            statusText: error?.statusText ?? null,
            url: error?.url ?? null,
            backend: error?.error ?? null,
            rawError: error
          });
          this.errorMessage.set(this.resolveErrorMessage(error));
        }
      });
  }

  private summaryDate(key: string, fallback: string): string {
    const value = this.detail()?.encabezado?.[key]?.toString().trim() || fallback;
    return normalizePmsDateDDMMYYYY(value) || value || '—';
  }

  private findRoomDetailValue(key: string): string {
    const completeDetail = this.detail();
    const records = [
      ...(completeDetail?.desgloseHabitaciones ?? []),
      ...(completeDetail?.detalleHabitaciones ?? [])
    ];

    for (const record of records) {
      const value = record?.[key]?.toString().trim();
      if (value) {
        return value;
      }
    }

    return '';
  }

  private normalizeResponse(response: ReservationCompleteResponse | null | undefined): ReservationCompleteResponse {
    return {
      encabezado: response?.encabezado && typeof response.encabezado === 'object' ? response.encabezado : null,
      detalleHabitaciones: Array.isArray(response?.detalleHabitaciones) ? response.detalleHabitaciones : [],
      serviciosIncluidos: Array.isArray(response?.serviciosIncluidos) ? response.serviciosIncluidos : [],
      serviciosAdicionales: Array.isArray(response?.serviciosAdicionales) ? response.serviciosAdicionales : [],
      desgloseHabitaciones: Array.isArray(response?.desgloseHabitaciones) ? response.desgloseHabitaciones : []
    };
  }

  private resolveErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return 'No fue posible consultar el detalle completo de la reserva.';
    }

    const httpError = error as { error?: unknown; message?: string; status?: number };
    if (httpError.error && typeof httpError.error === 'object') {
      const apiError = httpError.error as { message?: string; mensaje?: string; detail?: string };
      return apiError.message || apiError.mensaje || apiError.detail || `No fue posible consultar el detalle. Código HTTP ${httpError.status || 0}.`;
    }

    return httpError.message || 'No fue posible consultar el detalle completo de la reserva.';
  }

  private fieldLabel(key: string): string {
    const labels: Record<string, string> = {
      prV01_CodReserva: 'Código de reserva',
      prV01_CodAgencia: 'Código de agencia',
      mR01_NomAgencia: 'Agencia',
      prV01_CodTarifa: 'Código de tarifa',
      mR03_NomTarifa: 'Tarifa',
      prV01_CodPlan: 'Código de plan',
      mR06_PlanAlimenticio: 'Plan alimenticio',
      prV01_FecIngresa: 'Fecha de ingreso',
      prV01_FecSalida: 'Fecha de salida',
      prV01_FecCreacion: 'Fecha de creación',
      prV01_FecConfirma: 'Fecha de confirmación',
      prV01_FecPrepago: 'Fecha de prepago',
      prV01_FecAnulada: 'Fecha de anulación',
      prV01_TotNoches: 'Noches',
      prV01_TotDias: 'Días',
      prV01_Descripcion: 'Descripción',
      prV01_TCambio: 'Tipo de cambio',
      prV01_Folio: 'Folio',
      prV01_Estado: 'Estado',
      prV01_Moneda: 'Moneda',
      prV01_TotalRsv: 'Total de reserva',
      prV01_Observacion: 'Observación',
      prV01_Procesado: 'Procesado',
      prV01_Directo: 'Reserva directa',
      prV01_Operador: 'Operador',
      prV02_CatHabita: 'Categoría',
      prV02_TipHabita: 'Tipo de habitación',
      prV02_CantHab: 'Cantidad de habitaciones',
      prV02_Precio: 'Precio',
      prV02_Moneda: 'Moneda',
      prV02_PorDesc: 'Porcentaje de descuento',
      prV02_Total: 'Total',
      prV02_Cpl: 'Complemento',
      prV02_Impuesto: 'Impuesto',
      prV02_NumPax: 'Adultos',
      prV02_NumChild: 'Niños',
      prV02_TotChild: 'Total niños',
      prV02_CCosto: 'Centro de costo',
      prV02_Orden: 'Orden',
      prV02_Operador: 'Operador',
      prV06_NumHabita: 'Habitación asignada',
      prV06_CatHabita: 'Categoría',
      prV06_TipHabita: 'Tipo de habitación',
      prV06_FechaIng: 'Fecha de ingreso',
      prV06_FechaSal: 'Fecha de salida',
      prV06_Procesado: 'Procesado',
      prV06_NumPax: 'Adultos',
      prV06_NumChild: 'Niños',
      prV06_Cpl: 'Complemento',
      prV06_Orden: 'Orden',
      prV06_HabOrigen: 'Habitación origen',
      prV06_Operador: 'Operador'
    };

    if (labels[key]) {
      return labels[key];
    }

    return key
      .replace(/^[a-z]{2}V\d+_/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^./, (value) => value.toUpperCase());
  }

  private formatValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (typeof value === 'string') {
      const cleanValue = value.trim();
      if (/fec|fecha/i.test(key)) {
        return normalizePmsDateDDMMYYYY(cleanValue) || cleanValue;
      }
      return this.maskSensitiveSequences(cleanValue);
    }

    if (typeof value === 'number') {
      return value.toLocaleString('es-CR', { maximumFractionDigits: 2 });
    }

    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    return this.maskSensitiveSequences(JSON.stringify(value));
  }

  private maskSensitiveSequences(value: string): string {
    return value.replace(/\b(\d{4})\d{5,11}(\d{4})\b/g, '$1********$2');
  }
}
