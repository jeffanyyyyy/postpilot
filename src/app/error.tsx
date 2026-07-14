'use client';

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#0D0D12] text-[#F0EFFF]">
      <h1 className="text-2xl font-bold">發生了一點問題</h1>
      <p className="mt-3 text-[#9B9AB8]">系統暫時無法處理你的請求，請稍後再試一次。</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-lg bg-[linear-gradient(135deg,#7C6FFF,#A78BFA)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition">
          重試
        </button>
        <a href="/dashboard" className="rounded-lg border border-[rgba(255,255,255,0.07)] px-5 py-2.5 text-sm font-medium text-[#F0EFFF] hover:bg-[rgba(255,255,255,0.05)] transition">
          回到儀表板
        </a>
      </div>
    </div>
  );
}
