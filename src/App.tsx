import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, laDauMoi, useAuth, type VaiTro } from './lib/auth';
import KhungTrang from './components/KhungTrang';
import { DangTai } from './components/ui';
import DangNhap from './pages/DangNhap';

const TongQuan = lazy(() => import('./pages/TongQuan'));
const KyBaoCao = lazy(() => import('./pages/KyBaoCao'));
const KyBaoCaoChiTiet = lazy(() => import('./pages/KyBaoCaoChiTiet'));
const TrangChuDonVi = lazy(() => import('./pages/TrangChuDonVi'));
const ViecCanNop = lazy(() => import('./pages/ViecCanNop'));
const NopBaoCao = lazy(() => import('./pages/NopBaoCao'));
const QuanTri = lazy(() => import('./pages/QuanTri'));
const NhiemVuChiTiet = lazy(() => import('./pages/NhiemVuChiTiet'));
const DanhMucNhiemVu = lazy(() => import('./pages/DanhMucNhiemVu'));
const KhoVanBan = lazy(() => import('./pages/KhoVanBan'));
const SoanBaoCaoChung = lazy(() => import('./pages/SoanBaoCaoChung'));
const SoCongVan = lazy(() => import('./pages/SoCongVan'));
const BaoCaoTuan = lazy(() => import('./pages/BaoCaoTuan'));
const VanBanDenDi = lazy(() => import('./pages/VanBanDenDi'));
const CaiDatTrang = lazy(() => import('./pages/QuanTri').then((m) => ({ default: m.CaiDatTrang })));

function Chan({ cho, hoac = false, children }: { cho: VaiTro[]; hoac?: boolean; children: ReactNode }) {
  const { hoSo } = useAuth();
  if (!hoSo || !(cho.includes(hoSo.vai_tro) || hoac)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CacTrang() {
  const { hoSo, dangTai, khoiPhuc } = useAuth();
  if (dangTai) return <DangTai chu="Đang kiểm tra đăng nhập…" />;
  if (!hoSo || khoiPhuc || hoSo.doi_mat_khau) return <DangNhap />;
  const cqtt: VaiTro[] = ['admin', 'quan_tri', 'lanh_dao'];
  return (
    <Suspense fallback={<DangTai />}>
      <Routes>
        <Route element={<KhungTrang />}>
          <Route index element={hoSo.vai_tro === 'don_vi' ? <TrangChuDonVi /> : <TongQuan />} />
          <Route path="ky-bao-cao" element={<Chan cho={cqtt} hoac={laDauMoi(hoSo)}><KyBaoCao /></Chan>} />
          <Route path="ky-bao-cao/:id" element={<Chan cho={cqtt} hoac={laDauMoi(hoSo)}><KyBaoCaoChiTiet /></Chan>} />
          <Route path="ky-bao-cao/:id/bao-cao-chung" element={<Chan cho={cqtt}><SoanBaoCaoChung /></Chan>} />
          <Route path="theo-doi" element={<Chan cho={[]} hoac={laDauMoi(hoSo)}><TongQuan chuTri={hoSo.don_vi_id} /></Chan>} />
          <Route path="viec-can-nop" element={<ViecCanNop />} />
          <Route path="viec-can-nop/:id" element={<NopBaoCao />} />
          <Route path="nhiem-vu" element={<DanhMucNhiemVu />} />
          <Route path="nhiem-vu/danh-muc" element={<Navigate to="/nhiem-vu" replace />} />
          <Route path="nhiem-vu/:id" element={<NhiemVuChiTiet />} />
          <Route path="kho-van-ban" element={<KhoVanBan />} />
          <Route path="so-cong-van" element={<SoCongVan />} />
          <Route path="bao-cao-tuan" element={<BaoCaoTuan />} />
          <Route path="van-ban" element={<Chan cho={['admin', 'quan_tri', 'don_vi']}><VanBanDenDi /></Chan>} />
          <Route path="quan-tri" element={<Chan cho={['admin']}><QuanTri /></Chan>} />
          <Route path="cai-dat" element={<Chan cho={['admin', 'quan_tri']}><CaiDatTrang /></Chan>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CacTrang />
      </BrowserRouter>
    </AuthProvider>
  );
}
