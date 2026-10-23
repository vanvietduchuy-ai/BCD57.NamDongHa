// Báo cáo tuần: đơn vị chủ trì nhập kết quả ngay trên bảng A4 nhiệm vụ (cột "Kết quả thực hiện");
// trang này để Cơ quan Thường trực, Lãnh đạo BCĐ xem tình hình gửi theo tuần, nhắc đơn vị chưa gửi, nhập thay trên bảng A4.
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bell, CalendarClock, Table2, ChevronDown, ChevronLeft, ChevronRight, PenLine, Settings2 } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useBayGio, useDuLieu } from '../lib/useDuLieu';
import { laAdmin, laQuanTri, useAuth } from '../lib/auth';
import { ngayGioDu } from '../lib/dinhDang';
import { COT_NV, type NhiemVu, type TrangThaiNv } from '../lib/nhiemVu';
import { canBaoCaoTuan, ghepCauHinh, goiYDanhGia, KHOA_CAU_HINH, tinhTrangTatCa, type CapNhatTT } from '../lib/danhMucA4';
import {
  baoCaoHieuLuc, BCT_MAC_DINH, boTienTo, chuTre, gioHan, KHOA_BCT, muonMs, NHAN_TT_TUAN, TEN_THU, tinhTrangTuan, tuanCua, type CapNhatTuan, type CauHinhBCT, type Tuan,
} from '../lib/baoCaoTuan';
import { LienLacDonVi } from '../components/LienLacTrucTiep';
import { DangTai, HopLoi, HopThoai, lopO, Nut, O, Rong, The, TieuDeTrang, cx } from '../components/ui';

type NvT = NhiemVu;
type DonVi = { id: string; ten: string; loai: string | null; thu_tu: number | null };
type Viec = { n: NvT; tuan: CapNhatTuan[] };

