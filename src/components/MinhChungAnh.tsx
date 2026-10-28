// Minh chứng bằng ảnh (ảnh chụp màn hình, ảnh hiện trường): chọn ảnh, kéo thả hoặc dán (Ctrl+V) -> lưu Google Drive, gắn vào nhiệm vụ
// Dùng chung cơ chế tệp đính kèm nhiệm vụ (bảng tep) nên tự hiện ở cột Minh chứng của bảng A4.
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { goiChucNang, loiDe } from '../lib/supabase';
import { NHAN_TOI_DA_TEP, QUA_LON } from '../lib/gioiHanTep';
import { HopLoi, HopThoai, Nut, cx } from './ui';

type Anh = { f: File; url: string };
const pad = (n: number) => String(n).padStart(2, '0');

export default function MinhChungAnh({ nhiemVuId, xong }: { nhiemVuId: string; xong: () => void }) {
  const [mo, setMo] = useState(false);
  const [ds, setDs] = useState<Anh[]>([]);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [keo, setKeo] = useState(false);
  const dsRef = useRef<Anh[]>([]);
  dsRef.current = ds;

  const them = (fs: File[]) => {
    const moi: Anh[] = []; let l: string | null = null;
    const d = new Date();
    fs.forEach((f, i) => {
      if (!f.type.startsWith('image/')) { l = `"${f.name}" không phải ảnh`; return; }
      if (QUA_LON(f.size)) { l = `"${f.name}" lớn hơn ${NHAN_TOI_DA_TEP}`; return; }
      // Ảnh dán từ clipboard thường tên "image.png": đặt tên theo thời điểm để khỏi trùng
      const ten = /^image\.\w+$/i.test(f.name) ? `Anh-man-hinh-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${dsRef.current.length + i + 1}.${f.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}` : f.name;
      moi.push({ f: ten === f.name ? f : new File([f], ten, { type: f.type }), url: URL.createObjectURL(f) });
    });
    setLoi(l);
    if (moi.length) setDs((x) => [...x, ...moi].slice(0, 20));
  };
  const dong = () => { dsRef.current.forEach((a) => URL.revokeObjectURL(a.url)); setDs([]); setLoi(null); setMo(false); };

  // Dán ảnh từ clipboard (chụp màn hình rồi Ctrl+V) khi hộp đang mở
  useEffect(() => {
    if (!mo) return;
    const dan = (e: ClipboardEvent) => {
      const fs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (fs.length) { e.preventDefault(); them(fs); }
    };
    window.addEventListener('paste', dan);
    return () => window.removeEventListener('paste', dan);
  }, [mo]); // eslint-disable-line react-hooks/exhaustive-deps

  const luu = async () => {
    if (!ds.length) return;
    setDang(true); setLoi(null);
    const hong: string[] = [];
    for (const a of ds) {
      try {
        const fd = new FormData();
        fd.append('file', a.f); fd.append('loai', 'nhiem_vu'); fd.append('nhiem_vu_id', nhiemVuId);
        await goiChucNang('drive-upload', fd, true);
      } catch (e) { hong.push(`${a.f.name}: ${loiDe(e)}`); }
    }
    setDang(false);
    if (hong.length) { setLoi(`Chưa tải được ${hong.length}/${ds.length} ảnh — ${hong[0]}`); setDs((x) => x.filter((a) => hong.some((h) => h.startsWith(`${a.f.name}:`)))); xong(); return; }
    dong(); xong();
  };

  return (
    <>
      <button type="button" onClick={() => setMo(true)} title="Tải ảnh chụp màn hình, ảnh hiện trường làm minh chứng"
        className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-vien-2 px-2 text-[0.8125rem] font-semibold text-mo-2 hover:border-[#8E1B22] hover:text-[#8E1B22]">
        <ImagePlus className="h-4 w-4" />Tải ảnh / ảnh màn hình</button>
      <HopThoai mo={mo} dong={dong} tieuDe="Minh chứng: ảnh" rong="max-w-2xl">
        <div className="flex flex-col gap-3">
          <label onDragOver={(e) => { e.preventDefault(); setKeo(true); }} onDragLeave={() => setKeo(false)}
            onDrop={(e) => { e.preventDefault(); setKeo(false); them(Array.from(e.dataTransfer.files)); }}
            className={cx('flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-3 text-center text-[0.8125rem] text-mo-2', keo ? 'border-[#8E1B22] bg-[#FFF3D6]' : 'border-[#9AA1AE] bg-nen-2')}>
            <ImagePlus className="h-6 w-6 text-xanh" />
            <span><b className="text-xanh">Chọn ảnh</b> hoặc kéo thả vào đây</span>
            <span className="text-xs text-mo">Chụp màn hình rồi bấm <b>Ctrl+V</b> để dán ngay · PNG, JPG, HEIC, WebP · tối đa 20 ảnh</span>
            <input type="file" multiple accept="image/*" className="sr-only" onChange={(e) => { them(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          </label>
          {ds.length > 0 && (
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
              {ds.map((a, i) => (
                <li key={a.url} className="relative overflow-hidden rounded-xl border border-vien bg-nen">
                  <img src={a.url} alt={a.f.name} className="h-28 w-full object-cover" />
                  <span className="block truncate px-2 py-1 text-[11px] text-mo-2">{a.f.name}</span>
                  <button type="button" aria-label={`Bỏ ${a.f.name}`} onClick={() => { URL.revokeObjectURL(a.url); setDs((x) => x.filter((_, j) => j !== i)); }}
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-den shadow hover:bg-white"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
          {loi && <HopLoi loi={loi} />}
          <div className="flex justify-end gap-2">
            <Nut onClick={dong}>Huỷ</Nut>
            <Nut kieu="chinh" dangChay={dang} disabled={!ds.length} onClick={() => void luu()}>{ds.length ? `Lưu ${ds.length} ảnh làm minh chứng` : 'Lưu minh chứng'}</Nut>
          </div>
        </div>
      </HopThoai>
    </>
  );
}
