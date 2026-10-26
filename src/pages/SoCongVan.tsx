// Sổ công văn đến / đi — tự vào sổ khi đơn vị gửi báo cáo văn bản, khi Cơ quan Thường trực thêm văn bản vào kho.
// Sổ của Ban Chỉ đạo: lấy số theo từng loại văn bản (mỗi loại một dãy số riêng trong năm).
// Sổ của Cơ quan Thường trực: một dãy số nối tiếp liên tục trong năm, không phụ thuộc loại văn bản.
import { useMemo, useState } from 'react';
import { BookPlus, ExternalLink, FilePen, FileSpreadsheet, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { useAuth, laQuanTri } from '../lib/auth';
import { ngay } from '../lib/dinhDang';
import { khongDau } from '../lib/nhiemVu';
import { COT_VB, LOAI_VB, SO_THEO_THU_MUC, THU_MUC, type LoaiVb, type ThuMuc, type VanBan } from '../lib/vanBan';
import { linkXemDrive, ThongTinVanBan, type VanBanDaNop } from '../components/VanBanPdf';
import { moTepDrive } from '../components/TepDrive';
import FormVanBan from '../components/FormVanBan';
import { DemTepKem, DsTepKem, type TepKem } from '../components/TepKem';
import { DangTai, HopLoi, HopThoai, lopO, Nut, O, Rong, The, TieuDeTrang, cx } from '../components/ui';

// Nhóm loại văn bản -> màu nhãn trong sổ
const NHOM_LOAI: Record<LoaiVb, string> = {
  nghi_quyet: 'bg-[#FDF1F0] text-ink', quyet_dinh: 'bg-[#FDF1F0] text-ink', chi_thi: 'bg-[#FDF1F0] text-ink', ket_luan: 'bg-[#FDF1F0] text-ink',
  ke_hoach: 'bg-cam-nhat text-cam-dam', chuong_trinh: 'bg-cam-nhat text-cam-dam', quy_che: 'bg-cam-nhat text-cam-dam',
  cong_van: 'bg-xanh-nhat text-xanh', thong_bao: 'bg-xanh-nhat text-xanh', giay_moi: 'bg-xanh-nhat text-xanh',
  bao_cao: 'bg-[#E3F1E8] text-[#1D5B36]', to_trinh: 'bg-[#E3F1E8] text-[#1D5B36]', bien_ban: 'bg-[#E3F1E8] text-[#1D5B36]',
  khac: 'bg-nen-3 text-mo-2',
};
const THU_TU_LOAI = Object.keys(LOAI_VB) as LoaiVb[];
const NhanLoai = ({ l }: { l: LoaiVb }) => <span className={cx('inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4', NHOM_LOAI[l] ?? NHOM_LOAI.khac)}>{LOAI_VB[l] ?? 'Khác'}</span>;

type Dong = {
  id: string; don_vi_id: string; don_vi: string; loai_so: 'den' | 'di'; nam: number; so_thu_tu: number; ngay: string;
  noi_gui: string | null; noi_nhan: string | null; ghi_chu: string | null; van_ban_id: string; so_ky_hieu: string | null;
  ngay_ban_hanh: string | null; trich_yeu: string; loai: LoaiVb; co_quan_ban_hanh: string; nguoi_ky: string | null;
  chuc_vu_nguoi_ky: string | null; drive_file_id: string | null; drive_url: string | null; ten_tep: string | null;
  ky_ten?: string | null; tep?: TepKem[] | null;
};

export default function SoCongVan() {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  // Sổ công văn đến / đi của Cơ quan Thường trực BCĐ; các đơn vị không theo dõi sổ này
  const duocXem = hoSo?.vai_tro !== 'don_vi';
  const [so, setSo] = useState<'den' | 'di'>('den');
  const [nam, setNam] = useState(new Date().getFullYear());
  const [tim, setTim] = useState('');
  const [loai, setLoai] = useState<LoaiVb | ''>('');
  // Số đánh theo từng loại nên mặc định xem sổ nhóm theo loại; nhớ lựa chọn theo máy
  const [nhom, setNhomS] = useState(() => { try { return localStorage.getItem('bcd57-so-nhom') !== '0'; } catch { return true; } });
  const setNhom = (v: boolean) => { setNhomS(v); try { localStorage.setItem('bcd57-so-nhom', v ? '1' : '0'); } catch { /* bỏ qua */ } };
  const [chon, setChon] = useState<Dong | null>(null);
  const [them, setThem] = useState(false);
  // Hai sổ: sổ của Ban Chỉ đạo (văn bản đến BCĐ, văn bản BCĐ ban hành) và sổ của Cơ quan Thường trực; nhớ lựa chọn theo máy
  const [cuaSo, setCuaSoS] = useState<'bcd' | 'cqtt'>(() => { try { return localStorage.getItem('bcd57-so-cua') === 'cqtt' ? 'cqtt' : 'bcd'; } catch { return 'bcd'; } });
  const setCuaSo = (v: 'bcd' | 'cqtt') => { setCuaSoS(v); setLoai(''); try { localStorage.setItem('bcd57-so-cua', v); } catch { /* bỏ qua */ } };

  const { data, loi, dangTai, taiLai } = useDuLieu(async () => {
    if (!duocXem) return { dong: [] as Dong[], chuSo: '' };
    const chuSo = cuaSo === 'bcd'
      ? ((await supabase.from('don_vi').select('id').eq('loai', 'lanh_dao_bcd').limit(1).maybeSingle()).data?.id as string | undefined) ?? ''
      : ((await supabase.rpc('don_vi_thuong_truc')).data as string | null) ?? '';
    const r = await supabase.from('v_so_van_ban').select('*').eq('don_vi_id', chuSo).eq('nam', nam).order('ngay', { ascending: false }).order('tao_luc', { ascending: false });
    return { dong: (kq(r) ?? []) as Dong[], chuSo };
  }, [nam, cuaSo]);

  // Lọc theo sổ + từ khoá (chưa lọc loại) -> đếm số văn bản từng loại
  const theoSo = useMemo(() => {
    const t = khongDau(tim.trim());
    return (data?.dong ?? []).filter((d) => d.loai_so === so
      && (!t || khongDau(`${d.so_thu_tu} ${d.so_ky_hieu ?? ''} ${d.trich_yeu} ${d.noi_gui ?? ''} ${d.noi_nhan ?? ''} ${d.nguoi_ky ?? ''} ${d.ky_ten ?? ''} ${LOAI_VB[d.loai] ?? ''} ${(d.tep ?? []).map((f) => f.ten).join(' ')}`).includes(t)));
  }, [data, so, tim]);
  const demLoai = useMemo(() => {
    const m = new Map<LoaiVb, number>();
    theoSo.forEach((d) => m.set(d.loai, (m.get(d.loai) ?? 0) + 1));
    return THU_TU_LOAI.filter((k) => m.has(k)).map((k) => [k, m.get(k)!] as const);
  }, [theoSo]);
  // Sổ BCĐ đánh số theo loại; sổ Cơ quan Thường trực đánh số nối tiếp chung
  const theoLoai = cuaSo === 'bcd';
  const nhomLoai = nhom && theoLoai;
  const ds = useMemo(() => theoSo.filter((d) => !loai || d.loai === loai), [theoSo, loai]);
  // Trong từng loại: số mới nhất lên đầu
  const nhomDs = useMemo(() => THU_TU_LOAI.map((k) => [k, ds.filter((d) => d.loai === k).sort((a, b) => b.so_thu_tu - a.so_thu_tu)] as const).filter(([, r]) => r.length), [ds]);
  const dsLoc = useMemo(() => (loai || !theoLoai ? [...ds].sort((a, b) => b.so_thu_tu - a.so_thu_tu) : ds), [ds, loai, theoLoai]);
  const dem = (l: 'den' | 'di') => (data?.dong ?? []).filter((d) => d.loai_so === l).length;

  const xuatExcel = async () => {
    const XLSX = await import('xlsx');
    const thuTu = theoLoai && (nhom || loai) ? nhomDs.flatMap(([, r]) => [...r].reverse()) : [...dsLoc].reverse();
    const dong = thuTu.map((d) => ({
      [so === 'den' ? 'Số đến' : 'Số đi']: d.so_thu_tu, [so === 'den' ? 'Ngày đến' : 'Ngày gửi']: ngay(d.ngay),
      'Loại': LOAI_VB[d.loai], 'Số, ký hiệu': d.so_ky_hieu ?? '', 'Ngày văn bản': d.ngay_ban_hanh ? ngay(d.ngay_ban_hanh) : '',
      [so === 'den' ? 'Nơi gửi' : 'Nơi nhận']: (so === 'den' ? d.noi_gui : d.noi_nhan) ?? '', 'Trích yếu': d.trich_yeu,
      'Người ký': [d.chuc_vu_nguoi_ky, d.nguoi_ky].filter(Boolean).join(' '), 'Ghi chú': d.ghi_chu ?? '',
      'Tệp (Google Drive)': d.drive_url || linkXemDrive(d.drive_file_id) || '',
      'Tài liệu kèm theo': (d.tep ?? []).map((f) => f.ten).join('; '),
    }));
    const ws = XLSX.utils.json_to_sheet(dong);
    ws['!cols'] = [8, 12, 12, 18, 12, 30, 60, 30, 20, 45, 40].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${so === 'den' ? 'Sổ đến' : 'Sổ đi'} ${cuaSo === 'bcd' ? 'BCĐ' : 'Thường trực'}`);
    // Thống kê số văn bản theo loại (cả sổ đến và sổ đi trong năm)
    const tat = data?.dong ?? [];
    const tk = THU_TU_LOAI.map((k) => {
      const den = tat.filter((d) => d.loai === k && d.loai_so === 'den').length;
      const di = tat.filter((d) => d.loai === k && d.loai_so === 'di').length;
      return { 'Loại văn bản': LOAI_VB[k], 'Sổ đến': den, 'Sổ đi': di, 'Cộng': den + di };
    }).filter((r) => r['Cộng'] > 0);
    tk.push({ 'Loại văn bản': 'Tổng cộng', 'Sổ đến': dem('den'), 'Sổ đi': dem('di'), 'Cộng': tat.length });
    const ws2 = XLSX.utils.json_to_sheet(tk);
    ws2['!cols'] = [22, 10, 10, 10].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Theo loại');
    const duoi = loai ? `-${khongDau(LOAI_VB[loai]).replace(/\s+/g, '-')}` : '';
    XLSX.writeFile(wb, `so-cong-van-${cuaSo === 'bcd' ? 'bcd' : 'thuong-truc'}-${so === 'den' ? 'den' : 'di'}${duoi}-${nam}.xlsx`);
  };

  if (!duocXem) return <><TieuDeTrang ten="Sổ công văn" /><Rong>Sổ công văn đến, đi do Thường trực Ban Chỉ đạo theo dõi.</Rong></>;
  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;

  return (
    <>
      <TieuDeTrang tren={cuaSo === 'bcd' ? 'Ban Chỉ đạo 57 phường · Cơ quan Thường trực quản lý' : 'Thường trực Ban Chỉ đạo 57 phường'} ten="Sổ công văn"
        phai={<>
          <Nut icon={<FileSpreadsheet className="h-4 w-4" />} onClick={xuatExcel}>Xuất Excel</Nut>
          {quanTri && <Nut kieu="chinh" icon={<Plus className="h-4 w-4" />} onClick={() => setThem(true)}>Vào sổ văn bản</Nut>}
        </>} />
      <div role="tablist" aria-label="Sổ của" className="flex gap-1 self-start rounded-xl border border-vien bg-white p-1">
        {([['bcd', 'Sổ của Ban Chỉ đạo'], ['cqtt', 'Sổ của Cơ quan Thường trực']] as const).map(([k, t]) => (
          <button key={k} role="tab" aria-selected={cuaSo === k} onClick={() => setCuaSo(k)}
            className={cx('h-9 whitespace-nowrap rounded-lg px-3.5 text-[0.8125rem]', cuaSo === k ? 'bg-ink font-semibold text-white' : 'text-mo-2 hover:bg-nen-2')}>{t}</button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex gap-2">
          <div role="tablist" className="grid flex-1 grid-cols-2 rounded-xl bg-[#E7E3D9] p-1 sm:flex-none">
            {([['den', 'Sổ đến'], ['di', 'Sổ đi']] as const).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={so === k} onClick={() => { setSo(k); setLoai(''); }} className={cx('h-10 whitespace-nowrap rounded-lg px-4 text-[0.875rem]', so === k ? 'bg-white font-bold shadow-sm' : 'font-medium text-mo-2')}>{t} <span className="mono text-mo">{dem(k)}</span></button>
            ))}
          </div>
          <select aria-label="Năm" className={cx(lopO, 'min-h-12 w-[104px] shrink-0 bg-white')} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
            {[0, 1, 2].map((i) => new Date().getFullYear() - i).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <label className="relative sm:min-w-52 sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-mo" />
          <input className={cx(lopO, 'w-full bg-white pl-10')} placeholder="Tìm số đến/đi, số ký hiệu, trích yếu, nơi gửi…" value={tim} onChange={(e) => setTim(e.target.value)} aria-label="Tìm trong sổ" />
        </label>
      </div>

      {demLoai.length > 0 && (
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Phân loại văn bản" className="-mx-3.5 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-3.5 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {[['', 'Tất cả', theoSo.length] as const, ...demLoai.map(([k, n]) => [k, LOAI_VB[k], n] as const)].map(([k, t, n]) => (
              <button key={k || 'all'} type="button" onClick={() => setLoai(k)} aria-pressed={loai === k}
                className={cx('flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.8125rem]', loai === k ? 'bg-ink font-semibold text-white' : 'bg-white text-mo-2 hover:bg-nen-3')}>
                {t}<span className={cx('mono text-[11px]', loai === k ? 'text-white/75' : 'text-mo')}>{n}</span>
              </button>
            ))}
          </div>
          {theoLoai && !loai && demLoai.length > 1 && (
            <button type="button" onClick={() => setNhom(!nhom)} aria-pressed={nhom} title="Nhóm sổ theo loại văn bản"
              className={cx('flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[0.8125rem]', nhom ? 'border-ink bg-[#FDF1F0] font-semibold text-ink' : 'border-vien bg-white text-mo-2')}>
              <Layers className="h-4 w-4" /><span className="hidden sm:inline">Nhóm theo loại</span><span className="sm:hidden">Nhóm</span>
            </button>
          )}
        </div>
      )}

      {ds.length === 0 ? <Rong>{theoSo.length ? 'Không có văn bản thuộc loại này.' : 'Sổ chưa có văn bản.'}</Rong>
        : nhomLoai && !loai ? nhomDs.map(([k, r]) => (
          <section key={k} className="flex flex-col gap-2">
            <h2 className="m-0 flex items-center gap-2 px-1 text-[0.875rem] font-bold text-den"><NhanLoai l={k} /><span className="mono text-xs font-medium text-mo">{r.length} văn bản</span></h2>
            <BangSo ds={r} so={so} chon={setChon} anLoai />
          </section>
        ))
        : <BangSo ds={dsLoc} so={so} chon={setChon} anLoai={!!loai} />}

      <ChiTietSo d={chon} cuaSo={cuaSo} dong={() => setChon(null)} xong={() => { setChon(null); void taiLai(); }} />
      {quanTri && cuaSo === 'bcd' && them && <HopVaoSoBcd so={so} chuSo={data?.chuSo ?? ''} dong={() => setThem(false)} xong={() => { setThem(false); void taiLai(); }} />}
      {quanTri && cuaSo === 'cqtt' && <FormVanBan mo={them} dong={() => setThem(false)} dau={{ thu_muc: so === 'den' ? 'cap_tren_cong_an_tinh' : 'bcd_phuong_ban_hanh', loai: 'cong_van' }}
        thuMucChoPhep={(Object.keys(THU_MUC) as ThuMuc[]).filter((k) => SO_THEO_THU_MUC(k) === so)}
        xong={() => { setThem(false); void taiLai(); }} />}
    </>
  );
}

function BangSo({ ds, so, chon, anLoai }: { ds: Dong[]; so: 'den' | 'di'; chon: (d: Dong) => void; anLoai?: boolean }) {
  return (
    <The className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-[0.8125rem]">
          <thead className="bg-nen-2 text-left text-[11px] tracking-wide text-mo">
            <tr>
              <th className="px-4 py-3">{so === 'den' ? 'SỐ ĐẾN' : 'SỐ ĐI'}</th><th className="px-2">{so === 'den' ? 'NGÀY ĐẾN' : 'NGÀY GỬI'}</th>
              {!anLoai && <th className="px-2">LOẠI</th>}
              <th className="px-2">SỐ, KÝ HIỆU · NGÀY</th><th className="px-2">TRÍCH YẾU</th>
              <th className="px-2">{so === 'den' ? 'NƠI GỬI' : 'NƠI NHẬN'}</th><th className="px-2">NGƯỜI KÝ</th><th className="px-4">TỆP</th>
            </tr>
          </thead>
          <tbody>
            {ds.map((d) => {
              const link = d.drive_url || linkXemDrive(d.drive_file_id);
              return (
                <tr key={d.id} onClick={() => chon(d)} className="cursor-pointer border-t border-[#F1EEE7] align-top hover:bg-nen-2">
                  <td className="so px-4 py-3 text-base font-bold leading-5">{d.so_thu_tu}</td>
                  <td className="so whitespace-nowrap px-2 py-3">{ngay(d.ngay)}</td>
                  {!anLoai && <td className="px-2 py-3"><NhanLoai l={d.loai} /></td>}
                  <td className="px-2 py-3"><div className="so font-semibold">{d.so_ky_hieu ?? '—'}</div><div className="whitespace-nowrap text-xs text-mo">{d.ngay_ban_hanh ? ngay(d.ngay_ban_hanh) : ''}</div></td>
                  <td className="max-w-md px-2 py-3">{d.trich_yeu}{d.ky_ten && <div className="mt-0.5 text-xs text-xanh">Báo cáo kỳ: {d.ky_ten}</div>}</td>
                  <td className="px-2 py-3">{(so === 'den' ? d.noi_gui : d.noi_nhan) ?? '—'}</td>
                  <td className="px-2 py-3">{d.nguoi_ky ?? '—'}</td>
                  <td className="px-4 py-3">{link && !String(d.drive_file_id ?? '').startsWith('thu-') ? <button type="button" onClick={(e) => { e.stopPropagation(); void moTepDrive('van_ban', d.van_ban_id, d.ten_tep ?? `${d.so_ky_hieu ?? 'van-ban'}.pdf`, 'xem', d.drive_url); }} aria-label="Mở tệp" className="inline-flex min-h-9 items-center text-[#8E1B22]"><ExternalLink className="h-4 w-4" /></button> : <span className="text-mo">—</span>}{(d.tep?.length ?? 0) > 0 && <span className="ml-2 text-xs" title="Tài liệu kèm theo"><DemTepKem n={d.tep!.length} /></span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="m-0 flex list-none flex-col p-0 md:hidden">
        {ds.map((d) => (
          <li key={d.id} className="border-b border-[#F1EEE7] last:border-0">
            <button onClick={() => chon(d)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-nen-2">
              <span className={cx('mono flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none', so === 'den' ? 'bg-xanh-nhat text-xanh' : 'bg-[#FDF1F0] text-ink')}>
                <span className="text-[1.0625rem] font-bold">{d.so_thu_tu}</span><span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wide">{so === 'den' ? 'đến' : 'đi'}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2 text-xs text-mo">{!anLoai && <NhanLoai l={d.loai} />}<b className="mono truncate text-den">{d.so_ky_hieu ?? '—'}</b><span className="shrink-0">· {ngay(d.ngay)}</span></span>
                <span className="line-clamp-3 text-[0.875rem] font-semibold leading-snug">{d.trich_yeu}</span>
                <span className="truncate text-xs text-mo">{so === 'den' ? `Từ: ${d.noi_gui ?? '—'}` : `Gửi: ${d.noi_nhan ?? '—'}`}{d.ghi_chu ? ` · ${d.ghi_chu}` : ''}</span>
                {(d.ky_ten || (d.tep?.length ?? 0) > 0) && <span className="flex items-center gap-2 text-xs text-mo">{d.ky_ten && <span className="truncate text-xanh">Báo cáo kỳ: {d.ky_ten}</span>}<DemTepKem n={d.tep?.length ?? 0} /></span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </The>
  );
}

function ChiTietSo({ d, cuaSo, dong, xong }: { d: Dong | null; cuaSo: 'bcd' | 'cqtt'; dong: () => void; xong: () => void }) {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  const [sua, setSua] = useState(false);
  const [g, setG] = useState({ so_thu_tu: '', ngay: '', noi: '', ghi_chu: '' });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const [vbSua, setVbSua] = useState<VanBan | null>(null);
  const [dCu, setDCu] = useState<Dong | null>(null);
  if (d !== dCu) {
    setDCu(d); setSua(false); setLoi(null); setVbSua(null);
    setG({ so_thu_tu: String(d?.so_thu_tu ?? ''), ngay: d?.ngay ?? '', noi: (d?.loai_so === 'den' ? d?.noi_gui : d?.noi_nhan) ?? '', ghi_chu: d?.ghi_chu ?? '' });
  }
  if (!d) return null;
  const den = d.loai_so === 'den';
  const vb: VanBanDaNop = { id: d.van_ban_id, so_van_ban: null, ky_hieu: null, so_ky_hieu: d.so_ky_hieu, ngay_ban_hanh: d.ngay_ban_hanh, trich_yeu: d.trich_yeu, loai: d.loai,
    nguoi_ky: d.nguoi_ky, chuc_vu_nguoi_ky: d.chuc_vu_nguoi_ky, co_quan_ban_hanh: d.co_quan_ban_hanh, drive_file_id: d.drive_file_id, drive_url: d.drive_url, ten_tep: d.ten_tep };
  const luu = async () => {
    setLoi(null);
    const so = Number(g.so_thu_tu);
    if (quanTri && sua) {
      if (!Number.isInteger(so) || so < 1) { setLoi(`Nhập ${den ? 'số đến' : 'số đi'} là số nguyên dương`); return; }
      if (!g.ngay) { setLoi(`Nhập ${den ? 'ngày đến' : 'ngày gửi'}`); return; }
    }
    setDang(true);
    const capNhat = quanTri && sua
      ? { so_thu_tu: so, ngay: g.ngay, nam: Number(g.ngay.slice(0, 4)), [den ? 'noi_gui' : 'noi_nhan']: g.noi.trim() || null, ghi_chu: g.ghi_chu.trim() || null }
      : { ghi_chu: g.ghi_chu.trim() || null };
    const { error } = await supabase.from('so_van_ban').update(capNhat).eq('id', d.id);
    setDang(false);
    if (error) setLoi(/duplicate|unique/i.test(error.message) ? `${den ? 'Số đến' : 'Số đi'} ${so}/${g.ngay.slice(0, 4)}${cuaSo === 'bcd' ? ` của loại ${LOAI_VB[d.loai] ?? 'Khác'}` : ''} đã có trong sổ — chọn số khác.` : loiDe(error));
    else xong();
  };
  const xoaKhoiSo = async () => {
    if (!window.confirm(`Xoá văn bản "${d.so_ky_hieu ?? d.trich_yeu}" khỏi ${den ? 'sổ đến' : 'sổ đi'}? Văn bản vẫn còn trong kho văn bản.`)) return;
    setDang(true);
    const { error } = await supabase.from('so_van_ban').delete().eq('id', d.id);
    setDang(false);
    if (error) setLoi(loiDe(error)); else xong();
  };
  // Chép dòng sổ Thường trực sang sổ của Ban Chỉ đạo (số đến / đi do hệ thống tự cấp tiếp theo)
  const vaoSoBcd = async () => {
    setDang(true); setLoi(null);
    const bcd = (await supabase.from('don_vi').select('id').eq('loai', 'lanh_dao_bcd').limit(1).maybeSingle()).data?.id as string | undefined;
    if (!bcd) { setDang(false); setLoi('Chưa có đơn vị "Lãnh đạo Ban Chỉ đạo" để làm sổ của Ban Chỉ đạo.'); return; }
    const { error } = await supabase.from('so_van_ban').insert({ don_vi_id: bcd, loai_so: d.loai_so, nam: d.nam, ngay: d.ngay, van_ban_id: d.van_ban_id, noi_gui: d.noi_gui, noi_nhan: d.noi_nhan, ghi_chu: d.ghi_chu });
    setDang(false);
    if (error) setLoi(/duplicate|unique/i.test(error.message) ? 'Văn bản đã có trong sổ của Ban Chỉ đạo.' : loiDe(error)); else xong();
  };
  const moSuaVb = async () => {
    setLoi(null);
    const { data, error } = await supabase.from('van_ban').select(COT_VB).eq('id', d.van_ban_id).maybeSingle();
    if (error || !data) setLoi(error ? loiDe(error) : 'Không mở được văn bản'); else setVbSua(data as unknown as VanBan);
  };
  return (
    <>
      <HopThoai mo dong={dong} tieuDe={`${den ? 'Số đến' : 'Số đi'} ${d.so_thu_tu}/${d.nam} · ${LOAI_VB[d.loai] ?? 'Khác'}`} rong="max-w-[900px]">
        <div className="flex flex-col gap-4">
          {sua ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-vien bg-nen-2 p-3 sm:p-4">
              <div className="flex items-center gap-2 text-[0.8125rem] font-bold text-den"><Pencil className="h-4 w-4" />Sửa thông tin vào sổ</div>
              <div className="grid grid-cols-2 gap-3">
                <O nhan={cuaSo === 'bcd' ? `${den ? 'Số đến' : 'Số đi'} (${LOAI_VB[d.loai] ?? 'Khác'})` : (den ? 'Số đến' : 'Số đi')}><input inputMode="numeric" className={lopO} value={g.so_thu_tu} onChange={(e) => setG({ ...g, so_thu_tu: e.target.value.replace(/\D/g, '') })} /></O>
                <O nhan={den ? 'Ngày đến' : 'Ngày gửi'}><input type="date" className={lopO} value={g.ngay} onChange={(e) => setG({ ...g, ngay: e.target.value })} /></O>
              </div>
              <O nhan={den ? 'Nơi gửi' : 'Nơi nhận'}><input className={lopO} value={g.noi} onChange={(e) => setG({ ...g, noi: e.target.value })} /></O>
              <O nhan="Ghi chú (xử lý, chuyển…)"><input className={lopO} value={g.ghi_chu} onChange={(e) => setG({ ...g, ghi_chu: e.target.value })} /></O>
              <p className="m-0 text-xs text-mo">Số, ký hiệu, trích yếu, người ký… sửa ở <button type="button" onClick={() => void moSuaVb()} className="font-semibold text-[#8E1B22] underline">thông tin văn bản</button>.</p>
            </div>
          ) : (
            <ThongTinVanBan vb={vb} them={<>
              <dt className="text-mo">{den ? 'Nơi gửi' : 'Nơi nhận'}</dt><dd className="m-0">{(den ? d.noi_gui : d.noi_nhan) ?? '—'}</dd>
              <dt className="text-mo">{den ? 'Ngày đến' : 'Ngày gửi'}</dt><dd className="so m-0">{ngay(d.ngay)}</dd>
              {d.ky_ten && <><dt className="text-mo">Kỳ báo cáo</dt><dd className="m-0">{d.ky_ten}</dd></>}
            </>} />
          )}
          {!sua && <DsTepKem tep={d.tep} />}
          {!sua && <O nhan="Ghi chú (xử lý, chuyển…)"><input className={lopO} readOnly={!quanTri} value={g.ghi_chu} onChange={(e) => setG({ ...g, ghi_chu: e.target.value })} /></O>}
          {loi && <HopLoi loi={loi} />}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {quanTri && !sua && <>
              <Nut icon={<Pencil className="h-4 w-4" />} onClick={() => setSua(true)}>Sửa sổ</Nut>
              <Nut icon={<FilePen className="h-4 w-4" />} onClick={() => void moSuaVb()}>Sửa văn bản</Nut>
              {cuaSo === 'cqtt' && <Nut icon={<BookPlus className="h-4 w-4" />} dangChay={dang} onClick={() => void vaoSoBcd()}>Vào sổ Ban Chỉ đạo</Nut>}
              <Nut kieu="nguy" icon={<Trash2 className="h-4 w-4" />} dangChay={dang} onClick={() => void xoaKhoiSo()}>Xoá khỏi sổ</Nut>
            </>}
            <span className="hidden flex-1 sm:block" />
            <Nut onClick={sua ? () => setSua(false) : dong}>{sua ? 'Huỷ sửa' : 'Đóng'}</Nut>
            {quanTri && <Nut kieu="chinh" dangChay={dang} onClick={() => void luu()}>{sua ? 'Lưu thay đổi' : 'Lưu ghi chú'}</Nut>}
          </div>
        </div>
      </HopThoai>
      {vbSua && <FormVanBan mo vb={vbSua} dong={() => setVbSua(null)} xong={() => { setVbSua(null); xong(); }} daXoa={() => { setVbSua(null); xong(); }} />}
    </>
  );
}

// Vào sổ của Ban Chỉ đạo: chọn văn bản trong kho (hoặc tải văn bản mới), số đến / đi hệ thống tự cấp nếu để trống
type VbChon = { id: string; so_ky_hieu: string | null; trich_yeu: string; co_quan_ban_hanh: string; ngay_ban_hanh: string | null; loai: LoaiVb };
function HopVaoSoBcd({ so, chuSo, dong, xong }: { so: 'den' | 'di'; chuSo: string; dong: () => void; xong: () => void }) {
  const den = so === 'den';
  const homNay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [tim, setTim] = useState('');
  const [vb, setVb] = useState<VbChon | null>(null);
  const [g, setG] = useState({ so: '', ngay: homNay, noi: '', ghi_chu: '' });
  const [taiMoi, setTaiMoi] = useState(false);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const ds = useDuLieu(async () => (kq(await supabase.from('van_ban').select('id, so_ky_hieu, trich_yeu, co_quan_ban_hanh, ngay_ban_hanh, loai').order('ngay_ban_hanh', { ascending: false, nullsFirst: false }).limit(500)) ?? []) as VbChon[], []);
  const loc = useMemo(() => { const t = khongDau(tim.trim()); return (ds.data ?? []).filter((v) => !t || khongDau(`${v.so_ky_hieu ?? ''} ${v.trich_yeu} ${v.co_quan_ban_hanh}`).includes(t)).slice(0, 40); }, [ds.data, tim]);
  const chonVb = (v: VbChon) => { setVb(v); if (den && !g.noi) setG((x) => ({ ...x, noi: v.co_quan_ban_hanh })); };
  const luu = async () => {
    if (!vb) { setLoi('Chọn văn bản cần vào sổ'); return; }
    if (!chuSo) { setLoi('Chưa có đơn vị "Lãnh đạo Ban Chỉ đạo" để làm sổ của Ban Chỉ đạo.'); return; }
    const soTT = g.so ? Number(g.so) : null;
    if (g.so && (!Number.isInteger(soTT) || soTT! < 1)) { setLoi(`${den ? 'Số đến' : 'Số đi'} phải là số nguyên dương`); return; }
    setDang(true); setLoi(null);
    const { error } = await supabase.from('so_van_ban').insert({
      don_vi_id: chuSo, loai_so: so, nam: Number(g.ngay.slice(0, 4)), ngay: g.ngay, van_ban_id: vb.id,
      [den ? 'noi_gui' : 'noi_nhan']: g.noi.trim() || null, ghi_chu: g.ghi_chu.trim() || null, ...(soTT ? { so_thu_tu: soTT } : {}),
    });
    setDang(false);
    if (error) setLoi(/duplicate|unique/i.test(error.message) ? `Số này (loại ${LOAI_VB[vb.loai] ?? 'Khác'}) hoặc văn bản này đã có trong sổ — kiểm tra lại.` : loiDe(error)); else xong();
  };
  return (
    <>
      <HopThoai mo dong={dong} tieuDe={`Vào ${den ? 'sổ đến' : 'sổ đi'} của Ban Chỉ đạo`} rong="max-w-2xl">
        <div className="flex flex-col gap-3.5">
          {vb ? (
            <div className="flex items-start gap-3 rounded-xl border border-vien bg-nen-2 p-3">
              <div className="flex min-w-0 flex-1 flex-col"><span className="flex items-center gap-2"><NhanLoai l={vb.loai} /><b className="so text-[0.875rem]">{vb.so_ky_hieu ?? '—'}</b></span><span className="text-[0.875rem] leading-snug">{vb.trich_yeu}</span><span className="text-xs text-mo">{vb.co_quan_ban_hanh}</span></div>
              <Nut onClick={() => setVb(null)}>Đổi</Nut>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-mo" />
                  <input autoFocus className={cx(lopO, 'w-full pl-10')} placeholder="Tìm văn bản trong kho: số, ký hiệu, trích yếu" value={tim} onChange={(e) => setTim(e.target.value)} /></label>
                <Nut icon={<Plus className="h-4 w-4" />} onClick={() => setTaiMoi(true)} ngan="Tải lên">Tải văn bản mới</Nut>
              </div>
              <ul className="m-0 flex max-h-72 list-none flex-col overflow-y-auto rounded-xl border border-vien p-0">
                {ds.dangTai && <li className="p-3 text-sm text-mo">Đang tải…</li>}
                {!ds.dangTai && loc.length === 0 && <li className="p-3 text-sm text-mo">Không thấy văn bản. Bấm “Tải văn bản mới”.</li>}
                {loc.map((v) => (
                  <li key={v.id} className="border-b border-[#F1EEE7] last:border-0"><button onClick={() => chonVb(v)} className="flex w-full flex-col px-3 py-2 text-left hover:bg-nen-2">
                    <span className="text-[0.8125rem]"><b className="so">{v.so_ky_hieu ?? '—'}</b> · {v.trich_yeu}</span><span className="text-xs text-mo">{v.co_quan_ban_hanh}</span></button></li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <O nhan={den ? 'Số đến' : 'Số đi'} goiY={vb ? `Để trống: tự cấp số ${LOAI_VB[vb.loai] ?? 'Khác'} tiếp theo` : 'Để trống: tự cấp số tiếp theo của loại văn bản'}><input inputMode="numeric" className={lopO} value={g.so} onChange={(e) => setG({ ...g, so: e.target.value.replace(/\D/g, '') })} /></O>
            <O nhan={den ? 'Ngày đến' : 'Ngày gửi'}><input type="date" className={lopO} value={g.ngay} onChange={(e) => setG({ ...g, ngay: e.target.value })} /></O>
          </div>
          <O nhan={den ? 'Nơi gửi' : 'Nơi nhận'}><input className={lopO} value={g.noi} onChange={(e) => setG({ ...g, noi: e.target.value })} /></O>
          <O nhan="Ghi chú (xử lý, chuyển…)"><input className={lopO} value={g.ghi_chu} onChange={(e) => setG({ ...g, ghi_chu: e.target.value })} /></O>
          {loi && <HopLoi loi={loi} />}
          <div className="flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" dangChay={dang} onClick={() => void luu()}>Vào sổ</Nut></div>
        </div>
      </HopThoai>
      {taiMoi && <FormVanBan mo dong={() => setTaiMoi(false)} dau={{ thu_muc: den ? 'cap_tren_tinh' : 'bcd_phuong_ban_hanh', loai: 'cong_van' }}
        xong={async (id) => {
          setTaiMoi(false);
          // Văn bản mới tải từ hộp của Ban Chỉ đạo: hệ thống tự ghi thêm vào sổ Thường trực -> gỡ để hai sổ độc lập
          const tt = (await supabase.rpc('don_vi_thuong_truc')).data as string | null;
          if (tt) await supabase.from('so_van_ban').delete().eq('van_ban_id', id).eq('don_vi_id', tt);
          const r = await supabase.from('van_ban').select('id, so_ky_hieu, trich_yeu, co_quan_ban_hanh, ngay_ban_hanh, loai').eq('id', id).maybeSingle();
          if (r.data) chonVb(r.data as VbChon); void ds.taiLai();
        }} />}
    </>
  );
}
