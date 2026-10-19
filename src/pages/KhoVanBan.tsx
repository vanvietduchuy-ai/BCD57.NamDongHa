import { useMemo, useState } from 'react';
import { CalendarDays, Check, Download, Link2, Unlink, Folder, FolderOpen, MapPin, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useManRong } from '../lib/manHinh';
import { loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { useAuth, laQuanTri } from '../lib/auth';
import { ngay } from '../lib/dinhDang';
import { khongDau } from '../lib/nhiemVu';
import { moTepDrive } from '../components/TepDrive';
import { COT_VB, linkVb, LOAI_VB, THU_MUC, TT_VB, xoaVanBan, type LoaiVb, type ThuMuc, type VanBan } from '../lib/vanBan';
import { CHUA_XEP, dinhKemPhien, docHoSoHop, sapXepPhien, suaHoSoHop, THANH_PHAN_HOP, type PhienHopKho } from '../lib/phienHop';
import { Chip, DangTai, HopLoi, HopThoai, lopO, Nut, O, Rong, The, cx } from '../components/ui';
import FormVanBan from '../components/FormVanBan';

export default function KhoVanBan() {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  const { data, loi, dangTai, taiLai } = useDuLieu(async () => {
    const [a, b, hh] = await Promise.all([
      supabase.from('van_ban').select(COT_VB).order('ngay_ban_hanh', { ascending: false, nullsFirst: true }).order('tai_len_luc', { ascending: false }),
      supabase.from('nhiem_vu').select('can_cu_van_ban_id').not('can_cu_van_ban_id', 'is', null),
      docHoSoHop(),
    ]);
    const dem: Record<string, number> = {};
    for (const x of (b.data ?? []) as { can_cu_van_ban_id: string }[]) dem[x.can_cu_van_ban_id] = (dem[x.can_cu_van_ban_id] ?? 0) + 1;
    return { vb: kq(a) as unknown as VanBan[], dem, hh };
  }, []);

  const rong = useManRong();
  const [thuMuc, setThuMuc] = useState<ThuMuc | 'cap_tren' | ''>('');
  const [loai, setLoai] = useState<LoaiVb | ''>('');
  const [tim, setTim] = useState('');
  const [phien, setPhien] = useState('');            // phiên họp đang xem trong thư mục Hồ sơ họp BCĐ ('' = cả thư mục)
  const [suaPhien, setSuaPhien] = useState<PhienHopKho | 'moi' | null>(null);
  const [hetHl, setHetHl] = useState(false);
  const [form, setForm] = useState<{ vb?: VanBan } | null>(null);
  const [chonId, setChonId] = useState<string | null>(null);
  const [dangXoa, setDangXoa] = useState<string | null>(null);
  const [tb, setTb] = useState<string | null>(null);
  const xoa = async (v: VanBan) => {
    if (!window.confirm(`Xoá văn bản "${v.so_ky_hieu ?? v.trich_yeu}"?\n\nVăn bản bị gỡ khỏi sổ công văn, bỏ liên kết căn cứ / minh chứng nhiệm vụ; tệp trên Google Drive chuyển vào thùng rác.`)) return;
    setDangXoa(v.id); setTb(null);
    try { await xoaVanBan(v.id); setChonId(null); setTb(`Đã xoá văn bản ${v.so_ky_hieu ?? ''}.`); void taiLai(); }
    catch (e) { setTb(loiDe(e)); } finally { setDangXoa(null); }
  };

  const phienCua = (v: VanBan) => { const p = data?.hh.vb[v.id]; return p && data?.hh.ds.some((x) => x.id === p) ? p : CHUA_XEP; };
  // Văn bản đính kèm vào phiên (văn bản có sẵn ở thư mục khác, hoặc của phiên khác)
  const kemCua = (pid: string) => new Set(data?.hh.kem[pid] ?? []);
  const trongPhien = (v: VanBan, pid: string) => (v.thu_muc === 'hop_bcd' && phienCua(v) === pid) || kemCua(pid).has(v.id);
  const laKem = (v: VanBan, pid: string) => !(v.thu_muc === 'hop_bcd' && phienCua(v) === pid) && kemCua(pid).has(v.id);
  const hop = (v: VanBan, tm: ThuMuc | 'cap_tren' | '') => !tm || (tm === 'cap_tren' ? v.thu_muc.startsWith('cap_tren')
    : tm === 'hop_bcd' && phien && phien !== CHUA_XEP ? trongPhien(v, phien)
    : v.thu_muc === tm && (tm !== 'hop_bcd' || !phien || phienCua(v) === phien));
  const [moKem, setMoKem] = useState(false);
  const boKem = async (v: VanBan, pid: string) => {
    try { await dinhKemPhien(pid, [], [v.id]); setTb(`Đã bỏ đính kèm ${v.so_ky_hieu ?? v.trich_yeu} khỏi phiên họp.`); void taiLai(); }
    catch (e) { setTb(loiDe(e)); }
  };
  const conHl = (v: VanBan) => hetHl || v.trang_thai !== 'het_hieu_luc';
  const ds = useMemo(() => {
    const t = khongDau(tim.trim());
    return (data?.vb ?? []).filter((v) => hop(v, thuMuc) && (!loai || v.loai === loai) && conHl(v)
      && (!t || khongDau(`${v.so_ky_hieu ?? ''} ${v.trich_yeu} ${v.co_quan_ban_hanh} ${v.nguoi_ky ?? ''} ${v.ghi_chu ?? ''}`).includes(t)));
  }, [data, thuMuc, phien, loai, tim, hetHl]); // eslint-disable-line react-hooks/exhaustive-deps
  const cacLoai = useMemo(() => [...new Set((data?.vb ?? []).filter((v) => hop(v, thuMuc) && conHl(v)).map((v) => v.loai))], [data, thuMuc, phien, hetHl]); // eslint-disable-line react-hooks/exhaustive-deps
  const vbChon = rong ? (ds.find((v) => v.id === chonId) ?? ds[0] ?? null) : null;

  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;

  const nutTM = (k: ThuMuc | 'cap_tren' | '', ten: string, con = false, ph = '', dem?: number) => (
    <button key={(k || 'all') + ph} title={ten} onClick={() => { setThuMuc(k); setPhien(ph); setLoai(''); }} aria-pressed={thuMuc === k && phien === ph}
      className={cx('flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-left text-[0.8438rem] lg:w-full', con && 'lg:pl-8',
        thuMuc === k && phien === ph ? 'bg-white font-semibold text-den shadow-sm max-lg:bg-ink max-lg:text-white' : 'bg-white text-mo-2 hover:bg-white/70 lg:bg-transparent')}>
      {ph ? <FolderOpen className="h-4 w-4 shrink-0" strokeWidth={1.8} /> : <Folder className="h-4 w-4 shrink-0" strokeWidth={1.8} />}<span className="min-w-0 flex-1 whitespace-nowrap lg:truncate">{ten}</span>
      {dem !== undefined && <span className="mono text-[0.7188rem] text-mo">{dem}</span>}
    </button>
  );
  // Hồ sơ họp BCĐ: mỗi phiên họp là một thư mục con
  const dsPhien = sapXepPhien(data?.hh.ds ?? []);
  const vbHop = (data?.vb ?? []).filter((v) => v.thu_muc === 'hop_bcd' && conHl(v));
  const soChuaXep = vbHop.filter((v) => phienCua(v) === CHUA_XEP).length;
  const phienChon = thuMuc === 'hop_bcd' && phien && phien !== CHUA_XEP ? dsPhien.find((p) => p.id === phien) ?? null : null;
  const thuMucHop = <>
    {nutTM('hop_bcd', THU_MUC.hop_bcd)}
    {dsPhien.map((p) => nutTM('hop_bcd', p.ten, true, p.id, (data?.vb ?? []).filter((v) => conHl(v) && trongPhien(v, p.id)).length))}
    {soChuaXep > 0 && nutTM('hop_bcd', 'Chưa xếp phiên họp', true, CHUA_XEP, soChuaXep)}
    {quanTri && <button key="them-phien" onClick={() => setSuaPhien('moi')}
      className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl border border-dashed border-vien-2 bg-white px-3 text-left text-[0.8125rem] font-semibold text-[#8E1B22] hover:bg-white/70 lg:w-full lg:border-0 lg:bg-transparent lg:pl-8">
      <Plus className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Tạo phiên họp</span></button>}
  </>;
  const xoaPhien = async (p: PhienHopKho) => {
    const n = vbHop.filter((v) => phienCua(v) === p.id).length;   // văn bản đính kèm từ thư mục khác chỉ bỏ liên kết
    if (!window.confirm(`Xoá phiên họp "${p.ten}"?${n ? `\n\n${n} văn bản của phiên chuyển sang "Chưa xếp phiên họp" (không xoá văn bản).` : ''}`)) return;
    try {
      await suaHoSoHop((h) => ({ ds: h.ds.filter((x) => x.id !== p.id), vb: Object.fromEntries(Object.entries(h.vb).filter(([, v]) => v !== p.id)), kem: Object.fromEntries(Object.entries(h.kem).filter(([k]) => k !== p.id)) }));
      setPhien(''); setTb(`Đã xoá phiên họp ${p.ten}.`); void taiLai();
    } catch (e) { setTb(loiDe(e)); }
  };
  const moVb = (v: VanBan) => void moTepDrive('van_ban', v.id, v.ten_tep ?? `${v.so_ky_hieu ?? 'van-ban'}.pdf`, 'xem', v.drive_url);

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[min(100%,240px)] flex-1 flex-col gap-0.5">
          <span className="text-[0.8125rem] text-mo">Lưu trữ · đồng bộ Google Drive</span>
          <h1 className="m-0 text-[1.375rem] font-extrabold tracking-tight md:text-[1.625rem]">Kho văn bản</h1>
        </div>
        <div className="flex w-full gap-2 sm:contents">
        <label className="relative min-w-0 flex-1 sm:w-[340px] sm:flex-none">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-[18px] w-[18px] text-mo" />
          <input className="h-11 w-full rounded-xl border border-vien bg-white pl-10 pr-3 text-base outline-none focus:border-xanh sm:text-sm" placeholder="Số ký hiệu, trích yếu, nội dung" value={tim} onChange={(e) => setTim(e.target.value)} aria-label="Tìm văn bản" />
        </label>
        {quanTri && <Nut kieu="chinh" className="shrink-0" icon={<Upload className="h-4 w-4" />} onClick={() => setForm({})} ngan="Tải lên">Tải lên văn bản</Nut>}
        </div>
      </header>

      {tb && <div role="status" className="rounded-xl bg-xanh-nhat px-4 py-3 text-sm text-xanh">{tb}</div>}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_330px] 2xl:grid-cols-[236px_minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
          <nav aria-label="Thư mục" className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
            {nutTM('', 'Tất cả văn bản')}
            {nutTM('cap_tren', 'Văn bản cấp trên')}
            {(['cap_tren_trung_uong', 'cap_tren_tinh', 'cap_tren_cong_an_tinh'] as ThuMuc[]).map((k) => nutTM(k, THU_MUC[k], true))}
            {(Object.keys(THU_MUC) as ThuMuc[]).filter((k) => !k.startsWith('cap_tren')).map((k) => k === 'hop_bcd' ? <span key={k} className="contents">{thuMucHop}</span> : nutTM(k, THU_MUC[k]))}
          </nav>
          <div className="hidden rounded-2xl bg-nen-3 px-4 py-3 text-[0.7812rem] leading-relaxed text-mo-2 lg:block">
            Chỉ lưu văn bản thường. Văn bản mật lưu theo quy định bảo vệ bí mật nhà nước, không tải lên hệ thống.
          </div>
          <label className="hidden items-center gap-2 px-1 text-[0.7812rem] text-mo lg:flex">
            <input type="checkbox" className="h-4 w-4" checked={hetHl} onChange={(e) => setHetHl(e.target.checked)} /> Hiện cả văn bản hết hiệu lực
          </label>
        </div>

        <The className="flex min-w-0 flex-col overflow-hidden">
          {phienChon && <TheoPhien p={phienChon} ds={(data?.vb ?? []).filter((v) => conHl(v) && trongPhien(v, phienChon.id))} quanTri={quanTri}
            them={() => setForm({})} kem={() => setMoKem(true)} sua={() => setSuaPhien(phienChon)} xoa={() => void xoaPhien(phienChon)} />}
          {thuMuc === 'hop_bcd' && !phien && <div className="border-b border-vien bg-nen-2 px-4 py-2.5 text-[0.8125rem] text-mo-2">
            Hồ sơ họp được lập theo từng phiên họp — chọn phiên họp ở danh mục thư mục{quanTri ? ' hoặc bấm “Tạo phiên họp”' : ''}.</div>}
          <div className="flex flex-wrap gap-2 border-b border-vien p-4">
            {[['', 'Tất cả'] as [LoaiVb | '', string], ...cacLoai.map((k) => [k, LOAI_VB[k]] as [LoaiVb, string])].map(([k, t]) => (
              <button key={k || 'all'} type="button" onClick={() => setLoai(k)} aria-pressed={loai === k}
                className={cx('min-h-8 rounded-full px-3 text-[0.8125rem]', loai === k ? 'bg-ink font-semibold text-white' : 'bg-nen text-mo-2 hover:bg-nen-3')}>{t}</button>
            ))}
          </div>
          {ds.length === 0 ? <div className="p-4"><Rong>Không có văn bản phù hợp.</Rong></div> : (
            <ul className="flex flex-col">
              {ds.map((v) => {
                const tenPhien = thuMuc === 'hop_bcd' && !phien ? dsPhien.find((p) => p.id === phienCua(v))?.ten : undefined;
                const kem = !!phienChon && laKem(v, phienChon.id);
                const hangNut = quanTri && (!rong || kem);
                const c = CHIP_LOAI(v);
                const dangXem = vbChon?.id === v.id;
                return (
                  <li key={v.id}>
                    <button type="button" onClick={() => (rong ? setChonId(v.id) : linkVb(v) ? moVb(v) : quanTri && setForm({ vb: v }))}
                      className={cx('grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-[#F1EEE7] px-4 py-3 text-left transition-colors sm:grid-cols-[120px_minmax(0,1fr)_auto]',
                        dangXem ? 'bg-[#FDF1F0] shadow-[inset_3px_0_0_var(--color-ink)]' : 'hover:bg-nen-2', v.trang_thai === 'het_hieu_luc' && 'opacity-60', hangNut && 'border-b-0 pb-1')}>
                      <span className="mono col-span-2 flex gap-2 text-[0.75rem] leading-snug text-mo-2 sm:col-span-1 sm:flex-col sm:gap-0">
                        <b className="font-bold text-den">{v.so_ky_hieu ?? '…'}</b><span>{v.ngay_ban_hanh ? ngay(v.ngay_ban_hanh) : '…'}</span>
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="line-clamp-2 text-[0.875rem] font-semibold leading-snug text-den sm:line-clamp-1">{v.trich_yeu}</span>
                        <span className="truncate text-[0.7812rem] text-mo">{kem && <span className="mr-1 inline-flex items-center gap-1 rounded bg-[#E0E7FF] px-1.5 font-semibold text-[#3730A3]"><Link2 className="h-3 w-3" />Đính kèm · {v.thu_muc === 'hop_bcd' ? 'phiên khác' : THU_MUC[v.thu_muc]}</span>}{v.co_quan_ban_hanh}{tenPhien && <> · <b className="font-semibold text-[#8E1B22]">{tenPhien}</b></>}</span>
                      </span>
                      <Chip nen={c[0]} chu={c[1]}>{c[2]}</Chip>
                    </button>
                    {hangNut && <div className="-mt-px flex justify-end gap-1 border-b border-[#F1EEE7] px-3 pb-1.5">
                      {kem && <button type="button" onClick={() => void boKem(v, phienChon!.id)} className="mr-auto flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-[#3730A3] hover:bg-[#EEF2FF]"><Unlink className="h-3.5 w-3.5" />Bỏ khỏi phiên</button>}
                      {!rong && <><button type="button" onClick={() => setForm({ vb: v })} className="flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-mo-2 hover:bg-nen"><Pencil className="h-3.5 w-3.5" />Sửa</button>
                      <button type="button" onClick={() => void xoa(v)} className="flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-nguy hover:bg-nguy-nhat"><Trash2 className="h-3.5 w-3.5" />Xoá</button></>}
                    </div>}
                  </li>
                );
              })}
            </ul>
          )}
        </The>

        {vbChon && (
          <The className="sticky top-6 hidden max-h-[calc(100vh-3rem)] flex-col overflow-hidden xl:flex">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
              <div className="flex h-36 items-center justify-center rounded-2xl bg-nen">
                <div className="flex h-28 w-20 flex-col gap-1.5 rounded bg-white p-3 shadow-sm">
                  <span className="mx-auto mb-1 h-1 w-8 rounded bg-den" />
                  {[1, 2, 3, 4, 5].map((i) => <span key={i} className={cx('h-0.5 rounded bg-vien-2', i === 5 ? 'w-2/3' : 'w-full')} />)}
                </div>
              </div>
              <span className="mono pt-1 text-[0.7812rem] font-bold text-do">{vbChon.so_ky_hieu ?? 'Chưa có số'}{vbChon.ngay_ban_hanh ? ` · ${ngay(vbChon.ngay_ban_hanh)}` : ''}</span>
              <h2 className="-mt-1 m-0 text-[1.125rem] font-bold leading-snug">{vbChon.trich_yeu}</h2>
              <span className="-mt-1 text-[0.8125rem] text-mo">{vbChon.co_quan_ban_hanh} · {LOAI_VB[vbChon.loai]}</span>
              <dl className="m-0 grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[0.8125rem]">
                {([['Thư mục', vbChon.thu_muc.startsWith('cap_tren') ? `Văn bản cấp trên / ${THU_MUC[vbChon.thu_muc]}`
                    : vbChon.thu_muc === 'hop_bcd' ? `${THU_MUC.hop_bcd} / ${dsPhien.find((p) => p.id === phienCua(vbChon))?.ten ?? 'Chưa xếp phiên họp'}` : THU_MUC[vbChon.thu_muc]],
                   ['Tệp', vbChon.ten_tep ?? (linkVb(vbChon) ? 'Google Drive' : 'Chưa có tệp')],
                   ['Người ký', vbChon.nguoi_ky ?? '—'], ['Tải lên', ngay(vbChon.tai_len_luc)], ['Trạng thái', TT_VB[vbChon.trang_thai].nhan],
                   ...(vbChon.ghi_chu ? [['Ghi chú', vbChon.ghi_chu]] : [])] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-mo">{k}</dt><dd className="m-0 min-w-0 break-words">{v}</dd></div>
                ))}
              </dl>
              {quanTri && (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[0.8438rem] font-bold">Liên kết</span>
                  <span className="flex items-start gap-2 rounded-xl bg-nen px-3 py-2 text-[0.8125rem]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-xanh" />{data?.dem[vbChon.id] ? `Căn cứ của ${data.dem[vbChon.id]} nhiệm vụ BCĐ` : 'Chưa là căn cứ của nhiệm vụ nào'}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 border-t border-vien p-4">
              {linkVb(vbChon)
                ? <Nut kieu="chinh" className="flex-1" onClick={() => moVb(vbChon)}>Mở trên Google Drive</Nut>
                : <span className="flex-1 self-center text-[0.8125rem] text-mo">Chưa gắn tệp Google Drive.</span>}
              {linkVb(vbChon) && <Nut aria-label="Tải về" title="Tải về" className="px-3" onClick={() => void moTepDrive('van_ban', vbChon.id, vbChon.ten_tep ?? `${vbChon.so_ky_hieu ?? 'van-ban'}.pdf`, 'tai', vbChon.drive_url)}><Download className="h-4 w-4" /></Nut>}
              {quanTri && <Nut aria-label="Sửa văn bản" title="Sửa" className="px-3" onClick={() => setForm({ vb: vbChon })}><Pencil className="h-4 w-4" /></Nut>}
              {quanTri && <Nut kieu="nguy" aria-label="Xoá văn bản" title="Xoá" className="px-3" dangChay={dangXoa === vbChon.id} onClick={() => void xoa(vbChon)}><Trash2 className="h-4 w-4" /></Nut>}
            </div>
          </The>
        )}
      </div>

      <FormVanBan mo={!!form} dong={() => setForm(null)} vb={form?.vb} dau={thuMuc && thuMuc !== 'cap_tren' ? { thu_muc: thuMuc } : undefined}
        phienDs={data?.hh.ds ?? []} phienDau={form?.vb ? phienCua(form.vb) : thuMuc === 'hop_bcd' ? phien : ''}
        xong={() => { setForm(null); void taiLai(); }} daXoa={() => { setForm(null); setChonId(null); setTb('Đã xoá văn bản.'); void taiLai(); }} />
      {phienChon && <ChonVanBanCoSan mo={moKem} dong={() => setMoKem(false)} p={phienChon} ds={(data?.vb ?? []).filter((v) => conHl(v) && !trongPhien(v, phienChon.id))}
        tenPhien={(v) => (v.thu_muc === 'hop_bcd' ? dsPhien.find((x) => x.id === phienCua(v))?.ten : undefined)}
        xong={(n) => { setMoKem(false); setTb(`Đã đính kèm ${n} văn bản vào ${phienChon.ten}.`); void taiLai(); }} />}
      <FormPhien p={suaPhien} dong={() => setSuaPhien(null)} xong={(id, ten) => { const moi = suaPhien === 'moi'; setSuaPhien(null); setThuMuc('hop_bcd'); setPhien(id); setTb(moi ? `Đã tạo phiên họp ${ten} — tải lên hồ sơ của phiên.` : 'Đã lưu phiên họp.'); void taiLai(); }} />
    </>
  );
}

// Nhãn loại văn bản có màu theo thiết kế gốc
function CHIP_LOAI(v: VanBan): [string, string, string] {
  if (v.trang_thai === 'du_thao') return ['bg-nen-3', 'text-mo-2', 'Dự thảo'];
  const m: Partial<Record<LoaiVb, [string, string]>> = {
    nghi_quyet: ['bg-nguy-nhat', 'text-nguy'], quyet_dinh: ['bg-xanh-nhat', 'text-xanh'], ke_hoach: ['bg-[#DCFCE7]', 'text-[#166534]'],
    quy_che: ['bg-cam-nhat', 'text-cam-dam'], chi_thi: ['bg-nguy-nhat', 'text-nguy'], ket_luan: ['bg-xanh-nhat', 'text-xanh'],
  };
  const c = m[v.loai] ?? ['bg-nen-3', 'text-mo-2'];
  return [c[0], c[1], LOAI_VB[v.loai]];
}

// Đầu thư mục một phiên họp: thông tin phiên + thành phần hồ sơ đã có / còn thiếu
function TheoPhien({ p, ds, quanTri, them, kem, sua, xoa }: { p: PhienHopKho; ds: VanBan[]; quanTri: boolean; them: () => void; kem: () => void; sua: () => void; xoa: () => void }) {
  const co = new Set(ds.map((v) => v.loai));
  return (
    <div className="flex flex-col gap-2.5 border-b border-vien bg-[#FDF6F5] px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-[#8E1B22]">Hồ sơ phiên họp</span>
        {quanTri && <>
          <button onClick={sua} aria-label="Sửa phiên họp" title="Sửa phiên họp" className="flex h-8 w-8 items-center justify-center rounded-lg text-mo-2 hover:bg-white"><Pencil className="h-4 w-4" /></button>
          <button onClick={xoa} aria-label="Xoá phiên họp" title="Xoá phiên họp" className="flex h-8 w-8 items-center justify-center rounded-lg text-nguy hover:bg-white"><Trash2 className="h-4 w-4" /></button>
        </>}
      </div>
      <div className="-mt-1.5 flex flex-col gap-1">
        <h2 className="m-0 text-[1.0625rem] font-bold leading-snug">{p.ten}</h2>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-mo">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 shrink-0" />{p.ngay ? ngay(p.ngay) : 'Chưa có ngày họp'}</span>
          {p.dia_diem && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" />{p.dia_diem}</span>}
        </span>
        {p.ghi_chu && <span className="whitespace-pre-wrap text-[0.8125rem] text-mo-2">{p.ghi_chu}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Thành phần hồ sơ">
        <span className="mr-1 text-[11.5px] font-semibold text-mo-2">Thành phần:</span>
        {THANH_PHAN_HOP.map(([k, t]) => (
          <span key={k} className={cx('flex h-7 items-center gap-1 rounded-full px-2.5 text-[0.75rem] font-semibold', co.has(k) ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-white text-mo ring-1 ring-vien')}>
            {co.has(k) && <Check className="h-3.5 w-3.5" />}{t}</span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono min-w-0 flex-1 whitespace-nowrap text-xs text-mo">{ds.length} văn bản trong hồ sơ</span>
        {quanTri && <div className="flex gap-2 max-sm:w-full">
          <Nut className="max-sm:flex-1" icon={<Link2 className="h-4 w-4" />} onClick={kem}>Đính kèm văn bản có sẵn</Nut>
          <Nut kieu="chinh" className="max-sm:flex-1" icon={<Upload className="h-4 w-4" />} onClick={them} ngan="Tải lên mới">Tải lên văn bản mới</Nut>
        </div>}
      </div>
    </div>
  );
}

// Tạo / sửa phiên họp (chỉ Cơ quan Thường trực)
function FormPhien({ p, dong, xong }: { p: PhienHopKho | 'moi' | null; dong: () => void; xong: (id: string, ten: string) => void }) {
  const goc = p && p !== 'moi' ? p : null;
  const [g, setG] = useState({ ten: '', ngay: '', dia_diem: '', ghi_chu: '' });
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [moTruoc, setMoTruoc] = useState<typeof p>(null);
  if (p !== moTruoc) {   // mở hộp: nạp lại giá trị
    setMoTruoc(p); setLoi(null);
    setG({ ten: goc?.ten ?? '', ngay: goc?.ngay ?? '', dia_diem: goc?.dia_diem ?? (goc ? '' : 'Hội trường Đảng ủy phường Nam Đông Hà'), ghi_chu: goc?.ghi_chu ?? '' });
  }
  const luu = async () => {
    const ten = g.ten.trim();
    if (!ten) { setLoi('Nhập tên phiên họp'); return; }
    setDangChay(true); setLoi(null);
    const id = goc?.id ?? `ph_${Date.now().toString(36)}`;
    const ban: PhienHopKho = { id, ten, ...(g.ngay ? { ngay: g.ngay } : {}), ...(g.dia_diem.trim() ? { dia_diem: g.dia_diem.trim() } : {}), ...(g.ghi_chu.trim() ? { ghi_chu: g.ghi_chu.trim() } : {}) };
    try {
      await suaHoSoHop((h) => ({ ...h, ds: goc ? h.ds.map((x) => (x.id === id ? ban : x)) : [...h.ds, ban] }));
      xong(id, ten);
    } catch (e) { setLoi(loiDe(e)); } finally { setDangChay(false); }
  };
  return (
    <HopThoai mo={!!p} dong={dong} tieuDe={goc ? 'Sửa phiên họp' : 'Tạo phiên họp'} rong="max-w-xl">
      <div className="flex flex-col gap-3.5">
        <O nhan="Tên phiên họp"><input className={lopO} autoFocus placeholder="VD: Phiên họp định kỳ quý IV/2026" value={g.ten} onChange={(e) => setG({ ...g, ten: e.target.value })} /></O>
        <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
          <O nhan="Ngày họp"><input type="date" className={lopO} value={g.ngay} onChange={(e) => setG({ ...g, ngay: e.target.value })} /></O>
          <O nhan="Địa điểm"><input className={lopO} value={g.dia_diem} onChange={(e) => setG({ ...g, dia_diem: e.target.value })} /></O>
        </div>
        <O nhan="Ghi chú (thành phần, nội dung chính…)"><textarea className={cx(lopO, 'min-h-16 py-2')} value={g.ghi_chu} onChange={(e) => setG({ ...g, ghi_chu: e.target.value })} /></O>
        {loi && <HopLoi loi={loi} />}
        <div className="flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" dangChay={dangChay} onClick={() => void luu()}>{goc ? 'Lưu' : 'Tạo phiên họp'}</Nut></div>
      </div>
    </HopThoai>
  );
}

// Chọn văn bản có sẵn trong kho (mọi thư mục) để đính kèm vào hồ sơ phiên họp — văn bản giữ nguyên thư mục gốc
function ChonVanBanCoSan({ mo, dong, p, ds, tenPhien, xong }: { mo: boolean; dong: () => void; p: PhienHopKho; ds: VanBan[]; tenPhien: (v: VanBan) => string | undefined; xong: (n: number) => void }) {
  const [tim, setTim] = useState('');
  const [tm, setTm] = useState<ThuMuc | ''>('');
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [moTruoc, setMoTruoc] = useState(false);
  if (mo !== moTruoc) { setMoTruoc(mo); if (mo) { setTim(''); setTm(''); setChon(new Set()); setLoi(null); } }
  const t = khongDau(tim.trim());
  const loc = ds.filter((v) => (!tm || v.thu_muc === tm) && (!t || khongDau(`${v.so_ky_hieu ?? ''} ${v.trich_yeu} ${v.co_quan_ban_hanh} ${v.nguoi_ky ?? ''}`).includes(t)));
  const cacTm = [...new Set(ds.map((v) => v.thu_muc))];
  const doi = (id: string) => setChon((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const luu = async () => {
    if (!chon.size) { setLoi('Chọn ít nhất một văn bản'); return; }
    setDangChay(true); setLoi(null);
    try { await dinhKemPhien(p.id, [...chon]); xong(chon.size); } catch (e) { setLoi(loiDe(e)); } finally { setDangChay(false); }
  };
  return (
    <HopThoai mo={mo} dong={dong} tieuDe="Đính kèm văn bản có sẵn" rong="max-w-2xl">
      <div className="flex flex-col gap-3">
        <span className="text-[0.8125rem] text-mo-2">Vào hồ sơ <b className="text-den">{p.ten}</b>. Văn bản giữ nguyên thư mục gốc, không tải lại tệp.</span>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mo" />
            <input className={cx(lopO, 'w-full pl-9')} autoFocus placeholder="Số ký hiệu, trích yếu" value={tim} onChange={(e) => setTim(e.target.value)} aria-label="Tìm văn bản" />
          </label>
          <select className={cx(lopO, 'max-sm:w-full')} value={tm} onChange={(e) => setTm(e.target.value as ThuMuc | '')} aria-label="Thư mục">
            <option value="">Mọi thư mục</option>
            {cacTm.map((k) => <option key={k} value={k}>{THU_MUC[k]}</option>)}
          </select>
        </div>
        <ul className="m-0 flex max-h-[min(52vh,440px)] list-none flex-col overflow-y-auto rounded-xl border border-vien p-0">
          {loc.length === 0 ? <li className="p-4 text-[0.8125rem] text-mo">Không có văn bản phù hợp.</li> : loc.map((v) => (
            <li key={v.id} className="border-b border-[#F1EEE7] last:border-0">
              <label className={cx('flex cursor-pointer items-start gap-3 px-3 py-2.5', chon.has(v.id) ? 'bg-[#FDF1F0]' : 'hover:bg-nen-2')}>
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#8E1B22]" checked={chon.has(v.id)} onChange={() => doi(v.id)} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="mono text-[0.75rem] text-mo-2"><b className="text-den">{v.so_ky_hieu ?? '…'}</b>{v.ngay_ban_hanh ? ` · ${ngay(v.ngay_ban_hanh)}` : ''} · {LOAI_VB[v.loai]}</span>
                  <span className="line-clamp-2 text-[0.8438rem] font-semibold leading-snug">{v.trich_yeu}</span>
                  <span className="truncate text-[0.75rem] text-mo">{THU_MUC[v.thu_muc]}{tenPhien(v) ? ` / ${tenPhien(v)}` : ''}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {loi && <HopLoi loi={loi} />}
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-[0.8125rem] text-mo">Đã chọn <b className="mono text-den">{chon.size}</b></span>
          <Nut onClick={dong}>Huỷ</Nut>
          <Nut kieu="chinh" dangChay={dangChay} onClick={() => void luu()}>Đính kèm</Nut>
        </div>
      </div>
    </HopThoai>
  );
}