export default function BaoCaoTuan() {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  const admin = laAdmin(hoSo);
  const donVi = hoSo?.vai_tro === 'don_vi';
  const [lui, setLui] = useState(0);
  const [moCaiDat, setMoCaiDat] = useState(false);
  const [thongBao, setThongBao] = useState<string | null>(null);
  useBayGio(60000);

  const { data, loi, dangTai, taiLai } = useDuLieu(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from('cau_hinh').select('khoa, gia_tri').in('khoa', [KHOA_BCT, KHOA_CAU_HINH]),
      supabase.from('v_nhiem_vu').select(COT_NV).eq('trang_thai_giao', 'da_duyet'),
      supabase.from('don_vi').select('id, ten, loai, thu_tu').eq('hoat_dong', true).order('thu_tu'),
      supabase.from('v_nhiem_vu_cap_nhat').select('nhiem_vu_id, noi_dung, luc, phan_tram, boi_ten, trang_thai_moi').order('luc', { ascending: false }).limit(4000),
    ]);
    const ch = (kq(a) ?? []) as { khoa: string; gia_tri: unknown }[];
    return {
      bct: { ...BCT_MAC_DINH, ...(ch.find((x) => x.khoa === KHOA_BCT)?.gia_tri as Partial<CauHinhBCT> | undefined) },
      a4: ghepCauHinh(ch.find((x) => x.khoa === KHOA_CAU_HINH)?.gia_tri as never),
      nv: (kq(b) ?? []) as unknown as NvT[], dv: (kq(c) ?? []) as DonVi[], cn: (kq(d) ?? []) as CapNhatTuan[],
    };
  }, []);

  const tuan = useMemo(() => tuanCua(new Date(), data?.bct ?? BCT_MAC_DINH, lui), [data, lui]);
  // Nhiệm vụ phải báo cáo tuần: cùng quy tắc với bảng A4 (canBaoCaoTuan) — đã duyệt giao, không phải nhiệm vụ lớn có nhiệm vụ con
  const viec = useMemo(() => {
    if (!data) return [] as Viec[];
    const cha = new Set(Object.values(data.a4.dong).map((x) => x.cha).filter(Boolean) as string[]);
    const cnMap = new Map<string, CapNhatTT[]>();
    for (const c of data.cn) { if (!cnMap.has(c.nhiem_vu_id)) cnMap.set(c.nhiem_vu_id, []); cnMap.get(c.nhiem_vu_id)!.push(c); }   // mới nhất trước
    const ttMap = tinhTrangTatCa(data.nv, cnMap, data.a4);
    const ketThuc = tuan.ketThuc.toISOString();
    return data.nv.filter((n) => !cha.has(n.id) && n.chu_tri_don_vi_id).map((n) => {
      // Không chặn mốc đầu/cuối tuần: nộp bù sau Chủ nhật hoặc chuẩn bị trước tuần sau vẫn thuộc đúng tuần (theo tiền tố "Báo cáo tuần NN/YYYY:", đã có năm)
      const trongTuan = baoCaoHieuLuc(data.cn.filter((c) => c.nhiem_vu_id === n.id), tuan);   // đã tính sửa / rút
      const luaXong = cnMap.get(n.id)?.find((c) => c.trang_thai_moi === 'hoan_thanh')?.luc;
      const can = canBaoCaoTuan(n, ttMap.get(n.id)!.tt, data.a4.dong[n.id]?.danh_gia ?? goiYDanhGia(n), trongTuan.length > 0, !!luaXong && luaXong > ketThuc);
      return { n, tuan: trongTuan, can };
    }).filter((x) => x.can).map(({ n, tuan: t }) => ({ n, tuan: t }))
      .sort((a, b) => (a.n.ma ?? '').localeCompare(b.n.ma ?? '', 'vi', { numeric: true }) || a.n.tao_luc.localeCompare(b.n.tao_luc));
  }, [data, tuan]);

  // Đơn vị nhập báo cáo tuần ngay trên bảng A4 nhiệm vụ
  if (donVi) return <Navigate to="/nhiem-vu?tab=chua_bct" replace />;
  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;
  if (!data) return null;

  const hanChu = `${TEN_THU[data.bct.thu]}, ${gioHan(data.bct)}`;
  return (
    <>
      <TieuDeTrang tren="Đơn vị chủ trì báo cáo kết quả nhiệm vụ hằng tuần" ten="Báo cáo tuần"
        phai={<>
          {admin
            ? <Nut icon={<Settings2 className="h-4 w-4" />} onClick={() => setMoCaiDat(true)} ngan="Hạn">Hạn nộp: {hanChu}</Nut>
            : <span className="flex h-10 items-center gap-1.5 rounded-xl bg-nen px-3 text-[0.8125rem] text-mo-2"><CalendarClock className="h-4 w-4" />Hạn {hanChu}</span>}
          {quanTri && <Link to="/nhiem-vu?tab=chua_bct" className="flex h-10 items-center gap-1.5 rounded-xl bg-[#8E1B22] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[#6A0F14]"><Table2 className="h-4 w-4" /><span className="hidden sm:inline">Nhập trên bảng A4</span><span className="sm:hidden">Bảng A4</span></Link>}
        </>} />
      {thongBao && <div role="status" className="rounded-xl bg-[#DCFCE7] px-4 py-2.5 text-sm text-[#166534]">{thongBao}</div>}

      {/* Chọn tuần */}
      <div className="flex items-center gap-2 rounded-2xl border border-vien bg-white px-2 py-1.5">
        <button onClick={() => setLui(lui + 1)} aria-label="Tuần trước" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-nen"><ChevronLeft className="h-5 w-5" /></button>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center leading-tight">
          <b className="text-[0.9375rem]">{tuan.ten}</b>
          <span className="flex items-center gap-1 text-xs text-mo"><CalendarClock className="h-3.5 w-3.5 shrink-0" />Hạn {ngayGioDu(tuan.han.toISOString())}{lui === 0 && Date.now() <= tuan.han.getTime() ? ` · còn ${conLaiChu(tuan.han)}` : ''}{lui < 0 ? ' · tuần sau, chuẩn bị trước' : ''}</span>
        </div>
        <button disabled={lui <= (quanTri ? -1 : 0)} onClick={() => setLui(lui - 1)} aria-label="Tuần sau" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-nen disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
      </div>

      <BangTuan tuan={tuan} viec={viec} dv={data.dv} quanTri={quanTri} daNhac={setThongBao} />
      {moCaiDat && <HopCaiDat ch={data.bct} dong={() => setMoCaiDat(false)} xong={() => { setMoCaiDat(false); void taiLai(); }} />}
    </>
  );
}

