import { Link } from 'react-router-dom';
import { ArrowUp, ChevronRight, FileText, Mail, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { kq, useBayGio, useDuLieu } from '../lib/useDuLieu';
import { laDauMoi, useAuth } from '../lib/auth';
import { conLai, hai, ngay, ngayGio, tenNgan } from '../lib/dinhDang';
import { TT_NOP } from './KyBaoCaoChiTiet';
import { DINH_KY, type DinhKy, type TrangThaiNv } from '../lib/nhiemVu';
import { Chip, DangTai, HopLoi, Rong, The, TieuDeThe, cx } from '../components/ui';
import { Chuong } from '../components/KhungTrang';
import { TheBaoCaoTuan } from './BaoCaoTuan';
import TongQuan from './TongQuan';

export type Viec = { nop_id: string; don_vi_id: string; trang_thai: string; ky_id: string; ten: string; loai: string; han_nop: string; qua_han: boolean; cap?: string; don_vi_giao?: string | null };
// Nhãn loại việc kèm đơn vị giao (Thường trực BCĐ / đầu mối)
export const nhanViec = (v: Pick<Viec, 'loai' | 'cap' | 'don_vi_giao'>): [string, string] => {
  const [nhan, mau] = v.cap === 'linh_vuc' ? ['TỔNG HỢP GỬI THƯỜNG TRỰC', 'text-[#8E1B22]'] : [NHAN_LOAI[v.loai]?.[0] ?? v.loai, NHAN_LOAI[v.loai]?.[1] ?? ''];
  return [v.don_vi_giao ? `${nhan} · ${tenNgan(v.don_vi_giao).toUpperCase()}` : nhan, mau];
};
export const NHAN_LOAI: Record<string, [string, string]> = {
  dot_xuat: ['ĐỘT XUẤT', 'text-cam'], thang: ['ĐỊNH KỲ', 'text-xanh'],
  quy: ['ĐỊNH KỲ', 'text-xanh'], sau_thang: ['ĐỊNH KỲ', 'text-xanh'], nam: ['ĐỊNH KỲ', 'text-xanh'],
};

type NvDv = { id: string; ma: string | null; ten: string; han: string | null; trang_thai: TrangThaiNv; phan_tram: number; qua_han: boolean; con_ngay: number | null; chu_tri_don_vi_id: string | null; dinh_ky: DinhKy | null; ky_han: string | null; ky_xong: boolean };

type DaGui = { id: string; trang_thai: string; nop_luc: string; ky_bao_cao: { ten: string } };

export default function TrangChuDonVi() {
  const { hoSo } = useAuth();
  const { data, loi, dangTai, taiLai } = useDuLieu(async () => {
    const dv = hoSo!.don_vi_id!;
    const [a, b, c, vb] = await Promise.all([
      supabase.from('v_viec_can_nop').select('*').eq('don_vi_id', dv).order('han_nop'),
      supabase.from('nop_bao_cao').select('id, trang_thai, nop_luc, ky_bao_cao(ten)').eq('don_vi_id', dv).not('nop_luc', 'is', null).order('nop_luc', { ascending: false }).limit(5),
      supabase.from('v_nhiem_vu').select('id, ma, ten, han, trang_thai, phan_tram, qua_han, con_ngay, chu_tri_don_vi_id, phoi_hop_ids, dinh_ky, ky_han, ky_xong').neq('trang_thai', 'hoan_thanh').neq('trang_thai', 'tam_dung').order('han', { nullsFirst: false }),
      supabase.from('v_cong_van_nhan').select('id', { count: 'exact', head: true }).eq('don_vi_id', dv).is('nhan_luc', null),
    ]);
    const vbMoi = vb.error ? 0 : vb.count ?? 0;
    const nv = ((kq(c) ?? []) as (NvDv & { phoi_hop_ids: string[] | null })[]).filter((n) => n.chu_tri_don_vi_id === dv || (n.phoi_hop_ids ?? []).includes(dv));
    return { viec: (kq(a) ?? []) as Viec[], daGui: (kq(b) ?? []) as unknown as DaGui[], nv, vbMoi };
  });
  if (loi) return <HopLoi loi={loi} taiLai={taiLai} />;
  if (dangTai && !data) return <DangTai />;
  if (!data) return null;
  // Việc chính: định kỳ hạn gần nhất (không có thì việc hạn gần nhất); việc khác (đột xuất trước)
  const gan = data.viec.find((v) => v.loai !== 'dot_xuat') ?? data.viec[0];
  const khac = data.viec.filter((v) => v !== gan).sort((a, b) => Number(b.loai === 'dot_xuat') - Number(a.loai === 'dot_xuat')).slice(0, 3);

  return (
    <>
      <div className="hidden items-center gap-3 lg:flex">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.8125rem] text-mo">Tài khoản đơn vị · {hoSo?.ho_ten}</span>
          <h1 className="m-0 text-[1.625rem] font-extrabold tracking-tight">{hoSo?.don_vi?.ten}</h1>
        </div>
        <Chuong />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {gan ? <TheChinh v={gan} /> : <The className="p-5"><Rong>Đã nộp đủ, không còn văn bản cần nộp.</Rong></The>}
          {khac.map((v) => <TheKhac key={v.nop_id} v={v} />)}
        </div>

        <div className="flex flex-col gap-3">
          {hoSo?.don_vi_id && <TheBaoCaoTuan dv={hoSo.don_vi_id} />}
          {data.vbMoi > 0 && (
            <div className="grid grid-cols-1 gap-3">
                <Link to="/van-ban" className="the-noi flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#FBCFD4] bg-[#FFF5F6] p-3.5 text-den">
                  <span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-mo-2"><Mail className="h-4 w-4 text-nguy" />Văn bản đến</span>
                  <span className="flex items-baseline gap-1.5"><b className="mono text-[1.375rem] leading-none text-nguy">{data.vbMoi}</b><span className="text-[0.75rem] text-mo">chưa bấm nhận</span></span>
                  <span className="text-[11.5px] font-semibold text-[#8E1B22]">Mở xem →</span>
                </Link>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <h2 className="m-0 flex-1 text-[1.0625rem] font-bold">Nhiệm vụ của đơn vị</h2>
            <Link to="/nhiem-vu" className="text-[0.8438rem] font-semibold text-[#8E1B22]">Tất cả</Link>
          </div>
          {data.nv.length === 0 && <The className="p-4"><span className="text-sm text-mo">Không có nhiệm vụ đang thực hiện.</span></The>}
          {data.nv.slice(0, 5).map((n) => {
            const sap = !n.qua_han && n.con_ngay != null && n.con_ngay <= 3;
            const [nhan, nen, chu] = n.qua_han ? ['Quá hạn', 'bg-nguy-nhat', 'text-nguy'] : sap ? ['Sắp đến hạn', 'bg-cam-nhat', 'text-cam-dam'] : n.trang_thai === 'chua_trien_khai' ? ['Chưa triển khai', 'bg-nen-3', 'text-mo-2'] : ['Đang làm', 'bg-xanh-nhat', 'text-xanh'];
            return (
              <Link key={n.id} to={`/nhiem-vu/${n.id}`} className="the-noi flex flex-col gap-3 rounded-2xl border border-vien bg-white p-4 text-den">
                <div className="flex items-start gap-3">
                  <span className="line-clamp-2 min-w-0 flex-1 text-[0.9062rem] font-semibold leading-snug">{n.ten}</span>
                  <Chip nen={nen} chu={chu} className="rounded-full">{nhan}</Chip>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEEBE3]"><div className={cx('thanh-chay h-1.5 rounded-full', n.qua_han ? 'bg-nguy' : 'bg-xanh')} style={{ width: `${n.phan_tram}%` }} /></div>
                  <span className="shrink-0 text-[0.7812rem] text-mo">{n.dinh_ky ? (n.ky_xong ? `${DINH_KY[n.dinh_ky]} · kỳ này xong` : `${DINH_KY[n.dinh_ky]} · hạn ${n.ky_han ? ngay(n.ky_han).replace(/\/\d{4}$/, '') : '—'}`) : n.han ? `Hạn ${ngay(n.han).replace(/\/\d{4}$/, '')}` : 'Chưa chốt hạn'}</span>
                </div>
              </Link>
            );
          })}

          {data.daGui.length > 0 && (
            <The className="mt-2 flex flex-col gap-1 p-4">
              <TieuDeThe>Báo cáo đã gửi gần đây</TieuDeThe>
              {data.daGui.map((n) => {
                const t = TT_NOP[n.trang_thai] ?? TT_NOP.da_nop;
                return (
                  <Link key={n.id} to={`/viec-can-nop/${n.id}`} className="-mx-2 flex items-center gap-3 rounded-xl border-t border-[#F1EEE7] px-2 py-3 text-den transition-colors first:border-0 hover:bg-nen-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="truncate text-sm font-semibold">{n.ky_bao_cao.ten}</span><span className="text-xs text-mo">Gửi {ngayGio(n.nop_luc)}</span></div>
                    <Chip cham nen={t.nen} chu={t.chu}>{t.nhan}</Chip><ChevronRight className="h-4 w-4 shrink-0 text-mo" />
                  </Link>
                );
              })}
            </The>
          )}
        </div>
      </div>
      {/* Đơn vị làm đầu mối lĩnh vực: phần theo dõi các đơn vị gộp vào trang chủ */}
      {laDauMoi(hoSo) && hoSo?.don_vi_id && <TongQuan chuTri={hoSo.don_vi_id} nhung />}
    </>
  );
}

// Độ dài kỳ để vẽ vòng đếm ngược
const NGAY_KY: Record<string, number> = { thang: 30, quy: 90, sau_thang: 180, nam: 365, dot_xuat: 14 };

// Thẻ việc chính: vòng đếm ngược + nút nộp (thiết kế gốc, trang chủ đơn vị trên điện thoại)
function TheChinh({ v }: { v: Viec }) {
  const t = useBayGio();
  const c = conLai(v.han_nop, t);
  const tong = (NGAY_KY[v.loai] ?? 30) * 86_400_000;
  const ti = Math.max(0, Math.min(1, c.ms / tong));
  const R = 54, CV = 2 * Math.PI * R;
  const loai = v.loai === 'dot_xuat' ? 'ĐỘT XUẤT' : `ĐỊNH KỲ · ${({ thang: 'THÁNG', quy: 'QUÝ', sau_thang: '6 THÁNG', nam: 'NĂM' } as Record<string, string>)[v.loai] ?? ''}`;
  return (
    <section className="noi-len-hero flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-[#7C1419] via-ink to-ink-3 p-4 text-white sm:gap-5 sm:rounded-3xl sm:p-5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate rounded-full bg-ink-2 px-3 py-1 text-[11px] font-bold tracking-[1px] text-[#F0C9C4]">{loai}</span>
        <span className="flex-1" />
        <span className={cx('shrink-0 rounded-full px-3 py-1 text-xs font-bold', c.ms <= 0 ? 'bg-nguy text-white' : v.trang_thai === 'can_bo_sung' ? 'bg-cam-nhat text-cam-dam' : 'bg-[#FDE68A] text-ink')}>{c.ms <= 0 ? 'Quá hạn' : v.trang_thai === 'can_bo_sung' ? 'Cần bổ sung' : 'Đang mở'}</span>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative h-[112px] w-[112px] shrink-0 sm:h-[132px] sm:w-[132px]">
          <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="66" cy="66" r={R} fill="none" stroke="var(--color-ink-2)" strokeWidth="11" />
            <circle cx="66" cy="66" r={R} fill="none" stroke={c.ms <= 0 ? '#F87171' : '#FCD34D'} strokeWidth="11" strokeLinecap="round" strokeDasharray={CV} strokeDashoffset={CV * (1 - ti)} className="transition-[stroke-dashoffset] duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mono text-[2.125rem] font-bold leading-none sm:text-[2.5rem]">{Math.max(0, c.ngay)}</span>
            <span className="mt-1 text-[11px] tracking-[1.5px] text-[#F0C9C4]">NGÀY</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[1.0625rem] font-bold leading-snug">{v.ten}</span>
          <span className="mono pt-1.5 text-[1.375rem] font-bold leading-none">{hai(c.gio)}:{hai(c.phut)}:{hai(c.giay)}</span>
          <span className="pt-1 text-[0.75rem] leading-snug text-[#F0C9C4]">{v.don_vi_giao && v.cap !== 'linh_vuc' ? `${tenNgan(v.don_vi_giao)} giao · ` : ''}Hạn {ngayGio(v.han_nop)}</span>
        </div>
      </div>
      <Link to={`/viec-can-nop/${v.nop_id}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-[0.9375rem] font-bold text-den transition active:scale-[0.98]"><ArrowUp className="h-4 w-4" />{v.trang_thai === 'can_bo_sung' ? 'Bổ sung báo cáo' : 'Nộp báo cáo ngay'}</Link>
    </section>
  );
}

// Thẻ việc khác: đột xuất nền vàng
function TheKhac({ v }: { v: Viec }) {
  const t = useBayGio();
  const c = conLai(v.han_nop, t);
  const dx = v.loai === 'dot_xuat';
  return (
    <Link to={`/viec-can-nop/${v.nop_id}`} className={cx('the-noi flex items-center gap-3 rounded-2xl border p-4 text-den', dx ? 'border-[#FDE68A] bg-[#FEF3C7]' : 'border-vien bg-white')}>
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', dx ? 'bg-[#F59E0B] text-den' : 'bg-xanh-nhat text-xanh')}>{dx ? <Zap className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cx('truncate text-[11px] font-bold tracking-[1px]', dx ? 'text-cam' : nhanViec(v)[1])}>{nhanViec(v)[0]}</span>
        <span className="truncate text-[0.9062rem] font-bold">{v.ten}</span>
        <span className={cx('mono text-[0.75rem] font-bold', c.ms <= 0 ? 'text-nguy' : dx ? 'text-cam-dam' : 'text-xanh')}>{c.ms <= 0 ? 'Đã quá hạn' : `Còn ${c.ngay} ngày ${hai(c.gio)} giờ ${hai(c.phut)} phút`}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-mo-2" />
    </Link>
  );
}
