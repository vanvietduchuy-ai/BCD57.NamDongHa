// Hạn và thanh tiến độ của nhiệm vụ (dùng ở trang chi tiết)
import { ngay } from '../lib/dinhDang';
import { hanNv, TT_NV, type NhiemVu } from '../lib/nhiemVu';
import { Chip, ChipHan, cx } from './ui';

export function HanNv({ n }: { n: Pick<NhiemVu, 'han' | 'trang_thai'> & Partial<Pick<NhiemVu, 'dinh_ky' | 'ky_han' | 'ky_xong'>> }) {
  // Nhiệm vụ định kỳ: trạng thái kỳ hiện tại
  if (n.dinh_ky && n.trang_thai !== 'hoan_thanh' && n.trang_thai !== 'tam_dung') {
    if (n.ky_xong) return <Chip nen="bg-[#DCFCE7]" chu="text-[#166534]">Kỳ này: xong</Chip>;
    if (n.ky_han) return <ChipHan han={hanNv(n.ky_han)} />;
  }
  if (!n.han) return <Chip>Chưa chốt hạn</Chip>;
  if (n.trang_thai === 'hoan_thanh') return <span className="so text-xs text-mo">hạn {ngay(n.han)}</span>;
  if (n.trang_thai === 'tam_dung') return <Chip>Tạm dừng</Chip>;
  return <ChipHan han={hanNv(n.han)} />;
}

export function ThanhNv({ n }: { n: Pick<NhiemVu, 'phan_tram' | 'trang_thai' | 'qua_han'> }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[#EEEBE3]">
        <div className={cx('thanh-chay h-1.5 rounded-full', n.qua_han ? 'bg-nguy' : TT_NV[n.trang_thai].thanh)} style={{ width: `${n.phan_tram}%` }} />
      </div>
      <span className="so w-9 text-right text-xs font-semibold">{n.phan_tram}%</span>
    </div>
  );
}
