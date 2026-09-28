(() => {
const $ = id => document.getElementById(id);
const KEY = "storage-fit-planner-v15";
const PREV_KEYS = ["storage-fit-planner-v14","storage-fit-planner-v13","storage-fit-planner-v12","storage-fit-planner-v11","storage-fit-planner-v10","storage-fit-planner-v9","storage-fit-planner-v8","storage-fit-planner-v7","storage-fit-planner-v6","storage-fit-planner-v4","storage-fit-planner-v3","storage-fit-planner-v2"];
const COLORS = ["var(--c1)","var(--c2)","var(--c3)","var(--c4)","var(--c5)","var(--c6)"];
const SEARCH_LIMIT = 90000;
const LAYOUT_LIMIT = 180;

let state = loadState();
let editingStorage = state.selectedStorage || state.storages[0]?.id || "";
let editingBox = state.boxes[0]?.id || "";
let layouts = [];
let selectedLayout = 0;
let detailView = "front";
let editMode = false;
let selectedEditItem = -1;
let editOriginalLayout = null;
let topDrag = null;
let currentGaps = [];
let selectedGap = -1;
let galleryWasCapped = false;
let detailModalOpen = false;

state.itemLimits = state.itemLimits || {};
state.fitTolerance = Math.max(0, Number(state.fitTolerance)||0);
state.enableStacking = !!state.enableStacking;
state.optimizeGoal = ["fill","compartments","simple","balanced"].includes(state.optimizeGoal)?state.optimizeGoal:"fill";
state.savedPlans = Array.isArray(state.savedPlans)?state.savedPlans:[];
for(const b of state.boxes){
  if(!(b.id in state.itemLimits)) state.itemLimits[b.id] = null;
  b.price = Math.max(0,Number(b.price)||0);
  b.currency = String(b.currency||"MAD").trim().toUpperCase().slice(0,6) || "MAD";
  b.url = String(b.url||"").trim();
  b.image = String(b.image||"").trim();
  b.sku = String(b.sku||"").trim();
  b.uprightOnly = b.uprightOnly !== false;
  b.canBeStacked = !!b.canBeStacked;
  b.canSupportStack = !!b.canSupportStack;
}
for(const s of state.storages){
  if(!Array.isArray(s.obstacles)) s.obstacles=[];
  for(const o of s.obstacles){
    o.id=o.id||uid("o");
    o.name=o.name||"Blocked zone";
    o.x=Math.max(0,Number(o.x)||0);o.y=Math.max(0,Number(o.y)||0);
    o.w=Math.max(0,Number(o.w)||0);o.d=Math.max(0,Number(o.d)||0);
    o.h=Math.max(0,Number(o.h)||s.h||0);
  }
}

function defaults(){
  return {
    unit:"cm",clearance:0.5,fitTolerance:0,uprightOnly:true,enableStacking:false,clearanceEnabled:false,optimizeGoal:"fill",savedPlans:[],
    storages:[
      {id:"s1",name:"Drawer 67 × 26 × 13",w:67,d:26,h:13,obstacles:[]},
      {id:"s2",name:"Shelf 81 × 40 × 27",w:81,d:40,h:27,obstacles:[]}
    ],
    boxes:[
      {id:"b1",name:"Box 30 × 25 × 12",w:30,d:25,h:12,uprightOnly:true,canBeStacked:false,canSupportStack:false},
      {id:"b2",name:"Box 32 × 25 × 12",w:32,d:25,h:12,uprightOnly:true,canBeStacked:false,canSupportStack:false},
      {id:"b3",name:"Small box 20 × 13 × 10",w:20,d:13,h:10,uprightOnly:true,canBeStacked:false,canSupportStack:false}
    ],
    selectedStorage:"s1",selectedTypes:{b1:true,b2:false,b3:false},itemLimits:{b1:null,b2:null,b3:null}
  };
}
function loadState(){
  try{
    const current=JSON.parse(localStorage.getItem(KEY)||"null");
    if(current?.storages?.length && current?.boxes?.length) return current;
    for(const key of PREV_KEYS){
      const old=JSON.parse(localStorage.getItem(key)||"null");
      if(old?.storages?.length && old?.boxes?.length){
        const selectedTypes={};
        for(const b of old.boxes){
          selectedTypes[b.id]=Boolean(old.selectedTypes?.[b.id] || (old.selections?.[b.id]||0)>0 || b.id===old.selectedBox);
        }
        return {
          unit:old.unit||"cm",clearance:old.clearance??0.5,fitTolerance:old.fitTolerance??0,uprightOnly:old.uprightOnly!==false,enableStacking:!!old.enableStacking,optimizeGoal:old.optimizeGoal||"fill",savedPlans:Array.isArray(old.savedPlans)?old.savedPlans:[],
          clearanceEnabled:!!old.clearanceEnabled,storages:old.storages,boxes:old.boxes,
          selectedStorage:old.selectedStorage||old.storages[0]?.id||"",selectedTypes,
          itemLimits:Object.fromEntries(old.boxes.map(b=>[b.id, old.itemLimits?.[b.id] ?? null]))
        };
      }
    }
  }catch(e){}
  return defaults();
}
function save(){
  state.unit=$("unit").value; state.uprightOnly=$("uprightOnly").checked; state.enableStacking=$("enableStacking").checked; state.optimizeGoal=$("optimizeGoal").value;
  state.clearanceEnabled=$("clearanceEnabled").checked; state.clearance=Math.max(0,Number($("clearance").value)||0); state.fitTolerance=Math.max(0,Number($("fitTolerance").value)||0);
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
}
function uid(p){return p+Math.random().toString(36).slice(2,9)}
function fmt(n){return String(Math.round(n*10)/10)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function storage(){return state.storages.find(s=>s.id===state.selectedStorage)}
function boxById(id){return state.boxes.find(b=>b.id===id)}
function colorFor(id){const i=Math.max(0,state.boxes.findIndex(b=>b.id===id));return COLORS[i%COLORS.length]}
function round6(n){return Math.round(n*1e6)/1e6}
function unitScale(from,to){
  const perCm={cm:1,mm:10,in:1/2.54};
  return (perCm[to]||1)/(perCm[from]||1);
}
function convertAllUnits(from,to){
  if(from===to)return;
  const f=unitScale(from,to),cv=n=>Math.round((Number(n)||0)*f*1000)/1000;
  for(const s of state.storages){
    s.w=cv(s.w);s.d=cv(s.d);s.h=cv(s.h);
    for(const o of (s.obstacles||[])){o.x=cv(o.x);o.y=cv(o.y);o.w=cv(o.w);o.d=cv(o.d);o.h=cv(o.h)}
  }
  for(const b of state.boxes){b.w=cv(b.w);b.d=cv(b.d);b.h=cv(b.h)}
  state.clearance=cv(state.clearance);
  state.fitTolerance=cv(state.fitTolerance);
  state.unit=to;
}


function openDetailModal(){
  if(!layouts.length)return;
  detailModalOpen=true;
  $("detailModal").classList.add("open");
  $("detailModal").setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  updateModalNav();updateSavePlanButton();
}
function closeDetailModal(){
  detailModalOpen=false;
  $("detailModal").classList.remove("open");
  $("detailModal").setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}
function updateModalNav(){
  const hasLayouts=layouts.length>0;
  $("prevLayoutBtn").disabled=!hasLayouts || selectedLayout<=0;
  $("nextLayoutBtn").disabled=!hasLayouts || selectedLayout>=layouts.length-1;
}
function rerenderSelectedLayout(openModalToo=false){
  const sz=currentUsableSize();
  if(!sz||!layouts.length)return;
  renderGallery(sz.W,sz.D,sz.H,galleryWasCapped);
  renderDetail(sz.W,sz.D,sz.H);
  updateModalNav();
  if(openModalToo) openDetailModal();
}

function backupPayload(){
  return {
    format:"storage-fit-backup",
    version:1,
    appVersion:15,
    exportedAt:new Date().toISOString(),
    localStorageKey:KEY,
    data:JSON.parse(JSON.stringify(state))
  };
}
function backupFilename(){
  const d=new Date(),pad=n=>String(n).padStart(2,"0");
  return `storage-fit-backup-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`;
}
function downloadTextFile(filename,textValue,type="application/json"){
  const blob=new Blob([textValue],{type});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}
function approxStateBytes(){
  try{return new Blob([JSON.stringify(state)]).size}catch(e){return JSON.stringify(state).length}
}
function humanBytes(n){
  if(n<1024)return `${n} B`;
  if(n<1024*1024)return `${(n/1024).toFixed(n<10240?1:0)} KB`;
  return `${(n/1024/1024).toFixed(2)} MB`;
}
function renderBackupStats(){
  if(!$("backupStorageCount"))return;
  $("backupStorageCount").textContent=String(state.storages?.length||0);
  $("backupItemCount").textContent=String(state.boxes?.length||0);
  $("backupPlanCount").textContent=String(state.savedPlans?.length||0);
  $("backupSize").textContent=humanBytes(approxStateBytes());
}
function setBackupStatus(message,tone=""){
  const el=$("backupStatus");if(!el)return;
  el.className=`datastatus ${tone}`.trim();el.textContent=message;
}
function isFiniteNonNegative(v){return Number.isFinite(Number(v))&&Number(v)>=0}
function validateBackupState(candidate){
  if(!candidate||typeof candidate!=="object")return "Backup data is missing.";
  if(!Array.isArray(candidate.storages))return "Backup has no storage-space list.";
  if(!Array.isArray(candidate.boxes))return "Backup has no item list.";
  if(candidate.savedPlans!=null&&!Array.isArray(candidate.savedPlans))return "Saved plans are malformed.";

  const ids=new Set();
  for(const s of candidate.storages){
    if(!s||typeof s!=="object"||!s.id)return "A storage space is missing its ID.";
    if(ids.has(`s:${s.id}`))return "Duplicate storage-space ID found.";
    ids.add(`s:${s.id}`);
    if(!isFiniteNonNegative(s.w)||!isFiniteNonNegative(s.d)||!isFiniteNonNegative(s.h))return `Storage “${s.name||s.id}” has invalid dimensions.`;
    if(s.obstacles!=null&&!Array.isArray(s.obstacles))return `Storage “${s.name||s.id}” has malformed blocked zones.`;
  }
  for(const b of candidate.boxes){
    if(!b||typeof b!=="object"||!b.id)return "An item is missing its ID.";
    if(ids.has(`b:${b.id}`))return "Duplicate item ID found.";
    ids.add(`b:${b.id}`);
    if(!isFiniteNonNegative(b.w)||!isFiniteNonNegative(b.d)||!isFiniteNonNegative(b.h))return `Item “${b.name||b.id}” has invalid dimensions.`;
  }
  return "";
}
function extractBackupState(parsed){
  if(parsed?.format==="storage-fit-backup"&&parsed.data)return parsed.data;
  // Also accept a raw state object for resilience with manual/older exports.
  if(parsed&&Array.isArray(parsed.storages)&&Array.isArray(parsed.boxes))return parsed;
  return null;
}
function restoreBackupState(candidate){
  const error=validateBackupState(candidate);
  if(error)throw new Error(error);
  localStorage.setItem(KEY,JSON.stringify(candidate));
  // Reload so the normal startup migration/normalization path fills any defaults
  // introduced by newer versions of the app.
  location.reload();
}

function renderAll(){
  $("unit").value=state.unit||"cm";$("optimizeGoal").value=state.optimizeGoal||"fill";$("uprightOnly").checked=state.uprightOnly!==false;$("enableStacking").checked=!!state.enableStacking;
  $("clearanceEnabled").checked=!!state.clearanceEnabled;$("clearance").value=state.clearance??0.5;$("fitTolerance").value=state.fitTolerance??0;
  $("clearanceField").style.display=state.clearanceEnabled?"block":"none";
  renderStorageList();renderBoxList();renderStorageSelect();renderItemPicker();loadStorageEditor();renderObstacleEditor();loadBoxEditor();renderSavedPlans();renderBackupStats();resetResults();
}
function renderStorageList(){
  const el=$("storageList");
  if(!state.storages.length){el.innerHTML='<div class="empty">No storage spaces yet.</div>';return}
  el.innerHTML=state.storages.map(s=>`<div class="listitem ${s.id===editingStorage?"active":""}" data-s="${s.id}">
    <div><div class="listname">${esc(s.name)}</div><div class="dims">${fmt(s.w)} × ${fmt(s.d)} × ${fmt(s.h)} ${esc(state.unit)}${s.obstacles?.length?` · ${s.obstacles.length} blocked`:""}</div></div>
    ${s.id===state.selectedStorage?'<span class="badge">selected</span>':""}</div>`).join("");
  el.querySelectorAll("[data-s]").forEach(n=>n.addEventListener("click",()=>{editingStorage=n.dataset.s;loadStorageEditor();renderObstacleEditor();renderStorageList()}));
}
function renderBoxList(){
  const el=$("boxList");
  if(!state.boxes.length){el.innerHTML='<div class="empty">No items yet.</div>';return}
  el.innerHTML=state.boxes.map(b=>`<div class="listitem ${b.id===editingBox?"active":""}" data-b="${b.id}">
    <div class="itemmain">${safeUrl(b.image)?`<img class="itemthumb" src="${esc(safeUrl(b.image))}" alt="">`:""}<div><div class="listname">${esc(b.name)}</div><div class="dims">${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${esc(state.unit)}${b.price>0?` · ${esc(money(b.price,b.currency))}`:""}${b.sku?` · ${esc(b.sku)}`:""}</div></div></div>
    ${state.selectedTypes?.[b.id]?'<span class="badge">allowed</span>':""}</div>`).join("");
  el.querySelectorAll("[data-b]").forEach(n=>n.addEventListener("click",()=>{editingBox=n.dataset.b;loadBoxEditor();renderBoxList()}));
}
function renderStorageSelect(){
  const el=$("storageSelect");el.innerHTML=state.storages.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
  if(state.selectedStorage) el.value=state.selectedStorage;
}
function renderItemPicker(){
  const el=$("itemPicker");state.selectedTypes=state.selectedTypes||{};state.itemLimits=state.itemLimits||{};
  if(!state.boxes.length){el.innerHTML='<div class="empty">Add an item first.</div>';return}
  el.innerHTML=state.boxes.map(b=>{
    const selected=!!state.selectedTypes[b.id];
    const limit=state.itemLimits[b.id];
    const limited=Number.isFinite(limit) && limit>0;
    return `<div class="pickrow">
      <input aria-label="Allow ${esc(b.name)}" type="checkbox" data-type="${b.id}" ${selected?"checked":""}>
      <span><span class="listname">${esc(b.name)}</span><span class="dims" style="display:block">${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${esc(state.unit)}</span></span>
      <span class="limitcontrol">
        <select data-limit-mode="${b.id}" aria-label="Quantity mode for ${esc(b.name)}">
          <option value="unlimited" ${limited?"":"selected"}>Unlimited</option>
          <option value="max" ${limited?"selected":""}>Max</option>
        </select>
        <input data-limit-value="${b.id}" aria-label="Maximum quantity of ${esc(b.name)}" type="number" min="1" max="99" step="1" value="${limited?limit:1}" ${limited?"":"disabled"}>
      </span>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-type]").forEach(c=>c.addEventListener("change",()=>{
    state.selectedTypes[c.dataset.type]=c.checked;save();renderBoxList();resetResults();
  }));
  el.querySelectorAll("[data-limit-mode]").forEach(sel=>sel.addEventListener("change",()=>{
    const id=sel.dataset.limitMode;
    if(sel.value==="max"){
      const input=el.querySelector(`[data-limit-value="${id}"]`);
      state.itemLimits[id]=Math.max(1,Math.floor(Number(input?.value)||1));
    }else state.itemLimits[id]=null;
    save();renderItemPicker();resetResults();
  }));
  el.querySelectorAll("[data-limit-value]").forEach(inp=>inp.addEventListener("change",()=>{
    const id=inp.dataset.limitValue;
    const mode=el.querySelector(`[data-limit-mode="${id}"]`)?.value;
    if(mode==="max") state.itemLimits[id]=Math.max(1,Math.min(99,Math.floor(Number(inp.value)||1)));
    save();renderItemPicker();resetResults();
  }));
}
function loadStorageEditor(){
  const s=state.storages.find(x=>x.id===editingStorage);$("storageName").value=s?.name||"";$("sw").value=s?.w??"";$("sd").value=s?.d??"";$("sh").value=s?.h??"";
}
function renderObstacleEditor(){
  const el=$("obstacleList"),s=state.storages.find(x=>x.id===editingStorage);
  if(!s){el.innerHTML='<div class="empty">Select a storage space.</div>';return}
  s.obstacles=s.obstacles||[];
  if(!s.obstacles.length){el.innerHTML='<div class="empty">No blocked zones.</div>';return}
  el.innerHTML=s.obstacles.map(o=>`<div class="obstacle" data-obstacle="${o.id}">
    <div class="obstaclegrid">
      <div class="field"><label>Name</label><input data-okey="name" value="${esc(o.name||"Blocked zone")}"></div>
      <div class="field"><label>X</label><input data-okey="x" type="number" min="0" step="0.1" value="${fmt(o.x)}"></div>
      <div class="field"><label>Y</label><input data-okey="y" type="number" min="0" step="0.1" value="${fmt(o.y)}"></div>
      <div class="field"><label>Width</label><input data-okey="w" type="number" min="0" step="0.1" value="${fmt(o.w)}"></div>
      <div class="field"><label>Depth</label><input data-okey="d" type="number" min="0" step="0.1" value="${fmt(o.d)}"></div>
      <div class="field"><label>Height</label><input data-okey="h" type="number" min="0" step="0.1" value="${fmt(o.h)}"></div>
      <button class="obstacle-remove" type="button" data-remove-obstacle="${o.id}" aria-label="Remove blocked zone">×</button>
    </div>
  </div>`).join("");

  el.querySelectorAll("[data-obstacle]").forEach(row=>{
    const id=row.dataset.obstacle,o=s.obstacles.find(x=>x.id===id);
    row.querySelectorAll("[data-okey]").forEach(inp=>inp.addEventListener("change",()=>{
      const k=inp.dataset.okey;
      o[k]=k==="name"?(inp.value.trim()||"Blocked zone"):Math.max(0,Number(inp.value)||0);
      save();renderStorageList();resetResults();
    }));
  });
  el.querySelectorAll("[data-remove-obstacle]").forEach(btn=>btn.addEventListener("click",()=>{
    s.obstacles=s.obstacles.filter(o=>o.id!==btn.dataset.removeObstacle);
    save();renderObstacleEditor();renderStorageList();resetResults();
  }));
}

function loadBoxEditor(){
  const b=state.boxes.find(x=>x.id===editingBox);
  $("boxName").value=b?.name||"";$("bw").value=b?.w??"";$("bd").value=b?.d??"";$("bh").value=b?.h??"";
  $("boxPrice").value=b?.price||"";$("boxCurrency").value=b?.currency||"MAD";$("boxSku").value=b?.sku||"";$("boxUrl").value=b?.url||"";$("boxImage").value=b?.image||"";
  $("boxUprightOnly").checked=b?.uprightOnly!==false;$("boxCanBeStacked").checked=!!b?.canBeStacked;$("boxCanSupportStack").checked=!!b?.canSupportStack;
}
function selectedBoxes(){return state.boxes.filter(b=>state.selectedTypes?.[b.id])}

function ikeaUrlInfo(raw){
  const info={};
  try{
    const u=new URL(raw);
    const isIkea=/(^|\.)ikea\.com$/i.test(u.hostname);
    if(!isIkea)return info;
    info.isIkea=true;
    const parts=u.pathname.split("/").filter(Boolean);
    const last=parts[parts.length-1]||"";
    const m=last.match(/^(.*?)-([a-z]?\d{8})$/i);
    if(m){
      info.slug=m[1];
      const digits=m[2].replace(/\D/g,"");
      if(digits.length===8) info.sku=`${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
      const words=m[1].split("-").filter(Boolean);
      info.name=words.map((w,i)=>i===0?w.toUpperCase():w).join(" ");
    }
  }catch(e){}
  return info;
}
function normalizeProductDimensions(values,unit){
  const nums=values.map(v=>Number(String(v).replace(",",".")));
  if(nums.some(n=>!Number.isFinite(n)||n<=0))return null;
  const from=(unit||"cm").toLowerCase();
  const target=state.unit||"cm";
  let factor=1;
  if(from==="mm")factor=unitScale("mm",target);
  else if(from==="cm")factor=unitScale("cm",target);
  else if(from==="m")factor=unitScale("cm",target)*100;
  else if(from==="in"||from==='"')factor=unitScale("in",target);
  return nums.map(n=>Math.round(n*factor*1000)/1000);
}
function parseDimensionString(str){
  const s=String(str||"").replace(/×/g,"x");
  const m=s.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|")\b/i);
  if(!m)return null;
  return normalizeProductDimensions([m[1],m[2],m[3]],m[4]);
}
function parseLabeledDimensions(str){
  const s=String(str||"")
    .replace(/\u00a0/g," ")
    .replace(/\*\*/g,"")
    .replace(/\s+/g," ");

  function find(label){
    const re=new RegExp(`\\b${label}\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m|in|")\\b`,"i");
    const m=s.match(re);
    return m?{value:m[1],unit:m[2]}:null;
  }

  const w=find("Width"), d=find("Depth"), h=find("Height");
  if(!w||!d||!h)return null;

  const wc=normalizeProductDimensions([w.value,1,1],w.unit)?.[0];
  const dc=normalizeProductDimensions([d.value,1,1],d.unit)?.[0];
  const hc=normalizeProductDimensions([h.value,1,1],h.unit)?.[0];
  if(!(wc>0&&dc>0&&hc>0))return null;
  return [wc,dc,hc];
}
function deepFindProduct(node){
  if(!node)return null;
  if(Array.isArray(node)){
    for(const x of node){const r=deepFindProduct(x);if(r)return r}
    return null;
  }
  if(typeof node!=="object")return null;
  const t=node["@type"];
  if(t==="Product"||(Array.isArray(t)&&t.includes("Product")))return node;
  if(node["@graph"]){const r=deepFindProduct(node["@graph"]);if(r)return r}
  return null;
}
function schemaValue(v){
  if(v==null)return null;
  if(typeof v==="number"||typeof v==="string")return v;
  if(typeof v==="object")return v.value??v.maxValue??v.name??null;
  return null;
}
function parseHtmlProduct(html,url){
  const doc=new DOMParser().parseFromString(html,"text/html");
  const out={url};
  let product=null;
  for(const s of doc.querySelectorAll('script[type="application/ld+json"]')){
    try{product=deepFindProduct(JSON.parse(s.textContent));if(product)break}catch(e){}
  }
  if(product){
    out.name=product.name||"";
    out.sku=String(product.sku||product.productID||"");
    const offers=Array.isArray(product.offers)?product.offers[0]:product.offers;
    if(offers){out.price=Number(offers.price)||0;out.currency=offers.priceCurrency||""}
    const image=Array.isArray(product.image)?product.image[0]:product.image;
    if(typeof image==="string")out.image=image;
    const w=schemaValue(product.width),d=schemaValue(product.depth),h=schemaValue(product.height);
    if(w&&d&&h){
      const unit=(product.width?.unitCode||product.width?.unitText||product.depth?.unitCode||"cm").toString().toLowerCase();
      const mapped=unit.includes("mmt")?"mm":unit.includes("cmt")?"cm":unit.includes("inch")?"in":unit;
      const dims=normalizeProductDimensions([w,d,h],mapped);
      if(dims)[out.w,out.d,out.h]=dims;
    }
  }
  out.name=out.name||doc.querySelector('meta[property="og:title"]')?.content||doc.querySelector("h1")?.textContent?.trim()||doc.title||"";
  out.image=out.image||doc.querySelector('meta[property="og:image"]')?.content||"";
  if(!out.price){
    out.price=Number(doc.querySelector('meta[property="product:price:amount"]')?.content)||0;
    out.currency=out.currency||doc.querySelector('meta[property="product:price:currency"]')?.content||"";
  }
  const body=(doc.body?.innerText||"").replace(/\s+/g," ");
  if(!out.w){
    const dims=parseLabeledDimensions(body.slice(0,18000))
      || parseDimensionString(`${out.name} ${body.slice(0,18000)}`);
    if(dims)[out.w,out.d,out.h]=dims;
  }
  if(!out.sku){
    const m=body.match(/\b(\d{3})[.\s](\d{3})[.\s](\d{2})\b/);
    if(m)out.sku=`${m[1]}.${m[2]}.${m[3]}`;
  }
  return out;
}
function parseReaderProduct(markdown,url){
  const out={url},info=ikeaUrlInfo(url);
  const txt=String(markdown||"");
  const title=(txt.match(/^#\s+(.+)$/m)||[])[1]||(txt.match(/^Title:\s*(.+)$/mi)||[])[1]||"";
  out.name=title.trim()||info.name||"";
  const dims=parseLabeledDimensions(txt.slice(0,20000))
    || parseDimensionString(`${title}\n${txt.slice(0,20000)}`);
  if(dims)[out.w,out.d,out.h]=dims;
  const sku=(txt.match(/\b(\d{3})\.(\d{3})\.(\d{2})\b/)||txt.match(/\b(\d{3})\s(\d{3})\s(\d{2})\b/));
  out.sku=sku?`${sku[1]}.${sku[2]}.${sku[3]}`:(info.sku||"");
  const priceMatches=[...txt.slice(0,6000).matchAll(/(?:^|\s)(\d[\d\s.,]*?)\s*(DH|MAD|EUR|USD|€|\$)(?:\s|$)/gim)];
  if(priceMatches.length){
    const pm=priceMatches.find(m=>Number(m[1].replace(/\s/g,"").replace(",", "."))>0)||priceMatches[0];
    out.price=Number(pm[1].replace(/\s/g,"").replace(",", "."))||0;
    const c=pm[2].toUpperCase();out.currency=(c==="DH"?"MAD":c==="€"?"EUR":c==="$"?"USD":c);
  }
  const img=(txt.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)||[])[1];
  if(img)out.image=img;
  return out;
}
function mergeProductInfo(base,extra){
  const out={...base};
  for(const k of ["name","sku","currency","image"]){if(!out[k]&&extra[k])out[k]=extra[k]}
  for(const k of ["price","w","d","h"]){if(!(Number(out[k])>0)&&Number(extra[k])>0)out[k]=Number(extra[k])}
  out.url=out.url||extra.url||"";
  return out;
}
function inferredProductInfo(url){
  const info=ikeaUrlInfo(url);
  return {url,name:info.name||"",sku:info.sku||"",price:0,currency:"MAD",image:""};
}
async function fetchSmartProduct(url){
  let data=inferredProductInfo(url),source="URL";
  try{
    const r=await fetch(url,{headers:{"Accept":"text/html,application/xhtml+xml"}});
    if(r.ok){
      data=mergeProductInfo(data,parseHtmlProduct(await r.text(),url));
      source="product page";
    }else throw new Error("direct blocked");
  }catch(e){
    try{
      const reader=`https://r.jina.ai/${url}`;
      const r=await fetch(reader,{headers:{"Accept":"text/plain"}});
      if(r.ok){
        data=mergeProductInfo(data,parseReaderProduct(await r.text(),url));
        source="public reader";
      }
    }catch(e2){}
  }
  return {data,source};
}
function productCompleteness(p){
  const keys=["name","w","d","h","price","sku"];
  return keys.filter(k=>k==="price"?Number(p[k])>0:!!p[k]).length;
}
function applyImportedProduct(p){
  const id=uid("b");
  const item={
    id,name:p.name||"Imported item",
    w:Number(p.w)||0,d:Number(p.d)||0,h:Number(p.h)||0,
    price:Math.max(0,Number(p.price)||0),
    currency:(p.currency||"MAD").toUpperCase().slice(0,6),
    sku:p.sku||"",url:p.url||"",image:p.image||"",
    uprightOnly:true,canBeStacked:false,canSupportStack:false
  };
  state.boxes.push(item);state.selectedTypes[id]=true;state.itemLimits[id]=null;editingBox=id;
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  renderBoxList();renderItemPicker();loadBoxEditor();resetResults();
  ["boxName","bw","bd","bh","boxPrice","boxSku","boxUrl","boxImage"].forEach(k=>{const el=$(k);el?.classList.add("autofill");setTimeout(()=>el?.classList.remove("autofill"),750)});
  return item;
}
function safeUrl(value){
  try{
    const u=new URL(String(value||"").trim());
    return (u.protocol==="http:"||u.protocol==="https:")?u.href:"";
  }catch(e){return ""}
}
function money(n,currency){
  const value=Number(n)||0;
  try{
    return new Intl.NumberFormat(undefined,{style:"currency",currency:currency||"MAD",maximumFractionDigits:2}).format(value);
  }catch(e){
    return `${value.toLocaleString(undefined,{maximumFractionDigits:2})} ${currency||"MAD"}`;
  }
}
function shoppingRows(layout){
  const counts=layoutCounts(layout);
  return Object.entries(counts).map(([id,qty])=>{
    const b=boxById(id);
    const price=Math.max(0,Number(b?.price)||0),currency=(b?.currency||"MAD").toUpperCase();
    return {
      id,qty,name:b?.name||layout.find(p=>p.typeId===id)?.name||"Item",
      price,currency,subtotal:price*qty,url:safeUrl(b?.url),image:safeUrl(b?.image),sku:b?.sku||"",
      dimensions:b?`${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${state.unit}`:""
    };
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
function shoppingTotals(layout){
  const totals={},rows=shoppingRows(layout);let missing=0;
  for(const r of rows){
    if(r.price>0) totals[r.currency]=(totals[r.currency]||0)+r.subtotal;
    else missing+=r.qty;
  }
  return {totals,missing,rows};
}
function totalsText(layout){
  const {totals,missing}=shoppingTotals(layout);
  const parts=Object.entries(totals).map(([c,v])=>money(v,c));
  if(!parts.length)return missing?"Prices missing":"No priced items";
  return parts.join(" + ")+(missing?` · ${missing} unpriced`:"");
}
function renderShoppingList(layout){
  const el=$("shoppingList"),summary=shoppingTotals(layout);
  $("shoppingTotal").textContent=totalsText(layout);
  if(!summary.rows.length){el.innerHTML='<div class="empty">No items in this layout.</div>';return}
  el.innerHTML=`<div class="shoprows">${summary.rows.map(r=>`<div class="shoprow">
    <div><div class="shopname">${esc(r.name)}</div><div class="shopsub">${esc(r.dimensions)}${r.sku?` · ${esc(r.sku)}`:""}</div></div>
    <div class="shopnum">×${r.qty}</div>
    <div class="shopnum">${r.price>0?money(r.price,r.currency):"—"}</div>
    <div class="shopnum shopsubtotal">${r.price>0?money(r.subtotal,r.currency):"—"}</div>
    <div class="shopaction">${r.url?`<a class="shoplink" href="${esc(r.url)}" target="_blank" rel="noopener">Product ↗</a>`:""}</div>
  </div>`).join("")}</div>${summary.missing?`<div class="shopmissing">${summary.missing} item${summary.missing===1?"":"s"} still need a price before the total is complete.</div>`:""}`;
}
function slugify(s){
  return String(s||"plan").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"storage-plan";
}
function currentExportPayload(){
  const layout=layouts[selectedLayout],s=storage();if(!layout||!s)return null;
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;
  return {
    format:"storage-fit-plan",
    version:1,
    exportedAt:new Date().toISOString(),
    storage:{
      id:s.id,name:s.name,width:s.w,depth:s.d,height:s.h,unit:state.unit,
      wallClearance:state.clearanceEnabled?state.clearance:0,
      fitTolerance:state.fitTolerance,
      obstacles:(s.obstacles||[]).map(o=>({...o}))
    },
    optimizationGoal:state.optimizeGoal,
    utilization:Number((utilization(layout,s.w-2*c,s.d-2*c)*100).toFixed(2)),
    items:shoppingRows(layout),
    placements:layout.map(p=>({...p}))
  };
}
function downloadJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}
function buildPrintSheet(){
  const layout=layouts[selectedLayout],s=storage();if(!layout||!s)return false;
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0,W=s.w-2*c,D=s.d-2*c,H=s.h-2*c;
  const rows=shoppingRows(layout);
  $("printSheet").innerHTML=`<div class="printsheet">
    <h1>${esc(s.name)} — Layout ${selectedLayout+1}</h1>
    <div class="printmeta">${fmt(s.w)} × ${fmt(s.d)} × ${fmt(s.h)} ${esc(state.unit)} · ${esc(goalLabel())} · ${(utilization(layout,W,D)*100).toFixed(1)}% usable-floor utilization</div>
    <div class="printgrid">
      <div class="printviz"><h2>Front view</h2>${svgFront(layout,W,H,640,340)}</div>
      <div class="printviz"><h2>Top view</h2>${svgTop(layout,W,D,640,340,true,false,-1,null)}</div>
    </div>
    <h2>Shopping list</h2>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${esc(r.name)}${r.sku?` · ${esc(r.sku)}`:""}${r.url?`<br><a href="${esc(r.url)}">${esc(r.url)}</a>`:""}</td><td>${r.qty}</td><td>${r.price>0?money(r.price,r.currency):"—"}</td><td>${r.price>0?money(r.subtotal,r.currency):"—"}</td></tr>`).join("")}</tbody></table>
    <div class="printtotal">Estimated total: ${esc(totalsText(layout))}</div>
  </div>`;
  return true;
}

function goalLabel(goal=state.optimizeGoal){
  return ({fill:"Best use of space",compartments:"Most compartments",simple:"Simplest setup",balanced:"Balanced mix"})[goal]||"Best use of space";
}
function balanceScore(layout){
  const counts=Object.values(layoutCounts(layout));
  if(counts.length<=1)return 0;
  const total=counts.reduce((a,b)=>a+b,0);
  let entropy=0;
  for(const c of counts){const p=c/total;entropy-=p*Math.log(p)}
  return entropy/Math.log(counts.length);
}
function compareLayoutsForGoal(a,b,W,D){
  const ua=utilization(a,W,D),ub=utilization(b,W,D);
  if(state.optimizeGoal==="compartments") return b.length-a.length || ub-ua || distinctTypes(b)-distinctTypes(a);
  if(state.optimizeGoal==="simple") return distinctTypes(a)-distinctTypes(b) || a.length-b.length || ub-ua;
  if(state.optimizeGoal==="balanced") return balanceScore(b)-balanceScore(a) || distinctTypes(b)-distinctTypes(a) || ub-ua || b.length-a.length;
  return ub-ua || b.length-a.length || distinctTypes(b)-distinctTypes(a);
}
function planSignature(storageId,layout){
  return `${storageId}|${canonicalLayout(layout)}`;
}
function currentPlanSaved(){
  const layout=layouts[selectedLayout],s=storage();
  if(!layout||!s)return false;
  const sig=planSignature(s.id,layout);
  return state.savedPlans.some(p=>p.signature===sig);
}
function renderSavedPlans(){
  const sec=$("savedPlansSection"),el=$("savedPlans");
  if(!state.savedPlans.length){sec.style.display="none";el.innerHTML="";return}
  sec.style.display="block";
  $("savedPlansCount").textContent=`${state.savedPlans.length} saved`;
  el.innerHTML=state.savedPlans.map((p,i)=>{
    const s=state.storages.find(x=>x.id===p.storageId);
    const counts={};for(const item of p.layout)counts[item.typeId]=(counts[item.typeId]||0)+1;
    const summary=Object.entries(counts).map(([id,n])=>`${esc(boxById(id)?.name||"Item")} ×${n}`).join(" · ");
    return `<div class="savedcard">
      <div class="savedhead">
        <div><div class="savedname">${esc(p.name)}</div><div class="savedmeta">${esc(s?.name||p.storageName||"Storage")} · ${p.layout.length} item${p.layout.length===1?"":"s"}</div><span class="goallabel">${esc(goalLabel(p.goal))}</span></div>
      </div>
      <div class="small" style="margin-top:8px">${summary||"Saved layout"}</div>
      <div class="savedmeta" style="margin-top:6px">Estimated: ${esc(totalsText(p.layout))}</div>
      <div class="savedactions">
        <button class="btn soft" type="button" data-open-plan="${p.id}">Open</button>
        <button class="btn danger" type="button" data-delete-plan="${p.id}">Delete</button>
      </div>
    </div>`;
  }).join("");
  el.querySelectorAll("[data-delete-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    state.savedPlans=state.savedPlans.filter(p=>p.id!==btn.dataset.deletePlan);
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderSavedPlans();updateSavePlanButton();
  }));
  el.querySelectorAll("[data-open-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    const plan=state.savedPlans.find(p=>p.id===btn.dataset.openPlan);if(!plan)return;
    if(state.storages.some(s=>s.id===plan.storageId))state.selectedStorage=plan.storageId;
    state.optimizeGoal=plan.goal||state.optimizeGoal;
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
    renderAll();
    layouts=[plan.layout.map(q=>({...q}))];
    selectedLayout=0;selectedGap=-1;currentGaps=[];galleryWasCapped=false;
    const sz=currentUsableSize();if(!sz)return;
    renderGallery(sz.W,sz.D,sz.H,false);renderDetail(sz.W,sz.D,sz.H);openDetailModal();
  }));
}
function updateSavePlanButton(){
  const saved=currentPlanSaved();
  $("savePlanBtn").textContent=saved?"Saved ✓":"Save plan";
  $("savePlanBtn").classList.toggle("active",saved);
}

function resetResults(){
  layouts=[];selectedLayout=0;currentGaps=[];selectedGap=-1;galleryWasCapped=false;closeDetailModal();
  $("resultLabel").textContent="—";$("layoutCount").textContent="—";$("bestFill").textContent="—";$("searchState").textContent="Ready";
  $("message").className="message";$("message").textContent="Select the item types you want to use, then find arrangements.";
  $("gallerySection").style.display="none";$("detailSection").style.display="";
  const n=selectedBoxes().length;$("searchNote").textContent=n?`${n} item type${n===1?"":"s"} selected.`:"Select at least one item type.";
}

function orientations(item,uprightOnly){
  const raw=uprightOnly?[[item.w,item.d,item.h],[item.d,item.w,item.h]]:
    [[item.w,item.d,item.h],[item.w,item.h,item.d],[item.d,item.w,item.h],[item.d,item.h,item.w],[item.h,item.w,item.d],[item.h,item.d,item.w]];
  const seen=new Set();return raw.filter(o=>{const k=o.join("|");if(seen.has(k))return false;seen.add(k);return true});
}
function overlap(a,b,gap=0){return !(a.x+a.w+gap<=b.x || b.x+b.w+gap<=a.x || a.y+a.d+gap<=b.y || b.y+b.d+gap<=a.y)}
function rawObstacles(){
  return storage()?.obstacles||[];
}
function usableObstacles(){
  const S=storage();if(!S)return [];
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;
  const W=S.w-2*c,D=S.d-2*c,H=S.h-2*c;
  return (S.obstacles||[]).map(o=>({
    id:o.id,name:o.name||"Blocked zone",
    x:Math.max(0,(Number(o.x)||0)-c),
    y:Math.max(0,(Number(o.y)||0)-c),
    w:Math.max(0,Math.min(Number(o.w)||0,W-Math.max(0,(Number(o.x)||0)-c))),
    d:Math.max(0,Math.min(Number(o.d)||0,D-Math.max(0,(Number(o.y)||0)-c))),
    h:Math.max(0,Math.min(Number(o.h)||H,H))
  })).filter(o=>o.w>0&&o.d>0&&o.x<W&&o.y<D);
}
function freeFloorArea(W,D,obstacles){
  const obs=obstacles.filter(o=>o.w>0&&o.d>0);
  if(!obs.length)return W*D;
  const xs=[0,W],ys=[0,D];
  for(const o of obs){xs.push(Math.max(0,o.x),Math.min(W,o.x+o.w));ys.push(Math.max(0,o.y),Math.min(D,o.y+o.d))}
  const ux=[...new Set(xs)].sort((a,b)=>a-b),uy=[...new Set(ys)].sort((a,b)=>a-b);
  let blocked=0;
  for(let i=0;i<ux.length-1;i++)for(let j=0;j<uy.length-1;j++){
    const x1=ux[i],x2=ux[i+1],y1=uy[j],y2=uy[j+1];
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    if(obs.some(o=>mx>=o.x&&mx<o.x+o.w&&my>=o.y&&my<o.y+o.d))blocked+=(x2-x1)*(y2-y1);
  }
  return Math.max(0,W*D-blocked);
}
function candidatePointsFor(placed,obstacles,itemW,itemD,gap){
  const xs=new Set([gap]),ys=new Set([gap]);
  for(const p of placed){xs.add(round6(p.x+p.w+gap));ys.add(round6(p.y+p.d+gap))}
  for(const o of obstacles){
    xs.add(round6(o.x+o.w+gap));ys.add(round6(o.y+o.d+gap));
    xs.add(round6(o.x-itemW-gap));ys.add(round6(o.y-itemD-gap));
  }
  const out=[];
  for(const y of [...ys].filter(v=>v>=gap-1e-9).sort((a,b)=>a-b))
    for(const x of [...xs].filter(v=>v>=gap-1e-9).sort((a,b)=>a-b))out.push([x,y]);
  return out;
}
function candidatePoints(placed){
  const gap=Math.max(0,state.fitTolerance||0),obs=usableObstacles();
  const xs=new Set([gap]),ys=new Set([gap]);
  for(const p of placed){xs.add(round6(p.x+p.w+gap));ys.add(round6(p.y+p.d+gap))}
  for(const o of obs){xs.add(round6(o.x+o.w+gap));ys.add(round6(o.y+o.d+gap))}
  const out=[];for(const y of [...ys].sort((a,b)=>a-b))for(const x of [...xs].sort((a,b)=>a-b))out.push([x,y]);return out;
}
function canonicalLayout(placed){
  return placed.slice().sort((a,b)=>a.typeId.localeCompare(b.typeId)||a.x-b.x||a.y-b.y||a.w-b.w||a.d-b.d)
    .map(p=>`${p.typeId}:${round6(p.x)},${round6(p.y)},${round6(p.w)},${round6(p.d)},${round6(p.h)}`).join(";");
}
function occupiedArea(layout){return layout.reduce((s,p)=>s+p.w*p.d,0)}
function utilization(layout,W,D){return occupiedArea(layout)/Math.max(1e-9,freeFloorArea(W,D,usableObstacles()))}
function forbiddenRects(layout,W,D){
  const gap=Math.max(0,state.fitTolerance||0);
  const rects=[];
  for(const p of layout){
    rects.push({
      x:Math.max(0,p.x-gap),y:Math.max(0,p.y-gap),
      w:Math.min(W,p.x+p.w+gap)-Math.max(0,p.x-gap),
      d:Math.min(D,p.y+p.d+gap)-Math.max(0,p.y-gap)
    });
  }
  for(const o of usableObstacles()){
    rects.push({
      x:Math.max(0,o.x-gap),y:Math.max(0,o.y-gap),
      w:Math.min(W,o.x+o.w+gap)-Math.max(0,o.x-gap),
      d:Math.min(D,o.y+o.d+gap)-Math.max(0,o.y-gap)
    });
  }
  // Wall tolerance is represented as four forbidden strips.
  if(gap>0){
    rects.push({x:0,y:0,w:W,d:Math.min(gap,D)});
    rects.push({x:0,y:Math.max(0,D-gap),w:W,d:Math.min(gap,D)});
    rects.push({x:0,y:0,w:Math.min(gap,W),d:D});
    rects.push({x:Math.max(0,W-gap),y:0,w:Math.min(gap,W),d:D});
  }
  return rects.filter(r=>r.w>1e-9&&r.d>1e-9);
}
function rectIntersects(a,b){
  return !(a.x+a.w<=b.x+1e-9||b.x+b.w<=a.x+1e-9||a.y+a.d<=b.y+1e-9||b.y+b.d<=a.y+1e-9);
}
function rectContains(a,b){
  return a.x<=b.x+1e-9&&a.y<=b.y+1e-9&&a.x+a.w>=b.x+b.w-1e-9&&a.y+a.d>=b.y+b.d-1e-9;
}
function findEmptyRectangles(layout,W,D){
  const forbidden=forbiddenRects(layout,W,D);
  const xs=new Set([0,W]),ys=new Set([0,D]);
  for(const r of forbidden){
    xs.add(Math.max(0,Math.min(W,r.x)));xs.add(Math.max(0,Math.min(W,r.x+r.w)));
    ys.add(Math.max(0,Math.min(D,r.y)));ys.add(Math.max(0,Math.min(D,r.y+r.d)));
  }
  const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b);
  const candidates=[];

  // Enumerate rectangles whose edges align to meaningful item/obstacle boundaries.
  // Prefix-style occupancy is unnecessary here because layouts are intentionally small.
  for(let xi=0;xi<X.length-1;xi++){
    for(let xj=xi+1;xj<X.length;xj++){
      const w=X[xj]-X[xi]; if(w<=1e-6)continue;
      for(let yi=0;yi<Y.length-1;yi++){
        for(let yj=yi+1;yj<Y.length;yj++){
          const d=Y[yj]-Y[yi]; if(d<=1e-6)continue;
          const r={x:X[xi],y:Y[yi],w,d,area:w*d};
          if(forbidden.some(f=>rectIntersects(r,f)))continue;
          candidates.push(r);
        }
      }
    }
  }

  // Keep only maximal rectangles, then order by area.
  candidates.sort((a,b)=>b.area-a.area||Math.max(b.w,b.d)-Math.max(a.w,a.d));
  const maximal=[];
  for(const r of candidates){
    if(maximal.some(m=>rectContains(m,r)))continue;
    maximal.push(r);
    if(maximal.length>=12)break;
  }
  return maximal;
}
function gapSuggestions(gap,H,layout){
  const results=[];
  for(const b of state.boxes){
    const max=allowedMaxFor(b.id),already=countType(layout,b.id);
    if(max!==null&&already>=max)continue;
    const oris=orientations(b,state.uprightOnly).filter(o=>o[2]+Math.max(0,state.fitTolerance||0)<=H+1e-9);
    let best=null;
    for(const o of oris){
      if(o[0]<=gap.w+1e-9&&o[1]<=gap.d+1e-9){
        const sep=Math.max(0,state.fitTolerance||0);
        const nx=Math.max(1,Math.floor((gap.w+sep)/(o[0]+sep))),ny=Math.max(1,Math.floor((gap.d+sep)/(o[1]+sep)));
        let count=nx*ny;
        if(max!==null)count=Math.min(count,max-already);
        if(count>0&&(!best||count>best.count))best={o,count};
      }
    }
    if(best)results.push({id:b.id,name:b.name,count:best.count,o:best.o,area:b.w*b.d});
  }
  return results.sort((a,b)=>b.area-a.area||b.count-a.count).slice(0,4);
}

function countSignature(layout){
  const c={};for(const p of layout)c[p.typeId]=(c[p.typeId]||0)+1;
  return Object.keys(c).sort().map(k=>`${k}:${c[k]}`).join("|");
}
function canPlaceAny(placed,types,W,D){
  const points=candidatePoints(placed);
  for(const t of types) for(const o of t.oris) for(const [x,y] of points){
    if(x+o[0]>W+1e-9||y+o[1]>D+1e-9)continue;
    const p={x,y,w:o[0],d:o[1]};if(!placed.some(q=>overlap(p,q)))return true;
  }
  return false;
}

function findLayouts(){
  save();
  const S=storage(), selected=selectedBoxes();
  if(!S){showMessage("Add or select a storage space first.","bad");return}
  if(!selected.length){showMessage("Select at least one item type.","bad");return}

  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;
  const W=S.w-2*c,D=S.d-2*c,H=S.h-2*c;
  const gap=Math.max(0,state.fitTolerance||0),obstacles=usableObstacles();
  if(W<=0||D<=0||H<=0){showMessage("The clearance is larger than the usable storage dimensions.","bad");return}

  const types=selected.map(b=>({
    ...b,
    max:(Number.isFinite(state.itemLimits?.[b.id]) && state.itemLimits[b.id]>0) ? state.itemLimits[b.id] : null,
    oris:orientations(b,state.uprightOnly).filter(o=>o[0]+2*gap<=W&&o[1]+2*gap<=D&&o[2]+gap<=H)
  })).filter(t=>t.oris.length);

  const rejected=selected.filter(b=>!types.some(t=>t.id===b.id));
  if(!types.length){
    showMessage("None of the selected item types fits in this storage in an allowed orientation.","bad");
    $("resultLabel").textContent="Doesn't fit";$("layoutCount").textContent="0";$("bestFill").textContent="0%";$("searchState").textContent="Complete";return;
  }

  $("searchState").textContent="Searching…";
  showMessage(`Finding proposals optimized for “${goalLabel()}”…`,"");
  const found=new Map(),visited=new Set();
  let nodes=0,truncated=false;

  function recurse(placed,counts){
    nodes++;
    if(nodes>SEARCH_LIMIT){truncated=true;return}
    const sig=canonicalLayout(placed)+"|"+Object.keys(counts).sort().map(k=>`${k}:${counts[k]}`).join(",");
    if(visited.has(sig))return;visited.add(sig);

    let extended=false;
    for(const t of types){
      const used=counts[t.id]||0;
      if(t.max!==null && used>=t.max) continue;
      for(const o of t.oris){
        const points=candidatePointsFor(placed,obstacles,o[0],o[1],gap);
        for(const [x,y] of points){
          if(x<gap-1e-9||y<gap-1e-9||x+o[0]+gap>W+1e-9||y+o[1]+gap>D+1e-9||o[2]+gap>H+1e-9)continue;
          const p={typeId:t.id,name:t.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]};
          if(placed.some(q=>overlap(p,q,gap))||obstacles.some(ob=>overlap(p,ob,gap)))continue;
          extended=true;
          recurse([...placed,p],{...counts,[t.id]:used+1});
          if(found.size>=LAYOUT_LIMIT*4){truncated=true;return}
        }
      }
    }
    if(!extended && placed.length){
      const key=canonicalLayout(placed);
      if(!found.has(key))found.set(key,placed.map(p=>({...p})));
    }
  }
  recurse([],{});

  // Group by suggested quantities, but preserve a few distinct geometries for
  // each mix. This removes the flood of near-duplicates without hiding useful
  // alternatives such as front-loaded vs side-loaded arrangements.
  const grouped=new Map();
  for(const layout of found.values()){
    const sig=countSignature(layout);
    if(!grouped.has(sig)) grouped.set(sig,[]);
    const variants=grouped.get(sig);
    if(variants.length<4) variants.push(layout);
  }

  layouts=[...grouped.values()].flat();
  layouts.sort((a,b)=>compareLayoutsForGoal(a,b,W,D) || countSignature(a).localeCompare(countSignature(b)));

  if(layouts.length>LAYOUT_LIMIT){
    layouts=layouts.slice(0,LAYOUT_LIMIT);
    truncated=true;
  }

  $("resultLabel").textContent=layouts.length?"Fits":"No layout";
  $("layoutCount").textContent=String(layouts.length);
  $("bestFill").textContent=layouts.length?`${(utilization(layouts[0],W,D)*100).toFixed(1)}%`:"0%";
  $("searchState").textContent=truncated?"Capped":"Complete";

  if(rejected.length){
    showMessage(`${layouts.length} distinct proposal${layouts.length===1?"":"s"} found. ${rejected.map(x=>x.name).join(", ")} cannot fit at all and was excluded.${truncated?" Results are capped.":""}`,"warn");
  }else{
    showMessage(`${layouts.length} distinct proposal${layouts.length===1?"":"s"} found. Unlimited items are used only while they improve a maximal layout; Max limits are respected. ${obstacles.length?`${obstacles.length} blocked zone${obstacles.length===1?"":"s"} avoided. `:""}${gap>0?`Minimum gap: ${fmt(gap)} ${state.unit}. `:"Exact-fit mode. "}${truncated?"Results are capped to keep the browser responsive.":""}`,"good");
  }
  selectedLayout=0;selectedGap=-1;currentGaps=[];
  editMode=false;
  renderGallery(W,D,H,truncated);
}

function distinctTypes(layout){
  return new Set(layout.map(p=>p.typeId)).size;
}
function proposalTags(layout,W,D){
  if(!layouts.length)return [];
  const fill=utilization(layout,W,D);
  const bestFill=Math.max(...layouts.map(l=>utilization(l,W,D)));
  const mostItems=Math.max(...layouts.map(l=>l.length));
  const minTypes=Math.min(...layouts.map(l=>distinctTypes(l)));
  const maxTypes=Math.max(...layouts.map(l=>distinctTypes(l)));
  const tags=[];
  if(Math.abs(fill-bestFill)<1e-9) tags.push("Best fill");
  if(layout.length===mostItems) tags.push("Most compartments");
  if(distinctTypes(layout)===minTypes) tags.push("Simplest setup");
  if(maxTypes>1 && distinctTypes(layout)===maxTypes) tags.push("Most mixed");
  return tags.slice(0,2);
}

function showMessage(text,type){$("message").className=`message ${type||""}`;$("message").textContent=text}
function layoutCounts(layout){
  const c={};for(const p of layout)c[p.typeId]=(c[p.typeId]||0)+1;return c;
}
function legendHtml(layout){
  const counts=layoutCounts(layout);
  return Object.entries(counts).map(([id,n])=>`<span class="legenditem"><span class="swatch" style="background:${colorFor(id)}"></span>${esc(boxById(id)?.name||id)} ×${n}</span>`).join("");
}
function renderGallery(W,D,H,truncated){
  galleryWasCapped=!!truncated;
  $("gallerySection").style.display="block";$("detailSection").style.display="";
  $("gallerySubtitle").textContent=`${layouts.length} curated proposals${truncated?" (search capped)":""}, ordered for “${goalLabel()}”.`;
  const el=$("gallery");
  el.innerHTML=layouts.map((layout,i)=>`<button type="button" class="layoutcard ${i===selectedLayout?"selected":""}" data-layout="${i}">
    <div class="layoutmeta"><div><strong>Layout ${i+1}</strong>${i===0?`<span class="proposalbadge">${esc(goalLabel())}</span>`:""}${proposalTags(layout,W,D).map(t=>`<span class="proposalbadge">${t}</span>`).join(" ")}</div><span>${(utilization(layout,W,D)*100).toFixed(1)}% usable floor</span></div>
    ${svgTop(layout,W,D,360,210,false)}
    <div class="legend">${legendHtml(layout)}</div>
  </button>`).join("");
  el.querySelectorAll("[data-layout]").forEach(btn=>btn.addEventListener("click",()=>{
    selectedLayout=Number(btn.dataset.layout)||0;
    selectedGap=-1;currentGaps=[];
    editMode=false;selectedEditItem=-1;editOriginalLayout=null;topDrag=null;
    renderGallery(W,D,H,truncated);
    renderDetail(W,D,H);
    openDetailModal();
  }));
  if(layouts.length){renderDetail(W,D,H);updateModalNav();}
}

function invalidEditIndices(layout,W,D){
  const bad=new Set(),gap=Math.max(0,state.fitTolerance||0),obstacles=usableObstacles();
  for(let i=0;i<layout.length;i++){
    const p=layout[i];
    if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9) bad.add(i);
    if(obstacles.some(o=>overlap(p,o,gap)))bad.add(i);
    for(let j=i+1;j<layout.length;j++){
      if(overlap(p,layout[j],gap)){bad.add(i);bad.add(j)}
    }
  }
  return bad;
}
function topGeometry(W,D,width,height){
  const pad=18,scale=Math.min((width-2*pad)/W,(height-2*pad)/D);
  return {pad,scale,ox:(width-W*scale)/2,oy:(height-D*scale)/2};
}
function svgTop(layout,W,D,width,height,labels=true,editable=false,selected=-1,highlightGap=null){
  const g=topGeometry(W,D,width,height),bad=editable?invalidEditIndices(layout,W,D):new Set(),obstacles=usableObstacles();
  const obstacleRects=obstacles.map(o=>`<g>
    <defs><pattern id="hatch-${o.id}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#b23c3c" stroke-opacity=".45" stroke-width="3"/></pattern></defs>
    <rect x="${g.ox+o.x*g.scale}" y="${g.oy+o.y*g.scale}" width="${o.w*g.scale}" height="${o.d*g.scale}" fill="url(#hatch-${o.id})" stroke="#b23c3c" stroke-width="1.7"/>
    ${labels?`<text x="${g.ox+(o.x+o.w/2)*g.scale}" y="${g.oy+(o.y+o.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#8b2e2e">blocked</text>`:""}
  </g>`).join("");
  const rects=layout.map((p,idx)=>{
    const invalid=bad.has(idx),active=idx===selected;
    const stroke=invalid?"#b23c3c":active?"#111":colorFor(p.typeId);
    const fill=invalid?"#b23c3c":colorFor(p.typeId);
    const sw=active?3:invalid?2.5:1.7;
    return `<g data-item="${editable?idx:""}" style="${editable?"cursor:move":""}">
      <rect data-item="${editable?idx:""}" x="${g.ox+p.x*g.scale}" y="${g.oy+p.y*g.scale}" width="${p.w*g.scale}" height="${p.d*g.scale}" rx="3" fill="${fill}" fill-opacity="${invalid?".28":".34"}" stroke="${stroke}" stroke-width="${sw}"/>
      ${labels?`<text data-item="${editable?idx:""}" x="${g.ox+(p.x+p.w/2)*g.scale}" y="${g.oy+(p.y+p.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#222" pointer-events="${editable?"auto":"none"}">${esc(shortName(boxById(p.typeId)?.name||String(idx+1)))}</text>`:""}
    </g>`;
  }).join("");
  const gapMark=highlightGap?`<rect x="${g.ox+highlightGap.x*g.scale}" y="${g.oy+highlightGap.y*g.scale}" width="${highlightGap.w*g.scale}" height="${highlightGap.d*g.scale}" fill="#166c45" fill-opacity=".08" stroke="#166c45" stroke-width="3" stroke-dasharray="8 5"/><text x="${g.ox+(highlightGap.x+highlightGap.w/2)*g.scale}" y="${g.oy+(highlightGap.y+highlightGap.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="#166c45">${fmt(highlightGap.w)} × ${fmt(highlightGap.d)} ${esc(state.unit)}</text>`:"";
  return `<svg class="preview" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top view"><rect x="${g.ox}" y="${g.oy}" width="${W*g.scale}" height="${D*g.scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${obstacleRects}${gapMark}${rects}</svg>`;
}
function shortName(s){return s.length>12?s.slice(0,10)+"…":s}
function svgFront(layout,W,H,width=760,height=390){
  const pad=28,scale=Math.min((width-2*pad)/W,(height-2*pad)/H),ox=(width-W*scale)/2,oy=(height-H*scale)/2;
  const obstacles=usableObstacles();
  const obs=obstacles.map(o=>`<rect x="${ox+o.x*scale}" y="${oy+(H-o.h)*scale}" width="${o.w*scale}" height="${o.h*scale}" fill="#b23c3c" fill-opacity=".12" stroke="#b23c3c" stroke-dasharray="5 4" stroke-width="1.5"/>`).join("");
  const sorted=layout.slice().sort((a,b)=>b.y-a.y||a.x-b.x);
  const rects=sorted.map(p=>`<rect x="${ox+p.x*scale}" y="${oy+(H-p.h)*scale}" width="${p.w*scale}" height="${p.h*scale}" rx="2" fill="${colorFor(p.typeId)}" fill-opacity=".28" stroke="${colorFor(p.typeId)}" stroke-width="1.5"/>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Front view"><rect x="${ox}" y="${oy}" width="${W*scale}" height="${H*scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${obs}${rects}</svg>`;
}
function svgSide(layout,D,H,width=760,height=390){
  const pad=28,scale=Math.min((width-2*pad)/D,(height-2*pad)/H),ox=(width-D*scale)/2,oy=(height-H*scale)/2;
  const obstacles=usableObstacles();
  const obs=obstacles.map(o=>`<rect x="${ox+o.y*scale}" y="${oy+(H-o.h)*scale}" width="${o.d*scale}" height="${o.h*scale}" fill="#b23c3c" fill-opacity=".12" stroke="#b23c3c" stroke-dasharray="5 4" stroke-width="1.5"/>`).join("");
  const sorted=layout.slice().sort((a,b)=>b.x-a.x||a.y-b.y);
  const rects=sorted.map(p=>`<rect x="${ox+p.y*scale}" y="${oy+(H-p.h)*scale}" width="${p.d*scale}" height="${p.h*scale}" rx="2" fill="${colorFor(p.typeId)}" fill-opacity=".28" stroke="${colorFor(p.typeId)}" stroke-width="1.5"/>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Side view"><rect x="${ox}" y="${oy}" width="${D*scale}" height="${H*scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${obs}${rects}</svg>`;
}

/* Interactive orthographic 3D camera. */
const isoCamera={yaw:Math.PI/4,elevation:30*Math.PI/180};

function isoCameraRaw(x,y,z,W,D,H){
  const cx=W/2,cy=D/2,dx=x-cx,dy=y-cy;
  const c=Math.cos(isoCamera.yaw),s=Math.sin(isoCamera.yaw);
  const xr=dx*c-dy*s,yr=dx*s+dy*c;
  const ce=Math.cos(isoCamera.elevation),se=Math.sin(isoCamera.elevation);
  return [xr,yr*se-z*ce];
}
function isoTransform(W,D,H,width,height){
  const corners=[[0,0,0],[W,0,0],[W,D,0],[0,D,0],[0,0,H],[W,0,H],[W,D,H],[0,D,H]].map(v=>isoCameraRaw(...v,W,D,H));
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pad=38,scale=Math.min((width-2*pad)/(maxX-minX||1),(height-2*pad)/(maxY-minY||1));
  const tx=(width-(minX+maxX)*scale)/2,ty=(height-(minY+maxY)*scale)/2;
  return (x,y,z)=>{const [rx,ry]=isoCameraRaw(x,y,z,W,D,H);return [rx*scale+tx,ry*scale+ty]};
}
function poly(points,fill,stroke,opacity){
  return `<polygon points="${points.map(p=>p.join(",")).join(" ")}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="1.1"/>`;
}
function obstacleCuboidSvg(o,P){
  const A=P(o.x,o.y,0),B=P(o.x+o.w,o.y,0),C=P(o.x+o.w,o.y+o.d,0),D=P(o.x,o.y+o.d,0);
  const E=P(o.x,o.y,o.h),F=P(o.x+o.w,o.y,o.h),G=P(o.x+o.w,o.y+o.d,o.h),H=P(o.x,o.y+o.d,o.h);
  return poly([A,B,F,E],"#b23c3c","#b23c3c",.10)+poly([B,C,G,F],"#b23c3c","#b23c3c",.14)+poly([E,F,G,H],"#b23c3c","#b23c3c",.18);
}
function cuboidSvg(p,P){
  const A=P(p.x,p.y,0),B=P(p.x+p.w,p.y,0),C=P(p.x+p.w,p.y+p.d,0),D=P(p.x,p.y+p.d,0);
  const E=P(p.x,p.y,p.h),F=P(p.x+p.w,p.y,p.h),G=P(p.x+p.w,p.y+p.d,p.h),H=P(p.x,p.y+p.d,p.h);
  const c=colorFor(p.typeId);
  return poly([A,B,F,E],c,c,.18)+poly([B,C,G,F],c,c,.24)+poly([E,F,G,H],c,c,.34);
}
function svgIso(layout,W,D,H,width=760,height=430){
  const P=isoTransform(W,D,H,width,height);
  const sorted=layout.slice().sort((a,b)=>{
    const ac=isoCameraRaw(a.x+a.w/2,a.y+a.d/2,a.h/2,W,D,H)[1];
    const bc=isoCameraRaw(b.x+b.w/2,b.y+b.d/2,b.h/2,W,D,H)[1];
    return bc-ac;
  });
  const floor=poly([P(0,0,0),P(W,0,0),P(W,D,0),P(0,D,0)],"#ffffff","#bbbbbb",1);
  const obstacleBoxes=usableObstacles().map(o=>obstacleCuboidSvg(o,P)).join("");
  const boxes=sorted.map(p=>cuboidSvg(p,P)).join("");
  const pts=[P(0,0,0),P(W,0,0),P(W,D,0),P(0,D,0),P(0,0,H),P(W,0,H),P(W,D,H),P(0,D,H)];
  const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const lines=edges.map(([a,b])=>`<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" stroke="#222" stroke-width="1.8"/>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Interactive 3D view">${floor}${obstacleBoxes}${boxes}${lines}</svg>`;
}

function renderDetail(W,D,H){
  const layout=layouts[selectedLayout];if(!layout)return;
  $("detailTitle").textContent=`Layout ${selectedLayout+1}`;
  updateModalNav();updateSavePlanButton();
  $("detailSubtitle").textContent=`${(utilization(layout,W,D)*100).toFixed(1)}% usable-floor utilization · ${layout.length} item${layout.length===1?"":"s"}.`;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===detailView));
  $("reset3d").disabled=detailView!=="iso";
  $("editLayoutBtn").textContent=editMode?"Editing":"Edit layout";
  $("editBar").classList.toggle("active",editMode);
  $("detailViz").classList.toggle("is-3d",detailView==="iso"&&!editMode);
  let svg="";
  if(detailView==="front")svg=svgFront(layout,W,H);
  else if(detailView==="iso")svg=svgIso(layout,W,D,H);
  else if(detailView==="top")svg=svgTop(layout,W,D,760,430,true,editMode,selectedEditItem,currentGaps[selectedGap]||null);
  else svg=svgSide(layout,D,H);
  $("detailViz").innerHTML=svg;

  const counts=layoutCounts(layout);
  $("layoutItems").innerHTML=Object.entries(counts).map(([id,n])=>{
    const b=boxById(id),ps=layout.filter(p=>p.typeId===id);
    const os=[...new Set(ps.map(p=>`${fmt(p.w)} × ${fmt(p.d)} × ${fmt(p.h)}`))];
    return `<li><strong>${esc(b?.name||id)} ×${n}</strong> — ${os.join(", ")} ${esc(state.unit)}</li>`;
  }).join("");

  currentGaps=findEmptyRectangles(layout,W,D);
  if(selectedGap>=currentGaps.length)selectedGap=-1;
  renderGapList(W,D,H);
  renderShoppingList(layout);
}



function renderGapList(W,D,H){
  const el=$("gapList");
  const totalFree=Math.max(0,freeFloorArea(W,D,usableObstacles())-occupiedArea(layouts[selectedLayout]||[]));
  $("leftoverTotal").textContent=`${fmt(totalFree)} ${state.unit}² free`;
  if(!currentGaps.length){
    el.innerHTML='<div class="empty">No rectangular leftover space remains.</div>';
    return;
  }
  el.innerHTML=currentGaps.slice(0,8).map((g,i)=>{
    const suggestions=gapSuggestions(g,H,layouts[selectedLayout]);
    const chips=suggestions.length?suggestions.map(s=>`<button type="button" class="suggestion" data-gap-add="${i}" data-gap-item="${s.id}" title="Add one ${esc(s.name)} here"><strong>${esc(s.name)}</strong>${s.count>1?` · up to ${s.count}`:""}</button>`).join(""):'<div class="nosuggestion">No saved item fits this rectangle.</div>';
    return `<div class="gapcard ${i===selectedGap?"active":""}" data-gap="${i}">
      <div class="gaphead"><strong>${fmt(g.w)} × ${fmt(g.d)} ${esc(state.unit)}</strong><span class="gaparea">${fmt(g.area)} ${esc(state.unit)}²</span></div>
      <div class="gapsuggestions">${chips}</div>
      <div class="gapnote">Position: ${fmt(g.x)} from left · ${fmt(g.y)} from front</div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-gap]").forEach(card=>card.addEventListener("click",e=>{
    if(e.target.closest("[data-gap-add]"))return;
    selectedGap=Number(card.dataset.gap);
    detailView="top";
    renderDetail(W,D,H);
    openDetailModal();
  }));

  el.querySelectorAll("[data-gap-add]").forEach(btn=>btn.addEventListener("click",e=>{
    e.stopPropagation();
    const gi=Number(btn.dataset.gapAdd),id=btn.dataset.gapItem,g=currentGaps[gi],b=boxById(id),layout=layouts[selectedLayout];
    if(!g||!b||!layout)return;
    const max=allowedMaxFor(id);
    if(max!==null&&countType(layout,id)>=max){setEditStatus(`Maximum quantity (${max}) reached for ${b.name}.`,true);return}
    const oris=orientations(b,state.uprightOnly).filter(o=>o[0]<=g.w+1e-9&&o[1]<=g.d+1e-9&&o[2]+Math.max(0,state.fitTolerance||0)<=H+1e-9);
    if(!oris.length)return;
    // Prefer the orientation using the largest share of the highlighted gap.
    oris.sort((a,b2)=>(b2[0]*b2[1])-(a[0]*a[1]));
    const o=oris[0],p={typeId:id,name:b.name,x:round6(g.x),y:round6(g.y),z:0,w:o[0],d:o[1],h:o[2]};
    layout.push(p);
    const idx=layout.length-1;
    if(!editItemValid(layout,idx,W,D)){
      layout.pop();setEditStatus("That saved item no longer fits after applying tolerance.",true);return;
    }
    selectedEditItem=idx;editMode=true;editOriginalLayout=editOriginalLayout||layout.slice(0,-1).map(q=>({...q}));
    selectedGap=-1;detailView="top";
    setEditStatus(`${b.name} added. You can drag or rotate it.`);
    renderDetail(W,D,H);
    renderGallery(W,D,H,galleryWasCapped);
    openDetailModal();
  }));
}

function currentUsableSize(){
  const S=storage(); if(!S)return null;
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;
  return {W:S.w-2*c,D:S.d-2*c,H:S.h-2*c};
}
function selectedManualLayout(){return layouts[selectedLayout]}
function editItemValid(layout,index,W,D){
  if(index<0||index>=layout.length)return false;
  const p=layout[index],gap=Math.max(0,state.fitTolerance||0),obstacles=usableObstacles();
  if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9)return false;
  if(obstacles.some(o=>overlap(p,o,gap)))return false;
  for(let i=0;i<layout.length;i++)if(i!==index&&overlap(p,layout[i],gap))return false;
  return true;
}
function setEditStatus(msg,bad=false){
  $("editStatus").textContent=msg;
  $("editStatus").style.color=bad?"var(--bad)":"var(--muted)";
}
function refreshCurrentDetail(){
  const sz=currentUsableSize();if(sz&&layouts.length)renderDetail(sz.W,sz.D,sz.H);
}
function allowedMaxFor(id){
  const v=state.itemLimits?.[id];
  return Number.isFinite(v)&&v>0?v:null;
}
function countType(layout,id){return layout.filter(p=>p.typeId===id).length}

$("editLayoutBtn").addEventListener("click",()=>{
  if(!layouts.length)return;
  if(!editMode){
    editMode=true;
    editOriginalLayout=selectedManualLayout().map(p=>({...p}));
    selectedEditItem=-1;
    detailView="top";
    setEditStatus("Click a box, drag it to move, or use the edit buttons.");
  }
  refreshCurrentDetail();
});

$("doneEdit").addEventListener("click",()=>{
  if(!editMode)return;
  const sz=currentUsableSize(),layout=selectedManualLayout();
  if(sz&&invalidEditIndices(layout,sz.W,sz.D).size){
    setEditStatus("Resolve collisions before finishing.",true);return;
  }
  editMode=false;selectedEditItem=-1;editOriginalLayout=null;
  setEditStatus("Layout saved locally in this proposal.");
  refreshCurrentDetail();
});

$("resetEdit").addEventListener("click",()=>{
  if(!editMode||!editOriginalLayout)return;
  layouts[selectedLayout]=editOriginalLayout.map(p=>({...p}));
  selectedEditItem=-1;selectedGap=-1;setEditStatus("Proposal restored.");refreshCurrentDetail();
});

$("rotateItem").addEventListener("click",()=>{
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz||selectedEditItem<0){setEditStatus("Select a box first.",true);return}
  const p=layout[selectedEditItem],old={w:p.w,d:p.d};
  p.w=old.d;p.d=old.w;
  if(!editItemValid(layout,selectedEditItem,sz.W,sz.D)){
    p.w=old.w;p.d=old.d;setEditStatus("That rotation would collide or leave the storage.",true);
  }else {selectedGap=-1;setEditStatus("Rotated.");}
  refreshCurrentDetail();
});

$("removeItem").addEventListener("click",()=>{
  const layout=selectedManualLayout();
  if(!editMode||!layout||selectedEditItem<0){setEditStatus("Select a box first.",true);return}
  layout.splice(selectedEditItem,1);selectedEditItem=-1;selectedGap=-1;setEditStatus("Item removed.");refreshCurrentDetail();
});

$("duplicateItem").addEventListener("click",()=>{
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz||selectedEditItem<0){setEditStatus("Select a box first.",true);return}
  const src=layout[selectedEditItem],max=allowedMaxFor(src.typeId);
  if(max!==null&&countType(layout,src.typeId)>=max){setEditStatus(`Maximum quantity (${max}) reached for this item.`,true);return}
  const points=candidatePoints(layout);
  for(const [x,y] of points){
    const p={...src,x:round6(x),y:round6(y)};
    const gap=Math.max(0,state.fitTolerance||0);
    if(p.x>=gap-1e-9&&p.y>=gap-1e-9&&p.x+p.w+gap<=sz.W+1e-9&&p.y+p.d+gap<=sz.D+1e-9&&!layout.some(q=>overlap(p,q,gap))&&!usableObstacles().some(o=>overlap(p,o,gap))){
      layout.push(p);selectedEditItem=layout.length-1;selectedGap=-1;setEditStatus("Duplicate added.");refreshCurrentDetail();return;
    }
  }
  setEditStatus("No free position for another copy.",true);
});

$("detailViz").addEventListener("pointerdown",e=>{
  if(!editMode||detailView!=="top"||!layouts.length)return;
  const target=e.target.closest?.("[data-item]");
  if(!target)return;
  const idx=Number(target.getAttribute("data-item"));
  if(!Number.isInteger(idx)||idx<0)return;
  const layout=selectedManualLayout(),p=layout[idx];
  selectedEditItem=idx;
  topDrag={id:e.pointerId,startX:e.clientX,startY:e.clientY,origX:p.x,origY:p.y};
  $("detailViz").setPointerCapture?.(e.pointerId);
  setEditStatus("Dragging…");
  refreshCurrentDetail();
  e.preventDefault();
});

$("detailViz").addEventListener("pointermove",e=>{
  if(!topDrag||!editMode||detailView!=="top"||e.pointerId!==topDrag.id)return;
  const sz=currentUsableSize(),layout=selectedManualLayout(),p=layout[selectedEditItem];
  const svg=$("detailViz").querySelector("svg");if(!sz||!p||!svg)return;
  const rect=svg.getBoundingClientRect(),g=topGeometry(sz.W,sz.D,760,430);
  const dx=(e.clientX-topDrag.startX)/rect.width*760/g.scale;
  const dy=(e.clientY-topDrag.startY)/rect.height*430/g.scale;
  const snap=.5;
  const gap=Math.max(0,state.fitTolerance||0);
  p.x=Math.max(gap,Math.min(sz.W-p.w-gap,Math.round((topDrag.origX+dx)/snap)*snap));
  p.y=Math.max(gap,Math.min(sz.D-p.d-gap,Math.round((topDrag.origY+dy)/snap)*snap));
  setEditStatus(editItemValid(layout,selectedEditItem,sz.W,sz.D)?"Position valid.":"Collision — release to revert.",!editItemValid(layout,selectedEditItem,sz.W,sz.D));
  refreshCurrentDetail();
  e.preventDefault();
});

function stopTopDrag(e){
  if(!topDrag||(e&&e.pointerId!==topDrag.id))return;
  const sz=currentUsableSize(),layout=selectedManualLayout();
  if(sz&&layout&&!editItemValid(layout,selectedEditItem,sz.W,sz.D)){
    layout[selectedEditItem].x=topDrag.origX;layout[selectedEditItem].y=topDrag.origY;
    setEditStatus("Collision rejected; previous position restored.",true);
  }else {selectedGap=-1;setEditStatus("Position updated.");}
  topDrag=null;refreshCurrentDetail();
}
$("detailViz").addEventListener("pointerup",stopTopDrag);
$("detailViz").addEventListener("pointercancel",stopTopDrag);

let isoDrag=null;
$("detailViz").addEventListener("pointerdown",e=>{
  if(editMode||detailView!=="iso"||!layouts.length)return;
  isoDrag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:isoCamera.yaw,elevation:isoCamera.elevation};
  $("detailViz").setPointerCapture?.(e.pointerId);
  $("detailViz").classList.add("dragging");
  e.preventDefault();
});
$("detailViz").addEventListener("pointermove",e=>{
  if(!isoDrag||e.pointerId!==isoDrag.id||detailView!=="iso")return;
  const dx=e.clientX-isoDrag.x,dy=e.clientY-isoDrag.y;
  isoCamera.yaw=isoDrag.yaw+dx*0.012;
  isoCamera.elevation=Math.max(10*Math.PI/180,Math.min(75*Math.PI/180,isoDrag.elevation-dy*0.009));
  const S=storage();
  if(S&&layouts.length){const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;renderDetail(S.w-2*c,S.d-2*c,S.h-2*c)}
  e.preventDefault();
});
function stopIsoDrag(e){
  if(!isoDrag||(e&&e.pointerId!==isoDrag.id))return;
  isoDrag=null;$("detailViz").classList.remove("dragging");
}
$("detailViz").addEventListener("pointerup",stopIsoDrag);
$("detailViz").addEventListener("pointercancel",stopIsoDrag);
$("detailViz").addEventListener("lostpointercapture",stopIsoDrag);
$("reset3d").addEventListener("click",()=>{
  isoCamera.yaw=Math.PI/4;isoCamera.elevation=30*Math.PI/180;
  const S=storage();if(S&&layouts.length){const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;renderDetail(S.w-2*c,S.d-2*c,S.h-2*c)}
});


$("printPlanBtn").addEventListener("click",()=>{
  if(!buildPrintSheet())return;
  window.print();
});
$("exportPlanBtn").addEventListener("click",()=>{
  const payload=currentExportPayload(),s=storage();if(!payload||!s)return;
  downloadJson(`${slugify(s.name)}-layout-${selectedLayout+1}.json`,payload);
  const old=$("exportPlanBtn").textContent;$("exportPlanBtn").textContent="Exported ✓";
  setTimeout(()=>{$("exportPlanBtn").textContent=old},1200);
});

$("savePlanBtn").addEventListener("click",()=>{
  const layout=layouts[selectedLayout],s=storage();if(!layout||!s)return;
  const signature=planSignature(s.id,layout);
  const existing=state.savedPlans.find(p=>p.signature===signature);
  if(existing){
    state.savedPlans=state.savedPlans.filter(p=>p.id!==existing.id);
  }else{
    const sameStorage=state.savedPlans.filter(p=>p.storageId===s.id).length+1;
    state.savedPlans.push({
      id:uid("plan"),
      name:`${s.name} · Plan ${sameStorage}`,
      storageId:s.id,
      storageName:s.name,
      goal:state.optimizeGoal,
      signature,
      layout:layout.map(q=>({...q}))
    });
  }
  localStorage.setItem(KEY,JSON.stringify(state));
  renderSavedPlans();updateSavePlanButton();
});

$("closeDetailModal").addEventListener("click",closeDetailModal);
$("detailBackdrop").addEventListener("click",closeDetailModal);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && detailModalOpen){ closeDetailModal(); return; }
  if(!detailModalOpen) return;
  if(e.key==="ArrowLeft" && selectedLayout>0){
    selectedLayout--; selectedGap=-1; editMode=false; selectedEditItem=-1; editOriginalLayout=null; topDrag=null;
    rerenderSelectedLayout(true);
  }else if(e.key==="ArrowRight" && selectedLayout<layouts.length-1){
    selectedLayout++; selectedGap=-1; editMode=false; selectedEditItem=-1; editOriginalLayout=null; topDrag=null;
    rerenderSelectedLayout(true);
  }
});
$("prevLayoutBtn").addEventListener("click",()=>{
  if(selectedLayout<=0)return;
  selectedLayout--; selectedGap=-1; editMode=false; selectedEditItem=-1; editOriginalLayout=null; topDrag=null;
  rerenderSelectedLayout(true);
});
$("nextLayoutBtn").addEventListener("click",()=>{
  if(selectedLayout>=layouts.length-1)return;
  selectedLayout++; selectedGap=-1; editMode=false; selectedEditItem=-1; editOriginalLayout=null; topDrag=null;
  rerenderSelectedLayout(true);
});

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  detailView=btn.dataset.view;topDrag=null;const S=storage();if(!S||!layouts.length)return;
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;renderDetail(S.w-2*c,S.d-2*c,S.h-2*c);
}));

$("generateBtn").addEventListener("click",findLayouts);
$("storageSelect").addEventListener("change",()=>{state.selectedStorage=$("storageSelect").value;editingStorage=state.selectedStorage;save();renderStorageList();loadStorageEditor();renderObstacleEditor();resetResults()});
$("optimizeGoal").addEventListener("change",()=>{
  state.optimizeGoal=$("optimizeGoal").value;save();
  const sz=currentUsableSize();
  if(layouts.length&&sz){
    layouts.sort((a,b)=>compareLayoutsForGoal(a,b,sz.W,sz.D) || countSignature(a).localeCompare(countSignature(b)));
    selectedLayout=0;selectedGap=-1;currentGaps=[];
    renderGallery(sz.W,sz.D,sz.H,galleryWasCapped);
    if(detailModalOpen){renderDetail(sz.W,sz.D,sz.H);}
  }else resetResults();
});

$("unit").addEventListener("change",()=>{
  const from=state.unit||"cm",to=$("unit").value;
  convertAllUnits(from,to);
  localStorage.setItem(KEY,JSON.stringify(state));
  renderAll();
});
$("uprightOnly").addEventListener("change",()=>{state.uprightOnly=$("uprightOnly").checked;save();resetResults()});
$("enableStacking").addEventListener("change",()=>{state.enableStacking=$("enableStacking").checked;save();resetResults()});
$("clearanceEnabled").addEventListener("change",()=>{state.clearanceEnabled=$("clearanceEnabled").checked;$("clearanceField").style.display=state.clearanceEnabled?"block":"none";save();resetResults()});
$("clearance").addEventListener("change",()=>{state.clearance=Math.max(0,Number($("clearance").value)||0);save();resetResults()});
$("fitTolerance").addEventListener("change",()=>{state.fitTolerance=Math.max(0,Number($("fitTolerance").value)||0);save();resetResults()});

$("addStorage").addEventListener("click",()=>{
  const id=uid("s");state.storages.push({id,name:"New storage",w:60,d:40,h:20,obstacles:[]});editingStorage=id;
  if(!state.selectedStorage)state.selectedStorage=id;save();renderAll();$("storageName").focus();$("storageName").select()
});
$("addObstacle").addEventListener("click",()=>{
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  s.obstacles=s.obstacles||[];
  const n=s.obstacles.length+1;
  s.obstacles.push({id:uid("o"),name:`Blocked zone ${n}`,x:0,y:0,w:5,d:5,h:Math.min(s.h||5,5)});
  save();renderObstacleEditor();renderStorageList();resetResults();
});



$("backupAllBtn").addEventListener("click",()=>{
  const payload=backupPayload();
  downloadTextFile(backupFilename(),JSON.stringify(payload,null,2));
  setBackupStatus(`Full backup created: ${state.storages.length} storage space${state.storages.length===1?"":"s"}, ${state.boxes.length} item${state.boxes.length===1?"":"s"}, ${(state.savedPlans||[]).length} saved plan${(state.savedPlans||[]).length===1?"":"s"}.`,"good");
});
$("restoreAllBtn").addEventListener("click",()=>{
  $("restoreFileInput").value="";
  $("restoreFileInput").click();
});
$("restoreFileInput").addEventListener("change",async()=>{
  const file=$("restoreFileInput").files?.[0];if(!file)return;
  setBackupStatus(`Checking ${file.name}…`);
  try{
    const parsed=JSON.parse(await file.text());
    const candidate=extractBackupState(parsed);
    if(!candidate)throw new Error("This does not look like a Storage Fit backup.");
    const validation=validateBackupState(candidate);
    if(validation)throw new Error(validation);

    const s=candidate.storages.length,b=candidate.boxes.length,p=(candidate.savedPlans||[]).length;
    const ok=confirm(`Restore this backup?\n\n${s} storage space${s===1?"":"s"}\n${b} item${b===1?"":"s"}\n${p} saved plan${p===1?"":"s"}\n\nThis will replace the data currently stored in this browser.`);
    if(!ok){setBackupStatus("Restore cancelled.");return}

    // Automatic emergency rollback snapshot of the current browser data.
    localStorage.setItem(`${KEY}-pre-restore`,JSON.stringify(backupPayload()));
    setBackupStatus("Backup validated. Restoring…","good");
    restoreBackupState(candidate);
  }catch(err){
    setBackupStatus(`Restore failed: ${err?.message||"invalid backup file"}`,"warn");
  }
});

$("smartUrl").addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();$("smartImportBtn").click()}
});
$("smartImportBtn").addEventListener("click",async()=>{
  const raw=$("smartUrl").value.trim(),url=safeUrl(raw);
  if(!url){
    $("smartStatus").className="smartstatus warn";$("smartStatus").textContent="Paste a valid http(s) product URL first.";return;
  }
  $("smartImportBtn").disabled=true;$("smartImportBtn").textContent="Importing…";
  $("smartStatus").className="smartstatus";$("smartStatus").textContent="Reading product information…";
  $("smartPreview").className="smartpreview";$("smartPreview").innerHTML="";
  try{
    const {data,source}=await fetchSmartProduct(url);
    const completeness=productCompleteness(data);
    const item=applyImportedProduct(data);
    const found=[];
    if(item.name&&item.name!=="Imported item")found.push("name");
    if(item.w&&item.d&&item.h)found.push("dimensions");
    if(item.price)found.push("price");
    if(item.sku)found.push("reference");
    if(item.image)found.push("image");
    $("smartStatus").className=`smartstatus ${completeness>=4?"good":"warn"}`;
    $("smartStatus").textContent=found.length
      ? `Imported via ${source}: ${found.join(", ")}.${item.w&&item.d&&item.h?"":" Dimensions still need to be checked/entered."}`
      : "The link was saved, but the retailer blocked automatic product data. Fill the missing fields below.";
    if(ikeaUrlInfo(url).isIkea && item.w&&item.d&&item.h){
      $("smartStatus").textContent += " IKEA measurements detected.";
    }
    $("smartPreview").className="smartpreview show";
    $("smartPreview").innerHTML=`${safeUrl(item.image)?`<img src="${esc(safeUrl(item.image))}" alt="">`:"<div></div>"}<div><div class="listname">${esc(item.name)}</div><div class="dims">${item.w?`${fmt(item.w)} × ${fmt(item.d)} × ${fmt(item.h)} ${esc(state.unit)}`:"Dimensions missing"}${item.price?` · ${esc(money(item.price,item.currency))}`:""}${item.sku?` · ${esc(item.sku)}`:""}</div></div>`;
    $("smartUrl").value="";
  }catch(e){
    $("smartStatus").className="smartstatus warn";$("smartStatus").textContent="Could not import this product automatically. The page may block external readers.";
  }finally{
    $("smartImportBtn").disabled=false;$("smartImportBtn").textContent="Import";
  }
});

$("addBox").addEventListener("click",()=>{
  const id=uid("b");state.boxes.push({id,name:"New item",w:30,d:20,h:10,price:0,currency:"MAD",sku:"",url:"",image:"",uprightOnly:true,canBeStacked:false,canSupportStack:false});state.selectedTypes[id]=false;state.itemLimits[id]=null;editingBox=id;save();renderAll();$("boxName").focus();$("boxName").select()
});
$("saveStorage").addEventListener("click",()=>{
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  s.name=$("storageName").value.trim()||"Storage";s.w=Math.max(0,Number($("sw").value)||0);s.d=Math.max(0,Number($("sd").value)||0);s.h=Math.max(0,Number($("sh").value)||0);
  s.obstacles=s.obstacles||[];for(const o of s.obstacles){o.x=Math.min(o.x,s.w);o.y=Math.min(o.y,s.d);o.w=Math.min(o.w,Math.max(0,s.w-o.x));o.d=Math.min(o.d,Math.max(0,s.d-o.y));o.h=Math.min(o.h,s.h)}
  save();renderAll()
});
$("saveBox").addEventListener("click",()=>{
  const b=state.boxes.find(x=>x.id===editingBox);if(!b)return;
  b.name=$("boxName").value.trim()||"Item";b.w=Math.max(0,Number($("bw").value)||0);b.d=Math.max(0,Number($("bd").value)||0);b.h=Math.max(0,Number($("bh").value)||0);
  b.price=Math.max(0,Number($("boxPrice").value)||0);b.currency=($("boxCurrency").value.trim().toUpperCase().slice(0,6)||"MAD");b.sku=$("boxSku").value.trim();b.url=$("boxUrl").value.trim();b.image=$("boxImage").value.trim();
  b.uprightOnly=$("boxUprightOnly").checked;b.canBeStacked=$("boxCanBeStacked").checked;b.canSupportStack=$("boxCanSupportStack").checked;
  save();renderAll()
});
$("deleteStorage").addEventListener("click",()=>{
  if(!editingStorage)return;state.savedPlans=state.savedPlans.filter(p=>p.storageId!==editingStorage);state.storages=state.storages.filter(x=>x.id!==editingStorage);
  if(state.selectedStorage===editingStorage)state.selectedStorage=state.storages[0]?.id||"";
  editingStorage=state.selectedStorage||state.storages[0]?.id||"";save();renderAll()
});
$("deleteBox").addEventListener("click",()=>{
  if(!editingBox)return;state.boxes=state.boxes.filter(x=>x.id!==editingBox);delete state.selectedTypes[editingBox];delete state.itemLimits[editingBox];
  editingBox=state.boxes[0]?.id||"";save();renderAll()
});

renderAll();
})();
