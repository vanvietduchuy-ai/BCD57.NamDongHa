// Báo cáo tuần: mỗi tuần (thứ Hai – Chủ nhật, giờ Việt Nam) đơn vị chủ trì báo cáo kết quả các nhiệm vụ đang thực hiện.
// Mỗi nhiệm vụ báo cáo = một dòng nhiem_vu_cap_nhat có tiền tố "Báo cáo tuần NN/YYYY:" -> không cần thêm bảng mới.
// Hạn nộp lưu ở cau_hinh (khoá 'bao_cao_tuan'): thứ trong tuần + giờ.
export const KHOA_BCT = 'bao_cao_tuan';
export type CauHinhBCT = { thu: number; gio: number; phut?: number; bat: boolean };   // thu: 1 = thứ Hai … 7 = Chủ nhật
export const BCT_MAC_DINH: CauHinhBCT = { thu: 5, gio: 17, bat: true };
export const TEN_THU: Record<number, string> = { 1: 'thứ Hai', 2: 'thứ Ba', 3: 'thứ Tư', 4: 'thứ Năm', 5: 'thứ Sáu', 6: 'thứ Bảy', 7: 'Chủ nhật' };

const VN = 7 * 3600 * 1000;
// Ngày (theo giờ VN) dạng UTC-midnight để tính toán
const ngayVN = (d: Date) => { const t = new Date(d.getTime() + VN); return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };

// Giờ hạn dạng 17:00
export const gioHan = (ch: CauHinhBCT) => `${String(ch.gio).padStart(2, '0')}:${String(ch.phut ?? 0).padStart(2, '0')}`;
export type Tuan = { so: number; nam: number; batDau: Date; ketThuc: Date; han: Date; ten: string; tienTo: string };
// Tuần chứa ngày d (lui = số tuần lùi lại)
export function tuanCua(d: Date, ch: CauHinhBCT, lui = 0): Tuan {
  const n = ngayVN(d) - lui * 7 * 86400000;
  const thu = ((new Date(n).getUTCDay() + 6) % 7) + 1;               // 1..7
  const thu2 = n - (thu - 1) * 86400000;                              // thứ Hai 00:00 (VN, dạng UTC)
  // Số tuần ISO: theo thứ Năm của tuần
  const thu5 = new Date(thu2 + 3 * 86400000);
  const nam = thu5.getUTCFullYear();
  const so = Math.floor((thu5.getTime() - Date.UTC(nam, 0, 1)) / (7 * 86400000)) + 1;
  const batDau = new Date(thu2 - VN);
  const ketThuc = new Date(thu2 + 7 * 86400000 - VN - 1);
  const han = new Date(thu2 + (ch.thu - 1) * 86400000 + ch.gio * 3600000 + (ch.phut ?? 0) * 60000 - VN);
  const dd = (x: number) => { const t = new Date(x); return `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };
  return { so, nam, batDau, ketThuc, han, ten: `Tuần ${so}/${nam} (${dd(thu2)} – ${dd(thu2 + 6 * 86400000)})`, tienTo: `Báo cáo tuần ${so}/${nam}:` };
}

export type CapNhatTuan = { nhiem_vu_id: string; noi_dung: string; luc: string; phan_tram: number | null; boi_ten: string | null };
export const laBaoCaoTuan = (c: CapNhatTuan, t: Tuan) => c.noi_dung.startsWith(t.tienTo);
export const boTienTo = (s: string) => s.replace(/^Báo cáo tuần \d+\/\d+:\s*/, '');
// Đơn vị rút báo cáo tuần (báo là chưa báo cáo): ghi một dòng đánh dấu, không xoá lịch sử
export const DAU_RUT = '(Đơn vị rút báo cáo — chưa báo cáo tuần này)';
export const laRutBaoCao = (noiDung: string) => boTienTo(noiDung).startsWith(DAU_RUT);
// Các lần báo cáo tuần còn hiệu lực (mới nhất trước): bỏ những lần trước lần rút gần nhất; lần mới nhất là bản đang dùng (sửa = gửi lại)
export function baoCaoHieuLuc<T extends { noi_dung: string; luc: string }>(ds: T[], t: Tuan): T[] {
  const cua = ds.filter((c) => c.noi_dung.startsWith(t.tienTo)).sort((a, b) => b.luc.localeCompare(a.luc));
  const i = cua.findIndex((c) => laRutBaoCao(c.noi_dung));
  return i < 0 ? cua : cua.slice(0, i);
}
// Báo cáo tuần gần nhất (mọi tuần) còn hiệu lực — bỏ dòng rút
export const laBaoCaoTuanBatKy = (noiDung: string) => /^Báo cáo tuần \d+\/\d+:/.test(noiDung) && !laRutBaoCao(noiDung);

// Tình trạng báo cáo tuần của một đơn vị
export type TinhTrangTuan = 'du' | 'tre' | 'thieu' | 'chua' | 'qua_han' | 'khong_co';
export const NHAN_TT_TUAN: Record<TinhTrangTuan, [string, string, string]> = {
  du: ['Đã gửi đủ', '#166534', '#DCFCE7'], tre: ['Gửi đủ, trễ hạn', '#92400E', '#FEF3C7'], thieu: ['Gửi chưa đủ', '#92400E', '#FEF3C7'],
  chua: ['Chưa gửi', '#3D4350', '#EAE6DC'], qua_han: ['Quá hạn chưa gửi', '#9F1239', '#FCE7EC'], khong_co: ['Không có nhiệm vụ', '#5B6170', '#F4F2ED'],
};
export function tinhTrangTuan(soViec: number, daBao: number, guiTre: boolean, t: Tuan, bayGio = Date.now()): TinhTrangTuan {
  if (!soViec) return 'khong_co';
  if (daBao >= soViec) return guiTre ? 'tre' : 'du';
  if (bayGio > t.han.getTime()) return daBao ? 'thieu' : 'qua_han';
  return daBao ? 'thieu' : 'chua';
}
