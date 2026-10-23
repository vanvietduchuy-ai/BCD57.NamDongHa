// Chốt tuần: ảnh chụp tiến độ / tình trạng của từng nhiệm vụ tại hạn nộp báo cáo của mỗi tuần.
// Lưu ở cau_hinh (khoá chot_tuan_<năm>_<tuần>) -> xem lại tuần cũ ra đúng số liệu của tuần đó, không đổi theo dữ liệu mới.
import { canBaoCaoTuan, goiYDanhGia, tinhTrangTatCa, type CapNhatTT, type CauHinhA4, type TinhTrang } from './danhMucA4';
import type { NhiemVu } from './nhiemVu';
import { baoCaoHieuLuc, type CapNhatTuan, type Tuan } from './baoCaoTuan';

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

// Nhiệm vụ phải báo cáo tuần t và các lần báo cáo còn hiệu lực của tuần đó (một nguồn dùng cho trang Báo cáo tuần và theo dõi nhiều tuần).
// quaKhu = tính tình trạng như lúc hạn của tuần t (tuần đã qua hạn), nếu không thì theo hiện tại.
export type ViecTuan = { n: NhiemVu; tuan: CapNhatTuan[] };
export function viecCuaTuan(nv: NhiemVu[], cn: CapNhatTuan[], cnMap: Map<string, CapNhatTT[]>, a4: CauHinhA4, t: Tuan, quaKhu: boolean): ViecTuan[] {
  const cha = new Set(Object.values(a4.dong).map((x) => x.cha).filter(Boolean) as string[]);
  const ttMap = tinhTrangTatCa(nv, cnMap, a4, quaKhu ? t.han : undefined);
  const ketThuc = t.ketThuc.toISOString();
  return nv.filter((n) => !cha.has(n.id) && n.chu_tri_don_vi_id).map((n) => {
    const trongTuan = baoCaoHieuLuc(cn.filter((c) => c.nhiem_vu_id === n.id), t);   // đã tính sửa / rút
    const luaXong = cnMap.get(n.id)?.find((c) => c.trang_thai_moi === 'hoan_thanh')?.luc;
    const can = canBaoCaoTuan(n, ttMap.get(n.id)!.tt, a4.dong[n.id]?.danh_gia ?? goiYDanhGia(n), trongTuan.length > 0, !!luaXong && luaXong > ketThuc);
    return { n, tuan: trongTuan, can };
  }).filter((x) => x.can).map(({ n, tuan }) => ({ n, tuan }))
    .sort((a, b) => (a.n.ma ?? '').localeCompare(b.n.ma ?? '', 'vi', { numeric: true }) || a.n.tao_luc.localeCompare(b.n.tao_luc));
}
export function gomCapNhat(cn: CapNhatTuan[]): Map<string, CapNhatTT[]> {
  const m = new Map<string, CapNhatTT[]>();
  for (const c of cn) { if (!m.has(c.nhiem_vu_id)) m.set(c.nhiem_vu_id, []); m.get(c.nhiem_vu_id)!.push(c); }   // mới nhất trước
  return m;
}
