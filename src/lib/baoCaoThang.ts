// Báo cáo tháng gửi tỉnh (mẫu XA003, 19 bảng / 7 phụ lục): cấu trúc bảng, tính tự động, kiểm tra, lưu trữ.
// Số liệu từng ô lưu ở bảng bao_cao_thang (ghi qua hàm luu_bao_cao_thang); phân công + khoá kỳ lưu ở cau_hinh khoá 'bao_cao_thang'.
import { supabase } from './supabase';

export const KHOA_BCTH = 'bao_cao_thang';

export type KieuO = 'so' | 'chu' | 'ngay' | 'chon';
export type CotB = {
  k: string; nhan: string; kieu: KieuO; rong?: number;
  bb?: boolean;                  // bắt buộc nhập khi bảng "Cần báo cáo"
  chon?: string[];               // danh sách chọn (kieu 'chon')
  tuTinh?: (c: Ngu) => string | null;   // giá trị gợi ý tự tính (hiện xám, nhập tay thì lấy giá trị nhập)
  chiDoc?: boolean;              // luôn tự tính, không nhập
};
export type DongB = { k: string; nhan: string; dvt?: string; tuy?: boolean; tong?: boolean; quy?: boolean };
export type BangB = {
  id: string; ten: string; pl: number; ghiChu?: string; cotNhan: string; dvt?: boolean;
  cot: CotB[]; dong?: DongB[]; dongDong?: string;   // dong: dòng cố định; dongDong: bảng dòng động (nhãn "Thêm …")
  quy?: boolean;                 // chỉ bắt buộc tháng 3, 6, 9, 12
};
export type Ngu = { dong: string; lay: (dong: string, cot: string) => number | null; truoc: (dong: string, cot: string) => number | null };

export const PHU_LUC: { so: number; ten: string }[] = [
  { so: 1, ten: 'Kết quả thực hiện nhiệm vụ, thể chế, phản ánh kiến nghị' },
  { so: 2, ten: 'Chỉ tiêu dịch vụ công trực tuyến và Đề án 06' },
  { so: 3, ten: 'Dữ liệu chuyên ngành, hạ tầng, an toàn thông tin' },
  { so: 4, ten: 'Bài toán lớn và nhiệm vụ KHCN, ĐMST' },
  { so: 5, ten: 'Dự toán, giải ngân và dự án đang vướng' },
  { so: 6, ten: 'Kết quả cấp xã theo chỉ tiêu then chốt' },
  { so: 7, ten: 'Sổ theo dõi điểm nghẽn, kiến nghị, đối chiếu cam kết' },
];

const D = (k: string, nhan: string, o: Partial<DongB> = {}): DongB => ({ k, nhan, ...o });
const so = (k: string, nhan: string, o: Partial<CotB> = {}): CotB => ({ k, nhan, kieu: 'so', ...o });
const chu = (k: string, nhan: string, o: Partial<CotB> = {}): CotB => ({ k, nhan, kieu: 'chu', ...o });
const lamTron = (x: number) => Math.round(x * 1000) / 1000;
const hieu = (a: number | null, b: number | null) => (a == null || b == null ? null : hienSo(lamTron(a - b)));

