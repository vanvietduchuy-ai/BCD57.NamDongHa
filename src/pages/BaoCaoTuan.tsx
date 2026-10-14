// Báo cáo tuần: đơn vị chủ trì nhập kết quả tất cả nhiệm vụ đang thực hiện trên một trang, gửi một lần;
// Cơ quan Thường trực, Lãnh đạo BCĐ xem tình hình gửi theo tuần, nhắc đơn vị chưa gửi, nhập thay khi cần.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, Table2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, PenLine, Send, Settings2 } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useBayGio, useDuLieu } from '../lib/useDuLieu';
import { laQuanTri, useAuth } from '../lib/auth';
import { ngayGioDu } from '../lib/dinhDang';
import { TT_NV, type DinhKy, type TrangThaiNv } from '../lib/nhiemVu';
import { docSo, ghepCauHinh, goiYDanhGia, KHOA_CAU_HINH, soVN, tinhDanhGia, type DanhGia, type DongA4, type KieuDG } from '../lib/danhMucA4';
import {
  BCT_MAC_DINH, boTienTo, KHOA_BCT, laBaoCaoTuan, NHAN_TT_TUAN, TEN_THU, tinhTrangTuan, tuanCua, type CapNhatTuan, type CauHinhBCT, type Tuan,
} from '../lib/baoCaoTuan';
import { LienLacDonVi } from '../components/LienLacTrucTiep';
import { DangTai, HopLoi, HopThoai, lopO, Nut, O, Rong, The, TieuDeTrang, cx } from '../components/ui';

type NvT = { id: string; ma: string | null; ten: string; san_pham: string | null; chu_tri_don_vi_id: string | null; chu_tri_ten: string | null; trang_thai: TrangThaiNv;
  phan_tram: number; trang_thai_giao: string; han: string | null; dinh_ky: DinhKy | null; tao_luc: string };
type DonVi = { id: string; ten: string; loai: string | null; thu_tu: number | null };
type Viec = { n: NvT; d: DongA4; dg: DanhGia; tuan: CapNhatTuan[]; truoc: CapNhatTuan | null };

