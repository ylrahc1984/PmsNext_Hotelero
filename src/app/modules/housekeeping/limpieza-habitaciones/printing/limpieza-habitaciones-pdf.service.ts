import { Injectable, inject } from '@angular/core';
import type { TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { LimpiezaHabitacionesPdfData } from '../models/limpieza-habitacion.model';
import { LimpiezaHabitacionesPdfBuilder } from './limpieza-habitaciones-pdf.builder';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export type LimpiezaHabitacionesPdfResult = 'opened' | 'downloaded';

@Injectable({ providedIn: 'root' })
export class LimpiezaHabitacionesPdfService {
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly builder = new LimpiezaHabitacionesPdfBuilder();
  private pdfMakePromise?: Promise<PdfMakeBrowser>;

  async open(data: LimpiezaHabitacionesPdfData): Promise<LimpiezaHabitacionesPdfResult> {
    const previewWindow = this.reservePreviewWindow();

    try {
      const pdfMake = await this.getPdfMake();
      const company = this.empresaContext.empresa();
      const definition = this.builder.build(data, {
        nombre: (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim(),
        cedula: company?.MA04_Ruc,
        direccion: company?.MA04_Direccion,
        telefono: company?.MA04_Telefono1
      });
      const blob = await pdfMake.createPdf(definition).getBlob();

      if (previewWindow && !previewWindow.closed) {
        const objectUrl = URL.createObjectURL(blob);
        previewWindow.location.replace(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
        return 'opened';
      }

      this.downloadBlob(blob, this.filename(data.fechaOperativa));
      return 'downloaded';
    } catch (error) {
      if (previewWindow && !previewWindow.closed) previewWindow.close();
      throw error;
    }
  }

  private async getPdfMake(): Promise<PdfMakeBrowser> {
    if (!this.pdfMakePromise) {
      this.pdfMakePromise = Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts')
      ]).then(([pdfMakeModule, fontsModule]) => {
        const pdfMake =
          (pdfMakeModule as unknown as { default?: PdfMakeBrowser }).default
          ?? (pdfMakeModule as unknown as PdfMakeBrowser);
        const fonts =
          (fontsModule as unknown as { default?: Record<string, string> }).default
          ?? (fontsModule as unknown as Record<string, string>);
        pdfMake.addVirtualFileSystem(fonts);
        return pdfMake;
      });
    }
    return this.pdfMakePromise;
  }

  private reservePreviewWindow(): Window | null {
    const preview = window.open('', '_blank');
    if (!preview) return null;

    preview.opener = null;
    preview.document.title = 'Generando lista de Housekeeping';
    preview.document.body.innerHTML =
      '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando lista de limpieza...</div>';
    return preview;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  private filename(operationalDate: string): string {
    const date = operationalDate.replace(/[^0-9]+/g, '-') || 'sin-fecha';
    return `Limpieza_Habitaciones_${date}.pdf`;
  }
}
