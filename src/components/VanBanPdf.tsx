// Chọn PDF văn bản đã ký, đóng dấu → web tự đọc số, ký hiệu, ngày, trích yếu, người ký (sửa được) · Xem văn bản đã nộp
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileCheck2, FileText, FileUp, RefreshCw, ScanText, ShieldAlert } from 'lucide-react';
import { CHE_DO_THU, goiChucNang } from '../lib/supabase';
import { docVanBanPdf, META_TRONG, soKyHieu, type MetaVb } from '../lib/docPdf';
import { docVanBanWord } from '../lib/docWord';
import { LOAI_VB, type LoaiVb } from '../lib/vanBan';
import { ngay } from '../lib/dinhDang';
import { HopLoi, lopO, O, cx } from './ui';
import { NutTepDrive, useXemTruocDrive } from './TepDrive';
import { docTepNhap, luuMetaNhap, luuTepNhap, xoaTepNhap } from '../lib/nhapTam';
import XemPdf from './XemPdf';

export type VanBanDaNop = {
  id: string; so_van_ban: string | null; ky_hieu: string | null; so_ky_hieu: string | null; ngay_ban_hanh: string | null;
  trich_yeu: string; loai: LoaiVb; nguoi_ky: string | null; chuc_vu_nguoi_ky: string | null; co_quan_ban_hanh: string;
  drive_file_id: string | null; drive_url: string | null; ten_tep: string | null;
};
export const COT_VB_NOP = 'id, so_van_ban, ky_hieu, so_ky_hieu, ngay_ban_hanh, trich_yeu, loai, nguoi_ky, chuc_vu_nguoi_ky, co_quan_ban_hanh, drive_file_id, drive_url, ten_tep';

export const metaTuVanBan = (v: VanBanDaNop | null | undefined): MetaVb => (v ? {
  ...META_TRONG, so_van_ban: v.so_van_ban ?? '', ky_hieu: v.ky_hieu ?? '', ngay_ban_hanh: v.ngay_ban_hanh ?? '', loai: v.loai,
  trich_yeu: v.trich_yeu, nguoi_ky: v.nguoi_ky ?? '', chuc_vu_nguoi_ky: v.chuc_vu_nguoi_ky ?? '', co_quan_ban_hanh: v.co_quan_ban_hanh,
} : { ...META_TRONG });

const laThu = (id?: string | null) => !id || id.startsWith('thu-');
export const linkXemDrive = (id?: string | null) => (laThu(id) ? null : `https://drive.google.com/file/d/${id}/view`);

// Tải PDF lên Google Drive qua Edge Function (chế độ thử: không có Drive)
export async function taiPdfLenDrive(file: File, loai: 'van_ban_nop' | 'van_ban' | 'van_ban_nhiem_vu' | 'cong_van', o: { nopId?: string; nhiemVuId?: string; thuMuc?: string } = {}) {
  if (CHE_DO_THU) return { drive_file_id: `thu-${Date.now()}`, url: null as string | null };
  const fd = new FormData();
  fd.append('file', file); fd.append('loai', loai);
  if (o.nopId) fd.append('nop_bao_cao_id', o.nopId);
  if (o.nhiemVuId) fd.append('nhiem_vu_id', o.nhiemVuId);
  if (o.thuMuc) fd.append('thu_muc', o.thuMuc);
  return goiChucNang<{ drive_file_id: string; url: string | null }>('drive-upload', fd, true);
}

export function kiemTraMeta(m: MetaVb, batBuoc = true): string | null {
  if (m.mat) return 'Văn bản có độ mật — không nộp lên hệ thống.';
  if (!m.trich_yeu.trim()) return 'Nhập trích yếu văn bản';
  if (batBuoc && !m.so_van_ban.trim()) return 'Nhập số văn bản';
  if (batBuoc && !m.ngay_ban_hanh) return 'Nhập ngày ban hành';
  return null;
}

