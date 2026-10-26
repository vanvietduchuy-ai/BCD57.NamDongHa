// Báo cáo tuần: mỗi kỳ báo cáo kết quả các nhiệm vụ đang thực hiện, số liệu tuần N tính từ hạn nộp tuần N-1 đến hạn nộp tuần N
// (vd hạn 16h00 thứ Ba: tuần N tính từ 16h00 thứ Ba tuần N-1 đến 16h00 thứ Ba tuần N; tuần N = tuần ISO chứa ngày hạn).
// Mỗi nhiệm vụ báo cáo = một dòng nhiem_vu_cap_nhat có tiền tố "Báo cáo tuần NN/YYYY:" -> không cần thêm bảng mới.
// Hạn nộp lưu ở cau_hinh (khoá 'bao_cao_tuan'): thứ trong tuần + giờ.
export const KHOA_BCT = 'bao_cao_tuan';
export type MocGio = { thu: number; gio: number; phut?: number };
// mo: bắt đầu nhận báo cáo (trước hạn, vd 7h thứ Hai); dong: kết thúc nhận (sau hạn, vd 11h thứ Tư). Bỏ trống = không giới hạn.
export type CauHinhBCT = { thu: number; gio: number; phut?: number; bat: boolean; mo?: MocGio | null; dong?: MocGio | null };   // thu: 1 = thứ Hai … 7 = Chủ nhật
export const BCT_MAC_DINH: CauHinhBCT = { thu: 5, gio: 17, bat: true };
export const TEN_THU: Record<number, string> = { 1: 'thứ Hai', 2: 'thứ Ba', 3: 'thứ Tư', 4: 'thứ Năm', 5: 'thứ Sáu', 6: 'thứ Bảy', 7: 'Chủ nhật' };

const VN = 7 * 3600 * 1000;
// Ngày (theo giờ VN) dạng UTC-midnight để tính toán
const ngayVN = (d: Date) => { const t = new Date(d.getTime() + VN); return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };

// Giờ hạn dạng 17:00
export const gioHan = (ch: CauHinhBCT) => `${String(ch.gio).padStart(2, '0')}:${String(ch.phut ?? 0).padStart(2, '0')}`;
export type Tuan = { so: number; nam: number; batDau: Date; ketThuc: Date; han: Date; ten: string; tienTo: string };
// Kỳ báo cáo tuần: lui = số tuần lùi lại. Kỳ hiện tại = kỳ có hạn nộp gần nhất chưa qua (qua hạn thì sang kỳ kế tiếp).
export function tuanCua(d: Date, ch: CauHinhBCT, lui = 0): Tuan {
  const DAY = 86400000;
  const n0 = ngayVN(d);
  const thu = ((new Date(n0).getUTCDay() + 6) % 7) + 1;              // 1..7
  const hanCua = (t2: number) => t2 + (ch.thu - 1) * DAY + ch.gio * 3600000 + (ch.phut ?? 0) * 60000 - VN;
  let thu2 = n0 - (thu - 1) * DAY;                                    // thứ Hai 00:00 (VN, dạng UTC) của tuần chứa ngày hạn
  if (hanCua(thu2) < d.getTime()) thu2 += 7 * DAY;                    // đã qua hạn tuần này -> kỳ đang chờ báo cáo là tuần kế tiếp
  thu2 -= lui * 7 * DAY;
  // Số tuần ISO: theo thứ Năm của tuần
  const thu5 = new Date(thu2 + 3 * DAY);
  const nam = thu5.getUTCFullYear();
  const so = Math.floor((thu5.getTime() - Date.UTC(nam, 0, 1)) / (7 * DAY)) + 1;
  const han = new Date(hanCua(thu2));
  const batDau = new Date(han.getTime() - 7 * DAY);                   // hạn nộp của tuần trước
  const ketThuc = new Date(han.getTime() - 1);
  const dd = (x: Date) => { const t = new Date(x.getTime() + VN); return `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };
  return { so, nam, batDau, ketThuc, han, ten: `Tuần ${so}/${nam} (${dd(batDau)} – ${dd(han)})`, tienTo: `Báo cáo tuần ${so}/${nam}:` };
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

// ---------- Cửa sổ nhận báo cáo của một kỳ: mốc hạn giữ nguyên (cách tính số liệu, nộp muộn), nhưng đơn vị chỉ nộp được từ `mo` đến `dong`
const NGAY = 86400000;
export function cuaSoNop(ch: CauHinhBCT, t: Tuan): { mo: Date | null; dong: Date | null } {
  const han0 = ngayVN(t.han) - VN;                                   // 00:00 (giờ VN) của ngày hạn
  const tai = (m: MocGio) => han0 + (m.thu - ch.thu) * NGAY + m.gio * 3600000 + (m.phut ?? 0) * 60000;
  let mo = ch.mo ? tai(ch.mo) : null; if (mo !== null && mo > t.han.getTime()) mo -= 7 * NGAY;
  let dong = ch.dong ? tai(ch.dong) : null; if (dong !== null && dong < t.han.getTime()) dong += 7 * NGAY;
  return { mo: mo === null ? null : new Date(mo), dong: dong === null ? null : new Date(dong) };
}
export const nhanMoc = (d: Date) => {
  const v = new Date(d.getTime() + VN), thu = ((v.getUTCDay() + 6) % 7) + 1;
  return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')} ${TEN_THU[thu]} ${String(v.getUTCDate()).padStart(2, '0')}/${String(v.getUTCMonth() + 1).padStart(2, '0')}`;
};
// Trả thông báo nếu bây giờ ngoài thời gian nhận báo cáo của kỳ (lui < 0 = chuẩn bị trước, không áp dụng)
export function kiemTraCuaSoNop(ch: CauHinhBCT, t: Tuan, lui: number, bayGio = Date.now()): string | null {
  if (lui < 0) return null;
  const { mo, dong } = cuaSoNop(ch, t);
  if (mo && bayGio < mo.getTime()) return `Chưa đến thời gian nhận báo cáo của ${t.ten.split(' (')[0].toLowerCase()} — mở lúc ${nhanMoc(mo)}.`;
  if (dong && bayGio > dong.getTime()) return `Đã hết thời gian nhận báo cáo của ${t.ten.split(' (')[0].toLowerCase()} — đóng lúc ${nhanMoc(dong)}. Liên hệ Cơ quan Thường trực để nhập thay.`;
  return null;
}
