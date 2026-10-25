import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, HardDrive, Play, Plus, XCircle } from 'lucide-react';
import { goiChucNang, loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { ngayGio } from '../lib/dinhDang';
import { Chip, DangTai, Hang, HopLoi, HopThoai, lopO, Nut, O, The, ThanhThaoTac, TieuDeThe, TieuDeTrang, cx } from '../components/ui';
import { NutTepDrive } from '../components/TepDrive';
import LichDinhKy from '../components/LichDinhKy';
import { laAdmin, useAuth } from '../lib/auth';
import { BCT_MAC_DINH, KHOA_BCT, TEN_THU, type CauHinhBCT } from '../lib/baoCaoTuan';
import { khongDau } from '../lib/nhiemVu';
import { HopLienHe, hienSdt, luuLienHe, type LienHe } from '../components/LienHe';
import YeuCauDangKy from '../components/YeuCauDangKy';
import TaoTaiKhoanHangLoat, { KHOI_DV, khoiCua, TaoTaiKhoanTheoDonVi, type DvTk } from '../components/TaiKhoanHangLoat';

type Tab = 'tai_khoan' | 'dang_ky' | 'don_vi' | 'lich' | 'cai_dat' | 'luu_tru' | 'nhat_ky';
const TABS: [Tab, string][] = [['tai_khoan', 'Tài khoản'], ['dang_ky', 'Yêu cầu đăng ký'], ['don_vi', 'Đơn vị'], ['lich', 'Lịch báo cáo định kỳ'], ['cai_dat', 'Cài đặt'], ['luu_tru', 'Lưu trữ & tự động'], ['nhat_ky', 'Nhật ký']];

export default function QuanTri() {
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : 'tai_khoan') as Tab;
  const setTab = (k: Tab) => setSp({ tab: k }, { replace: true });
  const { data: soCho } = useDuLieu(async () => (await supabase.from('yeu_cau_dang_ky').select('id', { count: 'exact', head: true }).eq('trang_thai', 'cho')).count ?? 0);
  return (
    <>
      <TieuDeTrang tren="Chỉ tài khoản Quản trị hệ thống · tài khoản, đơn vị, lưu trữ, nhật ký" ten="Quản trị hệ thống" />
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-vien">
        {TABS.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('h-11 whitespace-nowrap px-4 text-[0.9062rem]', tab === k ? 'border-b-2 border-ink font-bold text-den' : 'font-medium text-mo hover:text-den')}>{t}{k === 'dang_ky' && !!soCho && <span className="so ml-1.5 rounded-full bg-nguy px-1.5 py-0.5 text-[11px] font-bold text-white">{soCho}</span>}</button>)}
      </div>
      {tab === 'tai_khoan' && <TaiKhoan />}
      {tab === 'dang_ky' && <YeuCauDangKy />}
      {tab === 'don_vi' && <><DauMoi /><DonVi /></>}
      {tab === 'lich' && <LichTheoDonVi />}
      {tab === 'cai_dat' && <CaiDat />}
      {tab === 'luu_tru' && <LuuTru />}
      {tab === 'nhat_ky' && <NhatKy />}
    </>
  );
}

type Nd = { id: string; ho_ten: string; email: string | null; chuc_vu: string | null; vai_tro: string; don_vi_id: string | null; hoat_dong: boolean; doi_mat_khau?: boolean; don_vi: { ten: string; loai: string } | null };
const VT: Record<string, [string, string, string]> = { admin: ['Quản trị hệ thống', 'bg-den', 'text-white'], quan_tri: ['Cơ quan Thường trực', 'bg-ink', 'text-white'], lanh_dao: ['Lãnh đạo', 'bg-nguy-nhat', 'text-nguy'], don_vi: ['Đơn vị', 'bg-nen-3', 'text-mo-2'] };

