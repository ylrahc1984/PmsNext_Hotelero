import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { UnidadMedidaService } from './unidad-medida.service';
import { UnidadMedidaResponse } from './unidad-medida.models';

@Component({
  selector: 'app-unidad-medida-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './unidad-medida-form.component.html',
  styleUrls: ['./unidad-medida-form.component.scss']
})
export class UnidadMedidaFormComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private codUMedActual: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private unidadMedidaService: UnidadMedidaService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      codUMed: ['', [Validators.required]],
      descripcion: ['', [Validators.required]]
    });
  }

  private loadIfEditing(): void {
    const codUMed = this.route.snapshot.paramMap.get('codUMed');
    if (!codUMed) {
      return;
    }

    this.isEditing = true;
    this.codUMedActual = codUMed;
    this.form.get('codUMed')?.disable();

    this.unidadMedidaService.getUnidadByCodigo(codUMed).subscribe({
      next: (data) => {
        if (!data) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro la unidad de medida seleccionada.',
            icon: 'error'
          });
          this.goBack();
          return;
        }

        this.form.patchValue({
          codUMed: data.CAC04_UnmMed,
          descripcion: data.CAC04_Descripcion
        });
      },
      error: (error) => {
        console.error('Error al cargar unidad de medida:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar la unidad de medida seleccionada.',
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
    const codUMed = String(raw.codUMed || '').trim();
    const descripcion = String(raw.descripcion || '').trim();
    const payload = this.unidadMedidaService.buildPayload(codUMed, descripcion, this.isEditing ? 2 : 1);
    const codReferencia = this.codUMedActual ?? codUMed;

    const operation = this.isEditing
      ? this.unidadMedidaService.editarUnidad(codReferencia, payload)
      : this.unidadMedidaService.crearUnidad(payload);

    operation.subscribe({
      next: (response: UnidadMedidaResponse) => {
        const message =
          response?.respuesta ||
          (this.isEditing ? 'Unidad actualizada correctamente.' : 'Unidad creada correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar unidad de medida:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar la unidad de medida.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/administracion/configuracion/unidad-medida']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
