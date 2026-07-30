export function calculateHeaderNightlyPrice(total: number, detailLines: number, nights: number): number | null {
  if (
    !Number.isFinite(total) ||
    total < 0 ||
    !Number.isInteger(detailLines) ||
    detailLines <= 0 ||
    !Number.isFinite(nights) ||
    nights <= 0
  ) {
    return null;
  }

  return Math.round((total / detailLines / nights + Number.EPSILON) * 1000000) / 1000000;
}
