import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { DocumentPrintService } from './document-print.service';

describe('DocumentPrintService', () => {
  let service: DocumentPrintService;
  let http: HttpTestingController;
  const reference = { tipoDocu: 'F/1', serieDocu: '0007', numDocu: '0000042' };
  const pdf = () => new Blob(['%PDF-1.7 test'], { type: 'application/pdf' });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DocumentPrintService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the traditional route with encoded string identifiers and blob response', async () => {
    const result = firstValueFrom(service.getInvoicePdf(reference, 'traditional'));
    const request = http.expectOne(`${environment.apiUrl}/facturas/F%2F1/0007/0000042/pdf`);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(pdf());
    expect((await result).type).toBe('application/pdf');
  });

  it('requests the cost-center route and preserves leading zeroes', async () => {
    const result = firstValueFrom(service.getInvoicePdf(reference, 'cost-center'));
    const request = http.expectOne(`${environment.apiUrl}/facturas/F%2F1/0007/0000042/pdf-centro-costo`);
    request.flush(pdf());
    expect((await result).size).toBeGreaterThan(5);
  });

  it('rejects incomplete references without issuing a request', async () => {
    await expectAsync(firstValueFrom(service.getInvoicePdf({ ...reference, serieDocu: ' ' }, 'traditional')))
      .toBeRejectedWithError('La referencia de la factura está incompleta.');
    http.expectNone(() => true);
  });

  it('rejects a successful non-PDF response', async () => {
    const result = firstValueFrom(service.getInvoicePdf(reference, 'traditional'));
    http.expectOne((request) => request.responseType === 'blob').flush(new Blob(['oops'], { type: 'text/plain' }));
    await expectAsync(result).toBeRejectedWithError('El archivo recibido no es un PDF válido.');
  });

  it('propagates HTTP errors', async () => {
    const result = firstValueFrom(service.getInvoicePdf(reference, 'traditional'));
    http.expectOne((request) => request.url.endsWith('/pdf')).flush(new Blob(['missing']), { status: 404, statusText: 'Not Found' });
    await expectAsync(result).toBeRejected();
  });

  it('opens the PDF in a supplied window and keeps its URL alive for the viewer grace period', () => {
    const objectUrl = 'blob:test-pdf';
    const previewDocument = document.implementation.createHTMLDocument();
    const reserved = { closed: false, opener: window, document: previewDocument } as unknown as Window;
    spyOn(URL, 'createObjectURL').and.returnValue(objectUrl);
    const revoke = spyOn(URL, 'revokeObjectURL');
    const timeout = spyOn(window, 'setTimeout').and.returnValue(1);
    expect(service.openPdf(pdf(), 'invoice.pdf', reserved)).toBe('opened');
    expect(previewDocument.querySelector('iframe')?.getAttribute('src')).toBe(objectUrl);
    expect(previewDocument.querySelector('a[download="invoice.pdf"]')?.getAttribute('href')).toBe(objectUrl);
    expect(timeout).toHaveBeenCalledWith(jasmine.any(Function), 30 * 60 * 1000);
    expect(revoke).not.toHaveBeenCalled();
    const release = timeout.calls.mostRecent().args[0] as () => void;
    release();
    expect(revoke).toHaveBeenCalledOnceWith(objectUrl);
  });

  it('downloads instead when the browser blocks opening a new tab', () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test-pdf');
    spyOn(URL, 'revokeObjectURL');
    spyOn(window, 'open').and.returnValue(null);
    spyOn(HTMLAnchorElement.prototype, 'click');
    expect(service.openPdf(pdf(), 'invoice.pdf')).toBe('downloaded');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});
