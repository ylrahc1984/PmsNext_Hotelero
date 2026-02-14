import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { GooglePlaceSelection, GooglePlacesAutocompleteDirective } from '../../reservas/google-places-autocomplete.directive';
import { ListaPickupService } from './lista-pickup.service';

@Component({
  selector: 'app-lista-pickup-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule, RouterLink, GooglePlacesAutocompleteDirective],
  templateUrl: './lista-pickup-form.component.html',
  styleUrls: ['./lista-pickup-form.component.scss']
})
export class ListaPickupFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private listaPickupService = inject(ListaPickupService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  form!: FormGroup;
  isEditing = false;
  isLoading = false;
  placeSelectionMessage = '';

  private readonly durationPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  ngOnInit(): void {
    this.buildForm();

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.isEditing = true;
      this.loadPickup(id);
    }
  }

  private buildForm(): void {
    const operador = this.auth.getCurrentUser()?.usuario ?? 'CARGA';
    this.form = this.fb.group({
      cR11_ID: [0],
      cR11_Nombre: ['', [Validators.required, Validators.minLength(3)]],
      cR11_Duracion: ['', [Validators.required, Validators.pattern(this.durationPattern)]],
      cR11_Estado: [1, [Validators.required]],
      cR11_Localizacion: ['', [Validators.required]],
      cR11_Operador: [operador, [Validators.required]]
    });
  }

  private loadPickup(id: number): void {
    this.isLoading = true;
    this.listaPickupService.getById(id).subscribe({
      next: (pickup) => {
        if (!pickup) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro el pickup solicitado.',
            icon: 'warning'
          });
          this.isLoading = false;
          this.router.navigate(['/catalogos/lista-pickup']);
          return;
        }

        this.form.patchValue({
          cR11_ID: pickup.CR11_ID,
          cR11_Nombre: pickup.CR11_Nombre,
          cR11_Duracion: pickup.CR11_Duracion,
          cR11_Estado: Number(pickup.CR11_Estado ?? 0),
          cR11_Localizacion: pickup.CR11_Localizacion || '',
          cR11_Operador: pickup.CR11_Operador || this.form.get('cR11_Operador')?.value
        });
        this.isLoading = false;
      },
      error: (error) => {
        const message = error?.message || 'No se pudo cargar el pickup.';
        Swal.fire({
          title: 'Error',
          text: message,
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = this.listaPickupService.buildPayload(
      {
        cR11_ID: this.isEditing ? Number(raw.cR11_ID || 0) : 0,
        cR11_Nombre: (raw.cR11_Nombre || '').toString().trim(),
        cR11_Duracion: (raw.cR11_Duracion || '').toString(),
        cR11_Estado: Number(raw.cR11_Estado ?? 0),
        cR11_Localizacion: (raw.cR11_Localizacion || '').toString().trim(),
        cR11_Operador: (raw.cR11_Operador || '').toString().trim()
      },
      this.isEditing ? this.listaPickupService.getAccionUpdate() : this.listaPickupService.getAccionInsert()
    );

    const request = this.isEditing
      ? this.listaPickupService.update(payload)
      : this.listaPickupService.create(payload);

    this.isLoading = true;
    request.subscribe({
      next: (response) => {
        const message =
          response?.respuesta ||
          (this.isEditing ? 'Pickup actualizado correctamente.' : 'Pickup creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        });
        this.router.navigate(['/catalogos/lista-pickup']);
      },
      error: (error) => {
        const message = error?.message || 'No se pudo guardar el pickup.';
        Swal.fire({
          title: 'Error',
          text: message,
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/catalogos/lista-pickup']);
  }

  onEstadoToggle(checked: boolean): void {
    this.form.patchValue({ cR11_Estado: checked ? 1 : 0 });
  }

  // Google Places: al seleccionar una sugerencia, guardamos el texto en localizacion.
  onPlaceSelected(selection: GooglePlaceSelection): void {
    const formatted = (selection.formattedAddress || '').toString().trim();
    const name = (selection.name || '').toString().trim();
    const displayText = name && formatted
      ? (formatted.toLowerCase().includes(name.toLowerCase()) ? formatted : `${name}, ${formatted}`)
      : (formatted || name);

    this.form.patchValue({ cR11_Localizacion: displayText });
    this.placeSelectionMessage = '';
  }

  onPlaceSelectionError(message: string): void {
    this.placeSelectionMessage = (message || '').toString().trim();
  }

  onLocalizacionInput(): void {
    if (this.placeSelectionMessage) {
      this.placeSelectionMessage = '';
    }
  }

  isFieldInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  get isEstadoActivo(): boolean {
    return Number(this.form.get('cR11_Estado')?.value) === 1;
  }
}
