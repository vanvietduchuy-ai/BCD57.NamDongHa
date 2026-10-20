// Minh chứng nhiệm vụ bằng văn bản PDF: web tự đọc số, ký hiệu, ngày ban hành, trích yếu, người ký
// -> lưu vào kho văn bản, gắn với nhiệm vụ, tự vào sổ văn bản (đi / đến)
import { useState } from 'react';
import { xoaTepNhap } from '../lib/nhapTam';
import { BookCheck, FileText, FileUp, Trash2 } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ngay } from '../lib/dinhDang';
import { META_TRONG, type MetaVb } from '../lib/docPdf';
import type { LoaiVb } from '../lib/vanBan';
import OVanBanPdf, { kiemTraMeta, taiPdfLenDrive } from './VanBanPdf';
import { NutTepDrive } from './TepDrive';
import { HopLoi, HopThoai, Nut } from './ui';

export type MinhChung = {
  van_ban_id: string; so_ky_hieu: string | null; ngay_ban_hanh: string | null; trich_yeu: string; loai: LoaiVb;
  nguoi_ky: string | null; chuc_vu_nguoi_ky: string | null; co_quan_ban_hanh: string; drive_file_id: string | null;
  drive_url: string | null; ten_tep: string | null; don_vi: string | null; vao_so: string | null; tao_luc: string; tao_boi: string | null;
};
export const COT_MINH_CHUNG = 'van_ban_id, so_ky_hieu, ngay_ban_hanh, trich_yeu, loai, nguoi_ky, chuc_vu_nguoi_ky, co_quan_ban_hanh, drive_file_id, drive_url, ten_tep, don_vi, vao_so, tao_luc, tao_boi';

type KetQua = { van_ban_id: string; so: { loai_so: 'di' | 'den'; so_thu_tu: number; don_vi: string }[] };

