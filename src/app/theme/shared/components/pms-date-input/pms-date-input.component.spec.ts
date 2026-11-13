import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { PmsDateInputComponent } from './pms-date-input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, PmsDateInputComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="submitted = true">
      <app-pms-date-input formControlName="date" [min]="'01/01/2026'" [max]="'31/12/2028'" />
      <button type="submit">Consultar</button>
    </form>
  `
})
class ReactiveHostComponent {
  form = new FormGroup({ date: new FormControl<string | null>(null) });
  submitted = false;
}

@Component({
  standalone: true,
  imports: [FormsModule, PmsDateInputComponent],
  template: `
    <app-pms-date-input [(ngModel)]="date" name="date" />
  `
})
class TemplateDrivenHostComponent {
  date: string | null = null;
}

describe('PmsDateInputComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReactiveHostComponent, TemplateDrivenHostComponent] }).compileComponents();
  });

  function createReactiveFixture(): ComponentFixture<ReactiveHostComponent> {
    const fixture = TestBed.createComponent(ReactiveHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  function getTextInput(fixture: ComponentFixture<ReactiveHostComponent>): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="text"]');
  }

  it('normalizes compact and separated dates on blur and updates Reactive Forms', () => {
    const fixture = createReactiveFixture();
    const input = getTextInput(fixture);

    input.value = '20112026';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.date.value).toBe('20/11/2026');
    expect(input.value).toBe('20112026');

    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('20/11/2026');

    input.value = '01012027';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.date.value).toBe('01/01/2027');
  });

  it('accepts valid leap days and rejects impossible or incomplete dates without losing typed text', () => {
    const fixture = createReactiveFixture();
    const input = getTextInput(fixture);

    input.value = '29022028';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.date.value).toBe('29/02/2028');
    expect(fixture.componentInstance.form.controls.date.valid).toBeTrue();

    input.value = '31112026';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('31112026');
    expect(fixture.componentInstance.form.controls.date.value).toBeNull();
    expect(fixture.componentInstance.form.controls.date.invalid).toBeTrue();

    input.value = '201120';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.date.invalid).toBeTrue();
  });

  it('accepts separated dates, treats empty as null, and applies configured limits', () => {
    const fixture = createReactiveFixture();
    const input = getTextInput(fixture);
    const control = fixture.componentInstance.form.controls.date;

    input.value = '20/11/2026';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(control.value).toBe('20/11/2026');
    expect(control.valid).toBeTrue();

    input.value = '31/12/2025';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(control.value).toBeNull();
    expect(control.invalid).toBeTrue();

    input.value = '01012029';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(control.value).toBeNull();
    expect(control.invalid).toBeTrue();

    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(control.value).toBeNull();
    expect(control.valid).toBeTrue();
  });

  it('updates the value from the native calendar and disables both controls', () => {
    const fixture = createReactiveFixture();
    const host = fixture.componentInstance;
    const calendar = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;

    calendar.value = '2028-02-29';
    calendar.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.form.controls.date.value).toBe('29/02/2028');

    host.form.controls.date.disable();
    fixture.detectChanges();
    expect(getTextInput(fixture).disabled).toBeTrue();
    expect(calendar.disabled).toBeTrue();
  });

  it('exposes programmatic focus and leaves Enter to the consumer form', () => {
    const fixture = createReactiveFixture();
    const host = fixture.componentInstance;
    const dateControl = fixture.debugElement.query((node) => node.componentInstance instanceof PmsDateInputComponent);
    const dateInputComponent = dateControl.componentInstance as PmsDateInputComponent;
    const input = getTextInput(fixture);

    host.form.controls.date.setValue('20/11/2026');
    fixture.detectChanges();
    dateInputComponent.focus();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBeFalse();

    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBeFalse();

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBeFalse();
    expect(host.submitted).toBeFalse();
  });

  it('supports template-driven ngModel forms', async () => {
    const fixture = TestBed.createComponent(TemplateDrivenHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;

    input.value = '01012027';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.date).toBe('01/01/2027');
  });

  it('closes the visible fallback calendar on Escape', () => {
    const fixture = createReactiveFixture();
    const dateControl = fixture.debugElement.query((node) => node.componentInstance instanceof PmsDateInputComponent);
    const component = dateControl.componentInstance as PmsDateInputComponent;
    component.fallbackCalendarVisible = true;
    fixture.detectChanges();
    const calendar = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;

    calendar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(component.fallbackCalendarVisible).toBeFalse();
  });

  it('uses showPicker when available and exposes the fallback if it throws', () => {
    const fixture = createReactiveFixture();
    const dateControl = fixture.debugElement.query((node) => node.componentInstance instanceof PmsDateInputComponent);
    const component = dateControl.componentInstance as PmsDateInputComponent;
    const calendar = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement & { showPicker?: () => void };
    const showPicker = jasmine.createSpy('showPicker');
    Object.defineProperty(calendar, 'showPicker', { configurable: true, value: showPicker });

    component.openCalendar();
    expect(showPicker).toHaveBeenCalled();
    expect(component.fallbackCalendarVisible).toBeFalse();

    Object.defineProperty(calendar, 'showPicker', {
      configurable: true,
      value: () => {
        throw new Error('Picker unavailable');
      }
    });
    component.openCalendar();
    expect(component.fallbackCalendarVisible).toBeTrue();
  });
});
