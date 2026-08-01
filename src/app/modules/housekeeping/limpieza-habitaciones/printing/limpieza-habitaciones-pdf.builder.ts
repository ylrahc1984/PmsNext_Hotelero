import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

import {
  LimpiezaHabitacionVista,
  LimpiezaHabitacionesPdfData
} from '../models/limpieza-habitacion.model';

export interface LimpiezaHabitacionesPdfEmpresa {
  nombre: string;
  cedula?: string;
  direccion?: string;
  telefono?: string;
}

export class LimpiezaHabitacionesPdfBuilder {
  build(data: LimpiezaHabitacionesPdfData, empresa: LimpiezaHabitacionesPdfEmpresa): TDocumentDefinitions {
    const companyName = empresa.nombre.trim() || 'HOTEL';

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [28, 30, 28, 52],
      info: {
        title: `Limpieza de Habitaciones - ${data.fechaOperativa}`,
        author: companyName,
        subject: 'Lista operativa para el departamento de Housekeeping'
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 7.4,
        color: '#243746',
        lineHeight: 1.08
      },
      footer: (currentPage: number, pageCount: number): Content => ({
        margin: [28, 12, 28, 0],
        columns: [
          {
            text: `Fecha operativa: ${data.fechaOperativa}  |  Operador: ${data.operador || '-'}`,
            color: '#6B7C87',
            fontSize: 7
          },
          {
            text: `Pagina ${currentPage} de ${pageCount}`,
            alignment: 'right',
            color: '#6B7C87',
            fontSize: 7
          }
        ]
      }),
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: companyName, style: 'companyName' },
                ...(empresa.cedula ? [{ text: `Cedula: ${empresa.cedula}`, style: 'companyMeta' } as Content] : []),
                ...(empresa.direccion ? [{ text: empresa.direccion, style: 'companyMeta' } as Content] : []),
                ...(empresa.telefono ? [{ text: `Tel. ${empresa.telefono}`, style: 'companyMeta' } as Content] : [])
              ]
            },
            {
              width: 285,
              stack: [
                { text: 'LIMPIEZA DE HABITACIONES', style: 'documentTitle' },
                { text: 'LISTA OPERATIVA DE HOUSEKEEPING', style: 'documentSubtitle' },
                {
                  text: `Fecha operativa: ${data.fechaOperativa}`,
                  alignment: 'right',
                  bold: true,
                  color: '#174E55',
                  margin: [0, 5, 0, 0]
                }
              ]
            }
          ]
        },
        {
          canvas: [{
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 736,
            y2: 0,
            lineWidth: 1.6,
            lineColor: '#0F766E'
          }],
          margin: [0, 10, 0, 10]
        },
        this.summaryTable(data),
        {
          columns: [
            {
              text: 'HABITACIONES PROGRAMADAS',
              bold: true,
              fontSize: 9,
              color: '#0F766E',
              characterSpacing: 0.7
            },
            {
              text: `${data.habitaciones.length} habitaciones en esta lista`,
              alignment: 'right',
              color: '#667985',
              fontSize: 7.2
            }
          ],
          margin: [0, 12, 0, 5]
        },
        this.roomsTable(data.habitaciones),
        {
          columns: [
            {
              text: 'Observaciones generales:',
              bold: true,
              color: '#405864'
            },
            {
              text: 'Firma supervisión: ______________________________',
              alignment: 'right',
              color: '#405864'
            }
          ],
          margin: [0, 14, 0, 0]
        },
        {
          text: `Generado el ${this.formatDateTime(data.generadoEn)}. La prioridad se calcula con base en la fecha operativa y el estado de la habitación.`,
          color: '#71828D',
          italics: true,
          fontSize: 6.8,
          margin: [0, 5, 0, 0]
        }
      ],
      styles: {
        companyName: {
          bold: true,
          fontSize: 15,
          color: '#173F49'
        },
        companyMeta: {
          fontSize: 7.2,
          color: '#687B86',
          margin: [0, 2, 0, 0]
        },
        documentTitle: {
          alignment: 'right',
          bold: true,
          fontSize: 14,
          color: '#173F49',
          characterSpacing: 0.6
        },
        documentSubtitle: {
          alignment: 'right',
          bold: true,
          fontSize: 7.6,
          color: '#0F766E',
          characterSpacing: 0.8,
          margin: [0, 3, 0, 0]
        }
      }
    };
  }

  private summaryTable(data: LimpiezaHabitacionesPdfData): Content {
    const items: Array<[string, number, string, string]> = [
      ['TOTAL', data.kpis.total, '#E8F3F2', '#174E55'],
      ['SALIDAS HOY', data.kpis.salidasHoy, '#FFF2DD', '#9A5200'],
      ['LLEGADAS', data.kpis.llegadas, '#E9F2FF', '#1D4F91'],
      ['OCUPADAS', data.kpis.ocupadas, '#F1ECFF', '#5C3B9B'],
      ['PENDIENTES', data.kpis.pendientes, '#FDECEC', '#A22A2A'],
      ['LIMPIAS', data.kpis.limpias, '#E9F7EE', '#24703E']
    ];
    const cells: TableCell[] = items.map(([label, value, fillColor, color]) => ({
      stack: [
        { text: String(value), bold: true, fontSize: 14, color, alignment: 'center' },
        { text: label, bold: true, fontSize: 6.5, color, alignment: 'center', characterSpacing: 0.5 }
      ],
      fillColor,
      margin: [4, 5, 4, 5]
    }));

    return {
      table: {
        widths: ['*', '*', '*', '*', '*', '*'],
        body: [cells]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 1.5,
        vLineColor: () => '#FFFFFF',
        paddingTop: () => 0,
        paddingBottom: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0
      }
    };
  }

  private roomsTable(rooms: LimpiezaHabitacionVista[]): Content {
    const rows: TableCell[][] = [[
      this.header('#', 'center'),
      this.header('Hab.', 'center'),
      this.header('Prioridad', 'left'),
      this.header('Estado', 'left'),
      this.header('Limpieza', 'left'),
      this.header('Entrada', 'center'),
      this.header('Salida', 'center'),
      this.header('Huesped', 'left'),
      this.header('Pax', 'center'),
      this.header('Grupo', 'center')
    ]];

    if (!rooms.length) {
      rows.push([{
        text: 'No hay habitaciones para los filtros seleccionados.',
        alignment: 'center',
        color: '#6B7C87',
        italics: true,
        colSpan: 10,
        margin: [0, 12, 0, 12]
      }, ...Array.from({ length: 9 }, () => ({ text: '' }))]);
    } else {
      rooms.forEach((room, index) => rows.push(this.roomRow(room, index)));
    }

    return {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        widths: [18, 32, 62, 55, 58, 53, 53, '*', 23, 36],
        body: rows
      },
      layout: {
        hLineWidth: (rowIndex: number) => rowIndex === 0 ? 0 : 0.45,
        vLineWidth: () => 0,
        hLineColor: () => '#D8E2E5',
        paddingTop: () => 5,
        paddingBottom: () => 5,
        paddingLeft: () => 4,
        paddingRight: () => 4
      }
    };
  }

  private roomRow(room: LimpiezaHabitacionVista, index: number): TableCell[] {
    const fillColor = index % 2 === 0 ? '#F7FAFA' : '#FFFFFF';
    return [
      this.cell(String(index + 1), fillColor, 'center'),
      {
        text: room.room || '-',
        fillColor,
        alignment: 'center',
        bold: true,
        fontSize: 9,
        color: '#173F49'
      },
      this.badge(room.prioridad, fillColor, this.priorityColor(room.prioridad)),
      this.cell(room.estado || '-', fillColor),
      this.badge(room.estadoLimpieza, fillColor, this.cleanColor(room.estadoLimpieza)),
      this.cell(room.fechaIni || '-', fillColor, 'center'),
      this.cell(room.fechaFin || '-', fillColor, 'center'),
      this.cell(room.huesped || '-', fillColor),
      this.cell(String(room.numPax || 0), fillColor, 'center'),
      this.cell(room.grupo || '-', fillColor, 'center')
    ];
  }

  private header(text: string, alignment: 'left' | 'center'): TableCell {
    return {
      text,
      alignment,
      bold: true,
      color: '#FFFFFF',
      fillColor: '#174E55',
      margin: [0, 3, 0, 3]
    };
  }

  private cell(text: string, fillColor: string, alignment: 'left' | 'center' = 'left'): TableCell {
    return { text, fillColor, alignment, color: '#304650' };
  }

  private badge(text: string, fillColor: string, color: string): TableCell {
    return { text, fillColor, bold: true, color, fontSize: 6.8 };
  }

  private priorityColor(priority: string): string {
    if (priority === 'SALIDA HOY') return '#B45309';
    if (priority === 'LLEGADA') return '#1D4ED8';
    if (priority === 'OCUPADA') return '#6D28D9';
    return '#526873';
  }

  private cleanColor(status: string): string {
    if (status === 'LIMPIA') return '#15803D';
    if (status === 'EN PROCESO') return '#1D4ED8';
    if (status === 'INSPECCION') return '#A16207';
    return '#B42318';
  }

  private formatDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()} ${hours}:${minutes}`;
  }
}
