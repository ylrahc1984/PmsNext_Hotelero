import {
  CentroActividadCard,
  CentroDetalleBloque,
  CentroHeatmapRow,
  CentroKpi,
  CentroNivelOperacion,
  CentroOperacionMatrixRow,
  CentroOperacionalActividadHora,
  CentroOperacionalResponse,
  CentroOperacionalViewModel,
  CentroTimelineBlock
} from '../interfaces/centro-operacional.interface';

export function buildCentroOperacionalViewModel(response: CentroOperacionalResponse | null | undefined): CentroOperacionalViewModel {
  const safeResponse = response ?? {
    totalRegistros: 0,
    bloques: [],
    totalesGenerales: { totalGeneral: 0, totalPaxGeneral: 0, totalServicios: 0 },
    resumenActividadPorHora: []
  };

  const bloques = [...(safeResponse.bloques ?? [])].sort((a, b) => normalizeHour(a.bloqueHora).localeCompare(normalizeHour(b.bloqueHora)));
  const resumen = safeResponse.resumenActividadPorHora ?? [];
  const totalPax = toNumber(safeResponse.totalesGenerales?.totalPaxGeneral);
  const totalServicios = toNumber(safeResponse.totalesGenerales?.totalServicios);
  const ingresoTotal = toNumber(safeResponse.totalesGenerales?.totalGeneral);
  const peakBlock = bloques.reduce((best, item) => (toNumber(item.totalesHora?.paxHora) > toNumber(best?.totalesHora?.paxHora) ? item : best), bloques[0]);
  const actividades = buildActividadCards(resumen);
  const topActivity = actividades[0];
  const timeline = buildTimeline(bloques);
  const hours = timeline.map((item) => item.bloqueHora);
  const nivelDia = resolveDayLevel(totalPax);

  return {
    totalRegistros: toNumber(safeResponse.totalRegistros),
    nivelDia,
    nivelDiaLabel: labelForLevel(nivelDia),
    kpis: buildKpis(totalPax, totalServicios, ingresoTotal, peakBlock?.bloqueHora ?? '-', topActivity),
    timeline,
    heatmapColumns: hours,
    heatmap: buildHeatmap(resumen, hours),
    actividades,
    matrizOperacional: buildOperationalMatrix(resumen, hours, bloques),
    detalles: buildDetalles(bloques),
    alertas: buildAlertas(timeline, actividades)
  };
}

export function resolveLoadLevel(pax: number): CentroNivelOperacion {
  if (pax >= 41) return 'critico';
  if (pax >= 26) return 'alto';
  if (pax >= 11) return 'medio';
  return 'normal';
}

export function levelClass(level: CentroNivelOperacion): string {
  return `is-${level}`;
}

function buildTimeline(bloques: CentroOperacionalResponse['bloques']): CentroTimelineBlock[] {
  const maxPax = Math.max(...bloques.map((item) => toNumber(item.totalesHora?.paxHora)), 1);

  return bloques.map((item) => {
    const paxHora = toNumber(item.totalesHora?.paxHora);
    return {
      bloqueHora: normalizeHour(item.bloqueHora),
      paxHora,
      totalHora: toNumber(item.totalesHora?.totalHora),
      cantidadServicios: toNumber(item.totalesHora?.cantidadServicios),
      nivel: resolveLoadLevel(paxHora),
      intensidad: Math.max(8, Math.round((paxHora / maxPax) * 100))
    };
  });
}

