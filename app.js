const state = { courses: [], sourceCard: null };
const $ = selector => document.querySelector(selector);
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4WwGJ6TIuTt0nlvh3Xp2x_0rcJdLx7JInJ_5cy1n9H2sZIr8EGCohbqLQmbasSRjCLe51m6vbXnAa/pub?gid=0&single=true&output=csv';

function parseCSV(text) {
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"'&&cell==='')quoted=true;
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell.length||row.length){row.push(cell);if(row.some(v=>v.trim()))rows.push(row);}
  if(!rows.length)return [];
  const headers=rows.shift().map((h,i)=>h.trim()||`Column ${i+1}`);
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]??'').trim()])));
}
const norm = value => String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function field(record,...candidates){for(const candidate of candidates){const key=Object.keys(record||{}).find(k=>norm(k)===norm(candidate));if(key)return record[key]||'';}return '';}
function patterned(record,patterns){for(const pattern of patterns){const key=Object.keys(record||{}).find(k=>pattern.test(norm(k)));if(key&&record[key])return record[key];}return '';}
function categoryOf(course){return field(course,'Category')||'Uncategorized';}
function categoryClass(category){const c=norm(category);return /core/.test(c)?'core':/specialtopic/.test(c)?'topics':/elective/.test(c)?'electives':'other';}
function titleOf(course){return field(course,'Course Title','Title','Name')||'Untitled course';}
function codeOf(course){return field(course,'Course Codes','Course Code','Course Number','Codes','Code','Number')||patterned(course,[/^(course)?codes?$/,/^(course)?numbers?$/]);}
function creditsOf(course){return field(course,'Credits','Credit','Credit Hours');}
function historyOf(course){return patterned(course,[/recentofferings/,/historicalofferings/,/offerings/,/teachinghistory/,/taught/]);}
function firstOffering(course){const text=historyOf(course);if(!text)return '';return text.split(/,\s*(?=(?:Fall|Spring|Summer)\s+\d{4})|[;\n]+/i).map(x=>x.trim()).filter(Boolean)[0]||'';}

// One shared component ensures matching dimensions and placement across categories.
function renderCourse(course){
  const category=categoryClass(categoryOf(course));
  const code=codeOf(course),history=firstOffering(course);
  const card=document.createElement('article');
  card.className=`course-card ${category}`;card.tabIndex=0;card.setAttribute('role','button');
  card.setAttribute('aria-label',`${titleOf(course)}. Open course details.`);
  const teachingHistory=history&&category==='core'?`<div class="card-meta"><span class="history">Last taught: ${esc(history)}</span></div>`:'';
  card.innerHTML=`<div class="card-code-slot">${code?`<span class="code-pill">${esc(code)}</span>`:''}</div><h3>${esc(titleOf(course))}</h3>${teachingHistory}<span class="card-affordance" aria-hidden="true"></span>`;
  card.addEventListener('click',()=>showDetail(course,category,card));
  card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showDetail(course,category,card);}});
  return card;
}
function showDetail(course,category,sourceCard){
  const code=codeOf(course),title=titleOf(course);
  const titleKey=Object.keys(course).find(k=>['coursetitle','title','name'].includes(norm(k)));
  const categoryKey=Object.keys(course).find(k=>norm(k)==='category');
  const codeKey=Object.keys(course).find(key=>['coursecodes','coursecode','coursenumber','code','number'].includes(norm(key)));
  const visible=new Set([titleKey,categoryKey,codeKey].filter(Boolean));
  const rows=Object.entries(course).filter(([key,value])=>value&&!visible.has(key));
  const dialog=$('#course-dialog');state.sourceCard=sourceCard;dialog.className=`course-dialog ${category}`;
  const origin=sourceCard.getBoundingClientRect();
  $('#course-detail').innerHTML=`${code?`<span class="detail-code">${esc(code)}</span>`:''}<h2>${esc(title)}</h2><table class="detail-table"><tbody>${rows.map(([key,value])=>`<tr><th scope="row">${esc(key)}</th><td>${esc(value)}</td></tr>`).join('')}</tbody></table>`;
  dialog.showModal();
  const panel=dialog.getBoundingClientRect();
  dialog.style.setProperty('--zoom-x',`${origin.left+origin.width/2-panel.left}px`);
  dialog.style.setProperty('--zoom-y',`${origin.top+origin.height/2-panel.top}px`);
  dialog.classList.remove('closing');
  requestAnimationFrame(()=>dialog.classList.add('visible'));
  dialog.querySelector('.close').focus();
}
function closeDetail(){const dialog=$('#course-dialog');if(!dialog.open||dialog.classList.contains('closing'))return;dialog.classList.remove('visible');dialog.classList.add('closing');const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?0:240;window.setTimeout(()=>{if(dialog.open)dialog.close();dialog.classList.remove('closing');},delay);}
function appendGrid(section,records){const grid=section.querySelector('.course-grid');records.forEach(course=>grid.append(renderCourse(course)));}
function renderCourses(){
  const root=$('#curriculum');root.replaceChildren();
  const core=state.courses.filter(course=>categoryClass(categoryOf(course))==='core');
  const topics=state.courses.filter(course=>categoryClass(categoryOf(course))==='topics');
  const electives=state.courses.filter(course=>categoryClass(categoryOf(course))==='electives');
  if(core.length){const section=document.createElement('section');section.className='core-section';section.innerHTML='<div class="section-heading core-heading"><h2>Core Courses</h2></div><div class="course-grid"></div>';appendGrid(section,core);root.append(section);}
  if(topics.length||electives.length){
    const section=document.createElement('section');section.className='electives-section';section.innerHTML='<div class="section-heading electives-heading"><h2>Electives</h2></div><div class="course-grid"></div><div class="legend"><span><i class="legend-swatch topics-swatch"></i>Space-focused Special Topics</span><span><i class="legend-swatch electives-swatch"></i>Other Electives</span></div>';
    [...topics,...electives].forEach(course=>section.querySelector('.course-grid').append(renderCourse(course)));
    root.append(section);
  }
  if(!core.length&&!topics.length&&!electives.length)root.innerHTML='<div class="empty-state">No course records were returned by the Courses tab.</div>';
}
async function load(){
  const error=$('#error');error.hidden=true;
  try{
    const response=await fetch(SHEET_CSV_URL,{cache:'no-store'});
    if(!response.ok)throw Error(`Google Sheets request failed (${response.status}).`);
    state.courses=parseCSV(await response.text());
    if(!state.courses.length)throw Error('The Courses tab returned no course rows.');
    renderCourses();
  }catch(err){error.hidden=false;error.textContent=err.message;$('#curriculum').innerHTML='<div class="empty-state">Course records are unavailable. Reload the page to try again.</div>';}
}
$('#course-dialog .close').addEventListener('click',closeDetail);
$('#course-dialog').addEventListener('click',event=>{if(event.target.id==='course-dialog')closeDetail();});
$('#course-dialog').addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
$('#course-dialog').addEventListener('close',()=>{if(state.sourceCard?.isConnected)state.sourceCard.focus();});
$('#print-page').addEventListener('click',()=>window.print());
load();
