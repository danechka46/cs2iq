 'use strict';
let state, bank='CatBoost · условные', period='day', filter='upcoming', page='forecasts';
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
const statuses={review:'Результат на проверке',won:'Выигрыш',lost:'Проигрыш',void:'Возврат',cancelled:'Отмена',active:'Виртуальная позиция',pending:'Ждём подтверждения'};
const titles={overview:'ML Банк',forecasts:'Прогнозы CS2',models:'Сравнение моделей',journal:'Журнал эксперимента',sources:'Источники и правила',history:'История прогнозов'};
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
    `${e.paper?.forecast_id?'<button class="text-button" data-open-match="'+esc(e.paper.forecast_id)+'">'+esc(e.match.teams.join(' — '))+'</button>':esc(e.match.teams.join(' — '))}<small>${esc(e.match.tournament)} · ${esc(e.match.format)}</small>`,
    esc(e.quote.outcome),pct(e.prediction.p),`${esc(e.quote.odds)}<small>${esc(e.quote.bookmaker)}</small>`,
    money(e.stake),pct(e.ev),esc(statuses[e.status]),`<button data-detail="${esc(e.id)}">Почему ↗</button>`
  ].map(cell).join('')+'</tr>'));
}
function renderForecasts(){
  if(!state)return;
  const now=Date.now(),query=$('#home-search').value.toLowerCase(),model=$('#home-model').value;
  const upcoming=state.forecasts.filter(e=>!closed(e)&&+new Date(e.match.starts_at)>now);
  const active=state.forecasts.filter(e=>!closed(e)&&+new Date(e.match.starts_at)<=now);
  $('#forecast-counters').innerHTML=[['ПРЕДСТОЯЩИХ ПОЗИЦИЙ',upcoming.length],['В ИГРЕ / ЖДУТ РАСЧЁТА',active.length],['МЕТОДОВ В РОСПИСИ',state.model_forecasts?.model_names.length||1]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  let list=state.forecasts.filter(e=>(model==='all'||e.bank===model)&&JSON.stringify([e.match.teams,e.match.tournament]).toLowerCase().includes(query));
  list=list.filter(e=>filter==='closed'?closed(e):!closed(e)&&(filter==='upcoming'?+new Date(e.match.starts_at)>now:+new Date(e.match.starts_at)<=now));
  list.sort((a,b)=>filter==='upcoming'?+new Date(a.match.starts_at)-+new Date(b.match.starts_at):+new Date(b.fixed_at)-+new Date(a.fixed_at));
  const emptyTitle=query?'По запросу ничего не найдено':filter==='closed'?'Завершённых прогнозов пока нет':filter==='active'?'Нет позиций в игре':'Предстоящих позиций банка пока нет';
  $('#forecast-cards').innerHTML=list.length?list.map(e=>`<article class="forecast-card">
    <div class="forecast-card-top"><span>${esc(e.match.tournament)} · ${esc(e.match.format)}</span><span class="model-chip">${esc(e.bank)}${e.bank==='Coin50'?' · контроль':''}</span></div>
    <div class="match-time">${date(e.match.starts_at)} МСК</div><h3>${esc(e.match.teams[0])}<span>vs</span>${esc(e.match.teams[1])}</h3>
    <div class="pick"><span>${e.paper?'КАРТА №'+e.paper.map_number+' · ИССЛЕДОВАТЕЛЬСКИЙ ВЫБОР':'ПОБЕДИТЕЛЬ МАТЧА'}</span><strong>${esc(e.quote.outcome)}</strong></div>
    ${e.paper?.forecast_id?`<button class="text-button" data-open-match="${esc(e.paper.forecast_id)}">Роспись по всем названиям карт ↗</button>`:''}
    <div class="pick-metrics"><div><span>${e.paper?'Минимальная P по картам':'Вероятность'}</span><b>${pct(e.prediction.p)}</b></div><div><span>Коэффициент</span><b>${esc(e.quote.odds)}</b></div><div><span>${e.paper?'Сценарная оценка EV':'Ожидаемый EV'}</span><b class="positive">${pct(e.ev)}</b></div></div>
    <div class="pick-meta"><span>${esc(e.quote.bookmaker)} · линия ${date(e.quote.observed_at)}</span><span>${e.paper?'Оценки по картам '+pct(e.paper.p_min)+' — '+pct(e.paper.p_max)+' · преимущество не доказано':'Неопределённость ± '+pct(e.prediction.uncertainty)}</span><span>Версия ${esc(e.prediction.version)} · зафиксировано ${date(e.fixed_at)} МСК</span></div>
    <div class="pick-footer"><div><span>${esc(statuses[e.status])}</span><strong>${e.pnl==null?money(e.stake):money(e.pnl)+' P&L'}</strong></div><button data-detail="${esc(e.id)}">Обоснование ↗</button></div></article>`).join(''):empty(emptyTitle,query?'Попробуйте другое название матча или турнира.':state.pipeline.status==='waiting'?(state.match_feed?.status==='ok'?'Источник текущих матчей подключён. Исследовательские модели карт обучены; для позиций нужны проверка на новых матчах и линии. Когда модель зафиксирует выбор, он появится здесь.':'Источники для прогноза и обученные модели ещё не подключены. Когда модель зафиксирует выбор, он появится здесь.'):'В этом разделе пока нет подходящих позиций. Прогнозы без пройденных фильтров не публикуются.');
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
  $('#match-feed-cards').innerHTML=feed.matches.some(m=>m.status!=='completed')?feed.matches.filter(m=>m.status!=='completed').map(m=>`<article class="schedule-card"><div class="schedule-top"><span>${esc(m.tournament)} · ${esc(m.format)}</span><span class="schedule-status">${esc(labels[m.status]||m.status)}</span></div><h3>${esc(m.teams[0])}<span>vs</span>${esc(m.teams[1])}</h3><div class="schedule-info"><span>Начало ${date(m.starts_at)} МСК</span>${m.score?`<b>Счёт по картам ${m.score.join(' : ')}</b>`:''}</div><div class="schedule-bottom"><span>Позиция банка не открыта</span><small>Вероятность, EV и позиция появятся только после проверки модели и линии.</small></div></article>`).join(''):empty('В канале нет текущих матчей','Источник ответил успешно. Отсутствие матча в этом канале не означает отмену события.');
}
function renderBookmakers(){
  const data=state.bookmaker_odds;
  if(!data){$('#bookmaker-status').textContent='Первый снимок коэффициентов ещё не опубликован.';return;}
  $('#bookmaker-status').textContent='Фонбет · снимок '+date(data.observed_at)+' МСК · '+data.boards.length+' матчей · '+data.map_markets+' рынков карт · '+data.matched_matches+' матчей сопоставлено с прогнозами'+(data.status==='error'?' · обновление не удалось, предыдущий снимок':Date.now()-new Date(data.observed_at)>2*3600000?' · снимок устарел':'');
  $('#bookmaker-cards').innerHTML=data.boards.length?data.boards.map(b=>`<details class="forward-match"><summary><strong>${esc(b.teams.join(' — '))}</strong><small>${date(b.starts_at)} МСК · ${b.match_link_status==='matched'?'Есть соответствующий прогноз':'Без однозначной связи с прогнозом'}</small></summary><p>${esc(b.competition)} · <a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">Источник: Фонбет ↗</a></p>${table(['КАРТА','П1 / П2','РОВНЫЙ ТОТАЛ','ТБ / ТМ'],b.maps.map(m=>'<tr>'+['№'+m.map_number,m.winner_odds?m.winner_odds.map(x=>Number(x).toFixed(2)).join(' / '):'—',m.balanced_total?String(m.balanced_total.line).replace('.',','):'Нет полной пары',m.balanced_total?[m.balanced_total.over_odds,m.balanced_total.under_odds].map(x=>Number(x).toFixed(2)).join(' / '):'—'].map(cell).join('')+'</tr>'))}</details>`).join(''):empty('Коэффициенты пока не получены','Автоматический цикл повторит получение при следующем обновлении.');
}



function conditionalCard(m,name){
  const data=typeof state==='undefined'?null:state?.conditional_paper;
  const plan=data?.plans.find(p=>p.forecast_id===m.id&&p.model===m.selected_model);
  if(!plan)return '';
  return '<section class="named-choice"><h4>Зафиксировано до старта · '+esc(plan.model)+'</h4><p>'+date(plan.fixed_at)+' МСК · коэффициенты '+date(plan.quote_observed_at)+' МСК. После игры выбор не меняется.</p>'+plan.groups.map(g=>{
    const c=g.choices[name],r=plan.result?.groups.find(x=>x.map_number===g.map_number);
    const actual=r?.actual?.map_name;
    const outcome=c?(c.market==='map_winner'?'Победа '+m.teams[c.team_index]:'ТБ '+String(c.line).replace('.',',')):'Пропуск';
    const labels={won:'Выигрыш',lost:'Проигрыш',push:'Возврат',skip:'Пропуск по плану',not_played:'Не сыграна',cancelled:'Отмена',review:'Проверка результата'};
    return '<p><b>Котировка БК для карты №'+g.map_number+': '+esc(outcome)+'</b>'+(c?' · P '+pct(c.p)+' · кф '+c.odds+' · '+money(g.stake):' · условия отбора не пройдены')+'<br>'+(r?(actual&&actual!==name?'Сыграна другая карта — этот вариант не входит в статистику.':esc(labels[r.status])):'Если эта карта сыграна на данном месте, учитываем этот сохранённый вариант; иначе пропуск.')+'</p>';
  }).join('')+'<p>Резерв покрывает один вариант на место карты. Состав при фиксации: '+esc(plan.roster_status)+'. Только виртуальный эксперимент.</p></section>';
}
function renderConditional(){
  const d=state.conditional_paper,el=$('#conditional-paper');if(!el)return;
  el.hidden=!d;if(!d)return;
  const reasons={no_fresh_quotes:'Нет свежего снимка коэффициентов',unmatched:'Матч не сопоставлен с линией',outside_window:'Матч вне предматчевого окна',legacy_forecast:'Нет новой версии прогноза',rules:'Правила котировки не подтверждены',known_roster_change:'Известны изменения состава',incomplete_maps:'Неполная роспись карт',risk_limit:'Лимит резерва'};
  el.innerHTML='<h2>Условные ставки · автоматический эксперимент</h2><p>До старта фиксируем выбор для каждого названия карты и полученного коэффициента. Сыгранный вариант рассчитывается; остальные не входят в статистику. Резерв — 1% на возможную позицию, до 10% банка. Порог P ≥ 60% и оценочный EV ≥ 3% — условия исследования, не доказательство преимущества.</p>'+table(['МОДЕЛЬ','КАПИТАЛ','РЕЗЕРВ','РАССЧИТАНО','P&L'],d.banks.map(b=>'<tr>'+[esc(b.model),money(b.equity),money(b.reserved),b.settled,money(b.pnl)].map(cell).join('')+'</tr>'))+'<p>Сохранено планов: '+d.plans.length+'. '+(d.last_run?.new_plans?'Новых за цикл: '+d.last_run.new_plans+'. ':'')+Object.entries(d.last_run?.skipped||{}).map(([k,n])=>esc(reasons[k]||k)+': '+n).join(' · ')+'</p><p>Непроверенный состав явно помечается, но не останавливает этот условный исследовательский эксперимент. Известные изменения состава блокируют новый план. Старый банк карт сохранён отдельно.</p>';
}
function namedChoice(m,mapName,line,now=Date.now(),equity=10000000){
  if(m.status!=='waiting')return {status:'closed'};
  if(m.roster?.status==='reported_change'||m.roster?.status==='changed')return {status:'roster_changed'};
  if(!Number.isFinite(new Date(m.starts_at).getTime()))return {status:'missing'};
  if(now>=new Date(m.starts_at).getTime()-60000)return {status:'started'};
  if(m.selected_model==='Coin50')return {status:'control'};
  if(m.forecast_origin==='legacy')return {status:'legacy'};
  const rows=m.maps.filter(x=>x.map_name===mapName);
  if(!rows.length)return {status:'missing'};
  const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
  const p=mean(rows.map(x=>x.winner_probability)),over=mean(rows.map(x=>x.over_probabilities[String(line)]));
  const choices=[{market:'winner',team_index:0,p},{market:'winner',team_index:1,p:1-p},{market:'over',line,p:over}]
    .filter(c=>Number.isFinite(c.p)&&c.p>=.60&&c.p<=1).sort((a,b)=>b.p-a.p);
  if(!choices.length)return {status:'below_threshold'};
  const choice=choices[0];
  return {status:'conditional',...choice,min_odds:Math.ceil(Math.max(1.4,1.03/choice.p)*100-1e-9)/100,
    stake:Math.max(0,Math.floor(equity*.01)),position_created:false,quote_confirmed:false};
}
function choiceCard(m,name,line,equity){
  const frozen=conditionalCard(m,name);if(frozen)return frozen;
  const c=namedChoice(m,name,line,Date.now(),equity);
  const reasons={roster_changed:'Состав изменён или есть сообщение о заменах. Новые позиции заблокированы; вероятности моделью не скорректированы.',closed:'Матч уже рассчитан или отменён.',started:'До старта не осталось 60 секунд. Новые предматчевые позиции не открываем.',control:'Coin50 — контрольный метод, без рекомендаций.',legacy:'Это прежний сохранённый прогноз. Новые позиции по нему не открываем.',missing:'Нет сохранённой оценки карты.',below_threshold:'Ни один исход не прошёл исследовательский порог P ≥ 60%.'};
  if(c.status!=='conditional')return '<section class="named-choice"><h4>Выбор модели · ставки нет</h4><p>'+esc(reasons[c.status])+'</p></section>';
  const outcome=c.market==='winner'?'Победа '+m.teams[c.team_index]:'ТБ '+String(line).replace('.',',');
  return '<section class="named-choice"><h4>Условный выбор модели</h4><strong>Если сыграют '+esc(name.replace('de_',''))+': '+esc(outcome)+'</strong><p>P модели '+pct(c.p)+' · минимальный коэффициент '+c.min_odds.toFixed(2)+' для оценочного EV ≥ 3%.</p><p>План позиции: '+money(c.stake)+' (1% капитала), если будут пройдены все проверки. Сейчас из банка ничего не списывается.</p><p class="choice-blocked"><b>Ставки нет:</b> этот вариант ещё не зафиксирован с полученной котировкой в условном плане. Порог 60% — условие исследования, а не доказанная надёжность или прибыльность.</p></section>';
}
function mapBreakdown(m,selection,board,openedComparisons=new Set(),equity=10000000){
  const pool=new Set(['de_ancient','de_anubis','de_cache','de_dust2','de_inferno','de_mirage','de_nuke']);
  const names=[...new Set(m.maps.map(x=>x.map_name))].filter(name=>pool.has(name)).sort();
  const lines=[...new Set((board?.maps||[]).map(q=>q.balanced_total?.line).filter(x=>x!=null))];
  const common=lines.length===1&&m.maps.every(x=>Number.isFinite(x.over_probabilities[String(lines[0])]))?lines[0]:null;
  const threshold=selection==='book'?(common??20.5):Number(selection);
  const scope=selection==='book'?(common!=null?'Одинаковый порог в доступных линиях Фонбет':lines.length>1?'Порог для просмотра · линии БК различаются':'Порог для просмотра · единой линии БК нет'):'Выбранный порог для просмотра';
  const mean=values=>values.reduce((sum,p)=>sum+p,0)/values.length;
  return '<div class="map-breakdown">'+names.map(name=>{
    const rows=m.maps.filter(x=>x.map_name===name);
    const actual=rows.find(x=>x.actual)?.actual;
    if(m.status==='settled'&&!actual)return '';
    const p=mean(rows.map(x=>x.winner_probability));
    const over=mean(rows.map(x=>x.over_probabilities[String(threshold)]));
    const favorite=Math.abs(p-.5)<1e-9?'Равные шансы':'Фаворит: '+m.teams[p>.5?0:1];
    const comparisons=rows[0].models;
    const compare=comparisons?'<details class="map-model-comparison" data-comparison-key="'+esc(m.id+'_'+name)+'" '+(openedComparisons.has(m.id+'_'+name)?'open':'')+'><summary>Сравнить все 5 моделей</summary>'+table(['МОДЕЛЬ',m.teams[0],m.teams[1],'P(ТБ '+String(threshold).replace('.',',')+')'],Object.entries(comparisons).map(([name,v])=>'<tr>'+[esc(name)+(name===m.selected_model?' ●':''),pct(v.winner_probability),pct(1-v.winner_probability),pct(v.over_probabilities[String(threshold)])].map(cell).join('')+'</tr>'))+'</details>':'';
    return `<article class="map-probability"><h3>${esc(name.replace('de_','').replace(/^./,x=>x.toUpperCase()))}</h3><p>${esc(favorite)}</p><div class="map-team-pair"><div><span>${esc(m.teams[0])}</span><strong class="${p>.5?'positive':''}">${pct(p)}</strong></div><div><span>${esc(m.teams[1])}</span><strong class="${p<.5?'positive':''}">${pct(1-p)}</strong></div></div><div class="map-win-bar" role="img" aria-label="${esc(m.teams[0])}: ${pct(p)}; ${esc(m.teams[1])}: ${pct(1-p)}"><span style="width:${p*100}%"></span></div><div class="map-total"><span>ТБ ${String(threshold).replace('.',',')} раунда</span><strong>${pct(over)}</strong></div><p class="map-total-scope">${esc(scope)} · с овертаймами</p>${choiceCard(m,name,threshold,equity)}${compare}${actual?'<p class="map-result">Сыграна: '+esc(actual.score.join(' : '))+' · '+actual.rounds_actual+' раундов</p>':''}</article>`;
  }).join('')+'</div>';
}
function rosterNote(m){
  const r=m.roster;if(!r)return '';
  const reported=r.status==='reported_change',changed=r.status==='changed';
  let text=reported?'Сообщено о '+r.report.replacement_count+' заменах у '+r.report.team+'. Источник: сообщение пользователя, независимо не подтверждено. Отметка добавлена '+date(r.report.reported_at)+' МСК; она не была известна модели при фиксации прогноза.':changed?'Полученный состав отличается от ранее наблюдавшейся пятёрки. Это не подтверждает, что замены временные.':r.status==='unchanged_observed'?'Полученные пятёрки совпали с предыдущим наблюдением. Это не гарантия отсутствия изменений перед игрой.':r.status==='no_baseline'?'Пятёрки получены, но нет предыдущего состава для сравнения.':'Состав не проверен: нет свежих полных пятёрок обеих команд.';
  const players=(r.teams||[]).filter(t=>t.complete).map(t=>t.nicknames.map(esc).join(', ')).join(' / ');
  return '<aside class="roster-note"><strong>'+(reported||changed?'Состав изменён — прогноз без учёта замен':'Составы · '+(r.status==='unchanged_observed'?'совпали с прошлым наблюдением':'не проверены'))+'</strong><p>'+esc(text)+'</p>'+(players?'<p>Пятёрки Cito: '+players+'. Снимок '+date(r.checked_at)+' МСК.</p>':'')+'<p>Текущие модели не используют игроков как признаки. '+(r.block_new_positions?'Обычные новые позиции заблокированы. В условном исследовании неизвестный состав отмечается отдельно; известные изменения блокируют новый план.':'Проверка состава сама по себе не разрешает ставку: остальные фильтры сохраняются.')+' Старые позиции и прогнозы сохраняются.</p></aside>';
}
function availableFor(m,model){
  return (m.available_models||Object.keys(m.maps?.[0]?.models||{CatBoost:true})).includes(model);
}
function currentMatch(m,now=Date.now()){
  return m.status==='waiting'&&now-new Date(m.starts_at).getTime()<18*3600000;
}
function historyRows(data,now=Date.now()){
  const matches=(data.model_forecasts||data.research_forward)?.matches||[];
  const rows=[],covered=new Set();
  const plans=data.conditional_paper?.plans||[];
  for(const p of plans){
    covered.add(p.forecast_id);
    for(const g of p.groups){
      const r=p.result?.groups.find(x=>x.map_number===g.map_number),c=r?.choice;
      const hasPick=Object.values(g.choices).some(Boolean);
      const pick=c?(c.market==='map_winner'?'Победа '+p.match.teams[c.team_index]:'ТБ '+String(c.line).replace('.',',')):
        r?'Пропуск':hasPick?'Условный план · ждём сыгранную карту':'Пропуск на всех картах';
      rows.push({match:p.match.teams.join(' — '),starts_at:p.match.starts_at,model:p.model,phase:'Условный эксперимент',
        map:r?.actual?.map_name?.replace('de_','')||'Карта №'+g.map_number,pick,odds:c?.odds??null,
        result:r?.status||(hasPick?'waiting':'skip'),score:r?.actual?.score?.join(' : ')||'',
        pnl:c&&r.payout!=null?r.payout-g.stake:null,forecast_id:p.forecast_id});
    }
  }
  for(const e of data.forecasts||[]){
    if(e.conditional)continue;
    if(e.paper?.forecast_id)covered.add(e.paper.forecast_id);
    rows.push({match:e.match.teams.join(' — '),starts_at:e.match.starts_at,model:e.bank,phase:'Прежний банк',
      map:e.paper?.actual?.map_name?.replace('de_','')||e.match.format,pick:e.quote.outcome,odds:e.quote.odds,
      result:e.status,score:e.paper?.actual?.score?.join(' : ')||'',pnl:e.pnl,forecast_id:e.paper?.forecast_id});
  }
  for(const m of matches){
    if(covered.has(m.id))continue;
    rows.push({match:m.teams.join(' — '),starts_at:m.starts_at,model:'—',phase:'Прогноз без позиции',map:'—',
      pick:'Ставка не фиксировалась',odds:null,result:m.status==='settled'?'no_bet':m.status==='void'?'cancelled':m.status==='review'?'review':'waiting',
      score:m.maps.filter(x=>x.actual).map(x=>x.map_name.replace('de_','')+' '+x.actual.score.join(':')).filter((x,i,a)=>a.indexOf(x)===i).join(' · '),pnl:null,forecast_id:m.id});
  }
  return rows.filter(r=>typeof r.odds==='number'&&Number.isFinite(r.odds)&&r.odds>1).sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at)||a.match.localeCompare(b.match)||a.model.localeCompare(b.model));
}
function renderHistory(){
  const el=$('#history-table');if(!el)return;
  const selected=$('#history-model').value||'all',search=$('#history-search').value.toLowerCase(),scope=$('#history-status').value;
  const all=historyRows(state),models=[...new Set(all.map(r=>r.model).filter(m=>m!=='—'))].sort();
  $('#history-model').innerHTML='<option value="all">Все модели</option>'+models.map(m=>'<option>'+esc(m)+'</option>').join('');
  $('#history-model').value=models.includes(selected)?selected:'all';
  const done=r=>['won','lost','push','void','cancelled','not_played','no_bet'].includes(r.result)||r.result==='skip'&&new Date(r.starts_at)<=Date.now();
  const rows=all.filter(r=>(selected==='all'||r.model===selected||r.model==='—')&&
    [r.match,r.map,r.pick].join(' ').toLowerCase().includes(search)&&
    (scope==='all'||scope==='done'&&done(r)||scope==='waiting'&&!done(r)&&new Date(r.starts_at)<=Date.now()));
  const labels={won:'Выигрыш',lost:'Проигрыш',push:'Возврат',void:'Возврат / отмена',cancelled:'Отмена / изменение матча',not_played:'Карта не сыграна',skip:'Пропуск',no_bet:'Завершён · без ставки',waiting:'Ждём результата',active:'Ждём результата',pending:'Ждём подтверждения',review:'Результат на проверке'};
  $('#history-count').textContent='Ставок: '+rows.length+' из '+all.length+'. Только зафиксированные позиции; пропуски и несыгранные условные варианты скрыты.';
  el.innerHTML=rows.length?table(['МАТЧ / ДАТА · МСК','МОДЕЛЬ / КАРТА','СТАВКА','КФ','РЕЗУЛЬТАТ','P&L'],rows.map(r=>'<tr>'+[
    (r.forecast_id?'<button class="text-button" data-open-match="'+esc(r.forecast_id)+'">'+esc(r.match)+'</button>':esc(r.match))+'<small>'+date(r.starts_at)+'</small>',
    esc(r.model)+'<small>'+esc(r.map)+' · '+esc(r.phase)+'</small>',esc(r.pick),r.odds==null?'—':Number(r.odds).toFixed(2),
    esc(labels[r.result]||r.result)+(r.score?'<small>'+esc(r.score)+'</small>':''),r.pnl==null?'—':money(r.pnl)].map(cell).join('')+'</tr>')):
    empty('Записей по этому фильтру нет','Выбери все записи или другой статус.');
}
function renderForward(){
  const data=state.model_forecasts||state.research_forward;
  if(!data){$('#forward-cards').innerHTML=empty('Ждём первый автоматический расчёт','Будет роспись вероятностей для каждого названия карты.');return;}
  const opened=new Set([...document.querySelectorAll('#forward-cards details[data-forecast-id][open]')].map(x=>x.dataset.forecastId));
  const openedComparisons=new Set([...document.querySelectorAll('#forward-cards details[data-comparison-key][open]')].map(x=>x.dataset.comparisonKey));
  const select=$('#forward-line'),old=select.value||'book';
  select.innerHTML='<option value="book">Общий порог Фонбет / просмотр 20,5 без общего порога</option>'+data.lines.map(line=>`<option value="${line}">ТБ ${String(line).replace('.',',')}</option>`).join('');select.value=old;
  const line=select.value,filter=$('#forward-filter').value;
  const modelSelect=$('#forward-model'),previousModel=modelSelect.value||'CatBoost';
  const modelNames=data.model_names||['CatBoost'];
  modelSelect.innerHTML=modelNames.map(n=>`<option>${esc(n)}</option>`).join('');
  modelSelect.value=modelNames.includes(previousModel)?previousModel:modelNames[0];
  const selectedModel=modelSelect.value;

  const stale=Date.now()-new Date(data.last_run_at)>10*3600000;
  $('#forward-status').textContent='Расчёт '+date(data.last_run_at)+' МСК · '+data.matches.filter(m=>currentMatch(m)).length+' актуальных серий · '+data.scored_maps+' сыгранных карт оценено'+(stale?' · обновление задерживается':'');
  const winner=data.metrics_by_model?.[selectedModel]?.winner_metrics||data.winner_metrics;
  $('#forward-stats').textContent=winner?selectedModel+' · по заранее сохранённым прогнозам проверено '+winner.n+' сыгранных карт · Brier победителя '+num(winner.brier)+' · верных '+pct(winner.accuracy):selectedModel+' · новые прогнозы фиксируются до игры. Статистика появится после завершения этих матчей; прибыльность не доказана.';
  if(selectedModel==='XGBoost'&&data.comparison?.calibration_weights.XGBoost.winner===0)$('#forward-stats').textContent+=' XGBoost: настройка выбрала 50/50 для победителя; вероятности ТБ остаются отдельными.';
  const labels={waiting:'Ожидаем игру / результат',settled:'Сыгранные карты рассчитаны',void:'Отмена или изменение матча',review:'Результат требует проверки'};
  const matches=data.matches.map(m=>({...m,selected_model:selectedModel,maps:m.maps.map(x=>({...x,...(x.models?.[selectedModel]||{})}))})).filter(m=>filter==='archive'?!currentMatch(m):filter==='resolved'?m.status!=='waiting':currentMatch(m)&&(filter==='upcoming'?new Date(m.starts_at)>Date.now():filter==='live'?new Date(m.starts_at)<=Date.now():true));
  $('#forward-cards').innerHTML=matches.length?matches.map(m=>{
    const board=state.bookmaker_odds?.boards.find(b=>b.forecast_id===m.id);
    const available=availableFor(m,selectedModel);
    const matchStatus=m.status==='waiting'&&Date.now()>=new Date(m.starts_at)?'Начало по расписанию прошло · ждём результат':labels[m.status];
    const position=state.forecasts.find(p=>!p.conditional&&(p.paper?.forecast_id===m.id||p.paper?.match_id===m.match_id));
    return `<details class="forward-match" data-forecast-id="${esc(m.id)}" ${opened.has(m.id)?'open':''}><summary><strong>${esc(m.teams.join(' — '))}</strong><small>${date(m.starts_at)} МСК · BO${m.best_of} · ${esc(matchStatus)}${m.forecast_origin==='legacy'?' · сохранённый CatBoost':''}</small><span class="breakdown-link">Открыть роспись по названиям карт ↓</span></summary><p class="muted">${esc(m.event)} · прогноз сохранён ${date(m.issued_at)} МСК. Каждое название — отдельный сценарий; карта ещё может быть не выбрана. ${m.map_order_feature===false?'Модель '+esc(selectedModel)+' обучена без номера карты. Для каждого названия одна оценка; ниже можно сравнить все пять моделей.':'Показано среднее заранее сохранённых сценариев порядка с равными весами.'} Зелёным выделена команда-фаворит.</p>${rosterNote(m)}${available?mapBreakdown(m,line,board,openedComparisons,state.conditional_paper?.banks.find(b=>b.model===selectedModel)?.equity??10000000):empty("Предматчевого прогноза "+selectedModel+" для этой игры нет","У этой модели нет заранее сохранённого прогноза на этот матч. Прежний прогноз CatBoost доступен; прогнозы задним числом не создаются.")+'<button data-show-catboost="'+esc(m.id)+'">Показать сохранённый CatBoost</button>'}${position?'<aside class="map-paper-note"><strong>Ранее зафиксированная позиция банка · прежняя версия модели</strong><p>'+esc(position.quote.outcome)+' · '+money(position.stake)+' · коэффициент '+position.quote.odds+'. Банк выбрал исход по минимальной оценке среди всех названий карт; это не означает, что карта уже выбрана.</p><button data-detail="'+esc(position.id)+'">Детали позиции</button></aside>':''}</details>`;
  }).join(''):empty('В этом разделе пока нет записей','Результаты появятся после завершения матчей.');
}
function openMatch(id){
  const data=state.model_forecasts||state.research_forward;
  const oldMatch=state.research_forward?.matches.find(m=>m.id===id);
  const match=data?.matches.find(m=>m.id===id||(oldMatch&&m.match_id===oldMatch.match_id));
  if(!match&&oldMatch){$('#detail-content').textContent='Новые модели запущены после фиксации прежнего прогноза. Прогнозы задним числом не создаются.\n\n'+JSON.stringify(oldMatch,null,2);$('#details').showModal();return;}

  if(!match)return;
  if(!$('#forward-filter option[value=resolved]'))$('#forward-filter').insertAdjacentHTML('beforeend','<option value=resolved>Архив · рассчитанные</option><option value=archive>Архив · ждут проверки</option>');
  $('#forward-filter').value=currentMatch(match)?'waiting':'resolved';
  if(match.status==='waiting'&&!currentMatch(match))$('#forward-filter').value='archive';
  renderForward();nav('forecasts');
  const detail=[...document.querySelectorAll('#forward-cards details')].find(d=>d.dataset.forecastId===match.id);
  if(detail){detail.open=true;detail.scrollIntoView({block:'start',behavior:'smooth'});}
}
function render(){
  const b=state.banks.find(x=>x.name===bank);
  $('#banks').innerHTML=state.banks.map(x=>`<button data-bank="${esc(x.name)}" class="${x.name===bank?'selected':''}">${esc(x.name)}${x.name==='Coin50'?' · контроль':''}</button>`).join('');
  const stale=Date.now()-new Date(state.generated_at)>2*3600000;
  const status=state.pipeline.status;
  const label=stale?'Снимок давно не обновлялся':status==='ok'?'Последний цикл завершён':status==='waiting'?(state.research_forward?'Исследовательские прогнозы работают':'Ожидаем первые прогнозы'):'Обработка данных требует внимания';
  const description=stale?'На экране последний сохранённый снимок. Смотрите время фиксации каждого прогноза.':status==='waiting'?(state.match_feed?.status==='ok'?'Источник текущих матчей подключён. Исследовательские модели карт обучены. Условные прогнозы всех карт и их статистика — ниже. Исследовательские позиции карт ведутся в отдельном виртуальном банке; строгий протокол показан отдельно.':'Стенд доступен. Источники для прогнозов и обученные модели пока не подключены.'):status==='ok'?'Каждый опубликованный выбор прошёл фильтры и сохранён в виртуальном банке.':'Новые прогнозы могут задерживаться. Ранее зафиксированная история сохранена.';
  $('#status').innerHTML=`<span class="statusicon">${status==='ok'&&!stale?'✓':'Ⅱ'}</span><div><strong>${label}</strong><p>${description}</p></div><span class="pill">PAPER ONLY</span>`;
  $('#updated').textContent='Снимок '+date(state.generated_at)+' МСК';
  $('#public-updated')?.remove();
  const stamp=document.createElement('p');stamp.id='public-updated';stamp.className='publication-stamp';stamp.textContent='Снимок: '+date(state.generated_at)+' МСК · обновление по расписанию раз в час';$('#status').after(stamp);
  $('#stats').innerHTML=[['Виртуальный капитал',money(b.equity),'Доходность банка '+pct(b.return)],['Доступный остаток',money(b.available),'Для новых виртуальных позиций'],['Зарезервировано',money(b.reserved),b.conditional?'Условных мест в резерве: '+b.pending_slots:'Открытых позиций: '+state.forecasts.filter(e=>e.bank===bank&&!closed(e)).length],['Реализованный P&L',money(b.pnl),'ROI '+pct(b.roi)+' · рассчитано '+b.settled]].map(x=>`<div class="stat"><label>${x[0]}</label><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
  $('#equity-chart').innerHTML=chartCurve(b);$('#return-chart').innerHTML=returnChart(b);
  $('#match-limit').textContent=b.research?'1% · одна позиция':'2%';
  $('#drawdown').textContent='Макс. просадка '+pct(b.max_drawdown);
  const exposure=b.equity?b.reserved/b.equity:0;
  $('#exposure').textContent=pct(exposure)+' / 10%';$('#meter').style.width=Math.min(100,exposure*1000)+'%';
  $('#active-preview').innerHTML=positionTable(state.forecasts.filter(e=>e.bank===bank&&!closed(e)).slice(0,5));
  renderForecasts();renderMatchFeed();renderBookmakers();renderForward();renderPaper();renderSuiteComparison();renderSourceHealth();renderConditional();renderHistory();
  $('#model-table').innerHTML=table(['МОДЕЛЬ','КАПИТАЛ','ROI','ПРОСАДКА','ПОЗИЦИЙ','ОБЩАЯ N','LOG LOSS','BRIER','ECE','95% CI BRIER'],state.banks.map(x=>'<tr>'+[`${esc(x.name)}<small>${state.registered_models.includes(x.name)?'Версия зарегистрирована':x.research?'Экспериментальные позиции карт':state.model_forecasts?.model_names.includes(x.name)?'Прогнозы карт работают · строгий банк отдельно':state.research?.model===x.name?'Обучена для исследования · не подключена':'Не подключена'}</small>`,money(x.equity),pct(x.roi),pct(x.max_drawdown),x.positions,x.quality.n,num(x.quality.log_loss),num(x.quality.brier),num(x.quality.ece),x.quality.brier_ci95?x.quality.brier_ci95.map(num).join(' — '):'Недостаточно данных'].map(cell).join('')+'</tr>'));
  const mapData=state.map_data;
  $('#map-data-status').textContent=mapData?'Cito API · согласованных записей карт: '+mapData.maps+' · серий: '+mapData.matches+'. Снимок: '+date(mapData.observed_at)+' МСК. На этой истории обучены модели. Новые условные прогнозы фиксируются заранее для всех поддерживаемых карт.':'Сводка источника счетов карт ещё не опубликована. Модели карт не подключены.';
  const research=state.research;
  $('#research-panel').hidden=!research;
  if(research){
    const test=research.splits.test;
    $('#research-period').textContent='Отложенный период: '+test.from+' — '+test.to+' · '+test.n+' матчей · обучение: '+research.splits.training.n+' · калибровка: '+research.splits.calibration.n;
    $('#research-verdict').textContent=research.outcome==='baseline_better'?'В этой проверке CatBoost уступил простому Elo. Модель сохранена для исследования; виртуальные позиции по ней не открываются.':'На этой исторической выборке CatBoost снизил log loss относительно Elo. Для допуска к виртуальным позициям нужна дополнительная проверка.';
    $('#research-metrics').innerHTML=table(['МЕТОД','LOG LOSS ↓','BRIER ↓','ДОЛЯ ВЕРНЫХ ИСХОДОВ'],Object.entries(research.metrics).map(([name,m])=>'<tr>'+[esc(name),num(m.log_loss),num(m.brier),pct(m.accuracy)].map(cell).join('')+'</tr>'));
  }
  const maps=research?.map_experiment;
  $('#map-research-panel').hidden=!maps;
  if(maps){
    $('#map-research-period').textContent='Обучение: '+maps.splits.training.maps+' карт · настройка вероятностей: '+maps.splits.calibration.maps+' · проверка: '+maps.splits.test.maps+' карт / '+maps.splits.test.matches+' серий · '+maps.splits.test.from+' — '+maps.splits.test.to;
    $('#map-research-verdict').textContent='Победитель карты: в этой проверке модель уступила прогнозу 50/50. Тотал: распределение числа раундов немного улучшилось относительно частотной модели по картам. Два дня проверки не доказывают устойчивое преимущество.';
    const labels={CatBoost:'CatBoost',Calibrated:'CatBoost после настройки вероятностей',Coin50:'50/50',MapFrequency:'Частоты результатов по карте'};
    $('#map-winner-metrics').innerHTML=table(['ПОБЕДИТЕЛЬ КАРТЫ','LOG LOSS ↓','BRIER ↓','ВЕРНЫХ ИСХОДОВ'],Object.entries(maps.winner_metrics).map(([name,m])=>'<tr>'+[esc(labels[name]),num(m.log_loss),num(m.brier),pct(m.accuracy)].map(cell).join('')+'</tr>'));
    $('#map-rounds-metrics').innerHTML=table(['ЧИСЛО РАУНДОВ','LOG LOSS ↓','ОШИБКА РАСПРЕДЕЛЕНИЯ ↓'],Object.entries(maps.rounds_metrics).map(([name,m])=>'<tr>'+[esc(labels[name]),num(m.log_loss),num(m.ranked_probability_score)].map(cell).join('')+'</tr>'));
  }
  const roster=research?.roster_experiment;
  $('#roster-panel').hidden=!roster;
  if(roster){
    const test=roster.splits.test;
    $('#roster-period').textContent=test.from+' — '+test.to+' · '+test.n+' матчей · обучение: '+roster.splits.training.n+' · калибровка: '+roster.splits.calibration.n;
    $('#roster-verdict').textContent='На этих матчах история составов снизила ошибку CatBoost, но Elo сохранил меньший log loss. Устойчивое преимущество пока не доказано.';
    const labels={'Elo':'Elo','CatBoost-rosters':'CatBoost · с составами','CatBoost-results':'CatBoost · без составов','Coin50':'Coin50'};
    $('#roster-metrics').innerHTML=table(['МЕТОД','LOG LOSS ↓','BRIER ↓','ДОЛЯ ВЕРНЫХ ИСХОДОВ'],Object.entries(roster.metrics).map(([name,m])=>'<tr>'+[esc(labels[name]||name),num(m.log_loss),num(m.brier),pct(m.accuracy)].map(cell).join('')+'</tr>'));
  }
  $('#quality-note').textContent=state.quality_note;$('#cohort').textContent='N = '+state.common_cohort;
  $('#calibration').innerHTML=b.quality.n?table(['ДИАПАЗОН P','N','СРЕДНЯЯ P','ЧАСТОТА ПОБЕД'],b.quality.calibration.map(x=>'<tr>'+[`${pct(x.lower)}–${pct(x.lower+.1)}`,x.n,pct(x.predicted),pct(x.observed)].map(cell).join('')+'</tr>')):empty('Качество ещё не измерено','Нужны предматчевые прогнозы всех моделей и подтверждённые результаты.');
  $('#integrity').textContent=state.integrity_ok?'✓ ПРОВЕРЕНО ПРИ ПУБЛИКАЦИИ':'НАРУШЕНА ЦЕЛОСТНОСТЬ';
  const kinds={OPENING:'Начальный капитал',RUN_START:'Начало цикла',RUN_END:'Завершение цикла',POSITION:'Виртуальная позиция',SETTLEMENT:'Расчёт позиции',FORECAST:'Оценка модели',DECISION:'Решение',INPUT:'Снимок данных',SCHEDULE:'Расписание',MODEL:'Регистрация модели',PENDING:'Ожидание результата',RESULT:'Получен результат',REVIEW:'Требуется проверка',DISPLAY_FEED:'Загружены матчи для отображения',DISPLAY_FEED_ERROR:'Ошибка обновления матчей'};
  $('#journal-table').innerHTML=table(['№','ВРЕМЯ · МСК','СОБЫТИЕ','БАНК','ХЕШ',''],state.journal.slice().reverse().map(e=>'<tr>'+[e.seq,date(e.at),esc(kinds[e.kind]||e.kind),esc(e.bank),esc(e.hash.slice(0,16))+'…',`<button data-detail="${esc(e.id)}">Открыть</button>`].map(cell).join('')+'</tr>'));
  $('#source-cards').innerHTML=`<article class="panel"><h2>ViewYourTeam</h2><span class="pill">${state.match_feed?.status==='ok'?'КАНАЛ ПОДКЛЮЧЁН':state.match_feed?.status==='error'?'ОШИБКА ОБНОВЛЕНИЯ':'НЕ ПОДКЛЮЧЁН'}</span><p class="muted">Текущие матчи для отображения с указанием источника. Эти данные не используются для обучения моделей или расчёта банка.</p><a href="https://viewyourteam.com/api-docs" target="_blank" rel="noopener noreferrer">Источник и условия ↗</a></article>`+Object.entries(state.sources).map(([name,at])=>`<article class="panel"><h2>${esc(name)}</h2><span class="pill">${at?'ЕСТЬ ПОЛУЧЕННЫЕ СНИМКИ':'ИСТОЧНИК НЕ ПОДКЛЮЧЁН'}</span><p class="muted">${at?'Последнее наблюдение: '+date(at)+' МСК':'Получение линии и условия использования ещё предстоит подтвердить.'}</p></article>`).join('');
}

function attachConditional(next){
  const d=next.conditional_paper;if(!d)return;
  next.banks.unshift(...d.banks.map(b=>({...b,research:true,conditional:true,return:b.pnl/b.initial,quality:{n:0,calibration:[],log_loss:null,brier:null,ece:null,brier_ci95:null}})));
  for(const p of d.plans)for(const r of p.result?.groups||[]){
    if(!r.choice||!['won','lost','push'].includes(r.status))continue;
    const g=p.groups.find(x=>x.map_number===r.map_number),c=r.choice;
    next.forecasts.push({id:p.id+'_'+r.map_number,conditional:true,bank:p.model+' · условные',fixed_at:p.fixed_at,stake:g.stake,ev:c.estimated_ev,status:r.status==='push'?'void':r.status,pnl:r.payout-g.stake,
      match:{teams:p.match.teams,tournament:'Условный план · сыгранная карта',format:r.actual.map_name.replace('de_',''),starts_at:p.match.starts_at},
      quote:{outcome:r.actual.map_name.replace('de_','')+' · '+(c.market==='map_winner'?'Победа '+p.match.teams[c.team_index]:'ТБ '+c.line),market:c.market,odds:c.odds,bookmaker:p.bookmaker,observed_at:p.quote_observed_at},
      prediction:{p:c.p,version:d.policy.version},paper:{forecast_id:p.forecast_id,match_id:p.match.id},
      explanation:'Условный выбор и коэффициент сохранены до старта. Этот вариант сыгран; остальные не входят в статистику. Состав при фиксации: '+p.roster_status});
  }
  if(!next.banks.some(x=>x.name===bank))bank=d.banks[0].name;
}
function attachPaper(next){
  const r=next.research_paper;if(!r){if(!next.banks.some(x=>x.name===bank))bank=next.banks[0].name;return;}
  next.banks.unshift({...r,research:true,return:r.pnl/r.initial,quality:{n:0,calibration:[],log_loss:null,brier:null,ece:null,brier_ci95:null}});
  for(const p of r.positions_list){
    const outcome='Карта №'+p.map_number+' · '+(p.market==='map_winner'?'Победа '+p.teams[p.team_index]:'ТБ '+String(p.line).replace('.',','));
    next.forecasts.push({id:p.id,bank:r.name,fixed_at:p.fixed_at,stake:p.stake,ev:p.estimated_ev,status:p.status,pnl:p.pnl,
      match:{teams:p.teams,tournament:'Отдельная виртуальная позиция банка',format:'Карта №'+p.map_number,starts_at:p.starts_at},
      quote:{outcome,market:p.market,odds:p.odds,bookmaker:p.bookmaker,observed_at:p.quote_observed_at},
      prediction:{p:p.p_min,version:p.model_version},paper:p,
      explanation:'Минимальная оценка среди всех поддерживаемых карт. Это сценарный отбор, а не доверительная граница. Преимущество модели не доказано. Только виртуальная позиция.'});
  }
  if(!next.banks.some(x=>x.name===bank))bank=next.banks[0].name;
}
function renderPaper(){
  const r=state.research_paper,el=$('#paper-protocol');if(!el)return;
  el.hidden=!r;if(!r)return;
  $('#paper-description').textContent='Отдельный исследовательский банк CatBoost: победитель карты или ТБ по ровной линии Фонбет. Пока только карта №1, одна позиция на матч. Старт 100 000 ₽; размер 1% капитала, общий резерв до 10%. Название карты не выбирается заранее: используем минимальную оценку среди всех поддерживаемых карт. Это не доверительная граница; прибыльность модели не доказана.';
  if(r.opening_enabled===false)$('#paper-description').textContent+=' Старый отбор новых позиций по карте №1 отключён. Открытые позиции рассчитываются; новые выборы по названиям карт пока условные.';
  $('#paper-audit').textContent='Журнал проверен · событий: '+r.events+' · '+r.head_hash.slice(0,16)+'… · фиксируем только свежие коэффициенты до старта серии; учитываем овертаймы. Исправления результатов сохраняются отдельными событиями.';
  const rows=r.journal.slice().reverse().map(e=>'<tr>'+[e.seq,date(e.at),esc({OPENING:'Начало эксперимента',POLICY_UPDATE:'Переход на актуальный пул из 7 карт',OPENING_CONTROL:'Новые позиции ждут подтверждения названия карты и котировки',POSITION:'Зафиксирована позиция',RESOLUTION:'Расчёт / исправление'}[e.kind]),esc(e.hash.slice(0,16))+'…'].map(cell).join('')+'</tr>');
  $('#paper-journal').innerHTML=table(['№','ВРЕМЯ · МСК','СОБЫТИЕ','ХЕШ'],rows);
  $('#paper-quick').innerHTML='<strong>'+r.positions_list.filter(p=>p.status==='active'||p.status==='review').length+' открытых исследовательских позиций · резерв '+money(r.reserved)+'</strong><p>Доступно '+money(r.available)+' · капитал '+money(r.equity)+'. Исход, сумма и коэффициент сохранены до игры.</p><button data-page="overview">Открыть банк и позиции ↗</button>';
}


function renderSuiteComparison(){
  const report=state.model_forecasts?.comparison,panel=$('#suite-comparison');panel.hidden=!report;if(!report)return;
  $('#suite-period').textContent='Обучение '+report.splits.training.maps+' карт · настройка '+report.splits.calibration.maps+' · проверка '+report.splits.test.maps+' карт / '+report.splits.test.matches+' серий. Номер карты исключён из признаков у всех алгоритмов.';
  $('#suite-metrics').innerHTML=table(['МОДЕЛЬ','ПОБЕДИТЕЛЬ · LOG LOSS ↓','BRIER ↓','ВЕРНЫХ','РАУНДЫ · LOG LOSS ↓'],Object.entries(report.metrics).map(([name,v])=>'<tr>'+[esc(name),num(v.winner.log_loss),num(v.winner.brier),pct(v.winner.accuracy),num(v.rounds.log_loss)].map(cell).join('')+'</tr>'));
  const w=report.calibration_weights.XGBoost.winner,stack=report.stack_weights;
  $('#suite-weights').textContent='Вес XGBoost для победителя после настройки: '+pct(w)+'. При нулевом весе прогноз равен 50/50; это результат проверки, а не ошибка. ConvexStack: веса CatBoost / XGBoost / LightGBM для победителя '+stack.winner.map(pct).join(' / ')+', для раундов '+stack.rounds.map(pct).join(' / ')+'.';
}


function renderSourceHealth(){
  const h=state.source_health,box=$('#source-health');if(!box)return;
  box.hidden=!h;if(!h)return;
  const labels={schedule:'Расписание',results:'Результаты',odds:'Коэффициенты',quota:'Квота API',rosters:'Составы'};
  const messages={not_configured:'ключ источника не настроен',collection_error:'ошибка обновления, сохранён предыдущий снимок',stale:'снимок давно не обновлялся',overdue:'есть матчи без подтверждённого результата более 18 часов',exhausted:'лимит запросов достигнут, новые запросы остановлены'};
  const watch=h.result_watch;
  box.innerHTML='<strong>'+(h.status==='attention'?'Нужно внимание к источникам':'Проверка источников работает')+'</strong><p>'+(h.alerts.length?h.alerts.map(a=>esc(labels[a.source])+': '+esc(messages[a.code])+(a.matches?' ('+a.matches+')':'')).join('<br>'):'Ошибок и просроченных снимков не обнаружено.')+'</p><p>Проверка результатов: '+date(watch?.checked_at)+' МСК. Дополнительные запросы — не чаще раза в 2 часа и до 6 в сутки. Квота: '+h.quota.used+' / '+h.quota.cap+' запросов в месяц.</p>';
  box.classList.toggle('attention',h.status==='attention');
}

async function refresh(){
  $('#refresh').disabled=true;
  try{
    const response=await fetch(document.body.dataset.source,{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const next=await response.json();
    if(next.schema_version!==1||!Array.isArray(next.forecasts)||!Array.isArray(next.banks))throw Error('Неподдерживаемый формат данных');
    attachConditional(next);attachPaper(next);state=next;$('#error').hidden=true;render();
  }catch(e){$('#error').hidden=false;$('#error').textContent='Не удалось обновить снимок. Последние загруженные данные сохранены на экране. '+e.message;}
  finally{$('#refresh').disabled=false;}
}
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.dataset.page){if(t.dataset.page==='forecasts'&&state){$('#forward-filter').value='waiting';renderForward();}nav(t.dataset.page);}
  if(t.dataset.openMatch&&state)openMatch(t.dataset.openMatch);
  if(t.dataset.showCatboost&&state){$('#forward-model').value='CatBoost';openMatch(t.dataset.showCatboost);}
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

$('#forward-filter').addEventListener('change',()=>{if(state)renderForward();});
$('#forward-line').addEventListener('change',()=>{if(state)renderForward();});

$('#forward-model').addEventListener('change',()=>{if(state)renderForward();});

for(const id of ['history-model','history-status'])$('#'+id).addEventListener('change',()=>{if(state)renderHistory();});
$('#history-search').addEventListener('input',()=>{if(state)renderHistory();});