function buildHeatmap(resumen: CentroOperacionalActividadHora[], columns: string[]): CentroHeatmapRow[] {
  const grouped = new Map<string, CentroOperacionalActividadHora[]>();

  resumen.forEach((item) => {
    const key = item.codServicio || item.nomServicio || 'SIN-CODIGO';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return [...grouped.entries()]
    .map(([codServicio, items]) => {
      const first = items[0];
      const cells = columns.map((bloqueHora) => {
        const cell = items.find((item) => normalizeHour(item.bloqueHora) === bloqueHora);
        const paxActividadHora = toNumber(cell?.paxActividadHora);
        return {
          bloqueHora,
          paxActividadHora,
          cantidadServicios: toNumber(cell?.cantidadServicios),
          totalActividadHora: toNumber(cell?.totalActividadHora),
          nivel: resolveLoadLevel(paxActividadHora)
        };
      });

      return {
        codServicio,
        nomServicio: first?.nomServicio || codServicio,
        totalPax: items.reduce((sum, item) => sum + toNumber(item.paxActividadHora), 0),
        totalServicios: items.reduce((sum, item) => sum + toNumber(item.cantidadServicios), 0),
        cells
      };
    })
    .sort((a, b) => b.totalPax - a.totalPax || a.nomServicio.localeCompare(b.nomServicio));
}

function buildActividadCards(resumen: CentroOperacionalActividadHora[]): CentroActividadCard[] {
  const grouped = new Map<string, CentroOperacionalActividadHora[]>();

  resumen.forEach((item) => {
    const key = item.codServicio || item.nomServicio || 'SIN-CODIGO';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return [...grouped.entries()]
    .map(([codServicio, items]) => {
      const sorted = [...items].sort((a, b) => normalizeHour(a.bloqueHora).localeCompare(normalizeHour(b.bloqueHora)));
      const totalPax = sorted.reduce((sum, item) => sum + toNumber(item.paxActividadHora), 0);
      const totalServicios = sorted.reduce((sum, item) => sum + toNumber(item.cantidadServicios), 0);
      const totalIngreso = sorted.reduce((sum, item) => sum + toNumber(item.totalActividadHora), 0);
      const maxPax = Math.max(...sorted.map((item) => toNumber(item.paxActividadHora)), 1);
      const peak = sorted.reduce((best, item) => (toNumber(item.paxActividadHora) > toNumber(best?.paxActividadHora) ? item : best), sorted[0]);

      return {
        codServicio,
        nomServicio: sorted[0]?.nomServicio || codServicio,
        totalPax,
        totalServicios,
        totalIngreso,
        nivel: resolveLoadLevel(totalPax),
        peakHour: normalizeHour(peak?.bloqueHora ?? '-'),
        trend: resolveTrend(sorted),
        bars: sorted.map((item) => ({
          bloqueHora: normalizeHour(item.bloqueHora),
          paxActividadHora: toNumber(item.paxActividadHora),
          cantidadServicios: toNumber(item.cantidadServicios),
          width: Math.max(6, Math.round((toNumber(item.paxActividadHora) / maxPax) * 100)),
          nivel: resolveLoadLevel(toNumber(item.paxActividadHora))
        }))
      };
    })
    .sort((a, b) => b.totalPax - a.totalPax || a.nomServicio.localeCompare(b.nomServicio));
}

function buildDetalles(bloques: CentroOperacionalResponse['bloques']): CentroDetalleBloque[] {
  return bloques.map((item) => {
    const paxHora = toNumber(item.totalesHora?.paxHora);
    return {
      bloqueHora: normalizeHour(item.bloqueHora),
      paxHora,
      cantidadServicios: toNumber(item.totalesHora?.cantidadServicios),
      totalHora: toNumber(item.totalesHora?.totalHora),
      nivel: resolveLoadLevel(paxHora),
      detalles: item.detalles ?? []
    };
  });
}

function buildOperationalMatrix(
  resumen: CentroOperacionalActividadHora[],
  columns: string[],
  bloques: CentroOperacionalResponse['bloques']
): CentroOperacionMatrixRow[] {
  const grouped = new Map<string, CentroOperacionalActividadHora[]>();
  const allDetails = bloques.flatMap((bloque) =>
    (bloque.detalles ?? []).map((detalle) => ({
      ...detalle,
      bloqueHora: normalizeHour(detalle.bloqueHora || detalle.prV02_HoraServicio || bloque.bloqueHora)
    }))
  );
  const maxPax = Math.max(...resumen.map((item) => toNumber(item.paxActividadHora)), 1);

  resumen.forEach((item) => {
    const key = item.codServicio || item.nomServicio || 'SIN-CODIGO';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return [...grouped.entries()]
    .map(([codServicio, items]) => {
      const first = items[0];
      const nomServicio = first?.nomServicio || codServicio;
      const totalPax = items.reduce((sum, item) => sum + toNumber(item.paxActividadHora), 0);
      const totalServicios = items.reduce((sum, item) => sum + toNumber(item.cantidadServicios), 0);
      const totalIngreso = items.reduce((sum, item) => sum + toNumber(item.totalActividadHora), 0);
      const peak = items.reduce((best, item) => (toNumber(item.paxActividadHora) > toNumber(best?.paxActividadHora) ? item : best), items[0]);
      const details = allDetails.filter((detail) => {
        const detailCode = (detail.codServicio ?? '').trim();
        const detailName = (detail.nomServicio ?? '').trim();
        return detailCode === codServicio || (!detailCode && detailName === nomServicio) || detailName === nomServicio;
      });

      return {
        codServicio,
        nomServicio,
        totalPax,
        totalServicios,
        totalIngreso,
        nivel: resolveLoadLevel(totalPax),
        peakHour: normalizeHour(peak?.bloqueHora ?? '-'),
        detalles: details,
        cells: columns.map((bloqueHora) => {
          const cell = items.find((item) => normalizeHour(item.bloqueHora) === bloqueHora);
          const paxActividadHora = toNumber(cell?.paxActividadHora);
          return {
            bloqueHora,
            paxActividadHora,
            cantidadServicios: toNumber(cell?.cantidadServicios),
            totalActividadHora: toNumber(cell?.totalActividadHora),
            nivel: resolveLoadLevel(paxActividadHora),
            intensidad: paxActividadHora > 0 ? Math.max(10, Math.round((paxActividadHora / maxPax) * 100)) : 0
          };
        })
      };
    })
    .sort((a, b) => b.totalPax - a.totalPax || a.nomServicio.localeCompare(b.nomServicio));
}

function buildKpis(totalPax: number, totalServicios: number, ingresoTotal: number, peakHour: string, topActivity?: CentroActividadCard): CentroKpi[] {
  return [
    { label: 'Total Pax Dia', value: formatNumber(totalPax), detail: 'Volumen operacional consolidado', icon: 'feather icon-users', tone: resolveDayLevel(totalPax) },
    { label: 'Total Servicios', value: formatNumber(totalServicios), detail: 'Reservas activas en la operacion', icon: 'feather icon-briefcase', tone: 'neutral' },
    { label: 'Ingreso Total', value: formatCurrency(ingresoTotal), detail: 'Valor operativo del rango', icon: 'feather icon-trending-up', tone: 'normal' },
    { label: 'Hora Pico', value: peakHour || '-', detail: 'Bloque con mayor carga de pax', icon: 'feather icon-activity', tone: 'alto' },
    { label: 'Actividad Mas Cargada', value: topActivity?.nomServicio ?? '-', detail: `${formatNumber(topActivity?.totalPax ?? 0)} pax acumulados`, icon: 'feather icon-layers', tone: topActivity?.nivel ?? 'neutral' }
  ];
}

function buildAlertas(timeline: CentroTimelineBlock[], actividades: CentroActividadCard[]): string[] {
  const alertas: string[] = [];
  const criticalBlocks = timeline.filter((item) => item.nivel === 'critico');
  const highActivities = actividades.filter((item) => item.nivel === 'critico' || item.nivel === 'alto').slice(0, 3);

  if (criticalBlocks.length) {
    alertas.push(`${criticalBlocks.length} bloque(s) con saturacion critica: ${criticalBlocks.map((item) => item.bloqueHora).join(', ')}`);
  }

  highActivities.forEach((item) => {
    alertas.push(`${item.nomServicio} concentra ${formatNumber(item.totalPax)} pax; revisar capacidad en ${item.peakHour}`);
  });

  return alertas.length ? alertas : ['Operacion sin alertas criticas para el rango seleccionado.'];
}

function resolveDayLevel(totalPax: number): CentroNivelOperacion {
  if (totalPax >= 160) return 'critico';
  if (totalPax >= 95) return 'alto';
  if (totalPax >= 45) return 'medio';
  return 'normal';
}

function labelForLevel(level: CentroNivelOperacion): string {
  const labels: Record<CentroNivelOperacion, string> = {
    normal: 'NORMAL',
    medio: 'MEDIO',
    alto: 'ALTO',
    critico: 'CRITICO'
  };
  return labels[level];
}

function resolveTrend(items: CentroOperacionalActividadHora[]): 'ascendente' | 'estable' | 'descendente' {
  if (items.length < 2) return 'estable';
  const first = toNumber(items[0].paxActividadHora);
  const last = toNumber(items[items.length - 1].paxActividadHora);
  if (last > first * 1.15) return 'ascendente';
  if (last < first * 0.85) return 'descendente';
  return 'estable';
}

function normalizeHour(value: string | null | undefined): string {
  const raw = (value ?? '').toString().trim();
  if (!raw) return '-';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