export default function BaoCaoTuan() {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  const donVi = hoSo?.vai_tro === 'don_vi';
  const [lui, setLui] = useState(0);
  const [nhapThay, setNhapThay] = useState<string | null>(null);
  const [moCaiDat, setMoCaiDat] = useState(false);
  const [thongBao, setThongBao] = useState<string | null>(null);
  useBayGio(60000);

  const { data, loi, dangTai, taiLai } = useDuLieu(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from('cau_hinh').select('khoa, gia_tri').in('khoa', [KHOA_BCT, KHOA_CAU_HINH]),
      supabase.from('v_nhiem_vu').select('id, ma, ten, san_pham, chu_tri_don_vi_id, chu_tri_ten, trang_thai, phan_tram, trang_thai_giao, han, dinh_ky, tao_luc').eq('trang_thai_giao', 'da_duyet'),
      supabase.from('don_vi').select('id, ten, loai, thu_tu').eq('hoat_dong', true).order('thu_tu'),
      supabase.from('v_nhiem_vu_cap_nhat').select('nhiem_vu_id, noi_dung, luc, phan_tram, boi_ten').order('luc', { ascending: false }).limit(4000),
    ]);
    const ch = (kq(a) ?? []) as { khoa: string; gia_tri: unknown }[];
    return {
      bct: { ...BCT_MAC_DINH, ...(ch.find((x) => x.khoa === KHOA_BCT)?.gia_tri as Partial<CauHinhBCT> | undefined) },
      a4: ghepCauHinh(ch.find((x) => x.khoa === KHOA_CAU_HINH)?.gia_tri as never),
      nv: (kq(b) ?? []) as NvT[], dv: (kq(c) ?? []) as DonVi[], cn: (kq(d) ?? []) as CapNhatTuan[],
    };
  }, []);

  const tuan = useMemo(() => tuanCua(new Date(), data?.bct ?? BCT_MAC_DINH, lui), [data, lui]);
  // Nhiệm vụ phải báo cáo tuần: đã duyệt giao, chưa xong / tạm dừng (hoặc vừa hoàn thành trong tuần), không phải nhiệm vụ lớn có nhiệm vụ con
  const viec = useMemo(() => {
    if (!data) return [] as Viec[];
    const cha = new Set(Object.values(data.a4.dong).map((x) => x.cha).filter(Boolean) as string[]);
    const tu = tuan.batDau.toISOString(), den = tuan.ketThuc.toISOString();
    return data.nv.filter((n) => !cha.has(n.id) && n.chu_tri_don_vi_id).map((n) => {
      const ds = data.cn.filter((c) => c.nhiem_vu_id === n.id);
      const trongTuan = ds.filter((c) => c.luc >= tu && c.luc <= den && laBaoCaoTuan(c, tuan));
      return { n, d: data.a4.dong[n.id] ?? {}, dg: data.a4.dong[n.id]?.danh_gia ?? goiYDanhGia(n), tuan: trongTuan, truoc: ds.find((c) => c.luc < tu) ?? null };
    }).filter((x) => x.tuan.length > 0 || !['hoan_thanh', 'tam_dung'].includes(x.n.trang_thai))
      .sort((a, b) => (a.n.ma ?? '').localeCompare(b.n.ma ?? '', 'vi', { numeric: true }) || a.n.tao_luc.localeCompare(b.n.tao_luc));
  }, [data, tuan]);

  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;
  if (!data) return null;

  const dvCuaToi = hoSo?.don_vi_id ?? null;
  const dvNhap = nhapThay ?? (donVi ? dvCuaToi : null);
  const tenDv = (id: string | null) => data.dv.find((d) => d.id === id)?.ten ?? '';
  const viecCuaToi = dvCuaToi ? viec.filter((x) => x.n.chu_tri_don_vi_id === dvCuaToi) : [];

  return (
    <>
      <TieuDeTrang tren={donVi ? hoSo?.don_vi?.ten : 'Đơn vị chủ trì báo cáo kết quả nhiệm vụ hằng tuần'} ten="Báo cáo tuần"
        phai={quanTri && <Nut icon={<Settings2 className="h-4 w-4" />} onClick={() => setMoCaiDat(true)} ngan="Hạn">Hạn nộp: {TEN_THU[data.bct.thu]}, {data.bct.gio}h</Nut>} />
      {thongBao && <div role="status" className="rounded-xl bg-[#DCFCE7] px-4 py-2.5 text-sm text-[#166534]">{thongBao}</div>}

      <Link to="/nhiem-vu?tab=chua_bct" className="flex items-center gap-2 self-start rounded-xl border border-vien bg-white px-3 py-2 text-[0.8125rem] font-semibold text-[#8E1B22] hover:bg-nen-2">
        <Table2 className="h-4 w-4" />Nhập báo cáo tuần ngay trên bảng A4 nhiệm vụ</Link>

      {/* Chọn tuần */}
      <div className="flex items-center gap-2 rounded-2xl border border-vien bg-white px-2 py-1.5">
        <button onClick={() => setLui(lui + 1)} aria-label="Tuần trước" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen"><ChevronLeft className="h-5 w-5" /></button>
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <b className="text-[0.9375rem]">{tuan.ten}</b>
          <span className="flex items-center gap-1 text-xs text-mo"><CalendarClock className="h-3.5 w-3.5" />Hạn {TEN_THU[data.bct.thu]} {ngayGioDu(tuan.han.toISOString())}{lui === 0 && Date.now() <= tuan.han.getTime() ? ` · còn ${conLaiChu(tuan.han)}` : ''}</span>
        </div>
        <button disabled={lui === 0} onClick={() => setLui(lui - 1)} aria-label="Tuần sau" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {dvNhap
        ? <BieuMau key={`${dvNhap}-${tuan.so}-${tuan.nam}`} tuan={tuan} viec={viec.filter((x) => x.n.chu_tri_don_vi_id === dvNhap)} tenDv={tenDv(dvNhap)} thay={!!nhapThay} quanTri={quanTri}
            dong={nhapThay ? () => setNhapThay(null) : undefined} xong={(m) => { setThongBao(m); setNhapThay(null); void taiLai(); }} />
        : <>
            <BangTuan tuan={tuan} viec={viec} dv={data.dv} quanTri={quanTri} nhapThay={setNhapThay} daNhac={setThongBao} />
            {quanTri && viecCuaToi.length > 0 && (
              <button onClick={() => setNhapThay(dvCuaToi)} className="flex items-center gap-2 self-start rounded-xl border border-vien bg-white px-3 py-2 text-[0.8125rem] font-semibold text-[#8E1B22] hover:bg-nen-2">
                <PenLine className="h-4 w-4" />Báo cáo nhiệm vụ của {tenDv(dvCuaToi)} ({viecCuaToi.length})</button>
            )}
          </>}
      {moCaiDat && <HopCaiDat ch={data.bct} dong={() => setMoCaiDat(false)} xong={() => { setMoCaiDat(false); void taiLai(); }} />}
    </>
  );
}

