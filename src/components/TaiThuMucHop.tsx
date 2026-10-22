// Tải cả thư mục (hoặc nhiều tệp) vào hồ sơ một phiên họp:
// mỗi tệp thành một văn bản trong Kho (thư mục Hồ sơ họp BCĐ), tự đọc thông tin từ PDF / Word, lưu Drive theo thư mục phiên (giữ thư mục con).
import { useState } from 'react';
import { Check, FileText, FolderUp, Loader2, ShieldAlert, X } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { NHAN_TOI_DA_TEP, QUA_LON } from '../lib/gioiHanTep';
import { docVanBanPdf, soKyHieu, type MetaVb } from '../lib/docPdf';
import { docVanBanWord } from '../lib/docWord';
import { khongDau } from '../lib/nhiemVu';
import { suaHoSoHop, thuMucDrivePhien, type PhienHopKho } from '../lib/phienHop';
import { THU_MUC, type LoaiVb } from '../lib/vanBan';
import { taiPdfLenDrive } from './VanBanPdf';
import { HopLoi, HopThoai, Nut, cx } from './ui';

const DUOI = /\.(pdf|docx?|xlsx?|jpe?g|png|zip)$/i;
const CO_QUAN_MD = 'Ban Chỉ đạo 57 phường Nam Đông Hà';
// Đoán loại theo tên tệp khi không đọc được nội dung
const LOAI_TEN: [RegExp, LoaiVb][] = [
  [/giay moi/, 'giay_moi'], [/to trinh/, 'to_trinh'], [/bao cao/, 'bao_cao'], [/bien ban/, 'bien_ban'], [/thong bao|ket luan/, 'thong_bao'],
  [/chuong trinh/, 'chuong_trinh'], [/ke hoach/, 'ke_hoach'], [/quyet dinh/, 'quyet_dinh'], [/nghi quyet/, 'nghi_quyet'], [/cong van/, 'cong_van'],
];
const tenKhongDuoi = (f: File) => f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
const duongDan = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || '');
// Đường dẫn thư mục của tệp (gồm cả tên thư mục được chọn) — trên Drive tạo đúng cấu trúc thư mục đó trong thư mục phiên họp
const thuMucCon = (f: File) => duongDan(f).split('/').slice(0, -1).map((x) => x.replace(/\\/g, '-').trim()).filter(Boolean).join('/');

type Dong = { f: File; tt: 'cho' | 'doc' | 'tai' | 'xong' | 'bo' | 'loi'; ghi?: string };

