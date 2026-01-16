import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ContadorService } from '../contador.service';
import { ContadorResponse, ContadorUI } from '../contador.models';

@Component({
  selector: 'app-contador-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contador-detalle.component.html',
  styleUrls: ['./contador-detalle.component.scss']
})
export class ContadorDetalleComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private codigoActual: string | null = null;

  boolOptions: Array<{ value: number; label: string }> = [
    { value: 1, label: 'Si' },
    { value: 0, label: 'No' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private contadorService: ContadorService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      codigo: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      serie: [0, [Validators.min(0)]],
      contador: [0, [Validators.min(0)]],
      largo: [1, [Validators.required, Validators.min(1)]],
      auto: [0, [Validators.required, this.optionValidator(['0', '1'])]],
      frmCod: [0, [Validators.required, this.optionValidator(['0', '1'])]]
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

    this.contadorService.getByCodigo(codigo).subscribe({
      next: (data) => {
        this.form.patchValue({
          codigo: data.codigo,
          descripcion: data.descripcion,
          serie: data.serie,
          contador: data.contador,
          largo: data.largo,
          auto: data.auto,
          frmCod: data.frmCod
        });
      },
      error: (error) => {
        console.error('Error al cargar contador:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el contador seleccionado.',
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
    const payload: ContadorUI = {
      codigo: raw.codigo,
      descripcion: raw.descripcion,
      serie: Number(raw.serie) || 0,
      contador: Number(raw.contador) || 0,
      largo: Number(raw.largo) || 1,
      auto: Number(raw.auto),
      frmCod: Number(raw.frmCod)
    };

    const codigo = this.codigoActual ?? payload.codigo;
    const operation = this.isEditing
      ? this.contadorService.update(codigo, payload)
      : this.contadorService.create(payload);

    operation.subscribe({
      next: (response: ContadorResponse) => {
        const message = response?.respuesta || (this.isEditing ? 'Contador actualizado correctamente.' : 'Contador creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar contador:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar el contador.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/administracion/configuracion/contadores']);
  }

  private optionValidator(allowed: string[]) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') {
        return null;
      }
      return allowed.includes(String(control.value)) ? null : { invalidOption: true };
    };
  }
}
