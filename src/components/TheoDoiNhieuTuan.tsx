// Theo dõi báo cáo tuần của đơn vị qua nhiều tuần: tỷ lệ đúng hạn, trễ, không nộp đủ + xếp hạng + xuất Excel
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { chuTre, muonMs, tinhTrangTuan, tuanCua, type CapNhatTuan, type CauHinhBCT, type TinhTrangTuan } from '../lib/baoCaoTuan';
import { daQuaHan, gomCapNhat, viecCuaTuan } from '../lib/chotTuan';
import type { CauHinhA4 } from '../lib/danhMucA4';
import type { NhiemVu } from '../lib/nhiemVu';
import { lopO, Nut, Rong, The, cx } from './ui';

type DonVi = { id: string; ten: string; thu_tu: number | null };
type O = { nhan: string; tt: TinhTrangTuan; muon: number; so: number; bao: number };
const MAU: Partial<Record<TinhTrangTuan, string>> = { du: 'bg-xanh', tre: 'bg-[#F59E0B]', thieu: 'bg-nguy', qua_han: 'bg-nguy' };
const NHAN: Partial<Record<TinhTrangTuan, string>> = { du: 'Đúng hạn', tre: 'Trễ hạn', thieu: 'Gửi chưa đủ', qua_han: 'Không gửi' };

