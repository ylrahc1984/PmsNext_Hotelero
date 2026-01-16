import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { TipoClienteService } from './tipo-cliente.service';
import { TipoClienteDto, TipoClienteResponse } from './tipo-cliente.models';

@Component({
  selector: 'app-tipo-cliente-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './tipo-cliente-form.component.html',
  styleUrls: ['./tipo-cliente-form.component.scss']
})
export class TipoClienteFormComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private codTipoActual: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private tipoClienteService: TipoClienteService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      codTipo: ['', [Validators.required]],
      tipoCliente: ['', [Validators.required]]
    });
  }

  private loadIfEditing(): void {
    const codTipo = this.route.snapshot.paramMap.get('codTipo');
    if (!codTipo) {
      return;
    }

    this.isEditing = true;
    this.codTipoActual = codTipo;
    this.form.get('codTipo')?.disable();

    this.tipoClienteService.getTipoClienteByCodigo(codTipo).subscribe({
      next: (data: TipoClienteDto | null) => {
        if (!data) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro el tipo de cliente seleccionado.',
            icon: 'error'
          });
          this.goBack();
          return;
        }

        this.form.patchValue({
          codTipo: data.CPV00_Codigo,
          tipoCliente: data.CPV00_Descripcion
        });
      },
      error: (error) => {
        console.error('Error al cargar tipo de cliente:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el tipo de cliente seleccionado.',
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
    const codTipo = String(raw.codTipo || '').trim();
    const tipoCliente = String(raw.tipoCliente || '').trim();
    const payload = this.tipoClienteService.buildPayload(codTipo, tipoCliente, this.isEditing ? 2 : 1);
    const codReferencia = this.codTipoActual ?? codTipo;

    const operation = this.isEditing
      ? this.tipoClienteService.editarTipoCliente(codReferencia, payload)
      : this.tipoClienteService.crearTipoCliente(payload);

    operation.subscribe({
      next: (response: TipoClienteResponse) => {
        const message =
          response?.respuesta ||
          (this.isEditing ? 'Tipo de cliente actualizado correctamente.' : 'Tipo de cliente creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar tipo de cliente:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar el tipo de cliente.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/administracion/configuracion/tipo-cliente']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