const conLaiChu = (han: Date) => {
  const p = Math.max(0, Math.round((han.getTime() - Date.now()) / 60000));
  const ngay = Math.floor(p / 1440), gio = Math.floor((p % 1440) / 60);
  return ngay ? `${ngay} ngày ${gio} giờ` : gio ? `${gio} giờ ${p % 60} phút` : `${p} phút`;
};

// ---------- Biểu mẫu báo cáo tuần của một đơn vị: mỗi nhiệm vụ một khối, ô nhập đổi theo cách đánh giá
type Nhap = { tu: string; mau: string; pt: number | null; ghi: string; xong: boolean };
function BieuMau({ tuan, viec, tenDv, thay, quanTri, dong, xong }: { tuan: Tuan; viec: Viec[]; tenDv: string; thay: boolean; quanTri: boolean; dong?: () => void; xong: (m: string) => void }) {
  const khoaNhap = `bcd57-bct-${tuan.nam}-${tuan.so}-${tenDv}`;
  const [g, setGS] = useState<Record<string, Nhap>>(() => { try { return JSON.parse(localStorage.getItem(khoaNhap) ?? '{}'); } catch { return {}; } });
  const setG = (id: string, p: Partial<Nhap>) => setGS((x) => {
    const v = { ...x, [id]: { ...(x[id] ?? moi(viec.find((y) => y.n.id === id)!)), ...p } };
    try { localStorage.setItem(khoaNhap, JSON.stringify(v)); } catch { /* bỏ qua */ }
    return v;
  });
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const daBao = viec.filter((x) => x.tuan.length).length;
  const conLai = viec.filter((x) => !x.tuan.length);

  const ketQua = (x: Viec, v: Nhap) => {
    const coSo = (x.dg.kieu === 'ty_le' || x.dg.kieu === 'so_luong') && v.tu.trim() !== '' && v.mau.trim() !== '';
    const tu = docSo(v.tu), mau = docSo(v.mau);
    return coSo && Number.isFinite(tu) && Number.isFinite(mau) && mau > 0 && tu <= mau ? { tu, mau, ...tinhDanhGia(x.dg, tu, mau) } : null;
  };
  const daNhap = (x: Viec) => { const v = g[x.n.id]; return !!v && (!!ketQua(x, v) || v.pt != null || v.ghi.trim() !== '' || v.xong); };

  const gui = async () => {
    const ds = viec.filter(daNhap);
    if (!ds.length) { setLoi('Chưa nhập kết quả nhiệm vụ nào.'); return; }
    for (const x of ds) {
      if ((x.dg.kieu === 'ty_le' || x.dg.kieu === 'so_luong') && !ketQua(x, g[x.n.id])) { setLoi(`Nhiệm vụ "${x.n.ten.slice(0, 60)}…" có số liệu: nhập số đạt và tổng số để làm minh chứng.`); return; }
    }
    setDang(true); setLoi(null);
    const dong_ = ds.map((x) => {
      const v = g[x.n.id]; const k = ketQua(x, v);
      const so = k ? (x.dg.kieu === 'ty_le'
        ? `Kết quả: ${soVN(k.tu)}/${soVN(k.mau)} (${soVN(k.tyLe, 2)}%)${x.dg.chi_tieu ? ` — ${k.dat ? 'đạt' : 'chưa đạt'} chỉ tiêu ${soVN(x.dg.chi_tieu, 2)}%` : ''}.`
        : `Kết quả: hoàn thành ${soVN(k.tu)}/${soVN(k.mau)}.`) : '';
      const pt = v.xong ? 100 : k ? k.phanTram : v.pt;
      const tt: TrangThaiNv | null = v.xong ? 'hoan_thanh' : x.n.trang_thai === 'chua_trien_khai' ? 'dang_thuc_hien' : null;
      return {
        nhiem_vu_id: x.n.id, noi_dung: [tuan.tienTo, so, v.ghi.trim()].filter(Boolean).join(' '),
        phan_tram: pt != null && pt !== x.n.phan_tram ? pt : null, trang_thai_moi: tt && tt !== x.n.trang_thai ? tt : null,
      };
    });
    const { error } = await supabase.from('nhiem_vu_cap_nhat').insert(dong_);
    setDang(false);
    if (error) { setLoi(loiDe(error)); return; }
    try { localStorage.removeItem(khoaNhap); } catch { /* bỏ qua */ }
    xong(`Đã gửi báo cáo ${tuan.ten.split(' (')[0].toLowerCase()} của ${tenDv}: ${ds.length} nhiệm vụ.`);
  };

  return (
    <div className="flex flex-col gap-3">
      <The className="flex flex-wrap items-center gap-3 p-3.5 sm:p-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-mo">{thay ? 'Cơ quan Thường trực nhập thay cho' : 'Đơn vị báo cáo'}</span>
          <b className="text-[0.9375rem]">{tenDv}</b>
        </div>
        <div className="flex items-baseline gap-1.5"><b className={cx('mono text-[1.375rem]', daBao >= viec.length ? 'text-[#166534]' : 'text-den')}>{daBao}/{viec.length}</b><span className="text-xs text-mo">nhiệm vụ đã báo cáo tuần này</span></div>
        {dong && <Nut onClick={dong}>Quay lại</Nut>}
      </The>

      {viec.length === 0 && <Rong>Đơn vị không có nhiệm vụ đang thực hiện cần báo cáo tuần này.</Rong>}
      {[...conLai, ...viec.filter((x) => x.tuan.length)].map((x) => (
        <DongViec key={x.n.id} x={x} v={g[x.n.id] ?? moi(x)} dat={(p) => setG(x.n.id, p)} kq={ketQua(x, g[x.n.id] ?? moi(x))} quanTri={quanTri} />
      ))}

      {conLai.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-vien bg-white/95 px-4 py-3 shadow-[0_-6px_20px_-10px_rgba(40,10,15,.25)] backdrop-blur max-lg:bottom-1">
          <span className="flex-1 text-[0.8125rem] text-mo-2">Đã nhập <b className="mono text-den">{viec.filter(daNhap).length}</b> / {conLai.length} nhiệm vụ chưa báo cáo · bản nháp tự lưu trên máy</span>
          {loi && <span className="w-full text-[0.8125rem] text-nguy">{loi}</span>}
          <Nut kieu="chinh" icon={<Send className="h-4 w-4" />} dangChay={dang} onClick={() => void gui()}>Gửi báo cáo tuần</Nut>
        </div>
      )}
    </div>
  );
}
const moi = (x: Viec): Nhap => ({ tu: '', mau: x.dg.tong ? String(x.dg.tong) : '', pt: null, ghi: '', xong: false });

