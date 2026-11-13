import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ModuleAccessState } from 'src/app/core/models/module-access.models';
import { AuthService } from 'src/app/core/services/auth.service';
import { LockScreenService } from 'src/app/core/services/lock-screen.service';
import { ModuleAccessService } from 'src/app/core/services/module-access.service';
import { PushNotificationService } from 'src/app/core/services/push-notification.service';
import { GuestRequestNotificationService } from 'src/app/modules/clientes-huespedes/solicitudes-huespedes/guest-request-notification.service';
import { NavRightComponent } from './nav-right.component';

describe('NavRightComponent Quick Occupancy permission', () => {
  let modules: ReadonlySet<string>;
  let accessState: ModuleAccessState;

  const moduleAccessFake = {
    get snapshot(): ModuleAccessState {
      return accessState;
    },
    loadForUser: jasmine.createSpy('loadForUser').and.callFake(() => of(modules)),
    hasAccess(required: readonly string[], mode: 'any' | 'all' = 'any', state = accessState): boolean {
      if (!required.length) return true;
      if (state.status !== 'loaded') return false;
      return mode === 'all' ? required.every((item) => state.modules.has(item)) : required.some((item) => state.modules.has(item));
    }
  };

  beforeEach(async () => {
    modules = new Set(['FRONT']);
    accessState = { status: 'loaded', usuario: 'operador', modules, error: null };
    moduleAccessFake.loadForUser.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser$: of({ usuario: 'operador' }), getCurrentUser: () => ({ usuario: 'operador' }) } },
        { provide: ModuleAccessService, useValue: moduleAccessFake },
        {
          provide: GuestRequestNotificationService,
          useValue: { pendientesRecientes: () => [], cantidadPendientes: () => 0, start: jasmine.createSpy('start') }
        },
        {
          provide: PushNotificationService,
          useValue: {
            state: () => ({ status: 'disabled', message: '' }),
            refreshAvailability: jasmine.createSpy('refreshAvailability'),
            activate: jasmine.createSpy('activate'),
            deactivate: jasmine.createSpy('deactivate')
          }
        },
        { provide: LockScreenService, useValue: { requestLock: jasmine.createSpy('requestLock') } }
      ]
    });
    TestBed.overrideComponent(NavRightComponent, {
      set: {
        imports: [CommonModule],
        template:
          '@if (canUseQuickOccupancy) { <button class="availability-trigger" (click)="requestQuickOccupancy()">Disponibilidad</button> }'
      }
    });
    await TestBed.compileComponents();
  });

  it('shows and emits the availability action for FRONT access', () => {
    const fixture = TestBed.createComponent(NavRightComponent);
    const emitted = jasmine.createSpy('quickOccupancyRequested');
    fixture.componentInstance.quickOccupancyRequested.subscribe(emitted);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.availability-trigger')).not.toBeNull();
    (fixture.nativeElement.querySelector('.availability-trigger') as HTMLButtonElement).click();
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('shows and emits the availability action for RESER access', () => {
    modules = new Set(['RESER']);
    accessState = { ...accessState, modules };
    const fixture = TestBed.createComponent(NavRightComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.availability-trigger')).not.toBeNull();
  });

  it('hides the availability action and refuses to emit when no module is authorized', () => {
    modules = new Set();
    accessState = { ...accessState, modules };
    const fixture = TestBed.createComponent(NavRightComponent);
    const emitted = jasmine.createSpy('quickOccupancyRequested');
    fixture.componentInstance.quickOccupancyRequested.subscribe(emitted);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.availability-trigger')).toBeNull();
    fixture.componentInstance.requestQuickOccupancy();
    expect(emitted).not.toHaveBeenCalled();
  });
});
