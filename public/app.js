
const API='/api';let TOKEN=null,CU=null,MY_STORES=[],ACCS=[],PERMS={},dashFrom=1,dashTo=12,lastFocusedElement=null,backupInProgress=false;
const MO=['ΙΑΝ','ΦΕΒ','ΜΑΡ','ΑΠΡ','ΜΑΪ','ΙΟΥΝ','ΙΟΥΛ','ΑΥΓ','ΣΕΠ','ΟΚΤ','ΝΟΕ','ΔΕΚ'];
const PAGE_LABELS={dashboard:'Dashboard',transactions:'Συναλλαγές',accounts:'Λογαριασμοί',report:'Αναφορά',pnl:'P&L'};

async function $api(path,opts={}){
  const headers={...(opts.headers||{})};
  if(!(opts.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type']='application/json';
  if(TOKEN) headers['Authorization']='Bearer '+TOKEN;
  const r=await fetch(API+path,{...opts,headers,credentials:'same-origin'});
  if(r.status===401){await logout(false);throw new Error('Session expired');}
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Error');
  return d;
}
function fmt(n){return Math.abs(n).toLocaleString('el-GR',{maximumFractionDigits:0})}
function fmtE(n){if(!n)return'-';return(n<0?'-':'')+'€'+fmt(n)}
function toast(m,err){const t=document.createElement('div');t.className='toast'+(err?' err':'');t.textContent=m;document.getElementById('toasts').appendChild(t);setTimeout(()=>t.remove(),3000)}
function closeM(){document.getElementById('modals').innerHTML='';if(lastFocusedElement)lastFocusedElement.focus();}
function canWrite(){return CU.role==='admin'||CU.accessLevel==='full'}
function hasPerm(pg){return CU.role==='admin'||PERMS[pg]===true}
function sSel(id,val,fn,all=false){
  let h=`<div class="ssel"><select id="${id}" onchange="${fn}">`;
  if(all&&CU.role==='admin')h+=`<option value="all" ${val==='all'?'selected':''}>📊 Όλα</option>`;
  MY_STORES.forEach(s=>{h+=`<option value="${s.Id}" ${String(val)===String(s.Id)?'selected':''}>${s.Name}</option>`;});
  return h+'</select></div>';
}
function noAccessHTML(pageName){
  return `<div class="no-access"><div class="lock-big">🔒</div><h2>Δεν έχετε πρόσβαση</h2><p>Η σελίδα «${pageName}» δεν είναι διαθέσιμη για τον λογαριασμό σας.<br>Επικοινωνήστε με τον διαχειριστή για ενεργοποίηση.</p></div>`;
}

// AUTH
function applySession(user){
  TOKEN=null;
  CU=user;
  MY_STORES=CU.stores||[];
  PERMS=CU.permissions||{};
}

async function doLogin(){
  const username=document.getElementById('lu').value.trim();
  const password=document.getElementById('lp').value;
  const btn=document.getElementById('loginBtn');
  try{
    btn.disabled=true;
    btn.textContent='Σύνδεση...';
    const d=await $api('/auth/login',{method:'POST',body:JSON.stringify({username,password})});
    applySession(d.user);
    ACCS=await $api('/accounts');
    document.getElementById('login').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('lerr').style.display='none';
    buildApp();
  }catch(e){
    document.getElementById('lerr').style.display='block';
  }finally{
    btn.disabled=false;
    btn.textContent='Σύνδεση';
  }
}

async function logout(callApi=true){
  try{ if(callApi) await $api('/auth/logout',{method:'POST'}); }catch(e){}
  TOKEN=null;CU=null;MY_STORES=[];PERMS={};
  document.getElementById('app').style.display='none';
  document.getElementById('login').style.display='flex';
  document.getElementById('lp').value='';
  document.getElementById('lerr').style.display='none';
  document.getElementById('modals').innerHTML='';
  document.body.classList.remove('sidebar-open');
}

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('login').style.display!=='none')doLogin();
  if(e.key==='Escape'){
    if(document.getElementById('printPreviewModal')) closePrintPreview();
    else if(document.getElementById('modals').children.length) closeM();
    document.body.classList.remove('sidebar-open');
  }
});

const IC={dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',trans:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',report:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/></svg>',pnl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>',users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',acc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 10h16"/><path d="M10 4v16"/></svg>'};

function buildApp(){
  document.getElementById('uav').textContent=CU.name[0];
  document.getElementById('unm').textContent=CU.name;
  const accessLabel=CU.role==='admin'?'Admin — Όλα':(CU.accessLevel==='readonly'?'Read-Only':'Full Access')+' — '+MY_STORES.map(s=>s.Name).join(', ');
  document.getElementById('url').textContent=accessLabel;

  // Build nav — all 5 pages always visible, locked ones get lock icon
  let h='<div class="nsec">Μενού</div>';
  const navPages=[{id:'dashboard',icon:IC.dash,label:'Dashboard'},{id:'transactions',icon:IC.trans,label:'Συναλλαγές'},{id:'accounts',icon:IC.acc,label:'Λογαριασμοί'},{id:'report',icon:IC.report,label:'Αναφορά'},{id:'pnl',icon:IC.pnl,label:'P&L'}];
  navPages.forEach(pg=>{
    const locked=!hasPerm(pg.id);
    h+=`<button type="button" class="ni nav-btn${locked?' locked':''}" data-p="${pg.id}" data-nav="${pg.id}">${pg.icon}<span>${pg.label}</span>${locked?'<span class="lock-icon">🔒</span>':''}</button>`;
  });
  if(CU.role==='admin'){
    h+='<div class="nsec">Διαχείριση</div>';
    h+=`<button type="button" class="ni nav-btn" data-p="users" data-nav="users">${IC.users}<span>Χρήστες</span></button>`;
    h+=`<button type="button" class="ni nav-btn" data-p="stores" data-nav="stores"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Καταστήματα</span></button>`;
  }
  document.getElementById('nav').innerHTML=h;
  let pg='<div class="page" id="p-dashboard"></div><div class="page" id="p-transactions"></div><div class="page" id="p-accounts"></div><div class="page" id="p-report"></div><div class="page" id="p-pnl"></div>';
  if(CU.role==='admin'){pg+='<div class="page" id="p-users"></div>';pg+='<div class="page" id="p-stores"></div>';}
  document.getElementById('mc').innerHTML=pg;
  // Add backup button for admin
  if(CU.role==='admin'){
    const sftr=document.getElementById('sideFooter');
    if(sftr&&!document.getElementById('backupBtn')){
      const bb=document.createElement('button');bb.id='backupBtn';bb.className='lout';
      bb.style.cssText='margin-top:6px;border-color:var(--acc);color:var(--acc)';
      bb.innerHTML='💾 Backup DB';bb.type='button';bb.addEventListener('click',doBackup);sftr.appendChild(bb);
    }
  }
  nav('dashboard');
}
function nav(p){
  document.body.classList.remove('sidebar-open');
  // Reset transaction search state when leaving transactions page
  if(p!=='transactions'){txQ='';txP=1;txS=null;}
  if(p!=='accounts'){accQ='';}
  document.querySelectorAll('.ni').forEach(el=>el.classList.toggle('act',el.dataset.p===p));
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('act',el.id==='p-'+p));
  ({dashboard:rDash,transactions:rTrans,report:rReport,pnl:rPnl,accounts:rAccounts,users:rUsers,stores:rStores})[p]?.();
}

