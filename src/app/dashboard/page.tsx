'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// 手機版判斷：視窗寬度 < 768 視為手機。SSR 安全：初始 false，掛載後才量測。
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

const NAV = [
  { id: 'start', icon: '⚡', label: '快速開始' },
  { id: 'ig-post', icon: '📷', label: 'IG 文案＋輪播' },
  { id: 'ig-story', icon: '⭕', label: 'IG 限動' },
  { id: 'reels', icon: '🎬', label: 'Reels' },
  { id: 'threads', icon: '🧵', label: 'Threads' },
  { id: 'calendar', icon: '📅', label: '內容行事曆' },
  { id: 'analytics', icon: '📊', label: '數據分析' },
]

// 快速開始首頁的四個內容方向；key 對應 templates.category，
// 點了帶著方向跳到「IG 文案＋輪播」分頁並自動篩選對應分類
const DIRECTIONS = [
  { key: 'edu',      icon: '📚', title: '教學干貨', desc: '把專業拆成好懂的重點', color: '#34D399' },
  { key: 'interact', icon: '💬', title: '引爆互動', desc: '用問題和觀點引導留言', color: '#FBBF24' },
  { key: 'brand',    icon: '✨', title: '品牌故事', desc: '說出理念，讓人記住你', color: '#A78BFA' },
  { key: 'promo',    icon: '🔥', title: '限時促銷', desc: '把握檔期臨門一腳',   color: '#F87171' },
]

type Template = {
  slug: string
  name: string
  category: string
  description: string | null
  badge_text: string | null
  er_label: string | null
  is_hot: boolean | null
  required_plan: string | null
}

// templates 表只存 badge_text，顏色由 category 在前端對應
const CATEGORY_COLOR: Record<string, string> = {
  edu: '#34D399',
  interact: '#FBBF24',
  brand: '#A78BFA',
  promo: '#F87171',
  social: '#A78BFA',
  threads: '#9B9AB8',
  festival: '#FBBF24',
}

const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, business: 2 }

function canUseTemplate(userPlan: string, requiredPlan: string | null) {
  return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[requiredPlan ?? 'starter'] ?? 0)
}

// 以下兩個元件標示「尚未串接真實資料」的區塊。
// 串接 Meta Graph API 後，直接移除對應的 <DemoTag /> 與 <DemoNotice /> 即可。
function DemoTag({ label = '示範數據' }: { label?: string }) {
  return (
    <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'10px', background:'rgba(251,191,36,0.12)', color:'#FBBF24', border:'1px solid rgba(251,191,36,0.25)', whiteSpace:'nowrap', flexShrink:0 }}>
      {label}
    </span>
  )
}

function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', gap:'10px', alignItems:'flex-start', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'10px', padding:'12px 14px', marginBottom:'20px' }}>
      <span style={{ fontSize:'14px', lineHeight:1.5 }}>⚠️</span>
      <div style={{ fontSize:'12px', color:'#E3CE96', lineHeight:1.7 }}>{children}</div>
    </div>
  )
}

const HOOKS = ['損失規避','好奇缺口','社會認同','破除迷思','數字開頭']
const CTA_OPTIONS = [
  { key:'save', label:'💾 引導存檔' },
  { key:'comment', label:'💬 引導留言' },
  { key:'share', label:'📤 引導分享' },
  { key:'follow', label:'➕ 引導追蹤' },
]

// ── 零 token 產出：骨架庫（存在前端，非 AI）──────────────────────
// 一則貼文 = Hook（首句）＋ Body（主文，含 5 個重點）＋ CTA（行動呼籲）＋ 輪播分頁文字。
// 變數：{brand} 帳號、{topic} 主題、{industry} 產業，全部由使用者輸入 / 產業設定帶入。

type BuiltContent = {
  hook: string
  body: string
  cta: string
  hashtags: string[]
  slides: { title: string; body: string }[]
}

// Hook 首句：依「Hook 類型」給不同開場（填入主題）
const HOOK_LINES: Record<string, (t: string) => string> = {
  '損失規避': t => `你的「${t}」做了好一陣子，卻還看不到效果？`,
  '好奇缺口': t => `99% 的人不知道的「${t}」秘密——`,
  '社會認同': t => `跟 2,000+ 人一樣，搞懂「${t}」的這幾件事後，結果完全不同。`,
  '破除迷思': t => `大家都說「${t}」要這樣做——但這可能讓你白費力氣。`,
  '數字開頭': t => `5 個讓你的「${t}」立刻不一樣的方法：`,
}

// CTA 結尾：依「CTA 目標」給不同收尾
const CTA_LINES: Record<string, (b: string) => string> = {
  save: () => '💾 先存起來，需要的時候就能回來看。',
  comment: () => '你的想法是？留言告訴我 👇',
  share: () => '📤 轉給身邊也需要這篇的朋友。',
  follow: b => `➕ 追蹤 @${b}，每週更新這類內容。`,
}

// 內容支柱（= templates.category）骨架：導言 + 5 個重點骨架 + 標籤
const SKELETON: Record<string, { pillar: string; intro: (t: string) => string; points: string[]; tags: string[] }> = {
  edu: {
    pillar: '教學干貨',
    intro: t => `關於「${t}」，很多人努力卻沒效果，通常是漏了這幾個關鍵。`,
    points: ['最容易被忽略、但影響最大的第一步', '90% 的人會卡住的地方', '做錯反而越做越累的迷思', '沒人會告訴你、卻很關鍵的細節', '修正這一個，成果立刻不同'],
    tags: ['#乾貨分享', '#知識型', '#學起來'],
  },
  interact: {
    pillar: '引爆互動',
    intro: t => `先問你一個關於「${t}」的問題——你的答案可能跟多數人不一樣。`,
    points: ['一個會讓人想回答的開放問題', '兩種常見立場，你站哪邊？', '一個反直覺的觀點', '請大家在留言分享自己的經驗', '投票：A 還是 B？'],
    tags: ['#一起聊聊', '#你覺得呢', '#留言告訴我'],
  },
  brand: {
    pillar: '品牌故事',
    intro: t => `想跟你說說我們為什麼開始做「${t}」這件事。`,
    points: ['最初遇到的問題與契機', '我們相信的一個原則', '走過的一段彎路與學到的事', '想帶給你的改變', '未來想一起完成的目標'],
    tags: ['#品牌故事', '#理念', '#初衷'],
  },
  promo: {
    pillar: '限時促銷',
    intro: t => `關於「${t}」，這次的檔期真的值得把握。`,
    points: ['這次方案的核心亮點', '和平常相比多划算', '最適合哪一種人', '限時 / 限量的條件', '現在行動的下一步'],
    tags: ['#限時優惠', '#把握檔期', '#售完為止'],
  },
  social: {
    pillar: '社會證明',
    intro: t => `這些真實回饋，也許能幫你決定要不要開始「${t}」。`,
    points: ['一則具體的使用者回饋', '一個可量化的成果數字', '最多人擔心、後來被解決的疑慮', '為什麼他們願意回購 / 推薦', '換你試試看的邀請'],
    tags: ['#真實回饋', '#口碑', '#見證'],
  },
  festival: {
    pillar: '節慶內容',
    intro: t => `趁著這個節日，用「${t}」和大家一起應景一下。`,
    points: ['節日和你的主題怎麼連結', '一個應景的小巧思', '限定的內容或優惠', '和粉絲互動的節慶問題', '節日的祝福與 CTA'],
    tags: ['#節慶限定', '#應景', '#一起過節'],
  },
}

function buildContent(
  category: string,
  { brand, topic, industry, hookKey, ctaKey }: { brand: string; topic: string; industry: string; hookKey: string; ctaKey: string }
): BuiltContent {
  const b = brand || '我們'
  const t = topic || '這個主題'
  const sk = SKELETON[category] || SKELETON.edu
  const hook = (HOOK_LINES[hookKey] || HOOK_LINES['好奇缺口'])(t)
  const cta = (CTA_LINES[ctaKey] || CTA_LINES.save)(b)
  const industryTag = industry ? `（${industry}）` : ''
  const bodyPoints = sk.points.map((p, i) => `${i + 1}️⃣ ${p}`).join('\n')
  const body = `${sk.intro(t)}${industryTag}\n\n${b} 幫你整理 👇\n\n${bodyPoints}`
  const hashtags = [...sk.tags, '#IG行銷', '#社群經營']
  const slides = [
    { title: '封面頁', body: hook },
    ...sk.points.map((p, i) => ({ title: `第 ${i + 1} 頁`, body: `${i + 1}. ${p}` })),
    { title: '結尾頁（CTA）', body: cta },
  ]
  return { hook, body, cta, hashtags, slides }
}

// 把結構化內容組成一則可貼上的完整文案
function composeCaption(c: BuiltContent): string {
  return `${c.hook}\n\n${c.body}\n\n${c.cta}\n\n${c.hashtags.join(' ')}`
}

// 從產業建議時段推一個具體時間（schedules.scheduled_at 為 NOT NULL；過了就排明天同時段）
function computeSuggestedAt(times?: { label: string; time: string }[]): Date {
  const first = times?.[0]?.time ?? ''
  const m = first.match(/(\d{1,2}):(\d{2})/)
  const hh = m ? parseInt(m[1], 10) : 20
  const mm = m ? parseInt(m[2], 10) : 0
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  if (d <= new Date()) d.setDate(d.getDate() + 1)
  return d
}

// ── Threads 零 token 產出：爆款結構（短文 + 串文）────────────────────
// Threads 偏好高互動、有觀點；用「反直覺開頭 → 論點 → 互動收尾」等結構。
type ThreadBuilt = { structureLabel: string; single: string; thread: string[] }

const THREAD_STRUCTURES = [
  { key: 'contrarian', label: '反常識觀點', hint: '反直覺開頭 → 論點 → 互動收尾' },
  { key: 'story',      label: '個人體悟',   hint: '情境開場 → 轉折 → 觀點收尾' },
  { key: 'listicle',   label: '清單串文',   hint: '鉤子 → 逐則重點 → 收尾提問' },
  { key: 'question',   label: '提問互動',   hint: '尖銳提問 → 兩種立場 → 邀留言' },
]

function buildThreads(structureKey: string, { brand, topic }: { brand: string; topic: string }): ThreadBuilt {
  const b = brand || '我'
  const t = topic || '這件事'
  const map: Record<string, ThreadBuilt> = {
    contrarian: {
      structureLabel: '反常識觀點',
      single: `大家都說「${t}」要更拚。\n\n但我越來越覺得——方向錯了，努力只是加速撞牆。\n\n真正有用的，是先停下來問對問題。\n\n你也曾經在「${t}」上白費過力氣嗎？`,
      thread: [
        `關於「${t}」，一個可能會得罪人的觀點：🧵`,
        `1/ 多數人把「${t}」做成了比誰更拚。但拚命從來不是重點。`,
        `2/ 真正拉開差距的，是你有沒有想清楚「為什麼做」。`,
        `3/ 方向對了，慢也會到；方向錯了，快只是更快撞牆。`,
        `留言告訴我——你在「${t}」上，最想停下來重想的一件事是什麼？`,
      ],
    },
    story: {
      structureLabel: '個人體悟',
      single: `幾年前，${b}對「${t}」幾乎一竅不通。\n\n走錯方向浪費的時間，比做錯事還多。\n\n如果只能給當時的自己一句話：別急著做，先搞懂你要的是什麼。\n\n你在「${t}」上，最想跟過去的自己說什麼？`,
      thread: [
        `說個關於「${t}」的真實經驗，可能對正在卡關的你有用：🧵`,
        `1/ 一開始${b}以為「${t}」就是照著做就好。`,
        `2/ 後來才發現，真正難的不是方法，是取捨。`,
        `3/ 當我開始敢放掉不重要的，事情反而順了。`,
        `你正在「${t}」上卡住的地方是什麼？也許我踩過同一個坑。`,
      ],
    },
    listicle: {
      structureLabel: '清單串文',
      single: `想把「${t}」做好，其實不用很複雜。\n\n${b}整理成 3 個原則：\n\n① 先求穩，再求快\n② 少做，但做對\n③ 讓成果可以累積\n\n哪一個你最有感？`,
      thread: [
        `把「${t}」做好，其實只要守住這幾個原則：🧵`,
        `1/ 先求穩再求快——地基不穩，衝越快摔越慘。`,
        `2/ 少做但做對——與其樣樣碰，不如一件做到位。`,
        `3/ 讓成果累積——每一步都為下一步鋪路。`,
        `這 3 個裡面，你最想先從哪一個開始？留言聊聊。`,
      ],
    },
    question: {
      structureLabel: '提問互動',
      single: `一個關於「${t}」的問題，想聽聽大家怎麼想：\n\n你覺得是「先開始再修正」比較好，還是「想清楚再動手」？\n\n${b}自己偏向前者，但最近有點動搖。\n\n你站哪一邊？為什麼？`,
      thread: [
        `想丟一個「${t}」的問題給大家，兩種答案都有人堅持：🧵`,
        `A 立場：先開始再修正，做中學最快。`,
        `B 立場：想清楚再動手，少走冤枉路。`,
        `${b}兩邊都待過，各有代價。`,
        `你是 A 還是 B？留言告訴我你的理由。`,
      ],
    },
  }
  return map[structureKey] || map.contrarian
}

// 串文各則之間的分隔（複製 / 存檔用）
function joinThread(items: string[]): string {
  return items.join('\n\n——— 下一則 ———\n\n')
}

// ── IG 限動零 token 產出：畫面文字 + 建議互動貼紙（投票/問答）──────────
// 限動＝底圖＋畫面上的字；貼紙（投票/問答）IG API 無法預先加，需發布後在 App 手動加。
type StoryBuilt = {
  angleLabel: string
  screenText: string                       // 打在底圖畫面上的字
  sticker:
    | { type: 'poll'; question: string; optionA: string; optionB: string }
    | { type: 'qa'; prompt: string }
}

const STORY_ANGLES = [
  { key: 'poll_thisthat', label: '二選一投票', hint: '拋一個對立選擇，用投票貼紙互動' },
  { key: 'qa_ask',        label: '問答徵集',   hint: '邀粉絲提問，用問答貼紙收集' },
  { key: 'tip_poll',      label: '乾貨＋投票', hint: '給一個重點，再問認不認同' },
  { key: 'behind_qa',     label: '幕後＋提問', hint: '露一點幕後，引導好奇提問' },
]

function buildStory(angleKey: string, { brand, topic }: { brand: string; topic: string }): StoryBuilt {
  const b = brand || '我們'
  const t = topic || '這個主題'
  const map: Record<string, StoryBuilt> = {
    poll_thisthat: {
      angleLabel: '二選一投票',
      screenText: `關於「${t}」\n你是哪一派？`,
      sticker: { type: 'poll', question: `${t}，你比較支持？`, optionA: '這一種 👍', optionB: '那一種 🤔' },
    },
    qa_ask: {
      angleLabel: '問答徵集',
      screenText: `關於「${t}」\n你最想問的是什麼？`,
      sticker: { type: 'qa', prompt: `你對「${t}」最大的疑問？` },
    },
    tip_poll: {
      angleLabel: '乾貨＋投票',
      screenText: `${t} 的一個重點：\n先求穩，再求快`,
      sticker: { type: 'poll', question: '這點你認同嗎？', optionA: '認同', optionB: '不一定' },
    },
    behind_qa: {
      angleLabel: '幕後＋提問',
      screenText: `${b} 的「${t}」幕後\n想看更多嗎？`,
      sticker: { type: 'qa', prompt: '你最好奇哪個部分？' },
    },
  }
  return map[angleKey] || map.poll_thisthat
}

