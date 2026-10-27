// Danh mục nhiệm vụ dạng bảng A4: cấu hình bảng (lưu ở cau_hinh, khoá 'danh_muc_a4'),
// tính tình trạng quá hạn / sắp đến hạn, tỉ lệ theo đơn vị, đọc bảng danh mục từ tệp Word (.docx).
import { khongDau, NHOM_NV, type NhiemVu } from './nhiemVu';
import { khoaTuanHienTai, laBaoCaoTuanSau } from './baoCaoTuan';
import { homNayVN } from './dinhDang';

export const KHOA_CAU_HINH = 'danh_muc_a4';

export type KhoaCot = 'tt' | 'ten' | 'nguon_vb' | 'chu_tri' | 'san_pham' | 'han' | 'tien_do' | 'ket_qua_tuan' | 'minh_chung' | 'tinh_trang' | 'lanh_dao' | 'ma';
export type CotA4 = { khoa: KhoaCot; nhan: string; rong: number; hien: boolean };
export type NhomA4 = { id: string; ky_hieu: string; ten: string };
// Thông tin riêng của từng dòng trong bảng (không có trong bảng nhiem_vu)
// Cách đánh giá kết quả từng nhiệm vụ: tỷ lệ (đạt/tổng so với chỉ tiêu %), số lượng sản phẩm, % tiến độ, theo kỳ
export type KieuDG = 'ty_le' | 'so_luong' | 'tien_do' | 'ky';
// mau_dv: mẫu số (tổng số) biến động theo thời gian -> đơn vị chủ trì được sửa khi báo cáo (bỏ trống = tự đoán theo tên nhiệm vụ)
export type DanhGia = { kieu: KieuDG; chi_tieu?: number; tong?: number; mau_dv?: boolean };
export type SoLieuDG = { tu: number; mau: number; luc: string };
export type DongA4 = { nhom?: string; thu_tu?: number; nguon_vb?: string; han_vb?: string; chu_tri_vb?: string; tien_do_vb?: string; cao?: number; danh_gia?: DanhGia; so_lieu?: SoLieuDG; cha?: string; tt_tay?: { loai: LoaiTT; nhan: string } };   // tt_tay: tình trạng sửa tay (bỏ = tự động)   // cha: id nhiệm vụ lớn chứa nhiệm vụ này
export type CauHinhA4 = {
  tieu_de: string; dong_goc: string; dong_phu: string; ghi_chu: string; canh_bao_ngay: number;
  kho: { huong: 'ngang' | 'doc'; co_chu: number; le: [number, number, number, number] };   // lề trên, phải, dưới, trái (mm)
  cot: CotA4[]; nhom: NhomA4[]; dong: Record<string, DongA4>;
};

export const COT_MAC_DINH: CotA4[] = [
  { khoa: 'tt', nhan: 'TT', rong: 4, hien: true },
  { khoa: 'ten', nhan: 'Nội dung nhiệm vụ', rong: 21, hien: true },
  { khoa: 'nguon_vb', nhan: 'Nguồn văn bản giao', rong: 12, hien: true },
  { khoa: 'chu_tri', nhan: 'Cơ quan chủ trì / phối hợp', rong: 11, hien: true },
  { khoa: 'san_pham', nhan: 'Chỉ tiêu thực hiện / sản phẩm', rong: 13, hien: true },
  { khoa: 'han', nhan: 'Thời hạn hoàn thành', rong: 8, hien: true },
  { khoa: 'tien_do', nhan: 'Tiến độ thực hiện', rong: 14, hien: true },
  { khoa: 'ket_qua_tuan', nhan: 'Kết quả thực hiện', rong: 15, hien: true },   // tự điền từ báo cáo tuần
  { khoa: 'minh_chung', nhan: 'Minh chứng', rong: 8, hien: true },
  { khoa: 'tinh_trang', nhan: 'Tình trạng', rong: 7, hien: true },
  { khoa: 'lanh_dao', nhan: 'Lãnh đạo phụ trách', rong: 7, hien: false },
  { khoa: 'ma', nhan: 'Mã', rong: 5, hien: false },
];

export const CAU_HINH_MAC_DINH: CauHinhA4 = {
  tieu_de: 'DANH MỤC NHIỆM VỤ CẦN THỰC HIỆN',
  dong_goc: 'Phụ lục',
  dong_phu: '(Tính đến ngày {ngay})',
  ghi_chu: '',
  canh_bao_ngay: 7,
  kho: { huong: 'ngang', co_chu: 11, le: [15, 12, 15, 15] },
  cot: COT_MAC_DINH, nhom: [], dong: {},
};

