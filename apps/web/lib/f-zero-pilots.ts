export type FZeroPilot = {
  number: number;
  name: string;
  nameJa: string;
  color: string;
};

// F-Zero GX / AX official 41 pilots, indexed by in-game pilot number (00-40).
// Number 0 (Deathborn) corresponds to the unlockable boss pilot.
export const F_ZERO_PILOTS: readonly FZeroPilot[] = [
  { number: 0, name: 'Deathborn', nameJa: 'デスボーン', color: '#1f2937' },
  { number: 1, name: 'Mighty Gazelle', nameJa: 'マイティ・ガゼル', color: '#ef4444' },
  { number: 2, name: 'Jody Summer', nameJa: 'ジョディ・サマー', color: '#e5e7eb' },
  { number: 3, name: 'Dr. Stewart', nameJa: 'Dr.スチュワート', color: '#eab308' },
  { number: 4, name: 'Baba', nameJa: 'ババ', color: '#f97316' },
  { number: 5, name: 'Samurai Goroh', nameJa: 'サムライ・ゴロー', color: '#dc2626' },
  { number: 6, name: 'Pico', nameJa: 'ピコ', color: '#16a34a' },
  { number: 7, name: 'Captain Falcon', nameJa: 'キャプテン・ファルコン', color: '#3b82f6' },
  { number: 8, name: 'Octoman', nameJa: 'オクトマン', color: '#a855f7' },
  { number: 9, name: 'Mr. EAD', nameJa: 'ミスターEAD', color: '#fbbf24' },
  { number: 10, name: 'James McCloud', nameJa: 'ジェームス・マクラウド', color: '#f59e0b' },
  { number: 11, name: 'Billy', nameJa: 'ビリー', color: '#a3e635' },
  { number: 12, name: 'Kate Alen', nameJa: 'ケイト・アレン', color: '#ec4899' },
  { number: 13, name: 'Zoda', nameJa: 'ゾーダ', color: '#6b21a8' },
  { number: 14, name: 'Jack Levin', nameJa: 'ジャック・レビン', color: '#60a5fa' },
  { number: 15, name: 'Bio Rex', nameJa: 'バイオレックス', color: '#84cc16' },
  { number: 16, name: 'The Skull', nameJa: 'ザ・スカル', color: '#7c3aed' },
  { number: 17, name: 'Antonio Guster', nameJa: 'アントニオ・ガスター', color: '#22c55e' },
  { number: 18, name: 'Beastman', nameJa: 'ビーストマン', color: '#0ea5e9' },
  { number: 19, name: 'Leon', nameJa: 'レオン', color: '#14b8a6' },
  { number: 20, name: 'Super Arrow', nameJa: 'スーパーアロー', color: '#2563eb' },
  { number: 21, name: 'Mrs. Arrow', nameJa: 'ミセス・アロー', color: '#f472b6' },
  { number: 22, name: 'Gomar & Shioh', nameJa: 'ゴマー＆シオー', color: '#06b6d4' },
  { number: 23, name: 'Silver Neelsen', nameJa: 'シルバー・ニールセン', color: '#94a3b8' },
  { number: 24, name: 'Michael Chain', nameJa: 'マイケル・チェーン', color: '#65a30d' },
  { number: 25, name: 'Blood Falcon', nameJa: 'ブラッド・ファルコン', color: '#7f1d1d' },
  { number: 26, name: 'John Tanaka', nameJa: 'ジョン・タナカ', color: '#fb923c' },
  { number: 27, name: 'Draq', nameJa: 'ドラック', color: '#0891b2' },
  { number: 28, name: 'Roger Buster', nameJa: 'ロジャー・バスター', color: '#fde047' },
  { number: 29, name: 'Dr. Clash', nameJa: 'Dr.クラッシュ', color: '#a16207' },
  { number: 30, name: 'Black Shadow', nameJa: 'ブラックシャドー', color: '#312e81' },
  { number: 31, name: 'Don Genie', nameJa: 'ドン・ジーニー', color: '#facc15' },
  { number: 32, name: 'Digi-Boy', nameJa: 'デジボーイ', color: '#22d3ee' },
  { number: 33, name: 'Dai San Gen', nameJa: 'ダイ・サンゲン', color: '#f87171' },
  { number: 34, name: 'Spade', nameJa: 'スペード', color: '#a3a3a3' },
  { number: 35, name: 'Dai Goroh', nameJa: 'ダイ・ゴロー', color: '#dc2626' },
  { number: 36, name: 'Princia Ramode', nameJa: 'プリンシア・ラモード', color: '#fbbf24' },
  { number: 37, name: 'Lily Flyer', nameJa: 'リリー・フライヤー', color: '#f9a8d4' },
  { number: 38, name: 'PJ', nameJa: 'PJ', color: '#fb7185' },
  { number: 39, name: 'QQQ', nameJa: 'QQQ', color: '#9ca3af' },
  { number: 40, name: 'Phoenix', nameJa: 'フェニックス', color: '#ea580c' },
];

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getAnonymousPilot(newsSlug: string, userId: number): FZeroPilot {
  const idx = djb2(`${newsSlug}:${userId}`) % F_ZERO_PILOTS.length;
  return F_ZERO_PILOTS[idx];
}
