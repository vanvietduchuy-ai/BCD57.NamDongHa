// Nhập hồ sơ bàn giao: các văn bản do Văn phòng Đảng ủy (Cơ quan Thường trực cũ) bàn giao.
// Chọn các tệp PDF (tên bắt đầu bằng số thứ tự 01_, 02_ …) → khớp với danh sách đã lập sẵn (hoSoBanGiao.ts) → tải lên Google Drive và ghi vào Kho văn bản.
// Thông tin (số, ngày, trích yếu, cơ quan, thư mục) lấy từ danh sách, không cần đọc lại PDF.
import { useMemo, useState } from 'react';
import { Check, FileText, FolderUp, Loader2, ShieldAlert, X } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { BAN_GIAO } from '../lib/hoSoBanGiao';
import { QUA_LON, NHAN_TOI_DA_TEP } from '../lib/gioiHanTep';
import { ngay } from '../lib/dinhDang';
import { LOAI_VB, THU_MUC } from '../lib/vanBan';
import { taiPdfLenDrive } from './VanBanPdf';
import { HopLoi, HopThoai, Nut, cx } from './ui';

type Tt = 'cho' | 'tai' | 'xong' | 'co' | 'loi';
const soTt = (f: File) => Number(f.name.match(/^(\d{1,3})[_\s-]/)?.[1] ?? NaN);

