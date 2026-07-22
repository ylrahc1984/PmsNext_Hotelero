import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, distinctUntilChanged, finalize, forkJoin, of } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import {
  ReservationPrepayment,
  ReservationPrepaymentMode,
  ReservationPrepaymentSummary
} from './models/reservation-prepayment.model';
import { ReservationPrepaymentsService } from './services/reservation-prepayments.service';

interface ReservationPrepaymentForm {
  fechaDepo: FormControl<string>;
  fechaReg: FormControl<string>;
  concepto: FormControl<string>;
  frmPago: FormControl<string>;
  moneda: FormControl<string>;
  tCambio: FormControl<number>;
  totalPrepa: FormControl<number>;
  nOperacion: FormControl<string>;
  numTarjeta: FormControl<string>;
  venTarjeta: FormControl<string>;
  codSeguridad: FormControl<string>;
  tipTarjeta: FormControl<string>;
  cCosto: FormControl<string>;
}

interface MoneyCard {
  label: string;
  value: number;
  currency: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
}

@Component({
  selector: 'app-reservation-prepayments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservation-prepayments.component.html',
  styleUrls: ['./reservation-prepayments.component.scss']
})
export class ReservationPrepaymentsComponent implements OnInit, OnChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(ReservationPrepaymentsService);
  private readonly monedaService = inject(MonedaService);
  private readonly tipoCambioService = inject(TipoCambioService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() reserva: ReservationPrepaymentSummary | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();

  readonly form: FormGroup<ReservationPrepaymentForm> = this.fb.group({
    fechaDepo: this.fb.control(this.todayIso(), { validators: [Validators.required] }),
    fechaReg: this.fb.control(this.todayIso(), { validators: [Validators.required] }),
    concepto: this.fb.control('', { validators: [Validators.required, Validators.maxLength(160)] }),
    frmPago: this.fb.control('', { validators: [Validators.required] }),
    moneda: this.fb.control('', { validators: [Validators.required] }),
    tCambio: this.fb.control(1, { validators: [Validators.required, Validators.min(0.0001)] }),
    totalPrepa: this.fb.control(0, { validators: [Validators.required, Validators.min(0.01)] }),
    nOperacion: this.fb.control('', { validators: [Validators.maxLength(60)] }),
    numTarjeta: this.fb.control('', { validators: [Validators.maxLength(30)] }),
    venTarjeta: this.fb.control('', { validators: [Validators.maxLength(10)] }),
    codSeguridad: this.fb.control('', { validators: [Validators.maxLength(8)] }),
    tipTarjeta: this.fb.control('', { validators: [Validators.maxLength(30)] }),
    cCosto: this.fb.control('', { validators: [Validators.maxLength(80)] })
  });

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly mode = signal<ReservationPrepaymentMode>('new');
  readonly selectedPrepayment = signal<ReservationPrepayment | null>(null);
  readonly prepayments = signal<ReservationPrepayment[]>([]);
  readonly monedas = signal<MonedaUI[]>([]);
  readonly formasPago = signal<FormaPago[]>([]);
  readonly submitted = signal(false);
  readonly conversionAmount = signal(0);
  readonly projectedBalance = signal(0);

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isViewing = computed(() => this.mode() === 'view');
  readonly modalTitle = computed(() => (this.isEditing() ? 'Editar Prepago' : this.isViewing() ? 'Consultar Prepago' : 'Administración de Prepagos'));
  readonly submitLabel = computed(() => (this.isEditing() ? 'Actualizar Prepago' : 'Guardar Prepago'));
  readonly conversionVisible = computed(() => this.normalizeCurrency(this.form.controls.moneda.value) !== this.reservationCurrency());
  readonly reservationCurrency = computed(() => this.normalizeCurrency(this.reserva?.moneda || 'USD'));
  readonly totalPrepaid = computed(() => this.roundMoney(this.prepayments().reduce((sum, item) => sum + this.toReservationCurrency(item), 0)));
  readonly pendingBalance = computed(() => this.roundMoney(Math.max(this.totalReservation() - this.totalPrepaid(), 0)));
  readonly cards = computed<MoneyCard[]>(() => [
    { label: 'Total Reserva', value: this.totalReservation(), currency: this.reservationCurrency(), icon: 'bi-receipt', tone: 'primary' },
    { label: 'Total Prepagado', value: this.totalPrepaid(), currency: this.reservationCurrency(), icon: 'bi-wallet2', tone: 'success' },
    { label: 'Saldo Pendiente', value: this.pendingBalance(), currency: this.reservationCurrency(), icon: 'bi-cash-coin', tone: 'warning' },
    { label: 'Moneda Reserva', value: 0, currency: this.reservationCurrency(), icon: 'bi-currency-exchange', tone: 'neutral' }
  ]);

  errorMessage = '';

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.applyPaymentMethodValidators();
      this.updateMoneyPreview();
    });
    this.form.controls.moneda.valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncExchangeRate());
    this.form.controls.fechaDepo.valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncExchangeRate());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true && this.reserva) {
      this.initializeModal();
    }
  }

  onClose(): void {
    if (this.saving()) {
      return;
    }
    this.close.emit();
  }

  async guardar(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.updateMoneyPreview();

    const validationMessage = this.getSubmitValidationMessage();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      return;
    }

    const payload = this.buildPayload(this.isEditing() ? 2 : 1);
    const confirmation = await Swal.fire({
      title: this.isEditing() ? 'Actualizar prepago' : 'Guardar prepago',
      html: `¿Está seguro de ${this.isEditing() ? 'actualizar' : 'registrar'} este prepago por <strong>${this.moneySymbol(payload.moneda)} ${payload.totalPrepa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.isEditing() ? 'Sí, actualizar' : 'Sí, guardar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d'
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const request$ = this.isEditing() ? this.service.actualizar(payload) : this.service.guardar(payload);
    this.saving.set(true);
    this.errorMessage = '';

    request$
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (response) => {
          if (!this.isSuccessfulResponse(response)) {
            this.errorMessage = response.respuesta || response.mensaje || 'El endpoint no confirmó la operación.';
            return;
          }

          await Swal.fire({
            title: this.isEditing() ? 'Actualización completada' : 'Registro completado',
            text: response?.respuesta || response?.mensaje || 'El prepago fue procesado correctamente.',
            icon: 'success',
            timer: 1400,
            showConfirmButton: false
          });
          this.changed.emit();
          this.resetForm();
          this.consultar();
        },
        error: (error) => {
          console.error('No se pudo guardar el prepago.', error);
          this.errorMessage = this.getApiErrorMessage(error);
        }
      });
  }

  limpiar(): void {
    if (this.saving()) {
      return;
    }
    this.resetForm();
  }

  cancelarEdicion(): void {
    this.resetForm();
  }

  editar(prepayment: ReservationPrepayment): void {
    this.selectedPrepayment.set(prepayment);
    this.mode.set('edit');
    this.applyPrepaymentToForm(prepayment, false);
  }

  ver(prepayment: ReservationPrepayment): void {
    this.selectedPrepayment.set(prepayment);
    this.mode.set('view');
    this.applyPrepaymentToForm(prepayment, true);
  }

  async eliminar(prepayment: ReservationPrepayment): Promise<void> {
    const result = await Swal.fire({
      title: 'Eliminar prepago',
      text: `¿Desea eliminar el prepago ${prepayment.numInterno || prepayment.nOperacion || ''}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.saving.set(true);
    this.service
      .eliminar({ ...prepayment, operador: this.currentOperator() })
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.changed.emit();
          this.consultar();
        },
        error: (error) => {
          console.error('No se pudo eliminar el prepago.', error);
          this.errorMessage = this.getApiErrorMessage(error);
        }
      });
  }

  isInvalid(controlName: keyof ReservationPrepaymentForm): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  moneySymbol(currency: string): string {
    const normalized = this.normalizeCurrency(currency);
    return this.monedas().find((item) => this.normalizeCurrency(item.codMoneda) === normalized)?.simbolo || (normalized === 'CRC' || normalized === 'COL' ? '₡' : '$');
  }

  formaPagoLabel(code: string): string {
    const item = this.formasPago().find((entry) => entry.codigo === code);
    return item ? item.descripcion : code || 'N/D';
  }

  isCardPayment(): boolean {
    const code = this.form.controls.frmPago.value;
    const formaPago = this.formasPago().find((item) => item.codigo === code);
    const text = `${formaPago?.tipoPago ?? ''} ${formaPago?.descripcion ?? ''}`.toUpperCase();
    return text.includes('TC') || text.includes('TARJETA') || text.includes('CREDIT') || text.includes('DEBIT');
  }

  trackByNumInterno(_: number, item: ReservationPrepayment): string {
    return item.numInterno || `${item.codRsv}-${item.nOperacion}-${item.fechaDepo}`;
  }

  formatDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  private initializeModal(): void {
    this.resetForm();
    this.loadCatalogs();
    this.consultar();
  }

  private loadCatalogs(): void {
    forkJoin({
      monedas: this.monedaService.getAll().pipe(catchError(() => of([] as MonedaUI[]))),
      formasPago: this.formaPagoService.getAll().pipe(catchError(() => of([] as FormaPago[])))
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ monedas, formasPago }) => {
        this.monedas.set(monedas);
        this.formasPago.set(formasPago.filter((item) => item.tipoFrm === 'A' || item.tipoFrm === 'V'));
        this.applyDefaults();
      });
  }

  private consultar(): void {
    const codReserva = this.reserva?.codReserva?.trim();
    if (!codReserva) {
      return;
    }

    this.loading.set(true);
    this.errorMessage = '';
    this.service
      .consultar(codReserva)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.prepayments.set(items);
          this.updateMoneyPreview();
        },
        error: (error) => {
          console.error('No se pudieron consultar los prepagos.', error);
          this.prepayments.set([]);
          this.errorMessage = this.getApiErrorMessage(error);
        }
      });
  }

  private resetForm(): void {
    const today = this.todayIso();
    this.mode.set('new');
    this.selectedPrepayment.set(null);
    this.submitted.set(false);
    this.form.enable({ emitEvent: false });
    this.form.reset({
      fechaDepo: today,
      fechaReg: today,
      concepto: '',
      frmPago: this.formasPago()[0]?.codigo ?? '',
      moneda: this.reservationCurrency(),
      tCambio: this.reserva?.tCambio || 1,
      totalPrepa: 0,
      nOperacion: '',
      numTarjeta: '',
      venTarjeta: '',
      codSeguridad: '',
      tipTarjeta: '',
      cCosto: 'PREPA'
    });
    this.applyDefaults();
    this.updateMoneyPreview();
  }

  private applyDefaults(): void {
    if (!this.form.controls.moneda.value) {
      this.form.controls.moneda.setValue(this.reservationCurrency(), { emitEvent: false });
    }
    if (!this.form.controls.frmPago.value && this.formasPago().length) {
      this.form.controls.frmPago.setValue(this.formasPago()[0].codigo, { emitEvent: false });
    }
    this.syncExchangeRate();
    this.applyPaymentMethodValidators();
  }

  private applyPrepaymentToForm(prepayment: ReservationPrepayment, readonly: boolean): void {
    this.form.enable({ emitEvent: false });
    this.form.reset({
      fechaDepo: this.normalizeDateForInput(prepayment.fechaDepo),
      fechaReg: this.normalizeDateForInput(prepayment.fechaReg),
      concepto: prepayment.concepto,
      frmPago: prepayment.frmPago,
      moneda: this.normalizeCurrency(prepayment.moneda),
      tCambio: Number(prepayment.tCambio || 1),
      totalPrepa: Number(prepayment.totalPrepa || 0),
      nOperacion: prepayment.nOperacion,
      numTarjeta: prepayment.numTarjeta,
      venTarjeta: prepayment.venTarjeta,
      codSeguridad: prepayment.codSeguridad,
      tipTarjeta: prepayment.tipTarjeta,
      cCosto: prepayment.cCosto || 'PREPA'
    });

    if (readonly) {
      this.form.disable({ emitEvent: false });
    }

    this.updateMoneyPreview();
  }

  private applyPaymentMethodValidators(): void {
    const nOperacion = this.form.controls.nOperacion;
    nOperacion.setValidators([Validators.maxLength(60)]);
    if (!this.isCashPayment()) {
      nOperacion.addValidators([Validators.required]);
    }
    nOperacion.updateValueAndValidity({ emitEvent: false });
  }

  private syncExchangeRate(): void {
    const monedaPrepago = this.normalizeCurrency(this.form.controls.moneda.value);
    if (!monedaPrepago || monedaPrepago === this.reservationCurrency()) {
      this.form.controls.tCambio.setValue(1, { emitEvent: false });
      return;
    }

    const existing = Number(this.form.controls.tCambio.value || this.reserva?.tCambio || 0);
    if (existing > 1) {
      return;
    }

    this.tipoCambioService
      .fetchTipoCambio(normalizePmsDateDDMMYYYY(this.form.controls.fechaDepo.value || this.todayIso()), this.reservationCurrency())
      .pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        const rate = Number(items[0]?.venta ?? this.reserva?.tCambio ?? 0) || 1;
        this.form.controls.tCambio.setValue(rate, { emitEvent: false });
        this.updateMoneyPreview();
      });
  }

  private updateMoneyPreview(): void {
    this.syncExchangeRateIfNeeded();
    const equivalent = this.toReservationCurrency(this.buildPayload(this.isEditing() ? 2 : 1));
    this.conversionAmount.set(equivalent);
    const baseAlreadyStored = this.isEditing() ? this.toReservationCurrency(this.selectedPrepayment()) : 0;
    this.projectedBalance.set(this.roundMoney(Math.max(this.pendingBalance() + baseAlreadyStored - equivalent, 0)));
  }

  private syncExchangeRateIfNeeded(): void {
    if (this.normalizeCurrency(this.form.controls.moneda.value) === this.reservationCurrency() && this.form.controls.tCambio.value !== 1) {
      this.form.controls.tCambio.setValue(1, { emitEvent: false });
    }
  }

  private getSubmitValidationMessage(): string {
    if (this.form.invalid) {
      return 'Complete los campos obligatorios antes de guardar el prepago.';
    }

    const amount = Number(this.form.controls.totalPrepa.value || 0);
    if (amount <= 0) {
      return 'El monto del prepago debe ser mayor a cero.';
    }

    const equivalent = this.conversionAmount();
    const editingAmount = this.isEditing() ? this.toReservationCurrency(this.selectedPrepayment()) : 0;
    if (equivalent > this.pendingBalance() + editingAmount + 0.01) {
      return 'El prepago no puede ser mayor al saldo pendiente de la reserva.';
    }

    return '';
  }

  private buildPayload(proceso: number): ReservationPrepayment {
    const raw = this.form.getRawValue();
    const base = this.selectedPrepayment() ?? this.service.createEmptyPayload();
    return {
      ...base,
      proceso,
      numInterno: base.numInterno || '',
      codRsv: this.reserva?.codReserva ?? '',
      codAge: this.reserva?.codAgencia ?? '',
      fechaDepo: raw.fechaDepo,
      fechaReg: raw.fechaReg,
      horaReg: base.horaReg || this.currentTime(),
      concepto: raw.concepto.trim(),
      cCosto: 'PREPA',
      totalRsv: this.totalReservation(),
      totalPrepa: Number(raw.totalPrepa || 0),
      saldoPrepa: this.projectedBalance(),
      moneda: this.normalizeCurrency(raw.moneda),
      tCambio: Number(raw.tCambio || 1),
      frmPago: raw.frmPago.trim(),
      numTarjeta: raw.numTarjeta.trim(),
      venTarjeta: raw.venTarjeta.trim(),
      codSeguridad: raw.codSeguridad.trim(),
      tipTarjeta: raw.tipTarjeta.trim(),
      nOperacion: raw.nOperacion.trim(),
      operador: this.currentOperator()
    };
  }

  private toReservationCurrency(prepayment: ReservationPrepayment | null): number {
    if (!prepayment) {
      return 0;
    }

    const amount = Number(prepayment.totalPrepa ?? 0) || 0;
    const from = this.normalizeCurrency(prepayment.moneda);
    const to = this.reservationCurrency();
    const rate = Number(prepayment.tCambio || this.form.controls.tCambio.value || this.reserva?.tCambio || 1) || 1;

    if (!amount || from === to) {
      return this.roundMoney(amount);
    }

    if (from === 'CRC' || from === 'COL') {
      return this.roundMoney(amount / rate);
    }

    if (to === 'CRC' || to === 'COL') {
      return this.roundMoney(amount * rate);
    }

    return this.roundMoney(amount);
  }

  private totalReservation(): number {
    return Number(this.reserva?.totalRsv ?? 0) || 0;
  }

  private isCashPayment(): boolean {
    const code = this.form.controls.frmPago.value;
    const formaPago = this.formasPago().find((item) => item.codigo === code);
    const text = `${formaPago?.tipoPago ?? ''} ${formaPago?.descripcion ?? ''}`.toUpperCase();
    return text.includes('CE') || text.includes('EFECTIVO') || text.includes('CONTADO');
  }

  private currentOperator(): string {
    return this.auth.getCurrentUser()?.usuario?.trim() || this.reserva?.operador || '';
  }

  private normalizeCurrency(value: string | null | undefined): string {
    const currency = (value ?? '').trim().toUpperCase();
    return currency === 'COL' ? 'CRC' : currency;
  }

  private normalizeDateForInput(value: string): string {
    return toPmsDateInputValue(value) || this.todayIso();
  }

  private todayIso(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private currentTime(): string {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private getApiErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return 'No se pudo completar la operación. Revise la conexión con el API.';
    }

    const httpError = error as { error?: unknown; message?: string };
    if (typeof httpError.error === 'string' && httpError.error.trim()) {
      return httpError.error;
    }
    if (httpError.error && typeof httpError.error === 'object') {
      const apiError = httpError.error as { respuesta?: string; mensaje?: string; message?: string };
      return apiError.respuesta || apiError.mensaje || apiError.message || 'No se pudo completar la operación.';
    }
    return httpError.message || 'No se pudo completar la operación.';
  }

  private isSuccessfulResponse(response: { ok?: boolean; respuesta?: string; mensaje?: string } | null | undefined): boolean {
    if (response?.ok === false) {
      return false;
    }

    const text = `${response?.respuesta ?? ''} ${response?.mensaje ?? ''}`.toUpperCase();
    return !text.includes('ERROR') && !text.includes('NO SE PUDO') && !text.includes('FALL');
  }
}
