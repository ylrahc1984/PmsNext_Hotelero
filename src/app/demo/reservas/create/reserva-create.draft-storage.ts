export const RESERVA_CREATE_DRAFT_STORAGE_KEY = 'reserva_create_draft_cod';

export function getReservaCreateDraftCod(): string | null {
  try {
    const value = sessionStorage.getItem(RESERVA_CREATE_DRAFT_STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function setReservaCreateDraftCod(codReserva: string): void {
  try {
    const v = (codReserva ?? '').toString().trim();
    if (v) sessionStorage.setItem(RESERVA_CREATE_DRAFT_STORAGE_KEY, v);
  } catch {
    // ignore
  }
}

export function clearReservaCreateDraftCod(): void {
  try {
    sessionStorage.removeItem(RESERVA_CREATE_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

