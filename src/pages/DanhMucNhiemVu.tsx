// Danh mục nhiệm vụ dạng bảng A4 động: theo dõi, giao đơn vị chủ trì, đơn vị nhập kết quả và minh chứng,
// cảnh báo quá hạn, tỉ lệ hoàn thành theo đơn vị. Đơn vị chỉ thấy nhiệm vụ mình được giao chủ trì.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PE, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, FileUp, GripVertical, Maximize2, Minus, Paperclip, Pencil, Plus, Search, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { laQuanTri, useAuth } from '../lib/auth';
import { homNayVN, ngayGioDu } from '../lib/dinhDang';
import { COT_NV, khongDau, NHOM_NV, tenKyNv, thieu6Ro, TT_NV, type NhiemVu, type NhomNv, type TrangThaiNv } from '../lib/nhiemVu';
import {
  CAU_HINH_MAC_DINH, COT_MAC_DINH, doanDonVi, docDanhMucWord, ghepCauHinh, KHOA_CAU_HINH, kichThuocTrang, MAU_TT, ngayNgan, soNgay, tinhTrang, docSo, goiYDanhGia, soVN, tinhDanhGia, type DanhGia, type KieuDG, trangThaiTuChu,
  type CauHinhA4, type CotA4, type DongA4, type DongNhap, type KetQuaDoc, type KhoaCot, type LoaiTT, type NhomA4, type TinhTrang,
} from '../lib/danhMucA4';
import { moTepDrive } from '../components/TepDrive';
import FormVanBan from '../components/FormVanBan';
import { DangTai, HopLoi, HopThoai, lopO, Nut, O, TieuDeTrang, cx } from '../components/ui';
import FormNhiemVu, { tuNhiemVu } from '../components/FormNhiemVu';

