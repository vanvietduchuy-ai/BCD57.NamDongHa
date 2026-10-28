// Chọn nhiệm vụ do tỉnh giao (một hoặc nhiều mã) cho một nhiệm vụ của phường; Thường trực nhập / cập nhật danh sách từ tệp Word của tỉnh
import { useEffect, useMemo, useState } from 'react';
import { FileUp, Plus, Search } from 'lucide-react';
import { gopNvTinh, docNvTinhWord, luuNvTinh, taiNvTinh, type NvTinh } from '../lib/nvTinh';
import { khongDau } from '../lib/nhiemVu';
import { HopLoi, HopThoai, lopO, Nut, cx } from './ui';

export default function ChonNvTinh({ dong, chon, luu, nhapDuoc, tenNv }: { dong: () => void; chon: string[]; luu: (ma: string[]) => void; nhapDuoc: boolean; tenNv: string }) {
  const [ds, setDs] = useState<NvTinh[] | null>(null);
  const [da, setDa] = useState<string[]>(chon);
  const [tim, setTim] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [tay, setTay] = useState({ ma: '', ten: '' });
  useEffect(() => { void taiNvTinh().then(setDs).catch(() => setDs([])); }, []);
  const loc = useMemo(() => { const t = khongDau(tim.trim()); return (ds ?? []).filter((x) => !t || khongDau(`${x.ma} ${x.ten} ${x.vb ?? ''} ${x.dv ?? ''}`).includes(t)); }, [ds, tim]);
  const bat = (ma: string) => setDa((d) => (d.includes(ma) ? d.filter((x) => x !== ma) : [...d, ma]));
  const capNhat = async (moi: NvTinh[], thongBao: string) => {
    const gop = gopNvTinh(ds ?? [], moi); const e = await luuNvTinh(gop);
    if (e) { setLoi(`Không lưu được danh sách: ${e}`); return; }
    setDs(gop); setLoi(null); setOk(thongBao);
  };
  const nhapWord = async (f: File | undefined) => {
    if (!f) return;
    try { const moi = await docNvTinhWord(f); await capNhat(moi, `Đã nhập ${moi.length} nhiệm vụ từ tệp Word (mã đã có được cập nhật).`); }
    catch (e) { setLoi(e instanceof Error ? e.message : 'Không đọc được tệp Word'); }
  };
  const themTay = async () => {
    const ma = tay.ma.trim().toUpperCase(), ten = tay.ten.trim();
    if (!ma || !ten) { setLoi('Nhập mã và nội dung nhiệm vụ'); return; }
    await capNhat([{ ma, ten }], `Đã thêm ${ma}.`); setDa((d) => (d.includes(ma) ? d : [...d, ma])); setTay({ ma: '', ten: '' });
  };
  return (
    <HopThoai mo dong={dong} tieuDe="Nhiệm vụ do tỉnh giao" rong="max-w-3xl">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[0.8125rem] leading-snug text-mo-2">Chọn mã nhiệm vụ cấp tỉnh tương ứng với: <b className="text-den">{tenNv}</b></p>
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-mo" />
          <input autoFocus className={cx(lopO, 'w-full pl-10')} placeholder="Tìm theo mã, nội dung, văn bản giao, đơn vị" value={tim} onChange={(e) => setTim(e.target.value)} /></label>
        <ul className="m-0 flex max-h-[45vh] list-none flex-col overflow-y-auto rounded-xl border border-vien p-0">
          {ds === null && <li className="p-3 text-sm text-mo">Đang tải…</li>}
          {ds && !loc.length && <li className="p-3 text-sm text-mo">{ds.length ? 'Không thấy nhiệm vụ phù hợp.' : 'Chưa có danh sách nhiệm vụ của tỉnh. ' + (nhapDuoc ? 'Bấm “Nhập từ tệp Word của tỉnh” bên dưới.' : 'Liên hệ Cơ quan Thường trực.')}</li>}
          {loc.map((x) => (
            <li key={x.ma} className="border-b border-[#F1EEE7] last:border-0">
              <label className={cx('flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-nen-2', da.includes(x.ma) && 'bg-nen')}>
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={da.includes(x.ma)} onChange={() => bat(x.ma)} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.8438rem] leading-snug"><b className="mono">{x.ma}</b> · {x.ten}</span>
                  <span className="text-xs text-mo">{[x.vb, x.han && `Hạn ${x.han}`, x.dv].filter(Boolean).join(' · ')}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {nhapDuoc && (
          <div className="flex flex-col gap-2 rounded-xl bg-nen p-3">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[0.8125rem] font-semibold text-xanh"><FileUp className="h-4 w-4" />Nhập / cập nhật từ tệp Word của tỉnh (cột Mã, Nhiệm vụ…)
              <input type="file" className="sr-only" accept=".docx" onChange={(e) => { void nhapWord(e.target.files?.[0]); e.target.value = ''; }} /></label>
            <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2">
              <input className={lopO} placeholder="Mã (NV-BT-…)" value={tay.ma} onChange={(e) => setTay({ ...tay, ma: e.target.value })} />
              <input className={lopO} placeholder="Nội dung nhiệm vụ của tỉnh (thêm tay)" value={tay.ten} onChange={(e) => setTay({ ...tay, ten: e.target.value })} />
              <Nut icon={<Plus className="h-4 w-4" />} onClick={() => void themTay()}>Thêm</Nut>
            </div>
          </div>
        )}
        {ok && <p className="m-0 text-xs text-[#166534]">{ok}</p>}
        {loi && <HopLoi loi={loi} />}
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-mo">Đã chọn: {da.length ? da.join(', ') : 'chưa chọn'}</span>
          <Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" onClick={() => luu(da)}>Lưu</Nut>
        </div>
      </div>
    </HopThoai>
  );
}
