import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuestSelfCheckinDialogComponent } from './guest-self-checkin-dialog.component';

describe('GuestSelfCheckinDialogComponent', () => {
  let component: GuestSelfCheckinDialogComponent;
  let fixture: ComponentFixture<GuestSelfCheckinDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GuestSelfCheckinDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(GuestSelfCheckinDialogComponent);
    component = fixture.componentInstance;
    component.reservation = { codigo: 'EE260000293' };
    component.room = { numero: '12' };
    component.adultCount = 2;
    component.childCount = 1;
    component.guestCount = 3;
    component.documentTypes = [{ codigo: 'PAS', descripcion: 'Pasaporte' }];
    component.nationalities = [{ codigo: 'CR', descripcion: 'Costarricense' }];
    fixture.detectChanges();
  });

  it('genera automáticamente adultos y niños de la reserva', () => {
    expect(component.guests.length).toBe(3);
    expect(component.completedCount).toBe(0);
  });

  it('guarda un huésped y selecciona el siguiente pendiente', () => {
    const emitted: string[] = [];
    component.guestSaved.subscribe((guest) => emitted.push(guest.nombre));
    component.guestForm.setValue({
      tipoDocumento: 'PAS',
      numeroDocumento: 'P123',
      nombre: 'María',
      apellidos: 'Gómez',
      email: 'maria@example.com',
      telefono: '8888-8888',
      codigoNacionalidad: 'CR'
    });

    component.submit();

    expect(emitted).toEqual(['María']);
    expect(component.completedCount).toBe(1);
    expect(component.selectedGuest?.orden).toBe(2);
  });
});
