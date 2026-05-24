-- Supabase SQL Editöründe bu komutu çalıştırın:
-- https://supabase.com/dashboard → SQL Editor → New query

create table banka_hareketleri (
  id serial primary key,
  tarih date not null default current_date,
  tur text not null check (tur in ('gelir', 'gider')),
  tutar numeric(10,2) not null,
  aciklama text,
  created_at timestamptz default now()
);
