/**
 * BizBook KZ v5.0 — Рабочее приложение с Supabase
 * © 2026 ТОО «NOVA Comp». Все права защищены.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, auth, profiles, companies, tariffs, tariffRequests, counterparties, nomenclature, documents } from './lib/supabase.js'
import { MRP, MZP, calcSalary } from './data/constants.js'



function validateIIN(iin) {
  if (!iin || iin.length !== 12 || !/^\d{12}$/.test(iin)) return false
  const w1 = [1,2,3,4,5,6,7,8,9,10,11]
  const w2 = [3,4,5,6,7,8,9,10,11,1,2]
  const d = iin.split('').map(Number)
  let s = 0
  for (let i = 0; i < 11; i++) s += d[i] * w1[i]
  let r = s % 11
  if (r === 10) {
    s = 0
    for (let i = 0; i < 11; i++) s += d[i] * w2[i]
    r = s % 11
  }
  return r === d[11]
}
function getIINError(iin, type) {
  if (!iin) return ''
  if (!/^\d+$/.test(iin)) return 'Только цифры'
  if (iin.length < 12) return `Введите ещё ${12 - iin.length} цифр`
  if (iin.length > 12) return 'Не более 12 цифр'
  if (!validateIIN(iin)) return type === 'ip' ? 'Неверный ИИН. Проверьте правильность' : 'Неверный БИН. Проверьте правильность'
  return ''
}
function IINInput({label, value, onChange, type, C, required}) {
  const err = getIINError(value, type)
  const ok = value && value.length === 12 && !err
  return (
    <div style={{marginBottom:12}}>
      {label && <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:.6}}>{label}{required && <span style={{color:C.red}}> *</span>}</p>}
      <div style={{position:'relative'}}>
        <input
          value={value||''}
          onChange={e=>onChange(e.target.value.replace(/\D/g,'').slice(0,12))}
          placeholder={type==='ip'?'ИИН (12 цифр)':'БИН (12 цифр)'}
          type="tel"
          style={{width:'100%',background:C.inputBg,border:`1.5px solid ${err&&value&&value.length===12?C.red:ok?C.green:C.border2}`,borderRadius:12,padding:'11px 40px 11px 14px',color:C.text,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
        />
        {ok && <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:C.green,fontSize:16}}>✓</span>}
        {err && value && value.length===12 && <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:C.red,fontSize:16}}>✗</span>}
      </div>
      {err && value && value.length>0 && <p style={{color:C.red,fontSize:10,margin:'4px 0 0'}}>{err}</p>}
      {ok && <p style={{color:C.green,fontSize:10,margin:'4px 0 0'}}>✅ {type==='ip'?'ИИН':'БИН'} корректен</p>}
    </div>
  )
}

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
const Inp=({label,value,onChange,placeholder,type='text',C,required})=>{
  const [showPw,setShowPw]=useState(false)
  const isPassword=type==='password'
  return(
  <div style={{marginBottom:12}}>
    {label&&<p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:.6}}>{label}{required&&<span style={{color:C.red}}> *</span>}</p>}
    <div style={{position:'relative'}}>
      <input value={value||''} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder} type={isPassword?(showPw?'text':'password'):type}
        style={{width:'100%',background:C.inputBg,border:`1px solid ${C.border2}`,borderRadius:12,padding:isPassword?'11px 40px 11px 14px':'11px 14px',color:C.text,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
      {isPassword&&<button type="button" onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:C.muted,padding:0}}>
        {showPw?'🙈':'👁️'}
      </button>}
    </div>
  </div>
)}
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
    ['tariffs','💳','Тарифы'],
    ['soon','🚀','Скоро'],
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
  const [step,setStep]=useState('login')  // login | email | otp | set_password | restore
  const [bin,setBin]=useState('')
  const [email,setEmail]=useState('')
  const [otp,setOtp]=useState('')
  const [password,setPassword]=useState('')
  const [password2,setPassword2]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [info,setInfo]=useState('')
  const [foundEmail,setFoundEmail]=useState('')

  async function loginByBin(){
    if(bin.length<12){setError('Введите ИИН/БИН (12 цифр)');return}
    if(!password){setError('Введите пароль');return}
    setLoading(true);setError('')
    // Ищем email по БИН в базе
    const{data,error:e}=await supabase.from('profiles').select('email').eq('bin',bin).single()
    if(e||!data){setLoading(false);setError('ИИН/БИН не найден. Зарегистрируйтесь через Email');return}
    const{error:e2}=await auth.signInWithPassword(data.email,password)
    setLoading(false)
    if(e2){setError('Неверный ИИН/БИН или пароль');return}
  }

  async function sendOtp(){
    if(!email.includes('@')){setError('Введите корректный email');return}
    setLoading(true);setError('')
    const{error:e}=await auth.signInWithOtp(email)
    setLoading(false)
    if(e){setError(e.message);return}
    setInfo(`Код отправлен на ${email}`)
    setStep('otp')
  }

  async function verifyOtp(){
    if(otp.length<6){setError('Введите 6-значный код');return}
    setLoading(true);setError('')
    const{error:e}=await auth.verifyOtp(email,otp)
    setLoading(false)
    if(e){setError('Неверный код или истёк срок');return}
    setStep('set_password')
  }

  async function setNewPassword(){
    if(!bin||bin.length<12){setError('Введите ИИН/БИН');return}
    if(password.length<6){setError('Пароль минимум 6 символов');return}
    if(password!==password2){setError('Пароли не совпадают');return}
    setLoading(true);setError('')
    const{error:e}=await auth.updatePassword(password)
    if(e){setLoading(false);setError(e.message);return}
    // Сохраняем БИН в профиль
    const user=await auth.getUser()
    if(user){
      await supabase.from('profiles').update({bin}).eq('id',user.id)
    }
    setLoading(false)
    // Сохраняем БИН в localStorage для автозаполнения формы компании
    localStorage.setItem('reg_bin', bin)
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
        <div style={{padding:'24px 28px 28px'}}>
          {step==='login'&&(
            <>
              <h2 style={{color:C.text,fontSize:16,fontWeight:700,margin:'0 0 4px'}}>Войти в систему</h2>
              <p style={{color:C.muted,fontSize:11,margin:'0 0 16px'}}>ИИН/БИН и пароль</p>
              {error&&<Alert type="error" C={C}>{error}</Alert>}
              <IINInput label="ИИН / БИН" value={bin} onChange={setBin} type="bin" C={C} required/>
              <Inp label="Пароль" value={password} onChange={setPassword} placeholder="Введите пароль" type="password" C={C}/>
              <Btn onClick={loginByBin} loading={loading}>🔑 Войти</Btn>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:10}}>
                <button onClick={()=>{setStep('email');setError('')}} style={{background:'none',border:'none',color:C.p,fontSize:11,cursor:'pointer',padding:0}}>Забыли пароль?</button>
                <button onClick={()=>{setStep('email');setError('')}} style={{background:'none',border:'none',color:C.p,fontSize:11,cursor:'pointer',padding:0}}>Первый вход →</button>
              </div>
              <p style={{color:C.dim,fontSize:9,textAlign:'center',marginTop:16}}>© 2026 ТОО «NOVA Comp» · BizBook.kz</p>
            </>
          )}
          {step==='email'&&(
            <>
              <button onClick={()=>setStep('login')} style={{background:'none',border:'none',color:C.p,fontSize:12,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Назад</button>
              <h2 style={{color:C.text,fontSize:16,fontWeight:700,margin:'0 0 4px'}}>Вход по Email</h2>
              <p style={{color:C.muted,fontSize:11,margin:'0 0 16px'}}>Первый вход или восстановление пароля</p>
              {error&&<Alert type="error" C={C}>{error}</Alert>}
              <Inp label="Email" value={email} onChange={setEmail} placeholder="your@email.com" type="email" C={C}/>
              <Btn onClick={sendOtp} loading={loading}>📧 Получить код →</Btn>
            </>
          )}
          {step==='otp'&&(
            <>
              <button onClick={()=>setStep('email')} style={{background:'none',border:'none',color:C.p,fontSize:12,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Назад</button>
              <h2 style={{color:C.text,fontSize:16,fontWeight:700,margin:'0 0 4px'}}>Введите код</h2>
              {info&&<Alert type="success" C={C}>{info}</Alert>}
              {error&&<Alert type="error" C={C}>{error}</Alert>}
              <Inp label="Код из письма" value={otp} onChange={v=>setOtp(v.replace(/\D/g,'').slice(0,6))} placeholder="123456" type="tel" C={C}/>
              <Btn onClick={verifyOtp} loading={loading} disabled={otp.length<6}>✅ Подтвердить</Btn>
              <button onClick={sendOtp} style={{width:'100%',marginTop:8,padding:'10px',borderRadius:12,background:'transparent',border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:'pointer'}}>Отправить повторно</button>
            </>
          )}
          {step==='set_password'&&(
            <>
              <h2 style={{color:C.text,fontSize:16,fontWeight:700,margin:'0 0 4px'}}>Последний шаг!</h2>
              <p style={{color:C.muted,fontSize:11,margin:'0 0 16px'}}>Введите ИИН/БИН и создайте пароль для входа</p>
              {error&&<Alert type="error" C={C}>{error}</Alert>}
              <IINInput label="Ваш ИИН (для ИП) или БИН (для ТОО)" value={bin} onChange={setBin} type="bin" C={C} required/>
              <Inp label="Придумайте пароль" value={password} onChange={setPassword} placeholder="Минимум 6 символов" type="password" C={C}/>
              <Inp label="Повторите пароль" value={password2} onChange={setPassword2} placeholder="Повторите пароль" type="password" C={C}/>
              <Btn onClick={setNewPassword} loading={loading} disabled={!bin||bin.length<12||password.length<6||password!==password2}>✅ Сохранить и продолжить</Btn>
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
  const [form,setForm]=useState(()=>({
    name:'',bin:localStorage.getItem('reg_bin')||'',type:'too',regime:'our',nds:false,
    address:'',city:'Алматы',director:'',phone:'',email:'',
    bank:'Halyk Bank',bik:'',iik:'',kbe:'17'
  }))
  const upd=k=>v=>setForm(f=>({...f,[k]:v}))

  async function save(){
    if(!form.name||!form.bin){setError('Название и БИН обязательны');return}
    if(form.bin.length!==12){setError('БИН должен содержать 12 цифр');return}
    setLoading(true);setError('')
    const{data,error:e}=await companies.create({...form,owner_id:userId})
    setLoading(false)
    if(e){setError(e.message);return}
    await supabase.from('profiles').update({bin:form.bin}).eq('id',userId)
    localStorage.removeItem('reg_bin')
    onDone(data, true)
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
            <IINInput label="БИН / ИИН *" value={form.bin} onChange={upd('bin')} type={form.type==='ip'?'ip':'bin'} C={C} required/>
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

  const mainDocs=docs.filter(d=>!d.linked_doc_id)
  const income=mainDocs.filter(d=>d.direction==='out'&&d.pay_status==='paid').reduce((s,d)=>s+Number(d.amount),0)
  const pending=mainDocs.filter(d=>d.direction==='out'&&d.pay_status==='unpaid').reduce((s,d)=>s+Number(d.amount),0)
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
              {(()=>{
                // Для СО — считаем по дочерним документам
                if(doc.type==='invoice'){
                  const hasAvr=docs.some(d=>d.linked_doc_id===doc.id&&d.type==='avr')
                  const hasSf=docs.some(d=>d.linked_doc_id===doc.id&&d.type==='sf')||docs.some(d=>d.linked_doc_id===doc.id&&d.type==='avr'&&docs.some(sf=>sf.linked_doc_id===d.id&&sf.type==='sf'))
                  if(hasSf) return <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:'rgba(34,197,94,.13)',color:C.green}}>✅ Отгружен</span>
                  if(hasAvr) return <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:'rgba(245,158,11,.13)',color:C.gold}}>🚚 Частично</span>
                  return <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:'rgba(239,68,68,.13)',color:C.red}}>📦 Не отгружен</span>
                }
                // Для АВР и СФ — берём ship_status из БД
                if(doc.type==='avr'||doc.type==='sf'){
                  const s=doc.ship_status||'not_shipped'
                  if(s==='shipped') return <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:'rgba(34,197,94,.13)',color:C.green}}>✅ Отгружен</span>
                  if(s==='partial') return <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:'rgba(245,158,11,.13)',color:C.gold}}>🚚 Частично</span>
                  return <span style={{fontSize:8,padding:'1px 6px',borderRadius:8,fontWeight:700,background:'rgba(239,68,68,.13)',color:C.red}}>📦 Не отгружен</span>
                }
                return null
              })()}
              {doc.nds_amount>0&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:8,background:C.gSoft,color:C.gold,fontWeight:600}}>НДС</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ─── СУММА ПРОПИСЬЮ ──────────────────────────────────────────────
function numToWords(n){
  const ones=['','один','два','три','четыре','пять','шесть','семь','восемь','девять',
    'десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать',
    'шестнадцать','семнадцать','восемнадцать','девятнадцать']
  const tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто']
  const hundreds=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот']
  function decl(n,f){const v=n%100;if(v>=11&&v<=19)return f[3];const r=n%10;if(r===1)return f[1];if(r>=2&&r<=4)return f[2];return f[3]}
  function three(n,fem){
    if(n===0)return''
    const h=Math.floor(n/100),rest=n%100,t=rest>=20?Math.floor(rest/10):0,o=rest>=20?rest%10:rest
    const of=fem?['','одна','две','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать']:ones
    return[hundreds[h],tens[t],of[o]].filter(Boolean).join(' ')
  }
  n=Math.floor(n);if(n===0)return'ноль'
  const mil=Math.floor(n/1000000),tho=Math.floor((n%1000000)/1000),rem=n%1000,parts=[]
  if(mil>0)parts.push(three(mil,false)+' '+decl(mil,['','миллион','миллиона','миллионов']))
  if(tho>0)parts.push(three(tho,true)+' '+decl(tho,['','тысяча','тысячи','тысяч']))
  if(rem>0)parts.push(three(rem,false))
  return parts.join(' ').replace(/\s+/g,' ').trim()
}
function amountWords(n){
  const whole=Math.floor(n),tiyn=Math.round((n-whole)*100)
  const w=numToWords(whole)
  return w.charAt(0).toUpperCase()+w.slice(1)+' тенге '+String(tiyn).padStart(2,'0')+' тиын'
}

// ─── PDF ГЕНЕРАТОР (window.print) ────────────────────────────────
async function generateAndSharePDF(doc, company){
  const fmtN = n => Number(n||0).toLocaleString('ru-KZ',{minimumFractionDigits:2,maximumFractionDigits:2})
  const amount = Number(doc.amount||0)
  generatePDF(doc, company)
  if(navigator.share){
    try{
      const shareText = (DOC_TYPES[doc.type]||'Документ')+' №'+doc.number+' от '+doc.date+'\nСумма: '+fmtN(amount)+' KZT\nОт: '+company.name
      await navigator.share({title: DOC_TYPES[doc.type]+' №'+doc.number, text: shareText})
    }catch(e){}
  }
}
function generatePDF(doc, company){
  const items = doc.items||[]
  const amount = Number(doc.amount||0)
  const ndsAmount = Number(doc.nds_amount||0)
  const amountNoNds = amount - ndsAmount
  const cp = doc.counterparty_name||''
  const date = doc.date||''
  const fmtN = n => Number(n||0).toLocaleString('ru-KZ',{minimumFractionDigits:2,maximumFractionDigits:2})

  function itemsRows(){
    return items.map((r,i)=>{
      const sum=Number(r.price)*Number(r.qty)
      return `<tr><td style="text-align:center">${i+1}</td><td>${r.name}</td><td style="text-align:center">${fmtN(r.qty)}</td><td style="text-align:center">${r.unit}</td><td style="text-align:right">${fmtN(Number(r.price))}</td><td style="text-align:right">${fmtN(sum)}</td></tr>`
    }).join('')
  }
  function itemsRowsAvr(){
    return items.map((r,i)=>{
      const sum=Number(r.price)*Number(r.qty)
      return `<tr><td style="text-align:center">${i+1}</td><td>${r.name}</td><td style="text-align:center">${date}</td><td></td><td style="text-align:center">${r.unit}</td><td style="text-align:center">${fmtN(r.qty)}</td><td style="text-align:right">${fmtN(Number(r.price))}</td><td style="text-align:right">${fmtN(sum)}</td></tr>`
    }).join('')
  }
  function itemsRowsSF(){
    return items.map((r,i)=>{
      const qty=Number(r.qty),price=Number(r.price),total=qty*price
      const ndsR=Number(r.nds_rate||0),ndsSum=ndsR>0?Math.round(total*ndsR/116):0,noNds=total-ndsSum
      return `<tr><td style="text-align:center">${i+1}</td><td>${r.name}</td><td style="text-align:center">${r.unit}</td><td style="text-align:center">—</td><td style="text-align:center">${fmtN(qty)}</td><td style="text-align:right">${fmtN(price)}</td><td style="text-align:right">${fmtN(noNds)}</td><td style="text-align:center">${ndsR?ndsR+'%':'Без НДС'}</td><td style="text-align:right">${ndsR?fmtN(ndsSum):'—'}</td><td style="text-align:right">${fmtN(total)}</td></tr>`
    }).join('')
  }
  function itemsRowsWB(){
    return items.map((r,i)=>{
      const qty=Number(r.qty),price=Number(r.price),total=qty*price
      return `<tr><td style="text-align:center">${i+1}</td><td>${r.name}</td><td style="text-align:center"></td><td style="text-align:center">${r.unit}</td><td style="text-align:center">${fmtN(qty)}</td><td style="text-align:center">${fmtN(qty)}</td><td style="text-align:right">${fmtN(price)}</td><td style="text-align:right">${fmtN(total)}</td><td style="text-align:right">—</td></tr>`
    }).join('')
  }
  function itemsRowsPOA(){
    return items.map((r,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${r.name}</td><td style="text-align:center">${r.unit}</td><td>${numToWords(Number(r.qty))}</td></tr>`).join('')
  }

  const BASE = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:10pt;color:#000;background:#fff;padding:15mm 15mm 15mm 20mm}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #000;padding:3px 5px;vertical-align:middle}
    th{background:#ececec;font-weight:bold;text-align:center;font-size:9pt}
    .no-border td,.no-border th{border:none}
    .right-note{text-align:right;font-size:8pt;line-height:1.5;margin-bottom:4mm}
    .doc-title{text-align:center;font-size:13pt;font-weight:bold;margin:4mm 0}
    .kv td:first-child{font-size:9pt;color:#444;width:45mm;border:none;border-bottom:1px solid #999;padding:2px 0}
    .kv td:last-child{border:none;border-bottom:1px solid #999;font-weight:bold;padding:2px 4px}
    .party-row{display:grid;grid-template-columns:35mm 1fr;gap:4px;border-bottom:1px solid #999;margin-bottom:3mm;padding-bottom:2mm;font-size:10pt}
    .party-label{font-size:9pt;color:#444;padding-top:1px}
    .sign-block{display:flex;gap:8mm;align-items:flex-end;margin-top:6mm}
    .sign-line{border-bottom:1px solid #000;flex:1;height:10mm}
    .sign-label{font-size:7pt;color:#555;text-align:center;margin-top:1mm}
    .mp{font-size:8pt;font-weight:bold;margin-top:2mm}
    .bin-box{border:1px solid #000;padding:2px 6px;font-weight:bold;font-size:11pt;text-align:center;display:inline-block;min-width:35mm}
    .italic{font-style:italic;font-size:8pt;color:#555}
    .total-right{text-align:right;font-weight:bold;padding:3px 5px}
    @media print{body{padding:10mm 10mm 10mm 15mm}@page{margin:0;size:A4}.no-print{display:none!important}}
  `

  let html = ''

  if(doc.type==='invoice'){
    html = `
    <div style="background:#f7f7f7;border:1px solid #ccc;padding:4mm;margin-bottom:5mm;font-size:8pt;line-height:1.5">
      <strong>Внимание!</strong> Оплата данного счёта означает согласие с условиями поставки товара. Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе.<br>
      <strong>Образец платёжного поручения</strong>
      <table style="margin-top:2mm;font-size:8pt">
        <tr>
          <td>Бенефициар:<br><strong>${company.name}</strong><br>БИН: ${company.bin}</td>
          <td>ИИК: <strong>${company.iik||''}</strong></td>
          <td>КБЕ: <strong>${company.kbe||'17'}</strong></td>
        </tr>
        <tr>
          <td>Банк бенефициара:<br><strong>${company.bank||''}</strong></td>
          <td>БИК: <strong>${company.bik||''}</strong></td>
          <td>Код назначения платежа: <strong>856</strong></td>
        </tr>
      </table>
    </div>
    <div class="doc-title">Счёт на оплату № ${doc.number} от ${date} г.</div>
    <div class="party-row"><span class="party-label">Поставщик:</span><span><strong>БИН/ИИН ${company.bin}, ${company.name},</strong> ${company.address||'г. Алматы'}</span></div>
    <div class="party-row"><span class="party-label">Покупатель:</span><span><strong>${cp}</strong></span></div>
    <div style="margin-bottom:4mm;font-size:10pt"><strong>Договор:</strong> Без договора</div>
    <table style="margin-bottom:3mm">
      <thead><tr><th style="width:8mm">№</th><th>Наименование</th><th style="width:18mm">Кол-во</th><th style="width:14mm">Ед.</th><th style="width:28mm">Цена</th><th style="width:28mm">Сумма</th></tr></thead>
      <tbody>${itemsRows()}</tbody>
      <tfoot><tr><td colspan="5" class="total-right">Итого:</td><td style="text-align:right;font-weight:bold">${fmtN(amount)}</td></tr></tfoot>
    </table>
    <div style="margin-bottom:2mm">Всего наименований ${items.length}, на сумму ${fmtN(amount)} KZT</div>
    <div style="font-weight:bold;margin-bottom:8mm">Всего к оплате: ${amountWords(amount)}</div>
    <div style="display:flex;align-items:flex-end;gap:4mm">
      <strong>Исполнитель</strong>
      <div style="border-bottom:1px solid #000;width:60mm;height:8mm"></div>
      <span>/${company.director||''}/</span>
    </div>`

  } else if(doc.type==='avr'){
    html = `
    <div class="right-note">Приложение 50 к приказу Министра финансов<br>Республики Казахстан от 20 декабря 2012 года № 562<br><strong>Форма Р-1</strong></div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:6mm;margin-bottom:4mm">
      <table class="kv">
        <tr><td>Заказчик</td><td><strong>${cp}</strong><br><span class="italic">полное наименование, адрес, данные о средствах связи</span></td></tr>
        <tr><td>Исполнитель</td><td><strong>${company.name}, ${company.address||'г. Алматы'}</strong><br><span class="italic">полное наименование, адрес, данные о средствах связи</span></td></tr>
        <tr><td>Договор (контракт)</td><td>Без договора</td></tr>
      </table>
      <div style="text-align:right;font-size:9pt">
        ИИН/БИН<br><span class="bin-box">${cp.length>0?'—':''}</span><br><br>
        ИИН/БИН<br><span class="bin-box">${company.bin}</span>
      </div>
    </div>
    <table style="margin-bottom:4mm">
      <tr>
        <td style="font-size:12pt;font-weight:bold;text-align:center;border:none">АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)</td>
        <td style="width:30mm;font-size:9pt"><strong>Номер документа</strong><br>${doc.number}</td>
        <td style="width:30mm;font-size:9pt"><strong>Дата составления</strong><br>${date}</td>
      </tr>
    </table>
    <table style="margin-bottom:4mm;font-size:9pt">
      <thead>
        <tr><th rowspan="2">№ по порядку</th><th rowspan="2">Наименование работ (услуг)</th><th rowspan="2">Дата выполнения</th><th rowspan="2">Сведения об отчёте (при наличии)</th><th rowspan="2">Ед. изм.</th><th colspan="3">Выполнено работ (оказано услуг)</th></tr>
        <tr><th>количество</th><th>цена за единицу</th><th>стоимость</th></tr>
        <tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th></tr>
      </thead>
      <tbody>${itemsRowsAvr()}</tbody>
      <tfoot><tr><td colspan="7" class="total-right">Итого</td><td style="text-align:right;font-weight:bold">${fmtN(amount)}</td></tr></tfoot>
    </table>
    <div style="margin-bottom:2mm;font-size:9pt">Сведения об использовании запасов, полученных от заказчика: <span style="border-bottom:1px solid #999;display:inline-block;width:60mm">&nbsp;</span></div>
    <div style="margin-bottom:6mm;font-size:9pt">Приложение: на <span style="border-bottom:1px solid #999;display:inline-block;width:20mm">&nbsp;</span> страниц</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
      <div>
        <div style="font-weight:bold;margin-bottom:4mm">Сдал (Исполнитель) &nbsp; Руководитель</div>
        <div class="sign-block">
          <div><div class="sign-line"></div><div class="sign-label">должность</div></div>
          <div><div class="sign-line"></div><div class="sign-label">подпись</div></div>
          <div><div class="sign-line"></div><div class="sign-label">расшифровка подписи</div></div>
        </div>
        <div class="mp">М.П.</div>
      </div>
      <div>
        <div style="font-weight:bold;margin-bottom:4mm">Принял (Заказчик)</div>
        <div class="sign-block">
          <div><div class="sign-line"></div><div class="sign-label">должность</div></div>
          <div><div class="sign-line"></div><div class="sign-label">подпись</div></div>
          <div><div class="sign-line"></div><div class="sign-label">расшифровка подписи</div></div>
        </div>
        <div style="font-size:9pt;margin-top:3mm">Дата подписания (принятия) работ (услуг): ${date}</div>
        <div class="mp">М.П.</div>
      </div>
    </div>`

  } else if(doc.type==='sf'){
    html = `
    <div class="doc-title">Счёт-фактура № ${doc.number} от ${date} г.</div>
    <div style="margin-bottom:3mm">Дата совершения оборота: ${date}</div>
    <table class="kv" style="margin-bottom:4mm">
      <tr><td>Поставщик:</td><td><strong>${company.name}</strong></td></tr>
      <tr><td>ИИН и адрес поставщика:</td><td>БИН: ${company.bin}, ${company.address||'г. Алматы'}</td></tr>
      <tr><td>ИИК поставщика:</td><td>${company.iik||''}, в банке ${company.bank||''}, БИК ${company.bik||''}</td></tr>
      <tr><td>Договор (контракт):</td><td>Без договора</td></tr>
      <tr><td>Условия оплаты:</td><td></td></tr>
      <tr><td>Пункт назначения:</td><td>${cp}</td></tr>
      <tr><td>Поставка по доверенности:</td><td>Без доверенности</td></tr>
      <tr><td>Способ отправления:</td><td>99 (Прочие)</td></tr>
      <tr><td>Товарно-транспортная накладная:</td><td></td></tr>
      <tr><td>Грузоотправитель:</td><td>БИН: ${company.bin}, ${company.name}, ${company.address||'г. Алматы'}</td></tr>
      <tr><td>Грузополучатель:</td><td>${cp}</td></tr>
      <tr><td>Получатель:</td><td><strong>${cp}</strong></td></tr>
    </table>
    <table style="margin-bottom:4mm;font-size:8.5pt">
      <thead>
        <tr><th>№</th><th>Наименование товаров (работ, услуг)</th><th>Ед.</th><th>ТНВЭД</th><th>Кол-во</th><th>Цена (KZT)</th><th>Стоимость без НДС</th><th>НДС ставка</th><th>НДС сумма</th><th>Всего</th></tr>
        <tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th></tr>
      </thead>
      <tbody>${itemsRowsSF()}</tbody>
      <tfoot>
        <tr><td colspan="6" class="total-right">Всего по счёту:</td><td style="text-align:right;font-weight:bold">${fmtN(amountNoNds)}</td><td></td><td style="text-align:right;font-weight:bold">${fmtN(ndsAmount)}</td><td style="text-align:right;font-weight:bold">${fmtN(amount)}</td></tr>
      </tfoot>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-bottom:4mm">
      <div>
        <div>Руководитель: <strong>${company.director||''}</strong> &nbsp; <span style="border-bottom:1px solid #000;display:inline-block;width:30mm">&nbsp;</span></div>
        <div style="font-size:8pt;color:#555;margin-top:1mm">ВЫДАЛ (ответственное лицо поставщика)</div>
        <div style="margin-top:2mm">Руководитель<br><span style="border-bottom:1px solid #000;display:inline-block;width:50mm">&nbsp;</span></div>
        <div style="font-size:7.5pt;color:#555">(Ф.И.О., подпись) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (должность)</div>
      </div>
      <div>
        <div>Главный бухгалтер: Не предусмотрен</div>
        <div style="margin-top:8mm"><span style="border-bottom:1px solid #000;display:inline-block;width:50mm">&nbsp;</span></div>
        <div style="font-size:7.5pt;color:#555">(Ф.И.О., подпись)</div>
      </div>
    </div>
    <div style="font-size:8pt;font-style:italic">Примечание: Без печати недействительно. Оригинал (первый экземпляр) — покупателю. Копия — поставщику.</div>
    <div class="mp" style="margin-top:2mm">М.П.</div>`

  } else if(doc.type==='waybill'){
    const totalQty = items.reduce((s,r)=>s+Number(r.qty),0)
    html = `
    <div style="margin-bottom:2mm">Организация (индивидуальный предприниматель) &nbsp; <strong>${company.name}</strong></div>
    <div class="right-note">Приложение 26 к приказу Министра финансов РК от 20 декабря 2012 года № 562<br><strong>Форма З-2</strong> &nbsp;&nbsp; ИИН/БИН <strong>${company.bin}</strong> &nbsp;&nbsp; Номер: <strong>${doc.number}</strong> &nbsp;&nbsp; Дата: <strong>${date}</strong></div>
    <div class="doc-title">НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ</div>
    <table style="margin-bottom:4mm;font-size:9pt">
      <thead><tr><th>Организация — отправитель</th><th>Организация — получатель</th><th>Ответственный (Ф.И.О.)</th><th>ТТН (номер, дата)</th></tr></thead>
      <tbody><tr><td>${company.name}</td><td>${cp}</td><td style="text-align:center">${company.director||''}</td><td></td></tr></tbody>
    </table>
    <table style="margin-bottom:4mm;font-size:9pt">
      <thead>
        <tr><th rowspan="2">№ по порядку</th><th rowspan="2">Наименование, характеристика</th><th rowspan="2">Номенкл. №</th><th rowspan="2">Ед. изм.</th><th colspan="2">Количество</th><th rowspan="2">Цена за единицу, KZT</th><th rowspan="2">Сумма с НДС, KZT</th><th rowspan="2">Сумма НДС, KZT</th></tr>
        <tr><th>подлежит отпуску</th><th>отпущено</th></tr>
        <tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th></tr>
      </thead>
      <tbody>${itemsRowsWB()}</tbody>
      <tfoot><tr><td colspan="4" class="total-right">Итого</td><td style="text-align:center;font-weight:bold">${fmtN(totalQty)}</td><td style="text-align:center;font-weight:bold">${fmtN(totalQty)}</td><td style="text-align:center">×</td><td style="text-align:right;font-weight:bold">${fmtN(amount)}</td><td></td></tr></tfoot>
    </table>
    <div style="margin-bottom:2mm">Всего отпущено (прописью): <strong>${numToWords(totalQty)}</strong></div>
    <div style="margin-bottom:6mm;font-weight:bold">на сумму (прописью): ${amountWords(amount)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
      <div>
        <div style="font-weight:bold">Отпуск разрешил &nbsp; Руководитель</div>
        <div class="sign-block">
          <div><div class="sign-line"></div><div class="sign-label">должность</div></div>
          <div><div class="sign-line"></div><div class="sign-label">подпись</div></div>
          <div><div class="sign-line"></div><div class="sign-label">расшифровка</div></div>
        </div>
        <div style="margin-top:3mm;font-size:9pt">Главный бухгалтер <span style="border-bottom:1px solid #000;display:inline-block;width:15mm">&nbsp;</span> / Не предусмотрен</div>
        <div class="mp">М.П.</div>
        <div style="margin-top:4mm;font-size:9pt">Отпустил <span style="border-bottom:1px solid #000;display:inline-block;width:30mm">&nbsp;</span></div>
      </div>
      <div>
        <div style="font-size:9pt">По доверенности № <span style="border-bottom:1px solid #000;display:inline-block;width:15mm">&nbsp;</span> от "<span style="border-bottom:1px solid #000;display:inline-block;width:8mm">&nbsp;</span>" <span style="border-bottom:1px solid #000;display:inline-block;width:20mm">&nbsp;</span> 20__ г.</div>
        <div style="margin-top:12mm;font-size:9pt">Запасы получил <span style="border-bottom:1px solid #000;display:inline-block;width:30mm">&nbsp;</span></div>
      </div>
    </div>`

  } else if(doc.type==='poa'){
    html = `
    <div class="right-note">Приложение 6 к приказу Министра финансов Республики Казахстан от 20 декабря 2012 года № 562<br><strong>Форма Д-1</strong></div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:4mm;margin-bottom:3mm;align-items:center">
      <div>Организация (индивидуальный предприниматель): <strong>${company.name}</strong></div>
      <div style="text-align:right;font-size:9pt">ИИН/БИН<br><span class="bin-box">${company.bin}</span></div>
    </div>
    <div style="margin-bottom:3mm">Доверенность действительна по: <strong>${date} г.</strong></div>
    <div style="border:1px solid #000;padding:3mm;margin-bottom:2mm">
      <div><strong>${company.name}</strong>, БИН/ИИН ${company.bin}, ${company.address||'г. Алматы'}</div>
      <div class="italic">наименование получателя, ИИН/БИН и его адрес</div>
      <div style="margin-top:2mm"><strong>${cp}</strong></div>
      <div class="italic">наименование плательщика, ИИН/БИН и его адрес</div>
    </div>
    <div style="margin-bottom:3mm">Счёт № <strong>${company.iik||''}</strong> в <strong>${company.bank||''}</strong><br><span class="italic">наименование банка</span></div>
    <div class="doc-title">ДОВЕРЕННОСТЬ № ${doc.number}</div>
    <div style="margin-bottom:4mm">Дата выдачи <strong>${date} г.</strong></div>
    <table class="kv" style="margin-bottom:4mm">
      <tr><td>Выдана</td><td><strong>Руководителю, ${company.director||''}</strong><br><span class="italic">должность, фамилия, имя, отчество</span></td></tr>
      <tr><td>Удостоверение личности (паспорт)</td><td>серии № <span style="border-bottom:1px solid #999;display:inline-block;width:25mm">&nbsp;</span> от <span style="border-bottom:1px solid #999;display:inline-block;width:20mm">&nbsp;</span><br><span class="italic">выдан МВД РЕСПУБЛИКИ КАЗАХСТАН</span></td></tr>
      <tr><td>На получение от</td><td><strong>${cp}</strong><br><span class="italic">наименование поставщика</span></td></tr>
      <tr><td>активов по</td><td><span style="border-bottom:1px solid #999;display:inline-block;width:70mm">&nbsp;</span><br><span class="italic">наименование, номер и дата документа</span></td></tr>
    </table>
    <table style="margin-bottom:4mm">
      <thead>
        <tr><th style="width:12mm">№ по порядку</th><th>Наименование активов</th><th style="width:25mm">Единица измерения</th><th style="width:45mm">Количество (прописью)</th></tr>
        <tr><th>1</th><th>2</th><th>3</th><th>4</th></tr>
      </thead>
      <tbody>${itemsRowsPOA()}<tr><td colspan="4" style="height:10mm"></td></tr></tbody>
      <tfoot><tr><td colspan="4" class="total-right">Итого</td></tr></tfoot>
    </table>
    <div style="margin-bottom:2mm">Подпись лица, получившего доверенность <span style="border-bottom:1px solid #000;display:inline-block;width:40mm">&nbsp;</span></div>
    <div style="margin-bottom:6mm;font-size:9pt">удостоверяем:</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
      <div>
        <div style="font-weight:bold">Руководитель организации (индивидуальный предприниматель)</div>
        <div class="sign-block">
          <div><div class="sign-line"></div><div class="sign-label">Подпись</div></div>
          <div><div class="sign-line"></div><div class="sign-label">расшифровка подписи</div></div>
        </div>
        <div class="mp">М.П.</div>
      </div>
      <div>
        <div>Главный бухгалтер</div>
        <div class="sign-block">
          <div><div class="sign-line"></div><div class="sign-label">Подпись</div></div>
          <div><div class="sign-line"></div><div class="sign-label">расшифровка подписи</div></div>
        </div>
      </div>
    </div>`
  }

  // Кнопки управления — снаружи iframe чтобы работало закрытие
  const closeBtn = `<button onclick="window.parent.document.getElementById('bbModal').remove()" style="padding:10px 20px;background:#f0f0f0;color:#333;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:Arial">✕ Закрыть</button>`
  const printBtn = `<button onclick="window.print()" style="padding:10px 24px;background:#7c6fff;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;font-family:Arial">📥 Сохранить PDF</button>`
  const toolbar = `<div style="position:fixed;bottom:0;left:0;right:0;background:#fff;padding:10px 16px;border-top:1px solid #ddd;display:flex;gap:8px;justify-content:center;z-index:999;box-shadow:0 -2px 8px rgba(0,0,0,.1)">${printBtn}${closeBtn}</div>`
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=0.6"><title>${doc.number}</title><style>${BASE}body{padding-bottom:70px;zoom:0.75}@media print{.no-print{display:none!important}.print-toolbar{display:none!important}}</style></head><body>${html}<div class="no-print" style="position:fixed;bottom:0;left:0;right:0;background:#fff;padding:10px 16px;border-top:1px solid #ddd;display:flex;gap:8px;justify-content:center;z-index:999;box-shadow:0 -2px 8px rgba(0,0,0,.1)">${printBtn}</div></body></html>`
  // Пробуем window.open (браузер), если заблокировано — показываем внутри
  const win = window.open('about:blank','_blank')
  if(win){
    win.document.write(fullHtml)
    win.document.close()
  } else {
    // PWA — показываем в модальном окне
    const existing = document.getElementById('bbModal')
    if(existing) existing.remove()
    const modal = document.createElement('div')
    modal.id = 'bbModal'
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#f5f5f5;z-index:9999;display:flex;flex-direction:column'
    // Верхняя панель с кнопками
    const topBar = document.createElement('div')
    topBar.style.cssText = 'background:#7c6fff;padding:10px 16px;display:flex;gap:8px;justify-content:space-between;align-items:center;flex-shrink:0'
        const pdfBtn2 = document.createElement('button')
    pdfBtn2.textContent = '📥 PDF'
    pdfBtn2.style.cssText = 'padding:8px 16px;background:#fff;color:#7c6fff;border:none;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer'
    const closeBtn2 = document.createElement('button')
    closeBtn2.textContent = '✕ Закрыть'
    closeBtn2.style.cssText = 'padding:8px 16px;background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer'
    closeBtn2.onclick = ()=>document.getElementById('bbModal').remove()
    const titleSpan = document.createElement('span')
    titleSpan.textContent = doc.number
    titleSpan.style.cssText = 'color:#fff;font-size:13px;font-weight:bold'
    const btnGroup = document.createElement('div')
    btnGroup.style.cssText = 'display:flex;gap:8px'
    btnGroup.appendChild(pdfBtn2)
    btnGroup.appendChild(closeBtn2)
    topBar.appendChild(titleSpan)
    topBar.appendChild(btnGroup)
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'flex:1;border:none;background:#fff'
    iframe.srcdoc = fullHtml
    // Кнопка печати через iframe
    topBar.querySelector('button').onclick = ()=>iframe.contentWindow.print()
    modal.appendChild(topBar)
    modal.appendChild(iframe)
    document.body.appendChild(modal)
  }
}


// ─── NEW DOC SCREEN ───────────────────────────────────────────────
function NewDocScreen({C,company,cpList,nomList,initType,initCp,initRows,linkedDocId,onBack,onSaved}){
  const [step,setStep]=useState(initCp?2:1)
  const [type,setType]=useState(initType||'invoice')
  const [direction,setDirection]=useState('out')
  const [cpId,setCpId]=useState(initCp?.id||'')
  const [cpName,setCpName]=useState(initCp?.name||'')
  const [date,setDate]=useState(today())
  const [rows,setRows]=useState(initRows||[{name:'',qty:1,unit:'усл',price:'',nds_rate:company?.nds?16:0}])
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
      items:rows,notes,status:'draft',pay_status:'unpaid',
      linked_doc_id:linkedDocId||null
    })
    // Синхронизируем статусы с родительским документом
    if(linkedDocId&&!e){
      // Получаем ВСЕ документы компании
      const allDocsRes=await documents.list(company.id)
      const allDocs=allDocsRes?.data||[]
      const parentDoc=allDocs.find(d=>d.id===linkedDocId)
      const parentPayStatus=parentDoc?.pay_status||'unpaid'

      if(type==='avr'){
        // АВР + СО → оба partial
        await documents.update(linkedDocId,{ship_status:'partial'})
        // Обновляем сам АВР после создания
        const{data:avrData}=await documents.list(company.id)
        const newAvr=avrData?.find(d=>d.linked_doc_id===linkedDocId&&d.type==='avr')
        if(newAvr?.id) await documents.update(newAvr.id,{ship_status:'partial',pay_status:parentPayStatus!=='unpaid'?parentPayStatus:'unpaid'})
      }
      if(type==='sf'){
        // СФ + АВР + СО → все shipped
        // 1. Обновляем АВР (прямой родитель)
        await documents.update(linkedDocId,{ship_status:'shipped'})
        // 2. Если родитель АВР — обновляем СО
        if(parentDoc?.linked_doc_id){
          await documents.update(parentDoc.linked_doc_id,{ship_status:'shipped'})
        }
        // 3. Обновляем всю цепочку
        const rootId=parentDoc?.linked_doc_id||linkedDocId
        const chain=allDocs.filter(d=>d.id===rootId||d.linked_doc_id===rootId||(d.linked_doc_id&&allDocs.find(p=>p.id===d.linked_doc_id&&(p.id===rootId||p.linked_doc_id===rootId))))
        for(const d of chain){
          await documents.update(d.id,{ship_status:'shipped'})
        }
        // 4. Обновляем сам СФ — берём самый новый документ
        const{data:freshDocs}=await documents.list(company.id)
        const newSf=freshDocs?.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]
        if(newSf?.id) await documents.update(newSf.id,{ship_status:'shipped',pay_status:parentPayStatus!=='unpaid'?parentPayStatus:'unpaid'})
      }
    }
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
            {cpList.length===0?(
              <div style={{background:C.card2,borderRadius:12,padding:'16px',textAlign:'center',marginBottom:12}}>
                <p style={{color:C.muted,fontSize:12,margin:'0 0 8px'}}>У вас нет контрагентов</p>
                <p style={{color:C.muted,fontSize:10,margin:'0 0 12px'}}>Сначала добавьте контрагента в раздел «Контрагенты»</p>
              </div>
            ):(
              <div style={{marginBottom:10}}>
                <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 8px',textTransform:'uppercase'}}>Выберите контрагента:</p>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {cpList.map(cp=>(
                    <button key={cp.id} onClick={()=>{setCpId(cp.id);setCpName(cp.name)}}
                      style={{padding:'10px 14px',borderRadius:11,border:`1.5px solid ${cpId===cp.id?C.p:C.border}`,background:cpId===cp.id?C.pSoft:C.card2,color:cpId===cp.id?C.p:C.text,fontSize:11,fontWeight:cpId===cp.id?700:400,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>{cp.name}</span>
                      {cpId===cp.id&&<span style={{color:C.p,fontSize:14}}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{display:'flex',gap:7,marginTop:8}}>
              <SBtn onClick={()=>setStep(1)} C={C} style={{flex:1}}>← Назад</SBtn>
              <Btn onClick={()=>cpName&&setStep(3)} disabled={!cpName} style={{flex:2}}>Далее →</Btn>
            </div>
          </>
        )}
        {step===3&&(
          <>
            <Sec C={C}>Товары / Услуги</Sec>
            {nomList.length===0&&(
              <div style={{background:C.card2,borderRadius:12,padding:'16px',textAlign:'center',marginBottom:12}}>
                <p style={{color:C.muted,fontSize:12,margin:'0 0 4px'}}>У вас нет номенклатуры</p>
                <p style={{color:C.muted,fontSize:10,margin:0}}>Сначала добавьте товары/услуги в раздел «Номенклатура»</p>
              </div>
            )}
            {nomList.length>0&&rows.length===0&&(
              <p style={{color:C.muted,fontSize:11,margin:'0 0 8px'}}>Выберите позиции из номенклатуры:</p>
            )}
            {nomList.length>0&&(
              <div style={{marginBottom:10}}>
                <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 6px',textTransform:'uppercase'}}>Добавить из номенклатуры:</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                  {nomList.map(n=>(
                    <button key={n.id} onClick={()=>setRows(r=>{const emptyIdx=r.findIndex(row=>!row.name);if(emptyIdx>=0){const updated=[...r];updated[emptyIdx]={...updated[emptyIdx],name:n.name,unit:n.unit,price:String(n.price),nds_rate:n.nds_rate};return updated}return[...r,{name:n.name,qty:1,unit:n.unit,price:String(n.price),nds_rate:n.nds_rate}]})}
                      style={{padding:'6px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:C.card2,color:C.text,fontSize:10,fontWeight:500,cursor:'pointer'}}>
                      + {n.name} ({n.price?fmt(n.price):'цена не указана'})
                    </button>
                  ))}
                </div>
              </div>
            )}
            {rows.map((row,i)=>(
              <div key={i} style={{background:C.card2,borderRadius:12,padding:'10px',marginBottom:8,border:`1px solid ${C.p}33`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <p style={{color:C.text,fontSize:11,fontWeight:600,margin:0}}>{row.name}</p>
                  <button onClick={()=>removeRow(i)} style={{background:'rgba(239,68,68,.1)',border:'none',borderRadius:8,padding:'3px 8px',cursor:'pointer',color:C.red,fontSize:12}}>✕</button>
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
function DocDetailScreen({C,doc:initDoc,onBack,onUpdate,setDocs,docs:allDocs,company,nav,cpList,nomList}){
  const [loading,setLoading]=useState(false)
  const [doc,setDoc]=useState(initDoc)
  if(!doc) return null
  const items=doc.items||[]

  // Находим всю цепочку документов рекурсивно
  async function getChain(){
    const res=await documents.list(doc.company_id)
    const all=res?.data||[]
    // Поднимаемся до корня
    let rootId=doc.id
    let cur=doc
    while(cur.linked_doc_id){
      const parent=all.find(d=>d.id===cur.linked_doc_id)
      if(!parent) break
      rootId=parent.id
      cur=parent
    }
    // Рекурсивно находим всех потомков
    function getDescendants(id){
      const children=all.filter(d=>d.linked_doc_id===id)
      return[...children,...children.flatMap(ch=>getDescendants(ch.id))]
    }
    const root=all.find(d=>d.id===rootId)
    const descendants=getDescendants(rootId)
    return{all,rootId,chain:[root,...descendants].filter(Boolean)}
  }
  async function updatePayStatus(status){
    setLoading(true)
    setDoc(d=>({...d,pay_status:status}))
    const{chain}=await getChain()
    // Обновляем все документы в цепочке
    for(const d of chain){
      await documents.update(d.id,{pay_status:status})
    }
    // Обновляем локально сразу без перезагрузки
    const chainIds=chain.map(d=>d.id)
    if(setDocs) setDocs(prev=>prev.map(d=>chainIds.includes(d.id)?{...d,pay_status:status}:d))
    setLoading(false)
  }
  async function updateShipStatus(shipStatus){
    setLoading(true)
    setDoc(d=>({...d,ship_status:shipStatus}))
    const{chain}=await getChain()
    for(const d of chain){
      await documents.update(d.id,{ship_status:shipStatus})
    }
    const chainIds=chain.map(d=>d.id)
    if(setDocs) setDocs(prev=>prev.map(d=>chainIds.includes(d.id)?{...d,ship_status:shipStatus}:d))
    setLoading(false)
  }

  const ndsLine=doc.nds_amount>0?('в т.ч. НДС: '+fmt(Number(doc.nds_amount))+'\n'):''
  const shareText=DOC_TYPES[doc.type]+' №'+doc.number+'\nот '+doc.date+'\n\nОт: '+(company?.name||'')+'\nКому: '+(doc.counterparty_name||'')+'\nСумма: '+fmt(Number(doc.amount))+'\n'+ndsLine+'\nРеквизиты:\nБанк: '+(company?.bank||'')+'\nИИК: '+(company?.iik||'')

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
            <div style={{width:'100%',marginTop:6,display:'flex',gap:5,flexWrap:'wrap'}}>
              {[['not_shipped','📦 Не отгружен','rgba(100,116,139,.13)',C.muted],['partial','🚚 Частично отгружен','rgba(245,158,11,.13)',C.gold],['shipped','✅ Отгружен','rgba(34,197,94,.13)',C.green]].map(([v,l,bg,col])=>(
                <button key={v} onClick={()=>updateShipStatus(v)} disabled={loading}
                  style={{padding:'5px 11px',borderRadius:10,border:`1.5px solid ${(doc.ship_status||'not_shipped')===v?col:C.border}`,background:(doc.ship_status||'not_shipped')===v?bg:'transparent',color:(doc.ship_status||'not_shipped')===v?col:C.muted,fontSize:10,fontWeight:(doc.ship_status||'not_shipped')===v?700:400,cursor:'pointer'}}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        {/* Цепочка документов */}
        {(doc.type==='invoice'||doc.type==='avr')&&(
          <div style={{marginBottom:8}}>
            <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 6px',textTransform:'uppercase'}}>📎 Создать на основе документа</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
              {doc.type==='invoice'&&<button onClick={()=>nav('newDoc',{type:'avr',initCp:{id:doc.counterparty_id,name:doc.counterparty_name},initRows:doc.items,linkedDocId:doc.id})}
                style={{padding:'10px',borderRadius:12,background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.25)',color:C.green,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                ✅ Создать АВР
              </button>}
              <button onClick={()=>nav('newDoc',{type:'sf',initCp:{id:doc.counterparty_id,name:doc.counterparty_name},initRows:doc.items,linkedDocId:doc.id})}
                style={{padding:'10px',borderRadius:12,background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.25)',color:C.gold,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                🧾 Создать СФ
              </button>
            </div>
          </div>
        )}
        {doc.linked_doc_id&&(
          <div style={{background:C.card2,borderRadius:10,padding:'8px 12px',marginBottom:8,border:`1px solid ${C.border}`}}>
            <p style={{color:C.muted,fontSize:9,margin:0}}>🔗 Связан со счётом</p>
          </div>
        )}
        {/* Actions */}
        <button onClick={()=>generatePDF(doc,company)}
          style={{width:'100%',padding:'12px',borderRadius:12,background:'rgba(124,111,255,.12)',border:'1px solid rgba(124,111,255,.3)',color:C.p,fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:8}}>
          📥 Скачать PDF
        </button>


        <button onClick={async()=>{if(confirm('Удалить документ?')){await documents.delete(doc.id);onBack();setTimeout(()=>onUpdate(),100)}}}
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
  const [editCp,setEditCp]=useState(null)
  const [form,setForm]=useState({name:'',bin:'',type:'client',nds:false,bank:'',iik:'',phone:'',email:'',contact:''})
  const [loading,setLoading]=useState(false)
  const upd=k=>v=>setForm(f=>({...f,[k]:v}))
  const filtered=cpList.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())||c.bin?.includes(q))

  function openEdit(cp){
    setEditCp(cp)
    setForm({name:cp.name||'',bin:cp.bin||'',type:cp.type||'client',nds:cp.nds||false,bank:cp.bank||'',iik:cp.iik||'',phone:cp.phone||'',email:cp.email||'',contact:cp.contact||''})
    setShowAdd(true)
  }

  async function save(){
    if(!form.name){return}
    setLoading(true)
    if(editCp){
      await counterparties.update(editCp.id,{...form})
    } else {
      await counterparties.create({...form,company_id:company.id})
    }
    setLoading(false)
    setShowAdd(false)
    setEditCp(null)
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
            <button onClick={()=>openEdit(cp)} style={{background:C.pSoft,border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',color:C.p,fontSize:11,flexShrink:0}}>✏️</button>
          </div>
        ))}
        {filtered.length===0&&<p style={{color:C.muted,textAlign:'center',padding:'32px 0',fontSize:12}}>Контрагентов не найдено</p>}
      </div>
      {/* Add modal */}
      {showAdd&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'flex-end',zIndex:200}}>
          <div style={{background:C.card,borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column',padding:'18px 18px 26px',overflow:'hidden'}}>
            <div style={{width:36,height:4,background:C.dim,borderRadius:2,margin:'0 auto 14px'}}/>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:'0 0 14px'}}>{editCp?'✏️ Редактировать':'Добавить контрагента'}</h3>
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
              <SBtn onClick={()=>{setShowAdd(false);setEditCp(null);setForm({name:'',bin:'',type:'client',nds:false,bank:'',iik:'',phone:'',email:'',contact:''})}} C={C} style={{flex:1}}>Отмена</SBtn>
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
  const [editNom,setEditNom]=useState(null)
  const [form,setForm]=useState({name:'',description:'',unit:'усл',price:'',nds_rate:0,category:''})
  const [loading,setLoading]=useState(false)
  const upd=k=>v=>setForm(f=>({...f,[k]:v}))
  const filtered=nomList.filter(n=>n.name.toLowerCase().includes(q.toLowerCase()))

  function openEdit(n){
    setEditNom(n)
    setForm({name:n.name||'',description:n.description||'',unit:n.unit||'усл',price:String(n.price||''),nds_rate:n.nds_rate||0,category:n.category||''})
    setShowAdd(true)
  }

  async function save(){
    if(!form.name){return}
    setLoading(true)
    if(editNom){
      await nomenclature.update(editNom.id,{...form,price:Number(form.price)||0})
    } else {
      await nomenclature.create({...form,company_id:company.id,price:Number(form.price)||0})
    }
    setLoading(false)
    setShowAdd(false)
    setEditNom(null)
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
            <button onClick={()=>openEdit(n)} style={{background:C.pSoft,border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',color:C.p,fontSize:11,flexShrink:0,marginLeft:4}}>✏️</button>
          </div>
        ))}
        {filtered.length===0&&<p style={{color:C.muted,textAlign:'center',padding:'32px 0',fontSize:12}}>Позиций не найдено</p>}
      </div>
      {showAdd&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'flex-end',zIndex:200}}>
          <div style={{background:C.card,borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'80vh',display:'flex',flexDirection:'column',padding:'18px 18px 26px',overflow:'hidden'}}>
            <div style={{width:36,height:4,background:C.dim,borderRadius:2,margin:'0 auto 14px'}}/>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:'0 0 14px'}}>{editNom?'✏️ Редактировать':'Добавить позицию'}</h3>
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
              <SBtn onClick={()=>{setShowAdd(false);setEditNom(null);setForm({name:'',description:'',unit:'усл',price:'',nds_rate:0,category:''})}} C={C} style={{flex:1}}>Отмена</SBtn>
              <Btn onClick={save} loading={loading} style={{flex:2}}>💾 Сохранить</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────
