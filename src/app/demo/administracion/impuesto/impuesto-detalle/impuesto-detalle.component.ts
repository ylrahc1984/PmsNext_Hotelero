import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ImpuestoService } from '../impuesto.service';
import { ImpuestoResponse, ImpuestoUI } from '../impuesto.models';

@Component({
  selector: 'app-impuesto-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './impuesto-detalle.component.html',
  styleUrls: ['./impuesto-detalle.component.scss']
})
export class ImpuestoDetalleComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private codigoActual: string | null = null;

  tipoImpuOptions: Array<{ value: string; label: string }> = [
    { value: 'ITBIS', label: 'ITBIS' },
    { value: 'ISC', label: 'ISC' },
    { value: 'EXE', label: 'Exento' },
    { value: 'OTRO', label: 'Otro' }
  ];

  grabadoOptions: Array<{ value: number; label: string }> = [
    { value: 1, label: 'Si' },
    { value: 0, label: 'No' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private impuestoService: ImpuestoService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      codigo: ['', [Validators.required]],
      nombre: ['', [Validators.required]],
      porcentaje: [0, [Validators.required, Validators.min(0)]],
      tipoImpu: ['', [Validators.required]],
      grabado: [0, [Validators.required, this.optionValidator(['0', '1'])]],
      orden: [0, [Validators.required, Validators.min(0)]],
      ctaContav: [''],
      ctaContac: [''],
      idTributacion: [''],
      ctaRifa: ['']
    });
  }

  private loadIfEditing(): void {
    const codigo = this.route.snapshot.paramMap.get('codigo');
    if (!codigo) {
      return;
    }

    this.isEditing = true;
    this.codigoActual = codigo;
    this.form.get('codigo')?.disable();

    this.impuestoService.getByCodigo(codigo).subscribe({
      next: (data) => {
        this.form.patchValue({
          codigo: data.codigo,
          nombre: data.nombre,
          porcentaje: data.porcentaje,
          tipoImpu: data.tipoImpu,
          grabado: data.grabado,
          orden: data.orden,
          ctaContav: data.ctaContav,
          ctaContac: data.ctaContac,
          idTributacion: data.idTributacion,
          ctaRifa: data.ctaRifa
        });
      },
      error: (error) => {
        console.error('Error al cargar impuesto:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el impuesto seleccionado.',
          icon: 'error'
        });
        this.goBack();
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        title: 'Validacion',
        text: 'Por favor complete los campos requeridos.',
        icon: 'warning'
      });
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ImpuestoUI = {
      codigo: raw.codigo,
      nombre: raw.nombre,
      porcentaje: Number(raw.porcentaje),
      tipoImpu: raw.tipoImpu,
      grabado: Number(raw.grabado),
      orden: Number(raw.orden),
      ctaContav: raw.ctaContav || '',
      ctaContac: raw.ctaContac || '',
      idTributacion: raw.idTributacion || '',
      ctaRifa: raw.ctaRifa || ''
    };

    const codigo = this.codigoActual ?? payload.codigo;
    const operation = this.isEditing
      ? this.impuestoService.update(codigo, payload)
      : this.impuestoService.create(payload);

    operation.subscribe({
      next: (response: ImpuestoResponse) => {
        const message =
          response?.respuesta ||
          (this.isEditing ? 'Impuesto actualizado correctamente.' : 'Impuesto creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar impuesto:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar el impuesto.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/administracion/configuracion/impuestos']);
  }

  private optionValidator(allowed: string[]) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') {
        return null;
      }
      return allowed.includes(String(control.value)) ? null : { invalidOption: true };
    };
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