// ===== DASHBOARD =====
async function rDash(){
  const pg=document.getElementById('p-dashboard');
  if(!hasPerm('dashboard')){pg.innerHTML=noAccessHTML('Dashboard');return;}
  pg.innerHTML='<div class="loading">Φόρτωση...</div>';
  try{
    const d=await $api('/dashboard?year=2026');
    let tR=0,tE=0,mI={};
    d.monthly.forEach(r=>{if(r.Type==='Income'){tR+=r.Total;mI[r.Month]=(mI[r.Month]||0)+r.Total}else{tE+=r.Total}});
    const pr=tR-tE,mg=tR?((pr/tR)*100).toFixed(1):0;
    if(!dashFrom)dashFrom=1;if(!dashTo)dashTo=12;
    // Filter monthly by range
    let filtI=0,filtE=0;
    d.monthly.forEach(r=>{if(r.Month>=dashFrom&&r.Month<=dashTo){if(r.Type==='Income')filtI+=r.Total;else filtE+=r.Total;}});
    const filtP=filtI-filtE,filtMg=filtI?((filtP/filtI)*100).toFixed(1):0;
    const fromOpts=MO.map((m,i)=>'<option value="'+(i+1)+'" '+(i+1===dashFrom?'selected':'')+'>'+m+'</option>').join('');
    const toOpts=MO.map((m,i)=>'<option value="'+(i+1)+'" '+(i+1===dashTo?'selected':'')+'>'+m+'</option>').join('');
    const storeSub=CU.role==='admin'?'Όλα τα Καταστήματα':MY_STORES.map(s=>s.Name).join(', ');
    let h='<div class="phdr"><div><div class="ptitle">Dashboard</div><div class="psub">2026 — '+storeSub+'</div></div>'
      +'<div class="hacts" style="align-items:center;gap:8px">'
      +'<label style="font-size:11px;color:var(--dim)">Από:</label>'
      +'<select id="dashFromSel" onchange="dashFrom=+this.value;rDash()" style="padding:6px 10px;background:var(--bg4);border:1px solid var(--brd);border-radius:var(--r);color:var(--txt);font-size:12px;outline:none">'+fromOpts+'</select>'
      +'<label style="font-size:11px;color:var(--dim)">Έως:</label>'
      +'<select id="dashToSel" onchange="dashTo=+this.value;rDash()" style="padding:6px 10px;background:var(--bg4);border:1px solid var(--brd);border-radius:var(--r);color:var(--txt);font-size:12px;outline:none">'+toOpts+'</select>'
      +'<button class="btn bs bo" onclick="exportPDF(\'Dashboard\')" >🖨 PDF</button>'
      +'<button class="btn bs bo" onclick="exportDashExcel()" style="border-color:var(--grn);color:var(--grn)">📊 Excel</button>'
      
      +'</div></div>';
    h+=`<div class="srow"><div class="scard"><div class="slbl">Έσοδα</div><div class="sval">€${fmt(filtI)}</div></div><div class="scard"><div class="slbl">Έξοδα</div><div class="sval">€${fmt(filtE)}</div></div><div class="scard"><div class="slbl">Κέρδος</div><div class="sval" style="color:${filtP>=0?'var(--grn)':'var(--red)'}">€${fmt(filtP)}</div><div class="schg ${filtP>=0?'pos':'neg'}">${filtMg}%</div></div></div>`;
    let mx=0;for(let m=dashFrom;m<=dashTo;m++){const v=mI[m]||0;if(v>mx)mx=v}
    h+='<div class="tcard"><div class="thdr"><div class="ttl">Μηνιαία Έσοδα</div></div><div class="chart">';
    for(let m=dashFrom;m<=dashTo;m++){const v=mI[m]||0;h+=`<div class="bar" style="height:${mx?(v/mx*200):6}px"><span class="bv">€${fmt(v)}</span><span class="bl">${MO[m-1]}</span></div>`}
    h+='</div></div>';
    if(CU.role==='admin'&&d.perStore.length){const sd={};d.perStore.forEach(r=>{if(r.Month!==undefined&&(r.Month<dashFrom||r.Month>dashTo))return;if(!sd[r.StoreName])sd[r.StoreName]={i:0,e:0};if(r.Type==='Income')sd[r.StoreName].i+=r.Total;else sd[r.StoreName].e+=r.Total});
    h+='<div class="tcard"><div class="thdr"><div class="ttl">Ανά Κατάστημα</div></div><div class="twrap"><table><thead><tr><th>Κατάστημα</th><th>Έσοδα</th><th>Έξοδα</th><th>Κέρδος</th><th>%</th></tr></thead><tbody>';
    let allI=0,allE=0;
    for(const[n,v]of Object.entries(sd)){const p=v.i-v.e;allI+=v.i;allE+=v.e;h+=`<tr><td>${n}</td><td>€${fmt(v.i)}</td><td>€${fmt(v.e)}</td><td class="${p>=0?'p':'n'}">${fmtE(p)}</td><td class="${p>=0?'p':'n'}">${v.i?((p/v.i)*100).toFixed(1):0}%</td></tr>`}
    const allP=allI-allE;
    h+=`<tr class="tot"><td>ΣΥΝΟΛΟ</td><td class="p">€${fmt(allI)}</td><td class="n">€${fmt(allE)}</td><td class="${allP>=0?'p':'n'}">${fmtE(allP)}</td><td class="${allP>=0?'p':'n'}">${allI?((allP/allI)*100).toFixed(1):0}%</td></tr>`;
    h+='</tbody></table></div></div>';
    }
    pg.innerHTML=h;
  }catch(e){pg.innerHTML=`<div class="loading" style="color:var(--red)">${e.message}</div>`}
}

// ===== TRANSACTIONS =====
let txS=null,txP=1,txQ='',txTimer=null,txF='2026-01-01',txT='2026-12-31';
function fmtDate(d){if(!d)return'';const p=d.split('-');if(p.length===3&&p[0].length===4)return`${p[2]}-${p[1]}-${p[0]}`;return d}
function txChangeStore(v){txS=v;txP=1;txQ='';const inp=document.getElementById('txSearch');if(inp)inp.value='';txLoadData();}
async function rTrans(){
  const pg=document.getElementById('p-transactions');
  if(!hasPerm('transactions')){pg.innerHTML=noAccessHTML('Συναλλαγές');return;}
  if(!txS)txS=MY_STORES[0]?.Id;
  if(!document.getElementById('txSearch')){
    const w=canWrite();
    pg.innerHTML=`<div class="phdr"><div><div class="ptitle">Συναλλαγές</div><div class="psub">${w?'Πλήρης πρόσβαση':'Μόνο ανάγνωση'}</div></div><div class="hacts">${sSel('txSS',txS,'txChangeStore(this.value)')}${w?'<button class="btn bs" style="background:var(--grn);color:#000" onclick="showAddTx(\'Income\')">+ Νέο Έσοδο</button><button class="btn bs" style="background:var(--red);color:#fff" onclick="showAddTx(\'Expenses\')">+ Νέο Έξοδο</button>':''}<button class="btn bs bo" onclick="exportPDF(\'Συναλλαγές\')" title="PDF">🖨 PDF</button><button class="btn bs bo" onclick="exportTxExcel()" style="border-color:var(--grn);color:var(--grn)">📊 Excel</button></div></div>
    <div class="tcard"><div class="thdr"><div class="ttl" id="txTotal"></div><div class="tacts" style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap">
    <div class="dr-wrap"><label class="dr-lbl">ΑΠΟ</label><input id="txDateF" type="date" class="dr-inp" value="${txF}" onchange="txF=this.value;txP=1;txLoadData()"></div>
    <div class="dr-wrap"><label class="dr-lbl">ΕΩΣ</label><input id="txDateT" type="date" class="dr-inp" value="${txT}" onchange="txT=this.value;txP=1;txLoadData()"></div>
    <input id="txSearch" type="text" placeholder="🔍 Αναζήτηση..." style="padding:6px 10px;background:var(--bg4);border:1px solid var(--brd);border-radius:var(--r);color:var(--txt);font-size:12px;outline:none;width:180px;align-self:flex-end">
    <span id="txPager" style="align-self:center"></span></div></div><div class="twrap" id="txBody"><div class="loading">Φόρτωση...</div></div></div>`;
    document.getElementById('txSearch').addEventListener('input',function(){
      clearTimeout(txTimer);const v=this.value;
      txTimer=setTimeout(()=>{txQ=v;txP=1;txLoadData()},350);
    });
  }
  txLoadData();
}
async function txLoadData(){
  const w=canWrite();
  try{
    const qParam=txQ?`&search=${encodeURIComponent(txQ)}`:'';
    const d=await $api(`/transactions?storeId=${txS}&page=${txP}&limit=30${qParam}&from=${txF}&to=${txT}`);
    document.getElementById('txTotal').textContent=d.total+' εγγραφές';
    const pg=document.getElementById('txPager');
    pg.innerHTML=d.pages>1?`<button class="btn bs bo" onclick="txP=Math.max(1,txP-1);txLoadData()">◀</button> ${d.page}/${d.pages} <button class="btn bs bo" onclick="txP=Math.min(${d.pages},txP+1);txLoadData()">▶</button>`:'';
    let rows='<table><thead><tr><th>Ημ/νία</th><th>Περιγραφή</th><th>Λογ/μός</th><th>Ποσό</th>'+(w?'<th></th>':'')+'</tr></thead><tbody>';
    d.data.forEach(t=>{const ii=t.AccountType==='Income';
      rows+=`<tr><td>${fmtDate(t.Date)}</td><td>${t.Description||''}</td><td>${t.AccountName}</td><td class="${ii?'p':'n'}">${ii?'+':'-'}€${fmt(t.Amount)}</td>${w?`<td><button class="btn bs bo" onclick="delTx(${t.Id})">✕</button></td>`:''}</tr>`;});
    rows+='</tbody></table>';
    document.getElementById('txBody').innerHTML=rows;
  }catch(e){if(e.message.includes('πρόσβαση')){document.getElementById('p-transactions').innerHTML=noAccessHTML('Συναλλαγές')}else{const b=document.getElementById('txBody');if(b)b.innerHTML=`<div class="loading" style="color:var(--red)">${e.message}</div>`}}
}
function showAddTx(type){
  if(!canWrite()){toast('Έχετε μόνο δικαίωμα ανάγνωσης',true);return}
  const ac=ACCS.filter(a=>!type||a.Type===type).map(a=>`<option value="${a.Id}">${a.Name}</option>`).join('');
  const st=MY_STORES.map(s=>`<option value="${s.Id}">${s.Name}</option>`).join('');
  document.getElementById('modals').innerHTML=`<div class="mov" onclick="if(event.target===this)closeM()"><div class="modal"><h3>Νέα Συναλλαγή</h3>
    <div class="fg"><label>Ημερομηνία</label><input type="date" id="ntD" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="fg"><label>Περιγραφή</label><input type="text" id="ntN"></div>
    <div class="fg"><label>Ποσό</label><input type="number" id="ntA" min="0" step="0.01"></div>
    <div class="fg"><label>Λογαριασμός</label><select id="ntAc">${ac}</select></div>
    <div class="fg"><label>Κατάστημα</label><select id="ntSt">${st}</select></div>
    <div class="macts"><button class="btn bs bo" onclick="closeM()">Ακύρωση</button><button class="btn bs bp" onclick="submitTx()">Καταχώρηση</button></div></div></div>`;
}
async function submitTx(){try{await $api('/transactions',{method:'POST',body:JSON.stringify({date:document.getElementById('ntD').value,description:document.getElementById('ntN').value,amount:parseFloat(document.getElementById('ntA').value)||0,accountId:parseInt(document.getElementById('ntAc').value),storeId:parseInt(document.getElementById('ntSt').value)})});closeM();rTrans();toast('Καταχωρήθηκε!')}catch(e){toast(e.message,true)}}
async function delTx(id){if(!canWrite()){toast('Read-only',true);return}try{await $api('/transactions/'+id,{method:'DELETE'});rTrans()}catch(e){toast(e.message,true)}}

