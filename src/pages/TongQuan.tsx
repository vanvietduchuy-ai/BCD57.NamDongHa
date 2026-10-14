// Tổng quan điều hành (Thường trực, lãnh đạo) / Theo dõi đơn vị (đầu mối, chuTri): theo bố cục thiết kế gốc
//   (1) kỳ chính đang mở: đếm ngược + tiến độ nộp; (2) hạn sắp tới; (3) 4 ô việc cần làm;
//   (4) tình hình nộp của từng đơn vị theo tháng (ô màu); (5) nhiệm vụ cần chú ý.
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Inbox, Plus, Search, Send, SendHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { kq, useBayGio, useDuLieu } from '../lib/useDuLieu';
import { useAuth, laQuanTri, type HoSo } from '../lib/auth';
import { conLaiNgan, hai, mucGap, ngay, ngayGio, ngayGioDu, tenNgan, thuNgay } from '../lib/dinhDang';
import { type NhiemVu } from '../lib/nhiemVu';
import { HopNhac, type DonViNhac } from '../components/HopNhac';
import { ChipHan, DangTai, DemSo, DongHo, HopLoi, Rong, The, cx } from '../components/ui';
import { Chuong } from '../components/KhungTrang';

type KyMo = { ky_id: string; chu_tri_don_vi_id: string | null; don_vi_giao: string | null; ten: string; loai: string; han_nop: string; han_gui_tinh: string | null; so_don_vi: number; da_nop: number; da_duyet: number; can_bo_sung: number; chua_nop: number };
type Dong = { nop_id: string; ky_id: string; don_vi_id: string; don_vi: string; thu_tu: number; ky: string; loai: string; trang_thai: string; han: string; nop_luc: string | null; dung_han: boolean | null; tre_ngay: number; tu_ngay: string | null };
type NvChuY = Pick<NhiemVu, 'id' | 'ma' | 'ten' | 'han' | 'qua_han' | 'con_ngay' | 'trang_thai' | 'phan_tram' | 'chu_tri_ten' | 'dinh_ky' | 'ky_han'>;

const LOAI_KY: Record<string, string> = { thang: 'THÁNG', quy: 'QUÝ', sau_thang: '6 THÁNG', nam: 'NĂM', dot_xuat: 'ĐỘT XUẤT' };

type VbNhan = { id: string; tu_don_vi: string; gui_luc: string; trich_yeu: string; so_ky_hieu: string | null; han_phan_hoi: string | null };
type VbGui = { id: string; gui_luc: string; trich_yeu: string; so_ky_hieu: string | null; noi_nhan: { nhan_luc: string | null }[] };

async function taiVanBan() {
  const [a, b] = await Promise.all([
    supabase.from('v_cong_van_nhan').select('id, tu_don_vi, gui_luc, trich_yeu, so_ky_hieu, han_phan_hoi').is('nhan_luc', null).order('gui_luc', { ascending: false }).limit(20),
    supabase.from('v_cong_van').select('id, gui_luc, trich_yeu, so_ky_hieu, noi_nhan').order('gui_luc', { ascending: false }).limit(30),
  ]);
  if (a.error) return null;
  const gui = ((b.data ?? []) as VbGui[]).filter((g) => g.noi_nhan.some((n) => !n.nhan_luc));
  return { chuaNhan: (a.data ?? []) as VbNhan[], guiCho: gui };
}

