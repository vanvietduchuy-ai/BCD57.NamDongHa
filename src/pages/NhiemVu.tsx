import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, Plus, Search, ShieldCheck, SlidersHorizontal, Table2, Users } from 'lucide-react';
import { useManRong } from '../lib/manHinh';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { useAuth, laQuanTri } from '../lib/auth';
import { ngay } from '../lib/dinhDang';
import { COT_NV, DINH_KY, hanNv, khongDau, LINH_VUC, moTaDinhKy, NHOM_NV, tenKyNv, TT_NV, type LinhVuc, type NhiemVu, type NhomNv } from '../lib/nhiemVu';
import { Chip, ChipHan, DangTai, HopLoi, lopO, Nut, Rong, The, TieuDeTrang, cx } from '../components/ui';
import FormNhiemVu from '../components/FormNhiemVu';

type Tab = 'chu_y' | 'tat_ca' | 'cho_duyet' | 'qua_han' | 'hoan_thanh' | 'dang' | 'chua';

export function HanNv({ n }: { n: Pick<NhiemVu, 'han' | 'trang_thai'> & Partial<Pick<NhiemVu, 'dinh_ky' | 'ky_han' | 'ky_xong'>> }) {
  // Nhiệm vụ định kỳ: trạng thái kỳ hiện tại
  if (n.dinh_ky && n.trang_thai !== 'hoan_thanh' && n.trang_thai !== 'tam_dung') {
    if (n.ky_xong) return <Chip nen="bg-[#DCFCE7]" chu="text-[#166534]">Kỳ này: xong</Chip>;
    if (n.ky_han) return <ChipHan han={hanNv(n.ky_han)} />;
  }
  if (!n.han) return <Chip>Chưa chốt hạn</Chip>;
  if (n.trang_thai === 'hoan_thanh') return <span className="so text-xs text-mo">hạn {ngay(n.han)}</span>;
  if (n.trang_thai === 'tam_dung') return <Chip>Tạm dừng</Chip>;
  return <ChipHan han={hanNv(n.han)} />;
}

export function ThanhNv({ n }: { n: Pick<NhiemVu, 'phan_tram' | 'trang_thai' | 'qua_han'> }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[#EEEBE3]">
        <div className={cx('thanh-chay h-1.5 rounded-full', n.qua_han ? 'bg-nguy' : TT_NV[n.trang_thai].thanh)} style={{ width: `${n.phan_tram}%` }} />
      </div>
      <span className="so w-9 text-right text-xs font-semibold">{n.phan_tram}%</span>
    </div>
  );
}

// Cột bảng (máy tính): STT | Mã | Nhiệm vụ | Chủ trì | Tiến độ | Hạn
const LUOI = 'md:grid md:grid-cols-[32px_minmax(0,1fr)_minmax(0,170px)_96px_128px] md:items-center md:gap-4';

