import './style.css'
import { hooks, LANGS, STR, DEPTS, PERSONAS, DIAG, NATIONS, NATION_CODES, NATIONS_TOP, natName, PHASES, PHASE_KEYS, BANNER_DUE, TASKS, CATLBL, CAL, REQ, POOLS, POSTS, PCATS, FAQ, WHERE, BILL_EXPL, NOTI_UI, NOTI_INIT, NOTI_PHASE } from './data.js'

/* 규칙 기반 시간표 생성: 우선순위 → 선호 → 시간 충돌 → 학점 상한 */
function genPlan(){
 const pool = [...POOLS[mode()]].sort((a,b)=>a.pri-b.pri);
 const P = S.pref, plan = [], notes = []; let cr = 0;
 const clash = slots => plan.some(c => c.slots.some(([d1,s1,e1]) => slots.some(([d2,s2,e2]) => d1===d2 && s1<e2 && s2<e1)));
 const score = ([,slots,eng]) => (P.noNine && slots.some(s=>s[1]<600) ? 2 : 0) + (P.freeFri && slots.some(s=>s[0]===4) ? 2 : 0) + (P.eng && !eng ? 1 : 0);
 pool.forEach((c,ci) => {
  if (cr + c.cr > P.max) { notes.push({ko:`${c.n.ko}: 최대 ${P.max}학점을 넘어서 뺐어요`,en:`${c.n.en}: skipped to stay within ${P.max} credits`}); return; }
  let opts = c.secs.filter(s => !clash(s[1])).sort((a,b)=>score(a)-score(b));
  if (S.alt && c.pri===1 && opts.length>1) opts = [opts[1],opts[0]];
  const pick = opts[0];
  if (!pick) { notes.push({ko:`${c.n.ko}: 시간이 겹쳐서 뺐어요`,en:`${c.n.en}: skipped, time clash`}); return; }
  if (score(pick) >= 2) {
   if (c.pri >= 3) { notes.push({ko:`${c.n.ko}: 선호 조건에 맞는 분반이 없어 뺐어요`,en:`${c.n.en}: no section fits your preferences`}); return; }
   notes.push({ko:`${c.n.ko}: 필수라 선호 조건과 달라도 넣었어요`,en:`${c.n.en}: required, kept despite preferences`});
  }
  plan.push({id:c.id,n:{ko:`${c.n.ko} ${pick[0]}`,en:`${c.n.en} ${pick[0]}`},base:c.n,cr:c.cr,pri:c.pri,tag:c.tag,pre:c.pre,cart:c.cart,eng:pick[2],slots:pick[1],c:ci%5});
  cr += c.cr;
 });
 return {plan, notes, cr};
}

/* ======================= STATE ======================= */
const S = {
 appName:'mumomo', onboard:true, mode:'student', loggedIn:false, lang:'ko', phase:'arrive', tab:'home', overlay:null,
 loginStep:'school', genStep:0,
 profile:{...PERSONAS.cont.p}, ans:{...PERSONAS.cont.ans}, persona:'cont', diagI:0,
 pref:{max:18,noNine:false,freeFri:false,eng:false}, alt:false, ttView:'plan', reg:{}, billCourse:'ds', qaView:'chat', pcat:'all', openTr:{}, openAns:{}, liked:{},
 notis:[], notiSeeded:false, notiShown:null,
 taskI:0, chat:[], points:120, myPosts:[], showAI:false, showMoney:false, step:1
};