async function tai(chuTri: string | null, donViMinh: string | null, hoSo: HoSo | null) {
  const nam = new Date().getFullYear();
  let qKy = supabase.from('v_tinh_hinh_nop').select('ky_id, chu_tri_don_vi_id, don_vi_giao, ten, loai, han_nop, han_gui_tinh, so_don_vi, da_nop, da_duyet, can_bo_sung, chua_nop').eq('trang_thai_ky', 'mo').eq('cap', 'don_vi');
  let qNop = supabase.from('v_theo_doi_nop').select('nop_id, ky_id, don_vi_id, don_vi, thu_tu, ky, loai, trang_thai, han, nop_luc, dung_han, tre_ngay, tu_ngay')
    .eq('cap', 'don_vi').gte('han', `${nam}-01-01T00:00:00+07:00`).lte('han', `${nam}-12-31T23:59:59+07:00`);
  let qNv = supabase.from('v_nhiem_vu').select('id, ma, ten, han, qua_han, con_ngay, trang_thai, phan_tram, chu_tri_ten, dinh_ky, ky_han')
    .eq('trang_thai_giao', 'da_duyet');
  if (chuTri) { qKy = qKy.eq('chu_tri_don_vi_id', chuTri); qNop = qNop.eq('chu_tri_don_vi_id', chuTri); qNv = qNv.eq('chu_tri_don_vi_id', chuTri); }
  const [a, b, d, f, e] = await Promise.all([
    qKy.order('han_nop'),
    qNop,
    supabase.from('nhiem_vu').select('id', { count: 'exact', head: true }).eq('trang_thai_giao', 'de_xuat'),
    qNv.order('han', { ascending: true, nullsFirst: false }),
    // Tổ Tổng hợp (Thường trực) cũng nộp báo cáo chuyên đề cho Phòng VH-XH
    !chuTri && donViMinh ? supabase.from('v_viec_can_nop').select('nop_id, ten, han_nop, don_vi_giao').eq('don_vi_id', donViMinh).order('han_nop') : Promise.resolve({ data: [], error: null }),
  ]);
  const tatCa = (kq(f) ?? []) as NvChuY[];
  const nv = tatCa.filter((n) => !['hoan_thanh', 'tam_dung'].includes(n.trang_thai));
  const quaHan = nv.filter((n) => n.qua_han);
  return {
    nam, kyMo: (kq(a) ?? []) as KyMo[], dong: (kq(b) ?? []) as Dong[], choDuyet: d.count ?? 0,
    nvTong: tatCa.length, nvXong: tatCa.filter((n) => n.trang_thai === 'hoan_thanh').length,
    nvChuaTk: tatCa.filter((n) => n.trang_thai === 'chua_trien_khai').length,
    nvDang: nv.length, nvQuaHan: quaHan.length,
    nvQuaLauNhat: quaHan.reduce((m, n) => Math.max(m, -(n.con_ngay ?? 0)), 0),
    nvChuY: nv.filter((n) => n.qua_han || (n.con_ngay != null && n.con_ngay <= 14)).sort((x, y) => (x.con_ngay ?? 99) - (y.con_ngay ?? 99)).slice(0, 7),
    canNop: ((e as { data: unknown }).data ?? []) as { nop_id: string; ten: string; han_nop: string; don_vi_giao: string | null }[],
    ...(await taiThem(chuTri, hoSo)),
  };
}
async function taiThem(chuTri: string | null, hoSo: HoSo | null) {
  const vb = !chuTri && ['quan_tri', 'admin'].includes(hoSo?.vai_tro ?? '');
  return { vb: vb ? await taiVanBan().catch(() => null) : null };
}

const daGui = (x: Dong) => !!x.nop_luc && ['da_nop', 'da_duyet', 'can_bo_sung'].includes(x.trang_thai);

// Tình hình nộp theo tháng: mỗi ô = các kỳ có hạn trong tháng đó của 1 đơn vị (lấy tình trạng xấu nhất)
type O = 'dung' | 'tre' | 'khong' | 'chua' | null;
const MAU_O: Record<Exclude<O, null>, [string, string]> = {
  dung: ['bg-xanh', 'Đúng hạn'], tre: ['bg-[#F59E0B]', 'Trễ / bổ sung'], khong: ['bg-nguy', 'Không nộp'], chua: ['border border-dashed border-vien-2 bg-white', 'Chưa đến hạn / đang mở'],
};
function bangNop(dong: Dong[], soThang = 4) {
  const bayGio = Date.now();
  const thangCuoi = new Date();
  const cot = Array.from({ length: soThang }, (_, i) => {
    const d = new Date(thangCuoi.getFullYear(), thangCuoi.getMonth() + 1 - (soThang - 1 - i), 1);
    return { khoa: `${d.getFullYear()}-${hai(d.getMonth() + 1)}`, nhan: `T${d.getMonth() + 1}` };
  });
  const hang = new Map<string, { ten: string; thu_tu: number; o: Record<string, O> }>();
  const hang_ = (x: Dong) => hang.get(x.don_vi_id) ?? hang.set(x.don_vi_id, { ten: x.don_vi, thu_tu: x.thu_tu, o: {} }).get(x.don_vi_id)!;
  const muc = { khong: 3, tre: 2, chua: 1, dung: 0 } as const;
  for (const x of dong) {
    const khoa = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date(x.han));
    if (!cot.some((c) => c.khoa === khoa)) continue;
    const t: O = daGui(x) ? (x.dung_han && x.trang_thai !== 'can_bo_sung' ? 'dung' : 'tre') : Date.parse(x.han) < bayGio ? 'khong' : 'chua';
    const h = hang_(x);
    const cu = h.o[khoa];
    if (!cu || muc[t!] > muc[cu]) h.o[khoa] = t;
  }
  return { cot, hang: [...hang.values()].sort((a, b) => a.thu_tu - b.thu_tu) };
}

