import { useState, useEffect, useMemo, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase, ref, onValue, set, push, remove, update
} from "firebase/database";

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
// 🔧 REMPLACEZ ces valeurs par celles de votre projet Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAi12OCnZ901dgB_6gGe6dmRdUTMkkfrMM",
  authDomain: "resavcasa.firebaseapp.com",
  databaseURL: "https://resavcasa-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "resavcasa",
  storageBucket: "resavcasa.firebasestorage.app",
  messagingSenderId: "27032567292",
  appId: "1:27032567292:web:c2c6d2d75751af66d54679"
};


const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ─── FIREBASE HELPERS ─────────────────────────────────────────────────────────
// Convertit un snapshot Firebase (objet clé→valeur) en tableau avec id
const snapToArray = (snap) => {
  if (!snap) return [];
  return Object.entries(snap).map(([id, val]) => ({ id, ...val }));
};

// Convertit un objet plat (pour rights qui est clé→tableau)
const snapToObj = (snap) => snap || {};

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "AVCASA";

const FRENCH_HOLIDAYS = (year) => {
  const easterSunday = (y) => {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  };
  const easter = easterSunday(year);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return new Set([
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`,
    `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
    fmt(addDays(easter, 1)), fmt(addDays(easter, 39)), fmt(addDays(easter, 50)),
  ]);
};

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

// ─── HOOK : écoute temps réel d'un nœud Firebase ─────────────────────────────
function useFirebaseList(path) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const r = ref(db, path);
    const unsub = onValue(r, (snap) => {
      setData(snap.exists() ? snapToArray(snap.val()) : []);
      setLoading(false);
    });
    return () => unsub();
  }, [path]);
  return [data, loading];
}

