import { Injectable, inject } from '@angular/core';
import type { Content, TableCell, TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { HotelLogoService } from 'src/app/core/services/hotel-logo.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { ArriboHabitacion, ArriboReserva } from '../models/arribo.model';

type PdfMakeBrowser = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: TDocumentDefinitions): TCreatedPdf;
};

export interface ArribosPdfFilters {
  fechaDesde: string;
  fechaHasta: string;
  agencia: string;
}

interface ArribosTotals {
  reservas: number;
  habitaciones: number;
  adultos: number;
  ninos: number;
}

@Injectable({ providedIn: 'root' })
export class ArribosPdfService {
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly hotelLogoService = inject(HotelLogoService);
  private pdfMakePromise?: Promise<PdfMakeBrowser>;
  private hotelLogoPromise?: Promise<string>;

  async open(filters: ArribosPdfFilters, reservas: ArriboReserva[]): Promise<'opened' | 'downloaded'> {
    if (!reservas.length) {
      throw new Error('No hay arribos visibles para exportar.');
    }

    const previewWindow = this.reservePreviewWindow();

    try {
      const [pdfMake, hotelLogo] = await Promise.all([this.getPdfMake(), this.getHotelLogo()]);
      const blob = await pdfMake.createPdf(this.buildDocumentDefinition(filters, reservas, hotelLogo)).getBlob();
      const validatedBlob = await this.validatePdfBlob(blob);
      const filename = this.filename(filters);

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

  private buildDocumentDefinition(filters: ArribosPdfFilters, reservas: ArriboReserva[], hotelLogo: string): TDocumentDefinitions {
    const company = this.empresaContext.empresa();
    const companyName = (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim();
    const legalName = (company?.MA04_RazonSocial || '').trim();
    const contact = [
      company?.MA04_Direccion,
      [company?.MA04_Ciudad, company?.MA04_Pais].filter(Boolean).join(', '),
      company?.MA04_Telefono1 ? `Tel. ${company.MA04_Telefono1}` : '',
      company?.MA04_Email
    ].filter(Boolean).join('  |  ');
    const totals = this.calculateTotals(reservas);

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [28, 24, 28, 30],
      info: { title: 'Reporte de Arribos', author: companyName, subject: 'Front Desk - Arribos' },
      defaultStyle: { font: 'Roboto', fontSize: 7.5, color: '#26364A', lineHeight: 1.08 },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [28, 7, 28, 0],
        columns: [
          { text: 'PMSNext · Front Desk', color: '#718096', fontSize: 7 },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#718096', fontSize: 7 }
        ]
      }),
      content: [
        this.buildHeader(companyName, legalName, contact, hotelLogo),
        this.buildMetadata(filters),
        this.buildSummary(totals),
        ...this.buildGroupedContent(reservas)
      ],
      styles: {
        companyName: { bold: true, fontSize: 13, color: '#17364F' },
        legalName: { fontSize: 7.8, color: '#4C5F73', margin: [0, 2, 0, 0] },
        companyMeta: { fontSize: 6.5, color: '#66758A', margin: [0, 3, 0, 0] },
        documentTitle: { bold: true, fontSize: 14, color: '#17364F', characterSpacing: 0.75 },
        metadataLabel: { bold: true, fontSize: 7, color: '#52677A', fillColor: '#EDF3F6' },
        metadataValue: { fontSize: 7.2, color: '#26364A' },
        summaryLabel: { bold: true, fontSize: 6.4, color: '#66758A', characterSpacing: 0.45 },
        summaryValue: { bold: true, fontSize: 11, color: '#17364F' },
        dateHeader: { bold: true, fontSize: 10, color: '#17364F', characterSpacing: 0.4 },
        agencyHeader: { bold: true, fontSize: 8.5, color: '#167D8D', characterSpacing: 0.35 },
        reservationCode: { bold: true, fontSize: 8.1, color: '#15385F' },
        reservationLabel: { fontSize: 6.3, color: '#718096', characterSpacing: 0.25 },
        reservationValue: { bold: true, fontSize: 7.3, color: '#26364A' },
        observation: { fontSize: 7, color: '#53627D', lineHeight: 1.15 },
        tableHeader: { bold: true, fontSize: 6.7, color: '#FFFFFF' },
        tableCell: { fontSize: 7, color: '#26364A' },
        roomingEmpty: { italics: true, fontSize: 6.8, color: '#94A3B8' }
      }
    };
  }