// 把限動內容（畫面文字＋貼紙建議）組成可複製 / 存檔的文字
function composeStory(s: StoryBuilt): string {
  const stick = s.sticker.type === 'poll'
    ? `【投票貼紙】${s.sticker.question}\n  選項A：${s.sticker.optionA}\n  選項B：${s.sticker.optionB}`
    : `【問答貼紙】${s.sticker.prompt}`
  return `${s.screenText}\n\n— 建議互動貼紙（發布後在 IG App 手動加）—\n${stick}`
}

// 用 Canvas 把畫面文字合成進 9:16 底圖，回傳 Blob（繁中用系統字型，不需 Cloudinary）
function renderStoryImage(screenText: string, handle: string): Promise<Blob | null> {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  // 背景漸層（品牌深色＋紫）
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#13131A'); g.addColorStop(0.55, '#241f45'); g.addColorStop(1, '#0D0D12')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  // 主文字
  ctx.fillStyle = '#F0EFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const fontSize = 78, lineH = 108, maxW = W - 200
  ctx.font = `bold ${fontSize}px "PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif`
  // 依 \n 與寬度自動換行（CJK 逐字）
  const lines: string[] = []
  for (const para of screenText.split('\n')) {
    let cur = ''
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch }
      else cur += ch
    }
    lines.push(cur)
  }
  const startY = H / 2 - ((lines.length - 1) * lineH) / 2
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, startY + i * lineH))
  // 底部帳號
  if (handle) {
    ctx.font = 'bold 40px "PingFang TC","Microsoft JhengHei",sans-serif'
    ctx.fillStyle = '#A78BFA'
    ctx.fillText(`@${handle}`, W / 2, H - 140)
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

function AnalyticsPage() {
  const barData = [3200, 8400, 4100, 5800, 9200, 6300, 3700]
  const maxBar = Math.max(...barData)
  const weekDays = ['一','二','三','四','五','六','日']

  return (
    <div>
      {/* 頂部篩選 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' as any }}>
        {['7 天','30 天','90 天'].map((t,i) => (
          <button key={t} style={{ padding:'7px 14px', borderRadius:'20px', fontSize:'13px', fontWeight:'500', background: i===0 ? 'rgba(124,111,255,0.15)' : '#1E1E2E', color: i===0 ? '#A78BFA' : '#9B9AB8', border: i===0 ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)', cursor:'pointer' }}>{t}</button>
        ))}
        <button style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:'8px', fontSize:'13px', background:'transparent', color:'#9B9AB8', border:'1px solid rgba(255,255,255,0.07)', cursor:'pointer' }} onClick={() => alert('週報功能開發中')}>📧 寄送週報</button>
      </div>

      <DemoNotice>
        <strong style={{ color:'#FBBF24' }}>本頁所有數字皆為示範內容，不是你的真實成效。</strong><br />
        觸及、互動率、存檔、追蹤成長等指標需要串接 Instagram / Threads 官方 API 才能取得，目前尚未串接。串接完成後，這些數字會自動替換為你帳號的實際數據。
      </DemoNotice>

      {/* 數據卡片 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'20px' }}>
        {[
          { label:'總觸及人數', value:'24.8K', color:'#A78BFA', delta:'▲ +18% 較上週' },
          { label:'平均 ER', value:'6.4%', color:'#34D399', delta:'▲ +1.2% 較上週' },
          { label:'總存檔數', value:'1,247', color:'#A78BFA', delta:'▲ +34% 較上週' },
          { label:'新增追蹤', value:'+89', color:'#34D399', delta:'本週淨成長' },
        ].map(s => (
          <div key={s.label} style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px', opacity:0.75 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
              <span style={{ fontSize:'12px', color:'#9B9AB8' }}>{s.label}</span>
              <DemoTag label="待串接" />
            </div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:s.color, letterSpacing:'-0.5px' }}>{s.value}</div>
            <div style={{ fontSize:'11px', color:'#34D399', marginTop:'4px' }}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
        {/* 每日觸及趨勢 */}
        <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
          <div style={{ fontWeight:'700', fontSize:'13px', color:'#9B9AB8', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'6px' }}>
            每日觸及趨勢
            <DemoTag label="待串接" />
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'4px', height:'80px' }}>
            {barData.map((v,i) => (
              <div key={i} style={{ flex:1, borderRadius:'3px 3px 0 0', background: i===4 ? 'linear-gradient(180deg,#7C6FFF,#A78BFA)' : 'rgba(124,111,255,0.2)', height:`${Math.round(v/maxBar*100)}%`, minHeight:'4px', transition:'height .3s' }} title={`${v.toLocaleString()} 觸及`} />
            ))}
          </div>
          <div style={{ display:'flex', gap:'4px', marginTop:'6px' }}>
            {weekDays.map(d => <div key={d} style={{ flex:1, textAlign:'center', fontSize:'10px', color:'#5C5B78' }}>{d}</div>)}
          </div>
        </div>

        {/* 內容類型 ER */}
        <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
          <div style={{ fontWeight:'700', fontSize:'13px', color:'#9B9AB8', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'6px' }}>
            內容類型 ER 比較
            <DemoTag label="待串接" />
          </div>
          {[
            { label:'教育型', pct:80, er:'8.2%', color:'#34D399' },
            { label:'互動型', pct:65, er:'6.7%', color:'#FBBF24' },
            { label:'品牌故事', pct:55, er:'5.6%', color:'#A78BFA' },
            { label:'促銷型', pct:38, er:'3.9%', color:'#F87171' },
          ].map(c => (
            <div key={c.label} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
              <span style={{ fontSize:'12px', color:'#9B9AB8', width:'56px', flexShrink:0 }}>{c.label}</span>
              <div style={{ flex:1, height:'6px', background:'#13131A', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${c.pct}%`, background:c.color, borderRadius:'3px' }} />
              </div>
              <span style={{ fontSize:'12px', fontWeight:'700', color:c.color, width:'36px', textAlign:'right' as any }}>{c.er}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 最佳貼文 */}
      <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px', marginBottom:'16px' }}>
        <div style={{ fontWeight:'700', fontSize:'13px', color:'#9B9AB8', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'6px' }}>
          <span>本期最佳貼文 <span style={{ fontSize:'12px', fontWeight:'400' }}>按互動率排序</span></span>
          <DemoTag label="待串接" />
        </div>
        {[
          { rank:'🥇', title:'保養順序錯了？你可能讓精華液白費', meta:'教育型 · 週日 · 存檔 342 次', er:'11.2%' },
          { rank:'🥈', title:'說一個可能得罪人的觀點——關於運動與睡眠', meta:'互動型 · 週三 · 留言 89 則', er:'8.7%' },
          { rank:'🥉', title:'五年後你會感謝自己做過這件事', meta:'品牌故事 · 週一 · 分享 156 次', er:'7.3%' },
        ].map(p => (
          <div key={p.rank} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px', borderRadius:'8px', background:'#13131A', border:'1px solid rgba(255,255,255,0.05)', marginBottom:'8px' }}>
            <div style={{ fontSize:'20px', width:'28px', textAlign:'center' as any, flexShrink:0 }}>{p.rank}</div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <div style={{ fontSize:'13px', fontWeight:'600', whiteSpace:'nowrap' as any, overflow:'hidden', textOverflow:'ellipsis' }}>{p.title}</div>
              <div style={{ fontSize:'11px', color:'#9B9AB8', marginTop:'2px' }}>{p.meta}</div>
            </div>
            <div style={{ fontSize:'16px', fontWeight:'800', color:'#34D399', flexShrink:0 }}>{p.er}</div>
          </div>
        ))}
      </div>

      {/* 數據洞察 */}
      <div style={{ background:'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(167,139,250,0.04))', border:'1px solid rgba(124,111,255,0.2)', borderRadius:'14px', padding:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
          <span style={{ fontSize:'18px' }}>📊</span>
          <span style={{ fontSize:'14px', fontWeight:'700' }}>內容洞察建議</span>
          <span style={{ marginLeft:'auto' }}><DemoTag label="通用建議" /></span>
        </div>
        <div style={{ fontSize:'13px', color:'#9B9AB8', lineHeight:'1.7' }}>
          以下是社群經營的通用原則，<strong style={{ color:'#F0EFFF' }}>不是針對你帳號的分析</strong>。等 Instagram / Threads 串接完成後，這裡會換成依你實際成效產生的洞察。
          <br /><br />
          <strong style={{ color:'#F0EFFF' }}>教育型貼文</strong>的存檔率通常明顯高於促銷型——存檔是演算法權重很高的訊號，代表內容有「之後還想再看」的價值。若你的內容以促銷為主，可以試著把教育型的比例拉到一半左右，再搭配一篇高互動的「是非題」問答文平衡觸及與互動。
          <br /><br />
          發文時段沒有一體適用的答案，<strong style={{ color:'#F0EFFF' }}>取決於你自己的受眾何時在線</strong>。在拿到真實數據之前，建議固定時段連續發兩到三週，再用同一時段的表現互相比較——這比套用任何「黃金時段」都準。
        </div>
      </div>
    </div>
  )
}
type Schedule = {
  id: string
  platform: string
  content: string
  scheduled_at: string
  status: string | null
}

const WEEK_LABEL = ['日','一','二','三','四','五','六']

function formatSlot(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `週${WEEK_LABEL[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()} · ${hh}:${mm}`
}

// 把「週二 20:00」這種時段換算成下一次實際發生的時間點
function nextOccurrence(dow: number, hour: number, minute: number) {
  const now = new Date()
  const d = new Date(now)
  d.setHours(hour, minute, 0, 0)
  let delta = (dow - d.getDay() + 7) % 7
  if (delta === 0 && d <= now) delta = 7
  d.setDate(d.getDate() + delta)
  return d
}

const SCHEDULE_TIMES = [
  { rank:'★', slot:'週二 20:00', label:'最佳推薦時段', er:'ER +42%', color:'#FBBF24', dow:2, hour:20, minute:0 },
  { rank:'2', slot:'週四 19:30', label:'次佳時段',     er:'ER +31%', color:'#A78BFA', dow:4, hour:19, minute:30 },
  { rank:'3', slot:'週三 12:30', label:'午間流量',     er:'ER +18%', color:'#9B9AB8', dow:3, hour:12, minute:30 },
]

type PostingTime = {
  category_key: string
  category_name: string
  category_desc: string | null
  display_order: number
  recommended_times: { label: string; time: string }[] | null
  content_formats: { type: string; desc: string }[] | null
}

function SchedulePage({ userId, showToast, onGenerate }: { userId: string, showToast: (m:string)=>void, onGenerate: ()=>void }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState(1)
  const [platform, setPlatform] = useState('ig')
  const [content, setContent] = useState('')
  const [selectedTime] = useState(0)
  const [queue, setQueue] = useState<Schedule[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState('')
  // 產業別輔助選時間（本版純畫面輔助，不寫入 DB、不接進 schedules）
  const [industry, setIndustry] = useState('')
  const [pickedTime, setPickedTime] = useState('')
  const [postingTimes, setPostingTimes] = useState<PostingTime[]>([])
  const [ptError, setPtError] = useState(false)
  const supabase = createClient()

  const times = SCHEDULE_TIMES

  const loadQueue = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('schedules')
      .select('id,platform,content,scheduled_at,status')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true })

    if (error) setQueueError(error.message)
    else { setQueue(data ?? []); setQueueError('') }
    setQueueLoading(false)
  }, [userId, supabase])

  useEffect(() => { loadQueue() }, [loadQueue])

  // 讀取產業別發文時段建議（讀不到就設 ptError，不讓頁面崩潰）
  useEffect(() => {
    let cancelled = false
    async function loadPostingTimes() {
      try {
        const { data, error } = await supabase
          .from('posting_times')
          .select('category_key,category_name,category_desc,display_order,recommended_times,content_formats')
          .order('display_order', { ascending: true })
        if (cancelled) return
        if (error || !data) { setPtError(true); return }
        setPostingTimes(data as PostingTime[])
      } catch {
        if (!cancelled) setPtError(true)
      }
    }
    loadPostingTimes()
    return () => { cancelled = true }
    // 只需在掛載時讀一次；supabase 每次 render 都是新實例，故不放進依賴避免重複請求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSchedule() {
    if (!content || !userId) return
    const t = times[selectedTime]
    const scheduledAt = nextOccurrence(t.dow, t.hour, t.minute)

    const { error } = await supabase.from('schedules').insert({
      user_id: userId,
      platform,
      content,
      scheduled_at: scheduledAt.toISOString(),
      status: 'scheduled'
    })
    if (error) { showToast('❌ 排程失敗：' + error.message); return }

    showToast('✅ 排程成功！')
    setContent('')
    setStep(1)
    await loadQueue()
  }

  const selectedIndustry = postingTimes.find(p => p.category_key === industry)

  const platBtns = [
    { key:'ig', icon:'📷', label:'Instagram' },
    { key:'threads', icon:'🧵', label:'Threads' },
    { key:'both', icon:'✦', label:'兩個都發' },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap:'20px' }}>
      <div>
        {/* 步驟進度條 */}
        <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'16px 20px', marginBottom:'16px', display:'flex', alignItems:'center' }}>
          {['編輯文案','Hashtag','排程時間'].map((s,i) => (
            <div key={s} style={{ display:'flex', alignItems:'center', flex: i<2 ? 'auto' : 'none' }}>
              <div style={{ display:'flex', flexDirection:'column' as any, alignItems:'center', gap:'4px', cursor:'pointer' }} onClick={() => setStep(i+1)}>
                <div style={{ width:'28px', height:'28px', borderRadius:'50%', background: step===i+1 ? 'linear-gradient(135deg,#7C6FFF,#A78BFA)' : step>i+1 ? '#34D399' : '#1A1A24', border: step===i+1 ? 'none' : '1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'800', color:'#fff', boxShadow: step===i+1 ? '0 3px 10px rgba(124,111,255,0.4)' : 'none' }}>{step>i+1 ? '✓' : i+1}</div>
                <div style={{ fontSize:'11px', color: step===i+1 ? '#A78BFA' : '#5C5B78', fontWeight: step===i+1 ? '700' : '400', whiteSpace:'nowrap' as any }}>{s}</div>
              </div>
              {i<2 && <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.07)', margin:'0 8px', marginBottom:'16px' }}></div>}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'14px' }}>選擇發文平台</div>
            <div style={{ display:'flex', gap:'10px', marginBottom:'18px' }}>
              {platBtns.map(p => (
                <button key={p.key} onClick={() => setPlatform(p.key)} style={{ flex:1, padding:'12px 8px', borderRadius:'8px', border: platform===p.key ? '1px solid rgba(124,111,255,0.45)' : '1px solid rgba(255,255,255,0.07)', background: platform===p.key ? 'rgba(124,111,255,0.15)' : '#13131A', color: platform===p.key ? '#A78BFA' : '#9B9AB8', cursor:'pointer', display:'flex', flexDirection:'column' as any, alignItems:'center', gap:'4px', fontSize:'12px', fontWeight:'600' }}>
                  <span style={{ fontSize:'20px' }}>{p.icon}</span>{p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'8px' }}>編輯文案</div>
            <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="在這裡輸入或貼上你的文案，或點右上角「生成文案」從模板一鍵套用..." style={{ width:'100%', minHeight:'140px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'12px', outline:'none', resize:'vertical' as any, fontFamily:'inherit', lineHeight:'1.8', boxSizing:'border-box' as any }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px' }}>
              <span style={{ fontSize:'11px', color:'#5C5B78' }}>{content.length} / 2,200 字</span>
              <button onClick={onGenerate} style={{ background:'none', border:'none', color:'#A78BFA', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>從模板生成 →</button>
            </div>
            <button onClick={() => setStep(2)} style={{ width:'100%', marginTop:'14px', padding:'13px', background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor:'pointer' }}>下一步：設定 Hashtag →</button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'6px' }}>HASHTAG（第一則留言）</div>
            <p style={{ fontSize:'12px', color:'#9B9AB8', marginBottom:'14px' }}>放留言比說明文字觸及更好，演算法更喜歡</p>
            <div style={{ display:'flex', flexWrap:'wrap' as any, gap:'8px', marginBottom:'14px' }}>
              {['#IG行銷','#社群經營','#台灣自媒體','#內容創作','#演算法'].map(h => (
                <span key={h} style={{ fontSize:'12px', color:'#A78BFA', background:'rgba(124,111,255,0.08)', padding:'4px 10px', borderRadius:'6px' }}>{h}</span>
              ))}
            </div>
            <div style={{ fontSize:'11px', color:'#5C5B78', marginBottom:'16px' }}>已選 5 個 · 建議 5-10 個精準 tag</div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => setStep(1)} style={{ padding:'12px 16px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#9B9AB8', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>← 上一步</button>
              <button onClick={() => setStep(3)} style={{ flex:1, padding:'13px', background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor:'pointer' }}>下一步：選擇時間 →</button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'14px' }}>
              ✦ 推薦發文時段
            </div>
            {ptError ? (
              <div style={{ fontSize:'12px', color:'#9B9AB8', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'12px', marginBottom:'16px' }}>時段建議暫時無法載入</div>
            ) : !selectedIndustry ? (
              <div style={{ fontSize:'12px', color:'#5C5B78', lineHeight:1.6, background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'14px', marginBottom:'16px' }}>請先於下方選擇產業，即可查看建議發文時段</div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap' as any, gap:'8px', marginBottom:'16px' }}>
                {(selectedIndustry.recommended_times ?? []).map((rt, i) => (
                  <button
                    key={i}
                    onClick={() => setPickedTime(rt.time)}
                    style={{ fontSize:'12px', color: pickedTime===rt.time ? '#A78BFA' : '#9B9AB8', background: pickedTime===rt.time ? 'rgba(124,111,255,0.15)' : 'rgba(124,111,255,0.08)', border: pickedTime===rt.time ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)', padding:'6px 10px', borderRadius:'6px', cursor:'pointer' }}
                  >
                    {rt.label}：{rt.time}
                  </button>
                ))}
              </div>
            )}
            {/* 產業別輔助選時間 */}
            <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', marginTop:'4px', paddingTop:'16px', marginBottom:'16px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'8px' }}>產業別</div>
              {ptError ? (
                <div style={{ fontSize:'12px', color:'#9B9AB8', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'12px' }}>時段建議暫時無法載入</div>
              ) : (
                <>
                  <select
                    value={industry}
                    onChange={e => { setIndustry(e.target.value); setPickedTime('') }}
                    style={{ width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' as any }}
                  >
                    <option value="">請選擇產業</option>
                    {postingTimes.map(p => (
                      <option key={p.category_key} value={p.category_key}>{p.category_name}</option>
                    ))}
                  </select>

                  {selectedIndustry && (
                    <div style={{ marginTop:'14px' }}>
                      {selectedIndustry.category_desc && (
                        <p style={{ fontSize:'12px', color:'#9B9AB8', lineHeight:1.6, marginBottom:'14px' }}>{selectedIndustry.category_desc}</p>
                      )}

                      <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'8px' }}>內容形式建議</div>
                      <div style={{ display:'flex', flexDirection:'column' as any, gap:'6px' }}>
                        {(selectedIndustry.content_formats ?? []).map((cf, i) => (
                          <div key={i} style={{ fontSize:'13px', lineHeight:1.6 }}>
                            <strong style={{ color:'#A78BFA' }}>{cf.type}</strong><span style={{ color:'#9B9AB8' }}>：{cf.desc}</span>
                          </div>
                        ))}
                      </div>

                      {pickedTime && (
                        <div style={{ marginTop:'14px', fontSize:'12px', color:'#34D399', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:'8px', padding:'8px 12px' }}>
                          已選建議時段：{pickedTime}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => setStep(2)} style={{ padding:'12px 16px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#9B9AB8', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>← 上一步</button>
              <button onClick={() => showToast('已存為草稿 💾')} style={{ padding:'12px 16px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#9B9AB8', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>💾 草稿</button>
              <button onClick={handleSchedule} style={{ flex:1, padding:'13px', background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor:'pointer' }}>📅 確認排程</button>
            </div>
          </div>
        )}
      </div>

      {/* 右側佇列 */}
      <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'18px' }}>
        <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'14px' }}>
          排程佇列 <span style={{ fontSize:'11px', color:'#9B9AB8', fontWeight:'400' }}>即將發布</span>
        </div>

        {queueLoading && (
          <div style={{ fontSize:'12px', color:'#5C5B78', padding:'20px 0', textAlign:'center' }}>載入中…</div>
        )}

        {!queueLoading && queueError && (
          <div style={{ fontSize:'12px', color:'#F87171', lineHeight:1.6, padding:'10px 0' }}>❌ 讀取失敗：{queueError}</div>
        )}

        {!queueLoading && !queueError && queue.length === 0 && (
          <div style={{ fontSize:'12px', color:'#5C5B78', lineHeight:1.7, padding:'20px 0', textAlign:'center' }}>
            還沒有排程的貼文。<br />在左側完成三個步驟就會出現在這裡。
          </div>
        )}

        {!queueLoading && !queueError && queue.map(q => (
          <div key={q.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background: q.platform==='ig' ? 'linear-gradient(135deg,#f093fb,#f5576c)' : '#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>{q.platform==='ig' ? '📷' : '🧵'}</div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <div style={{ fontSize:'13px', fontWeight:'600', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{q.content.slice(0, 30) || '（無內容）'}</div>
              <div style={{ fontSize:'11px', color:'#9B9AB8' }}>{formatSlot(q.scheduled_at)}</div>
            </div>
            <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 8px', borderRadius:'10px', background: q.status==='scheduled' ? 'rgba(124,111,255,0.15)' : 'rgba(255,255,255,0.05)', color: q.status==='scheduled' ? '#A78BFA' : '#9B9AB8', flexShrink:0 }}>{q.status==='scheduled' ? '排程' : '草稿'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
// ── 四格式統一月曆：格式顏色 + 由 schedules 資料判定格式 ──────────────
const FORMAT_META: Record<string, { label: string; color: string }> = {
  ig_post:  { label: 'IG貼文', color: '#f093fb' },
  ig_story: { label: 'IG限動', color: '#A78BFA' },
  reels:    { label: 'Reels',  color: '#34D399' },
  threads:  { label: 'Threads', color: '#9B9AB8' },
}

type SchedRow = {
  id: string
  platform: string
  content: string
  scheduled_at: string
  status: string | null
  format?: string | null
}

// 判定格式：優先用 format 欄位；沒有（舊資料 / 尚未加欄位）就用 platform 推斷
function formatOf(r: SchedRow): string {
  if (r.format && FORMAT_META[r.format]) return r.format
  if (r.platform === 'threads') return 'threads'
  return 'ig_post'
}

const pad2 = (n: number) => String(n).padStart(2, '0')
// ISO → <input type="datetime-local"> 需要的本地時間字串
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function CalendarPage({ userId, onGenerate }: { userId: string; onGenerate: () => void }) {
  const isMobile = useIsMobile()
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  // 通用建議時段：讀 posting_times 的 category_key='general' 一筆
  const [generalTimes, setGeneralTimes] = useState<{ label: string; time: string }[] | null>(null)
  const [gtError, setGtError] = useState(false)

  // 真實排程資料
  const [rows, setRows] = useState<SchedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<SchedRow | null>(null)
  const [editTime, setEditTime] = useState('')
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  // 讀 schedules（容錯：若還沒有 format 欄位，退回不選 format）
  const loadRows = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    let res = await supabase.from('schedules')
      .select('id,platform,content,scheduled_at,status,format')
      .eq('user_id', userId).order('scheduled_at', { ascending: true })
    if (res.error && /format/i.test(res.error.message)) {
      res = await supabase.from('schedules')
        .select('id,platform,content,scheduled_at,status')
        .eq('user_id', userId).order('scheduled_at', { ascending: true })
    }
    if (res.error) { setLoadError(res.error.message); setRows([]) }
    else { setRows((res.data as SchedRow[]) ?? []); setLoadError('') }
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { loadRows() }, [loadRows])

  useEffect(() => {
    let cancelled = false
    async function loadGeneral() {
      try {
        const { data, error } = await supabase
          .from('posting_times')
          .select('category_name,recommended_times')
          .eq('category_key', 'general')
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (error || !data || !Array.isArray(data.recommended_times)) { setGtError(true); return }
        setGeneralTimes(data.recommended_times as { label: string; time: string }[])
      } catch {
        if (!cancelled) setGtError(true)
      }
    }
    loadGeneral()
    return () => { cancelled = true }
    // 只需在掛載時讀一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const weekDays = ['日','一','二','三','四','五','六']

  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const today = new Date()

  // 依「日」分組本月的排程
  const eventsByDay: Record<number, SchedRow[]> = {}
  for (const r of rows) {
    const d = new Date(r.scheduled_at)
    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      (eventsByDay[d.getDate()] ||= []).push(r)
    }
  }
  const monthRows = Object.values(eventsByDay).flat()
  const cntDraft = monthRows.filter(r => (r.status ?? 'draft') === 'draft').length
  const cntSched = monthRows.filter(r => r.status === 'scheduled').length
  const cntPub = monthRows.filter(r => r.status === 'published').length

  function changeMonth(dir: number) {
    let m = currentMonth + dir
    let y = currentYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setCurrentMonth(m)
    setCurrentYear(y)
  }

  async function saveTime() {
    if (!selected || !editTime) return
    setBusy(true)
    // 加 .select() 取回受影響列，才能分辨「RLS 擋掉（0 列、無 error）」的情況
    const { data, error } = await supabase.from('schedules')
      .update({ scheduled_at: new Date(editTime).toISOString() })
      .eq('id', selected.id)
      .select('id')
    setBusy(false)
    if (error) { alert('改時間失敗：' + error.message); return }
    if (!data || data.length === 0) { alert('沒有更新到資料（可能是 schedules 的 UPDATE 權限/RLS 尚未開放）'); return }
    setSelected(null)
    await loadRows()
  }

  async function removeRow() {
    if (!selected) return
    setBusy(true)
    const { data, error } = await supabase.from('schedules').delete().eq('id', selected.id).select('id')
    setBusy(false)
    if (error) { alert('刪除失敗：' + error.message); return }
    if (!data || data.length === 0) { alert('沒有刪除到資料（可能是 schedules 的 DELETE 權限/RLS 尚未開放）'); return }
    setSelected(null)
    await loadRows()
  }

  const days = []
  for (let i = 0; i < firstDay; i++) days.push({ day: 0, otherMonth: true })
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, otherMonth: false })
  while (days.length % 7 !== 0) days.push({ day: 0, otherMonth: true })

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap:'20px' }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ fontSize:'20px', fontWeight:'800' }}>{currentYear} 年 {monthNames[currentMonth]}</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => changeMonth(-1)} style={{ width:'32px', height:'32px', background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#9B9AB8', cursor:'pointer', fontSize:'16px' }}>‹</button>
            <button onClick={() => changeMonth(1)} style={{ width:'32px', height:'32px', background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#9B9AB8', cursor:'pointer', fontSize:'16px' }}>›</button>
          </div>
        </div>

        {/* 格式圖例 */}
        <div style={{ display:'flex', flexWrap:'wrap' as any, gap:'12px', marginBottom:'14px' }}>
          {Object.entries(FORMAT_META).map(([k, m]) => (
            <span key={k} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#9B9AB8' }}>
              <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:m.color, display:'inline-block' }} />{m.label}
            </span>
          ))}
        </div>

        {loadError && (
          <div style={{ background:'rgba(248,113,113,0.06)', border:'1px solid rgba(248,113,113,0.3)', color:'#F87171', fontSize:'12px', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px' }}>❌ 讀取排程失敗：{loadError}</div>
        )}

        <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            {weekDays.map(d => (
              <div key={d} style={{ padding:'10px 8px', textAlign:'center', fontSize:'11px', fontWeight:'700', color:'#5C5B78', textTransform:'uppercase' as any }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {days.map((d, i) => {
              const isToday = !d.otherMonth && today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === d.day
              const dayEvents = d.day ? (eventsByDay[d.day] || []) : []
              return (
                <div key={i} style={{ minHeight:'84px', borderRight: (i+1)%7===0 ? 'none' : '1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)', padding:'6px', opacity: d.otherMonth ? 0.3 : 1, cursor: d.day ? 'pointer' : 'default' }} onClick={() => d.day && onGenerate()}>
                  <div style={{ width:'24px', height:'24px', borderRadius:'50%', background: isToday ? '#7C6FFF' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'600', color: isToday ? '#fff' : '#F0EFFF', marginBottom:'4px' }}>
                    {d.day || ''}
                  </div>
                  {dayEvents.map(r => {
                    const meta = FORMAT_META[formatOf(r)]
                    const dt = new Date(r.scheduled_at)
                    const isDraft = (r.status ?? 'draft') === 'draft'
                    return (
                      <div
                        key={r.id}
                        onClick={(e) => { e.stopPropagation(); setSelected(r); setEditTime(toLocalInput(r.scheduled_at)) }}
                        title={r.content}
                        style={{ fontSize:'10px', padding:'2px 5px', borderRadius:'4px', marginBottom:'2px', fontWeight:'500', whiteSpace:'nowrap' as any, overflow:'hidden', textOverflow:'ellipsis', background: meta.color + '22', color: meta.color, borderLeft:`2px solid ${meta.color}`, opacity: isDraft ? 0.7 : 1 }}
                      >
                        {pad2(dt.getHours())}:{pad2(dt.getMinutes())} {isDraft ? '·草稿 ' : ''}{r.content.slice(0, 8)}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        {loading && <div style={{ fontSize:'12px', color:'#5C5B78', marginTop:'10px' }}>載入排程中…</div>}
      </div>

      <div style={{ display:'flex', flexDirection:'column' as any, gap:'14px' }}>
        <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'18px' }}>
          <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'14px' }}>
            ✦ 通用建議時段
          </div>
          {(gtError || !generalTimes || generalTimes.length === 0) ? (
            <div style={{ fontSize:'12px', color:'#9B9AB8', padding:'6px 0' }}>時段建議暫時無法載入</div>
          ) : (
            generalTimes.map((t, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize:'13px' }}>
                  <strong style={{ color:'#F0EFFF' }}>{t.label}</strong><span style={{ color:'#9B9AB8' }}>：{t.time}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'18px' }}>
          <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'14px' }}>
            📋 本月進度 <span style={{ fontSize:'11px', color:'#9B9AB8', fontWeight:'400' }}>本月共 {monthRows.length} 則</span>
          </div>
          {[
            { label:'已發布', value:cntPub, color:'#34D399' },
            { label:'排程中', value:cntSched, color:'#A78BFA' },
            { label:'草稿', value:cntDraft, color:'#FBBF24' },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'#9B9AB8' }}>{s.label}</span>
              <strong style={{ color:s.color }}>{s.value} 則</strong>
            </div>
          ))}
        </div>

        <button onClick={onGenerate} style={{ background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'13px', fontSize:'14px', fontWeight:'700', cursor:'pointer', width:'100%' }}>
          ✦ 新增貼文
        </button>
      </div>

      {/* 項目詳情：看內容 / 改時間 / 刪除 */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:'20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'22px', width:'460px', maxWidth:'100%' }}>
            {(() => { const meta = FORMAT_META[formatOf(selected)]; const isDraft = (selected.status ?? 'draft') === 'draft'; return (
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
                <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 9px', borderRadius:'10px', background: meta.color + '22', color: meta.color }}>{meta.label}</span>
                <span style={{ fontSize:'11px', color:'#9B9AB8' }}>{isDraft ? '草稿 / 未排程' : selected.status}</span>
              </div>
            )})()}
            <pre style={{ whiteSpace:'pre-wrap' as any, fontSize:'13px', lineHeight:1.7, margin:'0 0 16px', fontFamily:'inherit', color:'#F0EFFF', maxHeight:'220px', overflowY:'auto' as any, background:'#13131A', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'8px', padding:'12px' }}>{selected.content}</pre>
            <div style={{ fontSize:'12px', fontWeight:'600', color:'#9B9AB8', marginBottom:'6px' }}>發布時間</div>
            <input
              type="datetime-local"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              style={{ width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' as any, marginBottom:'16px', colorScheme:'dark' as any }}
            />
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={removeRow} disabled={busy} style={{ padding:'11px 16px', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'8px', color:'#F87171', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>🗑 刪除</button>
              <button onClick={() => setSelected(null)} style={{ padding:'11px 16px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#9B9AB8', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>關閉</button>
              <button onClick={saveTime} disabled={busy} style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? '處理中…' : '💾 儲存時間'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 快速開始首頁：選產業（記住）＋「今天想發什麼？」四方向 ──
function QuickStartPage({
  displayName, industry, onIndustryChange, onPick,
}: {
  displayName: string
  industry: string
  onIndustryChange: (v: string) => void
  onPick: (key: string) => void
}) {
  const [industries, setIndustries] = useState<{ key: string; name: string }[]>([])
  const [industryErr, setIndustryErr] = useState(false)

  // 產業選項讀 posting_times（讀不到就隱藏選單，不擋首頁）
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('posting_times')
          .select('category_key,category_name,display_order')
          .order('display_order', { ascending: true })
        if (cancelled) return
        if (error || !data) { setIndustryErr(true); return }
        setIndustries(data.map((d: any) => ({ key: d.category_key, name: d.category_name })))
      } catch {
        if (!cancelled) setIndustryErr(true)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const industryName = industries.find(i => i.key === industry)?.name

  return (
    <div>
      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(167,139,250,0.04))', border:'1px solid rgba(124,111,255,0.15)', borderRadius:'14px', padding:'28px', marginBottom:'20px' }}>
        <div style={{ fontSize:'11px', color:'#A78BFA', fontWeight:'700', letterSpacing:'1.5px', marginBottom:'10px' }}>✦ 社群自動駕駛平台</div>
        <div style={{ fontSize:'15px', color:'#9B9AB8', marginBottom:'4px' }}>你好，{displayName} 👋</div>
        <div style={{ fontSize:'30px', fontWeight:'800', lineHeight:1.2 }}>
          <span style={{ background:'linear-gradient(90deg,#7C6FFF,#A78BFA)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>今天想發什麼？</span>
        </div>
        <div style={{ color:'#9B9AB8', marginTop:'8px' }}>選一個方向，我幫你帶好格式跳到編輯。</div>
      </div>

      {/* 產業選一次記住 */}
      <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px', marginBottom:'24px' }}>
        <div style={{ fontSize:'12px', fontWeight:'600', color:'#9B9AB8', marginBottom:'8px' }}>你的產業</div>
        {industryErr ? (
          <div style={{ fontSize:'12px', color:'#9B9AB8' }}>產業選項暫時無法載入（不影響其他功能）</div>
        ) : (
          <select
            value={industry}
            onChange={e => onIndustryChange(e.target.value)}
            style={{ width:'100%', maxWidth:'360px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' }}
          >
            <option value="">請選擇產業（選一次就記住）</option>
            {industries.map(i => (
              <option key={i.key} value={i.key}>{i.name}</option>
            ))}
          </select>
        )}
        {industry && industryName && (
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#34D399', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:'8px', padding:'8px 12px', display:'inline-block' }}>
            ✅ 已記住：{industryName}　之後產出會依這個產業給建議
          </div>
        )}
      </div>

      {/* 四個方向大按鈕 */}
      <div style={{ fontSize:'16px', fontWeight:'700', marginBottom:'14px' }}>選一個方向開始</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'16px' }}>
        {DIRECTIONS.map(d => (
          <button
            key={d.key}
            onClick={() => onPick(d.key)}
            style={{ textAlign:'left', background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderLeft:`3px solid ${d.color}`, borderRadius:'14px', padding:'22px', cursor:'pointer', color:'#F0EFFF', display:'flex', alignItems:'center', gap:'16px' }}
          >
            <div style={{ fontSize:'34px', flexShrink:0 }}>{d.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'17px', fontWeight:'800', marginBottom:'4px' }}>{d.title}</div>
              <div style={{ fontSize:'13px', color:'#9B9AB8' }}>{d.desc}</div>
            </div>
            <div style={{ fontSize:'13px', fontWeight:'700', color:d.color, flexShrink:0 }}>選這個 →</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 尚未接產出邏輯的格式分頁殼（IG限動 / Reels / Threads）──
function FormatPlaceholder({ icon, title, desc, onStart }: { icon: string; title: string; desc: string; onStart: () => void }) {
  return (
    <div>
      <DemoNotice>
        <strong style={{ color:'#FBBF24' }}>此格式的產出功能正在開發中。</strong><br />
        目前為版面示意，下一階段會接上實際的內容產出。
      </DemoNotice>
      <div style={{ background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'48px 24px', textAlign:'center' }}>
        <div style={{ fontSize:'44px', marginBottom:'12px' }}>{icon}</div>
        <div style={{ fontSize:'18px', fontWeight:'800', marginBottom:'8px' }}>{title}</div>
        <div style={{ fontSize:'13px', color:'#9B9AB8', lineHeight:1.7, maxWidth:'420px', margin:'0 auto 20px' }}>{desc}</div>
        <button onClick={onStart} style={{ background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'11px 20px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
          ← 回快速開始
        </button>
      </div>
    </div>
  )
}

// ── 方案分級：各分頁需要的最低方案（前端 UI 用；後端另有 RLS 把關）──
const PLAN_NAME: Record<string, string> = { starter: 'Starter', pro: 'Pro', business: 'Business' }
const FORMAT_PLAN: Record<string, string> = {
  start: 'starter', 'ig-post': 'starter', calendar: 'starter',
  'ig-story': 'pro', threads: 'pro', reels: 'business',
}
// 升級彈窗依方案顯示的賣點
const PLAN_PERKS: Record<string, string[]> = {
  pro: ['解鎖 IG 限動與 Threads 產出', '解鎖全部 Pro 模板（促銷型、節慶）', '無限次一鍵產出', '多帳號管理'],
  business: ['解鎖 Reels 影片產出', '進階排程', '團隊／代理帳號', '包含所有 Pro 功能'],
}

// 高於方案的功能顯示的鎖定畫面（比照鎖 Pro 模板的樣式）
function LockedScreen({ title, requiredPlan, onUpgrade }: { title: string; requiredPlan: string; onUpgrade: () => void }) {
  return (
    <div style={{ background:'#1E1E2E', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'14px', padding:'48px 24px', textAlign:'center' }}>
      <div style={{ fontSize:'44px', marginBottom:'12px' }}>🔒</div>
      <div style={{ fontSize:'18px', fontWeight:'800', marginBottom:'8px' }}>{title}</div>
      <div style={{ fontSize:'13px', color:'#9B9AB8', lineHeight:1.7, maxWidth:'420px', margin:'0 auto 20px' }}>
        此功能需要 <strong style={{ color:'#FBBF24' }}>{PLAN_NAME[requiredPlan]}</strong> 方案才能使用。升級後即可解鎖。
      </div>
      <button onClick={onUpgrade} style={{ background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'11px 20px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
        🔒 升級解鎖
      </button>
    </div>
  )
}

// ── Threads 分頁：零 token 爆款結構產出（短文 / 串文）──
function ThreadsPage({
  userId, industrySuggest, showToast,
}: {
  userId: string
  industrySuggest: { name: string; times: { label: string; time: string }[] } | null
  showToast: (m: string) => void
}) {
  const [topic, setTopic] = useState('')
  const [brand, setBrand] = useState('')
  const [structure, setStructure] = useState('contrarian')
  const isMobile = useIsMobile()
  const [built, setBuilt] = useState<ThreadBuilt | null>(null)
  const [view, setView] = useState<'single' | 'thread'>('single')
  const [generating, setGenerating] = useState(false)
  const [savingCal, setSavingCal] = useState(false)
  const supabase = createClient()

  const card = { background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' } as any
  const label = { fontSize:'12px', fontWeight:'600', color:'#9B9AB8', marginBottom:'6px', display:'block' } as any
  const input = { width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' } as any

  function gen() {
    setGenerating(true)
    const r = buildThreads(structure, { brand, topic })
    setTimeout(() => { setBuilt(r); setGenerating(false) }, 200)
  }

  function currentText(): string {
    if (!built) return ''
    return view === 'single' ? built.single : joinThread(built.thread)
  }

  function copy() {
    if (!built) return
    navigator.clipboard.writeText(currentText())
    showToast('✅ 已複製')
  }

  async function addToCal() {
    if (!built || !userId) return
    setSavingCal(true)
    const base = {
      user_id: userId,
      platform: 'threads',
      content: currentText(),
      scheduled_at: computeSuggestedAt(industrySuggest?.times).toISOString(),
      status: 'draft',
    }
    let { error } = await supabase.from('schedules').insert({ ...base, format: 'threads' })
    if (error && /format/i.test(error.message)) {
      ;({ error } = await supabase.from('schedules').insert(base))
    }
    setSavingCal(false)
    if (error) { showToast('❌ 加入行事曆失敗：' + error.message); return }
    showToast('📅 已加入行事曆（草稿）')
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap:'20px' }}>
      {/* 左：設定 */}
      <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
        <div style={card}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'16px' }}>基本資訊</div>
          <label style={label}>這篇要講的主題</label>
          <input style={{ ...input, marginBottom:'14px' }} value={topic} onChange={e => setTopic(e.target.value)} placeholder="例：自媒體經營、接案報價" />
          <label style={label}>你的帳號名稱（可留空）</label>
          <input style={input} value={brand} onChange={e => setBrand(e.target.value)} placeholder="例：Elena" />
        </div>
        <div style={card}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'12px' }}>爆款結構（為高互動設計）</div>
          <div style={{ display:'flex', flexDirection:'column' as any, gap:'8px' }}>
            {THREAD_STRUCTURES.map(s => (
              <button
                key={s.key}
                onClick={() => setStructure(s.key)}
                style={{ textAlign:'left', padding:'12px 14px', borderRadius:'10px', cursor:'pointer', background: structure===s.key ? 'rgba(124,111,255,0.12)' : '#13131A', border: structure===s.key ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)', color:'#F0EFFF' }}
              >
                <div style={{ fontSize:'14px', fontWeight:'700', color: structure===s.key ? '#A78BFA' : '#F0EFFF' }}>{s.label}</div>
                <div style={{ fontSize:'12px', color:'#9B9AB8', marginTop:'2px' }}>{s.hint}</div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={gen} disabled={generating} style={{ background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'14px', fontSize:'15px', fontWeight:'700', cursor:'pointer', width:'100%', opacity: generating ? 0.7 : 1 }}>
          {generating ? '⏳ 生成中...' : '✦ 一鍵生成'}
        </button>
      </div>

      {/* 右：產出 */}
      <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div style={{ fontWeight:'700', fontSize:'13px' }}>🧵 產出結果</div>
            {built && <button onClick={gen} style={{ background:'transparent', color:'#9B9AB8', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'5px 10px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>↺ 換一版</button>}
          </div>

          {!built ? (
            <div style={{ minHeight:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#5C5B78', fontSize:'13px', flexDirection:'column' as any, gap:'8px' }}>
              <div style={{ fontSize:'28px', opacity:0.4 }}>🧵</div>
              <div>填好主題、選結構後點生成</div>
            </div>
          ) : (
            <>
              {/* 短文 / 串文 切換 */}
              <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
                {([['single','短文'],['thread','串文']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setView(k)} style={{ flex:1, padding:'8px', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer', background: view===k ? 'rgba(124,111,255,0.15)' : '#13131A', color: view===k ? '#A78BFA' : '#9B9AB8', border: view===k ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize:'11px', color:'#5C5B78', marginBottom:'10px' }}>結構：{built.structureLabel}</div>

              {view === 'single' ? (
                <pre style={{ whiteSpace:'pre-wrap' as any, fontSize:'14px', lineHeight:1.8, margin:0, fontFamily:'inherit', color:'#F0EFFF' }}>{built.single}</pre>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' as any, gap:'8px' }}>
                  {built.thread.map((p, i) => (
                    <div key={i} style={{ background:'#13131A', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'8px', padding:'10px 12px' }}>
                      <div style={{ fontSize:'10px', fontWeight:'700', color:'#7C6FFF', marginBottom:'4px' }}>第 {i + 1} 則</div>
                      <div style={{ fontSize:'13.5px', lineHeight:1.7, color:'#F0EFFF', whiteSpace:'pre-wrap' as any }}>{p}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {built && (
          <div style={card}>
            {industrySuggest && industrySuggest.times.length > 0 && (
              <div style={{ fontSize:'12px', color:'#A78BFA', background:'rgba(124,111,255,0.08)', border:'1px solid rgba(124,111,255,0.2)', borderRadius:'8px', padding:'8px 10px', marginBottom:'12px', lineHeight:1.6 }}>
                🕒 <strong>{industrySuggest.name}</strong> 建議時段：{industrySuggest.times.map(t => `${t.label} ${t.time}`).join('；')}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              <button onClick={copy} style={{ background:'transparent', color:'#9B9AB8', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'10px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>📋 複製{view==='single' ? '短文' : '串文'}</button>
              <button onClick={addToCal} disabled={savingCal} style={{ background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', opacity: savingCal ? 0.7 : 1 }}>{savingCal ? '⏳ 加入中…' : '📅 加入行事曆'}</button>
            </div>
            <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'10px', lineHeight:1.6 }}>
              產出模式：只產內容、不自動發布。以上為高互動設計的爆款結構參考，實際成效仍取決於主題與受眾。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── IG 限動分頁：畫面文字 + 貼紙建議 + Canvas 底圖下載 ──
function IgStoryPage({
  userId, industrySuggest, showToast,
}: {
  userId: string
  industrySuggest: { name: string; times: { label: string; time: string }[] } | null
  showToast: (m: string) => void
}) {
  const [topic, setTopic] = useState('')
  const [brand, setBrand] = useState('')
  const [angle, setAngle] = useState('poll_thisthat')
  const isMobile = useIsMobile()
  const [built, setBuilt] = useState<StoryBuilt | null>(null)
  const [generating, setGenerating] = useState(false)
  const [savingCal, setSavingCal] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const supabase = createClient()

  const card = { background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' } as any
  const label = { fontSize:'12px', fontWeight:'600', color:'#9B9AB8', marginBottom:'6px', display:'block' } as any
  const input = { width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' } as any

  function gen() {
    setGenerating(true)
    const r = buildStory(angle, { brand, topic })
    setTimeout(() => { setBuilt(r); setGenerating(false) }, 200)
  }

  function copy() {
    if (!built) return
    navigator.clipboard.writeText(composeStory(built))
    showToast('✅ 已複製文案＋貼紙建議')
  }

  async function download() {
    if (!built) return
    setDownloading(true)
    const blob = await renderStoryImage(built.screenText, brand)
    setDownloading(false)
    if (!blob) { showToast('❌ 底圖產生失敗'); return }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `postpilot_story_${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
    showToast('🖼️ 底圖已下載')
  }

  async function addToCal() {
    if (!built || !userId) return
    setSavingCal(true)
    const base = {
      user_id: userId,
      platform: 'ig',
      content: composeStory(built),
      scheduled_at: computeSuggestedAt(industrySuggest?.times).toISOString(),
      status: 'draft',
    }
    let { error } = await supabase.from('schedules').insert({ ...base, format: 'ig_story' })
    if (error && /format/i.test(error.message)) {
      ;({ error } = await supabase.from('schedules').insert(base))
    }
    setSavingCal(false)
    if (error) { showToast('❌ 加入行事曆失敗：' + error.message); return }
    showToast('📅 已加入行事曆（草稿）')
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 400px', gap:'20px' }}>
      {/* 左：設定 */}
      <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
        <div style={card}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'16px' }}>基本資訊</div>
          <label style={label}>這則限動的主題</label>
          <input style={{ ...input, marginBottom:'14px' }} value={topic} onChange={e => setTopic(e.target.value)} placeholder="例：新品上架、本週優惠" />
          <label style={label}>你的帳號名稱（會印在底圖下方，可留空）</label>
          <input style={input} value={brand} onChange={e => setBrand(e.target.value)} placeholder="例：Elena" />
        </div>
        <div style={card}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'12px' }}>互動角度</div>
          <div style={{ display:'flex', flexDirection:'column' as any, gap:'8px' }}>
            {STORY_ANGLES.map(a => (
              <button
                key={a.key}
                onClick={() => setAngle(a.key)}
                style={{ textAlign:'left', padding:'12px 14px', borderRadius:'10px', cursor:'pointer', background: angle===a.key ? 'rgba(124,111,255,0.12)' : '#13131A', border: angle===a.key ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)', color:'#F0EFFF' }}
              >
                <div style={{ fontSize:'14px', fontWeight:'700', color: angle===a.key ? '#A78BFA' : '#F0EFFF' }}>{a.label}</div>
                <div style={{ fontSize:'12px', color:'#9B9AB8', marginTop:'2px' }}>{a.hint}</div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={gen} disabled={generating} style={{ background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'14px', fontSize:'15px', fontWeight:'700', cursor:'pointer', width:'100%', opacity: generating ? 0.7 : 1 }}>
          {generating ? '⏳ 生成中...' : '✦ 一鍵生成'}
        </button>
      </div>

      {/* 右：產出 */}
      <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div style={{ fontWeight:'700', fontSize:'13px' }}>⭕ 產出結果</div>
            {built && <button onClick={gen} style={{ background:'transparent', color:'#9B9AB8', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'5px 10px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>↺ 換一版</button>}
          </div>

          {!built ? (
            <div style={{ minHeight:'320px', display:'flex', alignItems:'center', justifyContent:'center', color:'#5C5B78', fontSize:'13px', flexDirection:'column' as any, gap:'8px' }}>
              <div style={{ fontSize:'28px', opacity:0.4 }}>⭕</div>
              <div>填好主題、選角度後點生成</div>
            </div>
          ) : (
            <>
              {/* 9:16 底圖預覽 */}
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'14px' }}>
                <div style={{ width:'200px', height:'356px', borderRadius:'14px', background:'linear-gradient(135deg,#13131A 0%,#241f45 55%,#0D0D12 100%)', border:'1px solid rgba(255,255,255,0.1)', position:'relative' as any, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', boxSizing:'border-box' as any }}>
                  <div style={{ color:'#F0EFFF', fontSize:'16px', fontWeight:'800', textAlign:'center' as any, lineHeight:1.5, whiteSpace:'pre-wrap' as any }}>{built.screenText}</div>
                  {brand && <div style={{ position:'absolute' as any, bottom:'14px', left:0, right:0, textAlign:'center' as any, color:'#A78BFA', fontSize:'11px', fontWeight:'700' }}>@{brand}</div>}
                </div>
              </div>

              {/* 貼紙建議 */}
              <div style={{ background:'#13131A', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px', padding:'12px 14px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:'#FBBF24', marginBottom:'8px' }}>建議互動貼紙</div>
                {built.sticker.type === 'poll' ? (
                  <div style={{ fontSize:'13px', lineHeight:1.7, color:'#F0EFFF' }}>
                    <div style={{ marginBottom:'6px' }}>📊 投票：{built.sticker.question}</div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <span style={{ flex:1, textAlign:'center' as any, background:'rgba(124,111,255,0.12)', border:'1px solid rgba(124,111,255,0.3)', borderRadius:'8px', padding:'6px', fontSize:'12px' }}>{built.sticker.optionA}</span>
                      <span style={{ flex:1, textAlign:'center' as any, background:'rgba(124,111,255,0.12)', border:'1px solid rgba(124,111,255,0.3)', borderRadius:'8px', padding:'6px', fontSize:'12px' }}>{built.sticker.optionB}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:'13px', lineHeight:1.7, color:'#F0EFFF' }}>❓ 問答：{built.sticker.prompt}</div>
                )}
              </div>
            </>
          )}
        </div>

        {built && (
          <>
            {/* 貼紙需手動加的提示 */}
            <div style={{ display:'flex', gap:'10px', alignItems:'flex-start', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'10px', padding:'12px 14px' }}>
              <span style={{ fontSize:'14px' }}>⚠️</span>
              <div style={{ fontSize:'12px', color:'#E3CE96', lineHeight:1.7 }}>
                投票／問答<strong>貼紙無法用程式預先加入</strong>。請下載底圖後，在 IG App 發佈限動時：點上方<strong>貼圖工具</strong> → 選「投票」或「問答」→ 把上面建議的題目與選項打上去。
              </div>
            </div>

            <div style={card}>
              {industrySuggest && industrySuggest.times.length > 0 && (
                <div style={{ fontSize:'12px', color:'#A78BFA', background:'rgba(124,111,255,0.08)', border:'1px solid rgba(124,111,255,0.2)', borderRadius:'8px', padding:'8px 10px', marginBottom:'12px', lineHeight:1.6 }}>
                  🕒 <strong>{industrySuggest.name}</strong> 建議時段：{industrySuggest.times.map(t => `${t.label} ${t.time}`).join('；')}
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <button onClick={copy} style={{ background:'transparent', color:'#9B9AB8', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'10px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>📋 複製文案</button>
                <button onClick={download} disabled={downloading} style={{ background:'transparent', color:'#9B9AB8', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'10px', fontSize:'13px', fontWeight:'600', cursor:'pointer', opacity: downloading ? 0.7 : 1 }}>{downloading ? '⏳ 產生中…' : '🖼️ 下載底圖'}</button>
                <button onClick={addToCal} disabled={savingCal} style={{ gridColumn:'1 / -1', background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'11px', fontSize:'13px', fontWeight:'700', cursor:'pointer', opacity: savingCal ? 0.7 : 1 }}>{savingCal ? '⏳ 加入中…' : '📅 加入行事曆'}</button>
              </div>
              <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'10px', lineHeight:1.6 }}>
                產出模式：只產內容、不自動發布。底圖以瀏覽器合成（9:16、1080×1920），繁中用系統字型。
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Reels 分頁：零 token 影片組裝（Canvas 動畫 + MediaRecorder 匯出，內嵌音樂）──
const REELS_TEMPLATES = [
  { key: 'bullets',     label: '重點條列', hint: '標題＋逐點浮現' },
  { key: 'quote',       label: '語錄卡',   hint: '一句話置中放大' },
  { key: 'carousel',    label: '圖片輪播', hint: '多張圖依序播放' },
  { key: 'beforeafter', label: '前後對比', hint: '兩張圖 前 → 後' },
]
const REELS_MONTHLY_CAP = 10   // Business 每月可匯出支數（先用前端計數；之後可接後端）

function reelsMonthKey() {
  const d = new Date()
  return `pp_reels_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const s = Math.max(W / img.width, H / img.height)
  const w = img.width * s, h = img.height * s
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let cur = ''
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch }
      else cur += ch
    }
    out.push(cur)
  }
  return out
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60)
  return `${m}:${String(ss).padStart(2, '0')}`
}

// 上傳影片 → 裁剪（起點/終點）→ 疊標題 → 保留原聲或換音樂 → 匯出 9:16
function ReelsVideoEditor({ showToast }: { showToast: (m: string) => void }) {
  const isMobile = useIsMobile()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoName, setVideoName] = useState('')
  const [dur, setDur] = useState(0)
  const [cur, setCur] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [title, setTitle] = useState('')
  const [replaceAudio, setReplaceAudio] = useState(false)
  const [musicUrl, setMusicUrl] = useState('')
  const [musicName, setMusicName] = useState('')
  const [rendering, setRendering] = useState(false)
  const [used, setUsed] = useState(0)
  const W = 720, H = 1280

  useEffect(() => {
    try { setUsed(parseInt(localStorage.getItem(reelsMonthKey()) || '0', 10) || 0) } catch {}
  }, [])
  const remaining = Math.max(0, REELS_MONTHLY_CAP - used)
  const clipLen = Math.max(0, trimEnd - trimStart)

  function onVideo(files: FileList | null) {
    if (!files || !files[0]) return
    setVideoUrl(URL.createObjectURL(files[0]))
    setVideoName(files[0].name)
  }
  function onMusic(files: FileList | null) {
    if (!files || !files[0]) return
    setMusicUrl(URL.createObjectURL(files[0]))
    setMusicName(files[0].name)
    setReplaceAudio(true)
  }
  function onLoadedMeta() {
    const v = videoRef.current; if (!v) return
    const d = v.duration || 0
    setDur(d); setTrimStart(0); setTrimEnd(Math.min(d, 90))
  }
  function setStartHere() { const v = videoRef.current; if (v) setTrimStart(Math.min(v.currentTime, trimEnd - 0.1)) }
  function setEndHere() { const v = videoRef.current; if (v) setTrimEnd(Math.min(Math.max(v.currentTime, trimStart + 0.1), trimStart + 90)) }

  function drawVideoFrame(ctx: CanvasRenderingContext2D, v: HTMLVideoElement) {
    ctx.fillStyle = '#0D0D12'; ctx.fillRect(0, 0, W, H)
    const vw = v.videoWidth, vh = v.videoHeight
    if (vw && vh) {
      const s = Math.max(W / vw, H / vh)
      const w = vw * s, h = vh * s
      ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h)
    }
    if (title) {
      ctx.fillStyle = 'rgba(13,13,18,0.5)'; ctx.fillRect(0, H - 240, W, 240)
      ctx.fillStyle = '#F0EFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = 'bold 52px "PingFang TC","Microsoft JhengHei",sans-serif'
      wrapLines(ctx, title, W - 140).forEach((ln, i) => ctx.fillText(ln, W / 2, H - 160 + i * 62))
    }
  }

  async function exportClip() {
    const v = videoRef.current, canvas = canvasRef.current
    if (!videoUrl || !v || !canvas) { showToast('請先上傳影片'); return }
    if (remaining <= 0) { showToast('本月匯出額度已用完（可加購包）'); return }
    if (clipLen <= 0) { showToast('請設定有效的裁剪範圍'); return }
    if (typeof MediaRecorder === 'undefined' || !(canvas as any).captureStream) {
      showToast('此瀏覽器不支援影片匯出，請用最新版 Chrome / Edge'); return
    }
    setRendering(true)
    try {
      const ctx = canvas.getContext('2d')!
      v.pause(); v.currentTime = trimStart
      await new Promise<void>(res => { const h = () => { v.removeEventListener('seeked', h); res() }; v.addEventListener('seeked', h) })
      const stream: MediaStream = (canvas as any).captureStream(30)
      let audioCtx: AudioContext | null = null, musicEl: HTMLAudioElement | null = null
      if (replaceAudio && musicUrl) {
        v.muted = true
        audioCtx = new AudioContext(); musicEl = new Audio(musicUrl)
        const src = audioCtx.createMediaElementSource(musicEl)
        const dest = audioCtx.createMediaStreamDestination()
        src.connect(dest); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t))
        await musicEl.play().catch(() => {})
      } else {
        v.muted = false
        const vs = (v as any).captureStream?.() || (v as any).mozCaptureStream?.()
        vs?.getAudioTracks?.().forEach((t: MediaStreamTrack) => stream.addTrack(t))
      }
      const mime = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      const chunks: BlobPart[] = []
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      const done = new Promise<void>(res => { rec.onstop = () => res() })
      rec.start()
      await v.play()
      await new Promise<void>(res => {
        const tick = () => {
          drawVideoFrame(ctx, v)
          setCur(v.currentTime)
          if (v.currentTime >= trimEnd || v.ended) res()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      rec.stop(); await done
      v.pause(); if (musicEl) musicEl.pause(); if (audioCtx) audioCtx.close()
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(new Blob(chunks, { type: mime }))
      const a = document.createElement('a')
      a.href = url; a.download = `postpilot_clip_${Date.now()}.${ext}`; a.click()
      URL.revokeObjectURL(url)
      const next = used + 1; setUsed(next)
      try { localStorage.setItem(reelsMonthKey(), String(next)) } catch {}
      showToast(`🎬 影片已匯出（.${ext}）`)
    } catch (e: any) {
      showToast('❌ 匯出失敗：' + (e?.message || '未知錯誤'))
    } finally {
      setRendering(false)
    }
  }

  const card = { background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' } as any
  const label = { fontSize:'12px', fontWeight:'600', color:'#9B9AB8', marginBottom:'6px', display:'block' } as any
  const input = { width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' } as any

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap:'20px' }}>
      <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
        <div style={card}>
          <label style={label}>上傳影片</label>
          <input type="file" accept="video/*" onChange={e => onVideo(e.target.files)} style={{ fontSize:'12px', color:'#9B9AB8' }} />
          {videoName && <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'6px' }}>🎞 {videoName}{dur ? `（${fmtTime(dur)}）` : ''}</div>}
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              onLoadedMetadata={onLoadedMeta}
              onTimeUpdate={() => setCur(videoRef.current?.currentTime ?? 0)}
              style={{ width:'100%', maxHeight:'320px', marginTop:'12px', borderRadius:'8px', background:'#000' }}
            />
          )}
        </div>

        {videoUrl && (
          <div style={card}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'12px' }}>裁剪（播放到想要的位置，再設起點／終點）</div>
            <div style={{ fontSize:'13px', color:'#F0EFFF', marginBottom:'10px' }}>目前播放位置：<strong>{fmtTime(cur)}</strong></div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
              <button onClick={setStartHere} style={{ flex:1, padding:'9px', borderRadius:'8px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', color:'#9B9AB8', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>⏱ 設為起點</button>
              <button onClick={setEndHere} style={{ flex:1, padding:'9px', borderRadius:'8px', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', color:'#9B9AB8', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>設為終點 ⏱</button>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', color:'#A78BFA', fontWeight:'700' }}>
              <span>起點 {fmtTime(trimStart)}</span>
              <span style={{ color: clipLen > 90 ? '#F87171' : '#34D399' }}>長度 {fmtTime(clipLen)}</span>
              <span>終點 {fmtTime(trimEnd)}</span>
            </div>
            {clipLen > 90 && <div style={{ fontSize:'11px', color:'#F87171', marginTop:'6px' }}>建議裁剪在 90 秒內</div>}
          </div>
        )}

        <div style={card}>
          <label style={label}>疊加標題文字（可留空）</label>
          <input style={{ ...input, marginBottom:'16px' }} value={title} onChange={e => setTitle(e.target.value)} placeholder="會壓在影片下方" />
          <label style={label}>聲音</label>
          <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
            <button onClick={() => setReplaceAudio(false)} style={{ flex:1, padding:'9px', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer', background: !replaceAudio ? 'rgba(124,111,255,0.15)' : '#13131A', color: !replaceAudio ? '#A78BFA' : '#9B9AB8', border: !replaceAudio ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>保留原聲</button>
            <button onClick={() => setReplaceAudio(true)} style={{ flex:1, padding:'9px', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer', background: replaceAudio ? 'rgba(124,111,255,0.15)' : '#13131A', color: replaceAudio ? '#A78BFA' : '#9B9AB8', border: replaceAudio ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>換音樂</button>
          </div>
          {replaceAudio && (
            <div>
              <input type="file" accept="audio/*" onChange={e => onMusic(e.target.files)} style={{ fontSize:'12px', color:'#9B9AB8' }} />
              {musicName && <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'6px' }}>♪ {musicName}</div>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-start', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'10px', padding:'12px 14px' }}>
          <span style={{ fontSize:'14px' }}>⚠️</span>
          <div style={{ fontSize:'12px', color:'#E3CE96', lineHeight:1.7 }}>
            透過 API 發布時<strong>不能使用 IG 熱門音檔</strong>。換音樂請用<strong>自有／已授權</strong>的檔案。
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize:'12px', color:'#9B9AB8', marginBottom:'10px' }}>本月已匯出 <strong style={{ color:'#F0EFFF' }}>{used}</strong> / {REELS_MONTHLY_CAP} 支，剩 <strong style={{ color: remaining>0 ? '#34D399' : '#F87171' }}>{remaining}</strong> 支</div>
          <button onClick={exportClip} disabled={rendering || remaining<=0 || !videoUrl} style={{ width:'100%', background: (remaining<=0||!videoUrl) ? '#2a2a38' : 'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'13px', fontSize:'14px', fontWeight:'700', cursor: (rendering||remaining<=0||!videoUrl) ? 'default' : 'pointer', opacity: rendering ? 0.7 : 1 }}>
            {rendering ? `⏳ 匯出中…（到 ${fmtTime(cur)}）` : remaining<=0 ? '本月額度已用完' : '🎬 匯出裁剪影片'}
          </button>
          <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'10px', lineHeight:1.6 }}>
            實驗性功能：以瀏覽器即時錄製（不燒 token）。匯出時請保持此分頁在前景、不要切走。輸出格式依瀏覽器支援（多為 .webm）。
          </div>
        </div>
        {/* 匯出用的離屏畫布 */}
        <canvas ref={canvasRef} width={W} height={H} style={{ display:'none' }} />
      </div>
    </div>
  )
}

function ReelsPage({ showToast }: { showToast: (m: string) => void }) {
  const isMobile = useIsMobile()
  const [mode, setMode] = useState<'assemble' | 'video'>('assemble')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const [template, setTemplate] = useState('bullets')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [duration, setDuration] = useState(15)
  const [imageNames, setImageNames] = useState<string[]>([])
  const [musicUrl, setMusicUrl] = useState('')
  const [musicName, setMusicName] = useState('')
  const [scrub, setScrub] = useState(0)
  const [rendering, setRendering] = useState(false)
  const [used, setUsed] = useState(0)

  const W = 720, H = 1280   // 9:16 匯出解析度

  useEffect(() => {
    try { setUsed(parseInt(localStorage.getItem(reelsMonthKey()) || '0', 10) || 0) } catch {}
  }, [])

  const remaining = Math.max(0, REELS_MONTHLY_CAP - used)

  // 畫某個進度 (0..1) 的一幀
  const drawAt = useCallback((progress: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    // 背景
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#13131A'); g.addColorStop(0.55, '#241f45'); g.addColorStop(1, '#0D0D12')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const imgs = imagesRef.current
    const points = body.split('\n').map(s => s.trim()).filter(Boolean)

    if (template === 'carousel' || template === 'beforeafter') {
      if (imgs.length) {
        const idx = template === 'beforeafter'
          ? (progress < 0.5 ? 0 : Math.min(1, imgs.length - 1))
          : Math.min(imgs.length - 1, Math.floor(progress * imgs.length))
        drawCover(ctx, imgs[idx], W, H)
        ctx.fillStyle = 'rgba(13,13,18,0.55)'; ctx.fillRect(0, H - 260, W, 260)
      }
      ctx.fillStyle = '#F0EFFF'
      if (template === 'beforeafter') {
        ctx.font = 'bold 64px "PingFang TC","Microsoft JhengHei",sans-serif'
        ctx.fillText(progress < 0.5 ? '前' : '後', W / 2, 120)
      }
      if (title) {
        ctx.font = 'bold 52px "PingFang TC","Microsoft JhengHei",sans-serif'
        wrapLines(ctx, title, W - 160).forEach((ln, i) => ctx.fillText(ln, W / 2, H - 180 + i * 62))
      }
    } else if (template === 'quote') {
      const scale = 1 + 0.06 * progress
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(scale, scale)
      ctx.fillStyle = '#F0EFFF'
      ctx.font = 'bold 60px "PingFang TC","Microsoft JhengHei",sans-serif'
      const q = body || title || '在這裡放一句話'
      const lines = wrapLines(ctx, q, W - 200)
      lines.forEach((ln, i) => ctx.fillText(ln, 0, (i - (lines.length - 1) / 2) * 84))
      ctx.restore()
    } else {
      // bullets：標題在上，重點逐點浮現
      ctx.fillStyle = '#A78BFA'
      ctx.font = 'bold 64px "PingFang TC","Microsoft JhengHei",sans-serif'
      wrapLines(ctx, title || '你的標題', W - 140).forEach((ln, i) => ctx.fillText(ln, W / 2, 260 + i * 76))
      const shown = points.length ? Math.min(points.length, Math.floor(progress * points.length) + 1) : 0
      ctx.font = 'bold 46px "PingFang TC","Microsoft JhengHei",sans-serif'
      ctx.fillStyle = '#F0EFFF'
      for (let i = 0; i < shown; i++) {
        wrapLines(ctx, `${i + 1}. ${points[i]}`, W - 160).forEach((ln, j) =>
          ctx.fillText(ln, W / 2, 560 + i * 120 + j * 56))
      }
    }
  }, [template, title, body, W, H])

  useEffect(() => { drawAt(scrub) }, [drawAt, scrub])

  function onImages(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files).slice(0, 8)
    setImageNames(arr.map(f => f.name))
    imagesRef.current = []
    arr.forEach(f => {
      const img = new Image()
      img.onload = () => drawAt(scrub)
      img.src = URL.createObjectURL(f)
      imagesRef.current.push(img)
    })
  }

  function onMusic(files: FileList | null) {
    if (!files || !files[0]) return
    setMusicUrl(URL.createObjectURL(files[0]))
    setMusicName(files[0].name)
  }

  async function exportVideo() {
    const canvas = canvasRef.current
    if (!canvas) return
    if (remaining <= 0) { showToast('本月匯出額度已用完（可加購包）'); return }
    if (typeof MediaRecorder === 'undefined' || !(canvas as any).captureStream) {
      showToast('此瀏覽器不支援影片匯出，請用最新版 Chrome / Edge'); return
    }
    setRendering(true)
    try {
      const fps = 30
      const stream: MediaStream = (canvas as any).captureStream(fps)
      let audioCtx: AudioContext | null = null
      let audioEl: HTMLAudioElement | null = null
      if (musicUrl) {
        audioCtx = new AudioContext()
        audioEl = new Audio(musicUrl)
        const srcNode = audioCtx.createMediaElementSource(audioEl)
        const dest = audioCtx.createMediaStreamDestination()
        srcNode.connect(dest)
        dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr))
        await audioEl.play().catch(() => {})
      }
      const mime = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      const chunks: BlobPart[] = []
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      const done = new Promise<void>(res => { rec.onstop = () => res() })
      rec.start()
      const start = performance.now()
      await new Promise<void>(res => {
        const tick = (now: number) => {
          const p = Math.min((now - start) / 1000 / duration, 1)
          setScrub(p); drawAt(p)
          if (p < 1) requestAnimationFrame(tick); else res()
        }
        requestAnimationFrame(tick)
      })
      rec.stop()
      await done
      if (audioEl) audioEl.pause()
      if (audioCtx) audioCtx.close()
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunks, { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `postpilot_reels_${Date.now()}.${ext}`; a.click()
      URL.revokeObjectURL(url)
      const next = used + 1
      setUsed(next)
      try { localStorage.setItem(reelsMonthKey(), String(next)) } catch {}
      showToast(`🎬 影片已匯出（.${ext}）`)
    } catch (e: any) {
      showToast('❌ 匯出失敗：' + (e?.message || '未知錯誤'))
    } finally {
      setRendering(false)
    }
  }

  const card = { background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' } as any
  const label = { fontSize:'12px', fontWeight:'600', color:'#9B9AB8', marginBottom:'6px', display:'block' } as any
  const input = { width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' } as any
  const needImages = template === 'carousel' || template === 'beforeafter'

  return (
    <div>
      {/* 圖文組裝 / 影片剪輯 切換 */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        <button onClick={() => setMode('assemble')} style={{ padding:'9px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer', background: mode==='assemble' ? 'rgba(124,111,255,0.15)' : '#13131A', color: mode==='assemble' ? '#A78BFA' : '#9B9AB8', border: mode==='assemble' ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>🎬 圖文組裝</button>
        <button onClick={() => setMode('video')} style={{ padding:'9px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer', background: mode==='video' ? 'rgba(124,111,255,0.15)' : '#13131A', color: mode==='video' ? '#A78BFA' : '#9B9AB8', border: mode==='video' ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>✂️ 影片剪輯</button>
      </div>

      {mode === 'video' ? (
        <ReelsVideoEditor showToast={showToast} />
      ) : (
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap:'20px' }}>
        {/* 左：設定 */}
        <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
          <div style={{ display:'flex', gap:'10px', alignItems:'flex-start', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'10px', padding:'12px 14px' }}>
            <span style={{ fontSize:'14px' }}>⚠️</span>
            <div style={{ fontSize:'12px', color:'#E3CE96', lineHeight:1.7 }}>
              透過 API 發布時<strong>不能使用 IG 熱門音檔</strong>（版權限制）。請上傳<strong>自有或已授權</strong>的音樂。
            </div>
          </div>

        <div style={card}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'12px' }}>影片模板</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            {REELS_TEMPLATES.map(tm => (
              <button key={tm.key} onClick={() => setTemplate(tm.key)} style={{ textAlign:'left', padding:'12px 14px', borderRadius:'10px', cursor:'pointer', background: template===tm.key ? 'rgba(124,111,255,0.12)' : '#13131A', border: template===tm.key ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)', color:'#F0EFFF' }}>
                <div style={{ fontSize:'14px', fontWeight:'700', color: template===tm.key ? '#A78BFA' : '#F0EFFF' }}>{tm.label}</div>
                <div style={{ fontSize:'11px', color:'#9B9AB8', marginTop:'2px' }}>{tm.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <label style={label}>標題 / 主字</label>
          <input style={{ ...input, marginBottom:'14px' }} value={title} onChange={e => setTitle(e.target.value)} placeholder="例：3 個提高轉換的小技巧" />
          <label style={label}>{template==='quote' ? '語錄內容' : '重點內容（一行一點）'}</label>
          <textarea style={{ ...input, minHeight:'110px', resize:'vertical' as any, fontFamily:'inherit', lineHeight:1.7 }} value={body} onChange={e => setBody(e.target.value)} placeholder={template==='quote' ? '把一句想被記住的話放這裡' : '第一點\n第二點\n第三點'} />

          {needImages && (
            <div style={{ marginTop:'14px' }}>
              <label style={label}>圖片（{template==='beforeafter' ? '2 張：前、後' : '最多 8 張'}）</label>
              <input type="file" accept="image/*" multiple onChange={e => onImages(e.target.files)} style={{ fontSize:'12px', color:'#9B9AB8' }} />
              {imageNames.length > 0 && <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'6px' }}>已選 {imageNames.length} 張</div>}
            </div>
          )}

          <div style={{ marginTop:'14px' }}>
            <label style={label}>音樂（自有／授權，會內嵌進影片）</label>
            <input type="file" accept="audio/*" onChange={e => onMusic(e.target.files)} style={{ fontSize:'12px', color:'#9B9AB8' }} />
            {musicName && <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'6px' }}>♪ {musicName}</div>}
          </div>

          <div style={{ marginTop:'16px' }}>
            <label style={label}>長度：{duration} 秒</label>
            <input type="range" min={5} max={90} value={duration} onChange={e => setDuration(parseInt(e.target.value, 10))} style={{ width:'100%' }} />
          </div>
        </div>
      </div>

      {/* 右：預覽 + 匯出 */}
      <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
        <div style={card}>
          <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'12px' }}>9:16 預覽</div>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <canvas ref={canvasRef} width={W} height={H} style={{ width:'202px', height:'360px', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.1)', background:'#0D0D12' }} />
          </div>
          <div style={{ marginTop:'12px' }}>
            <label style={{ ...label, marginBottom:'4px' }}>預覽進度</label>
            <input type="range" min={0} max={1} step={0.01} value={scrub} onChange={e => setScrub(parseFloat(e.target.value))} style={{ width:'100%' }} />
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize:'12px', color:'#9B9AB8', marginBottom:'10px' }}>本月已匯出 <strong style={{ color:'#F0EFFF' }}>{used}</strong> / {REELS_MONTHLY_CAP} 支，剩 <strong style={{ color: remaining>0 ? '#34D399' : '#F87171' }}>{remaining}</strong> 支</div>
          <button onClick={exportVideo} disabled={rendering || remaining<=0} style={{ width:'100%', background: remaining<=0 ? '#2a2a38' : 'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'13px', fontSize:'14px', fontWeight:'700', cursor: rendering||remaining<=0 ? 'default' : 'pointer', opacity: rendering ? 0.7 : 1 }}>
            {rendering ? `⏳ 渲染中…（${Math.round(scrub*100)}%）` : remaining<=0 ? '本月額度已用完' : '🎬 匯出影片'}
          </button>
          <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'10px', lineHeight:1.6 }}>
            以瀏覽器即時渲染（Canvas＋MediaRecorder），不燒 AI token。渲染時請保持此分頁在前景。輸出格式依瀏覽器支援（多為 .webm）。
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  )
}

// ── 帳號連結 / 設定：自動發布的地基（讀真實連結狀態；連結鈕待 Meta 憑證接上）──
function SettingsPage({ userId, showToast }: { userId: string; showToast: (m: string) => void }) {
  const [ig, setIg] = useState<string | null>(null)
  const [threads, setThreads] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('profiles').select('ig_account,threads_account').eq('id', userId).maybeSingle()
      if (cancelled) return
      if (data) { setIg(data.ig_account ?? null); setThreads(data.threads_account ?? null) }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const card = { background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' } as any

  function ConnectCard({ icon, name, account, limit }: { icon: string; name: string; account: string | null; limit: string }) {
    const connected = !!account
    return (
      <div style={{ ...card, marginBottom:'14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
          <span style={{ fontSize:'24px' }}>{icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'15px', fontWeight:'700' }}>{name}</div>
            <div style={{ fontSize:'12px', color: connected ? '#34D399' : '#9B9AB8' }}>
              {loading ? '讀取中…' : connected ? `已連結：${account}` : '未連結任何帳號'}
            </div>
          </div>
          <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 9px', borderRadius:'10px', background: connected ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)', color: connected ? '#34D399' : '#9B9AB8' }}>
            {connected ? '已連結' : '未連結'}
          </span>
        </div>
        <button
          onClick={() => showToast('帳號連結待 Meta 設定完成後開放')}
          disabled
          style={{ width:'100%', padding:'11px', borderRadius:'8px', border:'1px dashed rgba(255,255,255,0.15)', background:'#13131A', color:'#5C5B78', fontSize:'13px', fontWeight:'600', cursor:'not-allowed' }}
        >
          🔗 連結 {name}（待 Meta 設定後開放）
        </button>
        <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'8px', lineHeight:1.6 }}>發布上限：{limit}</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth:'720px' }}>
      <div style={{ display:'flex', gap:'10px', alignItems:'flex-start', background:'rgba(124,111,255,0.06)', border:'1px solid rgba(124,111,255,0.2)', borderRadius:'10px', padding:'12px 14px', marginBottom:'18px' }}>
        <span style={{ fontSize:'14px' }}>ℹ️</span>
        <div style={{ fontSize:'12px', color:'#C7C3F0', lineHeight:1.7 }}>
          目前為<strong>「產出模式」</strong>：內容可產出、複製、下載、加入行事曆。<strong>自動發布</strong>需先完成 Meta 開發者設定與帳號授權——完成後，下方連結鈕就會開放，行事曆上的排程即可自動發布。
        </div>
      </div>

      <ConnectCard icon="📷" name="Instagram" account={ig} limit="每 24 小時最多 100 則" />
      <ConnectCard icon="🧵" name="Threads" account={threads} limit="每日最多 250 則" />

      <div style={card}>
        <div style={{ fontSize:'13px', fontWeight:'700', marginBottom:'10px' }}>自動發布上線前的準備</div>
        <div style={{ fontSize:'12px', color:'#9B9AB8', lineHeight:1.9 }}>
          1. 建立 Meta 開發者 App、加入 Instagram / Threads 產品<br />
          2. IG 切換為商業/創作者帳號並連結 Facebook 粉專<br />
          3. 設定 OAuth 重新導向網址、把自己加為 App 測試者<br />
          4. 填好並部署 <a href="/privacy" style={{ color:'#A78BFA' }}>隱私政策</a> 與 <a href="/terms" style={{ color:'#A78BFA' }}>服務條款</a><br />
          完成後把 App ID / Secret / redirect URI 交給工程接上即可。
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [page, setPage] = useState('start')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()
  const [user, setUser] = useState<any>(null)
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [tplLoading, setTplLoading] = useState(true)
  const [tplError, setTplError] = useState('')
  const [plan, setPlan] = useState('starter')
  const [captionCount, setCaptionCount] = useState<number | null>(null)
  const [upgradeFor, setUpgradeFor] = useState<Template | null>(null)
  const [lockFeature, setLockFeature] = useState<{ label: string; plan: string } | null>(null)
  const [catFilter, setCatFilter] = useState('all')
  const [brand, setBrand] = useState('')
  const [topic, setTopic] = useState('')
  const [hook, setHook] = useState('損失規避')
  const [cta, setCta] = useState('save')
  const [built, setBuilt] = useState<BuiltContent | null>(null)   // 結構化產出結果
  const [generating, setGenerating] = useState(false)
  const [savingCal, setSavingCal] = useState(false)
  const [toast, setToast] = useState('')
  const [direction, setDirection] = useState('')   // 快速開始選的內容方向（對應 templates.category）
  const [industry, setIndustry] = useState('')     // 產業（選一次記住，存 localStorage）
  const [industrySuggest, setIndustrySuggest] = useState<{ name: string; times: { label: string; time: string }[] } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 開場讀回上次選的產業
  useEffect(() => {
    try { const s = localStorage.getItem('pp_industry'); if (s) setIndustry(s) } catch {}
  }, [])

  function chooseIndustry(v: string) {
    setIndustry(v)
    try { localStorage.setItem('pp_industry', v) } catch {}
  }

  // 依產業讀 posting_times 的建議發布時間（供「加入行事曆」用）
  useEffect(() => {
    if (!industry) { setIndustrySuggest(null); return }
    let cancelled = false
    async function loadSuggest() {
      const { data } = await supabase
        .from('posting_times')
        .select('category_name,recommended_times')
        .eq('category_key', industry)
        .maybeSingle()
      if (cancelled) return
      if (data) setIndustrySuggest({ name: data.category_name, times: Array.isArray(data.recommended_times) ? data.recommended_times : [] })
      else setIndustrySuggest(null)
    }
    loadSuggest()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry])

  // 快速開始：帶著方向跳到「IG 文案＋輪播」，並自動篩選對應分類
  function pickDirection(key: string) {
    setDirection(key)
    setCatFilter(key)
    setSelectedTpl(null)
    setPage('ig-post')
  }

  const directionMeta = DIRECTIONS.find(d => d.key === direction)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { router.push('/login'); return }
      if (cancelled) return
      setUser(auth.user)

      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const [profileRes, tplRes, countRes] = await Promise.all([
        supabase.from('profiles').select('plan').eq('id', auth.user.id).maybeSingle(),
        supabase
          .from('templates')
          .select('slug,name,category,description,badge_text,er_label,is_hot,required_plan')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('captions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', auth.user.id)
          .gte('created_at', monthStart.toISOString()),
      ])
      if (cancelled) return

      if (profileRes.data?.plan) setPlan(profileRes.data.plan)
      if (tplRes.error) setTplError(tplRes.error.message)
      else setTemplates(tplRes.data ?? [])
      if (!countRes.error) setCaptionCount(countRes.count ?? 0)
      setTplLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  function showToast(msg:string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleGenerate() {
    if (!selectedTpl) return
    setGenerating(true)
    setBuilt(null)
    // 零 token：純前端組裝骨架＋填變數，不呼叫任何 API
    const result = buildContent(selectedTpl.category, {
      brand, topic, industry: industrySuggest?.name ?? '', hookKey: hook, ctaKey: cta,
    })
    // 短暫延遲只為了保留「生成中」的手感（非等待 API）
    setTimeout(() => { setBuilt(result); setGenerating(false) }, 250)
  }

  async function handleSaveCaption() {
    if (!built || !user) return
    const { error } = await supabase.from('captions').insert({
      user_id: user.id,
      template_slug: selectedTpl?.slug,
      brand_name: brand,
      topic,
      hook_type: hook,
      cta_type: cta,
      content: composeCaption(built),
      platform: 'ig',
      status: 'draft'
    })
    if (error) { showToast('❌ 儲存失敗：' + error.message); return }
    setCaptionCount(c => (c === null ? 1 : c + 1))
    showToast('✅ 文案已儲存到草稿！')
  }

  function handleCopy() {
    if (!built) return
    navigator.clipboard.writeText(composeCaption(built))
    showToast('✅ 完整文案已複製！')
  }

  // 下載素材：把完整文案＋Hashtag＋每一頁輪播文字打包成 .txt
  function handleDownload() {
    if (!built || !selectedTpl) return
    const lines: string[] = []
    lines.push(`【${selectedTpl.name}】PostPilot 產出素材`)
    lines.push(industrySuggest?.name ? `產業：${industrySuggest.name}` : '')
    lines.push('\n──────── 完整文案 ────────\n')
    lines.push(`${built.hook}\n\n${built.body}\n\n${built.cta}`)
    lines.push('\n──────── Hashtag ────────\n')
    lines.push(built.hashtags.join(' '))
    lines.push('\n──────── 輪播分頁文字 ────────')
    built.slides.forEach(s => lines.push(`\n[${s.title}]\n${s.body}`))
    const blob = new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `postpilot_${selectedTpl.slug}_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    showToast('📦 素材已下載')
  }

  // 從產業建議時段推算一個具體的建議發布時間（schedules.scheduled_at 為 NOT NULL）
  function suggestedScheduledAt(): Date {
    return computeSuggestedAt(industrySuggest?.times)
  }

  // 加入行事曆：把這則內容寫進 schedules（狀態＝draft／未排程）
  async function handleAddToCalendar() {
    if (!built || !user) return
    setSavingCal(true)
    const base = {
      user_id: user.id,
      platform: 'ig',
      content: composeCaption(built),
      hashtags: built.hashtags,
      scheduled_at: suggestedScheduledAt().toISOString(),
      status: 'draft',
    }
    // 這個分頁的格式固定是 IG 貼文；容錯：若 schedules 還沒有 format 欄位就退回不帶
    let { error } = await supabase.from('schedules').insert({ ...base, format: 'ig_post' })
    if (error && /format/i.test(error.message)) {
      ;({ error } = await supabase.from('schedules').insert(base))
    }
    setSavingCal(false)
    if (error) { showToast('❌ 加入行事曆失敗：' + error.message); return }
    showToast('📅 已加入行事曆（草稿）')
  }

  const S = {
    app: { display:'flex', height:'100vh', overflow:'hidden', background:'#0D0D12', color:'#F0EFFF', fontFamily:"-apple-system,'PingFang TC',sans-serif", fontSize:'15px' } as any,
    sidebar: isMobile
      ? { width:'270px', minWidth:'270px', maxWidth:'82vw', background:'#13131A', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column' as any, position:'fixed' as any, top:0, left:0, bottom:0, height:'100vh', zIndex:300, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition:'transform .25s ease', boxShadow: sidebarOpen ? '2px 0 24px rgba(0,0,0,0.55)' : 'none' } as any
      : { width:'220px', minWidth:'220px', background:'#13131A', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column' as any, position:'relative' as any, zIndex:100 },
    logo: { padding:'22px 20px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'10px' },
    logoMark: { width:'32px', height:'32px', background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'800', color:'#fff' },
    logoText: { fontSize:'17px', fontWeight:'700' },
    nav: { flex:1, padding:'12px 10px', display:'flex', flexDirection:'column' as any, gap:'2px' },
    navItem: (active:boolean) => ({ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', fontSize:'14px', fontWeight:'500', color: active ? '#A78BFA' : '#9B9AB8', background: active ? 'rgba(124,111,255,0.12)' : 'transparent', cursor:'pointer', border:'none', width:'100%', textAlign:'left' as any }),
    main: { flex:1, display:'flex', flexDirection:'column' as any, overflow:'hidden' },
    topbar: { background:'#13131A', borderBottom:'1px solid rgba(255,255,255,0.07)', padding: isMobile ? '0 12px' : '0 28px', height:'58px', minHeight:'58px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' },
    page: { flex:1, overflowY:'auto' as any, overflowX:'hidden' as any, padding: isMobile ? '16px' : '28px' },
    card: { background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' },
    btnPrimary: { background:'linear-gradient(135deg,#7C6FFF,#A78BFA)', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer' },
    btnGhost: { background:'transparent', color:'#9B9AB8', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
    input: { width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' as any },
    select: { width:'100%', background:'#13131A', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', color:'#F0EFFF', fontSize:'14px', padding:'10px 13px', outline:'none', boxSizing:'border-box' as any },
    label: { fontSize:'12px', fontWeight:'600', color:'#9B9AB8', marginBottom:'6px', display:'block' },
  }

  const userEmail = user?.email || ''
  const displayName = userEmail.split('@')[0]

  return (
    <div style={S.app}>
      {/* 手機抽屜遮罩 */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200 }} />
      )}
      {/* SIDEBAR */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoMark}>P</div>
          <div style={S.logoText}>Post<span style={{color:'#A78BFA'}}>Pilot</span></div>
        </div>
        <nav style={S.nav}>
          {NAV.map(n => {
            const navLocked = !canUseTemplate(plan, FORMAT_PLAN[n.id] ?? 'starter')
            return (
              <button key={n.id} style={S.navItem(page===n.id)} onClick={() => { setPage(n.id); setSidebarOpen(false) }}>
                <span>{n.icon}</span> {n.label}
                {navLocked && <span style={{ marginLeft:'auto', fontSize:'11px', opacity:0.8 }}>🔒</span>}
              </button>
            )
          })}
        </nav>
        <div style={{ padding:'14px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'34px', height:'34px', background:'linear-gradient(135deg,#667eea,#764ba2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', flexShrink:0 }}>
            {displayName[0]?.toUpperCase()}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</div>
            <div style={{ fontSize:'11px', color:'#A78BFA', background:'rgba(124,111,255,0.15)', padding:'1px 6px', borderRadius:'10px', display:'inline-block', marginTop:'2px' }}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</div>
          </div>
          <button onClick={() => { setPage('settings'); setSidebarOpen(false) }} style={{ background:'none', border:'none', color: page==='settings' ? '#A78BFA' : '#5C5B78', cursor:'pointer', fontSize:'16px' }} title="帳號連結 / 設定">⚙️</button>
          <button onClick={handleLogout} style={{ background:'none', border:'none', color:'#5C5B78', cursor:'pointer', fontSize:'16px' }} title="登出">⏻</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={S.main}>
        {/* TOPBAR */}
        <div style={S.topbar}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} aria-label="開啟選單" style={{ background:'none', border:'none', color:'#F0EFFF', fontSize:'22px', cursor:'pointer', padding:'2px 4px', lineHeight:1, flexShrink:0 }}>☰</button>
            )}
            <div style={{ fontSize:'17px', fontWeight:'700', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{NAV.find(n=>n.id===page)?.label ?? (page==='settings' ? '帳號連結 / 設定' : '')}</div>
          </div>
          <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
            <button style={S.btnGhost} onClick={() => showToast('週報功能開發中 📧')}>{isMobile ? '📧' : '📧 週報'}</button>
            <button style={S.btnPrimary} onClick={() => { setPage('ig-post'); setSelectedTpl(null) }}>{isMobile ? '✦ 生成' : '✦ 生成文案'}</button>
          </div>
        </div>

        {/* PAGES */}
        <div style={S.page}>

          {/* 高於方案的分頁：顯示鎖定畫面（前端擋；後端另有 schedules 的 RLS 把關）*/}
          {!canUseTemplate(plan, FORMAT_PLAN[page] ?? 'starter') ? (
            <LockedScreen
              title={NAV.find(n => n.id === page)?.label ?? '此功能'}
              requiredPlan={FORMAT_PLAN[page] ?? 'pro'}
              onUpgrade={() => setLockFeature({ label: `「${NAV.find(n => n.id === page)?.label ?? '此功能'}」`, plan: FORMAT_PLAN[page] ?? 'pro' })}
            />
          ) : (
          <>

          {/* ── 快速開始 ── */}
          {page === 'start' && (
            <QuickStartPage
              displayName={displayName}
              industry={industry}
              onIndustryChange={chooseIndustry}
              onPick={pickDirection}
            />
          )}

          {/* ── IG 文案＋輪播（沿用現有模板庫，階段2 接零 token 產出）── */}
          {page === 'ig-post' && !selectedTpl && (
            <div>
              {directionMeta && (
                <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.07)', borderLeft:`3px solid ${directionMeta.color}`, borderRadius:'10px', padding:'10px 14px', marginBottom:'16px' }}>
                  <span style={{ fontSize:'18px' }}>{directionMeta.icon}</span>
                  <span style={{ fontSize:'13px' }}>方向：<strong style={{ color:directionMeta.color }}>{directionMeta.title}</strong>　已為你篩選對應模板</span>
                  <button onClick={() => { setDirection(''); setCatFilter('all') }} style={{ marginLeft:'auto', background:'none', border:'none', color:'#5C5B78', cursor:'pointer', fontSize:'12px' }}>清除 ✕</button>
                </div>
              )}
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' as any, marginBottom:'20px' }}>
                {[['all','全部'],['edu','教育型'],['interact','互動'],['brand','品牌故事'],['promo','促銷型'],['social','社會證明'],['threads','Threads'],['festival','節慶']].map(([k,l]) => (
                  <button key={k} onClick={() => setCatFilter(k)} style={{ padding:'7px 14px', borderRadius:'20px', fontSize:'13px', fontWeight:'500', background: catFilter===k ? 'rgba(124,111,255,0.15)' : '#1E1E2E', color: catFilter===k ? '#A78BFA' : '#9B9AB8', border: catFilter===k ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)', cursor:'pointer' }}>{l}</button>
                ))}
              </div>
              {tplLoading && (
                <div style={{ ...S.card, textAlign:'center', color:'#5C5B78', fontSize:'13px', padding:'48px' }}>
                  載入模板庫中…
                </div>
              )}

              {!tplLoading && tplError && (
                <div style={{ ...S.card, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.06)', color:'#F87171', fontSize:'13px' }}>
                  ❌ 模板載入失敗：{tplError}
                </div>
              )}

              {!tplLoading && !tplError && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>
                  {templates.filter(t => catFilter==='all' || t.category===catFilter).map(t => {
                    const locked = !canUseTemplate(plan, t.required_plan)
                    return (
                      <div
                        key={t.slug}
                        style={{ ...S.card, cursor:'pointer', transition:'all .2s', opacity: locked ? 0.65 : 1, borderColor: locked ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.07)' }}
                        onClick={() => {
                          if (locked) { setUpgradeFor(t); return }
                          setSelectedTpl(t)
                          setBuilt(null)
                        }}
                      >
                        {locked
                          ? <div style={{ fontSize:'10px', color:'#FBBF24', fontWeight:'700', marginBottom:'6px' }}>🔒 升級解鎖</div>
                          : t.is_hot && <div style={{ fontSize:'10px', color:'#FBBF24', fontWeight:'700', marginBottom:'6px' }}>🔥 本週推薦</div>}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                          <div style={{ fontWeight:'700', fontSize:'14px' }}>{t.name}</div>
                          <span style={{ fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'6px', background:'rgba(255,255,255,0.05)', color: CATEGORY_COLOR[t.category] ?? '#9B9AB8', flexShrink:0, marginLeft:'8px' }}>{t.badge_text}</span>
                        </div>
                        <div style={{ fontSize:'12px', color:'#9B9AB8', marginBottom:'12px' }}>{t.description}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:'11px', color:'#5C5B78' }}>{t.er_label}</span>
                          <span style={{ fontSize:'12px', fontWeight:'600', color: locked ? '#FBBF24' : '#A78BFA' }}>
                            {locked ? '升級解鎖 →' : '立即使用 →'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {!tplLoading && !tplError && templates.filter(t => catFilter==='all' || t.category===catFilter).length === 0 && (
                <div style={{ ...S.card, textAlign:'center', color:'#5C5B78', fontSize:'13px', padding:'48px' }}>
                  這個分類還沒有模板
                </div>
              )}
            </div>
          )}

          {/* ── GENERATOR ── */}
          {page === 'ig-post' && selectedTpl && (
            <div>
              <button onClick={() => setSelectedTpl(null)} style={{ background:'none', border:'none', color:'#9B9AB8', cursor:'pointer', fontSize:'13px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'6px' }}>← 返回模板庫</button>
              <div style={{ fontSize:'18px', fontWeight:'800', marginBottom:'20px' }}>{selectedTpl.name}</div>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap:'20px' }}>
                <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
                  <div style={S.card}>
                    <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'16px' }}>基本資訊</div>
                    <label style={S.label}>你的品牌 / 帳號名稱</label>
                    <input style={{ ...S.input, marginBottom:'14px' }} value={brand} onChange={e=>setBrand(e.target.value)} placeholder="例：Elena線上課程" />
                    <label style={S.label}>這篇要講的主題</label>
                    <input style={S.input} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="例：如何使用行銷提高轉換率" />
                  </div>
                  <div style={S.card}>
                    <div style={{ fontSize:'11px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.8px', marginBottom:'16px' }}>內容設定</div>
                    <label style={S.label}>Hook 類型（首句風格）</label>
                    <select style={{ ...S.select, marginBottom:'14px' }} value={hook} onChange={e=>setHook(e.target.value)}>
                      {HOOKS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <label style={S.label}>CTA 目標</label>
                    <div style={{ display:'flex', flexWrap:'wrap' as any, gap:'8px' }}>
                      {CTA_OPTIONS.map(c => (
                        <button key={c.key} onClick={() => setCta(c.key)} style={{ padding:'7px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', background: cta===c.key ? 'rgba(124,111,255,0.15)' : '#13131A', color: cta===c.key ? '#A78BFA' : '#9B9AB8', border: cta===c.key ? '1px solid rgba(124,111,255,0.4)' : '1px solid rgba(255,255,255,0.07)', cursor:'pointer' }}>{c.label}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleGenerate} disabled={generating} style={{ ...S.btnPrimary, padding:'14px', fontSize:'15px', width:'100%', opacity: generating ? 0.7 : 1 }}>
                    {generating ? '⏳ 生成中...' : '✦ 一鍵生成文案'}
                  </button>
                </div>

                <div style={{ display:'flex', flexDirection:'column' as any, gap:'16px' }}>
                  <div style={S.card}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                      <div style={{ fontWeight:'700', fontSize:'13px' }}>✦ 產出結果</div>
                      {built && <button onClick={handleGenerate} style={{ ...S.btnGhost, fontSize:'12px', padding:'5px 10px' }}>↺ 換一版</button>}
                    </div>

                    {/* 產業建議發布時間 */}
                    {built && industrySuggest && industrySuggest.times.length > 0 && (
                      <div style={{ fontSize:'12px', color:'#A78BFA', background:'rgba(124,111,255,0.08)', border:'1px solid rgba(124,111,255,0.2)', borderRadius:'8px', padding:'8px 10px', marginBottom:'14px', lineHeight:1.6 }}>
                        🕒 <strong>{industrySuggest.name}</strong> 建議時段：{industrySuggest.times.map(t => `${t.label} ${t.time}`).join('；')}
                      </div>
                    )}

                    {!built ? (
                      <div style={{ minHeight:'180px', display:'flex', alignItems:'center', justifyContent:'center', color:'#5C5B78', fontSize:'13px', flexDirection:'column' as any, gap:'8px' }}>
                        <div style={{ fontSize:'28px', opacity:0.4 }}>✦</div>
                        <div>填好左側設定後點擊生成</div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column' as any, gap:'12px' }}>
                        {[
                          { tag:'Hook 首句', color:'#FBBF24', text: built.hook },
                          { tag:'Body 主文', color:'#34D399', text: built.body },
                          { tag:'CTA 行動呼籲', color:'#A78BFA', text: built.cta },
                        ].map(sec => (
                          <div key={sec.tag}>
                            <div style={{ fontSize:'10px', fontWeight:'700', color:sec.color, letterSpacing:'0.5px', marginBottom:'4px' }}>{sec.tag}</div>
                            <pre style={{ whiteSpace:'pre-wrap' as any, fontSize:'13.5px', lineHeight:1.75, margin:0, fontFamily:'inherit', color:'#F0EFFF' }}>{sec.text}</pre>
                          </div>
                        ))}
                        <div>
                          <div style={{ fontSize:'10px', fontWeight:'700', color:'#9B9AB8', letterSpacing:'0.5px', marginBottom:'4px' }}>Hashtag</div>
                          <div style={{ display:'flex', flexWrap:'wrap' as any, gap:'6px' }}>
                            {built.hashtags.map(h => <span key={h} style={{ fontSize:'12px', color:'#A78BFA', background:'rgba(124,111,255,0.08)', padding:'3px 8px', borderRadius:'6px' }}>{h}</span>)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 輪播分頁文字 */}
                  {built && (
                    <div style={S.card}>
                      <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'12px' }}>🖼️ 輪播分頁文字 <span style={{ fontSize:'11px', color:'#9B9AB8', fontWeight:'400' }}>{built.slides.length} 頁</span></div>
                      <div style={{ display:'flex', flexDirection:'column' as any, gap:'8px' }}>
                        {built.slides.map((s, i) => (
                          <div key={i} style={{ display:'flex', gap:'10px', background:'#13131A', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'8px', padding:'10px 12px' }}>
                            <div style={{ fontSize:'11px', fontWeight:'700', color:'#7C6FFF', flexShrink:0, width:'56px' }}>{s.title}</div>
                            <div style={{ fontSize:'13px', lineHeight:1.6, color:'#F0EFFF' }}>{s.body}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 產出模式動作（不接發布） */}
                  {built && (
                    <div style={S.card}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        <button style={S.btnGhost} onClick={handleCopy}>📋 複製文案</button>
                        <button style={S.btnGhost} onClick={handleDownload}>📦 下載素材</button>
                        <button style={S.btnGhost} onClick={handleSaveCaption}>💾 儲存草稿</button>
                        <button style={{ ...S.btnPrimary, opacity: savingCal ? 0.7 : 1 }} disabled={savingCal} onClick={handleAddToCalendar}>{savingCal ? '⏳ 加入中…' : '📅 加入行事曆'}</button>
                      </div>
                      <div style={{ fontSize:'11px', color:'#5C5B78', marginTop:'10px', lineHeight:1.6 }}>
                        產出模式：只產內容、不自動發布（不需 Meta 審核）。加入行事曆會存成草稿；行事曆顯示這些草稿是下一階段的功能。
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── IG 限動（零 token 產出：文字＋貼紙建議＋底圖下載）── */}
          {page === 'ig-story' && (
            <IgStoryPage userId={user?.id} industrySuggest={industrySuggest} showToast={showToast} />
          )}

          {/* ── Reels（零 token 影片組裝）── */}
          {page === 'reels' && (
            <ReelsPage showToast={showToast} />
          )}

          {/* ── Threads（零 token 爆款結構產出）── */}
          {page === 'threads' && (
            <ThreadsPage userId={user?.id} industrySuggest={industrySuggest} showToast={showToast} />
          )}

          {/* ── CALENDAR ── */}
          {page === 'calendar' && (
            <CalendarPage userId={user?.id} onGenerate={() => { setPage('ig-post'); setSelectedTpl(null) }} />
          )}

          {/* ── SCHEDULE（暫從導覽移除，程式碼保留供階段2/3 重用）── */}
          {page === 'schedule' && (
            <SchedulePage userId={user?.id} showToast={showToast} onGenerate={() => { setPage('ig-post'); setSelectedTpl(null) }} />
          )}

          {/* ── ANALYTICS（暫從導覽移除，程式碼保留供後續重用）── */}
          {page === 'analytics' && (
            <AnalyticsPage />
          )}

          {/* ── 帳號連結 / 設定（自動發布地基；OAuth 待 Meta 憑證接上）── */}
          {page === 'settings' && (
            <SettingsPage userId={user?.id} showToast={showToast} />
          )}

          </>
          )}
        </div>
      </div>

      {/* UPGRADE MODAL（模板鎖 upgradeFor / 功能鎖 lockFeature 共用）*/}
      {(upgradeFor || lockFeature) && (() => {
        const info = upgradeFor
          ? { label: `「${upgradeFor.name}」`, plan: upgradeFor.required_plan || 'pro' }
          : lockFeature!
        const close = () => { setUpgradeFor(null); setLockFeature(null) }
        return (
        <div
          onClick={close}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:'20px' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, width:'400px', maxWidth:'100%' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>🔒</div>
            <div style={{ fontSize:'18px', fontWeight:'800', marginBottom:'8px' }}>
              {info.label}需要 {PLAN_NAME[info.plan] ?? 'Pro'} 方案
            </div>
            <div style={{ fontSize:'13px', color:'#9B9AB8', lineHeight:1.7, marginBottom:'18px' }}>
              升級 {PLAN_NAME[info.plan] ?? 'Pro'} 之後就能直接使用。
            </div>

            <div style={{ background:'#13131A', borderRadius:'8px', padding:'14px', marginBottom:'18px' }}>
              {(PLAN_PERKS[info.plan] ?? PLAN_PERKS.pro).map(f => (
                <div key={f} style={{ display:'flex', gap:'8px', fontSize:'13px', color:'#F0EFFF', padding:'4px 0' }}>
                  <span style={{ color:'#34D399' }}>✓</span> {f}
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button style={{ ...S.btnGhost, flex:1, padding:'12px' }} onClick={close}>
                稍後再說
              </button>
              <button
                style={{ ...S.btnPrimary, flex:1, padding:'12px' }}
                onClick={() => { close(); showToast('💳 升級流程開發中（綠界金流尚未串接）') }}
              >
                升級 {PLAN_NAME[info.plan] ?? 'Pro'}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* TOAST */}
      {toast && (
        <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'#1E1E2E', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', padding:'12px 18px', fontSize:'13px', fontWeight:'600', boxShadow:'0 8px 32px rgba(0,0,0,0.4)', zIndex:999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}