export default function MinhChungVanBan({ nhiemVuId, ds, suaDuoc, xoaDuoc, xong, gon = false }: {
  nhiemVuId: string; ds: MinhChung[]; suaDuoc: boolean; xoaDuoc: boolean; xong: () => void; gon?: boolean;   // gon: chỉ hiện nút nhỏ "Tải PDF" (khung chi tiết bảng A4)
}) {
  const { hoSo } = useAuth();
  const macDinh = (): MetaVb => ({ ...META_TRONG, loai: 'khac', co_quan_ban_hanh: hoSo?.don_vi?.ten ?? '' });
  const [mo, setMo] = useState(false);
  const [meta, setMeta] = useState<MetaVb>(macDinh);
  const [tep, setTep] = useState<File | null>(null);
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [tb, setTb] = useState<string | null>(null);

  const moHop = () => { setMeta(macDinh()); setTep(null); setLoi(null); setMo(true); };
  const luu = async () => {
    setLoi(null);
    if (!tep) { setLoi('Chọn tệp PDF văn bản'); return; }
    const l = kiemTraMeta(meta, false); if (l) { setLoi(l); return; }
    setDangChay(true);
    try {
      const len = await taiPdfLenDrive(tep, 'van_ban_nhiem_vu', { nhiemVuId });
      const { data, error } = await supabase.rpc('nhiem_vu_gan_van_ban', { p_nv: nhiemVuId, p: {
        ...meta, drive_file_id: len.drive_file_id, drive_url: len.url ?? '', ten_tep: tep.name,
      } });
      if (error) throw error;
      const kq = data as KetQua;
      setTb(`Đã lưu minh chứng${kq.so.length ? ` · vào ${kq.so.map((s) => `${s.loai_so === 'di' ? 'sổ đi' : 'sổ đến'} số ${s.so_thu_tu}${s.don_vi !== hoSo?.don_vi?.ten ? ` (${s.don_vi})` : ''}`).join(', ')}` : ''}.`);
      void xoaTepNhap(`mc:${nhiemVuId}`);
      setMo(false); xong();
    } catch (e) { setLoi(loiDe(e)); } finally { setDangChay(false); }
  };
  const go = async (m: MinhChung) => {
    if (!window.confirm(`Gỡ minh chứng "${m.so_ky_hieu ?? m.trich_yeu}" khỏi nhiệm vụ? Văn bản vẫn còn trong kho và sổ văn bản.`)) return;
    const { error } = await supabase.from('nhiem_vu_van_ban').delete().eq('nhiem_vu_id', nhiemVuId).eq('van_ban_id', m.van_ban_id);
    if (error) setTb(loiDe(error)); else xong();
  };

  return (
    <div className={gon ? 'contents' : 'flex flex-col gap-2.5'}>
      {tb && !gon && <div role="status" className="rounded-xl bg-[#DCFCE7] px-3 py-2 text-[0.8125rem] text-[#166534]">{tb}</div>}
      {ds.map((m) => (
        <div key={m.van_ban_id} className="flex gap-3 rounded-xl bg-nen-2 p-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-xanh" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="mono text-[0.8125rem] font-bold text-den">{m.so_ky_hieu ?? 'Chưa có số'}{m.ngay_ban_hanh ? ` · ${ngay(m.ngay_ban_hanh)}` : ''}</span>
            <span className="text-[0.875rem] font-semibold leading-snug">{m.trich_yeu}</span>
            <span className="text-xs text-mo">{m.co_quan_ban_hanh}{m.nguoi_ky ? ` · ${[m.chuc_vu_nguoi_ky, m.nguoi_ky].filter(Boolean).join(' ')} ký` : ''}</span>
            {m.vao_so && <span className="mt-1 inline-flex items-center gap-1 self-start rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[0.75rem] font-semibold text-[#166534]"><BookCheck className="h-3.5 w-3.5" />{m.vao_so}</span>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {m.drive_file_id && !m.drive_file_id.startsWith('thu-') && <NutTepDrive loai="van_ban" id={m.van_ban_id} ten={m.ten_tep ?? 'van-ban.pdf'} nhan="Mở" duPhong={m.drive_url} />}
            {(xoaDuoc || m.tao_boi === hoSo?.id) && <button type="button" onClick={() => void go(m)} aria-label="Gỡ minh chứng" className="flex h-9 w-9 items-center justify-center rounded-lg text-nguy hover:bg-nguy-nhat"><Trash2 className="h-4 w-4" /></button>}
          </div>
        </div>
      ))}
      {suaDuoc && gon && (
        <button type="button" onClick={moHop} title="Tải văn bản PDF đã ký — tự đọc số, ngày ban hành; tự vào sổ văn bản"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-vien-2 px-2 text-[0.8125rem] font-semibold text-mo-2 hover:border-[#8E1B22] hover:text-[#8E1B22]">
          <FileUp className="h-4 w-4" />Tải PDF lên</button>
      )}
      {suaDuoc && !gon && (
        <button type="button" onClick={moHop} className="flex min-h-14 items-center gap-3 rounded-xl border border-dashed border-vien-2 bg-white px-3 py-2.5 text-left hover:bg-nen-2">
          <FileUp className="h-5 w-5 shrink-0 text-xanh" />
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.875rem] font-semibold text-den">Đính kèm văn bản (PDF)</span>
            <span className="text-xs text-mo">Tự đọc số, ngày ban hành, trích yếu, người ký · tự vào sổ văn bản</span>
          </span>
        </button>
      )}
      <HopThoai mo={mo} dong={() => setMo(false)} tieuDe="Minh chứng: văn bản PDF" rong="max-w-4xl">
        <div className="flex flex-col gap-4">
          <OVanBanPdf meta={meta} doiMeta={setMeta} tep={tep} chonTep={(f, m) => { setTep(f); setMeta({ ...m, loai: m.loai || 'khac' }); }} hienCoQuan tieuDe="Chọn văn bản PDF đã ký, đóng dấu" khoaNhap={`mc:${nhiemVuId}`} />
          {tep && <p className="m-0 rounded-xl bg-nen-3 px-3 py-2 text-[0.8125rem] text-mo-2">
            Văn bản của đơn vị mình → vào <b>sổ đi</b>{hoSo?.vai_tro === 'don_vi' ? <> và <b>sổ đến</b> của Cơ quan Thường trực</> : ''}; văn bản của cơ quan khác → vào <b>sổ đến</b>. Không lưu văn bản mật.
          </p>}
          {loi && <HopLoi loi={loi} />}
          <div className="flex justify-end gap-2">
            <Nut onClick={() => setMo(false)}>Huỷ</Nut>
            <Nut kieu="chinh" dangChay={dangChay} disabled={!tep} onClick={luu}>Lưu minh chứng, vào sổ</Nut>
          </div>
        </div>
      </HopThoai>
    </div>
  );
}
