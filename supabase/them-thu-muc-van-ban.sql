-- Thêm 4 thư mục Kho văn bản: dang_uy_phuong, ubnd_phuong, phong_ban, so_nganh.
-- Chạy trong Supabase > SQL Editor. An toàn khi chạy lại: gỡ ràng buộc CHECK cũ trên cột thu_muc (nếu có)
-- và bổ sung giá trị nếu cột là kiểu enum.
do $$
declare r record; t text;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.van_ban'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%thu_muc%'
  loop
    execute format('alter table public.van_ban drop constraint %I', r.conname);
  end loop;
  select udt_name into t from information_schema.columns where table_schema = 'public' and table_name = 'van_ban' and column_name = 'thu_muc';
  if t is not null and t not in ('text', 'varchar', 'bpchar') then
    execute format('alter type public.%I add value if not exists %L', t, 'dang_uy_phuong');
    execute format('alter type public.%I add value if not exists %L', t, 'ubnd_phuong');
    execute format('alter type public.%I add value if not exists %L', t, 'phong_ban');
    execute format('alter type public.%I add value if not exists %L', t, 'so_nganh');
  end if;
end $$;
