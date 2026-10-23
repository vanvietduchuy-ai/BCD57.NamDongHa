import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, MoreHorizontal, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { conLai, conLaiNgan, hai, MAU_GAP, mucGap } from '../lib/dinhDang';
import { useBayGio } from '../lib/useDuLieu';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function The({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' }) {
  return <Tag className={cx('rounded-2xl border border-vien bg-white', className)}>{children}</Tag>;
}

export function TieuDeThe({ children, phai }: { children: ReactNode; phai?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="m-0 flex-1 text-[0.9375rem] font-bold">{children}</h2>
      {phai}
    </div>
  );
}

type NutProps = ButtonHTMLAttributes<HTMLButtonElement> & { kieu?: 'chinh' | 'phu' | 'nguy' | 'nhe' | 'do'; dangChay?: boolean; icon?: ReactNode; ngan?: string };
export function Nut({ kieu = 'phu', dangChay, icon, children, className, disabled, ngan, ...p }: NutProps) {
  const nhanChu = typeof children === 'string' ? children : Array.isArray(children) && children.every((x) => typeof x === 'string' || typeof x === 'number') ? children.join('') : undefined;
  const k = {
    chinh: 'nut-chinh bg-do text-white hover:bg-do-2 border-transparent shadow-sm shadow-do/20',
    phu: 'bg-white text-den border-vien-2 hover:bg-nen-2',
    nguy: 'bg-white text-nguy border-nguy/40 hover:bg-nguy-nhat',
    nhe: 'bg-transparent text-[#8E1B22] border-transparent hover:bg-do/5',
    do: 'bg-do text-white border-transparent hover:bg-do-2 shadow-sm shadow-do/25',
  }[kieu];
  return (
    <button title={nhanChu} {...p} disabled={disabled || dangChay}
      className={cx('inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-sm font-semibold transition duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:min-h-11 sm:px-4', !!icon && 'co-icon', k, className)}>
      {dangChay ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children != null && children !== false && <span className="nhan">{ngan ? <><span className="max-sm:hidden">{children}</span><span className="sm:hidden">{ngan}</span></> : children}</span>}
    </button>
  );
}

// cham: kiểu viên thuốc có chấm màu (trạng thái nộp báo cáo)
export function Chip({ children, nen = 'bg-nen-3', chu = 'text-mo-2', className, cham }: { children: ReactNode; nen?: string; chu?: string; className?: string; cham?: boolean }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-bold leading-5', cham ? 'rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold' : 'rounded-md px-2 py-0.5 text-[11.5px]', nen, chu, className)}>
      {cham && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{children}
    </span>
  );
}

export function TheSo({ nhan, giaTri, phu, mau = 'text-den' }: { nhan: string; giaTri: ReactNode; phu?: ReactNode; mau?: string }) {
  return (
    <The as="div" className="flex flex-col gap-1 p-4">
      <span className="text-[0.8125rem] text-mo">{nhan}</span>
      <span className={cx('so text-[1.625rem] font-bold leading-tight', mau)}>{typeof giaTri === 'number' ? <DemSo n={giaTri} /> : giaTri}</span>
      {phu && <span className="text-xs text-mo">{phu}</span>}
    </The>
  );
}

// Số chạy từ 0 tới giá trị (một lần khi hiện)
export function DemSo({ n, ms = 700 }: { n: number; ms?: number }) {
  const [v, setV] = useState(n);
  const dau = useRef(true);
  useEffect(() => {
    if (!dau.current || !Number.isInteger(n) || n <= 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(n); return; }
    dau.current = false;
    let raf = 0; const t0 = performance.now();
    const b = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(n * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(b); };
    raf = requestAnimationFrame(b);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return <>{v}</>;
}

export function DangTai({ chu = 'Đang tải…' }: { chu?: string }) {
  return (
    <div role="status" aria-label={chu} className="flex flex-col gap-2.5 p-5">
      <div className="khung-cho h-4 w-2/5" />
      <div className="khung-cho h-3 w-4/5" />
      <div className="khung-cho h-3 w-3/5" />
    </div>
  );
}

export function HopLoi({ loi, taiLai }: { loi: string; taiLai?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-xl border border-nguy/30 bg-nguy-nhat p-4 text-sm text-nguy">
      <span className="flex-1">{loi}</span>
      {taiLai && <Nut kieu="nguy" onClick={taiLai}>Thử lại</Nut>}
    </div>
  );
}

export function Rong({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-vien-2 p-6 text-center text-sm text-mo">{children}</div>;
}

export function TieuDeTrang({ tren, ten, phai }: { tren?: ReactNode; ten: ReactNode; phai?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-2 sm:gap-3">
      <div className="flex min-w-[58%] flex-1 flex-col gap-0.5 sm:min-w-[min(100%,260px)] sm:gap-1">
        {tren && <div className="truncate text-[0.8125rem] text-mo">{tren}</div>}
        <h1 className="m-0 truncate text-[1.25rem] font-bold tracking-tight sm:whitespace-normal sm:text-[1.375rem] sm:font-extrabold md:text-[1.625rem]">{ten}</h1>
      </div>
      {/* Điện thoại: nút phụ chỉ còn biểu tượng để không rớt hàng */}
      {phai && <div className="tieu-de-nut flex shrink-0 gap-1.5 sm:flex-wrap sm:gap-2">{phai}</div>}
    </header>
  );
}

// Đồng hồ đếm ngược lớn (ngày – giờ – phút – giây)
export function DongHo({ han, toi = true }: { han: string; toi?: boolean }) {
  const t = useBayGio();
  const c = conLai(han, t);
  const o = [[c.ngay, 'NGÀY'], [c.gio, 'GIỜ'], [c.phut, 'PHÚT'], [c.giay, 'GIÂY']] as const;
  return (
    <div className="flex w-full gap-2 sm:w-auto sm:gap-3" aria-label={`Còn ${c.ngay} ngày ${c.gio} giờ ${c.phut} phút`}>
      {o.map(([v, l]) => (
        <div key={l} className={cx('flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl sm:h-[92px] sm:w-[94px] sm:flex-none sm:rounded-2xl', toi ? 'bg-ink-2' : 'bg-nen')}>
          <span className="mono text-[1.5rem] font-bold leading-none sm:text-[2.375rem]">{hai(v)}</span>
          <span className={cx('text-[10px] tracking-widest sm:text-[11px]', toi ? 'text-[#F0C9C4]' : 'text-mo')}>{l}</span>
        </div>
      ))}
    </div>
  );
}

export function ChipHan({ han, className }: { han: string; className?: string }) {
  const t = useBayGio();
  const m = MAU_GAP[mucGap(new Date(han).getTime() - t)];
  return <span className={cx('mono inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold', m.nen, m.chu, className)}>{conLaiNgan(han, t)}</span>;
}

export function NhanGap({ han }: { han: string }) {
  const t = useBayGio(30000);
  const m = MAU_GAP[mucGap(new Date(han).getTime() - t)];
  return <span className={cx('shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold', m.nen, m.chu)}>{m.nhan}</span>;
}

// Thanh tiến độ có vạch mức giao và vạch TB
export function ThanhTyLe({ tyLe, mauThanh, vachGiao, vachTb, cao = 'h-2' }: { tyLe: number; mauThanh: string; vachGiao?: number | null; vachTb?: number | null; cao?: string }) {
  const pct = (v: number) => `${Math.max(0, Math.min(99.5, v * 100))}%`;
  return (
    <div className={cx('relative rounded-full bg-[#EEEBE3]', cao)}>
      <div className={cx('thanh-chay rounded-full', cao, mauThanh)} style={{ width: pct(Math.min(1, tyLe)) }} />
      {vachGiao != null && <div className="absolute -top-1 h-[calc(100%+8px)] w-0.5 bg-ink" style={{ left: pct(vachGiao) }} title="Mức giao" />}
      {vachTb != null && <div className="absolute -top-1 h-[calc(100%+8px)] border-l-2 border-dotted border-mo" style={{ left: pct(vachTb) }} title="Trung bình tỉnh" />}
    </div>
  );
}

// Props cho lớp nền popup: chỉ đóng khi cả lúc nhấn lẫn lúc nhả chuột đều nằm trên nền
// (tránh bấm trong popup, kéo chuột ra ngoài rồi nhả thì popup tự đóng).
let nhanTrenNen = false;
export function nenDong(dong: () => void) {
  return {
    onMouseDown: (e: { target: EventTarget; currentTarget: EventTarget }) => { nhanTrenNen = e.target === e.currentTarget; },
    onTouchStart: (e: { target: EventTarget; currentTarget: EventTarget }) => { nhanTrenNen = e.target === e.currentTarget; },
    onClick: (e: { target: EventTarget; currentTarget: EventTarget }) => {
      const hopLe = nhanTrenNen && e.target === e.currentTarget;
      nhanTrenNen = false;
      if (hopLe) dong();
    },
  };
}

export function HopThoai({ mo, dong, tieuDe, children, rong = 'max-w-lg' }: { mo: boolean; dong: () => void; tieuDe: string; children: ReactNode; rong?: string }) {
  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [mo, dong]);
  if (!mo) return null;
  return (
    <div className="mo-dan fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" {...nenDong(dong)}>
      <div role="dialog" aria-modal="true" aria-label={tieuDe}
        className={cx('hien-hop max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-3xl bg-white px-4 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[92vh] sm:rounded-3xl sm:px-5 sm:pb-5', rong)}>
        <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-3 border-b border-[#F1EEE7] bg-white/95 px-4 pb-3 pt-4 backdrop-blur sm:-mx-5 sm:px-5 sm:pt-5">
          <h2 className="m-0 flex-1 text-lg font-bold">{tieuDe}</h2>
          <button onClick={dong} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-nen"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function O({ nhan, children, goiY }: { nhan: string; children: ReactNode; goiY?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[0.8125rem] font-semibold text-mo-2 [&>input]:w-full [&>select]:w-full [&>textarea]:w-full">
      {nhan}
      {children}
      {goiY && <span className="text-xs font-normal text-mo">{goiY}</span>}
    </label>
  );
}
export const lopO = 'min-h-11 min-w-0 max-w-full rounded-xl border border-vien-2 bg-nen-2 px-3 text-base font-normal text-den sm:text-[0.9375rem] outline-none focus:border-xanh focus:bg-white disabled:opacity-60';

// Biểu trưng dùng chung (ảnh cờ Đảng — public/logo.jpg)
// Biểu trưng: cờ Đảng
export function LogoBcd({ className = 'h-11 w-11' }: { className?: string }) {
  return <img src="/logo.jpg" alt="Biểu trưng Ban Chỉ đạo 57" width={96} height={96} className={cx('shrink-0 rounded-xl object-cover ring-1 ring-black/10', className)} />;
}

// Một dòng biểu mẫu: điện thoại nhãn ở trên, ô rộng hết; máy tính nhãn bên trái
export function Hang({ nhan, children }: { nhan: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[#F1EEE7] py-3 text-sm sm:flex-row sm:items-center sm:gap-3">
      <span className="font-semibold text-mo-2 sm:w-52 sm:shrink-0 sm:text-den">{nhan}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// Thanh nút Lưu dính đáy màn hình; trên điện thoại các nút chia đều bề ngang
export function ThanhThaoTac({ children, trai }: { children: ReactNode; trai?: ReactNode }) {
  return (
    <div className="day-duoi sticky z-10 flex flex-col gap-2 rounded-2xl border border-vien bg-white/95 p-2.5 shadow-[0_8px_24px_-12px_rgba(60,10,12,0.25)] backdrop-blur sm:flex-row sm:items-center sm:px-3">
      {trai && <div className="min-w-0 flex-1 text-sm font-semibold text-[#166534]">{trai}</div>}
      {!trai && <span className="hidden flex-1 sm:block" />}
      <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:justify-end">{children}</div>
    </div>
  );
}

// Đếm ngược dạng chữ đơn cách: "12 ngày" / "01:36:20" (khung chi tiết kỳ)
export function DongHoChu({ han, className }: { han: string; className?: string }) {
  const t = useBayGio();
  const c = conLai(han, t);
  const qua = c.ms <= 0;
  return (
    <div className={cx('mono flex flex-col font-bold leading-tight', qua ? 'text-nguy' : 'text-xanh', className)} aria-label={qua ? 'Đã quá hạn' : `Còn ${c.ngay} ngày ${c.gio} giờ ${c.phut} phút`}>
      {qua ? <span className="text-[1.5rem]">Quá hạn</span> : <>
        <span className="text-[1.5rem]">{c.ngay} ngày</span>
        <span className="text-[1.5rem]">{hai(c.gio)}:{hai(c.phut)}:{hai(c.giay)}</span>
      </>}
    </div>
  );
}

// Nút "⋯" mở danh sách thao tác
export type MucThaoTac = { ten: string; icon?: ReactNode; bam: () => void; nguy?: boolean; an?: boolean };
export function MenuThaoTac({ ds, nhan = 'Thao tác', className }: { ds: MucThaoTac[]; nhan?: string; className?: string }) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const refSheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mo) return;
    const f = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !refSheet.current?.contains(t)) setMo(false);
    };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [mo]);
  const hien = ds.filter((m) => !m.an);
  if (!hien.length) return null;
  return (
    <div ref={ref} className={cx('relative', className)}>
      <button type="button" onClick={() => setMo(!mo)} aria-haspopup="menu" aria-expanded={mo}
        aria-label={nhan} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-vien-2 bg-white px-3 text-sm font-semibold text-den hover:bg-nen-2 sm:min-h-11 sm:px-4">
        <MoreHorizontal className="h-4 w-4" /><span className="max-sm:hidden">{nhan}</span>
      </button>
      {mo && (
        <>
          {/* Điện thoại: bảng chọn trượt từ dưới lên (không tràn ra mép màn hình) */}
          {createPortal(<div ref={refSheet} className="mo-dan fixed inset-0 z-50 bg-ink/40 sm:hidden" {...nenDong(() => setMo(false))}>
            <div role="menu" aria-label={nhan} className="truot-len absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl bg-white px-2 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
              <div className="px-4 pb-2 text-[0.8125rem] font-semibold text-mo">{nhan}</div>
              {hien.map((m) => (
                <button key={m.ten} role="menuitem" type="button" onClick={() => { setMo(false); m.bam(); }}
                  className={cx('flex min-h-12 items-center gap-3 rounded-xl px-4 text-left text-[0.9375rem] font-medium hover:bg-nen-2', m.nguy ? 'text-nguy' : 'text-den')}>{m.icon}{m.ten}</button>
              ))}
              <button type="button" onClick={() => setMo(false)} className="mt-1 min-h-12 rounded-xl bg-nen-2 text-[0.9375rem] font-semibold text-den">Đóng</button>
            </div>
          </div>, document.body)}
          <div role="menu" className="bat-len absolute right-0 z-40 mt-2 hidden w-56 origin-top-right flex-col overflow-hidden rounded-2xl border border-vien bg-white py-1.5 shadow-xl sm:flex">
            {hien.map((m) => (
              <button key={m.ten} role="menuitem" type="button" onClick={() => { setMo(false); m.bam(); }}
                className={cx('flex min-h-11 items-center gap-2.5 px-4 text-left text-sm hover:bg-nen-2', m.nguy ? 'text-nguy' : 'text-den')}>{m.icon}{m.ten}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
