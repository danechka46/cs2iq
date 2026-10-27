 'use strict';
let state, bank='ConvexStack', period='day', filter='upcoming', page='forecasts';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n/100)+' ₽';
const pct=n=>n==null?'—':new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:2}).format(n);
const num=n=>n==null?'—':Number(n).toFixed(4);
const date=s=>s?new Date(s).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const empty=(title,desc)=>`<div class="empty"><div class="symbol">⌁</div><strong>${esc(title)}</strong><p>${esc(desc)}</p></div>`;
const table=(heads,rows)=>`<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const cell=v=>`<td>${v}</td>`;
const closed=e=>['won','lost','void','cancelled'].includes(e.status);
const statuses={won:'Выигрыш',lost:'Проигрыш',void:'Возврат',cancelled:'Отмена',active:'Виртуальная позиция',pending:'Ждём подтверждения'};
const titles={overview:'ML Банк',forecasts:'Прогнозы CS2',models:'Сравнение моделей',journal:'Журнал эксперимента',sources:'Источники и правила'};
function nav(p,updateHash=true){
  if(!titles[p])p='forecasts'; page=p;
  document.body.dataset.page=p;
  document.querySelectorAll('.page').forEach(x=>x.hidden=x.id!==p);
  document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('selected',b.dataset.page===p);b.setAttribute('aria-current',b.dataset.page===p?'page':'false');});
  $('#page-title').innerHTML=esc(titles[p])+'<span class="accent">.</span>';
  $('#breadcrumb').textContent=titles[p]; document.title='CS2IQ — '+titles[p];
  $('#page-description').textContent=p==='forecasts'?'Выбор модели до начала матча. Проверка результата после.':'Каждое решение — до матча. Каждый результат — в истории.';
  if(updateHash&&location.hash!=='#'+p)history.replaceState(null,'','#'+p);
}
function chartCurve(b){let points=b.curve;if(points.length<2)return empty('Эксперимент ещё не накопил историю','Стартовый капитал — 100 000 ₽. График появится после первого расчёта.');let w=660,h=190,pad=48,min=Math.min(...points.map(p=>p.equity)),max=Math.max(...points.map(p=>p.equity));let range=Math.max(max-min,10000);min-=range*.1;max+=range*.1;let start=+new Date(points[0].at),end=+new Date(points.at(-1).at);const x=p=>pad+(+new Date(p.at)-start)/Math.max(end-start,1)*(w-pad-10),y=v=>h-25-(v-min)/(max-min)*(h-40);let d=points.map((p,i)=>`${i?'L':'M'} ${x(p)} ${y(p.equity)}`).join(' ');return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Изменение виртуального капитала">${[0,.5,1].map(f=>{let v=min+(max-min)*f;return `<path d="M ${pad} ${y(v)} H ${w}" stroke="#28323c" stroke-dasharray="3 5"/><text x="0" y="${y(v)+3}">${Math.round(v/100000)} тыс.</text>`;}).join('')}<path d="${d}" fill="none" stroke="#c2f06a" stroke-width="2.5"/><text x="${pad}" y="188">${date(points[0].at)}</text><text x="${w-100}" y="188">${date(points.at(-1).at)}</text></svg>`;}
function returnChart(b){const series=b.periods[period];if(!series.length)return empty('Пока нет рассчитанных прогнозов','Здесь появится доходность по дням, неделям и месяцам.');const recent=series.slice(-12),max=Math.max(.001,...recent.map(x=>Math.abs(x.return||0)));return `<svg viewBox="0 0 420 180" role="img" aria-label="Доходность по периодам"><path d="M 0 80 H 420" stroke="#34414d"/>${recent.map((p,i)=>{const step=420/recent.length,x=i*step+4,v=p.return||0,h=Math.abs(v)/max*55;return `<rect x="${x}" y="${v>=0?80-h:80}" width="${Math.max(4,step-9)}" height="${Math.max(1,h)}" fill="${v>=0?'#c2f06a':'#f28a8a'}"/><text x="${x}" y="${v>=0?72-h:94+h}">${pct(v)}</text><text x="${x}" y="175" transform="rotate(-25 ${x} 175)">${esc(p.label)}</text>`;}).join('')}</svg>`;}
function positionTable(list){
  if(!list.length)return empty('Открытых позиций пока нет','Прогнозы появятся после подключения источников и моделей.');
  return table(['МАТЧ / ТУРНИР','ИСХОД','ВЕРОЯТНОСТЬ','КОЭФФ.','ПОЗИЦИЯ','EV','СТАТУС',''],list.map(e=>'<tr>'+[
    `${esc(e.match.teams.join(' — '))}<small>${esc(e.match.tournament)} · ${esc(e.match.format)}</small>`,
    esc(e.quote.outcome),pct(e.prediction.p),`${esc(e.quote.odds)}<small>${esc(e.quote.bookmaker)}</small>`,
    money(e.stake),pct(e.ev),esc(statuses[e.status]),`<button data-detail="${esc(e.id)}">Почему ↗</button>`
  ].map(cell).join('')+'</tr>'));
}
function renderForecasts(){
  if(!state)return;
  const now=Date.now(),query=$('#home-search').value.toLowerCase(),model=$('#home-model').value;
  const upcoming=state.forecasts.filter(e=>!closed(e)&&+new Date(e.match.starts_at)>now);
  const active=state.forecasts.filter(e=>!closed(e)&&+new Date(e.match.starts_at)<=now);
  $('#forecast-counters').innerHTML=[['ПРЕДСТОЯЩИХ ПОЗИЦИЙ',upcoming.length],['В ИГРЕ / ЖДУТ РАСЧЁТА',active.length],['ПОДКЛЮЧЕНО МОДЕЛЕЙ',state.registered_models.filter(m=>m!=='Coin50').length+' / 4']].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  let list=state.forecasts.filter(e=>(model==='all'||e.bank===model)&&JSON.stringify([e.match.teams,e.match.tournament]).toLowerCase().includes(query));
  list=list.filter(e=>filter==='closed'?closed(e):!closed(e)&&(filter==='upcoming'?+new Date(e.match.starts_at)>now:+new Date(e.match.starts_at)<=now));
  list.sort((a,b)=>filter==='upcoming'?+new Date(a.match.starts_at)-+new Date(b.match.starts_at):+new Date(b.fixed_at)-+new Date(a.fixed_at));
  const emptyTitle=query?'По запросу ничего не найдено':filter==='closed'?'Завершённых прогнозов пока нет':filter==='active'?'Нет позиций в игре':'Предстоящих прогнозов пока нет';
  $('#forecast-cards').innerHTML=list.length?list.map(e=>`<article class="forecast-card">
    <div class="forecast-card-top"><span>${esc(e.match.tournament)} · ${esc(e.match.format)}</span><span class="model-chip">${esc(e.bank)}${e.bank==='Coin50'?' · контроль':''}</span></div>
    <div class="match-time">${date(e.match.starts_at)} МСК</div><h3>${esc(e.match.teams[0])}<span>vs</span>${esc(e.match.teams[1])}</h3>
    <div class="pick"><span>ПОБЕДИТЕЛЬ МАТЧА</span><strong>${esc(e.quote.outcome)}</strong></div>
    <div class="pick-metrics"><div><span>Вероятность</span><b>${pct(e.prediction.p)}</b></div><div><span>Коэффициент</span><b>${esc(e.quote.odds)}</b></div><div><span>Ожидаемый EV</span><b class="positive">${pct(e.ev)}</b></div></div>
    <div class="pick-meta"><span>${esc(e.quote.bookmaker)} · линия ${date(e.quote.observed_at)}</span><span>Неопределённость ± ${pct(e.prediction.uncertainty)}</span><span>Версия ${esc(e.prediction.version)} · зафиксировано ${date(e.fixed_at)} МСК</span></div>
    <div class="pick-footer"><div><span>${esc(statuses[e.status])}</span><strong>${e.pnl==null?money(e.stake):money(e.pnl)+' P&L'}</strong></div><button data-detail="${esc(e.id)}">Обоснование ↗</button></div></article>`).join(''):empty(emptyTitle,query?'Попробуйте другое название матча или турнира.':state.pipeline.status==='waiting'?(state.match_feed?.status==='ok'?'Источник текущих матчей подключён. Линии и обученные модели ещё не готовы. Когда модель зафиксирует выбор, он появится здесь.':'Источники для прогноза и обученные модели ещё не подключены. Когда модель зафиксирует выбор, он появится здесь.'):'В этом разделе пока нет подходящих позиций. Прогнозы без пройденных фильтров не публикуются.');
}
function renderMatchFeed(){
  const feed=state.match_feed;
  if(!feed||feed.status==='not_connected'){
    $('#match-feed-status').textContent='Источник матчей ещё не подключён.';
    $('#match-feed-cards').innerHTML=empty('Матчи появятся после загрузки источника','Здесь будут реальные события, даже если модель ещё не рассчитала прогноз.');return;
  }
  const stale=!feed.observed_at||Date.now()-new Date(feed.observed_at)>2*3600000;
  const coverage=feed.coverage==='live_only'?'Открытый канал: только текущие матчи, не полное расписание.':'Текущие и предстоящие матчи.';
  $('#match-feed-status').textContent=coverage+' Снимок: '+date(feed.observed_at)+' МСК.'+(feed.status==='error'?' Новое обновление не удалось; показан предыдущий снимок.':stale?' Данные устарели.':' Обновление раз в час.');
  const labels={live:'В игре на момент снимка',upcoming:'Предстоящий матч',completed:'Завершён по данным источника'};
  $('#match-feed-cards').innerHTML=feed.matches.length?feed.matches.map(m=>`<article class="schedule-card"><div class="schedule-top"><span>${esc(m.tournament)} · ${esc(m.format)}</span><span class="schedule-status">${esc(labels[m.status]||m.status)}</span></div><h3>${esc(m.teams[0])}<span>vs</span>${esc(m.teams[1])}</h3><div class="schedule-info"><span>Начало ${date(m.starts_at)} МСК</span>${m.score?`<b>Счёт по картам ${m.score.join(' : ')}</b>`:''}</div><div class="schedule-bottom"><span>Прогноз не рассчитан</span><small>Вероятность, EV и позиция появятся только после проверки модели и линии.</small></div></article>`).join(''):empty('В канале нет текущих матчей','Источник ответил успешно. Отсутствие матча в этом канале не означает отмену события.');
}
function render(){
  const b=state.banks.find(x=>x.name===bank);
  $('#banks').innerHTML=state.banks.map(x=>`<button data-bank="${esc(x.name)}" class="${x.name===bank?'selected':''}">${esc(x.name)}${x.name==='Coin50'?' · контроль':''}</button>`).join('');
  const stale=Date.now()-new Date(state.generated_at)>2*3600000;
  const status=state.pipeline.status;
  const label=stale?'Снимок давно не обновлялся':status==='ok'?'Последний цикл завершён':status==='waiting'?'Ожидаем первые прогнозы':'Обработка данных требует внимания';
  const description=stale?'На экране последний сохранённый снимок. Смотрите время фиксации каждого прогноза.':status==='waiting'?(state.match_feed?.status==='ok'?'Источник текущих матчей подключён. Букмекерские линии и модели для прогнозов ещё не готовы.':'Стенд доступен. Источники для прогнозов и обученные модели пока не подключены.'):status==='ok'?'Каждый опубликованный выбор прошёл фильтры и сохранён в виртуальном банке.':'Новые прогнозы могут задерживаться. Ранее зафиксированная история сохранена.';
  $('#status').innerHTML=`<span class="statusicon">${status==='ok'&&!stale?'✓':'Ⅱ'}</span><div><strong>${label}</strong><p>${description}</p></div><span class="pill">PAPER ONLY</span>`;
  $('#updated').textContent='Снимок '+date(state.generated_at)+' МСК';
  $('#public-updated')?.remove();
  const stamp=document.createElement('p');stamp.id='public-updated';stamp.className='publication-stamp';stamp.textContent='Снимок: '+date(state.generated_at)+' МСК · обновление по расписанию раз в час';$('#status').after(stamp);
  $('#stats').innerHTML=[['Виртуальный капитал',money(b.equity),'Доходность банка '+pct(b.return)],['Доступный остаток',money(b.available),'Для новых виртуальных позиций'],['Зарезервировано',money(b.reserved),'Открытых позиций: '+state.forecasts.filter(e=>e.bank===bank&&!closed(e)).length],['Реализованный P&L',money(b.pnl),'ROI '+pct(b.roi)+' · рассчитано '+b.settled]].map(x=>`<div class="stat"><label>${x[0]}</label><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
  $('#equity-chart').innerHTML=chartCurve(b);$('#return-chart').innerHTML=returnChart(b);
  $('#drawdown').textContent='Макс. просадка '+pct(b.max_drawdown);
  const exposure=b.equity?b.reserved/b.equity:0;
  $('#exposure').textContent=pct(exposure)+' / 10%';$('#meter').style.width=Math.min(100,exposure*1000)+'%';
  $('#active-preview').innerHTML=positionTable(state.forecasts.filter(e=>e.bank===bank&&!closed(e)).slice(0,5));
  renderForecasts();renderMatchFeed();
  $('#model-table').innerHTML=table(['МОДЕЛЬ','КАПИТАЛ','ROI','ПРОСАДКА','ПОЗИЦИЙ','ОБЩАЯ N','LOG LOSS','BRIER','ECE','95% CI BRIER'],state.banks.map(x=>'<tr>'+[`${esc(x.name)}<small>${state.registered_models.includes(x.name)?'Версия зарегистрирована':state.research?.model===x.name?'Обучена для исследования · не подключена':'Не подключена'}</small>`,money(x.equity),pct(x.roi),pct(x.max_drawdown),x.positions,x.quality.n,num(x.quality.log_loss),num(x.quality.brier),num(x.quality.ece),x.quality.brier_ci95?x.quality.brier_ci95.map(num).join(' — '):'Недостаточно данных'].map(cell).join('')+'</tr>'));
  const research=state.research;
  $('#research-panel').hidden=!research;
  if(research){
    const test=research.splits.test;
    $('#research-period').textContent='Отложенный период: '+test.from+' — '+test.to+' · '+test.n+' матчей · обучение: '+research.splits.training.n+' · калибровка: '+research.splits.calibration.n;
    $('#research-verdict').textContent=research.outcome==='baseline_better'?'В этой проверке CatBoost уступил простому Elo. Модель сохранена для исследования; виртуальные позиции по ней не открываются.':'На этой исторической выборке CatBoost снизил log loss относительно Elo. Для допуска к виртуальным позициям нужна дополнительная проверка.';
    $('#research-metrics').innerHTML=table(['МЕТОД','LOG LOSS ↓','BRIER ↓','ДОЛЯ ВЕРНЫХ ИСХОДОВ'],Object.entries(research.metrics).map(([name,m])=>'<tr>'+[esc(name),num(m.log_loss),num(m.brier),pct(m.accuracy)].map(cell).join('')+'</tr>'));
  }
  $('#quality-note').textContent=state.quality_note;$('#cohort').textContent='N = '+state.common_cohort;
  $('#calibration').innerHTML=b.quality.n?table(['ДИАПАЗОН P','N','СРЕДНЯЯ P','ЧАСТОТА ПОБЕД'],b.quality.calibration.map(x=>'<tr>'+[`${pct(x.lower)}–${pct(x.lower+.1)}`,x.n,pct(x.predicted),pct(x.observed)].map(cell).join('')+'</tr>')):empty('Качество ещё не измерено','Нужны предматчевые прогнозы всех моделей и подтверждённые результаты.');
  $('#integrity').textContent=state.integrity_ok?'✓ ПРОВЕРЕНО ПРИ ПУБЛИКАЦИИ':'НАРУШЕНА ЦЕЛОСТНОСТЬ';
  const kinds={OPENING:'Начальный капитал',RUN_START:'Начало цикла',RUN_END:'Завершение цикла',POSITION:'Виртуальная позиция',SETTLEMENT:'Расчёт позиции',FORECAST:'Оценка модели',DECISION:'Решение',INPUT:'Снимок данных',SCHEDULE:'Расписание',MODEL:'Регистрация модели',PENDING:'Ожидание результата',RESULT:'Получен результат',REVIEW:'Требуется проверка',DISPLAY_FEED:'Загружены матчи для отображения',DISPLAY_FEED_ERROR:'Ошибка обновления матчей'};
  $('#journal-table').innerHTML=table(['№','ВРЕМЯ · МСК','СОБЫТИЕ','БАНК','ХЕШ',''],state.journal.slice().reverse().map(e=>'<tr>'+[e.seq,date(e.at),esc(kinds[e.kind]||e.kind),esc(e.bank),esc(e.hash.slice(0,16))+'…',`<button data-detail="${esc(e.id)}">Открыть</button>`].map(cell).join('')+'</tr>'));
  $('#source-cards').innerHTML=`<article class="panel"><h2>ViewYourTeam</h2><span class="pill">${state.match_feed?.status==='ok'?'КАНАЛ ПОДКЛЮЧЁН':state.match_feed?.status==='error'?'ОШИБКА ОБНОВЛЕНИЯ':'НЕ ПОДКЛЮЧЁН'}</span><p class="muted">Текущие матчи для отображения с указанием источника. Эти данные не используются для обучения моделей или расчёта банка.</p><a href="https://viewyourteam.com/api-docs" target="_blank" rel="noopener noreferrer">Источник и условия ↗</a></article>`+Object.entries(state.sources).map(([name,at])=>`<article class="panel"><h2>${esc(name)}</h2><span class="pill">${at?'ЕСТЬ ПОЛУЧЕННЫЕ СНИМКИ':'ИСТОЧНИК НЕ ПОДКЛЮЧЁН'}</span><p class="muted">${at?'Последнее наблюдение: '+date(at)+' МСК':'Получение линии и условия использования ещё предстоит подтвердить.'}</p></article>`).join('');
}
async function refresh(){
  $('#refresh').disabled=true;
  try{
    const response=await fetch(document.body.dataset.source,{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const next=await response.json();
    if(next.schema_version!==1||!Array.isArray(next.forecasts)||!Array.isArray(next.banks))throw Error('Неподдерживаемый формат данных');
    state=next;$('#error').hidden=true;render();
  }catch(e){$('#error').hidden=false;$('#error').textContent='Не удалось обновить снимок. Последние загруженные данные сохранены на экране. '+e.message;}
  finally{$('#refresh').disabled=false;}
}
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.dataset.page)nav(t.dataset.page);
  if(t.dataset.bank){bank=t.dataset.bank;render();}
  if(t.dataset.period){period=t.dataset.period;document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('selected',b.dataset.period===period));if(state)render();}
  if(t.dataset.filter){filter=t.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter));renderForecasts();}
  if(t.dataset.detail&&state){const entry=state.forecasts.find(x=>x.id===t.dataset.detail)||state.journal.find(x=>x.id===t.dataset.detail);$('#detail-content').textContent=JSON.stringify(entry,null,2);$('#details').showModal();}
});
$('#close-dialog').onclick=()=>$('#details').close();$('#refresh').onclick=refresh;
$('#home-search').oninput=renderForecasts;$('#home-model').onchange=renderForecasts;
$('#export').onclick=()=>{if(!state)return;const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='cs2iq-public-state.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('hashchange',()=>nav(location.hash.slice(1),false));
nav(location.hash.slice(1)||'forecasts',false);refresh();setInterval(refresh,60000);