function ProfileScreen({C,profile,company,onLogout,onCompanyUpdate}){
  const [editReq,setEditReq]=useState(false)
  const [reqLoading,setReqLoading]=useState(false)
  const [reqForm,setReqForm]=useState({director:company?.director||'',address:company?.address||'',phone:company?.phone||'',email:company?.email||'',bank:company?.bank||'',iik:company?.iik||'',bik:company?.bik||''})
  async function saveReq(){
    setReqLoading(true)
    await companies.update(company.id,reqForm)
    setReqLoading(false)
    setEditReq(false)
    if(onCompanyUpdate) onCompanyUpdate()
  }
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
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <Sec C={C} style={{margin:0}}>Реквизиты</Sec>
            <button onClick={()=>setEditReq(r=>!r)} style={{background:C.pSoft,border:'none',borderRadius:8,padding:'5px 12px',cursor:'pointer',color:C.p,fontSize:11,fontWeight:600}}>
              {editReq?'✕ Закрыть':'✏️ Изменить'}
            </button>
          </div>
          {editReq?(
            <div style={{background:C.card,borderRadius:14,padding:'14px',marginBottom:10,border:`1px solid ${C.border}`}}>
              <Inp label="Директор/Руководитель" value={reqForm.director} onChange={v=>setReqForm(f=>({...f,director:v}))} placeholder="Иванов Иван Иванович" C={C}/>
              <Inp label="Адрес" value={reqForm.address} onChange={v=>setReqForm(f=>({...f,address:v}))} placeholder="г. Алматы, ул. Примерная, д. 1" C={C}/>
              <Inp label="Телефон" value={reqForm.phone} onChange={v=>setReqForm(f=>({...f,phone:v}))} placeholder="+7 700 000 00 00" C={C}/>
              <Inp label="Email" value={reqForm.email} onChange={v=>setReqForm(f=>({...f,email:v}))} placeholder="info@company.kz" C={C}/>
              <Inp label="Банк" value={reqForm.bank} onChange={v=>setReqForm(f=>({...f,bank:v}))} placeholder="Halyk Bank" C={C}/>
              <Inp label="ИИК" value={reqForm.iik} onChange={v=>setReqForm(f=>({...f,iik:v}))} placeholder="KZ..." C={C}/>
              <Inp label="БИК" value={reqForm.bik} onChange={v=>setReqForm(f=>({...f,bik:v}))} placeholder="HSBKKZKX" C={C}/>
              <Btn onClick={saveReq} loading={reqLoading}>💾 Сохранить реквизиты</Btn>
            </div>
          ):(
            <div>
              {[['Директор',company.director],['Адрес',company.address],['Телефон',company.phone],['Email',company.email],['Банк',company.bank],['ИИК',company.iik]].map(([l,v])=>v?(
                <div key={l} style={{marginBottom:9}}>
                  <p style={{color:C.muted,fontSize:9,fontWeight:700,margin:'0 0 3px',textTransform:'uppercase'}}>{l}</p>
                  <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 13px',color:C.text,fontSize:12}}>{v}</div>
                </div>
              ):null)}
            </div>
          )}
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
        <Sec C={C}>Безопасность</Sec>
        <ChangePasswordBlock C={C}/>
        <button onClick={onLogout} style={{width:'100%',padding:'12px',borderRadius:12,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:C.red,fontSize:12,fontWeight:600,cursor:'pointer',marginTop:8}}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}

