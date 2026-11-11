const state = { courses: [], sourceCard: null };
const $ = selector => document.querySelector(selector);
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4WwGJ6TIuTt0nlvh3Xp2x_0rcJdLx7JInJ_5cy1n9H2sZIr8EGCohbqLQmbasSRjCLe51m6vbXnAa/pub';
const TOP_LANGUAGE_CSV_URL = `${SHEET_URL}?gid=1528805080&single=true&output=csv`;
const COURSES_CSV_URL = `${SHEET_URL}?gid=0&single=true&output=csv`;

function parseCSVRows(text) {
  text=text.replace(/^\uFEFF/,'');
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
  return rows;
}
function parseCSV(text) {
  const rows=parseCSVRows(text);
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
function frequencyOf(course){return field(course,'Frequency','Frequency of Offering').trim();}
function titleOf(course){return field(course,'Course Title','Title','Name')||'Untitled course';}
function codeOf(course){return field(course,'Course Codes','Course Code','Course Number','Codes','Code','Number')||patterned(course,[/^(course)?codes?$/,/^(course)?numbers?$/]);}
function creditsOf(course){return field(course,'Credits','Credit','Credit Hours');}
function historyOf(course){return patterned(course,[/recentofferings/,/historicalofferings/,/offerings/,/teachinghistory/,/taught/]);}
function firstOffering(course){const text=historyOf(course);if(!text)return '';return text.split(/,\s*(?=(?:Fall|Spring|Summer)\s+\d{4})|[;\n]+/i).map(x=>x.trim()).filter(Boolean)[0]||'';}

function renderTopLanguage(csv){
  const values=Object.fromEntries(parseCSVRows(csv).map(([key,value])=>[norm(key),value?.trim()||'']));
  if(!values.title||!values.description)throw Error('The Top Language tab is missing its title or description.');
  $('.eyebrow').textContent=values.eyebrow||'';
  $('.intro h1').textContent=values.title;
  $('.dek').textContent=values.subtitle||'';
  document.title=`Curriculum Proposal: ${values.title} | Georgia Tech`;
  const note=$('.orienting-note');note.replaceChildren();
  const terms=new Map();
  const addTerm=(label,style)=>{
    label=label.trim();
    if(!label)return;
    terms.set(label.toLowerCase(),style);
    if(/(Courses|Topics|Electives)$/i.test(label))terms.set(label.slice(0,-1).toLowerCase(),style);
  };
  for(const heading of document.querySelectorAll('#curriculum .section-heading')){
    addTerm(heading.querySelector('h2').textContent,heading.classList.contains('core-heading')?'inline-core':'inline-electives');
  }
  for(const course of state.courses){
    const category=categoryClass(categoryOf(course));
    if(['core','topics','electives'].includes(category))addTerm(categoryOf(course),`inline-${category}`);
  }
  const labels=[...terms.keys()].sort((a,b)=>b.length-a.length);
  if(!labels.length){note.textContent=values.description;return;}
  const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp(`\\b(?:${labels.map(escapeRegex).join('|')})\\b`,'gi');
  let cursor=0,match;
  while((match=pattern.exec(values.description))){
    note.append(document.createTextNode(values.description.slice(cursor,match.index)));
    const strong=document.createElement('strong');
    strong.className=terms.get(match[0].toLowerCase());strong.textContent=match[0];note.append(strong);
    cursor=pattern.lastIndex;
  }
  note.append(document.createTextNode(values.description.slice(cursor)));
}

// One shared component ensures matching dimensions and placement across categories.
function renderCourse(course){
  const category=categoryClass(categoryOf(course));
  const code=codeOf(course),history=firstOffering(course),status=field(course,'Status').trim();
  const card=document.createElement('article');
  card.className=`course-card ${category}`;card.tabIndex=0;card.setAttribute('role','button');
  card.setAttribute('aria-label',`${titleOf(course)}. Open course details.`);
  const metadata=category==='core'?(history?`Last taught: ${esc(history)}`:''):((category==='topics'||category==='electives')&&status?`Status: ${esc(status)}`:'');
  const metadataRow=metadata?`<div class="card-meta"><span class="history">${metadata}</span></div>`:'';
  card.innerHTML=`<div class="card-code-slot">${code?`<span class="code-pill">${esc(code)}</span>`:''}</div><h3>${esc(titleOf(course))}</h3>${metadataRow}<span class="card-affordance" aria-hidden="true"></span>`;
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
function renderCourses(){
  const root=$('#curriculum');root.replaceChildren();
  const core=[];
  const electiveGroups=new Map();
  for(const course of state.courses){
    const category=categoryClass(categoryOf(course));
    if(category==='core')core.push(course);
    else if(category==='topics'||category==='electives'){
      const frequency=frequencyOf(course);
      if(!electiveGroups.has(frequency))electiveGroups.set(frequency,[]);
      electiveGroups.get(frequency).push(course);
    }
  }
  if(core.length){
    const section=document.createElement('section');section.className='core-section';
    section.innerHTML=`<div class="section-heading core-heading"><h2>${core.length===1?'Core Course':'Core Courses'}</h2></div><div class="course-grid"></div>`;
    core.forEach(course=>section.querySelector('.course-grid').append(renderCourse(course)));
    root.append(section);
  }
  let lastElectiveSection=null;
  for(const [frequency,courses] of electiveGroups){
    const section=document.createElement('section');section.className='electives-section';
    const title=frequency?`${frequency} Electives`:'Electives with Unspecified Frequency';
    section.innerHTML=`<div class="section-heading electives-heading"><h2>${esc(title)}</h2></div><div class="course-grid"></div>`;
    courses.forEach(course=>section.querySelector('.course-grid').append(renderCourse(course)));
    root.append(section);lastElectiveSection=section;
  }
  if(lastElectiveSection){
    const legend=document.createElement('div');legend.className='legend';
    legend.innerHTML='<span><i class="legend-swatch topics-swatch"></i>Space-focused Special Topics</span><span><i class="legend-swatch electives-swatch"></i>Other Electives</span>';
    lastElectiveSection.append(legend);
  }
  if(!root.children.length)root.innerHTML='<div class="empty-state">No course records were returned by the Courses tab.</div>';
}
async function load(){
  const error=$('#error');error.hidden=true;
  try{
    const [topResponse,coursesResponse]=await Promise.all([fetch(TOP_LANGUAGE_CSV_URL,{cache:'no-store'}),fetch(COURSES_CSV_URL,{cache:'no-store'})]);
    if(!topResponse.ok||!coursesResponse.ok)throw Error(`Google Sheets request failed (${!topResponse.ok?topResponse.status:coursesResponse.status}).`);
    const topCsv=await topResponse.text();
    state.courses=parseCSV(await coursesResponse.text());
    if(!state.courses.length)throw Error('The Courses tab returned no course rows.');
    renderCourses();
    renderTopLanguage(topCsv);
  }catch(err){error.hidden=false;error.textContent=err.message;$('#curriculum').innerHTML='<div class="empty-state">Proposal data is unavailable. Reload the page to try again.</div>';}
}
$('#course-dialog .close').addEventListener('click',closeDetail);
$('#course-dialog').addEventListener('click',event=>{if(event.target.id==='course-dialog')closeDetail();});
$('#course-dialog').addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
$('#course-dialog').addEventListener('close',()=>{if(state.sourceCard?.isConnected)state.sourceCard.focus();});
$('#print-page').addEventListener('click',()=>window.print());
load();
