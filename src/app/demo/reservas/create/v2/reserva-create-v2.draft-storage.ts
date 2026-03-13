import { ClienteUI } from '../../../catalogos/agencias-comisionistas/cliente.models';
import { ReservaCreateV2Draft } from './reserva-create-v2.models';

const RESERVA_CREATE_V2_DRAFT_STORAGE_KEY = 'reserva_create_v2_draft';
const RESERVA_CREATE_V2_DRAFT_VERSION = 1;

export interface ReservaCreateV2StoredDraft {
  version: number;
  updatedAt: string;
  draft: ReservaCreateV2Draft;
  selectedCliente: ClienteUI | null;
}

export function getReservaCreateV2StoredDraft(): ReservaCreateV2StoredDraft | null {
  try {
    const raw = sessionStorage.getItem(RESERVA_CREATE_V2_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReservaCreateV2StoredDraft;
    if (!parsed || parsed.version !== RESERVA_CREATE_V2_DRAFT_VERSION || !parsed.draft) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setReservaCreateV2StoredDraft(draft: ReservaCreateV2Draft, selectedCliente: ClienteUI | null): void {
  try {
    const payload: ReservaCreateV2StoredDraft = {
      version: RESERVA_CREATE_V2_DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
      draft,
      selectedCliente
    };
    sessionStorage.setItem(RESERVA_CREATE_V2_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearReservaCreateV2StoredDraft(): void {
  try {
    sessionStorage.removeItem(RESERVA_CREATE_V2_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
