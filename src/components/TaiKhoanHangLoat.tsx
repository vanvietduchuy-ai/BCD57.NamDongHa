// Tạo nhiều tài khoản một lần cho 1 đơn vị (tổ Công an phường, trường học, phòng ban…)
// Email tự sinh: <mã đơn vị>.<họ tên không dấu>@bcd57.namdongha; mật khẩu tạm do máy chủ sinh, bắt đổi ở lần đăng nhập đầu.
import { useState } from 'react';
import { ClipboardPaste, Copy, Download, Plus, Trash2, UsersRound } from 'lucide-react';
import { goiChucNang, loiDe } from '../lib/supabase';
import { khongDau } from '../lib/nhiemVu';
import { cx, HopLoi, HopThoai, lopO, Nut, O } from './ui';

export type DvTk = { id: string; ma: string; ten: string; loai: string };
export const KHOI_DV: [string, string, (l: string) => boolean][] = [
  ['cong_an', 'Công an phường', (l) => l === 'cong_an' || l === 'co_quan_thuong_truc'],
  ['truong_hoc', 'Trường công lập', (l) => l === 'truong_hoc'],
  ['phong_ban', 'Phòng, ban, đoàn thể', (l) => ['phong_ban', 'doan_the', 'khac'].includes(l)],
  ['lanh_dao', 'Lãnh đạo BCĐ', (l) => l === 'lanh_dao_bcd'],
];
export const khoiCua = (loai: string) => KHOI_DV.find(([, , f]) => f(loai))?.[0] ?? 'phong_ban';

type Dong = { ho_ten: string; chuc_vu: string; sdt: string };
type KetQua = { ho_ten: string; email: string; mat_khau?: string; loi?: string };
const DOMAIN = 'bcd57.namdongha';
export const emailTuSinh = (ma: string, hoTen: string) =>
  `${khongDau(ma).replace(/^(ca|th)_/, '').replace(/[^a-z0-9]/g, '')}.${khongDau(hoTen).replace(/[^a-z0-9]/g, '')}@${DOMAIN}`;