// Ô số liệu theo thiết kế gốc: tiêu đề, số lớn + chú thích, dòng phụ
function OSo({ nhan, so, sau, phu, den, mau = 'text-den' }: { nhan: string; so: ReactNode; sau?: ReactNode; phu?: ReactNode; den: string; mau?: string }) {
  return (
    <Link to={den} className="the-noi flex min-w-0 flex-col gap-1.5 rounded-2xl border border-vien bg-white px-3.5 py-3 text-den sm:gap-2 sm:px-5 sm:py-4">
      <span className="truncate text-[0.8125rem] text-mo-2 sm:text-[0.8438rem]">{nhan}</span>
      <span className="flex items-baseline gap-2">
        <span className={cx('mono text-[1.5rem] font-bold leading-none sm:text-[1.875rem]', mau)}>{so}</span>
        {sau && <span className="truncate text-[0.8125rem] text-mo-2">{sau}</span>}
      </span>
      {phu && <span className="truncate text-[0.7812rem] text-mo">{phu}</span>}
    </Link>
  );
}

// Tỷ lệ nộp đúng hạn trong một quý (chỉ tính bài đã đến hạn)
function tyLeQuy(dong: Dong[], nam: number, quy: number) {
  const bayGio = Date.now();
  const trong = dong.filter((x) => {
    const d = new Date(x.han);
    return d.getFullYear() === nam && Math.floor(d.getMonth() / 3) + 1 === quy && Date.parse(x.han) < bayGio;
  });
  if (!trong.length) return null;
  return Math.round((trong.filter((x) => daGui(x) && x.dung_han && x.trang_thai !== 'can_bo_sung').length / trong.length) * 100);
}
const LA_MA = ['', 'I', 'II', 'III', 'IV'];