// Ghép cấu hình đã lưu với mặc định (thêm cột mới nếu bản lưu cũ chưa có)
export function ghepCauHinh(luu: Partial<CauHinhA4> | null | undefined): CauHinhA4 {
  const l = luu ?? {};
  const cot = COT_MAC_DINH.map((c) => ({ ...c, ...(l.cot ?? []).find((x) => x.khoa === c.khoa) }));
  if (l.cot?.length) {
    // Cột đã bỏ (vd. thời hạn theo văn bản, kết quả) tự rơi khỏi bảng; cột mới đặt ngay sau cột đứng trước nó trong mặc định
    const thuTu = l.cot.map((c) => c.khoa as string);
    const vi = (k: KhoaCot): number => {
      const i = thuTu.indexOf(k); if (i >= 0) return i;
      const j = COT_MAC_DINH.findIndex((c) => c.khoa === k);
      return j > 0 ? vi(COT_MAC_DINH[j - 1].khoa) + 0.5 : -0.5;
    };
    cot.sort((a, b) => vi(a.khoa) - vi(b.khoa));
  }
  return {
    ...CAU_HINH_MAC_DINH, ...l,
    kho: { ...CAU_HINH_MAC_DINH.kho, ...l.kho },
    cot, nhom: l.nhom ?? [], dong: l.dong ?? {},
  };
}

export const kichThuocTrang = (c: CauHinhA4) => (c.kho.huong === 'doc' ? { rong: 210, cao: 297 } : { rong: 297, cao: 210 });

// ---------- Ngày tháng (theo giờ Việt Nam)
const ngayTu = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const soNgay = (tu: string, den: string) => Math.round((ngayTu(den) - ngayTu(tu)) / 86400000);
export const ngayNgan = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

