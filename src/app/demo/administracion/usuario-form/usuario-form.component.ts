import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { DepartamentoService } from 'src/app/demo/administracion/departamento/departamento.service';
import { DepartamentoUI } from 'src/app/demo/administracion/departamento/departamento.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { UsuarioPayload, UsuarioResponse } from 'src/app/demo/administracion/usuarios/usuario.models';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.scss']
})
export class UsuarioFormComponent implements OnInit {
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
      nombre: ['', [Validators.required]],
      departamento: [null, [Validators.required]],
      telefono: [''],
      correo: ['', [Validators.email]],
      puntoVentaHabilitado: [false],
      clavePuntoVenta: [{ value: '', disabled: true }]
    });

    this.form.get('puntoVentaHabilitado')?.valueChanges.subscribe((value) => {
      this.syncPuntoVentaState(!!value);
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
        usuario: this.usuarioService.getUsuarioById(usuario)
      }).subscribe({
        next: (result) => {
          this.departamentos = result.departamentos ?? [];
          this.form.patchValue({
            usuario: result.usuario.usuario,
            nombre: result.usuario.nombreUsu,
            departamento: result.usuario.departamento,
            telefono: result.usuario.telefono,
            correo: result.usuario.correo,
            puntoVentaHabilitado: (result.usuario.pntVenta ?? 0) === 1,
            clavePuntoVenta: result.usuario.passPntVenta ?? ''
          });
          this.syncPuntoVentaState(this.form.get('puntoVentaHabilitado')?.value);
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
        this.syncPuntoVentaState(this.form.get('puntoVentaHabilitado')?.value);
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
    const payload: UsuarioPayload = {
      tipo: this.isEditing ? 2 : 1,
      usuario: raw.usuario,
      nombreUsu: raw.nombre,
      departamento: Number(raw.departamento),
      telefono: raw.telefono || '',
      correo: raw.correo || '',
      clave: this.isEditing ? '' : 'NUEVO-PASS',
      pntVenta: raw.puntoVentaHabilitado ? 1 : 0,
      passPntVenta: raw.clavePuntoVenta || '',
      operador: '',
      respuesta: '',
      pageNumber: 0,
      pageSize: 0
    };

    const operation = this.isEditing
      ? this.usuarioService.actualizarUsuario({ ...payload, usuario: this.usuarioActual || payload.usuario })
      : this.usuarioService.crearUsuario(payload);

    operation.subscribe({
      next: (response: UsuarioResponse) => {
        const message = response?.respuesta || (this.isEditing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => {
          if (this.isEditing) {
            this.goBack();
            return;
          }
          this.router.navigate(['/usuarios', payload.usuario, 'propiedades']);
        });
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
    this.router.navigate(['/usuarios']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private syncPuntoVentaState(isEnabled: boolean): void {
    const passControl = this.form.get('clavePuntoVenta');
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
