import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from 'src/environments/environment';
import { InHouseGuestsComponent } from './in-house-guests.component';

describe('InHouseGuestsComponent', () => {
  let component: InHouseGuestsComponent;
  let fixture: ComponentFixture<InHouseGuestsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InHouseGuestsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(InHouseGuestsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const request = httpMock.expectOne((req) => req.url === `${environment.apiUrl}/pax-in-house/lista-completa`);
    request.flush({
      pax: [],
      totalHabitaciones: 0,
      totalAdultos: 0,
      totalNinos: 0,
      totalHuespedes: 0,
      respuesta: ''
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