function useFirebaseObj(path) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const r = ref(db, path);
    const unsub = onValue(r, (snap) => {
      setData(snap.exists() ? snapToObj(snap.val()) : {});
      setLoading(false);
    });
    return () => unsub();
  }, [path]);
  return [data, loading];
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [members, membersLoading]           = useFirebaseList("members");
  const [gliders, glidersLoading]           = useFirebaseList("gliders");
  const [rights, rightsLoading]             = useFirebaseObj("rights");
  const [reservations, reservationsLoading] = useFirebaseList("reservations");
  const [waitlist, waitlistLoading]         = useFirebaseList("waitlist");
  const [availability, availLoading]        = useFirebaseList("availability");
  const [logs, logsLoading]                 = useFirebaseList("logs");

  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView]               = useState("calendar");
  const [today]                       = useState(new Date());
  const [calDate, setCalDate]         = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [modal, setModal]             = useState(null);
  const [darkMode, setDarkMode]       = useState(() => {
    try { return JSON.parse(localStorage.getItem("avcasa_dark")) || false; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("avcasa_dark", JSON.stringify(darkMode)); } catch {}
  }, [darkMode]);

  const isLoading = membersLoading || glidersLoading || rightsLoading ||
    reservationsLoading || waitlistLoading || availLoading;

  // ── Écriture Firebase ────────────────────────────────────────────────────
  const addLog = (action) => {
    const userId = currentUser?.memberId || 'admin';
    push(ref(db, "logs"), { ts: new Date().toISOString(), userId, action });
  };

  // ── Ecran de chargement ───────────────────────────────────────────────────
  if (isLoading) {
    const bg = darkMode ? '#1a1c1e' : '#f0f2f0';
    return (
      <div style={{minHeight:'100vh', background:bg, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:16}}>
        <div style={{fontSize:40}}>🛩️</div>
        <div style={{fontSize:20, fontWeight:700, color:'#1a6b3c'}}>Rés'AVCASA</div>
        <div style={{fontSize:14, color:'#888'}}>Connexion à la base de données…</div>
        <div style={{width:40, height:40, border:'4px solid #e0e0e0', borderTop:'4px solid #1a6b3c',
          borderRadius:'50%', animation:'spin 0.8s linear infinite'}} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!currentUser) return (
    <LoginScreen members={members} darkMode={darkMode}
      onLogin={(u) => { setCurrentUser(u); addLog(`Connexion: ${u.type==='admin'?'ADMIN':u.memberId}`); }} />
  );

  const userMember = currentUser.type === 'user' ? members.find(m => m.id === currentUser.memberId) : null;

  return (
    <div style={{minHeight:'100vh', background: darkMode?'#1a1c1e':'#f0f2f0',
      color: darkMode?'#e8eae8':'#1a1c1e', fontFamily:"'Segoe UI', system-ui, sans-serif", fontSize:15}}>
      <TopBar
        currentUser={currentUser} userMember={userMember} view={view} setView={setView}
        darkMode={darkMode} setDarkMode={setDarkMode}
        onLogout={() => { addLog(`Déconnexion`); setCurrentUser(null); setView('calendar'); }}
      />
      <div style={{maxWidth:1100, margin:'0 auto', padding:'0 12px 40px'}}>
        {view === 'calendar' && (
          <CalendarView
            calDate={calDate} setCalDate={setCalDate} today={today}
            members={members} gliders={gliders} reservations={reservations}
            availability={availability} currentUser={currentUser} userMember={userMember}
            onDayClick={(date) => setModal({type:'dayDetail', date})}
            darkMode={darkMode}
          />
        )}
        {view === 'day' && (
          <DayOperView
            today={today} members={members} gliders={gliders}
            reservations={reservations} availability={availability}
            onSelectDay={(d) => setModal({type:'dayDetail', date:d})}
            darkMode={darkMode}
          />
        )}
        {view === 'history' && (
          <HistoryView reservations={reservations} members={members} gliders={gliders} logs={logs} darkMode={darkMode} />
        )}
        {view === 'admin' && currentUser.type === 'admin' && (
          <AdminView
            members={members} gliders={gliders} rights={rights}
            reservations={reservations} waitlist={waitlist}
            addLog={addLog} darkMode={darkMode}
          />
        )}
      </div>
      {modal?.type === 'dayDetail' && (
        <DayDetailModal
          date={modal.date} members={members} gliders={gliders}
          reservations={reservations} waitlist={waitlist}
          availability={availability} rights={rights}
          currentUser={currentUser} userMember={userMember}
          addLog={addLog} darkMode={darkMode}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ members, onLogin, darkMode }) {
  const [tab, setTab]           = useState('user');
  const [initiales, setInitiales] = useState('');
  const [pwd, setPwd]           = useState('');
  const [err, setErr]           = useState('');

  const handleUser = () => {
    const m = members.find(m => m.initiales.toUpperCase() === initiales.toUpperCase().trim());
    if (!m) { setErr("Initiales introuvables"); return; }
    onLogin({type:'user', memberId: m.id});
  };
  const handleAdmin = () => {
    if (pwd === ADMIN_PASSWORD) onLogin({type:'admin'});
    else setErr("Mot de passe incorrect");
  };

  const bg     = darkMode ? '#1a1c1e' : '#f0f2f0';
  const card   = darkMode ? '#252729' : '#fff';
  const txt    = darkMode ? '#e8eae8' : '#1a1c1e';
  const muted  = darkMode ? '#9a9c9a' : '#6b6d6b';
  const border = darkMode ? '#3a3c3a' : '#dde0dd';
  const accent = '#1a6b3c';

  return (
    <div style={{minHeight:'100vh', background:bg, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:20}}>
      <div style={{marginBottom:24, textAlign:'center'}}>
        <div style={{fontSize:38, marginBottom:4}}>🛩️</div>
        <div style={{fontSize:26, fontWeight:700, color:accent, letterSpacing:-0.5}}>Rés'AVCASA</div>
        <div style={{fontSize:13, color:muted, marginTop:4}}>Association Vélivole de Château-Arnoux / Saint-Auban</div>
      </div>
      <div style={{background:card, border:`1px solid ${border}`, borderRadius:16, padding:'28px 32px',
        width:'100%', maxWidth:360, boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <div style={{display:'flex', marginBottom:24, background:bg, borderRadius:10, padding:3}}>
          {['user','admin'].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(''); }}
              style={{flex:1, padding:'8px 0', border:'none', borderRadius:8, fontWeight:600, fontSize:14,
                background: tab===t ? accent : 'transparent',
                color: tab===t ? '#fff' : muted, cursor:'pointer', transition:'all .2s'}}>
              {t === 'user' ? '👤 Membre' : '🔧 Admin'}
            </button>
          ))}
        </div>
        {tab === 'user' ? (
          <>
            <label style={{fontSize:13, color:muted, display:'block', marginBottom:6}}>Vos initiales</label>
            <input value={initiales} onChange={e=>{setInitiales(e.target.value);setErr('');}}
              placeholder="ex: JD" maxLength={5}
              onKeyDown={e=>e.key==='Enter'&&handleUser()}
              style={{width:'100%', padding:'10px 14px', border:`1.5px solid ${border}`, borderRadius:10,
                fontSize:20, fontWeight:700, textAlign:'center', letterSpacing:4,
                background:bg, color:txt, outline:'none', boxSizing:'border-box'}} />
            <button onClick={handleUser}
              style={{width:'100%', marginTop:14, padding:'12px 0', background:accent,
                color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer'}}>
              Se connecter →
            </button>
          </>
        ) : (
          <>
            <label style={{fontSize:13, color:muted, display:'block', marginBottom:6}}>Mot de passe admin</label>
            <input type="password" value={pwd} onChange={e=>{setPwd(e.target.value);setErr('');}}
              onKeyDown={e=>e.key==='Enter'&&handleAdmin()}
              style={{width:'100%', padding:'10px 14px', border:`1.5px solid ${border}`, borderRadius:10,
                fontSize:15, background:bg, color:txt, outline:'none', boxSizing:'border-box'}} />
            <button onClick={handleAdmin}
              style={{width:'100%', marginTop:14, padding:'12px 0', background:'#7c3aed',
                color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer'}}>
              Accès Admin →
            </button>
          </>
        )}
        {err && <div style={{marginTop:12, color:'#e53935', fontSize:13, textAlign:'center', fontWeight:500}}>{err}</div>}
      </div>
    </div>
  );
}

// ─── TOP BAR ──────────────────────────────────────────────────────────────────
function TopBar({ currentUser, userMember, view, setView, darkMode, setDarkMode, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const bg     = darkMode ? '#252729' : '#fff';
  const border = darkMode ? '#3a3c3a' : '#e0e3e0';
  const txt    = darkMode ? '#e8eae8' : '#1a1c1e';
  const muted  = darkMode ? '#8a8c8a' : '#6b6d6b';
  const accent = '#1a6b3c';

  const navItems = [
    {id:'calendar', icon:'📅', label:'Calendrier'},
    {id:'day',      icon:'✈️',  label:'Terrain'},
    {id:'history',  icon:'📋', label:'Historique'},
    ...(currentUser.type==='admin' ? [{id:'admin', icon:'⚙️', label:'Admin'}] : []),
  ];
  const currentNav = navItems.find(n => n.id === view);
  const handleNav  = (id) => { setView(id); setMenuOpen(false); };

  return (
    <div style={{background:bg, borderBottom:`1px solid ${border}`, position:'sticky', top:0, zIndex:100}}>
      <style>{`@media(max-width:600px){.desk-nav{display:none!important}.mob-nav{display:flex!important}}.mob-nav{display:none}`}</style>
      <div style={{maxWidth:1100, margin:'0 auto', padding:'0 12px',
        display:'flex', alignItems:'center', gap:8, height:54}}>
        <div style={{fontWeight:800, fontSize:15, color:accent, flexShrink:0, letterSpacing:-0.5}}>🛩️ Rés'AVCASA</div>
        <div style={{flex:1, display:'flex', gap:2, padding:'0 4px'}}>
          <div className="desk-nav" style={{display:'flex', gap:2, flex:1}}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => handleNav(n.id)}
                style={{padding:'6px 12px', border:'none', borderRadius:8, fontSize:13,
                  fontWeight: view===n.id?700:400,
                  background: view===n.id ? (n.id==='admin'?'#7c3aed':accent) : 'transparent',
                  color: view===n.id ? '#fff' : muted, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0}}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
          <div className="mob-nav" style={{flex:1, alignItems:'center', position:'relative'}}>
            <button onClick={() => setMenuOpen(o => !o)}
              style={{display:'flex', alignItems:'center', gap:8, padding:'7px 14px',
                border:`1px solid ${border}`, borderRadius:10,
                background: darkMode?'#1a1c1e':'#f5f7f5', color:txt,
                fontSize:14, fontWeight:700, cursor:'pointer', minWidth:160}}>
              <span style={{flex:1, textAlign:'left'}}>{currentNav?.icon} {currentNav?.label}</span>
              <span style={{fontSize:12, color:muted}}>{menuOpen ? '▲' : '▼'}</span>
            </button>
            {menuOpen && (
              <div style={{position:'absolute', top:'calc(100% + 6px)', left:0, background:bg,
                border:`1px solid ${border}`, borderRadius:12,
                boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:200, minWidth:200, overflow:'hidden'}}>
                {navItems.map(n => (
                  <button key={n.id} onClick={() => handleNav(n.id)}
                    style={{width:'100%', textAlign:'left', padding:'12px 16px', border:'none',
                      borderBottom:`1px solid ${border}`,
                      background: view===n.id ? (n.id==='admin'?'#f3effe':'#e8f5e9') : 'transparent',
                      color: view===n.id ? (n.id==='admin'?'#7c3aed':accent) : txt,
                      fontWeight: view===n.id?700:400, fontSize:15, cursor:'pointer'}}>
                    {n.icon} {n.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
          <button onClick={() => setDarkMode(!darkMode)}
            style={{background:'none', border:'none', fontSize:18, cursor:'pointer', padding:'4px 6px'}}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <div style={{fontSize:13, color:muted, display:'flex', flexDirection:'column', alignItems:'flex-end', lineHeight:1.2}}>
            <span style={{fontWeight:600, color:txt}}>{currentUser.type==='admin'?'Admin':userMember?.initiales}</span>
            {userMember && <span style={{fontSize:11}}>{userMember.prenom}</span>}
          </div>
          <button onClick={onLogout}
            style={{padding:'5px 10px', border:`1px solid ${border}`, borderRadius:8,
              background:'none', color:muted, fontSize:12, cursor:'pointer'}}>
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────
function CalendarView({ calDate, setCalDate, today, members, gliders, reservations, availability, currentUser, onDayClick, darkMode }) {
  const year     = calDate.getFullYear();
  const month    = calDate.getMonth();
  const holidays = useMemo(() => FRENCH_HOLIDAYS(year), [year]);

  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const startDow  = (firstDay.getDay() + 6) % 7;
  const cells     = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));

  const bg     = darkMode ? '#1a1c1e' : '#f0f2f0';
  const card   = darkMode ? '#252729' : '#fff';
  const border = darkMode ? '#3a3c3a' : '#dde0dd';
  const txt    = darkMode ? '#e8eae8' : '#1a1c1e';
  const muted  = darkMode ? '#8a8c8a' : '#6b6d6b';

  return (
    <div style={{paddingTop:20}}>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap'}}>
        <button onClick={() => setCalDate(new Date(year, month-1, 1))}
          style={{padding:'8px 14px', border:`1px solid ${border}`, borderRadius:10, background:card, color:txt, fontSize:18, cursor:'pointer'}}>‹</button>
        <select value={month} onChange={e => setCalDate(new Date(year, +e.target.value, 1))}
          style={{padding:'8px 12px', border:`1px solid ${border}`, borderRadius:10, background:card, color:txt, fontSize:16, fontWeight:700, cursor:'pointer'}}>
          {MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setCalDate(new Date(+e.target.value, month, 1))}
          style={{padding:'8px 12px', border:`1px solid ${border}`, borderRadius:10, background:card, color:txt, fontSize:16, fontWeight:700, cursor:'pointer'}}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => setCalDate(new Date(year, month+1, 1))}
          style={{padding:'8px 14px', border:`1px solid ${border}`, borderRadius:10, background:card, color:txt, fontSize:18, cursor:'pointer'}}>›</button>
        <button onClick={() => setCalDate(new Date(today.getFullYear(), today.getMonth(), 1))}
          style={{padding:'8px 14px', background:'#1a6b3c', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer'}}>
          Aujourd'hui
        </button>
        <div style={{marginLeft:'auto', fontSize:12, color:muted, display:'flex', gap:16, flexWrap:'wrap'}}>
          <span>✅ Libre</span><span>🟠 Partiel</span><span>🔴 Complet</span><span>🎓 Instruction</span>
        </div>
      </div>
      <div style={{background:card, borderRadius:16, border:`1px solid ${border}`, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', background: darkMode?'#2c2f2c':'#f7faf7'}}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{textAlign:'center', padding:'10px 4px', fontSize:12, fontWeight:700,
              color: d==='Sam'||d==='Dim' ? '#e53935' : muted}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)'}}>
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} style={{minHeight:80, borderTop:`1px solid ${border}`,
              borderRight:(i+1)%7!==0?`1px solid ${border}`:'none'}} />;
            const dStr    = fmtDate(date);
            const isToday = fmtDate(today) === dStr;
            const isHol   = holidays.has(dStr);
            const dow     = (date.getDay() + 6) % 7;
            const isWE    = dow >= 5;
            const dayRes  = reservations.filter(r => r.date === dStr);
            const hasMyRes = currentUser.type === 'user' && dayRes.some(r => r.memberId === currentUser.memberId);
            const reservedGliders = new Set(dayRes.filter(r=>r.type==='day').map(r=>r.gliderId)).size;
            const hasInstruction  = availability.some(a => a.date === dStr);

            let occupancy = '✅';
            if (reservedGliders >= gliders.length && gliders.length > 0) occupancy = '🔴';
            else if (dayRes.length > 0) occupancy = '🟠';

            let bgColor = 'transparent';
            if (isToday)       bgColor = darkMode ? '#1a3a2a' : '#e8f5e9';
            else if (hasMyRes) bgColor = darkMode ? '#1a2a3a' : '#e3f2fd';
            else if (dayRes.length > 0) bgColor = darkMode ? '#2a2a1a' : '#fff8e1';
            else if (isWE || isHol) bgColor = darkMode ? '#2a1a1a' : '#fff5f5';

            return (
              <div key={dStr} onClick={() => onDayClick(date)}
                style={{minHeight:80, padding:'6px 8px', borderTop:`1px solid ${border}`,
                  borderRight:(i+1)%7!==0?`1px solid ${border}`:'none',
                  background:bgColor, cursor:'pointer', transition:'filter .15s'}}
                onMouseEnter={e=>e.currentTarget.style.filter='brightness(0.95)'}
                onMouseLeave={e=>e.currentTarget.style.filter=''}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <span style={{fontWeight:isToday?800:isWE||isHol?600:400, fontSize:14,
                    color: isToday?'#fff': isWE||isHol?'#e53935':txt,
                    background: isToday?'#1a6b3c':'transparent',
                    borderRadius:isToday?'50%':'0',
                    width:isToday?24:undefined, height:isToday?24:undefined,
                    display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
                    {date.getDate()}
                  </span>
                  <span style={{fontSize:13}}>{occupancy}</span>
                </div>
                {hasInstruction && <div style={{fontSize:14, marginTop:2}}>🎓</div>}
                {dayRes.length > 0 && (
                  <div style={{fontSize:10, marginTop:4, color:muted}}>
                    {dayRes.slice(0,2).map(r => {
                      const m = members.find(x=>x.id===r.memberId);
                      const g = gliders.find(x=>x.id===r.gliderId);
                      return (
                        <div key={r.id} style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          color: r.memberId===currentUser.memberId?'#1565c0':'inherit', lineHeight:1.3}}>
                          {m?.prenom} · {g?.modele}
                        </div>
                      );
                    })}
                    {dayRes.length > 2 && <div style={{color:muted}}>+{dayRes.length-2} autre{dayRes.length-2>1?'s':''}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── DAY DETAIL MODAL ─────────────────────────────────────────────────────────
function DayDetailModal({ date, members, gliders, reservations, waitlist, availability, rights, currentUser, userMember, addLog, darkMode, onClose }) {
  const [subView, setSubView]         = useState('detail');
  const [resType, setResType]         = useState('day');
  const [selGlider, setSelGlider]     = useState('');
  const [debut, setDebut]             = useState('08:00');
  const [fin, setFin]                 = useState('18:00');
  const [commentaire, setCommentaire] = useState('');
  const [conflict, setConflict]       = useState(null);
  const [promoted, setPromoted]       = useState(null);

  const dStr       = fmtDate(date);
  const dayRes     = reservations.filter(r => r.date === dStr);
  const dayAvail   = availability.filter(a => a.date === dStr);
  const instructors = dayAvail.map(a => members.find(m => m.id === a.memberId)).filter(Boolean);

  const authorizedGliders = currentUser.type === 'admin'
    ? gliders
    : gliders.filter(g => (rights[currentUser.memberId] || []).includes(g.id));

  const isInstructor = userMember?.instructeur;
  const iAmAvail     = availability.some(a => a.memberId === currentUser.memberId && a.date === dStr);
  const iAmAvailObj  = availability.find(a => a.memberId === currentUser.memberId && a.date === dStr);

  const overlay = {position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200,
    display:'flex', alignItems:'center', justifyContent:'center', padding:16};
  const cardStyle = {background:darkMode?'#252729':'#fff', borderRadius:20, padding:24,
    width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxSizing:'border-box'};
  const border = darkMode?'#3a3c3a':'#dde0dd';
  const txt    = darkMode?'#e8eae8':'#1a1c1e';
  const muted  = darkMode?'#8a8c8a':'#6b6d6b';
  const bg     = darkMode?'#1a1c1e':'#f7f9f7';

  // ── Réserver ───────────────────────────────────────────────────────────────
  const handleReserve = () => {
    if (!selGlider) return;
    const existing   = dayRes.filter(r => r.gliderId === selGlider);
    const hasConflict = existing.some(r => r.type === 'day') ||
      (resType === 'slot' && existing.some(r => r.type === 'slot' && r.debut < fin && r.fin > debut));

    if (hasConflict) {
      const inWait = waitlist.some(w => w.memberId === currentUser.memberId && w.gliderId === selGlider && w.date === dStr);
      if (inWait) { setConflict('already_wait'); return; }
      setConflict('conflict');
      return;
    }
    push(ref(db, "reservations"), {
      memberId:    currentUser.memberId,
      gliderId:    selGlider,
      date:        dStr,
      type:        resType,
      debut:       resType==='slot' ? debut : null,
      fin:         resType==='slot' ? fin   : null,
      commentaire: commentaire.trim().slice(0,40) || null,
      ts:          Date.now(),
    });
    addLog(`Réservation: ${selGlider} le ${dStr}`);
    setSubView('detail');
    setCommentaire('');
  };

  // ── Liste d'attente ────────────────────────────────────────────────────────
  const handleWaitlist = () => {
    push(ref(db, "waitlist"), {
      memberId: currentUser.memberId,
      gliderId: selGlider,
      date:     dStr,
      ts:       Date.now(),
    });
    addLog(`Liste d'attente: ${selGlider} le ${dStr}`);
    setConflict(null);
    setSubView('detail');
  };

  // ── Annuler + promotion automatique ───────────────────────────────────────
  const handleDelete = (resId) => {
    const cancelled   = reservations.find(x => x.id === resId);
    const waitForSlot = waitlist
      .filter(w => w.gliderId === cancelled.gliderId && w.date === cancelled.date)
      .sort((a, b) => a.ts - b.ts);

    if (waitForSlot.length > 0) {
      const first          = waitForSlot[0];
      const promotedMember = members.find(m => m.id === first.memberId);
      const promotedGlider = gliders.find(g => g.id === first.gliderId);
      // Supprimer l'ancienne résa, créer la nouvelle, retirer de la liste d'attente
      remove(ref(db, `reservations/${resId}`));
      push(ref(db, "reservations"), {
        memberId:    first.memberId,
        gliderId:    first.gliderId,
        date:        first.date,
        type:        cancelled.type,
        debut:       cancelled.debut,
        fin:         cancelled.fin,
        commentaire: null,
        ts:          Date.now(),
      });
      remove(ref(db, `waitlist/${first.id}`));
      addLog(`Annulation ${resId} → promotion: ${first.memberId}`);
      setPromoted({
        memberName: `${promotedMember?.prenom} ${promotedMember?.nom}`,
        gliderName: `${promotedGlider?.modele}_${promotedGlider?.immat}`,
      });
      setTimeout(() => setPromoted(null), 5000);
    } else {
      remove(ref(db, `reservations/${resId}`));
      addLog(`Annulation réservation ${resId}`);
    }
  };

  // ── Disponibilité instruction ──────────────────────────────────────────────
  const toggleAvail = () => {
    if (iAmAvail && iAmAvailObj) {
      remove(ref(db, `availability/${iAmAvailObj.id}`));
    } else {
      push(ref(db, "availability"), { memberId: currentUser.memberId, date: dStr });
      addLog(`Disponibilité instruction: ${dStr}`);
    }
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={cardStyle}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
          <div style={{fontSize:20, fontWeight:800, color:txt}}>
            {date.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'})}
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:muted}}>✕</button>
        </div>

        {promoted && (
          <div style={{background:'#e8f5e9', border:'1px solid #43a047', borderRadius:12,
            padding:'12px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:20}}>🎉</span>
            <div>
              <div style={{fontWeight:700, fontSize:13, color:'#1b5e20'}}>Liste d'attente promue !</div>
              <div style={{fontSize:13, color:'#2e7d32'}}>
                <strong>{promoted.memberName}</strong> est automatiquement réservé sur <strong>{promoted.gliderName}</strong>
              </div>
            </div>
          </div>
        )}

        {conflict === 'conflict' && (
          <div style={{background:'#fff3e0', border:'1px solid #ff9800', borderRadius:12, padding:16, marginBottom:16}}>
            <div style={{fontWeight:700, color:'#e65100', marginBottom:8}}>⚠️ Conflit de réservation</div>
            <div style={{fontSize:13, color:'#5d3a00', marginBottom:12}}>Ce planeur est déjà réservé. Voulez-vous vous inscrire en liste d'attente ?</div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={handleWaitlist}
                style={{padding:'8px 16px', background:'#ff9800', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer'}}>
                ✋ Liste d'attente
              </button>
              <button onClick={() => setConflict(null)}
                style={{padding:'8px 16px', background:'none', border:'1px solid #ff9800', borderRadius:8, color:'#e65100', cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {conflict === 'already_wait' && (
          <div style={{background:'#e8f5e9', border:'1px solid #4caf50', borderRadius:12, padding:12, marginBottom:16, fontSize:13, color:'#1b5e20'}}>
            ✅ Vous êtes déjà en liste d'attente pour ce planeur.
          </div>
        )}

        {instructors.length > 0 && (
          <div style={{background:darkMode?'#1a2a3a':'#e3f2fd', borderRadius:12, padding:12, marginBottom:14, fontSize:13}}>
            🎓 <strong>Instruction disponible</strong> avec : {instructors.map(i => `${i.nom} ${i.prenom}`).join(', ')}
          </div>
        )}

        {isInstructor && currentUser.type === 'user' && (
          <button onClick={toggleAvail}
            style={{width:'100%', padding:'10px 0', marginBottom:14, border:'1px dashed #42a5f5', borderRadius:10,
              background: iAmAvail ? '#e3f2fd' : 'transparent', color:'#1565c0', fontWeight:600, cursor:'pointer', fontSize:13}}>
            {iAmAvail ? '✅ Disponible pour instruction (cliquer pour annuler)' : '🎓 Me déclarer disponible pour instruction'}
          </button>
        )}

        {subView === 'detail' && (
          <>
            <div style={{marginBottom:14}}>
              <div style={{fontWeight:700, marginBottom:8, color:txt, fontSize:14}}>Réservations du jour</div>
              {dayRes.length === 0
                ? <div style={{fontSize:13, color:muted, fontStyle:'italic'}}>Aucune réservation</div>
                : dayRes.map(r => {
                  const m = members.find(x => x.id === r.memberId);
                  const g = gliders.find(x => x.id === r.gliderId);
                  const canDelete = r.memberId === currentUser.memberId || currentUser.type === 'admin';
                  return (
                    <div key={r.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                      background: r.memberId===currentUser.memberId ? (darkMode?'#1a3a2a':'#e8f5e9') : bg,
                      borderRadius:10, padding:'10px 14px', marginBottom:6, border:`1px solid ${border}`}}>
                      <div>
                        <div style={{fontWeight:600, fontSize:14, color:txt}}>{m?.initiales} — {g?.modele}_{g?.immat}</div>
                        <div style={{fontSize:12, color:muted}}>
                          {r.type === 'day' ? 'Journée complète' : `${r.debut} → ${r.fin}`}
                        </div>
                        {r.commentaire && (
                          <div style={{fontSize:12, marginTop:3, color:darkMode?'#7cb9f0':'#1565c0', fontStyle:'italic'}}>
                            💬 {r.commentaire}
                          </div>
                        )}
                      </div>
                      {canDelete && (
                        <button onClick={() => handleDelete(r.id)}
                          style={{background:'none', border:'1px solid #ef5350', color:'#ef5350', borderRadius:8, padding:'4px 10px', fontSize:12, cursor:'pointer'}}>
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            {(() => {
              const myWait = waitlist.filter(w => w.memberId === currentUser.memberId && w.date === dStr);
              return myWait.length > 0 ? (
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700, marginBottom:8, color:txt, fontSize:14}}>Mes listes d'attente</div>
                  {myWait.map(w => {
                    const g = gliders.find(x => x.id === w.gliderId);
                    return (
                      <div key={w.id} style={{background:'#fff8e1', border:'1px solid #ffd54f', borderRadius:10,
                        padding:'8px 14px', marginBottom:6, fontSize:13, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <span>⏳ {g?.modele}_{g?.immat}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null;
            })()}

            <button onClick={() => setSubView('reserve')}
              style={{width:'100%', padding:'12px 0', background:'#1a6b3c', color:'#fff',
                border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer'}}>
              + Nouvelle réservation
            </button>
          </>
        )}

        {subView === 'reserve' && (
          <div>
            <div style={{fontWeight:700, fontSize:16, color:txt, marginBottom:16}}>Réserver un planeur</div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:13, color:muted, display:'block', marginBottom:6}}>Planeur</label>
              <select value={selGlider} onChange={e => setSelGlider(e.target.value)}
                style={{width:'100%', padding:'10px', border:`1px solid ${border}`, borderRadius:10, background:bg, color:txt, fontSize:14}}>
                <option value="">-- Choisir un planeur --</option>
                {authorizedGliders.map(g => {
                  const busy = dayRes.some(r => r.gliderId === g.id && r.type === 'day');
                  return <option key={g.id} value={g.id}>{g.modele}_{g.immat}{busy ? ' 🔴' : ' ✅'}</option>;
                })}
              </select>
            </div>
            <div style={{display:'flex', gap:10, marginBottom:14}}>
              {['day','slot'].map(t => (
                <button key={t} onClick={() => setResType(t)}
                  style={{flex:1, padding:'10px 0', border:`1px solid ${border}`, borderRadius:10,
                    background: resType===t ? '#1a6b3c' : 'transparent',
                    color: resType===t ? '#fff' : txt, fontWeight:600, cursor:'pointer'}}>
                  {t === 'day' ? '☀️ Journée' : '⏱️ Créneau'}
                </button>
              ))}
            </div>
            {resType === 'slot' && (
              <div style={{display:'flex', gap:12, marginBottom:14}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:12, color:muted}}>Début</label>
                  <input type="time" value={debut} onChange={e=>setDebut(e.target.value)} min="08:00" max="19:00"
                    style={{width:'100%', padding:'8px', border:`1px solid ${border}`, borderRadius:8, background:bg, color:txt, marginTop:4}} />
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:12, color:muted}}>Fin</label>
                  <input type="time" value={fin} onChange={e=>setFin(e.target.value)} min="08:00" max="19:00"
                    style={{width:'100%', padding:'8px', border:`1px solid ${border}`, borderRadius:8, background:bg, color:txt, marginTop:4}} />
                </div>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:13, color:muted, display:'flex', justifyContent:'space-between', marginBottom:6}}>
                <span>Commentaire <span style={{fontWeight:400}}>(optionnel)</span></span>
                <span style={{fontSize:11, color:commentaire.length>=40?'#e53935':muted}}>{commentaire.length}/40</span>
              </label>
              <input value={commentaire} onChange={e => setCommentaire(e.target.value.slice(0,40))}
                placeholder="ex: Brevet, voyage à 2, solo…"
                style={{width:'100%', padding:'9px 12px', border:`1px solid ${commentaire.length>=40?'#ef5350':border}`,
                  borderRadius:10, background:bg, color:txt, fontSize:14, boxSizing:'border-box'}} />
            </div>
            <div style={{display:'flex', gap:10}}>
              <button onClick={handleReserve}
                style={{flex:1, padding:'12px 0', background:'#1a6b3c', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer'}}>
                ✅ Confirmer
              </button>
              <button onClick={() => { setSubView('detail'); setConflict(null); }}
                style={{padding:'12px 16px', background:'none', border:`1px solid ${border}`, borderRadius:12, color:txt, cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DAY OPER VIEW ────────────────────────────────────────────────────────────
function DayOperView({ today, members, gliders, reservations, availability, onSelectDay, darkMode }) {
  const [viewDate, setViewDate] = useState(today);
  const dStr    = fmtDate(viewDate);
  const dayRes  = reservations.filter(r => r.date === dStr);
  const dayAvail = availability.filter(a => a.date === dStr);

  const card   = darkMode?'#252729':'#fff';
  const border = darkMode?'#3a3c3a':'#dde0dd';
  const txt    = darkMode?'#e8eae8':'#1a1c1e';
  const muted  = darkMode?'#8a8c8a':'#6b6d6b';

  const availableGliders  = gliders.filter(g => !dayRes.some(r => r.gliderId === g.id && r.type === 'day'));
  const reservedGliders   = gliders.filter(g => dayRes.some(r => r.gliderId === g.id));
  const availInstructors  = dayAvail.map(a => members.find(m => m.id === a.memberId)).filter(Boolean);

  return (
    <div style={{paddingTop:20}}>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap'}}>
        <div style={{fontSize:22, fontWeight:800, color:'#1a6b3c'}}>✈️ Vue terrain</div>
        <input type="date" value={dStr} onChange={e => setViewDate(new Date(e.target.value + 'T12:00'))}
          style={{padding:'8px 12px', border:`1px solid ${border}`, borderRadius:10, background:card, color:txt, fontSize:14}} />
        <button onClick={() => setViewDate(today)}
          style={{padding:'8px 14px', background:'#1a6b3c', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer'}}>
          Aujourd'hui
        </button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16, marginBottom:16}}>
        <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20}}>
          <div style={{fontWeight:700, fontSize:16, marginBottom:14, color:txt}}>✅ Planeurs disponibles ({availableGliders.length})</div>
          {availableGliders.length === 0
            ? <div style={{color:muted, fontStyle:'italic', fontSize:13}}>Tous réservés</div>
            : availableGliders.map(g => (
              <div key={g.id} style={{padding:'10px 14px', background:darkMode?'#1a3a2a':'#e8f5e9', borderRadius:10, marginBottom:8, fontWeight:600, fontSize:14, color:txt}}>
                🛩️ {g.modele}_{g.immat}
              </div>
            ))}
        </div>
        <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20}}>
          <div style={{fontWeight:700, fontSize:16, marginBottom:14, color:txt}}>🔴 Planeurs réservés ({reservedGliders.length})</div>
          {reservedGliders.length === 0
            ? <div style={{color:muted, fontStyle:'italic', fontSize:13}}>Aucune réservation</div>
            : reservedGliders.map(g => {
              const res = dayRes.filter(r => r.gliderId === g.id);
              return (
                <div key={g.id} style={{padding:'10px 14px', background:darkMode?'#2a1a1a':'#ffebee', borderRadius:10, marginBottom:8}}>
                  <div style={{fontWeight:600, fontSize:14, color:txt}}>🛩️ {g.modele}_{g.immat}</div>
                  {res.map(r => {
                    const m = members.find(x => x.id === r.memberId);
                    return <div key={r.id} style={{fontSize:12, color:muted, marginTop:3}}>{m?.initiales} — {r.type==='day'?'Journée':`${r.debut}→${r.fin}`}</div>;
                  })}
                </div>
              );
            })}
        </div>
        <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20}}>
          <div style={{fontWeight:700, fontSize:16, marginBottom:14, color:txt}}>🎓 Instructeurs disponibles ({availInstructors.length})</div>
          {availInstructors.length === 0
            ? <div style={{color:muted, fontStyle:'italic', fontSize:13}}>Aucun instructeur disponible</div>
            : availInstructors.map(i => (
              <div key={i.id} style={{padding:'10px 14px', background:darkMode?'#1a2a3a':'#e3f2fd', borderRadius:10, marginBottom:8, fontWeight:600, fontSize:14, color:txt}}>
                🎓 {i.nom} {i.prenom}
              </div>
            ))}
        </div>
      </div>
      <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20}}>
        <div style={{fontWeight:700, fontSize:16, marginBottom:14, color:txt}}>📋 Toutes les réservations du jour ({dayRes.length})</div>
        {dayRes.length === 0
          ? <div style={{color:muted, fontStyle:'italic', fontSize:13}}>Aucune réservation</div>
          : dayRes.map(r => {
            const m = members.find(x => x.id === r.memberId);
            const g = gliders.find(x => x.id === r.gliderId);
            return (
              <div key={r.id} style={{display:'flex', alignItems:'center', gap:16, padding:'10px 14px',
                background:darkMode?'#2a2c2a':'#f7faf7', borderRadius:10, marginBottom:6, border:`1px solid ${border}`}}>
                <div style={{width:36, height:36, borderRadius:'50%', background:'#1a6b3c',
                  display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13, flexShrink:0}}>
                  {m?.initiales}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, fontSize:14, color:txt}}>{m?.prenom} {m?.nom}</div>
                  <div style={{fontSize:12, color:muted}}>🛩️ {g?.modele}_{g?.immat} — {r.type==='day'?'Journée':`${r.debut} → ${r.fin}`}</div>
                  {r.commentaire && <div style={{fontSize:12, color:'#1565c0', fontStyle:'italic', marginTop:2}}>💬 {r.commentaire}</div>}
                </div>
              </div>
            );
          })}
      </div>
      <button onClick={() => onSelectDay(viewDate)}
        style={{marginTop:16, padding:'12px 24px', background:'#1a6b3c', color:'#fff',
          border:'none', borderRadius:12, fontSize:14, fontWeight:600, cursor:'pointer'}}>
        + Réserver sur ce jour
      </button>
    </div>
  );
}

// ─── HISTORY VIEW ─────────────────────────────────────────────────────────────
function HistoryView({ reservations, members, gliders, logs, darkMode }) {
  const [tab, setTab] = useState('reservations');
  const card   = darkMode?'#252729':'#fff';
  const border = darkMode?'#3a3c3a':'#dde0dd';
  const txt    = darkMode?'#e8eae8':'#1a1c1e';
  const muted  = darkMode?'#8a8c8a':'#6b6d6b';
  const bg     = darkMode?'#1a1c1e':'#f7f9f7';

  const sortedRes  = [...reservations].sort((a,b) => b.ts - a.ts);
  const byMember   = {};
  const byGlider   = {};
  reservations.forEach(r => {
    byMember[r.memberId] = (byMember[r.memberId]||0) + 1;
    byGlider[r.gliderId] = (byGlider[r.gliderId]||0) + 1;
  });

  return (
    <div style={{paddingTop:20}}>
      <div style={{fontSize:22, fontWeight:800, color:'#1a6b3c', marginBottom:20}}>📋 Historique & Statistiques</div>
      <div style={{display:'flex', gap:8, marginBottom:20, flexWrap:'wrap'}}>
        {['reservations','stats','logs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{padding:'8px 16px', border:`1px solid ${border}`, borderRadius:10,
              background:tab===t?'#1a6b3c':'transparent', color:tab===t?'#fff':txt, fontWeight:600, fontSize:13, cursor:'pointer'}}>
            {t==='reservations'?'📅 Réservations':t==='stats'?'📊 Statistiques':'🔒 Logs'}
          </button>
        ))}
      </div>

      {tab === 'reservations' && (
        <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, overflow:'hidden'}}>
          {sortedRes.map((r,i) => {
            const m = members.find(x => x.id === r.memberId);
            const g = gliders.find(x => x.id === r.gliderId);
            return (
              <div key={r.id} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 16px',
                borderBottom:i<sortedRes.length-1?`1px solid ${border}`:'none',
                background:i%2===0?'transparent':bg}}>
                <div style={{width:36, height:36, borderRadius:'50%', background:'#1a6b3c20',
                  display:'flex', alignItems:'center', justifyContent:'center', color:'#1a6b3c', fontWeight:700, fontSize:12, flexShrink:0}}>
                  {m?.initiales}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, fontSize:14, color:txt}}>{m?.prenom} {m?.nom}</div>
                  <div style={{fontSize:12, color:muted}}>{r.date} · {g?.modele}_{g?.immat} · {r.type==='day'?'Journée':`${r.debut}→${r.fin}`}</div>
                  {r.commentaire && <div style={{fontSize:12, color:'#1565c0', fontStyle:'italic', marginTop:2}}>💬 {r.commentaire}</div>}
                </div>
              </div>
            );
          })}
          {sortedRes.length===0 && <div style={{padding:24, textAlign:'center', color:muted, fontStyle:'italic'}}>Aucune réservation</div>}
        </div>
      )}

      {tab === 'stats' && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16}}>
          <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20}}>
            <div style={{fontWeight:700, fontSize:15, marginBottom:14, color:txt}}>Réservations par membre</div>
            {members.map(m => (
              <div key={m.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${border}`}}>
                <span style={{fontSize:13, color:txt}}>{m.prenom} {m.nom}</span>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{width:Math.min((byMember[m.id]||0)*20,120), height:8, background:'#1a6b3c', borderRadius:4, minWidth:4}} />
                  <span style={{fontSize:13, fontWeight:700, color:'#1a6b3c', minWidth:20, textAlign:'right'}}>{byMember[m.id]||0}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20}}>
            <div style={{fontWeight:700, fontSize:15, marginBottom:14, color:txt}}>Réservations par planeur</div>
            {gliders.map(g => (
              <div key={g.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${border}`}}>
                <span style={{fontSize:13, color:txt}}>{g.modele}_{g.immat}</span>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{width:Math.min((byGlider[g.id]||0)*20,120), height:8, background:'#1565c0', borderRadius:4, minWidth:4}} />
                  <span style={{fontSize:13, fontWeight:700, color:'#1565c0', minWidth:20, textAlign:'right'}}>{byGlider[g.id]||0}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20}}>
            <div style={{fontWeight:700, fontSize:15, marginBottom:14, color:txt}}>Résumé global</div>
            {[
              {label:'Total réservations', val:reservations.length, color:'#1a6b3c'},
              {label:'Membres actifs',     val:Object.keys(byMember).length, color:'#1565c0'},
              {label:'Planeurs utilisés',  val:Object.keys(byGlider).length, color:'#7c3aed'},
            ].map(s => (
              <div key={s.label} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${border}`}}>
                <span style={{fontSize:13, color:txt}}>{s.label}</span>
                <span style={{fontWeight:800, fontSize:18, color:s.color}}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, overflow:'hidden'}}>
          {[...logs].sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,100).map((l,i) => (
            <div key={l.id} style={{padding:'10px 16px', borderBottom:`1px solid ${border}`,
              background:i%2===0?'transparent':bg, fontSize:13, display:'flex', gap:12}}>
              <span style={{color:muted, flexShrink:0}}>{new Date(l.ts).toLocaleString('fr-FR')}</span>
              <span style={{color:'#1565c0', fontWeight:600, flexShrink:0}}>{l.userId}</span>
              <span style={{color:txt}}>{l.action}</span>
            </div>
          ))}
          {logs.length===0 && <div style={{padding:24, textAlign:'center', color:muted, fontStyle:'italic'}}>Aucun log</div>}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function AdminView({ members, gliders, rights, reservations, waitlist, addLog, darkMode }) {
  const [tab, setTab] = useState('members');
  const card   = darkMode?'#252729':'#fff';
  const border = darkMode?'#3a3c3a':'#dde0dd';
  const txt    = darkMode?'#e8eae8':'#1a1c1e';
  const muted  = darkMode?'#8a8c8a':'#6b6d6b';
  const bg     = darkMode?'#1a1c1e':'#f7f9f7';

  return (
    <div style={{paddingTop:20}}>
      <div style={{fontSize:22, fontWeight:800, color:'#7c3aed', marginBottom:20}}>⚙️ Administration</div>
      <div style={{display:'flex', gap:8, marginBottom:20, flexWrap:'wrap'}}>
        {['members','gliders','rights','reservations'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{padding:'8px 16px', border:`1px solid ${border}`, borderRadius:10,
              background:tab===t?'#7c3aed':'transparent', color:tab===t?'#fff':txt, fontWeight:600, fontSize:13, cursor:'pointer'}}>
            {t==='members'?'👤 Membres':t==='gliders'?'🛩️ Planeurs':t==='rights'?'🔑 Droits':'📅 Réservations'}
          </button>
        ))}
      </div>
      {tab==='members'      && <AdminMembers      members={members} addLog={addLog} darkMode={darkMode} card={card} border={border} txt={txt} muted={muted} bg={bg} />}
      {tab==='gliders'      && <AdminGliders      gliders={gliders} addLog={addLog} darkMode={darkMode} card={card} border={border} txt={txt} muted={muted} bg={bg} />}
      {tab==='rights'       && <AdminRights       members={members} gliders={gliders} rights={rights} addLog={addLog} darkMode={darkMode} card={card} border={border} txt={txt} muted={muted} />}
      {tab==='reservations' && <AdminReservations reservations={reservations} members={members} gliders={gliders} waitlist={waitlist} addLog={addLog} darkMode={darkMode} card={card} border={border} txt={txt} muted={muted} bg={bg} />}
    </div>
  );
}

function AdminMembers({ members, addLog, darkMode, card, border, txt, muted, bg }) {
  const [form, setForm] = useState({nom:'', prenom:'', initiales:'', dob:'', instructeur:false});
  const [err, setErr]   = useState('');

  const add = () => {
    if (!form.nom || !form.prenom || !form.initiales || !form.dob) { setErr("Tous les champs sont obligatoires"); return; }
    if (members.some(m => m.initiales.toUpperCase() === form.initiales.toUpperCase())) { setErr("Ces initiales existent déjà"); return; }
    push(ref(db, "members"), {...form, initiales: form.initiales.toUpperCase()});
    addLog(`Ajout membre: ${form.nom} ${form.prenom}`);
    setForm({nom:'', prenom:'', initiales:'', dob:'', instructeur:false});
    setErr('');
  };

  return (
    <div>
      <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20, marginBottom:20}}>
        <div style={{fontWeight:700, fontSize:15, marginBottom:16, color:txt}}>Ajouter un membre</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:12}}>
          {[['nom','Nom'],['prenom','Prénom'],['initiales','Initiales'],['dob','Date naissance']].map(([k,l]) => (
            <div key={k}>
              <label style={{fontSize:12, color:muted, display:'block', marginBottom:4}}>{l}</label>
              <input type={k==='dob'?'date':'text'} value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
                style={{width:'100%', padding:'8px 10px', border:`1px solid ${border}`, borderRadius:8, background:bg, color:txt, fontSize:14, boxSizing:'border-box'}} />
            </div>
          ))}
        </div>
        <label style={{display:'flex', alignItems:'center', gap:8, fontSize:14, color:txt, marginBottom:12, cursor:'pointer'}}>
          <input type="checkbox" checked={form.instructeur} onChange={e => setForm(f=>({...f, instructeur:e.target.checked}))} style={{width:18,height:18}} />
          Instructeur
        </label>
        {err && <div style={{color:'#e53935', fontSize:13, marginBottom:8}}>{err}</div>}
        <button onClick={add} style={{padding:'10px 20px', background:'#1a6b3c', color:'#fff', border:'none', borderRadius:10, fontWeight:600, cursor:'pointer'}}>
          + Ajouter
        </button>
      </div>
      <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, overflow:'hidden'}}>
        {members.map((m,i) => (
          <div key={m.id} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 16px',
            borderBottom:i<members.length-1?`1px solid ${border}`:'none'}}>
            <div style={{width:40, height:40, borderRadius:'50%', background:'#1a6b3c20',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#1a6b3c', fontWeight:800, fontSize:13, flexShrink:0}}>
              {m.initiales}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, fontSize:14, color:txt}}>
                {m.nom} {m.prenom}
                {m.instructeur && <span style={{fontSize:11, background:'#e3f2fd', color:'#1565c0', borderRadius:6, padding:'2px 6px', marginLeft:6}}>Instructeur</span>}
              </div>
              <div style={{fontSize:12, color:muted}}>Initiales: {m.initiales} · Né(e): {m.dob}</div>
            </div>
            <button onClick={() => { remove(ref(db, `members/${m.id}`)); addLog(`Suppression membre: ${m.nom}`); }}
              style={{background:'none', border:'1px solid #ef5350', color:'#ef5350', borderRadius:8, padding:'4px 10px', fontSize:12, cursor:'pointer'}}>
              🗑️
            </button>
          </div>
        ))}
        {members.length===0 && <div style={{padding:24, textAlign:'center', color:muted, fontStyle:'italic'}}>Aucun membre</div>}
      </div>
    </div>
  );
}

function AdminGliders({ gliders, addLog, darkMode, card, border, txt, muted, bg }) {
  const [form, setForm] = useState({modele:'', immat:''});

  const add = () => {
    if (!form.modele || !form.immat) return;
    push(ref(db, "gliders"), form);
    addLog(`Ajout planeur: ${form.modele}_${form.immat}`);
    setForm({modele:'', immat:''});
  };

  return (
    <div>
      <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, padding:20, marginBottom:20}}>
        <div style={{fontWeight:700, fontSize:15, marginBottom:16, color:txt}}>Ajouter un planeur</div>
        <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:12}}>
          {[['modele','Modèle (ex: Discus)'],['immat','Immatriculation (ex: F-CXYZ)']].map(([k,l]) => (
            <div key={k} style={{flex:'1 1 160px'}}>
              <label style={{fontSize:12, color:muted, display:'block', marginBottom:4}}>{l}</label>
              <input value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
                style={{width:'100%', padding:'8px 10px', border:`1px solid ${border}`, borderRadius:8, background:bg, color:txt, fontSize:14, boxSizing:'border-box'}} />
            </div>
          ))}
        </div>
        <button onClick={add} style={{padding:'10px 20px', background:'#1a6b3c', color:'#fff', border:'none', borderRadius:10, fontWeight:600, cursor:'pointer'}}>
          + Ajouter
        </button>
      </div>
      <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, overflow:'hidden'}}>
        {gliders.map((g,i) => (
          <div key={g.id} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
            borderBottom:i<gliders.length-1?`1px solid ${border}`:'none'}}>
            <div style={{fontSize:28}}>🛩️</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, fontSize:15, color:txt}}>{g.modele}_{g.immat}</div>
            </div>
            <button onClick={() => { remove(ref(db, `gliders/${g.id}`)); addLog(`Suppression planeur: ${g.modele}`); }}
              style={{background:'none', border:'1px solid #ef5350', color:'#ef5350', borderRadius:8, padding:'4px 10px', fontSize:12, cursor:'pointer'}}>
              🗑️
            </button>
          </div>
        ))}
        {gliders.length===0 && <div style={{padding:24, textAlign:'center', color:muted, fontStyle:'italic'}}>Aucun planeur</div>}
      </div>
    </div>
  );
}

function AdminRights({ members, gliders, rights, addLog, darkMode, card, border, txt, muted }) {
  const toggle = (memberId, gliderId) => {
    const cur     = rights[memberId] || [];
    const updated = cur.includes(gliderId) ? cur.filter(x => x !== gliderId) : [...cur, gliderId];
    set(ref(db, `rights/${memberId}`), updated);
    addLog(`Droits: ${memberId} / ${gliderId}`);
  };

  return (
    <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, overflow:'auto'}}>
      <table style={{width:'100%', borderCollapse:'collapse', minWidth:400}}>
        <thead>
          <tr style={{background:darkMode?'#2c2f2c':'#f7faf7'}}>
            <th style={{padding:'12px 16px', textAlign:'left', fontSize:13, fontWeight:700, color:txt, borderBottom:`1px solid ${border}`}}>Membre</th>
            {gliders.map(g => (
              <th key={g.id} style={{padding:'12px 10px', textAlign:'center', fontSize:12, fontWeight:600, color:muted, borderBottom:`1px solid ${border}`, minWidth:80}}>
                {g.modele}<br/><span style={{fontSize:10}}>{g.immat}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m,i) => (
            <tr key={m.id} style={{borderBottom:i<members.length-1?`1px solid ${border}`:'none'}}>
              <td style={{padding:'10px 16px', fontSize:13, fontWeight:600, color:txt, whiteSpace:'nowrap'}}>
                {m.initiales} — {m.prenom} {m.nom}
              </td>
              {gliders.map(g => {
                const has = (rights[m.id]||[]).includes(g.id);
                return (
                  <td key={g.id} style={{textAlign:'center', padding:'8px'}}>
                    <button onClick={() => toggle(m.id, g.id)}
                      style={{width:36, height:36, border:'none', borderRadius:8, cursor:'pointer', fontSize:18,
                        background:has ? '#e8f5e9' : darkMode?'#2a2c2a':'#f5f5f5', transition:'all .15s'}}>
                      {has ? '✅' : '⬜'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminReservations({ reservations, members, gliders, waitlist, addLog, darkMode, card, border, txt, muted, bg }) {
  const [promoted, setPromoted] = useState(null);
  const sorted     = [...reservations].sort((a,b) => b.ts - a.ts);
  const sortedWait = [...waitlist].sort((a,b) => a.ts - b.ts);

  const handleAdminDelete = (resId) => {
    const cancelled   = reservations.find(x => x.id === resId);
    const waitForSlot = waitlist
      .filter(w => w.gliderId === cancelled.gliderId && w.date === cancelled.date)
      .sort((a, b) => a.ts - b.ts);
    if (waitForSlot.length > 0) {
      const first = waitForSlot[0];
      const pm    = members.find(m => m.id === first.memberId);
      const pg    = gliders.find(g => g.id === first.gliderId);
      remove(ref(db, `reservations/${resId}`));
      push(ref(db, "reservations"), {
        memberId: first.memberId, gliderId: first.gliderId, date: first.date,
        type: cancelled.type, debut: cancelled.debut, fin: cancelled.fin,
        commentaire: null, ts: Date.now(),
      });
      remove(ref(db, `waitlist/${first.id}`));
      addLog(`Admin annulation ${resId} → promotion: ${first.memberId}`);
      setPromoted({ memberName:`${pm?.prenom} ${pm?.nom}`, gliderName:`${pg?.modele}_${pg?.immat}` });
      setTimeout(() => setPromoted(null), 5000);
    } else {
      remove(ref(db, `reservations/${resId}`));
      addLog(`Admin suppression rés ${resId}`);
    }
  };

  return (
    <div>
      {promoted && (
        <div style={{background:'#e8f5e9', border:'1px solid #43a047', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10}}>
          <span style={{fontSize:20}}>🎉</span>
          <div>
            <div style={{fontWeight:700, fontSize:13, color:'#1b5e20'}}>Liste d'attente promue !</div>
            <div style={{fontSize:13, color:'#2e7d32'}}><strong>{promoted.memberName}</strong> → <strong>{promoted.gliderName}</strong></div>
          </div>
        </div>
      )}
      <div style={{background:card, borderRadius:14, border:`1px solid ${border}`, marginBottom:20}}>
        <div style={{padding:'16px 20px', borderBottom:`1px solid ${border}`, fontWeight:700, fontSize:15, color:txt}}>
          Toutes les réservations ({reservations.length})
        </div>
        {sorted.map((r,i) => {
          const m = members.find(x => x.id === r.memberId);
          const g = gliders.find(x => x.id === r.gliderId);
          return (
            <div key={r.id} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
              borderBottom:i<sorted.length-1?`1px solid ${border}`:'none', background:i%2===0?'transparent':bg}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600, fontSize:14, color:txt}}>{m?.initiales} · {g?.modele}_{g?.immat}</div>
                <div style={{fontSize:12, color:muted}}>{r.date} · {r.type==='day'?'Journée':`${r.debut}→${r.fin}`}</div>
              </div>
              <button onClick={() => handleAdminDelete(r.id)}
                style={{background:'none', border:'1px solid #ef5350', color:'#ef5350', borderRadius:8, padding:'4px 10px', fontSize:12, cursor:'pointer'}}>
                🗑️
              </button>
            </div>
          );
        })}
        {sorted.length===0 && <div style={{padding:24, textAlign:'center', color:muted, fontStyle:'italic'}}>Aucune réservation</div>}
      </div>
      {sortedWait.length > 0 && (
        <div style={{background:card, borderRadius:14, border:`1px solid ${border}`}}>
          <div style={{padding:'16px 20px', borderBottom:`1px solid ${border}`, fontWeight:700, fontSize:15, color:txt}}>
            Listes d'attente ({sortedWait.length})
          </div>
          {sortedWait.map((w,i) => {
            const m = members.find(x => x.id === w.memberId);
            const g = gliders.find(x => x.id === w.gliderId);
            return (
              <div key={w.id} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 20px',
                borderBottom:i<sortedWait.length-1?`1px solid ${border}`:'none'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14, color:txt}}>{m?.initiales} · {g?.modele}_{g?.immat}</div>
                  <div style={{fontSize:12, color:muted}}>{w.date} · {new Date(w.ts).toLocaleString('fr-FR')}</div>
                </div>
                <button onClick={() => remove(ref(db, `waitlist/${w.id}`))}
                  style={{background:'none', border:'1px solid #ef5350', color:'#ef5350', borderRadius:8, padding:'4px 10px', fontSize:12, cursor:'pointer'}}>
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
