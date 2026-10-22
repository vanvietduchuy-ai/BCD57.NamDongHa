import { useState } from 'react';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import { goiChucNang, loiDe, supabase } from '../lib/supabase';
import { HopLoi, cx } from './ui';
import { NutTepDrive } from './TepDrive';
import { NHAN_TEP_KEM } from './TepKem';
import { NHAN_TOI_DA_TEP, QUA_LON } from '../lib/gioiHanTep';

export type Tep = { id: string; drive_file_id: string; ten: string };

// Danh sách tệp trên Google Drive + ô tải lên (qua Edge Function drive-upload)
export default function TepDinhKem({ loai, dichId, thuMuc, suaDuoc, tep, xong, xoaDuoc = suaDuoc }: {
  loai: 'nop_bao_cao' | 'nhiem_vu'; dichId: string; thuMuc?: string;
  suaDuoc: boolean; xoaDuoc?: boolean; tep: Tep[]; xong: () => void;
}) {
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const tai = async (f: File) => {
    if (QUA_LON(f.size)) { setLoi(`Tệp lớn hơn ${NHAN_TOI_DA_TEP}`); return; }
    setDangChay(true); setLoi(null);
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('loai', loai); fd.append(`${loai}_id`, dichId);
      if (thuMuc) fd.append('thu_muc', thuMuc);
      await goiChucNang('drive-upload', fd, true);
      xong();
    } catch (e) { setLoi(loiDe(e)); } finally { setDangChay(false); }
  };
  const xoa = async (t: Tep) => {
    if (!window.confirm(`Gỡ tệp "${t.ten}"?`)) return;
    const { error } = await supabase.from('tep').delete().eq('id', t.id);
    if (error) setLoi(loiDe(error)); else xong();
  };
  return (
    <div className="flex flex-col gap-2">
      {tep.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-xl bg-nen px-3 py-2 text-sm">
          <Paperclip className="h-4 w-4 shrink-0 text-xanh" />
          <span className="flex-1 truncate">{t.ten}</span>
          {t.drive_file_id.startsWith('thu-') ? <span className="text-xs text-mo">bản thử</span> : <NutTepDrive loai="tep" id={t.id} ten={t.ten} />}
          {xoaDuoc && <button aria-label={`Gỡ ${t.ten}`} onClick={() => xoa(t)} className="flex h-9 w-9 items-center justify-center rounded-lg text-nguy hover:bg-nguy-nhat"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
      {suaDuoc && (
        <label className={cx('flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#9AA1AE] bg-nen-2 px-3 text-center text-[0.8125rem] text-mo-2', dangChay && 'opacity-60')}>
          <Upload className="h-5 w-5 text-xanh" />
          <span>{dangChay ? 'Đang tải lên Google Drive…' : <><b className="text-xanh">Chọn tệp</b> hoặc chụp ảnh</>}</span>
          <input type="file" className="sr-only" disabled={dangChay} accept={NHAN_TEP_KEM}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void tai(f); e.target.value = ''; }} />
        </label>
      )}
      {loi && <HopLoi loi={loi} />}
    </div>
  );
}
