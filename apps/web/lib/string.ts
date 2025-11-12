/**
 * 全角文字を半角に変換（ひらがな・カタカナは除く）
 */
export function toHalfWidth(str: string): string {
  return str
    .replace(/[！-～]/g, (char) => {
      // 全角記号・英数字を半角に変換
      return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
    })
    .replace(/　/g, ' '); // 全角スペースを半角スペースに
}

/**
 * displayNameのバリデーション
 */
export function validateDisplayName(displayName: string): {
  valid: boolean;
  error?: string;
} {
  const normalized = toHalfWidth(displayName);

  if (normalized.length < 1 || normalized.length > 10) {
    return { valid: false, error: 'Display name must be 1-10 characters' };
  }

  const allowedPattern =
    /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF!"#$%&'()=~|`{+*}<>?_@\[;:\],.\/ -]+$/;
  if (!allowedPattern.test(normalized)) {
    return {
      valid: false,
      error: 'Display name contains invalid characters',
    };
  }

  return { valid: true };
}