// ===== REPORT =====
let rpS=null,rpF='2026-01-01',rpT='2026-12-31';
async function rReport(){
  const pg=document.getElementById('p-report');
  if(!hasPerm('report')){pg.innerHTML=noAccessHTML('Αναφορά');return;}
  if(!rpS)rpS=MY_STORES[0]?.Id;
  pg.innerHTML='<div class="loading">Φόρτωση...</div>';
  try{
    const d=await $api(`/report?storeId=${rpS}&from=${rpF}&to=${rpT}`);
    let tI=0,tE=0;const ir=d.filter(r=>r.AccountType==='Income'),er=d.filter(r=>r.AccountType==='Expenses');
    ir.forEach(r=>tI+=r.Total);er.forEach(r=>tE+=r.Total);const pr=tI-tE;
    let h=`<div class="phdr"><div><div class="ptitle">Αναφορά</div></div><div class="hacts">${sSel('rpSS',rpS,"rpS=this.value;rReport()")}<button class="btn bs bo" onclick="exportPDF(\'Αναφορά\')">🖨 PDF</button><button class="btn bs bo" onclick="exportReportExcel()" style="border-color:var(--grn);color:var(--grn)">📊 Excel</button></div></div>`;
    h+=`<div style="display:flex;gap:12px;margin-bottom:20px;align-items:end;flex-wrap:wrap"><div class="fg" style="margin:0"><label>Από</label><input type="date" value="${rpF}" onchange="rpF=this.value;rReport()"></div><div class="fg" style="margin:0"><label>Έως</label><input type="date" value="${rpT}" onchange="rpT=this.value;rReport()"></div><div class="scard" style="padding:12px 18px"><div class="slbl">Κέρδος</div><div class="sval" style="font-size:18px;color:${pr>=0?'var(--grn)':'var(--red)'}">€${fmt(pr)}</div></div></div>`;
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
    h+='<div class="tcard"><div class="thdr"><div class="ttl">Έσοδα</div></div><div class="twrap"><table><thead><tr><th>Λογαριασμός</th><th>Ποσό</th></tr></thead><tbody>';
    ir.forEach(r=>{h+=`<tr><td>${r.AccountName}</td><td class="p">€${fmt(r.Total)}</td></tr>`});
    h+=`<tr class="sub"><td>Σύνολο:</td><td class="p">€${fmt(tI)}</td></tr></tbody></table></div></div>`;
    h+='<div class="tcard"><div class="thdr"><div class="ttl">Έξοδα</div></div><div class="twrap" style="max-height:500px;overflow-y:auto"><table><thead><tr><th>Λογαριασμός</th><th>Ποσό</th></tr></thead><tbody>';
    er.forEach(r=>{h+=`<tr><td>${r.AccountName}</td><td class="n">€${fmt(r.Total)}</td></tr>`});
    h+=`<tr class="sub"><td>Σύνολο:</td><td class="n">€${fmt(tE)}</td></tr></tbody></table></div></div></div>`;
    pg.innerHTML=h;
  }catch(e){if(e.message.includes('πρόσβαση')){pg.innerHTML=noAccessHTML('Αναφορά')}else{pg.innerHTML=`<div class="loading" style="color:var(--red)">${e.message}</div>`}}
}

