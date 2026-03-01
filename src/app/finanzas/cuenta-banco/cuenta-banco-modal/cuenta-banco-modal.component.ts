import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CuentaBanco } from '../cuenta-banco.model';

type CuentaBancoForm = {
  ctaBanco: FormControl<string>;
  codBanco: FormControl<string>;
  nombreCta: FormControl<string>;
  numeroCta: FormControl<string>;
  moneda: FormControl<string>;
  ctaContable: FormControl<string>;
  numCheque: FormControl<string>;
  saldo: FormControl<number | null>;
  fechaApe: FormControl<string>;
  empresa: FormControl<string>;
  operador: FormControl<string>;
};

@Component({
  selector: 'app-cuenta-banco-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cuenta-banco-modal.component.html',
  styleUrls: ['./cuenta-banco-modal.component.scss']
})
export class CuentaBancoModalComponent implements OnInit, OnChanges {
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() cuenta: CuentaBanco | null = null;
  @Input() busy = false;
  @Input() defaultCodBanco = '';

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<CuentaBanco>();

  readonly form: FormGroup<CuentaBancoForm> = new FormGroup<CuentaBancoForm>({
    ctaBanco: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codBanco: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nombreCta: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    numeroCta: new FormControl('', { nonNullable: true }),
    moneda: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ctaContable: new FormControl('', { nonNullable: true }),
    numCheque: new FormControl('', { nonNullable: true }),
    saldo: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    fechaApe: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)] }),
    empresa: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    operador: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  modalTitle = 'Nueva Cuenta Bancaria';
  modalSubtitle = 'Registra una cuenta bancaria para el banco seleccionado.';
  submitLabel = 'Guardar Cuenta';
  codBancoDisabled = false;
  ctaBancoDisabled = false;

  ctaBancoError = '';
  codBancoError = '';
  nombreCtaError = '';
  monedaError = '';
  empresaError = '';
  operadorError = '';
  saldoError = '';
  fechaApeError = '';

  canSubmit = false;
  submitDisabled = true;
  showSpinner = false;
  showSaveIcon = true;

  codBancoInputDisabled = false;
  ctaBancoInputDisabled = false;
  nombreCtaInputDisabled = false;
  monedaInputDisabled = false;
  empresaInputDisabled = false;
  operadorInputDisabled = false;
  optionalInputsDisabled = false;

  private submitted = false;

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateValidationState());
    this.updateValidationState();
    this.updateDisabledState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cuenta'] || changes['open']) {
      if (this.open) {
        this.applyCuenta(this.cuenta);
      }
    }
    if (changes['defaultCodBanco'] && this.open && !this.cuenta) {
      this.applyDefaultCodBanco();
    }
    if (changes['busy']) {
      this.updateDisabledState();
      this.updateValidationState();
    }
  }

  onClose(): void {
    if (this.busy) {
      return;
    }
    this.close.emit();
  }

  onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.updateValidationState();
    if (!this.canSubmit) {
      return;
    }
    const raw = this.form.getRawValue();
    this.save.emit({
      ctaBanco: raw.ctaBanco,
      codBanco: raw.codBanco,
      nombreCta: raw.nombreCta,
      numeroCta: raw.numeroCta,
      moneda: raw.moneda,
      ctaContable: raw.ctaContable,
      numCheque: raw.numCheque,
      saldo: raw.saldo ?? undefined,
      fechaApe: raw.fechaApe,
      empresa: raw.empresa,
      operador: raw.operador
    });
  }

  private applyCuenta(cuenta: CuentaBanco | null): void {
    this.submitted = false;
    if (cuenta) {
      this.modalTitle = 'Editar Cuenta Bancaria';
      this.modalSubtitle = 'Actualiza la información de la cuenta bancaria seleccionada.';
      this.submitLabel = 'Guardar Cambios';
      this.form.reset({
        ctaBanco: cuenta.ctaBanco,
        codBanco: cuenta.codBanco,
        nombreCta: cuenta.nombreCta,
        numeroCta: cuenta.numeroCta ?? '',
        moneda: cuenta.moneda,
        ctaContable: cuenta.ctaContable ?? '',
        numCheque: cuenta.numCheque ?? '',
        saldo: cuenta.saldo ?? null,
        fechaApe: this.normalizeDate(cuenta.fechaApe),
        empresa: cuenta.empresa,
        operador: cuenta.operador
      });
      this.codBancoDisabled = true;
      this.ctaBancoDisabled = true;
      this.form.controls.codBanco.disable({ emitEvent: false });
      this.form.controls.ctaBanco.disable({ emitEvent: false });
    } else {
      this.modalTitle = 'Nueva Cuenta Bancaria';
      this.modalSubtitle = 'Registra una cuenta bancaria para el banco seleccionado.';
      this.submitLabel = 'Guardar Cuenta';
      this.form.reset({
        ctaBanco: '',
        codBanco: this.defaultCodBanco || '',
        nombreCta: '',
        numeroCta: '',
        moneda: '',
        ctaContable: '',
        numCheque: '',
        saldo: null,
        fechaApe: '',
        empresa: '',
        operador: ''
      });
      this.codBancoDisabled = false;
      this.ctaBancoDisabled = false;
      this.form.controls.codBanco.enable({ emitEvent: false });
      this.form.controls.ctaBanco.enable({ emitEvent: false });
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.updateDisabledState();
    this.updateValidationState();
  }

  private applyDefaultCodBanco(): void {
    if (this.codBancoDisabled) {
      return;
    }
    const currentValue = this.form.controls.codBanco.value;
    if (!currentValue) {
      this.form.controls.codBanco.setValue(this.defaultCodBanco || '', { emitEvent: false });
      this.updateValidationState();
    }
  }

  private updateValidationState(): void {
    this.ctaBancoError = this.getControlError(this.form.controls.ctaBanco, 'El código de cuenta es obligatorio.');
    this.codBancoError = this.getControlError(this.form.controls.codBanco, 'El banco es obligatorio.');
    this.nombreCtaError = this.getControlError(this.form.controls.nombreCta, 'El nombre es obligatorio.');
    this.monedaError = this.getControlError(this.form.controls.moneda, 'La moneda es obligatoria.');
    this.empresaError = this.getControlError(this.form.controls.empresa, 'La empresa es obligatoria.');
    this.operadorError = this.getControlError(this.form.controls.operador, 'El operador es obligatorio.');
    this.saldoError = this.getMinError(this.form.controls.saldo, 'El saldo debe ser mayor o igual a 0.');
    this.fechaApeError = this.getPatternError(this.form.controls.fechaApe, 'Fecha inválida.');
    this.canSubmit = this.form.valid && !this.busy;
    this.submitDisabled = !this.canSubmit;
  }

  private updateDisabledState(): void {
    this.codBancoInputDisabled = this.codBancoDisabled || this.busy;
    this.ctaBancoInputDisabled = this.ctaBancoDisabled || this.busy;
    this.nombreCtaInputDisabled = this.busy;
    this.monedaInputDisabled = this.busy;
    this.empresaInputDisabled = this.busy;
    this.operadorInputDisabled = this.busy;
    this.optionalInputsDisabled = this.busy;
    this.showSpinner = this.busy;
    this.showSaveIcon = !this.busy;
  }

  private getControlError(control: FormControl<string>, message: string): string {
    const shouldShow = control.invalid && (control.touched || this.submitted);
    return shouldShow ? message : '';
  }

  private getMinError(control: FormControl<number | null>, message: string): string {
    const shouldShow = control.invalid && (control.touched || this.submitted);
    return shouldShow ? message : '';
  }

  private getPatternError(control: FormControl<string>, message: string): string {
    const shouldShow = control.invalid && (control.touched || this.submitted);
    return shouldShow ? message : '';
  }

  private normalizeDate(value?: string): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day && month && year) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }
    return trimmed;
  }
}
