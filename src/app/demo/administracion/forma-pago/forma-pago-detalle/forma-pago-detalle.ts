import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { FormaPago, FormaPagoResponse, TipoFrm, TipoPago } from '../forma-pago.models';
import { FormaPagoService } from '../forma-pago.service';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-forma-pago-detalle',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forma-pago-detalle.html',
  styleUrl: './forma-pago-detalle.scss'
})
export class FormaPagoDetalleComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private codigoActual: string | null = null;
  private toastService = inject(ToastService);

  tipoFrmOptions: Array<{ value: TipoFrm; label: string }> = [
    { value: 'A', label: 'Ambos' },
    { value: 'V', label: 'Venta' },
    { value: 'C', label: 'Compra' }
  ];

  tipoPagoOptions: Array<{ value: TipoPago; label: string }> = [
    { value: 'CE', label: 'Contado Efectivo' },
    { value: 'CR', label: 'Credito' },
    { value: 'PP', label: 'Prepago' },
    { value: 'TC', label: 'Tarjeta Credito/Debito' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private formaPagoService: FormaPagoService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.bindTipoPagoChanges();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      codigo: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      tipoFrm: ['', [Validators.required, this.optionValidator(['A', 'V', 'C'])]],
      tipoPago: ['', [Validators.required, this.optionValidator(['CE', 'CR', 'PP', 'TC'])]],
      nDias: [{ value: 0, disabled: true }],
      orden: [0, [Validators.required, Validators.min(0)]]
    });
  }

  private bindTipoPagoChanges(): void {
    this.form.get('tipoPago')?.valueChanges.subscribe((value: TipoPago | null) => {
      this.applyTipoPagoRules(value);
    });
  }

  private loadIfEditing(): void {
    const codigo =
      this.route.snapshot.paramMap.get('codigo') ||
      this.route.snapshot.queryParamMap.get('codigo') ||
      this.route.snapshot.queryParamMap.get('id');

    if (!codigo) {
      return;
    }

    this.isEditing = true;
    this.codigoActual = codigo;

    this.formaPagoService.getByCodigo(codigo).subscribe({
      next: (data) => {
        this.form.patchValue({
          codigo: data.codigo,
          descripcion: data.descripcion,
          tipoFrm: data.tipoFrm,
          tipoPago: data.tipoPago,
          nDias: data.nDias,
          orden: data.orden
        });
        this.applyTipoPagoRules(data.tipoPago);
      },
      error: (error) => {
        console.error('Error al cargar forma de pago:', error);
        alert('No se pudo cargar la forma de pago seleccionada.');
        this.goBack();
      }
    });
  }

  private applyTipoPagoRules(tipoPago: TipoPago | null): void {
    const nDiasControl = this.form.get('nDias');
    if (!nDiasControl) {
      return;
    }

    if (tipoPago === 'CR') {
      nDiasControl.enable({ emitEvent: false });
      nDiasControl.setValidators([Validators.required, Validators.min(1)]);
      if (!nDiasControl.value || nDiasControl.value <= 0) {
        nDiasControl.setValue(null, { emitEvent: false });
      }
    } else {
      nDiasControl.setValue(0, { emitEvent: false });
      nDiasControl.disable({ emitEvent: false });
      nDiasControl.clearValidators();
    }

    nDiasControl.updateValueAndValidity({ emitEvent: false });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    const raw = this.form.getRawValue();
    const payload: FormaPago = {
      codigo: raw.codigo,
      descripcion: raw.descripcion,
      tipoFrm: raw.tipoFrm,
      tipoPago: raw.tipoPago,
      nDias: raw.nDias,
      orden: raw.orden
    };

    const operation = this.isEditing
      ? this.formaPagoService.update(payload)
      : this.formaPagoService.create(payload);

    operation.subscribe({
      next: (response: FormaPagoResponse) => {
        const message =
          response?.respuesta ||
          (this.isEditing ? 'Forma de pago actualizada correctamente.' : 'Forma de pago creada correctamente.');
        this.toastService.success(message);
        this.goBack();
      },
      error: (error) => {
        console.error('Error al guardar forma de pago:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar la forma de pago.';
        alert(errorMsg);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/formas-pago']);
  }

  private optionValidator(allowed: string[]) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      return allowed.includes(control.value) ? null : { invalidOption: true };
    };
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
