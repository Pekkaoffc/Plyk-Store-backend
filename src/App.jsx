import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";

// ── SHA-256 (frontend) ────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

const HASH_PIN  = "76ced5b53829bb4ca8ab376be09683e92512ef0aab8fb68fcee5121596f94143";
const HASH_PASS = "8e03bd0fac273783b443ceff78b9dd612e853508223751b3b1f49b9a50f1cc00";

const fmt = (n) => "Rp " + Number(n).toLocaleString("id-ID");
const finalPrice = (p) => p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
const MAX_FAIL = 3;
const LOCK_MS  = 5 * 60 * 1000;

// ── CSS ───────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@700;900&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html,body,#root { min-height:100vh; }
  body { background:#050508; }
  ::-webkit-scrollbar { width:6px; }
  ::-webkit-scrollbar-track { background:#0a0a0f; }
  ::-webkit-scrollbar-thumb { background:#ff003c; border-radius:3px; }

  @keyframes flicker{0%,100%{opacity:1}93%{opacity:.75}97%{opacity:.85}}
  @keyframes glitch{0%,100%{text-shadow:2px 0 #ff003c,-2px 0 #00f0ff}25%{text-shadow:-2px 0 #ff003c,2px 0 #00f0ff}50%{text-shadow:2px 2px #ff003c,-2px -2px #00f0ff}}
  @keyframes scanline{from{transform:translateY(-100%)}to{transform:translateY(100vh)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
  @keyframes pinPop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}

  .app{font-family:'Rajdhani',sans-serif;min-height:100vh;background:#050508;color:#fff;overflow-x:hidden}
  .scanline{position:fixed;top:0;left:0;width:100%;height:2px;background:linear-gradient(transparent,rgba(255,0,60,.04),transparent);animation:scanline 8s linear infinite;pointer-events:none;z-index:9999}

  /* NAV */
  .navbar{background:rgba(5,5,8,.95);border-bottom:1px solid #ff003c33;backdrop-filter:blur(12px);position:sticky;top:0;z-index:100;padding:0 24px}
  .nav-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;height:62px;gap:8px}
  .logo-btn{background:none;border:none;cursor:pointer;font-family:'Orbitron',monospace;font-size:22px;font-weight:900;color:#ff003c;animation:flicker 4s infinite;letter-spacing:2px;padding:4px 8px;border-radius:6px;transition:background .2s;user-select:none}
  .logo-btn span{color:#fff}
  .nav-spacer{flex:1}
  .nav-btn{background:none;border:1px solid #ff003c33;color:#ff003c88;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;padding:7px 16px;border-radius:6px;cursor:pointer;transition:all .2s;letter-spacing:1px}
  .nav-btn:hover,.nav-btn.active{background:#ff003c22;border-color:#ff003c;color:#ff003c;box-shadow:0 0 12px #ff003c33}

  /* HERO */
  .hero{text-align:center;padding:56px 24px 40px;position:relative}
  .hero::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:600px;height:300px;background:radial-gradient(ellipse,#ff003c18 0%,transparent 70%);pointer-events:none}
  .hero-title{font-family:'Orbitron',monospace;font-size:clamp(32px,6vw,58px);font-weight:900;animation:glitch 6s infinite;letter-spacing:4px;line-height:1.1;margin-bottom:12px}
  .hero-sub{color:#ff003c99;font-size:16px;letter-spacing:3px;text-transform:uppercase;font-weight:600}

  /* FILTER BAR */
  .filter-bar{max-width:1100px;margin:0 auto;padding:0 20px 24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .filter-chip{background:#0a0a12;border:1px solid #ff003c22;color:#ffffff88;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;padding:7px 16px;border-radius:20px;cursor:pointer;transition:all .2s;letter-spacing:.5px}
  .filter-chip:hover,.filter-chip.active{background:#ff003c22;border-color:#ff003c;color:#ff003c;box-shadow:0 0 10px #ff003c22}
  .stock-select{background:#0a0a12;border:1px solid #ff003c22;color:#ffffff88;font-family:'Rajdhani',sans-serif;font-size:13px;padding:7px 14px;border-radius:20px;cursor:pointer;outline:none}
  .stock-select:focus{border-color:#ff003c;color:#ff003c}

  /* PRODUCTS */
  .section-wrap{max-width:1100px;margin:0 auto;padding:0 20px 60px}
  .section-title{font-family:'Orbitron',monospace;font-size:14px;color:#ff003c;letter-spacing:3px;text-transform:uppercase;margin-bottom:24px;display:flex;align-items:center;gap:10px}
  .section-title::after{content:'';flex:1;height:1px;background:linear-gradient(to right,#ff003c44,transparent)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}

  .prod-card{background:linear-gradient(145deg,#0d0d14,#080810);border:1px solid #ff003c33;border-radius:14px;overflow:hidden;transition:all .25s;animation:fadeUp .4s ease both;position:relative}
  .prod-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,#ff003c08 0%,transparent 50%);pointer-events:none}
  .prod-card:hover{border-color:#ff003c;box-shadow:0 0 20px #ff003c33,0 0 60px #ff003c11;transform:translateY(-4px)}
  .prod-card.out-of-stock{opacity:.6;filter:grayscale(.5)}

  .card-img-wrap{width:100%;height:160px;background:#0a0a12;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
  .card-img-wrap::after{content:'';position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(transparent,#0d0d14)}
  .card-img{width:90px;height:90px;object-fit:contain;filter:drop-shadow(0 0 12px #ff003c66)}
  .card-body{padding:16px 18px 18px}
  .card-name{font-size:17px;font-weight:700;color:#fff;margin-bottom:6px;line-height:1.3}
  .card-cat{font-size:11px;font-weight:700;color:#ff003c;background:#ff003c18;padding:2px 8px;border-radius:6px;display:inline-block;margin-bottom:8px;letter-spacing:.5px}
  .card-price-row{display:flex;align-items:center;gap:10px;margin-bottom:4px}
  .card-price{font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:#ff003c}
  .card-original{font-size:13px;color:#ffffff44;text-decoration:line-through}
  .card-discount{background:#ff003c;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px}
  .card-stock{font-size:12px;font-weight:700;letter-spacing:1px;margin-bottom:14px;display:flex;align-items:center;gap:5px}
  .stock-ready{color:#00ff88} .stock-habis{color:#ff4444} .stock-pre{color:#ffbb00}

  .btn-wa{background:linear-gradient(135deg,#25d366,#128c3e);border:none;color:#fff;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;padding:10px 16px;border-radius:8px;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:1px;transition:all .2s;text-transform:uppercase}
  .btn-wa:hover{filter:brightness(1.15);transform:translateY(-1px);box-shadow:0 4px 20px #25d36644}
  .btn-tg{background:linear-gradient(135deg,#2aabee,#1a7ab5);border:none;color:#fff;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;padding:10px 16px;border-radius:8px;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:1px;transition:all .2s;text-transform:uppercase}
  .btn-tg:hover{filter:brightness(1.15);transform:translateY(-1px);box-shadow:0 4px 20px #2aabee44}
  .btn-disabled{background:#1a1a22;border:none;color:#ffffff33;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;padding:10px 16px;border-radius:8px;width:100%;cursor:not-allowed;letter-spacing:1px;text-transform:uppercase}

  /* MODAL */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);backdrop-filter:blur(8px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
  .modal{background:#0a0a12;border:1px solid #ff003c55;border-radius:16px;width:100%;max-width:440px;overflow:hidden}
  .modal-lg{max-width:500px;max-height:90vh;overflow-y:auto}
  .modal-head{background:linear-gradient(135deg,#ff003c22,transparent);border-bottom:1px solid #ff003c33;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0}
  .modal-title{font-family:'Orbitron',monospace;font-size:14px;color:#ff003c;letter-spacing:2px}
  .modal-body{padding:26px 22px}
  .close-btn{background:none;border:none;color:#ff003c;font-size:24px;cursor:pointer;line-height:1}

  /* PIN */
  .pin-dots{display:flex;gap:14px;justify-content:center;margin:22px 0}
  .pin-dot{width:18px;height:18px;border-radius:50%;border:2px solid #ff003c55;background:transparent;transition:all .2s}
  .pin-dot.filled{background:#ff003c;border-color:#ff003c;box-shadow:0 0 10px #ff003c88;animation:pinPop .2s ease}
  .numpad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:260px;margin:0 auto}
  .num-btn{background:#0f0f1a;border:1px solid #ff003c22;color:#fff;font-family:'Orbitron',monospace;font-size:18px;font-weight:700;padding:16px;border-radius:10px;cursor:pointer;transition:all .15s;user-select:none}
  .num-btn:hover{background:#ff003c22;border-color:#ff003c;box-shadow:0 0 12px #ff003c33}
  .num-btn:active{transform:scale(.93)}

  /* FORM */
  .label{font-size:12px;color:#ff003c99;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .field{width:100%;background:#050508;border:1px solid #ff003c33;border-radius:8px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:15px;padding:10px 14px;outline:none;transition:border .2s}
  .field:focus{border-color:#ff003c;box-shadow:0 0 10px #ff003c22}
  .field-row{margin-bottom:14px}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}

  .btn-red{background:linear-gradient(135deg,#ff003c,#cc0030);border:none;color:#fff;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;padding:11px 22px;border-radius:8px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;transition:all .2s}
  .btn-red:hover{filter:brightness(1.15);box-shadow:0 0 20px #ff003c66}
  .btn-red:disabled{opacity:.4;cursor:not-allowed;filter:none}
  .btn-ghost{background:transparent;border:1px solid #ff003c44;color:#ff003c;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;transition:all .2s}
  .btn-ghost:hover{background:#ff003c22;border-color:#ff003c}

  .err-msg{background:#ff003c18;border:1px solid #ff003c44;border-radius:8px;padding:10px 14px;color:#ff003c;font-size:13px;font-weight:600;margin-bottom:14px}
  .err-msg.shake{animation:shake .4s ease}
  .attempt-dots{display:flex;gap:6px;justify-content:center;margin-top:12px}
  .attempt-dot{width:10px;height:10px;border-radius:50%;background:#ff003c22;border:1px solid #ff003c44;transition:all .3s}
  .attempt-dot.used{background:#ff003c;border-color:#ff003c;box-shadow:0 0 8px #ff003c}
  .lockout-bar{height:4px;background:#ff003c22;border-radius:2px;overflow:hidden;margin-top:12px}
  .lockout-fill{height:100%;background:#ff003c;border-radius:2px;transition:width .5s linear}

  /* ADMIN */
  .admin-wrap{max-width:1100px;margin:0 auto;padding:36px 20px 60px}
  .admin-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:12px}
  .panel-card{background:#0a0a12;border:1px solid #ff003c22;border-radius:12px;overflow:hidden}
  .panel-table{width:100%;border-collapse:collapse}
  .panel-table th{background:#ff003c11;padding:12px 14px;text-align:left;font-size:11px;color:#ff003c;text-transform:uppercase;letter-spacing:1.5px;font-family:'Rajdhani',sans-serif;font-weight:700}
  .panel-table td{padding:13px 14px;border-top:1px solid #ff003c0f;font-size:13px;vertical-align:middle}
  .panel-table tr:hover td{background:#ff003c08}
  .btn-edit{background:#ff003c22;border:1px solid #ff003c44;color:#ff003c;font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer;transition:all .2s}
  .btn-edit:hover{background:#ff003c;color:#fff}
  .btn-del{background:#1a0008;border:1px solid #ff003c33;color:#ff003c88;font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer;transition:all .2s}
  .btn-del:hover{background:#ff003c;color:#fff}

  .stock-badge-ready{background:#00ff8822;color:#00ff88;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px}
  .stock-badge-habis{background:#ff444422;color:#ff4444;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px}
  .stock-badge-pre{background:#ffbb0022;color:#ffbb00;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px}

  .spinner{width:32px;height:32px;border:3px solid #ff003c22;border-top:3px solid #ff003c;border-radius:50%;animation:spin 1s linear infinite;margin:40px auto}

  .neon-divider{height:1px;background:linear-gradient(to right,transparent,#ff003c44,transparent);margin:40px 0}
  .footer{border-top:1px solid #ff003c22;padding:24px;text-align:center;font-size:13px;color:#ffffff22;letter-spacing:1px}

  @media(max-width:640px){
    .grid{grid-template-columns:1fr}
    .grid-2{grid-template-columns:1fr}
    .panel-table{font-size:12px}
    .panel-table td,.panel-table th{padding:9px 8px}
  }
`;

// ── ICONS ────────────────────────────────────────────────────────────
const WaIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.117 1.532 5.845L.06 23.617a.5.5 0 00.613.613l5.772-1.472A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.656-.502-5.183-1.381l-.371-.217-3.847.98.997-3.765-.229-.385A9.943 9.943 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>;
const TgIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.16 14.47l-2.96-.924c-.643-.204-.658-.643.136-.953l11.57-4.461c.537-.194 1.006.131.988.089z"/></svg>;

// ── LOCK HOOK ─────────────────────────────────────────────────────────
function useLock() {
  const [fails, setFails]     = useState(0);
  const [until, setUntil]     = useState(null);
  const [remain, setRemain]   = useState(0);
  useEffect(() => {
    if (!until) return;
    const iv = setInterval(() => {
      const left = until - Date.now();
      if (left <= 0) { setUntil(null); setFails(0); setRemain(0); }
      else setRemain(left);
    }, 500);
    return () => clearInterval(iv);
  }, [until]);
  const fail = () => { const n = fails+1; setFails(n); if(n>=MAX_FAIL) setUntil(Date.now()+LOCK_MS); return n; };
  const reset = () => { setFails(0); setUntil(null); };
  return { fails, isLocked: !!until, pct: until?(remain/LOCK_MS)*100:0, mins: Math.ceil(remain/60000), fail, reset };
}

// ── PIN MODAL ─────────────────────────────────────────────────────────
function PinModal({ onOk, onClose }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const lock = useLock();
  const PIN_LEN = 4;

  const boom = (msg) => { setErr(msg); setShake(true); setTimeout(()=>setShake(false),400); setPin(""); };

  const press = useCallback(async (n) => {
    if (lock.isLocked) return;
    const next = pin + n;
    setPin(next);
    if (next.length === PIN_LEN) {
      const h = await sha256(next);
      if (h === HASH_PIN) { lock.reset(); onOk(); }
      else {
        const a = lock.fail();
        boom(a >= MAX_FAIL ? "Terkunci 5 menit!" : `PIN salah! Sisa: ${MAX_FAIL-a}x`);
      }
    }
  }, [pin, lock]);

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head"><span className="modal-title">🔐 VERIFIKASI PIN</span></div>
        <div className="modal-body">
          {lock.isLocked ? (
            <div style={{textAlign:"center",padding:"10px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>🔒</div>
              <div style={{color:"#ff003c",fontWeight:700,marginBottom:6}}>Akses Dikunci {lock.mins} menit</div>
              <div className="lockout-bar"><div className="lockout-fill" style={{width:`${lock.pct}%`}}/></div>
              <button className="btn-ghost" style={{marginTop:20,width:"100%"}} onClick={onClose}>Tutup</button>
            </div>
          ) : (
            <>
              <div style={{textAlign:"center",fontSize:13,color:"#ffffff55",marginBottom:4}}>Klik logo 5× untuk akses ini</div>
              <div className="pin-dots">{Array.from({length:PIN_LEN}).map((_,i)=><div key={i} className={`pin-dot${i<pin.length?" filled":""}`}/>)}</div>
              {err && <div className={`err-msg${shake?" shake":""}`}>⚠ {err}</div>}
              <div className="numpad">
                {[1,2,3,4,5,6,7,8,9].map(n=><button key={n} className="num-btn" onClick={()=>press(String(n))}>{n}</button>)}
                <button className="num-btn" style={{fontSize:13}} onClick={()=>{setPin(p=>p.slice(0,-1));setErr("");}}>⌫</button>
                <button className="num-btn" style={{gridColumn:2}} onClick={()=>press("0")}>0</button>
                <button className="num-btn" style={{fontSize:11,color:"#ff003c88"}} onClick={onClose}>✕</button>
              </div>
              <div className="attempt-dots">{Array.from({length:MAX_FAIL}).map((_,i)=><div key={i} className={`attempt-dot${i<lock.fails?" used":""}`}/>)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PASSWORD MODAL ────────────────────────────────────────────────────
function PassModal({ onOk, onBack }) {
  const [pass, setPass] = useState("");
  const [err, setErr]   = useState("");
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const lock = useLock();

  const boom = (msg) => { setErr(msg); setShake(true); setTimeout(()=>setShake(false),400); setPass(""); };

  const submit = async () => {
    if (!pass || lock.isLocked || loading) return;
    setLoading(true);
    try {
      // Try backend first, fallback to local hash
      const res = await api.login(pass);
      if (res.token) { onOk(res.token); return; }
      // fallback: local verify
      const h = await sha256(pass);
      if (h === HASH_PASS) { onOk("local-admin-token"); return; }
      boom(res.error || "Password salah!");
      lock.fail();
    } catch {
      // offline fallback
      const h = await sha256(pass);
      if (h === HASH_PASS) { onOk("local-admin-token"); }
      else { boom("Password salah!"); lock.fail(); }
    } finally { setLoading(false); }
  };

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">🛡️ PASSWORD ADMIN</span>
          <span style={{fontSize:11,color:"#00ff88",background:"#00ff8822",padding:"3px 10px",borderRadius:20}}>PIN ✓</span>
        </div>
        <div className="modal-body">
          {lock.isLocked ? (
            <div style={{textAlign:"center",padding:"10px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>🔒</div>
              <div style={{color:"#ff003c",fontWeight:700,marginBottom:6}}>Dikunci {lock.mins} menit</div>
              <div className="lockout-bar"><div className="lockout-fill" style={{width:`${lock.pct}%`}}/></div>
              <button className="btn-ghost" style={{marginTop:20,width:"100%"}} onClick={onBack}>← Kembali</button>
            </div>
          ) : (
            <>
              {err && <div className={`err-msg${shake?" shake":""}`}>⚠ {err}</div>}
              <div className="field-row">
                <div className="label">Password</div>
                <div style={{position:"relative"}}>
                  <input className="field" type={show?"text":"password"} placeholder="••••••••••" value={pass}
                    onChange={e=>{setPass(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&submit()} autoFocus style={{paddingRight:44}}/>
                  <button onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#ff003c88",cursor:"pointer",fontSize:16}}>{show?"🙈":"👁"}</button>
                </div>
              </div>
              <div className="attempt-dots" style={{marginBottom:14}}>{Array.from({length:MAX_FAIL}).map((_,i)=><div key={i} className={`attempt-dot${i<lock.fails?" used":""}`}/>)}</div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn-red" onClick={submit} disabled={!pass||loading} style={{flex:1}}>{loading?"...":"Masuk →"}</button>
                <button className="btn-ghost" onClick={onBack}>← PIN</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PRODUCT FORM ──────────────────────────────────────────────────────
function ProdForm({ initial, onSave, onCancel, title }) {
  const blank = { name:"", category:"", price:"", discount:"", stock:"Ready", contact:"", contactType:"whatsapp", image:"" };
  const [f, setF] = useState(initial ? {...initial, price:String(initial.price), discount:String(initial.discount)} : blank);
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <div className="field-row"><div className="label">Nama Produk *</div><input className="field" placeholder="Akun ML Sultan" value={f.name} onChange={e=>set("name",e.target.value)}/></div>
          <div className="field-row"><div className="label">Kategori</div><input className="field" placeholder="Mobile Legends, Voucher, Streaming..." value={f.category} onChange={e=>set("category",e.target.value)}/></div>
          <div className="grid-2">
            <div className="field-row"><div className="label">Harga (Rp) *</div><input className="field" type="number" placeholder="150000" value={f.price} onChange={e=>set("price",e.target.value)}/></div>
            <div className="field-row"><div className="label">Diskon (%)</div><input className="field" type="number" placeholder="0" min="0" max="100" value={f.discount} onChange={e=>set("discount",e.target.value)}/></div>
          </div>
          <div className="field-row"><div className="label">Stok</div>
            <select className="field" value={f.stock} onChange={e=>set("stock",e.target.value)}>
              <option value="Ready">Ready</option>
              <option value="Habis">Habis</option>
              <option value="Pre-order">Pre-order</option>
            </select>
          </div>
          <div className="field-row"><div className="label">Kirim Order Via</div>
            <select className="field" value={f.contactType} onChange={e=>set("contactType",e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
          <div className="field-row"><div className="label">Nomor {f.contactType==="whatsapp"?"WhatsApp":"Telegram"} *</div><input className="field" placeholder="628123456789" value={f.contact} onChange={e=>set("contact",e.target.value)}/></div>
          <div className="field-row"><div className="label">URL Foto</div><input className="field" placeholder="https://..." value={f.image} onChange={e=>set("image",e.target.value)}/>
            {f.image && <img src={f.image} alt="" style={{maxHeight:64,maxWidth:"100%",objectFit:"contain",marginTop:8,borderRadius:8,border:"1px solid #ff003c22"}} onError={e=>e.target.style.display="none"}/>}
          </div>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button className="btn-red" style={{flex:1}} onClick={()=>{
              if(!f.name.trim()||!f.price||!f.contact.trim()){alert("Nama, Harga & Nomor wajib diisi!");return;}
              onSave({...f,price:Number(f.price),discount:Number(f.discount)||0});
            }}>💾 Simpan</button>
            <button className="btn-ghost" onClick={onCancel}>Batal</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STOCK BADGE ───────────────────────────────────────────────────────
const StockBadge = ({s}) => {
  if (s==="Habis")    return <span className="stock-badge-habis">Habis</span>;
  if (s==="Pre-order") return <span className="stock-badge-pre">Pre-order</span>;
  return <span className="stock-badge-ready">Ready</span>;
};

// ── MAIN APP ──────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]         = useState("store");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["Semua"]);
  const [cat, setCat]           = useState("Semua");
  const [stockFilter, setStock] = useState("Semua");
  const [loading, setLoading]   = useState(true);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [token, setToken]       = useState("");
  const [authStep, setAuthStep] = useState(null);
  const [logoClicks, setLogoClicks] = useState(0);
  const clickTimer = useRef(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [adminTab, setAdminTab] = useState("products");

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (cat !== "Semua") params.category = cat;
      if (stockFilter !== "Semua") params.stock = stockFilter;
      const data = await api.getProducts(params);
      setProducts(Array.isArray(data) ? data : []);
    } catch { setProducts([]); }
    setLoading(false);
  }, [cat, stockFilter]);

  const loadCategories = async () => {
    try { const c = await api.getCategories(); setCategories(c); } catch {}
  };

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadCategories(); }, []);

  // Logo 5x click secret
  const onLogo = () => {
    const n = logoClicks + 1; setLogoClicks(n);
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setLogoClicks(0), 2000);
    if (n >= 5) { setLogoClicks(0); if (!isAdmin) setAuthStep("pin"); }
  };

  const logout = async () => {
    try { await api.logout(token); } catch {}
    setIsAdmin(false); setToken(""); setPage("store");
  };

  // Admin CRUD
  const addProd = async (data) => {
    const res = await api.addProduct(data, token);
    if (res.id) { await loadProducts(); await loadCategories(); setShowAdd(false); }
    else alert(res.error || "Gagal tambah produk");
  };
  const editSave = async (data) => {
    const res = await api.editProduct(editProd.id, data, token);
    if (res.id) { await loadProducts(); await loadCategories(); setEditProd(null); }
    else alert(res.error || "Gagal edit produk");
  };
  const delProd = async (id) => {
    if (!window.confirm("Hapus produk ini?")) return;
    await api.delProduct(id, token);
    await loadProducts(); await loadCategories();
  };

  const orderLink = (p) => {
    const msg = encodeURIComponent(`Halo kak, mau order:\n\n*${p.name}*\nHarga: ${fmt(finalPrice(p))}\n\nMohon konfirmasinya ya, makasih! 🙏`);
    return p.contactType==="telegram"
      ? `https://t.me/${p.contact.replace(/^@/,"")}?text=${msg}`
      : `https://wa.me/${p.contact.replace(/\D/g,"")}?text=${msg}`;
  };

  const stockClass = (s) => s==="Habis"?"stock-habis":s==="Pre-order"?"stock-pre":"stock-ready";
  const stockDot   = (s) => s==="Habis"?"✕":s==="Pre-order"?"⏳":"●";

  return (
    <div className="app">
      <style>{css}</style>
      <div className="scanline"/>

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-inner">
          <button className="logo-btn" onClick={onLogo}>PLYK<span> STORE</span></button>
          <div className="nav-spacer"/>
          <button className={`nav-btn${page==="store"?" active":""}`} onClick={()=>setPage("store")}>🏪 Store</button>
          {isAdmin && <>
            <button className={`nav-btn${page==="admin"?" active":""}`} onClick={()=>setPage("admin")}>⚙️ Panel</button>
            <button className="nav-btn" onClick={logout}>🚪 Logout</button>
          </>}
        </div>
      </nav>

      {/* ── STORE ── */}
      {page==="store" && (
        <>
          <div className="hero">
            <h1 className="hero-title">PLYK STORE</h1>
            <p className="hero-sub">⚡ Digital Products — Fast & Trusted ⚡</p>
          </div>

          {/* FILTER */}
          <div className="filter-bar">
            {categories.map(c=>(
              <button key={c} className={`filter-chip${cat===c?" active":""}`} onClick={()=>setCat(c)}>{c}</button>
            ))}
            <select className="stock-select" value={stockFilter} onChange={e=>setStock(e.target.value)}>
              {["Semua","Ready","Habis","Pre-order"].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="section-wrap">
            <div className="section-title">// {cat==="Semua"?"Semua Produk":cat} {stockFilter!=="Semua"?`— ${stockFilter}`:""}</div>
            {loading ? <div className="spinner"/> : products.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 0",color:"#ff003c44"}}>
                <div style={{fontSize:48,marginBottom:12}}>📦</div>
                <div style={{fontFamily:"Orbitron",fontSize:14,letterSpacing:2}}>Tidak ada produk</div>
              </div>
            ) : (
              <div className="grid">
                {products.map((p,i)=>(
                  <div key={p.id} className={`prod-card${p.stock==="Habis"?" out-of-stock":""}`} style={{animationDelay:`${i*.06}s`}}>
                    <div className="card-img-wrap">
                      {p.image ? <img src={p.image} alt={p.name} className="card-img" onError={e=>e.target.style.display="none"}/> : <span style={{fontSize:48}}>🎮</span>}
                    </div>
                    <div className="card-body">
                      <div className="card-cat">{p.category}</div>
                      <div className="card-name">{p.name}</div>
                      <div className="card-price-row">
                        <span className="card-price">{fmt(finalPrice(p))}</span>
                        {p.discount>0 && <><span className="card-original">{fmt(p.price)}</span><span className="card-discount">-{p.discount}%</span></>}
                      </div>
                      <div className={`card-stock ${stockClass(p.stock)}`}>{stockDot(p.stock)} {p.stock}</div>
                      {p.stock==="Habis" ? (
                        <button className="btn-disabled">Stok Habis</button>
                      ) : (
                        <a href={orderLink(p)} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                          {p.contactType==="telegram"
                            ? <button className="btn-tg"><TgIcon/> Order via Telegram</button>
                            : <button className="btn-wa"><WaIcon/> Order via WhatsApp</button>}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="neon-divider"/>
          <footer className="footer">© 2026 PLYK STORE — Digital Products Fast & Trusted</footer>
        </>
      )}

      {/* ── ADMIN ── */}
      {page==="admin" && isAdmin && (
        <div className="admin-wrap">
          <div className="admin-topbar">
            <div>
              <div style={{fontFamily:"Orbitron",fontSize:18,color:"#ff003c",letterSpacing:2,marginBottom:4}}>ADMIN PANEL</div>
              <div style={{fontSize:13,color:"#ffffff55"}}>Kelola produk Plyk Store</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              {[["products","💿 Produk"],["stats","📊 Statistik"]].map(([t,l])=>(
                <button key={t} className={`nav-btn${adminTab===t?" active":""}`} onClick={()=>setAdminTab(t)}>{l}</button>
              ))}
            </div>
          </div>

          {adminTab==="products" && (
            <>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
                <button className="btn-red" style={{padding:"10px 22px"}} onClick={()=>setShowAdd(true)}>+ Tambah Produk</button>
              </div>
              <div className="panel-card">
                <div style={{overflowX:"auto"}}>
                  <table className="panel-table">
                    <thead><tr>
                      <th>Foto</th><th>Nama</th><th>Kategori</th><th>Harga</th><th>Diskon</th><th>Stok</th><th>Via</th><th>Aksi</th>
                    </tr></thead>
                    <tbody>
                      {products.length===0 && <tr><td colSpan={8} style={{textAlign:"center",color:"#ff003c44",padding:40}}>Belum ada produk</td></tr>}
                      {products.map(p=>(
                        <tr key={p.id}>
                          <td>{p.image?<img src={p.image} alt="" style={{width:38,height:38,objectFit:"contain",borderRadius:6,background:"#0a0a18"}} onError={e=>e.target.style.display="none"}/>:<span style={{fontSize:24}}>🎮</span>}</td>
                          <td style={{fontWeight:600,maxWidth:140}}>{p.name}</td>
                          <td><span style={{color:"#ff003c88",fontSize:11}}>{p.category}</span></td>
                          <td style={{fontFamily:"Orbitron",color:"#ff003c",fontSize:12}}>{fmt(finalPrice(p))}</td>
                          <td>{p.discount>0?<span className="card-discount">{p.discount}%</span>:<span style={{color:"#ffffff22"}}>—</span>}</td>
                          <td><StockBadge s={p.stock}/></td>
                          <td>{p.contactType==="telegram"?<span style={{color:"#2aabee",fontWeight:700,fontSize:11}}>Telegram</span>:<span style={{color:"#25d366",fontWeight:700,fontSize:11}}>WhatsApp</span>}</td>
                          <td><div style={{display:"flex",gap:6}}>
                            <button className="btn-edit" onClick={()=>setEditProd(p)}>✏️</button>
                            <button className="btn-del" onClick={()=>delProd(p.id)}>🗑</button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {adminTab==="stats" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:16}}>
              {[
                ["💿","Total Produk",products.length,""],
                ["✅","Ready",products.filter(p=>p.stock==="Ready").length,""],
                ["❌","Habis",products.filter(p=>p.stock==="Habis").length,""],
                ["⏳","Pre-order",products.filter(p=>p.stock==="Pre-order").length,""],
                ["🏷️","Kategori",categories.length-1,""],
                ["🔥","Ada Diskon",products.filter(p=>p.discount>0).length,""],
              ].map(([icon,label,val])=>(
                <div key={label} style={{background:"#0a0a12",border:"1px solid #ff003c22",borderRadius:12,padding:"20px 18px"}}>
                  <div style={{fontSize:26,marginBottom:8}}>{icon}</div>
                  <div style={{fontFamily:"Orbitron",fontSize:22,color:"#ff003c",fontWeight:700,marginBottom:4}}>{val}</div>
                  <div style={{fontSize:12,color:"#ffffff55",letterSpacing:1}}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AUTH MODALS */}
      {authStep==="pin" && <PinModal onOk={()=>setAuthStep("password")} onClose={()=>setAuthStep(null)}/>}
      {authStep==="password" && <PassModal onOk={(t)=>{setToken(t);setIsAdmin(true);setAuthStep(null);setPage("admin");}} onBack={()=>setAuthStep("pin")}/>}

      {/* PRODUCT MODALS */}
      {showAdd && <ProdForm title="// TAMBAH PRODUK" onSave={addProd} onCancel={()=>setShowAdd(false)}/>}
      {editProd && <ProdForm title="// EDIT PRODUK" initial={editProd} onSave={editSave} onCancel={()=>setEditProd(null)}/>}
    </div>
  );
}