export const BANG: BangB[] = [
  { id: '1.1', ten: 'Số lượng nhiệm vụ', pl: 1, cotNhan: 'Nội dung', ghiChu: 'Chỉ ghi số lượng nhiệm vụ được giao chủ trì. Mỗi nhiệm vụ chỉ tính ở một cột.',
    cot: [so('tw', 'Nhiệm vụ Trung ương giao'), so('tinh', 'Nhiệm vụ BCĐ, UBND tỉnh giao'), so('xa', 'Nhiệm vụ giao cấp xã', { bb: true }),
      so('tong', 'Tổng số', { chiDoc: true, tuTinh: (c) => { const t = ['tw', 'tinh', 'xa'].map((k) => c.lay(c.dong, k)); return t.every((x) => x == null) ? null : hienSo(lamTron(t.reduce<number>((a, x) => a + (x ?? 0), 0))); } })],
    dong: [D('d1', '1. Tổng số nhiệm vụ có thời hạn đang theo dõi'), D('d2', '2. Số nhiệm vụ đến hạn trong tháng'), D('d3', '3. Số nhiệm vụ hoàn thành trong tháng'),
      D('d3a', '3a. Trong đó: hoàn thành đúng hạn'), D('d4', '4. Số nhiệm vụ quá hạn chưa hoàn thành'), D('d4a', '4a. Trong đó: tồn từ các tháng trước'),
      D('d5', '5. Số nhiệm vụ đề nghị điều chỉnh thời hạn hoặc dừng thực hiện'), D('d6', '6. Số nhiệm vụ thường xuyên (báo riêng, không tính vào dòng 1)')] },
  { id: '1.2', ten: 'Danh sách nhiệm vụ hoàn thành hoặc quá hạn trong tháng', pl: 1, cotNhan: 'STT', dongDong: 'nhiệm vụ',
    ghiChu: 'Chỉ ghi nhiệm vụ hoàn thành hoặc quá hạn trong tháng; không ghi "đang hoàn thiện", "cơ bản xong".',
    cot: [chu('ten', 'Tên nhiệm vụ', { rong: 3, bb: true }), { k: 'nhom', nhan: 'Nhóm', kieu: 'chon', chon: ['Trung ương', 'Tỉnh', 'Xã'], bb: true }, chu('vb', 'Văn bản giao (số, ngày)', { rong: 2 }),
      chu('han', 'Thời hạn'), { k: 'kq', nhan: 'Kết quả', kieu: 'chon', chon: ['Xong đúng hạn', 'Xong quá hạn', 'Quá hạn'], bb: true }, chu('sp', 'Sản phẩm cụ thể đã có', { rong: 2 }),
      chu('mc', 'Văn bản, biên bản chứng minh (số, ngày)', { rong: 2 }), chu('lydo', 'Lý do quá hạn và thời hạn mới đề xuất', { rong: 2 })] },
  { id: '1.3', ten: 'Văn bản thể chế thuộc thẩm quyền của tỉnh', pl: 1, cotNhan: 'Nội dung', ghiChu: 'Dòng 5 ghi rõ văn bản Trung ương đang chờ (số hiệu, điều, khoản) và chờ từ tháng nào.',
    cot: [so('so', 'Số văn bản', { bb: true }), chu('ten', 'Tên văn bản (đối với dòng 2, 4, 5)', { rong: 3 })],
    dong: [D('d1', '1. Số văn bản phải ban hành trong năm theo kế hoạch'), D('d2', '2. Số văn bản ban hành trong tháng'), D('d3', '3. Số văn bản đã ban hành lũy kế từ đầu năm'),
      D('d4', '4. Số văn bản chậm so với kế hoạch'), D('d5', '5. Số văn bản chưa ban hành được do chờ Trung ương hướng dẫn')] },
  { id: '1.4', ten: 'Tiếp nhận, xử lý phản ánh, kiến nghị', pl: 1, cotNhan: 'Kênh tiếp nhận', ghiChu: 'Không phát sinh ghi 0. Cột (4) không lớn hơn cột (3). Có phản ánh thì nêu vấn đề lặp lại nhiều nhất hoặc ghi "Không có vấn đề lặp lại".',
    cot: [so('tn', 'Tiếp nhận trong tháng', { bb: true }), so('tl', 'Đã trả lời', { bb: true }), so('dh', 'Trong đó: trả lời đúng hạn', { bb: true }), so('qh', 'Quá hạn chưa trả lời', { bb: true }), chu('lap', 'Vấn đề phản ánh lặp lại nhiều nhất', { rong: 2 })],
    dong: [D('d1', '1. Hệ thống pakn.nq57.vn'), D('d2', '2. Kênh của tỉnh (ghi tên ứng dụng, cổng)'),
      D('t', 'Tổng cộng', { tong: true })] },
  { id: '2.1', ten: 'Thủ tục hành chính và dịch vụ công trực tuyến', pl: 2, cotNhan: 'Nội dung', dvt: true, ghiChu: 'Ghi số lượng, không ghi tỷ lệ. Hệ thống không trích xuất được thì ghi "chưa có số liệu" và nêu lý do ở cột cuối.',
    cot: [so('xa', 'Cấp xã', { bb: true }), so('truoc', 'Tháng trước', { chiDoc: true, tuTinh: (c) => hieu(c.truoc(c.dong, 'xa'), 0) }), chu('ht', 'Hệ thống trích xuất, ngày trích xuất', { rong: 2 })],
    dong: [D('d1', '1. Tổng số thủ tục hành chính thuộc thẩm quyền', { dvt: 'Thủ tục' }), D('d2', '2. Số thủ tục cung cấp dịch vụ công trực tuyến toàn trình', { dvt: 'Thủ tục' }),
      D('d2a', '2a. Trong đó: số thủ tục đủ điều kiện cung cấp toàn trình', { dvt: 'Thủ tục' }), D('d3', '3. Số hồ sơ tiếp nhận trong tháng', { dvt: 'Hồ sơ' }),
      D('d4', '4. Trong đó: số hồ sơ nộp trực tuyến', { dvt: 'Hồ sơ' }), D('d5', '5. Số hồ sơ đã giải quyết trong tháng', { dvt: 'Hồ sơ' }),
      D('d6', '6. Trong đó: số hồ sơ giải quyết đúng hạn', { dvt: 'Hồ sơ' }), D('d7', '7. Số hồ sơ có kết quả điện tử', { dvt: 'Hồ sơ' })] },
  { id: '2.2', ten: 'Kết quả triển khai Đề án 06', pl: 2, cotNhan: 'Nội dung', dvt: true, ghiChu: 'Dòng 3: cột "Đã đạt lũy kế" ghi số đã làm sạch; ghi thêm số còn tồn ở cột cuối. "Đạt trong tháng" tự tính = lũy kế kỳ này trừ lũy kế kỳ trước (nhập tay thì lấy số nhập).',
    cot: [so('ph', 'Số phải thực hiện', { bb: true }), so('lk', 'Đã đạt lũy kế', { bb: true }),
      so('th', 'Đạt trong tháng', { bb: true, tuTinh: (c) => hieu(c.lay(c.dong, 'lk'), c.truoc(c.dong, 'lk')) }), chu('ht', 'Hệ thống trích xuất, ngày trích xuất / ghi chú', { rong: 2 })],
    dong: [D('d1', '1. Hồ sơ định danh điện tử mức 2 đã thu nhận', { dvt: 'Hồ sơ' }), D('d2', '2. Tài khoản định danh điện tử mức 2 đã kích hoạt', { dvt: 'Tài khoản' }),
      D('d3', '3. Trường hợp dữ liệu dân cư cần làm sạch', { dvt: 'Trường hợp' }), D('d4', '4. Chi trả không dùng tiền mặt: người có công và thân nhân', { dvt: 'Người' }),
      D('d5', '5. Chi trả không dùng tiền mặt: đối tượng bảo trợ xã hội, hưu trí xã hội', { dvt: 'Người' }), D('d6', '6. Chi trả không dùng tiền mặt: lương hưu, trợ cấp BHXH', { dvt: 'Người' }),
      D('d7', '7. Tiện ích của Đề án 06 được giao chỉ tiêu (ghi tên tiện ích)', { dvt: 'Tiện ích', tuy: true })] },
  { id: '3.1', ten: 'Cơ sở dữ liệu chuyên ngành do tỉnh quản lý', pl: 3, cotNhan: 'Cơ sở dữ liệu', dvt: true, ghiChu: 'Chỉ nhập phần thuộc địa bàn phường. "Thực hiện trong tháng" tự tính từ lũy kế nếu để trống.',
    cot: [so('kl', 'Khối lượng phải thực hiện', { bb: true }), so('lk', 'Đã đạt "đúng, đủ, sạch, sống" lũy kế', { bb: true }),
      so('th', 'Thực hiện trong tháng', { tuTinh: (c) => hieu(c.lay(c.dong, 'lk'), c.truoc(c.dong, 'lk')) }),
      { k: 'kn', nhan: 'Đã kết nối CSDL quốc gia', kieu: 'chon', chon: ['Có', 'Không'] }, chu('cq', 'Cơ quan cung cấp số liệu', { rong: 2 })],
    dong: [D('d1', '1. Đất đai', { dvt: 'Thửa' }), D('d2', '2. Hộ tịch: khai sinh', { dvt: 'Bản ghi' }), D('d3', '3. Hộ tịch: kết hôn', { dvt: 'Bản ghi' }),
      D('d4', '4. Bảo trợ xã hội', { dvt: 'Đối tượng' }), D('d5', '5. Cơ sở dữ liệu khác (ghi tên)', { dvt: '', tuy: true })] },
  { id: '3.2', ten: 'Điều kiện hạ tầng tối thiểu', pl: 3, cotNhan: 'Nội dung', quy: true, ghiChu: 'Báo cáo định kỳ theo quý (tháng 3, 6, 9, 12). "Số còn lại cuối tháng" tự tính = đầu tháng trừ đã xử lý.',
    cot: [so('dau', 'Số còn lại đầu tháng', { bb: true }), so('xl', 'Đã xử lý trong tháng', { bb: true }),
      so('cuoi', 'Số còn lại cuối tháng', { bb: true, tuTinh: (c) => hieu(c.lay(c.dong, 'dau'), c.lay(c.dong, 'xl')) }), chu('xa', 'Tên xã còn lại', { rong: 2 })],
    dong: [D('d1', '1. Số thôn chưa có sóng di động'), D('d2', '2. Số thôn chưa có điện lưới'), D('d3', '3. Số xã chưa bảo đảm trang thiết bị tối thiểu'), D('d4', '4. Số xã chưa kết nối mạng truyền số liệu chuyên dùng')] },
  { id: '3.3', ten: 'Hệ thống dùng chung và an toàn thông tin', pl: 3, cotNhan: 'Nội dung', ghiChu: 'Ghi 0 nếu không phát sinh.',
    cot: [so('sl', 'Số lượng', { bb: true }), chu('gc', 'Ghi chú (tên hệ thống, nguyên nhân, kết quả xử lý)', { rong: 3 })],
    dong: [D('d1', '1. Số hệ thống thông tin đang vận hành'), D('d2', '2. Trong đó: số hệ thống đã được phê duyệt hồ sơ cấp độ'), D('d3', '3. Số sự cố an toàn thông tin trong tháng'),
      D('d3a', '3a. Trong đó: số sự cố đã xử lý xong'), D('d4', '4. Số điểm yếu nghiêm trọng chưa khắc phục'),
      D('d5', '5. Số lần gián đoạn của hệ thống dùng chung'), D('d5a', '5a. Tổng số giờ gián đoạn')] },
  { id: '4.1', ten: 'Kết quả trong tháng của từng bài toán lớn', pl: 4, cotNhan: 'STT', dongDong: 'bài toán', ghiChu: 'Bài toán mới ở bước ban hành kế hoạch ghi "chưa có sản phẩm".',
    cot: [chu('ten', 'Tên bài toán', { rong: 2, bb: true }), chu('cq', 'Cơ quan chủ trì'), chu('tg', 'Viện, trường, doanh nghiệp tham gia'), chu('moc', 'Mốc phải đạt trong tháng'),
      chu('kq', 'Kết quả thực tế (Đạt / Chưa đạt; sản phẩm)', { rong: 2 }), chu('noi', 'Nơi thử nghiệm, đối tượng thụ hưởng'), so('kp', 'Kinh phí đã chi lũy kế (tỷ đồng)'), chu('vm', 'Vướng mắc')] },
  { id: '4.2', ten: 'Nhiệm vụ khoa học và công nghệ cấp tỉnh', pl: 4, cotNhan: 'Nội dung', dvt: true, ghiChu: 'Doanh nghiệp tham gia thực tế là có hợp đồng, góp vốn, thử nghiệm hoặc mua sản phẩm; ký biên bản ghi nhớ không tính. Vốn chỉ tính tiền đã nhận.',
    cot: [so('th', 'Trong tháng'), so('lk', 'Lũy kế từ đầu năm'), chu('cc', 'Căn cứ số liệu', { rong: 2 })],
    dong: [D('d1', '1. Số nhiệm vụ đang thực hiện', { dvt: 'Nhiệm vụ' }), D('d2', '2. Số nhiệm vụ nghiệm thu', { dvt: 'Nhiệm vụ' }), D('d3', '3. Số nhiệm vụ có kết quả được chuyển giao, ứng dụng', { dvt: 'Nhiệm vụ' }),
      D('d4', '4. Số nhiệm vụ có doanh nghiệp tham gia thực tế', { dvt: 'Nhiệm vụ' }), D('d5', '5. Vốn ngoài ngân sách đã nhận cho nhiệm vụ', { dvt: 'Tỷ đồng' }),
      D('d6', '6. Số hợp đồng chuyển giao, thương mại hóa kết quả đã ký', { dvt: 'Hợp đồng' }), D('d7', '7. Giá trị hợp đồng tại dòng 6', { dvt: 'Tỷ đồng' })] },
  { id: '4.3', ten: 'Tổ chức hỗ trợ đổi mới sáng tạo của tỉnh', pl: 4, cotNhan: 'Tổ chức',
    cot: [{ k: 'tt', nhan: 'Trạng thái', kieu: 'chon', chon: ['Đang hoạt động', 'Đang chuẩn bị', 'Đang chuyển đổi', 'Chưa có'] }, chu('kq', 'Kết quả trong tháng (số giao dịch, số dự án hỗ trợ, kinh phí)', { rong: 2 }), chu('vm', 'Vướng mắc', { rong: 2 })],
    dong: [D('d1', '1. Trung tâm đổi mới sáng tạo'), D('d2', '2. Sàn giao dịch công nghệ'), D('d3', '3. Quỹ phát triển khoa học, công nghệ và đổi mới sáng tạo'), D('d4', '4. Vườn ươm, không gian sáng tạo')] },
  { id: '5.1', ten: 'Dự toán và giải ngân (đơn vị: tỷ đồng)', pl: 5, cotNhan: 'Nội dung', ghiChu: 'Đơn vị tính TỶ ĐỒNG (không nhập triệu đồng). Khi dự toán thay đổi, ghi ở cột ghi chú tổng chi cân đối ngân sách địa phương và lý do.',
    cot: [so('dt', 'Dự toán, kế hoạch vốn được giao', { bb: true }), so('pb', 'Đã phân bổ chi tiết', { bb: true }),
      so('cpb', 'Chưa phân bổ', { chiDoc: true, tuTinh: (c) => hieu(c.lay(c.dong, 'dt'), c.lay(c.dong, 'pb')) }), so('gt', 'Giải ngân trong tháng', { bb: true }), so('gl', 'Giải ngân lũy kế từ đầu năm', { bb: true }), chu('gc', 'Ghi chú', { rong: 2 })],
    dong: [D('d1', '1. Chi thường xuyên'), D('d2', '2. Chi đầu tư'), D('t', 'Tổng cộng', { tong: true })] },
  { id: '5.2', ten: 'Dự án chưa được phân bổ vốn hoặc giải ngân chậm', pl: 5, cotNhan: 'STT', dongDong: 'dự án',
    cot: [chu('ten', 'Tên dự án', { rong: 2, bb: true }), chu('cdt', 'Chủ đầu tư'), so('tm', 'Tổng mức đầu tư (tỷ đồng)'), so('von', 'Vốn giao năm (tỷ đồng)'), so('gn', 'Đã giải ngân (tỷ đồng)'),
      { k: 'buoc', nhan: 'Bước đang dừng', kieu: 'chon', chon: ['Chủ trương', 'Thẩm định', 'Phê duyệt', 'Lựa chọn nhà thầu', 'Thanh toán'] }, chu('cq', 'Cơ quan đang xử lý hồ sơ'), so('ngay', 'Số ngày ở bước hiện tại'), chu('dx', 'Đề xuất xử lý', { rong: 2 })] },
  { id: '6.1', ten: 'Xã, phường, đặc khu chưa có kết quả theo các chỉ tiêu then chốt', pl: 6, cotNhan: 'Chỉ tiêu', ghiChu: 'Nhập 0 hoặc 1. Phường thuộc diện nào thì nhập 1 và ghi tên phường ở cột "Tên xã chưa có kết quả"; không thuộc diện thì nhập 0. Dòng 4 báo cáo theo quý.',
    cot: [so('v', 'Số xã chưa có kết quả (0 / 1)', { bb: true }), chu('ten', 'Tên xã chưa có kết quả', { rong: 2 }), chu('bp', 'Biện pháp trong tháng và kết quả', { rong: 3 })],
    dong: [D('d1', '1. Xã chưa phát sinh hồ sơ nộp trực tuyến'), D('d2', '2. Xã chưa có hồ sơ cấp kết quả điện tử'), D('d3', '3. Xã chưa thực hiện chi trả an sinh xã hội không dùng tiền mặt'),
      D('d4', '4. Xã chưa bảo đảm sóng, điện, trang thiết bị tối thiểu (theo quý)', { quy: true })] },
  { id: '6.2', ten: 'Nhân lực chuyển đổi số', pl: 6, cotNhan: 'Cấp', quy: true, ghiChu: 'Báo cáo theo quý. "Còn thiếu" tự tính = biên chế được giao trừ đã bố trí.',
    cot: [so('bc', 'Biên chế được giao', { bb: true }), so('db', 'Đã bố trí', { bb: true }), so('th', 'Còn thiếu', { bb: true, tuTinh: (c) => hieu(c.lay(c.dong, 'bc'), c.lay(c.dong, 'db')) }),
      so('tuyen', 'Dự kiến tuyển dụng trong quý tới'), chu('lydo', 'Lý do chưa bố trí đủ', { rong: 2 })],
    dong: [D('d1', '1. Cấp tỉnh', { tuy: true }), D('d2', '2. Cấp xã'), D('t', 'Tổng cộng', { tong: true })] },
  { id: '7.1', ten: 'Điểm nghẽn', pl: 7, cotNhan: 'STT', dongDong: 'điểm nghẽn', ghiChu: 'Ghi cả điểm nghẽn đã báo các tháng trước nhưng chưa xong. Chỉ ghi "Đã xong" khi có văn bản, quyết định hoặc kết quả đã giải quyết.',
    cot: [chu('dn', 'Điểm nghẽn (nêu cụ thể quy định, hệ thống hoặc địa bàn đang vướng)', { rong: 4, bb: true }), { k: 'tq', nhan: 'Thẩm quyền xử lý', kieu: 'chon', chon: ['Tỉnh', 'Trung ương'], bb: true }, { k: 'tu', nhan: 'Phát sinh từ tháng', kieu: 'ngay' },
      so('tt', 'Số tháng tồn đọng'), chu('viec', 'Việc đã làm trong tháng', { rong: 3 }), { k: 'kq', nhan: 'Kết quả', kieu: 'chon', chon: ['Đã xong', 'Đang chờ', 'Quá hạn'], bb: true }] },
  { id: '7.2', ten: 'Kiến nghị với Trung ương', pl: 7, cotNhan: 'STT', dongDong: 'kiến nghị', ghiChu: 'Chỉ ghi kiến nghị mới hoặc chưa được giải quyết; không ghi kiến nghị chung không gắn với địa phương.',
    cot: [chu('nd', 'Nội dung kiến nghị', { rong: 3, bb: true }), chu('cq', 'Cơ quan có thẩm quyền', { rong: 2 }), chu('sp', 'Sản phẩm mong muốn', { rong: 2 }), chu('han', 'Thời hạn đề nghị'),
      chu('vb', 'Văn bản đã gửi (số, ngày)', { rong: 2 }), { k: 'tt', nhan: 'Tình trạng', kieu: 'chon', chon: ['Đã trả lời', 'Chưa trả lời'] }, so('ton', 'Số tháng tồn đọng')] },
  { id: '7.3', ten: 'Đối chiếu mục tiêu đề ra trong tháng trước', pl: 7, cotNhan: 'STT', dongDong: 'cam kết',
    cot: [chu('ck', 'Cam kết tại báo cáo tháng trước', { rong: 3, bb: true }), { k: 'kq', nhan: 'Kết quả', kieu: 'chon', chon: ['Đạt', 'Chưa đạt'], bb: true }, chu('sp', 'Sản phẩm, số liệu đạt được', { rong: 3 }), chu('lydo', 'Lý do chưa đạt và thời hạn mới', { rong: 2 })] },
];

