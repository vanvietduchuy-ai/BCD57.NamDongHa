// Danh mục nhiệm vụ dạng bảng A4 động: theo dõi, giao đơn vị chủ trì, đơn vị nhập kết quả và minh chứng,
// cảnh báo quá hạn, tỉ lệ hoàn thành theo đơn vị. Đơn vị chỉ thấy nhiệm vụ mình được giao chủ trì.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PE, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, Download, FileUp, LayoutGrid, Minus, Paperclip, Pencil, Plus, Rows3, Search, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { laQuanTri, useAuth } from '../lib/auth';
import { homNayVN, ngayGioDu } from '../lib/dinhDang';
import { COT_NV, khongDau, NHOM_NV, TT_NV, type NhiemVu, type NhomNv, type TrangThaiNv } from '../lib/nhiemVu';
import {
  CAU_HINH_MAC_DINH, COT_MAC_DINH, doanDonVi, docDanhMucWord, ghepCauHinh, KHOA_CAU_HINH, kichThuocTrang, MAU_TT, ngayNgan, tinhTrang, trangThaiTuChu,
  type CauHinhA4, type CotA4, type DongA4, type DongNhap, type KetQuaDoc, type KhoaCot, type LoaiTT, type NhomA4, type TinhTrang,
} from '../lib/danhMucA4';
import { DangTai, HopLoi, HopThoai, lopO, Nut, O, Rong, TieuDeTrang, cx } from '../components/ui';
import FormNhiemVu, { tuNhiemVu } from '../components/FormNhiemVu';

const MM = 96 / 25.4;
const FONT_A4 = "'Times New Roman', Tinos, 'Liberation Serif', serif";
type DonVi = { id: string; ten: string; loai: string | null };
type CapNhat = { nhiem_vu_id: string; noi_dung: string; phan_tram: number | null; trang_thai_moi: TrangThaiNv | null; luc: string; boi_ten: string | null };
type Dong = { n: NhiemVu; tt: TinhTrang; stt: number; nhom: string; cn: CapNhat[]; mc: string[]; d: DongA4 };
type LocTT = 'tat_ca' | 'qua_han' | 'sap_han' | 'chua_xong' | 'xong';
type Rieng = { cot?: Record<string, number>; cao?: Record<string, number>; zoom?: number | 'vua'; the?: boolean };

const KHOA_RIENG = 'bcd57-danh-muc-a4';
const docRieng = (): Rieng => { try { return JSON.parse(localStorage.getItem(KHOA_RIENG) ?? '{}'); } catch { return {}; } };
const ghiRieng = (r: Rieng) => { try { localStorage.setItem(KHOA_RIENG, JSON.stringify(r)); } catch { /* bỏ qua */ } };
const tenNgan = (t: string | null | undefined) => (t ?? '').replace(' – Công an phường', ' - CAP').replace('Phòng Văn hóa – Xã hội', 'Phòng VH-XH').replace('Văn phòng HĐND – UBND', 'VP HĐND-UBND');
const phanTram = (a: number, b: number) => (b ? Math.round((a * 1000) / b) / 10 : 0);
const pt = (x: number) => `${String(x).replace('.', ',')}%`;
const nhomMacDinh = (): NhomA4[] => (Object.entries(NHOM_NV) as [NhomNv, string][]).map(([k, v], i) => ({ id: `nv_${k}`, ky_hieu: 'ABC'[i], ten: v }));

