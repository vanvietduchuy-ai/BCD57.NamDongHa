// Văn bản đến – đi: đơn vị gửi văn bản PDF cho Cơ quan Thường trực; Thường trực gửi cho một, nhiều hoặc tất cả đơn vị.
// Bên nhận xem PDF, bấm "Đã nhận"; bên gửi theo dõi ai đã xem, đã nhận, nhắc đơn vị chưa nhận. Tự vào sổ đến / sổ đi của Thường trực.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { xoaTepNhap } from '../lib/nhapTam';
import { ArrowRight, Bell, CalendarClock, CheckCheck, CheckCircle2, ClipboardList, Eye, Inbox, Paperclip, Search, Send, Users } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { laQuanTri, useAuth } from '../lib/auth';
import { ngay, ngayGio } from '../lib/dinhDang';
import { khongDau } from '../lib/nhiemVu';
import { LOAI_VB, type LoaiVb } from '../lib/vanBan';
import { META_TRONG, type MetaVb } from '../lib/docPdf';
import OVanBanPdf, { kiemTraMeta, taiPdfLenDrive, ThongTinVanBan, type VanBanDaNop } from '../components/VanBanPdf';
import ChonDonVi, { type DvChon } from '../components/ChonDonVi';
import { ChonTepKem, DemTepKem, DsTepKem, kiemTraTepKem, NHAN_TEP_KEM, taiTepKemCongVan, type TepKem } from '../components/TepKem';
import { Chip, ChipHan, DangTai, HopLoi, HopThoai, lopO, Nut, O, Rong, The, TieuDeTrang, cx } from '../components/ui';

type VbCot = {
  van_ban_id: string; so_ky_hieu: string | null; ngay_ban_hanh: string | null; trich_yeu: string; loai: LoaiVb; co_quan_ban_hanh: string;
  nguoi_ky: string | null; chuc_vu_nguoi_ky: string | null; drive_file_id: string | null; drive_url: string | null; ten_tep: string | null;
};
// Một lượt nhận (văn bản gửi đến đơn vị mình)
type Nhan = VbCot & { id: string; cong_van_id: string; don_vi_id: string; tu_don_vi_id: string; tu_don_vi: string; gui_luc: string;
  ghi_chu: string | null; han_phan_hoi: string | null; xem_luc: string | null; nhan_luc: string | null; tep: TepKem[] | null };
// Một văn bản đã gửi
type NoiNhan = { don_vi_id: string; ten: string; xem_luc: string | null; nhan_luc: string | null };
type Gui = VbCot & { id: string; tu_don_vi_id: string; gui_luc: string; ghi_chu: string | null; han_phan_hoi: string | null; noi_nhan: NoiNhan[]; tep: TepKem[] | null };
// Báo cáo đơn vị nộp theo kỳ, đã vào sổ đến của mình (nơi nhận bài)
type BaoCaoDen = VbCot & { id: string; so_thu_tu: number; nam: number; ngay: string; noi_gui: string | null; ghi_chu: string | null;
  nop_bao_cao_id: string; ky_id: string | null; ky_ten: string | null; tao_luc: string; tep: TepKem[] | null };
type MucDen = { kieu: 'cv'; x: Nhan; luc: string } | { kieu: 'bc'; x: BaoCaoDen; luc: string };

const vbTu = (x: VbCot): VanBanDaNop => ({ id: x.van_ban_id, so_van_ban: null, ky_hieu: null, so_ky_hieu: x.so_ky_hieu, ngay_ban_hanh: x.ngay_ban_hanh,
  trich_yeu: x.trich_yeu, loai: x.loai, nguoi_ky: x.nguoi_ky, chuc_vu_nguoi_ky: x.chuc_vu_nguoi_ky, co_quan_ban_hanh: x.co_quan_ban_hanh,
  drive_file_id: x.drive_file_id, drive_url: x.drive_url, ten_tep: x.ten_tep });
const hanPh = (d: string) => `${d}T17:00:00+07:00`;