export default function TaoTaiKhoanHangLoat({ mo, dong, donVi, xong }: { mo: boolean; dong: () => void; donVi: DvTk[]; xong: () => void }) {
  const [dv, setDv] = useState('');
  const [vaiTro, setVaiTro] = useState('don_vi');
  const [ds, setDs] = useState<Dong[]>([{ ho_ten: '', chuc_vu: '', sdt: '' }]);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [kq, setKq] = useState<KetQua[] | null>(null);
  const [moCu, setMoCu] = useState(false);
  if (mo !== moCu) { setMoCu(mo); if (mo) { setDv(''); setVaiTro('don_vi'); setDs([{ ho_ten: '', chuc_vu: '', sdt: '' }]); setKq(null); setLoi(null); } }
  if (!mo) return null;
  const dvChon = donVi.find((d) => d.id === dv);
  const hopLe = ds.filter((d) => d.ho_ten.trim());

  // Dán từ Excel/Word: mỗi dòng "Họ tên <Tab|;> Chức vụ <Tab|;> SĐT"
  const dan = async () => {
    const t = await navigator.clipboard.readText().catch(() => window.prompt('Dán danh sách (mỗi dòng: Họ tên; Chức vụ; SĐT)') ?? '');
    const moi = t.split(/\r?\n/).map((l) => l.split(/\t|;/).map((x) => x.trim())).filter((x) => x[0]).map(([ho_ten, chuc_vu = '', sdt = '']) => ({ ho_ten, chuc_vu, sdt }));
    if (moi.length) setDs([...ds.filter((d) => d.ho_ten.trim()), ...moi]);
  };
  const tao = async () => {
    setLoi(null);
    if (!dvChon) { setLoi('Chọn đơn vị'); return; }
    if (!hopLe.length) { setLoi('Nhập ít nhất 1 người'); return; }
    setDang(true);
    try {
      const r = await goiChucNang<{ ket_qua: KetQua[] }>('quan-tri-tai-khoan', {
        hanh_dong: 'tao_nhieu', don_vi_id: dvChon.id, vai_tro: vaiTro,
        ds: hopLe.map((d) => ({ ho_ten: d.ho_ten.trim(), chuc_vu: d.chuc_vu.trim() || null, sdt: d.sdt.trim() || null, email: emailTuSinh(dvChon.ma, d.ho_ten) })),
      });
      setKq(r.ket_qua); xong();
    } catch (e) { setLoi(loiDe(e)); } finally { setDang(false); }
  };
  const taiExcel = async () => {
    if (!kq || !dvChon) return;
    const X = await import('xlsx');
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Họ tên', 'Email đăng nhập', 'Mật khẩu tạm', 'Ghi chú'], ...kq.map((k) => [k.ho_ten, k.email, k.mat_khau ?? '', k.loi ?? 'Đổi mật khẩu ở lần đăng nhập đầu'])]), 'Tài khoản');
    X.writeFile(wb, `Tai khoan ${dvChon.ma}.xlsx`);
  };

  return (
    <HopThoai mo dong={dong} tieuDe={kq ? 'Đã tạo tài khoản' : 'Tạo tài khoản hàng loạt'} rong="max-w-3xl">
      {kq ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[0.875rem]">Đã tạo <b>{kq.filter((k) => !k.loi).length}/{kq.length}</b> tài khoản cho <b>{dvChon?.ten}</b>. Mật khẩu tạm chỉ hiện lần này — tải danh sách để phát cho cán bộ; hệ thống bắt đổi mật khẩu ở lần đăng nhập đầu.</p>
          <ul className="m-0 list-none rounded-xl border border-vien p-0">
            {kq.map((k) => (
              <li key={k.email} className="flex flex-col gap-0.5 border-b border-[#F1EEE7] px-3 py-2.5 last:border-0">
                <div className="flex items-center gap-2"><b className="min-w-0 flex-1 text-[0.875rem]">{k.ho_ten}</b>
                  {k.loi ? <span className="text-[11.5px] font-semibold text-nguy">{k.loi}</span> : <span className="mono rounded-md bg-nen-3 px-2 py-0.5 text-[0.8125rem] font-bold">{k.mat_khau}</span>}</div>
                <span className="break-all text-xs text-mo">{k.email}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Nut icon={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard.writeText(kq.map((k) => `${k.ho_ten}\t${k.email}\t${k.mat_khau ?? ''}`).join('\n'))}>Sao chép</Nut>
            <Nut kieu="chinh" icon={<Download className="h-4 w-4" />} onClick={taiExcel}>Tải danh sách (Excel)</Nut>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {loi && <HopLoi loi={loi} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_190px]">
            <O nhan="Đơn vị">
              <select className={lopO} value={dv} onChange={(e) => setDv(e.target.value)}>
                <option value="">— Chọn đơn vị —</option>
                {KHOI_DV.map(([k, ten, f]) => { const ds_ = donVi.filter((d) => f(d.loai)); return ds_.length ? <optgroup key={k} label={ten}>{ds_.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}</optgroup> : null; })}
              </select>
            </O>
            <O nhan="Vai trò"><select className={lopO} value={vaiTro} onChange={(e) => setVaiTro(e.target.value)}><option value="don_vi">Cán bộ đơn vị</option><option value="lanh_dao">Lãnh đạo BCĐ</option></select></O>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[0.8125rem] font-semibold">Danh sách cán bộ <span className="font-normal text-mo">· {hopLe.length} người</span></span>
            <Nut kieu="nhe" icon={<ClipboardPaste className="h-4 w-4" />} onClick={dan}>Dán từ Excel</Nut>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {ds.map((d, i) => {
              const doi = (k: keyof Dong, v: string) => setDs(ds.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <li key={i} className="flex flex-col gap-1.5 rounded-xl border border-vien bg-nen-2 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="so w-5 shrink-0 text-center text-[11.5px] font-bold text-mo">{i + 1}</span>
                    <input aria-label="Họ tên" placeholder="Họ và tên" className={cx(lopO, 'min-h-10 flex-1 bg-white')} value={d.ho_ten} onChange={(e) => doi('ho_ten', e.target.value)} />
                    <button aria-label="Xoá dòng" onClick={() => setDs(ds.length > 1 ? ds.filter((_, j) => j !== i) : [{ ho_ten: '', chuc_vu: '', sdt: '' }])} className="grid h-10 w-9 shrink-0 place-items-center text-mo"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-7 pr-11">
                    <input aria-label="Chức vụ" placeholder="Chức vụ" className={cx(lopO, 'min-h-9 bg-white text-[0.8125rem]')} value={d.chuc_vu} onChange={(e) => doi('chuc_vu', e.target.value)} />
                    <input aria-label="Số điện thoại" placeholder="SĐT (Zalo)" inputMode="tel" className={cx(lopO, 'so min-h-9 bg-white text-[0.8125rem]')} value={d.sdt} onChange={(e) => doi('sdt', e.target.value)} />
                  </div>
                  {dvChon && d.ho_ten.trim() && <span className="break-all pl-7 text-[11.5px] text-mo">Đăng nhập: <b className="font-semibold text-mo-2">{emailTuSinh(dvChon.ma, d.ho_ten)}</b></span>}
                </li>
              );
            })}
          </ul>
          <button onClick={() => setDs([...ds, { ho_ten: '', chuc_vu: '', sdt: '' }])} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-vien-2 text-[0.8125rem] font-semibold text-[#8E1B22]"><Plus className="h-4 w-4" />Thêm người</button>
          <div className="flex justify-end gap-2"><Nut onClick={dong}>Huỷ</Nut>
            <Nut kieu="chinh" icon={<UsersRound className="h-4 w-4" />} dangChay={dang} onClick={tao}>Tạo {hopLe.length || ''} tài khoản</Nut></div>
        </div>
      )}
    </HopThoai>
  );
}

// Email tài khoản dùng chung của một đơn vị (mỗi trường / phòng một tài khoản): tên viết liền không dấu, bỏ chữ "Trường",
// cấp học viết tắt (Mầm non -> mn, Tiểu học -> th, THCS -> thcs). Vd "Trường Tiểu học Hàm Nghi" -> thhamnghi@bcd57.namdongha
export const emailDonVi = (ten: string, ma: string) => {
  const t = khongDau(ten).replace(/^truong\s+/, '');
  const cap: [RegExp, string][] = [[/^mam non\s+/, 'mn'], [/^tieu hoc\s+/, 'th'], [/^thcs\s+/, 'thcs'], [/^thpt\s+/, 'thpt']];
  const hit = cap.find(([re]) => re.test(t));
  const goc = hit ? hit[1] + t.replace(hit[0], '') : khongDau(ma);
  return `${goc.replace(/[^a-z0-9]/g, '')}@${DOMAIN}`;
};

// Tạo mỗi đơn vị chưa có tài khoản một tài khoản dùng chung (khối chọn được, mặc định trường công lập)
export function TaoTaiKhoanTheoDonVi({ mo, dong, donVi, daCo, xong }: { mo: boolean; dong: () => void; donVi: DvTk[]; daCo: Set<string>; xong: () => void }) {
  const [khoi, setKhoi] = useState('truong_hoc');
  const [bo, setBo] = useState<Set<string>>(new Set());
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [kq, setKq] = useState<(KetQua & { don_vi: string })[] | null>(null);
  const [moCu, setMoCu] = useState(false);
  if (mo !== moCu) { setMoCu(mo); if (mo) { setKhoi('truong_hoc'); setBo(new Set()); setKq(null); setLoi(null); } }
  if (!mo) return null;
  const f = KHOI_DV.find(([k]) => k === khoi)?.[2] ?? (() => false);
  const ds = donVi.filter((d) => f(d.loai) && !daCo.has(d.id) && d.loai !== 'lanh_dao_bcd' && !/^(TRUONG_HOC|THUONG_TRUC)$/.test(d.ma));
  const chon = ds.filter((d) => !bo.has(d.id));
  const tao = async () => {
    setLoi(null); setDang(true);
    const tong: (KetQua & { don_vi: string })[] = [];
    try {
      for (const d of chon) {
        const r = await goiChucNang<{ ket_qua: KetQua[] }>('quan-tri-tai-khoan', {
          hanh_dong: 'tao_nhieu', don_vi_id: d.id, vai_tro: 'don_vi',
          ds: [{ ho_ten: d.ten, chuc_vu: null, sdt: null, email: emailDonVi(d.ten, d.ma) }],
        });
        tong.push(...r.ket_qua.map((k) => ({ ...k, don_vi: d.ten })));
      }
    } catch (e) { setLoi(loiDe(e)); }
    finally { setDang(false); if (tong.length) { setKq(tong); xong(); } }
  };
  const taiExcel = async () => {
    if (!kq) return;
    const X = await import('xlsx');
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Đơn vị', 'Email đăng nhập', 'Mật khẩu tạm', 'Ghi chú'], ...kq.map((k) => [k.don_vi, k.email, k.mat_khau ?? '', k.loi ?? 'Đổi mật khẩu ở lần đăng nhập đầu'])]), 'Tài khoản');
    X.writeFile(wb, 'Tai khoan don vi.xlsx');
  };
  return (
    <HopThoai mo dong={dong} tieuDe={kq ? 'Đã tạo tài khoản' : 'Tạo tài khoản cho đơn vị'} rong="max-w-2xl">
      {kq ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[0.875rem]">Đã tạo <b>{kq.filter((k) => !k.loi).length}/{kq.length}</b> tài khoản. Mật khẩu tạm chỉ hiện lần này — tải danh sách để gửi cho từng đơn vị; hệ thống bắt đổi mật khẩu ở lần đăng nhập đầu.</p>
          <ul className="m-0 list-none rounded-xl border border-vien p-0">
            {kq.map((k) => (
              <li key={k.email} className="flex flex-col gap-0.5 border-b border-[#F1EEE7] px-3 py-2.5 last:border-0">
                <div className="flex items-center gap-2"><b className="min-w-0 flex-1 text-[0.875rem]">{k.don_vi}</b>
                  {k.loi ? <span className="text-[11.5px] font-semibold text-nguy">{k.loi}</span> : <span className="mono rounded-md bg-nen-3 px-2 py-0.5 text-[0.8125rem] font-bold">{k.mat_khau}</span>}</div>
                <span className="break-all text-xs text-mo">{k.email}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Nut icon={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard.writeText(kq.map((k) => `${k.don_vi}\t${k.email}\t${k.mat_khau ?? ''}`).join('\n'))}>Sao chép</Nut>
            <Nut kieu="chinh" icon={<Download className="h-4 w-4" />} onClick={taiExcel}>Tải danh sách (Excel)</Nut>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {loi && <HopLoi loi={loi} />}
          <O nhan="Khối đơn vị">
            <select className={lopO} value={khoi} onChange={(e) => { setKhoi(e.target.value); setBo(new Set()); }}>
              {KHOI_DV.filter(([k]) => k !== 'lanh_dao').map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </O>
          <p className="m-0 text-[0.8125rem] text-mo">Mỗi đơn vị dưới đây chưa có tài khoản; mỗi đơn vị được tạo <b>một tài khoản dùng chung</b>, email lấy theo tên đơn vị.</p>
          {ds.length === 0 ? <p className="m-0 text-[0.875rem] font-semibold">Mọi đơn vị trong khối này đã có tài khoản.</p> : (
            <ul className="m-0 list-none rounded-xl border border-vien p-0">
              {ds.map((d) => (
                <li key={d.id} className="border-b border-[#F1EEE7] last:border-0">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                    <input type="checkbox" className="h-4 w-4 shrink-0" checked={!bo.has(d.id)} onChange={() => setBo((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} />
                    <span className="flex min-w-0 flex-1 flex-col"><b className="text-[0.875rem]">{d.ten}</b><span className="break-all text-xs text-mo">{emailDonVi(d.ten, d.ma)}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Nut onClick={dong}>Huỷ</Nut>
            <Nut kieu="chinh" icon={<Plus className="h-4 w-4" />} onClick={() => void tao()} disabled={dang || !chon.length}>{dang ? 'Đang tạo…' : `Tạo ${chon.length} tài khoản`}</Nut>
          </div>
        </div>
      )}
    </HopThoai>
  );
}
