import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// CHẾ ĐỘ THỬ (chỉ dùng khi phát triển, không bật trên bản triển khai):
// VITE_CHE_DO_THU=1 và VITE_TAI_KHOAN_THU='{"Quản trị":"<jwt>","Tổ CSKV":"<jwt>"}'
// -> bỏ qua Supabase Auth, gọi thẳng PostgREST bằng JWT có sẵn.
export const CHE_DO_THU = import.meta.env.VITE_CHE_DO_THU === '1';

const url = import.meta.env.VITE_SUPABASE_URL || (CHE_DO_THU ? window.location.origin : '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'che-do-thu';

if (!url) {
  // Hiện lỗi rõ ràng thay vì màn hình trắng khi quên cấu hình
  throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong tệp .env');
}

const KHOA_THU = 'bcd57-tai-khoan-thu';

export function taiKhoanThu(): Record<string, string> {
  try { return JSON.parse(import.meta.env.VITE_TAI_KHOAN_THU || '{}'); } catch { return {}; }
}
let tokenBoNho: string | null = null;              // dự phòng khi trình duyệt chặn localStorage (khung nhúng)
export function tokenThu(): string | null {
  try { return localStorage.getItem(KHOA_THU) ?? tokenBoNho; } catch { return tokenBoNho; }
}
export function datTokenThu(t: string | null) {
  tokenBoNho = t;
  try { if (t) localStorage.setItem(KHOA_THU, t); else localStorage.removeItem(KHOA_THU); } catch { /* bỏ qua */ }
}

export const supabase: SupabaseClient = CHE_DO_THU
  ? createClient(url, anonKey, { accessToken: async () => tokenThu() ?? anonKey })
  : createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });

export const URL_SUPABASE = url;
export const KHOA_ANON = anonKey;

// Tệp lớn hơn mức này không gửi qua Edge Function mà tải thẳng lên Google Drive theo từng phần
const NGUONG_TAI_TRUC_TIEP = 20 * 1024 * 1024;
const KICH_THUOC_PHAN = 8 * 1024 * 1024; // bội số của 256 KiB theo yêu cầu của Drive

async function taiPhanLenDrive(urlPhien: string, file: File): Promise<string> {
  const tong = file.size;
  let tu = 0;
  while (tu < tong) {
    const den = Math.min(tu + KICH_THUOC_PHAN, tong);
    let res: Response | null = null;
    for (let lan = 0; lan < 4 && !res; lan++) {
      try {
        const r = await fetch(urlPhien, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes ${tu}-${den - 1}/${tong}` },
          body: file.slice(tu, den),
        });
        if (r.status === 308 || r.ok) res = r;
        else if (r.status < 500) throw new Error(`Google Drive từ chối tệp (${r.status})`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Google Drive từ chối')) throw e;
      }
      if (!res) await new Promise((ok) => setTimeout(ok, 1500 * (lan + 1)));
    }
    if (!res) throw new Error('Tải tệp lên bị ngắt giữa chừng. Kiểm tra mạng rồi thử lại.');
    if (den === tong) {
      if (!res.ok) throw new Error('Google Drive chưa nhận đủ tệp, hãy tải lại.');
      const d = await res.json().catch(() => null) as { id?: string } | null;
      if (!d?.id) throw new Error('Không lấy được mã tệp từ Google Drive.');
      return d.id;
    }
    tu = den;
  }
  throw new Error('Tệp rỗng');
}

// Gọi Edge Function kèm JWT người dùng
export async function goiChucNang<T = unknown>(ten: string, body: BodyInit | object, laForm = false): Promise<T> {
  // Tệp lớn: xin phiên tải lên (khoi_tao) -> trình duyệt gửi từng phần thẳng lên Drive -> ghi nhận (hoan_tat)
  if (ten === 'drive-upload' && laForm && body instanceof FormData) {
    const f = body.get('file');
    if (f instanceof File && f.size > NGUONG_TAI_TRUC_TIEP) {
      const chung = new FormData();
      body.forEach((v, k) => { if (k !== 'file') chung.append(k, v); });
      chung.set('ten_tep', f.name); chung.set('kich_thuoc', String(f.size)); chung.set('mime_tep', f.type || 'application/octet-stream');
      const kt = new FormData(); chung.forEach((v, k) => kt.append(k, v)); kt.set('buoc', 'khoi_tao');
      const { upload_url } = await goiChucNang<{ upload_url: string }>(ten, kt, true);
      const id = await taiPhanLenDrive(upload_url, f);
      const ht = new FormData(); chung.forEach((v, k) => ht.append(k, v)); ht.set('buoc', 'hoan_tat'); ht.set('drive_file_id', id);
      return goiChucNang<T>(ten, ht, true);
    }
  }
  const token = CHE_DO_THU ? tokenThu() : (await supabase.auth.getSession()).data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/${ten}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token ?? anonKey}`,
        apikey: anonKey,
        ...(laForm ? {} : { 'Content-Type': 'application/json' }),
      },
      body: laForm ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch (e) {
    // Tệp lớn: máy chủ ngắt kết nối giữa chừng (quá dung lượng / quá thời gian) hoặc mạng yếu
    if (ten === 'drive-upload') throw new Error('Tải tệp lên bị ngắt giữa chừng (tệp lớn hoặc mạng yếu). Kiểm tra mạng rồi thử lại; nếu vẫn lỗi, nén bớt tệp.');
    throw e;
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'loi' in data) ? String((data as { loi: string }).loi)
      : ten === 'drive-upload' && [413, 502, 504, 546].includes(res.status) ? 'Máy chủ không nhận nổi tệp này (quá lớn hoặc xử lý quá lâu). Hãy nén bớt hoặc chia nhỏ tệp rồi tải lại.'
      : `Lỗi ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

// Rút gọn lỗi Supabase cho người dùng
export function loiDe(e: unknown): string {
  if (!e) return 'Có lỗi xảy ra';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  const o = e as { message?: string; details?: string };
  return o.message || o.details || 'Có lỗi xảy ra';
}