// ---------- Ô chọn PDF + thông tin văn bản ----------
// khoaNhap: giữ tạm tệp + thông tin trên máy (IndexedDB) để khôi phục khi trang bị tải lại; xoá khi tep về null sau khi lưu
export default function OVanBanPdf({ meta, doiMeta: doiMeta_, tep, chonTep: chonTep_, driveId, hienCoQuan = false, tieuDe = 'Văn bản đã ký, đóng dấu (PDF)', khoaNhap }: {
  meta: MetaVb; doiMeta: (m: MetaVb) => void;
  tep: File | null; chonTep: (f: File, m: MetaVb) => void;
  driveId?: string | null; hienCoQuan?: boolean; tieuDe?: string; khoaNhap?: string;
}) {
  const [dangDoc, setDangDoc] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [blob, setBlob] = useState<string | null>(null);
  const [khoiPhuc, setKhoiPhuc] = useState(false);
  const oTep = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!tep) { setBlob(null); return; }
    const u = URL.createObjectURL(tep); setBlob(u);
    return () => URL.revokeObjectURL(u);
  }, [tep]);
  // Khôi phục tệp đang nhập dở (trang bị tải lại)
  useEffect(() => {
    if (!khoaNhap || tep) return;
    let huy = false;
    void docTepNhap(khoaNhap).then((b) => { if (b && !huy) { chonTep_(b.tep, b.meta); setKhoiPhuc(true); } });
    return () => { huy = true; };
  }, [khoaNhap]); // eslint-disable-line react-hooks/exhaustive-deps
  // Lưu / gửi xong (tep về null) thì xoá bản tạm
  const tepTruoc = useRef<File | null>(null);
  useEffect(() => { if (khoaNhap && tepTruoc.current && !tep) void xoaTepNhap(khoaNhap); tepTruoc.current = tep; }, [tep, khoaNhap]);
  const chonTep = (f: File, m: MetaVb) => { chonTep_(f, m); setKhoiPhuc(false); if (khoaNhap) void luuTepNhap(khoaNhap, f, m); };
  const doiMeta = (m: MetaVb) => { doiMeta_(m); if (khoaNhap && tep) void luuMetaNhap(khoaNhap, m); };

  const doc = async (f: File) => {
    setLoi(null);
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setLoi('Chọn tệp PDF'); return; }
    if (f.size > 25 * 1024 * 1024) { setLoi('Tệp lớn hơn 25 MB'); return; }
    try {
      setDangDoc('Đang đọc PDF…');
      const m = await docVanBanPdf(f, setDangDoc);
      // Giữ giá trị mặc định (VD tên đơn vị) khi không đọc được
      chonTep(f, { ...m, co_quan_ban_hanh: m.co_quan_ban_hanh || meta.co_quan_ban_hanh, loai: m.loai || meta.loai });
    } catch (e) {
      setLoi(`Không đọc được PDF (${e instanceof Error ? e.message : 'lỗi'}). Nhập thông tin thủ công.`);
      chonTep(f, { ...meta, noi_dung: '' });
    } finally { setDangDoc(null); }
  };
  const dat = <K extends keyof MetaVb>(k: K, v: MetaVb[K]) => doiMeta({ ...meta, [k]: v });
  // Điền thông tin từ bản Word (.docx) của văn bản — dùng khi PDF là bản scan đọc chưa đúng; tệp nộp vẫn là PDF
  const tuWord = async (f: File) => {
    setLoi(null); setDangDoc('Đang đọc tệp Word…');
    try {
      const w = await docVanBanWord(f);
      const giu = (k: keyof MetaVb) => (w[k] ? { [k]: w[k] } : {});
      doiMeta({ ...meta, ...giu('so_van_ban'), ...giu('ky_hieu'), ...giu('ngay_ban_hanh'), ...giu('trich_yeu'), ...giu('nguoi_ky'), ...giu('chuc_vu_nguoi_ky'),
        ...(hienCoQuan ? giu('co_quan_ban_hanh') : {}), ...(w.trich_yeu || w.ky_hieu ? { loai: w.loai } : {}), ...(w.noi_dung ? { noi_dung: w.noi_dung } : {}), mat: meta.mat || w.mat });
    } catch (e) { setLoi(e instanceof Error ? e.message : 'Không đọc được tệp Word'); } finally { setDangDoc(null); }
  };
  const coTep = !!tep || !!driveId;
  const xem = blob ?? (laThu(driveId) ? null : `https://drive.google.com/file/d/${driveId}/preview`);

  const chon = (
    <input ref={oTep} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Chọn tệp PDF"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) void doc(f); e.target.value = ''; }} />
  );

  if (!coTep) return (
    <div className="flex flex-col gap-2">
      <label className={cx('flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#9AA1AE] bg-white px-4 text-center', dangDoc && 'opacity-70')}>
        <FileUp className="h-8 w-8 text-xanh" />
        <span className="text-[0.9375rem] font-bold">{dangDoc ?? tieuDe}</span>
        <span className="text-[0.8125rem] text-mo">PDF đã ký, đóng dấu</span>
        {chon}
      </label>
      {loi && <HopLoi loi={loi} />}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2 text-[0.8125rem]">
          <FileCheck2 className="h-4 w-4 shrink-0 text-xanh" />
          <span className="min-w-0 flex-1 truncate font-semibold">{tep?.name ?? 'Văn bản đã nộp'}</span>
          <label className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 font-semibold text-[#8E1B22] hover:bg-xanh-nhat/50">
            <RefreshCw className="h-4 w-4" />Đổi tệp{chon}
          </label>
        </div>
        {xem
          ? (blob ? <XemPdf url={blob} cao="h-[420px] lg:h-[560px]" /> : <iframe title="Xem văn bản PDF" src={xem} className="h-[420px] w-full rounded-xl border border-vien bg-nen lg:h-[560px]" />)
          : <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-vien text-[0.8125rem] text-mo">Bản thử — không có tệp trên Google Drive</div>}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {dangDoc && <div className="rounded-xl bg-xanh-nhat px-3 py-2 text-[0.8125rem] text-xanh">{dangDoc}</div>}
        {khoiPhuc && <div className="rounded-xl bg-[#FEF9E7] px-3 py-2 text-[0.8125rem] font-semibold text-cam-dam">Đã khôi phục tệp và thông tin đang nhập dở. Kiểm tra rồi lưu / gửi.</div>}
        {meta.mat && <div className="flex items-center gap-2 rounded-xl bg-nguy-nhat px-3 py-2 text-[0.8125rem] font-semibold text-nguy"><ShieldAlert className="h-4 w-4" />Văn bản có độ mật — không nộp lên hệ thống.</div>}
        {tep && !dangDoc && (
          <div className="flex items-center gap-2 rounded-xl bg-nen-3 px-3 py-2 text-[0.7812rem] text-mo-2">
            <ScanText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{meta.ocr ? 'Bản scan: đã nhận dạng chữ.' : 'Đã đọc tự động.'} Kiểm tra, sửa nếu sai.</span>
            <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 font-semibold text-[#8E1B22] hover:bg-white" title="Đọc số, ký hiệu, trích yếu… từ bản Word của văn bản; tệp nộp vẫn là PDF">
              <FileText className="h-3.5 w-3.5" />Điền từ tệp Word
              <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-label="Chọn tệp Word để điền thông tin"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void tuWord(f); e.target.value = ''; }} />
            </label>
          </div>
        )}
        {loi && <HopLoi loi={loi} />}
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
          <O nhan="Số"><input className={cx(lopO, 'so')} inputMode="numeric" value={meta.so_van_ban} onChange={(e) => dat('so_van_ban', e.target.value.trim())} /></O>
          <O nhan="Ký hiệu"><input className={lopO} value={meta.ky_hieu} placeholder="BC-VHXH" onChange={(e) => dat('ky_hieu', e.target.value.replace(/\s/g, ''))} /></O>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <O nhan="Ngày ban hành"><input type="date" className={lopO} value={meta.ngay_ban_hanh} onChange={(e) => dat('ngay_ban_hanh', e.target.value)} /></O>
          <O nhan="Loại"><select className={lopO} value={meta.loai} onChange={(e) => dat('loai', e.target.value as LoaiVb)}>{Object.entries(LOAI_VB).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></O>
        </div>
        <O nhan="Trích yếu"><textarea className={cx(lopO, 'min-h-20 py-2')} value={meta.trich_yeu} onChange={(e) => dat('trich_yeu', e.target.value)} /></O>
        {hienCoQuan && <O nhan="Cơ quan ban hành"><input className={lopO} value={meta.co_quan_ban_hanh} onChange={(e) => dat('co_quan_ban_hanh', e.target.value)} /></O>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <O nhan="Người ký"><input className={lopO} value={meta.nguoi_ky} onChange={(e) => dat('nguoi_ky', e.target.value)} /></O>
          <O nhan="Chức vụ người ký"><input className={lopO} value={meta.chuc_vu_nguoi_ky} onChange={(e) => dat('chuc_vu_nguoi_ky', e.target.value)} /></O>
        </div>
        {(meta.so_van_ban || meta.ky_hieu) && <span className="text-xs text-mo">Số, ký hiệu: <b className="so text-den">{soKyHieu(meta.so_van_ban, meta.ky_hieu)}</b></span>}
      </div>
    </div>
  );
}

// ---------- Xem thông tin văn bản đã nộp ----------
export function ThongTinVanBan({ vb, xemTruoc = true, them }: { vb: VanBanDaNop; xemTruoc?: boolean; them?: ReactNode }) {
  const coTep = !laThu(vb.drive_file_id);
  const xt = useXemTruocDrive('van_ban', vb.id, xemTruoc && coTep);
  const dong: [string, ReactNode][] = [
    ['Số, ký hiệu', <b className="so">{vb.so_ky_hieu ?? '—'}</b>],
    ['Ngày ban hành', vb.ngay_ban_hanh ? ngay(vb.ngay_ban_hanh) : '—'],
    ['Loại', LOAI_VB[vb.loai]],
    ['Trích yếu', vb.trich_yeu],
    ['Cơ quan ban hành', vb.co_quan_ban_hanh],
    ['Người ký', [vb.chuc_vu_nguoi_ky, vb.nguoi_ky].filter(Boolean).join(' ') || '—'],
  ];
  return (
    <div className={cx('grid grid-cols-1 gap-4', xemTruoc && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
      <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] content-start gap-x-3 gap-y-2 text-sm">
        {dong.map(([k, v]) => <div key={k} className="contents"><dt className="text-mo">{k}</dt><dd className="m-0">{v}</dd></div>)}
        <dt className="text-mo">Tệp</dt>
        <dd className="m-0">{coTep ? <NutTepDrive loai="van_ban" id={vb.id} ten={vb.ten_tep ?? `${vb.so_ky_hieu ?? 'van-ban'}.pdf`} nhan={vb.ten_tep ?? 'Mở tệp'} duPhong={vb.drive_url} className="-ml-2" /> : <span className="text-mo">{vb.ten_tep ?? 'Bản thử'}</span>}</dd>
        {them}
      </dl>
      {xemTruoc && (!coTep
        ? <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-vien text-[0.8125rem] text-mo">Bản thử — không có tệp trên Google Drive</div>
        : xt.url ? <XemPdf url={xt.url} />
        : xt.loi ? <iframe title="Xem văn bản" src={`https://drive.google.com/file/d/${vb.drive_file_id}/preview`} className="h-[480px] w-full rounded-xl border border-vien bg-nen" />
        : <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-vien text-[0.8125rem] text-mo">Đang tải văn bản từ Google Drive…</div>)}
    </div>
  );
}

