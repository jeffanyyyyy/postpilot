// ⚠️ 一次性工具：建立 copy_library 表 + 灌入 76 組公版文案（v1.1）。
// seed 成功後應以第二個 PR 移除本檔（整個 src/app/api/admin/seed-copy-library 目錄）。
//
// 安全：必須帶正確 SEED_TOKEN（環境變數，未寫死）。POST 或帶 token 的 GET 皆可；
//       無 token / token 錯誤一律 401；SEED_TOKEN 未設定則 500（fail-closed）。
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import postgres from 'postgres'
import { COPY_ROWS } from './data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DDL 拆成單一語句逐條執行（避免多語句協定問題）
const DDL_STATEMENTS = [
  `create table if not exists public.copy_library (
     industry   text not null,
     purpose    text not null check (purpose in ('promo','brand')),
     platform   text not null check (platform in ('ig','threads')),
     hook       text not null,
     body       text not null,
     cta        text not null,
     updated_at timestamptz not null default now(),
     primary key (industry, purpose, platform)
   )`,
  `alter table public.copy_library enable row level security`,
  `drop policy if exists copy_library_public_read on public.copy_library`,
  `create policy copy_library_public_read on public.copy_library for select using (true)`,
]

function tokenOk(req: Request): boolean {
  const expected = process.env.SEED_TOKEN
  if (!expected) return false
  const url = new URL(req.url)
  const provided = req.headers.get('x-seed-token') ?? url.searchParams.get('token') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false // 長度不同直接失敗（timingSafeEqual 需等長）
  return timingSafeEqual(a, b)
}

async function handle(req: Request) {
  if (!process.env.SEED_TOKEN) {
    return NextResponse.json({ ok: false, error: 'SEED_TOKEN 未設定' }, { status: 500 })
  }
  if (!tokenOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    return NextResponse.json({ ok: false, error: 'SUPABASE_DB_URL 未設定' }, { status: 500 })
  }

  // prepare:false 供 Supabase 交易池（pgbouncer transaction mode）使用；ssl require。
  const sql = postgres(dbUrl, { prepare: false, max: 1, ssl: 'require' })
  try {
    await sql.begin(async (tx) => {
      for (const stmt of DDL_STATEMENTS) {
        await tx.unsafe(stmt)
      }
      await tx`
        insert into public.copy_library ${tx(COPY_ROWS, 'industry', 'purpose', 'platform', 'hook', 'body', 'cta')}
        on conflict (industry, purpose, platform)
        do update set hook = excluded.hook, body = excluded.body, cta = excluded.cta, updated_at = now()
      `
    })
    const rows = await sql<{ count: number }[]>`select count(*)::int as count from public.copy_library`
    const count = rows[0]?.count ?? 0
    return NextResponse.json({ ok: true, count, expected: 76, seeded: COPY_ROWS.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request) { return handle(req) }