export const TT_BANG = [
  { v: 'can', nhan: 'Cần báo cáo' },
  { v: 'khong_ap_dung', nhan: 'Không áp dụng' },
  { v: 'khong_phat_sinh', nhan: 'Không phát sinh' },
] as const;
export type TtBang = (typeof TT_BANG)[number]['v'];

// ---------- Cấu hình (phân công bảng -> đơn vị, ngày chốt / gửi, khoá kỳ)
export type CauHinhBCTh = { chot: number; gui: number; khoa: string[]; mo_lai: string[]; phan_cong: Record<string, string[]> };
export const CH_MAC_DINH: CauHinhBCTh = { chot: 25, gui: 27, khoa: [], mo_lai: [], phan_cong: {} };
export async function taiCauHinh(): Promise<CauHinhBCTh> {
  const { data } = await supabase.from('cau_hinh').select('gia_tri').eq('khoa', KHOA_BCTH).maybeSingle();
  return { ...CH_MAC_DINH, ...((data as { gia_tri?: Partial<CauHinhBCTh> } | null)?.gia_tri ?? {}) };
}
export async function luuCauHinh(c: CauHinhBCTh): Promise<string | null> {
  const { error } = await supabase.from('cau_hinh').upsert({ khoa: KHOA_BCTH, gia_tri: c, mo_ta: 'Báo cáo tháng gửi tỉnh: phân công bảng, ngày chốt, khoá kỳ' });
  return error ? error.message : null;
}