// ---------- Tình trạng một nhiệm vụ
export type LoaiTT = 'xong' | 'qua_han' | 'sap_han' | 'dang' | 'chua' | 'dung';
export type TinhTrang = { loai: LoaiTT; nhan: string; tre?: number; con?: number };
export function tinhTrang(n: NhiemVu, canhBao: number, xongLuc?: string | null, hom: string = homNayVN()): TinhTrang {
  const han = n.dinh_ky && n.ky_han && !n.ky_xong ? n.ky_han : n.han;
  if (n.trang_thai === 'hoan_thanh') {
    const tre = n.han && xongLuc ? Math.max(0, soNgay(n.han, xongLuc.slice(0, 10))) : 0;
    return { loai: 'xong', nhan: tre ? `Hoàn thành (trễ ${tre} ngày)` : 'Hoàn thành', tre };
  }
  if (n.trang_thai === 'tam_dung') return { loai: 'dung', nhan: 'Tạm dừng' };
  if (han) {
    const con = soNgay(hom, han);
    if (con < 0) return { loai: 'qua_han', nhan: `Quá hạn ${-con} ngày`, tre: -con };
    if (con <= canhBao) return { loai: 'sap_han', nhan: con === 0 ? 'Đến hạn hôm nay' : `Còn ${con} ngày`, con };
  }
  return n.trang_thai === 'chua_trien_khai' ? { loai: 'chua', nhan: 'Chưa triển khai' } : { loai: 'dang', nhan: n.trang_thai === 'trinh_ky' ? 'Đang trình ký' : 'Đang thực hiện' };
}
// ---------- Tình trạng dùng chung cho bảng A4 và Tổng quan (một nguồn duy nhất, để hai nơi luôn cho cùng số liệu)
// Cập nhật tối thiểu cần để tính: nội dung (đọc "Kết quả: a/b"), thời điểm, trạng thái mới (hoàn thành)
export type CapNhatTT = { noi_dung: string; luc: string; trang_thai_moi?: string | null; phan_tram?: number | null };
// Số liệu kết quả mới nhất: lưu ở bảng hoặc đọc từ lần cập nhật gần nhất ("Kết quả: 34.605/37.070 …"); cn xếp mới nhất trước
export function soLieuMoiNhat(cn: CapNhatTT[], d: DongA4): { tu: number; mau: number } | null {
  const c = cn.find((y) => /Kết quả: (?:hoàn thành )?[\d.,]+\/[\d.,]+/.test(y.noi_dung));
  const m = c?.noi_dung.match(/Kết quả: (?:hoàn thành )?([\d.,]+)\/([\d.,]+)/);
  const tuCn = m ? { tu: docSo(m[1]), mau: docSo(m[2]), luc: c!.luc } : null;
  const a = d.so_lieu;
  if (a && (!tuCn || a.luc >= tuCn.luc)) return a;
  return tuCn && Number.isFinite(tuCn.tu) && Number.isFinite(tuCn.mau) ? tuCn : null;
}
// Tỷ lệ % của nhiệm vụ đánh giá theo tỷ lệ; dat: so với chỉ tiêu (undefined nếu không đặt chỉ tiêu)
export function tyLeNhiemVu(n: Pick<NhiemVu, 'san_pham' | 'dinh_ky'>, cn: CapNhatTT[], d: DongA4) {
  const sl = soLieuMoiNhat(cn, d); if (!sl || !sl.mau) return null;
  const chiTieu = (d.danh_gia ?? goiYDanhGia(n)).chi_tieu; const tyLe = (sl.tu / sl.mau) * 100;
  return { tu: sl.tu, mau: sl.mau, tyLe, chiTieu, dat: chiTieu ? tyLe >= chiTieu - 1e-9 : undefined };
}
// Tình trạng ghi tay: suy loại theo chữ (Đạt / Đảm bảo / Hoàn thành -> hoàn thành; Không đạt / Chưa đạt / Chậm -> chưa đạt; Có nguy cơ chậm -> đang thực hiện)
export const loaiTheoChu = (t: string, macDinh: LoaiTT): LoaiTT => {
  const c = khongDau(t.trim().toLowerCase());
  if (/(khong|chua) dat/.test(c)) return 'qua_han';
  // "Có nguy cơ chậm tiến độ", "không chậm"… chỉ là cảnh báo / còn đúng tiến độ — KHÔNG phải quá hạn: tính là đang thực hiện (giữ sắp đến hạn / chưa triển khai nếu đang vậy)
  if (/nguy co|(khong|chua) (bi |co )?cham/.test(c)) return macDinh === 'sap_han' || macDinh === 'chua' ? macDinh : 'dang';
  if (/cham/.test(c)) return 'qua_han';
  if (/^(dat|dam bao|hoan thanh|da hoan thanh)\b/.test(c)) return 'xong';
  return macDinh;
};
export const chuanTTTay = (t: { loai: LoaiTT; nhan: string }): TinhTrang => ({ loai: loaiTheoChu(t.nhan, t.loai), nhan: t.nhan });
const MUC_XAU: LoaiTT[] = ['qua_han', 'sap_han', 'dang', 'chua', 'dung', 'xong'];
// Tình trạng của MỌI nhiệm vụ: theo hạn và trạng thái; nhiệm vụ tỷ lệ đã Đạt / Đảm bảo là hoàn thành; nhiệm vụ lớn tổng hợp từ nhiệm vụ con;
// sau cùng áp tình trạng Thường trực sửa tay. tt = tình trạng hiển thị / thống kê, ttTD = tình trạng tự động (trước khi sửa tay)
// Dựng lại nhiệm vụ như lúc `moc` (dùng cho Chốt tuần): bỏ cập nhật sau mốc; % và trạng thái theo cập nhật cuối cùng trước mốc
export function nvTaiMoc(n: NhiemVu, cn: CapNhatTT[], moc: Date): NhiemVu {
  const t = moc.getTime(), truoc = cn.filter((y) => new Date(y.luc).getTime() <= t);   // cn: mới nhất trước
  const pt = truoc.find((y) => y.phan_tram != null)?.phan_tram;
  const ts = truoc.find((y) => y.trang_thai_moi)?.trang_thai_moi as NhiemVu['trang_thai'] | undefined;
  const nay = n.trang_thai;
  return { ...n, phan_tram: pt ?? (ts === 'hoan_thanh' ? 100 : 0), trang_thai: ts ?? (nay === 'hoan_thanh' ? 'dang_thuc_hien' : nay) };
}
export function tinhTrangTatCa(nv0: NhiemVu[], cn0: Map<string, CapNhatTT[]>, ch: CauHinhA4, moc?: Date): Map<string, { tt: TinhTrang; ttTD: TinhTrang; nv: NhiemVu }> {
  const hom = moc ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(moc) : undefined;
  const nv = moc ? nv0.map((n) => nvTaiMoc(n, cn0.get(n.id) ?? [], moc)) : nv0;
  const cn = moc ? new Map([...cn0].map(([k, v]) => [k, v.filter((y) => new Date(y.luc).getTime() <= moc.getTime())])) : cn0;
  const hopLe = new Set(ch.nhom.length ? ch.nhom.map((g) => g.id) : Object.keys(NHOM_NV).map((k) => `nv_${k}`));
  type R = { n: NhiemVu; nhom: string; d: DongA4; cn: CapNhatTT[]; con: R[]; cha: boolean; tt: TinhTrang };
  const hienTai = khoaTuanHienTai();   // nội dung chuẩn bị trước cho tuần sau chưa tính vào tiến độ / tình trạng
  const ds: R[] = nv.map((n) => {
    const d = ch.dong[n.id] ?? {}; const c = (cn.get(n.id) ?? []).filter((y) => !laBaoCaoTuanSau(y.noi_dung, hienTai));
    const g = d.nhom;
    return { n, d, cn: c, con: [], cha: false, nhom: g && hopLe.has(g) ? g : ch.nhom.length ? '_khac' : `nv_${n.nhom}`,
      tt: tinhTrang(n, ch.canh_bao_ngay, c.find((x) => x.trang_thai_moi === 'hoan_thanh')?.luc ?? null, hom) };
  });
  const theoId = new Map(ds.map((x) => [x.n.id, x]));
  // Nhiệm vụ con: thuộc một nhiệm vụ lớn cùng nhóm, nhiệm vụ lớn không phải là con của nhiệm vụ khác
  for (const x of ds) { const c = x.d.cha ? theoId.get(x.d.cha) : undefined; if (c && c !== x && !c.d.cha && c.nhom === x.nhom) { x.cha = true; c.con.push(x); } }
  for (const x of ds) {
    if (x.con.length || x.d.tt_tay) continue;
    const dg = x.d.danh_gia ?? goiYDanhGia(x.n); if (dg.kieu !== 'ty_le') continue;
    const t = tyLeNhiemVu(x.n, x.cn, x.d);
    if (t && (!t.chiTieu || t.dat)) x.tt = { loai: 'xong', nhan: t.chiTieu ? 'Đạt' : 'Đảm bảo' };
    // Số liệu kỳ mới chưa đạt: không còn coi là hoàn thành (nhiệm vụ cũ đã bị ghi nhận hoàn thành khi từng đạt)
    else if (t && x.n.trang_thai === 'hoan_thanh') x.tt = tinhTrang({ ...x.n, trang_thai: 'dang_thuc_hien' }, ch.canh_bao_ngay, null, hom);
  }
  for (const g of ds) {
    if (!g.con.length) continue;
    // Tình trạng thực tế của từng nhiệm vụ con: tình trạng Thường trực sửa tay (vd Hoàn thành) được ưu tiên, giống cột Tình trạng của dòng con
    const tc = g.con.map((c) => (c.d.tt_tay ? chuanTTTay(c.d.tt_tay) : c.tt));
    const xong = tc.filter((t) => t.loai === 'xong').length;
    const xau = MUC_XAU.find((m) => tc.some((t) => t.loai === m)) ?? 'chua';
    g.tt = xong === g.con.length ? { loai: 'xong', nhan: 'Hoàn thành' }
      : { loai: xau, nhan: xau === 'qua_han' ? `${tc.filter((t) => t.loai === 'qua_han').length} việc quá hạn` : `${xong}/${g.con.length} hoàn thành` };
  }
  // Nhãn tổng hợp cũ ("1/5 hoàn thành", "2 việc quá hạn") lỡ lưu thành sửa tay trên nhiệm vụ lớn thì bỏ qua, luôn tính lại từ nhiệm vụ con
  const nhanTongHop = (t: { nhan: string }) => /\d+\s*\/\s*\d+\s*(nhiệm vụ )?(con )?(đã )?hoàn thành|\d+\s*việc quá hạn/i.test(t.nhan);
  return new Map(ds.map((x) => [x.n.id, { ttTD: x.tt, tt: x.d.tt_tay && !(x.con.length && nhanTongHop(x.d.tt_tay)) ? chuanTTTay(x.d.tt_tay) : x.tt, nv: x.n }]));
}
// Nhiệm vụ phải báo cáo tuần (một nguồn duy nhất cho bảng A4 và trang Báo cáo tuần):
// đã duyệt giao, có đơn vị chủ trì; đã báo cáo tuần đó, hoặc hoàn thành SAU tuần đó (nộp bù), hoặc chưa xong và không tạm dừng;
// nhiệm vụ tính theo tỷ lệ % (nhập số liệu) vẫn nhập tiếp ở các kỳ sau dù tự tính Đạt / Đảm bảo / Chưa đạt, cho tới khi được chọn thủ công là Hoàn thành (trạng thái hoặc tình trạng sửa tay) thì từ tuần sau không thống kê nữa.
// han = mốc chốt báo cáo của tuần đang xét: nhiệm vụ duyệt giao SAU mốc chốt thì chưa phải báo cáo tuần đó, đưa sang tuần sau (trừ khi đơn vị đã báo cáo).
export function canBaoCaoTuan(n: NhiemVu, tt: TinhTrang, dg: DanhGia, daBaoTuan: boolean, xongSauTuan: boolean, han?: Date, ttTay = false): boolean {
  if (n.trang_thai_giao !== 'da_duyet' || !n.chu_tri_don_vi_id) return false;
  if (!daBaoTuan && han && n.duyet_luc && new Date(n.duyet_luc).getTime() > han.getTime()) return false;
  if (daBaoTuan || xongSauTuan) return true;
  if (n.trang_thai === 'tam_dung') return false;
  if (dg.kieu === 'ty_le') return !(ttTay && tt.loai === 'xong') && n.trang_thai !== 'hoan_thanh';
  return n.trang_thai !== 'hoan_thanh' && tt.loai !== 'xong';
}
export const MAU_TT: Record<LoaiTT, { chu: string; nen: string; vach: string }> = {
  xong: { chu: '#166534', nen: '#DCFCE7', vach: '#16A34A' },
  qua_han: { chu: '#9F1239', nen: '#FCE7EC', vach: '#BE123C' },
  sap_han: { chu: '#92400E', nen: '#FEF3C7', vach: '#D97706' },
  dang: { chu: '#1E3A8A', nen: '#DCE8FF', vach: '#1E3A8A' },
  chua: { chu: '#3D4350', nen: '#EAE6DC', vach: '#9CA3AF' },
  dung: { chu: '#5B6170', nen: '#EAE6DC', vach: '#9CA3AF' },
};