// ===== P&L =====
let plS=null;
async function rPnl(){
  const pg=document.getElementById('p-pnl');
  if(!hasPerm('pnl')){pg.innerHTML=noAccessHTML('P&L');return;}
  if(!plS)plS=CU.role==='admin'?'all':String(MY_STORES[0]?.Id);
  pg.innerHTML='<div class="loading">Φόρτωση...</div>';
  try{
    const sp=plS==='all'?'':'&storeId='+plS;
    const d=await $api('/pnl?year=2026'+sp);
    const pv={};d.forEach(r=>{if(!pv[r.AccountName])pv[r.AccountName]={t:r.AccountType,m:{}};pv[r.AccountName].m[r.Month]=(pv[r.AccountName].m[r.Month]||0)+r.Total});
    const sn=plS==='all'?'Όλα τα Καταστήματα':MY_STORES.find(s=>String(s.Id)===String(plS))?.Name||'';
    let h=`<div class="phdr"><div><div class="ptitle">P & L</div><div class="psub">${sn} — 2026</div></div><div class="hacts">${sSel('plSS',plS,"plS=this.value;rPnl()",true)}<button class="btn bs bo" onclick="exportPDF(\'P&L\')">🖨 PDF</button><button class="btn bs bo" onclick="exportPnlExcel()" style="border-color:var(--grn);color:var(--grn)">📊 Excel</button></div></div>`;
    h+='<div class="tcard"><div class="twrap"><table><thead><tr><th style="min-width:180px">Λογαριασμός</th>';
    MO.forEach(m=>{h+=`<th>${m}</th>`});h+='<th style="background:var(--accg);color:var(--acc)">ΣΥΝΟΛΟ</th></tr></thead><tbody>';
    const ia=Object.entries(pv).filter(([,v])=>v.t==='Income'),ea=Object.entries(pv).filter(([,v])=>v.t==='Expenses');
    h+='<tr style="background:var(--bg4)"><td colspan="14" style="font-weight:700;color:var(--grn);font-size:11px;text-transform:uppercase;letter-spacing:1px;padding:10px 14px">Έσοδα</td></tr>';
    let tIM={},yrI=0;
    ia.forEach(([n,a])=>{h+=`<tr><td>${n}</td>`;let yr=0;for(let m=1;m<=12;m++){const v=a.m[m]||0;yr+=v;tIM[m]=(tIM[m]||0)+v;h+=`<td>${v?'€'+fmt(v):'-'}</td>`}h+=`<td style="font-weight:600">${yr?'€'+fmt(yr):'-'}</td></tr>`});
    h+='<tr class="sub"><td>Σύνολο Εσόδων:</td>';for(let m=1;m<=12;m++){const v=tIM[m]||0;yrI+=v;h+=`<td class="p">€${fmt(v)}</td>`}h+=`<td class="p" style="font-weight:700">€${fmt(yrI)}</td></tr>`;
    h+='<tr><td colspan="14" style="padding:4px"></td></tr>';
    h+='<tr style="background:var(--bg4)"><td colspan="14" style="font-weight:700;color:var(--red);font-size:11px;text-transform:uppercase;letter-spacing:1px;padding:10px 14px">Έξοδα</td></tr>';
    let tEM={},yrE=0;
    ea.forEach(([n,a])=>{h+=`<tr><td>${n}</td>`;let yr=0;for(let m=1;m<=12;m++){const v=a.m[m]||0;yr+=v;tEM[m]=(tEM[m]||0)+v;h+=`<td>${v?'€'+fmt(v):'-'}</td>`}h+=`<td style="font-weight:600">${yr?'€'+fmt(yr):'-'}</td></tr>`});
    h+='<tr class="sub"><td>Σύνολο Εξόδων:</td>';for(let m=1;m<=12;m++){const v=tEM[m]||0;yrE+=v;h+=`<td class="n">€${fmt(v)}</td>`}h+=`<td class="n" style="font-weight:700">€${fmt(yrE)}</td></tr>`;
    h+='<tr><td colspan="14" style="padding:4px"></td></tr>';
    let yrP=0;h+='<tr class="tot"><td>ΣΥΝΟΛΑ</td>';for(let m=1;m<=12;m++){const p=(tIM[m]||0)-(tEM[m]||0);yrP+=p;h+=`<td class="${p>=0?'p':'n'}">${fmtE(p)}</td>`}
    h+=`<td class="${yrP>=0?'p':'n'}" style="font-weight:700">${fmtE(yrP)}</td></tr></tbody></table></div></div>`;
    pg.innerHTML=h;
  }catch(e){if(e.message.includes('πρόσβαση')){pg.innerHTML=noAccessHTML('P&L')}else{pg.innerHTML=`<div class="loading" style="color:var(--red)">${e.message}</div>`}}
}

// ===== ACCOUNTS =====
let accQ='',accF='2026-01-01',accT='2026-12-31',accTotals={};
async function accLoadTotals(){
  accTotals={};
  const storeId=MY_STORES[0]?.Id;
  if(!storeId)return;
  try{
    const rpt=await $api(`/report?storeId=${storeId}&from=${accF}&to=${accT}`);
    rpt.forEach(r=>{accTotals[r.AccountName]=(accTotals[r.AccountName]||0)+r.Total;});
  }catch(e){accTotals={};}
  const el=document.getElementById('accLists');
  if(el) accRenderLists(ACCS,CU.role==='admin'||canWrite());
}
function accRenderLists(accs,canManage){
  let filtered=accQ?accs.filter(a=>a.Name.toLowerCase().includes(accQ.toLowerCase())):accs;
  const inc=filtered.filter(a=>a.Type==='Income'),exp=filtered.filter(a=>a.Type==='Expenses');
  const incTot=inc.reduce((s,a)=>s+(accTotals[a.Name]||0),0);
  const expTot=exp.reduce((s,a)=>s+(accTotals[a.Name]||0),0);
  let h=`<div class="tcard"><div class="thdr"><div class="ttl">Έσοδα (${inc.length})</div>${Object.keys(accTotals).length?`<div style="font-weight:700;color:var(--grn)">€${fmt(incTot)}</div>`:''}</div><div class="twrap"><table><thead><tr><th>Λογαριασμός</th>${Object.keys(accTotals).length?'<th style="text-align:right">Σύνολο</th>':''}${canManage?'<th></th>':''}</tr></thead><tbody>`;
  inc.forEach(a=>{const t=accTotals[a.Name];h+=`<tr><td>${a.Name}</td>${Object.keys(accTotals).length?`<td style="text-align:right;color:var(--grn)">${t?'+€'+fmt(t):'-'}</td>`:''}${canManage?`<td><button class="btn bs bo" onclick="delAcc(${a.Id})">🗑️</button></td>`:''}</tr>`});
  h+='</tbody></table></div></div>';
  h+=`<div class="tcard"><div class="thdr"><div class="ttl">Έξοδα (${exp.length})</div>${Object.keys(accTotals).length?`<div style="font-weight:700;color:var(--red)">€${fmt(expTot)}</div>`:''}</div><div class="twrap"><table><thead><tr><th>Λογαριασμός</th>${Object.keys(accTotals).length?'<th style="text-align:right">Σύνολο</th>':''}${canManage?'<th></th>':''}</tr></thead><tbody>`;
  exp.forEach(a=>{const t=accTotals[a.Name];h+=`<tr><td>${a.Name}</td>${Object.keys(accTotals).length?`<td style="text-align:right;color:var(--red)">${t?'-€'+fmt(t):'-'}</td>`:''}${canManage?`<td><button class="btn bs bo" onclick="delAcc(${a.Id})">🗑️</button></td>`:''}</tr>`});
  h+='</tbody></table></div></div>';
  document.getElementById('accLists').innerHTML=h;
}
async function rAccounts(){
  const pg=document.getElementById('p-accounts');
  if(!hasPerm('accounts')){pg.innerHTML=noAccessHTML('Λογαριασμοί');return;}
  ACCS=await $api('/accounts');
  const isAdmin=CU.role==='admin';
  const canManage=isAdmin||canWrite();
  if(!document.getElementById('accSearch')){
    pg.innerHTML=`<div class="phdr"><div><div class="ptitle">Λογαριασμοί</div><div class="psub">${canManage?'Διαχείριση λογαριασμών':'Μόνο ανάγνωση'}</div></div><div class="hacts"><div class="dr-wrap"><label class="dr-lbl">ΑΠΟ</label><input id="accDateF" type="date" class="dr-inp" value="${accF}" onchange="accF=this.value;accLoadTotals()"></div><div class="dr-wrap"><label class="dr-lbl">ΕΩΣ</label><input id="accDateT" type="date" class="dr-inp" value="${accT}" onchange="accT=this.value;accLoadTotals()"></div><input id="accSearch" type="text" placeholder="🔍 Αναζήτηση..." style="padding:6px 10px;background:var(--bg4);border:1px solid var(--brd);border-radius:var(--r);color:var(--txt);font-size:12px;outline:none;width:150px">${canManage?'<button class="btn bs bp" onclick="showAddAcc()">+ Νέος</button>':''}<button class="btn bs bo" onclick="exportPDF('Λογαριασμοί')">🖨 PDF</button><button class="btn bs bo" onclick="exportAccExcel()" style="border-color:var(--grn);color:var(--grn)">📊 Excel</button></div></div><div id="accLists"></div>`;
    document.getElementById('accSearch').addEventListener('input',function(){accQ=this.value;accRenderLists(ACCS,canManage);});
  }
  await accLoadTotals();
}
function showAddAcc(){
  document.getElementById('modals').innerHTML=`<div class="mov" onclick="if(event.target===this)closeM()"><div class="modal"><h3>Νέος Λογαριασμός</h3>
    <div class="fg"><label>Όνομα</label><input type="text" id="naName"></div>
    <div class="fg"><label>Τύπος</label><select id="naType"><option value="Income">Έσοδα</option><option value="Expenses" selected>Έξοδα</option></select></div>
    <div class="macts"><button class="btn bs bo" onclick="closeM()">Ακύρωση</button><button class="btn bs bp" onclick="addAcc()">OK</button></div></div></div>`;
}
async function addAcc(){try{await $api('/accounts',{method:'POST',body:JSON.stringify({name:document.getElementById('naName').value,type:document.getElementById('naType').value})});closeM();document.getElementById('accSearch')?.remove();accQ='';rAccounts();toast('OK!')}catch(e){toast(e.message,true)}}
async function delAcc(id){if(!confirm('Διαγραφή;'))return;try{await $api('/accounts/'+id,{method:'DELETE'});ACCS=await $api('/accounts');accRenderLists(ACCS,CU.role==='admin'||canWrite())}catch(e){toast(e.message,true)}}

