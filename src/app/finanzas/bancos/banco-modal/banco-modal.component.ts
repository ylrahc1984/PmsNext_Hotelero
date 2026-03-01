import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Banco } from '../banco.model';

type BancoForm = {
  codBanco: FormControl<string>;
  descripcion: FormControl<string>;
  operador: FormControl<string>;
};

@Component({
  selector: 'app-banco-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './banco-modal.component.html',
  styleUrls: ['./banco-modal.component.scss']
})
export class BancoModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() banco: Banco | null = null;
  @Input() busy = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Banco>();

  readonly form: FormGroup<BancoForm> = this.fb.group({
    codBanco: this.fb.control('', { validators: [Validators.required] }),
    descripcion: this.fb.control('', { validators: [Validators.required] }),
    operador: this.fb.control('', { validators: [Validators.required] })
  });

  modalTitle = 'Nuevo Banco';
  modalSubtitle = 'Registra un banco y su operador asignado.';
  submitLabel = 'Guardar Banco';
  codBancoDisabled = false;

  codBancoError = '';
  descripcionError = '';
  operadorError = '';
  canSubmit = false;
  submitDisabled = true;
  showSpinner = false;
  showSaveIcon = true;
  codBancoInputDisabled = false;
  descripcionInputDisabled = false;
  operadorInputDisabled = false;

  private submitted = false;

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateValidationState());
    this.updateValidationState();
    this.updateDisabledState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['banco'] || changes['open']) {
      if (this.open) {
        this.applyBanco(this.banco);
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
      codBanco: raw.codBanco,
      descripcion: raw.descripcion,
      operador: raw.operador
    });
  }

  private applyBanco(banco: Banco | null): void {
    this.submitted = false;
    if (banco) {
      this.modalTitle = 'Editar Banco';
      this.modalSubtitle = 'Actualiza la información del banco seleccionado.';
      this.submitLabel = 'Guardar Cambios';
      this.form.reset({
        codBanco: banco.codBanco,
        descripcion: banco.descripcion,
        operador: banco.operador
      });
      this.codBancoDisabled = true;
      this.form.controls.codBanco.disable({ emitEvent: false });
    } else {
      this.modalTitle = 'Nuevo Banco';
      this.modalSubtitle = 'Registra un banco y su operador asignado.';
      this.submitLabel = 'Guardar Banco';
      this.form.reset({
        codBanco: '',
        descripcion: '',
        operador: ''
      });
      this.codBancoDisabled = false;
      this.form.controls.codBanco.enable({ emitEvent: false });
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.updateDisabledState();
    this.updateValidationState();
  }

  private updateValidationState(): void {
    this.codBancoError = this.getControlError(this.form.controls.codBanco, 'El código es obligatorio.');
    this.descripcionError = this.getControlError(this.form.controls.descripcion, 'La descripción es obligatoria.');
    this.operadorError = this.getControlError(this.form.controls.operador, 'El operador es obligatorio.');
    this.canSubmit = this.form.valid && !this.busy;
    this.submitDisabled = !this.canSubmit;
  }

  private updateDisabledState(): void {
    this.codBancoInputDisabled = this.codBancoDisabled || this.busy;
    this.descripcionInputDisabled = this.busy;
    this.operadorInputDisabled = this.busy;
    this.showSpinner = this.busy;
    this.showSaveIcon = !this.busy;
  }

  private getControlError(control: FormControl<string>, message: string): string {
    const shouldShow = control.invalid && (control.touched || this.submitted);
    return shouldShow ? message : '';
  }
}