// nhung: hiển thị lồng trong trang chủ đơn vị đầu mối (phần theo dõi các đơn vị), không có đầu trang riêng
export default function TongQuan({ chuTri = null, nhung = false }: { chuTri?: string | null; nhung?: boolean }) {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  const nhacDuoc = quanTri || !!chuTri;
  const nav = useNavigate();
  const [tim, setTim] = useState('');
  const { data, loi, dangTai, taiLai } = useDuLieu(() => tai(chuTri, hoSo?.vai_tro === 'quan_tri' ? hoSo.don_vi_id : null, hoSo), [chuTri]);
  const [tb, setTb] = useState<string | null>(null);
  const [nhacKy, setNhacKy] = useState<{ k: KyMo; ds: DonViNhac[] } | null>(null);
  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;
  if (!data) return null;

  const chuaNopCua = (kyId: string) => data.dong.filter((x) => x.ky_id === kyId && !daGui(x)).sort((a, b) => a.thu_tu - b.thu_tu);
  const nhac = (k: KyMo) => setNhacKy({ k, ds: chuaNopCua(k.ky_id).map((x) => ({ nop_id: x.nop_id, don_vi_id: x.don_vi_id, don_vi: x.don_vi })) });

  // Kỳ chính: kỳ định kỳ của đơn vị đang xem, hạn gần nhất; không có thì kỳ hạn gần nhất
  const kyCuaMinh = data.kyMo.filter((k) => (chuTri ? k.chu_tri_don_vi_id === chuTri : !k.chu_tri_don_vi_id));
  const chinh = kyCuaMinh.find((k) => k.loai !== 'dot_xuat') ?? kyCuaMinh[0] ?? data.kyMo[0];
  const tuNgay = chinh ? data.dong.find((x) => x.ky_id === chinh.ky_id)?.tu_ngay : null;
  const dongChinh = chinh ? data.dong.filter((x) => x.ky_id === chinh.ky_id) : [];
  const dungHan = dongChinh.filter((x) => daGui(x) && x.trang_thai !== 'can_bo_sung').length;
  const tong = (f: (k: KyMo) => number) => data.kyMo.reduce((n, k) => n + f(k), 0);
  const soChuaNop = tong((k) => k.chua_nop + k.can_bo_sung);
  const soChoNhan = tong((k) => k.da_nop - k.da_duyet);
  const bang = bangNop(data.dong);
  const quy = Math.floor(new Date().getMonth() / 3) + 1;
  const tl = tyLeQuy(data.dong, data.nam, quy);
  const tlTruoc = quy > 1 ? tyLeQuy(data.dong, data.nam, quy - 1) : null;
  const pct = (n: number) => `${(n / Math.max(1, chinh?.so_don_vi ?? 1)) * 100}%`;
  const timKiem = (e: React.FormEvent) => { e.preventDefault(); if (tim.trim()) nav(`/nhiem-vu?tab=tat_ca&q=${encodeURIComponent(tim.trim())}`); };

  return (
    <>
      <header className={cx('flex flex-wrap items-center gap-3', nhung && 'mt-3 border-t border-vien pt-5')}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.8125rem] text-mo">{nhung ? 'Lĩnh vực đơn vị làm đầu mối' : thuNgay()}</span>
          {nhung ? <h2 className="m-0 text-[1.25rem] font-extrabold tracking-tight">Theo dõi các đơn vị</h2>
            : <h1 className="m-0 text-[1.375rem] font-extrabold tracking-tight md:text-[1.625rem]">{chuTri ? 'Theo dõi đơn vị' : 'Tổng quan điều hành'}</h1>}
        </div>
        {!nhung && <form onSubmit={timKiem} className="relative hidden w-[300px] xl:block" role="search">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-[18px] w-[18px] text-mo" />
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm nhiệm vụ, đơn vị, văn bản…" aria-label="Tìm kiếm"
            className="h-11 w-full rounded-xl border border-vien bg-white pl-10 pr-3 text-sm outline-none focus:border-xanh" />
        </form>}
        {!nhung && <div className="hidden lg:block"><Chuong /></div>}
        {nhacDuoc && <Link to="/ky-bao-cao?tao=1" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-do px-3.5 text-sm font-semibold text-white hover:bg-do-2 sm:min-h-11 sm:gap-2 sm:px-4"><Plus className="h-4 w-4" /><span className="sm:hidden">Đột xuất</span><span className="hidden sm:inline">Tạo kỳ báo cáo đột xuất</span></Link>}
      </header>
      {tb && <div role="status" className="rounded-xl bg-xanh-nhat px-4 py-3 text-sm text-xanh">{tb}</div>}

      {data.canNop.length > 0 && (
        <Link to={data.canNop.length === 1 ? `/viec-can-nop/${data.canNop[0].nop_id}` : '/viec-can-nop'}
          className="the-noi flex items-center gap-3 rounded-2xl border border-[#FDE68A] bg-[#FEF9E7] px-4 py-2.5 text-den">
          <Send className="h-4 w-4 shrink-0 text-cam" />
          <span className="min-w-0 flex-1 truncate text-[0.8125rem]"><b>Tổ Tổng hợp cần nộp {data.canNop.length}</b> · {data.canNop[0].ten}</span>
          <ChipHan han={data.canNop[0].han_nop} />
        </Link>
      )}

      {/* 1. Kỳ chính + hạn sắp tới */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.43fr)_minmax(0,1fr)]">
        {chinh ? (
          <section className="noi-len-hero flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-[#7C1419] via-ink to-ink-3 p-4 text-white sm:gap-5 sm:rounded-3xl sm:p-7">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-md bg-ink-2 px-2.5 py-1 text-[11px] font-bold tracking-[1px] text-[#FCD34D]">{chinh.loai === 'dot_xuat' ? 'ĐỘT XUẤT' : `ĐỊNH KỲ · ${LOAI_KY[chinh.loai] ?? ''}`}</span>
                {tuNgay && <span className="hidden text-[0.8125rem] text-[#F0C9C4] sm:inline">Kỳ {ngay(tuNgay).replace(/\/\d{4}$/, '')} – {ngay(chinh.han_nop)}</span>}
                <span className="flex-1" />
                <span className="rounded-full bg-[#FDE68A] px-3 py-1 text-xs font-bold text-ink">Đang mở</span>
              </div>
              <Link to={`/ky-bao-cao/${chinh.ky_id}`} className="mt-0.5 text-[1.125rem] font-bold leading-snug text-white sm:mt-1 sm:text-[1.375rem]">{chinh.ten}</Link>
              <span className="truncate text-[0.8125rem] text-[#F0C9C4]"><span className="hidden sm:inline">Hạn đơn vị nộp về {chinh.chu_tri_don_vi_id ? tenNgan(chinh.don_vi_giao) : 'Cơ quan Thường trực'}: </span><span className="sm:hidden">Hạn nộp </span>{ngayGioDu(chinh.han_nop)}</span>
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <DongHo han={chinh.han_nop} />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <span className="flex items-baseline gap-2"><span className="mono text-[1.5rem] font-bold leading-none sm:text-[1.875rem]">{chinh.da_nop}/{chinh.so_don_vi}</span><span className="text-[0.8125rem] text-[#F0C9C4]">đơn vị đã nộp</span></span>
                <div className="flex h-2 overflow-hidden rounded-full bg-ink-2">
                  <span className="thanh-chay h-2 bg-[#FCD34D]" style={{ width: pct(dungHan) }} />
                  <span className="h-2 bg-[#F59E0B]" style={{ width: pct(chinh.can_bo_sung) }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 whitespace-nowrap text-[0.7812rem] leading-snug">
                  <span className="text-[#FCD34D]">{dungHan} đã nộp</span>
                  <span className="text-[#FBBF24]">{chinh.can_bo_sung} cần bổ sung</span>
                  <span className="text-[#F0C9C4]">{chinh.chua_nop} chưa nộp</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-white/15 pt-3 text-[0.8125rem] sm:pt-4">
              <span className="flex min-w-0 basis-full items-center gap-2 text-[#F6E3E0] sm:basis-auto sm:flex-1">
                <ArrowRight className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{chinh.han_gui_tinh ? `Mốc tiếp theo: tổng hợp, gửi Công an tỉnh trước ${ngay(chinh.han_gui_tinh)}` : `Mốc tiếp theo: tiếp nhận, duyệt ${chinh.da_nop - chinh.da_duyet} bài đã nộp`}</span>
              </span>
              {nhacDuoc && chinh.chua_nop + chinh.can_bo_sung > 0 && (
                <button type="button" onClick={() => nhac(chinh)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[0.8125rem] font-semibold text-den transition active:scale-[0.97]">
                  <Bell className="h-4 w-4" />Nhắc {chinh.chua_nop + chinh.can_bo_sung} đơn vị
                </button>
              )}
              <Link to={`/ky-bao-cao/${chinh.ky_id}`} className="ml-auto inline-flex items-center gap-1 font-semibold text-[#FCD34D]">Xem chi tiết<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        ) : <The className="p-5"><Rong>Không có kỳ báo cáo nào đang mở.</Rong></The>}

        <The className="flex flex-col">
          <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-6 sm:pb-2 sm:pt-5">
            <h2 className="m-0 flex-1 text-[1rem] font-bold">Hạn sắp tới</h2>
            <Link to={nhacDuoc ? '/ky-bao-cao?tab=lich' : '/ky-bao-cao'} className="text-[0.8125rem] font-semibold text-[#8E1B22]">Lịch báo cáo</Link>
          </div>
          {data.kyMo.length === 0 ? <div className="px-6 pb-5 text-sm text-mo">Không có kỳ đang mở.</div> : (
            <ul className="xep-hang flex flex-col px-3 pb-3">
              {data.kyMo.slice(0, 5).map((k) => {
                const d = new Date(k.han_nop);
                const dd = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' }).format(d);
                const mm = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: 'numeric' }).format(d);
                return (
                  <li key={k.ky_id}>
                    <Link to={`/ky-bao-cao/${k.ky_id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-den transition-colors hover:bg-nen-2">
                      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#FDECEC] leading-none text-xanh">
                        <span className="mono text-[1.0625rem] font-bold">{dd}</span><span className="mt-0.5 text-[10.5px] font-semibold">TH{mm}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[0.875rem] font-semibold">{k.loai === 'dot_xuat' ? `Đột xuất: ${k.ten}` : k.ten}</span>
                        <span className="truncate text-xs text-mo">{k.loai === 'dot_xuat' ? 'Đột xuất' : `Định kỳ ${(LOAI_KY[k.loai] ?? '').toLowerCase()}`}{!chuTri && k.chu_tri_don_vi_id ? ` · ${tenNgan(k.don_vi_giao)} giao` : ''} · {k.so_don_vi} đơn vị</span>
                      </span>
                      <ConLaiChu han={k.han_nop} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </The>
      </div>

      {/* 2. Số liệu */}
      <div className="xep-hang grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <OSo nhan="Nhiệm vụ đang thực hiện" so={<DemSo n={data.nvDang} />} sau={`/ ${data.nvTong} nhiệm vụ`} den="/nhiem-vu?tab=tat_ca"
          phu={`${data.nvXong} hoàn thành · ${data.nvChuaTk} chưa triển khai`} />
        <OSo nhan="Nhiệm vụ quá hạn" so={<DemSo n={data.nvQuaHan} />} mau={data.nvQuaHan ? 'text-nguy' : 'text-den'} sau={data.nvQuaHan ? 'cần đôn đốc' : 'không có'} den="/nhiem-vu?tab=qua_han"
          phu={data.nvQuaHan ? `Lâu nhất: quá ${data.nvQuaLauNhat} ngày` : 'Tất cả trong hạn'} />
        {hoSo?.vai_tro === 'lanh_dao' && data.choDuyet > 0
          ? <OSo nhan="Nhiệm vụ chờ duyệt giao" so={<DemSo n={data.choDuyet} />} mau="text-cam" sau="đề xuất" den="/nhiem-vu?tab=cho_duyet" phu="Trưởng ban duyệt để giao" />
          : <OSo nhan="Bài chờ tiếp nhận" so={<DemSo n={soChoNhan} />} mau={soChoNhan ? 'text-cam' : 'text-den'} sau="bài đã nộp" den="/ky-bao-cao"
            phu={`${data.kyMo.length} kỳ đang mở · ${soChuaNop} bài chưa nộp`} />}
        {data.vb
          ? <OSo nhan="Văn bản đến chưa nhận" so={<DemSo n={data.vb.chuaNhan.length} />} mau={data.vb.chuaNhan.length ? 'text-nguy' : 'text-den'} sau="văn bản" den="/van-ban"
            phu={data.vb.guiCho.length ? `${data.vb.guiCho.length} văn bản gửi đi chưa đủ nơi nhận` : 'Văn bản gửi đi đã nhận đủ'} />
          : <OSo nhan={`Tỷ lệ nộp đúng hạn (quý ${LA_MA[quy]})`} so={tl == null ? '—' : `${tl}%`} mau="text-xanh" den="/ky-bao-cao?tab=theo_doi"
            sau={tl != null && tlTruoc != null && tl !== tlTruoc ? `${tl > tlTruoc ? '↑' : '↓'} ${Math.abs(tl - tlTruoc)} điểm` : undefined}
            phu={tlTruoc != null ? `So với quý ${LA_MA[quy - 1]}/${data.nam}` : 'Các kỳ đã đến hạn trong quý'} />}
      </div>

      {/* Văn bản đến – đi */}
      {data.vb && <TheVanBan d={data.vb} />}

      {/* 3. Tình hình nộp của đơn vị + nhiệm vụ cần chú ý */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.43fr)_minmax(0,1fr)]">
        <The className="flex min-w-0 flex-col gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="flex min-w-[180px] flex-1 flex-col gap-1">
              <h2 className="m-0 text-[1rem] font-bold">Tình hình nộp báo cáo của đơn vị</h2>
              {data.vb && tl != null && <span className="text-[0.75rem] font-semibold text-xanh">Quý {LA_MA[quy]}/{data.nam}: {tl}% bài nộp đúng hạn{tlTruoc != null && tl !== tlTruoc ? ` (${tl > tlTruoc ? '↑' : '↓'} ${Math.abs(tl - tlTruoc)} điểm)` : ''}</span>}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-mo">
              {(Object.keys(MAU_O) as Exclude<O, null>[]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cx('h-2 w-2 rounded-sm', MAU_O[k][0])} />{MAU_O[k][1]}</span>)}
            </div>
          </div>
          {bang.hang.length === 0 ? <Rong>Chưa có kỳ báo cáo trong các tháng gần đây.</Rong> : (
            <div className="grid items-center gap-x-1.5 gap-y-1.5 sm:gap-x-2" style={{ gridTemplateColumns: `minmax(104px,2fr) repeat(${bang.cot.length}, minmax(28px,1fr))` }}>
              <span className="text-[11px] font-bold tracking-wide text-mo">ĐƠN VỊ</span>
              {bang.cot.map((c) => <span key={c.khoa} className="text-center text-[11px] font-bold text-mo">{c.nhan}</span>)}
              {bang.hang.map((h) => (
                <FragmentHang key={h.ten} ten={h.ten}>
                  {bang.cot.map((c) => {
                    const o = h.o[c.khoa];
                    return <span key={c.khoa} title={o ? MAU_O[o][1] : 'Không có kỳ'} className={cx('h-6 rounded-md sm:h-7', o ? MAU_O[o][0] : 'bg-nen')} />;
                  })}
                </FragmentHang>
              ))}
            </div>
          )}
          <Link to="/ky-bao-cao?tab=theo_doi" className="self-start text-[0.8125rem] font-semibold text-[#8E1B22]">Bảng đánh giá đầy đủ →</Link>
        </The>

        <The className="flex min-w-0 flex-col gap-1 p-4 sm:p-6">
          <div className="flex items-center gap-2 pb-2">
            <h2 className="m-0 flex-1 text-[1rem] font-bold">Nhiệm vụ cần chú ý</h2>
            <Link to="/nhiem-vu" className="text-[0.8125rem] font-semibold text-[#8E1B22]">Tất cả →</Link>
          </div>
          {data.nvChuY.length === 0 ? <div className="text-[0.8125rem] font-semibold text-[#166534]">Không có nhiệm vụ quá hạn hoặc sắp đến hạn.</div> : (
            <ul className="flex flex-col gap-4">
              {data.nvChuY.map((n) => (
                <li key={n.id}>
                  <Link to={`/nhiem-vu/${n.id}`} className="flex flex-col gap-1.5 text-den">
                    <span className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-[0.8438rem] font-semibold">{n.ten}</span>
                      <span className={cx('mono shrink-0 text-[0.75rem] font-bold', n.qua_han ? 'text-nguy' : 'text-xanh')}>{n.phan_tram}%</span>
                      <span className="shrink-0 text-[0.75rem] text-mo">{(n.ky_han ?? n.han) ? (n.qua_han ? `quá ${-(n.con_ngay ?? 0)} ngày` : `hạn ${ngay((n.ky_han ?? n.han)!).replace(/\/\d{4}$/, '')}`) : 'chưa chốt hạn'}</span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-[#EEEBE3]"><span className={cx('thanh-chay block h-2 rounded-full', n.qua_han ? 'bg-nguy' : 'bg-xanh')} style={{ width: `${Math.max(2, n.phan_tram)}%` }} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </The>
      </div>

      <HopNhac mo={!!nhacKy} dong={() => setNhacKy(null)} tenKy={nhacKy?.k.ten ?? ''} hanNop={nhacKy?.k.han_nop ?? ''} ds={nhacKy?.ds ?? []} xong={setTb} />
    </>
  );
}

// Thời gian còn lại dạng chữ đơn cách ("3 ngày 09 giờ")
function ConLaiChu({ han }: { han: string }) {
  const t = useBayGio();
  const m = mucGap(Date.parse(han) - t);
  return <span className={cx('mono shrink-0 whitespace-nowrap text-[0.75rem] font-bold', m === 'qua_han' || m === 'gap' ? 'text-nguy' : m === 'sap_han' ? 'text-cam' : 'text-xanh')}>{conLaiNgan(han, t)}</span>;
}

// Một hàng của bảng ô màu (tên đơn vị + các ô tháng) trong lưới CSS
function FragmentHang({ ten, children }: { ten: string; children: ReactNode }) {
  return (
    <>
      <span className="min-w-0 truncate text-[0.7812rem] font-medium sm:text-[0.8125rem]" title={ten}><span className="sm:hidden">{ten.replace('Phòng Văn hóa – Xã hội', 'Phòng VH-XH').replace('Phòng Kinh tế – Hạ tầng và Đô thị', 'Phòng KT-HT-ĐT').split(' – ')[0]}</span><span className="hidden sm:inline">{ten}</span></span>
      {children}
    </>
  );
}

// ---------- Chỉ tiêu số liệu (tóm tắt từng lĩnh vực) ----------

// ---------- Văn bản đến – đi (Thường trực) ----------
function TheVanBan({ d }: { d: NonNullable<Awaited<ReturnType<typeof taiVanBan>>> }) {
  const ds = [
    ...d.chuaNhan.slice(0, 3).map((x) => ({ k: 'n' + x.id, den: true, ten: x.trich_yeu, phu: `${x.so_ky_hieu ? x.so_ky_hieu + ' · ' : ''}${tenNgan(x.tu_don_vi)}`, luc: x.gui_luc, nhan: 'Chưa nhận' })),
    ...d.guiCho.slice(0, 3).map((x) => ({ k: 'g' + x.id, den: false, ten: x.trich_yeu, phu: x.so_ky_hieu ?? 'Văn bản gửi đi', luc: x.gui_luc, nhan: `${x.noi_nhan.filter((n) => n.nhan_luc).length}/${x.noi_nhan.length} đã nhận` })),
  ].slice(0, 5);
  return (
    <The className="flex min-w-0 flex-col gap-2 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="m-0 flex-1 text-[1rem] font-bold">Văn bản đến – đi</h2>
        <Link to="/van-ban" className="text-[0.8125rem] font-semibold text-[#8E1B22]">Mở →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/van-ban" className="flex flex-col rounded-xl bg-nen-2 px-3 py-2.5 text-den"><span className={cx('mono text-[1.375rem] font-bold leading-none', d.chuaNhan.length ? 'text-nguy' : '')}>{d.chuaNhan.length}</span><span className="mt-1 text-[11.5px] text-mo">văn bản đến chưa nhận</span></Link>
        <Link to="/van-ban?tab=gui" className="flex flex-col rounded-xl bg-nen-2 px-3 py-2.5 text-den"><span className={cx('mono text-[1.375rem] font-bold leading-none', d.guiCho.length ? 'text-cam' : '')}>{d.guiCho.length}</span><span className="mt-1 text-[11.5px] text-mo">gửi đi chưa đủ nơi nhận</span></Link>
      </div>
      {ds.length === 0 ? <span className="py-2 text-[0.8125rem] font-semibold text-[#166534]">Không có văn bản cần xử lý.</span> : (
        <ul className="m-0 flex list-none flex-col p-0">
          {ds.map((x) => (
            <li key={x.k}>
              <Link to="/van-ban" className="-mx-2 flex items-center gap-2.5 rounded-xl px-2 py-2 text-den hover:bg-nen-2">
                <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', x.den ? 'bg-nguy-nhat text-nguy' : 'bg-xanh-nhat text-xanh')}>{x.den ? <Inbox className="h-4 w-4" /> : <SendHorizontal className="h-4 w-4" />}</span>
                <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[0.8125rem] font-semibold">{x.ten}</span><span className="truncate text-[11.5px] text-mo">{x.phu} · {ngayGio(x.luc)}</span></span>
                <span className={cx('shrink-0 text-[11px] font-bold', x.den ? 'text-nguy' : 'text-cam-dam')}>{x.nhan}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </The>
  );
}
