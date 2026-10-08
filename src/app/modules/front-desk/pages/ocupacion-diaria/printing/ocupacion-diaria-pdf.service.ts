import { Injectable, inject } from '@angular/core';
import type { Content, TableCell, TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { HotelLogoService } from 'src/app/core/services/hotel-logo.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  EstadoOcupacionDiaria,
  OcupacionDiariaHabitacion,
  OcupacionDiariaResumen
} from '../models/ocupacion-diaria.model';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export interface OcupacionDiariaPdfData {
  fecha: string;
  resumen: OcupacionDiariaResumen;
  habitaciones: OcupacionDiariaHabitacion[];
}

interface PdfPageRooms {
  left: OcupacionDiariaHabitacion[];
  right: OcupacionDiariaHabitacion[];
}

@Injectable({ providedIn: 'root' })
export class OcupacionDiariaPdfService {
  private static readonly ROWS_PER_SIDE = 42;
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly hotelLogoService = inject(HotelLogoService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;
  private hotelLogoPromise?: Promise<string>;

  async open(data: OcupacionDiariaPdfData): Promise<'opened' | 'downloaded'> {
    if (!data.habitaciones.length) {
      throw new Error('No hay habitaciones cargadas para exportar.');
    }

    const previewWindow = this.reservePreviewWindow();

    try {
      const [pdfMake, hotelLogo] = await Promise.all([this.getPdfMake(), this.getHotelLogo()]);
      const definition = this.buildDocumentDefinition(data, hotelLogo);
      const blob = await pdfMake.createPdf(definition).getBlob();
      const validatedBlob = await this.validatePdfBlob(blob);
      const filename = this.filename(data.fecha);

      if (previewWindow && !previewWindow.closed) {
        this.renderPreview(previewWindow, validatedBlob, filename);
        return 'opened';
      }

      this.downloadBlob(validatedBlob, filename);
      return 'downloaded';
    } catch (error) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close();
      }
      throw error;
    }
  }

  private async getPdfMake(): Promise<PdfMakeBrowser> {
    if (!this.pdfMakePromise) {
      this.pdfMakePromise = Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts')
      ]).then(([pdfMakeModule, fontsModule]) => {
        const pdfMake = (pdfMakeModule as unknown as { default?: PdfMakeBrowser }).default
          ?? (pdfMakeModule as unknown as PdfMakeBrowser);
        const fonts = (fontsModule as unknown as { default?: Record<string, string> }).default
          ?? (fontsModule as unknown as Record<string, string>);
        pdfMake.addVirtualFileSystem(fonts);
        return pdfMake;
      });
    }
    return this.pdfMakePromise;
  }

  private getHotelLogo(): Promise<string> {
    if (!this.hotelLogoPromise) {
      this.hotelLogoPromise = this.hotelLogoService.getLogoDataUrl(
        this.empresaContext.getSnapshot(),
        this.hotelLogoService.defaultPdfLogo
      );
    }
    return this.hotelLogoPromise;
  }

  private buildDocumentDefinition(data: OcupacionDiariaPdfData, hotelLogo: string): TDocumentDefinitions {
    const company = this.empresaContext.empresa();
    const companyName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const pages = this.splitPages(data.habitaciones);
    const content: Content[] = [];

    pages.forEach((page, index) => {
      const pageContent: Content[] = [
        this.buildHeader(companyName, hotelLogo, data.fecha),
        ...(index === 0 ? [this.buildSummary(data.resumen), this.buildLegend()] : []),
        this.buildParallelTables(page)
      ];
      content.push({
        stack: pageContent,
        ...(index < pages.length - 1 ? { pageBreak: 'after' as const } : {})
      } as Content);
    });

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [24, 20, 24, 28],
      info: { title: 'Reporte de Ocupación Diaria', author: companyName, subject: 'Front Desk - Ocupación Diaria' },
      defaultStyle: { font: 'Roboto', fontSize: 6.4, color: '#26364A', lineHeight: 1.02 },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [24, 6, 24, 0],
        columns: [
          { text: 'PMSNext Hotelero · Front Desk', color: '#718096', fontSize: 6.5 },
          { text: `Página ${currentPage} / ${pageCount}`, alignment: 'right', color: '#718096', fontSize: 6.5 }
        ]
      }),
      content,
      styles: {
        companyName: { bold: true, fontSize: 10.5, color: '#17364F' },
        documentTitle: { bold: true, fontSize: 12, color: '#17364F', characterSpacing: 0.55 },
        documentDate: { fontSize: 7.5, color: '#52677A', margin: [0, 3, 0, 0] },
        summary: { fontSize: 7.2, color: '#405469' },
        tableHeader: { bold: true, fontSize: 6.2, color: '#FFFFFF' },
        tableCell: { fontSize: 6.2, color: '#26364A' },
        tableCellStrong: { bold: true, fontSize: 6.3, color: '#17364F' },
        legend: { fontSize: 6.4, color: '#66758A' }
      }
    };
  }

  private buildHeader(companyName: string, hotelLogo: string, fecha: string): Content {
    return {
      stack: [
        {
          columns: [
            { width: 62, image: hotelLogo, fit: [54, 34], alignment: 'left' },
            { width: '*', stack: [{ text: companyName, style: 'companyName' }, { text: `Fecha consultada: ${this.displayDate(fecha)}`, style: 'documentDate' }] },
            { width: 245, stack: [{ text: 'REPORTE DE OCUPACIÓN DIARIA', style: 'documentTitle', alignment: 'right' }, { text: 'INVENTARIO DE HABITACIONES', style: 'legend', alignment: 'right', margin: [0, 2, 0, 0] }] }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 744, y2: 0, lineWidth: 1.5, lineColor: '#167D8D' }], margin: [0, 5, 0, 6] }
      ]
    };
  }

  private buildSummary(resumen: OcupacionDiariaResumen): Content {
    const text = [
      `${resumen.habitaciones} Habitaciones`,
      `${resumen.disponibles} Disponibles`,
      `${resumen.reservadas} Reservadas`,
      `${resumen.ocupadas} Ocupadas`,
      `${resumen.bloqueadas} Bloqueadas`,
      `${resumen.adultos} Adultos`,
      `${resumen.ninos} Niños`
    ].join('  |  ');
    return { text, style: 'summary', fillColor: '#F4F8FA', margin: [7, 5, 7, 5] };
  }

  private buildLegend(): Content {
    return {
      text: '● Disponible    ● Reservada    ● Ocupada    ● Bloqueada    |    N = Niños',
      style: 'legend',
      margin: [2, 4, 0, 7]
    };
  }

  private buildParallelTables(page: PdfPageRooms): Content {
    return {
      columns: [
        { width: '*', table: this.buildRoomTable(page.left), layout: this.tableLayout() },
        { width: 10, text: '' },
        { width: '*', table: this.buildRoomTable(page.right), layout: this.tableLayout() }
      ],
      columnGap: 0
    };
  }

  private buildRoomTable(habitaciones: OcupacionDiariaHabitacion[]): { widths: number[]; headerRows: number; body: TableCell[][] } {
    return {
      // El padding de pdfmake se suma al ancho declarado; estos valores dejan
      // espacio suficiente para que Plan no se desborde en el bloque derecho.
      widths: [34, 145, 27, 96, 31],
      headerRows: 1,
      body: [
        [this.headerCell('Hab'), this.headerCell('Reserva / Descripción'), this.headerCell('Pax', 'center'), this.headerCell('Agencia'), this.headerCell('Plan', 'center')],
        ...habitaciones.map((habitacion) => this.roomRow(habitacion))
      ]
    };
  }

  private roomRow(habitacion: OcupacionDiariaHabitacion): TableCell[] {
    const estado = this.normalizeEstado(habitacion.estado);
    const fillColor = this.stateFill(estado);
    const cell = (text: string, style = 'tableCell', alignment: 'left' | 'center' = 'left'): TableCell => ({ text, style, alignment, fillColor });
    return [
      cell(String(habitacion.numeroHabitacion), 'tableCellStrong'),
      this.textCell(habitacion.reservaDescripcion, fillColor, 'left', 34),
      cell(this.formatPax(habitacion.cantidadPax, habitacion.cantidadNinos), 'tableCell', 'center'),
      this.textCell(habitacion.agencia, fillColor, 'left', 18),
      this.textCell(habitacion.tipoPlan, fillColor, 'center', 7)
    ];
  }

  private textCell(value: string | number | null | undefined, fillColor: string, alignment: 'left' | 'center', maxChars: number): TableCell {
    const text = this.wrapText(value, maxChars);
    return {
      text,
      style: 'tableCell',
      alignment,
      fillColor,
      ...(text.includes('\n') ? { fontSize: 5.7, lineHeight: 0.95 } : {})
    };
  }

  private headerCell(text: string, alignment: 'left' | 'center' = 'left'): TableCell {
    return { text, alignment, style: 'tableHeader', fillColor: '#173A56' };
  }

  private tableLayout() {
    return {
      hLineWidth: () => 0.45,
      vLineWidth: () => 0.45,
      hLineColor: () => '#C9D5E0',
      vLineColor: () => '#C9D5E0',
      paddingTop: (rowIndex: number) => rowIndex === 0 ? 3 : 1.2,
      paddingBottom: (rowIndex: number) => rowIndex === 0 ? 3 : 1.2,
      paddingLeft: () => 3,
      paddingRight: () => 3
    };
  }

  private splitPages(habitaciones: OcupacionDiariaHabitacion[]): PdfPageRooms[] {
    const pageSize = OcupacionDiariaPdfService.ROWS_PER_SIDE * 2;
    const pages: PdfPageRooms[] = [];
    for (let offset = 0; offset < habitaciones.length; offset += pageSize) {
      pages.push({
        left: habitaciones.slice(offset, offset + OcupacionDiariaPdfService.ROWS_PER_SIDE),
        right: habitaciones.slice(offset + OcupacionDiariaPdfService.ROWS_PER_SIDE, offset + pageSize)
      });
    }
    return pages;
  }

  private formatPax(pax: number, children: number): string {
    const adults = Number(pax ?? 0);
    const ninos = Number(children ?? 0);
    return ninos > 0 ? `${adults}+${ninos}N` : String(adults);
  }

  private normalizeEstado(estado: string): EstadoOcupacionDiaria | '' {
    const normalized = (estado ?? '').trim().toUpperCase();
    return ['DISPONIBLE', 'RESERVADA', 'OCUPADA', 'BLOQUEADA'].includes(normalized)
      ? normalized as EstadoOcupacionDiaria
      : '';
  }

  private stateFill(estado: EstadoOcupacionDiaria | ''): string {
    switch (estado) {
      case 'RESERVADA': return '#FFF9E8';
      case 'OCUPADA': return '#FFF1F0';
      case 'BLOQUEADA': return '#F5F1FA';
      default: return '#FFFFFF';
    }
  }

  private truncate(value: string | number | null | undefined, maxLength: number): string {
    const text = String(value ?? '').trim();
    return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...` : text;
  }

  private wrapText(value: string | number | null | undefined, maxCharsPerLine: number): string {
    const text = String(value ?? '').trim();
    if (!text || text.length <= maxCharsPerLine) return text;

    const words = text.split(/\s+/);
    let firstLine = '';
    let remainder = '';
    words.forEach((word) => {
      const candidate = firstLine ? `${firstLine} ${word}` : word;
      if (!remainder && candidate.length <= maxCharsPerLine) {
        firstLine = candidate;
      } else {
        remainder = remainder ? `${remainder} ${word}` : word;
      }
    });

    return firstLine && remainder
      ? `${firstLine}\n${this.truncate(remainder, maxCharsPerLine)}`
      : this.truncate(text, maxCharsPerLine);
  }

  private displayDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || value || 'N/D';
  }

  private reservePreviewWindow(): Window | null {
    const preview = window.open('', '_blank');
    if (!preview) return null;
    preview.opener = null;
    preview.document.title = 'Generando reporte de ocupación diaria';
    preview.document.body.innerHTML = '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando reporte PDF...</div>';
    return preview;
  }

  private async validatePdfBlob(blob: Blob): Promise<Blob> {
    if (!(blob instanceof Blob) || blob.size < 5) throw new Error('El PDF generado está vacío.');
    const bytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...bytes) !== '%PDF-') throw new Error('El archivo generado no es un PDF válido.');
    return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  }

  private renderPreview(preview: Window, blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const doc = preview.document;
    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte de Ocupación Diaria</title><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}body{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#e8eef5;color:#17364f;font-family:Arial,sans-serif}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:62px;padding:11px 20px;background:#fff;border-bottom:1px solid #ced9e5}.title strong,.title span{display:block}.title strong{font-size:16px}.title span{margin-top:3px;color:#64748b;font-size:12px}.download{display:inline-flex;align-items:center;justify-content:center;min-height:39px;padding:0 16px;border-radius:9px;color:#fff;background:#1554c8;font-size:13px;font-weight:700;text-decoration:none}.viewer{position:relative;min-height:0;padding:12px}.viewer iframe{position:relative;z-index:1;width:100%;height:100%;border:0;border-radius:9px;background:#fff;box-shadow:0 12px 34px rgba(15,35,55,.14)}@media(max-width:640px){.toolbar{align-items:stretch;flex-direction:column}.download{width:100%}}</style></head><body><header class="toolbar"><div class="title"><strong>Reporte de Ocupación Diaria</strong><span id="filename"></span></div><a id="download" class="download">Descargar PDF</a></header><main class="viewer"><iframe id="pdfViewer" title="Reporte de Ocupación Diaria"></iframe></main></body></html>`);
    doc.close();
    const filenameNode = doc.getElementById('filename');
    const downloadLink = doc.getElementById('download') as HTMLAnchorElement | null;
    const viewer = doc.getElementById('pdfViewer') as HTMLIFrameElement | null;
    if (!filenameNode || !downloadLink || !viewer) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('No se pudo inicializar la vista previa del PDF.');
    }
    filenameNode.textContent = filename;
    downloadLink.href = objectUrl;
    downloadLink.download = filename;
    downloadLink.rel = 'noopener';
    viewer.src = objectUrl;
    preview.addEventListener('beforeunload', () => URL.revokeObjectURL(objectUrl), { once: true });
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
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  private filename(fecha: string): string {
    const normalized = normalizePmsDateDDMMYYYY(fecha);
    const safeDate = normalized ? normalized.split('/').reverse().join('-') : 'sin-fecha';
    return `ocupacion-diaria-${safeDate}.pdf`;
  }
}