export default function VanBanDenDi() {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  const [tab, setTab] = useState<'nhan' | 'gui'>(new URLSearchParams(window.location.search).get('tab') === 'gui' ? 'gui' : 'nhan');
  const [tim, setTim] = useState('');
  const [xemNhan, setXemNhan] = useState<Nhan | null>(null);
  const [xemGui, setXemGui] = useState<Gui | null>(null);
  const [xemBc, setXemBc] = useState<BaoCaoDen | null>(null);
  const [moGui, setMoGui] = useState(false);
  const [tb, setTb] = useState<string | null>(null);
  // Số dòng tải mỗi lần; bấm "Xem thêm" để tải tiếp, không để văn bản cũ biến mất
  const [gh, setGh] = useState(200);

  const { data, loi, dangTai, taiLai } = useDuLieu(async () => {
    const tt = (await supabase.rpc('don_vi_thuong_truc')).data as string | null;
    const cua = quanTri ? tt : hoSo?.don_vi_id ?? null;               // đơn vị của mình trong luồng gửi nhận
    const [a, b, c, d] = await Promise.all([
      supabase.from('v_cong_van_nhan').select('*').eq('don_vi_id', cua ?? '').order('gui_luc', { ascending: false }).limit(gh),
      supabase.from('v_cong_van').select('*').eq('tu_don_vi_id', cua ?? '').order('gui_luc', { ascending: false }).limit(gh),
      quanTri ? supabase.from('don_vi').select('id, ten, loai').eq('hoat_dong', true).order('thu_tu') : Promise.resolve({ data: [], error: null }),
      supabase.from('v_so_van_ban').select('*').eq('don_vi_id', cua ?? '').eq('loai_so', 'den').not('nop_bao_cao_id', 'is', null)
        .order('tao_luc', { ascending: false }).limit(gh),
    ]);
    return {
      tt, cua, nhan: (kq(a) ?? []) as Nhan[], gui: (kq(b) ?? []) as Gui[], bc: (kq(d) ?? []) as BaoCaoDen[],
      dv: ((kq(c) ?? []) as { id: string; ten: string; loai: string }[]).filter((d) => d.id !== tt && d.loai !== 'lanh_dao_bcd'),
    };
  }, [gh]);

  const t = khongDau(tim.trim());
  const hop = (x: VbCot & { ghi_chu: string | null }, them = '') => !t || khongDau(`${x.so_ky_hieu ?? ''} ${x.trich_yeu} ${x.co_quan_ban_hanh} ${x.ghi_chu ?? ''} ${them}`).includes(t);
  const dsNhan = useMemo((): MucDen[] => [
    ...(data?.nhan ?? []).filter((x) => hop(x, `${x.tu_don_vi} ${(x.tep ?? []).map((f) => f.ten).join(' ')}`)).map((x) => ({ kieu: 'cv' as const, x, luc: x.gui_luc })),
    ...(data?.bc ?? []).filter((x) => hop(x, `${x.noi_gui ?? ''} ${x.ky_ten ?? ''} bao cao ${(x.tep ?? []).map((f) => f.ten).join(' ')}`)).map((x) => ({ kieu: 'bc' as const, x, luc: x.tao_luc })),
  ].sort((p, q) => q.luc.localeCompare(p.luc)), [data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const dsGui = useMemo(() => (data?.gui ?? []).filter((x) => hop(x, x.noi_nhan.map((n) => n.ten).join(' '))), [data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const chuaNhan = (data?.nhan ?? []).filter((x) => !x.nhan_luc).length;
  const conNhan = (data?.nhan.length ?? 0) >= gh || (data?.bc.length ?? 0) >= gh;
  const conGui = (data?.gui.length ?? 0) >= gh;
  const xemThem = <div className="flex justify-center"><Nut onClick={() => setGh((x) => x + 200)} dangChay={dangTai}>Xem thêm văn bản cũ hơn</Nut></div>;

  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;

  const moNhan = async (x: Nhan) => {
    setXemNhan(x);
    if (!x.xem_luc) { await supabase.rpc('cong_van_xem', { p_nhan: x.id }); }
  };

  return (
    <>
      <TieuDeTrang tren={quanTri ? 'Cơ quan Thường trực BCĐ 57 ↔ các phòng, đơn vị' : `${hoSo?.don_vi?.ten ?? ''} ↔ Cơ quan Thường trực BCĐ 57`} ten="Văn bản đến – đi"
        phai={<Nut kieu="chinh" icon={<Send className="h-4 w-4" />} onClick={() => setMoGui(true)} ngan="Gửi">Gửi văn bản</Nut>} />
      {tb && <div role="status" className="rounded-xl bg-[#DCFCE7] px-4 py-3 text-sm text-[#166534]">{tb}</div>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div role="tablist" className="grid grid-cols-2 rounded-xl bg-[#E7E3D9] p-1 sm:w-[340px]">
          {([['nhan', 'Đã nhận', Inbox, chuaNhan], ['gui', 'Đã gửi', Send, 0]] as const).map(([k, ten, Icon, so]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cx('flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[0.875rem]', tab === k ? 'bg-white font-bold shadow-sm' : 'font-medium text-mo-2')}>
              <Icon className="h-4 w-4" />{ten}{so > 0 && <span className="mono rounded-full bg-nguy px-1.5 text-[11px] font-bold leading-5 text-white">{so}</span>}
            </button>
          ))}
        </div>
        <label className="relative sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-mo" />
          <input className={cx(lopO, 'w-full bg-white pl-10')} placeholder="Tìm số, trích yếu, đơn vị…" value={tim} onChange={(e) => setTim(e.target.value)} aria-label="Tìm văn bản" />
        </label>
      </div>

      {tab === 'nhan' && (dsNhan.length === 0 ? <Rong>Chưa có văn bản gửi đến.</Rong> : (
        <The className="overflow-hidden">
          <ul className="m-0 flex list-none flex-col p-0">
            {dsNhan.map((m) => {
              if (m.kieu === 'bc') { const x = m.x; return (
                <li key={`bc-${x.id}`} className="border-b border-[#F1EEE7] last:border-0">
                  <button type="button" onClick={() => setXemBc(x)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-nen-2 hover:bg-nen-2">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-transparent" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-xs text-mo">
                        <b className="min-w-0 truncate text-mo-2">{x.noi_gui ?? '—'}</b>
                        <span className="ml-auto shrink-0 mono">{ngayGio(x.tao_luc)}</span>
                      </span>
                      <span className="line-clamp-2 text-[0.9062rem] font-semibold leading-snug">{x.trich_yeu}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mo">
                        <span className="mono font-semibold text-mo-2">{x.so_ky_hieu ?? '—'}</span>
                        <Chip nen="bg-xanh-nhat" chu="text-xanh"><ClipboardList className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />Báo cáo kỳ{x.ky_ten ? `: ${x.ky_ten}` : ''}</Chip>
                        <span className="mono">Số đến {x.so_thu_tu}</span>
                        <DemTepKem n={x.tep?.length ?? 0} />
                      </span>
                    </span>
                  </button>
                </li>
              ); }
              const x = m.x;
              const moi = !x.xem_luc;
              return (
                <li key={`cv-${x.id}`} className="border-b border-[#F1EEE7] last:border-0">
                  <button type="button" onClick={() => void moNhan(x)} className={cx('flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-nen-2 hover:bg-nen-2', moi && 'bg-[#FFFBF3]')}>
                    <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', moi ? 'bg-nguy' : x.nhan_luc ? 'bg-transparent' : 'bg-[#F59E0B]')} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-xs text-mo">
                        <b className={cx('min-w-0 truncate', moi ? 'text-den' : 'text-mo-2')}>{x.tu_don_vi}</b>
                        <span className="ml-auto shrink-0 mono">{ngayGio(x.gui_luc)}</span>
                      </span>
                      <span className={cx('line-clamp-2 text-[0.9062rem] leading-snug', moi ? 'font-bold' : 'font-semibold')}>{x.trich_yeu}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mo">
                        <span className="mono font-semibold text-mo-2">{x.so_ky_hieu ?? '—'}</span>
                        <span>· {LOAI_VB[x.loai]}</span>
                        <DemTepKem n={x.tep?.length ?? 0} />
                        {x.han_phan_hoi && !x.nhan_luc && <ChipHan han={hanPh(x.han_phan_hoi)} />}
                        {x.nhan_luc ? <span className="flex items-center gap-1 font-semibold text-[#166534]"><CheckCheck className="h-3.5 w-3.5" />Đã nhận</span>
                          : moi ? <Chip nen="bg-nguy-nhat" chu="text-nguy">Mới</Chip> : <Chip nen="bg-cam-nhat" chu="text-cam-dam">Chưa bấm nhận</Chip>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </The>
      ))}
      {tab === 'nhan' && conNhan && xemThem}

      {tab === 'gui' && (dsGui.length === 0 ? <Rong>Chưa gửi văn bản nào.</Rong> : (
        <The className="overflow-hidden">
          <ul className="m-0 flex list-none flex-col p-0">
            {dsGui.map((x) => {
              const tong = x.noi_nhan.length, da = x.noi_nhan.filter((n) => n.nhan_luc).length, xem = x.noi_nhan.filter((n) => n.xem_luc && !n.nhan_luc).length;
              return (
                <li key={x.id} className="border-b border-[#F1EEE7] last:border-0">
                  <button type="button" onClick={() => setXemGui(x)} className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left active:bg-nen-2 hover:bg-nen-2">
                    <span className="flex items-center gap-2 text-xs text-mo">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 truncate font-semibold text-mo-2">{tong === 1 ? x.noi_nhan[0].ten : `${tong} đơn vị`}</span>
                      <span className="ml-auto shrink-0 mono">{ngayGio(x.gui_luc)}</span>
                    </span>
                    <span className="line-clamp-2 text-[0.9062rem] font-semibold leading-snug">{x.trich_yeu}</span>
                    <span className="flex items-center gap-2 text-xs text-mo"><span className="mono font-semibold text-mo-2">{x.so_ky_hieu ?? '—'}</span><span>· {LOAI_VB[x.loai]}</span><DemTepKem n={x.tep?.length ?? 0} />
                      {x.han_phan_hoi && <span className="ml-auto flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />phản hồi {ngay(x.han_phan_hoi)}</span>}</span>
                    <span className="flex items-center gap-2">
                      <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEEBE3]">
                        <span className="h-1.5 bg-[#16A34A]" style={{ width: `${(da / Math.max(1, tong)) * 100}%` }} />
                        <span className="h-1.5 bg-[#F59E0B]" style={{ width: `${(xem / Math.max(1, tong)) * 100}%` }} />
                      </span>
                      <span className={cx('mono shrink-0 text-xs font-bold', da === tong ? 'text-[#166534]' : 'text-mo-2')}>{da === tong ? 'Đã nhận đủ' : `${da}/${tong} đã nhận`}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </The>
      ))}
      {tab === 'gui' && conGui && xemThem}

      <XemNhan x={xemNhan} dong={() => { setXemNhan(null); void taiLai(); }} xong={() => { setXemNhan(null); setTb('Đã xác nhận nhận văn bản.'); void taiLai(); }} />
      <XemBaoCao x={xemBc} dong={() => setXemBc(null)} />
      <XemGui x={xemGui} dong={() => setXemGui(null)} baoTin={(m) => { setXemGui(null); setTb(m); void taiLai(); }} />
      {data && <GuiVanBan mo={moGui} dong={() => setMoGui(false)} quanTri={quanTri} dsDv={data.dv} coQuan={hoSo?.don_vi?.ten ?? ''}
        xong={(m) => { setMoGui(false); setTab('gui'); setTb(m); void taiLai(); }} />}
    </>
  );
}

// Bên nhận: xem văn bản, bấm Đã nhận
function XemNhan({ x, dong, xong }: { x: Nhan | null; dong: () => void; xong: () => void }) {
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  if (!x) return null;
  const nhan = async () => {
    setDang(true); setLoi(null);
    const { error } = await supabase.rpc('cong_van_nhan', { p_nhan: x.id });
    setDang(false);
    if (error) setLoi(loiDe(error)); else xong();
  };
  return (
    <HopThoai mo dong={dong} tieuDe={`Văn bản từ ${x.tu_don_vi}`} rong="max-w-[900px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-mo">
          <span>Gửi lúc <b className="mono text-den">{ngayGio(x.gui_luc)}</b></span>
          {x.han_phan_hoi && <span className="flex items-center gap-1.5">· Phản hồi trước <b className="text-den">{ngay(x.han_phan_hoi)}</b>{!x.nhan_luc && <ChipHan han={hanPh(x.han_phan_hoi)} />}</span>}
        </div>
        {x.ghi_chu && <div className="whitespace-pre-line rounded-xl bg-nen-3 px-4 py-3 text-sm"><b>Nội dung kèm theo:</b> {x.ghi_chu}</div>}
        <ThongTinVanBan vb={vbTu(x)} />
        <DsTepKem tep={x.tep} />
        {loi && <HopLoi loi={loi} />}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {x.nhan_luc && <span className="mr-auto flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[#166534]"><CheckCircle2 className="h-4 w-4" />Đã nhận lúc {ngayGio(x.nhan_luc)}</span>}
          <Nut onClick={dong}>Đóng</Nut>
          {!x.nhan_luc && <Nut kieu="chinh" icon={<CheckCheck className="h-4 w-4" />} dangChay={dang} onClick={() => void nhan()}>Đã nhận văn bản</Nut>}
        </div>
      </div>
    </HopThoai>
  );
}

// Báo cáo đơn vị nộp theo kỳ (đã vào sổ đến): văn bản + tài liệu kèm theo
function XemBaoCao({ x, dong }: { x: BaoCaoDen | null; dong: () => void }) {
  if (!x) return null;
  return (
    <HopThoai mo dong={dong} tieuDe={`Báo cáo của ${x.noi_gui ?? 'đơn vị'}`} rong="max-w-[900px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-mo">
          <Chip nen="bg-xanh-nhat" chu="text-xanh">Báo cáo kỳ{x.ky_ten ? `: ${x.ky_ten}` : ''}</Chip>
          <span>Số đến <b className="mono text-den">{x.so_thu_tu}/{x.nam}</b> · ngày {ngay(x.ngay)}</span>
        </div>
        {x.ghi_chu && <div className="whitespace-pre-line rounded-xl bg-nen-3 px-4 py-3 text-sm"><b>Ghi chú sổ:</b> {x.ghi_chu}</div>}
        <ThongTinVanBan vb={vbTu(x)} />
        <DsTepKem tep={x.tep} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Nut onClick={dong}>Đóng</Nut>
          {x.ky_id && <Link to={`/ky-bao-cao/${x.ky_id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-ink px-4 text-[0.875rem] font-semibold text-white">Mở kỳ báo cáo<ArrowRight className="h-4 w-4" /></Link>}
        </div>
      </div>
    </HopThoai>
  );
}

// Bên gửi: xem tình hình nhận của từng đơn vị, nhắc đơn vị chưa nhận
function XemGui({ x, dong, baoTin }: { x: Gui | null; dong: () => void; baoTin: (m: string) => void }) {
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangTep, setDangTep] = useState(false);
  if (!x) return null;
  const chua = x.noi_nhan.filter((n) => !n.nhan_luc);
  const themTep = async (fs: FileList | null) => {
    const ds = Array.from(fs ?? []); if (!ds.length) return;
    const sai = ds.map(kiemTraTepKem).find(Boolean); if (sai) { setLoi(sai); return; }
    setDangTep(true); setLoi(null);
    const hong = await taiTepKemCongVan(x.id, ds);
    setDangTep(false);
    if (hong.length) setLoi(`Chưa tải được: ${hong.join(', ')}`); else baoTin(`Đã đính kèm ${ds.length} tệp; nơi nhận xem được ngay.`);
  };
  const nhac = async () => {
    setDang(true); setLoi(null);
    const { error } = await supabase.rpc('cong_van_nhac', { p_cong_van: x.id });
    setDang(false);
    if (error) setLoi(loiDe(error)); else baoTin(`Đã nhắc ${chua.length} đơn vị chưa nhận văn bản.`);
  };
  return (
    <HopThoai mo dong={dong} tieuDe="Văn bản đã gửi" rong="max-w-[900px]">
      <div className="flex flex-col gap-4">
        {x.ghi_chu && <div className="whitespace-pre-line rounded-xl bg-nen-3 px-4 py-3 text-sm"><b>Nội dung kèm theo:</b> {x.ghi_chu}</div>}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-vien">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-vien bg-nen-2 px-4 py-2.5 text-[0.8125rem]">
            <b className="flex-1 whitespace-nowrap">Nơi nhận ({x.noi_nhan.length})</b>
            <span className="text-xs text-mo">Gửi {ngayGio(x.gui_luc)}{x.han_phan_hoi ? ` · phản hồi trước ${ngay(x.han_phan_hoi)}` : ''}</span>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {x.noi_nhan.map((n) => (
              <li key={n.don_vi_id} className="flex items-center gap-3 border-b border-[#F1EEE7] px-4 py-2.5 text-[0.8438rem] last:border-0">
                <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', n.nhan_luc ? 'bg-[#16A34A]' : n.xem_luc ? 'bg-[#F59E0B]' : 'bg-[#CFC9BC]')} />
                <span className="min-w-0 flex-1 font-semibold">{n.ten}</span>
                {n.nhan_luc ? <span className="flex items-center gap-1 text-xs font-semibold text-[#166534]"><CheckCheck className="h-3.5 w-3.5" />Đã nhận {ngayGio(n.nhan_luc)}</span>
                  : n.xem_luc ? <span className="flex items-center gap-1 text-xs font-semibold text-cam-dam"><Eye className="h-3.5 w-3.5" />Đã xem {ngayGio(n.xem_luc)}</span>
                  : <span className="text-xs text-mo">Chưa mở</span>}
              </li>
            ))}
          </ul>
        </section>
        <ThongTinVanBan vb={vbTu(x)} />
        <DsTepKem tep={x.tep} />
        <label className={cx('flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#9AA1AE] bg-nen-2 px-3 text-[0.8125rem] text-mo-2', dangTep && 'pointer-events-none opacity-60')}>
          <Paperclip className="h-4 w-4 text-xanh" /><b className="text-xanh">{dangTep ? 'Đang tải lên…' : 'Đính kèm thêm tệp'}</b><span className="max-sm:hidden">· Word, Excel, ảnh, ZIP…</span>
          <input type="file" multiple className="sr-only" accept={NHAN_TEP_KEM} disabled={dangTep} onChange={(e) => { void themTep(e.target.files); e.target.value = ''; }} />
        </label>
        {loi && <HopLoi loi={loi} />}
        <div className="flex flex-wrap justify-end gap-2">
          <Nut onClick={dong}>Đóng</Nut>
          {chua.length > 0 && <Nut kieu="chinh" icon={<Bell className="h-4 w-4" />} dangChay={dang} onClick={() => void nhac()}>Nhắc {chua.length} đơn vị chưa nhận</Nut>}
        </div>
      </div>
    </HopThoai>
  );
}

// Gửi văn bản: PDF (tự đọc số, ngày, trích yếu, người ký) + nơi nhận + nội dung kèm theo + hạn phản hồi
function GuiVanBan({ mo, dong, quanTri, dsDv, coQuan, xong }: { mo: boolean; dong: () => void; quanTri: boolean; dsDv: DvChon[]; coQuan: string; xong: (m: string) => void }) {
  const macDinh = (): MetaVb => ({ ...META_TRONG, loai: 'cong_van', co_quan_ban_hanh: coQuan });
  const [meta, setMeta] = useState<MetaVb>(macDinh);
  const [tep, setTep] = useState<File | null>(null);
  const [kem, setKem] = useState<File[]>([]);
  const [chon, setChon] = useState<string[]>([]);
  const [ghiChu, setGhiChu] = useState('');
  const [han, setHan] = useState('');
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [moCu, setMoCu] = useState(false);
  if (mo !== moCu) { setMoCu(mo); if (mo) { setMeta(macDinh()); setTep(null); setKem([]); setChon([]); setGhiChu(''); setHan(''); setLoi(null); } }
  if (!mo) return null;
  const gui = async () => {
    setLoi(null);
    if (!tep) { setLoi('Chọn tệp PDF văn bản'); return; }
    const l = kiemTraMeta(meta, false); if (l) { setLoi(l); return; }
    if (quanTri && !chon.length) { setLoi('Chọn đơn vị nhận'); return; }
    setDang(true);
    try {
      const len = await taiPdfLenDrive(tep, 'cong_van');
      const { data: cvId, error } = await supabase.rpc('gui_cong_van', {
        p: { ...meta, drive_file_id: len.drive_file_id, drive_url: len.url ?? '', ten_tep: tep.name, ghi_chu: ghiChu.trim(), han_phan_hoi: han || null },
        p_noi_nhan: quanTri ? chon : null,
      });
      if (error) throw error;
      void xoaTepNhap('cong_van:gui');
      const hong = kem.length && cvId ? await taiTepKemCongVan(cvId as string, kem) : [];
      const coKem = kem.length ? ` kèm ${kem.length - hong.length} tệp` : '';
      xong((quanTri ? `Đã gửi văn bản${coKem} cho ${chon.length} đơn vị, vào sổ đi.` : `Đã gửi văn bản${coKem} cho Cơ quan Thường trực BCĐ.`)
        + (hong.length ? ` Chưa tải được: ${hong.join(', ')} — mở văn bản đã gửi để thử lại.` : ''));
    } catch (e) { setLoi(loiDe(e)); } finally { setDang(false); }
  };
  return (
    <HopThoai mo dong={dong} tieuDe="Gửi văn bản" rong="max-w-4xl">
      <div className="flex flex-col gap-4">
        <OVanBanPdf meta={meta} doiMeta={setMeta} tep={tep} chonTep={(f, m) => { setTep(f); setMeta({ ...m, loai: m.loai || 'cong_van', co_quan_ban_hanh: m.co_quan_ban_hanh || coQuan }); }} hienCoQuan tieuDe="Chọn văn bản PDF đã ký, đóng dấu" khoaNhap="cong_van:gui" />
        {quanTri ? (
          <ChonDonVi ds={dsDv} chon={chon} doi={setChon} />
        ) : (
          <div className="flex items-start gap-2 rounded-xl bg-nen-2 px-3 py-2.5 text-[0.875rem]"><Send className="mt-0.5 h-4 w-4 shrink-0 text-mo" /><span>Gửi đến: <b>Thường trực Ban Chỉ đạo 57</b></span></div>
        )}
        <ChonTepKem ds={kem} doi={setKem} baoLoi={setLoi} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <O nhan="Nội dung kèm theo (không bắt buộc)"><textarea className={cx(lopO, 'min-h-20 py-2')} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="VD: Đề nghị các đơn vị triển khai, báo cáo kết quả…" /></O>
          <O nhan="Hạn phản hồi (nếu có)"><input type="date" className={lopO} value={han} onChange={(e) => setHan(e.target.value)} /></O>
        </div>
        <p className="m-0 rounded-xl bg-nen-3 px-3 py-2 text-[0.8125rem] text-mo-2">
          {quanTri ? <>Văn bản tự vào <b>sổ đi</b> của Thường trực. Đơn vị nhận được thông báo trên web và điện thoại.</> : <>Văn bản tự vào <b>sổ đến</b> của Cơ quan Thường trực. Không gửi văn bản mật.</>}
        </p>
        {loi && <HopLoi loi={loi} />}
        <div className="flex justify-end gap-2">
          <Nut onClick={dong}>Huỷ</Nut>
          <Nut kieu="chinh" icon={<Send className="h-4 w-4" />} dangChay={dang} disabled={!tep} onClick={() => void gui()}>{quanTri ? `Gửi ${chon.length || ''} đơn vị` : 'Gửi Thường trực'}</Nut>
        </div>
      </div>
    </HopThoai>
  );
}