export default function TheoDoiNhieuTuan({ nv, cn, a4, bct, dv }: { nv: NhiemVu[]; cn: CapNhatTuan[]; a4: CauHinhA4; bct: CauHinhBCT; dv: DonVi[] }) {
  const [soTuan, setSoTuan] = useState(8);
  const { tuans, bang } = useMemo(() => {
    const cnMap = gomCapNhat(cn);
    const tuans = Array.from({ length: soTuan }, (_, i) => tuanCua(new Date(), bct, i)).filter((t) => daQuaHan(t)).reverse();   // cũ → mới, chỉ tuần đã qua hạn
    const theoTuan = tuans.map((t) => ({ t, viec: viecCuaTuan(nv, cn, cnMap, a4, t, true) }));
    const bang = dv.map((d) => {
      const o: (O | null)[] = theoTuan.map(({ t, viec }) => {
        const ds = viec.filter((x) => x.n.chu_tri_don_vi_id === d.id);
        if (!ds.length) return null;
        const bao = ds.filter((x) => x.tuan.length), muon = Math.max(0, ...bao.map((x) => muonMs(x.tuan, t.han)));
        const tt = tinhTrangTuan(ds.length, bao.length, muon > 0, t);
        return { tt, muon, so: ds.length, bao: bao.length, nhan: NHAN[tt] ?? '' };
      });
      const co = o.filter((x): x is O => !!x), dung = co.filter((x) => x.tt === 'du').length, tre = co.filter((x) => x.tt === 'tre'), khong = co.filter((x) => x.tt === 'thieu' || x.tt === 'qua_han').length;
      return { d, o, soTuan: co.length, dung, tre: tre.length, treTb: tre.length ? tre.reduce((s, x) => s + x.muon, 0) / tre.length : 0, khong, tyLe: co.length ? dung / co.length : null };
    }).filter((b) => b.soTuan > 0).sort((a, b) => (b.tyLe ?? -1) - (a.tyLe ?? -1) || a.tre - b.tre || (a.d.thu_tu ?? 0) - (b.d.thu_tu ?? 0));
    return { tuans, bang };
  }, [nv, cn, a4, bct, dv, soTuan]);

  const xuat = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bang.map((b, i) => ({
      'Hạng': i + 1, 'Đơn vị': b.d.ten, 'Số tuần phải báo cáo': b.soTuan, 'Đúng hạn': b.dung, 'Trễ hạn': b.tre, 'Trễ TB': b.tre ? chuTre(b.treTb) : '', 'Không gửi đủ': b.khong,
      'Tỷ lệ đúng hạn (%)': b.tyLe == null ? '' : Math.round(b.tyLe * 100),
    }))), 'Xếp hạng');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bang.map((b) => Object.fromEntries([['Đơn vị', b.d.ten], ...tuans.map((t, i) => {
      const x = b.o[i]; return [`Tuần ${t.so}/${t.nam}`, x ? `${x.nhan}${x.tt === 'tre' ? ` (${chuTre(x.muon)})` : ''} ${x.bao}/${x.so}` : '—'];
    })]))), 'Từng tuần');
    XLSX.writeFile(wb, `theo-doi-bao-cao-tuan-${tuans.length}-tuan.xlsx`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[0.9375rem]">Theo dõi nhiều tuần theo đơn vị</b>
        <select aria-label="Số tuần" className={lopO} value={soTuan} onChange={(e) => setSoTuan(Number(e.target.value))}>{[4, 8, 12].map((t) => <option key={t} value={t}>{t} tuần gần nhất</option>)}</select>
        <span className="flex-1" />
        <Nut icon={<Download className="h-4 w-4" />} disabled={!bang.length} onClick={() => void xuat()}>Xuất Excel</Nut>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-mo">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-xanh" />Đúng hạn</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-[#F59E0B]" />Trễ hạn</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-nguy" />Không gửi đủ</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-[#E5E1D6]" />Không có nhiệm vụ</span>
      </div>
      {bang.length === 0 ? <Rong>Chưa có tuần nào qua hạn trong khoảng này.</Rong> : (
        <The className="overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[0.8125rem]">
            <thead className="bg-nen-2 text-left text-[11px] text-mo">
              <tr><th className="px-3 py-3">HẠNG</th><th className="px-2">ĐƠN VỊ</th><th className="w-40 px-2">ĐÚNG HẠN</th><th className="px-2 text-right">TRỄ</th><th className="px-2 text-right">KHÔNG ĐỦ</th><th className="px-3">TỪNG TUẦN (cũ → mới)</th></tr>
            </thead>
            <tbody>
              {bang.map((b, i) => (
                <tr key={b.d.id} className="border-t border-[#F1EEE7] align-middle">
                  <td className="so px-3 py-3 font-bold">{i + 1}</td>
                  <td className="px-2 font-semibold">{b.d.ten}</td>
                  <td className="px-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-[#EEEBE3]"><div className={cx('h-1.5 rounded-full', (b.tyLe ?? 1) >= 0.9 ? 'bg-xanh' : (b.tyLe ?? 1) >= 0.7 ? 'bg-[#F59E0B]' : 'bg-nguy')} style={{ width: `${(b.tyLe ?? 0) * 100}%` }} /></div>
                      <span className="so w-12 text-right text-xs font-bold">{b.tyLe == null ? '—' : `${Math.round(b.tyLe * 100)}%`}</span>
                    </div>
                    <div className="text-[11px] text-mo">{b.dung}/{b.soTuan} tuần</div>
                  </td>
                  <td className="so px-2 text-right">{b.tre ? <span className="font-semibold text-cam-dam">{b.tre}<span className="font-sans text-[11px] font-normal text-mo"> (TB {chuTre(b.treTb)})</span></span> : '—'}</td>
                  <td className="so px-2 text-right">{b.khong ? <span className="font-bold text-nguy">{b.khong}</span> : '—'}</td>
                  <td className="px-3"><div className="flex flex-wrap gap-1">
                    {b.o.map((x, k) => <span key={k} title={`Tuần ${tuans[k].so}/${tuans[k].nam}: ${x ? `${x.nhan}${x.tt === 'tre' ? ` ${chuTre(x.muon)}` : ''} (${x.bao}/${x.so})` : 'không có nhiệm vụ'}`} className={cx('h-6 w-6 rounded-md', x ? MAU[x.tt] : 'bg-[#E5E1D6]')} />)}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></The>
      )}
    </div>
  );
}
