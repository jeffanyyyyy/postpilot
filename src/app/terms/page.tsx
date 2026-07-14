import Link from 'next/link'

export const metadata = {
  title: '服務條款 | PostPilot',
  description: 'PostPilot 服務條款',
}

const wrap: React.CSSProperties = { minHeight:'100vh', background:'#0D0D12', color:'#F0EFFF', fontFamily:"-apple-system,'PingFang TC',sans-serif", padding:'48px 20px' }
const inner: React.CSSProperties = { maxWidth:'760px', margin:'0 auto', lineHeight:1.9, fontSize:'15px' }
const h2: React.CSSProperties = { fontSize:'18px', fontWeight:800, margin:'32px 0 10px' }
const muted: React.CSSProperties = { color:'#9B9AB8' }

export default function TermsPage() {
  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ fontSize:'26px', fontWeight:800, marginBottom:'4px' }}>
          Post<span style={{ color:'#A78BFA' }}>Pilot</span> 服務條款
        </div>
        <div style={muted}>最後更新：2026 年 7 月（生效日期：【請填寫】）</div>

        <p style={{ marginTop:'20px' }}>
          歡迎使用 PostPilot（以下稱「本服務」，由【請填入公司／品牌名稱】提供）。使用本服務即表示您同意以下條款。
        </p>

        <h2 style={h2}>一、服務說明</h2>
        <p>本服務提供社群內容的產出、排程與內容行事曆等工具，並在您授權後協助發布至您連結的社群平台。</p>

        <h2 style={h2}>二、帳號</h2>
        <p>您須提供正確的註冊資料並妥善保管帳號安全。您須為在您帳號下發生的活動負責。</p>

        <h2 style={h2}>三、可接受的使用</h2>
        <ul>
          <li>不得利用本服務發布違法、侵權、騷擾或違反各社群平台政策的內容。</li>
          <li>不得從事干擾服務運作、規避使用限制或未經授權存取的行為。</li>
        </ul>

        <h2 style={h2}>四、內容擁有權</h2>
        <p>您透過本服務建立或上傳的內容，其權利仍屬於您。您須確保擁有所使用之文字、圖片與音樂的合法權利；透過官方 API 發布時，不得使用未授權的音檔。</p>

        <h2 style={h2}>五、付費方案</h2>
        <p>部分功能需訂閱付費方案，金流由【綠界／請填寫】處理。方案內容、計費與退款政策以結帳頁面所載為準。</p>

        <h2 style={h2}>六、免責聲明</h2>
        <p>本服務依「現況」提供。對於內容成效（如觸及、互動）不作任何保證。因社群平台政策或 API 變更所致之影響，非本服務所能控制。</p>

        <h2 style={h2}>七、終止</h2>
        <p>您可隨時停止使用並要求刪除帳號。若您違反本條款，我們得暫停或終止您的使用權限。</p>

        <h2 style={h2}>八、準據法</h2>
        <p>本條款以【中華民國／請填寫】法律為準據法。</p>

        <h2 style={h2}>九、聯絡我們</h2>
        <p style={muted}>如對本條款有任何疑問，請聯絡：【聯絡 Email】</p>

        <div style={{ marginTop:'40px', paddingTop:'20px', borderTop:'1px solid rgba(255,255,255,0.08)', fontSize:'13px' }}>
          <Link href="/privacy" style={{ color:'#A78BFA' }}>隱私政策</Link>
          <span style={{ margin:'0 10px', color:'#5C5B78' }}>·</span>
          <Link href="/login" style={{ color:'#A78BFA' }}>回登入</Link>
        </div>
      </div>
    </div>
  )
}