// ---------- Dữ liệu ô
export type DuLieu = Record<string, string>;   // "bang|dong|cot" -> giá trị
export const khoaO = (b: string, d: string, c: string) => `${b}|${d}|${c}`;
export async function taiDuLieu(ky: string): Promise<DuLieu> {
  const { data, error } = await supabase.from('bao_cao_thang').select('bang, dong, cot, gia_tri').eq('ky', ky).limit(20000);
  if (error) throw new Error(error.message);
  const r: DuLieu = {};
  for (const x of (data ?? []) as { bang: string; dong: string; cot: string; gia_tri: string }[]) r[khoaO(x.bang, x.dong, x.cot)] = x.gia_tri;
  return r;
}
export async function luuO(ky: string, cac: { bang: string; dong: string; cot: string; gia_tri: string }[]): Promise<string | null> {
  const { error } = await supabase.rpc('luu_bao_cao_thang', { p_ky: ky, p_cac: cac });
  return error ? error.message : null;
}

// ---------- Số liệu: đọc / ghi kiểu Việt Nam
export function docSo(s: string | undefined | null): number | null {
  if (s == null) return null;
  let t = String(s).trim().replace(/\s+/g, '');
  if (!t || !/^[-+]?[\d.,]+$/.test(t)) return null;
  if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export const hienSo = (n: number | null): string => (n == null ? '' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(n));

export function kyTruoc(ky: string): string {
  const [y, m] = ky.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
export const tenKy = (ky: string) => { const [y, m] = ky.split('-'); return `tháng ${Number(m)}/${y}`; };
export const laThangQuy = (ky: string) => [3, 6, 9, 12].includes(Number(ky.split('-')[1]));
export function danhSachKy(homNay: string): string[] {
  const [y, m] = homNay.split('-').map(Number);
  const r: string[] = [];
  for (let i = -6; i <= 1; i++) { const t = y * 12 + (m - 1) + i; r.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`); }
  return r.reverse();
}
// Hạn: hết ngày "gửi" của tháng báo cáo (giờ VN)
export const hanGuiMs = (ky: string, gui: number) => new Date(`${ky}-${String(gui).padStart(2, '0')}T23:59:59+07:00`).getTime();

// ---------- Tính giá trị hiển thị của ô (nhập tay > tự tính)
export type TuanO = Record<string, { v: string; ten: string }>;   // số liệu tự lấy từ báo cáo tuần
export type Ctx = { cur: DuLieu; truoc: DuLieu; tuan?: TuanO };
export function dongDongSo(b: BangB, cur: DuLieu, them: number): number {
  let n = 0;
  const re = new RegExp(`^${b.id.replace('.', '\\.')}\\|r(\\d+)\\|`);
  for (const k of Object.keys(cur)) { const m = k.match(re); if (m && cur[k] !== '') n = Math.max(n, Number(m[1])); }
  return Math.max(n, them);
}
function ngu(b: BangB, ctx: Ctx, dong: string): Ngu {
  const gia = (d: DuLieu) => (dg: string, c: string) => {
    const t = tinhO(b, dg, b.cot.find((x) => x.k === c)!, ctx, d === ctx.truoc);
    return docSo(t.v);
  };
  return { dong, lay: gia(ctx.cur), truoc: gia(ctx.truoc) };
}
export function tinhO(b: BangB, dong: string, c: CotB, ctx: Ctx, laTruoc = false): { v: string; tuDong: boolean; nguon?: string } {
  const d = laTruoc ? ctx.truoc : ctx.cur;
  const tay = d[khoaO(b.id, dong, c.k)];
  const dg = b.dong?.find((x) => x.k === dong);
  if (dg?.tong) {   // dòng tổng cộng: cộng các dòng trên (cột số)
    if (c.kieu !== 'so') return { v: '', tuDong: false };
    const ks = (b.dong ?? []).filter((x) => !x.tong);
    const gt = ks.map((x) => docSo(tinhO(b, x.k, c, ctx, laTruoc).v));
    return gt.every((x) => x == null) ? { v: '', tuDong: true } : { v: hienSo(lamTron(gt.reduce<number>((a, x) => a + (x ?? 0), 0))), tuDong: true };
  }
  if (!laTruoc && !c.chiDoc && (tay == null || tay === '')) {   // có sẵn từ báo cáo tuần: tự điền, đơn vị không phải nhập lại
    const t = ctx.tuan?.[khoaO(b.id, dong, c.k)];
    if (t) return { v: t.v, tuDong: true, nguon: t.ten };
  }
  if (c.chiDoc || (tay == null || tay === '')) {
    if (c.tuTinh && !laTruoc) {
      const t = c.tuTinh({ ...ngu(b, ctx, dong) });
      if (t != null) return { v: c.kieu === 'so' ? hienSo(docSo(t)) : t, tuDong: true };
    } else if (c.tuTinh && laTruoc) {
      // kỳ trước: tính theo dữ liệu kỳ trước (không đệ quy sang kỳ trước nữa)
      const g = (dg2: string, ck: string) => docSo(d[khoaO(b.id, dg2, ck)]);
      const t = c.tuTinh({ dong, lay: g, truoc: () => null });
      if (t != null) return { v: c.kieu === 'so' ? hienSo(docSo(t)) : t, tuDong: true };
    }
  }
  return { v: tay ?? '', tuDong: false };
}

// ---------- Trạng thái bảng
export const ttBang = (cur: DuLieu, id: string): TtBang => ((cur[khoaO(id, '_tt', 'v')] as TtBang) || 'can');
export const giaiTrinh = (cur: DuLieu, id: string) => cur[khoaO(id, '_tt', 'gt')] ?? '';
export const batBuocKy = (b: BangB, ky: string) => !b.quy || laThangQuy(ky);

// ---------- Kiểm tra: ô thiếu / ô nghi sai
export type LoiO = { bang: string; dong: string; cot: string; loai: 'thieu' | 'sai'; msg: string };
export function kiemTraBang(b: BangB, ky: string, ctx: Ctx, soDong: number): LoiO[] {
  const loi: LoiO[] = [];
  if (ttBang(ctx.cur, b.id) !== 'can' || !batBuocKy(b, ky)) return loi;
  const lay = (dg: string, ck: string) => docSo(tinhO(b, dg, b.cot.find((x) => x.k === ck)!, ctx).v);
  if (b.dong) {
    for (const dg of b.dong) {
      if (dg.tong || dg.tuy || (dg.quy && !laThangQuy(ky))) continue;
      for (const c of b.cot) if (c.bb && tinhO(b, dg.k, c, ctx).v === '') loi.push({ bang: b.id, dong: dg.k, cot: c.k, loai: 'thieu', msg: `${dg.nhan} · ${c.nhan}` });
    }
    if (b.id === '1.4') for (const dg of ['d1', 'd2']) { const a = lay(dg, 'tl'), h = lay(dg, 'dh'); if (a != null && h != null && h > a) loi.push({ bang: b.id, dong: dg, cot: 'dh', loai: 'sai', msg: 'Số trả lời đúng hạn lớn hơn số đã trả lời' }); }
    if (b.id === '2.1') { const f = (a: string, bb: string, m: string) => { const x = lay(a, 'xa'), y = lay(bb, 'xa'); if (x != null && y != null && x > y) loi.push({ bang: b.id, dong: a, cot: 'xa', loai: 'sai', msg: m }); };
      f('d4', 'd3', 'Hồ sơ nộp trực tuyến lớn hơn hồ sơ tiếp nhận'); f('d6', 'd5', 'Hồ sơ đúng hạn lớn hơn hồ sơ đã giải quyết'); f('d2', 'd1', 'Thủ tục toàn trình lớn hơn tổng thủ tục'); }
    if (b.id === '2.2') for (const dg of b.dong) { const p = lay(dg.k, 'ph'), l = lay(dg.k, 'lk'); if (p != null && l != null && l > p && dg.k !== 'd3') loi.push({ bang: b.id, dong: dg.k, cot: 'lk', loai: 'sai', msg: 'Lũy kế lớn hơn số phải thực hiện' }); }
    if (b.id === '5.1') for (const dg of b.dong.filter((x) => !x.tong)) for (const ck of ['dt', 'pb', 'gt', 'gl']) { const v = lay(dg.k, ck); if (v != null && Math.abs(v) > 5000) loi.push({ bang: b.id, dong: dg.k, cot: ck, loai: 'sai', msg: 'Số quá lớn, nghi nhập triệu đồng (bảng tính bằng tỷ đồng)' }); }
    if (b.id === '6.1') for (const dg of b.dong) { const v = lay(dg.k, 'v'); if (v != null && v !== 0 && v !== 1) loi.push({ bang: b.id, dong: dg.k, cot: 'v', loai: 'sai', msg: 'Chỉ nhập 0 hoặc 1' });
      if (v === 1 && !(ctx.cur[khoaO(b.id, dg.k, 'ten')] ?? '').trim()) loi.push({ bang: b.id, dong: dg.k, cot: 'ten', loai: 'thieu', msg: `${dg.nhan} · cần ghi tên xã` }); }
  } else {
    if (soDong === 0 && !giaiTrinh(ctx.cur, b.id).trim()) loi.push({ bang: b.id, dong: 'r1', cot: b.cot[0].k, loai: 'thieu', msg: 'Chưa có dòng nào — nhập, hoặc chọn "Không phát sinh" và giải trình' });
    for (let i = 1; i <= soDong; i++) for (const c of b.cot) if (c.bb && tinhO(b, `r${i}`, c, ctx).v === '' && b.cot.some((x) => ctx.cur[khoaO(b.id, `r${i}`, x.k)])) loi.push({ bang: b.id, dong: `r${i}`, cot: c.k, loai: 'thieu', msg: `Dòng ${i} · ${c.nhan}` });
  }
  return loi;
}

// ---------- Tự điền từ báo cáo tuần: nhiệm vụ có "Kết quả: a/b" -> ô của bảng (a = đã đạt lũy kế, b = số phải thực hiện / khối lượng)
const khongDau = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const NGUON_TUAN: { tu: string[]; bang: string; dong: string[]; mau: string; dat: string }[] = [
  { tu: ['kich hoat tai khoan dinh danh dien tu vneid muc 2'], bang: '2.2', dong: ['d1', 'd2'], mau: 'ph', dat: 'lk' },
  { tu: ['chi tra nguoi co cong'], bang: '2.2', dong: ['d4'], mau: 'ph', dat: 'lk' },
  { tu: ['chi tra doi tuong bao tro xa hoi'], bang: '2.2', dong: ['d5'], mau: 'ph', dat: 'lk' },
  { tu: ['chi tra luong huu'], bang: '2.2', dong: ['d6'], mau: 'ph', dat: 'lk' },
  { tu: ['du lieu dat dai'], bang: '3.1', dong: ['d1'], mau: 'kl', dat: 'lk' },
];
export function nguonTuanBaoCao(nv: { id: string; ten: string }[], cn: { nhiem_vu_id: string; noi_dung: string }[]): TuanO {
  const kq: TuanO = {};
  const moiNhat = new Map<string, string>();   // cn xếp mới nhất trước
  for (const c of cn) {
    if (moiNhat.has(c.nhiem_vu_id)) continue;
    const m = c.noi_dung.match(/Kết quả: (?:hoàn thành )?([\d.,]+)\/([\d.,]+)/);
    if (m) moiNhat.set(c.nhiem_vu_id, `${m[1]}/${m[2]}`);
  }
  for (const r of NGUON_TUAN) {
    const n = nv.find((x) => moiNhat.has(x.id) && r.tu.some((k) => khongDau(x.ten).includes(k)));
    if (!n) continue;
    const [a, b] = moiNhat.get(n.id)!.split('/').map((x) => docSo(x.replace(/[.,]$/, '')));
    if (a == null || b == null) continue;
    for (const d of r.dong) { kq[khoaO(r.bang, d, r.dat)] = { v: hienSo(a), ten: n.ten }; kq[khoaO(r.bang, d, r.mau)] = { v: hienSo(b), ten: n.ten }; }
  }
  return kq;
}
