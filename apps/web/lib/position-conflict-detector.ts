/**
 * 順位申告の不整合検知ロジック
 *
 * 同率順位のルール: 「1位が2人なら 1,1,3…（2位は存在しない）」
 * - 順位rがs人同率 → r, r+1, ..., r+s-1 が占有される
 * - r+1 〜 r+s-1 は「存在しない順位」
 * - 存在しない順位を申告した人がいれば矛盾
 */

export interface RaceResultForConflict {
  raceNumber: number;
  position: number | null;
  isDisconnected: boolean;
}

export interface ParticipantForConflict {
  user: {
    id: number;
    displayName: string | null;
  };
  status?: string;
  raceResults?: RaceResultForConflict[];
}

export interface ConflictingUser {
  userId: number;
  userName: string;
}

export interface ConflictingUserWithPosition {
  userId: number;
  userName: string;
  position: number;
}

export interface ConflictResult {
  raceNumber: number;
  invalidPosition: number; // 存在しない順位
  conflictingUsers: ConflictingUser[]; // その順位を申告した人
  causingPosition: number; // 矛盾の原因となった同率順位
  causingCount: number; // 同率の人数
  causingUsers: ConflictingUser[]; // 同率順位を申告した人
  allInvolvedUsers: ConflictingUserWithPosition[]; // 矛盾に関わる全員（順位付き）
}

/**
 * 指定レースの順位申告の不整合を検知
 */
export function detectPositionConflictsForRace(
  participants: ParticipantForConflict[],
  raceNumber: number
): ConflictResult[] {
  // 提出済み参加者のみ対象 (PENDING, VERIFIED, REJECTED)
  const submittedParticipants = participants.filter(
    (p) => p.status && p.status !== 'UNSUBMITTED'
  );

  // 該当レースの順位を収集
  const positionMap = new Map<
    number,
    Array<{ userId: number; userName: string }>
  >();

  for (const participant of submittedParticipants) {
    const raceResult = participant.raceResults?.find(
      (r) => r.raceNumber === raceNumber
    );
    if (!raceResult || raceResult.isDisconnected || raceResult.position === null) {
      continue;
    }

    const position = raceResult.position;
    if (!positionMap.has(position)) {
      positionMap.set(position, []);
    }
    positionMap.get(position)!.push({
      userId: participant.user.id,
      userName: participant.user.displayName || `User#${participant.user.id}`,
    });
  }

  // 同率順位により「存在しない順位」を計算
  const invalidPositions = new Set<number>();
  const causingInfo = new Map<
    number,
    { causingPosition: number; causingCount: number; causingUsers: ConflictingUser[] }
  >();

  for (const [position, users] of positionMap.entries()) {
    const count = users.length;
    if (count > 1) {
      // 同率の場合、position+1 ~ position+count-1 は存在しない
      for (let i = 1; i < count; i++) {
        const invalidPos = position + i;
        if (invalidPos <= 20) {
          invalidPositions.add(invalidPos);
          causingInfo.set(invalidPos, {
            causingPosition: position,
            causingCount: count,
            causingUsers: users,
          });
        }
      }
    }
  }

  // 存在しない順位に申告がないかチェック
  const conflicts: ConflictResult[] = [];

  for (const invalidPos of invalidPositions) {
    const usersAtInvalidPos = positionMap.get(invalidPos);
    if (usersAtInvalidPos && usersAtInvalidPos.length > 0) {
      const info = causingInfo.get(invalidPos)!;

      // 矛盾に関わる全員をリスト化（順位付き）
      const allInvolved: ConflictingUserWithPosition[] = [
        ...info.causingUsers.map((u) => ({
          ...u,
          position: info.causingPosition,
        })),
        ...usersAtInvalidPos.map((u) => ({
          ...u,
          position: invalidPos,
        })),
      ];

      conflicts.push({
        raceNumber,
        invalidPosition: invalidPos,
        conflictingUsers: usersAtInvalidPos,
        causingPosition: info.causingPosition,
        causingCount: info.causingCount,
        causingUsers: info.causingUsers,
        allInvolvedUsers: allInvolved,
      });
    }
  }

  return conflicts;
}

/**
 * 全レース（1-3）の不整合を検知
 */
export function detectAllPositionConflicts(
  participants: ParticipantForConflict[]
): ConflictResult[] {
  const allConflicts: ConflictResult[] = [];

  for (let raceNumber = 1; raceNumber <= 3; raceNumber++) {
    const conflicts = detectPositionConflictsForRace(participants, raceNumber);
    allConflicts.push(...conflicts);
  }

  return allConflicts;
}

/**
 * 全員が提出済みかどうかを判定
 */
export function areAllParticipantsSubmitted(
  participants: ParticipantForConflict[],
  totalMatchParticipants: number
): boolean {
  const submittedCount = participants.filter(
    (p) => p.status && p.status !== 'UNSUBMITTED'
  ).length;
  return submittedCount >= totalMatchParticipants;
}