export default function NhiemVuTrang() {
  const { hoSo } = useAuth();
  const nav = useNavigate();
  const quanTri = laQuanTri(hoSo);
  const lanhDao = hoSo?.vai_tro === 'lanh_dao';
  const donVi = hoSo?.vai_tro === 'don_vi';
  const [sp, setSp] = useSearchParams();

  const { data, loi, dangTai, taiLai } = useDuLieu(async () => {
    const [a, b] = await Promise.all([
      supabase.from('v_nhiem_vu').select(COT_NV).order('han', { ascending: true, nullsFirst: false }).order('ma'),
      supabase.from('don_vi').select('id, ten').order('thu_tu'),
    ]);
    let nv = kq(a) as unknown as NhiemVu[];
    // Đơn vị: chỉ việc mình chủ trì / phối hợp (việc lĩnh vực mình làm đầu mối xem ở "Theo dõi lĩnh vực")
    if (hoSo?.vai_tro === 'don_vi') nv = nv.filter((n) => n.chu_tri_don_vi_id === hoSo.don_vi_id || (n.phoi_hop_ids ?? []).includes(hoSo.don_vi_id!));
    return { nv, dv: (kq(b) ?? []) as { id: string; ten: string }[] };
  }, []);

  const choDuyet = (data?.nv ?? []).filter((n) => n.trang_thai_giao === 'de_xuat');
  const tab = (sp.get('tab') as Tab) ?? (lanhDao && choDuyet.length ? 'cho_duyet' : 'tat_ca');
  const [nhom, setNhom] = useState<NhomNv | ''>('');
  const [dvLoc, setDvLoc] = useState('');
  const [lv, setLv] = useState<LinhVuc | ''>('');
  const [moLoc, setMoLoc] = useState(false);
  const [tim, setTim] = useState(() => sp.get('q') ?? '');
  const [chon, setChon] = useState<string[]>([]);
  const [moForm, setMoForm] = useState(false);
  const rong = useManRong();
  const [chonNv, setChonNv] = useState<string | null>(null);
  const [dangDuyet, setDangDuyet] = useState(false);
  const [loiDuyet, setLoiDuyet] = useState<string | null>(null);


  // Điều kiện theo tab (trạng thái) và theo bộ lọc (nhóm, lĩnh vực, đơn vị, tìm kiếm)
  const hopTab = (n: NhiemVu, t: Tab) => {
    if (t === 'cho_duyet') return n.trang_thai_giao === 'de_xuat';
    if (t !== 'tat_ca' && n.trang_thai_giao !== 'da_duyet') return false;
    if (t === 'chu_y') return n.qua_han || (n.con_ngay != null && n.con_ngay <= 7 && !['hoan_thanh', 'tam_dung'].includes(n.trang_thai)) || (n.han == null && n.trang_thai !== 'hoan_thanh');
    if (t === 'qua_han') return n.qua_han;
    if (t === 'hoan_thanh') return n.trang_thai === 'hoan_thanh';
    if (t === 'dang') return n.trang_thai === 'dang_thuc_hien' || n.trang_thai === 'trinh_ky';
    if (t === 'chua') return n.trang_thai === 'chua_trien_khai';
    return true;
  };
  const locKhac = useMemo(() => {
    const t = khongDau(tim.trim());
    return (data?.nv ?? []).filter((n) => {
      if (lv && n.linh_vuc !== lv) return false;
      if (dvLoc && n.chu_tri_don_vi_id !== dvLoc && !(n.phoi_hop_ids ?? []).includes(dvLoc)) return false;
      if (t && !khongDau(`${n.ma ?? ''} ${n.ten} ${n.chu_tri_ten ?? ''} ${n.san_pham ?? ''}`).includes(t)) return false;
      return true;
    });
  }, [data, lv, dvLoc, tim]);
  const theoTab = locKhac.filter((n) => hopTab(n, tab));
  const ds = theoTab.filter((n) => !nhom || n.nhom === nhom);
  // Gom theo nhóm nhiệm vụ để dễ nhìn
  const nhomCo = (Object.keys(NHOM_NV) as NhomNv[]).map((k) => [k, ds.filter((n) => n.nhom === k)] as const).filter(([, v]) => v.length);
  // Số thứ tự liên tục theo thứ tự hiển thị
  const stt = new Map(nhomCo.flatMap(([, v]) => v).map((n, i) => [n.id, i + 1]));
  const dsHien = nhomCo.flatMap(([, v]) => v);
  const nvChon = rong ? (dsHien.find((n) => n.id === chonNv) ?? dsHien[0] ?? null) : null;

  const datTab = (t: Tab) => { setChon([]); setSp(t === 'tat_ca' ? {} : { tab: t }, { replace: true }); };

  const duyet = async (ids: string[]) => {
    setDangDuyet(true); setLoiDuyet(null);
    const { error } = await supabase.from('nhiem_vu').update({ trang_thai_giao: 'da_duyet' }).in('id', ids);
    setDangDuyet(false);
    if (error) setLoiDuyet(loiDe(error)); else { setChon([]); void taiLai(); }
  };

  const xuatExcel = async () => {
    const XLSX = await import('xlsx');
    const tenDv = (id: string) => data?.dv.find((d) => d.id === id)?.ten ?? '';
    const dong = ds.map((n, i) => ({
      'TT': i + 1, 'Mã': n.ma, 'Nhiệm vụ (rõ việc)': n.ten, 'Nhóm': NHOM_NV[n.nhom], 'Lĩnh vực': LINH_VUC[n.linh_vuc],
      'Chủ trì (rõ người)': n.chu_tri_ten ?? '', 'Phối hợp': (n.phoi_hop_ids ?? []).map(tenDv).join('; '),
      'Lãnh đạo phụ trách': n.lanh_dao_phu_trach ?? '', 'Hạn (rõ thời gian)': n.dinh_ky ? moTaDinhKy(n.dinh_ky, n.han_trong_ky) : n.han ? ngay(n.han) : '',
      'Sản phẩm': n.san_pham ?? '', 'Thẩm quyền': n.tham_quyen ?? '', 'Căn cứ': n.can_cu_so_ky_hieu ?? '',
      'Trạng thái': TT_NV[n.trang_thai].nhan, 'Tiến độ (%)': n.phan_tram, 'Quá hạn': n.qua_han ? 'x' : '',
      'Giao': n.trang_thai_giao === 'da_duyet' ? 'Đã duyệt' : 'Đề xuất',
    }));
    const ws = XLSX.utils.json_to_sheet(dong);
    ws['!cols'] = [4, 12, 50, 22, 16, 28, 30, 24, 12, 28, 24, 16, 16, 10, 8, 10].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nhiệm vụ');
    XLSX.writeFile(wb, `danh-muc-nhiem-vu-bcd57.xlsx`);
  };

  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;

  const demTab = (t: Tab) => locKhac.filter((n) => hopTab(n, t) && (!nhom || n.nhom === nhom)).length;
  const soLoc = [lv, dvLoc].filter(Boolean).length;
  const chonDuoc = !donVi && tab === 'cho_duyet';
  const PILL: [Tab, string, string][] = [
    ['tat_ca', 'việc', 'text-den'], ['hoan_thanh', 'hoàn thành', 'text-xanh'], ['dang', 'đang thực hiện / trình ký', 'text-xanh'],
    ['chua', 'chưa triển khai', 'text-mo-2'], ['qua_han', 'quá hạn', 'text-nguy'],
    ...(!donVi && choDuyet.length ? [['cho_duyet', 'chờ duyệt giao', 'text-cam'] as [Tab, string, string]] : []),
  ];
  const demNhom = (k: NhomNv | '') => locKhac.filter((n) => hopTab(n, tab) && (!k || n.nhom === k)).length;

  return (
    <>
      <TieuDeTrang tren={donVi ? hoSo?.don_vi?.ten : 'Nhiệm vụ BCĐ · NQ 57, chuyển đổi số, Đề án 06'}
        ten={donVi ? 'Nhiệm vụ được giao' : 'Nhiệm vụ Ban Chỉ đạo'}
        phai={<>
          <Nut icon={<Table2 className="h-4 w-4" />} onClick={() => nav('/nhiem-vu/danh-muc')} ngan="Bảng A4">Danh mục dạng bảng A4</Nut>
          {!donVi && <Nut icon={<Download className="h-4 w-4" />} onClick={xuatExcel}>Xuất danh mục nhiệm vụ</Nut>}
          {quanTri && <Nut kieu="chinh" icon={<Plus className="h-4 w-4" />} onClick={() => setMoForm(true)} ngan="Giao việc">Tham mưu giao nhiệm vụ</Nut>}
          {lanhDao && <Nut kieu="chinh" icon={<Plus className="h-4 w-4" />} onClick={() => setMoForm(true)} ngan="Giao việc">Giao nhiệm vụ</Nut>}
        </>} />

      {/* Nhóm nhiệm vụ */}
      <div role="tablist" aria-label="Nhóm nhiệm vụ" className="-mt-1 flex gap-1 overflow-x-auto border-b border-vien">
        {([['', 'Tất cả'], ...Object.entries(NHOM_NV)] as [NhomNv | '', string][]).map(([k, t]) => {
          const n = demNhom(k);
          if (k && !n && nhom !== k) return null;
          return (
            <button key={k || 'tat_ca'} role="tab" aria-selected={nhom === k} onClick={() => setNhom(k)}
              className={cx('h-11 whitespace-nowrap px-4 text-[0.9062rem]', nhom === k ? 'border-b-2 border-ink font-bold text-den' : 'font-medium text-mo hover:text-den')}>
              {t}<span className="mono ml-1.5 text-[0.75rem] text-mo">· {n}</span>
            </button>
          );
        })}
      </div>

      {/* Ô số theo trạng thái: bấm để lọc */}
      <div className="hidden gap-3 md:flex">
        {PILL.map(([k, t, m]) => (
          <button key={k} type="button" onClick={() => datTab(k)} aria-pressed={tab === k}
            className={cx('flex min-w-0 flex-1 items-baseline gap-2 rounded-2xl border bg-white px-4 py-3.5 text-left transition', tab === k ? 'border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-vien hover:border-vien-2', k === 'dang' && 'flex-[1.6]')}>
            <span className={cx('mono text-[1.375rem] font-bold leading-none', m, k === 'qua_han' && !demTab(k) && 'text-mo')}>{demTab(k)}</span>
            <span className="truncate text-[0.8125rem] text-mo-2">{t}</span>
          </button>
        ))}
      </div>

      {lanhDao && choDuyet.length > 0 && tab !== 'cho_duyet' && (
        <button onClick={() => datTab('cho_duyet')} className="flex items-center gap-3 rounded-2xl bg-cam-nhat px-4 py-3 text-left text-sm text-cam-dam">
          <ShieldCheck className="h-5 w-5" /><span className="flex-1"><b>{choDuyet.length} nhiệm vụ</b> chờ duyệt giao.</span><span className="font-bold">Xem</span>
        </button>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <The className="flex min-w-0 flex-col overflow-hidden">
          {/* Công cụ: tìm, lọc */}
          <div className="flex flex-col gap-2 border-b border-vien p-3 sm:px-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:hidden">
              <select className={cx(lopO, 'w-full font-semibold')} value={tab} onChange={(e) => datTab(e.target.value as Tab)} aria-label="Trạng thái">
                {[...PILL, ['chu_y', 'cần chú ý', ''] as [Tab, string, string]].map(([k, t]) => <option key={k} value={k}>{t[0].toUpperCase() + t.slice(1)} ({demTab(k)})</option>)}
              </select>
              <button type="button" onClick={() => setMoLoc(!moLoc)} aria-expanded={moLoc}
                className={cx('flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold', moLoc || soLoc ? 'border-ink bg-ink text-white' : 'border-vien-2 bg-white text-den')}>
                <SlidersHorizontal className="h-4 w-4" />Lọc{soLoc ? ` · ${soLoc}` : ''}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_170px_190px]">
              <label className="relative col-span-2 md:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-mo" />
                <input className={cx(lopO, 'w-full bg-white pl-10')} placeholder="Tìm theo mã, tên, đơn vị, sản phẩm" value={tim} onChange={(e) => setTim(e.target.value)} aria-label="Tìm nhiệm vụ" />
              </label>
              <select className={cx(lopO, 'w-full bg-white', !moLoc && 'max-md:hidden')} value={lv} onChange={(e) => setLv(e.target.value as LinhVuc | '')} aria-label="Lọc lĩnh vực">
                <option value="">Mọi lĩnh vực</option>{Object.entries(LINH_VUC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {!donVi && (
                <select className={cx(lopO, 'w-full bg-white', !moLoc && 'max-md:hidden')} value={dvLoc} onChange={(e) => setDvLoc(e.target.value)} aria-label="Lọc đơn vị">
                  <option value="">Mọi đơn vị</option>{data?.dv.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}
                </select>
              )}
            </div>
            {chonDuoc && ds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-nen px-3 py-2">
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={chon.length === ds.length} onChange={(e) => setChon(e.target.checked ? ds.map((n) => n.id) : [])} />
                  Chọn tất cả ({ds.length})
                </label>
                <span className="flex-1" />
                <Nut kieu="chinh" disabled={!chon.length} dangChay={dangDuyet} icon={<ShieldCheck className="h-4 w-4" />} onClick={() => duyet(chon)}>
                  {lanhDao ? `Duyệt giao ${chon.length || ''} nhiệm vụ` : `Ghi nhận Trưởng ban đã duyệt (${chon.length})`}
                </Nut>
              </div>
            )}
            {loiDuyet && <HopLoi loi={loiDuyet} />}
          </div>

          {ds.length === 0 ? <div className="p-4"><Rong>{tab === 'chu_y' ? 'Không có việc sắp đến hạn.' : 'Không có nhiệm vụ.'}</Rong></div> : (
            <div className="flex flex-col">
              <div className={cx('hidden border-b border-vien px-5 py-3 text-[11px] font-bold tracking-wide text-mo', LUOI)}>
                <span>TT</span><span>NHIỆM VỤ · SẢN PHẨM</span><span>CHỦ TRÌ · PHỐI HỢP</span><span>HẠN</span><span>TRẠNG THÁI</span>
              </div>
              <ul className="flex flex-col">
                {dsHien.map((n) => {
                  const tt = TT_NV[n.trang_thai];
                  const vai = donVi ? (n.chu_tri_don_vi_id === hoSo?.don_vi_id ? 'Chủ trì' : 'Phối hợp') : null;
                  const ph = (n.phoi_hop_ids ?? []).map((x) => tenNganDv(data?.dv.find((d) => d.id === x)?.ten)).filter(Boolean);
                  const dangXem = nvChon?.id === n.id;
                  return (
                    <li key={n.id} className={cx('flex items-start gap-3 border-b border-[#F1EEE7] px-5 py-3 transition-colors last:border-0', dangXem ? 'bg-[#FDF1F0]' : 'hover:bg-nen-2', n.qua_han && 'shadow-[inset_3px_0_0_var(--color-nguy)]')}>
                      {chonDuoc && <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" aria-label={`Chọn ${n.ten}`} checked={chon.includes(n.id)}
                        onChange={(e) => setChon(e.target.checked ? [...chon, n.id] : chon.filter((x) => x !== n.id))} />}
                      <Link to={`/nhiem-vu/${n.id}`} aria-current={dangXem || undefined}
                        onClick={(e) => { if (rong && !e.ctrlKey && !e.metaKey && !dangXem) { e.preventDefault(); setChonNv(n.id); } }}
                        className={cx('flex min-w-0 flex-1 flex-col gap-1.5 text-den', LUOI)}>
                        <span className="mono hidden text-[0.7812rem] text-mo-2 md:block">{stt.get(n.id)}</span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex items-center gap-2 md:hidden">
                            <span className="mono text-xs font-bold text-mo-2">{stt.get(n.id)}. {n.ma}</span>
                            <span className="min-w-0 flex-1" />
                            <Chip nen={tt.nen} chu={tt.chu}>{tt.nhan}</Chip>
                          </div>
                          <span className="text-[0.875rem] font-bold leading-snug">{n.ten}</span>
                          {n.san_pham && <span className="line-clamp-1 text-[0.7812rem] text-mo">{n.san_pham}</span>}
                          {(vai || n.trang_thai_giao === 'de_xuat') && <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {vai && <Chip nen={vai === 'Chủ trì' ? 'bg-ink' : 'bg-nen-3'} chu={vai === 'Chủ trì' ? 'text-white' : 'text-mo-2'}>{vai}</Chip>}
                            {n.trang_thai_giao === 'de_xuat' && <Chip nen="bg-cam-nhat" chu="text-cam-dam">Đề xuất</Chip>}
                          </div>}
                        </div>
                        <span className="line-clamp-2 text-[0.8125rem] leading-snug text-mo-2"><span className="md:hidden"><Users className="mr-1 inline h-3.5 w-3.5 text-mo" /></span>{tenNganDv(n.chu_tri_ten) || 'Chưa rõ chủ trì'}{ph.length ? `; ${ph.join('; ')}` : ''}</span>
                        <span className="flex items-center gap-2 md:block">
                          <span className="min-w-0 flex-1 md:hidden"><ThanhNv n={n} /></span>
                          <span className="mono whitespace-nowrap text-[0.7812rem] text-mo-2 max-md:ml-auto">{n.dinh_ky ? <span className="font-sans"><span className="block text-[0.7188rem] font-semibold text-xanh">{DINH_KY[n.dinh_ky]}</span>{n.ky_han && <span className="mono">{ngay(n.ky_han).replace(/\/\d{4}$/, '')}</span>}</span> : n.han ? ngay(n.han) : <span className="font-sans">chưa chốt</span>}</span>
                        </span>
                        <span className="hidden md:block"><Chip nen={tt.nen} chu={tt.chu}>{tt.nhan}</Chip>{n.qua_han && <span className="mt-0.5 block text-[11px] font-bold text-nguy">quá hạn</span>}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </The>
        {nvChon && <KhungNv key={nvChon.id} n={nvChon} quanTri={quanTri} donVi={donVi} lanhDao={lanhDao} tenDv={(id) => data?.dv.find((d) => d.id === id)?.ten ?? ''} duyet={() => duyet([nvChon.id])} dangDuyet={dangDuyet} doi={() => void taiLai()} />}
      </div>

      <FormNhiemVu mo={moForm} dong={() => setMoForm(false)} tieuDe={lanhDao ? 'Giao nhiệm vụ (Trưởng ban giao trực tiếp)' : undefined} xong={(id) => { setMoForm(false); nav(`/nhiem-vu/${id}`); }} />
    </>
  );
}

// "Tổ CSKV – Công an phường" -> "Tổ CSKV - CAP"
const tenNganDv = (t: string | null | undefined) => (t ?? '').replace(' – Công an phường', ' - CAP').replace('Phòng Văn hóa – Xã hội', 'Phòng VH-XH').replace('Văn phòng HĐND – UBND', 'VP HĐND-UBND');

// Khung chi tiết bên phải (màn hình rộng) theo thiết kế gốc: "6 rõ", căn cứ, cập nhật tiến độ
type CapNhatNv = { id: number; noi_dung: string; phan_tram: number | null; luc: string; boi_ten: string | null };
function KhungNv({ n, quanTri, donVi, lanhDao, tenDv, duyet, dangDuyet, doi }: { n: NhiemVu; quanTri: boolean; donVi: boolean; lanhDao: boolean; tenDv: (id: string) => string; duyet: () => void; dangDuyet: boolean; doi: () => void }) {
  const tt = TT_NV[n.trang_thai];
  const [tdnq, setTdnq] = useState(n.da_cap_nhat_theodoinq);
  const { data: cn } = useDuLieu(async () => ((await supabase.from('v_nhiem_vu_cap_nhat').select('id, noi_dung, phan_tram, luc, boi_ten').eq('nhiem_vu_id', n.id).order('luc', { ascending: false }).limit(2)).data ?? []) as CapNhatNv[], [n.id]);
  const ph = (n.phoi_hop_ids ?? []).map(tenDv).filter(Boolean);
  const ro: [string, string | null][] = [
    ['Rõ việc', n.mo_ta || n.ten],
    ['Rõ người', n.chu_tri_ten ? `${n.chu_tri_ten}${ph.length ? ` chủ trì; ${ph.join(', ')} phối hợp` : ''}` : null],
    ['Rõ trách nhiệm', n.lanh_dao_phu_trach],
    ['Rõ thời gian', n.dinh_ky ? `${moTaDinhKy(n.dinh_ky, n.han_trong_ky)} · kỳ ${tenKyNv(n.ky_ma)}: ${n.ky_xong ? 'đã xong' : `hạn ${n.ky_han ? ngay(n.ky_han) : '—'}`}` : n.han ? `Hạn ${ngay(n.han)}` : null],
    ['Rõ sản phẩm', n.san_pham],
    ['Rõ thẩm quyền', n.tham_quyen],
  ];
  const doiTdnq = async (v: boolean) => {
    setTdnq(v);
    const { error } = await supabase.from('nhiem_vu').update({ da_cap_nhat_theodoinq: v }).eq('id', n.id);
    if (error) setTdnq(!v); else doi();
  };
  const duocCapNhat = n.trang_thai_giao === 'da_duyet' && n.trang_thai !== 'hoan_thanh';
  return (
    <The className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center gap-2">
          <span className="mono min-w-0 flex-1 truncate text-[0.75rem] font-bold tracking-[1px] text-mo">{n.ma ?? 'VIỆC'}</span>
          <Chip nen={tt.nen} chu={tt.chu}>{tt.nhan}</Chip>
        </div>
        <h2 className="-mt-1 m-0 text-[1.25rem] font-bold leading-snug">{n.ten}</h2>
        <dl className="m-0 grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-3 text-[0.8438rem]">
          {ro.map(([nhan, v]) => (
            <div key={nhan} className="contents">
              <dt className="text-mo-2">{nhan}</dt>
              <dd className={cx('m-0 leading-snug', v ? 'text-den' : 'italic text-cam-dam')}>{v ?? 'Chưa xác định'}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <span className="text-[0.8438rem] font-bold">Căn cứ (Kho văn bản)</span>
          {n.can_cu_so_ky_hieu
            ? <span className="rounded-xl bg-nen px-3 py-2 text-[0.8125rem]"><span className="mono">{n.can_cu_so_ky_hieu}</span></span>
            : <span className="text-[0.8125rem] text-mo">Chưa gắn văn bản căn cứ.</span>}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[0.8438rem] font-bold">Cập nhật tiến độ</span>
          <ThanhNv n={n} />
          {cn && cn.length > 0 ? cn.map((c) => (
            <div key={c.id} className="flex flex-col gap-0.5 rounded-xl bg-nen px-3 py-2 text-[0.8125rem]">
              <span className="line-clamp-3 leading-snug">{c.noi_dung}</span>
              <span className="text-[11.5px] text-mo">{c.boi_ten ?? ''} · {ngay(c.luc)}</span>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-vien-2 px-3 py-2.5 text-[0.8125rem] text-mo">Chưa có cập nhật. Đơn vị chủ trì cập nhật tại “Nhiệm vụ của tôi”.</div>
          )}
        </div>
        {!donVi && (
          <label className="flex items-center gap-2.5 text-[0.8438rem]">
            <input type="checkbox" className="h-5 w-5" checked={tdnq} disabled={!quanTri} onChange={(e) => void doiTdnq(e.target.checked)} />
            Đã cập nhật lên theodoinq.dcs.vn
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-vien p-4">
        {n.trang_thai_giao === 'de_xuat' && !donVi ? (
          <Nut kieu="chinh" dangChay={dangDuyet} icon={<ShieldCheck className="h-4 w-4" />} onClick={duyet}>{lanhDao ? 'Duyệt giao' : 'Ghi nhận đã duyệt'}</Nut>
        ) : (
          <Link to={`/nhiem-vu/${n.id}`} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold', duocCapNhat ? 'bg-ink text-white hover:bg-ink-2' : 'border border-vien-2 bg-white text-den')}>
            {duocCapNhat ? <>Cập nhật tiến độ</> : <>Xem chi tiết<ArrowRight className="h-4 w-4" /></>}
          </Link>
        )}
        <Link to={`/nhiem-vu/${n.id}#tep`} className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-vien-2 bg-white px-3 text-sm font-semibold text-den hover:bg-nen-2">Đính kèm dự thảo</Link>
      </div>
    </The>
  );
}
