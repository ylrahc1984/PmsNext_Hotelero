import { TestBed } from '@angular/core/testing';
import { IdentityDocumentCardComponent, IdentityDocumentVisualState } from './identity-document-card.component';

describe('IdentityDocumentCardComponent presentation', () => {
  it('renders the document states without a stored image by default', async () => {
    await TestBed.configureTestingModule({ imports: [IdentityDocumentCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(IdentityDocumentCardComponent);
    fixture.componentRef.setInput('documentLabel', 'Passport');
    fixture.componentRef.setInput('storedAtLabel', 'Sep 4, 2026 20:53');
    fixture.componentRef.setInput('storedByLabel', 'DEMO');
    fixture.componentRef.setInput('fileName', 'example.jpg');
    fixture.componentRef.setInput('fileSizeLabel', '95.7 KB');

    const states: Record<IdentityDocumentVisualState, string> = {
      empty: 'Add identity document',
      ready: 'Image ready to upload',
      'preparing-rooming': 'Preparing guest record...',
      uploading: 'Uploading document...',
      stored: 'Document stored',
      replacing: 'Replacing document...',
      deleting: 'Deleting document...',
      error: "We couldn't save the document."
    };
    for (const [state, label] of Object.entries(states)) {
      fixture.componentRef.setInput('state', state);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(label);
      expect(fixture.nativeElement.querySelector('img, input[type="file"]')).toBeNull();
      for (const button of Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)) {
        expect(button.type).toBe('button');
        expect(button.disabled).toBe(state === 'preparing-rooming' || state === 'uploading' || state === 'replacing' || state === 'deleting');
      }
      if (state === 'stored') {
        expect(fixture.nativeElement.textContent).toContain('Identity document');
        expect(fixture.nativeElement.textContent).toContain('Passport');
        expect(fixture.nativeElement.textContent).toContain('example.jpg · 95.7 KB');
        expect(fixture.nativeElement.textContent).toContain('Sep 4, 2026 20:53');
        expect(fixture.nativeElement.textContent).toContain('DEMO');
        expect(fixture.nativeElement.querySelector('.document-card__delete').textContent).toBe('Delete');
      }
    }
  });
});