// ===== USERS (admin) =====
async function rUsers(){
  if(CU.role!=='admin')return;const pg=document.getElementById('p-users');pg.innerHTML='<div class="loading">Φόρτωση...</div>';
  try{
    const d=await $api('/users');
    let h=`<div class="phdr"><div><div class="ptitle">Χρήστες & Δικαιώματα</div></div><button class="btn bs bp" onclick="showAddU()">+ Νέος Χρήστης</button></div>`;
    h+='<div class="tcard"><div class="twrap"><table><thead><tr><th>Χρήστης</th><th>Ρόλος</th><th>Πρόσβαση</th><th>Καταστήματα</th><th>Σελίδες</th><th></th></tr></thead><tbody>';
    d.forEach(u=>{
      const permTags=Object.entries(u.permissions||{}).map(([pg,has])=>`<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:${has?'var(--grng)':'var(--redg)'};color:${has?'var(--grn)':'var(--red)'}">${PAGE_LABELS[pg]||pg} ${has?'✓':'✗'}</span>`).join(' ');
      h+=`<tr>
        <td><b>${u.DisplayName}</b><br><span style="color:var(--dim);font-size:11px">${u.Username}</span></td>
        <td><span class="badge ${u.Role==='admin'?'adm':'usr'}">${u.Role}</span></td>
        <td>${u.Role==='admin'?'—':`<span class="badge ${u.AccessLevel==='readonly'?'ro':'rw'}">${u.AccessLevel==='readonly'?'Read-Only':'Full'}</span>`}</td>
        <td style="font-size:11px;color:var(--dim)">${u.Role==='admin'?'Όλα':u.StoreNames||'-'}</td>
        <td>${u.Role==='admin'?'Όλα':permTags}</td>
        <td>${u.Username!=='admin'?`<button class="btn bs bo" onclick="showEditU(${u.Id})">✏️</button> <button class="btn bs bo" onclick="delU(${u.Id})">🗑️</button>`:''}</td>
      </tr>`;
    });
    h+='</tbody></table></div></div>';pg.innerHTML=h;
    // Store user data for edit modal
    window._usersData=d;
  }catch(e){pg.innerHTML=`<div class="loading" style="color:var(--red)">${e.message}</div>`}
}

function userFormHTML(title, u={}) {
  const st=MY_STORES.map(s=>`<option value="${s.Id}" ${(u.StoreIds||'').split(',').includes(String(s.Id))?'selected':''}>${s.Name}</option>`).join('');
  const perms=u.permissions||{dashboard:true,transactions:true,accounts:true,report:true,pnl:true};
  const al=u.AccessLevel||'full';
  return `<h3>${title}</h3>
    <div class="fg"><label>Όνομα</label><input type="text" id="fuN" value="${u.DisplayName||''}"></div>
    <div class="fg"><label>Username</label><input type="text" id="fuU" value="${u.Username||''}" ${u.Id?'readonly style="opacity:.5"':''}></div>
    <div class="fg"><label>${u.Id?'Νέος κωδικός (κενό=χωρίς αλλαγή)':'Password'}</label><input type="password" id="fuP"></div>
    <div class="fg"><label>Ρόλος</label><select id="fuR"><option value="user" ${u.Role==='user'?'selected':''}>User</option><option value="admin" ${u.Role==='admin'?'selected':''}>Admin</option></select></div>
    <div class="fg"><label>Καταστήματα (Ctrl+Click)</label><select id="fuS" multiple style="height:70px">${st}</select></div>
    <div class="fg"><label>Επίπεδο Πρόσβασης</label>
      <div class="access-toggle">
        <button type="button" class="${al==='readonly'?'act':''}" onclick="this.classList.add('act');this.nextElementSibling.classList.remove('act');document.getElementById('fuAL').value='readonly'">🔒 Read-Only</button>
        <button type="button" class="${al!=='readonly'?'act':''}" onclick="this.classList.add('act');this.previousElementSibling.classList.remove('act');document.getElementById('fuAL').value='full'">✏️ Full Access</button>
      </div>
      <input type="hidden" id="fuAL" value="${al}">
    </div>
    <div class="fg"><label>Σελίδες με πρόσβαση</label>
      <div class="perm-grid">
        ${Object.entries(PAGE_LABELS).map(([code,label])=>`<div class="perm-item"><input type="checkbox" id="fp_${code}" ${perms[code]!==false?'checked':''}><label for="fp_${code}">${label}</label></div>`).join('')}
      </div>
    </div>`;
}

function showAddU(){
  document.getElementById('modals').innerHTML=`<div class="mov" onclick="if(event.target===this)closeM()"><div class="modal">
    ${userFormHTML('Νέος Χρήστης')}
    <div class="macts"><button class="btn bs bo" onclick="closeM()">Ακύρωση</button><button class="btn bs bp" onclick="submitNewU()">Δημιουργία</button></div></div></div>`;
}

function showEditU(id){
  const u=(window._usersData||[]).find(x=>x.Id===id);if(!u)return;
  document.getElementById('modals').innerHTML=`<div class="mov" onclick="if(event.target===this)closeM()"><div class="modal">
    ${userFormHTML('Επεξεργασία: '+u.DisplayName, u)}
    <div class="macts"><button class="btn bs bo" onclick="closeM()">Ακύρωση</button><button class="btn bs bp" onclick="submitEditU(${id})">Αποθήκευση</button></div></div></div>`;
}

function gatherUserForm(){
  const perms={};
  ['dashboard','transactions','accounts','report','pnl'].forEach(pg=>{
    perms[pg]=document.getElementById('fp_'+pg)?.checked??true;
  });
  return {
    displayName:document.getElementById('fuN').value,
    username:document.getElementById('fuU').value,
    password:document.getElementById('fuP').value,
    role:document.getElementById('fuR').value,
    storeIds:Array.from(document.getElementById('fuS').selectedOptions).map(o=>parseInt(o.value)),
    accessLevel:document.getElementById('fuAL').value,
    permissions:perms
  };
}

async function submitNewU(){
  const d=gatherUserForm();
  if(!d.displayName||!d.username||!d.password){toast('Συμπληρώστε όλα τα πεδία!',true);return}
  try{await $api('/users',{method:'POST',body:JSON.stringify(d)});closeM();rUsers();toast('Δημιουργήθηκε!')}catch(e){toast(e.message,true)}
}
async function submitEditU(id){
  const d=gatherUserForm();
  if(!d.password)delete d.password;
  try{await $api('/users/'+id,{method:'PUT',body:JSON.stringify(d)});closeM();rUsers();toast('Αποθηκεύτηκε!')}catch(e){toast(e.message,true)}
}
async function delU(id){if(!confirm('Διαγραφή;'))return;try{await $api('/users/'+id,{method:'DELETE'});rUsers();toast('OK')}catch(e){toast(e.message,true)}}