  private buildHeader(companyName: string, legalName: string, contact: string, hotelLogo: string): Content {
    return {
      stack: [
        {
          columns: [
            { width: 76, image: hotelLogo, fit: [68, 46], alignment: 'left' },
            {
              width: '*',
              stack: [
                { text: companyName, style: 'companyName' },
                ...(legalName && legalName.toUpperCase() !== companyName.toUpperCase() ? [{ text: legalName, style: 'legalName' } as Content] : []),
                ...(contact ? [{ text: contact, style: 'companyMeta' } as Content] : [])
              ]
            },
            { width: 210, text: 'REPORTE DE ARRIBOS', style: 'documentTitle', alignment: 'right', margin: [8, 5, 0, 0] }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 736, y2: 0, lineWidth: 1.8, lineColor: '#167D8D' }], margin: [0, 6, 0, 8] }
      ]
    };
  }

  private buildMetadata(filters: ArribosPdfFilters): Content {
    return {
      table: {
        widths: [54, 150, 54, 150, 60, '*'],
        body: [
          [this.labelCell('Período'), this.valueCell(`${this.displayDate(filters.fechaDesde)} - ${this.displayDate(filters.fechaHasta)}`), this.labelCell('Agencia'), this.valueCell(filters.agencia || 'Todas'), this.labelCell('Generado'), this.valueCell(this.generatedAt())]
        ]
      },
      layout: this.infoLayout(),
      margin: [0, 0, 0, 8]
    };
  }

  private buildSummary(totals: ArribosTotals): Content {
    const item = (label: string, value: number): TableCell => ({ stack: [{ text: label.toUpperCase(), style: 'summaryLabel' }, { text: String(value), style: 'summaryValue', margin: [0, 3, 0, 0] }], fillColor: '#F4F8FA', margin: [8, 6, 8, 6] });
    return {
      table: { widths: ['*', '*', '*', '*'], body: [[item('Reservas', totals.reservas), item('Habitaciones', totals.habitaciones), item('Adultos', totals.adultos), item('Niños', totals.ninos)]] },
      layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#C7D5DE', vLineColor: () => '#C7D5DE', paddingTop: () => 0, paddingBottom: () => 0, paddingLeft: () => 0, paddingRight: () => 0 },
      margin: [0, 0, 0, 12]
    };
  }

  private buildGroupedContent(reservas: ArriboReserva[]): Content[] {
    const byDate = new Map<string, ArriboReserva[]>();
    reservas.forEach((reserva) => {
      const date = normalizePmsDateDDMMYYYY(reserva.fechaIngreso) || reserva.fechaIngreso || 'N/D';
      const items = byDate.get(date) ?? [];
      items.push(reserva);
      byDate.set(date, items);
    });

    const content: Content[] = [];
    Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dateReservations]) => {
      const dateTotals = this.calculateTotals(dateReservations);
      content.push({
        stack: [
          { text: this.dateLabel(date), style: 'dateHeader' },
          { text: `${dateTotals.reservas} reservas · ${dateTotals.habitaciones} habitaciones · ${dateTotals.adultos} adultos · ${dateTotals.ninos} niños`, color: '#66758A', fontSize: 7.1, margin: [0, 3, 0, 0] }
        ],
        fillColor: '#F3F7FF', margin: [0, 4, 0, 6], border: [false, false, false, false]
      } as Content);

      const byAgency = new Map<string, ArriboReserva[]>();
      dateReservations.forEach((reserva) => {
        const code = reserva.agencia?.codigo || 'SIN-AGENCIA';
        const items = byAgency.get(code) ?? [];
        items.push(reserva);
        byAgency.set(code, items);
      });

      Array.from(byAgency.entries()).forEach(([code, agencyReservations]) => {
        const agencyName = agencyReservations[0]?.agencia?.nombre || 'Sin agencia';
        const agencyRooms = agencyReservations.reduce((total, item) => total + this.roomCount(item), 0);
        content.push({ text: agencyName.toUpperCase(), style: 'agencyHeader', margin: [0, 5, 0, 1] });
        content.push({ text: `${agencyReservations.length} ${agencyReservations.length === 1 ? 'reserva' : 'reservas'} · ${agencyRooms} habitaciones${code !== 'SIN-AGENCIA' ? ` · ${code}` : ''}`, color: '#718096', fontSize: 6.8, margin: [0, 0, 0, 4] });
        agencyReservations.forEach((reserva) => content.push(...this.buildReservation(reserva)));
      });
    });
    return content;
  }

  private buildReservation(reserva: ArriboReserva): Content[] {
    const reserved = Number(reserva.resumen?.habitacionesReservadas ?? 0);
    const desglosadas = Number(reserva.resumen?.habitacionesDesglosadas ?? reserva.habitaciones?.length ?? 0);
    const roomText = reserved !== desglosadas ? `${desglosadas} (reservadas: ${reserved})` : String(desglosadas);
    const cell = (label: string, value: string, style = 'reservationValue'): Content => ({ stack: [{ text: label.toUpperCase(), style: 'reservationLabel' }, { text: value || 'N/D', style, margin: [0, 2, 0, 0] }] });
    const result: Content[] = [{
      table: {
        widths: [105, '*', 62, 62, 42, 42, 54, 84],
        body: [[cell('Reserva', reserva.codReserva, 'reservationCode'), cell('Huésped / Grupo', reserva.descripcion), cell('Check in', this.displayDate(reserva.fechaIngreso)), cell('Check out', this.displayDate(reserva.fechaSalida)), cell('Noches', String(reserva.noches ?? 0)), cell('Plan', reserva.codPlan), cell('Estado', reserva.estado), cell('Habitaciones', roomText)]]
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#D5E0EA', vLineColor: () => '#D5E0EA', paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 5, paddingRight: () => 5 },
      fillColor: '#FFFFFF', margin: [0, 4, 0, 0]
    } as Content];

    if (reserva.observacion?.trim()) {
      result.push({ text: [{ text: 'Observaciones: ', bold: true, color: '#167D8D' }, reserva.observacion.trim()], style: 'observation', margin: [4, 5, 4, 5] });
    }

    result.push({
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        widths: [58, 105, 92, 48, 48, '*'],
        body: [
          [this.tableHeader('Habitación'), this.tableHeader('Categoría'), this.tableHeader('Tipo'), this.tableHeader('Adultos', 'center'), this.tableHeader('Niños', 'center'), this.tableHeader('Huéspedes')],
          ...(reserva.habitaciones.length ? reserva.habitaciones.map((habitacion) => this.roomRow(habitacion)) : [[{ text: 'Sin habitaciones desglosadas.', colSpan: 6, style: 'roomingEmpty' }, {}, {}, {}, {}, {}]])
        ]
      },
      layout: { fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? '#F7FAFC' : null, hLineWidth: () => 0.55, vLineWidth: () => 0.55, hLineColor: () => '#BFCBD7', vLineColor: () => '#BFCBD7', paddingTop: (rowIndex: number) => rowIndex === 0 ? 4 : 3, paddingBottom: (rowIndex: number) => rowIndex === 0 ? 4 : 3, paddingLeft: () => 4, paddingRight: () => 4 },
      margin: [0, 0, 0, 8]
    } as Content);
    return result;
  }

  private roomRow(habitacion: ArriboHabitacion): TableCell[] {
    const guests = (habitacion.huespedes ?? []).map((guest) => [guest.nombre, guest.apellidos].map((value) => value?.trim()).filter(Boolean).join(' ')).filter(Boolean);
    return [
      { text: habitacion.numero || 'N/D', style: 'tableCell', bold: true },
      { text: habitacion.categoria || 'N/D', style: 'tableCell' },
      { text: habitacion.tipo || 'N/D', style: 'tableCell' },
      { text: String(habitacion.adultos ?? 0), style: 'tableCell', alignment: 'center' },
      { text: String(habitacion.ninos ?? 0), style: 'tableCell', alignment: 'center' },
      guests.length ? { text: guests.join('\n'), style: 'tableCell' } : { text: 'Sin rooming', style: 'roomingEmpty' }
    ];
  }

  private calculateTotals(reservas: ArriboReserva[]): { reservas: number; habitaciones: number; adultos: number; ninos: number } {
    return {
      reservas: reservas.length,
      habitaciones: reservas.reduce((total, reserva) => total + this.roomCount(reserva), 0),
      adultos: reservas.reduce((total, reserva) => total + Number(reserva.resumen?.adultos ?? 0), 0),
      ninos: reservas.reduce((total, reserva) => total + Number(reserva.resumen?.ninos ?? 0), 0)
    };
  }

  private roomCount(reserva: ArriboReserva): number {
    return Number(reserva.resumen?.habitacionesDesglosadas ?? reserva.habitaciones?.length ?? 0);
  }

  private dateLabel(value: string): string {
    const parts = value.split('/');
    if (parts.length !== 3) return value.toUpperCase();
    const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return new Intl.DateTimeFormat('es-CR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date).toUpperCase();
  }

  private displayDate(value: string): string {
    const normalized = normalizePmsDateDDMMYYYY(value);
    if (normalized) return normalized;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
    return iso ? value.split('-').reverse().join('/') : value || 'N/D';
  }

  private generatedAt(): string {
    return new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  }

  private labelCell(text: string): TableCell { return { text, style: 'metadataLabel' }; }
  private valueCell(text: string): TableCell { return { text: text || ' ', style: 'metadataValue' }; }
  private tableHeader(text: string, alignment: 'left' | 'center' = 'left'): TableCell { return { text, style: 'tableHeader', alignment, fillColor: '#173A56' }; }
  private infoLayout() { return { hLineWidth: () => 0.55, vLineWidth: () => 0.55, hLineColor: () => '#CCD7E2', vLineColor: () => '#CCD7E2', paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 4, paddingRight: () => 4 }; }

  private reservePreviewWindow(): Window | null {
    const preview = window.open('', '_blank');
    if (!preview) return null;
    preview.opener = null;
    preview.document.title = 'Generando reporte de arribos';
    preview.document.body.innerHTML = '<div style="font:600 15px Arial,sans-serif;color:#334155;padding:32px">Generando reporte de arribos...</div>';
    return preview;
  }

  private async validatePdfBlob(blob: Blob): Promise<Blob> {
    if (!(blob instanceof Blob) || blob.size < 5) throw new Error('El PDF de arribos está vacío.');
    const signature = String.fromCharCode(...new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
    if (signature !== '%PDF-') throw new Error('El archivo generado no es un PDF válido.');
    return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  }

  private renderPreview(preview: Window, blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const doc = preview.document;
    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte de Arribos</title><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}body{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#e8eef5;color:#17364f;font-family:Arial,sans-serif}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:64px;padding:12px 20px;background:#fff;border-bottom:1px solid #ced9e5;box-shadow:0 4px 16px rgba(15,35,55,.08)}.title strong,.title span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title strong{font-size:16px}.title span{margin-top:3px;color:#64748b;font-size:12px}.download{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 18px;border-radius:10px;color:#fff;background:#1554c8;font-size:14px;font-weight:700;text-decoration:none}.viewer{position:relative;min-height:0;padding:12px}.viewer iframe{position:relative;z-index:1;width:100%;height:100%;border:0;border-radius:10px;background:#fff;box-shadow:0 12px 34px rgba(15,35,55,.14)}</style></head><body><header class="toolbar"><div class="title"><strong>Reporte de Arribos</strong><span id="filename"></span></div><a id="download" class="download">Descargar PDF</a></header><main class="viewer"><iframe id="pdfViewer" title="Reporte de Arribos PDF"></iframe></main></body></html>`);
    doc.close();
    const filenameNode = doc.getElementById('filename');
    const downloadLink = doc.getElementById('download') as HTMLAnchorElement | null;
    const viewer = doc.getElementById('pdfViewer') as HTMLIFrameElement | null;
    if (!filenameNode || !downloadLink || !viewer) throw new Error('No se pudo inicializar la vista previa del PDF.');
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

  private filename(filters: ArribosPdfFilters): string {
    const from = this.fileDate(filters.fechaDesde);
    const to = this.fileDate(filters.fechaHasta);
    return `Arribos_${from}${from !== to ? `_${to}` : ''}.pdf`;
  }

  private fileDate(value: string): string {
    const display = this.displayDate(value);
    return display.split('/').reverse().join('-').replace(/[^0-9-]/g, '') || 'sin-fecha';
  }
}
