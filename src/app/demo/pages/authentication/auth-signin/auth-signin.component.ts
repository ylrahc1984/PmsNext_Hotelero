import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
 
import { AuthService } from 'src/app/core/services/auth.service';
import { APP_BRANDING } from 'src/app/core/config/app-branding';
import { ModuleAccessService } from 'src/app/core/services/module-access.service';

@Component({
  selector: 'app-auth-signin',
  imports: [RouterModule, CommonModule, ReactiveFormsModule],
  templateUrl: './auth-signin.component.html',
  styleUrls: ['./auth-signin.component.scss']
})
export class AuthSigninComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private moduleAccess = inject(ModuleAccessService);
  private fb = inject(FormBuilder);

  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  readonly branding = APP_BRANDING;
  logoSrc = 'assets/images/next_web_logo_nuevo_v2_transparent.png';
  private logoFallbackSrc = 'assets/images/next_web_logo.png';
  private logoTriedFallback = false;

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.loginForm = this.fb.group({
      usuario: ['', [Validators.required, Validators.minLength(3)]],
      clave: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Por favor, completa todos los campos correctamente.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { usuario, clave } = this.loginForm.value;

    this.authService
      .login(usuario, clave)
      .pipe(
        switchMap((response) => {
          const authenticatedUser = response.usuario?.[0]?.usuario?.trim() || usuario.trim();
          return this.moduleAccess.loadForUser(authenticatedUser, true).pipe(
            map(() => ({ response, accessLoadError: false })),
            catchError((error) => {
              console.error('No se pudieron cargar los módulos del usuario:', error);
              return of({ response, accessLoadError: true });
            })
          );
        })
      )
      .subscribe({
        next: ({ response, accessLoadError }) => {
          this.isLoading = false;
          console.log('Login exitoso:', response);
          this.router.navigate(['/dashboard'], {
            queryParams: accessLoadError ? { accesoDenegado: 'carga' } : undefined
          });
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error en login:', error);

          if (error.status === 401) {
            this.errorMessage = 'Usuario o contraseña incorrectos.';
          } else if (error.status === 0) {
            this.errorMessage = 'No se puede conectar con el servidor. Verifique la URL de la API.';
          } else if (error.error?.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Error al iniciar sesión. Intente nuevamente.';
          }
        }
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogoError(): void {
    if (this.logoTriedFallback) {
      return;
    }
    this.logoTriedFallback = true;
    this.logoSrc = this.logoFallbackSrc;
  }

  get usuario() {
    return this.loginForm.get('usuario');
  }

  get clave() {
    return this.loginForm.get('clave');
  }
}
