const MONTHS       = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const today        = new Date();
let   viewYear     = today.getFullYear();
let   viewMonth    = today.getMonth();
let   selDay       = null;

/* caching of monthly data: { "2025-05": { 8: {total,checkup,records}, ... } } */
const monthCache = {};

function getCookie(name){
    let v=null;
    if(document.cookie) document.cookie.split(';').forEach(c=>{
        c=c.trim();
        if(c.startsWith(name+'=')) v=decodeURIComponent(c.slice(name.length+1));
    });
    return v;
}

function loadMonth(){
    const key = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}`;
    document.getElementById('calMonthLabel').textContent = MONTHS[viewMonth] + ' ' + viewYear;

    if(monthCache[key]){
        renderCal(monthCache[key]);
        return;
    }

    fetch(`/clinic/slots/?month=${key}`)
        .then(r=>r.json())
        .then(data=>{
            monthCache[key] = data.days || {};
            renderCal(monthCache[key]);
        })
        .catch(()=>{
            renderCal({});
        });
}

function getLoadClass(total){
    if(!total||total===0) return 'load-0';
    if(total<=5)  return 'load-1';
    if(total<=10) return 'load-2';
    if(total<=15) return 'load-3';
    return 'load-4';
}

function renderCal(dayData){
    const first = new Date(viewYear,viewMonth,1).getDay();
    const days  = new Date(viewYear,viewMonth+1,0).getDate();
    const grid  = document.getElementById('daysGrid');
    grid.innerHTML = '';

    for(let i=0;i<first;i++){
        const el=document.createElement('div');el.className='cal-day empty';grid.appendChild(el);
    }

    for(let d=1;d<=days;d++){
        const dt      = new Date(viewYear,viewMonth,d);
        const dow     = dt.getDay();
        const isPast  = dt < new Date(today.getFullYear(),today.getMonth(),today.getDate());
        const isToday = d===today.getDate()&&viewMonth===today.getMonth()&&viewYear===today.getFullYear();
        const isWknd  = dow===0||dow===6;
        const fd      = dayData[d];
        const load    = isWknd ? 'load-0' : getLoadClass(fd?fd.total:0);

        const el=document.createElement('div');
        el.className=`cal-day ${load}`;
        if(isToday) el.classList.add('today');
        if(isPast&&!isToday) el.classList.add('past');
        if(isWknd) el.classList.add('weekend');
        if(selDay&&selDay.d===d&&selDay.m===viewMonth&&selDay.y===viewYear) el.classList.add('selected');

        const numSpan=document.createElement('div');
        numSpan.className='day-num';numSpan.textContent=d;
        el.appendChild(numSpan);

        if(fd&&!isWknd){
            const bar=document.createElement('div');
            bar.className='day-bar';
            const pct=Math.min(100,(fd.total/20)*100);
            bar.style.cssText=`width:${Math.max(pct,20)}%;background:${fd.total>15?'#e6b800':fd.total>10?'var(--c-p3)':fd.total>5?'var(--c-p4)':'var(--c-dim)'};`;
            el.appendChild(bar);
        }

        el.setAttribute('role','gridcell');
        el.setAttribute('aria-label',isWknd?`${d} — weekend`:`${MONTHS[viewMonth]} ${d}${fd?', '+fd.total+' appointments':''}`);

        if(!isWknd&&(!isPast||isToday)){
            el.style.cursor='pointer';
            el.tabIndex=0;
            el.addEventListener('click',()=>pickDay(d,dayData));
            el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickDay(d,dayData);}});
        }
        grid.appendChild(el);
    }
    renderListView(dayData);
}

function pickDay(d, dayData){
    selDay={d,m:viewMonth,y:viewYear};
    const key=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}`;
    renderCal(monthCache[key]||{});
    renderDetail(d, dayData);
}

function renderDetail(d, dayData){
    const fd=dayData[d];
    document.getElementById('detailDate').textContent=`${MONTHS[viewMonth]} ${d}, ${viewYear}`;

    if(!fd){
        document.getElementById('detailBody').innerHTML=`
            <div class="empty-detail">
                <div class="ed-icon" aria-hidden="true">📭</div>
                <p class="ed-text">NO APPOINTMENTS<br/>ON THIS DATE.</p>
            </div>`;
        return;
    }

    const maxLoad    = 20;
    const chkPct     = Math.min(100,(fd.checkup/maxLoad)*100);
    const recPct     = Math.min(100,(fd.records/maxLoad)*100);
    const loadLevel  = fd.total>15?'HEAVY':fd.total>10?'MODERATE':fd.total>5?'LIGHT':'MINIMAL';
    const loadColor  = fd.total>15?'#e6b800':fd.total>10?'var(--c-p4)':'var(--c-lime)';

    const prepItems=[];
    if(fd.checkup>5)  prepItems.push('Prepare additional BP apparatus and thermometers');
    if(fd.checkup>10) prepItems.push('Consider 2 nurses on duty for check-ups');
    if(fd.records>3)  prepItems.push('Pre-sort medical record request forms');
    if(fd.total>12)   prepItems.push('Set up waiting area for overflow');
    if(prepItems.length===0) prepItems.push('Normal staffing is sufficient');

    document.getElementById('detailBody').innerHTML=`
        <div class="total-row">
            <span class="tr-label">TOTAL APPOINTMENTS</span>
            <span class="tr-val" style="color:${loadColor};">${fd.total}</span>
        </div>
        <div class="freq-card checkup">
            <div class="fc-header">
                <span class="fc-label">🩺 PHYSICAL CHECK-UPS</span>
                <span class="fc-count">${fd.checkup}</span>
            </div>
            <div class="fc-bar-wrap"><div class="fc-bar" style="width:${chkPct}%"></div></div>
        </div>
        <div class="freq-card records">
            <div class="fc-header">
                <span class="fc-label">📁 MEDICAL RECORDS</span>
                <span class="fc-count">${fd.records}</span>
            </div>
            <div class="fc-bar-wrap"><div class="fc-bar" style="width:${recPct}%;background:#e6b800;"></div></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:4px;">
            <span style="font-family:var(--font-px);font-size:6px;color:var(--c-muted);letter-spacing:.1em;">LOAD LEVEL</span>
            <span style="font-family:var(--font-px);font-size:7px;color:${loadColor};">${loadLevel}</span>
        </div>
        <div class="prep-note">
            <p class="pn-label">PREPARATION TIPS</p>
            <div class="pn-items">${prepItems.map(p=>`<div class="pn-item">${p}</div>`).join('')}</div>
        </div>`;
}

