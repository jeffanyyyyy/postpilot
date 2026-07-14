import { createBrowserClient } from '@supabase/ssr'

// 瀏覽器端只保留一個 Supabase client（維持原本的 factory + singleton export 形狀，
// 現有 import 全部不需要改）。底層改用 @supabase/ssr 的 createBrowserClient：
// session 會存進 cookie（cookie-based），middleware / server component 才讀得到登入狀態。
let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