// ─── ADMIN SCREEN ─────────────────────────────────────────────────
function AdminScreen({C,allCompanies,allTariffs,allTariffRequests,onRefresh}){
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
        {allTariffRequests.filter(r=>r.status==='pending').length>0&&(
          <>
            <Sec C={C}>⏳ Заявки на тариф ({allTariffRequests.filter(r=>r.status==='pending').length})</Sec>
            {allTariffRequests.filter(r=>r.status==='pending').map(req=>(
              <div key={req.id} style={{background:C.card,borderRadius:13,padding:'12px',marginBottom:8,border:`1.5px solid ${C.gold}40`}}>
                <p style={{color:C.text,fontSize:12,fontWeight:700,margin:'0 0 2px'}}>{req.companies?.name}</p>
                <p style={{color:C.muted,fontSize:10,margin:'0 0 6px'}}>БИН: {req.companies?.bin} · Тариф: {req.tariffs?.name} — {req.tariffs?.price_month?.toLocaleString()} ₸/мес</p>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={async()=>{await tariffRequests.approve(req.id,req.company_id,req.tariff_id);onRefresh()}}
                    style={{flex:2,padding:'8px',borderRadius:9,background:'rgba(34,197,94,.15)',border:'1px solid rgba(34,197,94,.3)',color:C.green,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                    ✅ Активировать
                  </button>
                  <button onClick={async()=>{await tariffRequests.reject(req.id);onRefresh()}}
                    style={{flex:1,padding:'8px',borderRadius:9,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:C.red,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                    ❌ Отклонить
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
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


function SoonScreen({C}) {
  const integrations = [
    {icon:'📊',name:'ЭСФ',desc:'Электронные счёт-фактуры через esf.gov.kz',status:'В разработке'},
    {icon:'✅',name:'ЭАВР',desc:'Электронные акты выполненных работ',status:'В разработке'},
    {icon:'🏛️',name:'Кабинет налогоплательщика',desc:'Отправка ФНО 200, 300, 100 напрямую в КНП',status:'В разработке'},
    {icon:'🏦',name:'Halyk Bank',desc:'Синхронизация выписок и платежей',status:'В разработке'},
    {icon:'💳',name:'Kaspi Bank',desc:'Автоматический учёт поступлений',status:'В разработке'},
    {icon:'🔐',name:'ЭЦП / eGov QR',desc:'Подписание документов через eGov Mobile и eGov Business',status:'В разработке'},
    {icon:'📱',name:'SMS уведомления',desc:'OTP и уведомления через казахстанских операторов',status:'В разработке'},
    {icon:'🤖',name:'ИИ-ассистент',desc:'Умный помощник бухгалтера на базе AI',status:'Планируется'},
    {icon:'📅',name:'Налоговый календарь',desc:'Напоминания о сроках сдачи отчётов и уплаты налогов',status:'Планируется'},
    {icon:'📰',name:'Новости и изменения НК РК',desc:'Актуальные изменения в налоговом законодательстве',status:'Планируется'},
    {icon:'💰',name:'Расчёт заработной платы',desc:'Полный расчёт ЗП с учётом НК РК 2026',status:'Планируется'},
    {icon:'📦',name:'Склад и остатки',desc:'Учёт товаров и складских остатков',status:'Планируется'},
    {icon:'📈',name:'Отчёты и аналитика',desc:'Финансовые отчёты, графики, дашборды',status:'Планируется'},
    {icon:'🏪',name:'App Store / Google Play',desc:'Нативные мобильные приложения',status:'Планируется'},
    {icon:'🔗',name:'API для партнёров',desc:'Интеграция BizBook.kz с вашими системами',status:'Планируется'},
  ]
  return (
    <div style={{flex:1,overflowY:'auto',paddingBottom:28}}>
      <div style={{padding:'12px 16px 0'}}>
        <div style={{background:'linear-gradient(135deg,#1a0f4e,#2d1f8a)',borderRadius:20,padding:'20px',marginBottom:14,border:'1px solid rgba(124,111,255,.3)'}}>
          <p style={{color:'rgba(255,255,255,.6)',fontSize:10,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:1}}>BizBook.kz · Дорожная карта</p>
          <h2 style={{color:'#fff',fontSize:20,fontWeight:900,margin:'0 0 6px'}}>Скоро в приложении 🚀</h2>
          <p style={{color:'rgba(255,255,255,.6)',fontSize:11,margin:0,lineHeight:1.5}}>Мы активно разрабатываем новые функции. Следите за обновлениями!</p>
        </div>
        {integrations.map((item,i)=>(
          <div key={i} style={{background:C.card,borderRadius:13,padding:'12px',marginBottom:8,border:`1px solid ${C.border}`,display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:44,height:44,borderRadius:12,background:C.pSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:C.text,fontSize:12,fontWeight:700,margin:'0 0 2px'}}>{item.name}</p>
              <p style={{color:C.muted,fontSize:10,margin:'0 0 5px',lineHeight:1.4}}>{item.desc}</p>
              <span style={{fontSize:9,padding:'2px 8px',borderRadius:8,fontWeight:700,background:item.status==='В разработке'?'rgba(245,158,11,.15)':'rgba(124,111,255,.15)',color:item.status==='В разработке'?'#f59e0b':'#7c6fff'}}>
                {item.status==='В разработке'?'🔧 В разработке':'📋 Планируется'}
              </span>
            </div>
          </div>
        ))}
        <div style={{background:C.card,borderRadius:13,padding:'14px',marginTop:8,border:`1px solid ${C.border}`,textAlign:'center'}}>
          <p style={{color:C.muted,fontSize:11,margin:'0 0 4px'}}>Есть предложение по функционалу?</p>
          <a href="mailto:info@bizbook.kz" style={{color:C.p,fontSize:12,fontWeight:600,textDecoration:'none'}}>📧 Написать нам: info@bizbook.kz</a>
        </div>
      </div>
    </div>
  )
}


function SetupPasswordScreen({C, userId, onDone}) {
  const [bin, setBin] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!bin || bin.length < 12) { setError('Введите ИИН/БИН (12 цифр)'); return }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return }
    if (password !== password2) { setError('Пароли не совпадают'); return }
    setLoading(true); setError('')
    try {
      const { error: e } = await auth.updatePassword(password)
      if (e) { setLoading(false); setError('Ошибка пароля: ' + e.message); return }
      const { data:sb } = await auth.getSession()
      const uid = sb?.session?.user?.id || userId
      const { error: e2 } = await supabase.from('profiles').update({ bin }).eq('id', uid)
      if (e2) { setLoading(false); setError('Ошибка сохранения: ' + e2.message); return }
      localStorage.setItem('reg_bin', bin)
      setLoading(false)
      onDone()
    } catch(err) {
      setLoading(false)
      setError('Ошибка: ' + err.message)
    }
  }

  return (
    <div>
      {error && <Alert type="error" C={C}>{error}</Alert>}
      <IINInput label="ИИН (для ИП) / БИН (для ТОО)" value={bin} onChange={setBin} type="bin" C={C} required/>
      <Inp label="Придумайте пароль" value={password} onChange={setPassword} placeholder="Минимум 6 символов" type="password" C={C}/>
      <Inp label="Повторите пароль" value={password2} onChange={setPassword2} placeholder="Повторите пароль" type="password" C={C}/>
      <Btn onClick={save} loading={loading} disabled={bin.length<12||password.length<6||password!==password2}>
        ✅ Сохранить и продолжить
      </Btn>
    </div>
  )
}


function PWAInstallBanner({C}) {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(()=>{
    // Проверяем не установлено ли уже
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('pwa_dismissed')
    if(isInstalled || dismissed) return

    window.addEventListener('beforeinstallprompt', (e)=>{
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    })

    // Показываем на iOS тоже (Safari не поддерживает beforeinstallprompt)
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    if(isIOS && !isInstalled && !dismissed) setShow(true)
  },[])

  if(!show) return null

  async function install(){
    if(deferredPrompt){
      deferredPrompt.prompt()
      const{outcome}=await deferredPrompt.userChoice
      if(outcome==='accepted') setShow(false)
    }
  }

  function dismiss(){
    localStorage.setItem('pwa_dismissed','1')
    setShow(false)
  }

  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())

  return(
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:500,padding:'12px 16px',background:C.card,borderTop:`2px solid ${C.p}`,boxShadow:'0 -4px 20px rgba(0,0,0,.3)'}}>
      <div style={{display:'flex',gap:12,alignItems:'center',maxWidth:500,margin:'0 auto'}}>
        <div style={{width:44,height:44,borderRadius:12,background:C.pSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Logo size={32}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{color:C.text,fontSize:12,fontWeight:700,margin:'0 0 2px'}}>Установить BizBook KZ</p>
          {isIOS?(
            <p style={{color:C.muted,fontSize:10,margin:0}}>Нажмите <strong>Поделиться</strong> → <strong>На экран Домой</strong></p>
          ):(
            <p style={{color:C.muted,fontSize:10,margin:0}}>Работает без интернета · Быстрый доступ</p>
          )}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          {!isIOS&&<button onClick={install} style={{padding:'7px 14px',borderRadius:10,background:C.p,border:'none',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer'}}>Установить</button>}
          <button onClick={dismiss} style={{padding:'7px 10px',borderRadius:10,background:C.card2,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:'pointer'}}>✕</button>
        </div>
      </div>
    </div>
  )
}


function ChangePasswordBlock({C}) {
  const [show, setShow] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function save() {
    if(pw.length < 6) { setError('Минимум 6 символов'); return }
    if(pw !== pw2) { setError('Пароли не совпадают'); return }
    setLoading(true); setError('')
    const { error: e } = await auth.updatePassword(pw)
    setLoading(false)
    if(e) { setError(e.message); return }
    setSuccess(true)
    setPw(''); setPw2('')
    setTimeout(() => { setSuccess(false); setShow(false) }, 2000)
  }

  return (
    <div style={{background:C.card,borderRadius:13,padding:'12px',marginBottom:8,border:`1px solid ${C.border}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <p style={{color:C.text,fontSize:12,fontWeight:600,margin:0}}>🔑 Изменить пароль</p>
        <button onClick={()=>setShow(!show)} style={{background:'none',border:'none',color:C.p,fontSize:12,cursor:'pointer',fontWeight:600}}>{show?'Скрыть':'Изменить'}</button>
      </div>
      {show&&(
        <div style={{marginTop:10}}>
          {error&&<Alert type="error" C={C}>{error}</Alert>}
          {success&&<Alert type="success" C={C}>✅ Пароль изменён!</Alert>}
          <Inp label="Новый пароль" value={pw} onChange={setPw} placeholder="Минимум 6 символов" type="password" C={C}/>
          <Inp label="Повторите пароль" value={pw2} onChange={setPw2} placeholder="Повторите пароль" type="password" C={C}/>
          <Btn onClick={save} loading={loading} disabled={pw.length<6||pw!==pw2}>Сохранить пароль</Btn>
        </div>
      )}
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
  const[appLoading,setAppLoading]=useState(true)
  const[docs,setDocs]=useState([])
  const[cpList,setCpList]=useState([])
  const[nomList,setNomList]=useState([])
  const[allCompanies,setAllCompanies]=useState([])
  const[allTariffs,setAllTariffs]=useState([])
  const[allTariffRequests,setAllTariffRequests]=useState([])

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
    if(!user){setProfile(null);setCompany(null);setDocs([]);setCpList([]);setNomList([]);setAppLoading(false);return}
    loadAll()
  },[user])

  async function loadAll(){
    setAppLoading(true)
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
    setAppLoading(false)

    // Tariffs for all
    const{data:tfs}=await tariffs.list()
    setAllTariffs(tfs||[])
    // Admin data
    if(p?.role==='admin'){
      const{data:trs}=await tariffRequests.listAll()
      setAllTariffRequests(trs||[])
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

  // Показываем SetupPassword только если нет bin в профиле
  const needsPassword = user && profile && !profile.bin

  if(needsPassword) return(
    <div style={{minHeight:'100vh',background:`radial-gradient(ellipse at 30% 20%,rgba(124,111,255,.2),${C.bg} 65%)`,display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:'system-ui'}}>
      <div style={{width:'100%',maxWidth:400,background:C.card,borderRadius:24,padding:'28px',border:`1px solid ${C.border}`}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <Logo size={48}/>
          <h2 style={{color:C.text,fontSize:18,fontWeight:800,margin:'12px 0 4px'}}>Настройка аккаунта</h2>
          <p style={{color:C.muted,fontSize:12,margin:0}}>Создайте пароль для быстрого входа</p>
        </div>
        <SetupPasswordScreen C={C} userId={user.id} onDone={()=>{
          localStorage.setItem('pw_set_' + user.id, '1')
          loadAll()
        }}/>
      </div>
    </div>
  )

  // Показываем спиннер пока данные загружаются
  if(appLoading) return(
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{width:48,height:48,border:`3px solid ${C.p}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{color:C.muted,fontSize:13}}>Загрузка...</p>
    </div>
  )
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
    if(screen==='newDoc') return <NewDocScreen C={C} company={company} cpList={cpList} nomList={nomList} initType={screenParams.type} initCp={screenParams.initCp} initRows={screenParams.initRows} linkedDocId={screenParams.linkedDocId} onBack={()=>nav('docs')} onSaved={()=>{loadAll();nav('docs')}}/>
    if(screen==='docDetail') return <DocDetailScreen C={C} doc={screenParams.doc} company={company} onBack={()=>nav('docs')} onUpdate={loadAll} setDocs={setDocs} docs={docs} nav={nav} cpList={cpList} nomList={nomList}/>
    if(screen==='docs') return <DocsScreen C={C} company={company} docs={docs} nav={nav} onRefresh={loadAll}/>
    if(screen==='counterparties') return <CpScreen C={C} company={company} cpList={cpList} onRefresh={loadAll}/>
    if(screen==='nomenclature') return <NomScreen C={C} company={company} nomList={nomList} onRefresh={loadAll}/>
    if(screen==='tariffs') return <TariffsScreen C={C} company={company} allTariffs={allTariffs} onSelect={(t)=>{alert(`Заявка на тариф «${t.name}» отправлена!\n\nДля активации свяжитесь:\n📞 +7 705 474 1612\n📧 info@bizbook.kz\n\nМы активируем тариф в течение 24 часов.`)}} onBack={()=>nav('home')}/>
    if(screen==='soon') return <SoonScreen C={C}/>
    if(screen==='profile') return <ProfileScreen C={C} profile={profile} company={company} onLogout={handleLogout} onCompanyUpdate={loadAll}/>
    if(screen==='admin'&&isAdmin) return <AdminScreen C={C} allCompanies={allCompanies} allTariffs={allTariffs} allTariffRequests={allTariffRequests} onRefresh={loadAll}/>
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
        <PWAInstallBanner C={C}/>
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
      <PWAInstallBanner C={C}/>
      <WM/>
    </div>
  )
}

// ─── TARIFFS SCREEN ───────────────────────────────────────────────
function TariffsScreen({C,company,allTariffs,onSelect,onBack}){
  const [requested,setRequested]=useState({})
  const [trStatus,setTrStatus]=useState(null)

  useEffect(()=>{
    if(company?.id){
      tariffRequests.get(company.id).then(({data})=>{
        if(data) setTrStatus(data)
      })
    }
  },[company?.id])

  async function handleSelect(t){
    if(!company?.id) return
    await tariffRequests.create(company.id, t.id)
    setTrStatus({tariff_id:t.id,status:'pending',tariffs:t})
    setRequested(r=>({...r,[t.id]:true}))
    onSelect&&onSelect(t)
  }
  const ICONS=['🚀','💼','⚡','🏆']
  const COLORS=[C.p,'#22c55e','#f59e0b','#ef4444']
  return(
    <div style={{flex:1,overflowY:'auto',paddingBottom:28}}>
      <div style={{padding:'14px 16px 0',display:'flex',alignItems:'center',gap:10}}>
        {onBack&&<button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:C.p,fontSize:28,padding:0,lineHeight:1}}>‹</button>}
        <div>
          <h2 style={{color:C.text,fontSize:16,fontWeight:800,margin:0}}>Тарифные планы</h2>
          <p style={{color:C.muted,fontSize:10,margin:0}}>Выберите подходящий план</p>
        </div>
      </div>
      <div style={{padding:'12px 16px 0'}}>
        {allTariffs.map((t,i)=>{
          const active=company?.tariff_id===t.id
          const available=t.is_active
          const features=Array.isArray(t.features)?t.features:[]
          return(
            <div key={t.id} style={{background:C.card,borderRadius:16,padding:'16px',marginBottom:12,border:`1.5px solid ${active?COLORS[i]:available?`${COLORS[i]}40`:C.border}`,position:'relative',overflow:'hidden'}}>
              {active&&<div style={{position:'absolute',top:10,right:10,background:C.green,borderRadius:10,padding:'2px 10px',fontSize:9,fontWeight:700,color:'#fff'}}>✅ Текущий</div>}
              {!available&&<div style={{position:'absolute',top:10,right:10,background:C.card2,borderRadius:10,padding:'2px 10px',fontSize:9,fontWeight:700,color:C.muted}}>🔧 В разработке</div>}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{width:44,height:44,borderRadius:12,background:`${COLORS[i]}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{ICONS[i]}</div>
                <div>
                  <p style={{color:COLORS[i],fontSize:15,fontWeight:800,margin:'0 0 2px'}}>{t.name}</p>
                  <p style={{color:C.text,fontSize:20,fontWeight:900,margin:0}}>{t.price_month?.toLocaleString('ru-KZ')} <span style={{fontSize:12,color:C.muted}}>₸/мес</span></p>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                {features.map((f,j)=>(
                  <div key={j} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                    <span style={{color:available?COLORS[i]:C.dim,fontSize:12}}>✓</span>
                    <span style={{color:available?C.text:C.muted,fontSize:11}}>{f}</span>
                  </div>
                ))}
              </div>
              {/* Статус тарифа */}
              {active&&<div style={{marginBottom:8,padding:'6px 10px',borderRadius:10,background:'rgba(34,197,94,.13)',textAlign:'center'}}><span style={{color:C.green,fontSize:11,fontWeight:700}}>✅ Подключён и активен</span></div>}
              {(requested[t.id]||trStatus?.tariff_id===t.id)&&!active&&<div style={{marginBottom:8,padding:'6px 10px',borderRadius:10,background:'rgba(245,158,11,.13)',textAlign:'center'}}><span style={{color:C.gold,fontSize:11,fontWeight:700}}>⏳ Ожидает активации</span></div>}
              {available?(
                active?(
                  <div style={{padding:'10px',borderRadius:11,background:`${C.green}15`,textAlign:'center'}}>
                    <span style={{color:C.green,fontSize:12,fontWeight:700}}>✅ Текущий тариф</span>
                  </div>
                ):(requested[t.id]||trStatus?.tariff_id===t.id)?(
                  <div style={{display:'flex',gap:8}}>
                    <a href={`https://wa.me/77054741612?text=Хочу оплатить тариф ${t.name} ${t.price_month} тг/мес для BizBook.kz`} target="_blank" rel="noopener noreferrer"
                      style={{flex:2,display:'block',padding:'11px',borderRadius:12,background:'linear-gradient(135deg,#25d366,#128c7e)',border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>
                      💳 Оплатить
                    </a>
                    <button onClick={()=>setRequested(r=>({...r,[t.id]:false}))}
                      style={{flex:1,padding:'11px',borderRadius:12,background:C.card2,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      Отменить
                    </button>
                  </div>
                ):(
                  <button onClick={()=>handleSelect(t)} style={{width:'100%',padding:'11px',borderRadius:12,background:`linear-gradient(135deg,${COLORS[i]},${COLORS[i]}bb)`,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                    Выбрать план →
                  </button>
                )
              ):(
                <div style={{padding:'10px',borderRadius:11,background:C.card2,textAlign:'center',border:`1px dashed ${C.border}`}}>
                  <span style={{color:C.muted,fontSize:12,fontWeight:600}}>🔧 Скоро будет доступен</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