// ===== STORES (admin) =====
async function rStores(){
  if(CU.role!=='admin')return;const pg=document.getElementById('p-stores');pg.innerHTML='<div class="loading">Φόρτωση...</div>';
  try{
    const d=await $api('/stores');
    let h=`<div class="phdr"><div><div class="ptitle">Καταστήματα</div><div class="psub">Διαχείριση καταστημάτων</div></div><button class="btn bs bp" onclick="showAddStore()">+ Νέο Κατάστημα</button></div>`;
    h+='<div class="tcard"><div class="twrap"><table><thead><tr><th>Κωδικός</th><th>Όνομα</th><th>Κατάσταση</th><th></th></tr></thead><tbody>';
    d.forEach(s=>{h+=`<tr><td><b>${s.Code}</b></td><td>${s.Name}</td><td><span class="badge" style="background:${s.IsActive?'var(--grng);color:var(--grn)':'var(--redg);color:var(--red)'}}">${s.IsActive?'Ενεργό':'Ανενεργό'}</span></td><td><button class="btn bs bo" onclick="editStore(${s.Id},'${s.Name}','${s.Code}')">✏️</button></td></tr>`;});
    h+='</tbody></table></div></div>';pg.innerHTML=h;
  }catch(e){pg.innerHTML=`<div class="loading" style="color:var(--red)">${e.message}</div>`}
}
function showAddStore(){
  document.getElementById('modals').innerHTML=`<div class="mov" onclick="if(event.target===this)closeM()"><div class="modal"><h3>Νέο Κατάστημα</h3>
    <div class="fg"><label>Κωδικός (π.χ. S4)</label><input type="text" id="nsCode" placeholder="S4"></div>
    <div class="fg"><label>Όνομα</label><input type="text" id="nsName" placeholder="Κατάστημα 4"></div>
    <div class="macts"><button class="btn bs bo" onclick="closeM()">Ακύρωση</button><button class="btn bs bp" onclick="submitNewStore()">Δημιουργία</button></div></div></div>`;
}
async function submitNewStore(){
  const code=document.getElementById('nsCode').value.trim();
  const name=document.getElementById('nsName').value.trim();
  if(!code||!name){toast('Συμπληρώστε κωδικό και όνομα!',true);return}
  try{await $api('/stores',{method:'POST',body:JSON.stringify({code,name})});closeM();rStores();
    // Refresh stores list for current user
    const d2=await $api('/stores');MY_STORES=d2;toast('Κατάστημα δημιουργήθηκε!');}catch(e){toast(e.message,true)}
}
function editStore(id,name,code){
  document.getElementById('modals').innerHTML=`<div class="mov" onclick="if(event.target===this)closeM()"><div class="modal"><h3>Επεξεργασία Καταστήματος</h3>
    <div class="fg"><label>Κωδικός</label><input type="text" id="esCode" value="${code}"></div>
    <div class="fg"><label>Όνομα</label><input type="text" id="esName" value="${name}"></div>
    <div class="macts"><button class="btn bs bo" onclick="closeM()">Ακύρωση</button><button class="btn bs bp" onclick="submitEditStore(${id})">Αποθήκευση</button></div></div></div>`;
}
async function submitEditStore(id){
  const code=document.getElementById('esCode').value.trim();
  const name=document.getElementById('esName').value.trim();
  try{await $api('/stores/'+id,{method:'PUT',body:JSON.stringify({code,name})});closeM();rStores();toast('Αποθηκεύτηκε!');}catch(e){toast(e.message,true)}
}

// ===== BACKUP =====
function doBackup(){
  if(backupInProgress)return;
  // Show backup modal
  document.getElementById('modals').innerHTML=`
  <div class="mov" onclick="if(event.target===this)closeM()" style="z-index:9999">
    <div class="modal" style="max-width:460px">
      <h3 style="margin-bottom:4px">💾 Backup Βάσης</h3>
      <p style="color:var(--dim);font-size:13px;margin-bottom:20px">Επίλεξε πού θέλεις να αποθηκευτεί το backup</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="backup-opt" onclick="doBackupLocal()">
          <span class="bopt-icon">💻</span>
          <div><div class="bopt-title">Τοπικά (Λήψη)</div><div class="bopt-sub">Κατεβάζει το αρχείο .db στον υπολογιστή σου</div></div>
        </button>
        <button class="backup-opt" onclick="closeM();showBackupEmail()">
          <span class="bopt-icon">📧</span>
          <div><div class="bopt-title">Email</div><div class="bopt-sub">Στέλνει το backup ως attachment σε email</div></div>
        </button>
        <button class="backup-opt" onclick="closeM();showBackupTelegram()">
          <span class="bopt-icon">✈️</span>
          <div><div class="bopt-title">Telegram</div><div class="bopt-sub">Στέλνει το αρχείο στο Telegram Bot σου</div></div>
        </button>
        <button class="backup-opt" onclick="closeM();showBackupWebhook()">
          <span class="bopt-icon">🌐</span>
          <div><div class="bopt-title">Webhook / URL</div><div class="bopt-sub">Στέλνει το backup σε οποιοδήποτε server ή NAS</div></div>
        </button>
      </div>
      <div class="macts" style="margin-top:16px"><button class="btn bs bo" onclick="closeM()">Κλείσιμο</button></div>
    </div>
  </div>`;
}

async function doBackupLocal(){
  closeM();
  const btn=document.getElementById('backupBtn');
  backupInProgress=true;
  if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    toast('Ξεκίνησε η λήψη του backup');
    const r=await fetch(API+'/backup',{credentials:'same-origin',headers:TOKEN?{'Authorization':'Bearer '+TOKEN}:{}});
    if(!r.ok){const e=await r.json().catch(()=>({}));toast(e.error||'Σφάλμα backup',true);return;}
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const dt=new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
    a.href=url;a.download=`koupis_backup_${dt}.db`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('✅ Backup αποθηκεύτηκε!');
  }catch(e){toast(e.message||'Σφάλμα backup',true)}
  finally{backupInProgress=false;if(btn){btn.disabled=false;btn.textContent='💾 Backup DB';}}
}

function showBackupEmail(){
  const saved=JSON.parse(localStorage.getItem('backupEmailCfg')||'{}');
  document.getElementById('modals').innerHTML=`
  <div class="mov" onclick="if(event.target===this)closeM()">
    <div class="modal" style="max-width:420px">
      <h3>📧 Backup μέσω Email</h3>
      <div class="fg"><label>SMTP Server</label><input type="text" id="bSmtp" placeholder="smtp.gmail.com" value="${saved.smtp||'smtp.gmail.com'}"></div>
      <div class="fg"><label>Port</label><input type="number" id="bPort" placeholder="587" value="${saved.port||587}"></div>
      <div class="fg"><label>Email αποστολέα</label><input type="email" id="bFrom" placeholder="you@gmail.com" value="${saved.from||''}"></div>
      <div class="fg"><label>Password / App Password</label><input type="password" id="bPass" placeholder="●●●●●●●●●●●●●●●●" value="${saved.pass||''}"></div>
      <div class="fg"><label>Αποστολή σε</label><input type="email" id="bTo" placeholder="backup@email.com" value="${saved.to||''}"></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dim);margin-bottom:16px">
        <input type="checkbox" id="bSave" ${saved.smtp?'checked':''}> Αποθήκευση ρυθμίσεων
      </label>
      <div class="macts">
        <button class="btn bs bo" onclick="closeM()">Ακύρωση</button>
        <button class="btn bs bp" onclick="sendBackupEmail()">📤 Αποστολή</button>
      </div>
    </div>
  </div>`;
}

async function sendBackupEmail(){
  const cfg={smtp:document.getElementById('bSmtp').value,port:+document.getElementById('bPort').value,from:document.getElementById('bFrom').value,pass:document.getElementById('bPass').value,to:document.getElementById('bTo').value};
  if(!cfg.smtp||!cfg.from||!cfg.pass||!cfg.to){toast('Συμπλήρωσε όλα τα πεδία',true);return;}
  if(document.getElementById('bSave').checked)localStorage.setItem('backupEmailCfg',JSON.stringify(cfg));
  closeM();
  const btn=document.getElementById('backupBtn');
  backupInProgress=true;if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    toast('⏳ Αποστολή backup μέσω email...');
    const r=await $api('/backup/email',{method:'POST',body:JSON.stringify(cfg)});
    toast('✅ Backup στάλθηκε στο '+cfg.to);
  }catch(e){toast(e.message||'Σφάλμα αποστολής',true)}
  finally{backupInProgress=false;if(btn){btn.disabled=false;btn.textContent='💾 Backup DB';}}
}

