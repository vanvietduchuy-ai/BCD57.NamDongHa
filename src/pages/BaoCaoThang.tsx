// Báo cáo tháng gửi tỉnh (mẫu XA003): 19 bảng / 7 phụ lục dạng A4 động. Đơn vị được phân công nhập thẳng vào ô vàng;
// ô xám web tự tính; ô hồng là ô thiếu hoặc nghi sai. Thường trực phân công bảng, khoá kỳ, xuất Excel.
import { useMemo, useState, type ReactNode } from 'react';
import { Download, Lock, LockOpen, Plus, Settings2, Trash2, TriangleAlert, CircleCheck } from 'lucide-react';
import { laQuanTri, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useDuLieu } from '../lib/useDuLieu';
import { homNayVN } from '../lib/dinhDang';
import {
  BANG, batBuocKy, CH_MAC_DINH, danhSachKy, docSo, dongDongSo, giaiTrinh, hanGuiMs, khoaO, kiemTraBang, kyTruoc, laThangQuy, luuCauHinh, luuO, PHU_LUC, taiCauHinh, taiDuLieu, tenKy, tinhO, TT_BANG, ttBang,
  type BangB, type CauHinhBCTh, type CotB, type DuLieu, type LoiO, type TtBang,
} from '../lib/baoCaoThang';
import { DangTai, HopLoi, HopThoai, Nut, The, TieuDeTrang, cx, lopO } from '../components/ui';

const FONT_A4 = "'Times New Roman', Tinos, 'Liberation Serif', serif";
const NEN = { tay: '#FFF1A8', tuDong: '#E7E5E4', thieu: '#F8C9CF' };
type DonVi = { id: string; ten: string };

