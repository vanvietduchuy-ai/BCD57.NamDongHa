import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive, Bell, BookOpen, ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen, Radar, CheckSquare, FileText, Send, Home, LayoutGrid, LogOut, Menu, ShieldCheck, SlidersHorizontal, Mail,
} from 'lucide-react';
import { laDauMoi, TEN_VAI_TRO, useAuth, type HoSo, type VaiTro } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ngayGio } from '../lib/dinhDang';
import { cx, LogoBcd, Nut } from './ui';
import { CaiDatThongBao, GoiYUngDung } from './UngDung';
import { dongBoDay } from '../lib/ungDung';
import { CongBatBuocSdt, HopLienHe, useThieuSdt } from './LienHe';

type Muc = { den: string; ten: string; icon: ReactNode; nhom?: string; ngan?: string; dem?: number };

function menu(h: HoSo): Muc[] {
  const vt: VaiTro = h.vai_tro;
  const i = (C: typeof Home) => <C className="h-5 w-5" strokeWidth={1.8} />;
  if (vt === 'don_vi') return [
    // 3 mục đầu nằm ở thanh dưới trên điện thoại
    { den: '/', ten: 'Trang chủ', icon: i(Home) },
    { den: '/viec-can-nop', ten: 'Văn bản cần nộp', ngan: 'Văn bản cần nộp', icon: i(FileText) },
    { den: '/nhiem-vu', ten: 'Nhiệm vụ', icon: i(CheckSquare) },
    ...(laDauMoi(h) ? [{ den: '/theo-doi', ten: 'Theo dõi đơn vị', icon: i(Radar) }, { den: '/ky-bao-cao', ten: 'Giao báo cáo', icon: i(Send) }] : []),
    { den: '/van-ban', ten: 'Văn bản đến – đi', ngan: 'Văn bản', icon: i(Mail) },
    { den: '/kho-van-ban', ten: 'Văn bản', icon: i(Archive) },
  ];
  const chung: Muc[] = [
    { den: '/', ten: 'Tổng quan', icon: i(LayoutGrid), nhom: 'ĐIỀU HÀNH' },
    { den: '/nhiem-vu', ten: 'Nhiệm vụ BCĐ', icon: i(CheckSquare), nhom: 'ĐIỀU HÀNH' },
    { den: '/ky-bao-cao', ten: 'Theo dõi kỳ báo cáo', ngan: 'Theo dõi kỳ', icon: i(FileText), nhom: 'ĐIỀU HÀNH' },
  ];
  if (vt === 'lanh_dao') return [...chung,
    { den: '/kho-van-ban', ten: 'Kho văn bản', icon: i(Archive), nhom: 'LƯU TRỮ' },
    { den: '/so-cong-van', ten: 'Sổ công văn', icon: i(BookOpen), nhom: 'LƯU TRỮ' },
  ];
  if (vt === 'quan_tri') return [
    ...chung,
    { den: '/viec-can-nop', ten: 'Văn bản cần nộp', icon: i(Send), nhom: 'ĐIỀU HÀNH' },
    { den: '/van-ban', ten: 'Văn bản đến – đi', icon: i(Mail), nhom: 'ĐIỀU HÀNH' },
    { den: '/kho-van-ban', ten: 'Kho văn bản', icon: i(Archive), nhom: 'LƯU TRỮ' },
    { den: '/so-cong-van', ten: 'Sổ công văn', icon: i(BookOpen), nhom: 'LƯU TRỮ' },
    { den: '/cai-dat', ten: 'Cài đặt', icon: i(SlidersHorizontal), nhom: 'LƯU TRỮ' },
  ];
  return [
    ...chung,
    { den: '/van-ban', ten: 'Văn bản đến – đi', icon: i(Mail), nhom: 'ĐIỀU HÀNH' },
    { den: '/kho-van-ban', ten: 'Kho văn bản', icon: i(Archive), nhom: 'LƯU TRỮ & HỆ THỐNG' },
    { den: '/so-cong-van', ten: 'Sổ công văn', icon: i(BookOpen), nhom: 'LƯU TRỮ & HỆ THỐNG' },
    { den: '/quan-tri', ten: 'Quản trị hệ thống', icon: i(ShieldCheck), nhom: 'LƯU TRỮ & HỆ THỐNG' },
  ];
}

