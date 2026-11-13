import { Component, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { ModuleAccessState } from 'src/app/core/models/module-access.models';
import { AuthService } from 'src/app/core/services/auth.service';
import { ModuleAccessService } from 'src/app/core/services/module-access.service';
import { OccupancyForecastService } from 'src/app/modules/front-desk/pages/occupancy-forecast/occupancy-forecast.service';
import { QuickOccupancyComponent } from 'src/app/modules/front-desk/pages/quick-occupancy/quick-occupancy.component';
import { RoomCategoriesService } from 'src/app/modules/front-desk/settings/room-categories/services/room-categories.service';
import { AdminComponent } from './admin.component';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  template: '<button type="button" class="availability-trigger" (click)="quickOccupancyRequested.emit()">Disponibilidad</button>'
})
class TestNavBarComponent {
  readonly quickOccupancyRequested = output<void>();
}

@Component({ standalone: true, template: '<div class="active-screen">Formulario detrás del panel</div>' })
class TestAdminScreenComponent {}

describe('AdminComponent Quick Occupancy integration', () => {
  let modules: ReadonlySet<string>;
  let accessState: ModuleAccessState;
  let forecastService: jasmine.SpyObj<OccupancyForecastService>;

  const moduleAccessFake = {
    get snapshot(): ModuleAccessState {
      return accessState;
    },
    hasAccess(required: readonly string[], mode: 'any' | 'all' = 'any', state = accessState): boolean {
      if (!required.length) return true;
      if (state.status !== 'loaded') return false;
      return mode === 'all' ? required.every((item) => state.modules.has(item)) : required.some((item) => state.modules.has(item));
    }
  };

  async function openHarness(): Promise<RouterTestingHarness> {
    return RouterTestingHarness.create('/stay');
  }

  beforeEach(async () => {
    modules = new Set(['FRONT']);
    accessState = { status: 'loaded', usuario: 'operador', modules, error: null };
    forecastService = jasmine.createSpyObj<OccupancyForecastService>('OccupancyForecastService', ['getForecast']);
    forecastService.getForecast.and.returnValue(of([]));
    const categoriesService = jasmine.createSpyObj<RoomCategoriesService>('RoomCategoriesService', ['getRoomCategories']);
    categoriesService.getRoomCategories.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: AdminComponent,
            children: [{ path: 'stay', component: TestAdminScreenComponent }]
          }
        ]),
        { provide: AuthService, useValue: { getCurrentUser: () => ({ usuario: 'operador' }) } },
        { provide: ModuleAccessService, useValue: moduleAccessFake },
        { provide: OccupancyForecastService, useValue: forecastService },
        { provide: RoomCategoriesService, useValue: categoriesService }
      ]
    });
    TestBed.overrideComponent(AdminComponent, {
      set: {
        imports: [RouterOutlet, TestNavBarComponent, QuickOccupancyComponent],
        template:
          '<app-nav-bar (quickOccupancyRequested)="requestQuickOccupancy()"></app-nav-bar>' +
          '<router-outlet></router-outlet>' +
          '<app-quick-occupancy [open]="quickOccupancyOpen" [canOpenQuickOccupancy]="canUseQuickOccupancy" ' +
          '[canOpenFullForecast]="canOpenFullForecast" (openChange)="onQuickOccupancyOpenChange($event)"></app-quick-occupancy>'
      }
    });
    await TestBed.compileComponents();
  });

  it('opens for FRONT access without changing the active route, screen, or issuing an automatic query', async () => {
    const harness = await openHarness();
    const screen = harness.routeNativeElement!.querySelector('.active-screen');
    const trigger = harness.routeNativeElement!.querySelector('.availability-trigger') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    harness.detectChanges();

    const panel = harness.routeNativeElement!.querySelector('[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('.active-screen')).toBe(screen);
    expect(TestBed.inject(Router).url).toBe('/stay');
    expect(forecastService.getForecast).not.toHaveBeenCalled();
  });

  it('opens for RESER access and hides the FRONT-only full forecast link', async () => {
    modules = new Set(['RESER']);
    accessState = { ...accessState, modules };
    const harness = await openHarness();
    (harness.routeNativeElement!.querySelector('.availability-trigger') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(harness.routeNativeElement!.querySelector('[role="dialog"]')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('.quick-occupancy__footer a')).toBeNull();
  });

  it('does not open when the user has neither FRONT nor RESER access', async () => {
    modules = new Set();
    accessState = { ...accessState, modules };
    const harness = await openHarness();
    (harness.routeNativeElement!.querySelector('.availability-trigger') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(harness.routeNativeElement!.querySelector('[role="dialog"]')).toBeNull();
    expect(forecastService.getForecast).not.toHaveBeenCalled();
  });

  it('shows the complete forecast link for FRONT access and clears panel state when closed', async () => {
    modules = new Set(['FRONT']);
    accessState = { ...accessState, modules };
    const harness = await openHarness();
    const trigger = harness.routeNativeElement!.querySelector('.availability-trigger') as HTMLButtonElement;
    trigger.click();
    harness.detectChanges();

    expect(harness.routeNativeElement!.querySelector('.quick-occupancy__footer a')?.getAttribute('href')).toBe(
      '/front-desk/occupancy-forecast'
    );
    (harness.routeNativeElement!.querySelector('.quick-occupancy__close') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="dialog"]')).toBeNull();
    expect(forecastService.getForecast).not.toHaveBeenCalled();
  });
});
