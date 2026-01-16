import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { DepartamentoService } from '../departamento.service';
import { DepartamentoResponse, DepartamentoUI } from '../departamento.models';

@Component({
  selector: 'app-departamento-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './departamento-detalle.component.html',
  styleUrls: ['./departamento-detalle.component.scss']
})
export class DepartamentoDetalleComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private idDepartamento: number | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private departamentoService: DepartamentoService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      departamento: ['', [Validators.required]]
    });
  }

  private loadIfEditing(): void {
    const idParam = this.route.snapshot.paramMap.get('idDepartamento');
    if (!idParam) {
      return;
    }

    const idDepartamento = Number(idParam);
    if (Number.isNaN(idDepartamento)) {
      this.goBack();
      return;
    }

    this.isEditing = true;
    this.idDepartamento = idDepartamento;

    this.departamentoService.getById(idDepartamento).subscribe({
      next: (data) => {
        this.form.patchValue({
          departamento: data.departamento
        });
      },
      error: (error) => {
        console.error('Error al cargar departamento:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el departamento seleccionado.',
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
        text: 'Por favor complete el campo requerido.',
        icon: 'warning'
      });
      return;
    }

    const raw = this.form.getRawValue();
    const payload: DepartamentoUI = {
      idDepartamento: this.idDepartamento ?? 0,
      departamento: raw.departamento
    };

    const operation = this.isEditing && this.idDepartamento !== null
      ? this.departamentoService.update(this.idDepartamento, payload)
      : this.departamentoService.create(payload);

    operation.subscribe({
      next: (response: DepartamentoResponse) => {
        const message = response?.respuesta || (this.isEditing ? 'Departamento actualizado correctamente.' : 'Departamento creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar departamento:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar el departamento.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/administracion/configuracion/departamentos']);
  }
}
