import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReservaTagAsignado } from '../../models/reserva-tag.model';
import { ReservationTagListComponent } from './reservation-tag-list.component';

describe('ReservationTagListComponent', () => {
  let fixture: ComponentFixture<ReservationTagListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReservationTagListComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReservationTagListComponent);
  });

  it('orders alerts and priority, limits visible tags and validates colors', () => {
    fixture.componentRef.setInput('maxVisible', 2);
    fixture.componentRef.setInput('tags', [
      makeAssignedTag(1, 'Regular', { prioridad: 1 }),
      makeAssignedTag(2, 'VIP', { prioridad: 5, color: 'red' }),
      makeAssignedTag(3, 'Alerta', { esAlerta: true, prioridad: 2 })
    ]);
    fixture.detectChanges();

    const chips = [...fixture.nativeElement.querySelectorAll('.tag-chip')] as HTMLElement[];
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('Alerta');
    expect(chips[1].textContent).toContain('VIP');
    expect(chips[1].style.backgroundColor).toBe('rgb(229, 231, 235)');
    expect((fixture.nativeElement.querySelector('.tag-more') as HTMLElement).textContent).toContain('+1 más');
  });

  it('allows removing manual tags but protects automatic tags', () => {
    const manual = makeAssignedTag(1, 'Manual');
    const automatic = makeAssignedTag(2, 'Automática', { tipoAsignacion: 'AUTOMATICO' });
    fixture.componentRef.setInput('tags', [manual, automatic]);
    fixture.componentRef.setInput('showRemove', true);
    const removed: ReservaTagAsignado[] = [];
    fixture.componentInstance.removeTag.subscribe((tag) => removed.push(tag));
    fixture.detectChanges();

    const removeButtons = fixture.nativeElement.querySelectorAll('.tag-chip__remove') as NodeListOf<HTMLButtonElement>;
    expect(removeButtons.length).toBe(1);
    removeButtons[0].click();
    expect(removed).toEqual([manual]);
    expect(fixture.nativeElement.textContent).toContain('Automática');
  });
});

function makeAssignedTag(idTag: number, nombre: string, overrides: Partial<ReservaTagAsignado> = {}): ReservaTagAsignado {
  return {
    idAsignacion: idTag,
    codReserva: 'RSV-1',
    idCategoria: 1,
    categoria: 'Experiencia',
    ordenCategoria: 10,
    idTag,
    nombre,
    descripcion: 'Descripción',
    color: '#DBEAFE',
    icono: 'tag',
    prioridad: 0,
    esAlerta: false,
    permiteAsignacionManual: true,
    grupoExclusion: null,
    tipoAsignacion: 'MANUAL',
    origen: 'RESERVA',
    observacion: null,
    fechaAsignacion: '2026-08-24T11:11:13',
    operadorAsignacion: 'CHARLY',
    ...overrides
  };
}
