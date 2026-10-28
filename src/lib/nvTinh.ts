// Nhiệm vụ do tỉnh giao (mã cấp tỉnh, vd NV-BT-134): danh sách lưu ở cau_hinh (khoá 'nhiem_vu_tinh'), nhập từ tệp Word tỉnh gửi.
// Nhiệm vụ của phường gắn với một hay nhiều mã tỉnh qua DongA4.ma_tinh để báo cáo và xuất file theo mã.
import { supabase } from './supabase';
import { chuCuaPhanTu, docXmlTuDocx } from './danhMucA4';
import { khongDau } from './nhiemVu';

export const KHOA_NV_TINH = 'nhiem_vu_tinh';
export type NvTinh = { ma: string; ten: string; vb?: string; dv?: string; han?: string; tt?: string };

export async function taiNvTinh(): Promise<NvTinh[]> {
  const { data } = await supabase.from('cau_hinh').select('gia_tri').eq('khoa', KHOA_NV_TINH).maybeSingle();
  const g = (data as { gia_tri?: { ds?: NvTinh[] } } | null)?.gia_tri;
  return Array.isArray(g?.ds) ? g!.ds! : [];
}
export async function luuNvTinh(ds: NvTinh[]): Promise<string | null> {
  const { error } = await supabase.from('cau_hinh').upsert({ khoa: KHOA_NV_TINH, gia_tri: { ds }, mo_ta: 'Nhiệm vụ do tỉnh giao (mã cấp tỉnh)' });
  return error ? error.message : null;
}
// Gộp theo mã: mã đã có thì cập nhật nội dung, mã mới thì thêm
export function gopNvTinh(cu: NvTinh[], moi: NvTinh[]): NvTinh[] {
  const m = new Map(cu.map((x) => [x.ma.toUpperCase(), x]));
  for (const x of moi) m.set(x.ma.toUpperCase(), { ...m.get(x.ma.toUpperCase()), ...x });
  return [...m.values()].sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true }));
}

// Đọc mọi bảng trong tệp Word có cột "Mã" và "Nhiệm vụ" (tệp trích xuất của tỉnh)
export async function docNvTinhWord(f: File): Promise<NvTinh[]> {
  const xml = await docXmlTuDocx(f);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const ra: NvTinh[] = [];
  for (const bang of Array.from(doc.getElementsByTagNameNS(W, 'tbl'))) {
    const hang = Array.from(bang.children).filter((x) => x.localName === 'tr').map((tr) => Array.from(tr.children).filter((x) => x.localName === 'tc').map(chuCuaPhanTu));
    if (hang.length < 2) continue;
    const tc = hang[0].map((x) => khongDau(x).trim());
    const iMa = tc.findIndex((x) => x === 'ma' || x === 'ma nv'), iTen = tc.findIndex((x) => x.includes('nhiem vu'));
    if (iMa < 0 || iTen < 0) continue;
    const tim = (...t: string[]) => tc.findIndex((x) => t.some((k) => x.includes(k)));
    const iVb = tim('van ban giao'), iDv = tim('don vi chu tri'), iHan = tim('han hoan thanh'), iTt = tim('tinh trang');
    for (const r of hang.slice(1)) {
      const ma = (r[iMa] ?? '').replace(/\s+/g, '').trim();
      const ten = (r[iTen] ?? '').trim();
      if (!ma || !ten) continue;
      const lay = (i: number) => (i >= 0 ? (r[i] ?? '').replace(/\s*\n\s*/g, ' · ').trim() || undefined : undefined);
      ra.push({ ma, ten, vb: lay(iVb), dv: lay(iDv), han: lay(iHan), tt: lay(iTt) });
    }
  }
  if (!ra.length) throw new Error('Không thấy bảng có cột "Mã" và "Nhiệm vụ" trong tệp Word.');
  return ra;
}
