// Hồ sơ họp BCĐ theo từng phiên họp (Kho văn bản / Hồ sơ họp BCĐ / <phiên họp>)
// Lưu ở cau_hinh (khoá 'ho_so_hop_bcd'): danh sách phiên họp + văn bản thuộc phiên nào.
import { supabase } from './supabase';
import type { LoaiVb } from './vanBan';

export const KHOA_HO_SO_HOP = 'ho_so_hop_bcd';
export type PhienHopKho = { id: string; ten: string; ngay?: string; dia_diem?: string; ghi_chu?: string };
export type HoSoHop = { ds: PhienHopKho[]; vb: Record<string, string> };   // vb: id văn bản -> id phiên họp
export const HO_SO_HOP_RONG: HoSoHop = { ds: [], vb: {} };
export const CHUA_XEP = '_chua';

// Thành phần hồ sơ một phiên họp (đối chiếu theo loại văn bản đã có trong phiên)
export const THANH_PHAN_HOP: [LoaiVb, string][] = [
  ['giay_moi', 'Giấy mời'], ['chuong_trinh', 'Chương trình'], ['to_trinh', 'Tờ trình'], ['bao_cao', 'Báo cáo'],
  ['bien_ban', 'Biên bản'], ['thong_bao', 'Thông báo kết luận'],
];

export async function docHoSoHop(): Promise<HoSoHop> {
  const { data } = await supabase.from('cau_hinh').select('gia_tri').eq('khoa', KHOA_HO_SO_HOP).maybeSingle();
  const g = (data?.gia_tri ?? {}) as Partial<HoSoHop>;
  return { ds: Array.isArray(g.ds) ? g.ds : [], vb: g.vb && typeof g.vb === 'object' ? g.vb : {} };
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
