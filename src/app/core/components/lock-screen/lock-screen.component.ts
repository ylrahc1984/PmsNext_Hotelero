import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LockScreenService } from '../../services/lock-screen.service';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lock-screen.component.html',
  styleUrls: ['./lock-screen.component.scss']
})
export class LockScreenComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private lockScreenService = inject(LockScreenService);

  user$ = this.authService.currentUser$;
  state$ = combineLatest({
    locked: this.lockScreenService.locked$,
    setupMode: this.lockScreenService.setupMode$
  });

  pinForm = this.fb.nonNullable.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]],
    confirmPin: ['']
  });

  unlockForm = this.fb.nonNullable.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
  });

  saving = false;
  unlocking = false;
  errorMessage = '';

  async savePin(): Promise<void> {
    this.errorMessage = '';
    this.pinForm.markAllAsTouched();

    const pin = this.pinForm.controls.pin.value;
    const confirmPin = this.pinForm.controls.confirmPin.value;

    if (this.pinForm.controls.pin.invalid) {
      this.errorMessage = 'El PIN debe tener entre 4 y 6 dígitos.';
      return;
    }

    if (pin !== confirmPin) {
      this.errorMessage = 'La confirmación no coincide con el PIN.';
      return;
    }

    this.saving = true;
    await this.lockScreenService.setPin(pin);
    this.pinForm.reset();
    this.saving = false;
  }

  async unlock(): Promise<void> {
    this.errorMessage = '';
    this.unlockForm.markAllAsTouched();

    if (this.unlockForm.invalid) {
      this.errorMessage = 'Ingrese el PIN de desbloqueo.';
      return;
    }

    this.unlocking = true;
    const valid = await this.lockScreenService.unlock(this.unlockForm.controls.pin.value);
    this.unlocking = false;

    if (valid) {
      this.unlockForm.reset();
      return;
    }

    this.errorMessage = 'PIN incorrecto.';
    this.unlockForm.controls.pin.reset();
  }

  logout(): void {
    this.lockScreenService.clear();
    this.authService.logout().subscribe();
  }
}
