import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ReservationPrepaymentsComponent } from './reservation-prepayments.component';

describe('ReservationPrepaymentsComponent', () => {
  let component: ReservationPrepaymentsComponent;
  let fixture: ComponentFixture<ReservationPrepaymentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationPrepaymentsComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ReservationPrepaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

