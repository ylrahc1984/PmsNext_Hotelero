import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuestSelfCheckinDialogComponent } from './guest-self-checkin-dialog.component';

describe('GuestSelfCheckinDialogComponent', () => {
  let component: GuestSelfCheckinDialogComponent;
  let fixture: ComponentFixture<GuestSelfCheckinDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GuestSelfCheckinDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(GuestSelfCheckinDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('reservation', { codigo: 'EE260000293' });
    fixture.componentRef.setInput('room', { numero: '12' });
    fixture.componentRef.setInput('adultCount', 2);
    fixture.componentRef.setInput('childCount', 1);
    fixture.componentRef.setInput('guestCount', 3);
    fixture.componentRef.setInput('documentTypes', [{ codigo: 'PAS', descripcion: 'Pasaporte' }]);
    fixture.componentRef.setInput('nationalities', [{ codigo: 'CR', descripcion: 'Costarricense' }]);
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
      codigoNacionalidad: 'CR',
      procede: 'Celebramos nuestro aniversario.'
    });

    component.submit();

    expect(emitted).toEqual(['María']);
    expect(component.completedCount).toBe(1);
    expect(component.selectedGuest?.orden).toBe(2);
  });

  it('incluye la nota para el concierge al guardar el huésped', () => {
    let savedGuest: unknown;
    component.guestSaved.subscribe((guest) => { savedGuest = guest; });
    component.guestForm.setValue({
      tipoDocumento: 'PAS',
      numeroDocumento: 'P123',
      nombre: 'María',
      apellidos: 'Gómez',
      email: 'maria@example.com',
      telefono: '8888-8888',
      codigoNacionalidad: 'CR',
      procede: 'Necesito una almohada adicional.'
    });

    component.submit();

    expect(savedGuest).toEqual(jasmine.objectContaining({ procede: 'Necesito una almohada adicional.' }));
  });
});
