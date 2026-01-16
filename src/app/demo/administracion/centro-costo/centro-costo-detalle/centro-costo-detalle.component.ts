import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { CentroCostoService } from '../centro-costo.service';
import { CentroCostoResponse, CentroCostoUI } from '../centro-costo.models';

@Component({
  selector: 'app-centro-costo-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './centro-costo-detalle.component.html',
  styleUrls: ['./centro-costo-detalle.component.scss']
})
export class CentroCostoDetalleComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private codGrupoActual: string | null = null;

  tipoOptions: Array<{ value: string; label: string }> = [
    { value: 'M', label: 'Mercancia' },
    { value: 'S', label: 'Servicio' }
  ];

  impuestoOptions: Array<{ value: number; label: string }> = [
    { value: 1, label: 'Si' },
    { value: 0, label: 'No' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private centroCostoService: CentroCostoService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      codGrupo: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      impuesto: [0, [Validators.required, this.optionValidator(['0', '1'])]],
      tcCto: ['', [Validators.required, this.optionValidator(['M', 'S'])]],
      orden: [0, [Validators.required, Validators.min(0)]]
    });
  }

  private loadIfEditing(): void {
    const codGrupo = this.route.snapshot.paramMap.get('codGrupo');
    if (!codGrupo) {
      return;
    }

    this.isEditing = true;
    this.codGrupoActual = codGrupo;
    this.form.get('codGrupo')?.disable();

    this.centroCostoService.getByCodigo(codGrupo).subscribe({
      next: (data) => {
        this.form.patchValue({
          codGrupo: data.codGrupo,
          descripcion: data.descripcion,
          impuesto: data.impuesto,
          tcCto: data.tcCto,
          orden: data.orden
        });
      },
      error: (error) => {
        console.error('Error al cargar centro de costo:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el centro de costo seleccionado.',
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
    const payload: CentroCostoUI = {
      codGrupo: raw.codGrupo,
      descripcion: raw.descripcion,
      impuesto: Number(raw.impuesto),
      orden: Number(raw.orden),
      tcCto: raw.tcCto
    };

    const codigo = this.codGrupoActual ?? payload.codGrupo;
    const operation = this.isEditing
      ? this.centroCostoService.update(codigo, payload)
      : this.centroCostoService.create(payload);

    operation.subscribe({
      next: (response: CentroCostoResponse) => {
        const message = response?.respuesta || (this.isEditing ? 'Centro de costo actualizado correctamente.' : 'Centro de costo creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar centro de costo:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar el centro de costo.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/administracion/configuracion/centrocosto']);
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
