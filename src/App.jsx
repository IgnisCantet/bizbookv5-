/**
 * BizBook KZ v5.0 — Рабочее приложение с Supabase
 * © 2026 ТОО «NOVA Comp». Все права защищены.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { auth, profiles, companies, tariffs, counterparties, nomenclature, documents } from './lib/supabase.js'
import { MRP, MZP, calcSalary } from './data/constants.js'

// ─── THEME ───────────────────────────────────────────────────────
const DARK = {
  bg:'#0d0d1a',card:'#13131f',card2:'#1a1a2e',card3:'#21213a',
  border:'rgba(124,111,255,.14)',border2:'rgba(124,111,255,.3)',
  text:'#f0efff',muted:'#6b6b8a',dim:'#252540',
  p:'#7c6fff',p2:'#6152e0',
  gold:'#f59e0b',goldL:'#fbbf24',
  green:'#22c55e',red:'#ef4444',cyan:'#06b6d4',orange:'#f97316',
  pSoft:'rgba(124,111,255,.13)',gSoft:'rgba(245,158,11,.12)',
  inputBg:'#1a1a2e',navBg:'#0d0d1a',
}
const LIGHT = {
  bg:'#f5f4ff',card:'#ffffff',card2:'#eeecff',card3:'#e4e1ff',
  border:'rgba(124,111,255,.15)',border2:'rgba(124,111,255,.3)',
  text:'#0d0d1a',muted:'#6b6b8a',dim:'#c4c0e8',
  p:'#7c6fff',p2:'#6152e0',
  gold:'#d97706',goldL:'#f59e0b',
  green:'#15803d',red:'#b91c1c',cyan:'#0e7490',orange:'#ea580c',
  pSoft:'rgba(124,111,255,.1)',gSoft:'rgba(217,119,6,.1)',
  inputBg:'#f0eeff',navBg:'#ffffff',
}

function useTheme(){
  const sys=()=>window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'
  const [mode,setMode]=useState(()=>{try{return localStorage.getItem('bb_theme')||'system'}catch{return'system'}})
  const resolved=mode==='system'?sys():mode
  const C=resolved==='dark'?DARK:LIGHT
  useEffect(()=>{try{localStorage.setItem('bb_theme',mode)}catch{}},[mode])
  return{C,mode,setMode,resolved}
}
function useLang(){
  const [lang,setLang]=useState(()=>{try{return localStorage.getItem('bb_lang')||'ru'}catch{return'ru'}})
  useEffect(()=>{try{localStorage.setItem('bb_lang',lang)}catch{}},[lang])
  return{lang,setLang}
}
function useVw(){
  const [vw,setVw]=useState(window.innerWidth)
  useEffect(()=>{const h=()=>setVw(window.innerWidth);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h)},[])
  return vw
}

// ─── UTILS ───────────────────────────────────────────────────────
const fmt=n=>(n||0).toLocaleString('ru-KZ')+' ₸'
const today=()=>new Date().toISOString().split('T')[0]
const DOC_TYPES={invoice:'Счёт на оплату',avr:'АВР',sf:'Счёт-фактура',poa:'Доверенность',waybill:'Накладная'}
const DOC_ICONS={invoice:'📄',avr:'✅',sf:'🧾',poa:'📜',waybill:'📦'}
const DOC_COLORS={invoice:'#7c6fff',avr:'#22c55e',sf:'#f59e0b',poa:'#ec4899',waybill:'#64748b'}

// ─── UI ATOMS ────────────────────────────────────────────────────
const Logo=({size=36})=>(
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#7c6fff"/><stop offset="1" stopColor="#4f46e5"/></linearGradient></defs>
    <rect width="100" height="100" rx="22" fill="url(#lg)"/>
    <rect x="33" y="18" width="9" height="20" rx="4.5" fill="white"/>
    <rect x="58" y="18" width="9" height="20" rx="4.5" fill="white"/>
    <rect x="33" y="18" width="34" height="9" rx="4.5" fill="white"/>
    <rect x="12" y="35" width="76" height="48" rx="10" fill="white"/>
    <rect x="12" y="53" width="76" height="11" fill="#f59e0b"/>
    <rect x="40" y="48" width="20" height="22" rx="7" fill="#4f46e5"/>
    <circle cx="50" cy="57" r="3.5" fill="#f59e0b"/>
    <rect x="48" y="57" width="4" height="7" rx="2" fill="#f59e0b"/>
  </svg>
)

const Btn=({children,onClick,col,style={},disabled,loading})=>(
  <button onClick={onClick} disabled={disabled||loading}
    style={{padding:'12px 0',borderRadius:14,background:disabled||loading?'#2a2a40':`linear-gradient(135deg,${col||'#7c6fff'},${col?col+'bb':'#6152e0'})`,border:'none',color:disabled||loading?'#6b6b8a':'#fff',fontSize:13,fontWeight:700,cursor:disabled||loading?'not-allowed':'pointer',width:'100%',transition:'opacity .15s',...style}}>
    {loading?'⏳ Загрузка...':children}
  </button>
)
const SBtn=({children,onClick,C,style={}})=>(
  <button onClick={onClick} style={{padding:'11px 0',borderRadius:13,background:C.card2,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:'pointer',width:'100%',...style}}>{children}</button>
)
const Inp=({label,value,onChange,placeholder,type='text',C,required})=>(
  <div style={{marginBottom:12}}>
    {label&&<p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:.6}}>{label}{required&&<span style={{color:C.red}}> *</span>}</p>}
    <input value={value||''} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border2}`,borderRadius:12,padding:'11px 14px',color:C.text,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
  </div>
)
const Sel=({label,value,onChange,options,C})=>(
  <div style={{marginBottom:12}}>
    {label&&<p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:.6}}>{label}</p>}
    <select value={value||''} onChange={e=>onChange(e.target.value)}
      style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border2}`,borderRadius:12,padding:'11px 14px',color:C.text,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit',appearance:'none'}}>
      {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
    </select>
  </div>
)
const Sec=({children,action,onAction,C})=>(
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'16px 0 8px'}}>
    <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:0,textTransform:'uppercase',letterSpacing:1.2}}>{children}</p>
    {action&&<button onClick={onAction} style={{background:'none',border:'none',color:C.p,fontSize:11,cursor:'pointer',fontWeight:600,padding:0}}>{action}</button>}
  </div>
)
const Toggle=({on,onToggle,col})=>(
  <div onClick={onToggle} style={{width:44,height:24,borderRadius:12,background:on?(col||'#7c6fff'):'#374151',display:'flex',alignItems:'center',padding:'0 3px',cursor:'pointer',flexShrink:0,transition:'background .2s'}}>
    <div style={{width:18,height:18,borderRadius:9,background:'#fff',transform:on?'translateX(20px)':'translateX(0)',transition:'transform .2s'}}/>
  </div>
)
const Alert=({type='info',children,C})=>{
  const cfg={info:{bg:C.pSoft,border:C.border,text:C.p,icon:'ℹ️'},error:{bg:'rgba(239,68,68,.1)',border:'rgba(239,68,68,.25)',text:C.red,icon:'❌'},success:{bg:'rgba(34,197,94,.1)',border:'rgba(34,197,94,.25)',text:C.green,icon:'✅'},warn:{bg:C.gSoft,border:`${C.gold}25`,text:C.gold,icon:'⚠️'}}[type]
  return <div style={{background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:12,padding:'10px 13px',marginBottom:10,display:'flex',gap:8,alignItems:'flex-start'}}>
    <span style={{fontSize:14,flexShrink:0}}>{cfg.icon}</span>
    <p style={{color:cfg.text,fontSize:11,margin:0,lineHeight:1.5}}>{children}</p>
  </div>
}
const Spinner=({C})=><div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 0'}}><div style={{width:32,height:32,borderRadius:16,border:`3px solid ${C.border}`,borderTopColor:C.p,animation:'spin 1s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

// ─── SIDEBAR ─────────────────────────────────────────────────────
function Sidebar({screen,nav,C,mode,setMode,lang,setLang,profile,isAdmin,onLogout,vw}){
  const [open,setOpen]=useState(false)
  const isMd=vw>=768
  const items=[
    ['home','🏠','Главная'],['docs','📁','Документы'],
    ['counterparties','👥','Контрагенты'],['nomenclature','📦','Номенклатура'],
    ['profile','👤','Профиль'],
    ...(isAdmin?[['admin','🔧','Панель админа']]:[[]])
  ].filter(x=>x.length>0)

  const content=(
    <div style={{width:isMd?230:'100%',maxWidth:isMd?230:320,background:C.card,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',height:'100vh',flexShrink:0}}>
      <div style={{padding:'18px 16px 13px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
        <Logo size={32}/>
        <div style={{flex:1,minWidth:0}}>
          <p style={{color:C.text,fontSize:13,fontWeight:800,margin:0}}>BizBook KZ</p>
          <p style={{color:C.muted,fontSize:9,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.email||'...'}</p>
        </div>
        {!isMd&&<button onClick={()=>setOpen(false)} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>✕</button>}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'8px 8px'}}>
        {items.map(([key,icon,label])=>{
          const active=screen===key
          return(
            <button key={key} onClick={()=>{nav(key);!isMd&&setOpen(false)}}
              style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 11px',borderRadius:11,border:'none',cursor:'pointer',background:active?C.pSoft:'transparent',marginBottom:2,textAlign:'left'}}>
              <span style={{fontSize:17,width:22,textAlign:'center',flexShrink:0}}>{icon}</span>
              <span style={{color:active?C.p:C.text,fontSize:12,fontWeight:active?700:400}}>{label}</span>
              {active&&<div style={{marginLeft:'auto',width:5,height:5,borderRadius:3,background:C.p,flexShrink:0}}/>}
            </button>
          )
        })}
      </div>
      <div style={{padding:'10px 12px',borderTop:`1px solid ${C.border}`}}>
        <div style={{display:'flex',gap:3,marginBottom:7}}>
          {[['dark','🌙'],['light','☀️'],['system','💻']].map(([v,ic])=>(
            <button key={v} onClick={()=>setMode(v)} style={{flex:1,padding:'6px 2px',borderRadius:8,border:`1.5px solid ${mode===v?C.p:C.border}`,background:mode===v?C.pSoft:'transparent',color:mode===v?C.p:C.muted,fontSize:9,fontWeight:600,cursor:'pointer'}}>{ic}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:4,marginBottom:8}}>
          {[['ru','🇷🇺 РУС'],['kz','🇰🇿 ҚАЗ']].map(([v,l])=>(
            <button key={v} onClick={()=>setLang(v)} style={{flex:1,padding:'6px',borderRadius:8,border:`1.5px solid ${lang===v?C.p:C.border}`,background:lang===v?C.pSoft:'transparent',color:lang===v?C.text:C.muted,fontSize:10,fontWeight:600,cursor:'pointer'}}>{l}</button>
          ))}
        </div>
        <button onClick={onLogout} style={{width:'100%',padding:'8px',borderRadius:10,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:C.red,fontSize:11,fontWeight:600,cursor:'pointer'}}>Выйти →</button>
      </div>
      <div style={{padding:'6px 12px 12px',borderTop:`1px solid ${C.border}`}}>
        <p style={{color:C.dim,fontSize:7,margin:0,textAlign:'center',lineHeight:1.6}}>© 2026 ТОО «NOVA Comp»<br/>Закон РК «Об авторском праве» №6-I</p>
      </div>
    </div>
  )

  if(isMd) return content
  return(
    <>
      <button onClick={()=>setOpen(true)} style={{width:38,height:38,borderRadius:12,background:C.card2,border:`1px solid ${C.border}`,cursor:'pointer',fontSize:18,flexShrink:0}}>☰</button>
      {open&&(
        <>
          <div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:100}}/>
          <div style={{position:'fixed',top:0,left:0,bottom:0,zIndex:101,display:'flex'}}>{content}</div>
        </>
      )}
    </>
  )
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────
function AuthScreen({C}){
  const [step,setStep]=useState('email')  // email | otp | pin_set
  const [email,setEmail]=useState('')
  const [otp,setOtp]=useState('')
  const [pin,setPin]=useState('')
  const [pinConfirm,setPinConfirm]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [info,setInfo]=useState('')

  async function sendOtp(){
    if(!email.includes('@')){setError('Введите корректный email');return}
    setLoading(true);setError('')
    const{error:e}=await auth.signInWithOtp(email)
    setLoading(false)
    if(e){setError(e.message);return}
    setInfo(`Код отправлен на ${email}. Проверьте почту.`)
    setStep('otp')
  }

  async function verifyOtp(){
    if(otp.length<6){setError('Введите 6-значный код');return}
    setLoading(true);setError('')
    const{error:e}=await auth.verifyOtp(email,otp)
    setLoading(false)
    if(e){setError('Неверный код или истёк срок. Запросите новый.');return}
    // После верификации страница перезагрузится через onAuthStateChange
  }

  return(
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at 30% 20%,rgba(124,111,255,.2),${C.bg} 65%)`,display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <div style={{width:'100%',maxWidth:400,background:C.card,borderRadius:24,overflow:'hidden',border:`1px solid ${C.border}`,boxShadow:`0 20px 80px rgba(0,0,0,.4)`}}>
        {/* Header */}
        <div style={{padding:'28px 28px 20px',textAlign:'center',borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:'inline-flex',padding:14,background:C.pSoft,borderRadius:20,marginBottom:14,border:`1px solid ${C.border2}`}}>
            <Logo size={52}/>
          </div>
          <h1 style={{color:C.text,fontSize:22,fontWeight:900,margin:'0 0 5px'}}>BizBook KZ</h1>
          <p style={{color:C.muted,fontSize:12,margin:0}}>Умная бухгалтерия для бизнеса РК</p>
        </div>
        {/* Form */}
        <div style={{padding:'24px 28px 28px'}}>
          {step==='email'&&(
            <>
              <h2 style={{color:C.text,fontSize:16,fontWeight:700,margin:'0 0 6px'}}>Войти в систему</h2>
              <p style={{color:C.muted,fontSize:11,margin:'0 0 16px',lineHeight:1.5}}>Введите email — пришлём одноразовый код для входа. Пароль не нужен!</p>
              {error&&<Alert type="error" C={C}>{error}</Alert>}
              <Inp label="Email" value={email} onChange={setEmail} placeholder="your@email.com" type="email" C={C}/>
              <Btn onClick={sendOtp} loading={loading}>📧 Получить код →</Btn>
              <p style={{color:C.dim,fontSize:9,textAlign:'center',marginTop:12}}>© 2026 ТОО «NOVA Comp» · Все права защищены</p>
            </>
          )}
          {step==='otp'&&(
            <>
              <button onClick={()=>setStep('email')} style={{background:'none',border:'none',color:C.p,fontSize:12,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Назад</button>
              <h2 style={{color:C.text,fontSize:16,fontWeight:700,margin:'0 0 6px'}}>Введите код</h2>
              {info&&<Alert type="success" C={C}>{info}</Alert>}
              {error&&<Alert type="error" C={C}>{error}</Alert>}
              <p style={{color:C.muted,fontSize:11,margin:'0 0 16px'}}>6-значный код из письма</p>
              <Inp label="Код подтверждения" value={otp} onChange={v=>setOtp(v.replace(/\D/,'').slice(0,6))} placeholder="123456" type="tel" C={C}/>
              <Btn onClick={verifyOtp} loading={loading} disabled={otp.length<6}>✅ Войти</Btn>
              <button onClick={()=>{sendOtp()}} style={{width:'100%',marginTop:8,padding:'10px',borderRadius:12,background:'transparent',border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:'pointer'}}>
                Отправить код повторно
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ONBOARD / COMPANY REGISTER ───────────────────────────────────
function CompanyRegister({C,userId,onDone}){
  const [step,setStep]=useState(1)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [form,setForm]=useState({
    name:'',bin:'',type:'too',regime:'our',nds:false,
    address:'',city:'Алматы',director:'',phone:'',email:'',
    bank:'Halyk Bank',bik:'',iik:'',kbe:'17'
  })
  const upd=k=>v=>setForm(f=>({...f,[k]:v}))

  async function save(){
    if(!form.name||!form.bin){setError('Название и БИН обязательны');return}
    if(form.bin.length!==12){setError('БИН должен содержать 12 цифр');return}
    setLoading(true);setError('')
    const{data,error:e}=await companies.create({...form,owner_id:userId})
    setLoading(false)
    if(e){setError(e.message);return}
    onDone(data)
  }

  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:28,fontFamily:'system-ui,-apple-system,sans-serif'}}>
      {/* Progress */}
      <div style={{padding:'14px 18px 0',display:'flex',alignItems:'center',gap:10}}>
        {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{background:'none',border:'none',color:C.p,fontSize:26,cursor:'pointer',padding:0}}>‹</button>}
        <div><h2 style={{color:C.text,fontSize:15,fontWeight:700,margin:0}}>{['','Тип организации','Реквизиты','Банк и контакты'][step]}</h2><p style={{color:C.muted,fontSize:10,margin:0}}>Шаг {step} из 3</p></div>
      </div>
      <div style={{padding:'8px 18px 0',display:'flex',gap:3}}>
        {[1,2,3].map(s=><div key={s} style={{flex:1,height:3,borderRadius:2,background:s<=step?C.p:C.card2}}/>)}
      </div>
      <div style={{padding:'14px 18px 0'}}>
        {error&&<Alert type="error" C={C}>{error}</Alert>}
        {step===1&&(
          <>
            <p style={{color:C.muted,fontSize:11,margin:'0 0 12px'}}>Выберите правовую форму</p>
            {[['🏢','ТОО','too'],['👤','ИП','ip'],['🏦','АО','ao'],['🌾','КФХ','kfh'],['🏘','КСК/ОСИ','ksk'],['🙋','Самозанятый','self']].map(([ic,l,v])=>(
              <div key={v} onClick={()=>upd('type')(v)} style={{background:form.type===v?C.pSoft:C.card,border:`1.5px solid ${form.type===v?C.p:C.border}`,borderRadius:13,padding:'12px',marginBottom:7,cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}>
                <span style={{fontSize:22}}>{ic}</span>
                <p style={{color:form.type===v?C.p:C.text,fontSize:13,fontWeight:700,margin:0}}>{l}</p>
                {form.type===v&&<div style={{marginLeft:'auto',width:18,height:18,borderRadius:9,background:C.p,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'#fff',fontSize:10}}>✓</span></div>}
              </div>
            ))}
            <Btn onClick={()=>setStep(2)} style={{marginTop:8}}>Далее →</Btn>
          </>
        )}
        {step===2&&(
          <>
            <Inp label="Название *" value={form.name} onChange={upd('name')} placeholder='ТОО "Компания"' C={C} required/>
            <Inp label="БИН * (12 цифр)" value={form.bin} onChange={v=>upd('bin')(v.replace(/\D/,'').slice(0,12))} placeholder="241040014477" type="tel" C={C} required/>
            <Inp label="Директор / ФИО ИП" value={form.director} onChange={upd('director')} placeholder="Иванов Иван Иванович" C={C}/>
            <Inp label="Юридический адрес" value={form.address} onChange={upd('address')} placeholder="г. Алматы, ул. ..." C={C}/>
            <Sel label="Налоговый режим" value={form.regime} onChange={upd('regime')} C={C} options={[['our','ОУР (КПН 20%)'],['snr','СНР Упрощёнка (4%)'],['patent','Патент'],['self','Самозанятый']]}/>
            <div onClick={()=>upd('nds')(!form.nds)} style={{background:form.nds?C.gSoft:C.card2,border:`1.5px solid ${form.nds?C.gold:C.border}`,borderRadius:12,padding:'11px 13px',marginBottom:10,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><p style={{color:C.text,fontSize:12,fontWeight:600,margin:'0 0 1px'}}>Плательщик НДС (16%)</p><p style={{color:C.muted,fontSize:9,margin:0}}>Порог: 43 250 000 ₸/год</p></div>
              <Toggle on={form.nds} onToggle={()=>upd('nds')(!form.nds)} col={C.gold}/>
            </div>
            <Btn onClick={()=>setStep(3)}>Далее →</Btn>
          </>
        )}
        {step===3&&(
          <>
            <Sel label="Банк" value={form.bank} onChange={upd('bank')} C={C} options={[['Halyk Bank','Halyk Bank'],['Kaspi Bank','Kaspi Bank'],['Jusan Bank','Jusan Bank'],['ForteBank','ForteBank'],['BCC','BCC'],['Евразийский','Евразийский']]}/>
            <Inp label="БИК" value={form.bik} onChange={upd('bik')} placeholder="HSBKKZKX" C={C}/>
            <Inp label="ИИК" value={form.iik} onChange={upd('iik')} placeholder="KZ89 601A 1234 5678 9100" C={C}/>
            <Inp label="Телефон" value={form.phone} onChange={upd('phone')} placeholder="+7 700 000 00 00" type="tel" C={C}/>
            <Inp label="Email компании" value={form.email} onChange={upd('email')} placeholder="info@company.kz" type="email" C={C}/>
            <Btn onClick={save} loading={loading}>✅ Зарегистрировать компанию</Btn>
          </>
        )}
      </div>
    </div>
  )
}

// ─── HOME SCREEN ─────────────────────────────────────────────────
function HomeScreen({C,company,docs,nav}){
  if(!company) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{fontSize:52,marginBottom:14}}>🏢</div>
      <h2 style={{color:C.text,fontSize:18,fontWeight:800,margin:'0 0 8px',textAlign:'center'}}>Добро пожаловать в BizBook KZ!</h2>
      <p style={{color:C.muted,fontSize:12,textAlign:'center',margin:'0 0 24px',lineHeight:1.6}}>Зарегистрируйте вашу компанию чтобы начать работу</p>
      <Btn onClick={()=>nav('register')} col={C.p} style={{maxWidth:300}}>🏢 Зарегистрировать компанию</Btn>
    </div>
  )

  const income=docs.filter(d=>d.direction==='out'&&d.pay_status==='paid').reduce((s,d)=>s+Number(d.amount),0)
  const pending=docs.filter(d=>d.direction==='out'&&d.pay_status==='unpaid').reduce((s,d)=>s+Number(d.amount),0)
  const recent=docs.slice(0,5)

  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:20}}>
      {/* Finance card */}
      <div style={{padding:'12px 16px 0'}}>
        <div style={{background:'linear-gradient(135deg,#1a0f4e,#2d1f8a)',borderRadius:20,padding:'17px',border:`1px solid ${C.border2}`,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',right:-20,top:-20,width:100,height:100,borderRadius:'50%',background:'rgba(124,111,255,.1)'}}/>
          <p style={{color:'rgba(255,255,255,.5)',fontSize:9,margin:'0 0 2px',textTransform:'uppercase',letterSpacing:1}}>Оплачено · {new Date().toLocaleString('ru-KZ',{month:'long',year:'numeric'})}</p>
          <h1 style={{color:'#fff',fontSize:26,fontWeight:900,margin:'0 0 13px',letterSpacing:-.5}}>{fmt(income)}</h1>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[['К оплате',fmt(pending),'#f59e0b'],['Документов',docs.length,'#7c6fff']].map(([l,v,c],i)=>(
              <div key={i} style={{background:'rgba(255,255,255,.08)',borderRadius:11,padding:'8px'}}>
                <p style={{color:'rgba(255,255,255,.45)',fontSize:9,margin:'0 0 3px'}}>{l}</p>
                <p style={{color:c,fontSize:13,fontWeight:700,margin:0}}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Tariff alert */}
      {!company.tariff_id&&(
        <div style={{padding:'9px 16px 0'}}>
          <Alert type="warn" C={C}>Тариф не подключён. Обратитесь к администратору для активации.</Alert>
        </div>
      )}
      {/* Quick create */}
      <div style={{padding:'10px 16px 0'}}>
        <Sec C={C}>Создать документ</Sec>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
          {Object.entries(DOC_TYPES).map(([type,label])=>(
            <button key={type} onClick={()=>nav('newDoc',{type})} style={{background:`${DOC_COLORS[type]}12`,border:`1px solid ${DOC_COLORS[type]}22`,borderRadius:14,padding:'12px 5px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
              <span style={{fontSize:21}}>{DOC_ICONS[type]}</span>
              <span style={{color:DOC_COLORS[type],fontSize:10,fontWeight:700,textAlign:'center',lineHeight:1.2}}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Recent docs */}
      <div style={{padding:'8px 16px 14px'}}>
        <Sec C={C} action="Все →" onAction={()=>nav('docs')}>Последние документы</Sec>
        {recent.length===0?(
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <p style={{color:C.muted,fontSize:12}}>Документов пока нет</p>
            <p style={{color:C.dim,fontSize:11}}>Создайте первый документ выше</p>
          </div>
        ):recent.map(doc=>(
          <div key={doc.id} onClick={()=>nav('docDetail',{doc})} style={{background:C.card,borderRadius:13,padding:'10px 12px',marginBottom:6,display:'flex',gap:9,cursor:'pointer',border:`1px solid ${C.border}`}}>
            <div style={{width:34,height:34,borderRadius:10,background:`${DOC_COLORS[doc.type]||C.p}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{DOC_ICONS[doc.type]||'📄'}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:C.text,fontSize:12,fontWeight:600,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.counterparty_name||'—'}</p>
              <p style={{color:C.dim,fontSize:9,margin:'2px 0 0'}}>{doc.number} · {doc.date}</p>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              {Number(doc.amount)>0&&<p style={{color:C.text,fontSize:11,fontWeight:700,margin:'0 0 3px'}}>{fmt(Number(doc.amount))}</p>}
              <span style={{fontSize:9,padding:'2px 7px',borderRadius:10,fontWeight:700,background:doc.pay_status==='paid'?'rgba(34,197,94,.13)':doc.pay_status==='partial'?'rgba(245,158,11,.13)':'rgba(239,68,68,.13)',color:doc.pay_status==='paid'?C.green:doc.pay_status==='partial'?C.gold:C.red}}>{doc.pay_status==='paid'?'Оплачен':doc.pay_status==='partial'?'Частично':'Не оплачен'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── DOCS SCREEN ─────────────────────────────────────────────────
function DocsScreen({C,company,docs,nav,onRefresh}){
  const [filt,setFilt]=useState('all')
  const [dir,setDir]=useState('all')
  const [q,setQ]=useState('')
  const filtered=docs.filter(d=>
    (filt==='all'||d.type===filt)&&
    (dir==='all'||d.direction===dir)&&
    (q===''||d.counterparty_name?.toLowerCase().includes(q.toLowerCase())||d.number?.toLowerCase().includes(q.toLowerCase()))
  )
  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:20}}>
      <div style={{padding:'8px 16px 0'}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Поиск документов..."
          style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 14px',color:C.text,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
      </div>
      <div style={{padding:'7px 16px 0',display:'flex',gap:5}}>
        {[['all','Все'],['out','📤 Исход.'],['in','📥 Входящ.']].map(([v,l])=>(
          <button key={v} onClick={()=>setDir(v)} style={{padding:'5px 10px',borderRadius:12,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:dir===v?C.p:C.card2,color:dir===v?'#fff':C.muted}}>{l}</button>
        ))}
      </div>
      <div style={{padding:'5px 16px 0',display:'flex',gap:4,overflowX:'auto'}}>
        {[['all','Все'],...Object.entries(DOC_TYPES)].map(([v,l])=>(
          <button key={v} onClick={()=>setFilt(v)} style={{padding:'3px 9px',borderRadius:10,border:`1px solid ${filt===v?C.p:C.border}`,cursor:'pointer',fontSize:9,fontWeight:600,whiteSpace:'nowrap',background:filt===v?C.pSoft:'transparent',color:filt===v?C.p:C.muted,flexShrink:0}}>{l}</button>
        ))}
      </div>
      <div style={{padding:'8px 16px 0'}}>
        {filtered.length===0?(
          <div style={{textAlign:'center',padding:'32px 0'}}>
            <p style={{color:C.muted,fontSize:13}}>Документов не найдено</p>
            <Btn onClick={()=>nav('newDoc',{})} col={C.p} style={{maxWidth:200,margin:'12px auto 0'}}>+ Создать</Btn>
          </div>
        ):filtered.map(doc=>(
          <div key={doc.id} onClick={()=>nav('docDetail',{doc})} style={{background:C.card,borderRadius:13,padding:'10px 12px',marginBottom:7,cursor:'pointer',border:`1px solid ${C.border}`}}>
            <div style={{display:'flex',gap:9,alignItems:'center'}}>
              <div style={{width:34,height:34,borderRadius:10,background:`${DOC_COLORS[doc.type]||C.p}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{DOC_ICONS[doc.type]||'📄'}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:C.text,fontSize:12,fontWeight:600,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.counterparty_name||'—'}</p>
                <p style={{color:C.dim,fontSize:9,margin:'2px 0 0'}}>{DOC_TYPES[doc.type]} · {doc.number}</p>
              </div>
              {Number(doc.amount)>0&&<p style={{color:C.text,fontSize:11,fontWeight:700,margin:0,flexShrink:0}}>{fmt(Number(doc.amount))}</p>}
            </div>
            <div style={{marginTop:7,paddingTop:5,borderTop:`1px solid ${C.border}`,display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
              <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,background:doc.direction==='out'?C.pSoft:'rgba(34,197,94,.12)',color:doc.direction==='out'?C.p:C.green,fontWeight:600}}>{doc.direction==='out'?'📤 Исходящий':'📥 Входящий'}</span>
              <span style={{color:C.dim,fontSize:9}}>{doc.date}</span>
              <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:doc.pay_status==='paid'?'rgba(34,197,94,.13)':doc.pay_status==='partial'?'rgba(245,158,11,.13)':'rgba(239,68,68,.13)',color:doc.pay_status==='paid'?C.green:doc.pay_status==='partial'?C.gold:C.red}}>{doc.pay_status==='paid'?'✅ Оплачен':doc.pay_status==='partial'?'⚡ Частично':'⏳ Не оплачен'}</span>
              {doc.nds_amount>0&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:8,background:C.gSoft,color:C.gold,fontWeight:600}}>НДС</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── NEW DOC SCREEN ───────────────────────────────────────────────
function NewDocScreen({C,company,cpList,nomList,initType,onBack,onSaved}){
  const [step,setStep]=useState(1)
  const [type,setType]=useState(initType||'invoice')
  const [direction,setDirection]=useState('out')
  const [cpId,setCpId]=useState('')
  const [cpName,setCpName]=useState('')
  const [date,setDate]=useState(today())
  const [rows,setRows]=useState([{name:'',qty:1,unit:'усл',price:'',nds_rate:company?.nds?16:0}])
  const [notes,setNotes]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  const totalNds=rows.reduce((s,r)=>s+Math.round(Number(r.price)*Number(r.qty)*Number(r.nds_rate)/116),0)
  const totalAmt=rows.reduce((s,r)=>s+Number(r.price)*Number(r.qty),0)

  function addRow(){setRows(r=>[...r,{name:'',qty:1,unit:'усл',price:'',nds_rate:company?.nds?16:0}])}
  function updRow(i,k,v){setRows(r=>r.map((row,idx)=>idx===i?{...row,[k]:v}:row))}
  function removeRow(i){setRows(r=>r.filter((_,idx)=>idx!==i))}

  function fillFromNom(i,nom){
    updRow(i,'name',nom.name)
    updRow(i,'unit',nom.unit)
    updRow(i,'price',String(nom.price))
    updRow(i,'nds_rate',nom.nds_rate)
  }

  async function save(){
    if(!cpName){setError('Укажите контрагента');return}
    if(rows.some(r=>!r.name||!r.price)){setError('Заполните все строки документа');return}
    setLoading(true);setError('')
    const docNum=await documents.nextNumber(company.id,type)
    const{data,error:e}=await documents.create({
      company_id:company.id,type,number:docNum,date,direction,
      counterparty_id:cpId||null,counterparty_name:cpName,
      amount:totalAmt,nds_amount:totalNds,
      items:rows,notes,status:'draft',pay_status:'unpaid'
    })
    setLoading(false)
    if(e){setError(e.message);return}
    onSaved(data)
  }

  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:28,position:'relative'}}>
      <div style={{padding:'14px 16px 0',display:'flex',alignItems:'center',gap:10}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:C.p,fontSize:28,padding:0,lineHeight:1}}>‹</button>
        <div><h2 style={{color:C.text,fontSize:14,fontWeight:700,margin:0}}>Новый документ</h2><p style={{color:C.muted,fontSize:9,margin:0}}>Шаг {step} из 3</p></div>
      </div>
      <div style={{padding:'7px 16px 0',display:'flex',gap:3}}>
        {[1,2,3].map(s=><div key={s} style={{flex:1,height:2.5,borderRadius:2,background:s<=step?C.p:C.card2}}/>)}
      </div>
      <div style={{padding:'12px 16px 0'}}>
        {error&&<Alert type="error" C={C}>{error}</Alert>}
        {step===1&&(
          <>
            <Sec C={C}>Тип документа</Sec>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
              {Object.entries(DOC_TYPES).map(([v,l])=>(
                <button key={v} onClick={()=>setType(v)} style={{padding:'7px 12px',borderRadius:11,border:`1.5px solid ${type===v?DOC_COLORS[v]:C.border}`,background:type===v?`${DOC_COLORS[v]}15`:'transparent',color:type===v?DOC_COLORS[v]:C.muted,fontSize:10,fontWeight:600,cursor:'pointer'}}>
                  {DOC_ICONS[v]} {l}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {[['out','📤 Исходящий'],['in','📥 Входящий']].map(([v,l])=>(
                <button key={v} onClick={()=>setDirection(v)} style={{flex:1,padding:'9px',borderRadius:11,border:`1.5px solid ${direction===v?C.p:C.border}`,background:direction===v?C.pSoft:'transparent',color:direction===v?C.p:C.muted,fontSize:11,fontWeight:600,cursor:'pointer'}}>{l}</button>
              ))}
            </div>
            <Inp label="Дата" value={date} onChange={setDate} type="date" C={C}/>
            <Btn onClick={()=>setStep(2)}>Далее →</Btn>
          </>
        )}
        {step===2&&(
          <>
            <Sec C={C}>Контрагент</Sec>
            {cpList.length>0&&(
              <div style={{marginBottom:10}}>
                <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 6px',textTransform:'uppercase'}}>Выбрать из базы:</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {cpList.map(cp=>(
                    <button key={cp.id} onClick={()=>{setCpId(cp.id);setCpName(cp.name)}} style={{padding:'5px 11px',borderRadius:10,border:`1.5px solid ${cpId===cp.id?C.p:C.border}`,background:cpId===cp.id?C.pSoft:'transparent',color:cpId===cp.id?C.p:C.text,fontSize:10,fontWeight:600,cursor:'pointer'}}>{cp.name}</button>
                  ))}
                </div>
              </div>
            )}
            <Inp label="Или введите вручную" value={cpName} onChange={v=>{setCpName(v);setCpId('')}} placeholder='ТОО "Компания" / ИП Иванов' C={C}/>
            <div style={{display:'flex',gap:7}}>
              <SBtn onClick={()=>setStep(1)} C={C} style={{flex:1}}>← Назад</SBtn>
              <Btn onClick={()=>cpName&&setStep(3)} disabled={!cpName} style={{flex:2}}>Далее →</Btn>
            </div>
          </>
        )}
        {step===3&&(
          <>
            <Sec C={C}>Товары / Услуги</Sec>
            {rows.map((row,i)=>(
              <div key={i} style={{background:C.card2,borderRadius:12,padding:'10px',marginBottom:8,border:`1px solid ${C.border}`}}>
                <div style={{display:'flex',gap:6,marginBottom:6}}>
                  <div style={{flex:1}}>
                    <p style={{color:C.muted,fontSize:8,margin:'0 0 3px',textTransform:'uppercase'}}>Наименование *</p>
                    <input value={row.name} onChange={e=>updRow(i,'name',e.target.value)} placeholder="Услуга/товар"
                      list={`nom-${i}`}
                      style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 10px',color:C.text,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                    <datalist id={`nom-${i}`}>{nomList.map(n=><option key={n.id} value={n.name}/>)}</datalist>
                  </div>
                  {rows.length>1&&<button onClick={()=>removeRow(i)} style={{background:'rgba(239,68,68,.1)',border:'none',borderRadius:9,padding:'0 10px',cursor:'pointer',color:C.red,fontSize:14,flexShrink:0,marginTop:15}}>✕</button>}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
                  <div>
                    <p style={{color:C.muted,fontSize:8,margin:'0 0 3px',textTransform:'uppercase'}}>Кол-во</p>
                    <input value={row.qty} onChange={e=>updRow(i,'qty',e.target.value)} type="number" min="1"
                      style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 10px',color:C.text,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                  </div>
                  <div>
                    <p style={{color:C.muted,fontSize:8,margin:'0 0 3px',textTransform:'uppercase'}}>Ед.изм.</p>
                    <select value={row.unit} onChange={e=>updRow(i,'unit',e.target.value)}
                      style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 6px',color:C.text,fontSize:12,outline:'none',appearance:'none',fontFamily:'inherit'}}>
                      {['усл','шт','кг','м','м²','л','час'].map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{color:C.muted,fontSize:8,margin:'0 0 3px',textTransform:'uppercase'}}>Цена ₸</p>
                    <input value={row.price} onChange={e=>updRow(i,'price',e.target.value)} type="number" placeholder="0"
                      style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 10px',color:C.text,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                  </div>
                  <div>
                    <p style={{color:C.muted,fontSize:8,margin:'0 0 3px',textTransform:'uppercase'}}>НДС %</p>
                    <select value={row.nds_rate} onChange={e=>updRow(i,'nds_rate',Number(e.target.value))}
                      style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 6px',color:C.text,fontSize:12,outline:'none',appearance:'none',fontFamily:'inherit'}}>
                      <option value={0}>0%</option><option value={16}>16%</option>
                    </select>
                  </div>
                </div>
                {Number(row.price)>0&&<p style={{color:C.muted,fontSize:9,margin:'6px 0 0',textAlign:'right'}}>Итого: {fmt(Number(row.price)*Number(row.qty))}</p>}
              </div>
            ))}
            <button onClick={addRow} style={{width:'100%',padding:'9px',borderRadius:11,background:'transparent',border:`1.5px dashed ${C.border}`,color:C.muted,fontSize:12,cursor:'pointer',marginBottom:10}}>+ Добавить строку</button>
            {totalAmt>0&&(
              <div style={{background:C.pSoft,borderRadius:13,padding:'12px',marginBottom:10,border:`1px solid ${C.border}`}}>
                {totalNds>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:C.muted,fontSize:11}}>Без НДС:</span><span style={{color:C.text,fontSize:11,fontWeight:600}}>{fmt(totalAmt-totalNds)}</span></div>}
                {totalNds>0&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{color:C.muted,fontSize:11}}>НДС:</span><span style={{color:C.gold,fontSize:11,fontWeight:600}}>{fmt(totalNds)}</span></div>}
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.text,fontSize:13,fontWeight:700}}>ИТОГО:</span><span style={{color:C.p,fontSize:18,fontWeight:900}}>{fmt(totalAmt)}</span></div>
              </div>
            )}
            <Inp label="Примечание" value={notes} onChange={setNotes} placeholder="Согласно договору №..." C={C}/>
            <div style={{display:'flex',gap:7,marginBottom:8}}>
              <SBtn onClick={()=>setStep(2)} C={C} style={{flex:1}}>← Назад</SBtn>
              <Btn onClick={save} loading={loading} style={{flex:2}}>💾 Сохранить</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── DOC DETAIL ───────────────────────────────────────────────────
function DocDetailScreen({C,doc,onBack,onUpdate,company}){
  const [loading,setLoading]=useState(false)
  if(!doc) return null
  const items=doc.items||[]

  async function updatePayStatus(status){
    setLoading(true)
    await documents.update(doc.id,{pay_status:status})
    setLoading(false)
    onUpdate()
  }

  const shareText=`${DOC_TYPES[doc.type]||'Документ'} №${doc.number}\nот ${doc.date}\n\nОт: ${company?.name||''}\nКому: ${doc.counterparty_name||''}\nСумма: ${fmt(Number(doc.amount))}\n${doc.nds_amount>0?`в т.ч. НДС: ${fmt(Number(doc.nds_amount))}\n`:''}\nРеквизиты:\nБанк: ${company?.bank||''}\nИИК: ${company?.iik||''}`

  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:24}}>
      <div style={{padding:'14px 16px 0',display:'flex',alignItems:'center',gap:10}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:C.p,fontSize:28,padding:0,lineHeight:1}}>‹</button>
        <h2 style={{color:C.text,fontSize:14,fontWeight:700,margin:0}}>{DOC_ICONS[doc.type]} {DOC_TYPES[doc.type]} №{doc.number}</h2>
      </div>
      <div style={{padding:'12px 16px 0'}}>
        {/* Doc card */}
        <div style={{background:C.card,borderRadius:16,padding:'16px',border:`1.5px solid ${DOC_COLORS[doc.type]||C.p}28`,marginBottom:10}}>
          <div style={{borderBottom:`2px solid ${DOC_COLORS[doc.type]||C.p}`,paddingBottom:10,marginBottom:10,display:'flex',justifyContent:'space-between'}}>
            <div>
              <p style={{color:DOC_COLORS[doc.type]||C.p,fontSize:11,fontWeight:800,margin:'0 0 2px',textTransform:'uppercase'}}>{DOC_TYPES[doc.type]} №{doc.number}</p>
              <p style={{color:C.muted,fontSize:9,margin:0}}>от {doc.date} · {doc.direction==='out'?'Исходящий':'Входящий'}</p>
            </div>
            <Logo size={24}/>
          </div>
          {/* Supplier */}
          <div style={{marginBottom:8}}>
            {[['Поставщик',company?.name],['БИН',company?.bin],['Банк',company?.bank],['ИИК',company?.iik]].map(([l,v])=>v?(
              <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{color:C.muted,fontSize:9}}>{l}</span>
                <span style={{color:C.text,fontSize:9,fontWeight:600,maxWidth:'55%',textAlign:'right'}}>{v}</span>
              </div>
            ):null)}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,marginBottom:8}}>
            <p style={{color:C.muted,fontSize:8,margin:'0 0 2px',textTransform:'uppercase'}}>Покупатель / Заказчик</p>
            <p style={{color:C.text,fontSize:12,fontWeight:700,margin:0}}>{doc.counterparty_name||'—'}</p>
          </div>
          {/* Items table */}
          {items.length>0&&(
            <div style={{background:C.card2,borderRadius:10,padding:'10px',marginBottom:8}}>
              <p style={{color:C.muted,fontSize:8,fontWeight:700,margin:'0 0 6px',textTransform:'uppercase'}}>Состав документа</p>
              {items.map((row,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:4,paddingBottom:4,borderBottom:i<items.length-1?`1px solid ${C.border}`:'none'}}>
                  <span style={{color:C.text,fontSize:10,maxWidth:'55%'}}>{row.name} ({row.qty} {row.unit})</span>
                  <span style={{color:C.text,fontSize:10,fontWeight:600}}>{fmt(Number(row.price)*Number(row.qty))}</span>
                </div>
              ))}
              {Number(doc.nds_amount)>0&&(
                <>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}><span style={{color:C.muted,fontSize:10}}>Без НДС</span><span style={{color:C.text,fontSize:10}}>{fmt(Number(doc.amount)-Number(doc.nds_amount))}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.muted,fontSize:10}}>НДС 16%</span><span style={{color:C.gold,fontSize:10}}>{fmt(Number(doc.nds_amount))}</span></div>
                </>
              )}
              <div style={{display:'flex',justifyContent:'space-between',paddingTop:6,borderTop:`1px solid ${C.border}`}}>
                <span style={{color:C.text,fontSize:12,fontWeight:700}}>ИТОГО</span>
                <span style={{color:C.text,fontSize:14,fontWeight:900}}>{fmt(Number(doc.amount))}</span>
              </div>
            </div>
          )}
          {doc.notes&&<p style={{color:C.muted,fontSize:10,margin:'0 0 8px',fontStyle:'italic'}}>{doc.notes}</p>}
          {/* Status */}
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {[['unpaid','⏳ Не оплачен','rgba(239,68,68,.13)',C.red],['partial','⚡ Частично','rgba(245,158,11,.13)',C.gold],['paid','✅ Оплачен','rgba(34,197,94,.13)',C.green]].map(([v,l,bg,col])=>(
              <button key={v} onClick={()=>updatePayStatus(v)} disabled={loading}
                style={{padding:'5px 11px',borderRadius:10,border:`1.5px solid ${doc.pay_status===v?col:C.border}`,background:doc.pay_status===v?bg:'transparent',color:doc.pay_status===v?col:C.muted,fontSize:10,fontWeight:doc.pay_status===v?700:400,cursor:'pointer'}}>{l}</button>
            ))}
          </div>
        </div>
        {/* Actions */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:8}}>
          <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
            style={{display:'block',padding:'11px',borderRadius:12,background:'rgba(37,211,102,.12)',border:'1px solid rgba(37,211,102,.25)',color:'#25d366',fontSize:11,fontWeight:600,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>
            💬 WhatsApp
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(DOC_TYPES[doc.type]+' №'+doc.number)}&body=${encodeURIComponent(shareText)}`}
            style={{display:'block',padding:'11px',borderRadius:12,background:C.pSoft,border:`1px solid ${C.border}`,color:C.p,fontSize:11,fontWeight:600,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>
            📧 Email
          </a>
        </div>
        <button onClick={async()=>{if(confirm('Удалить документ?')){await documents.delete(doc.id);onBack()}}}
          style={{width:'100%',padding:'10px',borderRadius:12,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:C.red,fontSize:11,fontWeight:600,cursor:'pointer'}}>
          🗑 Удалить документ
        </button>
      </div>
    </div>
  )
}

// ─── COUNTERPARTIES SCREEN ────────────────────────────────────────
function CpScreen({C,company,cpList,onRefresh}){
  const [q,setQ]=useState('')
  const [showAdd,setShowAdd]=useState(false)
  const [form,setForm]=useState({name:'',bin:'',type:'client',nds:false,bank:'',iik:'',phone:'',email:'',contact:''})
  const [loading,setLoading]=useState(false)
  const upd=k=>v=>setForm(f=>({...f,[k]:v}))
  const filtered=cpList.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())||c.bin?.includes(q))

  async function save(){
    if(!form.name){return}
    setLoading(true)
    await counterparties.create({...form,company_id:company.id})
    setLoading(false)
    setShowAdd(false)
    setForm({name:'',bin:'',type:'client',nds:false,bank:'',iik:'',phone:'',email:'',contact:''})
    onRefresh()
  }

  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:20}}>
      <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Поиск контрагентов..."
          style={{flex:1,background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 14px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
        <button onClick={()=>setShowAdd(true)} style={{padding:'10px 16px',borderRadius:12,background:C.p,border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>+ Добавить</button>
      </div>
      <div style={{padding:'8px 16px 0'}}>
        {filtered.map(cp=>(
          <div key={cp.id} style={{background:C.card,borderRadius:12,padding:'11px 12px',marginBottom:7,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:38,height:38,borderRadius:19,background:C.pSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:C.p,flexShrink:0}}>{cp.name[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:C.text,fontSize:12,fontWeight:600,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cp.name}</p>
              <p style={{color:C.dim,fontSize:9,margin:'2px 0 4px'}}>{cp.bin?`БИН: ${cp.bin}`:'БИН не указан'}</p>
              <div style={{display:'flex',gap:4}}>
                <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,background:cp.type==='client'?C.pSoft:'rgba(249,115,22,.12)',color:cp.type==='client'?C.p:C.orange,fontWeight:600}}>{cp.type==='client'?'Клиент':'Поставщик'}</span>
                {cp.nds&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:8,background:C.gSoft,color:C.gold,fontWeight:600}}>НДС</span>}
              </div>
            </div>
          </div>
        ))}
        {filtered.length===0&&<p style={{color:C.muted,textAlign:'center',padding:'32px 0',fontSize:12}}>Контрагентов не найдено</p>}
      </div>
      {/* Add modal */}
      {showAdd&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'flex-end',zIndex:200}}>
          <div style={{background:C.card,borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column',padding:'18px 18px 26px',overflow:'hidden'}}>
            <div style={{width:36,height:4,background:C.dim,borderRadius:2,margin:'0 auto 14px'}}/>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:'0 0 14px'}}>Добавить контрагента</h3>
            <div style={{overflowY:'auto',flex:1}}>
              <Inp label="Название *" value={form.name} onChange={upd('name')} placeholder='ТОО "Компания" / ИП Иванов' C={C}/>
              <Inp label="БИН / ИИН" value={form.bin} onChange={v=>upd('bin')(v.replace(/\D/,'').slice(0,12))} placeholder="123456789012" type="tel" C={C}/>
              <Sel label="Тип" value={form.type} onChange={upd('type')} C={C} options={[['client','Клиент'],['supplier','Поставщик']]}/>
              <div onClick={()=>upd('nds')(!form.nds)} style={{background:form.nds?C.gSoft:C.card2,border:`1.5px solid ${form.nds?C.gold:C.border}`,borderRadius:12,padding:'10px 13px',marginBottom:10,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <p style={{color:C.text,fontSize:12,fontWeight:600,margin:0}}>Плательщик НДС</p>
                <Toggle on={form.nds} onToggle={()=>upd('nds')(!form.nds)} col={C.gold}/>
              </div>
              <Inp label="Телефон" value={form.phone} onChange={upd('phone')} placeholder="+7 700 000 00 00" type="tel" C={C}/>
              <Inp label="Email" value={form.email} onChange={upd('email')} placeholder="email@company.kz" C={C}/>
              <Inp label="Контактное лицо" value={form.contact} onChange={upd('contact')} placeholder="Иванов Иван" C={C}/>
              <Inp label="Банк" value={form.bank} onChange={upd('bank')} placeholder="Halyk Bank" C={C}/>
              <Inp label="ИИК" value={form.iik} onChange={upd('iik')} placeholder="KZ..." C={C}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12,flexShrink:0}}>
              <SBtn onClick={()=>setShowAdd(false)} C={C} style={{flex:1}}>Отмена</SBtn>
              <Btn onClick={save} loading={loading} style={{flex:2}}>💾 Сохранить</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NOMENCLATURE SCREEN ──────────────────────────────────────────
function NomScreen({C,company,nomList,onRefresh}){
  const [q,setQ]=useState('')
  const [showAdd,setShowAdd]=useState(false)
  const [form,setForm]=useState({name:'',description:'',unit:'усл',price:'',nds_rate:0,category:''})
  const [loading,setLoading]=useState(false)
  const upd=k=>v=>setForm(f=>({...f,[k]:v}))
  const filtered=nomList.filter(n=>n.name.toLowerCase().includes(q.toLowerCase()))

  async function save(){
    if(!form.name){return}
    setLoading(true)
    await nomenclature.create({...form,company_id:company.id,price:Number(form.price)||0})
    setLoading(false)
    setShowAdd(false)
    setForm({name:'',description:'',unit:'усл',price:'',nds_rate:0,category:''})
    onRefresh()
  }

  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:20}}>
      <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Поиск..."
          style={{flex:1,background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 14px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
        <button onClick={()=>setShowAdd(true)} style={{padding:'10px 16px',borderRadius:12,background:C.p,border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>+ Добавить</button>
      </div>
      <div style={{padding:'8px 16px 0'}}>
        {filtered.map(n=>(
          <div key={n.id} style={{background:C.card,borderRadius:12,padding:'11px 12px',marginBottom:6,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:C.pSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>📦</div>
            <div style={{flex:1}}>
              <p style={{color:C.text,fontSize:12,fontWeight:600,margin:0}}>{n.name}</p>
              <p style={{color:C.muted,fontSize:9,margin:'2px 0 0'}}>{n.unit} · {n.nds_rate>0?`НДС ${n.nds_rate}%`:'Без НДС'}</p>
            </div>
            <p style={{color:C.p,fontSize:12,fontWeight:700,margin:0,flexShrink:0}}>{n.price>0?fmt(n.price):'—'}</p>
          </div>
        ))}
        {filtered.length===0&&<p style={{color:C.muted,textAlign:'center',padding:'32px 0',fontSize:12}}>Позиций не найдено</p>}
      </div>
      {showAdd&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'flex-end',zIndex:200}}>
          <div style={{background:C.card,borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'80vh',display:'flex',flexDirection:'column',padding:'18px 18px 26px',overflow:'hidden'}}>
            <div style={{width:36,height:4,background:C.dim,borderRadius:2,margin:'0 auto 14px'}}/>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:'0 0 14px'}}>Добавить позицию</h3>
            <div style={{overflowY:'auto',flex:1}}>
              <Inp label="Наименование *" value={form.name} onChange={upd('name')} placeholder="Разработка сайта / Ноутбук HP" C={C}/>
              <Inp label="Описание" value={form.description} onChange={upd('description')} placeholder="Краткое описание" C={C}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <Sel label="Единица" value={form.unit} onChange={upd('unit')} C={C} options={[['усл','усл'],['шт','шт'],['кг','кг'],['м','м'],['м²','м²'],['л','л'],['час','час']]}/>
                <Sel label="НДС" value={form.nds_rate} onChange={v=>upd('nds_rate')(Number(v))} C={C} options={[['0','0%'],['16','16%']]}/>
              </div>
              <Inp label="Цена по умолчанию ₸" value={form.price} onChange={upd('price')} type="number" placeholder="0" C={C}/>
              <Inp label="Категория" value={form.category} onChange={upd('category')} placeholder="Услуги / Товары / IT" C={C}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12,flexShrink:0}}>
              <SBtn onClick={()=>setShowAdd(false)} C={C} style={{flex:1}}>Отмена</SBtn>
              <Btn onClick={save} loading={loading} style={{flex:2}}>💾 Сохранить</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────
function ProfileScreen({C,profile,company,onLogout}){
  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:20}}>
      <div style={{padding:'10px 16px 0'}}>
        {company&&(
          <div style={{background:'linear-gradient(135deg,#1a0f4e,#2d1f8a)',borderRadius:20,padding:'16px',marginBottom:14,border:`1px solid ${C.border2}`,display:'flex',gap:12,alignItems:'center'}}>
            <div style={{padding:8,background:'rgba(255,255,255,.1)',borderRadius:14}}><Logo size={32}/></div>
            <div>
              <h3 style={{color:'#fff',fontSize:13,fontWeight:800,margin:'0 0 2px'}}>{company.name}</h3>
              <p style={{color:'rgba(255,255,255,.55)',fontSize:9,margin:'0 0 5px'}}>БИН: {company.bin} · с {company.created_at?.split('T')[0]}</p>
              <div style={{display:'flex',gap:4}}>
                {[company.type?.toUpperCase(),company.regime?.toUpperCase(),company.nds?'НДС':'Без НДС'].map((t,i)=><span key={i} style={{fontSize:8,padding:'2px 6px',borderRadius:8,background:'rgba(124,111,255,.35)',color:'#fff',fontWeight:600}}>{t}</span>)}
              </div>
            </div>
          </div>
        )}
        {company&&<>
          <Sec C={C}>Реквизиты</Sec>
          {[['Директор',company.director],['Адрес',company.address],['Телефон',company.phone],['Email',company.email],['Банк',company.bank],['ИИК',company.iik]].map(([l,v])=>v?(
            <div key={l} style={{marginBottom:9}}>
              <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 3px',textTransform:'uppercase'}}>{l}</p>
              <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 13px',color:C.text,fontSize:12}}>{v}</div>
            </div>
          ):null)}
        </>}
        <Sec C={C}>Аккаунт</Sec>
        <div style={{background:C.card,borderRadius:13,padding:'11px 13px',marginBottom:10,border:`1px solid ${C.border}`}}>
          <p style={{color:C.muted,fontSize:9,margin:'0 0 3px',textTransform:'uppercase'}}>Email</p>
          <p style={{color:C.text,fontSize:12,margin:0}}>{profile?.email||'—'}</p>
        </div>
        <div style={{background:C.card,borderRadius:13,padding:'11px 13px',marginBottom:12,border:`1px solid ${C.border}`,textAlign:'center'}}>
          <p style={{color:C.muted,fontSize:8,margin:'0 0 2px'}}>© 2026 ТОО «NOVA Comp». Все права защищены.</p>
          <p style={{color:C.dim,fontSize:7,margin:0}}>Закон РК «Об авторском праве» №6-I · BizBook KZ v5.0</p>
        </div>
        <button onClick={onLogout} style={{width:'100%',padding:'12px',borderRadius:12,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:C.red,fontSize:12,fontWeight:600,cursor:'pointer'}}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}

// ─── ADMIN SCREEN ─────────────────────────────────────────────────
function AdminScreen({C,allCompanies,allTariffs,onRefresh}){
  const [loading,setLoading]=useState(false)
  const [selCo,setSelCo]=useState(null)
  const [tariffId,setTariffId]=useState('')
  const [until,setUntil]=useState('')

  async function assignTariff(){
    if(!selCo||!tariffId){return}
    setLoading(true)
    await companies.setTariff(selCo,tariffId,until||null)
    setLoading(false)
    setSelCo(null)
    onRefresh()
  }
  async function toggleStatus(co){
    const newStatus=co.status==='active'?'suspended':'active'
    await companies.setStatus(co.id,newStatus)
    onRefresh()
  }

  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:20}}>
      <div style={{padding:'10px 16px 0'}}>
        <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',borderRadius:12,padding:'10px 13px',marginBottom:12}}>
          <p style={{color:C.red,fontSize:11,fontWeight:700,margin:'0 0 2px'}}>🔧 Панель администратора</p>
          <p style={{color:C.muted,fontSize:10,margin:0}}>Видна только тебе · Управление клиентами и тарифами</p>
        </div>
        <Sec C={C}>Все компании ({allCompanies.length})</Sec>
        {allCompanies.map(co=>(
          <div key={co.id} style={{background:C.card,borderRadius:13,padding:'12px',marginBottom:8,border:`1px solid ${co.status==='active'?`${C.green}30`:co.status==='suspended'?`${C.red}30`:C.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:C.text,fontSize:12,fontWeight:700,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{co.name}</p>
                <p style={{color:C.muted,fontSize:9,margin:'0 0 4px'}}>БИН: {co.bin} · {co.profiles?.email}</p>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:co.status==='active'?'rgba(34,197,94,.13)':co.status==='suspended'?'rgba(239,68,68,.13)':'rgba(245,158,11,.13)',color:co.status==='active'?C.green:co.status==='suspended'?C.red:C.gold}}>{co.status==='active'?'✅ Активна':co.status==='suspended'?'🔴 Заблокирована':'⏳ Ожидает'}</span>
                  {co.tariffs&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:8,background:C.pSoft,color:C.p,fontWeight:600}}>📋 {co.tariffs.name}</span>}
                </div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              <button onClick={()=>setSelCo(selCo===co.id?null:co.id)} style={{padding:'7px',borderRadius:9,background:C.pSoft,border:`1px solid ${C.border}`,color:C.p,fontSize:10,fontWeight:600,cursor:'pointer'}}>💳 Назначить тариф</button>
              <button onClick={()=>toggleStatus(co)} style={{padding:'7px',borderRadius:9,background:co.status==='active'?'rgba(239,68,68,.1)':'rgba(34,197,94,.1)',border:`1px solid ${co.status==='active'?'rgba(239,68,68,.2)':'rgba(34,197,94,.2)'}`,color:co.status==='active'?C.red:C.green,fontSize:10,fontWeight:600,cursor:'pointer'}}>
                {co.status==='active'?'🔴 Заблокировать':'✅ Активировать'}
              </button>
            </div>
            {selCo===co.id&&(
              <div style={{marginTop:8,padding:'10px',background:C.card2,borderRadius:10,border:`1px solid ${C.border}`}}>
                <Sel label="Тариф" value={tariffId} onChange={setTariffId} C={C} options={[['','Выберите тариф'],...allTariffs.map(t=>[t.id,`${t.name} — ${t.price_month} ₸/мес`])]}/>
                <Inp label="Действует до (опционально)" value={until} onChange={setUntil} type="date" C={C}/>
                <div style={{display:'flex',gap:7}}>
                  <SBtn onClick={()=>setSelCo(null)} C={C} style={{flex:1}}>Отмена</SBtn>
                  <Btn onClick={assignTariff} loading={loading} style={{flex:2}}>✅ Назначить</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
        {allCompanies.length===0&&<p style={{color:C.muted,textAlign:'center',padding:'24px 0',fontSize:12}}>Компаний пока нет</p>}
      </div>
    </div>
  )
}

