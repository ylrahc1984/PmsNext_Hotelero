import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export type InvoicePdfFormat = 'traditional' | 'cost-center';

export interface InvoicePdfReference {
  tipoDocu: string;
  serieDocu: string;
  numDocu: string;
}

const URL_FALLBACK_REVOKE_MS = 30 * 60 * 1000;
const DOWNLOAD_REVOKE_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class DocumentPrintService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = (environment.apiUrl || '').toString().replace(/\/+$/, '');

  getInvoicePdf(reference: InvoicePdfReference, format: InvoicePdfFormat): Observable<Blob> {
    if (!reference || !reference.tipoDocu?.trim() || !reference.serieDocu?.trim() || !reference.numDocu?.trim()) {
      return throwError(() => new Error('La referencia de la factura está incompleta.'));
    }
    if (format !== 'traditional' && format !== 'cost-center') {
      return throwError(() => new Error('El formato de PDF solicitado no es válido.'));
    }

    const suffix = format === 'traditional' ? 'pdf' : 'pdf-centro-costo';
    const url = `${this.apiUrl}/facturas/${encodeURIComponent(reference.tipoDocu)}/${encodeURIComponent(reference.serieDocu)}/${encodeURIComponent(reference.numDocu)}/${suffix}`;

    return this.http.get(url, { responseType: 'blob' }).pipe(
      mergeMap((blob) => from(this.validatePdf(blob)))
    );
  }

  openPdf(blob: Blob, filename: string, reservedWindow?: Window | null): 'opened' | 'downloaded' {
    const pdfBlob = this.asPdfBlob(blob);
    const objectUrl = URL.createObjectURL(pdfBlob);
    let target: Window | null = null;
    try {
      target = reservedWindow && !reservedWindow.closed ? reservedWindow : window.open('', '_blank');
      if (target) {
        this.renderPdfPreview(target, objectUrl, filename);
        this.releaseAfterViewerGracePeriod(objectUrl);
        return 'opened';
      }
    } catch {
      // If opening or navigating the tab fails, download the already fetched PDF.
    }

    try {
      this.downloadFromUrl(objectUrl, filename);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), DOWNLOAD_REVOKE_MS);
      return 'downloaded';
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  downloadPdf(blob: Blob, filename: string): void {
    const pdfBlob = this.asPdfBlob(blob);
    const objectUrl = URL.createObjectURL(pdfBlob);
    try {
      this.downloadFromUrl(objectUrl, filename);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), DOWNLOAD_REVOKE_MS);
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  private async validatePdf(blob: Blob): Promise<Blob> {
    if (!(blob instanceof Blob) || blob.size < 5) {
      throw new Error('El archivo recibido está vacío o no es un PDF válido.');
    }
    const signature = String.fromCharCode(...new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
    if (signature !== '%PDF-') throw new Error('El archivo recibido no es un PDF válido.');
    return this.asPdfBlob(blob);
  }

  private asPdfBlob(blob: Blob): Blob {
    if (!(blob instanceof Blob) || blob.size < 5) throw new Error('El archivo PDF está vacío o no es válido.');
    return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  }

  private downloadFromUrl(objectUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  }

  private renderPdfPreview(target: Window, objectUrl: string, filename: string): void {
    target.opener = null;
    const previewDocument = target.document;
    previewDocument.open();
    previewDocument.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Documento PDF</title></head><body></body></html>');
    previewDocument.close();
    previewDocument.title = filename;

    const style = previewDocument.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; }
      body { display: grid; grid-template-rows: auto minmax(0, 1fr); background: #e9eef5; color: #172b4d; font: 14px Arial, sans-serif; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 58px; padding: 10px 18px; background: #fff; border-bottom: 1px solid #d8e0eb; }
      .filename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
      .actions { display: flex; gap: 8px; }
      button, .download { border: 0; border-radius: 6px; padding: 9px 14px; background: #1456c0; color: #fff; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
      .download { background: #263b53; }
      main { min-height: 0; padding: 10px; }
      iframe { width: 100%; height: 100%; border: 0; background: #fff; }
      #pdfStatus { position: absolute; top: 72px; left: 18px; padding: 8px 12px; background: #fff; }
      #pdfStatus[hidden] { display: none; }
    `;
    previewDocument.head.appendChild(style);

    const header = previewDocument.createElement('header');
    const title = previewDocument.createElement('div');
    title.className = 'filename';
    title.textContent = filename;
    const actions = previewDocument.createElement('div');
    actions.className = 'actions';
    const printButton = previewDocument.createElement('button');
    printButton.type = 'button';
    printButton.textContent = 'Imprimir';
    const downloadLink = previewDocument.createElement('a');
    downloadLink.className = 'download';
    downloadLink.href = objectUrl;
    downloadLink.download = filename;
    downloadLink.textContent = 'Descargar PDF';
    actions.append(printButton, downloadLink);
    header.append(title, actions);

    const main = previewDocument.createElement('main');
    const frame = previewDocument.createElement('iframe');
    frame.title = filename;
    frame.src = objectUrl;
    const status = previewDocument.createElement('div');
    status.id = 'pdfStatus';
    status.textContent = 'Cargando documento PDF…';
    frame.addEventListener('load', () => { status.hidden = true; }, { once: true });
    frame.addEventListener('error', () => { status.textContent = 'No se pudo mostrar el PDF. Puede descargarlo desde esta pestaña.'; }, { once: true });
    printButton.addEventListener('click', () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        status.hidden = false;
        status.textContent = 'No se pudo iniciar la impresión. Use el control de impresión del visor PDF.';
      }
    });
    main.appendChild(frame);
    previewDocument.body.append(header, main, status);
  }

  private releaseAfterViewerGracePeriod(objectUrl: string): void {
    // PDF viewers and browser extensions may unload the tab while handing off the Blob URL.
    // Keep the URL alive through that transition, then release it after a bounded interval.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), URL_FALLBACK_REVOKE_MS);
  }
}