export default function DanhMucNhiemVu() {
  const { hoSo } = useAuth();
  const nav = useNavigate();
  const quanTri = laQuanTri(hoSo);
  const donVi = hoSo?.vai_tro === 'don_vi';

  const { data, loi, dangTai, taiLai, setData } = useDuLieu(async () => {
    const [a, b, c, d, e, f] = await Promise.all([
      supabase.from('v_nhiem_vu').select(COT_NV).order('han', { ascending: true, nullsFirst: false }),
      supabase.from('don_vi').select('id, ten, loai').eq('hoat_dong', true).order('thu_tu'),
      supabase.from('v_nhiem_vu_cap_nhat').select('nhiem_vu_id, noi_dung, phan_tram, trang_thai_moi, luc, boi_ten').order('luc', { ascending: false }).limit(5000),
      supabase.from('v_minh_chung_nhiem_vu').select('nhiem_vu_id, so_ky_hieu, trich_yeu, ten_tep'),
      supabase.from('tep').select('nhiem_vu_id, ten').not('nhiem_vu_id', 'is', null),
      supabase.from('cau_hinh').select('gia_tri').eq('khoa', KHOA_CAU_HINH).maybeSingle(),
    ]);
    const cn = new Map<string, CapNhat[]>();
    for (const x of (c.data ?? []) as CapNhat[]) { if (!cn.has(x.nhiem_vu_id)) cn.set(x.nhiem_vu_id, []); cn.get(x.nhiem_vu_id)!.push(x); }
    const mc = new Map<string, string[]>();
    const them = (id: string, ten: string) => { if (!mc.has(id)) mc.set(id, []); mc.get(id)!.push(ten); };
    for (const x of (d.data ?? []) as { nhiem_vu_id: string; so_ky_hieu: string | null; trich_yeu: string; ten_tep: string | null }[]) them(x.nhiem_vu_id, x.so_ky_hieu ? `${x.so_ky_hieu} – ${x.trich_yeu}` : x.ten_tep ?? x.trich_yeu);
    for (const x of (e.data ?? []) as { nhiem_vu_id: string; ten: string }[]) them(x.nhiem_vu_id, x.ten);
    return {
      nv: (kq(a) ?? []) as unknown as NhiemVu[], dv: (kq(b) ?? []) as DonVi[], cn, mc,
      ch: ghepCauHinh((f.data as { gia_tri?: Partial<CauHinhA4> } | null)?.gia_tri),
    };
  }, []);

  const [rieng, setRiengS] = useState<Rieng>(docRieng);
  const setRieng = (r: Rieng) => { setRiengS(r); ghiRieng(r); };
  const [tim, setTim] = useState('');
  const [locTT, setLocTT] = useState<LocTT>('tat_ca');
  const [locDv, setLocDv] = useState('');
  const [xemNhu, setXemNhu] = useState('');
  const [chon, setChon] = useState<string | null>(null);
  const [moCaiDat, setMoCaiDat] = useState(false);
  const [moNhap, setMoNhap] = useState(false);
  const [moThem, setMoThem] = useState(false);
  const [baoCao, setBaoCao] = useState<NhiemVu | null>(null);
  const [sua, setSua] = useState<NhiemVu | null>(null);
  const [thongBao, setThongBao] = useState<{ loi?: string; ok?: string } | null>(null);
  const [rongMan, setRongMan] = useState(() => window.innerWidth);
  useEffect(() => { const f = () => setRongMan(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const ch = data?.ch ?? CAU_HINH_MAC_DINH;
  // Ghi cấu hình (chỉ Thường trực): cập nhật ngay trên màn hình rồi lưu
  const luuCH = useCallback(async (next: CauHinhA4) => {
    setData((x) => (x ? { ...x, ch: next } : x));
    const { error } = await supabase.from('cau_hinh').upsert({ khoa: KHOA_CAU_HINH, gia_tri: next, mo_ta: 'Bảng danh mục nhiệm vụ A4' });
    if (error) setThongBao({ loi: `Không lưu được thiết lập bảng: ${loiDe(error)}` });
  }, [setData]);
  const suaDong = (id: string, p: Partial<DongA4>) => luuCH({ ...ch, dong: { ...ch.dong, [id]: { ...ch.dong[id], ...p } } });

  // Nhóm nhiệm vụ: theo thiết lập, nếu chưa có thì theo "Nhóm" của nhiệm vụ
  const nhomDs = ch.nhom.length ? ch.nhom : nhomMacDinh();
  const nhomCua = (n: NhiemVu) => { const g = ch.dong[n.id]?.nhom; return g && nhomDs.some((x) => x.id === g) ? g : ch.nhom.length ? '_khac' : `nv_${n.nhom}`; };

  const tatCa: Dong[] = useMemo(() => {
    if (!data) return [];
    const thuTuNhom = new Map(nhomDs.map((g, i) => [g.id, i]));
    const ds = data.nv.map((n) => {
      const cn = data.cn.get(n.id) ?? [];
      const xongLuc = cn.find((x) => x.trang_thai_moi === 'hoan_thanh')?.luc ?? null;
      return { n, tt: tinhTrang(n, ch.canh_bao_ngay, xongLuc), stt: 0, nhom: nhomCua(n), cn, mc: data.mc.get(n.id) ?? [], d: ch.dong[n.id] ?? {} };
    });
    ds.sort((a, b) => ((thuTuNhom.get(a.nhom) ?? 99) - (thuTuNhom.get(b.nhom) ?? 99))
      || ((a.d.thu_tu ?? 1e6) - (b.d.thu_tu ?? 1e6)) || (a.n.han ?? '9').localeCompare(b.n.han ?? '9') || (a.n.ma ?? '').localeCompare(b.n.ma ?? ''));
    ds.forEach((x, i) => { x.stt = i + 1; });
    return ds;
  }, [data, ch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phạm vi xem: đơn vị chỉ thấy nhiệm vụ mình chủ trì (đã duyệt giao); Thường trực có thể "xem như" một đơn vị
  const dvXem = donVi ? hoSo?.don_vi_id ?? '__' : xemNhu;
  const phamVi = tatCa.filter((x) => !dvXem || (x.n.chu_tri_don_vi_id === dvXem && x.n.trang_thai_giao === 'da_duyet'));
  const hien = phamVi.filter((x) => {
    if (!dvXem && locDv && x.n.chu_tri_don_vi_id !== locDv) return false;
    const k = x.tt.loai;
    if (locTT === 'qua_han' && k !== 'qua_han') return false;
    if (locTT === 'sap_han' && k !== 'sap_han') return false;
    if (locTT === 'chua_xong' && k === 'xong') return false;
    if (locTT === 'xong' && k !== 'xong') return false;
    const t = khongDau(tim.trim());
    if (t && !khongDau(`${x.n.ma ?? ''} ${x.n.ten} ${x.n.chu_tri_ten ?? ''} ${x.d.chu_tri_vb ?? ''} ${x.n.san_pham ?? ''} ${x.cn[0]?.noi_dung ?? ''}`).includes(t)) return false;
    return true;
  });

  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;
  if (!data) return null;

  const suaDuocBang = quanTri && !xemNhu;
  const laThe = rieng.the ?? rongMan < 720;
  const dongChon = tatCa.find((x) => x.n.id === chon) ?? null;
  const tenDv = (id: string | null) => data.dv.find((d) => d.id === id)?.ten ?? '';

  const capNhatNv = async (id: string, p: Partial<NhiemVu>) => {
    const { error } = await supabase.from('nhiem_vu').update(p).eq('id', id);
    if (error) { setThongBao({ loi: loiDe(error) }); return false; }
    void taiLai(); return true;
  };

  return (
    <>
      <TieuDeTrang tren={<><Link to="/nhiem-vu" className="text-mo"><ChevronLeft className="-mt-0.5 inline h-4 w-4" />Nhiệm vụ</Link> · {donVi ? hoSo?.don_vi?.ten : 'Bảng theo dõi dạng A4'}</>}
        ten="Danh mục nhiệm vụ"
        phai={<>
          <Nut icon={<Download className="h-4 w-4" />} onClick={() => void xuatWord(ch, hien).catch((e) => setThongBao({ loi: loiDe(e) }))} ngan="Word">Xuất Word</Nut>
          <Nut icon={<Download className="h-4 w-4" />} onClick={() => void xuatExcel(ch, hien, phamVi, data.dv)} ngan="Excel">Xuất Excel</Nut>
          {suaDuocBang && <Nut icon={<FileUp className="h-4 w-4" />} onClick={() => setMoNhap(true)} ngan="Nhập">Nhập từ Word</Nut>}
          {suaDuocBang && <Nut icon={<Settings2 className="h-4 w-4" />} onClick={() => setMoCaiDat(true)} ngan="Thiết lập">Thiết lập bảng</Nut>}
          {suaDuocBang && <Nut kieu="chinh" icon={<Plus className="h-4 w-4" />} onClick={() => setMoThem(true)} ngan="Thêm">Thêm nhiệm vụ</Nut>}
        </>} />
      {thongBao && <div className={cx('flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm', thongBao.loi ? 'bg-nguy-nhat text-nguy' : 'bg-[#DCFCE7] text-[#166534]')}>
        <span className="flex-1">{thongBao.loi ?? thongBao.ok}</span><button aria-label="Đóng" onClick={() => setThongBao(null)}><X className="h-4 w-4" /></button></div>}

      <CanhBao ds={phamVi} canhBao={ch.canh_bao_ngay} mo={(id) => setChon(id)} loc={setLocTT} />
      <ThongKe ds={phamVi} tatCa={tatCa} dv={data.dv} dvXem={dvXem} quanTri={!donVi} loc={setLocTT} chonDv={(id) => { setLocDv(id); }} />

      {/* Công cụ */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-mo" />
          <input className={cx(lopO, 'w-full bg-white pl-10')} placeholder="Tìm nội dung, đơn vị, kết quả" value={tim} onChange={(e) => setTim(e.target.value)} aria-label="Tìm nhiệm vụ" />
        </label>
        <div className="flex flex-wrap overflow-hidden rounded-xl border border-vien-2 bg-white" role="group" aria-label="Lọc theo tình trạng">
          {([['tat_ca', 'Tất cả'], ['qua_han', 'Quá hạn'], ['sap_han', 'Sắp đến hạn'], ['chua_xong', 'Chưa xong'], ['xong', 'Hoàn thành']] as [LocTT, string][]).map(([k, t]) => (
            <button key={k} aria-pressed={locTT === k} onClick={() => setLocTT(k)}
              className={cx('min-h-10 border-r border-vien px-3 text-[0.8125rem] font-semibold last:border-0', locTT === k ? 'bg-ink text-white' : 'text-mo-2 hover:bg-nen-2')}>{t}</button>
          ))}
        </div>
        {!donVi && !xemNhu && (
          <select className={cx(lopO, 'bg-white')} value={locDv} onChange={(e) => setLocDv(e.target.value)} aria-label="Lọc theo đơn vị chủ trì">
            <option value="">Mọi đơn vị chủ trì</option>{data.dv.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}
          </select>
        )}
        {quanTri && (
          <select className={cx(lopO, 'bg-white')} value={xemNhu} onChange={(e) => { setXemNhu(e.target.value); setLocDv(''); }} aria-label="Xem như đơn vị">
            <option value="">Xem: toàn bộ (Thường trực)</option>{data.dv.map((d) => <option key={d.id} value={d.id}>Xem như: {tenNgan(d.ten)}</option>)}
          </select>
        )}
        <span className="flex-1" />
        {!laThe && <Zoom z={rieng.zoom ?? 'vua'} dat={(z) => setRieng({ ...rieng, zoom: z })} />}
        <Nut icon={laThe ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />} onClick={() => setRieng({ ...rieng, the: !laThe })}>{laThe ? 'Bảng A4' : 'Dạng thẻ'}</Nut>
      </div>

      {laThe
        ? <DangThe ds={hien} nhomDs={nhomDs} mo={setChon} />
        : <BangA4 ch={ch} ds={hien} nhomDs={nhomDs} rieng={rieng} setRieng={setRieng} suaDuoc={suaDuocBang} chon={chon}
            mo={setChon} luuCH={luuCH} suaDong={suaDong} capNhatNv={capNhatNv}
            baoCao={(n) => setBaoCao(n)} duocBaoCao={(n) => n.trang_thai_giao === 'da_duyet' && (quanTri || n.chu_tri_don_vi_id === hoSo?.don_vi_id)}
            rong={phamVi.length > 0} />}

      {dongChon && (
        <KhungChiTiet x={dongChon} dong={() => setChon(null)} quanTri={suaDuocBang} nhomDs={nhomDs} tenDv={tenDv}
          duocBaoCao={dongChon.n.trang_thai_giao === 'da_duyet' && (quanTri || dongChon.n.chu_tri_don_vi_id === hoSo?.don_vi_id)}
          baoCao={() => setBaoCao(dongChon.n)} sua={() => setSua(dongChon.n)}
          doiNhom={(g) => suaDong(dongChon.n.id, { nhom: g, thu_tu: Date.now() })}
          diChuyen={(huong) => {
            const cung = tatCa.filter((x) => x.nhom === dongChon.nhom);
            const i = cung.findIndex((x) => x.n.id === dongChon.n.id), j = i + huong;
            if (j < 0 || j >= cung.length) return;
            const dong = { ...ch.dong };
            cung.forEach((x, k) => { dong[x.n.id] = { ...dong[x.n.id], thu_tu: (k === i ? j : k === j ? i : k) + 1 }; });
            void luuCH({ ...ch, dong });
          }}
          duyet={() => void capNhatNv(dongChon.n.id, { trang_thai_giao: 'da_duyet' })}
          xoa={async () => {
            if (!window.confirm(`Xoá nhiệm vụ "${dongChon.n.ten}" cùng toàn bộ lịch sử cập nhật?`)) return;
            const { error } = await supabase.from('nhiem_vu').delete().eq('id', dongChon.n.id);
            if (error) { setThongBao({ loi: loiDe(error) }); return; }
            setChon(null); void taiLai();
          }}
          moTrang={() => nav(`/nhiem-vu/${dongChon.n.id}#tep`)} />
      )}

      <HopBaoCao n={baoCao} dong={() => setBaoCao(null)} laChuTri xong={() => { setBaoCao(null); setThongBao({ ok: 'Đã gửi kết quả thực hiện.' }); void taiLai(); }} />
      {suaDuocBang && <FormNhiemVu mo={moThem} dong={() => setMoThem(false)} xong={(id) => { setMoThem(false); setChon(id); void taiLai(); }} />}
      {sua && <FormNhiemVu mo dong={() => setSua(null)} id={sua.id} dau={tuNhiemVu(sua)} xong={() => { setSua(null); void taiLai(); }} />}
      {moCaiDat && <HopCaiDat ch={ch} dong={() => setMoCaiDat(false)} luu={async (c) => { await luuCH(c); setMoCaiDat(false); }} soNv={(g) => tatCa.filter((x) => x.nhom === g).length} />}
      {moNhap && <HopNhapWord dv={data.dv} ch={ch} daCo={data.nv} dong={() => setMoNhap(false)} luuCH={luuCH}
        xong={(so) => { setMoNhap(false); setThongBao({ ok: `Đã nhập ${so} nhiệm vụ vào danh mục.` }); void taiLai(); }} />}
    </>
  );
}

// ---------- Cảnh báo quá hạn / sắp đến hạn
function CanhBao({ ds, canhBao, mo, loc }: { ds: Dong[]; canhBao: number; mo: (id: string) => void; loc: (l: LocTT) => void }) {
  const qh = ds.filter((x) => x.tt.loai === 'qua_han').sort((a, b) => (b.tt.tre ?? 0) - (a.tt.tre ?? 0));
  const sh = ds.filter((x) => x.tt.loai === 'sap_han').sort((a, b) => (a.tt.con ?? 0) - (b.tt.con ?? 0));
  if (!qh.length && !sh.length) return null;
  const khoi = (arr: Dong[], tieuDe: string, l: LocTT, nen: string, chu: string) => arr.length > 0 && (
    <div className={cx('flex min-w-0 flex-col gap-1.5 rounded-2xl px-4 py-3', nen)}>
      <div className={cx('flex flex-wrap items-center gap-2 text-sm font-bold', chu)}>{tieuDe}: {arr.length} nhiệm vụ
        <button className="rounded-lg border border-current px-2 py-0.5 text-xs font-semibold" onClick={() => loc(l)}>Lọc</button></div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {arr.slice(0, 5).map((x) => (
          <li key={x.n.id}><button onClick={() => mo(x.n.id)} className="flex w-full min-w-0 items-baseline gap-2 text-left text-[0.8125rem] hover:underline">
            <span className={cx('mono shrink-0 font-bold', chu)}>{x.tt.nhan}</span><span className="truncate text-den">{x.stt}. {x.n.ten}</span></button></li>
        ))}
        {arr.length > 5 && <li className="text-xs text-mo">… và {arr.length - 5} nhiệm vụ khác</li>}
      </ul>
    </div>
  );
  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{khoi(qh, 'Quá hạn', 'qua_han', 'bg-nguy-nhat', 'text-nguy')}{khoi(sh, `Sắp đến hạn (trong ${canhBao} ngày)`, 'sap_han', 'bg-cam-nhat', 'text-cam-dam')}</div>;
}

// ---------- Thống kê: số giao, hoàn thành, tỉ lệ theo đơn vị chủ trì
function ThongKe({ ds, tatCa, dv, dvXem, quanTri, loc, chonDv }: { ds: Dong[]; tatCa: Dong[]; dv: DonVi[]; dvXem: string; quanTri: boolean; loc: (l: LocTT) => void; chonDv: (id: string) => void }) {
  const dem = (k: LoaiTT) => ds.filter((x) => x.tt.loai === k).length;
  const xong = dem('xong'), tl = phanTram(xong, ds.length);
  const theoDv = (id: string) => {
    const a = tatCa.filter((x) => x.n.chu_tri_don_vi_id === id && x.n.trang_thai_giao === 'da_duyet');
    const x = a.filter((y) => y.tt.loai === 'xong');
    return { giao: a.length, xong: x.length, dungHan: x.filter((y) => !y.tt.tre).length, quaHan: a.filter((y) => y.tt.loai === 'qua_han').length };
  };
  const tong = tatCa.filter((x) => x.n.trang_thai_giao === 'da_duyet').length;
  const dsDv = (dvXem ? dv.filter((d) => d.id === dvXem) : dv).map((d) => ({ d, s: theoDv(d.id) })).filter((x) => x.s.giao > 0 || !!dvXem);
  const o = (n: number, nhan: string, mau: string, l: LocTT) => (
    <button onClick={() => loc(l)} className="flex flex-col items-start rounded-xl bg-nen-2 px-3 py-2 text-left hover:bg-nen-3">
      <span className={cx('mono text-[1.375rem] font-bold leading-tight', mau)}>{n}</span><span className="text-[0.75rem] text-mo">{nhan}</span></button>
  );
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
      <div className="flex flex-col gap-3 rounded-2xl border border-vien bg-white p-4">
        <span className="text-[11px] font-bold tracking-wide text-mo">{dvXem ? 'NHIỆM VỤ ĐƯỢC GIAO CHỦ TRÌ' : 'TOÀN BỘ DANH MỤC'}</span>
        <div className="grid grid-cols-3 gap-2">
          {o(ds.length, dvXem ? 'Được giao' : 'Tổng nhiệm vụ', 'text-den', 'tat_ca')}
          {o(xong, 'Hoàn thành', 'text-[#166534]', 'xong')}
          {o(ds.length - xong, 'Chưa hoàn thành', 'text-xanh', 'chua_xong')}
          {o(dem('qua_han'), 'Quá hạn', 'text-nguy', 'qua_han')}
          {o(dem('sap_han'), 'Sắp đến hạn', 'text-cam', 'sap_han')}
          {o(dem('chua'), 'Chưa triển khai', 'text-mo-2', 'chua_xong')}
        </div>
        <div className="flex items-center gap-3 text-sm"><span className="text-mo">Tỉ lệ hoàn thành</span>
          <div className="h-2 flex-1 rounded-full bg-nen-3"><div className="h-2 rounded-full bg-[#16A34A]" style={{ width: `${tl}%` }} /></div>
          <b className="mono">{pt(tl)}</b></div>
        {dvXem && tong > 0 && <span className="text-xs text-mo">Tỉ trọng: {pt(phanTram(ds.length, tong))} tổng số nhiệm vụ của danh mục.</span>}
      </div>
      <div className="min-w-0 rounded-2xl border border-vien bg-white p-4">
        <span className="text-[11px] font-bold tracking-wide text-mo">TỈ LỆ THEO ĐƠN VỊ CHỦ TRÌ</span>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead><tr className="text-right text-[11px] text-mo">
              <th className="py-1.5 pr-2 text-left font-semibold">Đơn vị</th><th className="px-2 font-semibold">Được giao</th><th className="px-2 font-semibold max-sm:hidden">Tỉ trọng</th>
              <th className="px-2 font-semibold">Hoàn thành</th><th className="px-2 font-semibold max-sm:hidden">Đúng hạn</th><th className="px-2 font-semibold">Quá hạn</th><th className="px-2 font-semibold">Tỉ lệ HT</th><th className="w-24 max-sm:hidden" />
            </tr></thead>
            <tbody>
              {dsDv.length === 0 && <tr><td colSpan={8} className="py-3 text-mo">Chưa có nhiệm vụ nào được giao.</td></tr>}
              {dsDv.map(({ d, s }) => { const p = phanTram(s.xong, s.giao); return (
                <tr key={d.id} className={cx('border-t border-[#F1EEE7] text-right', quanTri && 'cursor-pointer hover:bg-nen-2')} onClick={() => quanTri && chonDv(d.id)}>
                  <td className="py-1.5 pr-2 text-left">{d.ten}</td><td className="mono px-2">{s.giao}</td><td className="mono px-2 max-sm:hidden">{pt(phanTram(s.giao, tong))}</td>
                  <td className="mono px-2">{s.xong}</td><td className="mono px-2 max-sm:hidden">{s.dungHan}</td><td className={cx('mono px-2', s.quaHan > 0 && 'font-bold text-nguy')}>{s.quaHan}</td>
                  <td className="mono px-2 font-bold">{pt(p)}</td><td className="max-sm:hidden"><div className="h-1.5 rounded-full bg-nen-3"><div className="h-1.5 rounded-full bg-[#16A34A]" style={{ width: `${p}%` }} /></div></td>
                </tr>); })}
            </tbody>
            {!dvXem && dsDv.length > 0 && (() => { const x = tatCa.filter((y) => y.n.trang_thai_giao === 'da_duyet' && y.tt.loai === 'xong'); return (
              <tfoot><tr className="border-t border-vien-2 text-right font-bold"><td className="py-1.5 pr-2 text-left">Cả danh mục (đã duyệt giao)</td><td className="mono px-2">{tong}</td><td className="mono px-2 max-sm:hidden">100%</td>
                <td className="mono px-2">{x.length}</td><td className="mono px-2 max-sm:hidden">{x.filter((y) => !y.tt.tre).length}</td>
                <td className="mono px-2">{tatCa.filter((y) => y.n.trang_thai_giao === 'da_duyet' && y.tt.loai === 'qua_han').length}</td><td className="mono px-2">{pt(phanTram(x.length, tong))}</td><td className="max-sm:hidden" /></tr></tfoot>); })()}
          </table>
        </div>
        <p className="m-0 mt-2 text-xs text-mo">Tỉ trọng = số nhiệm vụ đơn vị được giao chủ trì / tổng số nhiệm vụ đã duyệt giao. Nhiệm vụ chờ duyệt chưa tính.</p>
      </div>
    </div>
  );
}

function Zoom({ z, dat }: { z: number | 'vua'; dat: (z: number | 'vua') => void }) {
  const [hien, setHien] = useState(100);
  useEffect(() => { const f = (e: Event) => setHien(Math.round((e as CustomEvent<number>).detail * 100)); window.addEventListener('a4-ti-le', f); return () => window.removeEventListener('a4-ti-le', f); }, []);
  const so = typeof z === 'number' ? z : hien / 100;
  return (
    <div className="flex items-center gap-1 rounded-xl border border-vien-2 bg-white px-1">
      <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen" aria-label="Thu nhỏ" onClick={() => dat(Math.max(0.3, Math.round((so - 0.1) * 10) / 10))}><Minus className="h-4 w-4" /></button>
      <span className="mono w-11 text-center text-xs">{typeof z === 'number' ? Math.round(z * 100) : hien}%</span>
      <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen" aria-label="Phóng to" onClick={() => dat(Math.min(2, Math.round((so + 0.1) * 10) / 10))}><Plus className="h-4 w-4" /></button>
      <button className={cx('h-9 rounded-lg px-2 text-xs font-semibold hover:bg-nen', z === 'vua' && 'text-do')} onClick={() => dat('vua')}>Vừa khung</button>
    </div>
  );
}

// ---------- Bảng A4
type BangProps = {
  ch: CauHinhA4; ds: Dong[]; nhomDs: NhomA4[]; rieng: Rieng; setRieng: (r: Rieng) => void; suaDuoc: boolean; chon: string | null; rong: boolean;
  mo: (id: string) => void; luuCH: (c: CauHinhA4) => Promise<void>; suaDong: (id: string, p: Partial<DongA4>) => void;
  capNhatNv: (id: string, p: Partial<NhiemVu>) => Promise<boolean>; baoCao: (n: NhiemVu) => void; duocBaoCao: (n: NhiemVu) => boolean;
};
const O_SUA: Partial<Record<KhoaCot, 'nv' | 'dong'>> = { ten: 'nv', san_pham: 'nv', chu_tri: 'dong', han_vb: 'dong', tien_do: 'dong' };

function BangA4({ ch, ds, nhomDs, rieng, setRieng, suaDuoc, chon, mo, luuCH, suaDong, capNhatNv, baoCao, duocBaoCao, rong: coDuLieu }: BangProps) {
  const vo = useRef<HTMLDivElement>(null);
  const giay = useRef<HTMLDivElement>(null);
  const [rongVo, setRongVo] = useState(1000);
  const [caoGiay, setCaoGiay] = useState(0);
  const [dangSua, setDangSua] = useState<string | null>(null);
  const hen = useRef<number | undefined>(undefined);
  const kt = kichThuocTrang(ch);
  const pxRong = kt.rong * MM, pxCao = kt.cao * MM;
  // Độ rộng cột: Thường trực lưu chung; người khác chỉnh riêng trên máy mình
  const cot = ch.cot.filter((c) => c.hien).map((c) => ({ ...c, rong: rieng.cot?.[c.khoa] && !suaDuoc ? rieng.cot[c.khoa] : c.rong }));
  const tong = cot.reduce((a, c) => a + (c.rong || 1), 0);
  const [rongTam, setRongTam] = useState<Record<string, number> | null>(null);
  const [caoTam, setCaoTam] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const el = vo.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setRongVo(e.contentRect.width)); ro.observe(el); return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = giay.current; if (!el) return;
    const ro = new ResizeObserver(() => setCaoGiay(el.scrollHeight)); ro.observe(el); return () => ro.disconnect();
  }, []);
  const tiLe = rieng.zoom && rieng.zoom !== 'vua' ? rieng.zoom : Math.min(1.6, Math.max(0.3, (rongVo - 8) / pxRong));
  useEffect(() => { window.dispatchEvent(new CustomEvent('a4-ti-le', { detail: tiLe })); }, [tiLe]);
  const soTrang = Math.max(1, Math.ceil((caoGiay - 2) / pxCao));

  const rongCot = (k: string, w: number) => (rongTam?.[k] ?? w);
  const keoCot = (e: PE, i: number) => {
    e.preventDefault(); e.stopPropagation();
    const a = cot[i], b = cot[i + 1]; if (!a || !b) return;
    const bang = (e.currentTarget as HTMLElement).closest('table')!; const tw = bang.offsetWidth;
    const x0 = e.clientX, wa = a.rong, wb = b.rong, min = tong * 0.025;
    let ketQua = { [a.khoa]: wa, [b.khoa]: wb } as Record<string, number>;
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { const dw = ((ev.clientX - x0) / tiLe / tw) * tong; const na = Math.max(min, Math.min(wa + wb - min, wa + dw));
      ketQua = { [a.khoa]: Math.round(na * 100) / 100, [b.khoa]: Math.round((wa + wb - na) * 100) / 100 }; setRongTam(ketQua); };
    const up = () => {
      el.removeEventListener('pointermove', mv); setRongTam(null);
      if (suaDuoc) void luuCH({ ...ch, cot: ch.cot.map((c) => (ketQua[c.khoa] ? { ...c, rong: ketQua[c.khoa] } : c)) });
      else setRieng({ ...rieng, cot: { ...rieng.cot, ...ketQua } });
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up, { once: true }); el.addEventListener('pointercancel', up, { once: true });
  };
  const caoDong = (x: Dong) => caoTam[x.n.id] ?? (!suaDuoc && rieng.cao?.[x.n.id]) ?? x.d.cao ?? 0;
  const keoDong = (e: PE, x: Dong) => {
    e.preventDefault(); e.stopPropagation(); window.clearTimeout(hen.current);
    const tr = (e.currentTarget as HTMLElement).closest('tr')!; const h0 = tr.offsetHeight, y0 = e.clientY; let nh = h0;
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { nh = Math.max(18, Math.round(h0 + (ev.clientY - y0) / tiLe)); setCaoTam((c) => ({ ...c, [x.n.id]: nh })); };
    const up = () => {
      el.removeEventListener('pointermove', mv);
      if (Math.abs(nh - h0) > 2) { if (suaDuoc) suaDong(x.n.id, { cao: nh }); else setRieng({ ...rieng, cao: { ...rieng.cao, [x.n.id]: nh } }); }
      window.setTimeout(() => setCaoTam((c) => { const con = { ...c }; delete con[x.n.id]; return con; }), 400);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up, { once: true }); el.addEventListener('pointercancel', up, { once: true });
  };
  const veLaiCao = (x: Dong) => { if (suaDuoc) suaDong(x.n.id, { cao: 0 }); else { const c = { ...rieng.cao }; delete c[x.n.id]; setRieng({ ...rieng, cao: c }); } };

  const bam = (id: string) => { window.clearTimeout(hen.current); hen.current = window.setTimeout(() => mo(id), 230); };
  const giaTriSua = (x: Dong, k: KhoaCot): string =>
    k === 'ten' ? x.n.ten : k === 'san_pham' ? x.n.san_pham ?? '' : k === 'chu_tri' ? x.d.chu_tri_vb ?? chuTriMacDinh(x) : k === 'han_vb' ? x.d.han_vb ?? '' : x.d.tien_do_vb ?? '';
  const luuO = async (x: Dong, k: KhoaCot, v: string) => {
    setDangSua(null);
    if (v === giaTriSua(x, k)) return;
    if (O_SUA[k] === 'nv') { if (k === 'ten' && !v.trim()) return; await capNhatNv(x.n.id, k === 'ten' ? { ten: v.trim() } : { san_pham: v.trim() || null }); }
    else suaDong(x.n.id, k === 'chu_tri' ? { chu_tri_vb: v } : k === 'han_vb' ? { han_vb: v } : { tien_do_vb: v });
  };

  const o = (x: Dong, c: CotA4): ReactNode => {
    const khoa = `${x.n.id}:${c.khoa}`;
    if (dangSua === khoa) return <OSuaChu dau={giaTriSua(x, c.khoa)} luu={(v) => void luuO(x, c.khoa, v)} huy={() => setDangSua(null)} />;
    switch (c.khoa) {
      case 'tt': return <>{x.stt}<div title="Kéo để đổi chiều cao hàng, bấm đúp để trả về tự động" onPointerDown={(e) => keoDong(e, x)} onDoubleClick={(e) => { e.stopPropagation(); veLaiCao(x); }}
        className="absolute -bottom-1 left-0 z-10 h-2 w-[4000px] cursor-row-resize hover:bg-do/20" /></>;
      case 'ten': return <span className="whitespace-pre-wrap">{x.n.ten}{x.n.trang_thai_giao === 'de_xuat' && <span className="ml-1 rounded bg-[#FEF3C7] px-1 font-sans text-[7.5pt] font-semibold text-[#92400E]">Chờ duyệt giao</span>}</span>;
      case 'chu_tri': return <><span className="whitespace-pre-wrap">{x.d.chu_tri_vb || chuTriMacDinh(x)}</span>
        {x.n.chu_tri_ten && <span className="mt-0.5 block font-sans text-[7.5pt] text-[#7A1A27]" title="Đơn vị được giao chủ trì trên hệ thống">▸ {tenNgan(x.n.chu_tri_ten)}</span>}</>;
      case 'san_pham': return <span className="whitespace-pre-wrap">{x.n.san_pham}</span>;
      case 'han_vb': return <span className="whitespace-pre-wrap">{x.d.han_vb}</span>;
      case 'han': return <><b>{x.n.dinh_ky ? (x.n.ky_han ? ngayNgan(x.n.ky_han) : 'Định kỳ') : ngayNgan(x.n.han) || '—'}</b>{x.n.dinh_ky && <span className="block text-[0.9em] italic">(định kỳ)</span>}</>;
      case 'tien_do': return <><span className="font-sans text-[8pt] font-semibold">{TT_NV[x.n.trang_thai].nhan} · {x.n.phan_tram}%</span>
        {x.d.tien_do_vb && <span className="mt-0.5 block whitespace-pre-wrap">{x.d.tien_do_vb}</span>}</>;
      case 'ket_qua': return x.cn[0]
        ? <><span className="whitespace-pre-wrap">{x.cn[0].noi_dung}</span><span className="mt-0.5 block font-sans text-[7.5pt] text-[#6B6B6B]">{x.cn[0].boi_ten ?? ''} · {ngayGioDu(x.cn[0].luc)}</span></>
        : duocBaoCao(x.n) ? <span className="italic text-[#8D8486]">Bấm đúp để nhập kết quả…</span> : null;
      case 'minh_chung': return x.mc.length
        ? <span className="flex flex-col gap-0.5">{x.mc.map((t, i) => <span key={i} className="text-[#1E4F86]">▸ {t}</span>)}</span>
        : <span className="text-[#8D8486]">—</span>;
      case 'tinh_trang': { const m = MAU_TT[x.tt.loai]; return <span className="inline-block rounded px-1 font-sans text-[7.8pt] font-semibold leading-snug" style={{ color: m.chu, background: m.nen }}>{x.tt.nhan}</span>; }
      case 'lanh_dao': return x.n.lanh_dao_phu_trach;
      case 'ma': return x.n.ma;
    }
  };

  const nhomCo = [...nhomDs, { id: '_khac', ky_hieu: '', ten: 'Chưa phân nhóm' }].map((g) => [g, ds.filter((x) => x.nhom === g.id)] as const).filter(([, v]) => v.length);
  const phu = ch.dong_phu.replace(/\{ngay\}/g, ngayNgan(homNayVN()));
  const [mt, mr, mb, ml] = ch.kho.le;

  return (
    <div ref={vo} className="overflow-x-auto rounded-2xl bg-[#E7E3E4] py-4">
      <div className="relative mx-auto" style={{ width: pxRong * tiLe, height: Math.max(caoGiay, pxCao) * tiLe }}>
        <div ref={giay} className="absolute left-0 top-0 origin-top-left bg-white text-[#121212] shadow-[0_8px_24px_rgba(40,10,15,.12)]"
          style={{ width: pxRong, minHeight: soTrang * pxCao, transform: `scale(${tiLe})`, padding: `${mt}mm ${mr}mm ${mb}mm ${ml}mm`, fontFamily: FONT_A4, fontSize: `${ch.kho.co_chu}pt`, lineHeight: 1.25 }}>
          {ch.dong_goc && <div className="text-right font-bold italic">{ch.dong_goc}</div>}
          <div className="text-center text-[1.15em] font-bold leading-snug">{ch.tieu_de}</div>
          {phu && <div className="mb-[8pt] mt-[2pt] text-center italic">{phu}</div>}
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>{cot.map((c) => <col key={c.khoa} style={{ width: `${(rongCot(c.khoa, c.rong) / tong) * 100}%` }} />)}</colgroup>
            <thead><tr>{cot.map((c, i) => (
              <th key={c.khoa} style={{ whiteSpace: 'normal' }} className="relative select-none whitespace-normal border border-[#2B2B2B] px-[4pt] py-[3pt] text-center align-middle font-bold [overflow-wrap:anywhere]">{c.nhan}
                {i < cot.length - 1 && <span onPointerDown={(e) => keoCot(e, i)} title="Kéo để đổi độ rộng cột" className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-do/30" />}</th>
            ))}</tr></thead>
            <tbody>
              {!ds.length && <tr><td colSpan={cot.length} className="border border-[#2B2B2B] py-8 text-center font-sans text-sm text-[#8D8486]">
                {coDuLieu ? 'Không có nhiệm vụ khớp bộ lọc.' : suaDuoc ? 'Chưa có nhiệm vụ. Bấm “Nhập từ Word” để nạp danh mục, hoặc “Thêm nhiệm vụ”.' : 'Đơn vị chưa được giao chủ trì nhiệm vụ nào.'}</td></tr>}
              {nhomCo.map(([g, arr]) => [
                <tr key={g.id}><td colSpan={cot.length} className="border border-[#2B2B2B] bg-[#F1ECEC] px-[4pt] py-[3pt] font-bold">{g.ky_hieu ? `${g.ky_hieu}. ` : ''}{g.ten}</td></tr>,
                ...arr.map((x) => {
                  const m = MAU_TT[x.tt.loai]; const cao = caoDong(x);
                  return (
                    <tr key={x.n.id} onClick={(e) => { if (!(e.target as HTMLElement).closest('textarea')) bam(x.n.id); }}
                      className={cx('cursor-pointer', chon === x.n.id ? 'bg-[#FFF3D6]' : x.tt.loai === 'qua_han' ? 'bg-[#FFF6F5] hover:bg-[#FDECEA]' : 'hover:bg-[#FBF8F8]')}
                      style={cao ? { height: cao } : undefined}>
                      {cot.map((c, i) => {
                        const suaO = (suaDuoc && O_SUA[c.khoa]) || (c.khoa === 'ket_qua' && duocBaoCao(x.n));
                        return (
                          <td key={c.khoa}
                            onDoubleClick={suaO ? (e) => { e.stopPropagation(); window.clearTimeout(hen.current); if (c.khoa === 'ket_qua') baoCao(x.n); else setDangSua(`${x.n.id}:${c.khoa}`); } : undefined}
                            className={cx('border border-[#2B2B2B] px-[4pt] py-[3pt] align-top [overflow-wrap:anywhere]', ['tt', 'han', 'han_vb', 'tinh_trang'].includes(c.khoa) && 'text-center', c.khoa === 'tt' && 'relative', suaO && 'hover:outline hover:outline-1 hover:outline-[#C99A2E]')}
                            style={i === 0 ? { boxShadow: `inset 3px 0 0 ${m.vach}` } : undefined}>{o(x, c)}</td>
                        );
                      })}
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
          {ch.ghi_chu && <p className="mt-[6pt] whitespace-pre-wrap text-justify text-[0.9em] italic">{ch.ghi_chu}</p>}
          {Array.from({ length: soTrang - 1 }, (_, k) => (
            <div key={k} aria-hidden className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-[#B9A9AC]" style={{ top: (k + 1) * pxCao }}>
              <span className="absolute -top-2.5 right-2 bg-white px-1 font-sans text-[10px] text-[#9A8B8E]">Trang {k + 2} (ước tính)</span></div>
          ))}
        </div>
      </div>
      <p className="m-0 mt-3 px-4 text-center text-xs text-mo">
        {suaDuoc ? 'Bấm một hàng để xem chi tiết. Bấm đúp vào ô để sửa. Kéo mép tiêu đề cột hoặc đáy ô TT để đổi độ rộng, chiều cao.' : 'Bấm một hàng để xem chi tiết. Bấm đúp ô “Kết quả thực hiện” để báo cáo kết quả.'}
      </p>
    </div>
  );
}
const chuTriMacDinh = (x: Dong) => x.n.chu_tri_ten ? `${x.n.chu_tri_ten} chủ trì` : '';

function OSuaChu({ dau, luu, huy }: { dau: string; luu: (v: string) => void; huy: () => void }) {
  const [v, setV] = useState(dau);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const t = ref.current; if (t) { t.style.height = '0'; t.style.height = `${t.scrollHeight + 2}px`; } }, [v]);
  useEffect(() => { const t = ref.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, []);
  return <textarea ref={ref} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => luu(v)} onClick={(e) => e.stopPropagation()}
    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); huy(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); luu(v); } }}
    className="block w-full resize-none overflow-hidden bg-[#FFFDF3] p-0 outline outline-2 outline-[#C99A2E]" style={{ font: 'inherit', lineHeight: 'inherit' }} />;
}

// ---------- Dạng thẻ (điện thoại)
function DangThe({ ds, nhomDs, mo }: { ds: Dong[]; nhomDs: NhomA4[]; mo: (id: string) => void }) {
  if (!ds.length) return <Rong>Không có nhiệm vụ.</Rong>;
  let truoc = '';
  return (
    <div className="flex flex-col gap-2.5">
      {ds.map((x) => {
        const g = nhomDs.find((y) => y.id === x.nhom); const dauNhom = x.nhom !== truoc; truoc = x.nhom; const m = MAU_TT[x.tt.loai];
        return (
          <div key={x.n.id} className="contents">
            {dauNhom && <span className="mt-1 text-xs font-bold text-do">{g ? `${g.ky_hieu}. ${g.ten}` : 'Chưa phân nhóm'}</span>}
            <button onClick={() => mo(x.n.id)} className="flex flex-col gap-1.5 rounded-2xl border border-vien bg-white p-3.5 text-left" style={{ borderLeft: `4px solid ${m.vach}` }}>
              <span className="flex items-center gap-2"><b className="mono text-do">{x.stt}</b><span className="flex-1" /><span className="rounded-md px-2 py-0.5 text-[11.5px] font-bold" style={{ color: m.chu, background: m.nen }}>{x.tt.nhan}</span></span>
              <span className="text-[0.875rem] font-semibold leading-snug">{x.n.ten}</span>
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-mo"><span>Hạn: <b className="text-den">{ngayNgan(x.n.han) || '—'}</b></span><span>Chủ trì: {tenNgan(x.n.chu_tri_ten) || '—'}</span><span>Minh chứng: {x.mc.length}</span></span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Khung chi tiết bên phải
function KhungChiTiet({ x, dong, quanTri, nhomDs, tenDv, duocBaoCao, baoCao, sua, doiNhom, diChuyen, duyet, xoa, moTrang }: {
  x: Dong; dong: () => void; quanTri: boolean; nhomDs: NhomA4[]; tenDv: (id: string | null) => string; duocBaoCao: boolean;
  baoCao: () => void; sua: () => void; doiNhom: (g: string) => void; diChuyen: (h: number) => void; duyet: () => void; xoa: () => void; moTrang: () => void;
}) {
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [dong]);
  const { n } = x; const m = MAU_TT[x.tt.loai];
  const hang = (nhan: string, gt: ReactNode) => <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-[#F1EEE7] py-2 text-sm last:border-0"><dt className="text-mo">{nhan}</dt><dd className="m-0 whitespace-pre-wrap">{gt || <i className="text-mo">—</i>}</dd></div>;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/30" onClick={dong} />
      <aside role="dialog" aria-label="Chi tiết nhiệm vụ" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-vien px-4 py-3">
          <h2 className="m-0 flex-1 text-base font-bold">Nhiệm vụ số {x.stt}{n.ma ? <span className="mono ml-2 text-xs text-mo">{n.ma}</span> : null}</h2>
          <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ color: m.chu, background: m.nen }}>{x.tt.nhan}</span>
          <button onClick={dong} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-nen"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <p className="m-0 text-[1.0625rem] font-bold leading-snug">{n.ten}</p>
          {n.trang_thai_giao === 'de_xuat' && <div className="rounded-xl bg-cam-nhat px-3 py-2 text-[0.8125rem] text-cam-dam">Nhiệm vụ đang chờ Trưởng ban duyệt giao. Đơn vị chưa thấy nhiệm vụ này.</div>}
          <dl className="m-0 flex flex-col">
            {hang('Đơn vị chủ trì', n.chu_tri_ten)}
            {hang('Phối hợp', (n.phoi_hop_ids ?? []).map(tenDv).filter(Boolean).join('; '))}
            {x.d.chu_tri_vb && hang('Ghi theo văn bản', x.d.chu_tri_vb)}
            {hang('Chỉ tiêu, sản phẩm', n.san_pham)}
            {hang('Hạn theo văn bản', x.d.han_vb)}
            {hang('Hạn hoàn thành', n.han ? ngayNgan(n.han) : '')}
            {hang('Tiến độ', `${TT_NV[n.trang_thai].nhan} · ${n.phan_tram}%${x.d.tien_do_vb ? `\n${x.d.tien_do_vb}` : ''}`)}
            {hang('Lãnh đạo phụ trách', n.lanh_dao_phu_trach)}
          </dl>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">Kết quả thực hiện</span>
            {x.cn.length ? x.cn.slice(0, 4).map((c, i) => (
              <div key={i} className="flex flex-col gap-0.5 rounded-xl bg-nen px-3 py-2 text-[0.8125rem]">
                <span className="whitespace-pre-wrap leading-snug">{c.noi_dung}</span>
                <span className="text-[11.5px] text-mo">{c.boi_ten ?? ''} · {ngayGioDu(c.luc)}{c.phan_tram != null ? ` · ${c.phan_tram}%` : ''}{c.trang_thai_moi ? ` · ${TT_NV[c.trang_thai_moi].nhan}` : ''}</span>
              </div>
            )) : <span className="text-[0.8125rem] text-mo">Chưa có kết quả.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Minh chứng</span>
            {x.mc.length ? x.mc.map((t, i) => <span key={i} className="flex items-start gap-2 text-[0.8125rem]"><Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mo" />{t}</span>) : <span className="text-[0.8125rem] text-mo">Chưa có minh chứng.</span>}
          </div>
          {quanTri && (
            <div className="flex flex-col gap-2 rounded-xl border border-vien p-3">
              <O nhan="Nhóm trong danh mục">
                <select className={cx(lopO, 'w-full')} value={x.nhom} onChange={(e) => doiNhom(e.target.value)}>
                  {nhomDs.map((g) => <option key={g.id} value={g.id}>{g.ky_hieu}. {g.ten}</option>)}
                </select>
              </O>
              <div className="flex flex-wrap gap-2">
                <Nut icon={<ArrowUp className="h-4 w-4" />} onClick={() => diChuyen(-1)}>Lên</Nut>
                <Nut icon={<ArrowDown className="h-4 w-4" />} onClick={() => diChuyen(1)}>Xuống</Nut>
                <Nut icon={<Pencil className="h-4 w-4" />} onClick={sua}>Sửa nhiệm vụ</Nut>
                {n.trang_thai_giao === 'de_xuat' && <Nut icon={<ShieldCheck className="h-4 w-4" />} onClick={duyet}>Ghi nhận đã duyệt giao</Nut>}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-vien p-3">
          {duocBaoCao && <Nut kieu="chinh" onClick={baoCao}>Báo cáo kết quả</Nut>}
          <Nut icon={<Paperclip className="h-4 w-4" />} onClick={moTrang}>Đính kèm minh chứng</Nut>
          <span className="flex-1" />
          {quanTri && <Nut kieu="nguy" icon={<Trash2 className="h-4 w-4" />} onClick={xoa}>Xoá</Nut>}
        </div>
      </aside>
    </>
  );
}

// ---------- Báo cáo kết quả (ghi vào lịch sử cập nhật của nhiệm vụ)
function HopBaoCao({ n, dong, laChuTri, xong }: { n: NhiemVu | null; dong: () => void; laChuTri: boolean; xong: () => void }) {
  const [noiDung, setNoiDung] = useState('');
  const [p, setP] = useState(0);
  const [tt, setTt] = useState<TrangThaiNv>('dang_thuc_hien');
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { if (n) { setNoiDung(''); setP(n.phan_tram); setTt(n.trang_thai); setLoi(null); } }, [n]);
  if (!n) return null;
  const gui = async () => {
    if (!noiDung.trim()) { setLoi('Nhập kết quả đã thực hiện'); return; }
    setDangChay(true); setLoi(null);
    const { error } = await supabase.from('nhiem_vu_cap_nhat').insert({
      nhiem_vu_id: n.id, noi_dung: noiDung.trim(),
      phan_tram: laChuTri && p !== n.phan_tram ? p : null, trang_thai_moi: laChuTri && tt !== n.trang_thai ? tt : null,
    });
    setDangChay(false);
    if (error) setLoi(loiDe(error)); else xong();
  };
  return (
    <HopThoai mo dong={dong} tieuDe="Báo cáo kết quả thực hiện" rong="max-w-xl">
      <div className="flex flex-col gap-3.5">
        <p className="m-0 text-sm font-semibold leading-snug">{n.ten}</p>
        <O nhan="Kết quả đã thực hiện, vướng mắc (nếu có)"><textarea className={cx(lopO, 'min-h-28 py-2')} value={noiDung} onChange={(e) => setNoiDung(e.target.value)} autoFocus /></O>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <O nhan={`Tỷ lệ hoàn thành: ${p}%`}><input type="range" min={0} max={100} step={5} value={p} className="h-11 accent-[#A4161A]"
            onChange={(e) => { const v = Number(e.target.value); setP(v); if (v === 100) setTt('hoan_thanh'); else if (tt === 'hoan_thanh') setTt('dang_thuc_hien'); }} /></O>
          <O nhan="Tình trạng"><select className={cx(lopO, 'w-full')} value={tt} onChange={(e) => { const v = e.target.value as TrangThaiNv; setTt(v); if (v === 'hoan_thanh') setP(100); }}>
            {(Object.keys(TT_NV) as TrangThaiNv[]).filter((k) => k !== 'tam_dung').map((k) => <option key={k} value={k}>{TT_NV[k].nhan}</option>)}</select></O>
        </div>
        {tt === 'hoan_thanh' && <div className="rounded-xl bg-[#DCFCE7] px-3 py-2 text-[0.8125rem] text-[#166534]">Sau khi gửi, bấm “Đính kèm minh chứng” để tải văn bản PDF đã ký (hoặc ảnh, tệp) làm minh chứng.</div>}
        {loi && <HopLoi loi={loi} />}
        <div className="flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" dangChay={dangChay} onClick={gui}>Gửi kết quả</Nut></div>
      </div>
    </HopThoai>
  );
}

// ---------- Thiết lập bảng
function HopCaiDat({ ch, dong, luu, soNv }: { ch: CauHinhA4; dong: () => void; luu: (c: CauHinhA4) => Promise<void>; soNv: (g: string) => number }) {
  const [g, setG] = useState<CauHinhA4>(() => ({ ...ch, nhom: ch.nhom.length ? ch.nhom : nhomMacDinh() }));
  const [tab, setTab] = useState<'chung' | 'cot' | 'nhom'>('chung');
  const [dangLuu, setDangLuu] = useState(false);
  const dat = <K extends keyof CauHinhA4>(k: K, v: CauHinhA4[K]) => setG((x) => ({ ...x, [k]: v }));
  const doi = <T,>(a: T[], i: number, j: number) => { if (j < 0 || j >= a.length) return a; const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b; };
  const tongHien = g.cot.filter((c) => c.hien).reduce((a, c) => a + c.rong, 0);
  return (
    <HopThoai mo dong={dong} tieuDe="Thiết lập bảng danh mục" rong="max-w-3xl">
      <div className="-mt-1 mb-3 flex gap-1 border-b border-vien">
        {([['chung', 'Chung, khổ giấy'], ['cot', 'Cột bảng'], ['nhom', 'Nhóm nhiệm vụ']] as const).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('h-10 px-3 text-sm', tab === k ? 'border-b-2 border-ink font-bold' : 'text-mo')}>{t}</button>))}
      </div>
      {tab === 'chung' && (
        <div className="flex flex-col gap-3">
          <O nhan="Dòng góc phải (vd: Phụ lục)"><input className={lopO} value={g.dong_goc} onChange={(e) => dat('dong_goc', e.target.value)} /></O>
          <O nhan="Tiêu đề bảng"><input className={lopO} value={g.tieu_de} onChange={(e) => dat('tieu_de', e.target.value)} /></O>
          <O nhan="Dòng phụ — viết {ngay} để tự điền ngày hôm nay"><textarea className={cx(lopO, 'min-h-16 py-2')} value={g.dong_phu} onChange={(e) => dat('dong_phu', e.target.value)} /></O>
          <O nhan="Ghi chú cuối bảng"><textarea className={cx(lopO, 'min-h-24 py-2')} value={g.ghi_chu} onChange={(e) => dat('ghi_chu', e.target.value)} /></O>
          <div className="grid gap-3 sm:grid-cols-3">
            <O nhan="Cảnh báo sắp đến hạn trước (ngày)"><input type="number" min={1} max={60} className={lopO} value={g.canh_bao_ngay} onChange={(e) => dat('canh_bao_ngay', Number(e.target.value) || 7)} /></O>
            <O nhan="Khổ giấy"><select className={lopO} value={g.kho.huong} onChange={(e) => dat('kho', { ...g.kho, huong: e.target.value as 'ngang' | 'doc' })}><option value="ngang">A4 ngang</option><option value="doc">A4 dọc</option></select></O>
            <O nhan="Cỡ chữ trong bảng (pt)"><input type="number" min={7} max={14} step={0.5} className={lopO} value={g.kho.co_chu} onChange={(e) => dat('kho', { ...g.kho, co_chu: Number(e.target.value) || 11 })} /></O>
          </div>
          <O nhan="Lề trên · phải · dưới · trái (mm)">
            <div className="grid grid-cols-4 gap-2">{g.kho.le.map((v, i) => (
              <input key={i} type="number" min={5} max={40} className={lopO} value={v} aria-label={['Lề trên', 'Lề phải', 'Lề dưới', 'Lề trái'][i]}
                onChange={(e) => { const le = [...g.kho.le] as CauHinhA4['kho']['le']; le[i] = Number(e.target.value) || 0; dat('kho', { ...g.kho, le }); }} />))}</div>
          </O>
        </div>
      )}
      {tab === 'cot' && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-xs text-mo">Độ rộng tính theo tỉ lệ để bảng luôn vừa khổ A4. Có thể kéo trực tiếp mép tiêu đề cột trên bảng.</p>
          {g.cot.map((c, i) => (
            <div key={c.khoa} className="grid grid-cols-[minmax(0,1fr)_72px_auto_auto] items-center gap-2">
              <input className={lopO} value={c.nhan} aria-label="Tên cột" onChange={(e) => dat('cot', g.cot.map((x, j) => (j === i ? { ...x, nhan: e.target.value } : x)))} />
              <input type="number" min={1} step={0.5} className={lopO} value={c.rong} aria-label="Độ rộng" title={c.hien ? pt(phanTram(c.rong, tongHien)) : ''}
                onChange={(e) => dat('cot', g.cot.map((x, j) => (j === i ? { ...x, rong: Number(e.target.value) || 1 } : x)))} />
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="h-5 w-5" checked={c.hien}
                onChange={(e) => dat('cot', g.cot.map((x, j) => (j === i ? { ...x, hien: e.target.checked } : x)))} />Hiện</label>
              <span className="flex gap-1"><button className="h-9 w-9 rounded-lg border border-vien" aria-label="Lên" onClick={() => dat('cot', doi(g.cot, i, i - 1))}><ArrowUp className="mx-auto h-4 w-4" /></button>
                <button className="h-9 w-9 rounded-lg border border-vien" aria-label="Xuống" onClick={() => dat('cot', doi(g.cot, i, i + 1))}><ArrowDown className="mx-auto h-4 w-4" /></button></span>
            </div>
          ))}
          <div className="flex gap-2 pt-1"><Nut onClick={() => dat('cot', g.cot.map((c) => ({ ...c, rong: 10 })))}>Chia đều độ rộng</Nut><Nut onClick={() => dat('cot', COT_MAC_DINH)}>Khôi phục mặc định</Nut></div>
        </div>
      )}
      {tab === 'nhom' && (
        <div className="flex flex-col gap-2">
          {g.nhom.map((x, i) => { const so = soNv(x.id); return (
            <div key={x.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2">
              <input className={lopO} value={x.ky_hieu} aria-label="Ký hiệu" onChange={(e) => dat('nhom', g.nhom.map((y, j) => (j === i ? { ...y, ky_hieu: e.target.value } : y)))} />
              <input className={lopO} value={x.ten} aria-label="Tên nhóm" onChange={(e) => dat('nhom', g.nhom.map((y, j) => (j === i ? { ...y, ten: e.target.value } : y)))} />
              <span className="flex gap-1">
                <button className="h-9 w-9 rounded-lg border border-vien" aria-label="Lên" onClick={() => dat('nhom', doi(g.nhom, i, i - 1))}><ArrowUp className="mx-auto h-4 w-4" /></button>
                <button className="h-9 w-9 rounded-lg border border-vien" aria-label="Xuống" onClick={() => dat('nhom', doi(g.nhom, i, i + 1))}><ArrowDown className="mx-auto h-4 w-4" /></button>
                <button className="h-9 rounded-lg border border-nguy/40 px-2 text-xs text-nguy disabled:opacity-40" disabled={so > 0} title={so ? `Còn ${so} nhiệm vụ trong nhóm` : 'Xoá nhóm'}
                  onClick={() => dat('nhom', g.nhom.filter((_, j) => j !== i))}>Xoá</button>
              </span>
            </div>); })}
          <div><Nut icon={<Plus className="h-4 w-4" />} onClick={() => dat('nhom', [...g.nhom, { id: `g${Date.now().toString(36)}`, ky_hieu: 'ABCDEFGHIK'[g.nhom.length] ?? '', ten: 'Nhóm nhiệm vụ mới' }])}>Thêm nhóm</Nut></div>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" dangChay={dangLuu} onClick={async () => { setDangLuu(true); await luu(g); setDangLuu(false); }}>Lưu thiết lập</Nut></div>
    </HopThoai>
  );
}

// ---------- Nhập danh mục từ tệp Word
function HopNhapWord({ dv, ch, daCo, dong, luuCH, xong }: { dv: DonVi[]; ch: CauHinhA4; daCo: NhiemVu[]; dong: () => void; luuCH: (c: CauHinhA4) => Promise<void>; xong: (so: number) => void }) {
  const [kqDoc, setKqDoc] = useState<KetQuaDoc | null>(null);
  const [dongs, setDongs] = useState<(DongNhap & { chon: boolean; chu_tri: string; phoi_hop: string[] })[]>([]);
  const [duyet, setDuyet] = useState(true);
  const [loi, setLoi] = useState<string | null>(null);
  const [tienTrinh, setTienTrinh] = useState<string | null>(null);
  const dvGiao = dv.filter((d) => d.loai !== 'lanh_dao_bcd');
  const coRoi = new Set(daCo.map((n) => khongDau(n.ten)));

  const chonTep = async (f: File | undefined) => {
    if (!f) return; setLoi(null);
    try {
      const k = await docDanhMucWord(f);
      setKqDoc(k);
      setDongs(k.dong.map((d) => { const g = doanDonVi(d.chu_tri_vb, dvGiao); return { ...d, ...g, chon: !coRoi.has(khongDau(d.ten)) }; }));
    } catch (e) { setLoi(loiDe(e)); }
  };
  const nhap = async () => {
    if (!kqDoc) return;
    const ds = dongs.filter((d) => d.chon);
    if (!ds.length) { setLoi('Chưa chọn nhiệm vụ nào'); return; }
    setLoi(null);
    // Nhóm: lấy theo các dòng "A. …", "B. …" của văn bản
    const nhom: NhomA4[] = [...ch.nhom];
    const idNhom = (x: DongNhap['nhom']) => {
      if (!x) return nhom[0]?.id;
      let g = nhom.find((y) => y.ky_hieu === x.ky_hieu && khongDau(y.ten) === khongDau(x.ten));
      if (!g) { g = { id: `g${Date.now().toString(36)}${nhom.length}`, ky_hieu: x.ky_hieu, ten: x.ten }; nhom.push(g); }
      return g.id;
    };
    const dongCH: Record<string, DongA4> = { ...ch.dong };
    let so = 0, thuTu = 0;
    try {
      for (const d of ds) {
        setTienTrinh(`Đang nhập ${so + 1}/${ds.length}…`);
        const tt = trangThaiTuChu(d.tien_do_vb);
        const { data, error } = await supabase.from('nhiem_vu').insert({
          nhom: 'chuong_trinh_cong_tac', linh_vuc: 'chung', ten: d.ten, san_pham: d.san_pham || null, han: d.han || null,
          chu_tri_don_vi_id: d.chu_tri || null, tham_quyen: 'Trưởng Ban Chỉ đạo',
        }).select('id').single();
        if (error) throw error;
        const id = data.id as string;
        const ph = d.phoi_hop.filter((x) => x !== d.chu_tri);
        if (ph.length) { const r = await supabase.from('nhiem_vu_phoi_hop').insert(ph.map((x) => ({ nhiem_vu_id: id, don_vi_id: x }))); if (r.error) throw r.error; }
        const capNhat: Record<string, unknown> = {};
        if (duyet) capNhat.trang_thai_giao = 'da_duyet';
        if (tt !== 'chua_trien_khai') capNhat.trang_thai = tt;
        if (Object.keys(capNhat).length) { const r = await supabase.from('nhiem_vu').update(capNhat).eq('id', id); if (r.error) throw r.error; }
        dongCH[id] = { nhom: idNhom(d.nhom), thu_tu: ++thuTu, han_vb: d.han_vb, chu_tri_vb: d.chu_tri_vb, tien_do_vb: d.tien_do_vb };
        so++;
      }
    } catch (e) { setLoi(`Đã nhập ${so}/${ds.length} nhiệm vụ thì gặp lỗi: ${loiDe(e)}`); }
    await luuCH({ ...ch, nhom, dong: dongCH,
      tieu_de: ch.tieu_de === CAU_HINH_MAC_DINH.tieu_de && kqDoc.tieu_de ? kqDoc.tieu_de : ch.tieu_de,
      dong_phu: ch.dong_phu === CAU_HINH_MAC_DINH.dong_phu && kqDoc.dong_phu ? kqDoc.dong_phu.replace(/ngày \d{1,2}\/\d{1,2}\/\d{4}/, 'ngày {ngay}') : ch.dong_phu,
      ghi_chu: ch.ghi_chu || kqDoc.ghi_chu });
    setTienTrinh(null);
    if (so === ds.length) xong(so);
  };

  return (
    <HopThoai mo dong={dong} tieuDe="Nhập danh mục nhiệm vụ từ tệp Word" rong="max-w-5xl">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-mo-2">Chọn tệp .docx có bảng danh mục (cột Nội dung nhiệm vụ, Cơ quan chủ trì / phối hợp, Chỉ tiêu, Thời hạn, Tiến độ). Web tự đọc, đoán đơn vị chủ trì; kiểm tra lại trước khi nhập.</p>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-vien-2 bg-nen-2 px-4 text-sm font-semibold hover:bg-nen">
          <FileUp className="h-4 w-4" />{kqDoc ? 'Chọn tệp khác' : 'Chọn tệp Word (.docx)'}
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => void chonTep(e.target.files?.[0])} />
        </label>
        {kqDoc && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <b>{dongs.length} nhiệm vụ</b><span className="text-mo">· chọn {dongs.filter((d) => d.chon).length}</span>
              {dongs.some((d) => !d.chu_tri) && <span className="text-cam-dam">· {dongs.filter((d) => !d.chu_tri).length} dòng chưa xác định đơn vị chủ trì</span>}
              <span className="flex-1" />
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={duyet} onChange={(e) => setDuyet(e.target.checked)} />Ghi nhận Trưởng ban đã duyệt giao (đơn vị thấy ngay)</label>
            </div>
            <div className="max-h-[52vh] overflow-auto rounded-xl border border-vien">
              <table className="w-full border-collapse text-[0.8125rem]">
                <thead className="sticky top-0 bg-nen-2 text-left text-[11px] text-mo"><tr>
                  <th className="p-2"><input type="checkbox" className="h-4 w-4" checked={dongs.every((d) => d.chon)} onChange={(e) => setDongs(dongs.map((d) => ({ ...d, chon: e.target.checked })))} aria-label="Chọn tất cả" /></th>
                  <th className="p-2">TT</th><th className="p-2">Nội dung</th><th className="p-2">Ghi trong văn bản</th><th className="p-2">Đơn vị chủ trì (giao trên web)</th><th className="p-2">Hạn</th></tr></thead>
                <tbody>{dongs.map((d, i) => (
                  <tr key={i} className={cx('border-t border-[#F1EEE7] align-top', !d.chon && 'opacity-50')}>
                    <td className="p-2"><input type="checkbox" className="h-4 w-4" checked={d.chon} onChange={(e) => setDongs(dongs.map((x, j) => (j === i ? { ...x, chon: e.target.checked } : x)))} aria-label={`Chọn dòng ${d.stt}`} /></td>
                    <td className="mono p-2">{d.nhom?.ky_hieu}{d.stt}</td>
                    <td className="p-2"><span className="line-clamp-3">{d.ten}</span>{coRoi.has(khongDau(d.ten)) && <span className="text-xs text-cam-dam">Đã có trong danh mục</span>}</td>
                    <td className="p-2 text-mo-2"><span className="line-clamp-3">{d.chu_tri_vb}</span></td>
                    <td className="p-2"><select className={cx(lopO, 'min-h-9 w-full text-[0.8125rem]', !d.chu_tri && 'border-cam')} value={d.chu_tri}
                      onChange={(e) => setDongs(dongs.map((x, j) => (j === i ? { ...x, chu_tri: e.target.value } : x)))} aria-label="Đơn vị chủ trì">
                      <option value="">— Chọn —</option>{dvGiao.map((v) => <option key={v.id} value={v.id}>{v.ten}</option>)}</select>
                      {d.phoi_hop.length > 0 && <span className="mt-0.5 block text-[11px] text-mo">Phối hợp: {d.phoi_hop.map((x) => tenNgan(dv.find((v) => v.id === x)?.ten)).join('; ')}</span>}</td>
                    <td className="p-2"><input type="date" className={cx(lopO, 'min-h-9 text-[0.8125rem]')} value={d.han} onChange={(e) => setDongs(dongs.map((x, j) => (j === i ? { ...x, han: e.target.value } : x)))} aria-label="Hạn hoàn thành" /></td>
                  </tr>))}</tbody>
              </table>
            </div>
          </>
        )}
        {loi && <HopLoi loi={loi} />}
        <div className="flex items-center justify-end gap-2">{tienTrinh && <span className="text-sm text-mo">{tienTrinh}</span>}
          <Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" disabled={!kqDoc} dangChay={!!tienTrinh} onClick={() => void nhap()}>Nhập vào danh mục</Nut></div>
      </div>
    </HopThoai>
  );
}

// ---------- Xuất tệp
function oChu(c: KhoaCot, x: Dong): string {
  switch (c) {
    case 'tt': return String(x.stt);
    case 'ten': return x.n.ten;
    case 'chu_tri': return x.d.chu_tri_vb || chuTriMacDinh(x);
    case 'san_pham': return x.n.san_pham ?? '';
    case 'han_vb': return x.d.han_vb ?? '';
    case 'han': return ngayNgan(x.n.han);
    case 'tien_do': return `${TT_NV[x.n.trang_thai].nhan} (${x.n.phan_tram}%)${x.d.tien_do_vb ? `\n${x.d.tien_do_vb}` : ''}`;
    case 'ket_qua': return x.cn[0] ? `${x.cn[0].noi_dung}\n(${x.cn[0].boi_ten ?? ''}, ${ngayGioDu(x.cn[0].luc)})` : '';
    case 'minh_chung': return x.mc.join('\n');
    case 'tinh_trang': return x.tt.nhan;
    case 'lanh_dao': return x.n.lanh_dao_phu_trach ?? '';
    case 'ma': return x.n.ma ?? '';
  }
}
function nhomTheoThuTu(ch: CauHinhA4, ds: Dong[]) {
  const g = ch.nhom.length ? ch.nhom : nhomMacDinh();
  return [...g, { id: '_khac', ky_hieu: '', ten: 'Chưa phân nhóm' }].map((x) => [x, ds.filter((y) => y.nhom === x.id)] as const).filter(([, v]) => v.length);
}
async function xuatWord(ch: CauHinhA4, ds: Dong[]) {
  const D = await import('docx');
  const { AlignmentType, Document, Header, Packer, PageNumber, PageOrientation, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType, BorderStyle } = D;
  const cot = ch.cot.filter((c) => c.hien); const tong = cot.reduce((a, c) => a + c.rong, 0);
  const tw = (mm: number) => Math.round(mm * 56.6929);
  const kt = kichThuocTrang(ch); const [mt, mr, mb, ml] = ch.kho.le;
  const rongNd = tw(kt.rong - ml - mr); const rong = cot.map((c) => Math.round((rongNd * c.rong) / tong));
  const sz = Math.round(ch.kho.co_chu * 2);
  const vien = { style: BorderStyle.SINGLE, size: 4, color: '000000' }; const borders = { top: vien, bottom: vien, left: vien, right: vien };
  const doan = (t: string, o: { dam?: boolean; nghieng?: boolean; can?: (typeof AlignmentType)[keyof typeof AlignmentType]; co?: number } = {}) =>
    (t || '').split('\n').map((dong) => new Paragraph({ alignment: o.can ?? AlignmentType.LEFT, widowControl: false, keepNext: false, keepLines: false, spacing: { before: 0, after: 0, line: 240 },
      children: [new TextRun({ text: dong, bold: o.dam, italics: o.nghieng, font: 'Times New Roman', size: o.co ?? sz })] }));
  const o = (t: string, w: number, o2: Parameters<typeof doan>[1] & { gop?: number } = {}) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, columnSpan: o2.gop,
    verticalAlign: VerticalAlign.TOP, margins: { top: 40, bottom: 40, left: 70, right: 70 }, children: doan(t, o2) });
  const giua = ['tt', 'han', 'han_vb', 'tinh_trang'];
  const hang: InstanceType<typeof TableRow>[] = [new TableRow({ tableHeader: true, children: cot.map((c, i) => o(c.nhan, rong[i], { dam: true, can: AlignmentType.CENTER })) })];
  for (const [g, arr] of nhomTheoThuTu(ch, ds)) {
    hang.push(new TableRow({ children: [o(`${g.ky_hieu ? `${g.ky_hieu}. ` : ''}${g.ten}`, rongNd, { dam: true, gop: cot.length })] }));
    for (const x of arr) hang.push(new TableRow({ children: cot.map((c, i) => o(oChu(c.khoa, x), rong[i], { can: giua.includes(c.khoa) ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, dam: c.khoa === 'han' })) }));
  }
  const phu = ch.dong_phu.replace(/\{ngay\}/g, ngayNgan(homNayVN()));
  const con = [
    ...(ch.dong_goc ? doan(ch.dong_goc, { dam: true, nghieng: true, can: AlignmentType.RIGHT, co: 28 }) : []),
    ...doan(ch.tieu_de, { dam: true, can: AlignmentType.CENTER, co: 28 }),
    ...(phu ? doan(phu, { nghieng: true, can: AlignmentType.CENTER, co: 26 }) : []),
    new Paragraph({ children: [] }),
    new Table({ width: { size: rongNd, type: WidthType.DXA }, columnWidths: rong, layout: TableLayoutType.FIXED, rows: hang }),
    ...(ch.ghi_chu ? [new Paragraph({ children: [] }), ...doan(ch.ghi_chu, { nghieng: true, can: AlignmentType.JUSTIFIED, co: Math.max(18, sz - 2) })] : []),
  ];
  const doc = new Document({ styles: { default: { document: { run: { font: 'Times New Roman', size: sz } } } }, sections: [{
    properties: { titlePage: true, page: { size: { width: 11906, height: 16838, orientation: ch.kho.huong === 'doc' ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE },
      margin: { top: tw(mt), right: tw(mr), bottom: tw(mb), left: tw(ml), header: tw(8) } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 26 })] })] }),
      first: new Header({ children: [new Paragraph({ children: [] })] }) },
    children: con }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `danh-muc-nhiem-vu-${homNayVN()}.docx`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function xuatExcel(ch: CauHinhA4, ds: Dong[], phamVi: Dong[], dv: DonVi[]) {
  const XLSX = await import('xlsx');
  const cot = ch.cot.filter((c) => c.hien); const tong = cot.reduce((a, c) => a + c.rong, 0);
  const aoa: (string | number)[][] = [[ch.tieu_de], [ch.dong_phu.replace(/\{ngay\}/g, ngayNgan(homNayVN()))], [], cot.map((c) => c.nhan)];
  const gop = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cot.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: cot.length - 1 } }];
  for (const [g, arr] of nhomTheoThuTu(ch, ds)) {
    gop.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: cot.length - 1 } }); aoa.push([`${g.ky_hieu ? `${g.ky_hieu}. ` : ''}${g.ten}`]);
    for (const x of arr) aoa.push(cot.map((c) => (c.khoa === 'tt' ? x.stt : oChu(c.khoa, x))));
  }
  const giao = phamVi.filter((x) => x.n.trang_thai_giao === 'da_duyet');
  aoa.push([], ['Tỉ lệ theo đơn vị chủ trì'], ['Đơn vị', 'Được giao', 'Tỉ trọng (%)', 'Hoàn thành', 'Đúng hạn', 'Quá hạn', 'Tỉ lệ hoàn thành (%)']);
  for (const d of dv) {
    const a = giao.filter((x) => x.n.chu_tri_don_vi_id === d.id); if (!a.length) continue;
    const x = a.filter((y) => y.tt.loai === 'xong');
    aoa.push([d.ten, a.length, phanTram(a.length, giao.length), x.length, x.filter((y) => !y.tt.tre).length, a.filter((y) => y.tt.loai === 'qua_han').length, phanTram(x.length, a.length)]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!merges'] = gop; ws['!cols'] = cot.map((c) => ({ wch: Math.max(6, Math.round((c.rong / tong) * 170)) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Danh mục');
  XLSX.writeFile(wb, `danh-muc-nhiem-vu-${homNayVN()}.xlsx`);
}
