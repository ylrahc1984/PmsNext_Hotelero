import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { DepartamentoService } from 'src/app/demo/administracion/departamento/departamento.service';
import { DepartamentoUI } from 'src/app/demo/administracion/departamento/departamento.models';
import { UsuarioService } from '../usuarios/usuario.service';
import { UsuarioResponse, UsuarioUI } from '../usuarios/usuario.models';

@Component({
  selector: 'app-usuario-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuario-detalle.html',
  styleUrl: './usuario-detalle.scss'
})
export class UsuarioDetalleComponent implements OnInit {
  form!: FormGroup;
  departamentos: DepartamentoUI[] = [];
  isEditing = false;
  isCatalogLoaded = false;
  private usuarioActual: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private usuarioService: UsuarioService,
    private departamentoService: DepartamentoService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadCatalogAndUser();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      usuario: ['', [Validators.required]],
      nombreUsu: ['', [Validators.required]],
      departamento: [null, [Validators.required]],
      telefono: [''],
      correo: ['', [Validators.email]],
      pntVenta: [false],
      passPntVenta: [{ value: '', disabled: true }]
    });
  }

  private loadCatalogAndUser(): void {
    const usuario = this.route.snapshot.paramMap.get('usuario');
    this.usuarioActual = usuario;
    this.isEditing = !!usuario;

    const departamentos$ = this.departamentoService.getAll();

    if (this.isEditing && usuario) {
      forkJoin({
        departamentos: departamentos$,
        usuario: this.usuarioService.getByUsuario(usuario , 1, 10)
      }).subscribe({
        next: (result) => {

          console.log('Usuario cargado:', result.usuario);

          this.departamentos = result.departamentos ?? [];
          this.form.patchValue({
            usuario: result.usuario.usuario,
            nombreUsu: result.usuario.nombreUsu,
            departamento: result.usuario.departamento,
            telefono: result.usuario.telefono,
            correo: result.usuario.correo,
            pntVenta: (result.usuario.pntVenta ?? 0) === 1,
            passPntVenta: result.usuario.passPntVenta ?? ''
          });
          this.syncPuntoVentaState(this.form.get('pntVenta')?.value);
          this.form.get('usuario')?.disable();
          this.isCatalogLoaded = true;
        },
        error: (error) => {
          console.error('Error al cargar usuario:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo cargar el usuario seleccionado.',
            icon: 'error'
          });
          this.goBack();
        }
      });
      return;
    }

    departamentos$.subscribe({
      next: (data) => {
        this.departamentos = data ?? [];
        this.syncPuntoVentaState(this.form.get('pntVenta')?.value);
        this.form.get('pntVenta')?.valueChanges.subscribe((value) => {
          this.syncPuntoVentaState(value);
        });
        this.isCatalogLoaded = true;
      },
      error: (error) => {
        console.error('Error al cargar departamentos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el catalogo de departamentos.',
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
        text: 'Complete los campos requeridos.',
        icon: 'warning'
      });
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UsuarioUI = {
      usuario: raw.usuario,
      nombreUsu: raw.nombreUsu,
      departamento: Number(raw.departamento),
      telefono: raw.telefono || '',
      correo: raw.correo || '',
      pntVenta: Number(raw.pntVenta) || 0,
      passPntVenta: raw.passPntVenta || ''
    };

    const usuario = this.usuarioActual ?? payload.usuario;
    const operation = this.isEditing
      ? this.usuarioService.update(usuario, payload)
      : this.usuarioService.create(payload);

    operation.subscribe({
      next: (response: UsuarioResponse) => {
        const message = response?.respuesta || (this.isEditing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar usuario:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar el usuario.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/usuarios-perfiles']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private syncPuntoVentaState(isEnabled: boolean): void {
    const passControl = this.form.get('passPntVenta');
    if (!passControl) {
      return;
    }
    if (isEnabled) {
      passControl.enable({ emitEvent: false });
    } else {
      passControl.setValue('', { emitEvent: false });
      passControl.disable({ emitEvent: false });
    }
  }
}