const MM = 96 / 25.4;
const FONT_A4 = "'Times New Roman', Tinos, 'Liberation Serif', serif";
type DonVi = { id: string; ten: string; loai: string | null };
type CapNhat = { nhiem_vu_id: string; noi_dung: string; phan_tram: number | null; trang_thai_moi: TrangThaiNv | null; luc: string; boi_ten: string | null };
type VbCanCu = { id: string; so_ky_hieu: string | null; trich_yeu: string; drive_url: string | null; ten_tep: string | null };
type Dong = { n: NhiemVu; tt: TinhTrang; stt: number; so: string; nhom: string; cn: CapNhat[]; mc: string[]; d: DongA4; vb: VbCanCu | null };
const tenVb = (v: VbCanCu) => [v.so_ky_hieu, v.trich_yeu].filter(Boolean).join(' – ');
type LocTT = 'tat_ca' | 'qua_han' | 'sap_han' | 'chua_xong' | 'xong' | 'cho_duyet';
type Rieng = { cot?: Record<string, number>; cao?: Record<string, number>; zoom?: number | 'vua' };

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
    const [a, b, c, d, e, f, g] = await Promise.all([
      supabase.from('v_nhiem_vu').select(COT_NV).order('han', { ascending: true, nullsFirst: false }),
      supabase.from('don_vi').select('id, ten, loai').eq('hoat_dong', true).order('thu_tu'),
      supabase.from('v_nhiem_vu_cap_nhat').select('nhiem_vu_id, noi_dung, phan_tram, trang_thai_moi, luc, boi_ten').order('luc', { ascending: false }).limit(5000),
      supabase.from('v_minh_chung_nhiem_vu').select('nhiem_vu_id, so_ky_hieu, trich_yeu, ten_tep'),
      supabase.from('tep').select('nhiem_vu_id, ten').not('nhiem_vu_id', 'is', null),
      supabase.from('cau_hinh').select('gia_tri').eq('khoa', KHOA_CAU_HINH).maybeSingle(),
      supabase.from('van_ban').select('id, so_ky_hieu, trich_yeu, drive_url, ten_tep').neq('trang_thai', 'du_thao').order('ngay_ban_hanh', { ascending: false, nullsFirst: false }).limit(1000),
    ]);
    const cn = new Map<string, CapNhat[]>();
    for (const x of (c.data ?? []) as CapNhat[]) { if (!cn.has(x.nhiem_vu_id)) cn.set(x.nhiem_vu_id, []); cn.get(x.nhiem_vu_id)!.push(x); }
    const mc = new Map<string, string[]>();
    const them = (id: string, ten: string) => { if (!mc.has(id)) mc.set(id, []); mc.get(id)!.push(ten); };
    for (const x of (d.data ?? []) as { nhiem_vu_id: string; so_ky_hieu: string | null; trich_yeu: string; ten_tep: string | null }[]) them(x.nhiem_vu_id, x.so_ky_hieu ? `${x.so_ky_hieu} – ${x.trich_yeu}` : x.ten_tep ?? x.trich_yeu);
    for (const x of (e.data ?? []) as { nhiem_vu_id: string; ten: string }[]) them(x.nhiem_vu_id, x.ten);
    return {
      nv: (kq(a) ?? []) as unknown as NhiemVu[], dv: (kq(b) ?? []) as DonVi[], cn, mc, vb: (g.data ?? []) as VbCanCu[],
      ch: ghepCauHinh((f.data as { gia_tri?: Partial<CauHinhA4> } | null)?.gia_tri),
    };
  }, []);

  const [rieng, setRiengS] = useState<Rieng>(docRieng);
  const setRieng = (r: Rieng) => { setRiengS(r); ghiRieng(r); };
  // Liên kết từ Tổng quan: ?tab=qua_han|cho_duyet|hoan_thanh, ?q=từ khoá
  const [thamSo] = useSearchParams();
  const [tim, setTim] = useState(() => thamSo.get('q') ?? '');
  const [locTT, setLocTT] = useState<LocTT>(() => ({ qua_han: 'qua_han', cho_duyet: 'cho_duyet', hoan_thanh: 'xong', dang: 'chua_xong', chua: 'chua_xong' } as Record<string, LocTT>)[thamSo.get('tab') ?? ''] ?? 'tat_ca');
  const [locDv, setLocDv] = useState('');
  const [xemNhu, setXemNhu] = useState('');
  const [chon, setChon] = useState<string | null>(null);
  const [moCaiDat, setMoCaiDat] = useState(false);
  const [moNhap, setMoNhap] = useState(false);
  const [moThem, setMoThem] = useState(false);
  const [moTk, setMoTk] = useState(false);
  const [sua, setSua] = useState<NhiemVu | null>(null);
  const [thongBao, setThongBao] = useState<{ loi?: string; ok?: string } | null>(null);

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
      const vb = n.can_cu_van_ban_id ? data.vb.find((v) => v.id === n.can_cu_van_ban_id) ?? { id: n.can_cu_van_ban_id, so_ky_hieu: n.can_cu_so_ky_hieu, trich_yeu: '', drive_url: null, ten_tep: null } : null;
      return { n, tt: tinhTrang(n, ch.canh_bao_ngay, xongLuc), stt: 0, so: '', nhom: nhomCua(n), cn, mc: data.mc.get(n.id) ?? [], d: ch.dong[n.id] ?? {}, vb };
    });
    ds.sort((a, b) => ((thuTuNhom.get(a.nhom) ?? 99) - (thuTuNhom.get(b.nhom) ?? 99))
      || ((a.d.thu_tu ?? 1e6) - (b.d.thu_tu ?? 1e6)) || a.n.tao_luc.localeCompare(b.n.tao_luc) || (a.n.ma ?? '').localeCompare(b.n.ma ?? '', 'vi', { numeric: true }));
    ds.forEach((x, i) => { x.stt = i + 1; x.so = String(i + 1); });
    // Giữ số thứ tự theo văn bản gốc khi mã có dạng "QIV-15.1" và các số tăng dần trong nhóm (vd: 1…14, 15.1…15.10, 16, 17)
    const theoNhom = new Map<string, Dong[]>(); ds.forEach((x) => { if (!theoNhom.has(x.nhom)) theoNhom.set(x.nhom, []); theoNhom.get(x.nhom)!.push(x); });
    for (const arr of theoNhom.values()) {
      const so = arr.map((x) => x.n.ma?.match(/-(\d+(?:\.\d+)*)$/)?.[1] ?? null);
      const tang = so.every((v, i) => v && (i === 0 || so[i - 1]!.localeCompare(v, 'vi', { numeric: true }) < 0));
      if (tang) arr.forEach((x, i) => { x.so = so[i]!.split('.').map(Number).join('.'); });
    }
    return ds;
  }, [data, ch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phạm vi xem: đơn vị chỉ thấy nhiệm vụ mình chủ trì (đã duyệt giao); Thường trực có thể "xem như" một đơn vị
  const dvXem = donVi ? hoSo?.don_vi_id ?? '__' : xemNhu;
  const phamVi = tatCa.filter((x) => !dvXem || (x.n.chu_tri_don_vi_id === dvXem && x.n.trang_thai_giao === 'da_duyet'));
  const hien = phamVi.filter((x) => {
    if (!dvXem && locDv && x.n.chu_tri_don_vi_id !== locDv) return false;
    const k = x.tt.loai;
    if (locTT === 'cho_duyet' && x.n.trang_thai_giao !== 'de_xuat') return false;
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
  const dongChon = tatCa.find((x) => x.n.id === chon) ?? null;
  const tenDv = (id: string | null) => data.dv.find((d) => d.id === id)?.ten ?? '';

  const capNhatNv = async (id: string, p: Partial<NhiemVu>) => {
    const { error } = await supabase.from('nhiem_vu').update(p).eq('id', id);
    if (error) { setThongBao({ loi: loiDe(error) }); return false; }
    void taiLai(); return true;
  };

  return (
    <>
      <TieuDeTrang tren={donVi ? hoSo?.don_vi?.ten : 'Danh mục nhiệm vụ · bảng A4'}
        ten={donVi ? 'Nhiệm vụ' : 'Nhiệm vụ Ban Chỉ đạo'}
        phai={<>
          <Nut icon={<Download className="h-4 w-4" />} onClick={() => void xuatWord(ch, hien).catch((e) => setThongBao({ loi: loiDe(e) }))} ngan="Word">Xuất Word</Nut>
          <Nut icon={<Download className="h-4 w-4" />} onClick={() => void xuatExcel(ch, hien, phamVi, data.dv)} ngan="Excel">Xuất Excel</Nut>
          {suaDuocBang && <Nut icon={<FileUp className="h-4 w-4" />} onClick={() => setMoNhap(true)} ngan="Nhập">Nhập từ Word</Nut>}
          {suaDuocBang && <Nut icon={<Settings2 className="h-4 w-4" />} onClick={() => setMoCaiDat(true)} ngan="Thiết lập">Thiết lập bảng</Nut>}
          {suaDuocBang && <Nut kieu="chinh" icon={<Plus className="h-4 w-4" />} onClick={() => setMoThem(true)} ngan="Thêm">Thêm nhiệm vụ</Nut>}
        </>} />
      {thongBao && <div className={cx('flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm', thongBao.loi ? 'bg-nguy-nhat text-nguy' : 'bg-[#DCFCE7] text-[#166534]')}>
        <span className="flex-1">{thongBao.loi ?? thongBao.ok}</span><button aria-label="Đóng" onClick={() => setThongBao(null)}><X className="h-4 w-4" /></button></div>}

      {/* Thanh lọc gọn: tình trạng (đếm) + tìm, đơn vị, xem như, thu phóng */}
      <ThanhLoc ds={phamVi} loc={locTT} datLoc={setLocTT} choDuyet={donVi ? null : phamVi.filter((x) => x.n.trang_thai_giao === 'de_xuat').length}
        moTk={moTk} datMoTk={setMoTk} soHien={hien.length}
        congCu={<>
          <label className="relative min-w-[200px] flex-1 sm:max-w-[340px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-mo" />
            <input className="h-9 w-full rounded-lg border border-vien bg-nen-2 pl-8 pr-2 text-[0.8125rem] outline-none focus:border-xanh focus:bg-white" placeholder="Tìm nội dung, đơn vị, kết quả" value={tim} onChange={(e) => setTim(e.target.value)} aria-label="Tìm nhiệm vụ" />
          </label>
          {!donVi && !xemNhu && (
            <select className="h-9 max-w-[220px] rounded-lg border border-vien bg-nen-2 px-2 text-[0.8125rem]" value={locDv} onChange={(e) => setLocDv(e.target.value)} aria-label="Lọc theo đơn vị chủ trì">
              <option value="">Mọi đơn vị chủ trì</option>{data.dv.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}
            </select>
          )}
          {quanTri && (
            <select className="h-9 max-w-[220px] rounded-lg border border-vien bg-nen-2 px-2 text-[0.8125rem]" value={xemNhu} onChange={(e) => { setXemNhu(e.target.value); setLocDv(''); }} aria-label="Xem như đơn vị">
              <option value="">Xem: toàn bộ</option>{data.dv.map((d) => <option key={d.id} value={d.id}>Xem như: {tenNgan(d.ten)}</option>)}
            </select>
          )}
          {(tim || locDv || locTT !== 'tat_ca') && <button className="h-9 rounded-lg px-2 text-[0.8125rem] font-semibold text-[#8E1B22] hover:bg-do/5" onClick={() => { setTim(''); setLocDv(''); setLocTT('tat_ca'); }}>Bỏ lọc</button>}
          <span className="flex-1" />
          <Zoom z={rieng.zoom ?? 'vua'} dat={(z) => setRieng({ ...rieng, zoom: z })} />
        </>} />
      {moTk && <ThongKe ds={phamVi} tatCa={tatCa} dv={data.dv} dvXem={dvXem} quanTri={!donVi} loc={setLocTT} chonDv={(id) => { setLocDv(id); }} />}

      {/* Bảng A4 + khung chi tiết bên phải (đứng cạnh bảng, không che) */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <BangA4 ch={ch} ds={hien} nhomDs={nhomDs} rieng={rieng} setRieng={setRieng} suaDuoc={suaDuocBang} chon={chon}
            mo={(id) => setChon((c) => (c === id ? null : id))} luuCH={luuCH} suaDong={suaDong} capNhatNv={capNhatNv}
            keoTha={(idKeo, dich) => {
              // Kéo thả: đặt nhiệm vụ trước/sau hàng đích (đổi nhóm nếu thả sang nhóm khác)
              const keo = tatCa.find((x) => x.n.id === idKeo); if (!keo) return;
              const nhomDich = dich.nhom ?? tatCa.find((x) => x.n.id === dich.id)?.nhom; if (!nhomDich) return;
              const cung = tatCa.filter((x) => x.nhom === nhomDich && x.n.id !== idKeo);
              let vi = dich.id ? cung.findIndex((x) => x.n.id === dich.id) : 0;
              if (vi < 0) vi = cung.length; else if (dich.id && !dich.truoc) vi += 1;
              cung.splice(vi, 0, keo);
              const dong = { ...ch.dong };
              cung.forEach((x, k) => { dong[x.n.id] = { ...dong[x.n.id], thu_tu: k + 1, ...(x.n.id === idKeo ? { nhom: nhomDich } : {}) }; });
              void luuCH({ ...ch, dong });
            }}
            rong={phamVi.length > 0} />
        </div>
        {dongChon && (
          <KhungChiTiet key={dongChon.n.id} x={dongChon} ds={hien} chon={setChon} dong={() => setChon(null)} quanTri={suaDuocBang} tenDv={tenDv}
            duocBaoCao={dongChon.n.trang_thai_giao === 'da_duyet' && (quanTri || dongChon.n.chu_tri_don_vi_id === hoSo?.don_vi_id)}
            laChuTri={quanTri || dongChon.n.chu_tri_don_vi_id === hoSo?.don_vi_id}
            daGui={() => { setThongBao({ ok: 'Đã cập nhật kết quả thực hiện.' }); void taiLai(); }}
            sua={() => setSua(dongChon.n)}
            dsVb={data.vb} ganVb={(id) => void capNhatNv(dongChon.n.id, { can_cu_van_ban_id: id })} luuTenNguon={(t) => suaDong(dongChon.n.id, { nguon_vb: t })} luuDong={(pp) => suaDong(dongChon.n.id, pp)}
            duyet={() => void capNhatNv(dongChon.n.id, { trang_thai_giao: 'da_duyet' })}
            xoa={async () => {
              if (!window.confirm(`Xoá nhiệm vụ "${dongChon.n.ten}" cùng toàn bộ lịch sử cập nhật?`)) return;
              const { error } = await supabase.from('nhiem_vu').delete().eq('id', dongChon.n.id);
              if (error) { setThongBao({ loi: loiDe(error) }); return; }
              setChon(null); void taiLai();
            }}
            moTrang={() => nav(`/nhiem-vu/${dongChon.n.id}#tep`)} />
        )}
      </div>

      {suaDuocBang && <FormNhiemVu mo={moThem} dong={() => setMoThem(false)} xong={(id) => { setMoThem(false); setChon(id); void taiLai(); }} />}
      {sua && <FormNhiemVu mo dong={() => setSua(null)} id={sua.id} dau={tuNhiemVu(sua)} xong={() => { setSua(null); void taiLai(); }} />}
      {moCaiDat && <HopCaiDat ch={ch} dong={() => setMoCaiDat(false)} luu={async (c) => { await luuCH(c); setMoCaiDat(false); }} soNv={(g) => tatCa.filter((x) => x.nhom === g).length} />}
      {moNhap && <HopNhapWord dv={data.dv} ch={ch} daCo={data.nv} dong={() => setMoNhap(false)} luuCH={luuCH}
        xong={(so) => { setMoNhap(false); setThongBao({ ok: `Đã nhập ${so} nhiệm vụ vào danh mục.` }); void taiLai(); }} />}
    </>
  );
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
    <div className="flex h-9 items-center gap-0.5 rounded-lg border border-vien bg-nen-2 px-0.5">
      <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white" aria-label="Thu nhỏ" onClick={() => dat(Math.max(0.3, Math.round((so - 0.1) * 10) / 10))}><Minus className="h-4 w-4" /></button>
      <span className="mono w-11 text-center text-xs">{typeof z === 'number' ? Math.round(z * 100) : hien}%</span>
      <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white" aria-label="Phóng to" onClick={() => dat(Math.min(2, Math.round((so + 0.1) * 10) / 10))}><Plus className="h-4 w-4" /></button>
      <button className={cx('h-8 rounded-md px-2 text-xs font-semibold hover:bg-white', z === 'vua' && 'text-do')} onClick={() => dat('vua')}>Vừa khung</button>
    </div>
  );
}

// ---------- Bảng A4
type BangProps = {
  ch: CauHinhA4; ds: Dong[]; nhomDs: NhomA4[]; rieng: Rieng; setRieng: (r: Rieng) => void; suaDuoc: boolean; chon: string | null; rong: boolean;
  mo: (id: string) => void; luuCH: (c: CauHinhA4) => Promise<void>; suaDong: (id: string, p: Partial<DongA4>) => void;
  capNhatNv: (id: string, p: Partial<NhiemVu>) => Promise<boolean>;
  keoTha: (id: string, dich: { id?: string; nhom?: string; truoc: boolean }) => void;
};
const O_SUA: Partial<Record<KhoaCot, 'nv' | 'dong'>> = { ten: 'nv', san_pham: 'nv', han: 'nv', lanh_dao: 'nv', ma: 'nv', nguon_vb: 'dong', chu_tri: 'dong', tien_do: 'dong' };

function BangA4({ ch, ds, nhomDs, rieng, setRieng, suaDuoc, chon, mo, luuCH, suaDong, capNhatNv, keoTha, rong: coDuLieu }: BangProps) {
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

  // Kéo thả hàng: giữ biểu tượng ở ô TT, kéo tới hàng khác (hoặc tiêu đề nhóm) rồi thả
  const [keo, setKeo] = useState<{ id: string; dich?: { id?: string; nhom?: string; truoc: boolean } } | null>(null);
  const vuaKeo = useRef(false);
  const batDauKeo = (e: PE, x: Dong) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); window.clearTimeout(hen.current);
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const y0 = e.clientY; let dich: { id?: string; nhom?: string; truoc: boolean } | undefined; let dangKeo = false;
    const mv = (ev: PointerEvent) => {
      if (!dangKeo && Math.abs(ev.clientY - y0) < 5) return;
      dangKeo = true;
      const tr = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('tr') as HTMLTableRowElement | null;
      if (tr?.dataset.id && tr.dataset.id !== x.n.id) { const r = tr.getBoundingClientRect(); dich = { id: tr.dataset.id, truoc: ev.clientY < r.top + r.height / 2 }; }
      else if (tr?.dataset.nhom) dich = { nhom: tr.dataset.nhom, truoc: true };
      else if (!tr || tr.dataset.id === x.n.id) dich = undefined;
      setKeo({ id: x.n.id, dich });
    };
    const up = () => {
      el.removeEventListener('pointermove', mv);
      if (dangKeo) { vuaKeo.current = true; window.setTimeout(() => { vuaKeo.current = false; }, 50); if (dich) keoTha(x.n.id, dich); }
      setKeo(null);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up, { once: true }); el.addEventListener('pointercancel', up, { once: true });
  };

  const bam = (id: string) => { window.clearTimeout(hen.current); hen.current = window.setTimeout(() => mo(id), 230); };
  const giaTriSua = (x: Dong, k: KhoaCot): string =>
    k === 'ten' ? x.n.ten : k === 'san_pham' ? x.n.san_pham ?? '' : k === 'han' ? x.n.han ?? '' : k === 'lanh_dao' ? x.n.lanh_dao_phu_trach ?? '' : k === 'ma' ? x.n.ma ?? ''
      : k === 'chu_tri' ? x.d.chu_tri_vb ?? chuTriMacDinh(x) : k === 'nguon_vb' ? x.d.nguon_vb ?? '' : x.d.tien_do_vb ?? '';
  const luuO = async (x: Dong, k: KhoaCot, v: string) => {
    setDangSua(null);
    if (v === giaTriSua(x, k)) return;
    if (O_SUA[k] === 'nv') {
      if (k === 'ten' && !v.trim()) return;
      await capNhatNv(x.n.id, k === 'ten' ? { ten: v.trim() } : k === 'han' ? { han: v || null } : k === 'lanh_dao' ? { lanh_dao_phu_trach: v.trim() || null } : k === 'ma' ? { ma: v.trim() || null } : { san_pham: v.trim() || null });
    }
    else suaDong(x.n.id, k === 'chu_tri' ? { chu_tri_vb: v } : k === 'nguon_vb' ? { nguon_vb: v } : { tien_do_vb: v });
  };

  const o = (x: Dong, c: CotA4): ReactNode => {
    const khoa = `${x.n.id}:${c.khoa}`;
    if (dangSua === khoa) return c.khoa === 'han'
      ? <input type="date" autoFocus defaultValue={giaTriSua(x, c.khoa)} onClick={(e) => e.stopPropagation()} onBlur={(e) => void luuO(x, c.khoa, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setDangSua(null); }}
          className="w-full bg-[#FFFDF3] p-0 text-center outline outline-2 outline-[#C99A2E]" style={{ font: 'inherit' }} />
      : <OSuaChu dau={giaTriSua(x, c.khoa)} luu={(v) => void luuO(x, c.khoa, v)} huy={() => setDangSua(null)} />;
    switch (c.khoa) {
      case 'tt': return <>{suaDuoc
        ? <span onPointerDown={(e) => batDauKeo(e, x)} title="Kéo để đưa nhiệm vụ lên, xuống" className="inline-flex cursor-grab touch-none select-none items-center gap-0.5 active:cursor-grabbing"><GripVertical className="-ml-1 h-[1em] w-[1em] text-[#B9A9AC]" />{x.so}</span>
        : x.so}<div title="Kéo để đổi chiều cao hàng, bấm đúp để trả về tự động" onPointerDown={(e) => keoDong(e, x)} onDoubleClick={(e) => { e.stopPropagation(); veLaiCao(x); }}
        className="absolute -bottom-1 left-0 z-10 h-2 w-[4000px] cursor-row-resize hover:bg-do/20" /></>;
      case 'ten': return <span className="whitespace-pre-wrap">{x.n.ten}{x.n.trang_thai_giao === 'de_xuat' && <span className="ml-1 rounded bg-[#FEF3C7] px-1 font-sans text-[7.5pt] font-semibold text-[#92400E]">Chờ duyệt giao</span>}</span>;
      case 'chu_tri': return <><span className="whitespace-pre-wrap">{x.d.chu_tri_vb || chuTriMacDinh(x)}</span>
        {x.n.chu_tri_ten && <span className="mt-0.5 block font-sans text-[7.5pt] text-[#7A1A27]" title="Đơn vị được giao chủ trì trên hệ thống">▸ {tenNgan(x.n.chu_tri_ten)}</span>}</>;
      case 'san_pham': return <span className="whitespace-pre-wrap">{x.n.san_pham}</span>;
      case 'nguon_vb': return <>
        {x.d.nguon_vb && <span className="block whitespace-pre-wrap">{x.d.nguon_vb}</span>}
        {x.vb && <button type="button" onClick={(e) => { e.stopPropagation(); void moTepDrive('van_ban', x.vb!.id, x.vb!.ten_tep ?? `${x.vb!.so_ky_hieu ?? 'van-ban'}.pdf`, 'xem', x.vb!.drive_url); }}
          title="Mở văn bản đính kèm" className="mt-0.5 block text-left font-sans text-[7.5pt] text-[#1E4F86] hover:underline">📎 {x.vb.so_ky_hieu || x.vb.trich_yeu || 'Văn bản đính kèm'}</button>}
        {!x.d.nguon_vb && !x.vb && suaDuoc && chon === x.n.id && <span className="font-sans text-[7.5pt] italic text-[#8D8486]">Bấm để ghi tên văn bản…</span>}
      </>;
      case 'han': return <><b>{x.n.dinh_ky ? (x.n.ky_han ? ngayNgan(x.n.ky_han) : 'Định kỳ') : ngayNgan(x.n.han) || '—'}</b>{x.n.dinh_ky && <span className="block text-[0.9em] italic">(định kỳ)</span>}</>;
      case 'tien_do': return <><span className="font-sans text-[8pt] font-semibold">{TT_NV[x.n.trang_thai].nhan} · {x.n.phan_tram}%</span>
        {x.d.so_lieu && x.d.danh_gia?.kieu !== 'tien_do' && <span className="mt-0.5 block font-sans text-[7.5pt] text-[#1E3A8A]">Đạt {soVN(x.d.so_lieu.tu)}/{soVN(x.d.so_lieu.mau)}{x.d.danh_gia?.kieu === 'ty_le' ? ` (${soVN((x.d.so_lieu.tu / x.d.so_lieu.mau) * 100, 2)}%${x.d.danh_gia.chi_tieu ? `; CT ${soVN(x.d.danh_gia.chi_tieu, 2)}%` : ''})` : ''}</span>}
        {x.d.tien_do_vb && <span className="mt-0.5 block whitespace-pre-wrap">{x.d.tien_do_vb}</span>}</>;
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
                <tr key={g.id} data-nhom={g.id}><td colSpan={cot.length} className={cx('border border-[#2B2B2B] bg-[#F1ECEC] px-[4pt] py-[3pt] font-bold', keo?.dich?.nhom === g.id && 'shadow-[inset_0_-3px_0_#C99A2E]')}>{g.ky_hieu ? `${g.ky_hieu}. ` : ''}{g.ten}</td></tr>,
                ...arr.map((x) => {
                  const m = MAU_TT[x.tt.loai]; const cao = caoDong(x);
                  return (
                    <tr key={x.n.id} data-id={x.n.id} onClick={(e) => { if (vuaKeo.current || (e.target as HTMLElement).closest('textarea, input')) return; bam(x.n.id); }}
                      className={cx('cursor-pointer', keo?.id === x.n.id ? 'opacity-40' : chon === x.n.id ? 'bg-[#FFF3D6]' : x.tt.loai === 'qua_han' ? 'bg-[#FFF6F5] hover:bg-[#FDECEA]' : 'hover:bg-[#FBF8F8]')}
                      style={{ ...(cao ? { height: cao } : {}), ...(keo?.dich?.id === x.n.id ? { boxShadow: keo.dich.truoc ? 'inset 0 3px 0 #C99A2E' : 'inset 0 -3px 0 #C99A2E' } : {}) }}>
                      {cot.map((c, i) => {
                        const suaO = suaDuoc && !!O_SUA[c.khoa];
                        return (
                          <td key={c.khoa}
                            onClick={suaO && chon === x.n.id && dangSua !== `${x.n.id}:${c.khoa}` ? (e) => { e.stopPropagation(); window.clearTimeout(hen.current); setDangSua(`${x.n.id}:${c.khoa}`); } : undefined}
                            onDoubleClick={suaO ? (e) => { e.stopPropagation(); window.clearTimeout(hen.current); setDangSua(`${x.n.id}:${c.khoa}`); } : undefined}
                            className={cx('border border-[#2B2B2B] px-[4pt] py-[3pt] align-top [overflow-wrap:anywhere]', ['tt', 'han', 'tinh_trang'].includes(c.khoa) && 'text-center', c.khoa === 'tt' && 'relative', suaO && 'hover:outline hover:outline-1 hover:outline-[#C99A2E]')}
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
        {suaDuoc ? 'Bấm một hàng để mở khung chi tiết; bấm tiếp vào ô của hàng đang chọn (hoặc bấm đúp) để sửa ngay trên bảng. Kéo biểu tượng ⋮ ở ô TT để đưa nhiệm vụ lên, xuống hoặc sang nhóm khác.' : 'Bấm một hàng để xem chi tiết và cập nhật kết quả ở khung bên phải.'}
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
function KhungChiTiet({ x, ds, chon, dong, quanTri, tenDv, duocBaoCao, laChuTri, daGui, sua, duyet, xoa, moTrang, dsVb, ganVb, luuTenNguon, luuDong }: {
  x: Dong; ds: Dong[]; chon: (id: string) => void; dong: () => void; quanTri: boolean; tenDv: (id: string | null) => string;
  dsVb: VbCanCu[]; ganVb: (id: string | null) => void; luuTenNguon: (t: string) => void; luuDong: (p: Partial<DongA4>) => void;
  duocBaoCao: boolean; laChuTri: boolean; daGui: () => void; sua: () => void;
  duyet: () => void; xoa: () => void; moTrang: () => void;
}) {
  const { n } = x; const m = MAU_TT[x.tt.loai];
  const vt = ds.findIndex((y) => y.n.id === n.id);
  const truoc = vt > 0 ? ds[vt - 1] : null, sau = vt >= 0 && vt < ds.length - 1 ? ds[vt + 1] : null;
  // Phím tắt: Esc đóng, ↑ ↓ chuyển nhiệm vụ (khi không gõ chữ)
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === 'Escape') dong();
      if (e.key === 'ArrowUp' && truoc) { e.preventDefault(); chon(truoc.n.id); }
      if (e.key === 'ArrowDown' && sau) { e.preventDefault(); chon(sau.n.id); }
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [dong, chon, truoc, sau]);

  // Gợi ý thông minh: việc cần làm tiếp với nhiệm vụ này
  const hom = homNayVN();
  const lanCuoi = x.cn[0]?.luc ?? null;
  const ngayIm = lanCuoi ? soNgay(lanCuoi.slice(0, 10), hom) : null;
  const thieu = thieu6Ro(n);
  const goiY: { muc: 'nguy' | 'cam' | 'xanh'; chu: string; nut?: ReactNode }[] = [];
  if (n.trang_thai_giao === 'de_xuat') goiY.push({ muc: 'cam', chu: 'Chờ Trưởng ban duyệt giao — đơn vị chưa thấy nhiệm vụ.', nut: quanTri && <button className="font-bold underline" onClick={duyet}>Duyệt giao</button> });
  if (x.tt.loai === 'qua_han') goiY.push({ muc: 'nguy', chu: `Quá hạn ${x.tt.tre} ngày — cần đôn đốc ${n.chu_tri_ten ?? 'đơn vị chủ trì'}.` });
  if (x.tt.loai === 'sap_han') goiY.push({ muc: 'cam', chu: `${x.tt.nhan} đến hạn.` });
  if (x.tt.loai !== 'xong' && n.trang_thai_giao === 'da_duyet' && (ngayIm == null || ngayIm > 14)) goiY.push({ muc: 'cam', chu: ngayIm == null ? 'Chưa có báo cáo kết quả nào.' : `${ngayIm} ngày chưa cập nhật kết quả.` });
  if (quanTri && thieu.length) goiY.push({ muc: 'xanh', chu: `Chưa đủ 6 rõ: thiếu ${thieu.join(', ')}.`, nut: <button className="font-bold underline" onClick={sua}>Bổ sung</button> });
  if (x.tt.loai === 'xong' && !x.mc.length) goiY.push({ muc: 'xanh', chu: 'Đã hoàn thành nhưng chưa có minh chứng.', nut: <button className="font-bold underline" onClick={moTrang}>Đính kèm</button> });
  const mauGy = { nguy: 'bg-nguy-nhat text-nguy', cam: 'bg-cam-nhat text-cam-dam', xanh: 'bg-xanh-nhat text-xanh' };

  const [xemHet, setXemHet] = useState(false);
  const han = n.dinh_ky ? n.ky_han : n.han;
  const conNgay = han && x.tt.loai !== 'xong' ? soNgay(hom, han) : null;
  const dongTT = (nhan: string, gt: ReactNode) => gt ? <div className="flex gap-3 py-1.5 text-[0.8125rem]"><dt className="w-[92px] shrink-0 text-mo">{nhan}</dt><dd className="m-0 min-w-0 flex-1 whitespace-pre-wrap leading-snug">{gt}</dd></div> : null;

  return (
    <>
      {/* Điện thoại / máy hẹp: lớp nền mờ; máy tính: khung đứng cạnh bảng */}
      <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={dong} />
      <aside aria-label="Chi tiết nhiệm vụ"
        className="truot-len fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl border border-vien bg-white shadow-xl lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:max-h-[calc(100vh-32px)] lg:w-[360px] lg:shrink-0 lg:animate-none lg:rounded-2xl lg:shadow-[0_8px_28px_-12px_rgba(60,10,12,.25)] xl:w-[390px]">
        {/* Đầu khung */}
        <div className="flex items-center gap-1 border-b border-vien px-3 py-2">
          <span className="mono rounded-md bg-nen px-1.5 py-0.5 text-xs font-bold text-mo-2">#{x.so}</span>
          {n.ma && <span className="mono truncate text-xs text-mo">{n.ma}</span>}
          <span className="flex-1" />
          <button disabled={!truoc} onClick={() => truoc && chon(truoc.n.id)} title="Nhiệm vụ trước (↑)" aria-label="Nhiệm vụ trước" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button disabled={!sau} onClick={() => sau && chon(sau.n.id)} title="Nhiệm vụ sau (↓)" aria-label="Nhiệm vụ sau" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          <button onClick={moTrang} title="Mở trang đầy đủ" aria-label="Mở trang đầy đủ" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen"><Maximize2 className="h-4 w-4" /></button>
          <button onClick={dong} title="Đóng (Esc)" aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-nen"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[0.9688rem] font-bold leading-snug">{n.ten}</p>
            <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
              <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ color: m.chu, background: m.nen }}>{x.tt.nhan}</span>
              {han && <span className="text-mo">Hạn <b className="mono text-den">{ngayNgan(han)}</b>{conNgay != null && conNgay >= 0 && x.tt.loai !== 'sap_han' ? ` · còn ${conNgay} ngày` : ''}</span>}
              {n.dinh_ky && <span className="text-mo">· định kỳ</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-nen-3"><div className="h-1.5 rounded-full transition-[width]" style={{ width: `${n.phan_tram}%`, background: m.vach }} /></div>
              <span className="mono w-10 text-right text-xs font-bold">{n.phan_tram}%</span>
            </div>
          </div>

          {goiY.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {goiY.map((g, i) => <li key={i} className={cx('flex items-start gap-2 rounded-xl px-3 py-2 text-[0.8125rem] leading-snug', mauGy[g.muc])}><span className="flex-1">{g.chu}</span>{g.nut}</li>)}
            </ul>
          )}

          {duocBaoCao && <CapNhatNhanh x={x} laChuTri={laChuTri} quanTri={quanTri} luuDong={luuDong} xong={daGui} />}

          <NguonVanBan x={x} quanTri={quanTri} dsVb={dsVb} gan={ganVb} luuTen={luuTenNguon} />

          <dl className="m-0 flex flex-col divide-y divide-[#F1EEE7]">
            {dongTT('Chủ trì', n.chu_tri_ten ?? <i className="text-mo">Chưa giao</i>)}
            {dongTT('Phối hợp', (n.phoi_hop_ids ?? []).map(tenDv).filter(Boolean).join('; '))}
            {dongTT('Sản phẩm', n.san_pham)}
            {dongTT('Phụ trách', n.lanh_dao_phu_trach)}
            {dongTT('Ghi chú', n.mo_ta)}
          </dl>

          <section className="flex flex-col gap-1.5">
            <h3 className="m-0 flex items-center text-[0.8125rem] font-bold">Kết quả thực hiện <span className="ml-1.5 font-normal text-mo">{x.cn.length || ''}</span></h3>
            {x.cn.length ? (xemHet ? x.cn : x.cn.slice(0, 2)).map((c, i) => (
              <div key={i} className="border-l-2 border-vien-2 pl-3 text-[0.8125rem]">
                <p className="m-0 whitespace-pre-wrap leading-snug">{c.noi_dung}</p>
                <span className="text-[11px] text-mo">{c.boi_ten ?? ''} · {ngayGioDu(c.luc)}{c.phan_tram != null ? ` · ${c.phan_tram}%` : ''}</span>
              </div>
            )) : <span className="text-[0.8125rem] text-mo">Chưa có.</span>}
            {x.cn.length > 2 && <button className="self-start text-xs font-semibold text-[#8E1B22]" onClick={() => setXemHet(!xemHet)}>{xemHet ? 'Thu gọn' : `Xem cả ${x.cn.length} lần cập nhật`}</button>}
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="m-0 flex items-center text-[0.8125rem] font-bold">Minh chứng <span className="flex-1" />
              <button className="flex items-center gap-1 text-xs font-semibold text-[#8E1B22]" onClick={moTrang}><Paperclip className="h-3.5 w-3.5" />Đính kèm</button></h3>
            {x.mc.length ? x.mc.map((t, i) => <span key={i} className="truncate text-[0.8125rem] text-[#1E4F86]" title={t}>▸ {t}</span>) : <span className="text-[0.8125rem] text-mo">Chưa có.</span>}
          </section>
        </div>

        {quanTri && (
          <div className="flex items-center gap-2 border-t border-vien px-3 py-2.5">
            <Nut icon={<Pencil className="h-4 w-4" />} onClick={sua}>Sửa</Nut>
            {n.trang_thai_giao === 'de_xuat' && <Nut icon={<ShieldCheck className="h-4 w-4" />} onClick={duyet}>Duyệt giao</Nut>}
            <span className="flex-1" />
            <button onClick={xoa} title="Xoá nhiệm vụ" aria-label="Xoá nhiệm vụ" className="flex h-10 w-10 items-center justify-center rounded-xl text-nguy hover:bg-nguy-nhat"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </aside>
    </>
  );
}

// Nguồn văn bản giao: ghi tên văn bản + đính kèm (chọn trong kho hoặc tải lên)
function NguonVanBan({ x, quanTri, dsVb, gan, luuTen }: { x: Dong; quanTri: boolean; dsVb: VbCanCu[]; gan: (id: string | null) => void; luuTen: (t: string) => void }) {
  const [ten, setTen] = useState(x.d.nguon_vb ?? '');
  const [chonKho, setChonKho] = useState(false);
  const [taiLen, setTaiLen] = useState(false);
  const [tim, setTim] = useState('');
  const loc = useMemo(() => { const t = khongDau(tim.trim()); return dsVb.filter((v) => !t || khongDau(tenVb(v)).includes(t)).slice(0, 30); }, [dsVb, tim]);
  if (!quanTri && !x.d.nguon_vb && !x.vb) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0 text-[0.8125rem] font-bold">Nguồn văn bản giao</h3>
      {quanTri
        ? <input className={cx(lopO, 'min-h-10 text-[0.8125rem]')} placeholder="Tên văn bản giao (vd: Kế hoạch 32/KH-BCĐ ngày 25/7/2026)" value={ten}
            onChange={(e) => setTen(e.target.value)} onBlur={() => { if (ten !== (x.d.nguon_vb ?? '')) luuTen(ten.trim()); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        : x.d.nguon_vb && <p className="m-0 text-[0.8125rem]">{x.d.nguon_vb}</p>}
      {x.vb ? (
        <div className="flex items-center gap-2 rounded-xl bg-nen px-3 py-2 text-[0.8125rem]">
          <Paperclip className="h-4 w-4 shrink-0 text-mo" />
          <button className="min-w-0 flex-1 truncate text-left text-[#1E4F86] hover:underline" title={tenVb(x.vb)}
            onClick={() => void moTepDrive('van_ban', x.vb!.id, x.vb!.ten_tep ?? `${x.vb!.so_ky_hieu ?? 'van-ban'}.pdf`, 'xem', x.vb!.drive_url)}>{tenVb(x.vb) || 'Văn bản đính kèm'}</button>
          {quanTri && <button onClick={() => gan(null)} title="Bỏ đính kèm" aria-label="Bỏ đính kèm" className="flex h-7 w-7 items-center justify-center rounded-lg text-mo hover:bg-white"><X className="h-4 w-4" /></button>}
        </div>
      ) : quanTri && !chonKho && (
        <div className="flex gap-2">
          <button onClick={() => setChonKho(true)} className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-vien-2 text-xs font-semibold text-mo-2 hover:border-[#8E1B22] hover:text-[#8E1B22]"><Search className="h-3.5 w-3.5" />Chọn trong kho</button>
          <button onClick={() => setTaiLen(true)} className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-vien-2 text-xs font-semibold text-mo-2 hover:border-[#8E1B22] hover:text-[#8E1B22]"><FileUp className="h-3.5 w-3.5" />Tải văn bản lên</button>
        </div>
      )}
      {chonKho && !x.vb && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-vien p-2">
          <input autoFocus className={cx(lopO, 'min-h-9 text-[0.8125rem]')} placeholder="Tìm số, ký hiệu, trích yếu" value={tim} onChange={(e) => setTim(e.target.value)} />
          <ul className="m-0 flex max-h-56 list-none flex-col overflow-y-auto p-0">
            {loc.length === 0 && <li className="px-2 py-2 text-xs text-mo">Không thấy văn bản. Bấm “Tải văn bản lên”.</li>}
            {loc.map((v) => <li key={v.id}><button onClick={() => { gan(v.id); setChonKho(false); if (!ten) { setTen(tenVb(v)); luuTen(tenVb(v)); } }}
              className="w-full rounded-lg px-2 py-1.5 text-left text-[0.8125rem] leading-snug hover:bg-nen"><b className="mono">{v.so_ky_hieu ?? ''}</b> {v.trich_yeu}</button></li>)}
          </ul>
          <button onClick={() => setChonKho(false)} className="self-end text-xs font-semibold text-mo">Đóng</button>
        </div>
      )}
      {taiLen && <FormVanBan mo dong={() => setTaiLen(false)} dau={{ thu_muc: 'cap_tren_tinh', loai: 'ke_hoach' }}
        xong={(id) => { setTaiLen(false); gan(id); }} />}
    </section>
  );
}

// Cập nhật kết quả ngay trong khung bên — ô nhập đổi theo cách đánh giá của nhiệm vụ:
//   Tỷ lệ: nhập Đạt / Tổng -> % so với chỉ tiêu; Số lượng: số sản phẩm đã xong / yêu cầu; Tiến độ: chọn %; Định kỳ: xác nhận xong kỳ.
const TEN_DG: Record<KieuDG, string> = { ty_le: 'Tỷ lệ %', so_luong: 'Số lượng', tien_do: 'Tiến độ', ky: 'Theo kỳ' };
function CapNhatNhanh({ x, laChuTri, quanTri, luuDong, xong }: { x: Dong; laChuTri: boolean; quanTri: boolean; luuDong: (p: Partial<DongA4>) => void; xong: () => void }) {
  const { n } = x;
  const goiY = goiYDanhGia(n);
  const [dg, setDg] = useState<DanhGia>(x.d.danh_gia ?? goiY);
  const [mo, setMo] = useState(false);
  const [noiDung, setNoiDung] = useState('');
  const [tu, setTu] = useState(x.d.so_lieu ? String(x.d.so_lieu.tu) : '');
  const [mau, setMau] = useState(x.d.so_lieu ? String(x.d.so_lieu.mau) : dg.tong ? String(dg.tong) : '');
  const [p, setP] = useState(n.phan_tram);
  const [xongNv, setXongNv] = useState(false);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const doiKieu = (k: KieuDG) => {
    const moi: DanhGia = k === goiY.kieu ? goiY : { kieu: k };
    setDg(moi); if (!mau && moi.tong) setMau(String(moi.tong));
    if (quanTri) luuDong({ danh_gia: moi });
  };
  const soTu = docSo(tu.trim()), soMau = docSo(mau.trim());
  const coSo = (dg.kieu === 'ty_le' || dg.kieu === 'so_luong') && Number.isFinite(soTu) && Number.isFinite(soMau) && soMau > 0;
  const kq = coSo ? tinhDanhGia(dg, soTu, soMau) : null;
  const ptMoi = kq ? kq.phanTram : p;
  // Gợi ý ghi nhận hoàn thành khi đạt chỉ tiêu / đủ số lượng / 100%
  const datMuc = kq ? kq.dat : ptMoi >= 100;

  if (!mo) return (
    <button onClick={() => { setMo(true); setXongNv(false); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-vien-2 px-3 text-left text-[0.8125rem] text-mo hover:border-[#8E1B22] hover:text-[#8E1B22]">
      <Plus className="h-4 w-4" /><span className="flex-1">{dg.kieu === 'ky' ? 'Báo cáo kết quả kỳ này…' : dg.kieu === 'tien_do' ? 'Cập nhật kết quả, tiến độ…' : 'Cập nhật số liệu kết quả…'}</span>
      {x.d.so_lieu && dg.kieu !== 'tien_do' && <span className="mono text-xs">{soVN(x.d.so_lieu.tu)}/{soVN(x.d.so_lieu.mau)}</span>}
    </button>
  );

  const gui = async () => {
    const dongSo = kq ? (dg.kieu === 'ty_le'
      ? `Kết quả: ${soVN(soTu)}/${soVN(soMau)} (${soVN(kq.tyLe, 2)}%)${dg.chi_tieu ? ` — ${kq.dat ? 'đạt' : 'chưa đạt'} chỉ tiêu ${soVN(dg.chi_tieu, 2)}%` : ''}.`
      : `Kết quả: hoàn thành ${soVN(soTu)}/${soVN(soMau)}.`) : '';
    const nd = [dongSo, noiDung.trim()].filter(Boolean).join('\n');
    if (!nd) { setLoi(dg.kieu === 'ty_le' || dg.kieu === 'so_luong' ? 'Nhập số liệu hoặc nội dung kết quả' : 'Nhập kết quả đã thực hiện'); return; }
    setDang(true); setLoi(null);
    const tt: TrangThaiNv = xongNv && dg.kieu !== 'ky' ? 'hoan_thanh' : ptMoi > 0 || nd ? 'dang_thuc_hien' : n.trang_thai;
    const ptGhi = xongNv && dg.kieu !== 'ky' ? 100 : ptMoi;
    const { error } = await supabase.from('nhiem_vu_cap_nhat').insert({
      nhiem_vu_id: n.id, noi_dung: nd,
      phan_tram: laChuTri && dg.kieu !== 'ky' && ptGhi !== n.phan_tram ? ptGhi : null, trang_thai_moi: laChuTri && tt !== n.trang_thai ? tt : null,
    });
    if (!error && dg.kieu === 'ky' && xongNv) {
      const r = await supabase.rpc('nhiem_vu_xac_nhan_ky', { p_nv: n.id, p_xong: true, p_ghi_chu: noiDung.trim() || null, p_ma_ky: null });
      if (r.error) { setDang(false); setLoi(loiDe(r.error)); return; }
    }
    setDang(false);
    if (error) { setLoi(loiDe(error)); return; }
    if (kq && quanTri) luuDong({ so_lieu: { tu: soTu, mau: soMau, luc: new Date().toISOString() }, ...(x.d.danh_gia ? {} : { danh_gia: dg }) });
    setMo(false); setNoiDung(''); xong();
  };
  const oSo = (nhan: string, v: string, dat: (v: string) => void, goi?: string) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-[11px] font-semibold text-mo-2">{nhan}</span>
      <input inputMode="decimal" className={cx(lopO, 'mono min-h-10 bg-white text-[0.9375rem]')} placeholder={goi} value={v} onChange={(e) => dat(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
  );
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-vien bg-nen-2 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-mo-2">Đánh giá theo</span>
        <div role="group" className="flex flex-1 gap-0.5 rounded-lg bg-white p-0.5">
          {(['ty_le', 'so_luong', 'tien_do', 'ky'] as KieuDG[]).filter((k) => k !== 'ky' || n.dinh_ky).map((k) => (
            <button key={k} onClick={() => doiKieu(k)} aria-pressed={dg.kieu === k}
              className={cx('h-7 flex-1 whitespace-nowrap rounded-md px-1.5 text-[11.5px]', dg.kieu === k ? 'bg-ink font-semibold text-white' : 'text-mo-2 hover:bg-nen')}>{TEN_DG[k]}</button>
          ))}
        </div>
      </div>

      {dg.kieu === 'ty_le' && <>
        <div className="flex items-end gap-2">
          {oSo('Đạt', tu, setTu, 'vd: 34.605')}<span className="pb-2.5 text-mo">/</span>{oSo('Tổng số', mau, setMau, 'vd: 37.070')}
          <label className="flex w-[74px] shrink-0 flex-col gap-1"><span className="text-[11px] font-semibold text-mo-2">Chỉ tiêu</span>
            <input inputMode="decimal" className={cx(lopO, 'mono min-h-10 bg-white text-[0.9375rem]')} placeholder="%" value={dg.chi_tieu ?? ''}
              onChange={(e) => { const v = docSo(e.target.value); setDg({ ...dg, chi_tieu: Number.isFinite(v) && e.target.value ? v : undefined }); }}
              onBlur={() => quanTri && luuDong({ danh_gia: dg })} /></label>
        </div>
        {kq && <div className={cx('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem]', kq.dat ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-white text-den')}>
          <b className="mono">{soVN(kq.tyLe, 2)}%</b>
          <span>{dg.chi_tieu ? (kq.dat ? `đạt chỉ tiêu ${soVN(dg.chi_tieu, 2)}%` : `còn thiếu ${soVN(dg.chi_tieu - kq.tyLe, 2)} điểm % so với chỉ tiêu ${soVN(dg.chi_tieu, 2)}%`) : 'tỷ lệ đạt'}</span>
          <span className="flex-1" /><span className="mono text-xs text-mo">→ {kq.phanTram}%</span>
        </div>}
      </>}

      {dg.kieu === 'so_luong' && <>
        <div className="flex items-end gap-2">{oSo('Đã hoàn thành', tu, setTu, '0')}<span className="pb-2.5 text-mo">/</span>{oSo('Yêu cầu', mau, setMau, 'số lượng')}</div>
        {kq && <div className="flex items-center gap-2 text-[0.8125rem]">
          <div className="h-1.5 flex-1 rounded-full bg-white"><div className="h-1.5 rounded-full bg-[#16A34A]" style={{ width: `${kq.phanTram}%` }} /></div>
          <span className="mono text-xs font-bold">{kq.phanTram}%</span></div>}
      </>}

      {dg.kieu === 'tien_do' && laChuTri && (
        <div className="flex items-center gap-1">
          {[0, 25, 50, 75, 100].map((v) => (
            <button key={v} onClick={() => { setP(v); setXongNv(v === 100); }} className={cx('mono h-8 flex-1 rounded-lg border text-xs font-semibold', p === v ? 'border-ink bg-ink text-white' : 'border-vien-2 bg-white text-mo-2 hover:bg-nen')}>{v}%</button>
          ))}
        </div>
      )}

      {dg.kieu === 'ky' && <span className="text-[0.8125rem] text-mo-2">Kỳ {tenKyNv(n.ky_ma)}{n.ky_xong ? ' — đã xác nhận hoàn thành.' : n.ky_han ? ` · hạn ${ngayNgan(n.ky_han)}` : ''}</span>}

      <textarea className={cx(lopO, 'min-h-16 bg-white py-2 text-[0.8125rem]')} placeholder={dg.kieu === 'tien_do' ? 'Kết quả đã thực hiện, vướng mắc' : 'Ghi chú, vướng mắc (không bắt buộc)'}
        value={noiDung} onChange={(e) => setNoiDung(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void gui(); if (e.key === 'Escape') setMo(false); }} />

      {laChuTri && !(dg.kieu === 'ky' && n.ky_xong) && (
        <label className={cx('flex items-center gap-2 text-[0.8125rem]', datMuc && !xongNv && 'text-[#166534]')}>
          <input type="checkbox" className="h-4 w-4 accent-[#16A34A]" checked={xongNv} onChange={(e) => setXongNv(e.target.checked)} />
          {dg.kieu === 'ky' ? `Xác nhận hoàn thành kỳ ${tenKyNv(n.ky_ma)}` : 'Ghi nhận hoàn thành nhiệm vụ'}
          {datMuc && !xongNv && dg.kieu !== 'ky' && <span className="text-xs">(đã đạt mức yêu cầu)</span>}
        </label>
      )}
      {loi && <span className="text-xs text-nguy">{loi}</span>}
      <div className="flex justify-end gap-2"><Nut onClick={() => setMo(false)}>Huỷ</Nut><Nut kieu="chinh" dangChay={dang} onClick={() => void gui()}>Gửi</Nut></div>
    </div>
  );
}

// ---------- Thanh lọc: một khối gọn — hàng 1 lọc theo tình trạng (có số đếm) + vòng tỉ lệ hoàn thành; hàng 2 công cụ
function ThanhLoc({ ds, loc, datLoc, choDuyet, moTk, datMoTk, soHien, congCu }: {
  ds: Dong[]; loc: LocTT; datLoc: (l: LocTT) => void; choDuyet: number | null; moTk: boolean; datMoTk: (v: boolean) => void; soHien: number; congCu: ReactNode;
}) {
  const dem = (k: LoaiTT) => ds.filter((x) => x.tt.loai === k).length;
  const xong = dem('xong'), tl = phanTram(xong, ds.length);
  const o: [LocTT, string, number, string][] = [
    ['tat_ca', 'Tất cả', ds.length, '#6A0F14'], ['qua_han', 'Quá hạn', dem('qua_han'), '#BE123C'], ['sap_han', 'Sắp đến hạn', dem('sap_han'), '#D97706'],
    ['chua_xong', 'Đang thực hiện', ds.length - xong, '#1E3A8A'], ['xong', 'Hoàn thành', xong, '#16A34A'],
    ...(choDuyet != null ? [['cho_duyet', 'Chờ duyệt giao', choDuyet, '#92400E'] as [LocTT, string, number, string]] : []),
  ];
  const r = 15, cv = 2 * Math.PI * r;
  return (
    <div className="flex flex-col rounded-2xl border border-vien bg-white shadow-[0_1px_2px_rgba(40,10,15,.04)]">
      <div className="flex items-center gap-2 border-b border-[#F1EEE7] px-2 py-1.5">
        <div role="group" aria-label="Lọc theo tình trạng" className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {o.map(([k, nhan, so, mau]) => {
            const chon = loc === k;
            return (
              <button key={k} onClick={() => datLoc(chon && k !== 'tat_ca' ? 'tat_ca' : k)} aria-pressed={chon}
                className={cx('relative flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[0.8125rem] transition', chon ? 'bg-nen font-semibold text-den' : 'text-mo-2 hover:bg-nen-2', so === 0 && k !== 'tat_ca' && !chon && 'opacity-55')}>
                <span className="h-2 w-2 rounded-full" style={{ background: mau }} />
                <span className="whitespace-nowrap">{nhan}</span>
                <span className="mono rounded-md px-1.5 text-[0.75rem] font-bold" style={{ color: mau, background: chon ? 'white' : 'transparent' }}>{so}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => datMoTk(!moTk)} aria-pressed={moTk} title="Xem tỉ lệ hoàn thành theo đơn vị chủ trì"
          className={cx('flex h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-left hover:bg-nen-2', moTk && 'bg-nen')}>
          <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden className="-rotate-90">
            <circle cx="20" cy="20" r={r} fill="none" stroke="#EAE6DC" strokeWidth="5" />
            <circle cx="20" cy="20" r={r} fill="none" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(cv * tl) / 100} ${cv}`} />
          </svg>
          <span className="hidden flex-col leading-tight sm:flex"><b className="mono text-[0.875rem]">{pt(tl)}</b><span className="whitespace-nowrap text-[11px] text-mo">hoàn thành {moTk ? '▴' : '▾'}</span></span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        {congCu}
        <span className="mono text-[0.75rem] text-mo" title="Đang hiện / tổng số">{soHien}/{ds.length}</span>
      </div>
    </div>
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
    case 'tt': return x.so;
    case 'ten': return x.n.ten;
    case 'chu_tri': return x.d.chu_tri_vb || chuTriMacDinh(x);
    case 'san_pham': return x.n.san_pham ?? '';
    case 'nguon_vb': return [x.d.nguon_vb, x.vb ? tenVb(x.vb) : ''].filter(Boolean).join('\n');
    case 'han': return ngayNgan(x.n.han);
    case 'tien_do': return `${TT_NV[x.n.trang_thai].nhan} (${x.n.phan_tram}%)${x.d.so_lieu && x.d.danh_gia?.kieu !== 'tien_do' ? `\nĐạt ${soVN(x.d.so_lieu.tu)}/${soVN(x.d.so_lieu.mau)}` : ''}${x.d.tien_do_vb ? `\n${x.d.tien_do_vb}` : ''}`;
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
  const giua = ['tt', 'han', 'tinh_trang'];
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