function showBackupTelegram(){
  const saved=JSON.parse(localStorage.getItem('backupTgCfg')||'{}');
  document.getElementById('modals').innerHTML=`
  <div class="mov" onclick="if(event.target===this)closeM()">
    <div class="modal" style="max-width:420px">
      <h3>✈️ Backup μέσω Telegram</h3>
      <p style="color:var(--dim);font-size:12px;margin-bottom:16px">Δημιούργησε bot από το <b>@BotFather</b> στο Telegram και βάλε το token παρακάτω</p>
      <div class="fg"><label>Bot Token</label><input type="text" id="bTgToken" placeholder="123456:ABC-DEF..." value="${saved.token||''}"></div>
      <div class="fg"><label>Chat ID</label><input type="text" id="bTgChat" placeholder="-100123456789" value="${saved.chatId||''}">
        <div style="font-size:11px;color:var(--dim);margin-top:4px">Στείλε μήνυμα στο bot και επίσκεψου: api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dim);margin-bottom:16px">
        <input type="checkbox" id="bTgSave" ${saved.token?'checked':''}> Αποθήκευση ρυθμίσεων
      </label>
      <div class="macts">
        <button class="btn bs bo" onclick="closeM()">Ακύρωση</button>
        <button class="btn bs bp" onclick="sendBackupTelegram()">📤 Αποστολή</button>
      </div>
    </div>
  </div>`;
}

async function sendBackupTelegram(){
  const cfg={token:document.getElementById('bTgToken').value,chatId:document.getElementById('bTgChat').value};
  if(!cfg.token||!cfg.chatId){toast('Συμπλήρωσε token και Chat ID',true);return;}
  if(document.getElementById('bTgSave').checked)localStorage.setItem('backupTgCfg',JSON.stringify(cfg));
  closeM();
  const btn=document.getElementById('backupBtn');
  backupInProgress=true;if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    toast('⏳ Αποστολή backup στο Telegram...');
    const r=await $api('/backup/telegram',{method:'POST',body:JSON.stringify(cfg)});
    toast('✅ Backup στάλθηκε στο Telegram!');
  }catch(e){toast(e.message||'Σφάλμα αποστολής',true)}
  finally{backupInProgress=false;if(btn){btn.disabled=false;btn.textContent='💾 Backup DB';}}
}

function showBackupWebhook(){
  const saved=JSON.parse(localStorage.getItem('backupWhCfg')||'{}');
  document.getElementById('modals').innerHTML=`
  <div class="mov" onclick="if(event.target===this)closeM()">
    <div class="modal" style="max-width:420px">
      <h3>🌐 Backup μέσω Webhook</h3>
      <p style="color:var(--dim);font-size:12px;margin-bottom:16px">Στέλνει το αρχείο .db με POST σε οποιοδήποτε URL (NAS, server, κλπ)</p>
      <div class="fg"><label>URL</label><input type="url" id="bWhUrl" placeholder="https://your-server.com/backup" value="${saved.url||''}"></div>
      <div class="fg"><label>Header Authorization (προαιρετικό)</label><input type="text" id="bWhAuth" placeholder="Bearer mytoken" value="${saved.auth||''}"></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dim);margin-bottom:16px">
        <input type="checkbox" id="bWhSave" ${saved.url?'checked':''}> Αποθήκευση ρυθμίσεων
      </label>
      <div class="macts">
        <button class="btn bs bo" onclick="closeM()">Ακύρωση</button>
        <button class="btn bs bp" onclick="sendBackupWebhook()">📤 Αποστολή</button>
      </div>
    </div>
  </div>`;
}

async function sendBackupWebhook(){
  const cfg={url:document.getElementById('bWhUrl').value,auth:document.getElementById('bWhAuth').value};
  if(!cfg.url){toast('Βάλε URL',true);return;}
  if(document.getElementById('bWhSave').checked)localStorage.setItem('backupWhCfg',JSON.stringify(cfg));
  closeM();
  const btn=document.getElementById('backupBtn');
  backupInProgress=true;if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    toast('⏳ Αποστολή backup στο webhook...');
    const r=await $api('/backup/webhook',{method:'POST',body:JSON.stringify(cfg)});
    toast('✅ Backup στάλθηκε στο server!');
  }catch(e){toast(e.message||'Σφάλμα αποστολής',true)}
  finally{backupInProgress=false;if(btn){btn.disabled=false;btn.textContent='💾 Backup DB';}}
}


// Update print header date
document.addEventListener('DOMContentLoaded',()=>{
  const el=document.getElementById('printDate');
  if(el)el.textContent=new Date().toLocaleDateString('el-GR',{year:'numeric',month:'long',day:'numeric'});
});


