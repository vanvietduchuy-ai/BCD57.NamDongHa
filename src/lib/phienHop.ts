// Hồ sơ họp BCĐ theo từng phiên họp (Kho văn bản / Hồ sơ họp BCĐ / <phiên họp>)
// Lưu ở cau_hinh (khoá 'ho_so_hop_bcd'): danh sách phiên họp + văn bản thuộc phiên nào.
import { supabase } from './supabase';
import type { LoaiVb } from './vanBan';

export const KHOA_HO_SO_HOP = 'ho_so_hop_bcd';
export type PhienHopKho = { id: string; ten: string; ngay?: string; dia_diem?: string; ghi_chu?: string };
// vb: văn bản thuộc thư mục Hồ sơ họp -> id phiên họp; kem: id phiên họp -> văn bản có sẵn ở thư mục khác được đính kèm vào phiên (không chuyển thư mục)
export type HoSoHop = { ds: PhienHopKho[]; vb: Record<string, string>; kem: Record<string, string[]> };
export const HO_SO_HOP_RONG: HoSoHop = { ds: [], vb: {}, kem: {} };
export const CHUA_XEP = '_chua';

// Thành phần hồ sơ một phiên họp (đối chiếu theo loại văn bản đã có trong phiên)
export const THANH_PHAN_HOP: [LoaiVb, string][] = [
  ['giay_moi', 'Giấy mời'], ['chuong_trinh', 'Chương trình'], ['to_trinh', 'Tờ trình'], ['bao_cao', 'Báo cáo'],
  ['bien_ban', 'Biên bản'], ['thong_bao', 'Thông báo kết luận'],
];

export async function docHoSoHop(): Promise<HoSoHop> {
  const { data } = await supabase.from('cau_hinh').select('gia_tri').eq('khoa', KHOA_HO_SO_HOP).maybeSingle();
  const g = (data?.gia_tri ?? {}) as Partial<HoSoHop>;
  return { ds: Array.isArray(g.ds) ? g.ds : [], vb: g.vb && typeof g.vb === 'object' ? g.vb : {}, kem: g.kem && typeof g.kem === 'object' ? g.kem : {} };
}

// Đọc bản mới nhất rồi mới sửa, tránh ghi đè thay đổi của người khác
export async function suaHoSoHop(f: (h: HoSoHop) => HoSoHop): Promise<HoSoHop> {
  const moi = f(await docHoSoHop());
  const { error } = await supabase.from('cau_hinh').upsert({ khoa: KHOA_HO_SO_HOP, gia_tri: moi, mo_ta: 'Hồ sơ họp BCĐ theo phiên họp' });
  if (error) throw error;
  return moi;
}

export const ganVanBanPhien = (vbId: string, phienId: string | null) => suaHoSoHop((h) => {
  const vb = { ...h.vb };
  if (phienId && phienId !== CHUA_XEP) vb[vbId] = phienId; else delete vb[vbId];
  return { ...h, vb };
});

export const sapXepPhien = (ds: PhienHopKho[]) => [...ds].sort((a, b) => (b.ngay ?? '9999').localeCompare(a.ngay ?? '9999') || a.ten.localeCompare(b.ten, 'vi'));

// Đính kèm / bỏ đính kèm văn bản có sẵn vào một phiên họp
export const dinhKemPhien = (phienId: string, them: string[], bo: string[] = []) => suaHoSoHop((h) => {
  const cu = h.kem[phienId] ?? [];
  const moi = [...new Set([...cu, ...them])].filter((x) => !bo.includes(x));
  return { ...h, kem: { ...h.kem, [phienId]: moi } };
});

// Thư mục con trên Google Drive cho từng phiên họp: "Kho văn bản/Hồ sơ họp BCĐ/<ngày> - <tên phiên>"
// Có ngày họp để các phiên trùng tên không lẫn nhau; bỏ dấu "/" trong tên (Drive hiểu là thư mục con); vẫn trùng thì thêm mã phiên.
export function thuMucDrivePhien(p: PhienHopKho, ds: PhienHopKho[]): string {
  const sach = (t: string) => t.replace(/[\\/]+/g, '-').replace(/\s+/g, ' ').trim();
  const ten = (x: PhienHopKho) => sach(`${x.ngay ? `${x.ngay.split('-').reverse().join('.')} - ` : ''}${x.ten}`);
  const goc = ten(p);
  return ds.some((x) => x.id !== p.id && ten(x) === goc) ? `${goc} (${p.id.slice(-4)})` : goc;
}