// ─── WATERMARK ───────────────────────────────────────────────────
const WM=()=><div style={{position:'fixed',bottom:0,right:0,opacity:.013,fontSize:6,color:'#fff',writingMode:'vertical-rl',padding:3,letterSpacing:2,pointerEvents:'none',userSelect:'none',zIndex:9999,lineHeight:1.2}}>{'© 2026 ТОО «NOVA Comp» BizBook KZ v5 Закон РК «Об авторском праве» №6-I '.repeat(6)}</div>

// ─── APP ROOT ─────────────────────────────────────────────────────
export default function App(){
  const{C,mode,setMode}=useTheme()
  const{lang,setLang}=useLang()
  const vw=useVw()
  const isMd=vw>=768

  // Auth state
  const[user,setUser]=useState(null)
  const[profile,setProfile]=useState(null)
  const[authLoading,setAuthLoading]=useState(true)

  // App state
  const[screen,setScreen]=useState('home')
  const[screenParams,setScreenParams]=useState({})
  const[company,setCompany]=useState(null)
  const[docs,setDocs]=useState([])
  const[cpList,setCpList]=useState([])
  const[nomList,setNomList]=useState([])
  const[allCompanies,setAllCompanies]=useState([])
  const[allTariffs,setAllTariffs]=useState([])

  const isAdmin=profile?.role==='admin'

  // Nav helper
  const nav=useCallback((s,params={})=>{setScreen(s);setScreenParams(params)},[])

  // Auth listener
  useEffect(()=>{
    auth.getSession().then(({data})=>{
      setUser(data?.session?.user||null)
      setAuthLoading(false)
    })
    const{data:{subscription}}=auth.onAuthStateChange((_,session)=>{
      setUser(session?.user||null)
      setAuthLoading(false)
    })
    return()=>subscription.unsubscribe()
  },[])

  // Load profile + data when user changes
  useEffect(()=>{
    if(!user){setProfile(null);setCompany(null);setDocs([]);setCpList([]);setNomList([]);return}
    loadAll()
  },[user])

  async function loadAll(){
    // Profile
    const{data:p}=await profiles.get(user.id)
    setProfile(p)

    // Company (first one)
    const{data:cos}=await companies.list(user.id)
    const co=cos?.[0]||null
    setCompany(co)

    if(co){
      // Docs
      const{data:ds}=await documents.list(co.id)
      setDocs(ds||[])
      // CPs
      const{data:cps}=await counterparties.list(co.id)
      setCpList(cps||[])
      // Nom
      const{data:noms}=await nomenclature.list(co.id)
      setNomList(noms||[])
    }

    // Admin data
    if(p?.role==='admin'){
      const{data:acs}=await companies.listAll()
      setAllCompanies(acs||[])
      const{data:tfs}=await tariffs.list()
      setAllTariffs(tfs||[])
    }
  }

  async function handleLogout(){
    await auth.signOut()
  }

  // Loading
  if(authLoading) return(
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}>
        <Logo size={56}/>
        <p style={{color:C.muted,fontSize:12,marginTop:16}}>Загрузка...</p>
      </div>
    </div>
  )

  // Not authenticated
  if(!user) return <AuthScreen C={C}/>

  // Company registration
  if(!company&&screen!=='register') return(
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:'system-ui,-apple-system,sans-serif',display:'flex',flexDirection:'column'}}>
      <CompanyRegister C={C} userId={user.id} onDone={(co)=>{setCompany(co);loadAll();nav('home')}}/>
    </div>
  )
  if(screen==='register') return(
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:'system-ui,-apple-system,sans-serif',display:'flex',flexDirection:'column'}}>
      <CompanyRegister C={C} userId={user.id} onDone={(co)=>{setCompany(co);loadAll();nav('home')}}/>
    </div>
  )

  // Page title
  const titles={home:'Главная',docs:'Документы',counterparties:'Контрагенты',nomenclature:'Номенклатура',profile:'Профиль',admin:'Панель админа',newDoc:'Новый документ',docDetail:'Документ'}
  const title=titles[screen]||'BizBook KZ'

  // Render content
  const renderContent=()=>{
    if(screen==='newDoc') return <NewDocScreen C={C} company={company} cpList={cpList} nomList={nomList} initType={screenParams.type} onBack={()=>nav('docs')} onSaved={()=>{loadAll();nav('docs')}}/>
    if(screen==='docDetail') return <DocDetailScreen C={C} doc={screenParams.doc} company={company} onBack={()=>nav('docs')} onUpdate={loadAll}/>
    if(screen==='docs') return <DocsScreen C={C} company={company} docs={docs} nav={nav} onRefresh={loadAll}/>
    if(screen==='counterparties') return <CpScreen C={C} company={company} cpList={cpList} onRefresh={loadAll}/>
    if(screen==='nomenclature') return <NomScreen C={C} company={company} nomList={nomList} onRefresh={loadAll}/>
    if(screen==='profile') return <ProfileScreen C={C} profile={profile} company={company} onLogout={handleLogout}/>
    if(screen==='admin'&&isAdmin) return <AdminScreen C={C} allCompanies={allCompanies} allTariffs={allTariffs} onRefresh={loadAll}/>
    return <HomeScreen C={C} company={company} docs={docs} nav={nav}/>
  }

  // Desktop layout
  if(isMd){
    return(
      <div style={{display:'flex',minHeight:'100vh',background:C.bg,fontFamily:'system-ui,-apple-system,sans-serif'}}>
        <Sidebar screen={screen} nav={nav} C={C} mode={mode} setMode={setMode} lang={lang} setLang={setLang} profile={profile} isAdmin={isAdmin} onLogout={handleLogout} vw={vw}/>
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
          {!['newDoc','docDetail'].includes(screen)&&(
            <div style={{padding:'16px 24px 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <h2 style={{color:C.text,fontSize:19,fontWeight:800,margin:0}}>{title}</h2>
                {screen==='home'&&company&&<p style={{color:C.muted,fontSize:11,margin:0}}>{company.name} · {company.regime?.toUpperCase()} · {company.nds?'НДС 16%':'Без НДС'}</p>}
              </div>
              <div style={{display:'flex',gap:8}}>
                {screen==='docs'&&<button onClick={()=>nav('newDoc',{})} style={{padding:'8px 16px',borderRadius:12,background:C.p,border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Создать</button>}
              </div>
            </div>
          )}
          <div style={{flex:1,overflowY:'auto',padding:['newDoc','docDetail'].includes(screen)?0:'8px 24px 24px'}}>
            <div style={{maxWidth:900,margin:'0 auto'}}>{renderContent()}</div>
          </div>
        </div>
        <WM/>
      </div>
    )
  }

  // Mobile layout
  return(
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#06060f',fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <div style={{width:Math.min(390,vw),height:'100dvh',maxHeight:844,background:C.bg,borderRadius:vw<=390?0:44,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:vw<=390?'none':'0 40px 120px rgba(0,0,0,.99),0 0 0 1px rgba(124,111,255,.1)'}}>
        {!['newDoc','docDetail'].includes(screen)&&(
          <>
            <div style={{padding:'11px 22px 3px',display:'flex',justifyContent:'space-between',flexShrink:0}}>
              <span style={{color:C.text,fontSize:11,fontWeight:600}}>9:41</span>
              <span style={{color:C.text,fontSize:9}}>●●●● WiFi 🔋</span>
            </div>
            <div style={{padding:'8px 16px 0',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              <Sidebar screen={screen} nav={nav} C={C} mode={mode} setMode={setMode} lang={lang} setLang={setLang} profile={profile} isAdmin={isAdmin} onLogout={handleLogout} vw={vw}/>
              <div style={{flex:1}}>
                <h2 style={{color:C.text,fontSize:15,fontWeight:800,margin:0}}>{title}</h2>
                {screen==='home'&&company&&<p style={{color:C.muted,fontSize:10,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{company.name}</p>}
              </div>
              {screen==='docs'&&<button onClick={()=>nav('newDoc',{})} style={{padding:'5px 12px',borderRadius:11,background:C.p,border:'none',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0}}>+ Создать</button>}
            </div>
          </>
        )}
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>{renderContent()}</div>
      </div>
      <WM/>
    </div>
  )
}