// ===== EXPORT HELPERS =====
function escHtml(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function closePrintPreview(){
  const el=document.getElementById('printPreviewModal');
  if(el)el.remove();
  if(lastFocusedElement) lastFocusedElement.focus();
}

function trapFocus(modal,event){
  if(event.key!=='Tab') return;
  const focusables=[...modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled);
  if(!focusables.length) return;
  const first=focusables[0];
  const last=focusables[focusables.length-1];
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
}

function triggerPrintPreview(){
  const frame=document.getElementById('printPreviewFrame');
  if(!frame||!frame.contentWindow)return;
  frame.contentWindow.focus();
  frame.contentWindow.print();
}

function buildPrintDocument(title, css, content){
  return `<!DOCTYPE html><html lang="el"><head><meta charset="UTF-8"><title>${escHtml(title)} — KOUPIS GROUP</title>${css}</head><body>${content}</body></html>`;
}

function openPrintPreview(title, html){
  closePrintPreview();
  lastFocusedElement=document.activeElement;
  document.getElementById('modals').insertAdjacentHTML('beforeend',`
    <div class="pvmov" id="printPreviewModal" role="dialog" aria-modal="true" aria-labelledby="printPreviewTitle">
      <div class="pvmodal">
        <div class="pvhdr">
          <div>
            <div class="pvttl" id="printPreviewTitle">Προεπισκόπηση Εκτύπωσης</div>
            <div class="pvsub">${escHtml(title)} — έλεγξε το layout και μετά πάτησε Εκτύπωση</div>
          </div>
          <div class="pvacts">
            <button class="btn bs bo" type="button" id="closePrintPreviewBtn">Κλείσιμο</button>
            <button class="btn bs bp" type="button" id="printPreviewBtn">🖨 Εκτύπωση</button>
          </div>
        </div>
        <div class="pvbody">
          <div class="pvpaper">
            <iframe id="printPreviewFrame" class="pvframe" title="Preview ${escHtml(title)}"></iframe>
          </div>
        </div>
      </div>
    </div>`);
  const modal=document.getElementById('printPreviewModal');
  modal.addEventListener('click',e=>{ if(e.target===modal) closePrintPreview(); });
  modal.addEventListener('keydown',e=>trapFocus(modal,e));
  document.getElementById('closePrintPreviewBtn').addEventListener('click',closePrintPreview);
  document.getElementById('printPreviewBtn').addEventListener('click',triggerPrintPreview);
  document.getElementById('closePrintPreviewBtn').focus();
  const frame=document.getElementById('printPreviewFrame');
  const doc=frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}

async function exportPDF(title){
  let content='';
  let pageSize='A4 portrait';
  const getPrintCss=(pageSize)=>`
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:10px;color:#000;background:#fff;padding:10mm}
      h1{font-size:18px;font-weight:700;margin-bottom:4px}
      .sub{font-size:10px;color:#555;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;margin-top:8px;page-break-inside:auto}
      thead{display:table-header-group}
      tfoot{display:table-footer-group}
      thead th{background:#f0f0f0;font-size:9px;font-weight:700;text-transform:uppercase;
        border-top:2px solid #000;border-bottom:1px solid #999;padding:5px 8px;text-align:right}
      thead th:first-child{text-align:left}
      tbody td{border-bottom:1px solid #e0e0e0;padding:4px 8px;text-align:right;vertical-align:top}
      tbody td:first-child{text-align:left}
      tr{page-break-inside:avoid;page-break-after:auto}
      tr.sub td{background:#f5f5f5;border-top:1px solid #999;border-bottom:1px solid #999;font-weight:700}
      tr.tot td{background:#e8e8e8;border-top:2px solid #000;border-bottom:2px solid #000;font-weight:700}
      .cards{display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap}
      .card{border-bottom:2px solid #000;padding-bottom:6px;min-width:120px}
      .clbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#666}
      .cval{font-size:16px;font-weight:700}
      .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;
        border-bottom:2px solid #000;padding-bottom:3px;margin:14px 0 6px}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
      @page{size:${pageSize};margin:10mm}
      @media print{body{padding:0}}
    </style>`;

  if(title==='Συναλλαγές'){
    try{
      const qParam=txQ?'&search='+encodeURIComponent(txQ):'';
      const d=await $api('/transactions?storeId='+txS+'&page=1&limit=9999'+qParam+'&from='+txF+'&to='+txT);
      const storeName=MY_STORES.find(s=>String(s.Id)===String(txS))?.Name||'';
      let rows='';
      d.data.forEach(t=>{const ii=t.AccountType==='Income';
        rows+=`<tr><td>${fmtDate(t.Date)}</td><td>${escHtml(t.Description||'')}</td><td>${escHtml(t.AccountName||'')}</td><td style="text-align:right;color:#000">${ii?'+':'-'}€${fmt(t.Amount)}</td></tr>`;});
      content=`<h1>Συναλλαγές</h1><div class="sub">${escHtml(storeName)} — ${d.total} εγγραφές</div>
        <table><thead><tr><th>Ημ/νία</th><th>Περιγραφή</th><th>Λογ/μός</th><th>Ποσό</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="4">Δεν υπάρχουν εγγραφές</td></tr>'}</tbody></table>`;
    }catch(e){alert('Σφάλμα: '+e.message);return;}

  } else if(title==='Dashboard'){
    const cards=document.querySelectorAll('#p-dashboard .scard');
    let cardsHTML='<div class="cards">';
    cards.forEach(c=>{cardsHTML+=`<div class="card"><div class="clbl">${escHtml(c.querySelector('.slbl')?.textContent||'')}</div><div class="cval">${escHtml(c.querySelector('.sval')?.textContent||'')}</div></div>`;});
    cardsHTML+='</div>';
    const tbl=document.querySelector('#p-dashboard table');
    content=`<h1>Dashboard</h1><div class="sub">2026 — ${MO[dashFrom-1]} έως ${MO[dashTo-1]}</div>${cardsHTML}
      <div class="section-title">Ανά Κατάστημα</div>${tbl?tbl.outerHTML:''}`;

  } else if(title==='Αναφορά'){
    const tbls=document.querySelectorAll('#p-report table');
    const pCard=document.querySelector('#p-report .scard');
    const profit=pCard?`<div class="cards"><div class="card"><div class="clbl">Κέρδος</div><div class="cval">${escHtml(pCard.querySelector('.sval')?.textContent||'')}</div></div></div>`:'';
    let grid='<div class="grid2">';
    const titles=['Έσοδα','Έξοδα'];
    tbls.forEach((t,i)=>{grid+=`<div><div class="section-title">${titles[i]||''}</div>${t.outerHTML}</div>`;});
    grid+='</div>';
    content=`<h1>Αναφορά</h1>${profit}${grid}`;

  } else if(title==='Λογαριασμοί'){
    const tbls=document.querySelectorAll('#p-accounts table');
    const titles=['Έσοδα','Έξοδα'];
    let body='';
    tbls.forEach((t,i)=>{body+=`<div class="section-title">${titles[i]||''}</div>${t.outerHTML}`;});
    content=`<h1>Λογαριασμοί</h1>${body}`;

  } else if(title==='P&L'){
    pageSize='A4 landscape';
    const tbl=document.querySelector('#p-pnl table');
    const sub=document.querySelector('#p-pnl .psub')?.textContent||'';
    content=`<h1>P & L</h1><div class="sub">${escHtml(sub)}</div>${tbl?tbl.outerHTML:''}`;
  }

  const css=getPrintCss(pageSize);
  openPrintPreview(title, buildPrintDocument(title, css, content));
}

function tableToExcel(tableId, filename, sheetname){
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(document.getElementById(tableId));
  XLSX.utils.book_append_sheet(wb, ws, sheetname||'Data');
  XLSX.writeFile(wb, filename+'.xlsx');
}

function exportExcelFromData(rows, headers, filename, sheetname){
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Column widths
  ws['!cols'] = headers.map(()=>({wch:20}));
  XLSX.utils.book_append_sheet(wb, ws, sheetname||'Data');
  XLSX.writeFile(wb, filename+'.xlsx');
}

// Dashboard Excel export
function exportDashExcel(){
  const rows = [];
  // Summary
  rows.push(['DASHBOARD ΣΥΝΟΨΗ']);
  rows.push(['Εύρος μηνών:', MO[dashFrom-1]+' – '+MO[dashTo-1]]);
  rows.push([]);
  // Per-store table
  const tbl = document.querySelector('#p-dashboard table');
  if(tbl){
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(tbl);
    ws['!cols'] = [{wch:25},{wch:15},{wch:15},{wch:15},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, 'Ανά Κατάστημα');
    // Also add monthly chart data
    const ws2 = XLSX.utils.aoa_to_sheet([['Μήνας','Έσοδα']]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Μηνιαία');
    XLSX.writeFile(wb, 'Dashboard_'+MO[dashFrom-1]+'_'+MO[dashTo-1]+'.xlsx');
  } else { toast('Δεν βρέθηκαν δεδομένα',true); }
}

function exportTxExcel(){
  const tbl = document.querySelector('#p-transactions table');
  if(!tbl){toast('Δεν βρέθηκαν δεδομένα',true);return;}
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(tbl);
  ws['!cols'] = [{wch:12},{wch:30},{wch:25},{wch:15}];
  XLSX.utils.book_append_sheet(wb, ws, 'Συναλλαγές');
  XLSX.writeFile(wb, 'Synalages.xlsx');
}

function exportAccExcel(){
  const tables = document.querySelectorAll('#p-accounts table');
  if(!tables.length){toast('Δεν βρέθηκαν δεδομένα',true);return;}
  const wb = XLSX.utils.book_new();
  const names=['Έσοδα','Έξοδα'];
  tables.forEach((tbl,i)=>{
    const ws = XLSX.utils.table_to_sheet(tbl);
    ws['!cols'] = [{wch:35},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, names[i]||('Sheet'+(i+1)));
  });
  XLSX.writeFile(wb, 'Logariasmoi.xlsx');
}

function exportReportExcel(){
  const tables = document.querySelectorAll('#p-report table');
  if(!tables.length){toast('Δεν βρέθηκαν δεδομένα',true);return;}
  const wb = XLSX.utils.book_new();
  const names=['Έσοδα','Έξοδα'];
  tables.forEach((tbl,i)=>{
    const ws = XLSX.utils.table_to_sheet(tbl);
    ws['!cols'] = [{wch:35},{wch:15}];
    XLSX.utils.book_append_sheet(wb, ws, names[i]||('Sheet'+(i+1)));
  });
  XLSX.writeFile(wb, 'Anafora.xlsx');
}

function exportPnlExcel(){
  const tbl = document.querySelector('#p-pnl table');
  if(!tbl){toast('Δεν βρέθηκαν δεδομένα',true);return;}
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(tbl);
  ws['!cols'] = [{wch:30},...Array(13).fill({wch:12})];
  XLSX.utils.book_append_sheet(wb, ws, 'P&L');
  XLSX.writeFile(wb, 'PnL.xlsx');
}

function setupUIBindings(){
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('logoutBtn').addEventListener('click', () => logout());
  document.getElementById('sidebarToggle').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  const overlay = document.getElementById('sidebarOverlay');
  overlay.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  overlay.addEventListener('touchend', () => document.body.classList.remove('sidebar-open'));
  document.getElementById('nav').addEventListener('click', (e) => {
    const btn=e.target.closest('[data-nav]');
    if(!btn) return;
    nav(btn.dataset.nav);
  });
}

// Restore session on page load
(async function restoreSession(){
  setupUIBindings();
  try{
    const d=await $api('/auth/me');
    applySession(d.user);
    ACCS=await $api('/accounts');
    document.getElementById('login').style.display='none';
    document.getElementById('app').style.display='block';
    buildApp();
  }catch(e){}
})();
