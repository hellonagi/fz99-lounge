/**
 * Classic Mini Prix トラックセットローテーション
 *
 * 基準時刻: 2026-01-04T06:11:00+09:00 (JST) = セットID 002
 * ローテーション: 29セット、1分刻み、29分周期
 */

// 基準時刻設定
export const TRACKSET_REFERENCE_TIME = new Date('2026-01-04T06:11:00+09:00');
export const TRACKSET_REFERENCE_ID = 2;
export const TRACKSET_COUNT = 29;

// 29セットのトラックデータ (トラックID使用: CLASSIC=201-220)
// [Minicup 1, Minicup 2, Minicup 3]
export const CLASSIC_MINI_TRACKSETS: Record<number, [number, number, number]> = {
  1: [201, 218, 214], // Mute_City_I, Big_Blue_II, Red_Canyon_II
  2: [216, 217, 220], // Mute_City_IV, Sand_Storm_I, Silence_II
  3: [202, 219, 210], // Big_Blue, Sand_Storm_II, White_Land_II
  4: [203, 208, 210], // Sand_Ocean, Red_Canyon_I, White_Land_II
  5: [206, 218, 212], // Mute_City_II, Big_Blue_II, Death_Wind_II
  6: [211, 217, 205], // Mute_City_III, Sand_Storm_I, Silence
  7: [205, 210, 215], // Silence, White_Land_II, Fire_Field
  8: [211, 219, 220], // Mute_City_III, Sand_Storm_II, Silence_II
  9: [204, 209, 214], // Death_Wind_I, White_Land_I, Red_Canyon_II
  10: [202, 207, 210], // Big_Blue, Port_Town_I, White_Land_II
  11: [201, 217, 212], // Mute_City_I, Sand_Storm_I, Death_Wind_II
  12: [216, 208, 220], // Mute_City_IV, Red_Canyon_I, Silence_II
  13: [203, 218, 205], // Sand_Ocean, Big_Blue_II, Silence
  14: [204, 217, 210], // Death_Wind_I, Sand_Storm_I, White_Land_II
  15: [206, 219, 213], // Mute_City_II, Sand_Storm_II, Port_Town_II
  16: [211, 218, 215], // Mute_City_III, Big_Blue_II, Fire_Field
  17: [216, 219, 205], // Mute_City_IV, Sand_Storm_II, Silence
  18: [202, 217, 213], // Big_Blue, Sand_Storm_I, Port_Town_II
  19: [203, 209, 220], // Sand_Ocean, White_Land_I, Silence_II
  20: [220, 210, 215], // Silence_II, White_Land_II, Fire_Field
  21: [201, 219, 215], // Mute_City_I, Sand_Storm_II, Fire_Field
  22: [216, 207, 220], // Mute_City_IV, Port_Town_I, Silence_II
  23: [204, 218, 210], // Death_Wind_I, Big_Blue_II, White_Land_II
  24: [202, 208, 213], // Big_Blue, Red_Canyon_I, Port_Town_II
  25: [206, 217, 215], // Mute_City_II, Sand_Storm_I, Fire_Field
  26: [211, 209, 205], // Mute_City_III, White_Land_I, Silence
  27: [216, 218, 220], // Mute_City_IV, Big_Blue_II, Silence_II
  28: [203, 207, 212], // Sand_Ocean, Port_Town_I, Death_Wind_II
  29: [204, 219, 214], // Death_Wind_I, Sand_Storm_II, Red_Canyon_II
};
