// Kéo thả chỉnh độ rộng cột, chiều cao hàng cho bảng; lưu theo trình duyệt (localStorage) để lần sau mở vẫn giữ.
import { useCallback, useState, type PointerEvent as RPointerEvent } from 'react';

const TOI_THIEU_COT = 40;
const TOI_THIEU_HANG = 24;
const doc = <T,>(k: string, mac: T): T => { try { const v = localStorage.getItem(`kt:${k}`); return v ? (JSON.parse(v) as T) : mac; } catch { return mac; } };
const ghi = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(`kt:${k}`); else localStorage.setItem(`kt:${k}`, JSON.stringify(v)); } catch { /* bỏ qua */ } };

export function useKichThuocBang(khoa: string) {
  const [cot, setCot] = useState<number[] | null>(() => doc<number[] | null>(`${khoa}:c`, null));
  const [hang, setHang] = useState<Record<string, number>>(() => doc<Record<string, number>>(`${khoa}:h`, {}));
  const daChinh = !!cot || Object.keys(hang).length > 0;

  const datLai = useCallback(() => { setCot(null); setHang({}); ghi(`${khoa}:c`, null); ghi(`${khoa}:h`, null); }, [khoa]);

  // Kéo mép phải của ô tiêu đề thứ i: đo độ rộng hiện tại của cả hàng tiêu đề rồi chỉ đổi cột i
  const keoCot = (e: RPointerEvent<HTMLElement>, i: number) => {
    e.preventDefault(); e.stopPropagation();
    const th = (e.currentTarget.closest('th') as HTMLElement | null); const tr = th?.parentElement;
    if (!tr) return;
    const dau = Array.from(tr.children).map((c) => Math.round((c as HTMLElement).getBoundingClientRect().width));
    const x0 = e.clientX; let cuoi = dau;
    const di = (ev: PointerEvent) => { const m = dau.slice(); m[i] = Math.max(TOI_THIEU_COT, dau[i] + ev.clientX - x0); cuoi = m; setCot(m); };
    const xong = () => { window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', xong); ghi(`${khoa}:c`, cuoi); };
    window.addEventListener('pointermove', di); window.addEventListener('pointerup', xong);
  };

  // Kéo mép dưới ô đầu của hàng: đổi chiều cao hàng đó
  const keoHang = (e: RPointerEvent<HTMLElement>, k: string) => {
    e.preventDefault(); e.stopPropagation();
    const tr = e.currentTarget.closest('tr'); if (!tr) return;
    const dau = Math.round(tr.getBoundingClientRect().height); const y0 = e.clientY; let cuoi = dau;
    const di = (ev: PointerEvent) => { cuoi = Math.max(TOI_THIEU_HANG, dau + ev.clientY - y0); setHang((h) => ({ ...h, [k]: cuoi })); };
    const xong = () => { window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', xong); setHang((h) => { ghi(`${khoa}:h`, h); return h; }); };
    window.addEventListener('pointermove', di); window.addEventListener('pointerup', xong);
  };

  return { cot, hang, daChinh, datLai, keoCot, keoHang };
}

/** Tay nắm kéo cột — đặt trong <th className="relative"> */
export const TayCot = ({ bam, i }: { bam: (e: RPointerEvent<HTMLElement>, i: number) => void; i: number }) => (
  <span role="separator" aria-orientation="vertical" title="Kéo để đổi độ rộng cột" onPointerDown={(e) => bam(e, i)}
    className="absolute -right-[3px] top-0 z-10 h-full w-[7px] cursor-col-resize touch-none select-none hover:bg-[#8B1A2B]/40" />
);

/** Tay nắm kéo hàng — đặt trong ô đầu của hàng (<td className="relative">) */
export const TayHang = ({ bam, k }: { bam: (e: RPointerEvent<HTMLElement>, k: string) => void; k: string }) => (
  <span role="separator" aria-orientation="horizontal" title="Kéo để đổi chiều cao hàng" onPointerDown={(e) => bam(e, k)}
    className="absolute -bottom-[3px] left-0 z-10 h-[7px] w-full cursor-row-resize touch-none select-none hover:bg-[#8B1A2B]/40" />
);

/** Thuộc tính cho <table> khi đã có độ rộng cột tuỳ chỉnh */
export const kieuBang = (cot: number[] | null) => (cot ? { tableLayout: 'fixed' as const, width: cot.reduce((a, b) => a + b, 0) } : undefined);