/* ======================= HELPERS ======================= */
const t = k => (STR[S.lang] && STR[S.lang][k] !== undefined) ? STR[S.lang][k] : (STR.en[k] !== undefined ? STR.en[k] : STR.ko[k]);
const tx = o => o == null ? '' : (typeof o === 'string' ? o : (o[S.lang] || o.en || o.ko || ''));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const today = () => parse(PHASES[S.phase].date);
const diff = s => Math.round((parse(s) - today()) / 864e5);
const ddLabel = n => n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`;
const ddClass = n => n < 0 ? 'late' : n <= 14 ? 'hot' : '';
const md = s => { const d = parse(s); return `${d.getMonth()+1}.${String(d.getDate()).padStart(2,'0')}`; };
/* 2026-1 기준 몇 번째 학기인지: 2026-1 입학 = 1, 2025-2 = 2, 2025-1 = 3 */
const semNo = () => Math.max(1, (2026 - (+S.profile.year)) * 2 + (S.profile.term === '1' ? 1 : 0));
const isNew = () => semNo() === 1;
const isUndecl = () => !!(DEPTS[S.profile.dept] && DEPTS[S.profile.dept].undeclared) && semNo() <= 2;
const mode = () => isUndecl() ? 'undec' : (semNo() === 1 ? 'first' : 'cont');
const grade = () => Math.max(1, Math.min(4, Math.ceil(semNo() / 2)));
hooks.mode = mode;
const spot = (ai, money) => `class="spot" ${ai?`data-ai="${esc(ai)}"`:''} ${money?`data-money="${esc(money)}"`:''}`;
function toast(m){ const el = document.getElementById('toast'); el.textContent = m; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(()=> el.hidden = true, 2600); }

const ICON = {
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
 study:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c2.5 2 7.5 2 10 0v-5"/></svg>',
 tt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 5v15M15 5v15"/></svg>',
 comm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M15 15c2.3-.4 4.4.8 5.3 3.6"/></svg>',
 qa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5" stroke-linecap="round"/></svg>',
 close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 google:'<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
 send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

/* ======================= RAIL ======================= */
const STEPS = [
 {k:'guest',t:'비로그인 홈',s:'학사 일정과 시기별 공통 안내만'},
 {k:'login',t:'Google 로그인 · 자가진단',s:'학과·학번에 따라 과목이수표 단계 분기'},
 {k:'home',t:'맞춤 홈 · 시기별 할 일',s:'모르는 걸 모르는 순간을 먼저 알림'},
 {k:'study',t:'남은 필수 과목',s:'요람 페이지를 출처로 표시'},
 {k:'tt',t:'추천 시간표 · 수강신청 가이드',s:'장바구니 순서, 이름 바뀐 과목'},
 {k:'bill',t:'빌넣 모드',s:'허가서 링크 · 메일 초안 · 모국어 설명'},
 {k:'comm',t:'커뮤니티',s:'선배 강의평 · AI 번역 · 포인트'},
 {k:'qa',t:'Q&A',s:'근거 기반 AI 상담 · FAQ · 부서 안내'},
 {k:'dash',t:'국제처 화면',s:'B2B 구독 · 반복 질문 → FAQ 자동화'}
];
const natOptions = sel => {
 const rest = NATION_CODES.filter(c => !NATIONS_TOP.includes(c)).sort((a,b) => natName(a,S.lang).localeCompare(natName(b,S.lang),S.lang));
 const opt = c => `<option value="${c}" ${sel===c?'selected':''}>${esc(natName(c,S.lang))}</option>`;
 return `<optgroup label="${S.lang==='ko'?'자주 선택':'Common'}">${NATIONS_TOP.map(opt).join('')}</optgroup><optgroup label="${S.lang==='ko'?'전체 국가':'All countries'}">${rest.map(opt).join('')}</optgroup>`;
};
function onboarding(){
 const ko = S.lang==='ko';
 return `<div class="onb"><div class="onb-top"><select class="langsel" id="langSel" aria-label="Language">${LANGS.map(([k,n])=>`<option value="${k}" ${S.lang===k?'selected':''}>${n}</option>`).join('')}</select></div>
  <div class="onb-mid"><div class="logo big"><i></i><span>${esc(S.appName)}</span></div>
   <p class="onb-line">${t('intro')}</p></div>
  <div class="onb-bot">
   <button class="btn" data-act="onbStart">${ko?'시작하기':'Get started'}</button></div></div>`;
}
function renderRail(){
 const r = document.getElementById('rail');
 r.innerHTML = `
  <div class="brand"><small>서비스 이름 (바꾸면 앱에 바로 반영)</small>
   <input id="appName" value="${esc(S.appName)}" aria-label="서비스 이름"></div>
  <p class="thesis">유학생이 모르는 걸 모르는 순간, 내 학번과 시기에 맞춰 먼저 알려주는 학사 내비게이터</p>
  <div><h3>화면</h3><div class="seg c2" role="group" aria-label="화면 전환">
   <button data-act="mode" data-v="student" aria-pressed="${S.mode==='student'}">학생 앱</button>
   <button data-act="mode" data-v="admin" aria-pressed="${S.mode==='admin'}">국제처 화면</button></div></div>
  <div><h3>로그인 상태</h3><div class="seg c2" role="group" aria-label="로그인 상태">
   <button data-act="auth" data-v="out" aria-pressed="${!S.loggedIn}">비로그인</button>
   <button data-act="auth" data-v="in" aria-pressed="${S.loggedIn}">로그인</button></div></div>
  <div><h3>학생 유형 (로그인 시)</h3><div class="seg" style="grid-template-columns:1fr" role="group" aria-label="학생 유형">
   ${Object.entries(PERSONAS).map(([k,v])=>`<button data-act="persona" data-v="${k}" aria-pressed="${S.persona===k}">${v.label}</button>`).join('')}</div></div>
  <div><h3>시기 (데모 날짜)</h3><div class="seg c5" role="group" aria-label="시기">
   ${PHASE_KEYS.map(k=>`<button data-act="phase" data-v="${k}" aria-pressed="${S.phase===k}">${STR.ko.phases[k]}<small>${md(PHASES[k].date)}</small></button>`).join('')}</div></div>
  <div><h3>시연 순서</h3><ol class="steps">${STEPS.map((x,i)=>`<li><button data-act="step" data-v="${x.k}" class="${S.step===i+1?'on':''}" data-i="${i+1}"><span class="n">0${i+1}</span><span>${x.t}<small>${x.s}</small></span></button></li>`).join('')}</ol></div>
  <div style="display:flex;flex-direction:column;gap:10px">
   <label class="sw" for="tgAI"><span>AI 활용 지점 표시<small>RAG·생성·번역이 쓰이는 곳</small></span><input type="checkbox" id="tgAI" ${S.showAI?'checked':''}></label>
   <label class="sw" for="tgMoney"><span>수익 지점 표시<small>제휴 수수료·B2B가 생기는 곳</small></span><input type="checkbox" id="tgMoney" ${S.showMoney?'checked':''}></label>
  </div>
  <details class="box"><summary>로그인 권한 비교</summary>
   <table class="perm" style="margin-top:8px"><tr><th>기능</th><th>비로그인</th><th>로그인</th></tr>
   <tr><td>학사 일정 · 시기별 공통 안내</td><td class="y">가능</td><td class="y">가능</td></tr>
   <tr><td>FAQ · 부서 안내 · 요람 보는 법</td><td class="y">가능</td><td class="y">가능</td></tr>
   <tr><td>AI 상담</td><td>일반 답변</td><td class="y">내 학번 기준</td></tr>
   <tr><td>커뮤니티</td><td>읽기만</td><td class="y">쓰기 · 답변 · 포인트</td></tr>
   <tr><td>남은 필수 과목 · 요람 출처</td><td class="n">불가</td><td class="y">가능</td></tr>
   <tr><td>추천 시간표 · 신청 가이드 · 빌넣</td><td class="n">불가</td><td class="y">가능</td></tr>
   <tr><td>비자·마감 D-day 알림</td><td class="n">불가</td><td class="y">가능</td></tr></table></details>
  <div class="row" style="flex-wrap:wrap"><button class="ghost" data-act="reset">처음부터 다시</button></div>
  <p class="fine">시연용 프로토타입이에요. 학사 일정, 요람 페이지, 과목, 장학 기준, 국제처 수치는 모두 예시예요. 법령 조항(출입국관리법 제20·25·31조 등)은 실제 근거예요. AI 응답은 시연 안정성을 위해 규칙으로 동작하고, 실제 서비스는 RAG + LLM으로 대체해요. 시간표 추천은 실제 규칙(우선순위·선수과목·시간 충돌·학점 상한·선호)으로 계산하지만 개설 강좌 데이터는 예시예요. 세인트의 과목이수표 다운로드 경로는 실제 화면으로 확인이 필요해요.</p>`;
}

/* ======================= APP SCREENS ======================= */
/* ======================= 알림 ======================= */
const nt = k => (NOTI_UI[S.lang] && NOTI_UI[S.lang][k] !== undefined) ? NOTI_UI[S.lang][k] : NOTI_UI.en[k];
const unreadN = () => S.notis.filter(n => n.unread).length;
let notiTimers = [];
const clearNotiTimers = () => { notiTimers.forEach(clearTimeout); notiTimers = []; };
/* 비로그인이면 알림을 비우고, 로그인하면 데모 알림을 한 번 채운다 */
function syncNotis(){
 if (!S.loggedIn){
  S.notis = []; S.notiSeeded = false; S.notiShown = null; clearNotiTimers();
  if (S.overlay === 'noti') S.overlay = null;
 } else if (!S.notiSeeded){
  S.notis = NOTI_INIT.map(n => ({...n})); S.notiSeeded = true;
 }
}
const badgeHtml = pop => { const n = unreadN(); return n ? `<span class="nbadge${pop?' pop':''}" aria-hidden="true">${n > 9 ? '9+' : n}</span>` : ''; };
function avatarBtn(){
 const n = unreadN(), pop = S.notiShown !== null && n !== S.notiShown; S.notiShown = n;
 return `<button class="avatar" id="avatarBtn" data-act="notiOpen" aria-label="${nt('aria')(n)}">${esc(S.profile.name.slice(0,1))}${badgeHtml(pop)}</button>`;
}
/* 도착·읽음 때 화면 전체를 다시 그리지 않고 배지와 열린 목록만 갱신 */
function refreshNoti(){
 const av = document.getElementById('avatarBtn');
 if (av){
  const n = unreadN(), pop = n !== S.notiShown; S.notiShown = n;
  av.setAttribute('aria-label', nt('aria')(n));
  const old = av.querySelector('.nbadge'); if (old) old.remove();
  av.insertAdjacentHTML('beforeend', badgeHtml(pop));
 }
 const ov = document.getElementById('notiov'); if (ov) ov.outerHTML = notiOverlay();
}
function pushNoti(n){
 if (!S.loggedIn || S.notis.some(x => x.id === n.id)) return;
 S.notis.unshift({...n, when:{ko:NOTI_UI.ko.now,en:NOTI_UI.en.now}, unread:true});
 refreshNoti();
}
/* 시연용: 시기에 맞는 알림을 1초 간격으로 하나씩 */
function queuePhaseNotis(phase){
 clearNotiTimers();
 (NOTI_PHASE[phase] || []).forEach((n, i) => notiTimers.push(setTimeout(() => pushNoti(n), (i + 1) * 1000)));
}
function notiOverlay(){
 const n = unreadN();
 const cards = S.notis.map(x => `<button class="noti-card${x.unread?' unread':''}" data-act="notiGo" data-v="${esc(x.id)}">
   <span class="noti-top"><span class="noti-ic">${tx(x.ic)}</span><span class="noti-when">${tx(x.when)}</span></span>
   <span class="noti-t">${tx(x.t)}</span><span class="noti-d">${tx(x.d)}</span>${x.unread?'<i class="noti-dot" aria-hidden="true"></i>':''}</button>`).join('');
 return `<div class="overlay" id="notiov" role="dialog" aria-label="${nt('title')}"><div class="ovhead"><b>${nt('title')}</b><button class="ovx" data-act="closeOv" aria-label="${t('close')}">${ICON.close}</button></div>
  <div class="scroll noti-list"><button class="btn line noti-prof" data-act="logoutAsk">${nt('profile')}</button>
  ${S.notis.length ? `<div class="noti-sum"><b>${nt('newN')(n)}</b><button data-act="notiAll" ${n?'':'disabled'}>${nt('readAll')}</button></div>${cards}` : `<div class="noti-empty">${nt('empty')}</div>`}</div></div>`;
}

function renderMain(){
 syncNotis();
 document.body.classList.toggle('show-ai', S.showAI);
 document.body.classList.toggle('show-money', S.showMoney);
 const m = document.getElementById('main');
 if (DEMO && S.mode === 'admin') { m.innerHTML = dashboard(); return; }
 m.innerHTML = `<div class="device-wrap"><div class="device"><div class="screen" id="screen">${screen()}</div></div></div>`;
 const ms = document.querySelector('.msgs'); if (ms) ms.scrollTop = ms.scrollHeight;
 requestAnimationFrame(() => {
  const tc = document.getElementById('tcar');
  if (tc && tc.clientWidth) tc.scrollLeft = S.taskI * tc.clientWidth;
 });
}

function screen(){
 if (S.onboard) return onboarding();
 const head = `<div class="apphead"><div class="logo"><i></i><span>${esc(S.appName)}</span></div>
  <div class="headr">${S.loggedIn ? avatarBtn() : ''}</div></div>`;
 let body;
 if (S.tab === 'home') body = `<div class="scroll">${home()}</div>`;
 else if (S.tab === 'study') body = `<div class="scroll">${study()}</div>`;
 else if (S.tab === 'tt') body = `<div class="scroll">${timetable()}</div>`;
 else if (S.tab === 'comm') body = `<div class="scroll">${community()}</div>`;
 else body = qa();
 const tabs = ['home','study','tt','comm','qa'];
 const bar = `<nav class="tabbar">${tabs.map(k=>`<button data-act="tab" data-v="${k}" ${S.tab===k?'aria-current="page"':''}>${ICON[k]}${t(k)}</button>`).join('')}</nav>`;
 let ov = '';
 if (S.overlay === 'login') ov = loginOverlay();
 else if (S.overlay === 'bill') ov = billOverlay();
 else if (S.overlay === 'compose') ov = composeOverlay();
 else if (S.overlay === 'logout') ov = logoutOverlay();
 else if (S.overlay === 'noti') ov = notiOverlay();
 return head + `<div style="flex:1;min-height:0;display:flex;flex-direction:column">${body}</div>` + bar + ov;
}

function lockCard(preview){
 return `<div class="card lock"><div class="blur">${preview}</div>
  <div class="over"><b>${t('lockT')}</b><p>${t('lockB')}</p><button class="btn sm" data-act="openLogin">${t('login')}</button></div></div>`;
}

function calendar(){
 const now = today();
 const items = CAL.filter(c => parse(c[1]||c[0]) >= now).slice(0,5);
 return `<div class="card"><ul class="cal">${items.map(c=>{
  const cur = parse(c[0]) <= now && parse(c[1]||c[0]) >= now;
  return `<li class="${cur?'now':''}"><span class="d">${md(c[0])}${c[1]?'–'+md(c[1]).slice(-2):''}</span><span>${tx(c[2])}${cur?' · '+(S.lang==='ko'?'진행 중':'now'):''}</span></li>`;}).join('')}</ul>
  <span class="s">${S.lang==='ko'?'학교 학사 일정 (예시)':'School calendar (example)'}</span></div>`;
}

/* 시기별 할 일 + 자가진단 답으로 개인화 */
function myTasks(){
 const A = S.ans;
 const base = PHASES[S.phase].tasks.filter(id => {
  if (id==='usim') return A.usim!=='yes';
  if (id==='arc') return A.arc!=='yes';
  if (id==='sid') return isNew();
  if (id==='extend') return !isNew();
  if (id==='renamed') return mode()==='cont';
  return true; });
 const extra = [];
 if (A.arc!=='yes') extra.push('arc');
 if (A.usim!=='yes') extra.push('usim');
 if (A.house==='off') extra.push('move15');
 if (A.house==='off' || A.house==='searching') extra.push('lease');
 return [...new Set([...base, ...extra])];
}
function taskCard(id){
 const k0 = TASKS[id]; if (!k0) return '';
 const k = {...k0}; const ko = S.lang==='ko';
 if (id==='arc' && S.ans.arc==='unknown') k.d = {ko:'외국인등록증(ARC)은 한국에 90일 넘게 머무는 외국인의 신분증이에요. 입국 90일 안에 꼭 받아야 해요. 하이코리아에서 방문 예약부터 잡으세요.',en:'The ARC is the ID card for foreigners staying over 90 days. Get it within 90 days of arrival. Book on HiKorea first.'};
 if (id==='reqcheck' && mode()==='first') k.d = {ko:'첫 학기라 과목이수표 없이 요람 기준 1학년 1학기 과목을 보여드려요.',en:'First term: we show year-1 courses from the handbook, no record needed.'};
 if (id==='reqcheck' && mode()==='undec') { k.t = {ko:'전공 결정 전 들을 과목 확인',en:'Courses before choosing a major'}; k.d = {ko:'1학년은 공통 교양과 전공 탐색 과목 위주예요. 전공 결정 시기도 알려드려요.',en:'Year 1 is common and exploration courses. We also track the major declaration date.'}; }
 if (id==='usim' && S.ans.usim==='how') k.d = {ko:'여권만 있으면 선불 유심을 바로 개통할 수 있어요. 순서: 여권 준비 → 선불 요금제 선택 → 매장 또는 온라인 개통.',en:'With a passport you can get a prepaid SIM now: passport → choose a prepaid plan → activate in store or online.'};
 const n = k.due ? diff(k.due) : null;
 const goBtn = k.link ? `<button class="go" data-act="partner" data-v="${id}">${tx(k.link)} →</button>` : k.act ? `<button class="go" data-act="taskgo" data-v="${k.act}">${t('go')} →</button>` : '';
 return `<div ${spot(k.ai,k.money)}><div class="card task">
  <div class="ic ${k.cat}">${tx(CATLBL[k.cat]).slice(0,2)}</div>
  <div style="min-width:0;display:flex;flex-direction:column;gap:3px"><span class="t">${tx(k.t)}</span><span class="s">${tx(k.d)}</span>
   <div class="row" style="flex-wrap:wrap">${k.src?`<span class="src">${k.src}</span>`:''}${goBtn}</div></div>
  ${n!=null?`<span class="dd ${ddClass(n)}">${ddLabel(n)}</span>`:'<span></span>'}</div></div>`;
}

/* 체크리스트 가로 캐러셀: CSS scroll-snap, 위치는 S.taskI에 저장해 render 뒤 복원 */
function taskCarousel(tasks){
 const cards = tasks.map(taskCard).filter(Boolean), n = cards.length;
 /* 로그인·학생 유형·시기·언어·카드 수가 바뀌면 첫 카드부터 */
 const key = [S.loggedIn, S.persona, S.phase, S.lang, n].join('|');
 if (S.taskKey !== key) { S.taskKey = key; S.taskI = 0; }
 S.taskI = Math.min(S.taskI, Math.max(0, n - 1));
 return `<div class="twrap"><div class="sec"><h2>${t('week')}</h2>${n>1?`<span class="tpos" id="tpos">${S.taskI+1} / ${n}</span>`:''}</div>
  <div class="tcar" id="tcar">${cards.map(c=>`<div class="slide">${c}</div>`).join('')}</div>
  ${n>1?`<div class="tdots" id="tdots">${cards.map((_,i)=>`<button class="${i===S.taskI?'on':''}" data-act="taskDot" data-v="${i}" aria-label="${i+1} / ${n}"></button>`).join('')}</div>`:''}</div>`;
}
function taskScrolled(el){
 if (!el.clientWidth) return;
 const i = Math.round(el.scrollLeft / el.clientWidth), n = el.children.length;
 if (i === S.taskI || i < 0 || i >= n) return;
 S.taskI = i;
 const pos = document.getElementById('tpos'); if (pos) pos.textContent = `${i+1} / ${n}`;
 document.querySelectorAll('#tdots button').forEach((d,j) => d.classList.toggle('on', j === i));
}
document.addEventListener('scroll', e => { if (e.target.id === 'tcar') taskScrolled(e.target); }, true);

function home(){
 const ph = PHASES[S.phase];
 if (!S.loggedIn) {
  return `<div class="banner"><span class="eyebrow">${t('phases')[S.phase]} · ${md(ph.date)}</span><b>${tx(ph.out)}</b><span class="s">${t('guest')}</span></div>
   <div class="sec"><h2>${t('cal')}</h2></div>${calendar()}
   <div class="sec"><h2>${t('week')}</h2></div>
   ${lockCard(`<div class="card task"><div class="ic visa">체류</div><div><span class="t">외국인등록</span></div><span class="dd hot">D-25</span></div>
    <div class="card task"><div class="ic study">학업</div><div><span class="t">자료구조 · 이산구조</span></div><span class="dd">D-7</span></div>`)}
   <div class="sec"><h2>${t('faq')}</h2><button data-act="tab" data-v="qa">${t('all')}</button></div>
   <div class="card">${FAQ.slice(0,3).map(f=>`<div class="row sb"><span class="p">${tx(f.q)}</span></div>`).join('<hr style="border:0;border-top:1px solid var(--line);margin:0">')}</div>`;
 }
 const due = diff(BANNER_DUE[S.phase]);
 const tasks = myTasks();
 const remain = REQ.filter(r=>r.st!=='done');
 const ko = S.lang==='ko';
 const reqBlock = mode()==='undec'
  ? `<div ${spot('학부 규정 RAG')}><div class="card"><div class="row sb"><span class="t">${ko?'전공 결정 전이에요':'Major not chosen yet'}</span><span class="pill">${tx(DEPTS[S.profile.dept])}</span></div>
     <span class="s">${ko?'1학년에는 전공 이수과목이 아직 없어요. 공통 교양과 전공 탐색 과목을 추천해요.':'No major courses in year 1. We suggest common and exploration courses.'}</span>
     <span class="dd hot" style="align-self:flex-start">${ko?'전공 결정 신청':'Major declaration'} ${ddLabel(diff('2026-11-16'))}</span></div></div>`
  : `<div ${spot('요람 RAG')}><div class="card"><div class="row sb"><span class="t">${remain.length}${ko?'과목 남았어요':' left'}</span><span class="pill acc">${mode()==='first'?(ko?'첫 학기 · 요람 기준':'First term · handbook'):(ko?'이번 학기 추천 3':'3 this term')}</span></div>
     <div class="row" style="flex-wrap:wrap">${(mode()==='first'?[{n:{ko:'기초컴퓨터프로그래밍',en:'Intro to Programming'}},{n:{ko:'미적분학 I',en:'Calculus I'}}]:remain.filter(r=>r.st==='now')).map(r=>`<span class="pill">${tx(r.n)}</span>`).join('')}</div>
     <span class="src">${S.profile.year} 요람 · 컴퓨터공학과 교육과정 p.142 (예시)</span></div></div>`;
 return `<div ${spot('시기 × 학번 맞춤 생성')}><div class="banner"><span class="eyebrow">${t('phases')[S.phase]} · ${md(ph.date)}</span>
   <b>${tx(ph.inn(due))}</b><span class="s">${t('hi')(esc(S.profile.name))} · ${tx(DEPTS[S.profile.dept])} ${grade()}${S.lang==='ko'?'학년':''}</span></div></div>
  ${taskCarousel(tasks)}
  <div class="sec"><h2>${t('remain')}</h2><button data-act="tab" data-v="study">${t('all')}</button></div>
  ${reqBlock}
  <div class="sec"><h2>${t('cal')}</h2></div>${calendar()}`;
}

/* ---------- Study ---------- */
function study(){
 if (!S.loggedIn) {
  return lockCard(`<div class="prog"><div class="card"><b>34/130</b></div><div class="card"><b>2/9</b></div></div><div class="card">자료구조 · 이산구조 · 컴퓨터구조</div>`) +
  `<div class="sec"><h2>${S.lang==='ko'?'요람 보는 법':'How to read the handbook'}</h2></div>
   <div class="card"><ol class="howto">
    <li>${S.lang==='ko'?'학교 홈페이지에서 내 입학 연도의 요람을 열어요.':'Open the handbook for your entry year.'}</li>
    <li>${S.lang==='ko'?'학과 교육과정 표에서 전공필수·전공선택·교양필수를 구분해요.':'Separate major-required, elective and general-required courses.'}</li>
    <li>${S.lang==='ko'?'과목마다 권장 학년·학기와 선수과목을 확인해요.':'Note the recommended semester and prerequisites.'}</li>
    <li>${S.lang==='ko'?'세인트의 과목이수표와 비교해 안 들은 과목을 찾아요.':'Compare with your course record to find what is left.'}</li></ol>
    <span class="s">${S.lang==='ko'?'로그인하면 이 네 단계를 AI가 대신 해요.':'Log in and the AI does these four steps for you.'}</span></div>`;
 }
 const ko = S.lang==='ko', M = mode();
 const tip = S.ans.yoram==='unknown' ? `<div class="card" style="background:var(--accent-soft);border-color:transparent"><span class="t">${ko?'요람이 뭔가요?':'What is the handbook?'}</span><span class="p">${ko?'졸업 요건과 교과목이 나와 있는 책이에요. 입학 연도마다 달라요. 아래는 AI가 내 입학 연도 요람을 대신 읽고 정리한 결과예요.':'A book of graduation requirements and courses, different for each entry year. Below, the AI has read your year’s handbook for you.'}</span></div>` : '';
 if (M==='undec') {
  const pool = POOLS.undec;
  return tip + `<div ${spot('학부 규정 RAG')}><div class="card"><div class="row sb"><span class="t">${tx(DEPTS[S.profile.dept])} · ${ko?'1학년':'Year 1'}</span><span class="pill">${ko?'전공 결정 전':'Undeclared'}</span></div>
   <p class="p">${ko?'이 학부는 1학년 동안 전공 이수과목이 나오지 않아요. 그래서 과목이수표 대신 공통 교양과 전공 탐색 과목을 기준으로 안내해요.':'This school has no major courses in year 1, so we guide you with common and exploration courses instead of a course record.'}</p>
   <span class="dd hot" style="align-self:flex-start">${ko?'전공 결정 신청':'Major declaration'} ${ddLabel(diff('2026-11-16'))}</span><span class="src">학부 학사 안내 (예시 일정)</span></div></div>
   <div class="sec"><h2>${ko?'1학년에 들을 과목':'Year 1 courses'}</h2></div>
   ${pool.map(c=>`<div class="card course"><div class="row sb"><span class="t">${tx(c.n)}</span><span class="pill ${c.pri===2?'acc':''}">${tx(c.tag)}</span></div><span class="s">${tx(c.cart)}</span></div>`).join('')}
   <div class="card"><span class="t">${ko?'전공 고르기 전에 확인할 것':'Before choosing a major'}</span><ol class="howto"><li>${ko?'전공별 1학년 권장 과목을 들었는지':'Whether you took each major’s recommended year-1 courses'}</li><li>${ko?'전공 결정 신청 기간과 방법':'The declaration period and process'}</li><li>${ko?'선배들의 전공 후기 (커뮤니티)':'Senior reviews of each major (Community)'}</li></ol></div>`;
 }
 const reqs = M==='first' ? REQ.map(r => r.sem==='1-1' ? {...r, st:'now', why:{ko:'1학년 1학기 권장 전공필수예요. 첫 학기라 이수 내역 없이 요람 기준으로 추천했어요.',en:'Recommended for your first term. No record needed.'}} : (r.st==='done' ? {...r, st:'next', why:null} : r)) : REQ;
 const V = M==='first' ? ['0 / 130','0 / 9','0 / 42','0 / 6',[0,0,0,0]] : ['34 / 130','2 / 9','6 / 42','4 / 6',[26,22,14,66]];
 const st = {now:['acc',{ko:'이번 학기 추천',en:'Take this term'}],next:['warn',{ko:'다음 학기',en:'Next term'}],lock:['',{ko:'선수과목 필요',en:'Needs prerequisite'}],later:['',{ko:'4학년',en:'Year 4'}],done:['ok',{ko:'이수 완료',en:'Done'}]};
 return tip + `${S.profile.dept!=='cs'?`<span class="s">${ko?'시연 데이터는 컴퓨터공학과 기준이에요':'Demo data uses Computer Science'}</span>`:''}<div class="prog">
   <div class="card"><span class="s">${ko?'총 이수 학점':'Total credits'}</span><b>${V[0]}</b><div class="bar"><i style="width:${V[4][0]}%"></i></div></div>
   <div class="card"><span class="s">${ko?'전공필수':'Major required'}</span><b>${V[1]}</b><div class="bar"><i style="width:${V[4][1]}%"></i></div></div>
   <div class="card"><span class="s">${ko?'전공선택':'Major elective'}</span><b>${V[2]}</b><div class="bar"><i style="width:${V[4][2]}%"></i></div></div>
   <div class="card"><span class="s">${ko?'교양필수':'General required'}</span><b>${V[3]}</b><div class="bar"><i style="width:${V[4][3]}%"></i></div></div></div>
  <span class="s">${M==='first'?(ko?'첫 학기라 과목이수표 없이 요람 기준으로 보여줘요 · 기준은 예시':'First term: shown from the handbook only · example data'):(ko?'과목이수표 PDF에서 인식 · 졸업 학점 등 기준은 예시':'Read from your course record · requirements are examples')}</span>
  <div class="sec"><h2>${t('remain')}</h2></div>
  ${reqs.map(r=>{ const [cls,lbl] = st[r.st];
   return `<div ${r.why?spot('요람 RAG · 이유 설명'):'class="spot"'}><div class="card course">
    <div class="row sb"><span class="t">${tx(r.n)}${r.gen?` <span class="pill">${S.lang==='ko'?'교양':'Gen.'}</span>`:''}</span><span class="pill ${cls}">${tx(lbl)}</span></div>
    ${r.old?`<span class="s">${tx(r.old)} · ${S.lang==='ko'?'같은 과목으로 인정':'counts as the same course'}</span>`:''}
    ${r.why?`<p class="why"><b>${t('why')}</b> ${tx(r.why)}</p>`:''}
    <div class="row" style="flex-wrap:wrap"><span class="s">${S.lang==='ko'?'권장':'Rec.'} ${r.sem}</span>${r.page?`<span class="src">2025 요람 ${r.page} (예시)</span>`:''}</div></div></div>`;}).join('')}
  <div class="sec"><h2>${S.lang==='ko'?'전공 · 복수전공 · 교환학생':'Major, double major, exchange'}</h2></div>
  <div class="card"><p class="p">${S.lang==='ko'?'외국인도 복수전공과 교환학생을 신청할 수 있어요. 학부제로 입학했다면 전공 결정 시기를 놓치지 마세요.':'International students can apply for double majors and exchange. If you entered without a major, do not miss the major selection period.'}</p>
   <span class="dd hot" style="align-self:flex-start">${S.lang==='ko'?'복수전공 신청':'Double major'} ${ddLabel(diff('2026-07-06'))}</span></div>`;
}

/* ---------- Timetable ---------- */
function ttGrid(plan){
 const days = S.lang==='ko'?['월','화','수','목','금']:['Mon','Tue','Wed','Thu','Fri'];
 let h = days.map((d,i)=>`<div class="dh" style="grid-column:${i+2};grid-row:1">${d}</div>`).join('');
 for (let r=0;r<18;r+=2) h += `<div class="hr" style="grid-column:1;grid-row:${r+2}/span 2">${9+r/2}</div><div class="gl" style="grid-column:2/7;grid-row:${r+2}"></div>`;
 plan.forEach(c => c.slots.forEach(([d,s,e]) => {
  const rs = Math.floor((s-540)/30)+2, re = Math.ceil((e-540)/30)+2;
  h += `<div class="blk c${c.c}" style="grid-column:${d+2};grid-row:${rs}/${re}">${tx(c.n)}</div>`;
 }));
 return `<div class="tt" aria-label="timetable">${h}</div>`;
}
function timetable(){
 if (!S.loggedIn) {
  return lockCard(`<div class="tt" style="height:200px"></div>`) +
   `<div class="sec"><h2>${S.lang==='ko'?'수강신청 하는 법':'How registration works'}</h2></div>
   <div class="card"><ol class="howto">
    <li>${S.lang==='ko'?'장바구니(예비 수강신청) 기간에 과목을 담아요.':'Add courses during the pre-registration cart period.'}</li>
    <li>${S.lang==='ko'?'신청 당일 시작 시간에 맞춰 세인트에 미리 로그인해요.':'Log in to the portal before opening time.'}</li>
    <li>${S.lang==='ko'?'경쟁이 센 과목부터 신청하고, 실패하면 대안 분반을 넣어요.':'Register the most competitive courses first; switch sections if you miss.'}</li>
    <li>${S.lang==='ko'?'못 잡은 과목은 수강정정 기간에 빌넣을 시도해요.':'Request missed courses during add/drop.'}</li></ol></div>`;
 }
 const ko = S.lang==='ko';
 const {plan, notes, cr: credits} = genPlan();
 const P = S.pref;
 const sub = `<div class="subtabs" style="grid-template-columns:1fr 1fr"><button data-act="ttv" data-v="plan" aria-pressed="${S.ttView==='plan'}">${t('rec')}</button><button data-act="ttv" data-v="guide" aria-pressed="${S.ttView==='guide'}">${t('guide')}</button></div>`;
 if (S.ttView === 'plan') {
  const reqN = plan.filter(c=>c.pri===1).length;
  const why = [
   mode()==='undec' ? (ko?'전공 결정 전이라 공통 교양필수와 전공 탐색 과목으로 짰어요':'Undeclared: common required and exploration courses') : (ko?`요람 기준 아직 안 들은 전공필수 ${reqN}과목을 먼저 넣었어요`:`${reqN} required major courses you have not taken come first`),
   ...plan.filter(c=>c.pre).map(c=>`${tx(c.base)}: ${tx(c.pre)}`),
   ko?`시간 겹침 없음 · 총 ${credits}학점 (최대 ${P.max})`:`No time clashes · ${credits} credits (max ${P.max})`,
   ...notes.map(tx)];
  return sub + `<div ${spot('요람·선수과목·개설강좌 기반 생성')}><div class="card">
   <div class="row sb"><span class="t">2026-1 · ${credits}${ko?'학점':' credits'}</span>
    <button class="btn sm line" data-act="alt">${S.alt?(ko?'처음 추천으로':'Back to first plan'):(ko?'다른 분반 조합':'Other sections')}</button></div>
   ${ttGrid(plan)}</div></div>
   <div class="card"><span class="t">${ko?'내 조건':'My preferences'}</span>
    <div class="prefs">
     <button data-act="pmax" aria-pressed="${P.max===15}">${ko?'최대 15학점':'Max 15 credits'}</button>
     <button data-act="pmax18" aria-pressed="${P.max===18}">${ko?'최대 18학점':'Max 18 credits'}</button>
     <button data-act="pref" data-v="noNine" aria-pressed="${P.noNine}">${ko?'9시 수업 피하기':'Avoid 9 a.m.'}</button>
     <button data-act="pref" data-v="freeFri" aria-pressed="${P.freeFri}">${ko?'금요일 공강':'Free Fridays'}</button>
     <button data-act="pref" data-v="eng" aria-pressed="${P.eng}">${ko?'영어강의 우선':'Prefer English'}</button></div>
    <span class="s">${ko?'바꾸면 시간표를 바로 다시 짜요':'Changing these rebuilds the timetable'}</span></div>
   ${plan.map(c=>`<div class="card" style="padding:9px 12px"><div class="row sb"><span class="t">${tx(c.n)}${c.eng?` <span class="pill">EN</span>`:''}</span><span class="row"><span class="pill ${c.pri===1?'acc':''}">${tx(c.tag)}</span><span class="s">${c.cr}${ko?'학점':'cr'}</span></span></div></div>`).join('')}
   <div class="card"><span class="t">${ko?'이렇게 짠 이유':'Why this plan'}</span>
    <ul class="howto" style="list-style:none">${why.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>
    <span class="s">${ko?'추천 순서: ① 요람상 미이수 필수 → ② 선수과목·권장 학기 → ③ 시간 충돌 제외 → ④ 학점 상한 → ⑤ 내 조건':'Order: ① required courses not yet taken → ② prerequisites & recommended term → ③ no clashes → ④ credit cap → ⑤ your preferences'}</span>
    <div class="row" style="flex-wrap:wrap"><span class="src">${S.profile.year} 요람 (예시)</span><span class="src">2026-1 개설 강좌 (예시 데이터)</span>${mode()==='cont'?'<span class="src">과목이수표 (업로드)</span>':''}</div></div>`;
 }
 const plan2 = [...plan].sort((a,b)=>a.pri-b.pri);
 const anyFail = Object.values(S.reg).includes('fail');
 return sub + `<div class="sec"><h2>${t('cart')}</h2></div>
  <div ${spot('경쟁률·선수과목 기반 순서')}><div class="card"><ol class="cartlist">${plan2.map((c,i)=>`<li><span class="no">${i+1}</span><div><span class="t">${tx(c.n)}</span><br><span class="s">${tx(c.cart)}</span></div></li>`).join('')}</ol></div></div>
  ${mode()==='cont'?`<div class="sec"><h2>${t('renamed')}</h2></div>
  <div ${spot('과목명 매칭')}><div class="card"><div class="row sb"><span class="p">이산수학 <span class="muted">(~2024)</span> → <b>이산구조</b> <span class="muted">(2025~)</span></span></div>
   <div class="row sb"><span class="p">컴퓨터공학설계 → <b>캡스톤디자인 I</b></span></div>
   <span class="s">${ko?'예전 이름으로 검색하면 안 나와요. 같은 과목으로 인정돼요.':'Old names will not show in search. They count as the same course.'}</span><span class="src">교과목 대체 표 (예시)</span></div></div>`:''}
  <div class="sec"><h2>${S.lang==='ko'?'당일 체크리스트':'On the day'}</h2></div>
  <div class="card"><ol class="howto"><li>${S.lang==='ko'?'10분 전 세인트 로그인, 서버 시간 확인':'Log in 10 minutes early and check server time'}</li><li>${S.lang==='ko'?'학수번호·분반을 메모해 두기':'Note course codes and sections'}</li><li>${S.lang==='ko'?'실패하면 대안 B 분반으로 바로 전환':'If you miss, switch to Plan B sections'}</li></ol></div>
  <div class="sec"><h2>${t('result')}</h2></div>
  <div class="card">${plan2.map(c=>`<div class="res"><span class="p">${tx(c.n)}</span>
   <button class="okb ${S.reg[c.id]==='ok'?'on':''}" data-act="reg" data-v="${c.id}" data-r="ok">${t('okb')}</button>
   <button class="failb ${S.reg[c.id]==='fail'?'on':''}" data-act="reg" data-v="${c.id}" data-r="fail">${t('failb')}</button></div>`).join('')}</div>
  ${anyFail?`<div ${spot('메일 초안 생성 · 모국어 설명')}><button class="btn" style="width:100%" data-act="openBill">${t('bill')} →</button></div>`:`<span class="s">${S.lang==='ko'?'실패한 과목이 있으면 빌넣 모드가 열려요.':'Mark a missed course to open add-request mode.'}</span>`}`;
}

/* ---------- Bill (빌넣) overlay ---------- */
function billOverlay(){
 const gp = genPlan().plan;
 const c = gp.find(p=>p.id===S.billCourse) || gp[0];
 const cname = tx(c.base); const ckor = c.base.ko;
 const p = S.profile; const left = diff('2026-03-09');
 const mail = `제목: [수강 허가 요청] ${ckor} 수강을 희망하는 ${DEPTS[p.dept].ko} ${p.name}입니다

${ckor} 교수님께,

안녕하세요. 저는 ${DEPTS[p.dept].ko} ${grade()}학년 ${p.name}(학번 ${p.id})입니다.
이번 학기 수강신청에서 ${ckor} 과목이 정원 마감되어 신청하지 못했습니다.
${c.id==='ds'?'이 과목은 전공 필수이고, 다음 학년의 알고리즘과 운영체제의 선수과목이라 이번 학기에 꼭 수강하고 싶습니다.':(c.pri===1?'이 과목은 전공 필수라 이번 학기에 꼭 수강하고 싶습니다.':'이 과목을 이번 학기에 꼭 수강하고 싶습니다.')}

가능하시다면 수강허가서에 서명을 부탁드려도 될까요?
첫 수업 시간에 허가서를 가지고 찾아뵙겠습니다.

바쁘신 와중에 읽어 주셔서 감사합니다.
${p.name} 드림`;
 S._mail = mail;
 return `<div class="overlay"><div class="ovhead"><b>${S.lang==='ko'?'빌넣 모드':'Add-request mode'} · ${esc(cname)}</b><button class="ovx" data-act="closeOv" aria-label="${t('close')}">${ICON.close}</button></div>
 <div class="scroll" style="padding-top:12px">
  <div class="card stepcard"><span class="no">1</span><div style="display:flex;flex-direction:column;gap:4px">
   <span class="t">${S.lang==='ko'?'지금 신청할 수 있어요':'You can still apply'}</span>
   <span class="s">${S.lang==='ko'?'수강정정 기간(3.03–3.09, 예시) 안에 끝내야 해요.':'Finish within add/drop (Mar 3–9, example).'}</span>
   <span class="dd ${ddClass(left)}" style="align-self:flex-start">${ddLabel(left)}</span></div></div>
  <div class="card stepcard"><span class="no">2</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0">
   <span class="t">${S.lang==='ko'?'수강허가서 받기':'Get the permission form'}</span>
   <span class="s">${S.lang==='ko'?'학교 홈페이지 › 학사 › 서식 자료실에서 ‘수강허가원’을 내려받아요. (경로는 학교마다 달라요)':'Download it from the school website › Academics › Forms. (Paths differ by school)'}</span>
   <a class="btn sm line" style="align-self:flex-start;text-decoration:none" href="https://www.sogang.ac.kr" target="_blank" rel="noopener">${S.lang==='ko'?'서식 자료실 열기 (예시 링크)':'Open forms page (example link)'}</a>
   <div class="formmock" aria-label="수강허가서 작성 예시"><h4>수 강 허 가 원</h4><table>
    <tr><td>교과목명</td><td>${esc(ckor)} (분반 01)</td></tr><tr><td>학수번호</td><td>CSE2010-01 (예시)</td></tr>
    <tr><td>학번 / 성명</td><td>${esc(p.id)} / ${esc(p.name)}</td></tr><tr><td>사유</td><td>${c.pri===1?'전공필수 미이수':'수강 희망'}</td></tr>
    <tr><td>담당교수 서명</td><td class="sig">(서명)</td></tr></table></div>
   <span class="s">${S.lang==='ko'?'↑ 작성 예시예요. 교수님 서명 칸은 비워 두세요.':'↑ A filled example. Leave the signature blank.'}</span></div></div>
  <div ${spot('메일 초안 생성 · 모국어 설명')}><div class="card stepcard"><span class="no">3</span><div style="display:flex;flex-direction:column;gap:8px;min-width:0">
   <span class="t">${S.lang==='ko'?'교수님께 메일 보내기':'Email the professor'}</span>
   <pre class="mail" id="mailText">${esc(mail)}</pre>
   <button class="btn sm" style="align-self:flex-start" data-act="copyMail">${t('copy')}</button>
   <div style="background:var(--ai-soft);border-radius:10px;padding:10px"><span class="s" style="color:var(--ai);font-weight:700">${S.lang==='ko'?'이 메일, 이렇게 읽으세요':'How to read this email'} · ${LANGS.find(l=>l[0]===S.lang)[1]}</span>
    <p class="p" style="margin-top:4px">${BILL_EXPL[S.lang]}</p></div></div></div></div>
  <div class="card stepcard"><span class="no">4</span><div style="display:flex;flex-direction:column;gap:4px">
   <span class="t">${S.lang==='ko'?'다음 절차':'Next steps'}</span>
   <ol class="howto"><li>${S.lang==='ko'?'첫 수업 뒤 교수님께 허가서 서명 받기':'Get the signature after the first class'}</li>
    <li>${S.lang==='ko'?'서명된 허가서를 학과 사무실에 제출':'Submit the signed form to the department office'}</li>
    <li>${S.lang==='ko'?'세인트에서 수강 내역 반영 확인':'Check that it shows in your portal'}</li>
    <li>${S.lang==='ko'?'반영이 안 되면 학과 사무실에 문의':'If not, ask the department office'}</li></ol>
   <button class="btn sm ink" style="align-self:flex-start" data-act="billDone">${S.lang==='ko'?'할 일에 추가 (마감 알림)':'Add to my tasks'}</button></div></div>
 </div></div>`;
}

/* ---------- Community ---------- */
function community(){
 const list = [...S.myPosts, ...POSTS].filter(p=>S.pcat==='all'||p.cat===S.pcat);
 return `${S.loggedIn?`<div ${spot(null,'포인트 → 제휴 혜택')}><div class="card" style="flex-direction:row;justify-content:space-between;align-items:center"><div><span class="s">${t('points')}</span><br><b style="font-family:var(--f-mono);font-size:18px">${S.points}P</b></div><span class="s" style="text-align:right">${S.lang==='ko'?'답변 채택 +50P · 강의평 +20P':'Picked answer +50P · Review +20P'}</span></div></div>`:`<div class="card"><span class="s">${t('guest')} · ${S.lang==='ko'?'읽기만 가능해요':'read only'}</span></div>`}
  <div class="row sb"><div class="chips">${PCATS.map(([k,l])=>`<button data-act="pcat" data-v="${k}" aria-pressed="${S.pcat===k}">${tx(l)}</button>`).join('')}</div></div>
  <button class="btn sm" style="align-self:flex-end" data-act="${S.loggedIn?'compose':'openLogin'}">${t('write')}${S.loggedIn?'':' · '+t('login')}</button>
  ${list.map(p=>{ const trOpen = S.openTr[p.id]; const trText = p.tr ? (p.tr[S.lang]||p.tr.en||p.tr.ko) : null;
   return `<div class="card post">
    <div class="meta"><span class="pill">${tx((PCATS.find(c=>c[0]===p.cat)||PCATS[0])[1])}</span><span class="pill">${p.lang}</span><span>${tx(p.by)}</span>${p.mentor?`<span class="pill acc">${S.lang==='ko'?'선배멘토':'Mentor'}</span>`:''}</div>
    <span class="t">${esc(p.title)}</span><p class="p">${esc(p.body)}</p>
    ${trOpen&&trText?`<div ${spot('다국어 번역')}><p class="tr">${esc(trText)}</p></div>`:''}
    <div class="acts">${trText?`<button data-act="tr" data-v="${p.id}">${trOpen?t('orig'):t('trans')}</button>`:''}<span>♡ ${p.likes + (S.liked[p.id]?1:0)}</span>${p.ans.length?`<span>${S.lang==='ko'?'답변':'Answers'} ${p.ans.length}</span>`:''}</div>
    ${p.ans.map(a=>`<div class="ans"><div class="meta"><span>${tx(a.by)}</span>${a.picked?`<span class="pill ok">${S.lang==='ko'?'채택 +50P':'Picked +50P'}</span>`:''}</div><span>${esc(tx(a.t))}</span></div>`).join('')}
   </div>`;}).join('')}
  <span class="s">${S.lang==='ko'?'예시 게시글 · 교수님 이름은 익명 처리':'Example posts · professor names anonymized'}</span>`;
}
function composeOverlay(){
 return `<div class="overlay"><div class="ovhead"><b>${t('write')}</b><button class="ovx" data-act="closeOv" aria-label="${t('close')}">${ICON.close}</button></div>
  <form class="scroll" id="composeForm" style="padding-top:12px">
   <div class="field"><label for="cCat">${S.lang==='ko'?'카테고리':'Category'}</label><select id="cCat">${PCATS.slice(1).map(([k,l])=>`<option value="${k}">${tx(l)}</option>`).join('')}</select></div>
   <div class="field"><label for="cTitle">${S.lang==='ko'?'제목':'Title'}</label><input id="cTitle" required value="${S.lang==='ko'?'이산구조 B교수님 강의평':'Review: Discrete Structures, Prof. B'}"></div>
   <div class="field"><label for="cBody">${S.lang==='ko'?'내용':'Body'}</label><textarea id="cBody" rows="5" required>${S.lang==='ko'?'예제를 많이 풀어 주셔서 유학생도 따라가기 좋아요.':'Lots of worked examples, easy to follow for international students.'}</textarea></div>
   <span class="s">${S.lang==='ko'?'어떤 언어로 써도 다른 학생에게는 AI 번역이 함께 보여요. 강의평은 +20P.':'Write in any language; others see an AI translation. Reviews earn +20P.'}</span>
   <button class="btn" type="submit">${S.lang==='ko'?'올리기':'Post'}</button></form></div>`;
}

/* ---------- Q&A ---------- */
function qa(){
 const sub = `<div style="padding:2px 16px 8px"><div class="subtabs" style="grid-template-columns:repeat(3,1fr)">
  <button data-act="qav" data-v="chat" aria-pressed="${S.qaView==='chat'}">${t('chat')}</button>
  <button data-act="qav" data-v="faq" aria-pressed="${S.qaView==='faq'}">${t('faq')}</button>
  <button data-act="qav" data-v="where" aria-pressed="${S.qaView==='where'}">${t('where')}</button></div></div>`;
 if (S.qaView === 'faq') return sub + `<div class="scroll">${FAQ.map(f=>`<details class="card faq"><summary>${tx(f.q)}</summary><p>${tx(f.a)}</p><div class="row" style="flex-wrap:wrap"><span class="src">${f.src}</span>${f.act==='bill'&&S.loggedIn?`<button class="btn sm line" data-act="openBill">${t('bill')}</button>`:''}</div></details>`).join('')}</div>`;
 if (S.qaView === 'where') return sub + `<div class="scroll"><span class="s">${S.lang==='ko'?'문제가 생기면 어디부터 가야 하는지 알려줘요 (부서명은 학교마다 달라요 · 예시)':'Where to go first when something happens (names differ by school · example)'}</span>
  ${WHERE.map(w=>`<div class="card"><span class="t">${tx(w.p)}</span><span class="p"><b style="color:var(--accent)">→ ${tx(w.d)}</b></span><span class="s">${tx(w.s)}</span></div>`).join('')}</div>`;
 const greet = S.loggedIn
  ? (S.lang==='ko'?`${S.profile.name}님의 학번(${S.profile.id})과 학과 요람을 기준으로 답해요. 근거를 못 찾으면 추측하지 않고 국제처로 넘겨요.`:`I answer using your student ID and your department handbook. If I cannot find a source, I forward the question to the international office.`)
  : (S.lang==='ko'?'학교 공통 규정과 공식 안내로 답해요. 로그인하면 내 학번 기준으로 답할 수 있어요.':'I answer from general school rules and official guides. Log in for answers based on your student ID.');
 const chips = S.lang==='ko'?['나 이번 학기 뭐 들어야 해?','빌넣 어떻게 해?','외국인등록 언제까지야?','재학증명서 어디서 떼?','병원 어느 과 가야 해?','기숙사 와이파이 비번 알려줘']:['What should I take this term?','How do I request a full course?','When is my ARC deadline?','Where do I get certificates?','Which clinic should I go to?','What is the dorm Wi-Fi password?'];
 return sub + `<div class="chatwrap"><div class="msgs">
   <div class="msg bot">${greet}</div>
   ${S.chat.map(m=>m.me?`<div class="msg me">${esc(m.text)}</div>`:`<div ${spot(m.guard?'근거 없으면 답하지 않음':'RAG · 출처 표시')} style="align-self:flex-start;max-width:88%"><div class="msg bot ${m.guard?'guard':''}" style="max-width:100%"><span>${m.text}</span>${m.srcs&&m.srcs.length?`<div class="srcs">${m.srcs.map(s=>`<span class="src">${s}</span>`).join('')}</div>`:''}${m.btn||''}</div></div>`).join('')}
  </div>
  <div class="chips" style="padding:0 16px 8px">${chips.map(c=>`<button data-act="chip" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <form class="composer" id="chatForm"><input id="chatIn" placeholder="${t('ask')}" autocomplete="off" aria-label="${t('ask')}"><button class="send" type="submit" aria-label="send">${ICON.send}</button></form></div>`;
}
function answer(q){
 const s = q.toLowerCase(); const has = a => a.some(k=>s.includes(k)); const ko = S.lang==='ko'; const L = S.loggedIn;
 if (L && mode()!=='cont' && has(['뭐 들어','과목','수업','take this term','course','what should'])) return mode()==='undec'
  ? {text: ko?`${DEPTS[S.profile.dept].ko} 1학년은 전공 이수과목이 아직 없어요. 이번 학기에는 유학생 한국어 I, 대학영어, 신입생 세미나 같은 교양필수와 전공 탐색 과목을 들으세요. 전공 결정 신청 시기도 알려드릴게요.`:'Your school has no major courses in year 1. Take required general courses and exploration courses this term.', srcs:['학부 학사 안내 (예시)'], btn:`<button class="btn sm line" data-act="tab" data-v="tt">${t('rec')} →</button>`}
  : {text: ko?'첫 학기라 이수 내역 없이 요람 기준으로 답해요. 1학년 1학기에는 <b>기초컴퓨터프로그래밍</b>과 <b>미적분학 I</b>을 먼저 들으세요. 자료구조의 선수과목이에요.':'For your first term, take <b>Intro to Programming</b> and <b>Calculus I</b> first.', srcs:[`${S.profile.year} 요람 p.142 (예시)`], btn:`<button class="btn sm line" data-act="tab" data-v="tt">${t('rec')} →</button>`};
 if (has(['뭐 들어','과목','수업','take this term','course','what should'])) return L
  ? {text: ko?`2025 요람 기준으로 이번 학기에는 <b>자료구조</b>와 <b>이산구조</b>(구 이산수학)를 꼭 들으세요. 둘 다 3학년 알고리즘의 선수과목이에요. 유학생 교양필수인 한국어 글쓰기도 남아 있어요.`:`Under the 2025 handbook, take <b>Data Structures</b> and <b>Discrete Structures</b> this term. Both unlock Algorithms. Korean Writing (general required) is also left.`, srcs:['2025 요람 p.142 (예시)','과목이수표 (업로드)'], btn:`<button class="btn sm line" data-act="tab" data-v="tt">${t('rec')} →</button>`}
  : {text: ko?'학과와 입학 연도마다 필수 과목이 달라서 일반 답을 드리기 어려워요. 로그인하고 과목이수표를 올리면 바로 알려드릴게요.':'Required courses depend on your department and entry year. Log in and upload your record for an exact answer.', srcs:[], btn:`<button class="btn sm" data-act="openLogin">${t('login')}</button>`};
 if (has(['빌넣','수강허가','허가','full course','permission'])) return {text: ko?'정원이 찬 과목은 교수님 서명을 받은 수강허가서를 수강정정 기간 안에 학과 사무실에 내면 돼요.':'Get the professor’s signature on a permission form and submit it during add/drop.', srcs:['학사 안내 (예시)'], btn: L?`<button class="btn sm" data-act="openBill">${t('bill')}</button>`:''};
 if (has(['외국인등록','arc','registration','등록증'])) return {text: ko?`입국일로부터 90일 안에 해야 해요.${L&&isNew()?' 2월 1일 입국 기준으로 마감은 5월 1일이에요.':''} 하이코리아에서 방문 예약부터 잡으세요.`:`Within 90 days of arrival. Book a visit on HiKorea first.`, srcs:['출입국관리법 제31조','하이코리아 안내']};
 if (has(['증명서','재학','certificate'])) return {text: ko?'학교 홈페이지 온라인 발급이나 캠퍼스 무인발급기에서 바로 받을 수 있어요. 비자 연장에는 재학증명서와 성적증명서가 둘 다 필요해요.':'Online or at a campus kiosk. Visa extension needs both enrollment and transcript certificates.', srcs:['학교 안내 (예시)','출입국관리법 제25조']};
 if (has(['병원','아파','clinic','sick'])) return {text: ko?'목·코·귀는 이비인후과, 감기·배탈은 내과예요. 학교 보험을 청구하려면 진료비 영수증과 세부내역서를 받아 두세요. 수업에 빠졌다면 유고결석도 따로 신청해야 해요.':'ENT for throat, nose and ears; internal medicine for colds. Keep receipts for insurance, and apply for excused absence separately.', srcs:['커뮤니티 선배 답변','학사 규정 (예시)']};
 if (has(['장학','scholar'])) return {text: L ? (ko?'직전 학기 평점 3.6으로 외국인 장학 기준(예시: 3.0 이상, 12학점 이상)을 충족해요. 4월 24일까지 신청하세요.':'Your GPA 3.6 meets the bar (example). Apply by April 24.') : (ko?'외국인 장학은 보통 직전 학기 성적과 이수 학점을 봐요. 로그인하면 자격을 바로 확인해 드려요.':'It usually depends on last term’s grades and credits. Log in to check eligibility.'), srcs:['학교 장학 공지 (예시)']};
 return {guard:true, text: ko?'학교 규정과 공식 안내에서 근거를 찾지 못했어요. 추측해서 답하지 않을게요.':'I could not find this in school rules or official guides, so I will not guess.', srcs:[], btn:`<button class="btn sm" data-act="fwd">${ko?'국제처에 질문 넘기기':'Send to the international office'}</button>`};
}

/* ---------- Login ---------- */
function loginOverlay(){
 const st = S.loginStep; const ko = S.lang==='ko';
 let body = '';
 if (st === 'school') body = `<div class="card" style="gap:12px"><span class="t">${ko?'1분이면 시작할 수 있어요':'Start in a minute'}</span>
   <button class="gbtn" data-act="google">${ICON.google}${ko?'Google 계정으로 계속하기':'Continue with Google'}</button>
   <button class="gbtn pri" data-act="lstep" data-v="profile">${ko?'학교 이메일로 계속하기':'Continue with school email'}</button>
   <span class="s">${ko?'학교 메일이 아직 없어도 Google 계정으로 가입할 수 있어요. 학번은 다음 단계에서 입력해요.':'No school email yet? Use Google. You enter your student ID next.'}</span>
   <button class="textbtn" data-act="closeOv">${ko?'로그인 없이 둘러보기':'Browse as guest'}</button></div>`;
 else if (st === 'profile') body = `<form class="card" id="profForm"><span class="t">${ko?'학과와 학번부터 알려 주세요':'Your department and student ID'}</span>
   <span class="s">${ko?'학과·입학 학기에 따라 과목이수표가 필요한지 정해져요.':'This decides whether we need your course record.'}</span>
   <div class="form2">
    <div class="field"><label for="pName">${ko?'이름':'Name'}</label><input id="pName" value="${esc(S.profile.name)}"></div>
    <div class="field"><label for="pId">${ko?'학번':'Student ID'}</label><input id="pId" value="${esc(S.profile.id)}"></div>
    <div class="field full"><label for="pDept">${ko?'학과 · 학부':'Department'}</label><select id="pDept">${Object.entries(DEPTS).map(([k,v])=>`<option value="${k}" ${S.profile.dept===k?'selected':''}>${tx(v)}</option>`).join('')}</select></div>
    <div class="field"><label for="pYear">${ko?'입학 연도':'Entry year'}</label><select id="pYear">${['2023','2024','2025','2026'].map(y=>`<option ${S.profile.year===y?'selected':''}>${y}</option>`).join('')}</select></div>
    <div class="field"><label for="pTerm">${ko?'입학 학기':'Entry term'}</label><select id="pTerm"><option value="1" ${S.profile.term==='1'?'selected':''}>${ko?'1학기':'Spring'}</option><option value="2" ${S.profile.term==='2'?'selected':''}>${ko?'2학기':'Fall'}</option></select></div>
    <div class="field full"><label for="pNation">${ko?'국적':'Nationality'}</label><select id="pNation">${natOptions(S.profile.nation)}</select></div>
   </div><button class="btn" type="submit">${ko?'다음':'Next'}</button></form>`;
 else if (st === 'upload') {
  const M = mode();
  if (M !== 'cont') {
   body = `<div class="card" style="gap:10px"><span class="pill ok" style="align-self:flex-start">${ko?'과목이수표 단계 건너뜀':'Course record skipped'}</span>
    <span class="t">${M==='undec'?(ko?`${DEPTS[S.profile.dept].ko}는 1학년에 전공 이수과목이 없어요`:'Your school has no major courses in year 1'):(ko?'첫 학기라 아직 과목이수표가 없어요':'First term: no course record yet')}</span>
    <span class="s">${M==='undec'?(ko?'공통 교양과 전공 탐색 과목, 전공 결정 시기를 기준으로 안내할게요.':'We will guide you with common and exploration courses and the major declaration date.'):(ko?'요람 기준 1학년 1학기 과목으로 시작하고, 다음 학기에 과목이수표를 받으면 업데이트할게요.':'We start from year-1 courses in the handbook and update after your first term.')}</span>
    <button class="btn" data-act="lstep" data-v="check">${ko?'다음':'Next'}</button></div>`;
  } else body = `<div ${spot('문서 인식 · 요람 매칭')}><div class="card" style="gap:10px"><span class="t">${ko?'과목이수표 PDF를 올려 주세요':'Upload your course record PDF'}</span>
   <span class="s">${ko?'세인트에서 이렇게 받을 수 있어요':'How to get it from SAINT'}</span>
   <ol class="howto">
    <li><span>${ko?'세인트(SAINT)에 학번으로 로그인':'Log in to SAINT with your student ID'}</span></li>
    <li><span>${ko?'첫 화면 탭에서 <b>과목이수표</b> 선택':'On the first screen, open the <b>Course Record</b> tab'}</span></li>
    <li><span>${ko?'오른쪽 위 <b>출력/다운로드</b> → PDF로 저장':'Click <b>Print/Download</b> and save as PDF'}</span></li>
    <li><span>${ko?'저장한 PDF를 아래에 올리기':'Upload the PDF below'}</span></li></ol>
   <label class="drop" for="pdfIn">${t('upload')}<input type="file" id="pdfIn" accept="application/pdf,image/*" hidden></label>
   <button class="btn line" data-act="parse">${t('sample')}</button>
   <button class="btn sm ink" style="align-self:flex-start" data-act="lstep" data-v="check">${ko?'나중에 올리기':'Later'}</button></div></div>`;
 }
 else if (st === 'check') {
  const i = S.diagI, d = DIAG[i], cur = S.ans[d.k];
  body = `<div class="card" style="gap:12px;min-height:420px">
   <div class="segbar">${DIAG.map((_,j)=>`<i class="${j<=i?'on':''}"></i>`).join('')}</div>
   <span class="qnum">${ko?'질문':'Question'} ${i+1} / ${DIAG.length}</span>
   <p class="qtitle">${tx(d.q)}</p><span class="s">${tx(d.h)}</span>
   <div style="display:flex;flex-direction:column;gap:8px">${d.o.map(([v,l])=>`<button class="opt" data-act="ans" data-k="${d.k}" data-v="${v}" aria-pressed="${cur===v}">${tx(l)}</button>`).join('')}</div>
   <div style="flex:1"></div>
   <div class="row">${i>0?`<button class="btn line" style="flex:1" data-act="diagPrev">${ko?'이전':'Back'}</button>`:''}
    <button class="btn" style="flex:2" data-act="diagNext" ${cur?'':'disabled'}>${i===DIAG.length-1?(ko?'내 체크리스트 만들기':'Build my checklist'):(ko?'다음':'Next')}</button></div></div>`;
 }
 else {
  const M = mode();
  const steps = M==='cont'
   ? [ko?'과목이수표에서 이수 과목 9개 인식':'Read 9 completed courses', ko?`${S.profile.year} 요람 · ${DEPTS[S.profile.dept].ko} 교육과정 매칭`:`Matched the ${S.profile.year} handbook`, ko?'남은 필수 과목 · 선수과목 계산':'Calculated remaining requirements', ko?'자가진단 답으로 할 일 정리':'Built tasks from your answers']
   : M==='first'
   ? [ko?`${S.profile.year} 요람 · 1학년 1학기 과목 확인`:'Checked year-1 courses', ko?'신입생 정착 일정 계산 (외국인등록 90일)':'Calculated arrival deadlines', ko?'첫 학기 시간표 추천':'Suggested a first-term timetable', ko?'자가진단 답으로 할 일 정리':'Built tasks from your answers']
   : [ko?`${DEPTS[S.profile.dept].ko} 1학년 규정 확인`:'Checked year-1 rules', ko?'공통 교양 · 전공 탐색 과목 정리':'Listed common and exploration courses', ko?'전공 결정 일정 등록':'Added the major declaration date', ko?'자가진단 답으로 할 일 정리':'Built tasks from your answers'];
  body = `<div class="card"><span class="t">${ko?'내 체크리스트를 만들고 있어요':'Building your checklist'}</span><ol class="gen">
   ${steps.map((x,i)=>`<li class="${S.genStep>i?'done':''}">${x}</li>`).join('')}</ol></div>`;
 }
 return `<div class="overlay loginov"><div class="ovhead"><b>${st==='check'?(ko?'나에게 필요한 것 찾기':'What do you need?'):t('login')}</b><button class="ovx" data-act="closeOv" aria-label="${t('close')}">${ICON.close}</button></div><div class="scroll">${body}</div></div>`;
}
function logoutOverlay(){
 return `<div class="overlay ovc"><div class="ovhead"><b>${esc(S.profile.name)}</b><button class="ovx" data-act="closeOv" aria-label="${t('close')}">${ICON.close}</button></div>
  <div class="scroll"><div class="card"><span class="t">${tx(DEPTS[S.profile.dept])} · ${S.profile.year}-${S.profile.term} · ${natName(S.profile.nation,S.lang)}</span>
  <button class="btn line" data-act="editProfile">${S.lang==='ko'?'프로필 수정':'Edit profile'}</button>
  <button class="btn ink" data-act="auth" data-v="out">${t('logout')}</button></div></div></div>`;
}

/* ---------- 국제처 dashboard ---------- */
function dashboard(){
 const topQ = [['빌넣(수강허가) 절차',142],['요람 보는 법 · 남은 필수 과목',118],['외국인등록 마감',96],['장학 자격',71],['재학·성적증명서 발급',54]];
 const langs = [['Tiếng Việt',34],['中文',28],['English',15],['Русский',9],['한국어',8],['日本語',6]];
 const mx = topQ[0][1];
 return `<div ${spot(null,'B2B 구독')}><div class="dash">
  <header><h2>${esc(S.appName)} · 국제처 대시보드</h2><p>2026학년도 1학기 · 시연용 예시 데이터</p></header>
  <div class="kpis">
   <div class="kpi"><span>앱 사용 유학생</span><b>412</b><span>예시</span></div>
   <div class="kpi w"><span>필수 과목 미이수 위험</span><b>23</b><span>선수과목 순서 꼬임</span></div>
   <div class="kpi d"><span>체류 만료 60일 내</span><b>9</b><span>연장 미확인</span></div>
   <div class="kpi"><span>AI가 국제처로 넘긴 질문</span><b>31</b><span>근거 없음 → 이관</span></div></div>
  <div class="dgrid">
   <div class="panel"><h3>이번 달 질문 TOP 5</h3>${topQ.map(q=>`<div class="hbar"><span>${q[0]}</span><div class="tr"><i style="width:${q[1]/mx*100}%"></i></div><b>${q[1]}</b></div>`).join('')}
    <div ${spot('반복 질문 → FAQ 초안 생성')}><div class="card" style="background:var(--ai-soft);border-color:transparent"><span class="t">‘빌넣’ 질문이 지난주보다 3배 늘었어요</span><span class="s">AI가 학사 안내를 근거로 FAQ 초안을 만들었어요. 검토 후 학생 앱에 바로 게시할 수 있어요.</span><button class="btn sm" style="align-self:flex-start" data-act="faqPub">초안 검토하기</button></div></div></div>
   <div class="panel"><h3>상담 언어 분포</h3>${langs.map(l=>`<div class="hbar"><span>${l[0]}</span><div class="tr"><i style="width:${l[1]/34*100}%"></i></div><b>${l[1]}%</b></div>`).join('')}</div></div>
  <div class="panel"><h3>먼저 연락이 필요한 학생</h3><div class="tbl"><table><thead><tr><th>학번</th><th>학과</th><th>신호</th><th>권장 조치</th></tr></thead><tbody>
   <tr><td>2025****</td><td>컴퓨터공학</td><td><span class="pill danger">전필 2과목 미신청</span></td><td>수강정정 안내 메시지</td></tr>
   <tr><td>2024****</td><td>경영학부</td><td><span class="pill warn">체류 만료 D-41</span></td><td>연장 서류 안내</td></tr>
   <tr><td>2026****</td><td>경제학과</td><td><span class="pill warn">외국인등록 미완료 D-18</span></td><td>하이코리아 예약 안내</td></tr></tbody></table></div></div>
  <div class="note"><b>왜 학교가 돈을 내나요?</b> 반복 상담은 AI가 먼저 처리하고, 필수 과목·체류 마감 같은 위험을 학생별로 미리 보여 줘요. 학생 앱은 무료, 학교는 대시보드를 구독해요. 학생 화면의 제휴 지점(유심·은행·채용)은 부가 수익이에요.</div>
 </div></div>`;
}

/* ======================= RENDER & EVENTS ======================= */
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
document.body.classList.toggle('demo', DEMO);
function render(){ if (DEMO) renderRail(); renderMain(); }

function runParse(){
 S.loginStep = 'gen'; S.genStep = 0; render();
 const tick = () => { S.genStep++; if (S.overlay==='login') renderMain();
  if (S.genStep < 4) setTimeout(tick, 550);
  else setTimeout(()=>{ S.loggedIn = true; S.taskI = 0; S.overlay = null; S.tab = 'home'; render(); toast(S.lang==='ko'?'로드맵을 만들었어요':'Your plan is ready'); }, 600); };
 setTimeout(tick, 450);
}
function goStep(k){
 const i = STEPS.findIndex(x=>x.k===k); S.step = i+1; S.mode = 'student'; S.overlay = null;
 if (k==='guest'){ S.loggedIn=false; S.tab='home'; S.phase='arrive'; }
 else if (k==='login'){ S.loggedIn=false; S.tab='home'; S.overlay='login'; S.loginStep='school'; }
 else if (k==='home'){ S.loggedIn=true; S.tab='home'; }
 else if (k==='study'){ S.loggedIn=true; S.tab='study'; }
 else if (k==='tt'){ S.loggedIn=true; S.tab='tt'; S.ttView='plan'; S.phase='reg'; }
 else if (k==='bill'){ if (mode()!=='cont'){ S.persona='cont'; S.profile={...PERSONAS.cont.p}; S.ans={...PERSONAS.cont.ans}; } S.loggedIn=true; S.tab='tt'; S.ttView='guide'; S.phase='add'; S.reg={ds:'fail',disc:'ok',la:'ok',web:'ok',kor:'ok'}; S.billCourse='ds'; S.overlay='bill'; }
 else if (k==='comm'){ S.tab='comm'; }
 else if (k==='qa'){ S.tab='qa'; S.qaView='chat'; }
 else if (k==='dash'){ S.mode='admin'; }
 render();
}

document.addEventListener('click', e => {
 const b = e.target.closest('[data-act]'); if (!b) return;
 const a = b.dataset.act, v = b.dataset.v;
 if (['mode','auth','phase','step','persona'].includes(a)) S.onboard = false;
 if (a==='onbStart'){ S.onboard = false; render(); }
 else if (a==='taskDot'){ const tc = document.getElementById('tcar'); if (tc) tc.scrollTo({left: +v * tc.clientWidth, behavior:'smooth'}); }
 else if (a==='mode'){ S.mode=v; render(); }
 else if (a==='auth'){ S.loggedIn = v==='in'; S.taskI = 0; S.overlay=null; render(); }
 else if (a==='phase'){ S.phase=v; render(); if (S.loggedIn) queuePhaseNotis(v); }
 else if (a==='step'){ goStep(v); }
 else if (a==='reset'){ Object.assign(S,{onboard:true,mode:'student',loggedIn:false,phase:'arrive',tab:'home',overlay:null,reg:{},chat:[],openTr:{},myPosts:[],points:120,alt:false,ttView:'plan',qaView:'chat',pcat:'all',step:1,persona:'cont',profile:{...PERSONAS.cont.p},ans:{...PERSONAS.cont.ans},pref:{max:18,noNine:false,freeFri:false,eng:false}}); render(); }
 else if (a==='tab'){ S.tab=v; S.overlay=null; renderMain(); }
 else if (a==='openLogin'){ S.overlay='login'; S.loginStep='school'; renderMain(); }
 else if (a==='notiOpen'){ S.overlay='noti'; renderMain(); }
 else if (a==='notiAll'){ S.notis.forEach(n => n.unread = false); refreshNoti(); }
 else if (a==='notiGo'){ const n = S.notis.find(x => x.id === v); if (n){ n.unread = false; S.tab = n.go; } S.overlay = null; renderMain(); }
 else if (a==='logoutAsk'){ S.overlay='logout'; renderMain(); }
 else if (a==='editProfile'){ S.overlay='login'; S.loginStep='profile'; renderMain(); }
 else if (a==='closeOv'){ S.overlay=null; renderMain(); }
 else if (a==='lstep'){ S.loginStep=v; if (v==='check') S.diagI=0; renderMain(); }
 else if (a==='google'){ S.loginStep='profile'; renderMain(); toast(S.lang==='ko'?'Google 계정을 연결했어요 (데모)':'Google account connected (demo)'); }
 else if (a==='parse'){ S.loginStep='check'; S.diagI=0; renderMain(); toast(S.lang==='ko'?'과목이수표에서 이수 과목 9개를 인식했어요':'Read 9 completed courses'); }
 else if (a==='ans'){ S.ans[b.dataset.k]=v; renderMain(); }
 else if (a==='diagNext'){ if (S.diagI < DIAG.length-1){ S.diagI++; renderMain(); } else runParse(); }
 else if (a==='diagPrev'){ S.diagI=Math.max(0,S.diagI-1); renderMain(); }
 else if (a==='persona'){ const P=PERSONAS[v]; S.persona=v; S.profile={...P.p}; S.ans={...P.ans}; S.loggedIn=true; S.overlay=null; S.reg={}; S.alt=false; render(); }
 else if (a==='pref'){ S.pref[v]=!S.pref[v]; renderMain(); }
 else if (a==='pmax'){ S.pref.max=15; renderMain(); }
 else if (a==='pmax18'){ S.pref.max=18; renderMain(); }
 else if (a==='alt'){ S.alt=!S.alt; renderMain(); }
 else if (a==='taskgo'){ if (v==='bill'){ if(!Object.values(S.reg).includes('fail')) S.reg.ds='fail'; S.billCourse='ds'; S.overlay='bill'; S.tab='tt'; S.ttView='guide'; } else if (v==='guide'){ S.tab='tt'; S.ttView='guide'; } else if (v==='faq'){ S.tab='qa'; S.qaView='faq'; } else S.tab=v; renderMain(); }
 else if (a==='partner'){ const k=TASKS[v]; if (k.url) window.open(k.url,'_blank','noopener'); toast(k.money ? (S.lang==='ko'?'제휴사 신청 화면으로 연결돼요 (데모)':'Opens partner sign-up (demo)') : (S.lang==='ko'?'신청 페이지로 연결돼요':'Opening the application page')); }
 else if (a==='ttv'){ S.ttView=v; renderMain(); }
 else if (a==='reg'){ S.reg[v] = S.reg[v]===b.dataset.r ? undefined : b.dataset.r; if (b.dataset.r==='fail') S.billCourse=v; renderMain(); }
 else if (a==='openBill'){ if (!S.loggedIn){ S.overlay='login'; S.loginStep='school'; } else { const f = Object.keys(S.reg).find(k=>S.reg[k]==='fail'); S.billCourse = f || 'ds'; S.overlay='bill'; } renderMain(); }
 else if (a==='copyMail'){ const txt = S._mail || ''; const done = () => toast(t('copied'));
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(()=>{ selectMail(); toast(S.lang==='ko'?'텍스트를 선택했어요. 복사해 주세요':'Text selected. Copy it manually'); });
  else selectMail(); }
 else if (a==='billDone'){ S.overlay=null; renderMain(); toast(S.lang==='ko'?'할 일에 추가했어요. 수강정정 마감 2일 전에 알려드릴게요':'Added. We will remind you 2 days before add/drop closes'); }
 else if (a==='pcat'){ S.pcat=v; renderMain(); }
 else if (a==='tr'){ S.openTr[v] = !S.openTr[v]; renderMain(); }
 else if (a==='compose'){ S.overlay='compose'; renderMain(); }
 else if (a==='qav'){ S.qaView=v; renderMain(); }
 else if (a==='chip'){ ask(v); }
 else if (a==='fwd'){ toast(S.lang==='ko'?'국제처 담당자에게 질문을 넘겼어요 (데모)':'Sent to the international office (demo)'); }
 else if (a==='faqPub'){ toast('FAQ 초안을 학생 앱에 게시했어요 (데모)'); }
});
function selectMail(){ const el = document.getElementById('mailText'); if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
function ask(q){
 if (!q || !q.trim()) return;
 S.chat.push({me:true,text:q}); renderMain();
 setTimeout(()=>{ const r = answer(q); S.chat.push(r); renderMain(); }, 380);
}
document.addEventListener('submit', e => {
 if (e.target.id==='chatForm'){ e.preventDefault(); const i = document.getElementById('chatIn'); const q = i.value; i.value=''; ask(q); }
 else if (e.target.id==='profForm'){ e.preventDefault();
  S.profile = {name:document.getElementById('pName').value||'Linh', id:document.getElementById('pId').value||'20251234', dept:document.getElementById('pDept').value, year:document.getElementById('pYear').value, term:document.getElementById('pTerm').value, nation:document.getElementById('pNation').value};
  if (S.loggedIn){ S.overlay=null; render(); toast(S.lang==='ko'?'프로필에 맞춰 홈을 다시 만들었어요':'Home updated for your profile'); }
  else { S.loginStep='upload'; renderMain(); } }
 else if (e.target.id==='composeForm'){ e.preventDefault();
  S.myPosts.unshift({id:'m'+Date.now(),cat:document.getElementById('cCat').value,lang:S.lang.toUpperCase(),by:{ko:`${S.profile.nation} · ${DEPTS[S.profile.dept].ko} ${grade()}학년`,en:`${S.profile.nation} · ${DEPTS[S.profile.dept].en}`},mentor:false,likes:0,
   title:document.getElementById('cTitle').value,body:document.getElementById('cBody').value,tr:null,ans:[]});
  if (document.getElementById('cCat').value==='review') S.points += 20;
  S.overlay=null; S.pcat='all'; renderMain(); toast(S.lang==='ko'?'올렸어요. 강의평 +20P':'Posted. +20P'); }
});
document.addEventListener('change', e => {
 if (e.target.id==='langSel'){ S.lang = e.target.value; renderMain(); }
 else if (e.target.id==='tgAI'){ S.showAI = e.target.checked; renderMain(); }
 else if (e.target.id==='tgMoney'){ S.showMoney = e.target.checked; renderMain(); }
 else if (e.target.id==='pdfIn' && e.target.files && e.target.files[0]){ toast((S.lang==='ko'?'올린 파일: ':'File: ') + e.target.files[0].name + (S.lang==='ko'?' · 데모에서는 샘플 결과를 보여줘요':' · demo shows a sample result')); S.loginStep='check'; S.diagI=0; renderMain(); }
});
document.addEventListener('input', e => {
 if (e.target.id==='appName'){ S.appName = e.target.value || 'mumomo'; renderMain(); }
});

render();