function DongViec({ x, v, dat, kq: k, quanTri }: { x: Viec; v: Nhap; dat: (p: Partial<Nhap>) => void; kq: { tyLe: number; phanTram: number; dat: boolean } | null; quanTri: boolean }) {
  const [moLai, setMoLai] = useState(false);
  const daGui = x.tuan.length > 0;
  const kieu: KieuDG = x.dg.kieu === 'ky' ? 'tien_do' : x.dg.kieu;
  return (
    <The className={cx('flex flex-col gap-2.5 p-3.5 sm:p-4', daGui && !moLai && 'bg-nen-2')}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.9375rem] font-semibold leading-snug">{x.n.ma && <span className="mono mr-1.5 text-xs text-mo">{x.n.ma}</span>}{x.n.ten}</span>
          {x.n.san_pham && <span className="text-xs text-mo">Chỉ tiêu: {x.n.san_pham}</span>}
          <span className="text-xs text-mo">{TT_NV[x.n.trang_thai].nhan} · {x.n.phan_tram}%{x.truoc ? ` · lần trước: ${boTienTo(x.truoc.noi_dung).slice(0, 90)}` : ''}</span>
        </div>
        {daGui && <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[#DCFCE7] px-2 py-1 text-xs font-semibold text-[#166534]"><CheckCircle2 className="h-3.5 w-3.5" />Đã báo cáo</span>}
      </div>
      {daGui && !moLai ? (
        <div className="flex flex-col gap-1">
          {x.tuan.map((c, i) => <p key={i} className="m-0 border-l-2 border-[#16A34A] pl-2.5 text-[0.8125rem]">{boTienTo(c.noi_dung)} <span className="text-[11px] text-mo">· {c.boi_ten ?? ''} {ngayGioDu(c.luc)}</span></p>)}
          <button onClick={() => setMoLai(true)} className="self-start text-xs font-semibold text-[#8E1B22]">Bổ sung báo cáo</button>
        </div>
      ) : (
        <>
          {kieu === 'ty_le' && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:max-w-md">
              <O nhan="Đạt"><input inputMode="decimal" className={cx(lopO, 'mono')} value={v.tu} onChange={(e) => dat({ tu: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="số đạt" /></O>
              <span className="pb-3 text-mo">/</span>
              <O nhan="Tổng số"><input inputMode="decimal" className={cx(lopO, 'mono')} value={v.mau} onChange={(e) => dat({ mau: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="tổng số" /></O>
            </div>
          )}
          {kieu === 'so_luong' && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:max-w-md">
              <O nhan="Đã hoàn thành"><input inputMode="decimal" className={cx(lopO, 'mono')} value={v.tu} onChange={(e) => dat({ tu: e.target.value.replace(/[^\d.,]/g, '') })} /></O>
              <span className="pb-3 text-mo">/</span>
              <O nhan="Yêu cầu"><input inputMode="decimal" className={cx(lopO, 'mono')} value={v.mau} onChange={(e) => dat({ mau: e.target.value.replace(/[^\d.,]/g, '') })} /></O>
            </div>
          )}
          {(kieu === 'ty_le' || kieu === 'so_luong') && v.tu && v.mau && docSo(v.tu) > docSo(v.mau) && <span className="text-[0.8125rem] text-nguy">Số đạt lớn hơn tổng số — kiểm tra lại.</span>}
          {k && <span className={cx('self-start rounded-lg px-2.5 py-1 text-[0.8125rem]', k.dat ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-nen text-den')}>
            <b className="mono">{soVN(k.tyLe, 2)}%</b> {x.dg.kieu === 'ty_le' && x.dg.chi_tieu ? (k.dat ? `· đạt chỉ tiêu ${soVN(x.dg.chi_tieu, 2)}%` : `· chỉ tiêu ${soVN(x.dg.chi_tieu, 2)}%`) : ''} → tiến độ {k.phanTram}%</span>}
          {kieu === 'tien_do' && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-mo">Tiến độ</span>
              {[0, 25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => dat({ pt: p, xong: p === 100 })} className={cx('mono h-8 min-w-12 rounded-lg border px-2 text-xs font-semibold', (v.pt ?? -1) === p ? 'border-ink bg-ink text-white' : 'border-vien-2 bg-white text-mo-2 hover:bg-nen')}>{p}%</button>
              ))}
            </div>
          )}
          <textarea className={cx(lopO, 'min-h-14 py-2 text-[0.875rem]')} placeholder={kieu === 'tien_do' ? 'Kết quả đã thực hiện trong tuần, vướng mắc' : 'Ghi chú, vướng mắc (không bắt buộc)'} value={v.ghi} onChange={(e) => dat({ ghi: e.target.value })} />
          <label className="flex items-center gap-2 text-[0.8125rem]">
            <input type="checkbox" className="h-4 w-4 accent-[#16A34A]" checked={v.xong} onChange={(e) => dat({ xong: e.target.checked })} />Đã hoàn thành nhiệm vụ{(k?.dat) && !v.xong && <span className="text-xs text-[#166534]">(đã đạt mức yêu cầu)</span>}
          </label>
          {!quanTri && x.n.trang_thai === 'hoan_thanh' && <span className="text-xs text-mo">Nhiệm vụ đã ghi nhận hoàn thành.</span>}
        </>
      )}
    </The>
  );
}

// ---------- Bảng theo dõi của Thường trực / Lãnh đạo
function BangTuan({ tuan, viec, dv, quanTri, nhapThay, daNhac }: { tuan: Tuan; viec: Viec[]; dv: DonVi[]; quanTri: boolean; nhapThay: (id: string) => void; daNhac: (m: string) => void }) {
  const [mo, setMo] = useState<string | null>(null);
  const [nhac, setNhac] = useState<DonVi[] | null>(null);
  const dong = dv.map((d) => {
    const ds = viec.filter((x) => x.n.chu_tri_don_vi_id === d.id);
    const bao = ds.filter((x) => x.tuan.length);
    const tre = bao.some((x) => x.tuan.some((c) => new Date(c.luc) > tuan.han));
    const cuoi = bao.flatMap((x) => x.tuan).sort((a, b) => b.luc.localeCompare(a.luc))[0]?.luc ?? null;
    return { d, ds, bao, cuoi, tt: tinhTrangTuan(ds.length, bao.length, tre, tuan) };
  }).filter((x) => x.ds.length);
  const chuaDu = dong.filter((x) => ['chua', 'qua_han', 'thieu'].includes(x.tt));
  const du = dong.filter((x) => x.tt === 'du' || x.tt === 'tre').length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.875rem]"><b className="mono">{du}</b>/{dong.length} đơn vị đã gửi đủ · <b className="mono">{viec.filter((x) => x.tuan.length).length}</b>/{viec.length} nhiệm vụ có báo cáo</span>
        <span className="flex-1" />
        {quanTri && chuaDu.length > 0 && <Nut icon={<Bell className="h-4 w-4" />} onClick={() => setNhac(chuaDu.map((x) => x.d))}>Nhắc {chuaDu.length} đơn vị chưa gửi đủ</Nut>}
      </div>
      {dong.length === 0 ? <Rong>Chưa có nhiệm vụ đã duyệt giao nào cần báo cáo tuần. Duyệt giao nhiệm vụ ở trang Nhiệm vụ BCĐ.</Rong> : (
        <The className="overflow-hidden">
          {dong.map(({ d, ds, bao, cuoi, tt }) => {
            const [nhan, chu, nen] = NHAN_TT_TUAN[tt];
            return (
              <div key={d.id} className="border-b border-[#F1EEE7] last:border-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <button onClick={() => setMo(mo === d.id ? null : d.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className={cx('h-4 w-4 shrink-0 text-mo transition', mo === d.id && 'rotate-180')} />
                    <span className="min-w-0 truncate text-[0.875rem] font-semibold">{d.ten}</span>
                  </button>
                  <span className="mono text-[0.8125rem]">{bao.length}/{ds.length}</span>
                  <div className="h-1.5 w-20 rounded-full bg-nen-3"><div className="h-1.5 rounded-full" style={{ width: `${(bao.length / ds.length) * 100}%`, background: chu }} /></div>
                  <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color: chu, background: nen }}>{nhan}</span>
                  <span className="hidden w-32 text-right text-xs text-mo sm:block">{cuoi ? ngayGioDu(cuoi) : '—'}</span>
                  {quanTri && <button onClick={() => nhapThay(d.id)} title="Nhập thay báo cáo cho đơn vị" className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#8E1B22] hover:bg-do/5"><PenLine className="h-3.5 w-3.5" />Nhập thay</button>}
                </div>
                {mo === d.id && (
                  <ul className="m-0 flex list-none flex-col gap-1.5 bg-nen-2 px-4 py-3 pl-10">
                    {ds.map((x) => (
                      <li key={x.n.id} className="flex flex-col text-[0.8125rem]">
                        <span className="flex items-start gap-2"><span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', x.tuan.length ? 'bg-[#16A34A]' : 'bg-vien-2')} />
                          <Link to={`/nhiem-vu/${x.n.id}`} className="font-semibold text-den hover:underline">{x.n.ma && <span className="mono mr-1 text-xs text-mo">{x.n.ma}</span>}{x.n.ten}</Link></span>
                        <span className="pl-4 text-mo-2">{x.tuan.length ? x.tuan.map((c) => boTienTo(c.noi_dung)).join(' | ') : <i className="text-mo">Chưa báo cáo tuần này</i>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </The>
      )}
      {nhac && <HopNhacTuan tuan={tuan} ds={nhac} dong={() => setNhac(null)} xong={daNhac} />}
    </>
  );
}

function HopNhacTuan({ tuan, ds, dong, xong }: { tuan: Tuan; ds: DonVi[]; dong: () => void; xong: (m: string) => void }) {
  const [buoc, setBuoc] = useState<'chon' | 'lien_lac'>('chon');
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const gui = async () => {
    setDang(true); setLoi(null);
    const { error } = await supabase.from('thong_bao').insert(ds.map((d) => ({
      don_vi_id: d.id, tieu_de: `Nhắc báo cáo ${tuan.ten.split(' (')[0].toLowerCase()}`,
      noi_dung: `Hạn ${ngayGioDu(tuan.han.toISOString())}. Đề nghị đơn vị cập nhật kết quả các nhiệm vụ được giao chủ trì.`, duong_dan: '/bao-cao-tuan',
    })));
    setDang(false);
    if (error) setLoi(loiDe(error)); else { xong(`Đã nhắc ${ds.length} đơn vị trên web.`); setBuoc('lien_lac'); }
  };
  return (
    <HopThoai mo dong={dong} tieuDe={buoc === 'chon' ? 'Nhắc đơn vị báo cáo tuần' : 'Gọi, nhắn trực tiếp'}>
      <div className="flex flex-col gap-3">
        {buoc === 'chon' ? <>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.875rem]">{ds.map((d) => <li key={d.id}>• {d.ten}</li>)}</ul>
          {loi && <HopLoi loi={loi} />}
          <div className="flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" icon={<Bell className="h-4 w-4" />} dangChay={dang} onClick={() => void gui()}>Gửi thông báo nhắc</Nut></div>
        </> : <>
          <LienLacDonVi ds={ds.map((d) => ({ id: d.id, ten: d.ten }))} noiDung={`BCĐ 57 phường Nam Đông Hà nhắc: đơn vị chưa gửi đủ báo cáo ${tuan.ten.split(' (')[0].toLowerCase()} (hạn ${ngayGioDu(tuan.han.toISOString())}). Đề nghị cập nhật trên web BCĐ 57. Trân trọng.`} />
          <div className="flex justify-end"><Nut kieu="chinh" onClick={dong}>Xong</Nut></div>
        </>}
      </div>
    </HopThoai>
  );
}

function HopCaiDat({ ch, dong, xong }: { ch: CauHinhBCT; dong: () => void; xong: () => void }) {
  const [g, setG] = useState(ch);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const luu = async () => {
    setDang(true); setLoi(null);
    const { error } = await supabase.from('cau_hinh').upsert({ khoa: KHOA_BCT, gia_tri: g, mo_ta: 'Hạn nộp báo cáo tuần' });
    setDang(false);
    if (error) setLoi(loiDe(error)); else xong();
  };
  return (
    <HopThoai mo dong={dong} tieuDe="Hạn nộp báo cáo tuần">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <O nhan="Thứ trong tuần"><select className={lopO} value={g.thu} onChange={(e) => setG({ ...g, thu: Number(e.target.value) })}>{Object.entries(TEN_THU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></O>
          <O nhan="Giờ"><select className={lopO} value={g.gio} onChange={(e) => setG({ ...g, gio: Number(e.target.value) })}>{Array.from({ length: 17 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{h}:00</option>)}</select></O>
        </div>
        <p className="m-0 text-xs text-mo">Áp dụng cho tất cả đơn vị chủ trì nhiệm vụ. Tuần tính từ thứ Hai đến Chủ nhật.</p>
        {loi && <HopLoi loi={loi} />}
        <div className="flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" dangChay={dang} onClick={() => void luu()}>Lưu</Nut></div>
      </div>
    </HopThoai>
  );
}

// Thẻ nhỏ trên trang chủ đơn vị: tình hình báo cáo tuần này + hạn
export function TheBaoCaoTuan({ dv }: { dv: string }) {
  const { data } = useDuLieu(async () => {
    const [a, b] = await Promise.all([
      supabase.from('cau_hinh').select('khoa, gia_tri').in('khoa', [KHOA_BCT, KHOA_CAU_HINH]),
      supabase.from('v_nhiem_vu').select('id, trang_thai').eq('chu_tri_don_vi_id', dv).eq('trang_thai_giao', 'da_duyet'),
    ]);
    const ch = (a.data ?? []) as { khoa: string; gia_tri: unknown }[];
    const bct = { ...BCT_MAC_DINH, ...(ch.find((x) => x.khoa === KHOA_BCT)?.gia_tri as Partial<CauHinhBCT> | undefined) };
    const a4 = ghepCauHinh(ch.find((x) => x.khoa === KHOA_CAU_HINH)?.gia_tri as never);
    const cha = new Set(Object.values(a4.dong).map((x) => x.cha).filter(Boolean) as string[]);
    const nv = ((b.data ?? []) as { id: string; trang_thai: TrangThaiNv }[]).filter((n) => !cha.has(n.id) && !['hoan_thanh', 'tam_dung'].includes(n.trang_thai));
    const t = tuanCua(new Date(), bct);
    const c = nv.length ? await supabase.from('v_nhiem_vu_cap_nhat').select('nhiem_vu_id, noi_dung').in('nhiem_vu_id', nv.map((n) => n.id)).gte('luc', t.batDau.toISOString()) : { data: [] };
    const da = new Set(((c.data ?? []) as { nhiem_vu_id: string; noi_dung: string }[]).filter((x) => x.noi_dung.startsWith(t.tienTo)).map((x) => x.nhiem_vu_id));
    return { t, tong: nv.length, da: nv.filter((n) => da.has(n.id)).length };
  }, [dv]);
  if (!data || !data.tong) return null;
  const xong = data.da >= data.tong; const qua = !xong && Date.now() > data.t.han.getTime();
  return (
    <Link to="/bao-cao-tuan" className={cx('the-noi flex items-center gap-3 rounded-2xl border p-3.5 text-den', xong ? 'border-vien bg-white' : qua ? 'border-[#FBCFD4] bg-[#FFF5F6]' : 'border-[#F5D48A] bg-[#FFFBEB]')}>
      <CalendarClock className={cx('h-6 w-6 shrink-0', xong ? 'text-[#166534]' : qua ? 'text-nguy' : 'text-cam-dam')} />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[0.875rem]">Báo cáo {data.t.ten.split(' (')[0].toLowerCase()}</b>
        <span className="text-xs text-mo">{xong ? 'Đã báo cáo đủ các nhiệm vụ.' : `Hạn ${ngayGioDu(data.t.han.toISOString())}${qua ? ' — đã quá hạn' : ` · còn ${conLaiChu(data.t.han)}`}`}</span>
      </span>
      <span className={cx('mono text-[1.25rem] font-bold', xong ? 'text-[#166534]' : 'text-den')}>{data.da}/{data.tong}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-mo" />
    </Link>
  );
}
