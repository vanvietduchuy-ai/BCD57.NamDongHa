// Chốt tuần: ảnh chụp tiến độ / tình trạng của từng nhiệm vụ tại hạn nộp báo cáo của mỗi tuần.
// Lưu ở cau_hinh (khoá chot_tuan_<năm>_<tuần>) -> xem lại tuần cũ ra đúng số liệu của tuần đó, không đổi theo dữ liệu mới.
import { tinhTrangTatCa, type CapNhatTT, type CauHinhA4, type TinhTrang } from './danhMucA4';
import type { NhiemVu } from './nhiemVu';
import type { Tuan } from './baoCaoTuan';

export type MucChot = { tt: TinhTrang; ttTD: TinhTrang; pt: number; ts: NhiemVu['trang_thai'] };
export type AnhChup = { luc: string; nv: Record<string, MucChot> };
export const khoaChot = (t: Tuan) => `chot_tuan_${t.nam}_${t.so}`;
// Tuần đã qua hạn thì mới chốt được
export const daQuaHan = (t: Tuan, bay = Date.now()) => bay > t.han.getTime();

// Tính ảnh chụp tại thời điểm hạn của tuần t
export function chupTuan(nv: NhiemVu[], cn: Map<string, CapNhatTT[]>, ch: CauHinhA4, t: Tuan): AnhChup {
  const kq = tinhTrangTatCa(nv, cn, ch, t.han);
  const o: Record<string, MucChot> = {};
  for (const [id, v] of kq) o[id] = { tt: v.tt, ttTD: v.ttTD, pt: v.nv.phan_tram, ts: v.nv.trang_thai };
  return { luc: new Date().toISOString(), nv: o };
}
