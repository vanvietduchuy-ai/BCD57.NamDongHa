-- Báo cáo tháng gửi tỉnh (19 bảng theo mẫu XA003): lưu số liệu từng ô để các đơn vị nhập trực tiếp trên web (thẻ "Báo cáo tháng").
-- Chạy MỘT LẦN trong Supabase > SQL Editor.
-- Quy tắc ghi:
--   • Chỉ ghi qua hàm luu_bao_cao_thang (không ghi thẳng vào bảng).
--   • Quản trị hệ thống / Cơ quan Thường trực: ghi mọi bảng, mọi lúc (kể cả đã khoá, để đính chính).
--   • Tài khoản đơn vị: chỉ ghi bảng được phân công (cau_hinh 'bao_cao_thang' > phan_cong), kỳ chưa khoá và chưa quá ngày gửi
--     (trừ khi Thường trực mở lại kỳ). Lãnh đạo BCĐ chỉ xem.

create table if not exists public.bao_cao_thang (
  ky        text        not null,                 -- 'YYYY-MM'
  bang      text        not null,                 -- '1.1' … '7.3'
  dong      text        not null,                 -- khoá dòng ('d1', 'r3', '_tt' …)
  cot       text        not null,                 -- khoá cột
  gia_tri   text        not null default '',
  don_vi_id uuid,
  boi       uuid,
  cap_nhat  timestamptz not null default now(),
  primary key (ky, bang, dong, cot)
);

alter table public.bao_cao_thang enable row level security;

drop policy if exists bao_cao_thang_doc on public.bao_cao_thang;
create policy bao_cao_thang_doc on public.bao_cao_thang for select to authenticated
  using (exists (select 1 from public.nguoi_dung n where n.id = auth.uid() and n.hoat_dong));

create or replace function public.luu_bao_cao_thang(p_ky text, p_cac jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  n record; cfg jsonb; o jsonb; v_bang text; v_dv uuid;
  quan_tri boolean; han timestamptz; ngay_gui int;
begin
  select * into n from public.nguoi_dung where id = auth.uid() and hoat_dong;
  if not found then raise exception 'Tài khoản chưa được cấp quyền'; end if;
  if p_ky !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Kỳ báo cáo không hợp lệ'; end if;
  quan_tri := n.vai_tro in ('admin', 'quan_tri');
  if not quan_tri and n.vai_tro <> 'don_vi' then raise exception 'Tài khoản này chỉ được xem'; end if;

  select coalesce(gia_tri::jsonb, '{}'::jsonb) into cfg from public.cau_hinh where khoa = 'bao_cao_thang';
  cfg := coalesce(cfg, '{}'::jsonb);

  if not quan_tri then
    if coalesce(cfg->'khoa', '[]'::jsonb) ? p_ky then raise exception 'Kỳ % đã khoá, liên hệ Cơ quan Thường trực', p_ky; end if;
    ngay_gui := coalesce((cfg->>'gui')::int, 27);
    han := ((p_ky || '-01')::date + (ngay_gui) )::timestamp at time zone 'Asia/Ho_Chi_Minh';   -- hết ngày gửi
    if now() > han and not (coalesce(cfg->'mo_lai', '[]'::jsonb) ? p_ky) then
      raise exception 'Đã quá hạn gửi báo cáo tháng (ngày %), liên hệ Cơ quan Thường trực để mở lại', ngay_gui;
    end if;
  end if;

  for o in select * from jsonb_array_elements(coalesce(p_cac, '[]'::jsonb)) loop
    v_bang := o->>'bang';
    if not quan_tri then
      if not coalesce((cfg->'phan_cong'->v_bang) ? n.don_vi_id::text, false) then
        raise exception 'Bảng % chưa được phân công cho đơn vị của bạn', v_bang;
      end if;
    end if;
    v_dv := n.don_vi_id;
    if coalesce(o->>'gia_tri', '') = '' then
      delete from public.bao_cao_thang where ky = p_ky and bang = v_bang and dong = o->>'dong' and cot = o->>'cot';
    else
      insert into public.bao_cao_thang (ky, bang, dong, cot, gia_tri, don_vi_id, boi, cap_nhat)
      values (p_ky, v_bang, o->>'dong', o->>'cot', o->>'gia_tri', v_dv, auth.uid(), now())
      on conflict (ky, bang, dong, cot)
      do update set gia_tri = excluded.gia_tri, don_vi_id = excluded.don_vi_id, boi = excluded.boi, cap_nhat = now();
    end if;
  end loop;
end $$;

revoke all on function public.luu_bao_cao_thang(text, jsonb) from public, anon;
grant execute on function public.luu_bao_cao_thang(text, jsonb) to authenticated;
