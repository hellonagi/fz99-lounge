import { TournamentDivision, TournamentMode } from './enums';

// 定員はコード定数(DBには持たない)。変更時はここだけ直す
export const GP_OFFLINE_MAX = 32;
export const GP_ONLINE_MAX = 67;
export const GP_MAX = GP_OFFLINE_MAX + GP_ONLINE_MAX;
export const CLASSIC_FIRST_COME = 20;
export const CLASSIC_MAX = CLASSIC_FIRST_COME;

export type GpSlot =
  | 'OFFLINE_CONFIRMED'
  | 'ONLINE_CONFIRMED'
  | 'ONLINE_OVERFLOW'
  | 'WAITLIST';

export interface SlotEntryLike {
  mode?: TournamentMode | null;
}

// 登録順(registeredAt asc)の配列を前提に、GPのslotを先着で割り当てる
export function assignGpSlots<T extends SlotEntryLike>(
  entries: T[],
): Array<{ entry: T; slot: GpSlot }> {
  let offline = 0;
  let online = 0;
  return entries.map((entry) => {
    if (entry.mode === TournamentMode.OFFLINE && offline < GP_OFFLINE_MAX) {
      offline += 1;
      return { entry, slot: 'OFFLINE_CONFIRMED' as GpSlot };
    }
    if (online < GP_ONLINE_MAX) {
      online += 1;
      return {
        entry,
        slot: (entry.mode === TournamentMode.OFFLINE
          ? 'ONLINE_OVERFLOW'
          : 'ONLINE_CONFIRMED') as GpSlot,
      };
    }
    return { entry, slot: 'WAITLIST' as GpSlot };
  });
}

// waitlistを除いた確定参加者(マッチ参加者の作成にも使う)
export function confirmedEntries<T extends SlotEntryLike>(
  division: TournamentDivision,
  entries: T[],
): T[] {
  if (division === TournamentDivision.CLASSIC) {
    return entries.slice(0, CLASSIC_FIRST_COME);
  }
  return assignGpSlots(entries)
    .filter((a) => a.slot !== 'WAITLIST')
    .map((a) => a.entry);
}