export default function NhapBanGiao({ mo, dong, xong }: { mo: boolean; dong: () => void; xong: (n: number) => void }) {
  const [tep, setTep] = useState<Record<number, File>>({});
  const [chon, setChon] = useState<Set<number>>(new Set());
  const [tt, setTt] = useState<Record<number, { t: Tt; ghi?: string }>>({});
  const [khongMat, setKhongMat] = useState(false);
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [moTruoc, setMoTruoc] = useState(false);
  if (mo !== moTruoc) { setMoTruoc(mo); if (mo) { setTep({}); setChon(new Set()); setTt({}); setKhongMat(false); setLoi(null); } }

  const nhanTep = (fs: FileList | null) => {
    if (!fs) return;
    const moi: Record<number, File> = {};
    const khongKhop: string[] = [];
    for (const f of Array.from(fs)) {
      const n = soTt(f);
      if (!/\.pdf$/i.test(f.name) || !BAN_GIAO.some((b) => b.stt === n)) { khongKhop.push(f.name); continue; }
      if (QUA_LON(f.size)) { khongKhop.push(`${f.name} (lớn hơn ${NHAN_TOI_DA_TEP})`); continue; }
      moi[n] = f;
    }
    setTep((c) => ({ ...c, ...moi }));
    setChon((c) => new Set([...c, ...Object.keys(moi).map(Number).filter((n) => !BAN_GIAO.find((b) => b.stt === n)?.trung)]));
    setLoi(khongKhop.length ? `${khongKhop.length} tệp không khớp danh sách nên bỏ qua: ${khongKhop.slice(0, 3).join('; ')}${khongKhop.length > 3 ? '…' : ''}` : null);
  };
  const doi = (n: number) => setChon((c) => { const x = new Set(c); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const dsTai = useMemo(() => BAN_GIAO.filter((b) => chon.has(b.stt) && tep[b.stt] && (tt[b.stt]?.t ?? 'cho') === 'cho'), [chon, tep, tt]);
  const set = (n: number, v: { t: Tt; ghi?: string }) => setTt((c) => ({ ...c, [n]: v }));

  const chay = async () => {
    if (!dsTai.length) { setLoi('Chưa chọn tệp nào để tải lên'); return; }
    if (!khongMat) { setLoi('Tích xác nhận các văn bản không mật'); return; }
    setDangChay(true); setLoi(null);
    // Bỏ qua tệp đã có trong Kho (chạy lại không bị trùng)
    const da = await supabase.from('van_ban').select('ten_tep').in('ten_tep', dsTai.map((b) => tep[b.stt].name));
    const coSan = new Set(((da.data ?? []) as { ten_tep: string | null }[]).map((x) => x.ten_tep));
    for (const b of dsTai) {
      const f = tep[b.stt];
      if (coSan.has(f.name)) { set(b.stt, { t: 'co', ghi: 'Đã có trong Kho — bỏ qua' }); continue; }
      try {
        set(b.stt, { t: 'tai' });
        const r = await taiPdfLenDrive(f, 'van_ban', { thuMuc: THU_MUC[b.tm] });
        const ins = await supabase.from('van_ban').insert({
          so_ky_hieu: b.so, ngay_ban_hanh: b.ngay, trich_yeu: b.ty, co_quan_ban_hanh: b.cq, loai: b.loai, thu_muc: b.tm, trang_thai: 'ban_hanh',
          ghi_chu: ['Bàn giao từ Văn phòng Đảng ủy (Cơ quan Thường trực cũ)', b.ghi].filter(Boolean).join(' · '),
          drive_file_id: r.drive_file_id, drive_url: r.url ?? null, ten_tep: f.name,
        }).select('id').single();
        if (ins.error) throw ins.error;
        // Hồ sơ của Thường trực cũ không phải văn bản đến/đi của Thường trực hiện nay: gỡ khỏi sổ công văn nếu hệ thống tự ghi
        await supabase.from('so_van_ban').delete().eq('van_ban_id', ins.data.id as string);
        set(b.stt, { t: 'xong' });
      } catch (e) { set(b.stt, { t: 'loi', ghi: loiDe(e) }); }
    }
    setDangChay(false);
  };

  const soXong = Object.values(tt).filter((x) => x.t === 'xong').length;
  const daXong = !dangChay && Object.keys(tt).length > 0 && dsTai.length === 0;
  const bieu = (t: Tt | undefined, co: boolean) => t === 'xong' || t === 'co' ? <Check className="h-4 w-4 text-[#166534]" /> : t === 'loi' ? <X className="h-4 w-4 text-nguy" />
    : t === 'tai' ? <Loader2 className="h-4 w-4 animate-spin text-xanh" /> : <FileText className={cx('h-4 w-4', co ? 'text-den' : 'text-mo')} />;

  return (
    <HopThoai mo={mo} dong={() => !dangChay && dong()} tieuDe="Nhập hồ sơ bàn giao" rong="max-w-3xl">
      <div className="flex flex-col gap-3">
        <span className="text-[0.8125rem] text-mo-2">Văn bản do <b className="text-den">Văn phòng Đảng ủy (Cơ quan Thường trực cũ)</b> bàn giao — {BAN_GIAO.length} văn bản. Chọn các tệp PDF đã giải nén (tên bắt đầu bằng 01_, 02_ …); số ký hiệu, ngày, trích yếu, thư mục lấy theo danh sách bàn giao. Không ghi vào sổ công văn của Thường trực.</span>
        {!dangChay && !daXong && <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#9AA1AE] bg-white px-3 text-center hover:border-[#8E1B22]">
          <FolderUp className="h-6 w-6 text-[#8E1B22]" /><span className="text-[0.875rem] font-bold">Chọn các tệp PDF ({Object.keys(tep).length}/{BAN_GIAO.length} đã chọn)</span>
          <input type="file" multiple accept=".pdf,application/pdf" className="sr-only" aria-label="Chọn các tệp PDF bàn giao" onChange={(e) => { nhanTep(e.target.files); e.target.value = ''; }} />
        </label>}
        <ul className="m-0 flex max-h-[min(46vh,420px)] list-none flex-col overflow-y-auto rounded-xl border border-vien p-0">
          {BAN_GIAO.map((b) => {
            const s = tt[b.stt]; const co = !!tep[b.stt];
            return (
              <li key={b.stt} className={cx('flex items-start gap-2.5 border-b border-[#F1EEE7] px-3 py-2 last:border-0', !co && 'opacity-50')}>
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#8E1B22]" checked={chon.has(b.stt)} disabled={!co || dangChay || !!s} onChange={() => doi(b.stt)} aria-label={`Chọn văn bản ${b.stt}`} />
                <span className="mt-0.5 shrink-0">{bieu(s?.t, co)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="mono text-[0.75rem] text-mo-2"><b className="text-den">{b.so ?? 'Không số'}</b>{b.ngay ? ` · ${ngay(b.ngay)}` : ''} · {LOAI_VB[b.loai]} · {THU_MUC[b.tm]}</span>
                  <span className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug">{b.ty}</span>
                  <span className={cx('truncate text-[0.75rem]', s?.t === 'loi' ? 'text-nguy' : 'text-mo')}>{s?.ghi ?? (co ? b.cq : 'Chưa chọn tệp')}{b.trung && !s ? ' · trùng bản trên, mặc định không nhập' : ''}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {!daXong && <label className="flex items-start gap-3 rounded-xl bg-nguy-nhat px-3 py-2.5 text-[0.8125rem] text-nguy">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={khongMat} disabled={dangChay} onChange={(e) => setKhongMat(e.target.checked)} />
          <span><ShieldAlert className="mr-1 inline h-4 w-4" /><b>Các văn bản không mật</b> (hệ thống không lưu văn bản mật)</span>
        </label>}
        {loi && <HopLoi loi={loi} />}
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-[0.8125rem] text-mo">{daXong ? <>Đã nhập <b className="mono text-den">{soXong}</b> văn bản</> : <><b className="mono text-den">{dsTai.length}</b> văn bản sẽ nhập</>}</span>
          {daXong ? <Nut kieu="chinh" onClick={() => xong(soXong)}>Xong</Nut> : <>
            <Nut onClick={dong} disabled={dangChay}>Huỷ</Nut>
            <Nut kieu="chinh" dangChay={dangChay} onClick={() => void chay()}>Tải lên và lưu</Nut>
          </>}
        </div>
      </div>
    </HopThoai>
  );
}
