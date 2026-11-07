// Small dependency-free kana reading aid. Kanji reading and full IME are NOT supported.
const rows = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho','ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'wo','ん':'n','が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ー':'-'
};
const ySeries = ['き','し','ち','に','ひ','み','り','ぎ','じ','び','ぴ','ぢ'];
const yBases = ['ky','sh','ch','ny','hy','my','ry','gy','j','by','py','j'];
const combo = Object.fromEntries(ySeries.flatMap((s, i) => ['ゃ','ゅ','ょ'].map((y, j) => [s + y, yBases[i] + ['a','u','o'][j]])));
export function romanizeKana(input) {
  const kana = input.replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  let result = '';
  for (let i = 0; i < kana.length; i++) {
    const c = kana[i];
    if (c === 'っ') {
      const next = combo[kana.slice(i + 1, i + 3)] || rows[kana[i + 1]] || '';
      result += next.startsWith('ch') ? 't' : (next.match(/^[bcdfghjklmnpqrstvwxyz]/)?.[0] || '');
      continue;
    }
    const pair = combo[kana.slice(i, i + 2)];
    if (pair) { result += pair; i++; continue; }
    result += rows[c] ?? c;
  }
  return result;
}
