import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#0D0D12] text-[#F0EFFF]">
      <p className="text-sm font-medium text-[#A78BFA]">404</p>
      <h1 className="mt-2 text-2xl font-bold">找不到這個頁面</h1>
      <p className="mt-3 text-[#9B9AB8]">你要找的頁面可能已被移動或不存在。</p>
      <Link href="/dashboard" className="mt-6 rounded-lg bg-[linear-gradient(135deg,#7C6FFF,#A78BFA)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition">
        回到儀表板
      </Link>
    </div>
  );
}
