import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { CheckInArrivalsService } from '../../services/check-in-arrivals.service';
import { GuestIdentityDocumentService } from '../../services/guest-identity-document.service';
import { GuestSelfCheckinDialogComponent } from './guest-self-checkin-dialog.component';

describe('GuestSelfCheckinDialogComponent', () => {
  let component: GuestSelfCheckinDialogComponent;
  let fixture: ComponentFixture<GuestSelfCheckinDialogComponent>;
  let arrivalsService: jasmine.SpyObj<CheckInArrivalsService>;
  let documentService: jasmine.SpyObj<GuestIdentityDocumentService>;

  beforeEach(async () => {
    arrivalsService = jasmine.createSpyObj<CheckInArrivalsService>('CheckInArrivalsService', ['addRoomingListGuest', 'updateRoomingListGuest']);
    arrivalsService.addRoomingListGuest.and.returnValue(of({ success: true, data: { idOpe: '0000000361' } }));
    arrivalsService.updateRoomingListGuest.and.returnValue(of({ success: true, data: { idOpe: 'RL-100' } }));
    documentService = jasmine.createSpyObj<GuestIdentityDocumentService>('GuestIdentityDocumentService', [
      'getByRooming', 'getById', 'create', 'replace', 'delete', 'getContent'
    ]);
    documentService.getByRooming.and.returnValue(of(null));
    documentService.getById.and.returnValue(of({
      idDocumento: 24,
      idRooming: '0000000361',
      codReserva: 'EE260000293',
      tipoDocumento: 'PAS',
      ladoDocumento: 'FRONT',
      nombreArchivo: 'passport.jpg',
      formato: 'jpg',
      mimeType: 'image/jpeg',
      tamanoBytes: 1024,
      activo: true,
      fechaCreacion: '2026-09-05T12:00:00',
      operadorCreacion: 'tester'
    }));
    documentService.create.and.returnValue(of({ success: true, data: { idGenerado: 24 } }));

    await TestBed.configureTestingModule({
      imports: [GuestSelfCheckinDialogComponent],
      providers: [
        { provide: CheckInArrivalsService, useValue: arrivalsService },
        { provide: GuestIdentityDocumentService, useValue: documentService },
        { provide: EmpresaContextService, useValue: { getSnapshot: () => ({ MA04_Unidad: '01' }) } },
        { provide: AuthService, useValue: { getCurrentUser: () => ({ usuario: 'tester' }) } },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning', 'info']) }
      ]
    }).compileComponents();
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

  it('guarda un huésped y selecciona el siguiente pendiente', async () => {
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

    await component.submit();

    expect(emitted).toEqual(['María']);
    expect(component.completedCount).toBe(1);
    expect(component.selectedGuest?.orden).toBe(2);
    expect(arrivalsService.addRoomingListGuest).toHaveBeenCalledWith(jasmine.objectContaining({ idOpe: '', nombre: 'María' }));
  });

  it('incluye la nota para el concierge al guardar el huésped', async () => {
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

    await component.submit();

    expect(savedGuest).toEqual(jasmine.objectContaining({ existingGuestId: '0000000361', procede: 'Necesito una almohada adicional.' }));
  });

  it('emite el identificador existente cuando se edita un huésped ya registrado', async () => {
    fixture.componentRef.setInput('guestCount', 1);
    fixture.componentRef.setInput('adultCount', 1);
    fixture.componentRef.setInput('childCount', 0);
    fixture.componentRef.setInput('existingGuests', [{
      numInterno: 'RL-100',
      codReserva: 'EE260000293',
      numHabita: '12',
      nacionalidad: 'CR',
      tipDocu: 'PAS',
      numDocu: 'P123',
      nombre: 'María',
      apellidos: 'Gómez',
      fecNaci: '',
      sexo: '',
      estCivil: '',
      tipoPax: 'PAX',
      direccion: '',
      email: 'maria@example.com',
      motivo: '8888-8888',
      procede: '',
      mdoArribo: '',
      orden: 1,
      operador: 'tester'
    }]);
    fixture.detectChanges();
    const save = spyOn(component.guestSaved, 'emit');
    const finish = spyOn(component.registrationFinished, 'emit');
    component.guestForm.patchValue({ nombre: 'María Editada' });

    await component.submit();

    expect(component.allCompleted).toBeTrue();
    expect(component.saveButtonLabel).toBe('Update guest');
    expect(finish).not.toHaveBeenCalled();
    expect(arrivalsService.updateRoomingListGuest).toHaveBeenCalledWith(jasmine.objectContaining({ idOpe: 'RL-100', nombre: 'María Editada' }));
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({
      slotId: 'guest-1',
      existingGuestId: 'RL-100',
      nombre: 'María Editada'
    }));
  });

  it('conserva el contrato al guardar desde el único botón del pie usando los campos visibles', async () => {
    const save = spyOn(component.guestSaved, 'emit');
    const data = {
      tipoDocumento: 'PAS', numeroDocumento: 'TEST-123', nombre: 'Ana', apellidos: 'Prueba',
      email: 'ana@example.com', telefono: '8888-8888', codigoNacionalidad: 'CR'
    };
    for (const [key, value] of Object.entries(data)) {
      const field = fixture.nativeElement.querySelector(`[formControlName="${key}"]`) as HTMLInputElement | HTMLSelectElement;
      field.value = value;
      field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }
    const notes = fixture.nativeElement.querySelectorAll('textarea') as NodeListOf<HTMLTextAreaElement>;
    expect(notes.length).toBe(1);
    notes[0].value = 'Una almohada adicional.';
    notes[0].dispatchEvent(new Event('input'));

    const submitButtons = fixture.nativeElement.querySelectorAll('button[type="submit"]') as NodeListOf<HTMLButtonElement>;
    expect(submitButtons.length).toBe(1);
    submitButtons[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(save).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      slotId: 'guest-1', existingGuestId: '0000000361', orden: 1, tipoPax: 'PAX', ...data, procede: 'Una almohada adicional.'
    }));
    expect(component.selectedGuestId).toBe('guest-2');
    expect(fixture.nativeElement.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('33');
  });

  it('mantiene selección, validación, bloqueo durante guardado y cierre', () => {
    const save = spyOn(component.guestSaved, 'emit');
    const close = spyOn(component.cancelled, 'emit');
    const guestButtons = fixture.nativeElement.querySelectorAll('.guest-card') as NodeListOf<HTMLButtonElement>;
    guestButtons[1].click();
    fixture.detectChanges();
    expect(component.selectedGuestId).toBe('guest-2');
    expect(guestButtons[1].getAttribute('aria-pressed')).toBe('true');

    fixture.nativeElement.querySelector('.guest-footer button').click();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.form-validation[role="alert"]')).toBeTruthy();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.guest-footer button').disabled).toBeTrue();
    fixture.nativeElement.querySelector('.guest-header__close').click();
    expect(close).not.toHaveBeenCalled();

    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.guest-header__close').click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('muestra un único documento vacío y sus acciones no guardan huéspedes por sí solas', () => {
    const save = spyOn(component.guestSaved, 'emit');
    const cards = fixture.nativeElement.querySelectorAll('app-identity-document-card');
    expect(cards.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.identity-documents__card')).toBeTruthy();
    expect(cards[0].textContent).toContain('Add identity document');
    expect(fixture.nativeElement.querySelectorAll('input[type="file"]').length).toBe(3);
    for (const button of Array.from(fixture.nativeElement.querySelectorAll('.document-card button') as NodeListOf<HTMLButtonElement>)) {
      expect(button.type).toBe('button');
      button.click();
    }
    expect(save).not.toHaveBeenCalled();
    expect(component.completedCount).toBe(0);
  });

  it('rechaza un archivo inválido sin crear rooming ni llamar APIs de documento', () => {
    const file = new File(['plain text'], 'document.txt', { type: 'text/plain' });

    component.onDocumentFileSelected({ target: { files: [file], value: 'document.txt' } } as unknown as Event, false);

    expect(component.selectedDocument.status).toBe('error');
    expect(component.selectedDocument.errorMessage).toContain('JPG, PNG or WEBP');
    expect(arrivalsService.addRoomingListGuest).not.toHaveBeenCalled();
    expect(documentService.create).not.toHaveBeenCalled();
  });

  it('crea el rooming con idOpe backend antes de subir documento sin completar el huésped', async () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:local-preview');
    spyOn(URL, 'revokeObjectURL');
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

    const file = new File(['image'], 'passport.jpg', { type: 'image/jpeg' });
    component.onDocumentFileSelected({ target: { files: [file], value: 'passport.jpg' } } as unknown as Event, false);
    await fixture.whenStable();

    expect(arrivalsService.addRoomingListGuest).toHaveBeenCalledWith(jasmine.objectContaining({
      idOpe: '',
      codRsv: 'EE260000293',
      numHabita: '12',
      nombre: 'María',
      mdoArribo: ''
    }));
    expect(documentService.create).toHaveBeenCalledWith(jasmine.objectContaining({
      file,
      empresa: '01',
      idRooming: '0000000361',
      codReserva: 'EE260000293',
      tipoDocumento: 'PAS'
    }));
    expect(component.selectedDocument.status).toBe('stored');
    expect(component.selectedGuestIsExisting).toBeTrue();
    expect(component.completedCount).toBe(0);
  });
});