const conLaiChu = (han: Date) => {
  const p = Math.max(0, Math.round((han.getTime() - Date.now()) / 60000));
  const ngay = Math.floor(p / 1440), gio = Math.floor((p % 1440) / 60);
  return ngay ? `${ngay} ngày ${gio} giờ` : gio ? `${gio} giờ ${p % 60} phút` : `${p} phút`;
};

// ---------- Bảng theo dõi của Thường trực / Lãnh đạo
function BangTuan({ tuan, viec, dv, quanTri, daNhac }: { tuan: Tuan; viec: Viec[]; dv: DonVi[]; quanTri: boolean; daNhac: (m: string) => void }) {
  const [mo, setMo] = useState<string | null>(null);
  const [nhac, setNhac] = useState<DonVi[] | null>(null);
  const dong = dv.map((d) => {
    const ds = viec.filter((x) => x.n.chu_tri_don_vi_id === d.id);
    const bao = ds.filter((x) => x.tuan.length);
    // Trễ tính theo lần gửi ĐẦU TIÊN của từng nhiệm vụ: sửa lại sau hạn không bị tính trễ
    const muon = Math.max(0, ...bao.map((x) => muonMs(x.tuan, tuan.han)));
    const cuoi = bao.flatMap((x) => x.tuan).sort((a, b) => b.luc.localeCompare(a.luc))[0]?.luc ?? null;
    return { d, ds, bao, cuoi, muon, tt: tinhTrangTuan(ds.length, bao.length, muon > 0, tuan) };
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
          {dong.map(({ d, ds, bao, cuoi, tt, muon }) => {
            const [nhan, chu, nen] = NHAN_TT_TUAN[tt];
            return (
              <div key={d.id} className="border-b border-[#F1EEE7] last:border-0">
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:flex sm:px-4 sm:py-3">
                  <button onClick={() => setMo(mo === d.id ? null : d.id)} aria-expanded={mo === d.id} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className={cx('h-4 w-4 shrink-0 text-mo transition', mo === d.id && 'rotate-180')} />
                    <span className="min-w-0 text-[0.875rem] font-semibold leading-snug sm:truncate">{d.ten}</span>
                  </button>
                  <span className="justify-self-end rounded-md px-2 py-0.5 text-xs font-semibold sm:order-3" style={{ color: chu, background: nen }}>{nhan}{muon > 0 && ` · muộn ${chuTre(muon)}`}</span>
                  <div className="col-span-2 flex items-center gap-2 pl-6 sm:order-2 sm:col-span-1 sm:pl-0">
                    <span className="mono text-[0.8125rem]">{bao.length}/{ds.length}</span>
                    <div className="h-1.5 w-full max-w-[80px] flex-1 rounded-full bg-nen-3 sm:w-20 sm:flex-none"><div className="h-1.5 rounded-full" style={{ width: `${(bao.length / ds.length) * 100}%`, background: chu }} /></div>
                    <span className="text-[11px] text-mo sm:hidden">{cuoi ? ngayGioDu(cuoi) : ''}</span>
                    {quanTri && <Link to={`/nhiem-vu?tab=chua_bct&dv=${d.id}`} className="ml-auto flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#8E1B22] hover:bg-do/5 sm:hidden"><PenLine className="h-3.5 w-3.5" />Nhập thay</Link>}
                  </div>
                  <span className="hidden w-32 text-right text-xs text-mo sm:order-4 sm:block">{cuoi ? ngayGioDu(cuoi) : '—'}</span>
                  {quanTri && <Link to={`/nhiem-vu?tab=chua_bct&dv=${d.id}`} title="Mở bảng A4 các nhiệm vụ của đơn vị để nhập thay báo cáo tuần"
                    className="hidden h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#8E1B22] hover:bg-do/5 sm:order-5 sm:flex"><PenLine className="h-3.5 w-3.5" />Nhập thay</Link>}
                </div>
                {mo === d.id && (
                  <ul className="m-0 flex list-none flex-col gap-1.5 bg-nen-2 px-3 py-3 pl-8 sm:px-4 sm:pl-10">
                    {ds.map((x) => (
                      <li key={x.n.id} className="flex flex-col text-[0.8125rem]">
                        <span className="flex items-start gap-2"><span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', x.tuan.length ? 'bg-[#16A34A]' : 'bg-vien-2')} />
                          <Link to={`/nhiem-vu/${x.n.id}`} className="font-semibold text-den hover:underline">{x.n.ma && <span className="mono mr-1 text-xs text-mo">{x.n.ma}</span>}{x.n.ten}</Link></span>
                        <span className="pl-4 text-mo-2">{x.tuan.length ? `${boTienTo(x.tuan[0].noi_dung)}${x.tuan.length > 1 ? ' (đã sửa)' : ''}${muonMs(x.tuan, tuan.han) > 0 ? ` — nộp muộn ${chuTre(muonMs(x.tuan, tuan.han))}` : ''}` : <i className="text-mo">Chưa báo cáo tuần này</i>}</span>
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
      noi_dung: `Hạn ${ngayGioDu(tuan.han.toISOString())}. Đề nghị đơn vị nhập kết quả các nhiệm vụ được giao chủ trì (cột Kết quả thực hiện trên bảng nhiệm vụ).`, duong_dan: '/nhiem-vu?tab=chua_bct',
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
          <O nhan="Giờ"><select className={lopO} value={`${g.gio}:${g.phut ?? 0}`} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); setG({ ...g, gio: h, phut: m }); }}>
            {Array.from({ length: 24 * 4 }, (_, i) => [Math.floor(i / 4), (i % 4) * 15]).map(([h, m]) => <option key={`${h}:${m}`} value={`${h}:${m}`}>{gioHan({ ...g, gio: h, phut: m })}</option>)}</select></O>
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
    const c = nv.length ? await supabase.from('v_nhiem_vu_cap_nhat').select('nhiem_vu_id, noi_dung, luc').in('nhiem_vu_id', nv.map((n) => n.id)).gte('luc', t.batDau.toISOString()) : { data: [] };
    const ds = (c.data ?? []) as { nhiem_vu_id: string; noi_dung: string; luc: string }[];
    const da = new Set(nv.map((n) => n.id).filter((id) => baoCaoHieuLuc(ds.filter((x) => x.nhiem_vu_id === id), t).length > 0));
    return { t, tong: nv.length, da: nv.filter((n) => da.has(n.id)).length };
  }, [dv]);
  if (!data || !data.tong) return null;
  const xong = data.da >= data.tong; const qua = !xong && Date.now() > data.t.han.getTime();
  return (
    <Link to={xong ? '/nhiem-vu' : '/nhiem-vu?tab=chua_bct'} className={cx('the-noi flex items-center gap-3 rounded-2xl border p-3.5 text-den', xong ? 'border-vien bg-white' : qua ? 'border-[#FBCFD4] bg-[#FFF5F6]' : 'border-[#F5D48A] bg-[#FFFBEB]')}>
      <CalendarClock className={cx('h-6 w-6 shrink-0', xong ? 'text-[#166534]' : qua ? 'text-nguy' : 'text-cam-dam')} />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[0.875rem]">Báo cáo {data.t.ten.split(' (')[0].toLowerCase()}</b>
        <span className="text-xs text-mo">{xong ? 'Đã báo cáo đủ các nhiệm vụ.' : `Hạn ${ngayGioDu(data.t.han.toISOString())}${qua ? ' — đã quá hạn' : ` · còn ${conLaiChu(data.t.han)}`}. Bấm để nhập trên bảng nhiệm vụ.`}</span>
      </span>
      <span className={cx('mono text-[1.25rem] font-bold', xong ? 'text-[#166534]' : 'text-den')}>{data.da}/{data.tong}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-mo" />
    </Link>
  );
}
