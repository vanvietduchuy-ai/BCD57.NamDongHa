-- Đăng ký tài khoản + Quản trị hệ thống duyệt.
-- Chạy MỘT LẦN trong Supabase > SQL Editor. Không lưu mật khẩu: khi duyệt, admin tạo tài khoản bằng chức năng sẵn có.

create table if not exists public.yeu_cau_dang_ky (
  id           uuid primary key default gen_random_uuid(),
  ho_ten       text not null check (char_length(ho_ten) between 2 and 100),
  email        text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 150),
  chuc_vu      text check (char_length(chuc_vu) <= 100),
  so_dien_thoai text check (char_length(so_dien_thoai) <= 20),
  don_vi_id    uuid references public.don_vi(id),
  ghi_chu      text check (char_length(ghi_chu) <= 300),
  trang_thai   text not null default 'cho' check (trang_thai in ('cho','da_duyet','tu_choi')),
  ly_do_tu_choi text,
  xu_ly_boi    uuid references public.nguoi_dung(id),
  xu_ly_luc    timestamptz,
  tao_luc      timestamptz not null default now()
);
-- mỗi email chỉ có 1 yêu cầu đang chờ
create unique index if not exists yeu_cau_dang_ky_email_cho on public.yeu_cau_dang_ky (lower(email)) where trang_thai = 'cho';

alter table public.yeu_cau_dang_ky enable row level security;
revoke all on public.yeu_cau_dang_ky from anon, authenticated;

-- Chỉ Quản trị hệ thống (vai_tro = 'admin') xem / xử lý
drop policy if exists yc_dk_admin on public.yeu_cau_dang_ky;
create policy yc_dk_admin on public.yeu_cau_dang_ky for all to authenticated
  using (exists (select 1 from public.nguoi_dung n where n.id = auth.uid() and n.vai_tro = 'admin' and n.hoat_dong))
  with check (exists (select 1 from public.nguoi_dung n where n.id = auth.uid() and n.vai_tro = 'admin' and n.hoat_dong));
grant select, update on public.yeu_cau_dang_ky to authenticated;

-- Danh sách đơn vị cho ô chọn ở trang đăng ký (chưa đăng nhập)
create or replace function public.don_vi_dang_ky()
returns table (id uuid, ma text, ten text, loai text)
language sql security definer set search_path = public stable as $$
  select d.id, d.ma, d.ten, d.loai from public.don_vi d
  where d.hoat_dong and d.loai <> 'lanh_dao_bcd' order by d.thu_tu;
$$;

-- Gửi yêu cầu đăng ký (chưa đăng nhập)
create or replace function public.gui_dang_ky(p_ho_ten text, p_email text, p_chuc_vu text, p_sdt text, p_don_vi uuid, p_ghi_chu text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email));
begin
  if coalesce(trim(p_ho_ten), '') = '' or v_email = '' then raise exception 'Thiếu họ tên hoặc email'; end if;
  if p_don_vi is null or not exists (select 1 from public.don_vi where id = p_don_vi and hoat_dong) then raise exception 'Chọn đơn vị công tác'; end if;
  if exists (select 1 from public.nguoi_dung where lower(email) = v_email) then raise exception 'Email này đã có tài khoản. Dùng "Quên mật khẩu" nếu cần.'; end if;
  if exists (select 1 from public.yeu_cau_dang_ky where lower(email) = v_email and trang_thai = 'cho') then raise exception 'Email này đã gửi yêu cầu, đang chờ duyệt.'; end if;
  if (select count(*) from public.yeu_cau_dang_ky where trang_thai = 'cho' and tao_luc > now() - interval '1 hour') >= 30 then
    raise exception 'Hệ thống đang nhận quá nhiều yêu cầu, vui lòng thử lại sau.'; end if;
  insert into public.yeu_cau_dang_ky (ho_ten, email, chuc_vu, so_dien_thoai, don_vi_id, ghi_chu)
  values (trim(p_ho_ten), v_email, nullif(trim(p_chuc_vu), ''), nullif(trim(p_sdt), ''), p_don_vi, nullif(trim(p_ghi_chu), ''));
end $$;

revoke all on function public.don_vi_dang_ky() from public;
revoke all on function public.gui_dang_ky(text, text, text, text, uuid, text) from public;
grant execute on function public.don_vi_dang_ky() to anon, authenticated;
grant execute on function public.gui_dang_ky(text, text, text, text, uuid, text) to anon, authenticated;
