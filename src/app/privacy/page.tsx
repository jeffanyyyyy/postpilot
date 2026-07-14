import Link from 'next/link'

export const metadata = {
  title: '隱私政策 | PostPilot',
  description: 'PostPilot 隱私政策',
}

const wrap: React.CSSProperties = { minHeight:'100vh', background:'#0D0D12', color:'#F0EFFF', fontFamily:"-apple-system,'PingFang TC',sans-serif", padding:'48px 20px' }
const inner: React.CSSProperties = { maxWidth:'760px', margin:'0 auto', lineHeight:1.9, fontSize:'15px' }
const h2: React.CSSProperties = { fontSize:'18px', fontWeight:800, margin:'32px 0 10px' }
const muted: React.CSSProperties = { color:'#9B9AB8' }

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ fontSize:'26px', fontWeight:800, marginBottom:'4px' }}>
          Post<span style={{ color:'#A78BFA' }}>Pilot</span> 隱私政策
        </div>
        <div style={muted}>最後更新：2026 年 7 月（生效日期：【請填寫】）</div>

        <p style={{ marginTop:'20px' }}>
          本隱私政策說明【請填入公司／品牌名稱】（以下稱「本服務」）如何收集、使用與保護您在使用 PostPilot 時的個人資料。使用本服務即表示您同意本政策所述之做法。
        </p>

        <h2 style={h2}>一、我們收集的資料</h2>
        <ul>
          <li><strong>帳號資料</strong>：您註冊時提供的電子郵件地址，以及顯示名稱。</li>
          <li><strong>您建立的內容</strong>：您在平台上產生的文案、貼文草稿、排程與行事曆項目。</li>
          <li><strong>方案與用量</strong>：您的訂閱方案、每月產出次數等使用紀錄。</li>
          <li><strong>連結的社群帳號（未來）</strong>：若您日後授權連結 Instagram／Threads，我們會取得該平台核發的存取權杖與必要的帳號識別資訊，用於代您發布內容。</li>
        </ul>

        <h2 style={h2}>二、我們如何使用資料</h2>
        <ul>
          <li>提供、維護與改善本服務的功能（產出內容、排程、行事曆）。</li>
          <li>依您的方案控管功能與用量。</li>
          <li>在您明確授權後，代您將內容發布至您連結的社群平台。</li>
          <li>與您就服務相關事項進行必要聯繫。</li>
        </ul>

        <h2 style={h2}>三、第三方服務</h2>
        <p>
          本服務使用 <strong>Supabase</strong>（資料庫與帳號驗證）儲存上述資料。若您使用自動發布功能，將透過 <strong>Meta（Instagram / Threads）官方 API</strong> 發布內容，並受其各自的政策約束。我們不會將您的個人資料出售給第三方。
        </p>

        <h2 style={h2}>四、Cookie 與工作階段</h2>
        <p>本服務使用必要的 Cookie 維持您的登入工作階段，不使用非必要的追蹤 Cookie。</p>

        <h2 style={h2}>五、資料保留與刪除</h2>
        <p>
          我們會在您使用服務期間保留您的資料。您可隨時要求刪除帳號與相關資料，請來信【聯絡 Email】。刪除連結的社群授權後，我們將停止存取該平台資料。
        </p>

        <h2 style={h2}>六、您的權利</h2>
        <p>您有權查詢、更正或刪除您的個人資料，並可隨時撤回先前給予的授權。</p>

        <h2 style={h2}>七、聯絡我們</h2>
        <p style={muted}>如對本政策有任何疑問，請聯絡：【聯絡 Email】</p>

        <div style={{ marginTop:'40px', paddingTop:'20px', borderTop:'1px solid rgba(255,255,255,0.08)', fontSize:'13px' }}>
          <Link href="/terms" style={{ color:'#A78BFA' }}>服務條款</Link>
          <span style={{ margin:'0 10px', color:'#5C5B78' }}>·</span>
          <Link href="/login" style={{ color:'#A78BFA' }}>回登入</Link>
        </div>
      </div>
    </div>
  )
}