function TaiKhoan() {
  const { hoSo } = useAuth();
  const [mo, setMo] = useState(false);
  const [moNhieu, setMoNhieu] = useState(false);
  const [moTheoDv, setMoTheoDv] = useState(false);
  const [khoi, setKhoi] = useState('');
  const [sdtCua, setSdtCua] = useState<Nd | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const { data, loi: loiTai, dangTai, taiLai } = useDuLieu(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('nguoi_dung').select('id, ho_ten, email, chuc_vu, vai_tro, don_vi_id, hoat_dong, doi_mat_khau, don_vi(ten, loai)').order('vai_tro').order('ho_ten'),
      supabase.from('don_vi').select('id, ma, ten, loai').eq('hoat_dong', true).order('thu_tu'),
      supabase.from('lien_he_nguoi_dung').select('nguoi_dung_id, so_dien_thoai, nhan_zalo, nhan_goi'),
    ]);
    const lh = new Map(((kq(c) ?? []) as LienHe[]).map((x) => [x.nguoi_dung_id, x]));
    return { nd: (kq(a) ?? []) as unknown as Nd[], dv: (kq(b) ?? []) as DvTk[], lh };
  });
  const doi = async (id: string, sua: Partial<Nd>) => {
    if (id === hoSo?.id && (sua.vai_tro || sua.hoat_dong === false)) { setLoi('Không tự khoá hoặc đổi vai trò tài khoản đang dùng.'); return; }
    if (sua.vai_tro && !window.confirm(`Đổi vai trò thành "${VT[sua.vai_tro][0]}"?`)) { void taiLai(); return; }
    if (sua.hoat_dong === false && !window.confirm('Khoá tài khoản này?')) return;
    setLoi(null); const { error } = await supabase.from('nguoi_dung').update(sua).eq('id', id); if (error) setLoi(loiDe(error)); else void taiLai(); };
  const xoaTk = async (nd: Nd) => {
    if (nd.id === hoSo?.id) { setLoi('Không thể tự xoá tài khoản đang dùng.'); return; }
    if (!window.confirm(`XOÁ HẲN tài khoản "${nd.ho_ten}" (${nd.email})?\n\nKhông khôi phục được. Tài khoản đã có báo cáo, cập nhật hoặc văn bản sẽ không xoá được — khi đó hãy chọn "Khoá".`)) return;
    setLoi(null);
    const { error } = await supabase.rpc('xoa_tai_khoan', { p_id: nd.id });
    if (error) setLoi(/could not find the function|schema cache/i.test(error.message) ? 'Chưa cài chức năng xoá: chạy supabase/xoa-tai-khoan.sql trong Supabase SQL Editor.' : loiDe(error));
    else void taiLai();
  };
  const datLaiMk = async (nd: Nd) => {
    const mk = window.prompt(`Mật khẩu mới cho ${nd.ho_ten} (ít nhất 8 ký tự):`);
    if (!mk) return;
    try { await goiChucNang('quan-tri-tai-khoan', { hanh_dong: 'dat_lai_mat_khau', id: nd.id, mat_khau: mk });
      // Mật khẩu do quản trị đặt là mật khẩu tạm: người dùng phải đổi sang mật khẩu riêng ở lần đăng nhập kế tiếp
      await supabase.from('nguoi_dung').update({ doi_mat_khau: true }).eq('id', nd.id);
      setLoi(null); window.alert('Đã đặt lại mật khẩu. Người dùng sẽ phải đổi mật khẩu ở lần đăng nhập tới.'); void taiLai(); }
    catch (e) { setLoi(loiDe(e)); }
  };
  // Bắt đổi mật khẩu ở lần đăng nhập tới: một tài khoản, hoặc mọi tài khoản đang bật (trừ tài khoản đang dùng) chưa bị bắt đổi
  const batDoiMk = async (ds: Nd[], hoi: string) => {
    if (!ds.length || !window.confirm(hoi)) return;
    setLoi(null);
    const { error } = await supabase.from('nguoi_dung').update({ doi_mat_khau: true }).in('id', ds.map((x) => x.id));
    if (error) setLoi(loiDe(error)); else void taiLai();
  };
  const nutSdt = (n: Nd) => {
    const l = data?.lh.get(n.id);
    return (
      <button onClick={() => setSdtCua(n)} className="flex min-h-9 items-center gap-2 rounded-lg px-2 hover:bg-nen" aria-label={`Số điện thoại ${n.ho_ten}`}>
        {l?.so_dien_thoai ? <>
          <span className="so font-semibold">{hienSdt(l.so_dien_thoai)}</span>
        </> : <span className="font-semibold text-[#8E1B22]">+ Thêm SĐT</span>}
      </button>
    );
  };
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
        <div className="flex justify-end gap-2">
          <Nut icon={<Plus className="h-4 w-4" />} onClick={() => setMo(true)}>Tạo 1 tài khoản</Nut>
          <Nut kieu="chinh" icon={<Plus className="h-4 w-4" />} onClick={() => setMoNhieu(true)}>Tạo hàng loạt</Nut>
          <Nut icon={<Plus className="h-4 w-4" />} onClick={() => setMoTheoDv(true)}>Mỗi đơn vị 1 tài khoản</Nut>
          {(() => { const ds = (data?.nd ?? []).filter((x) => x.hoat_dong && !x.doi_mat_khau && x.id !== hoSo?.id); return ds.length > 0 && (
            <Nut onClick={() => void batDoiMk(ds, `Bắt ${ds.length} tài khoản đang hoạt động đổi mật khẩu ở lần đăng nhập tới (trừ tài khoản của bạn)?\n\nTài khoản nào đã tự đổi mật khẩu rồi cũng sẽ phải đổi lại một lần.`)}>Bắt đổi mật khẩu ({ds.length})</Nut>); })()}
        </div>
        <div className="-mx-3.5 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-3.5 sm:mx-0 sm:px-0">
          {[['', 'Tất cả'], ...KHOI_DV.map(([k, t]) => [k, t])].map(([k, t]) => {
            const n = data?.nd.filter((x) => !k || (x.don_vi ? khoiCua(x.don_vi.loai) === k : false)).length ?? 0;
            return <button key={k} aria-pressed={khoi === k} onClick={() => setKhoi(k)} className={cx('min-h-9 shrink-0 rounded-full border px-3 text-[0.8125rem] font-semibold', khoi === k ? 'border-ink bg-ink text-white' : 'border-vien-2 bg-white text-mo-2')}>{t} <span className="so opacity-70">{n}</span></button>;
          })}
        </div>
      </div>
      {(loi || loiTai) && <HopLoi loi={(loi || loiTai)!} />}
      {dangTai && !data && <DangTai />}
      {data && (
        <The className="overflow-hidden"><div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[880px] text-[0.8125rem]">
            <thead className="bg-nen-2 text-left text-[11px] text-mo"><tr><th className="px-4 py-3">NGƯỜI DÙNG</th><th className="px-2">ĐIỆN THOẠI</th><th className="px-2">ĐƠN VỊ</th><th className="px-2">VAI TRÒ</th><th className="px-2">TRẠNG THÁI</th><th className="px-4 text-right">THAO TÁC</th></tr></thead>
            <tbody>{data.nd.filter((x) => !khoi || (x.don_vi ? khoiCua(x.don_vi.loai) === khoi : false)).map((n) => (
              <tr key={n.id} className="border-t border-[#F1EEE7]">
                <td className="min-w-[220px] px-4 py-2.5"><div className="font-semibold">{n.ho_ten}</div><div className="text-xs text-mo">{n.email}{n.chuc_vu && ` · ${n.chuc_vu}`}</div></td>
                <td className="whitespace-nowrap px-2">{nutSdt(n)}</td>
                <td className="px-2"><select aria-label="Đơn vị" className={cx(lopO, 'min-h-9 w-[200px] text-[0.8125rem]')} value={n.don_vi_id ?? ''} onChange={(e) => doi(n.id, { don_vi_id: e.target.value || null })}><option value="">—</option>{data.dv.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}</select></td>
                <td className="px-2"><select aria-label="Vai trò" className={cx(lopO, 'min-h-9 text-[0.8125rem]')} value={n.vai_tro} onChange={(e) => doi(n.id, { vai_tro: e.target.value })}>{Object.entries(VT).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></td>
                <td className="px-2"><Chip nen={n.hoat_dong ? 'bg-xanh-nhat' : 'bg-cam-nhat'} chu={n.hoat_dong ? 'text-xanh' : 'text-cam-dam'}>{n.hoat_dong ? 'Đang hoạt động' : 'Đã khoá'}</Chip>{n.doi_mat_khau && <div className="mt-1 text-[11px] font-semibold text-cam-dam">Chờ đổi mật khẩu</div>}</td>
                <td className="whitespace-nowrap px-4 text-right">
                  <button className="mr-3 font-semibold text-[#8E1B22]" onClick={() => datLaiMk(n)}>Đặt lại MK</button>
                  {!n.doi_mat_khau && n.id !== hoSo?.id && <button className="mr-3 font-semibold text-mo-2" title="Bắt đổi mật khẩu ở lần đăng nhập tới" onClick={() => void batDoiMk([n], `Bắt ${n.ho_ten} đổi mật khẩu ở lần đăng nhập tới?`)}>Bắt đổi MK</button>}
                  <button className={cx('font-semibold', n.hoat_dong ? 'text-nguy' : 'text-xanh')} onClick={() => doi(n.id, { hoat_dong: !n.hoat_dong })}>{n.hoat_dong ? 'Khoá' : 'Mở khoá'}</button>
                  {n.id !== hoSo?.id && <button className="ml-3 font-semibold text-nguy" onClick={() => void xoaTk(n)}>Xoá</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {/* Điện thoại: mỗi tài khoản 1 thẻ, không cuộn ngang */}
        <ul className="m-0 flex list-none flex-col p-0 md:hidden">
          {data.nd.filter((x) => !khoi || (x.don_vi ? khoiCua(x.don_vi.loai) === khoi : false)).map((n) => (
            <li key={n.id} className="flex flex-col gap-2.5 border-b border-[#F1EEE7] px-4 py-3.5 last:border-0">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[0.9375rem] font-semibold leading-snug">{n.ho_ten}</span>
                  <span className="break-all text-xs text-mo">{n.email}{n.chuc_vu && ` · ${n.chuc_vu}`}</span>
                </div>
                <Chip nen={n.hoat_dong ? 'bg-xanh-nhat' : 'bg-cam-nhat'} chu={n.hoat_dong ? 'text-xanh' : 'text-cam-dam'}>{n.hoat_dong ? 'Hoạt động' : 'Đã khoá'}</Chip>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Đơn vị" className={cx(lopO, 'min-h-10 w-full min-w-0 text-[0.8125rem]')} value={n.don_vi_id ?? ''} onChange={(e) => doi(n.id, { don_vi_id: e.target.value || null })}><option value="">— Đơn vị —</option>{data.dv.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}</select>
                <select aria-label="Vai trò" className={cx(lopO, 'min-h-10 w-full min-w-0 text-[0.8125rem]')} value={n.vai_tro} onChange={(e) => doi(n.id, { vai_tro: e.target.value })}>{Object.entries(VT).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
              </div>
              <div className="-ml-2 flex items-center gap-1 text-[0.8125rem]">
                {nutSdt(n)}
                <span className="flex-1" />
                <button className="min-h-9 px-2 font-semibold text-[#8E1B22]" onClick={() => datLaiMk(n)}>Đặt lại MK</button>
                {!n.doi_mat_khau && n.id !== hoSo?.id && <button className="min-h-9 px-2 font-semibold text-mo-2" onClick={() => void batDoiMk([n], `Bắt ${n.ho_ten} đổi mật khẩu ở lần đăng nhập tới?`)}>Bắt đổi MK</button>}
                <button className={cx('min-h-9 px-2 font-semibold', n.hoat_dong ? 'text-nguy' : 'text-xanh')} onClick={() => doi(n.id, { hoat_dong: !n.hoat_dong })}>{n.hoat_dong ? 'Khoá' : 'Mở khoá'}</button>
                {n.id !== hoSo?.id && <button className="min-h-9 px-2 font-semibold text-nguy" onClick={() => void xoaTk(n)}>Xoá</button>}
              </div>
            </li>
          ))}
        </ul></The>
      )}
      {sdtCua && <HopLienHe key={sdtCua.id} mo dong={() => setSdtCua(null)} nguoiDungId={sdtCua.id} ten={sdtCua.ho_ten} xong={() => void taiLai()} />}
      <TaoTaiKhoan mo={mo} dong={() => setMo(false)} donVi={data?.dv ?? []} xong={() => { setMo(false); void taiLai(); }} />
      <TaoTaiKhoanTheoDonVi mo={moTheoDv} dong={() => setMoTheoDv(false)} donVi={data?.dv ?? []} daCo={new Set((data?.nd ?? []).map((x) => x.don_vi_id).filter((x): x is string => !!x))} xong={() => void taiLai()} />
      <TaoTaiKhoanHangLoat mo={moNhieu} dong={() => setMoNhieu(false)} donVi={data?.dv ?? []} xong={() => void taiLai()} />
    </>
  );
}

function TaoTaiKhoan({ mo, dong, donVi, xong }: { mo: boolean; dong: () => void; donVi: { id: string; ten: string }[]; xong: () => void }) {
  const [f, setF] = useState({ email: '', mat_khau: '', ho_ten: '', chuc_vu: '', vai_tro: 'don_vi', don_vi_id: '', sdt: '' });
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const tao = async () => {
    setLoi(null);
    if (!f.email || f.mat_khau.length < 8 || !f.ho_ten) { setLoi('Nhập email, họ tên và mật khẩu tối thiểu 8 ký tự'); return; }
    if (f.vai_tro === 'don_vi' && !f.don_vi_id) { setLoi('Tài khoản đơn vị phải chọn đơn vị'); return; }
    setDangChay(true);
    try {
      const { sdt, ...tk } = f;
      const r = await goiChucNang<{ id: string }>('quan-tri-tai-khoan', { hanh_dong: 'tao', ...tk, don_vi_id: f.don_vi_id || null });
      await supabase.from('nguoi_dung').update({ doi_mat_khau: true }).eq('id', r.id);   // mật khẩu ban đầu là mật khẩu tạm
      if (sdt.trim()) await luuLienHe(r.id, sdt).catch((e) => window.alert(`Đã tạo tài khoản, chưa lưu được SĐT: ${loiDe(e)}`));
      xong(); setF({ email: '', mat_khau: '', ho_ten: '', chuc_vu: '', vai_tro: 'don_vi', don_vi_id: '', sdt: '' });
    }
    catch (e) { setLoi(loiDe(e)); } finally { setDangChay(false); }
  };
  return (
    <HopThoai mo={mo} dong={dong} tieuDe="Tạo tài khoản">
      <div className="flex flex-col gap-3">
        {loi && <HopLoi loi={loi} />}
        <O nhan="Họ và tên"><input className={lopO} value={f.ho_ten} onChange={(e) => setF({ ...f, ho_ten: e.target.value })} /></O>
        <O nhan="Chức vụ"><input className={lopO} value={f.chuc_vu} onChange={(e) => setF({ ...f, chuc_vu: e.target.value })} /></O>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <O nhan="Email đăng nhập"><input className={lopO} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></O>
          <O nhan="Số điện thoại (Zalo cá nhân)"><input className={lopO} type="tel" inputMode="tel" placeholder="0912 345 678" value={f.sdt} onChange={(e) => setF({ ...f, sdt: e.target.value })} /></O>
        </div>
        <O nhan="Mật khẩu ban đầu (tối thiểu 8 ký tự)"><input className={lopO} type="text" value={f.mat_khau} onChange={(e) => setF({ ...f, mat_khau: e.target.value })} /></O>
        <div className="grid grid-cols-2 gap-3">
          <O nhan="Vai trò"><select className={lopO} value={f.vai_tro} onChange={(e) => setF({ ...f, vai_tro: e.target.value })}>{Object.entries(VT).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></O>
          <O nhan="Đơn vị"><select className={lopO} value={f.don_vi_id} onChange={(e) => setF({ ...f, don_vi_id: e.target.value })}><option value="">—</option>{donVi.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}</select></O>
        </div>
        <Nut kieu="chinh" dangChay={dangChay} onClick={tao}>Tạo tài khoản</Nut>
      </div>
    </HopThoai>
  );
}

// Đầu mối lĩnh vực: đơn vị nhận, đôn đốc, tổng hợp báo cáo của các đơn vị rồi gửi Thường trực BCĐ
const LV_DAU_MOI: [string, string][] = [['nq57', 'Nghị quyết 57'], ['khcn_dmst', 'KHCN, đổi mới sáng tạo'], ['chuyen_doi_so', 'Chuyển đổi số'], ['de_an_06', 'Đề án 06']];
function DauMoi() {
  const [loi, setLoi] = useState<string | null>(null);
  const { data, taiLai } = useDuLieu(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('dau_moi_linh_vuc').select('linh_vuc, don_vi_id'),
      supabase.from('don_vi').select('id, ten').eq('hoat_dong', true).eq('phai_bao_cao', true).order('thu_tu'),
      supabase.from('cau_hinh').select('gia_tri').eq('khoa', 'tong_hop_linh_vuc').maybeSingle(),
    ]);
    return { dm: (kq(a) ?? []) as { linh_vuc: string; don_vi_id: string }[], dv: (kq(b) ?? []) as { id: string; ten: string }[], ngay: Number((c.data?.gia_tri as { sau_han_don_vi_ngay?: number } | undefined)?.sau_han_don_vi_ngay ?? 2) };
  });
  const chay = async (p: PromiseLike<{ error: unknown }>) => { setLoi(null); const { error } = await p; if (error) setLoi(loiDe(error)); else void taiLai(); };
  if (!data) return null;
  return (
    <The className="flex flex-col gap-1 p-4">
      <TieuDeThe>Đầu mối lĩnh vực</TieuDeThe>
      {loi && <HopLoi loi={loi} />}
      {LV_DAU_MOI.map(([lv, ten]) => (
        <Hang key={lv} nhan={ten}>
          <select aria-label={`Đầu mối ${ten}`} className={cx(lopO, 'min-h-10 w-full sm:w-80')} value={data.dm.find((x) => x.linh_vuc === lv)?.don_vi_id ?? ''}
            onChange={(e) => chay(e.target.value
              ? supabase.from('dau_moi_linh_vuc').upsert({ linh_vuc: lv, don_vi_id: e.target.value })
              : supabase.from('dau_moi_linh_vuc').delete().eq('linh_vuc', lv))}>
            <option value="">— Không có (đơn vị gửi thẳng Thường trực) —</option>
            {data.dv.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}
          </select>
        </Hang>
      ))}
      <Hang nhan="Hạn nộp tổng hợp lĩnh vực">
        <input type="number" min={0} max={10} aria-label="Số ngày sau hạn đơn vị" className={cx(lopO, 'so w-20')} defaultValue={data.ngay}
          onBlur={(e) => chay(supabase.from('cau_hinh').update({ gia_tri: { sau_han_don_vi_ngay: Number(e.target.value) || 0 } }).eq('khoa', 'tong_hop_linh_vuc'))} />
        <span className="text-[0.8125rem] text-mo">ngày sau hạn đơn vị</span>
      </Hang>
    </The>
  );
}

type Dv = { id: string; ma: string; ten: string; loai: string; thu_tu: number; phai_bao_cao: boolean; hoat_dong: boolean }
  & { the_thuc: string; co_quan_chu_quan: string | null; ten_ban_hanh: string | null; ky_hieu: string | null; nguoi_ky_chuc_danh: string | null; nguoi_ky_ho_ten: string | null };
function DonVi() {
  const [loi, setLoi] = useState<string | null>(null);
  const [moThem, setMoThem] = useState<string | null>(null);
  const { data, dangTai, taiLai } = useDuLieu(async () => {
    const [a, b] = await Promise.all([supabase.from('don_vi').select('*').order('thu_tu'), supabase.from('nguoi_dung').select('don_vi_id').eq('hoat_dong', true)]);
    const dem = new Map<string, number>(); ((kq(b) ?? []) as { don_vi_id: string | null }[]).forEach((x) => x.don_vi_id && dem.set(x.don_vi_id, (dem.get(x.don_vi_id) ?? 0) + 1));
    return { dv: (kq(a) ?? []) as Dv[], dem };
  });
  const chay = async (p: PromiseLike<{ error: unknown }>) => { setLoi(null); const { error } = await p; if (error) setLoi(loiDe(error)); else void taiLai(); };
  return (
    <>
      {loi && <HopLoi loi={loi} />}
      {dangTai && !data && <DangTai />}
      {data && KHOI_DV.map(([k, ten, f]) => {
        const ds = data.dv.filter((d) => f(d.loai));
        if (!ds.length && k === 'lanh_dao') return null;
        return (
          <section key={k} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <h2 className="m-0 flex-1 text-[0.8125rem] font-bold uppercase tracking-wide text-mo">{ten} <span className="so font-semibold">· {ds.length}</span></h2>
              {k !== 'lanh_dao' && <Nut kieu="nhe" icon={<Plus className="h-4 w-4" />} onClick={() => setMoThem(k)}>Thêm</Nut>}
            </div>
            <The className="overflow-hidden">
              <ul className="m-0 list-none p-0">
                {ds.map((d) => (
                  <li key={d.id} className={cx('flex flex-wrap items-center gap-x-4 gap-y-0.5 border-b border-[#F1EEE7] px-4 py-2.5 last:border-0', !d.hoat_dong && 'opacity-55')}>
                    <div className="flex min-w-0 basis-full flex-col sm:flex-1 sm:basis-auto">
                      <span className="text-[0.875rem] font-semibold leading-snug">{d.ten}</span>
                      <span className="text-xs text-mo"><span className="so">{d.ma}</span> · {data.dem.get(d.id) ?? 0} tài khoản{d.loai === 'co_quan_thuong_truc' ? ' · Thường trực BCĐ' : ''}</span>
                    </div>
                    <label className="flex min-h-9 items-center gap-2 text-[0.8125rem]"><input type="checkbox" className="h-5 w-5 accent-ink" checked={d.phai_bao_cao} onChange={(e) => chay(supabase.from('don_vi').update({ phai_bao_cao: e.target.checked }).eq('id', d.id))} />Nộp báo cáo</label>
                    <label className="flex min-h-9 items-center gap-2 text-[0.8125rem]"><input type="checkbox" className="h-5 w-5 accent-ink" checked={d.hoat_dong} onChange={(e) => chay(supabase.from('don_vi').update({ hoat_dong: e.target.checked }).eq('id', d.id))} />Hoạt động</label>
                  </li>
                ))}
                {!ds.length && <li className="px-4 py-3 text-[0.8125rem] text-mo">Chưa có đơn vị.</li>}
              </ul>
            </The>
          </section>
        );
      })}
      {moThem && <ThemDonVi khoi={moThem} dong={() => setMoThem(null)} xong={() => { setMoThem(null); void taiLai(); }} daCo={data?.dv.map((d) => d.ma) ?? []} />}
    </>
  );
}

// Thêm nhiều đơn vị một lần (mỗi dòng 1 tên) — mã tự sinh từ chữ đầu, sửa được
const LOAI_THEO_KHOI: Record<string, string> = { cong_an: 'cong_an', truong_hoc: 'truong_hoc', phong_ban: 'phong_ban' };
const TIEN_TO: Record<string, string> = { cong_an: 'CA_', truong_hoc: '', phong_ban: '' };
const maTuTen = (khoi: string, ten: string) => TIEN_TO[khoi] + ten.replace(/^(Tổ|Trường|Phòng)\s+/i, '').split(/[\s–-]+/).filter((w) => w && !/^số$/i.test(w))
  .map((w) => (/^\d+$/.test(w) || (w.length > 1 && w === w.toUpperCase()) ? khongDau(w) : khongDau(w)[0] ?? '')).join('').toUpperCase().slice(0, 12);
function ThemDonVi({ khoi, dong, xong, daCo }: { khoi: string; dong: () => void; xong: () => void; daCo: string[] }) {
  const [chu, setChu] = useState(''); const [phaiBc, setPhaiBc] = useState(khoi !== 'cong_an');
  const [dang, setDang] = useState(false); const [loi, setLoi] = useState<string | null>(null);
  const ds = chu.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((ten) => ({ ten, ma: maTuTen(khoi, ten) }));
  const trung = ds.filter((d, i) => daCo.includes(d.ma) || ds.findIndex((x) => x.ma === d.ma) !== i);
  const them = async () => {
    setDang(true); setLoi(null);
    const { error } = await supabase.from('don_vi').insert(ds.map((d, i) => ({ ...d, loai: LOAI_THEO_KHOI[khoi], phai_bao_cao: phaiBc, thu_tu: ({ cong_an: 10, truong_hoc: 90, phong_ban: 40 } as Record<string, number>)[khoi] + i })));
    setDang(false); if (error) setLoi(loiDe(error)); else xong();
  };
  const goiY = khoi === 'cong_an' ? 'Tổ Cảnh sát trật tự\nTổ Phòng chống tội phạm\nTổ An ninh' : khoi === 'truong_hoc' ? 'Trường Mầm non …\nTrường Tiểu học …\nTrường THCS …' : 'Phòng …';
  return (
    <HopThoai mo dong={dong} tieuDe={`Thêm đơn vị · ${KHOI_DV.find(([k]) => k === khoi)?.[1]}`}>
      <div className="flex flex-col gap-3">
        {loi && <HopLoi loi={loi} />}
        <O nhan="Tên đơn vị (mỗi dòng 1 đơn vị)"><textarea rows={5} className={cx(lopO, 'py-2')} placeholder={goiY} value={chu} onChange={(e) => setChu(e.target.value)} /></O>
        {ds.length > 0 && <ul className="m-0 flex list-none flex-col gap-1 rounded-xl border border-vien p-2">
          {ds.map((d) => <li key={d.ten} className="flex items-center gap-2 text-[0.8125rem]"><span className={cx('so w-24 shrink-0 rounded bg-nen-3 px-1.5 text-center text-[11px] font-bold', trung.includes(d) && 'bg-nguy-nhat text-nguy')}>{d.ma}</span>{d.ten}</li>)}
        </ul>}
        <label className="flex min-h-9 items-center gap-2 text-[0.8125rem]"><input type="checkbox" className="h-5 w-5 accent-ink" checked={phaiBc} onChange={(e) => setPhaiBc(e.target.checked)} />Phải nộp báo cáo định kỳ BCĐ 57</label>
        <div className="flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut><Nut kieu="chinh" dangChay={dang} disabled={!ds.length || trung.length > 0} onClick={them}>Thêm {ds.length || ''} đơn vị</Nut></div>
      </div>
    </HopThoai>
  );
}

type NguoiKy = { chuc_danh: string; ho_ten: string };
type TheThuc = { co_quan_cap_tren: string; co_quan: string; ky_hieu: string; dia_danh: string; truong_ban: NguoiKy; cqtt_ky_to_trinh: NguoiKy };


// Trang Cài đặt của Cơ quan Thường trực (nhắc hạn, người ký, thể thức văn bản)
export function CaiDatTrang() {
  return (<><TieuDeTrang ten="Cài đặt" /><CaiDat /></>);
}

// Cài đặt bằng biểu mẫu (không sửa JSON): lịch tự mở kỳ, nhắc hạn, người ký, thể thức văn bản BCĐ
function CaiDat() {
  const { hoSo } = useAuth();
  const admin = laAdmin(hoSo);
  const { data, dangTai, taiLai } = useDuLieu(async () => {
    const a = await supabase.from('cau_hinh').select('khoa, gia_tri');
    const ch = Object.fromEntries(((kq(a) ?? []) as { khoa: string; gia_tri: unknown }[]).map((x) => [x.khoa, x.gia_tri]));
    return { ch };
  });
  const [g, setG] = useState<Record<string, unknown> | null>(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [tb, setTb] = useState<{ loi?: string; ok?: string } | null>(null);
  if (dangTai && !data) return <DangTai />;
  if (!data) return null;

  const nh = (data.ch.nhac_han ?? {}) as Record<string, unknown>;
  const kenh = (data.ch.kenh_nhac ?? ['web']) as string[];
  const nk = (data.ch.nguoi_ky_bao_cao ?? { chuc_danh: '', ho_ten: '' }) as NguoiKy;
  const tt = (data.ch.the_thuc_bcd ?? {}) as TheThuc;
  const bct = { ...BCT_MAC_DINH, ...(data.ch[KHOA_BCT] as Partial<CauHinhBCT> | undefined) };
  const macDinh: Record<string, unknown> = {
    n3: nh.truoc_3_ngay !== false, n1: nh.truoc_1_ngay !== false, nqh: nh.qua_han_hang_ngay !== false, nld: nh.bao_lanh_dao_sau_ngay ?? 2, email: kenh.includes('email'),
    nk_cd: nk.chuc_danh, nk_ht: nk.ho_ten,
    bct_thu: bct.thu, bct_gio: bct.gio, bct_phut: bct.phut ?? 0, bct_bat: bct.bat,
    tb_cd: tt.truong_ban?.chuc_danh ?? 'TRƯỞNG BAN', tb_ht: tt.truong_ban?.ho_ten ?? '', cqt: tt.co_quan_cap_tren ?? '', cq: tt.co_quan ?? '', kh: tt.ky_hieu ?? 'BCĐ',
  };
  const v = g ?? macDinh;
  const dat = (k: string, x: unknown) => setG({ ...v, [k]: x });
  const so_ = (k: string, min: number, max: number) => (
    <input type="number" min={min} max={max} className={cx(lopO, 'w-20 text-center')} value={String(v[k])} onChange={(e) => dat(k, Number(e.target.value))} />
  );

  const luu = async () => {
    setDangLuu(true); setTb(null);
    const viec: PromiseLike<{ error: unknown }>[] = [
      supabase.from('cau_hinh').upsert([
        { khoa: 'nhac_han', gia_tri: { ...nh, truoc_3_ngay: v.n3, truoc_1_ngay: v.n1, qua_han_hang_ngay: v.nqh, bao_lanh_dao_sau_ngay: Number(v.nld) }, mo_ta: 'Quy tắc nhắc hạn' },
        { khoa: 'kenh_nhac', gia_tri: ['web', v.email && 'email'].filter(Boolean), mo_ta: 'Kênh nhắc hạn' },
        { khoa: 'nguoi_ky_bao_cao', gia_tri: { chuc_danh: v.nk_cd, ho_ten: v.nk_ht }, mo_ta: 'Người ký báo cáo gửi Công an tỉnh' },
        ...(admin ? [{ khoa: KHOA_BCT, gia_tri: { thu: Number(v.bct_thu), gio: Number(v.bct_gio), phut: Number(v.bct_phut), bat: !!v.bct_bat }, mo_ta: 'Hạn nộp báo cáo tuần' }] : []),
        { khoa: 'the_thuc_bcd', gia_tri: { ...tt, co_quan_cap_tren: v.cqt, co_quan: v.cq, ky_hieu: v.kh, truong_ban: { chuc_danh: v.tb_cd, ho_ten: v.tb_ht } }, mo_ta: 'Thể thức văn bản Ban Chỉ đạo' },
      ]),
    ];
    const kqs = await Promise.all(viec);
    setDangLuu(false);
    const e = kqs.find((r) => r.error)?.error;
    if (e) setTb({ loi: loiDe(e) }); else { setTb({ ok: 'Đã lưu.' }); setG(null); void taiLai(); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <The className="flex flex-col px-5 py-3">
          <TieuDeThe>Nhắc hạn</TieuDeThe>
          <Hang nhan="Nhắc đơn vị">
            {([['n3', 'Trước 3 ngày'], ['n1', 'Trước 1 ngày'], ['nqh', 'Quá hạn: hằng ngày']] as const).map(([k, t]) => (
              <label key={k} className="flex min-h-10 items-center gap-2 rounded-lg bg-nen px-3"><input type="checkbox" className="h-5 w-5 accent-[#A4161A]" checked={!!v[k]} onChange={(e) => dat(k, e.target.checked)} />{t}</label>
            ))}
          </Hang>
          <Hang nhan="Báo lãnh đạo khi quá hạn">sau {so_('nld', 1, 30)} ngày</Hang>
          <Hang nhan="Gửi thêm qua email"><label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#A4161A]" checked={!!v.email} onChange={(e) => dat('email', e.target.checked)} />Có</label></Hang>
        </The>
        <The className="flex flex-col px-5 py-3">
          <TieuDeThe>Báo cáo tuần</TieuDeThe>
          <Hang nhan="Hạn nộp hằng tuần">
            <select disabled={!admin} aria-label="Thứ" className={cx(lopO, 'w-auto')} value={String(v.bct_thu)} onChange={(e) => dat('bct_thu', Number(e.target.value))}>
              {Object.entries(TEN_THU).map(([k, t]) => <option key={k} value={k}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select>
            <span className="flex items-center gap-1">
              <select disabled={!admin} aria-label="Giờ" className={cx(lopO, 'w-auto')} value={String(v.bct_gio)} onChange={(e) => dat('bct_gio', Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')} giờ</option>)}</select>
              <select disabled={!admin} aria-label="Phút" className={cx(lopO, 'w-auto')} value={String(v.bct_phut)} onChange={(e) => dat('bct_phut', Number(e.target.value))}>
                {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')} phút</option>)}</select>
            </span>
          </Hang>
          <p className="m-0 pb-1 text-xs text-mo">Tuần tính từ thứ Hai đến Chủ nhật. Đơn vị chủ trì nhập báo cáo tuần ngay trên bảng A4 nhiệm vụ (cột “Kết quả thực hiện”).{!admin && ' Chỉ tài khoản Quản trị hệ thống được đổi hạn nộp.'}</p>
        </The>
        <The className="flex flex-col px-5 py-3">
          <TieuDeThe>Người ký báo cáo gửi Công an tỉnh</TieuDeThe>
          <Hang nhan="Chức danh"><input className={cx(lopO, 'w-full sm:w-72')} value={String(v.nk_cd)} onChange={(e) => dat('nk_cd', e.target.value)} /></Hang>
          <Hang nhan="Cấp bậc, họ tên"><input className={cx(lopO, 'w-full sm:w-72')} value={String(v.nk_ht)} onChange={(e) => dat('nk_ht', e.target.value)} /></Hang>
        </The>
        <The className="flex flex-col px-5 py-3">
          <TieuDeThe>Văn bản của Ban Chỉ đạo</TieuDeThe>
          <Hang nhan="Cơ quan cấp trên"><input className={cx(lopO, 'w-full sm:w-72')} value={String(v.cqt)} onChange={(e) => dat('cqt', e.target.value)} /></Hang>
          <Hang nhan="Tên cơ quan ban hành"><input className={cx(lopO, 'w-full sm:w-72')} value={String(v.cq)} onChange={(e) => dat('cq', e.target.value)} /></Hang>
          <Hang nhan="Ký hiệu"><input className={cx(lopO, 'w-full sm:w-32')} value={String(v.kh)} onChange={(e) => dat('kh', e.target.value)} /></Hang>
          <Hang nhan="Người ký (Trưởng ban)"><input className={cx(lopO, 'w-full sm:w-40')} value={String(v.tb_cd)} onChange={(e) => dat('tb_cd', e.target.value)} /><input className={cx(lopO, 'w-full sm:w-56')} placeholder="Họ tên" value={String(v.tb_ht)} onChange={(e) => dat('tb_ht', e.target.value)} /></Hang>
        </The>
      </div>
      {tb?.loi && <HopLoi loi={tb.loi} />}
      <ThanhThaoTac trai={tb?.ok}>
        {g && <Nut onClick={() => setG(null)}>Huỷ</Nut>}
        <Nut kieu="chinh" disabled={!g} dangChay={dangLuu} onClick={luu}>Lưu cài đặt</Nut>
      </ThanhThaoTac>
    </div>
  );
}

type Nk = { id: number; bang: string; hanh_dong: string; boi: string | null; luc: string; du_lieu_moi: Record<string, unknown> | null; du_lieu_cu: Record<string, unknown> | null };
const BANG: Record<string, string> = { nop_bao_cao: 'Nộp báo cáo', ky_bao_cao: 'Kỳ báo cáo', nguoi_dung: 'Tài khoản', don_vi: 'Đơn vị', cau_hinh: 'Cấu hình', nhiem_vu: 'Nhiệm vụ', van_ban: 'Văn bản', tep: 'Tệp' };
// Tên cột, giá trị dễ đọc cho nhật ký (cột không có trong danh sách thì không hiện)
const COT: Record<string, string> = {
  trang_thai: 'Trạng thái', trang_thai_giao: 'Giao', phan_tram: 'Tiến độ %', han: 'Hạn', han_nop: 'Hạn nộp', ten: 'Tên', y_kien_duyet: 'Ý kiến',
  vai_tro: 'Vai trò', hoat_dong: 'Hoạt động', phai_bao_cao: 'Phải báo cáo', vai: 'Vai', tu_so: 'Số đã làm', mau_so: 'Tổng số', trich_yeu: 'Trích yếu', so_ky_hieu: 'Số ký hiệu',
};
const GIA_TRI: Record<string, string> = {
  chua_nop: 'Chưa nộp', nhap: 'Đang soạn', da_nop: 'Chờ duyệt', can_bo_sung: 'Cần bổ sung', da_duyet: 'Đã duyệt', de_xuat: 'Đề xuất', mo: 'Mở', khoa: 'Khoá',
  chua_trien_khai: 'Chưa triển khai', dang_thuc_hien: 'Đang thực hiện', trinh_ky: 'Trình ký', hoan_thanh: 'Hoàn thành', tam_dung: 'Tạm dừng',
  da_gui: 'Đã gửi', quan_tri: 'Quản trị', lanh_dao: 'Lãnh đạo', don_vi: 'Đơn vị', chu_tri: 'Chủ trì', phoi_hop: 'Phối hợp', true: 'Có', false: 'Không',
};
const giaTri = (x: unknown) => (x == null ? '∅' : GIA_TRI[String(x)] ?? String(x).slice(0, 40));

function NhatKy() {
  const { data, dangTai } = useDuLieu(async () => {
    const [a, b] = await Promise.all([supabase.from('nhat_ky').select('id, bang, hanh_dong, boi, luc, du_lieu_moi, du_lieu_cu').order('luc', { ascending: false }).limit(100), supabase.from('nguoi_dung').select('id, ho_ten')]);
    return { nk: (kq(a) ?? []) as Nk[], nd: new Map(((kq(b) ?? []) as { id: string; ho_ten: string }[]).map((x) => [x.id, x.ho_ten])) };
  });
  if (dangTai && !data) return <DangTai />;
  const tomTat = (n: Nk) => {
    if (n.hanh_dong !== 'UPDATE' || !n.du_lieu_cu || !n.du_lieu_moi) return String(n.du_lieu_moi?.ten ?? n.du_lieu_cu?.ten ?? n.du_lieu_moi?.trich_yeu ?? '');
    return Object.keys(n.du_lieu_moi).filter((k) => COT[k] && JSON.stringify(n.du_lieu_moi![k]) !== JSON.stringify(n.du_lieu_cu![k]))
      .map((k) => `${COT[k]}: ${giaTri(n.du_lieu_cu![k])} → ${giaTri(n.du_lieu_moi![k])}`).join('; ');
  };
  return (
    <The className="overflow-hidden"><div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px] text-[0.7812rem]">
        <thead className="bg-nen-2 text-left text-[11px] text-mo"><tr><th className="px-4 py-3">THỜI ĐIỂM</th><th className="px-2">NGƯỜI THỰC HIỆN</th><th className="px-2">DỮ LIỆU</th><th className="px-2">THAO TÁC</th><th className="px-4">THAY ĐỔI</th></tr></thead>
        <tbody>{data?.nk.map((n) => (
          <tr key={n.id} className="border-t border-[#F1EEE7] align-top">
            <td className="so whitespace-nowrap px-4 py-2 text-xs">{ngayGio(n.luc)}</td>
            <td className="px-2">{n.boi ? data.nd.get(n.boi) ?? 'Người dùng' : 'Hệ thống'}</td>
            <td className="px-2">{BANG[n.bang] ?? n.bang}</td>
            <td className="px-2">{({ INSERT: 'Thêm', UPDATE: 'Sửa', DELETE: 'Xoá' } as Record<string, string>)[n.hanh_dong]}</td>
            <td className="px-4 text-xs text-mo-2">{tomTat(n)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    <ul className="m-0 flex list-none flex-col p-0 md:hidden">
      {data?.nk.map((n) => (
        <li key={n.id} className="flex flex-col gap-0.5 border-b border-[#F1EEE7] px-4 py-3 last:border-0">
          <span className="text-xs text-mo"><span className="so">{ngayGio(n.luc)}</span> · {n.boi ? data.nd.get(n.boi) ?? 'Người dùng' : 'Hệ thống'}</span>
          <span className="text-[0.875rem] font-semibold">{({ INSERT: 'Thêm', UPDATE: 'Sửa', DELETE: 'Xoá' } as Record<string, string>)[n.hanh_dong]} · {BANG[n.bang] ?? n.bang}</span>
          {tomTat(n) && <span className="break-words text-xs text-mo-2">{tomTat(n)}</span>}
        </li>
      ))}
    </ul></The>
  );
}

// ---------------------------------------------------------------- Lịch báo cáo định kỳ theo đơn vị giao
function LichTheoDonVi() {
  const { data } = useDuLieu(async () => {
    const r = await supabase.from('dau_moi_linh_vuc').select('don_vi_id, don_vi(ten)');
    const m = new Map<string, string>();
    for (const x of (kq(r) ?? []) as unknown as { don_vi_id: string; don_vi: { ten: string } }[]) m.set(x.don_vi_id, x.don_vi.ten);
    return [...m.entries()];
  });
  const [chon, setChon] = useState<string>('');
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex flex-wrap gap-2">
        {[['', 'Thường trực giao đầu mối'] as [string, string], ...(data ?? []).map(([id, ten]) => [id, `${ten} giao đơn vị`] as [string, string])].map(([id, ten]) => (
          <button key={id || 'tt'} role="tab" aria-selected={chon === id} onClick={() => setChon(id)}
            className={cx('min-h-10 rounded-xl border px-3 text-sm', chon === id ? 'border-ink bg-ink font-semibold text-white' : 'border-vien bg-white text-den')}>{ten}</button>
        ))}
      </div>
      <LichDinhKy key={chon || 'tt'} chuTri={chon || null} hanMacDinh={chon ? 5 : 8} />
    </div>
  );
}

// ---------------------------------------------------------------- Lưu trữ Google Drive & lịch chạy tự động
type Drive = { ok: boolean; loi?: string; tai_khoan?: string; ten?: string; da_dung?: number; gioi_han?: number | null; thu_muc_goc?: { id: string; ten: string; url: string }; cach_xac_thuc?: string };
type LichChay = { ten: string; lich: string; lan_cuoi: string | null; trang_thai: string | null; thong_diep: string | null };
const TEN_VIEC: Record<string, string> = {
  'sinh-ky-bao-cao': 'Tạo kỳ báo cáo tiếp theo (mỗi giờ, phút 05)', 'khoa-ky-het-han': 'Khoá kỳ hết hạn bổ sung (00:10)', 'nhac-han': 'Nhắc hạn (08:00)',
  'sao-luu': 'Sao lưu lên Google Drive (23:30)',
};
const gb = (n?: number | null) => (n == null ? '—' : `${(n / 1024 ** 3).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GB`);

function LuuTru() {
  const [drive, setDrive] = useState<Drive | null>(null);
  const [dang, setDang] = useState<string | null>(null);
  const [tb, setTb] = useState<{ loi?: string; ok?: string } | null>(null);
  const { data, taiLai } = useDuLieu(async () => {
    const [a, b, c, d, e, g] = await Promise.all([
      supabase.from('sao_luu').select('id, luc, drive_file_id, kich_thuoc, ket_qua, tu_dong').order('luc', { ascending: false }).limit(15),
      supabase.rpc('tinh_trang_lich'),
      supabase.rpc('da_dat_bi_mat_lich'),
      supabase.rpc('thong_ke_push'),
      goiChucNang('gui-thong-bao-day', { loai: 'khoa' }).then(() => true, () => false),
      supabase.rpc('tinh_trang_lien_he'),
    ]);
    return {
      saoLuu: (kq(a) ?? []) as { id: number; luc: string; drive_file_id: string | null; kich_thuoc: number | null; ket_qua: string; tu_dong: boolean }[],
      lich: b.error ? null : (b.data ?? []) as LichChay[], loiLich: b.error ? loiDe(b.error) : null,
      biMat: c.error ? null : !!c.data,
      day: { ...((d.data as { so_nguoi: number; so_may: number }[] | null)?.[0] ?? { so_nguoi: 0, so_may: 0 }), mayChu: e },
      dt: { ...((g.data as { co_sdt: number; chua_sdt: number }[] | null)?.[0] ?? { co_sdt: 0, chua_sdt: 0 }) },
    };
  });
  const kiemTra = async () => {
    setDang('drive'); setTb(null);
    try { setDrive(await goiChucNang<Drive>('drive-kiem-tra', {})); } catch (e) { setDrive({ ok: false, loi: loiDe(e) }); } finally { setDang(null); }
  };
  const chay = async (ten: string, body: object, ok: (r: Record<string, unknown>) => string) => {
    setDang(ten); setTb(null);
    try { const r = await goiChucNang<Record<string, unknown>>(ten, body); setTb({ ok: ok(r) }); void taiLai(); }
    catch (e) { setTb({ loi: `${ten}: ${loiDe(e)}` }); } finally { setDang(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      {tb?.loi && <HopLoi loi={tb.loi} />}
      {tb?.ok && <div role="status" className="rounded-xl bg-xanh-nhat px-4 py-3 text-sm text-xanh">{tb.ok}</div>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <The className="flex flex-col gap-3 p-5">
          <TieuDeThe phai={<Nut icon={<HardDrive className="h-4 w-4" />} dangChay={dang === 'drive'} onClick={kiemTra}>Kiểm tra kết nối</Nut>}>Google Drive</TieuDeThe>
          {drive && (drive.ok ? (
            <div className="flex flex-col gap-1.5 rounded-xl bg-[#F0FDF4] p-3 text-sm">
              <span className="flex items-center gap-2 font-semibold text-[#166534]"><CheckCircle2 className="h-4 w-4" />Đã kết nối · {drive.cach_xac_thuc}</span>
              <span>Tài khoản: <b>{drive.tai_khoan}</b>{drive.ten ? ` (${drive.ten})` : ''}</span>
              <span>Dung lượng: {gb(drive.da_dung)} / {drive.gioi_han ? gb(drive.gioi_han) : 'không giới hạn'}</span>
              {drive.thu_muc_goc && <span>Thư mục gốc: <a className="font-semibold text-[#8E1B22]" href={drive.thu_muc_goc.url} target="_blank" rel="noreferrer">{drive.thu_muc_goc.ten}</a></span>}
            </div>
          ) : (
            <div className="flex flex-col gap-1 rounded-xl bg-nguy-nhat p-3 text-sm text-nguy">
              <span className="flex items-center gap-2 font-semibold"><XCircle className="h-4 w-4" />Chưa kết nối được</span>
              <span>{drive.loi}</span>
              <span className="text-mo-2">Xem HUONG-DAN-TRIEN-KHAI.md, bước 4 (Google Drive) và bước 5 (deploy Edge Functions).</span>
            </div>
          ))}
        </The>

        <The className="flex flex-col gap-3 p-5">
          <TieuDeThe>Lịch chạy tự động</TieuDeThe>
          {data?.biMat === false && <div className="rounded-xl bg-cam-nhat p-3 text-[0.8125rem] text-cam-dam">Chưa đặt bí mật cho lịch chạy. Chạy trong SQL Editor của Supabase: <code>select dat_bi_mat_lich('https://&lt;mã-dự-án&gt;.supabase.co', '&lt;CRON_SECRET&gt;');</code></div>}
          {data?.loiLich && <span className="text-[0.8125rem] text-mo">Chưa đọc được lịch chạy ({data.loiLich}). Kiểm tra đã chạy migration 13 và bật pg_cron.</span>}
          {data?.lich?.map((l) => (
            <div key={l.ten} className="flex flex-wrap items-center gap-2 border-t border-[#F1EEE7] pt-2 text-[0.8125rem] first:border-0 first:pt-0">
              <span className="flex-1 font-semibold">{TEN_VIEC[l.ten] ?? l.ten}</span>
              {l.lan_cuoi ? <Chip nen={l.trang_thai === 'succeeded' ? 'bg-[#DCFCE7]' : 'bg-nguy-nhat'} chu={l.trang_thai === 'succeeded' ? 'text-[#166534]' : 'text-nguy'}>{l.trang_thai === 'succeeded' ? 'OK' : l.trang_thai} · {ngayGio(l.lan_cuoi)}</Chip> : <Chip>Chưa chạy</Chip>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 border-t border-[#F1EEE7] pt-3">
            <Nut icon={<Play className="h-4 w-4" />} dangChay={dang === 'nhac-han'} onClick={() => chay('nhac-han', {}, (r) => `Đã nhắc: ${r.ky_bao_cao ?? 0} kỳ báo cáo, ${r.nhiem_vu ?? 0} nhiệm vụ.`)}>Nhắc hạn</Nut>
          </div>
        </The>

        <The className="flex flex-col gap-3 p-5">
          <TieuDeThe>Kênh nhắc việc</TieuDeThe>
          {data && ([
            ['Thông báo đẩy', data.day.mayChu, `${data.day.so_may} máy · ${data.day.so_nguoi} người đã bật`, 'Chưa đặt khoá VAPID'],
            ['Gọi, SMS, Zalo cá nhân', data.dt.chua_sdt === 0, `${data.dt.co_sdt} tài khoản có SĐT · gọi trực tiếp từ máy người nhắc`, `${data.dt.chua_sdt} tài khoản chưa có SĐT · ${data.dt.co_sdt} đã có`],
          ] as const).map(([ten, ok, phu, thieu]) => (
            <div key={ten} className="flex items-center gap-3 border-t border-[#F1EEE7] pt-2.5 text-[0.8125rem] first:border-0 first:pt-0">
              {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#166534]" /> : <XCircle className="h-4 w-4 shrink-0 text-mo" />}
              <span className="w-36 shrink-0 font-semibold">{ten}</span>
              <span className={cx('min-w-0 flex-1', ok ? 'text-mo-2' : 'text-mo')}>{ok ? phu : thieu}</span>
            </div>
          ))}
        </The>
      </div>

      <The className="flex flex-col gap-3 p-5">
        <TieuDeThe phai={<Nut kieu="chinh" dangChay={dang === 'sao-luu'} onClick={() => chay('sao-luu', {}, (r) => `Đã sao lưu ${r.so_dong ?? ''} dòng lên Google Drive.`)}>Sao lưu ngay</Nut>}>
          Sao lưu dữ liệu (tự động 23:30 hằng ngày, giữ 30 ngày + bản ngày 01 hằng tháng)
        </TieuDeThe>
        {data?.saoLuu.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 border-t border-[#F1EEE7] pt-2 text-[0.8125rem]">
            <span className="so text-xs">{ngayGio(s.luc)}</span><Chip>{s.tu_dong ? 'Tự động' : 'Bấm tay'}</Chip><span className="flex-1">{s.ket_qua}</span>
            {s.drive_file_id && <NutTepDrive loai="sao_luu" id={String(s.id)} ten={`bcd57-sao-luu-${s.luc.slice(0, 10)}.json`} cheDo="tai" />}
          </div>
        ))}
        {data?.saoLuu.length === 0 && <span className="text-sm text-mo">Chưa có bản sao lưu nào.</span>}
      </The>
    </div>
  );
}
