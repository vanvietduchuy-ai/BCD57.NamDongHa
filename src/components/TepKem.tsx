// Tài liệu kèm theo: danh sách tệp (mở / tải qua máy chủ) và ô chọn nhiều tệp trước khi gửi.
import { FileArchive, FileImage, FileSpreadsheet, FileText, Paperclip, Plus, X } from 'lucide-react';
import { goiChucNang } from '../lib/supabase';
import { NHAN_TOI_DA_TEP, QUA_LON } from '../lib/gioiHanTep';
import { NutTepDrive } from './TepDrive';
import { cx } from './ui';

export type TepKem = { id: string; ten: string; drive_file_id: string; kich_thuoc?: number | null };

export const NHAN_TEP_KEM = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.rtf,.jpg,.jpeg,.png,.heic,.webp,.zip,.rar,.7z';
const DUOI = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|txt|csv|rtf|jpe?g|png|heic|webp|zip|rar|7z)$/i;

export const coKb = (n?: number | null) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
function BieuTuong({ ten }: { ten: string }) {
  const c = 'h-4 w-4 shrink-0';
  if (/\.(xlsx?|ods|csv)$/i.test(ten)) return <FileSpreadsheet className={cx(c, 'text-[#15803D]')} />;
  if (/\.(jpe?g|png|heic|webp)$/i.test(ten)) return <FileImage className={cx(c, 'text-[#7C3AED]')} />;
  if (/\.(zip|rar|7z)$/i.test(ten)) return <FileArchive className={cx(c, 'text-[#B45309]')} />;
  if (/\.pdf$/i.test(ten)) return <FileText className={cx(c, 'text-[#B91C1C]')} />;
  return <FileText className={cx(c, 'text-xanh')} />;
}

// Danh sách tệp kèm đã lưu
export function DsTepKem({ tep, tieuDe = 'Tài liệu kèm theo' }: { tep: TepKem[] | null | undefined; tieuDe?: string }) {
  if (!tep?.length) return null;
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-vien">
      <div className="flex items-center gap-2 border-b border-vien bg-nen-2 px-4 py-2.5 text-[0.8125rem] font-bold"><Paperclip className="h-4 w-4 text-mo" />{tieuDe} ({tep.length})</div>
      <ul className="m-0 flex list-none flex-col p-0">
        {tep.map((t) => (
          <li key={t.id} className="flex min-h-11 items-center gap-2.5 border-b border-[#F1EEE7] px-4 py-1.5 text-[0.8438rem] last:border-0">
            <BieuTuong ten={t.ten} />
            <span className="min-w-0 flex-1 break-all leading-snug">{t.ten}{t.kich_thuoc ? <span className="ml-1.5 text-xs text-mo">{coKb(t.kich_thuoc)}</span> : null}</span>
            {t.drive_file_id.startsWith('thu-') ? <span className="text-xs text-mo">bản thử</span> : <>
              <NutTepDrive loai="tep" id={t.id} ten={t.ten} nhan="Mở" className="shrink-0" />
              <NutTepDrive loai="tep" id={t.id} ten={t.ten} cheDo="tai" nhan="Tải" className="shrink-0 max-sm:hidden" />
            </>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Số tệp kèm (hiện trong danh sách)
export const DemTepKem = ({ n }: { n: number }) => (n > 0 ? <span className="inline-flex items-center gap-0.5 font-semibold text-mo-2"><Paperclip className="h-3.5 w-3.5" />{n}</span> : null);

// Kiểm tra tệp chọn thêm: trả thông báo lỗi hoặc null
export function kiemTraTepKem(f: File): string | null {
  if (!DUOI.test(f.name)) return `"${f.name}": chỉ nhận PDF, Word, Excel, PowerPoint, ảnh, tệp nén`;
  if (QUA_LON(f.size)) return `"${f.name}" lớn hơn ${NHAN_TOI_DA_TEP}`;
  return null;
}

// Chọn nhiều tệp kèm (chưa tải lên — tải sau khi gửi văn bản thành công)
export function ChonTepKem({ ds, doi, baoLoi }: { ds: File[]; doi: (ds: File[]) => void; baoLoi: (m: string | null) => void }) {
  const them = (fs: FileList | null) => {
    if (!fs?.length) return;
    const moi: File[] = []; let loi: string | null = null;
    for (const f of Array.from(fs)) { const l = kiemTraTepKem(f); if (l) loi = l; else if (!ds.some((x) => x.name === f.name && x.size === f.size)) moi.push(f); }
    baoLoi(loi);
    if (moi.length) doi([...ds, ...moi].slice(0, 20));
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5"><span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-mo-2"><Paperclip className="h-4 w-4 shrink-0" />Tài liệu kèm theo (không bắt buộc)</span><span className="text-xs text-mo">Word, Excel, PowerPoint, ảnh, ZIP… tối đa {NHAN_TOI_DA_TEP} mỗi tệp</span></div>
      {ds.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {ds.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex min-h-11 items-center gap-2.5 rounded-xl bg-nen px-3 py-1.5 text-[0.8438rem]">
              <BieuTuong ten={f.name} />
              <span className="min-w-0 flex-1 break-all leading-snug">{f.name}<span className="ml-1.5 text-xs text-mo">{coKb(f.size)}</span></span>
              <button type="button" aria-label={`Bỏ ${f.name}`} onClick={() => doi(ds.filter((_, j) => j !== i))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mo hover:bg-white"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#9AA1AE] bg-nen-2 px-3 text-[0.8125rem] text-mo-2">
        <Plus className="h-4 w-4 text-xanh" /><b className="text-xanh">Thêm tệp</b>
        <input type="file" multiple className="sr-only" accept={NHAN_TEP_KEM} onChange={(e) => { them(e.target.files); e.target.value = ''; }} />
      </label>
    </div>
  );
}

// Tải các tệp kèm lên sau khi gửi văn bản; trả danh sách tên tệp lỗi
export async function taiTepKemCongVan(congVanId: string, ds: File[], thuMuc?: string): Promise<string[]> {
  const loi: string[] = [];
  for (const f of ds) {
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('loai', 'cong_van_tep'); fd.append('cong_van_id', congVanId);
      if (thuMuc) fd.append('thu_muc', thuMuc);
      await goiChucNang('drive-upload', fd, true);
    } catch { loi.push(f.name); }
  }
  return loi;
}