function changeMonth(dir){
    viewMonth+=dir;
    if(viewMonth>11){viewMonth=0;viewYear++;}
    if(viewMonth<0){viewMonth=11;viewYear--;}
    loadMonth();
}

function renderListView(dayData){
    const tbody=document.getElementById('listTbody');
    tbody.innerHTML='';
    const days=new Date(viewYear,viewMonth+1,0).getDate();
    for(let d=1;d<=days;d++){
        const dow=new Date(viewYear,viewMonth,d).getDay();
        if(dow===0||dow===6) continue;
        const fd=dayData[d];
        if(!fd) continue;
        const isToday=d===today.getDate()&&viewMonth===today.getMonth()&&viewYear===today.getFullYear();
        const barW=Math.min(80,(fd.total/20)*80);
        const tr=document.createElement('tr');
        if(isToday) tr.style.background='rgba(218,255,35,.04)';
        tr.innerHTML=`
            <td><span class="ld-date">${MONTH_SHORT[viewMonth]} ${String(d).padStart(2,'0')}</span>
                ${isToday?'<span class="chip chip-lime" style="margin-left:6px;">TODAY</span>':''}</td>
            <td style="font-family:var(--font-px);font-size:9px;color:var(--c-text);">${fd.total}</td>
            <td><span class="chip chip-purple">${fd.checkup} CHECK-UPS</span></td>
            <td><span class="chip chip-warn">${fd.records} RECORDS</span></td>
            <td><div class="load-bar">
                <div class="lb-fill" style="width:${barW}px;background:${fd.total>15?'#e6b800':fd.total>10?'var(--c-p3)':'var(--c-p4)'};"></div>
                <span class="lb-num">${fd.total>15?'HEAVY':fd.total>10?'MOD':'LIGHT'}</span>
            </div></td>`;
        tr.style.cursor='pointer';
        tr.addEventListener('click',()=>pickDay(d,dayData));
        tbody.appendChild(tr);
    }
}

function setView(v){
    const calCard=document.getElementById('calView').querySelector('.cal-card');
    const listView=document.getElementById('listView');
    const btnCal=document.getElementById('btnCal');
    const btnList=document.getElementById('btnList');
    if(v==='cal'){
        calCard.style.display='';listView.classList.remove('show');
        btnCal.classList.add('active');btnCal.setAttribute('aria-pressed','true');
        btnList.classList.remove('active');btnList.setAttribute('aria-pressed','false');
    } else {
        calCard.style.display='none';listView.classList.add('show');
        btnList.classList.add('active');btnList.setAttribute('aria-pressed','true');
        btnCal.classList.remove('active');btnCal.setAttribute('aria-pressed','false');
    }
}

function updateApptStatus(apptId, newStatus, btn){
    btn.disabled=true;btn.textContent='⏳';
    fetch('{% url "clinic_update_status" %}',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':getCookie('csrftoken')},
        body:JSON.stringify({appt_id:apptId,status:newStatus})
    })
    .then(r=>r.json())
    .then(data=>{
        if(data.ok){
            showToast(data.appt_number+' marked as '+newStatus.toUpperCase());
            const row=document.getElementById('appt-row-'+apptId);
            if(row) row.style.opacity='.4';
            setTimeout(()=>window.location.reload(),900);
        } else {
            showToast('Error: '+(data.error||'Failed'));
            btn.disabled=false;btn.textContent=newStatus==='completed'?'✓ DONE':'✕ CANCEL';
        }
    })
    .catch(()=>{showToast('Connection error.');btn.disabled=false;});
}


loadMonth();


const key=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
setTimeout(()=>{
    const d=today.getDate();
    if(monthCache[key]&&monthCache[key][d]){
        selDay={d,m:today.getMonth(),y:today.getFullYear()};
        renderDetail(d,monthCache[key]);
        loadMonth();
    }
},600);