// ---------- Đọc tệp Word: lấy bảng đầu tiên, nhận dòng nhóm (A., B., …) và dòng nhiệm vụ
export type DongNhap = {
  nhom: { ky_hieu: string; ten: string } | null;
  stt: string; ten: string; chu_tri_vb: string; san_pham: string; han_vb: string; han_text: string; han: string; tien_do_vb: string; theo_doi: string;
};
export type KetQuaDoc = { tieu_de: string; dong_phu: string; ghi_chu: string; dong: DongNhap[]; cot: string[] };

async function docXmlTuDocx(f: File): Promise<string> {
  const XLSX = await import('xlsx');
  const buf = new Uint8Array(await f.arrayBuffer());
  const cfb = XLSX.CFB.read(buf, { type: 'array' });
  const e = XLSX.CFB.find(cfb, 'word/document.xml') ?? XLSX.CFB.find(cfb, '/word/document.xml');
  if (!e || !e.content) throw new Error('Không đọc được nội dung tệp Word. Hãy lưu lại tệp dưới dạng .docx.');
  return new TextDecoder('utf-8').decode(e.content as Uint8Array);
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function chuCuaPhanTu(el: Element): string {
  return Array.from(el.getElementsByTagNameNS(W, 'p')).map((p) => Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent ?? '').join('')).join('\n').trim();
}