export default function TaiThuMucHop({ mo, dong, p, dsPhien, xong }: { mo: boolean; dong: () => void; p: PhienHopKho; dsPhien: PhienHopKho[]; xong: (n: number) => void }) {
  const [ds, setDs] = useState<Dong[]>([]);
  const [khongMat, setKhongMat] = useState(false);
  const [khongVaoSo, setKhongVaoSo] = useState(true);
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [moTruoc, setMoTruoc] = useState(false);
  if (mo !== moTruoc) { setMoTruoc(mo); if (mo) { setDs([]); setKhongMat(false); setKhongVaoSo(true); setLoi(null); } }

  const chon = (fs: FileList | null) => {
    if (!fs) return;
    const moi = Array.from(fs).filter((f) => !/^\.|^~\$|thumbs\.db$/i.test(f.name));
    setDs((cu) => [...cu, ...moi.filter((f) => !cu.some((c) => c.f.name === f.name && duongDan(c.f) === duongDan(f) && c.f.size === f.size))
      .map((f): Dong => !DUOI.test(f.name) ? { f, tt: 'bo', ghi: 'Định dạng không hỗ trợ' } : QUA_LON(f.size) ? { f, tt: 'bo', ghi: `Lớn hơn ${NHAN_TOI_DA_TEP}` } : { f, tt: 'cho' })]);
  };
  const dat = (i: number, d: Partial<Dong>) => setDs((x) => x.map((y, j) => (j === i ? { ...y, ...d } : y)));
  const soTai = ds.filter((d) => d.tt === 'cho').length;

  const chay = async () => {
    if (!soTai) { setLoi('Chưa có tệp để tải lên'); return; }
    if (!khongMat) { setLoi('Tích xác nhận các văn bản không mật'); return; }
    setDangChay(true); setLoi(null);
    const goc = `${THU_MUC.hop_bcd}/${thuMucDrivePhien(p, dsPhien)}`;
    const ids: string[] = [];
    for (let i = 0; i < ds.length; i++) {
      const { f, tt } = ds[i];
      if (tt !== 'cho') continue;
      try {
        // 1. Đọc thông tin
        dat(i, { tt: 'doc', ghi: undefined });
        let m: MetaVb | null = null;
        try {
          if (/\.pdf$/i.test(f.name)) m = await docVanBanPdf(f, (s) => dat(i, { ghi: s }));
          else if (/\.docx$/i.test(f.name)) m = await docVanBanWord(f);
        } catch { m = null; }
        if (m?.mat) { dat(i, { tt: 'bo', ghi: 'Văn bản có độ mật — không tải lên' }); continue; }
        const tenTep = khongDau(f.name);
        const loai: LoaiVb = m && (m.trich_yeu || m.ky_hieu) && m.loai !== 'khac' ? m.loai : LOAI_TEN.find(([re]) => re.test(tenTep))?.[1] ?? m?.loai ?? 'khac';
        // 2. Lưu tệp lên Drive (thư mục phiên họp, giữ thư mục con)
        dat(i, { tt: 'tai', ghi: undefined });
        const con = thuMucCon(f);
        const r = await taiPdfLenDrive(f, 'van_ban', { thuMuc: con ? `${goc}/${con}` : goc });
        // 3. Ghi vào Kho văn bản
        const ins = await supabase.from('van_ban').insert({
          so_ky_hieu: m && (m.so_van_ban || m.ky_hieu) ? soKyHieu(m.so_van_ban, m.ky_hieu) : null, ngay_ban_hanh: m?.ngay_ban_hanh || null,
          trich_yeu: m?.trich_yeu || tenKhongDuoi(f), co_quan_ban_hanh: m?.co_quan_ban_hanh || CO_QUAN_MD, loai, thu_muc: 'hop_bcd', trang_thai: 'ban_hanh',
          nguoi_ky: m?.nguoi_ky || null, ghi_chu: con ? `Thư mục: ${con}` : null, drive_file_id: r.drive_file_id, drive_url: r.url ?? null, ten_tep: f.name,
          ...(m ? { so_van_ban: m.so_van_ban || null, ky_hieu: m.ky_hieu || null, chuc_vu_nguoi_ky: m.chuc_vu_nguoi_ky || null, noi_dung: m.noi_dung || null } : {}),
        }).select('id').single();
        if (ins.error) throw ins.error;
        const id = ins.data.id as string;
        ids.push(id);
        // Tài liệu họp không phải văn bản đi của Thường trực: gỡ khỏi sổ công văn đi nếu hệ thống tự ghi
        if (khongVaoSo) await supabase.from('so_van_ban').delete().eq('van_ban_id', id);
        dat(i, { tt: 'xong', ghi: m?.trich_yeu ? undefined : 'Không đọc được nội dung — lấy tên tệp làm trích yếu' });
      } catch (e) { dat(i, { tt: 'loi', ghi: loiDe(e) }); }
    }
    // 4. Xếp các văn bản vừa tải vào phiên họp
    if (ids.length) {
      try { await suaHoSoHop((h) => ({ ...h, vb: { ...h.vb, ...Object.fromEntries(ids.map((id) => [id, p.id])) } })); }
      catch (e) { setLoi(`Đã tải ${ids.length} văn bản nhưng chưa xếp được vào phiên họp: ${loiDe(e)}`); setDangChay(false); return; }
    }
    setDangChay(false);
  };

  const bieu = (d: Dong) => d.tt === 'xong' ? <Check className="h-4 w-4 text-[#166534]" /> : d.tt === 'bo' || d.tt === 'loi' ? <X className="h-4 w-4 text-nguy" />
    : d.tt === 'cho' ? <FileText className="h-4 w-4 text-mo" /> : <Loader2 className="h-4 w-4 animate-spin text-xanh" />;
  const daXong = ds.length > 0 && !dangChay && ds.every((d) => d.tt !== 'cho' && d.tt !== 'doc' && d.tt !== 'tai');

  return (
    <HopThoai mo={mo} dong={() => !dangChay && dong()} tieuDe="Tải thư mục vào phiên họp" rong="max-w-2xl">
      <div className="flex flex-col gap-3">
        <span className="text-[0.8125rem] text-mo-2">Vào hồ sơ <b className="text-den">{p.ten}</b>. Mỗi tệp thành một văn bản trong Kho; PDF, Word (.docx) tự đọc số, ký hiệu, trích yếu. Trên Google Drive lưu trong thư mục của phiên họp; chọn thư mục thì Drive tạo đúng thư mục đó (cả thư mục con).</span>
        {!dangChay && !daXong && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#9AA1AE] bg-white px-3 text-center hover:border-[#8E1B22]">
            <FolderUp className="h-6 w-6 text-[#8E1B22]" /><span className="text-[0.875rem] font-bold">Chọn thư mục</span>
            <input type="file" multiple className="sr-only" aria-label="Chọn thư mục" {...{ webkitdirectory: '', directory: '' }} onChange={(e) => { chon(e.target.files); e.target.value = ''; }} />
          </label>
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#9AA1AE] bg-white px-3 text-center hover:border-[#8E1B22]">
            <FileText className="h-6 w-6 text-[#8E1B22]" /><span className="text-[0.875rem] font-bold">Chọn nhiều tệp</span>
            <input type="file" multiple className="sr-only" aria-label="Chọn nhiều tệp" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={(e) => { chon(e.target.files); e.target.value = ''; }} />
          </label>
        </div>}
        {ds.length > 0 && <ul className="m-0 flex max-h-[min(44vh,380px)] list-none flex-col overflow-y-auto rounded-xl border border-vien p-0">
          {ds.map((d, i) => (
            <li key={i} className={cx('flex items-start gap-2.5 border-b border-[#F1EEE7] px-3 py-2 last:border-0', d.tt === 'bo' && 'opacity-60')}>
              <span className="mt-0.5 shrink-0">{bieu(d)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.8125rem] font-semibold">{d.f.name}</span>
                {(thuMucCon(d.f) || d.ghi || d.tt === 'doc' || d.tt === 'tai') && <span className={cx('truncate text-[0.75rem]', d.tt === 'loi' || d.tt === 'bo' ? 'text-nguy' : 'text-mo')}>
                  {d.tt === 'doc' ? d.ghi ?? 'Đang đọc…' : d.tt === 'tai' ? 'Đang tải lên Drive…' : d.ghi ?? `Thư mục: ${thuMucCon(d.f)}`}</span>}
              </span>
              {!dangChay && d.tt === 'cho' && <button onClick={() => setDs((x) => x.filter((_, j) => j !== i))} aria-label="Bỏ tệp" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-mo hover:bg-nen"><X className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>}
        {!daXong && <>
          <label className="flex items-start gap-3 rounded-xl bg-nguy-nhat px-3 py-2.5 text-[0.8125rem] text-nguy">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={khongMat} disabled={dangChay} onChange={(e) => setKhongMat(e.target.checked)} />
            <span><ShieldAlert className="mr-1 inline h-4 w-4" /><b>Các văn bản không mật</b> (hệ thống không lưu văn bản mật; PDF có dấu độ mật tự bỏ qua)</span>
          </label>
          <label className="flex items-start gap-3 px-1 text-[0.8125rem] text-mo-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#8E1B22]" checked={khongVaoSo} disabled={dangChay} onChange={(e) => setKhongVaoSo(e.target.checked)} />
            <span>Tài liệu họp — <b className="text-den">không ghi vào sổ công văn đi</b> (bỏ tích nếu là văn bản do Thường trực ban hành)</span>
          </label>
        </>}
        {loi && <HopLoi loi={loi} />}
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-[0.8125rem] text-mo">{daXong ? <>Đã tải <b className="mono text-den">{ds.filter((d) => d.tt === 'xong').length}</b>/{ds.length} tệp</> : <><b className="mono text-den">{soTai}</b> tệp sẽ tải lên</>}</span>
          {daXong ? <Nut kieu="chinh" onClick={() => xong(ds.filter((d) => d.tt === 'xong').length)}>Xong</Nut> : <>
            <Nut onClick={dong} disabled={dangChay}>Huỷ</Nut>
            <Nut kieu="chinh" dangChay={dangChay} onClick={() => void chay()}>Tải lên</Nut>
          </>}
        </div>
      </div>
    </HopThoai>
  );
}
