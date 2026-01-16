import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { UsuarioService } from '../usuario.service';
import { UsuarioResponse } from '../usuario.models';

@Component({
  selector: 'app-usuario-cambiar-clave',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuario-cambiar-clave.component.html',
  styleUrls: ['./usuario-cambiar-clave.component.scss']
})
export class UsuarioCambiarClaveComponent implements OnInit {
  form!: FormGroup;
  usuario = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      usuario: [{ value: '', disabled: true }],
      nuevaClave: ['', [Validators.required]],
      confirmarClave: ['', [Validators.required]]
    });

    const usuario = this.route.snapshot.paramMap.get('usuario');
    if (usuario) {
      this.usuario = usuario;
      this.form.patchValue({ usuario });
    } else {
      this.goBack();
    }
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

    const nueva = this.form.get('nuevaClave')?.value;
    const confirmar = this.form.get('confirmarClave')?.value;
    if (nueva !== confirmar) {
      Swal.fire({
        title: 'Validacion',
        text: 'Las claves no coinciden.',
        icon: 'warning'
      });
      return;
    }

    this.usuarioService
      .cambiarClave({
        tipo: 3,
        usuario: this.usuario,
        clave: nueva,
        operador: '',
        respuesta: ''
      })
      .subscribe({
      next: (response: UsuarioResponse) => {
        const message = response?.respuesta || 'Clave actualizada correctamente.';
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al cambiar clave:', error);
        const errorMsg = error?.error?.respuesta || 'Error al cambiar la clave.';
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
}
