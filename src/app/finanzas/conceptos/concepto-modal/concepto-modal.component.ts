import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Concepto } from '../concepto.model';

type ConceptoForm = {
  codConcepto: FormControl<string>;
  concepto: FormControl<string>;
  tipMov: FormControl<string>;
  empresa: FormControl<string>;
  operador: FormControl<string>;
};

const MAX_LENGTHS = {
  codConcepto: 20,
  concepto: 100,
  tipMov: 10,
  empresa: 50,
  operador: 50
};

const TIP_MOV_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Seleccione' },
  { value: 'ING', label: 'Ingreso' },
  { value: 'RET', label: 'Retiro' }
];

function noWhitespaceValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').toString();
  return value.trim().length ? null : { whitespace: true };
}

@Component({
  selector: 'app-concepto-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './concepto-modal.component.html',
  styleUrls: ['./concepto-modal.component.scss']
})
export class ConceptoModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() concepto: Concepto | null = null;
  @Input() busy = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Concepto>();

  readonly tipMovOptions = TIP_MOV_OPTIONS;

  readonly form: FormGroup<ConceptoForm> = this.fb.group({
    codConcepto: this.fb.control('', {
      validators: [Validators.required, noWhitespaceValidator, Validators.maxLength(MAX_LENGTHS.codConcepto)]
    }),
    concepto: this.fb.control('', {
      validators: [Validators.required, noWhitespaceValidator, Validators.maxLength(MAX_LENGTHS.concepto)]
    }),
    tipMov: this.fb.control('', {
      validators: [Validators.required, noWhitespaceValidator, Validators.maxLength(MAX_LENGTHS.tipMov)]
    }),
    empresa: this.fb.control('', {
      validators: [Validators.required, noWhitespaceValidator, Validators.maxLength(MAX_LENGTHS.empresa)]
    }),
    operador: this.fb.control('', {
      validators: [Validators.required, noWhitespaceValidator, Validators.maxLength(MAX_LENGTHS.operador)]
    })
  });

  modalTitle = 'Nuevo Concepto';
  modalSubtitle = 'Registra un concepto bancario para el sistema.';
  submitLabel = 'Guardar Concepto';
  codConceptoDisabled = false;

  codConceptoError = '';
  conceptoError = '';
  tipMovError = '';
  empresaError = '';
  operadorError = '';

  canSubmit = false;
  submitDisabled = true;
  showSpinner = false;
  showSaveIcon = true;

  codConceptoInputDisabled = false;
  conceptoInputDisabled = false;
  tipMovInputDisabled = false;
  empresaInputDisabled = false;
  operadorInputDisabled = false;

  private submitted = false;

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateValidationState());
    this.updateValidationState();
    this.updateDisabledState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['concepto'] || changes['open']) {
      if (this.open) {
        this.applyConcepto(this.concepto);
      }
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
      codConcepto: raw.codConcepto,
      concepto: raw.concepto,
      tipMov: raw.tipMov,
      empresa: raw.empresa,
      operador: raw.operador,
      cuenta: this.concepto?.cuenta,
      descripcion: this.concepto?.descripcion
    });
  }

  private applyConcepto(concepto: Concepto | null): void {
    this.submitted = false;
    if (concepto) {
      this.modalTitle = 'Editar Concepto';
      this.modalSubtitle = 'Actualiza la información del concepto seleccionado.';
      this.submitLabel = 'Guardar Cambios';
      this.form.reset({
        codConcepto: concepto.codConcepto,
        concepto: concepto.concepto,
        tipMov: concepto.tipMov,
        empresa: concepto.empresa,
        operador: concepto.operador
      });
      this.codConceptoDisabled = true;
      this.form.controls.codConcepto.disable({ emitEvent: false });
    } else {
      this.modalTitle = 'Nuevo Concepto';
      this.modalSubtitle = 'Registra un concepto bancario para el sistema.';
      this.submitLabel = 'Guardar Concepto';
      this.form.reset({
        codConcepto: '',
        concepto: '',
        tipMov: '',
        empresa: '',
        operador: ''
      });
      this.codConceptoDisabled = false;
      this.form.controls.codConcepto.enable({ emitEvent: false });
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.updateDisabledState();
    this.updateValidationState();
  }

  private updateValidationState(): void {
    this.codConceptoError = this.getControlError(this.form.controls.codConcepto, 'El código es obligatorio.');
    this.conceptoError = this.getControlError(this.form.controls.concepto, 'El concepto es obligatorio.');
    this.tipMovError = this.getControlError(this.form.controls.tipMov, 'El tipo de movimiento es obligatorio.');
    this.empresaError = this.getControlError(this.form.controls.empresa, 'La empresa es obligatoria.');
    this.operadorError = this.getControlError(this.form.controls.operador, 'El operador es obligatorio.');
    this.canSubmit = this.form.valid && !this.busy;
    this.submitDisabled = !this.canSubmit;
  }

  private updateDisabledState(): void {
    this.codConceptoInputDisabled = this.codConceptoDisabled || this.busy;
    this.conceptoInputDisabled = this.busy;
    this.tipMovInputDisabled = this.busy;
    this.empresaInputDisabled = this.busy;
    this.operadorInputDisabled = this.busy;
    this.showSpinner = this.busy;
    this.showSaveIcon = !this.busy;
  }

  private getControlError(control: FormControl<string>, message: string): string {
    const shouldShow = control.invalid && (control.touched || this.submitted);
    return shouldShow ? message : '';
  }
}