// "30/11/2026 (đề xuất)" -> "2026-11-30"; lấy ngày cuối cùng nếu có nhiều mốc ("Xác nhận: 20/10/2026; hoàn thành: 30/11/2026")
export function layNgay(s: string): string {
  const all = [...s.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
  if (!all.length) return '';
  // Ưu tiên mốc "hoàn thành", "duy trì đến", nếu không lấy mốc đầu tiên
  const uuTien = all.find((m) => /(hoàn thành|duy trì|được cấp)[^0-9]*$/i.test(s.slice(Math.max(0, (m.index ?? 0) - 30), m.index)));
  const m = uuTien ?? all[0];
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export async function docDanhMucWord(f: File): Promise<KetQuaDoc> {
  const xml = await docXmlTuDocx(f);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const bodyEl = doc.getElementsByTagNameNS(W, 'body')[0];
  const bang = bodyEl ? Array.from(bodyEl.children).find((x) => x.localName === 'tbl') : undefined;
  if (!bang) throw new Error('Không thấy bảng trong tệp Word.');
  const doan = Array.from(bodyEl.children).filter((x) => x.localName === 'p').map(chuCuaPhanTu).filter(Boolean);
  const hang = Array.from(bang.children).filter((x) => x.localName === 'tr').map((tr) => Array.from(tr.children).filter((x) => x.localName === 'tc').map(chuCuaPhanTu));
  if (hang.length < 2) throw new Error('Bảng trong tệp Word không có dòng nhiệm vụ.');
  const tieuDeCot = hang[0].map((x) => khongDau(x));
  const tim = (...tu: string[]) => tieuDeCot.findIndex((x) => tu.some((t) => x.includes(t)));
  const iTen = tim('noi dung', 'nhiem vu'), iChuTri = tim('chu tri', 'co quan'), iSp = tim('chi tieu', 'san pham'),
    iHanVb = tim('theo van ban'), iHan = tim('hoan thanh'), iTd = tim('tien do'), iTheoDoi = tim('theo doi');
  if (iTen < 0) throw new Error('Không nhận ra cột "Nội dung nhiệm vụ" trong bảng.');
  let nhom: DongNhap['nhom'] = null;
  const dong: DongNhap[] = [];
  for (const h of hang.slice(1)) {
    const khac = new Set(h.filter(Boolean));
    const mNhom = h[0]?.match(/^([A-ZĐ]|[IVX]+)\.\s*(.+)$/s);
    if (mNhom && (khac.size === 1 || !h[iTen] || h[iTen] === h[0])) { nhom = { ky_hieu: mNhom[1], ten: mNhom[2].trim() }; continue; }
    const ten = (h[iTen] ?? '').trim();
    if (!ten) continue;
    const hanText = iHan >= 0 ? h[iHan] ?? '' : '';
    const hanVb = iHanVb >= 0 ? h[iHanVb] ?? '' : '';
    dong.push({
      nhom, stt: h[0] ?? '', ten, chu_tri_vb: iChuTri >= 0 ? h[iChuTri] ?? '' : '', san_pham: iSp >= 0 ? h[iSp] ?? '' : '',
      han_vb: hanVb, han_text: hanText, han: layNgay(hanText) || layNgay(hanVb), tien_do_vb: iTd >= 0 ? h[iTd] ?? '' : '', theo_doi: iTheoDoi >= 0 ? h[iTheoDoi] ?? '' : '',
    });
  }
  const tieu = doan.find((x) => /danh m[ụu]c/i.test(x)) ?? '';
  const phu = doan.find((x) => /^\(t[íi]nh đến/i.test(x)) ?? '';
  const ghiChu = doan.filter((x) => x.startsWith('(*')).join('\n');
  return { tieu_de: tieu, dong_phu: phu, ghi_chu: ghiChu, dong, cot: hang[0] };
}

// Đoán đơn vị chủ trì / phối hợp từ chữ trong cột "Cơ quan chủ trì / phối hợp"
export type DonViGon = { id: string; ten: string };
const BI_DANH: [RegExp, RegExp][] = [
  [/van hoa\s*-?\s*xa hoi|vhxh|vh-xh/, /van hoa/],
  [/kt-ht-dt|kinh te\s*-?\s*ha tang/, /kinh te/],
  [/van phong hdnd|vp hdnd/, /van phong hdnd|hdnd/],
  [/van phong dang uy|vp dang uy/, /van phong dang uy/],
  [/ban xay dung dang/, /xay dung dang/],
  [/mttq|mat tran/, /mat tran|mttq/],
  [/trung tam phuc vu|hanh chinh cong/, /phuc vu hanh chinh|hanh chinh cong/],
  [/bao hiem xa hoi/, /bao hiem/],
  [/thue/, /thue/],
  [/co quan thuong truc/, /tong hop|thuong truc/],
  [/cong an phuong/, /cong an phuong|tong hop/],
  [/ubnd phuong|uy ban nhan dan/, /^ubnd|uy ban nhan dan/],
];
export function doanDonVi(chu: string, ds: DonViGon[]): { chu_tri: string; phoi_hop: string[] } {
  const t = khongDau(chu);
  const [truoc, sau] = t.includes('chu tri') ? [t.split('chu tri')[0], t.split('chu tri').slice(1).join(' ')] : [t, ''];
  const tim = (doan_: string): string[] => {
    const kq: string[] = [];
    for (const [mau, dv] of BI_DANH) {
      if (!mau.test(doan_)) continue;
      const d = ds.find((x) => dv.test(khongDau(x.ten)));
      if (d && !kq.includes(d.id)) kq.push(d.id);
    }
    for (const d of ds) { const k = khongDau(d.ten); if (k.length > 6 && doan_.includes(k) && !kq.includes(d.id)) kq.push(d.id); }
    return kq;
  };
  // "UBND phường (Văn phòng HĐND&UBND) chủ trì": ưu tiên đơn vị trong ngoặc
  const ngoac = truoc.match(/\(([^)]+)\)/)?.[1];
  const ct = [...new Set((ngoac ? tim(ngoac) : []).concat(tim(truoc)))];
  const ph = tim(sau).filter((x) => x !== ct[0]);
  return { chu_tri: ct[0] ?? '', phoi_hop: [...new Set([...ct.slice(1), ...ph])] };
}

// Trạng thái ban đầu theo cột "Tiến độ" của văn bản
export function trangThaiTuChu(s: string): 'chua_trien_khai' | 'dang_thuc_hien' | 'hoan_thanh' {
  const t = khongDau(s);
  if (/^(da )?hoan thanh/.test(t)) return 'hoan_thanh';
  if (/^chua (trien khai|co thong tin)/.test(t)) return 'chua_trien_khai';
  return 'dang_thuc_hien';
}

// ---------- Đánh giá kết quả: tự nhận cách đánh giá từ "Chỉ tiêu / sản phẩm"
// "37.070" (dấu chấm phân nghìn) -> 37070; "92,3" -> 92.3
export const docSo = (t: string) => { const x = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t.replace(',', '.'); const v = Number(x); return Number.isFinite(v) ? v : NaN; };
// Nhiệm vụ có mẫu số thay đổi theo thời gian (vd: kích hoạt VNeID mức 2 — tổng số công dân đủ điều kiện tăng/giảm)
export const MAU_BIEN_DONG = /vneid|định danh điện tử|kích hoạt tài khoản/i;
export const mauDonViSua = (dg: DanhGia, n: Pick<NhiemVu, 'ten'>) => dg.mau_dv ?? MAU_BIEN_DONG.test(n.ten ?? '');
export function goiYDanhGia(n: Pick<NhiemVu, 'san_pham' | 'dinh_ky'>): DanhGia {
  if (n.dinh_ky) return { kieu: 'ky' };
  const sp = n.san_pham ?? '';
  const pt = sp.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const tongSo = sp.match(/tổng\s*(?:số)?\s*([\d.]+)/i);
  if (pt || tongSo) return { kieu: 'ty_le', chi_tieu: pt ? docSo(pt[1]) : undefined, tong: tongSo ? docSo(tongSo[1]) : undefined };
  const phan = sp.match(/(\d+)\s*\/\s*(\d+)/) ?? null;
  if (phan) return { kieu: 'so_luong', tong: Number(phan[2]) };
  const toiThieu = sp.match(/(?:tối thiểu|ít nhất|đạt)\s*(\d+)/i);
  if (toiThieu) return { kieu: 'so_luong', tong: Number(toiThieu[1]) };
  return { kieu: 'tien_do' };
}
// % hoàn thành nhiệm vụ từ số liệu: tỷ lệ so với chỉ tiêu (đạt chỉ tiêu = 100%)
export function tinhDanhGia(dg: DanhGia, tu: number, mau: number) {
  const tyLe = mau > 0 ? (tu / mau) * 100 : 0;
  const muc = dg.kieu === 'ty_le' && dg.chi_tieu ? dg.chi_tieu : 100;
  const phanTram = Math.max(0, Math.min(100, Math.round((tyLe / muc) * 100)));
  return { tyLe, phanTram, dat: tyLe >= muc - 1e-9 };
}
export const soVN = (x: number, le = 0) => x.toLocaleString('vi-VN', { maximumFractionDigits: le });
