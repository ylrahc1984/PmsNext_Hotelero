import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, ViewChild, forwardRef, inject } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';

import {
  differenceInPmsCalendarDays,
  normalizePmsDateDDMMYYYY,
  normalizePmsDateKeyboardInputDDMMYYYY,
  toPmsDateInputValue
} from 'src/app/core/utils/pms-date.util';

@Component({
  selector: 'app-pms-date-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pms-date-input.component.html',
  styleUrls: ['./pms-date-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PmsDateInputComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PmsDateInputComponent),
      multi: true
    }
  ]
})
export class PmsDateInputComponent implements ControlValueAccessor, Validator {
  private readonly cdr = inject(ChangeDetectorRef);
  private static nextId = 0;

  @Input() label = '';
  @Input() describedBy: string | null = null;
  private minValue: string | null = null;
  private maxValue: string | null = null;

  @Input()
  set min(value: string | null) {
    this.minValue = value;
    this.refreshValidation();
  }
  get min(): string | null {
    return this.minValue;
  }

  @Input()
  set max(value: string | null) {
    this.maxValue = value;
    this.refreshValidation();
  }
  get max(): string | null {
    return this.maxValue;
  }
  @Input() id = `pms-date-input-${++PmsDateInputComponent.nextId}`;

  @ViewChild('dateInput') private dateInput?: ElementRef<HTMLInputElement>;
  @ViewChild('calendarInput') private calendarInput?: ElementRef<HTMLInputElement>;

  displayValue = '';
  validationMessage = '';
  disabled = false;
  touched = false;
  fallbackCalendarVisible = false;

  private pointerInitiatedFocus = false;
  private applyingViewValue = false;
  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  get minIso(): string | null {
    return this.toIsoLimit(this.min);
  }

  get maxIso(): string | null {
    return this.toIsoLimit(this.max);
  }

  get errorId(): string {
    return `${this.id}-error`;
  }

  get ariaDescribedBy(): string | null {
    const ids = [this.describedBy, this.hasError ? this.errorId : null].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  get hasError(): boolean {
    return this.touched && !!this.validationMessage;
  }

  writeValue(value: string | null | undefined): void {
    if (this.applyingViewValue) return;

    if (value == null || value === '') {
      this.displayValue = '';
      this.validationMessage = '';
    } else {
      const raw = String(value);
      const normalized = this.normalizeInput(raw);
      this.displayValue = normalized || raw;
      this.validationMessage = normalized ? this.getRangeError(normalized) : this.getFormatError(raw);
    }
    this.onValidatorChange();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.fallbackCalendarVisible = false;
    this.cdr.markForCheck();
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    if (!this.displayValue.trim()) return null;
    if (!this.validationMessage) return null;
    return { pmsDate: { message: this.validationMessage, value: this.displayValue } };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  onInput(value: string): void {
    this.displayValue = value;
    this.validationMessage = this.getValidationMessage(value);

    if (!value.trim()) {
      this.emitChange(null);
    } else {
      this.emitChange(this.validationMessage ? null : this.normalizeInput(value));
    }

    this.onValidatorChange();
  }

  onBlur(): void {
    this.touched = true;
    const normalized = this.normalizeInput(this.displayValue);
    if (normalized) this.displayValue = normalized;
    this.validationMessage = this.getValidationMessage(this.displayValue);
    this.onTouched();
    this.onValidatorChange();
    this.cdr.markForCheck();
  }

  onPointerDown(): void {
    this.pointerInitiatedFocus = !this.dateInput?.nativeElement.matches(':focus');
  }

  onFocus(): void {
    if (!this.pointerInitiatedFocus) this.dateInput?.nativeElement.select();
    this.pointerInitiatedFocus = false;
  }

  focus(): void {
    if (this.disabled) return;
    const input = this.dateInput?.nativeElement;
    input?.focus();
    input?.select();
  }

  openCalendar(): void {
    if (this.disabled) return;
    const input = this.calendarInput?.nativeElement as (HTMLInputElement & { showPicker?: () => void }) | undefined;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // If the browser denies showPicker, expose the native date control below.
      }
    }

    this.fallbackCalendarVisible = true;
    this.cdr.detectChanges();
    this.calendarInput?.nativeElement.focus();
  }

  onCalendarChange(value: string): void {
    const normalized = normalizePmsDateDDMMYYYY(value);
    if (!normalized) return;

    this.displayValue = normalized;
    this.validationMessage = this.getRangeError(normalized);
    this.emitChange(this.validationMessage ? null : normalized);
    this.onTouched();
    this.touched = true;
    this.onValidatorChange();
    this.fallbackCalendarVisible = false;
    this.cdr.markForCheck();
  }

  onEscape(event: KeyboardEvent): void {
    if (!this.fallbackCalendarVisible) return;
    event.preventDefault();
    this.fallbackCalendarVisible = false;
    this.dateInput?.nativeElement.focus();
    this.cdr.markForCheck();
  }

  private normalizeInput(value: string): string {
    return normalizePmsDateKeyboardInputDDMMYYYY(value);
  }

  private getValidationMessage(value: string): string {
    if (!value.trim()) return '';
    const normalized = this.normalizeInput(value);
    if (!normalized) return this.getFormatError(value);
    return this.getRangeError(normalized);
  }

  private getFormatError(value: string): string {
    const input = value.trim();
    if (/^\d{1,7}$/.test(input)) return 'Fecha incompleta. Use dd/MM/yyyy o 8 dígitos (ddMMyyyy).';

    const hasDateShape = /^\d{8}$/.test(input) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input);
    return hasDateShape ? 'La fecha no existe. Revise el día, mes y año.' : 'Formato inválido. Use dd/MM/yyyy o 8 dígitos (ddMMyyyy).';
  }

  private getRangeError(value: string): string {
    if (this.min) {
      const difference = differenceInPmsCalendarDays(this.min, value);
      if (difference !== null && difference < 0) return `La fecha debe ser igual o posterior a ${this.min}.`;
    }

    if (this.max) {
      const difference = differenceInPmsCalendarDays(value, this.max);
      if (difference !== null && difference < 0) return `La fecha debe ser igual o anterior a ${this.max}.`;
    }

    return '';
  }

  private toIsoLimit(value: string | null): string | null {
    const normalized = value ? normalizePmsDateKeyboardInputDDMMYYYY(value) : '';
    return normalized ? toPmsDateInputValue(normalized) : null;
  }

  private emitChange(value: string | null): void {
    this.applyingViewValue = true;
    this.onChange(value);
    this.applyingViewValue = false;
  }

  private refreshValidation(): void {
    this.validationMessage = this.getValidationMessage(this.displayValue);
    this.onValidatorChange();
    this.cdr.markForCheck();
  }
}
