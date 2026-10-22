import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { goiChucNang, loiDe, supabase } from '../lib/supabase';
import { kq, useDuLieu } from '../lib/useDuLieu';
import { ngayGio } from '../lib/dinhDang';
import { Chip, DangTai, HopLoi, HopThoai, lopO, Nut, O, The } from './ui';
import { luuLienHe } from './LienHe';
import { KHOI_DV } from './TaiKhoanHangLoat';

type Yc = { id: string; ho_ten: string; email: string; chuc_vu: string | null; so_dien_thoai: string | null; don_vi_id: string | null; ghi_chu: string | null;
  trang_thai: 'cho' | 'da_duyet' | 'tu_choi'; ly_do_tu_choi: string | null; xu_ly_luc: string | null; tao_luc: string; don_vi: { ten: string } | null };
type Dv = { id: string; ten: string; loai: string };

const TEN_VT: Record<string, string> = { don_vi: 'Tài khoản đơn vị', lanh_dao: 'Lãnh đạo BCĐ', quan_tri: 'Cơ quan Thường trực' };
const sinhMatKhau = () => {
  const b = new Uint8Array(10); crypto.getRandomValues(b);
  const kt = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(b, (x) => kt[x % kt.length]).join('') + '7a';
};

// Quản trị hệ thống duyệt / từ chối yêu cầu đăng ký tài khoản
export default function YeuCauDangKy() {
  const [loi, setLoi] = useState<string | null>(null);
  const [duyet, setDuyet] = useState<Yc | null>(null);
  const { data, loi: loiTai, dangTai, taiLai } = useDuLieu(async () => {
    const [a, b] = await Promise.all([
      supabase.from('yeu_cau_dang_ky').select('*, don_vi(ten)').order('tao_luc', { ascending: false }).limit(200),
      supabase.from('don_vi').select('id, ten, loai').eq('hoat_dong', true).order('thu_tu'),
    ]);
    return { yc: (kq(a) ?? []) as unknown as Yc[], dv: (kq(b) ?? []) as Dv[] };
  });
  const tuChoi = async (y: Yc) => {
    const ly = window.prompt(`Từ chối yêu cầu của ${y.ho_ten}. Lý do (không bắt buộc):`);
    if (ly === null) return;
    setLoi(null);
    const { error } = await supabase.from('yeu_cau_dang_ky').update({ trang_thai: 'tu_choi', ly_do_tu_choi: ly.trim() || null, xu_ly_luc: new Date().toISOString() }).eq('id', y.id);
    if (error) setLoi(loiDe(error)); else void taiLai();
  };
  const cho = data?.yc.filter((y) => y.trang_thai === 'cho') ?? [];
  const daXuLy = data?.yc.filter((y) => y.trang_thai !== 'cho') ?? [];
  return (
    <>
      {(loi || loiTai) && <HopLoi loi={(loi || loiTai)!} />}
      {dangTai && !data && <DangTai />}
      {data && (
        <>
          <h2 className="m-0 px-1 text-[0.8125rem] font-bold uppercase tracking-wide text-mo">Chờ duyệt <span className="so font-semibold">· {cho.length}</span></h2>
          <The className="overflow-hidden"><ul className="m-0 list-none p-0">
            {cho.map((y) => (
              <li key={y.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#F1EEE7] px-4 py-3 last:border-0">
                <div className="flex min-w-0 basis-full flex-col sm:flex-1 sm:basis-auto">
                  <span className="text-[0.9375rem] font-semibold">{y.ho_ten}{y.chuc_vu && <span className="font-normal text-mo"> · {y.chuc_vu}</span>}</span>
                  <span className="break-all text-xs text-mo">{y.email}{y.so_dien_thoai && ` · ${y.so_dien_thoai}`}</span>
                  <span className="text-xs text-mo">{y.don_vi?.ten ?? '—'} · gửi {ngayGio(y.tao_luc)}</span>
                  {y.ghi_chu && <span className="text-xs italic text-mo-2">“{y.ghi_chu}”</span>}
                </div>
                <div className="flex gap-2">
                  <Nut kieu="chinh" icon={<Check className="h-4 w-4" />} onClick={() => setDuyet(y)}>Duyệt</Nut>
                  <Nut icon={<X className="h-4 w-4" />} onClick={() => tuChoi(y)}>Từ chối</Nut>
                </div>
              </li>
            ))}
            {!cho.length && <li className="px-4 py-4 text-[0.8125rem] text-mo">Không có yêu cầu nào đang chờ.</li>}
          </ul></The>
          {!!daXuLy.length && (
            <>
              <h2 className="m-0 mt-2 px-1 text-[0.8125rem] font-bold uppercase tracking-wide text-mo">Đã xử lý <span className="so font-semibold">· {daXuLy.length}</span></h2>
              <The className="overflow-hidden"><ul className="m-0 list-none p-0">
                {daXuLy.map((y) => (
                  <li key={y.id} className="flex flex-wrap items-center gap-x-3 border-b border-[#F1EEE7] px-4 py-2.5 text-[0.8125rem] last:border-0">
                    <span className="min-w-0 flex-1 truncate"><b>{y.ho_ten}</b> · {y.email} · {y.don_vi?.ten ?? '—'}{y.ly_do_tu_choi && ` · lý do: ${y.ly_do_tu_choi}`}</span>
                    <Chip nen={y.trang_thai === 'da_duyet' ? 'bg-xanh-nhat' : 'bg-cam-nhat'} chu={y.trang_thai === 'da_duyet' ? 'text-xanh' : 'text-cam-dam'}>{y.trang_thai === 'da_duyet' ? 'Đã duyệt' : 'Đã từ chối'}</Chip>
                  </li>
                ))}
              </ul></The>
            </>
          )}
        </>
      )}
      {duyet && <HopDuyet key={duyet.id} yc={duyet} donVi={data?.dv ?? []} dong={() => setDuyet(null)} xong={() => void taiLai()} />}
    </>
  );
}

function HopDuyet({ yc, donVi, dong, xong }: { yc: Yc; donVi: Dv[]; dong: () => void; xong: () => void }) {
  const [vaiTro, setVaiTro] = useState('don_vi');
  const [donViId, setDonViId] = useState(yc.don_vi_id ?? '');
  const [mk] = useState(sinhMatKhau);
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [da, setDa] = useState(false);
  const chapNhan = async () => {
    setLoi(null);
    if (vaiTro === 'don_vi' && !donViId) { setLoi('Tài khoản đơn vị phải chọn đơn vị'); return; }
    setDangChay(true);
    try {
      const r = await goiChucNang<{ id: string }>('quan-tri-tai-khoan', { hanh_dong: 'tao', email: yc.email, mat_khau: mk, ho_ten: yc.ho_ten, chuc_vu: yc.chuc_vu ?? '', vai_tro: vaiTro, don_vi_id: donViId || null });
      if (yc.so_dien_thoai) await luuLienHe(r.id, yc.so_dien_thoai).catch(() => undefined);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('yeu_cau_dang_ky').update({ trang_thai: 'da_duyet', xu_ly_boi: u.user?.id ?? null, xu_ly_luc: new Date().toISOString() }).eq('id', yc.id);
      if (error) throw error;
      setDa(true); xong();
    } catch (e) { setLoi(loiDe(e)); } finally { setDangChay(false); }
  };
  return (
    <HopThoai mo dong={dong} tieuDe={da ? 'Đã tạo tài khoản' : `Duyệt: ${yc.ho_ten}`}>
      <div className="flex flex-col gap-3">
        {loi && <HopLoi loi={loi} />}
        {da ? (
          <>
            <p className="m-0 text-[0.875rem]">Gửi thông tin này cho người đăng ký (Zalo/điện thoại). Họ đổi mật khẩu ở lần đăng nhập đầu. <b>Mật khẩu chỉ hiện lúc này.</b></p>
            <div className="rounded-xl bg-nen-2 p-3 text-[0.875rem]"><div>Email: <b className="break-all">{yc.email}</b></div><div>Mật khẩu tạm: <b className="mono">{mk}</b></div></div>
            <Nut icon={<Copy className="h-4 w-4" />} onClick={() => void navigator.clipboard.writeText(`Tài khoản hệ thống BCĐ 57\nEmail: ${yc.email}\nMật khẩu tạm: ${mk}\n(đổi mật khẩu ở lần đăng nhập đầu)`)}>Sao chép</Nut>
            <Nut kieu="chinh" onClick={dong}>Xong</Nut>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-nen-2 p-3 text-[0.8125rem]"><b>{yc.ho_ten}</b>{yc.chuc_vu && ` · ${yc.chuc_vu}`}<br />{yc.email}{yc.so_dien_thoai && ` · ${yc.so_dien_thoai}`}</div>
            <div className="grid grid-cols-2 gap-3">
              <O nhan="Vai trò"><select className={lopO} value={vaiTro} onChange={(e) => setVaiTro(e.target.value)}>{Object.entries(TEN_VT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></O>
              <O nhan="Đơn vị"><select className={lopO} value={donViId} onChange={(e) => setDonViId(e.target.value)}><option value="">—</option>
                {KHOI_DV.map(([k, ten, f]) => { const ds = donVi.filter((d) => f(d.loai)); return ds.length ? <optgroup key={k} label={ten}>{ds.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}</optgroup> : null; })}</select></O>
            </div>
            <Nut kieu="chinh" dangChay={dangChay} onClick={chapNhan}>Duyệt và tạo tài khoản</Nut>
          </>
        )}
      </div>
    </HopThoai>
  );
}