const VAI_TRO = TEN_VAI_TRO;

function Logo({ toi = true }: { toi?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoBcd className="h-11 w-11" />
      <div className="flex flex-col">
        <span className={cx('text-[0.9375rem] font-bold', toi ? 'text-white' : 'text-den')}>BCĐ 57</span>
        <span className={cx('whitespace-nowrap text-xs', toi ? 'text-[#F0C9C4]' : 'text-mo')}>Phường Nam Đông Hà</span>
      </div>
    </div>
  );
}

type ThongBao = { id: number; tieu_de: string; noi_dung: string | null; duong_dan: string | null; da_doc: boolean; luc: string };

export function Chuong({ moSangPhai = false, toi = false }: { moSangPhai?: boolean; toi?: boolean }) {
  const [ds, setDs] = useState<ThongBao[]>([]);
  const [mo, setMo] = useState(false);
  const nav = useNavigate();
  const tai = async () => {
    const { data } = await supabase.from('thong_bao').select('id, tieu_de, noi_dung, duong_dan, da_doc, luc').order('luc', { ascending: false }).limit(15);
    setDs((data as ThongBao[]) ?? []);
  };
  useEffect(() => {
    void tai();
    const i = setInterval(tai, 60000);
    const f = (e: MessageEvent) => { if (e.data?.loai === 'thong_bao_moi') void tai(); };
    navigator.serviceWorker?.addEventListener('message', f);
    return () => { clearInterval(i); navigator.serviceWorker?.removeEventListener('message', f); };
  }, []);
  const chuaDoc = ds.filter((x) => !x.da_doc).length;
  const bam = async (t: ThongBao) => {
    setMo(false);
    if (!t.da_doc) { await supabase.from('thong_bao').update({ da_doc: true }).eq('id', t.id); void tai(); }
    if (t.duong_dan) nav(t.duong_dan);
  };
  return (
    <div className="relative">
      <button onClick={() => setMo(!mo)} aria-label={`Thông báo${chuaDoc ? `, ${chuaDoc} chưa đọc` : ''}`}
        className={cx('relative flex items-center justify-center rounded-xl transition active:scale-95', toi ? 'h-9 w-9 bg-white/10 text-[#F6E3E0] hover:text-white' : 'h-10 w-10 border border-vien bg-white text-den sm:h-11 sm:w-11')}>
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        {chuaDoc > 0 && <span className="cham-nhip absolute right-2 top-2 h-2 w-2 rounded-full bg-do" />}
      </button>
      {mo && (
        <div className={cx('bat-len absolute z-50 mt-2 w-80 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-vien bg-white text-den shadow-xl', moSangPhai ? 'left-0 origin-top-left' : 'right-0 origin-top-right')}>
          <div className="border-b border-vien px-4 py-3 text-sm font-bold">Thông báo</div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
          {ds.length === 0 && <div className="p-4 text-sm text-mo">Chưa có thông báo.</div>}
          {ds.map((t) => (
            <button key={t.id} onClick={() => bam(t)} className={cx('flex w-full flex-col gap-0.5 border-b border-[#F1EEE7] px-4 py-3 text-left hover:bg-nen-2', !t.da_doc && 'bg-xanh-nhat/40')}>
              <span className="text-[0.8125rem] font-semibold">{t.tieu_de}</span>
              {t.noi_dung && <span className="line-clamp-2 text-xs text-mo">{t.noi_dung}</span>}
              <span className="text-[11px] text-mo">{ngayGio(t.luc)}</span>
            </button>
          ))}
          </div>
          <CaiDatThongBao />
        </div>
      )}
    </div>
  );
}

