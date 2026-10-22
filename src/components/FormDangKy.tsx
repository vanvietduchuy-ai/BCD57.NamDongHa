import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { loiDe, supabase } from '../lib/supabase';
import { HopLoi, Nut, O, lopO } from './ui';
import { KHOI_DV } from './TaiKhoanHangLoat';

type Dv = { id: string; ma: string; ten: string; loai: string };

// Đăng ký tài khoản (chưa đăng nhập): gửi yêu cầu, Quản trị hệ thống duyệt rồi cấp mật khẩu tạm
export default function FormDangKy({ quayLai }: { quayLai: () => void }) {
  const [dv, setDv] = useState<Dv[]>([]);
  const [f, setF] = useState({ ho_ten: '', email: '', chuc_vu: '', sdt: '', don_vi_id: '', ghi_chu: '' });
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState(false);

  useEffect(() => {
    void supabase.rpc('don_vi_dang_ky').then(({ data, error }) => {
      if (error) setLoi('Chưa mở được chức năng đăng ký. Liên hệ Thường trực Ban Chỉ đạo.'); else setDv((data ?? []) as Dv[]);
    });
  }, []);

  const gui = async (e: FormEvent) => {
    e.preventDefault(); setLoi(null);
    if (!f.don_vi_id) { setLoi('Chọn đơn vị công tác.'); return; }
    setDangChay(true);
    try {
      const { error } = await supabase.rpc('gui_dang_ky', {
        p_ho_ten: f.ho_ten, p_email: f.email, p_chuc_vu: f.chuc_vu, p_sdt: f.sdt, p_don_vi: f.don_vi_id, p_ghi_chu: f.ghi_chu,
      });
      if (error) throw error;
      setXong(true);
    } catch (x) { setLoi(loiDe(x)); } finally { setDangChay(false); }
  };

  if (xong) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-vien bg-white p-7 text-center shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-xanh-nhat text-xanh"><CheckCircle2 className="h-6 w-6" /></span>
        <p className="m-0 text-[0.9375rem]">Đã gửi yêu cầu đăng ký. Quản trị hệ thống sẽ xem xét và cấp tài khoản.</p>
        <p className="m-0 text-[0.8125rem] text-mo">Khi được duyệt, bạn nhận email và mật khẩu tạm từ Thường trực Ban Chỉ đạo (đổi mật khẩu ở lần đăng nhập đầu).</p>
        <Nut kieu="phu" onClick={quayLai}>Về trang đăng nhập</Nut>
      </div>
    );
  }
  return (
    <form onSubmit={gui} className="flex flex-col gap-3.5 rounded-3xl border border-vien bg-white p-5 shadow-sm sm:p-7">
      {loi && <HopLoi loi={loi} />}
      <O nhan="Họ và tên"><input className={lopO} required maxLength={100} value={f.ho_ten} onChange={(e) => setF({ ...f, ho_ten: e.target.value })} autoFocus /></O>
      <O nhan="Email (dùng để đăng nhập)"><input className={lopO} type="email" inputMode="email" required maxLength={150} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></O>
      <O nhan="Đơn vị công tác">
        <select className={lopO} required value={f.don_vi_id} onChange={(e) => setF({ ...f, don_vi_id: e.target.value })}>
          <option value="">— Chọn đơn vị —</option>
          {KHOI_DV.map(([k, ten, fl]) => { const ds = dv.filter((d) => fl(d.loai)); return ds.length ? <optgroup key={k} label={ten}>{ds.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}</optgroup> : null; })}
        </select>
      </O>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <O nhan="Chức vụ"><input className={lopO} maxLength={100} value={f.chuc_vu} onChange={(e) => setF({ ...f, chuc_vu: e.target.value })} /></O>
        <O nhan="Số điện thoại (Zalo)"><input className={lopO} type="tel" inputMode="tel" maxLength={20} value={f.sdt} onChange={(e) => setF({ ...f, sdt: e.target.value })} /></O>
      </div>
      <O nhan="Ghi chú (không bắt buộc)"><input className={lopO} maxLength={300} value={f.ghi_chu} onChange={(e) => setF({ ...f, ghi_chu: e.target.value })} /></O>
      <Nut kieu="do" type="submit" dangChay={dangChay} className="mt-1 h-12 text-[0.9375rem]">Gửi yêu cầu đăng ký</Nut>
    </form>
  );
}
