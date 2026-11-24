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
      if (reservedWindow && !reservedWindow.closed) {
        target = reservedWindow;
        target.location.replace(objectUrl);
      } else {
        target = window.open(objectUrl, '_blank');
        if (target) target.opener = null;
      }
      if (target) {
        this.releaseWhenClosed(target, objectUrl);
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

  private releaseWhenClosed(target: Window, objectUrl: string): void {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    };
    target.addEventListener('beforeunload', release, { once: true });
    window.setTimeout(release, URL_FALLBACK_REVOKE_MS);
  }
}