export default function KhungTrang() {
  const { hoSo, dangXuat } = useAuth();
  const location = useLocation();
  const vungCuon = useRef<HTMLDivElement>(null);
  // Sang trang khác: về đầu trang (điện thoại cuộn trong khung riêng)
  useEffect(() => { vungCuon.current?.scrollTo(0, 0); }, [location.pathname]);
  // iPhone: bàn phím mở làm cả trang (window) bị đẩy lên; đóng bàn phím không tự trả về -> thanh dưới lơ lửng giữa màn hình.
  // Khung đã cố định (fixed) nên trang gốc không cần cuộn: đưa về 0 khi rời ô nhập / bàn phím đóng.
  useEffect(() => {
    const laO = (e: Element | null) => !!e && /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName);
    let hen = 0;
    // Chỉ áp dụng cho khung điện thoại (cố định); máy tính cuộn trang bình thường — không kéo về đầu trang sau mỗi lần sửa
    const dienThoai = () => window.matchMedia('(max-width: 1023.98px)').matches;
    const veDau = () => { window.clearTimeout(hen); hen = window.setTimeout(() => { if (dienThoai() && !laO(document.activeElement) && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0); }, 80); };
    const vv = window.visualViewport;
    const doiKhung = () => { if (dienThoai() && vv && vv.height > window.innerHeight * 0.85) window.scrollTo(0, 0); };
    document.addEventListener('focusout', veDau);
    vv?.addEventListener('resize', doiKhung);
    return () => { window.clearTimeout(hen); document.removeEventListener('focusout', veDau); vv?.removeEventListener('resize', doiKhung); };
  }, []);
  const [moThem, setMoThem] = useState(false);
  // Thanh menu bên (máy tính): thu gọn còn biểu tượng để rộng chỗ cho trang thao tác; nhớ theo máy
  const [gon, setGonS] = useState(() => { try { return localStorage.getItem('bcd57-menu-gon') === '1'; } catch { return false; } });
  const setGon = (v: boolean) => { setGonS(v); try { localStorage.setItem('bcd57-menu-gon', v ? '1' : '0'); } catch { /* bỏ qua */ } };
  const [moLienHe, setMoLienHe] = useState(false);
  const thieuSdt = useThieuSdt();
  const nav = useNavigate();
  // Số trên menu: bài chờ tiếp nhận (kỳ mình giao), việc mình còn phải nộp
  const [dem, setDem] = useState<{ cho: number; nop: number }>({ cho: 0, nop: 0 });
  useEffect(() => {
    if (!hoSo) return;
    const dauMoi = hoSo.vai_tro === 'don_vi' && laDauMoi(hoSo);
    const giao = hoSo.vai_tro !== 'don_vi' || dauMoi;
    void (async () => {
      const [a, b] = await Promise.all([
        giao ? (dauMoi ? supabase.from('v_tinh_hinh_nop').select('da_nop, da_duyet').eq('trang_thai_ky', 'mo').eq('cap', 'don_vi').eq('chu_tri_don_vi_id', hoSo.don_vi_id!)
          : supabase.from('v_tinh_hinh_nop').select('da_nop, da_duyet').eq('trang_thai_ky', 'mo').eq('cap', 'don_vi')) : Promise.resolve({ data: [] }),
        hoSo.don_vi_id && hoSo.vai_tro !== 'lanh_dao' ? supabase.from('v_viec_can_nop').select('nop_id').eq('don_vi_id', hoSo.don_vi_id) : Promise.resolve({ data: [] }),
      ]);
      const cho = ((a.data ?? []) as { da_nop: number; da_duyet: number }[]).reduce((n, k) => n + k.da_nop - k.da_duyet, 0);
      setDem({ cho, nop: (b.data ?? []).length });
    })();
  }, [hoSo, location.pathname]);
  useEffect(() => {
    if (!hoSo) return;
    void dongBoDay();
    const f = (e: MessageEvent) => { if (e.data?.loai === 'mo_duong_dan') nav(e.data.duong_dan); if (e.data?.loai === 'dang_ky_lai') void dongBoDay(); };
    navigator.serviceWorker?.addEventListener('message', f);
    return () => navigator.serviceWorker?.removeEventListener('message', f);
  }, [hoSo, nav]);
  if (!hoSo) return null;
  const ds = menu(hoSo).map((m) => ({ ...m, dem: m.den === '/ky-bao-cao' ? dem.cho : m.den === '/viec-can-nop' ? dem.nop : undefined }));
  const nhom = [...new Set(ds.map((m) => m.nhom ?? 'ĐƠN VỊ'))];
  const chuTat = hoSo.ho_ten.split(' ').slice(-2).map((x) => x[0]).join('').toUpperCase();

  const Link = ({ m, gon = false }: { m: Muc; gon?: boolean }) => (
    <NavLink to={m.den} end={m.den === '/'} title={menuGon && !gon ? m.ten : undefined} aria-label={menuGon && !gon ? m.ten : undefined}
      className={({ isActive }) => gon
        ? cx('flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[10.5px] transition-colors active:scale-95', isActive ? 'font-semibold text-do' : 'text-mo')
        : cx('relative flex h-11 items-center rounded-[10px] text-[0.875rem] transition-colors duration-200', menuGon ? 'justify-center' : 'gap-2.5 px-2.5', isActive ? 'bg-white/12 font-semibold text-white shadow-[inset_3px_0_0_#F5C518]' : 'text-[#F6E3E0] hover:bg-white/5')}>
      {m.icon}{!(menuGon && !gon) && <span className={gon ? 'line-clamp-2 max-w-full text-center leading-[1.15]' : 'min-w-0 flex-1 truncate'}>{gon ? m.ngan ?? m.ten : m.ten}</span>}
      {!gon && !!m.dem && (menuGon
        ? <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-do px-1 text-center text-[10px] font-bold leading-4 text-white">{m.dem}</span>
        : <span className="shrink-0 rounded-full bg-do px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{m.dem}</span>)}
    </NavLink>
  );
  const menuGon = gon;
  const chinh = ds.length > 4 ? ds.slice(0, 3) : ds;
  const them = ds.length > 4 ? ds.slice(3) : [];

  return (
    // Điện thoại: khung cố định cao đúng màn hình (thanh trên – vùng cuộn – thanh dưới), thanh dưới không trôi khi cuộn trên iPhone
    <div className="flex min-h-screen max-lg:fixed max-lg:inset-0 max-lg:min-h-0 max-lg:overflow-hidden">
      <nav aria-label="Điều hướng chính" className={cx('sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#7C1419] via-ink to-ink-3 py-6 text-[#FFF4DA] transition-[width] duration-200 lg:flex', gon ? 'w-[76px] gap-5 px-3' : 'w-64 gap-7 px-4')}>
        {gon
          ? <div className="flex flex-col items-center gap-3"><LogoBcd className="h-10 w-10" />{location.pathname !== '/' && <Chuong moSangPhai toi />}</div>
          : <div className="flex items-center justify-between gap-2 px-2"><Logo />{location.pathname !== '/' && <Chuong moSangPhai toi />}</div>}
        {nhom.map((n, k) => (
          <div key={n} className="flex flex-col gap-1">
            {gon ? (k > 0 && <div className="mx-2 mb-1 border-t border-white/10" />) : <div className="px-3 pb-2 text-[11px] font-semibold tracking-[1px] text-[#E0A9A3]">{n}</div>}
            {ds.filter((m) => (m.nhom ?? 'ĐƠN VỊ') === n).map((m) => <Link key={m.den} m={m} />)}
          </div>
        ))}
        <div className="flex-1" />
        <button onClick={() => setGon(!gon)} title={gon ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'} aria-label={gon ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
          className={cx('flex h-10 items-center rounded-[10px] text-[0.8125rem] text-[#F0C9C4] transition-colors hover:bg-white/5 hover:text-white', gon ? 'justify-center' : 'gap-2.5 px-2.5')}>
          {gon ? <PanelLeftOpen className="h-5 w-5" strokeWidth={1.8} /> : <><PanelLeftClose className="h-5 w-5" strokeWidth={1.8} /><span>Thu gọn menu</span></>}
        </button>
        <button onClick={() => setMoLienHe(true)} aria-label="Tài khoản" title={gon ? hoSo.ho_ten : undefined} className={cx('flex w-full items-center rounded-xl py-2 text-left transition-colors hover:bg-white/5', gon ? 'justify-center' : 'gap-2.5 px-2')}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4DA] text-[0.8125rem] font-bold text-den">{chuTat}</span>
          {!gon && <>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-white">{hoSo.ho_ten}</span>
            <span className="line-clamp-2 text-[11.5px] leading-snug text-[#F0C9C4]">{hoSo.vai_tro === 'don_vi' ? hoSo.don_vi?.ten : VAI_TRO[hoSo.vai_tro]}</span>
          </span>
          <ChevronUp className="h-4 w-4 shrink-0 text-[#F0C9C4]" />
          </>}
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col max-lg:min-h-0">
        <div className="sticky top-0 z-30 shrink-0 flex items-center gap-2.5 border-b border-vien bg-nen/95 px-3.5 pb-2 pt-[max(8px,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <LogoBcd className="h-9 w-9" />
          <button onClick={() => setMoLienHe(true)} aria-label="Tài khoản" className="flex min-w-0 flex-1 items-center gap-1 text-left">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[11.5px] text-mo">{hoSo.vai_tro === 'don_vi' ? 'Tài khoản đơn vị' : VAI_TRO[hoSo.vai_tro]}</span>
              <span className="truncate text-[0.9375rem] font-bold">{hoSo.vai_tro === 'don_vi' ? hoSo.don_vi?.ten : hoSo.ho_ten}</span>
            </span>
            <ChevronDown className="mt-3 h-4 w-4 shrink-0 text-mo" />
          </button>
          <Chuong />
        </div>
        <div ref={vungCuon} className="flex flex-1 flex-col max-lg:min-h-0 max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain">
        <main className={cx('mx-auto flex w-full flex-1', location.pathname === '/nhiem-vu' ? 'max-w-none' : 'max-w-[1400px]', ' flex-col gap-4 px-3.5 pb-6 pt-3.5 sm:gap-5 sm:px-4 sm:pt-5 lg:px-8 lg:pb-10 lg:pt-6')}>
          <div key={location.pathname} className="hien-trang flex flex-col gap-3.5 sm:gap-5"><Outlet /></div>
        </main>
        </div>

      <nav aria-label="Thanh điều hướng" className="relative z-30 grid shrink-0 grid-cols-4 border-t border-vien bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {chinh.map((m) => <Link key={m.den} m={m} gon />)}
        {them.length > 0 && (
          <button onClick={() => setMoThem(true)} className={cx('flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px]', them.some((m) => m.den !== '/' && location.pathname.startsWith(m.den)) ? 'font-semibold text-do' : 'text-mo')}>
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} /><span>Thêm</span>
          </button>
        )}
      </nav>
      </div>
      {location.pathname === '/' && <GoiYUngDung />}
      {thieuSdt === true && <CongBatBuocSdt nguoiDungId={hoSo.id} ten={hoSo.ho_ten} dangXuat={() => void dangXuat()} />}
      <HopLienHe mo={moLienHe} dong={() => setMoLienHe(false)} nguoiDungId={hoSo.id} ten={hoSo.ho_ten} xong={() => window.dispatchEvent(new Event('bcd57-lien-he'))}
        dau={
          <div className="flex items-center gap-3 rounded-2xl bg-nen-2 p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-[0.875rem] font-bold text-white">{chuTat}</div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[0.9375rem] font-bold leading-snug">{hoSo.ho_ten}</span>
              <span className="text-[0.8125rem] leading-snug text-mo">{hoSo.vai_tro === 'don_vi' ? hoSo.don_vi?.ten : VAI_TRO[hoSo.vai_tro]}</span>
              {hoSo.email && <span className="break-all text-xs text-mo">{hoSo.email}</span>}
            </div>
          </div>
        }
        cuoi={<Nut kieu="nguy" className="w-full" icon={<LogOut className="h-4 w-4" />} onClick={() => { setMoLienHe(false); void dangXuat(); }}>Đăng xuất</Nut>} />
      {moThem && (
        <div className="mo-dan fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMoThem(false)}>
          <div role="dialog" aria-label="Mục khác" className="truot-len absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-3xl bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            {them.map((m) => (
              <NavLink key={m.den} to={m.den} onClick={() => setMoThem(false)}
                className={({ isActive }) => cx('flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem]', isActive ? 'bg-nen font-bold' : '')}>
                {m.icon}{m.ten}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
