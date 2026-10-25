// Báo cáo tuần: mỗi tuần (thứ Hai – Chủ nhật, giờ Việt Nam) đơn vị chủ trì báo cáo kết quả các nhiệm vụ đang thực hiện.
// Mỗi nhiệm vụ báo cáo = một dòng nhiem_vu_cap_nhat có tiền tố "Báo cáo tuần NN/YYYY:" -> không cần thêm bảng mới.
// Hạn nộp lưu ở cau_hinh (khoá 'bao_cao_tuan'): thứ trong tuần + giờ.
export const KHOA_BCT = 'bao_cao_tuan';
export type CauHinhBCT = { thu: number; gio: number; phut?: number; bat: boolean };   // thu: 1 = thứ Hai … 7 = Chủ nhật; 8 … 14 = thứ Hai … Chủ nhật của tuần sau (nộp báo cáo tuần N vào tuần N+1)
export const BCT_MAC_DINH: CauHinhBCT = { thu: 5, gio: 17, bat: true };
export const TEN_THU: Record<number, string> = { 1: 'thứ Hai', 2: 'thứ Ba', 3: 'thứ Tư', 4: 'thứ Năm', 5: 'thứ Sáu', 6: 'thứ Bảy', 7: 'Chủ nhật',
  8: 'thứ Hai tuần sau', 9: 'thứ Ba tuần sau', 10: 'thứ Tư tuần sau', 11: 'thứ Năm tuần sau', 12: 'thứ Sáu tuần sau', 13: 'thứ Bảy tuần sau', 14: 'Chủ nhật tuần sau' };

const VN = 7 * 3600 * 1000;
// Ngày (theo giờ VN) dạng UTC-midnight để tính toán
const ngayVN = (d: Date) => { const t = new Date(d.getTime() + VN); return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };

// Giờ hạn dạng 17:00
export const gioHan = (ch: CauHinhBCT) => `${String(ch.gio).padStart(2, '0')}:${String(ch.phut ?? 0).padStart(2, '0')}`;
export type Tuan = { so: number; nam: number; batDau: Date; ketThuc: Date; han: Date; ten: string; tienTo: string };
// Tuần chứa ngày d (lui = số tuần lùi lại)
export function tuanCua(d: Date, ch: CauHinhBCT, lui = 0): Tuan {
  const DAY = 86400000;
  const n0 = ngayVN(d);
  const thu = ((new Date(n0).getUTCDay() + 6) % 7) + 1;              // 1..7
  const sauTuan = Math.floor((ch.thu - 1) / 7);                       // 0: hạn nằm trong tuần; 1: hạn nằm ở tuần sau
  const hanCua = (t2: number) => t2 + (ch.thu - 1) * DAY + ch.gio * 3600000 + (ch.phut ?? 0) * 60000 - VN;
  let thu2 = n0 - (thu - 1) * DAY - sauTuan * 7 * DAY;                // thứ Hai 00:00 (VN, dạng UTC) của tuần đang chờ báo cáo
  if (sauTuan > 0 && hanCua(thu2) < d.getTime()) thu2 += 7 * DAY;     // đã qua hạn tuần trước -> tuần hiện tại là tuần chờ báo cáo kế tiếp
  thu2 -= lui * 7 * DAY;
  // Số tuần ISO: theo thứ Năm của tuần
  const thu5 = new Date(thu2 + 3 * 86400000);
  const nam = thu5.getUTCFullYear();
  const so = Math.floor((thu5.getTime() - Date.UTC(nam, 0, 1)) / (7 * 86400000)) + 1;
  const batDau = new Date(thu2 - VN);
  const ketThuc = new Date(thu2 + 7 * 86400000 - VN - 1);
  const han = new Date(hanCua(thu2));
  const dd = (x: number) => { const t = new Date(x); return `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };
  return { so, nam, batDau, ketThuc, han, ten: `Tuần ${so}/${nam} (${dd(thu2)} – ${dd(thu2 + 6 * 86400000)})`, tienTo: `Báo cáo tuần ${so}/${nam}:` };
}

export type CapNhatTuan = { nhiem_vu_id: string; noi_dung: string; luc: string; phan_tram: number | null; boi_ten: string | null; trang_thai_moi?: string | null };
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
// Thời điểm gửi đầu tiên (các lần sửa sau không làm tăng độ trễ): ds là các lần còn hiệu lực của một tuần
export const nopDauTien = (ds: { luc: string }[]): string | null => ds.reduce<string | null>((m, c) => (m === null || c.luc < m ? c.luc : m), null);
// Số mili giây nộp muộn so với hạn (0 nếu đúng hạn hoặc chưa nộp)
export const muonMs = (ds: { luc: string }[], han: Date | number): number => { const d = nopDauTien(ds); return d ? Math.max(0, new Date(d).getTime() - new Date(han).getTime()) : 0; };
export function chuTre(ms: number): string {
  const p = Math.max(1, Math.round(ms / 60000)), ngay = Math.floor(p / 1440), gio = Math.floor((p % 1440) / 60);
  return ngay ? `${ngay} ngày${gio ? ` ${gio} giờ` : ''}` : gio ? `${gio} giờ` : `${p} phút`;
}
// Khoá so sánh tuần của một dòng báo cáo tuần (năm*100 + số tuần); null nếu không phải báo cáo tuần
export const khoaTuan = (noiDung: string): number | null => { const m = noiDung.match(/^Báo cáo tuần (\d+)\/(\d+):/); return m ? Number(m[2]) * 100 + Number(m[1]) : null; };
// Báo cáo của tuần SAU tuần hiện tại = nội dung chuẩn bị trước: chưa tính vào tiến độ / tình trạng cho tới khi sang tuần đó
export const khoaTuanHienTai = () => { const t = tuanCua(new Date(), BCT_MAC_DINH); return t.nam * 100 + t.so; };
export const laBaoCaoTuanSau = (noiDung: string, hienTai = khoaTuanHienTai()): boolean => { const k = khoaTuan(noiDung); return k !== null && k > hienTai; };
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