export default function BaoCaoThang() {
  const { hoSo } = useAuth();
  const quanTri = laQuanTri(hoSo);
  const donViId = hoSo?.don_vi_id ?? null;
  const [ky, setKy] = useState(() => homNayVN().slice(0, 7));
  const [tab, setTab] = useState<'thieu' | number>('thieu');
  const [them, setThem] = useState<Record<string, number>>({});
  const [thongBao, setThongBao] = useState<{ loi?: string; ok?: string } | null>(null);
  const [moPc, setMoPc] = useState(false);

  const { data, loi, dangTai, taiLai, setData } = useDuLieu(async () => {
    const [ch, dv, cur, truoc] = await Promise.all([
      taiCauHinh(),
      supabase.from('don_vi').select('id, ten').eq('hoat_dong', true).order('thu_tu'),
      taiDuLieu(ky),
      taiDuLieu(kyTruoc(ky)).catch(() => ({} as DuLieu)),
    ]);
    return { ch, dv: (dv.data ?? []) as DonVi[], cur, truoc };
  }, [ky]);

  const ch = data?.ch ?? CH_MAC_DINH;
  const cur = data?.cur ?? {};
  const truoc = data?.truoc ?? {};
  const ctx = useMemo(() => ({ cur, truoc }), [cur, truoc]);
  const quaHan = Date.now() > hanGuiMs(ky, ch.gui);
  const khoa = ch.khoa.includes(ky) || (quaHan && !ch.mo_lai.includes(ky));
  const duocPhanCong = (b: BangB) => !!donViId && (ch.phan_cong[b.id] ?? []).includes(donViId);
  const xemDuoc = (b: BangB) => quanTri || hoSo?.vai_tro === 'lanh_dao' || duocPhanCong(b);
  const nhapDuoc = (b: BangB) => quanTri || (hoSo?.vai_tro === 'don_vi' && duocPhanCong(b) && !khoa);
  const tenDv = (id: string) => data?.dv.find((d) => d.id === id)?.ten ?? '';
  const dsBang = BANG.filter(xemDuoc);

  const soDongCua = (b: BangB) => (b.dongDong ? dongDongSo(b, cur, them[b.id] ?? 0) : 0);
  const loiCua = useMemo(() => {
    const m: Record<string, LoiO[]> = {};
    for (const b of BANG) m[b.id] = kiemTraBang(b, ky, ctx, b.dongDong ? dongDongSo(b, cur, them[b.id] ?? 0) : 0);
    return m;
  }, [ctx, cur, ky, them]);

  const ghi = async (b: BangB, dong: string, cot: string, gt: string) => {
    const k = khoaO(b.id, dong, cot);
    if ((cur[k] ?? '') === gt) return;
    setData((x) => (x ? { ...x, cur: { ...x.cur, [k]: gt } } : x));
    const e = await luuO(ky, [{ bang: b.id, dong, cot, gia_tri: gt }]);
    if (e) { setThongBao({ loi: `Không lưu được: ${e}` }); void taiLai(); } else setThongBao(null);
  };
  const xoaDong = async (b: BangB, i: number, n: number) => {
    // Dồn các dòng phía dưới lên, xoá dòng cuối
    const cac: { bang: string; dong: string; cot: string; gia_tri: string }[] = [];
    const moi = { ...cur };
    for (let r = i; r <= n; r++) for (const c of b.cot) {
      const gt = r < n ? (cur[khoaO(b.id, `r${r + 1}`, c.k)] ?? '') : '';
      if ((cur[khoaO(b.id, `r${r}`, c.k)] ?? '') !== gt) { cac.push({ bang: b.id, dong: `r${r}`, cot: c.k, gia_tri: gt }); if (gt) moi[khoaO(b.id, `r${r}`, c.k)] = gt; else delete moi[khoaO(b.id, `r${r}`, c.k)]; }
    }
    setData((x) => (x ? { ...x, cur: moi } : x));
    setThem((t) => ({ ...t, [b.id]: Math.max(0, (t[b.id] ?? 0) - 1) }));
    if (cac.length) { const e = await luuO(ky, cac); if (e) { setThongBao({ loi: `Không lưu được: ${e}` }); void taiLai(); } }
  };
  const saoChepKyTruoc = async (b: BangB) => {
    const cac: { bang: string; dong: string; cot: string; gia_tri: string }[] = [];
    const moi = { ...cur };
    for (const [k, v] of Object.entries(truoc)) {
      if (!k.startsWith(`${b.id}|`) || k.includes('|_tt|') || cur[k]) continue;
      const [, dong, cot] = k.split('|');
      const c = b.cot.find((x) => x.k === cot);
      if (!c || c.chiDoc) continue;
      // Bảng cố định: lũy kế và các chỉ tiêu kỳ này sẽ khác; chỉ chép chữ và số "phải thực hiện / khối lượng / biên chế"
      if (!b.dongDong && c.kieu === 'so' && !['ph', 'kl', 'bc'].includes(cot)) continue;
      cac.push({ bang: b.id, dong, cot, gia_tri: v }); moi[k] = v;
    }
    if (!cac.length) { setThongBao({ ok: 'Không có gì để chép từ kỳ trước.' }); return; }
    setData((x) => (x ? { ...x, cur: moi } : x));
    const e = await luuO(ky, cac);
    setThongBao(e ? { loi: `Không lưu được: ${e}` } : { ok: `Đã chép ${cac.length} ô từ ${tenKy(kyTruoc(ky))} (chỉ các ô còn trống).` });
  };
  const datCH = async (c: CauHinhBCTh, ok?: string) => {
    setData((x) => (x ? { ...x, ch: c } : x));
    const e = await luuCauHinh(c);
    setThongBao(e ? { loi: `Không lưu được thiết lập: ${e}` } : ok ? { ok } : null);
  };

  const tongLoi = dsBang.reduce((a, b) => a + loiCua[b.id].length, 0);
  const bangDu = dsBang.filter((b) => !loiCua[b.id].length && batBuocKy(b, ky)).length;
  const kyChon = danhSachKy(homNayVN().slice(0, 7));

  if (dangTai && !data) return <DangTai chu="Đang tải báo cáo tháng…" />;
  if (loi) return (
    <div className="flex flex-col gap-3">
      <HopLoi loi={/bao_cao_thang|schema cache|does not exist/i.test(loi) ? 'Chưa cài bảng dữ liệu báo cáo tháng. Quản trị hệ thống chạy tệp supabase/bao-cao-thang.sql trong Supabase > SQL Editor (một lần) rồi tải lại trang.' : loi} taiLai={taiLai} />
    </div>
  );

  const bangCuaTab = tab === 'thieu' ? [] : dsBang.filter((b) => b.pl === tab);

  return (
    <div className="flex flex-col gap-4">
      <TieuDeTrang tren="Gửi Cơ quan Thường trực BCĐ 57 tỉnh · mẫu XA003" ten={`Báo cáo tháng (Tỉnh) · ${tenKy(ky)}`}
        phai={<>
          {quanTri && <Nut kieu="phu" icon={<Settings2 className="h-4 w-4" />} ngan="Phân công" onClick={() => setMoPc(true)}>Phân công bảng</Nut>}
          {quanTri && (ch.khoa.includes(ky)
            ? <Nut kieu="phu" icon={<LockOpen className="h-4 w-4" />} ngan="Mở khoá" onClick={() => datCH({ ...ch, khoa: ch.khoa.filter((x) => x !== ky) }, 'Đã mở khoá kỳ')}>Mở khoá kỳ</Nut>
            : <Nut kieu="phu" icon={<Lock className="h-4 w-4" />} ngan="Khoá" onClick={() => datCH({ ...ch, khoa: [...ch.khoa, ky] }, 'Đã khoá kỳ: đơn vị không nhập được nữa')}>Khoá kỳ</Nut>)}
          {quanTri && quaHan && !ch.khoa.includes(ky) && (ch.mo_lai.includes(ky)
            ? <Nut kieu="phu" ngan="Đóng lại" onClick={() => datCH({ ...ch, mo_lai: ch.mo_lai.filter((x) => x !== ky) }, 'Đã đóng lại, đơn vị không nhập được nữa')}>Đóng lại</Nut>
            : <Nut kieu="phu" ngan="Mở lại" onClick={() => datCH({ ...ch, mo_lai: [...ch.mo_lai, ky] }, 'Đã mở lại cho đơn vị đính chính')}>Mở lại cho đơn vị</Nut>)}
          <Nut kieu="chinh" icon={<Download className="h-4 w-4" />} ngan="Excel" onClick={() => xuatExcel(ky, dsBang, ctx, (b) => soDongCua(b))}>Xuất Excel</Nut>
        </>} />

      <The as="div" className="flex flex-wrap items-center gap-3 p-3 text-[0.8125rem]">
        <label className="flex items-center gap-2 font-semibold text-mo-2">Kỳ báo cáo
          <select className={cx(lopO, 'min-h-10')} value={ky} onChange={(e) => { setKy(e.target.value); setThem({}); }}>
            {[...new Set([...kyChon, ky])].sort().reverse().map((k) => <option key={k} value={k}>{tenKy(k)}</option>)}
          </select>
        </label>
        <span className="rounded-full bg-nen-3 px-3 py-1 font-semibold">Chốt số liệu ngày {ch.chot}</span>
        <span className="rounded-full bg-nen-3 px-3 py-1 font-semibold">Gửi tỉnh trước ngày {ch.gui}</span>
        {!laThangQuy(ky) && <span className="rounded-full bg-cam-nhat px-3 py-1 font-semibold text-cam-dam">Tháng này không bắt buộc chỉ tiêu quý</span>}
        {khoa
          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-nguy-nhat px-3 py-1 font-semibold text-nguy"><Lock className="h-3.5 w-3.5" />{ch.khoa.includes(ky) ? 'Đã khoá' : `Quá hạn gửi (ngày ${ch.gui})`}{!quanTri && ' · liên hệ Thường trực để đính chính'}</span>
          : <span className="rounded-full bg-[#DCFCE7] px-3 py-1 font-semibold text-[#166534]">Đang mở nhập</span>}
        <span className="ml-auto flex items-center gap-3 text-xs text-mo">
          <Chu mau={NEN.tuDong}>Web tự tính</Chu><Chu mau={NEN.tay}>Ô nhập</Chu><Chu mau={NEN.thieu}>Thiếu / nghi sai</Chu>
        </span>
      </The>

      {thongBao?.loi && <div role="alert" className="rounded-xl bg-nguy-nhat px-3 py-2 text-[0.8125rem] font-semibold text-nguy">{thongBao.loi}</div>}
      {thongBao?.ok && <div role="status" className="rounded-xl bg-[#DCFCE7] px-3 py-2 text-[0.8125rem] font-semibold text-[#166534]">{thongBao.ok}</div>}

      {!dsBang.length ? (
        <The className="p-6 text-center text-[0.9375rem] text-mo">Chưa có bảng nào được phân công cho đơn vị của bạn. Liên hệ Cơ quan Thường trực để được phân công nhập số liệu.</The>
      ) : (
        <>
          <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl border border-vien bg-white p-1">
            <TabNut on={tab === 'thieu'} bam={() => setTab('thieu')}>Còn thiếu{tongLoi > 0 && <b className="ml-1.5 rounded-full bg-nguy px-1.5 text-[11px] text-white">{tongLoi}</b>}</TabNut>
            {PHU_LUC.filter((p) => dsBang.some((b) => b.pl === p.so)).map((p) => <TabNut key={p.so} on={tab === p.so} bam={() => setTab(p.so)}>Phụ lục 0{p.so}</TabNut>)}
          </div>

          {tab === 'thieu' && (
            <The as="div" className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="m-0 flex-1 text-[0.9375rem] font-bold">Tiến độ nhập {tenKy(ky)}</h2>
                <span className="text-[0.8125rem] text-mo">Đủ {bangDu}/{dsBang.length} bảng · {tongLoi} ô thiếu hoặc nghi sai</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-nen-3"><div className="h-full bg-do" style={{ width: `${dsBang.length ? Math.round((bangDu * 100) / dsBang.length) : 0}%` }} /></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-[0.8125rem]">
                  <thead><tr className="bg-nen-2 text-left"><th className="border border-vien p-2">Bảng</th><th className="border border-vien p-2">Đơn vị nhập</th><th className="border border-vien p-2">Tình trạng</th><th className="border border-vien p-2">Cần bổ sung</th></tr></thead>
                  <tbody>
                    {dsBang.map((b) => {
                      const l = loiCua[b.id]; const tt = ttBang(cur, b.id);
                      const trangThai = tt !== 'can' ? TT_BANG.find((x) => x.v === tt)!.nhan : !batBuocKy(b, ky) ? 'Chưa đến kỳ quý' : l.length ? `${l.length} ô` : 'Đủ';
                      return (
                        <tr key={b.id} className="cursor-pointer hover:bg-nen-2" onClick={() => { setTab(b.pl); setTimeout(() => document.getElementById(`bang-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}>
                          <td className="border border-vien p-2 font-semibold">Bảng {b.id}<div className="font-normal text-mo">{b.ten}</div></td>
                          <td className="border border-vien p-2">{(ch.phan_cong[b.id] ?? []).map(tenDv).filter(Boolean).join(', ') || <span className="text-mo">Chưa phân công</span>}</td>
                          <td className="border border-vien p-2" style={{ background: l.length ? NEN.thieu : undefined }}>{trangThai}</td>
                          <td className="border border-vien p-2 text-mo">{l.slice(0, 3).map((x) => x.msg).join('; ')}{l.length > 3 ? `; … (+${l.length - 3})` : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </The>
          )}

          {bangCuaTab.map((b) => (
            <BangA4 key={b.id} b={b} ky={ky} ctx={ctx} khoaHT={khoa} nhap={nhapDuoc(b)} loi={loiCua[b.id]} soDong={soDongCua(b)}
              ghi={(d, c, v) => ghi(b, d, c, v)} themDong={() => setThem((t) => ({ ...t, [b.id]: soDongCua(b) + 1 }))} xoaDong={(i) => xoaDong(b, i, soDongCua(b))}
              chep={() => saoChepKyTruoc(b)} dv={(ch.phan_cong[b.id] ?? []).map(tenDv).filter(Boolean).join(', ')} />
          ))}
        </>
      )}

      {moPc && data && <PhanCong ch={ch} dv={data.dv} dong={() => setMoPc(false)} luu={(c) => { void datCH(c, 'Đã lưu phân công'); setMoPc(false); }} />}
    </div>
  );
}

const Chu = ({ mau, children }: { mau: string; children: string }) => <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 border border-mo-2" style={{ background: mau }} />{children}</span>;
const TabNut = ({ on, bam, children }: { on: boolean; bam: () => void; children: ReactNode }) => (
  <button role="tab" aria-selected={on} onClick={bam} className={cx('shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[0.8125rem] font-semibold', on ? 'bg-do text-white' : 'text-mo-2 hover:bg-nen-2')}>{children}</button>
);

// ---------- Một bảng dạng trang A4
function BangA4({ b, ky, ctx, khoaHT, nhap, loi, soDong, ghi, themDong, xoaDong, chep, dv }: {
  b: BangB; ky: string; ctx: { cur: DuLieu; truoc: DuLieu }; khoaHT: boolean; nhap: boolean; loi: LoiO[]; soDong: number;
  ghi: (dong: string, cot: string, v: string) => void; themDong: () => void; xoaDong: (i: number) => void; chep: () => void; dv: string;
}) {
  const tt = ttBang(ctx.cur, b.id);
  const sua = nhap && tt === 'can';
  const loiO = (dong: string, cot: string) => loi.find((x) => x.dong === dong && x.cot === cot);
  const th = 'border border-[#57534e] bg-[#F5F5F4] px-2 py-1.5 text-center text-[13px] font-bold align-middle';
  const hang: { k: string; nhan: string; dvt?: string; tong?: boolean }[] = b.dong ?? Array.from({ length: soDong }, (_, i) => ({ k: `r${i + 1}`, nhan: String(i + 1) }));

  return (
    <section id={`bang-${b.id}`} className="scroll-mt-4 overflow-hidden rounded-xl border border-vien-2 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-vien bg-nen-2 px-4 py-2.5 text-[0.8125rem]">
        <b className="flex-1 text-[0.875rem]">Phụ lục 0{b.pl} · Bảng {b.id}</b>
        {dv && <span className="text-mo">Đơn vị nhập: {dv}</span>}
        {loi.length > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-nguy"><TriangleAlert className="h-4 w-4" />{loi.length} ô cần xử lý</span>
          : batBuocKy(b, ky) ? <span className="inline-flex items-center gap-1 font-semibold text-[#166534]"><CircleCheck className="h-4 w-4" />Đủ</span>
          : <span className="font-semibold text-cam-dam">Chưa đến kỳ quý</span>}
      </div>
      <div className="overflow-x-auto p-4 sm:p-6" style={{ fontFamily: FONT_A4 }}>
        <div className="mx-auto flex min-w-[720px] max-w-[1050px] flex-col gap-3 text-[14px] text-black">
          <div className="text-center text-[15px] font-bold">Bảng {b.id}. {b.ten}</div>
          {b.ghiChu && <div className="text-[12.5px] italic">Lưu ý: {b.ghiChu}</div>}
          <div className="flex flex-wrap items-center gap-2 font-sans text-[0.8125rem]">
            <label className="flex items-center gap-2 font-semibold">Trạng thái bảng
              <select disabled={!nhap} className={cx(lopO, 'min-h-9 py-1 text-[0.8125rem]')} value={tt} onChange={(e) => ghi('_tt', 'v', e.target.value === 'can' ? '' : e.target.value)}>
                {TT_BANG.map((x) => <option key={x.v} value={x.v}>{x.nhan}</option>)}
              </select>
            </label>
            {(tt !== 'can' || (b.dongDong && soDong === 0)) && (
              <input disabled={!nhap} placeholder="Giải trình / lý do" className={cx(lopO, 'min-h-9 flex-1 py-1 text-[0.8125rem]')} defaultValue={giaiTrinh(ctx.cur, b.id)} key={giaiTrinh(ctx.cur, b.id)}
                onBlur={(e) => ghi('_tt', 'gt', e.target.value.trim())} style={{ background: loi.some((x) => x.dong === 'r1' && x.cot === b.cot[0].k && x.msg.startsWith('Chưa có dòng')) ? NEN.thieu : undefined }} />
            )}
            {sua && <Nut kieu="phu" className="min-h-9 text-xs" onClick={chep}>Chép từ {tenKy(kyTruoc(ky))}</Nut>}
          </div>
          {tt === 'can' && (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th} style={{ width: b.dongDong ? 44 : '30%' }}>{b.cotNhan}</th>
                  {b.dvt && <th className={th} style={{ width: 80 }}>Đơn vị tính</th>}
                  {b.cot.map((c) => <th key={c.k} className={th} style={{ width: `${(c.rong ?? 1) * 8}%` }}>{c.nhan}</th>)}
                  {b.dongDong && sua && <th className={th} style={{ width: 36 }} aria-label="Xoá dòng" />}
                </tr>
                <tr>
                  <th className={cx(th, 'font-normal italic')}>(1)</th>
                  {b.dvt && <th className={cx(th, 'font-normal italic')}>(2)</th>}
                  {b.cot.map((c, i) => <th key={c.k} className={cx(th, 'font-normal italic')}>({i + (b.dvt ? 3 : 2)})</th>)}
                  {b.dongDong && sua && <th className={th} />}
                </tr>
              </thead>
              <tbody>
                {hang.map((d, i) => (
                  <tr key={d.k}>
                    <td className={cx('border border-[#57534e] px-2 py-1 align-middle', b.dongDong ? 'text-center' : d.tong ? 'font-bold' : '')}>{d.nhan}</td>
                    {b.dvt && <td className="border border-[#57534e] px-2 py-1 text-center align-middle">{(d as { dvt?: string }).dvt}</td>}
                    {b.cot.map((c) => <OCell key={c.k} b={b} dong={d.k} c={c} ctx={ctx} sua={sua && !d.tong} loi={loiO(d.k, c.k)} ghi={(v) => ghi(d.k, c.k, v)} />)}
                    {b.dongDong && sua && <td className="border border-[#57534e] text-center"><button aria-label={`Xoá dòng ${i + 1}`} className="p-1 text-mo hover:text-nguy" onClick={() => xoaDong(i + 1)}><Trash2 className="h-4 w-4" /></button></td>}
                  </tr>
                ))}
                {b.dongDong && soDong === 0 && <tr><td colSpan={b.cot.length + 1 + (b.dvt ? 1 : 0)} className="border border-[#57534e] p-3 text-center italic text-[#57534e]">Chưa có dòng nào</td></tr>}
              </tbody>
            </table>
          )}
          {b.dongDong && sua && tt === 'can' && <div><Nut kieu="phu" className="min-h-9 text-xs" icon={<Plus className="h-4 w-4" />} onClick={themDong}>Thêm {b.dongDong}</Nut></div>}
          {khoaHT && !nhap && <div className="font-sans text-xs text-mo">Bảng chỉ xem — kỳ đã khoá hoặc bảng không thuộc phân công của bạn.</div>}
          {loi.length > 0 && (
            <ul className="m-0 list-disc pl-5 font-sans text-xs text-nguy">{loi.slice(0, 6).map((x, i) => <li key={i}>{x.msg}</li>)}{loi.length > 6 && <li>… và {loi.length - 6} ô khác</li>}</ul>
          )}
        </div>
      </div>
    </section>
  );
}

function OCell({ b, dong, c, ctx, sua, loi, ghi }: { b: BangB; dong: string; c: CotB; ctx: { cur: DuLieu; truoc: DuLieu }; sua: boolean; loi?: LoiO; ghi: (v: string) => void }) {
  const { v, tuDong } = tinhO(b, dong, c, ctx);
  const tay = ctx.cur[khoaO(b.id, dong, c.k)] ?? '';
  const nen = loi ? NEN.thieu : tuDong ? NEN.tuDong : sua && !c.chiDoc ? NEN.tay : undefined;
  const dsChon = c.chon;
  const chiDoc = !sua || c.chiDoc || (b.dong?.find((x) => x.k === dong)?.tong ?? false);
  return (
    <td className="border border-[#57534e] p-0 align-middle" style={{ background: nen, outline: loi ? '2px solid #B4232F' : undefined, outlineOffset: -2 }} title={loi?.msg}>
      {chiDoc ? (
        <div className={cx('min-h-[34px] px-2 py-1.5', c.kieu === 'so' ? 'text-right tabular-nums' : '')}>{v}</div>
      ) : dsChon ? (
        <select className="min-h-[34px] w-full bg-transparent px-1 text-[14px] outline-none" value={tay} onChange={(e) => ghi(e.target.value)}>
          <option value="">—</option>{dsChon.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      ) : (
        <input key={`${tay}|${v}`} defaultValue={tay || v} inputMode={c.kieu === 'so' ? 'decimal' : undefined}
          placeholder={tuDong && !tay ? v : undefined}
          className={cx('min-h-[34px] w-full bg-transparent px-2 text-[14px] outline-none focus:bg-white/70', c.kieu === 'so' && 'text-right tabular-nums')}
          onBlur={(e) => {
            let t = e.target.value.trim();
            if (c.kieu === 'so' && t) { const n = docSo(t); if (n == null) { e.target.value = tay; return; } t = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(n); }
            if (t === v && tuDong && !tay) return;   // không đổi giá trị tự tính
            ghi(t);
          }} />
      )}
    </td>
  );
}

// ---------- Phân công bảng -> đơn vị
function PhanCong({ ch, dv, dong, luu }: { ch: CauHinhBCTh; dv: DonVi[]; dong: () => void; luu: (c: CauHinhBCTh) => void }) {
  const [pc, setPc] = useState<Record<string, string[]>>(ch.phan_cong);
  const bat = (bang: string, id: string) => setPc((p) => { const a = p[bang] ?? []; return { ...p, [bang]: a.includes(id) ? a.filter((x) => x !== id) : [...a, id] }; });
  return (
    <HopThoai mo dong={dong} tieuDe="Phân công nhập số liệu từng bảng" rong="max-w-2xl">
      <p className="mt-0 text-[0.8125rem] text-mo">Đơn vị được tích chỉ thấy và nhập được bảng của mình. Cơ quan Thường trực luôn nhập được mọi bảng.</p>
      <div className="flex flex-col gap-2">
        {BANG.map((b) => (
          <details key={b.id} className="rounded-xl border border-vien bg-nen-2 px-3 py-2">
            <summary className="cursor-pointer text-[0.8125rem] font-semibold">Bảng {b.id}. {b.ten}
              <span className="ml-2 font-normal text-mo">{(pc[b.id] ?? []).length ? `${(pc[b.id] ?? []).length} đơn vị` : 'chưa phân công'}</span></summary>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {dv.map((d) => (
                <label key={d.id} className="flex min-h-9 items-center gap-2 text-[0.8125rem]">
                  <input type="checkbox" className="h-4 w-4" checked={(pc[b.id] ?? []).includes(d.id)} onChange={() => bat(b.id, d.id)} />{d.ten}
                </label>
              ))}
            </div>
          </details>
        ))}
      </div>
      <div className="sticky bottom-0 mt-3 flex justify-end gap-2 bg-white pt-2">
        <Nut kieu="phu" onClick={dong}>Huỷ</Nut>
        <Nut kieu="chinh" onClick={() => luu({ ...ch, phan_cong: pc })}>Lưu phân công</Nut>
      </div>
    </HopThoai>
  );
}

// ---------- Xuất Excel: mỗi bảng một sheet BANG_x_y, số liệu là số
async function xuatExcel(ky: string, ds: BangB[], ctx: { cur: DuLieu; truoc: DuLieu }, soDong: (b: BangB) => number) {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.utils.book_new();
  const [y, m] = ky.split('-');
  const tom: (string | number)[][] = [['BÁO CÁO THÁNG NQ57 — PHƯỜNG NAM ĐÔNG HÀ'], ['Kỳ báo cáo (MM/YYYY)', `${m}/${y}`], [], ['Mã bảng', 'Tên bảng', 'Trạng thái']];
  for (const b of ds) {
    const tt = ttBang(ctx.cur, b.id) as TtBang;
    tom.push([b.id, b.ten, TT_BANG.find((x) => x.v === tt)!.nhan]);
    const aoa: (string | number)[][] = [[`Bảng ${b.id}. ${b.ten}`], []];
    aoa.push([b.cotNhan, ...(b.dvt ? ['Đơn vị tính'] : []), ...b.cot.map((c) => c.nhan)]);
    aoa.push(['(1)', ...(b.dvt ? ['(2)'] : []), ...b.cot.map((_, i) => `(${i + (b.dvt ? 3 : 2)})`)]);
    const hang = b.dong ?? Array.from({ length: soDong(b) }, (_, i) => ({ k: `r${i + 1}`, nhan: String(i + 1), dvt: undefined }));
    if (tt === 'can') for (const d of hang) aoa.push([d.nhan, ...(b.dvt ? [(d as { dvt?: string }).dvt ?? ''] : []), ...b.cot.map((c) => { const v = tinhO(b, d.k, c, ctx).v; const n = c.kieu === 'so' ? docSo(v) : null; return n ?? v; })]);
    const gt = giaiTrinh(ctx.cur, b.id);
    if (tt !== 'can' || gt) aoa.push([], [`${TT_BANG.find((x) => x.v === tt)!.nhan}${gt ? `: ${gt}` : ''}`]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 44 }, ...(b.dvt ? [{ wch: 12 }] : []), ...b.cot.map((c) => ({ wch: 14 * (c.rong ?? 1) }))];
    XLSX.utils.book_append_sheet(wb, ws, `BANG_${b.id.replace('.', '_')}`);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tom), 'TONG_HOP');
  wb.SheetNames.unshift(wb.SheetNames.pop()!);
  XLSX.writeFile(wb, `bao-cao-thang-NQ57-${y}-${m}.xlsx`);
}

