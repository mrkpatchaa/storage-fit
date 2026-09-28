(() => {
const $ = id => document.getElementById(id);
const KEY = "storage-fit-planner-v28";
const RECOVERY_KEY = "storage-fit-recovery-v1";
const RECOVERY_LIMIT = 8;
const PREV_KEYS = ["storage-fit-planner-v27","storage-fit-planner-v26","storage-fit-planner-v25","storage-fit-planner-v24","storage-fit-planner-v23","storage-fit-planner-v22","storage-fit-planner-v21","storage-fit-planner-v20","storage-fit-planner-v19","storage-fit-planner-v18","storage-fit-planner-v17","storage-fit-planner-v16","storage-fit-planner-v15","storage-fit-planner-v14","storage-fit-planner-v13","storage-fit-planner-v12","storage-fit-planner-v11","storage-fit-planner-v10","storage-fit-planner-v9","storage-fit-planner-v8","storage-fit-planner-v7","storage-fit-planner-v6","storage-fit-planner-v4","storage-fit-planner-v3","storage-fit-planner-v2"];
const COLORS = ["var(--c1)","var(--c2)","var(--c3)","var(--c4)","var(--c5)","var(--c6)"];
const SEARCH_LIMIT = 90000;
const LAYOUT_LIMIT = 180;
const SHARE_LINK_LIMIT = 12000;
const EDIT_HISTORY_LIMIT = 60;

let state = loadState();
ensureHomeHierarchy(state);
let editingStorage = state.selectedStorage || state.storages[0]?.id || "";
let editingBox = state.boxes[0]?.id || "";
let layouts = [];
let selectedLayout = 0;
let detailView = "front";
let editMode = false;
let selectedEditItem = -1;
let editOriginalLayout = null;
let editHistory = {entries:[],index:-1};
let topDrag = null;
let currentGaps = [];
let selectedGap = -1;
let galleryWasCapped = false;
let detailModalOpen = false;
let compareModalOpen = false;
let comparePlanIds = new Set();
let pendingImport = null;

state.itemLimits = state.itemLimits || {};
state.fitTolerance = Math.max(0, Number(state.fitTolerance)||0);
state.editSnapStep = Math.max(0.01, Number(state.editSnapStep)||defaultEditSnapStep(state.unit));
state.editShowGrid = state.editShowGrid !== false;
state.enableStacking = !!state.enableStacking;
state.optimizeGoal = ["fill","compartments","simple","balanced","cost","access"].includes(state.optimizeGoal)?state.optimizeGoal:"fill";
state.savedPlans = Array.isArray(state.savedPlans)?state.savedPlans:[];
normalizeChosenPlanSelections(state);
normalizeShoppingBought(state);
normalizeInstallState(state);
for(const p of state.savedPlans){
  p.note=String(p.note||"");p.settings=p.settings||null;
  for(const q of p.layout||[])q.label=String(q.label||"").trim().slice(0,60);
  p.signature=planSignature(p.storageId,p.layout||[]);
}
for(const b of state.boxes){
  if(!(b.id in state.itemLimits)) state.itemLimits[b.id] = null;
  b.price = Math.max(0,Number(b.price)||0);
  b.ownedQty = Math.max(0,Math.min(999,Math.floor(Number(b.ownedQty)||0)));
  b.currency = String(b.currency||"MAD").trim().toUpperCase().slice(0,6) || "MAD";
  b.url = String(b.url||"").trim();
  b.image = String(b.image||"").trim();
  b.sku = String(b.sku||"").trim();
  b.retailer = String(b.retailer||retailerName(b.url)||"").trim();
  b.uprightOnly = b.uprightOnly !== false;
  b.floorRotationLocked = !!b.floorRotationLocked;
  b.frontPriority = !!b.frontPriority;
  b.canBeStacked = !!b.canBeStacked;
  b.canSupportStack = !!b.canSupportStack;
  b.maxStackLevel = Number.isFinite(Number(b.maxStackLevel)) ? Math.max(1,Math.min(9,Math.floor(Number(b.maxStackLevel)))) : null;
}
for(const s of state.storages){
  if(!Array.isArray(s.obstacles)) s.obstacles=[];
  if(!Array.isArray(s.dividers)) s.dividers=[];
  for(const o of s.obstacles){
    o.id=o.id||uid("o");
    o.name=o.name||"Blocked zone";
    o.x=Math.max(0,Number(o.x)||0);o.y=Math.max(0,Number(o.y)||0);
    o.w=Math.max(0,Number(o.w)||0);o.d=Math.max(0,Number(o.d)||0);
    o.h=Math.max(0,Number(o.h)||s.h||0);
  }
  for(const d of s.dividers){
    d.id=d.id||uid("d");
    d.orientation=d.orientation==="horizontal"?"horizontal":"vertical";
    d.position=Math.min(Math.max(0,Number(d.position)||0),d.orientation==="horizontal"?s.d:s.w);
    d.thickness=Math.max(0.01,Number(d.thickness)||0.5);
    d.h=Math.max(0.01,Number(d.h)||s.h||0.01);
  }
}
for(const p of state.savedPlans){
  if(!p.storageSnapshot){
    const live=state.storages.find(s=>s.id===p.storageId);
    if(live)p.storageSnapshot=captureStorageSnapshot(live);
  }
  if(!p.itemSnapshots||typeof p.itemSnapshots!=="object"||Array.isArray(p.itemSnapshots)){
    p.itemSnapshots=capturePlanItems(p.layout||[]);
  }
  p.validatedAt=p.validatedAt||p.savedAt||new Date().toISOString();
}

function defaults(){
  return {
    unit:"cm",clearance:0.5,fitTolerance:0,editSnapStep:0.5,editShowGrid:true,uprightOnly:true,enableStacking:false,clearanceEnabled:false,optimizeGoal:"fill",savedPlans:[],chosenPlanIds:{},shoppingBought:{},installedPlanIds:{},installOrder:[],
    rooms:[{id:"room1",name:"Bedroom"}],
    furniture:[{id:"furn1",roomId:"room1",name:"Wardrobe"}],
    selectedRoom:"room1",selectedFurniture:"furn1",
    storages:[
      {id:"s1",name:"Drawer 67 × 26 × 13",w:67,d:26,h:13,furnitureId:"furn1",obstacles:[],dividers:[]},
      {id:"s2",name:"Shelf 81 × 40 × 27",w:81,d:40,h:27,furnitureId:"furn1",obstacles:[],dividers:[]}
    ],
    boxes:[
      {id:"b1",name:"Box 30 × 25 × 12",w:30,d:25,h:12,ownedQty:0,uprightOnly:true,floorRotationLocked:false,frontPriority:false,canBeStacked:false,canSupportStack:false,maxStackLevel:null},
      {id:"b2",name:"Box 32 × 25 × 12",w:32,d:25,h:12,ownedQty:0,uprightOnly:true,floorRotationLocked:false,frontPriority:false,canBeStacked:false,canSupportStack:false,maxStackLevel:null},
      {id:"b3",name:"Small box 20 × 13 × 10",w:20,d:13,h:10,ownedQty:0,uprightOnly:true,floorRotationLocked:false,frontPriority:false,canBeStacked:false,canSupportStack:false,maxStackLevel:null}
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
          unit:old.unit||"cm",clearance:old.clearance??0.5,fitTolerance:old.fitTolerance??0,editSnapStep:old.editSnapStep??defaultEditSnapStep(old.unit||"cm"),editShowGrid:old.editShowGrid!==false,uprightOnly:old.uprightOnly!==false,enableStacking:!!old.enableStacking,optimizeGoal:old.optimizeGoal||"fill",savedPlans:Array.isArray(old.savedPlans)?old.savedPlans:[],chosenPlanIds:old.chosenPlanIds&&typeof old.chosenPlanIds==="object"?old.chosenPlanIds:{},chosenPlanId:old.chosenPlanId||null,shoppingBought:old.shoppingBought&&typeof old.shoppingBought==="object"?old.shoppingBought:{},installedPlanIds:old.installedPlanIds&&typeof old.installedPlanIds==="object"?old.installedPlanIds:{},installOrder:Array.isArray(old.installOrder)?old.installOrder:[],
          clearanceEnabled:!!old.clearanceEnabled,rooms:Array.isArray(old.rooms)?old.rooms:[],furniture:Array.isArray(old.furniture)?old.furniture:[],
          selectedRoom:old.selectedRoom||"",selectedFurniture:old.selectedFurniture||"",
          storages:old.storages,boxes:old.boxes,
          selectedStorage:old.selectedStorage||old.storages[0]?.id||"",selectedTypes,
          itemLimits:Object.fromEntries(old.boxes.map(b=>[b.id, old.itemLimits?.[b.id] ?? null]))
        };
      }
    }
  }catch(e){}
  return defaults();
}
function normalizeInstallState(target){
  target.installedPlanIds=target.installedPlanIds&&typeof target.installedPlanIds==="object"&&!Array.isArray(target.installedPlanIds)?target.installedPlanIds:{};
  target.installOrder=Array.isArray(target.installOrder)?target.installOrder.filter(Boolean):[];

  const chosen=target.chosenPlanIds||{},saved=Array.isArray(target.savedPlans)?target.savedPlans:[];
  for(const [storageId,planId] of Object.entries(target.installedPlanIds)){
    const valid=chosen[storageId]===planId&&saved.some(p=>p.id===planId&&p.storageId===storageId);
    if(!valid)delete target.installedPlanIds[storageId];
  }

  const chosenIds=new Set(Object.keys(chosen));
  const seen=new Set(),normalized=[];
  for(const id of target.installOrder){
    if(chosenIds.has(id)&&!seen.has(id)){seen.add(id);normalized.push(id)}
  }
  for(const s of target.storages||[]){
    if(chosenIds.has(s.id)&&!seen.has(s.id)){seen.add(s.id);normalized.push(s.id)}
  }
  for(const id of chosenIds){
    if(!seen.has(id)){seen.add(id);normalized.push(id)}
  }
  target.installOrder=normalized;
  return target;
}
function normalizeShoppingBought(target){
  target.shoppingBought=target.shoppingBought&&typeof target.shoppingBought==="object"&&!Array.isArray(target.shoppingBought)?target.shoppingBought:{};
  for(const [id,value] of Object.entries(target.shoppingBought)){
    const qty=Math.max(0,Math.min(9999,Math.floor(Number(value)||0)));
    if(qty>0)target.shoppingBought[id]=qty;else delete target.shoppingBought[id];
  }
  return target.shoppingBought;
}
function normalizeChosenPlanSelections(target){
  target.savedPlans=Array.isArray(target.savedPlans)?target.savedPlans:[];
  target.chosenPlanIds=target.chosenPlanIds&&typeof target.chosenPlanIds==="object"&&!Array.isArray(target.chosenPlanIds)?target.chosenPlanIds:{};
  if(target.chosenPlanId&&target.savedPlans.some(p=>p.id===target.chosenPlanId)){
    const legacy=target.savedPlans.find(p=>p.id===target.chosenPlanId);
    if(legacy?.storageId&&!target.chosenPlanIds[legacy.storageId])target.chosenPlanIds[legacy.storageId]=legacy.id;
  }
  delete target.chosenPlanId;
  for(const storageId of Object.keys(target.chosenPlanIds)){
    const plan=target.savedPlans.find(p=>p.id===target.chosenPlanIds[storageId]&&p.storageId===storageId);
    if(!plan)delete target.chosenPlanIds[storageId];
  }
  return target.chosenPlanIds;
}
function ensureHomeHierarchy(target){
  target.rooms=Array.isArray(target.rooms)?target.rooms.filter(r=>r&&r.id):[];
  target.furniture=Array.isArray(target.furniture)?target.furniture.filter(f=>f&&f.id):[];

  if(!target.rooms.length)target.rooms.push({id:"room-home",name:"Home"});
  const roomIds=new Set(target.rooms.map(r=>r.id));
  for(const f of target.furniture){
    if(!roomIds.has(f.roomId))f.roomId=target.rooms[0].id;
    f.name=String(f.name||"Furniture").trim()||"Furniture";
  }
  if(!target.furniture.length)target.furniture.push({id:"furniture-unassigned",roomId:target.rooms[0].id,name:"Unassigned furniture"});

  const furnitureIds=new Set(target.furniture.map(f=>f.id));
  const fallbackFurniture=target.furniture[0].id;
  for(const s of target.storages||[]){
    if(!furnitureIds.has(s.furnitureId))s.furnitureId=fallbackFurniture;
  }

  const selectedStorage=(target.storages||[]).find(s=>s.id===target.selectedStorage)||(target.storages||[])[0];
  const selectedFurniture=target.furniture.find(f=>f.id===selectedStorage?.furnitureId)
    ||target.furniture.find(f=>f.id===target.selectedFurniture)
    ||target.furniture[0];
  const selectedRoom=target.rooms.find(r=>r.id===selectedFurniture?.roomId)
    ||target.rooms.find(r=>r.id===target.selectedRoom)
    ||target.rooms[0];

  target.selectedRoom=selectedRoom?.id||"";
  target.selectedFurniture=selectedFurniture?.id||"";
  if(selectedStorage)target.selectedStorage=selectedStorage.id;
}
function roomById(id){return state.rooms.find(r=>r.id===id)}
function furnitureById(id){return state.furniture.find(f=>f.id===id)}
function storageBreadcrumb(s){
  const f=furnitureById(s?.furnitureId),r=roomById(f?.roomId);
  return [r?.name,f?.name,s?.name].filter(Boolean).join(" → ");
}
function uniqueSiblingName(preferred,existingNames=[]){
  const clean=String(preferred||"Copy").trim()||"Copy",taken=new Set(existingNames.map(x=>String(x).toLowerCase()));
  if(!taken.has(clean.toLowerCase()))return clean;
  let n=2,candidate=`${clean} (${n})`;
  while(taken.has(candidate.toLowerCase()))candidate=`${clean} (${++n})`;
  return candidate;
}
function nextCopyName(base,existingNames=[]){
  const clean=String(base||"Copy").trim()||"Copy";
  return uniqueSiblingName(`${clean} copy`,existingNames);
}
function repeatStorageNames(base,count){
  const clean=String(base||"Storage").trim()||"Storage",m=clean.match(/^(.*?)(\d+)$/);
  const prefix=m?m[1].trimEnd():clean,start=m?Number(m[2])+1:2,pad=m?m[2].length:0;
  return Array.from({length:Math.max(0,Math.floor(Number(count)||0))},(_,i)=>{
    const n=String(start+i).padStart(pad,"0");
    return `${prefix}${prefix?" ":""}${n}`;
  });
}
function cloneStorageDefinition(source,{id=null,furnitureId=null,name=null,idFactory=uid}={}){
  const storageId=id||idFactory("s");
  return {
    id:storageId,
    name:name||`${source?.name||"Storage"} copy`,
    w:Number(source?.w)||0,d:Number(source?.d)||0,h:Number(source?.h)||0,
    furnitureId:furnitureId||source?.furnitureId||"",
    obstacles:(source?.obstacles||[]).map(o=>({
      id:idFactory("o"),name:o.name||"Blocked zone",
      x:Number(o.x)||0,y:Number(o.y)||0,w:Number(o.w)||0,d:Number(o.d)||0,h:Number(o.h)||0
    })),
    dividers:(source?.dividers||[]).map(d=>({
      id:idFactory("d"),orientation:d.orientation==="horizontal"?"horizontal":"vertical",
      position:Number(d.position)||0,thickness:Math.max(0.01,Number(d.thickness)||0.5),h:Number(d.h)||Number(source?.h)||0
    }))
  };
}
function cloneFurnitureDefinition(sourceFurniture,childStorages,{roomId=null,name=null,idFactory=uid}={}){
  const furnitureId=idFactory("furn");
  return {
    furniture:{id:furnitureId,roomId:roomId||sourceFurniture?.roomId||"",name:name||`${sourceFurniture?.name||"Furniture"} copy`},
    storages:(childStorages||[]).map(s=>cloneStorageDefinition(s,{furnitureId,idFactory}))
  };
}
function syncHierarchyToStorage(storageId){
  const s=state.storages.find(x=>x.id===storageId);if(!s)return;
  const f=furnitureById(s.furnitureId);if(!f)return;
  state.selectedFurniture=f.id;state.selectedRoom=f.roomId;
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
    for(const d of (s.dividers||[])){d.position=cv(d.position);d.thickness=cv(d.thickness);d.h=cv(d.h)}
  }
  for(const b of state.boxes){b.w=cv(b.w);b.d=cv(b.d);b.h=cv(b.h)}
  for(const p of state.savedPlans||[]){
    for(const q of p.layout||[]){q.x=cv(q.x);q.y=cv(q.y);q.z=cv(q.z||0);q.w=cv(q.w);q.d=cv(q.d);q.h=cv(q.h)}
    if(p.settings){
      p.settings.clearance=cv(p.settings.clearance||0);
      p.settings.fitTolerance=cv(p.settings.fitTolerance||0);
      p.settings.unit=to;
    }
    if(p.storageSnapshot){
      p.storageSnapshot.w=cv(p.storageSnapshot.w);p.storageSnapshot.d=cv(p.storageSnapshot.d);p.storageSnapshot.h=cv(p.storageSnapshot.h);p.storageSnapshot.unit=to;
      for(const o of p.storageSnapshot.obstacles||[]){o.x=cv(o.x);o.y=cv(o.y);o.w=cv(o.w);o.d=cv(o.d);o.h=cv(o.h)}
      for(const d of p.storageSnapshot.dividers||[]){d.position=cv(d.position);d.thickness=cv(d.thickness);d.h=cv(d.h)}
    }
    p.signature=planSignature(p.storageId,p.layout||[]);
  }
  state.clearance=cv(state.clearance);
  state.fitTolerance=cv(state.fitTolerance);
  state.editSnapStep=Math.max(0.01,cv(state.editSnapStep||0.5));
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
    appVersion:28,
    exportedAt:new Date().toISOString(),
    localStorageKey:KEY,
    data:JSON.parse(JSON.stringify(state))
  };
}
function normalizeRecoveryJournal(entries){
  const rows=(Array.isArray(entries)?entries:[]).filter(e=>e&&typeof e==="object"&&e.data&&typeof e.data==="object").map((e,i)=>{
    const parsed=Date.parse(e.createdAt||"");
    return {
      id:String(e.id||`recovery-${i}`),
      createdAt:Number.isFinite(parsed)?new Date(parsed).toISOString():new Date(0).toISOString(),
      reason:String(e.reason||"Recovery checkpoint").trim().slice(0,120)||"Recovery checkpoint",
      appVersion:Number(e.appVersion)||null,
      data:e.data
    };
  }).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const seen=new Set(),out=[];
  for(const row of rows){
    if(seen.has(row.id))continue;
    seen.add(row.id);out.push(row);
    if(out.length>=RECOVERY_LIMIT)break;
  }
  return out;
}
function writeRecoveryJournal(entries){
  const journal=normalizeRecoveryJournal(entries);
  localStorage.setItem(RECOVERY_KEY,JSON.stringify(journal));
  return journal;
}
function readRecoveryJournal(){
  let journal=[];
  try{journal=normalizeRecoveryJournal(JSON.parse(localStorage.getItem(RECOVERY_KEY)||"[]"))}catch(e){}
  let imported=false;
  for(const key of [KEY,...PREV_KEYS]){
    const legacyKey=`${key}-pre-restore`,raw=localStorage.getItem(legacyKey);
    if(!raw)continue;
    try{
      const parsed=JSON.parse(raw),candidate=extractBackupState(parsed)||parsed?.data||parsed;
      if(candidate&&typeof candidate==="object"&&!validateBackupState(candidate)){
        journal.unshift({
          id:uid("rec"),createdAt:parsed?.exportedAt||new Date().toISOString(),
          reason:"Before backup restore (legacy checkpoint)",appVersion:parsed?.appVersion||null,data:candidate
        });
        imported=true;
      }
    }catch(e){}
    localStorage.removeItem(legacyKey);
  }
  return imported?writeRecoveryJournal(journal):journal;
}
function createRecoveryCheckpoint(reason,data=state){
  const snapshot=JSON.parse(JSON.stringify(data));
  if(validateBackupState(snapshot))return null;
  const journal=readRecoveryJournal(),serialized=JSON.stringify(snapshot);
  if(journal[0]&&JSON.stringify(journal[0].data)===serialized){
    journal[0].reason=String(reason||journal[0].reason).slice(0,120);
    journal[0].createdAt=new Date().toISOString();
    writeRecoveryJournal(journal);renderRecoveryHistory();return journal[0];
  }
  const entry={
    id:uid("rec"),createdAt:new Date().toISOString(),reason:String(reason||"Recovery checkpoint").slice(0,120),
    appVersion:28,data:snapshot
  };
  writeRecoveryJournal([entry,...journal]);renderRecoveryHistory();return entry;
}
function recoveryEntryMeta(entry){
  const data=entry?.data||{};
  return {
    storages:Array.isArray(data.storages)?data.storages.length:0,
    items:Array.isArray(data.boxes)?data.boxes.length:0,
    plans:Array.isArray(data.savedPlans)?data.savedPlans.length:0
  };
}
function renderRecoveryHistory(){
  const el=$("recoveryList"),clear=$("clearRecoveryBtn");if(!el||!clear)return;
  const journal=readRecoveryJournal();clear.disabled=!journal.length;
  if(!journal.length){el.innerHTML='<div class="empty">No recovery checkpoints yet.</div>';return}
  el.innerHTML=journal.map(entry=>{
    const m=recoveryEntryMeta(entry),when=new Date(entry.createdAt);
    const time=Number.isFinite(when.getTime())?when.toLocaleString():"Unknown time";
    return `<div class="recoveryrow">
      <div><div class="recoveryreason">${esc(entry.reason)}</div><div class="recoverymeta">${esc(time)} · ${m.storages} storage · ${m.items} items · ${m.plans} plans</div></div>
      <button class="btn soft" type="button" data-restore-recovery="${entry.id}">Restore</button>
    </div>`;
  }).join("");
  el.querySelectorAll("[data-restore-recovery]").forEach(btn=>btn.addEventListener("click",()=>restoreRecoveryCheckpoint(btn.dataset.restoreRecovery)));
}
function restoreRecoveryCheckpoint(id){
  const journal=readRecoveryJournal(),entry=journal.find(e=>e.id===id);if(!entry)return;
  const error=validateBackupState(entry.data);
  if(error){setBackupStatus(`Recovery checkpoint is invalid: ${error}`,"warn");return}
  const m=recoveryEntryMeta(entry);
  const ok=confirm(`Restore this checkpoint?\n\n${entry.reason}\n${m.storages} storage spaces · ${m.items} items · ${m.plans} plans\n\nYour current state will be checkpointed first.`);
  if(!ok)return;
  createRecoveryCheckpoint("Before restoring recovery checkpoint");
  localStorage.setItem(KEY,JSON.stringify(entry.data));
  location.reload();
}
function clearRecoveryHistory(){
  if(!readRecoveryJournal().length)return;
  if(!confirm("Clear all local recovery checkpoints? Manual backup files are not affected."))return;
  localStorage.removeItem(RECOVERY_KEY);renderRecoveryHistory();
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
  for(const p of candidate.savedPlans||[]){
    if(p.itemSnapshots!=null&&(typeof p.itemSnapshots!=="object"||Array.isArray(p.itemSnapshots)))return "A saved plan has malformed item snapshots.";
  }
  if(candidate.chosenPlanIds!=null&&(typeof candidate.chosenPlanIds!=="object"||Array.isArray(candidate.chosenPlanIds)))return "Chosen plan selections are malformed.";
  if(candidate.shoppingBought!=null&&(typeof candidate.shoppingBought!=="object"||Array.isArray(candidate.shoppingBought)))return "Shopping progress is malformed.";
  if(candidate.installedPlanIds!=null&&(typeof candidate.installedPlanIds!=="object"||Array.isArray(candidate.installedPlanIds)))return "Installed plan status is malformed.";
  if(candidate.installOrder!=null&&!Array.isArray(candidate.installOrder))return "Install order is malformed.";
  if(Array.isArray(candidate.installOrder)){
    if(candidate.installOrder.some(id=>typeof id!=="string"))return "Install order contains an invalid storage ID.";
    if(new Set(candidate.installOrder).size!==candidate.installOrder.length)return "Install order contains duplicates.";
  }
  if(candidate.rooms!=null&&!Array.isArray(candidate.rooms))return "Rooms are malformed.";
  if(candidate.furniture!=null&&!Array.isArray(candidate.furniture))return "Furniture is malformed.";
  if(candidate.chosenPlanIds&&Array.isArray(candidate.savedPlans)){
    for(const [storageId,planId] of Object.entries(candidate.chosenPlanIds)){
      if(!candidate.savedPlans.some(p=>p?.id===planId&&p?.storageId===storageId))return "A chosen plan selection is invalid.";
    }
    if(candidate.installedPlanIds){
      for(const [storageId,planId] of Object.entries(candidate.installedPlanIds)){
        if(candidate.chosenPlanIds[storageId]!==planId)return "An installed plan no longer matches the chosen plan for its storage.";
      }
    }
  }
  if(Array.isArray(candidate.rooms)&&Array.isArray(candidate.furniture)){
    const roomIds=new Set(candidate.rooms.map(r=>r?.id).filter(Boolean));
    if(candidate.furniture.some(f=>!f?.id||!roomIds.has(f.roomId)))return "A furniture entry points to a missing room.";
    const furnitureIds=new Set(candidate.furniture.map(f=>f.id));
    if(candidate.storages.some(s=>s.furnitureId&&!furnitureIds.has(s.furnitureId)))return "A storage space points to missing furniture.";
  }

  const ids=new Set();
  for(const s of candidate.storages){
    if(!s||typeof s!=="object"||!s.id)return "A storage space is missing its ID.";
    if(ids.has(`s:${s.id}`))return "Duplicate storage-space ID found.";
    ids.add(`s:${s.id}`);
    if(!isFiniteNonNegative(s.w)||!isFiniteNonNegative(s.d)||!isFiniteNonNegative(s.h))return `Storage “${s.name||s.id}” has invalid dimensions.`;
    if(s.obstacles!=null&&!Array.isArray(s.obstacles))return `Storage “${s.name||s.id}” has malformed blocked zones.`;
    if(s.dividers!=null&&!Array.isArray(s.dividers))return `Storage “${s.name||s.id}” has malformed dividers.`;
    for(const d of s.dividers||[]){
      if(!d||typeof d!=="object"||!d.id)return `Storage “${s.name||s.id}” has a divider without an ID.`;
      if(!["vertical","horizontal"].includes(d.orientation))return `Storage “${s.name||s.id}” has a divider with an invalid direction.`;
      if(!isFiniteNonNegative(d.position)||!isFiniteNonNegative(d.thickness)||!isFiniteNonNegative(d.h))return `Storage “${s.name||s.id}” has invalid divider dimensions.`;
    }
  }
  for(const b of candidate.boxes){
    if(!b||typeof b!=="object"||!b.id)return "An item is missing its ID.";
    if(ids.has(`b:${b.id}`))return "Duplicate item ID found.";
    ids.add(`b:${b.id}`);
    if(!isFiniteNonNegative(b.w)||!isFiniteNonNegative(b.d)||!isFiniteNonNegative(b.h))return `Item “${b.name||b.id}” has invalid dimensions.`;
    if(b.maxStackLevel!=null&&(!Number.isInteger(Number(b.maxStackLevel))||Number(b.maxStackLevel)<1||Number(b.maxStackLevel)>9))return `Item “${b.name||b.id}” has an invalid maximum stack level.`;
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
  renderHierarchy();renderStorageList();renderBoxList();renderStorageSelect();renderItemPicker();loadStorageEditor();renderObstacleEditor();renderDividerEditor();loadBoxEditor();renderSavedPlans();renderInstallDashboard();renderHomeProcurement();renderBackupStats();renderRecoveryHistory();resetResults();
}
function plannedStorageIds(){return new Set((state.savedPlans||[]).map(p=>p.storageId))}
function installedStorageIds(){return new Set(Object.keys(state.installedPlanIds||{}))}
function renderHierarchy(){
  const roomSelect=$("roomSelect"),furnitureSelect=$("furnitureSelect"),storageFurniture=$("storageFurniture");
  const room=roomById(state.selectedRoom)||state.rooms[0];
  if(room)state.selectedRoom=room.id;
  const roomFurniture=state.furniture.filter(f=>f.roomId===state.selectedRoom);
  let furniture=furnitureById(state.selectedFurniture);
  if(!furniture||furniture.roomId!==state.selectedRoom)furniture=roomFurniture[0]||null;
  state.selectedFurniture=furniture?.id||"";

  roomSelect.innerHTML=state.rooms.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("");
  roomSelect.value=state.selectedRoom;

  furnitureSelect.innerHTML=roomFurniture.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join("");
  if(state.selectedFurniture)furnitureSelect.value=state.selectedFurniture;

  const furnitureOptions=state.rooms.flatMap(r=>state.furniture.filter(f=>f.roomId===r.id).map(f=>`<option value="${f.id}">${esc(r.name)} → ${esc(f.name)}</option>`)).join("");
  storageFurniture.innerHTML=furnitureOptions;

  const planned=plannedStorageIds(),installed=installedStorageIds(),allCount=state.storages.length;
  const plannedCount=state.storages.filter(s=>planned.has(s.id)).length,installedCount=state.storages.filter(s=>installed.has(s.id)).length;
  $("homeProgress").textContent=allCount?`${plannedCount}/${allCount} planned · ${installedCount} installed`:"No storage yet";

  const currentSpaces=state.storages.filter(s=>s.furnitureId===state.selectedFurniture);
  if(!currentSpaces.some(s=>s.id===editingStorage))editingStorage=currentSpaces[0]?.id||"";
  const currentPlanned=currentSpaces.filter(s=>planned.has(s.id)).length,currentInstalled=currentSpaces.filter(s=>installed.has(s.id)).length;
  const pct=currentSpaces.length?Math.round(currentInstalled/currentSpaces.length*100):0;
  $("furnitureProgress").innerHTML=currentSpaces.length
    ? `${currentPlanned} of ${currentSpaces.length} planned · ${currentInstalled} installed.<div class="progressbar"><span style="width:${pct}%"></span></div>`
    : "No storage spaces in this furniture yet.";

  $("deleteRoom").disabled=state.rooms.length<=1;
  $("deleteFurniture").disabled=state.furniture.length<=1;
}
function renderStorageList(){
  const el=$("storageList"),filtered=state.storages.filter(s=>s.furnitureId===state.selectedFurniture);
  if(!filtered.length){el.innerHTML='<div class="empty">No storage spaces in this furniture yet.</div>';return}
  const planned=plannedStorageIds();
  el.innerHTML=filtered.map(s=>`<div class="listitem ${s.id===editingStorage?"active":""}" data-s="${s.id}">
    <div><div class="listname">${esc(s.name)}</div><div class="dims">${fmt(s.w)} × ${fmt(s.d)} × ${fmt(s.h)} ${esc(state.unit)}${s.obstacles?.length?` · ${s.obstacles.length} blocked`:""}${s.dividers?.length?` · ${s.dividers.length} divider${s.dividers.length===1?"":"s"}`:""}<div class="crumb">${planned.has(s.id)?"saved plan available":"not planned yet"}</div></div></div>
    ${s.id===state.selectedStorage?'<span class="badge">selected</span>':planned.has(s.id)?'<span class="badge">planned</span>':""}</div>`).join("");
  el.querySelectorAll("[data-s]").forEach(n=>n.addEventListener("click",()=>{
    editingStorage=n.dataset.s;state.selectedStorage=n.dataset.s;syncHierarchyToStorage(n.dataset.s);
    localStorage.setItem(KEY,JSON.stringify(state));
    renderHierarchy();renderStorageSelect();loadStorageEditor();renderObstacleEditor();renderDividerEditor();renderStorageList();resetResults();
  }));
}
function renderBoxList(){
  const el=$("boxList"),query=String($("itemSearch")?.value||"").trim().toLowerCase();
  if(!state.boxes.length){el.innerHTML='<div class="empty">No items yet.</div>';if($("itemSearchCount"))$("itemSearchCount").textContent="";return}
  const filtered=state.boxes.filter(b=>{
    if(!query)return true;
    return [b.name,b.sku,b.retailer,retailerName(b.url)].some(v=>String(v||"").toLowerCase().includes(query));
  });
  if($("itemSearchCount"))$("itemSearchCount").textContent=query?`${filtered.length} of ${state.boxes.length}`:`${state.boxes.length} item${state.boxes.length===1?"":"s"}`;
  if(!filtered.length){el.innerHTML='<div class="empty">No items match this search.</div>';return}
  el.innerHTML=filtered.map(b=>`<div class="listitem ${b.id===editingBox?"active":""}" data-b="${b.id}">
    <div class="itemmain">${safeUrl(b.image)?`<img class="itemthumb" src="${esc(safeUrl(b.image))}" alt="">`:""}<div><div class="listname">${esc(b.name)}${b.retailer?`<span class="retailerbadge">${esc(b.retailer)}</span>`:""}</div><div class="dims">${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${esc(state.unit)}${b.price>0?` · ${esc(money(b.price,b.currency))}`:""}${b.sku?` · ${esc(b.sku)}`:""}${b.ownedQty?` · own ${b.ownedQty}`:""}${esc(itemRuleText(b))}</div></div></div>
    ${state.selectedTypes?.[b.id]?'<span class="badge">allowed</span>':""}</div>`).join("");
  el.querySelectorAll("[data-b]").forEach(n=>n.addEventListener("click",()=>{editingBox=n.dataset.b;loadBoxEditor();renderBoxList()}));
}
function renderStorageSelect(){
  const el=$("storageSelect");
  el.innerHTML='<option value="">Select a storage space</option>'+state.storages.map(s=>`<option value="${s.id}">${esc(storageBreadcrumb(s))}</option>`).join("");
  el.value=state.selectedStorage||"";
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
      <span><span class="listname">${esc(b.name)}</span><span class="dims" style="display:block">${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${esc(state.unit)}${b.ownedQty?` · own ${b.ownedQty}`:""}${esc(itemRuleText(b))}</span></span>
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
  const s=state.storages.find(x=>x.id===editingStorage);
  $("storageName").value=s?.name||"";$("sw").value=s?.w??"";$("sd").value=s?.d??"";$("sh").value=s?.h??"";
  if(s&&$("storageFurniture"))$("storageFurniture").value=s.furnitureId||state.selectedFurniture;
}
function defaultConstraintMeasure(unit=state.unit){
  return unit==="mm"?10:unit==="in"?0.4:1;
}
function constraintTemplateZones(kind,S,params={},idFactory=uid){
  if(!S)return [];
  const W=Math.max(0,Number(S.w)||0),D=Math.max(0,Number(S.d)||0),H=Math.max(0,Number(S.h)||0);
  if(W<=0||D<=0||H<=0)return [];
  const h=Math.max(0.01,Math.min(H,Number(params.height)||H));
  const zone=(name,x,y,w,d)=>({id:idFactory("o"),name,x:round6(x),y:round6(y),w:round6(w),d:round6(d),h:round6(h)});
  if(kind==="side-runners"){
    const w=Math.max(0.01,Math.min(W/2,Number(params.width)||defaultConstraintMeasure()));
    return [
      zone("Left runner",0,0,w,D),
      zone("Right runner",W-w,0,w,D)
    ];
  }
  if(kind==="rear-strip"){
    const d=Math.max(0.01,Math.min(D,Number(params.depth)||defaultConstraintMeasure()));
    return [zone("Rear obstruction",0,D-d,W,d)];
  }
  if(kind==="front-strip"){
    const d=Math.max(0.01,Math.min(D,Number(params.depth)||defaultConstraintMeasure()));
    return [zone("Front lip / track",0,0,W,d)];
  }
  if(kind==="corner-posts"){
    const w=Math.max(0.01,Math.min(W/2,Number(params.width)||defaultConstraintMeasure()));
    const d=Math.max(0.01,Math.min(D/2,Number(params.depth)||defaultConstraintMeasure()));
    return [
      zone("Front-left corner",0,0,w,d),
      zone("Front-right corner",W-w,0,w,d),
      zone("Rear-left corner",0,D-d,w,d),
      zone("Rear-right corner",W-w,D-d,w,d)
    ];
  }
  return [];
}
function promptConstraintMeasure(label,defaultValue,maxValue){
  const raw=prompt(`${label} (${state.unit})`,String(round6(defaultValue)));
  if(raw===null)return null;
  const value=Number(raw);
  if(!Number.isFinite(value)||value<=0){alert("Enter a positive measurement.");return null}
  return Math.max(0.01,Math.min(maxValue,value));
}
function applyConstraintTemplate(kind){
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  const base=defaultConstraintMeasure(),params={};
  if(kind==="side-runners"){
    const width=promptConstraintMeasure("Runner width from each side",Math.min(base,s.w/2),s.w/2);if(width===null)return;
    const height=promptConstraintMeasure("Runner height",s.h,s.h);if(height===null)return;
    params.width=width;params.height=height;
  }else if(kind==="rear-strip"||kind==="front-strip"){
    const depth=promptConstraintMeasure(kind==="rear-strip"?"Rear obstruction depth":"Front lip / track depth",Math.min(base,s.d),s.d);if(depth===null)return;
    const height=promptConstraintMeasure("Obstruction height",s.h,s.h);if(height===null)return;
    params.depth=depth;params.height=height;
  }else if(kind==="corner-posts"){
    const width=promptConstraintMeasure("Corner width",Math.min(base,s.w/2),s.w/2);if(width===null)return;
    const depth=promptConstraintMeasure("Corner depth",Math.min(base,s.d/2),s.d/2);if(depth===null)return;
    const height=promptConstraintMeasure("Corner height",s.h,s.h);if(height===null)return;
    params.width=width;params.depth=depth;params.height=height;
  }else return;
  const zones=constraintTemplateZones(kind,s,params);
  if(!zones.length)return;
  s.obstacles=s.obstacles||[];s.obstacles.push(...zones);
  save();renderObstacleEditor();renderStorageList();renderSavedPlans();resetResults();
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
      save();renderStorageList();renderSavedPlans();resetResults();
    }));
  });
  el.querySelectorAll("[data-remove-obstacle]").forEach(btn=>btn.addEventListener("click",()=>{
    const obstacle=s.obstacles.find(o=>o.id===btn.dataset.removeObstacle);
    createRecoveryCheckpoint(`Before deleting blocked zone “${obstacle?.name||"Blocked zone"}”`);
    s.obstacles=s.obstacles.filter(o=>o.id!==btn.dataset.removeObstacle);
    save();renderObstacleEditor();renderStorageList();renderSavedPlans();resetResults();
  }));
}

function renderDividerEditor(){
  const el=$("dividerList"),s=state.storages.find(x=>x.id===editingStorage);
  if(!s){el.innerHTML='<div class="empty">Select a storage space.</div>';return}
  s.dividers=s.dividers||[];
  if(!s.dividers.length){el.innerHTML='<div class="empty">No custom dividers.</div>';return}
  el.innerHTML=s.dividers.map(d=>{
    const axis=d.orientation==="horizontal"?"From front":"From left";
    return `<div class="dividerrow" data-divider="${d.id}">
      <div class="dividergrid">
        <div class="field"><label>Direction</label><select data-dkey="orientation"><option value="vertical" ${d.orientation==="vertical"?"selected":""}>Vertical</option><option value="horizontal" ${d.orientation==="horizontal"?"selected":""}>Horizontal</option></select></div>
        <div class="field"><label>${axis}</label><input data-dkey="position" type="number" min="0" step="0.1" value="${fmt(d.position)}"></div>
        <div class="field"><label>Thickness</label><input data-dkey="thickness" type="number" min="0.01" step="0.1" value="${fmt(d.thickness)}"></div>
        <div class="field"><label>Height</label><input data-dkey="h" type="number" min="0" step="0.1" value="${fmt(d.h)}"></div>
        <button class="divider-remove" type="button" data-remove-divider="${d.id}" aria-label="Remove divider">×</button>
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-divider]").forEach(row=>{
    const id=row.dataset.divider,d=s.dividers.find(x=>x.id===id);
    row.querySelectorAll("[data-dkey]").forEach(inp=>inp.addEventListener("change",()=>{
      const k=inp.dataset.dkey;
      if(k==="orientation")d.orientation=inp.value==="horizontal"?"horizontal":"vertical";
      else if(k==="thickness")d.thickness=Math.max(0.01,Number(inp.value)||0.5);
      else d[k]=Math.max(0,Number(inp.value)||0);
      d.position=Math.min(d.position,d.orientation==="horizontal"?s.d:s.w);
      d.h=Math.min(d.h,s.h);
      save();renderDividerEditor();renderStorageList();renderSavedPlans();resetResults();
    }));
  });
  el.querySelectorAll("[data-remove-divider]").forEach(btn=>btn.addEventListener("click",()=>{
    const divider=s.dividers.find(d=>d.id===btn.dataset.removeDivider);
    createRecoveryCheckpoint(`Before deleting ${divider?.orientation||"custom"} divider`);
    s.dividers=s.dividers.filter(d=>d.id!==btn.dataset.removeDivider);
    save();renderDividerEditor();renderStorageList();renderSavedPlans();resetResults();
  }));
}

function loadBoxEditor(){
  const b=state.boxes.find(x=>x.id===editingBox);
  $("boxName").value=b?.name||"";$("bw").value=b?.w??"";$("bd").value=b?.d??"";$("bh").value=b?.h??"";
  $("boxPrice").value=b?.price||"";$("boxCurrency").value=b?.currency||"MAD";$("boxOwnedQty").value=b?.ownedQty??0;$("boxSku").value=b?.sku||"";$("boxUrl").value=b?.url||"";$("boxImage").value=b?.image||"";
  $("boxUprightOnly").checked=b?.uprightOnly!==false;
  $("boxFloorRotationLocked").checked=!!b?.floorRotationLocked;
  $("boxFrontPriority").checked=!!b?.frontPriority;
  $("boxCanBeStacked").checked=!!b?.canBeStacked;
  $("boxCanSupportStack").checked=!!b?.canSupportStack;
  $("boxMaxStackLevel").value=b?.maxStackLevel??"";
  syncStackRuleControls();
}
function syncStackRuleControls(){
  const enabled=$("boxCanBeStacked").checked;
  $("boxMaxStackLevel").disabled=!enabled;
}
$("boxCanBeStacked").addEventListener("change",syncStackRuleControls);
function itemRuleText(b){
  const tags=[];
  if(b?.floorRotationLocked)tags.push("rotation locked");
  if(b?.frontPriority)tags.push("front priority");
  if(b?.canBeStacked)tags.push(b.maxStackLevel?`stack ≤L${b.maxStackLevel}`:"can stack");
  if(b?.canSupportStack)tags.push("supports");
  if(b?.uprightOnly===false)tags.push("may tip");
  return tags.length?` · ${tags.join(" · ")}`:"";
}
function selectedBoxes(){return state.boxes.filter(b=>state.selectedTypes?.[b.id])}

function normalizedSku(value){
  return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
}
function canonicalProductUrl(value){
  try{
    const u=new URL(String(value||"").trim());
    if(!["http:","https:"].includes(u.protocol))return "";
    u.hash="";u.search="";
    u.hostname=u.hostname.toLowerCase().replace(/^www\./,"");
    u.pathname=u.pathname.replace(/\/+$/,"")||"/";
    return `${u.hostname}${u.pathname}`;
  }catch(e){return ""}
}
function retailerName(value){
  try{
    const host=new URL(String(value||"").trim()).hostname.toLowerCase().replace(/^www\./,"");
    if(/(^|\.)ikea\.com$/.test(host))return "IKEA";
    if(/(^|\.)amazon\./.test(host))return "Amazon";
    if(/(^|\.)jysk\./.test(host))return "JYSK";
    if(host.includes("leroymerlin"))return "Leroy Merlin";
    if(host.includes("temu.com"))return "Temu";
    return host.split(".").slice(0,-1).join(".")||host;
  }catch(e){return ""}
}
function findExistingProduct(p){
  const sku=normalizedSku(p?.sku);
  if(sku){
    const bySku=state.boxes.find(b=>normalizedSku(b.sku)===sku);
    if(bySku)return bySku;
  }
  const url=canonicalProductUrl(p?.url);
  if(url)return state.boxes.find(b=>canonicalProductUrl(b.url)===url)||null;
  return null;
}
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

  const w=find("(?:Width|Largeur)"), d=find("(?:Depth|Profondeur)"), h=find("(?:Height|Hauteur)");
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
  return {url,name:info.name||"",sku:info.sku||"",price:0,currency:"MAD",image:"",retailer:retailerName(url)};
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
function importedFields(p){
  return {
    name:String(p?.name||"").trim(),
    w:Number(p?.w)||0,d:Number(p?.d)||0,h:Number(p?.h)||0,
    price:Math.max(0,Number(p?.price)||0),
    currency:String(p?.currency||"MAD").trim().toUpperCase().slice(0,6)||"MAD",
    sku:String(p?.sku||"").trim(),
    url:safeUrl(p?.url),
    image:safeUrl(p?.image),
    retailer:String(p?.retailer||retailerName(p?.url)||"").trim()
  };
}
function applyImportedProduct(p,targetId=null){
  const imported=importedFields(p);
  let item=targetId?state.boxes.find(b=>b.id===targetId):null;
  if(item){
    if(imported.name)item.name=imported.name;
    for(const k of ["w","d","h"]){if(imported[k]>0)item[k]=imported[k]}
    if(imported.price>0){item.price=imported.price;item.currency=imported.currency}
    if(imported.sku)item.sku=imported.sku;
    if(imported.url)item.url=imported.url;
    if(imported.image)item.image=imported.image;
    if(imported.retailer)item.retailer=imported.retailer;
  }else{
    const id=uid("b");
    item={
      id,name:imported.name||"Imported item",
      w:imported.w,d:imported.d,h:imported.h,
      price:imported.price,currency:imported.currency,
      sku:imported.sku,url:imported.url,image:imported.image,retailer:imported.retailer,ownedQty:0,
      uprightOnly:true,floorRotationLocked:false,frontPriority:false,canBeStacked:false,canSupportStack:false,maxStackLevel:null
    };
    state.boxes.push(item);state.selectedTypes[id]=true;state.itemLimits[id]=null;
  }
  editingBox=item.id;
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  if($("itemSearch"))$("itemSearch").value="";
  renderBoxList();renderItemPicker();loadBoxEditor();resetResults();
  ["boxName","bw","bd","bh","boxPrice","boxSku","boxUrl","boxImage"].forEach(k=>{const el=$(k);el?.classList.add("autofill");setTimeout(()=>el?.classList.remove("autofill"),750)});
  return item;
}
function importFoundLabels(item){
  const found=[];
  if(item.name)found.push("name");
  if(item.w&&item.d&&item.h)found.push("dimensions");
  if(item.price)found.push("price");
  if(item.sku)found.push("reference");
  if(item.image)found.push("image");
  return found;
}
function renderImportPreview(data,source){
  const p=importedFields(data),existing=findExistingProduct(p),found=importFoundLabels(p);
  pendingImport={data:{...p},source,existingId:existing?.id||null};
  const completeness=productCompleteness(p),status=$("smartStatus"),preview=$("smartPreview");
  status.className=`smartstatus ${completeness>=4?"good":"warn"}`;
  status.textContent=found.length
    ? `Detected via ${source}: ${found.join(", ")}. Review before saving.`
    : "The product link was recognized, but most details still need to be entered manually.";
  preview.className="smartpreview show";
  preview.innerHTML=`
    ${p.image?`<img src="${esc(p.image)}" alt="">`:'<div class="itemthumb"></div>'}
    <div>
      <div class="listname">${esc(p.name||"Imported item")}${p.retailer?`<span class="retailerbadge">${esc(p.retailer)}</span>`:""}</div>
      <div class="importfields">
        <div class="importfield"><strong>Dimensions</strong>${p.w&&p.d&&p.h?`${fmt(p.w)} × ${fmt(p.d)} × ${fmt(p.h)} ${esc(state.unit)}`:"Missing"}</div>
        <div class="importfield"><strong>Price</strong>${p.price?esc(money(p.price,p.currency)):"Missing"}</div>
        <div class="importfield"><strong>Reference</strong>${esc(p.sku||"Missing")}</div>
        <div class="importfield"><strong>Source</strong>${esc(source)}</div>
        ${existing?`<div class="duplicatehint">Already in your library as <strong>${esc(existing.name)}</strong>${existing.sku?` · ${esc(existing.sku)}`:""}. You can refresh that item or deliberately add another copy.</div>`:""}
        <div class="importactions">
          ${existing?`<button class="btn primary" type="button" data-import-update="${existing.id}">Update existing</button><button class="btn soft" type="button" data-import-add>Add as new</button>`:`<button class="btn primary" type="button" data-import-add>Add item</button>`}
          <button class="btn soft" type="button" data-import-cancel>Cancel</button>
        </div>
      </div>
    </div>`;
  preview.querySelector("[data-import-add]")?.addEventListener("click",()=>commitPendingImport(null));
  preview.querySelector("[data-import-update]")?.addEventListener("click",e=>commitPendingImport(e.currentTarget.dataset.importUpdate));
  preview.querySelector("[data-import-cancel]")?.addEventListener("click",clearPendingImport);
}
function clearPendingImport(){
  pendingImport=null;
  $("smartPreview").className="smartpreview";$("smartPreview").innerHTML="";
  $("smartStatus").className="smartstatus";
  $("smartStatus").textContent="Paste a public product page. Nothing is added until you review the detected details.";
}
function commitPendingImport(targetId){
  if(!pendingImport)return;
  const item=applyImportedProduct(pendingImport.data,targetId);
  const action=targetId?"Updated":"Added";
  const status=$("smartStatus");
  status.className="smartstatus good";
  status.textContent=`${action} ${item.name}. You can fine-tune its physical rules below.`;
  $("smartPreview").className="smartpreview";$("smartPreview").innerHTML="";
  $("smartUrl").value="";
  pendingImport=null;
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

function purchaseBreakdown(qty,ownedQty,price){
  const used=Math.max(0,Math.floor(Number(qty)||0));
  const owned=Math.max(0,Math.floor(Number(ownedQty)||0));
  const ownedUsed=Math.min(used,owned),buyQty=Math.max(0,used-ownedUsed);
  const unitPrice=Math.max(0,Number(price)||0);
  return {used,owned,ownedUsed,buyQty,subtotal:unitPrice*buyQty};
}
function shoppingRows(layout){
  const counts=layoutCounts(layout);
  return Object.entries(counts).map(([id,qty])=>{
    const b=boxById(id),price=Math.max(0,Number(b?.price)||0),currency=(b?.currency||"MAD").toUpperCase();
    const stock=purchaseBreakdown(qty,b?.ownedQty,price);
    return {
      id,qty:stock.used,ownedQty:stock.owned,ownedUsed:stock.ownedUsed,buyQty:stock.buyQty,
      name:b?.name||layout.find(p=>p.typeId===id)?.name||"Item",
      price,currency,subtotal:stock.subtotal,url:safeUrl(b?.url),image:safeUrl(b?.image),sku:b?.sku||"",
      dimensions:b?`${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${state.unit}`:""
    };
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
function shoppingTotals(layout){
  const totals={},rows=shoppingRows(layout);
  let missing=0,purchaseUnits=0,ownedUsed=0;
  for(const r of rows){
    purchaseUnits+=r.buyQty;ownedUsed+=r.ownedUsed;
    if(r.buyQty<=0)continue;
    if(r.price>0) totals[r.currency]=(totals[r.currency]||0)+r.subtotal;
    else missing+=r.buyQty;
  }
  return {totals,missing,purchaseUnits,ownedUsed,rows};
}
function totalsText(layout){
  const {totals,missing,purchaseUnits}=shoppingTotals(layout);
  if(purchaseUnits===0)return "Nothing to buy";
  const parts=Object.entries(totals).map(([c,v])=>money(v,c));
  if(!parts.length)return missing?`${missing} unpriced to buy`:"Nothing to buy";
  return parts.join(" + ")+(missing?` · ${missing} unpriced`:"");
}
function purchaseCostProfile(layout){
  const summary=shoppingTotals(layout),currencies=Object.keys(summary.totals).sort();
  return {
    missing:summary.missing,
    purchaseUnits:summary.purchaseUnits,
    ownedUsed:summary.ownedUsed,
    currencies,
    singleCurrency:currencies.length===1?currencies[0]:null,
    knownTotal:currencies.length===1?summary.totals[currencies[0]]:null
  };
}
function comparePurchaseCost(a,b,W,D){
  const pa=purchaseCostProfile(a),pb=purchaseCostProfile(b);
  if(pa.missing!==pb.missing)return pa.missing-pb.missing;
  if(pa.purchaseUnits===0||pb.purchaseUnits===0){
    if(pa.purchaseUnits!==pb.purchaseUnits)return pa.purchaseUnits-pb.purchaseUnits;
  }
  if(pa.singleCurrency&&pa.singleCurrency===pb.singleCurrency&&pa.knownTotal!==pb.knownTotal){
    return pa.knownTotal-pb.knownTotal;
  }
  if(pa.purchaseUnits!==pb.purchaseUnits)return pa.purchaseUnits-pb.purchaseUnits;
  const ua=utilization(a,W,D),ub=utilization(b,W,D);
  return ub-ua || distinctTypes(a)-distinctTypes(b);
}
function renderShoppingList(layout){
  const el=$("shoppingList"),summary=shoppingTotals(layout);
  $("shoppingTotal").textContent=totalsText(layout);
  if(!summary.rows.length){el.innerHTML='<div class="empty">No items in this layout.</div>';return}
  el.innerHTML=`<div class="shoprows">${summary.rows.map(r=>`<div class="shoprow">
    <div><div class="shopname">${esc(r.name)}</div><div class="shopsub">${esc(r.dimensions)}${r.sku?` · ${esc(r.sku)}`:""}</div></div>
    <div class="shopnum" title="Used in layout">Use ×${r.qty}</div>
    <div class="shopnum" title="Covered by owned inventory">Own ×${r.ownedUsed}</div>
    <div class="shopnum" title="Additional units to buy"><strong>Buy ×${r.buyQty}</strong></div>
    <div class="shopnum shopprice">${r.buyQty&&r.price>0?money(r.price,r.currency):"—"}</div>
    <div class="shopnum shopsubtotal">${r.buyQty&&r.price>0?money(r.subtotal,r.currency):r.buyQty?"—":"✓"}</div>
    <div class="shopaction">${r.buyQty&&r.url?`<a class="shoplink" href="${esc(r.url)}" target="_blank" rel="noopener">Product ↗</a>`:""}</div>
  </div>`).join("")}</div>${summary.missing?`<div class="shopmissing">${summary.missing} unit${summary.missing===1?"":"s"} to buy still need a price before the total is complete.</div>`:""}`;
}

function slugify(s){
  return String(s||"plan").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"storage-plan";
}
function base64UrlEncodeUtf8(text){
  const bytes=new TextEncoder().encode(String(text)),chunk=0x8000;
  let binary="";
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function base64UrlDecodeUtf8(value){
  const raw=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
  const padded=raw+"=".repeat((4-raw.length%4)%4),binary=atob(padded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function validateSharePayload(payload){
  if(!payload||typeof payload!=="object"||payload.v!==1)return "Unsupported shared-plan format.";
  if(typeof payload.n!=="string"||!payload.n.trim()||payload.n.length>160)return "Shared plan has an invalid name.";
  if(!["cm","mm","in"].includes(payload.u))return "Shared plan has an invalid unit.";
  if(!Array.isArray(payload.d)||payload.d.length!==3||payload.d.some(v=>!Number.isFinite(Number(v))||Number(v)<=0))return "Shared plan has invalid storage dimensions.";
  if(!Array.isArray(payload.z)||payload.z.length!==3||payload.z.some(v=>!Number.isFinite(Number(v))||Number(v)<=0))return "Shared plan has invalid usable dimensions.";
  if(!Array.isArray(payload.i)||payload.i.length>100)return "Shared plan has invalid item definitions.";
  for(const row of payload.i){
    if(!Array.isArray(row)||row.length<2||typeof row[0]!=="string"||typeof row[1]!=="string"||row[0].length>100||row[1].length>200)return "Shared plan has a malformed item definition.";
  }
  const itemIds=new Set(payload.i.map(row=>row[0]));
  if(!Array.isArray(payload.o)||payload.o.length>100)return "Shared plan has invalid physical constraints.";
  for(const row of payload.o){
    if(!Array.isArray(row)||row.length!==6||![0,1].includes(row[0])||row.slice(1).some(v=>!Number.isFinite(Number(v))||Number(v)<0))return "Shared plan has a malformed physical constraint.";
  }
  if(!Array.isArray(payload.p)||!payload.p.length||payload.p.length>500)return "Shared plan has invalid placements.";
  for(const row of payload.p){
    if(!Array.isArray(row)||row.length!==8||!itemIds.has(row[0])||row.slice(1,7).some(v=>!Number.isFinite(Number(v))||Number(v)<0)||typeof row[7]!=="string"||row[7].length>60)return "Shared plan has a malformed placement.";
  }
  return "";
}
function encodeSharePayload(payload){
  const error=validateSharePayload(payload);if(error)throw new Error(error);
  return base64UrlEncodeUtf8(JSON.stringify(payload));
}
function decodeSharePayload(value){
  try{
    const payload=JSON.parse(base64UrlDecodeUtf8(value)),error=validateSharePayload(payload);
    return error?{error,payload:null}:{error:"",payload};
  }catch(e){return {error:"This shared-plan link is damaged or incomplete.",payload:null}}
}
function currentSharePayload(){
  const layout=layouts[selectedLayout],s=storage();if(!layout||!s)return null;
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0,W=s.w-2*c,D=s.d-2*c,H=s.h-2*c;
  const ids=[...new Set(layout.map(p=>p.typeId))];
  return {
    v:1,n:s.name,u:state.unit,g:goalLabel(),k:!!state.enableStacking,
    d:[round6(s.w),round6(s.d),round6(s.h)],z:[round6(W),round6(D),round6(H)],
    c:round6(c),t:round6(Math.max(0,state.fitTolerance||0)),
    r:Number((utilization(layout,W,D,H)*100).toFixed(2)),q:utilizationNoun(layout),
    o:usableObstacles().map(o=>[o.kind==="divider"?1:0,round6(o.x),round6(o.y),round6(o.w),round6(o.d),round6(o.h)]),
    i:ids.map(id=>[id,String(boxById(id)?.name||id).slice(0,200)]),
    p:layout.map(p=>[p.typeId,round6(p.x),round6(p.y),round6(Number(p.z)||0),round6(p.w),round6(p.d),round6(p.h),placementLabel(p)])
  };
}
function currentShareUrl(baseHref=location.href){
  const payload=currentSharePayload();if(!payload)return null;
  const encoded=encodeSharePayload(payload),url=new URL("share.html",baseHref);
  url.hash="p="+encoded;
  return url.toString();
}
async function copyText(text){
  if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return true}catch(e){}}
  const ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";
  document.body.appendChild(ta);ta.select();let ok=false;
  try{ok=document.execCommand("copy")}catch(e){}
  ta.remove();return ok;
}

function currentExportPayload(){
  const layout=layouts[selectedLayout],s=storage();if(!layout||!s)return null;
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;
  return {
    format:"storage-fit-plan",
    version:2,
    exportedAt:new Date().toISOString(),
    storage:{
      id:s.id,name:s.name,width:s.w,depth:s.d,height:s.h,unit:state.unit,
      wallClearance:state.clearanceEnabled?state.clearance:0,
      fitTolerance:state.fitTolerance,
      obstacles:(s.obstacles||[]).map(o=>({...o})),
      dividers:(s.dividers||[]).map(d=>({...d}))
    },
    optimizationGoal:state.optimizeGoal,
    stackingEnabled:state.enableStacking,
    utilizationKind:utilizationNoun(layout),
    utilization:Number((utilization(layout,s.w-2*c,s.d-2*c,s.h-2*c)*100).toFixed(2)),
    items:shoppingRows(layout),
    contents:labeledPlacements(layout),
    placements:layout.map(p=>({...p,label:placementLabel(p)}))
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
    <div class="printmeta">${fmt(s.w)} × ${fmt(s.d)} × ${fmt(s.h)} ${esc(state.unit)} · ${esc(goalLabel())} · ${(utilization(layout,W,D,H)*100).toFixed(1)}% ${esc(utilizationNoun(layout))} utilization</div>
    <div class="printgrid">
      <div class="printviz"><h2>Front view</h2>${svgFront(layout,W,H,640,340)}</div>
      <div class="printviz"><h2>Top view</h2>${svgTop(layout,W,D,640,340,true,false,-1,null)}</div>
    </div>
    ${labeledPlacements(layout).length?`<h2>Contents / labels</h2><table><thead><tr><th>#</th><th>Purpose</th><th>Organizer</th><th>Position</th></tr></thead><tbody>${labeledPlacements(layout).map(x=>`<tr><td>${x.index+1}</td><td><strong>${esc(x.label)}</strong></td><td>${esc(x.itemName)}</td><td>${fmt(x.x)}, ${fmt(x.y)}${x.z>0?`, z ${fmt(x.z)}`:""} ${esc(state.unit)}</td></tr>`).join("")}</tbody></table>`:""}
    <h2>Shopping list</h2>
    <table><thead><tr><th>Item</th><th>Use</th><th>Owned</th><th>Buy</th><th>Unit price</th><th>Subtotal</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${esc(r.name)}${r.sku?` · ${esc(r.sku)}`:""}${r.url&&r.buyQty?`<br><a href="${esc(r.url)}">${esc(r.url)}</a>`:""}</td><td>${r.qty}</td><td>${r.ownedUsed}</td><td>${r.buyQty}</td><td>${r.buyQty&&r.price>0?money(r.price,r.currency):"—"}</td><td>${r.buyQty&&r.price>0?money(r.subtotal,r.currency):r.buyQty?"—":"✓"}</td></tr>`).join("")}</tbody></table>
    <div class="printtotal">Additional purchase estimate: ${esc(totalsText(layout))}</div>
  </div>`;
  return true;
}

function goalLabel(goal=state.optimizeGoal){
  return ({fill:"Best use of space",compartments:"Most compartments",simple:"Simplest setup",balanced:"Balanced mix",cost:"Cheapest to implement",access:"Easiest access"})[goal]||"Best use of space";
}
function balanceScore(layout){
  const counts=Object.values(layoutCounts(layout));
  if(counts.length<=1)return 0;
  const total=counts.reduce((a,b)=>a+b,0);
  let entropy=0;
  for(const c of counts){const p=c/total;entropy-=p*Math.log(p)}
  return entropy/Math.log(counts.length);
}
function accessPenalty(layout,D,itemLookup=boxById){
  const preferred=(layout||[]).filter(p=>itemLookup(p.typeId)?.frontPriority);
  if(!preferred.length)return 0;
  const depth=Math.max(1e-9,Number(D)||1);
  return preferred.reduce((sum,p)=>sum+Math.max(0,Math.min(1,(p.y+p.d/2)/depth)),0)/preferred.length;
}
function compareAccess(a,b,D,itemLookup=boxById){return accessPenalty(a,D,itemLookup)-accessPenalty(b,D,itemLookup)}
function compareLayoutsForGoal(a,b,W,D){
  const ua=utilization(a,W,D),ub=utilization(b,W,D),access=compareAccess(a,b,D);
  if(state.optimizeGoal==="access") return access || ub-ua || b.length-a.length || distinctTypes(b)-distinctTypes(a);
  if(state.optimizeGoal==="cost") return comparePurchaseCost(a,b,W,D) || access;
  if(state.optimizeGoal==="compartments") return b.length-a.length || access || ub-ua || distinctTypes(b)-distinctTypes(a);
  if(state.optimizeGoal==="simple") return distinctTypes(a)-distinctTypes(b) || access || a.length-b.length || ub-ua;
  if(state.optimizeGoal==="balanced") return balanceScore(b)-balanceScore(a) || access || distinctTypes(b)-distinctTypes(a) || ub-ua || b.length-a.length;
  return ub-ua || access || b.length-a.length || distinctTypes(b)-distinctTypes(a);
}

function planSignature(storageId,layout){
  return `${storageId}|${canonicalPlanLayout(layout)}`;
}
function storageStructureSignature(s){
  if(!s)return "";
  const obstacles=(s.obstacles||[]).map(o=>[
    round6(Number(o.x)||0),round6(Number(o.y)||0),round6(Number(o.w)||0),round6(Number(o.d)||0),round6(Number(o.h)||0)
  ]).sort((a,b)=>a.join("|").localeCompare(b.join("|")));
  const dividers=(s.dividers||[]).map(d=>[
    d.orientation==="horizontal"?"h":"v",round6(Number(d.position)||0),round6(Number(d.thickness)||0),round6(Number(d.h)||0)
  ]).sort((a,b)=>a.join("|").localeCompare(b.join("|")));
  return JSON.stringify([round6(Number(s.w)||0),round6(Number(s.d)||0),round6(Number(s.h)||0),obstacles,dividers]);
}
function matchingSiblingStorages(source,storages=state.storages){
  if(!source)return [];
  const signature=storageStructureSignature(source);
  return (storages||[]).filter(s=>s.id!==source.id&&s.furnitureId===source.furnitureId&&storageStructureSignature(s)===signature);
}
function eligiblePropagationTargets(source){
  return matchingSiblingStorages(source).filter(target=>
    !state.savedPlans.some(p=>p.storageId===target.id) &&
    !state.chosenPlanIds?.[target.id] &&
    !state.installedPlanIds?.[target.id]
  );
}
function createSavedPlanForStorage(target,layout,{name=null,note=""}={}){
  const signature=planSignature(target.id,layout);
  const existing=state.savedPlans.find(p=>p.signature===signature);
  if(existing)return existing;
  const sameStorage=state.savedPlans.filter(p=>p.storageId===target.id).length+1;
  const plan={
    id:uid("plan"),
    name:name||`${target.name} · Plan ${sameStorage}`,
    note,
    storageId:target.id,
    storageName:target.name,
    storagePath:storageBreadcrumb(target),
    storageSnapshot:captureStorageSnapshot(target),
    itemSnapshots:capturePlanItems(layout),
    settings:capturePlanSettings(),
    savedAt:new Date().toISOString(),
    validatedAt:new Date().toISOString(),
    goal:state.optimizeGoal,
    stacking:state.enableStacking,
    signature,
    layout:layout.map(q=>({...q}))
  };
  state.savedPlans.push(plan);
  return plan;
}
function updateApplyMatchingButton(){
  const btn=$("applyMatchingBtn");if(!btn)return;
  const source=storage(),layout=layouts[selectedLayout];
  const targets=source&&layout?eligiblePropagationTargets(source):[];
  btn.disabled=!source||!layout||targets.length===0;
  btn.textContent=targets.length?`Apply to ${targets.length} matching`:"Apply to matching";
  btn.title=targets.length
    ? `Save and choose this layout for ${targets.length} fresh matching compartment${targets.length===1?"":"s" } in the same furniture.`
    : "No fresh structurally identical sibling compartments are available.";
}
function currentPlanSaved(){
  const layout=layouts[selectedLayout],s=storage();
  if(!layout||!s)return false;
  const sig=planSignature(s.id,layout);
  return state.savedPlans.some(p=>p.signature===sig);
}
function capturePlanSettings(){
  return {
    unit:state.unit,
    clearanceEnabled:!!state.clearanceEnabled,
    clearance:Math.max(0,Number(state.clearance)||0),
    fitTolerance:Math.max(0,Number(state.fitTolerance)||0),
    uprightOnly:state.uprightOnly!==false
  };
}
function itemPlanningSnapshot(b){
  if(!b)return null;
  return {
    id:b.id,name:b.name||"Item",
    w:Number(b.w)||0,d:Number(b.d)||0,h:Number(b.h)||0,
    uprightOnly:b.uprightOnly!==false,
    floorRotationLocked:!!b.floorRotationLocked,
    frontPriority:!!b.frontPriority,
    canBeStacked:!!b.canBeStacked,
    canSupportStack:!!b.canSupportStack,
    maxStackLevel:b.maxStackLevel==null?null:Math.max(1,Math.min(9,Math.floor(Number(b.maxStackLevel)||1)))
  };
}
function itemPlanningSignature(item){
  const b=itemPlanningSnapshot(item);
  return b?JSON.stringify([round6(b.w),round6(b.d),round6(b.h),b.uprightOnly,b.floorRotationLocked,b.frontPriority,b.canBeStacked,b.canSupportStack,b.maxStackLevel]):"";
}
function capturePlanItems(layout){
  const out={};
  for(const id of new Set((layout||[]).map(p=>p.typeId))){
    const item=boxById(id);if(item)out[id]=itemPlanningSnapshot(item);
  }
  return out;
}
function snapshotItemLookup(snapshots={}){
  return id=>snapshots?.[id]||null;
}
function supportingBaseForLookup(p,placed,itemLookup){
  const z=Number(p.z)||0;if(z<=1e-9)return null;
  return placed.find(base=>{
    const rule=itemLookup(base.typeId);
    return !!rule?.canSupportStack && Math.abs((Number(base.z)||0)+base.h-z)<=1e-9 && footprintContains(base,p);
  })||null;
}
function placementStackLevelLookup(p,placed,itemLookup){
  let current=p,level=1;const seen=new Set();
  while((Number(current.z)||0)>1e-9){
    const base=supportingBaseForLookup(current,placed,itemLookup);
    if(!base||seen.has(base))return Infinity;
    seen.add(base);level++;current=base;
  }
  return level;
}
function placementMatchesItem(p,item,forceUpright){
  if(!item)return false;
  return orientations(item,forceUpright).some(o=>
    Math.abs(o[0]-p.w)<=1e-6&&Math.abs(o[1]-p.d)<=1e-6&&Math.abs(o[2]-p.h)<=1e-6
  );
}
function validatePlanLayoutAgainst(plan,liveStorage,itemLookup){
  if(!liveStorage)return {valid:false,reasons:["Storage space no longer exists."]};
  const settings=plan.settings||{clearanceEnabled:false,clearance:0,fitTolerance:0,uprightOnly:true};
  const c=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  const W=(Number(liveStorage.w)||0)-2*c,D=(Number(liveStorage.d)||0)-2*c,H=(Number(liveStorage.h)||0)-2*c;
  if(W<=0||D<=0||H<=0)return {valid:false,reasons:["Saved clearance no longer leaves usable storage space."]};
  const obstacles=usableObstaclesFor(liveStorage,c),layout=plan.layout||[],reasons=[];
  for(let i=0;i<layout.length;i++){
    const p=layout[i],item=itemLookup(p.typeId),z=Number(p.z)||0;
    if(!item){reasons.push(`Item ${p.typeId} no longer exists.`);continue}
    if(!placementMatchesItem(p,item,settings.uprightOnly!==false)){
      reasons.push(`${item.name||"Item"} dimensions or orientation rules no longer match its saved placement.`);
    }
    if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9||z<0||z+p.h>H+1e-9){
      reasons.push(`${item.name||"Item"} no longer fits inside the storage bounds.`);
    }
    if(obstacles.some(o=>overlap3D(p,o,gap)))reasons.push(`${item.name||"Item"} now collides with a blocked zone or divider.`);
    for(let j=i+1;j<layout.length;j++)if(overlap3D(p,layout[j],gap))reasons.push("Saved placements now overlap.");
    if(z>1e-9){
      const base=supportingBaseForLookup(p,layout.filter((_,j)=>j!==i),itemLookup);
      if(!plan.stacking||!item.canBeStacked||!base){
        reasons.push(`${item.name||"Item"} is no longer valid at its stacked position.`);
      }else{
        const level=placementStackLevelLookup(p,layout.filter((_,j)=>j!==i),itemLookup);
        if(item.maxStackLevel&&level>item.maxStackLevel)reasons.push(`${item.name||"Item"} exceeds its current maximum stack level.`);
      }
    }
  }
  return {valid:reasons.length===0,reasons:[...new Set(reasons)]};
}
function planHealthFromData(plan,liveStorage,itemLookup){
  const changes=[];
  if(!liveStorage)return {status:"invalid",canRevalidate:false,reasons:["Storage space no longer exists."]};
  if(!plan.storageSnapshot||storageStructureSignature(plan.storageSnapshot)!==storageStructureSignature(liveStorage)){
    changes.push("Storage dimensions, blocked zones, or dividers changed.");
  }
  const snapshots=plan.itemSnapshots||{};
  for(const id of new Set((plan.layout||[]).map(p=>p.typeId))){
    const live=itemLookup(id),snap=snapshots[id];
    if(!live){changes.push(`Item ${snap?.name||id} no longer exists.`);continue}
    if(!snap||itemPlanningSignature(snap)!==itemPlanningSignature(live)){
      changes.push(`${live.name||snap?.name||"Item"} dimensions or handling rules changed.`);
    }
  }
  const validity=validatePlanLayoutAgainst(plan,liveStorage,itemLookup);
  if(!validity.valid)return {status:"invalid",canRevalidate:false,reasons:[...new Set([...changes,...validity.reasons])]};
  if(changes.length)return {status:"review",canRevalidate:true,reasons:[...new Set(changes)]};
  return {status:"current",canRevalidate:false,reasons:[]};
}
function planHealth(plan){
  return planHealthFromData(plan,state.storages.find(s=>s.id===plan.storageId),boxById);
}
function revalidatePlan(plan){
  const health=planHealth(plan);if(!health.canRevalidate)return false;
  const live=state.storages.find(s=>s.id===plan.storageId);if(!live)return false;
  plan.storageSnapshot=captureStorageSnapshot(live);
  plan.itemSnapshots=capturePlanItems(plan.layout||[]);
  plan.validatedAt=new Date().toISOString();
  return true;
}

function captureStorageSnapshot(s){
  return s?JSON.parse(JSON.stringify({
    id:s.id,name:s.name,furnitureId:s.furnitureId,w:s.w,d:s.d,h:s.h,unit:state.unit,obstacles:s.obstacles||[],dividers:s.dividers||[]
  })):null;
}
function planMetrics(plan){
  const liveStorage=state.storages.find(x=>x.id===plan.storageId);
  const s=plan.storageSnapshot||liveStorage;
  const settings=plan.settings||{clearanceEnabled:false,clearance:0,unit:state.unit};
  const c=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const W=Math.max(0,(Number(s?.w)||0)-2*c),D=Math.max(0,(Number(s?.d)||0)-2*c),H=Math.max(0,(Number(s?.h)||0)-2*c);
  const obstacles=usableObstaclesFor(s,c);
  const stackedCount=(plan.layout||[]).filter(p=>(p.z||0)>1e-9).length;
  const usesStacking=plan.stacking ?? stackedCount>0;
  const denom=usesStacking?usableVolume(W,D,H,obstacles):freeFloorArea(W,D,obstacles);
  const used=usesStacking?occupiedVolume(plan.layout||[]):occupiedArea(plan.layout||[]);
  const utilizationPct=denom>0?used/denom*100:0;
  return {
    storage:s,storagePath:liveStorage?storageBreadcrumb(liveStorage):(plan.storagePath||plan.storageName||s?.name||"Storage"),W,D,H,stackedCount,utilizationPct,
    utilizationKind:usesStacking?"usable volume":"usable floor",
    itemCount:(plan.layout||[]).length,
    distinctTypes:distinctTypes(plan.layout||[]),
    cost:totalsText(plan.layout||[]),
    purchaseUnits:purchaseCostProfile(plan.layout||[]).purchaseUnits,
    ownedUsed:purchaseCostProfile(plan.layout||[]).ownedUsed
  };
}
function chosenPlanForStorage(storageId){
  const id=state.chosenPlanIds?.[storageId];
  return id?state.savedPlans.find(p=>p.id===id&&p.storageId===storageId)||null:null;
}
function isPlanChosen(plan){
  return !!plan && state.chosenPlanIds?.[plan.storageId]===plan.id;
}
function toggleChosenPlan(planId){
  const plan=state.savedPlans.find(p=>p.id===planId);if(!plan)return false;
  state.chosenPlanIds=state.chosenPlanIds||{};
  if(state.chosenPlanIds[plan.storageId]===plan.id){
    delete state.chosenPlanIds[plan.storageId];
    normalizeInstallState(state);return true;
  }
  const health=planHealth(plan);
  if(health.status!=="current"){
    alert(health.status==="review"
      ?"Review and revalidate this plan before choosing it."
      :"This plan is no longer valid with the current storage/items. Open it and rebuild or edit it first.");
    return false;
  }
  state.chosenPlanIds[plan.storageId]=plan.id;
  normalizeInstallState(state);return true;
}
function chosenPlans(){
  return Object.entries(state.chosenPlanIds||{})
    .map(([storageId,planId])=>state.savedPlans.find(p=>p.id===planId&&p.storageId===storageId))
    .filter(Boolean);
}
function computeInstallAllocation(plans,ownedById={},installedPlanIds={},order=[]){
  const byStorage=new Map((plans||[]).map(p=>[p.storageId,p]));
  const orderedIds=[],seen=new Set();
  for(const id of order||[]){
    if(byStorage.has(id)&&!seen.has(id)){seen.add(id);orderedIds.push(id)}
  }
  for(const p of plans||[]){
    if(!seen.has(p.storageId)){seen.add(p.storageId);orderedIds.push(p.storageId)}
  }

  const available={};
  for(const [id,qty] of Object.entries(ownedById||{}))available[id]=Math.max(0,Math.floor(Number(qty)||0));

  const requirements=p=>layoutCounts(p.layout||[]);
  for(const storageId of orderedIds){
    const plan=byStorage.get(storageId);
    if(!plan||installedPlanIds?.[storageId]!==plan.id)continue;
    for(const [id,qty] of Object.entries(requirements(plan))){
      available[id]=Math.max(0,(available[id]||0)-qty);
    }
  }

  const entries=[];
  for(const storageId of orderedIds){
    const plan=byStorage.get(storageId);if(!plan)continue;
    const req=requirements(plan),installed=installedPlanIds?.[storageId]===plan.id;
    if(installed){
      entries.push({plan,storageId,status:"installed",missing:[]});
      continue;
    }
    const missing=Object.entries(req).map(([id,qty])=>({id,qty:Math.max(0,qty-(available[id]||0))})).filter(x=>x.qty>0);
    if(!missing.length){
      for(const [id,qty] of Object.entries(req))available[id]=Math.max(0,(available[id]||0)-qty);
      entries.push({plan,storageId,status:"ready",missing:[]});
    }else{
      entries.push({plan,storageId,status:"waiting",missing});
    }
  }
  return {entries,remainingOwned:available};
}
function currentInstallAllocation(){
  normalizeInstallState(state);
  const plans=chosenPlans(),owned=Object.fromEntries(state.boxes.map(b=>[b.id,b.ownedQty||0]));
  const installed=p=>state.installedPlanIds?.[p.storageId]===p.id;
  const healthById=new Map(plans.map(p=>[p.id,planHealth(p)]));
  const active=plans.filter(p=>installed(p)||healthById.get(p.id)?.status==="current");
  const base=computeInstallAllocation(active,owned,state.installedPlanIds,state.installOrder);
  const byStorage=new Map(base.entries.map(e=>[e.storageId,{...e,health:healthById.get(e.plan.id)}]));
  for(const p of plans){
    if(installed(p))continue;
    const health=healthById.get(p.id);
    if(health?.status!=="current")byStorage.set(p.storageId,{plan:p,storageId:p.storageId,status:"stale",missing:[],health});
  }
  const order=[],seen=new Set();
  for(const id of state.installOrder||[])if(byStorage.has(id)&&!seen.has(id)){seen.add(id);order.push(id)}
  for(const p of plans)if(byStorage.has(p.storageId)&&!seen.has(p.storageId)){seen.add(p.storageId);order.push(p.storageId)}
  return {entries:order.map(id=>byStorage.get(id)).filter(Boolean),remainingOwned:base.remainingOwned};
}
function moveInstallStorage(storageId,delta){
  normalizeInstallState(state);
  const order=state.installOrder,i=order.indexOf(storageId),j=i+delta;
  if(i<0||j<0||j>=order.length)return;
  [order[i],order[j]]=[order[j],order[i]];
  localStorage.setItem(KEY,JSON.stringify(state));renderInstallDashboard();
}
function renderInstallDashboard(){
  const sec=$("installDashboardSection");if(!sec)return;
  normalizeInstallState(state);
  const allocation=currentInstallAllocation(),entries=allocation.entries;
  if(!entries.length){
    sec.style.display="none";$("installQueue").innerHTML="";return;
  }
  sec.style.display="block";
  const installed=entries.filter(e=>e.status==="installed").length;
  const ready=entries.filter(e=>e.status==="ready").length;
  const waiting=entries.filter(e=>e.status==="waiting").length;
  const stale=entries.filter(e=>e.status==="stale").length;
  $("installProgressText").textContent=`${installed}/${entries.length} installed`;
  $("installSummary").innerHTML=`
    <div class="installstat"><div class="k">Chosen spaces</div><div class="v">${entries.length}</div></div>
    <div class="installstat"><div class="k">Ready now</div><div class="v">${ready}</div></div>
    <div class="installstat"><div class="k">Waiting</div><div class="v">${waiting}</div></div>
    <div class="installstat"><div class="k">Needs review</div><div class="v">${stale}</div></div>
    <div class="installstat"><div class="k">Installed</div><div class="v">${installed}</div><div class="progressbar"><span style="width:${entries.length?Math.round(installed/entries.length*100):0}%"></span></div></div>`;

  $("installQueue").innerHTML=entries.map((entry,index)=>{
    const plan=entry.plan,m=planMetrics(plan),contents=labeledPlacements(plan.layout||[]);
    const missing=entry.missing.map(x=>`${esc(boxById(x.id)?.name||"Item")} ×${x.qty}`).join(" · ");
    const label=entry.status==="installed"?"Installed":entry.status==="ready"?"Ready now":entry.status==="stale"?"Needs plan review":"Waiting for inventory";
    return `<div class="installcard ${entry.status}">
      <div>
        <div class="installtitle">${esc(m.storagePath)}</div>
        <div class="installmeta">${esc(plan.name)} · ${m.itemCount} organizer${m.itemCount===1?"":"s"}</div>
        ${contents.length?`<div class="installmeta">Contents: ${contents.slice(0,4).map(x=>esc(x.label)).join(" · ")}${contents.length>4?` · +${contents.length-4} more`:""}</div>`:""}
        <span class="installstatus ${entry.status}">${label}</span>
        ${entry.status==="waiting"?`<div class="installmissing">Missing: ${missing}</div>`:""}
        ${entry.status==="stale"?`<div class="planissues">${(entry.health?.reasons||[]).slice(0,2).map(esc).join(" · ")}</div>`:""}
        ${entry.status==="installed"&&entry.health?.status!=="current"?`<div class="planissues">Installed from a plan that has since changed: ${(entry.health?.reasons||[]).slice(0,2).map(esc).join(" · ")}</div>`:""}
      </div>
      <div class="installactions">
        <button class="btn soft" type="button" data-install-up="${entry.storageId}" ${index===0?"disabled":""}>↑</button>
        <button class="btn soft" type="button" data-install-down="${entry.storageId}" ${index===entries.length-1?"disabled":""}>↓</button>
        <button class="btn soft" type="button" data-install-open="${plan.id}">Open</button>
        ${entry.status==="installed"
          ?`<button class="btn soft" type="button" data-install-undo="${entry.storageId}">Undo installed</button>`
          :`<button class="btn primary" type="button" data-install-done="${entry.storageId}" ${entry.status!=="ready"?"disabled":""}>Mark installed</button>`}
      </div>
    </div>`;
  }).join("");

  $("installQueue").querySelectorAll("[data-install-up]").forEach(btn=>btn.addEventListener("click",()=>moveInstallStorage(btn.dataset.installUp,-1)));
  $("installQueue").querySelectorAll("[data-install-down]").forEach(btn=>btn.addEventListener("click",()=>moveInstallStorage(btn.dataset.installDown,1)));
  $("installQueue").querySelectorAll("[data-install-open]").forEach(btn=>btn.addEventListener("click",()=>openSavedPlan(btn.dataset.installOpen)));
  $("installQueue").querySelectorAll("[data-install-done]").forEach(btn=>btn.addEventListener("click",()=>{
    const storageId=btn.dataset.installDone,entry=currentInstallAllocation().entries.find(e=>e.storageId===storageId);
    if(!entry||entry.status!=="ready")return;
    state.installedPlanIds[storageId]=entry.plan.id;
    localStorage.setItem(KEY,JSON.stringify(state));renderInstallDashboard();renderHomeProcurement();
  }));
  $("installQueue").querySelectorAll("[data-install-undo]").forEach(btn=>btn.addEventListener("click",()=>{
    delete state.installedPlanIds[btn.dataset.installUndo];
    localStorage.setItem(KEY,JSON.stringify(state));renderInstallDashboard();renderHomeProcurement();
  }));
}

function aggregateRequiredCounts(plans){
  const counts={};
  for(const plan of plans||[]){
    const perPlan=layoutCounts(plan.layout||[]);
    for(const [id,qty] of Object.entries(perPlan))counts[id]=(counts[id]||0)+qty;
  }
  return counts;
}

function projectProcurement(plans=chosenPlans()){
  const installed=p=>state.installedPlanIds?.[p.storageId]===p.id;
  const stalePlans=(plans||[]).filter(p=>!installed(p)&&planHealth(p).status!=="current");
  const staleIds=new Set(stalePlans.map(p=>p.id));
  const activePlans=(plans||[]).filter(p=>!staleIds.has(p.id));
  const counts=aggregateRequiredCounts(activePlans),storageUse={};
  for(const plan of activePlans){
    const perPlan=layoutCounts(plan.layout||[]);
    for(const [id] of Object.entries(perPlan)){
      if(!storageUse[id])storageUse[id]=new Set();
      storageUse[id].add(plan.storageId);
    }
  }
  const rows=Object.entries(counts).map(([id,qty])=>{
    const b=boxById(id),price=Math.max(0,Number(b?.price)||0),currency=(b?.currency||"MAD").toUpperCase();
    const stock=purchaseBreakdown(qty,b?.ownedQty,price);
    const boughtQty=Math.min(stock.buyQty,Math.max(0,Math.floor(Number(state.shoppingBought?.[id])||0)));
    const remainingQty=Math.max(0,stock.buyQty-boughtQty);
    return {
      id,name:b?.name||"Deleted item",sku:b?.sku||"",url:safeUrl(b?.url),
      qty:stock.used,ownedQty:stock.owned,ownedUsed:stock.ownedUsed,buyQty:stock.buyQty,
      boughtQty,remainingQty,
      price,currency,subtotal:stock.subtotal,remainingSubtotal:price*remainingQty,
      storageCount:storageUse[id]?.size||0
    };
  }).sort((a,b)=>a.name.localeCompare(b.name));

  const totals={},remainingTotals={};
  let missing=0,remainingMissing=0,purchaseUnits=0,boughtUnits=0,remainingUnits=0,ownedUsed=0,totalRequired=0;
  for(const r of rows){
    totalRequired+=r.qty;purchaseUnits+=r.buyQty;boughtUnits+=r.boughtQty;remainingUnits+=r.remainingQty;ownedUsed+=r.ownedUsed;
    if(r.buyQty>0){
      if(r.price>0)totals[r.currency]=(totals[r.currency]||0)+r.subtotal;
      else missing+=r.buyQty;
    }
    if(r.remainingQty>0){
      if(r.price>0)remainingTotals[r.currency]=(remainingTotals[r.currency]||0)+r.remainingSubtotal;
      else remainingMissing+=r.remainingQty;
    }
  }
  return {plans,activePlans,stalePlans,rows,totals,remainingTotals,missing,remainingMissing,purchaseUnits,boughtUnits,remainingUnits,ownedUsed,totalRequired};
}
function moneyTotalsText(totals,missing,emptyText="Nothing to buy"){
  const parts=Object.entries(totals||{}).map(([c,v])=>money(v,c));
  if(!parts.length)return missing?`${missing} unpriced`:emptyText;
  return parts.join(" + ")+(missing?` · ${missing} unpriced`:"");
}
function projectTotalsText(summary){
  return summary.purchaseUnits===0?"Nothing to buy":moneyTotalsText(summary.totals,summary.missing);
}
function projectRemainingText(summary){
  if(summary.stalePlans?.length)return `${summary.stalePlans.length} chosen plan${summary.stalePlans.length===1?"":"s"} need review`;
  if(summary.purchaseUnits===0)return "Ready to install";
  if(summary.remainingUnits===0)return "All purchased";
  return moneyTotalsText(summary.remainingTotals,summary.remainingMissing);
}
function setShoppingBought(itemId,value){
  state.shoppingBought=state.shoppingBought||{};
  const summary=projectProcurement(),row=summary.rows.find(r=>r.id===itemId);
  const max=row?.buyQty||0,qty=Math.max(0,Math.min(max,Math.floor(Number(value)||0)));
  if(qty>0)state.shoppingBought[itemId]=qty;else delete state.shoppingBought[itemId];
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderHomeProcurement();
}
function renderHomeProcurement(){
  const sec=$("homeProcurementSection");if(!sec)return;
  const summary=projectProcurement();
  if(!summary.plans.length){
    sec.style.display="none";$("homeProcurementList").innerHTML="";
    $("receivePurchasesBtn").disabled=true;
    return;
  }
  sec.style.display="block";
  $("homeChosenCount").textContent=summary.plans.length+" chosen storage"+(summary.plans.length===1?"":"s")+(summary.stalePlans.length?" · "+summary.stalePlans.length+" need review":"");
  $("receivePurchasesBtn").disabled=summary.boughtUnits<=0;
  $("receivePurchasesBtn").textContent=summary.boughtUnits?`Receive ${summary.boughtUnits} purchased`:"Receive purchases";

  const ready=summary.purchaseUnits===0&&summary.stalePlans.length===0;
  $("homeProcurementSummary").innerHTML=`
    <div class="projectstat"><div class="k">Chosen spaces</div><div class="v">${summary.plans.length}</div></div>
    <div class="projectstat"><div class="k">Organizers required</div><div class="v">${summary.totalRequired}</div></div>
    <div class="projectstat"><div class="k">Owned reused</div><div class="v">${summary.ownedUsed}</div></div>
    <div class="projectstat ${summary.boughtUnits?"warn":""}"><div class="k">Shopping progress</div><div class="v">${summary.boughtUnits}/${summary.purchaseUnits}</div><div class="small">purchased</div></div>
    <div class="projectstat ${ready?"ready":""}"><div class="k">Remaining</div><div class="v" style="font-size:13px">${esc(projectRemainingText(summary))}</div></div>`;

  $("homeChosenPlans").innerHTML=summary.plans.map(plan=>{
    const m=planMetrics(plan);
    const health=planHealth(plan);return `<span class="projectplan">${esc(m.storagePath)} · ${esc(plan.name)}${health.status!=="current"?" · needs review":""}</span>`;
  }).join("");

  $("homeProcurementList").innerHTML=summary.rows.map(r=>`<div class="homeshoprow">
    <div><div class="shopname">${esc(r.name)}</div><div class="shopsub">${r.sku?esc(r.sku)+" · ":""}used in ${r.storageCount} storage${r.storageCount===1?"":"s"}</div></div>
    <div class="shopnum">Use ×${r.qty}</div>
    <div class="shopnum">Own ×${r.ownedUsed}</div>
    <div class="shopnum">Need ×${r.buyQty}</div>
    <div class="purchasecontrol">
      ${r.buyQty?`<button class="btn soft" type="button" data-bought-dec="${r.id}" aria-label="Decrease purchased quantity">−</button><span class="purchasecount">${r.boughtQty}</span><button class="btn soft" type="button" data-bought-inc="${r.id}" aria-label="Increase purchased quantity">+</button>`:'<span class="purchasecount">✓</span>'}
    </div>
    <div class="shopnum"><strong>Left ×${r.remainingQty}</strong></div>
    <div class="shopnum shopsubtotal">${r.remainingQty&&r.price>0?money(r.remainingSubtotal,r.currency):r.remainingQty?"—":"✓"}</div>
    <div class="shopaction">${r.remainingQty&&r.url?`<a class="shoplink" href="${esc(r.url)}" target="_blank" rel="noopener">Product ↗</a>`:""}${r.buyQty&&r.boughtQty!==r.buyQty?` <button class="btn soft" type="button" data-bought-all="${r.id}">All bought</button>`:""}</div>
  </div>`).join("") || '<div class="empty">No items in the chosen plans.</div>';

  $("homeProcurementList").querySelectorAll("[data-bought-dec]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=projectProcurement().rows.find(r=>r.id===btn.dataset.boughtDec);if(row)setShoppingBought(row.id,row.boughtQty-1);
  }));
  $("homeProcurementList").querySelectorAll("[data-bought-inc]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=projectProcurement().rows.find(r=>r.id===btn.dataset.boughtInc);if(row)setShoppingBought(row.id,row.boughtQty+1);
  }));
  $("homeProcurementList").querySelectorAll("[data-bought-all]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=projectProcurement().rows.find(r=>r.id===btn.dataset.boughtAll);if(row)setShoppingBought(row.id,row.buyQty);
  }));
}
function receiveMarkedPurchases(){
  const summary=projectProcurement();
  if(summary.boughtUnits<=0)return 0;
  let received=0;
  for(const row of summary.rows){
    if(row.boughtQty<=0)continue;
    const item=boxById(row.id);if(!item)continue;
    item.ownedQty=Math.max(0,Math.min(999,Math.floor(Number(item.ownedQty)||0)+row.boughtQty));
    received+=row.boughtQty;
    delete state.shoppingBought[row.id];
  }
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  return received;
}
function homeShoppingExportPayload(){
  const summary=projectProcurement(),install=currentInstallAllocation();
  return {
    format:"storage-fit-home-shopping",
    version:4,
    exportedAt:new Date().toISOString(),
    unit:state.unit,
    chosenPlans:summary.plans.map(p=>{const h=planHealth(p);return {id:p.id,name:p.name,storageId:p.storageId,storagePath:planMetrics(p).storagePath,health:h.status,healthReasons:h.reasons}}),
    staleChosenPlans:summary.stalePlans.length,
    totals:summary.totals,
    remainingTotals:summary.remainingTotals,
    missingPriceUnits:summary.missing,
    remainingMissingPriceUnits:summary.remainingMissing,
    purchaseUnits:summary.purchaseUnits,
    purchasedUnits:summary.boughtUnits,
    remainingUnits:summary.remainingUnits,
    ownedUsed:summary.ownedUsed,
    installQueue:install.entries.map((e,index)=>({
      order:index+1,storageId:e.storageId,planId:e.plan.id,storagePath:planMetrics(e.plan).storagePath,status:e.status,
      health:(e.health||planHealth(e.plan)).status,healthReasons:(e.health||planHealth(e.plan)).reasons,
      missing:e.missing.map(x=>({itemId:x.id,name:boxById(x.id)?.name||"Item",qty:x.qty}))
    })),
    items:summary.rows.map(r=>({...r,url:safeUrl(r.url)}))
  };
}

function updateCompareButton(){
  const btn=$("comparePlansBtn");if(!btn)return;
  const count=comparePlanIds.size;
  btn.disabled=count<2;
  btn.textContent=count?`Compare (${count})`:"Compare";
}
function openCompareModal(){
  if(comparePlanIds.size<2)return;
  compareModalOpen=true;renderCompareModal();
  $("compareModal").classList.add("open");
  $("compareModal").setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}
function closeCompareModal(){
  compareModalOpen=false;
  $("compareModal").classList.remove("open");
  $("compareModal").setAttribute("aria-hidden","true");
  if(!detailModalOpen)document.body.classList.remove("modal-open");
}
function renderCompareModal(){
  const plans=[...comparePlanIds].map(id=>state.savedPlans.find(p=>p.id===id)).filter(Boolean).slice(0,3);
  const el=$("compareGrid");
  el.innerHTML=plans.map(plan=>{
    const m=planMetrics(plan),counts=layoutCounts(plan.layout||[]),contents=labeledPlacements(plan.layout||[]);
    const items=Object.entries(counts).map(([id,n])=>`<li>${esc(boxById(id)?.name||"Item")} ×${n}</li>`).join("");
    const chosen=isPlanChosen(plan),health=planHealth(plan);
    return `<article class="comparecard ${chosen?"chosen":""}">
      <div class="comparetitle">${esc(plan.name)}${chosen?'<span class="chosenbadge">Chosen</span>':""}${health.status!=="current"?`<span class="planhealth ${health.status}">${health.status==="review"?"Review":"Invalid"}</span>`:""}</div>
      <div class="comparestorage">${esc(m.storagePath)} · ${esc(goalLabel(plan.goal))}</div>
      <div class="comparestats">
        <div class="comparestat"><div class="k">Utilization</div><div class="v">${m.utilizationPct.toFixed(1)}%</div><div class="small">${esc(m.utilizationKind)}</div></div>
        <div class="comparestat"><div class="k">Items</div><div class="v">${m.itemCount}</div><div class="small">${m.distinctTypes} type${m.distinctTypes===1?"":"s"}</div></div>
        <div class="comparestat"><div class="k">Stacked</div><div class="v">${m.stackedCount}</div><div class="small">${plan.stacking?"stacking enabled":"floor-focused"}</div></div>
        <div class="comparestat"><div class="k">To buy</div><div class="v" style="font-size:12px">${esc(m.cost)}</div><div class="small">${m.ownedUsed} owned used</div></div>
      </div>
      <div class="compareitems"><strong>Item mix</strong><ul>${items||"<li>No items</li>"}</ul></div>
      ${contents.length?`<div class="compareitems"><strong>Contents</strong><ul>${contents.map(x=>`<li>${esc(x.label)} — ${esc(x.itemName)}</li>`).join("")}</ul></div>`:""}
      ${health.status!=="current"?`<div class="planissues">${health.reasons.slice(0,3).map(esc).join(" · ")}</div>`:""}
      ${plan.note?`<div class="comparnote">${esc(plan.note)}</div>`:""}
      <div class="savedactions">
        <button class="btn ${chosen?"primary":"soft"}" type="button" data-compare-choose="${plan.id}" ${!chosen&&health.status!=="current"?"disabled":""}>${chosen?"Chosen here ✓":"Choose for this storage"}</button>
        <button class="btn soft" type="button" data-compare-open="${plan.id}">Open</button>
      </div>
    </article>`;
  }).join("");

  el.querySelectorAll("[data-compare-choose]").forEach(btn=>btn.addEventListener("click",()=>{
    toggleChosenPlan(btn.dataset.compareChoose);
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderSavedPlans();renderHomeProcurement();renderCompareModal();
  }));
  el.querySelectorAll("[data-compare-open]").forEach(btn=>btn.addEventListener("click",()=>{
    closeCompareModal();openSavedPlan(btn.dataset.compareOpen);
  }));
}
function openSavedPlan(planId){
  const plan=state.savedPlans.find(p=>p.id===planId);if(!plan)return;
  if(state.storages.some(s=>s.id===plan.storageId))state.selectedStorage=plan.storageId;
  state.optimizeGoal=plan.goal||state.optimizeGoal;
  state.enableStacking=plan.stacking ?? layoutUsesStacking(plan.layout);
  if(plan.settings){
    state.clearanceEnabled=!!plan.settings.clearanceEnabled;
    state.clearance=Math.max(0,Number(plan.settings.clearance)||0);
    state.fitTolerance=Math.max(0,Number(plan.settings.fitTolerance)||0);
    state.uprightOnly=plan.settings.uprightOnly!==false;
  }
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  renderAll();
  layouts=[plan.layout.map(q=>({...q}))];
  selectedLayout=0;selectedGap=-1;currentGaps=[];galleryWasCapped=false;
  const sz=currentUsableSize();if(!sz)return;
  renderGallery(sz.W,sz.D,sz.H,false);renderDetail(sz.W,sz.D,sz.H);openDetailModal();
}
function renderSavedPlans(){
  const sec=$("savedPlansSection"),el=$("savedPlans");
  comparePlanIds=new Set([...comparePlanIds].filter(id=>state.savedPlans.some(p=>p.id===id)));
  if(!state.savedPlans.length){
    sec.style.display="none";el.innerHTML="";state.chosenPlanIds={};state.installedPlanIds={};state.installOrder=[];comparePlanIds.clear();updateCompareButton();renderInstallDashboard();renderHomeProcurement();return;
  }
  sec.style.display="block";
  $("savedPlansCount").textContent=`${state.savedPlans.length} saved`;
  el.innerHTML=state.savedPlans.map(p=>{
    const m=planMetrics(p),counts=layoutCounts(p.layout||[]),contents=labeledPlacements(p.layout||[]);
    const summary=Object.entries(counts).map(([id,n])=>`${esc(boxById(id)?.name||"Item")} ×${n}`).join(" · ");
    const chosen=isPlanChosen(p),selected=comparePlanIds.has(p.id),health=planHealth(p);
    return `<div class="savedcard ${chosen?"chosen":""} ${health.status!=="current"?health.status:""}">
      <div class="savedhead">
        <div>
          <div class="savedname">${esc(p.name)}${chosen?'<span class="chosenbadge">Chosen</span>':""}${health.status!=="current"?`<span class="planhealth ${health.status}">${health.status==="review"?"Review":"Invalid"}</span>`:""}</div>
          <div class="savedmeta">${esc(m.storagePath)} · ${m.itemCount} item${m.itemCount===1?"":"s"} · ${m.utilizationPct.toFixed(1)}% ${esc(m.utilizationKind)}</div>
          <span class="goallabel">${esc(goalLabel(p.goal))}</span>
        </div>
        <label class="savedselect"><input type="checkbox" data-compare-plan="${p.id}" ${selected?"checked":""}> compare</label>
      </div>
      <div class="small" style="margin-top:8px">${summary||"Saved layout"}</div>
      ${contents.length?`<div class="savedmeta" style="margin-top:5px">Contents: ${contents.slice(0,4).map(x=>esc(x.label)).join(" · ")}${contents.length>4?` · +${contents.length-4} more`:""}</div>`:""}
      <div class="savedmeta" style="margin-top:6px">To buy: ${esc(m.cost)}${m.ownedUsed?` · ${m.ownedUsed} owned used`:""}${m.stackedCount?` · ${m.stackedCount} stacked`:""}</div>
      ${health.status!=="current"?`<div class="planissues">${health.reasons.slice(0,3).map(esc).join(" · ")}</div>`:""}
      ${p.note?`<div class="savednote">${esc(p.note)}</div>`:""}
      <div class="savedactions">
        <button class="btn soft" type="button" data-open-plan="${p.id}">Open</button>
        <button class="btn soft" type="button" data-rename-plan="${p.id}">Rename</button>
        <button class="btn soft" type="button" data-note-plan="${p.id}">${p.note?"Edit note":"Add note"}</button>
        ${health.canRevalidate?`<button class="btn soft" type="button" data-revalidate-plan="${p.id}">Revalidate</button>`:""}
        <button class="btn ${chosen?"primary":"soft"}" type="button" data-choose-plan="${p.id}" ${!chosen&&health.status!=="current"?"disabled":""}>${chosen?"Chosen here ✓":"Choose"}</button>
        <button class="btn danger" type="button" data-delete-plan="${p.id}">Delete</button>
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll("[data-compare-plan]").forEach(input=>input.addEventListener("change",()=>{
    const id=input.dataset.comparePlan;
    if(input.checked){
      if(comparePlanIds.size>=3){input.checked=false;alert("You can compare up to 3 plans at a time.");return}
      comparePlanIds.add(id);
    }else comparePlanIds.delete(id);
    updateCompareButton();
  }));
  el.querySelectorAll("[data-open-plan]").forEach(btn=>btn.addEventListener("click",()=>openSavedPlan(btn.dataset.openPlan)));
  el.querySelectorAll("[data-rename-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    const plan=state.savedPlans.find(p=>p.id===btn.dataset.renamePlan);if(!plan)return;
    const name=prompt("Plan name",plan.name);if(name===null)return;
    plan.name=name.trim()||plan.name;localStorage.setItem(KEY,JSON.stringify(state));renderSavedPlans();
  }));
  el.querySelectorAll("[data-note-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    const plan=state.savedPlans.find(p=>p.id===btn.dataset.notePlan);if(!plan)return;
    const note=prompt("Plan note",plan.note||"");if(note===null)return;
    plan.note=note.trim();localStorage.setItem(KEY,JSON.stringify(state));renderSavedPlans();
  }));
  el.querySelectorAll("[data-revalidate-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    const plan=state.savedPlans.find(p=>p.id===btn.dataset.revalidatePlan);if(!plan||!revalidatePlan(plan))return;
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderSavedPlans();
  }));
  el.querySelectorAll("[data-choose-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    toggleChosenPlan(btn.dataset.choosePlan);
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderSavedPlans();renderHomeProcurement();
  }));
  el.querySelectorAll("[data-delete-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=btn.dataset.deletePlan,deleted=state.savedPlans.find(p=>p.id===id);
    createRecoveryCheckpoint(`Before deleting saved plan “${deleted?.name||"Plan"}”`);
    state.savedPlans=state.savedPlans.filter(p=>p.id!==id);
    comparePlanIds.delete(id);
    if(deleted&&state.chosenPlanIds?.[deleted.storageId]===id)delete state.chosenPlanIds[deleted.storageId];
    normalizeInstallState(state);
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderSavedPlans();renderInstallDashboard();renderHomeProcurement();updateSavePlanButton();
  }));
  updateCompareButton();renderInstallDashboard();renderHomeProcurement();
}
function updateSavePlanButton(){
  const saved=currentPlanSaved();
  $("savePlanBtn").textContent=saved?"Saved ✓":"Save plan";
  $("savePlanBtn").classList.toggle("active",saved);
  updateApplyMatchingButton();
}

function resetResults(){
  layouts=[];selectedLayout=0;currentGaps=[];selectedGap=-1;galleryWasCapped=false;closeDetailModal();closeCompareModal();
  $("resultLabel").textContent="—";$("layoutCount").textContent="—";$("bestFill").textContent="—";$("searchState").textContent="Ready";
  $("message").className="message";$("message").textContent="Select the item types you want to use, then find arrangements.";
  $("gallerySection").style.display="none";$("detailSection").style.display="";
  const n=selectedBoxes().length;$("searchNote").textContent=n?`${n} item type${n===1?"":"s"} selected.`:"Select at least one item type.";
}

function orientations(item,forceUpright=state.uprightOnly){
  const uprightOnly=forceUpright || item.uprightOnly!==false,locked=!!item.floorRotationLocked;
  const raw=uprightOnly
    ? (locked?[[item.w,item.d,item.h]]:[[item.w,item.d,item.h],[item.d,item.w,item.h]])
    : (locked
      ? [[item.w,item.d,item.h],[item.w,item.h,item.d],[item.h,item.d,item.w]]
      : [[item.w,item.d,item.h],[item.w,item.h,item.d],[item.d,item.w,item.h],[item.d,item.h,item.w],[item.h,item.w,item.d],[item.h,item.d,item.w]]);
  const seen=new Set();return raw.filter(o=>{const k=o.join("|");if(seen.has(k))return false;seen.add(k);return true});
}
function overlap(a,b,gap=0){return !(a.x+a.w+gap<=b.x || b.x+b.w+gap<=a.x || a.y+a.d+gap<=b.y || b.y+b.d+gap<=a.y)}
function zOverlap(a,b){const az=Number(a.z)||0,bz=Number(b.z)||0;return !(az+a.h<=bz+1e-9 || bz+b.h<=az+1e-9)}
function overlap3D(a,b,gap=0){return overlap(a,b,gap)&&zOverlap(a,b)}
function footprintContains(base,p){
  return p.x>=base.x-1e-9&&p.y>=base.y-1e-9&&p.x+p.w<=base.x+base.w+1e-9&&p.y+p.d<=base.y+base.d+1e-9;
}
function supportingBaseFor(p,placed){
  const z=Number(p.z)||0;if(z<=1e-9)return null;
  return placed.find(base=>{
    const rule=boxById(base.typeId);
    return !!rule?.canSupportStack && Math.abs((Number(base.z)||0)+base.h-z)<=1e-9 && footprintContains(base,p);
  })||null;
}
function placementStackLevel(p,placed){
  let current=p,level=1;
  const seen=new Set();
  while((Number(current.z)||0)>1e-9){
    const base=supportingBaseFor(current,placed);
    if(!base||seen.has(base))return Infinity;
    seen.add(base);level++;current=base;
  }
  return level;
}
function maxStackLevelAllows(type,level){
  return !type?.maxStackLevel || level<=type.maxStackLevel;
}
function placementSupported(p,placed,type){
  const z=Number(p.z)||0;
  if(z<=1e-9)return true;
  if(!state.enableStacking||!type?.canBeStacked||!supportingBaseFor(p,placed))return false;
  const level=placementStackLevel(p,placed);
  return maxStackLevelAllows(type,level);
}
function dividerRectsForStorage(S){
  if(!S)return [];
  return (S.dividers||[]).map(d=>{
    const thickness=Math.max(0.01,Number(d.thickness)||0.5),h=Math.max(0.01,Math.min(Number(d.h)||S.h,S.h));
    if(d.orientation==="horizontal"){
      const center=Math.min(Math.max(0,Number(d.position)||0),S.d);
      const y1=Math.max(0,center-thickness/2),y2=Math.min(S.d,center+thickness/2);
      return {id:d.id,name:"Divider",kind:"divider",z:0,x:0,y:y1,w:S.w,d:Math.max(0,y2-y1),h};
    }
    const center=Math.min(Math.max(0,Number(d.position)||0),S.w);
    const x1=Math.max(0,center-thickness/2),x2=Math.min(S.w,center+thickness/2);
    return {id:d.id,name:"Divider",kind:"divider",z:0,x:x1,y:0,w:Math.max(0,x2-x1),d:S.d,h};
  });
}
function physicalObstaclesForStorage(S){
  if(!S)return [];
  const blocked=(S.obstacles||[]).map(o=>({...o,kind:"blocked",z:0}));
  return [...blocked,...dividerRectsForStorage(S)];
}
function rawObstacles(){
  return physicalObstaclesForStorage(storage());
}
function usableObstaclesFor(S,clearance=0){
  if(!S)return [];
  const c=Math.max(0,Number(clearance)||0),W=S.w-2*c,D=S.d-2*c,H=S.h-2*c;
  return physicalObstaclesForStorage(S).map(o=>({
    id:o.id,name:o.name||(o.kind==="divider"?"Divider":"Blocked zone"),kind:o.kind||"blocked",z:0,
    x:Math.max(0,(Number(o.x)||0)-c),
    y:Math.max(0,(Number(o.y)||0)-c),
    w:Math.max(0,Math.min(Number(o.w)||0,W-Math.max(0,(Number(o.x)||0)-c))),
    d:Math.max(0,Math.min(Number(o.d)||0,D-Math.max(0,(Number(o.y)||0)-c))),
    h:Math.max(0,Math.min(Number(o.h)||H,H))
  })).filter(o=>o.w>0&&o.d>0&&o.x<W&&o.y<D);
}
function usableObstacles(){
  const S=storage(),c=state.clearanceEnabled?Math.max(0,state.clearance||0):0;
  return usableObstaclesFor(S,c);
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
  return placed.slice().sort((a,b)=>a.typeId.localeCompare(b.typeId)||((a.z||0)-(b.z||0))||a.x-b.x||a.y-b.y||a.w-b.w||a.d-b.d)
    .map(p=>`${p.typeId}:${round6(p.x)},${round6(p.y)},${round6(p.z||0)},${round6(p.w)},${round6(p.d)},${round6(p.h)}`).join(";");
}
function canonicalPlanLayout(placed){
  return placed.slice().sort((a,b)=>a.typeId.localeCompare(b.typeId)||((a.z||0)-(b.z||0))||a.x-b.x||a.y-b.y||a.w-b.w||a.d-b.d)
    .map(p=>`${p.typeId}:${round6(p.x)},${round6(p.y)},${round6(p.z||0)},${round6(p.w)},${round6(p.d)},${round6(p.h)}:${encodeURIComponent(String(p.label||"").trim())}`).join(";");
}
function occupiedArea(layout){return layout.filter(p=>(Number(p.z)||0)<=1e-9).reduce((s,p)=>s+p.w*p.d,0)}
function occupiedVolume(layout){return layout.reduce((s,p)=>s+p.w*p.d*p.h,0)}
function usableVolume(W,D,H,obstacles=usableObstacles()){
  const xs=[0,W],ys=[0,D],zs=[0,H];
  for(const o of obstacles){
    xs.push(Math.max(0,o.x),Math.min(W,o.x+o.w));
    ys.push(Math.max(0,o.y),Math.min(D,o.y+o.d));
    zs.push(0,Math.min(H,o.h));
  }
  const X=[...new Set(xs)].sort((a,b)=>a-b),Y=[...new Set(ys)].sort((a,b)=>a-b),Z=[...new Set(zs)].sort((a,b)=>a-b);
  let free=0;
  for(let xi=0;xi<X.length-1;xi++)for(let yi=0;yi<Y.length-1;yi++)for(let zi=0;zi<Z.length-1;zi++){
    const x1=X[xi],x2=X[xi+1],y1=Y[yi],y2=Y[yi+1],z1=Z[zi],z2=Z[zi+1];
    if(x2<=x1||y2<=y1||z2<=z1)continue;
    const mx=(x1+x2)/2,my=(y1+y2)/2,mz=(z1+z2)/2;
    if(!obstacles.some(o=>mx>=o.x&&mx<o.x+o.w&&my>=o.y&&my<o.y+o.d&&mz>=0&&mz<o.h))free+=(x2-x1)*(y2-y1)*(z2-z1);
  }
  return Math.max(0,free);
}
function layoutUsesStacking(layout){return layout.some(p=>(Number(p.z)||0)>1e-9)}
function utilization(layout,W,D,H=currentUsableSize()?.H||1){
  if(state.enableStacking||layoutUsesStacking(layout))return occupiedVolume(layout)/Math.max(1e-9,usableVolume(W,D,H));
  return occupiedArea(layout)/Math.max(1e-9,freeFloorArea(W,D,usableObstacles()));
}
function utilizationNoun(layout){return (state.enableStacking||layoutUsesStacking(layout))?"usable volume":"usable floor"}
function forbiddenRects(layout,W,D){
  const gap=Math.max(0,state.fitTolerance||0);
  const rects=[];
  for(const p of layout){
    if((Number(p.z)||0)>1e-9)continue;
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
function validPlacement(p,placed,type,W,D,H,obstacles,gap){
  const z=Number(p.z)||0;
  if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9||z<0||z+p.h>H+1e-9)return false;
  if(obstacles.some(o=>overlap3D(p,o,gap)))return false;
  if(placed.some(q=>overlap3D(p,q,gap)))return false;
  return placementSupported(p,placed,type);
}
function candidatePlacementsFor(placed,type,o,W,D,H,obstacles,gap){
  const out=[],seen=new Set();
  const push=p=>{
    const key=`${round6(p.x)}|${round6(p.y)}|${round6(p.z||0)}`;
    if(seen.has(key)||!validPlacement(p,placed,type,W,D,H,obstacles,gap))return;
    seen.add(key);out.push(p);
  };

  const floorPlaced=placed.filter(p=>(Number(p.z)||0)<=1e-9);
  for(const [x,y] of candidatePointsFor(floorPlaced,obstacles,o[0],o[1],gap)){
    push({typeId:type.id,name:type.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]});
  }

  if(state.enableStacking&&type.canBeStacked){
    for(const base of placed){
      const baseRule=boxById(base.typeId);
      if(!baseRule?.canSupportStack)continue;
      const z=round6((Number(base.z)||0)+base.h);
      if(z+o[2]>H+1e-9||o[0]>base.w+1e-9||o[1]>base.d+1e-9)continue;
      const xs=new Set([base.x,round6(base.x+base.w-o[0])]);
      const ys=new Set([base.y,round6(base.y+base.d-o[1])]);
      for(const q of placed){
        if(Math.abs((Number(q.z)||0)-z)>1e-9)continue;
        if(q.x>=base.x-1e-9&&q.y>=base.y-1e-9&&q.x+q.w<=base.x+base.w+1e-9&&q.y+q.d<=base.y+base.d+1e-9){
          xs.add(round6(q.x+q.w+gap));ys.add(round6(q.y+q.d+gap));
          xs.add(round6(q.x-o[0]-gap));ys.add(round6(q.y-o[1]-gap));
        }
      }
      for(const y of [...ys])for(const x of [...xs]){
        const p={typeId:type.id,name:type.name,x:round6(x),y:round6(y),z,w:o[0],d:o[1],h:o[2]};
        if(footprintContains(base,p))push(p);
      }
    }
  }
  return out;
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
    oris:orientations(b,state.uprightOnly).filter(o=>o[0]+2*gap<=W&&o[1]+2*gap<=D&&o[2]<=H+1e-9)
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
        for(const p of candidatePlacementsFor(placed,t,o,W,D,H,obstacles,gap)){
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
    grouped.get(sig).push(layout);
  }
  for(const variants of grouped.values())variants.sort((a,b)=>compareLayoutsForGoal(a,b,W,D));

  layouts=[...grouped.values()].flatMap(variants=>variants.slice(0,4));
  layouts.sort((a,b)=>compareLayoutsForGoal(a,b,W,D) || countSignature(a).localeCompare(countSignature(b)));

  if(layouts.length>LAYOUT_LIMIT){
    layouts=layouts.slice(0,LAYOUT_LIMIT);
    truncated=true;
  }

  $("resultLabel").textContent=layouts.length?"Fits":"No layout";
  $("layoutCount").textContent=String(layouts.length);
  $("bestFill").textContent=layouts.length?`${(utilization(layouts[0],W,D,H)*100).toFixed(1)}%`:"0%";
  $("searchState").textContent=truncated?"Capped":"Complete";

  if(rejected.length){
    showMessage(`${layouts.length} distinct proposal${layouts.length===1?"":"s"} found. ${rejected.map(x=>x.name).join(", ")} cannot fit at all and was excluded.${truncated?" Results are capped.":""}`,"warn");
  }else{
    const costNote=state.optimizeGoal==="cost"?"Owned quantities reduce purchases; unpriced purchases are treated conservatively. Different currencies are not converted. ":"";
    const frontCount=selected.filter(b=>b.frontPriority).length;
    const handlingNote=(state.optimizeGoal==="access"||frontCount)?`Access ranking active${frontCount?` for ${frontCount} front-priority item type${frontCount===1?"":"s"}`:""}. `:"";
    const blockedCount=obstacles.filter(o=>o.kind!=="divider").length,dividerCount=obstacles.filter(o=>o.kind==="divider").length;
    const constraintNote=[
      blockedCount?`${blockedCount} blocked zone${blockedCount===1?"":"s"} avoided`:"",
      dividerCount?`${dividerCount} divider${dividerCount===1?"":"s"} respected`:""
    ].filter(Boolean).join(" · ");
    showMessage(`${layouts.length} distinct proposal${layouts.length===1?"":"s"} found. ${costNote}${handlingNote}Unlimited items are used only while they improve a maximal layout; Max limits are respected. ${state.enableStacking?"Stacking rules enabled. ":""}${constraintNote?`${constraintNote}. `:""}${gap>0?`Minimum gap: ${fmt(gap)} ${state.unit}. `:"Exact-fit mode. "}${truncated?"Results are capped to keep the browser responsive.":""}`,"good");
  }
  selectedLayout=0;selectedGap=-1;currentGaps=[];
  editMode=false;
  renderGallery(W,D,H,truncated);
}

function distinctTypes(layout){
  return new Set(layout.map(p=>p.typeId)).size;
}
function proposalTags(layout,W,D,H=currentUsableSize()?.H||1){
  if(!layouts.length)return [];
  const fill=utilization(layout,W,D,H);
  const bestFill=Math.max(...layouts.map(l=>utilization(l,W,D,H)));
  const mostItems=Math.max(...layouts.map(l=>l.length));
  const minTypes=Math.min(...layouts.map(l=>distinctTypes(l)));
  const maxTypes=Math.max(...layouts.map(l=>distinctTypes(l)));
  const tags=[];
  if(Math.abs(fill-bestFill)<1e-9) tags.push("Best fill");
  if(layout.length===mostItems) tags.push("Most compartments");
  if(distinctTypes(layout)===minTypes) tags.push("Simplest setup");
  if(maxTypes>1 && distinctTypes(layout)===maxTypes) tags.push("Most mixed");
  if(state.optimizeGoal==="cost" && layouts.length){
    const cheapest=layouts.reduce((best,l)=>comparePurchaseCost(l,best,W,D)<0?l:best,layouts[0]);
    if(comparePurchaseCost(layout,cheapest,W,D)===0)tags.push("Least to buy");
  }
  if(layout.some(p=>boxById(p.typeId)?.frontPriority) && layouts.length){
    const easiest=Math.min(...layouts.map(l=>accessPenalty(l,D)));
    if(Math.abs(accessPenalty(layout,D)-easiest)<1e-9)tags.push("Easy reach");
  }
  if(layoutUsesStacking(layout)) tags.push("Uses stacking");
  return tags.slice(0,3);
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
    <div class="layoutmeta"><div><strong>Layout ${i+1}</strong>${i===0?`<span class="proposalbadge">${esc(goalLabel())}</span>`:""}${proposalTags(layout,W,D,H).map(t=>`<span class="proposalbadge">${t}</span>`).join(" ")}</div><span>${(utilization(layout,W,D,H)*100).toFixed(1)}% ${utilizationNoun(layout)}</span></div>
    ${svgTop(layout,W,D,360,210,false)}
    <div class="legend">${legendHtml(layout)}</div>
    <div class="savedmeta" style="margin-top:7px">To buy: ${esc(totalsText(layout))}</div>
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
  const bad=new Set(),gap=Math.max(0,state.fitTolerance||0),obstacles=usableObstacles(),H=currentUsableSize()?.H||Infinity;
  for(let i=0;i<layout.length;i++){
    const p=layout[i],others=layout.filter((_,j)=>j!==i),type=boxById(p.typeId);
    if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9||(p.z||0)<0||(p.z||0)+p.h>H+1e-9)bad.add(i);
    if(obstacles.some(o=>overlap3D(p,o,gap)))bad.add(i);
    if(!placementSupported(p,others,type))bad.add(i);
    for(let j=i+1;j<layout.length;j++){
      if(overlap3D(p,layout[j],gap)){bad.add(i);bad.add(j)}
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
  const gridStep=normalizeSnapStep(state.editSnapStep),gridPx=gridStep*g.scale;
  const grid=editable&&state.editShowGrid&&gridPx>=2
    ? `<defs><pattern id="edit-grid" x="${g.ox}" y="${g.oy}" width="${gridPx}" height="${gridPx}" patternUnits="userSpaceOnUse"><path d="M ${gridPx} 0 L 0 0 0 ${gridPx}" fill="none" stroke="#88929a" stroke-opacity=".18" stroke-width="1"/></pattern></defs><rect x="${g.ox}" y="${g.oy}" width="${W*g.scale}" height="${D*g.scale}" fill="url(#edit-grid)" pointer-events="none"/>`
    : "";
  const obstacleRects=obstacles.map(o=>{
    const divider=o.kind==="divider",color=divider?"#416b8e":"#b23c3c",textColor=divider?"#31536f":"#8b2e2e";
    if(divider)return `<g>
      <rect x="${g.ox+o.x*g.scale}" y="${g.oy+o.y*g.scale}" width="${o.w*g.scale}" height="${o.d*g.scale}" fill="${color}" fill-opacity=".32" stroke="${color}" stroke-width="1.7"/>
      ${labels?`<text x="${g.ox+(o.x+o.w/2)*g.scale}" y="${g.oy+(o.y+o.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="9" fill="${textColor}">divider</text>`:""}
    </g>`;
    return `<g>
      <defs><pattern id="hatch-${o.id}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${color}" stroke-opacity=".45" stroke-width="3"/></pattern></defs>
      <rect x="${g.ox+o.x*g.scale}" y="${g.oy+o.y*g.scale}" width="${o.w*g.scale}" height="${o.d*g.scale}" fill="url(#hatch-${o.id})" stroke="${color}" stroke-width="1.7"/>
      ${labels?`<text x="${g.ox+(o.x+o.w/2)*g.scale}" y="${g.oy+(o.y+o.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="${textColor}">blocked</text>`:""}
    </g>`;
  }).join("");
  const rects=layout.map((p,idx)=>({p,idx})).sort((a,b)=>(a.p.z||0)-(b.p.z||0)).map(({p,idx})=>{
    const invalid=bad.has(idx),active=idx===selected;
    const stroke=invalid?"#b23c3c":active?"#111":colorFor(p.typeId);
    const fill=invalid?"#b23c3c":colorFor(p.typeId);
    const sw=active?3:invalid?2.5:1.7;
    return `<g data-item="${editable?idx:""}" style="${editable?"cursor:move":""}">
      <rect data-item="${editable?idx:""}" x="${g.ox+p.x*g.scale}" y="${g.oy+p.y*g.scale}" width="${p.w*g.scale}" height="${p.d*g.scale}" rx="3" fill="${fill}" fill-opacity="${invalid?".28":".34"}" stroke="${stroke}" stroke-width="${sw}"/>
      ${labels?`<text data-item="${editable?idx:""}" x="${g.ox+(p.x+p.w/2)*g.scale}" y="${g.oy+(p.y+p.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#222" pointer-events="${editable?"auto":"none"}">${esc(shortName(placementDisplayName(p,idx)))}${(p.z||0)>0?` ↑${fmt(p.z)}${state.unit}`:""}</text>`:""}
    </g>`;
  }).join("");
  const gapMark=highlightGap?`<rect x="${g.ox+highlightGap.x*g.scale}" y="${g.oy+highlightGap.y*g.scale}" width="${highlightGap.w*g.scale}" height="${highlightGap.d*g.scale}" fill="#166c45" fill-opacity=".08" stroke="#166c45" stroke-width="3" stroke-dasharray="8 5"/><text x="${g.ox+(highlightGap.x+highlightGap.w/2)*g.scale}" y="${g.oy+(highlightGap.y+highlightGap.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="#166c45">${fmt(highlightGap.w)} × ${fmt(highlightGap.d)} ${esc(state.unit)}</text>`:"";
  return `<svg class="preview" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top view"><rect x="${g.ox}" y="${g.oy}" width="${W*g.scale}" height="${D*g.scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${grid}${obstacleRects}${gapMark}${rects}</svg>`;
}
function shortName(s){return s.length>12?s.slice(0,10)+"…":s}
function placementLabel(p){return String(p?.label||"").trim().slice(0,60)}
function placementDisplayName(p,index=0){
  return placementLabel(p)||boxById(p?.typeId)?.name||String(index+1);
}
function labeledPlacements(layout){
  return (layout||[]).map((p,index)=>({
    index,label:placementLabel(p),itemName:boxById(p.typeId)?.name||p.typeId,
    x:p.x,y:p.y,z:Number(p.z)||0
  })).filter(x=>x.label);
}
function svgFront(layout,W,H,width=760,height=390){
  const pad=28,scale=Math.min((width-2*pad)/W,(height-2*pad)/H),ox=(width-W*scale)/2,oy=(height-H*scale)/2;
  const obstacles=usableObstacles();
  const obs=obstacles.map(o=>{
    const divider=o.kind==="divider",color=divider?"#416b8e":"#b23c3c";
    return `<rect x="${ox+o.x*scale}" y="${oy+(H-o.h)*scale}" width="${o.w*scale}" height="${o.h*scale}" fill="${color}" fill-opacity="${divider?".24":".12"}" stroke="${color}" ${divider?"":'stroke-dasharray="5 4"'} stroke-width="1.5"/>`;
  }).join("");
  const sorted=layout.slice().sort((a,b)=>b.y-a.y||a.x-b.x);
  const rects=sorted.map(p=>`<rect x="${ox+p.x*scale}" y="${oy+(H-(p.z||0)-p.h)*scale}" width="${p.w*scale}" height="${p.h*scale}" rx="2" fill="${colorFor(p.typeId)}" fill-opacity=".28" stroke="${colorFor(p.typeId)}" stroke-width="1.5"/>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Front view"><rect x="${ox}" y="${oy}" width="${W*scale}" height="${H*scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${obs}${rects}</svg>`;
}
function svgSide(layout,D,H,width=760,height=390){
  const pad=28,scale=Math.min((width-2*pad)/D,(height-2*pad)/H),ox=(width-D*scale)/2,oy=(height-H*scale)/2;
  const obstacles=usableObstacles();
  const obs=obstacles.map(o=>{
    const divider=o.kind==="divider",color=divider?"#416b8e":"#b23c3c";
    return `<rect x="${ox+o.y*scale}" y="${oy+(H-o.h)*scale}" width="${o.d*scale}" height="${o.h*scale}" fill="${color}" fill-opacity="${divider?".24":".12"}" stroke="${color}" ${divider?"":'stroke-dasharray="5 4"'} stroke-width="1.5"/>`;
  }).join("");
  const sorted=layout.slice().sort((a,b)=>b.x-a.x||a.y-b.y);
  const rects=sorted.map(p=>`<rect x="${ox+p.y*scale}" y="${oy+(H-(p.z||0)-p.h)*scale}" width="${p.d*scale}" height="${p.h*scale}" rx="2" fill="${colorFor(p.typeId)}" fill-opacity=".28" stroke="${colorFor(p.typeId)}" stroke-width="1.5"/>`).join("");
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
  const divider=o.kind==="divider",c=divider?"#416b8e":"#b23c3c";
  return poly([A,B,F,E],c,c,divider?.20:.10)+poly([B,C,G,F],c,c,divider?.24:.14)+poly([E,F,G,H],c,c,divider?.30:.18);
}
function cuboidSvg(p,P){
  const z=Number(p.z)||0;
  const A=P(p.x,p.y,z),B=P(p.x+p.w,p.y,z),C=P(p.x+p.w,p.y+p.d,z),D=P(p.x,p.y+p.d,z);
  const E=P(p.x,p.y,z+p.h),F=P(p.x+p.w,p.y,z+p.h),G=P(p.x+p.w,p.y+p.d,z+p.h),H=P(p.x,p.y+p.d,z+p.h);
  const c=colorFor(p.typeId);
  return poly([A,B,F,E],c,c,.18)+poly([B,C,G,F],c,c,.24)+poly([E,F,G,H],c,c,.34);
}
function svgIso(layout,W,D,H,width=760,height=430){
  const P=isoTransform(W,D,H,width,height);
  const sorted=layout.slice().sort((a,b)=>{
    const ac=isoCameraRaw(a.x+a.w/2,a.y+a.d/2,(a.z||0)+a.h/2,W,D,H)[1];
    const bc=isoCameraRaw(b.x+b.w/2,b.y+b.d/2,(b.z||0)+b.h/2,W,D,H)[1];
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
  const stackedCount=layout.filter(p=>(p.z||0)>1e-9).length;
  $("detailSubtitle").textContent=`${(utilization(layout,W,D,H)*100).toFixed(1)}% ${utilizationNoun(layout)} utilization · ${layout.length} item${layout.length===1?"":"s"}${stackedCount?` · ${stackedCount} stacked`:""}.`;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===detailView));
  $("reset3d").disabled=detailView!=="iso";
  $("editLayoutBtn").textContent=editMode?"Editing":"Edit layout";
  $("editBar").classList.toggle("active",editMode);
  const labelInput=$("placementLabel"),selectedPlacement=selectedEditItem>=0?layout[selectedEditItem]:null;
  labelInput.disabled=!editMode||!selectedPlacement;
  labelInput.value=selectedPlacement?placementLabel(selectedPlacement):"";
  labelInput.placeholder=selectedPlacement?"e.g. Socks":"Select a box, e.g. Socks";
  $("editSnapStep").value=String(round6(normalizeSnapStep(state.editSnapStep)));
  $("editSnapUnit").textContent=state.unit;
  $("editShowGrid").checked=state.editShowGrid!==false;
  updateEditHistoryControls();
  const selectedType=selectedPlacement?boxById(selectedPlacement.typeId):null;
  $("moveItemFloor").disabled=!editMode||!selectedPlacement||(Number(selectedPlacement.z)||0)<=1e-9;
  $("stackItem").disabled=!editMode||!selectedPlacement||!state.enableStacking||!selectedType?.canBeStacked;
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
    const stacked=ps.filter(p=>(p.z||0)>1e-9).length;
    return `<li><strong>${esc(b?.name||id)} ×${n}</strong> — ${os.join(", ")} ${esc(state.unit)}${stacked?` · ${stacked} stacked`:""}</li>`;
  }).join("");
  const labels=labeledPlacements(layout);
  $("layoutLabels").innerHTML=labels.length?labels.map(x=>`<div class="placementlabelrow"><span class="n">${x.index+1}</span><div><strong>${esc(x.label)}</strong><span>${esc(x.itemName)}</span></div></div>`).join(""):'<div class="empty">No placement labels yet. Use Edit layout and select a box.</div>';

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
function cloneLayoutSnapshot(layout){return (layout||[]).map(p=>({...p}))}
function editHistoryKey(layout){return JSON.stringify(cloneLayoutSnapshot(layout))}
function makeEditHistory(layout){return {entries:[{layout:cloneLayoutSnapshot(layout),label:"Start"}],index:0}}
function appendEditHistoryState(history,layout,label="",limit=EDIT_HISTORY_LIMIT){
  const base=history&&Array.isArray(history.entries)?history:{entries:[],index:-1};
  const current=base.entries[base.index]?.layout;
  if(current&&editHistoryKey(current)===editHistoryKey(layout))return base;
  let entries=base.entries.slice(0,Math.max(0,base.index+1));
  entries.push({layout:cloneLayoutSnapshot(layout),label:String(label||"Edit").slice(0,80)});
  const cap=Math.max(2,Math.floor(Number(limit)||EDIT_HISTORY_LIMIT));
  if(entries.length>cap)entries=entries.slice(entries.length-cap);
  return {entries,index:entries.length-1};
}
function stepEditHistoryState(history,delta){
  const base=history&&Array.isArray(history.entries)?history:{entries:[],index:-1};
  const next=base.index+(delta<0?-1:1);
  if(next<0||next>=base.entries.length)return {history:base,layout:null,label:"",moved:false};
  return {history:{entries:base.entries,index:next},layout:cloneLayoutSnapshot(base.entries[next].layout),label:base.entries[next].label||"Edit",moved:true};
}
function updateEditHistoryControls(){
  const undo=$("undoEdit"),redo=$("redoEdit");if(!undo||!redo)return;
  undo.disabled=!editMode||editHistory.index<=0;
  redo.disabled=!editMode||editHistory.index<0||editHistory.index>=editHistory.entries.length-1;
}
function resetEditHistory(layout){editHistory=makeEditHistory(layout);updateEditHistoryControls()}
function recordEditHistory(label){
  if(!editMode)return;
  editHistory=appendEditHistoryState(editHistory,selectedManualLayout(),label);updateEditHistoryControls();
}
function moveEditHistory(delta){
  if(!editMode)return false;
  const fromLabel=editHistory.entries[editHistory.index]?.label||"Edit",step=stepEditHistoryState(editHistory,delta);
  if(!step.moved)return false;
  editHistory=step.history;layouts[selectedLayout]=step.layout;
  if(selectedEditItem>=step.layout.length)selectedEditItem=-1;
  selectedGap=-1;topDrag=null;updateSavePlanButton();updateEditHistoryControls();
  setEditStatus((delta<0?"Undo: "+fromLabel:"Redo: "+step.label)+".");
  refreshCurrentDetail();return true;
}
function mirrorLayoutGeometry(layout,W,D,axis){
  const width=Math.max(0,Number(W)||0),depth=Math.max(0,Number(D)||0);
  if(!Array.isArray(layout)||!["x","y"].includes(axis))return [];
  return layout.map(p=>({
    ...p,
    x:axis==="x"?round6(width-(Number(p.x)||0)-(Number(p.w)||0)):round6(Number(p.x)||0),
    y:axis==="y"?round6(depth-(Number(p.y)||0)-(Number(p.d)||0)):round6(Number(p.y)||0)
  }));
}
function mirrorCurrentLayout(axis){
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz)return false;
  const mirrored=mirrorLayoutGeometry(layout,sz.W,sz.D,axis);
  if(invalidEditIndices(mirrored,sz.W,sz.D).size){
    setEditStatus(axis==="x"
      ?"Mirror rejected: the left/right reflection collides with current constraints or support rules."
      :"Mirror rejected: the front/back reflection collides with current constraints or support rules.",true);
    return false;
  }
  layouts[selectedLayout]=mirrored;
  selectedGap=-1;updateSavePlanButton();
  setEditStatus(axis==="x"?"Mirrored left ↔ right.":"Mirrored front ↔ back.");
  refreshCurrentDetail();return true;
}
function defaultEditSnapStep(unit){
  return unit==="mm"?5:unit==="in"?0.2:0.5;
}
function normalizeSnapStep(value){
  const n=Number(value);
  return Math.max(0.01,Math.min(10000,Number.isFinite(n)&&n>0?n:defaultEditSnapStep(state.unit)));
}
function snapValue(value,step=state.editSnapStep){
  const s=normalizeSnapStep(step);
  return round6(Math.round((Number(value)||0)/s)*s);
}
function editItemValid(layout,index,W,D){
  if(index<0||index>=layout.length)return false;
  const p=layout[index],gap=Math.max(0,state.fitTolerance||0),obstacles=usableObstacles(),H=currentUsableSize()?.H||Infinity;
  const others=layout.filter((_,i)=>i!==index),type=boxById(p.typeId);
  if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9||(p.z||0)<0||(p.z||0)+p.h>H+1e-9)return false;
  if(obstacles.some(o=>overlap3D(p,o,gap)))return false;
  if(others.some(q=>overlap3D(p,q,gap)))return false;
  if(!placementSupported(p,others,type))return false;
  return layout.every((q,i)=>{
    if(i===index||(q.z||0)<=1e-9)return true;
    return placementSupported(q,layout.filter((_,j)=>j!==i),boxById(q.typeId));
  });
}
function setEditStatus(msg,bad=false){
  $("editStatus").textContent=msg;
  $("editStatus").style.color=bad?"var(--bad)":"var(--muted)";
}
function clampSnappedValue(value,min,max,step=state.editSnapStep){
  if(max<min)return min;
  const snapped=snapValue(value,step);
  return round6(Math.max(min,Math.min(max,snapped)));
}
function manualRelocationCandidates(layout,index,target,W,D,H){
  if(!layout||index<0||index>=layout.length)return [];
  const p=layout[index],type=boxById(p.typeId),others=layout.filter((_,i)=>i!==index);
  if(!type)return [];
  const gap=Math.max(0,state.fitTolerance||0),obstacles=usableObstacles(),all=[];
  if(target==="floor")all.push({...p,z:0});
  const generated=candidatePlacementsFor(others,type,[p.w,p.d,p.h],W,D,H,obstacles,gap)
    .filter(q=>target==="stack"?(q.z||0)>1e-9:(q.z||0)<=1e-9);
  all.push(...generated);
  const seen=new Set(),unique=[];
  for(const q of all){
    const key=`${round6(q.x)}|${round6(q.y)}|${round6(q.z||0)}`;
    if(seen.has(key))continue;seen.add(key);unique.push(q);
  }
  return unique.sort((a,b)=>{
    const da=Math.abs(a.x-p.x)+Math.abs(a.y-p.y),db=Math.abs(b.x-p.x)+Math.abs(b.y-p.y);
    return da-db||Math.abs((a.z||0)-(p.z||0))-Math.abs((b.z||0)-(p.z||0));
  });
}
function relocateSelectedPlacement(target){
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz||selectedEditItem<0){setEditStatus("Select a box first.",true);return false}
  const p=layout[selectedEditItem],type=boxById(p.typeId);
  if(target==="stack"&&(!state.enableStacking||!type?.canBeStacked)){
    setEditStatus("Enable stacking and allow this item to sit on another item first.",true);return false;
  }
  const old={x:p.x,y:p.y,z:Number(p.z)||0};
  for(const q of manualRelocationCandidates(layout,selectedEditItem,target,sz.W,sz.D,sz.H)){
    p.x=q.x;p.y=q.y;p.z=Number(q.z)||0;
    if(editItemValid(layout,selectedEditItem,sz.W,sz.D)){
      selectedGap=-1;updateSavePlanButton();
      setEditStatus(target==="stack"?`Stacked at level ${placementStackLevel(p,layout.filter((_,i)=>i!==selectedEditItem))}.`:"Moved to floor.");
      refreshCurrentDetail();return true;
    }
  }
  p.x=old.x;p.y=old.y;p.z=old.z;
  setEditStatus(target==="stack"?"No valid support is available for this item.":"No valid floor position is available.",true);
  refreshCurrentDetail();return false;
}
function nudgeSelectedPlacement(dx,dy){
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||detailView!=="top"||!layout||!sz||selectedEditItem<0)return false;
  const p=layout[selectedEditItem],old={x:p.x,y:p.y},gap=Math.max(0,state.fitTolerance||0);
  p.x=clampSnappedValue(p.x+dx,gap,sz.W-p.w-gap);
  p.y=clampSnappedValue(p.y+dy,gap,sz.D-p.d-gap);
  if(!editItemValid(layout,selectedEditItem,sz.W,sz.D)){
    p.x=old.x;p.y=old.y;setEditStatus("Nudge rejected: collision, bounds, or stack support.",true);refreshCurrentDetail();return false;
  }
  selectedGap=-1;updateSavePlanButton();setEditStatus(`Moved to ${fmt(p.x)}, ${fmt(p.y)} ${state.unit}.`);refreshCurrentDetail();return true;
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
    setEditStatus("Click a box, drag it, use Arrow keys to nudge, or change its floor/stack level.");
  }
  refreshCurrentDetail();
});

$("placementLabel").addEventListener("input",()=>{
  const layout=selectedManualLayout();
  if(!editMode||!layout||selectedEditItem<0)return;
  layout[selectedEditItem].label=$("placementLabel").value.trim().slice(0,60);
  updateSavePlanButton();
  const sz=currentUsableSize();if(sz)renderDetail(sz.W,sz.D,sz.H);
});
$("placementLabel").addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();$("placementLabel").blur()}
});
$("editSnapStep").addEventListener("change",()=>{
  state.editSnapStep=normalizeSnapStep($("editSnapStep").value);
  localStorage.setItem(KEY,JSON.stringify(state));refreshCurrentDetail();
});
$("editShowGrid").addEventListener("change",()=>{
  state.editShowGrid=$("editShowGrid").checked;
  localStorage.setItem(KEY,JSON.stringify(state));refreshCurrentDetail();
});
$("moveItemFloor").addEventListener("click",()=>relocateSelectedPlacement("floor"));
$("stackItem").addEventListener("click",()=>relocateSelectedPlacement("stack"));
$("mirrorLayoutX").addEventListener("click",()=>mirrorCurrentLayout("x"));
$("mirrorLayoutY").addEventListener("click",()=>mirrorCurrentLayout("y"));

document.addEventListener("keydown",e=>{
  if(!editMode||detailView!=="top"||selectedEditItem<0)return;
  if(e.target?.closest?.("input,textarea,select,button"))return;
  const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!dir)return;
  const step=normalizeSnapStep(state.editSnapStep)*(e.shiftKey?5:1);
  e.preventDefault();nudgeSelectedPlacement(dir[0]*step,dir[1]*step);
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
  const p=layout[selectedEditItem],type=boxById(p.typeId);
  if(type?.floorRotationLocked){setEditStatus("This item keeps its floor orientation.",true);return}
  const old={w:p.w,d:p.d};
  p.w=old.d;p.d=old.w;
  if(!editItemValid(layout,selectedEditItem,sz.W,sz.D)){
    p.w=old.w;p.d=old.d;setEditStatus("That rotation would collide or leave the storage.",true);
  }else {selectedGap=-1;setEditStatus("Rotated.");}
  refreshCurrentDetail();
});

$("removeItem").addEventListener("click",()=>{
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||selectedEditItem<0||!sz){setEditStatus("Select a box first.",true);return}
  const [removed]=layout.splice(selectedEditItem,1);
  const invalid=invalidEditIndices(layout,sz.W,sz.D);
  if(invalid.size){
    layout.splice(selectedEditItem,0,removed);
    setEditStatus("Remove the items stacked above this one first.",true);
    refreshCurrentDetail();return;
  }
  selectedEditItem=-1;selectedGap=-1;setEditStatus("Item removed.");refreshCurrentDetail();
});

$("duplicateItem").addEventListener("click",()=>{
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz||selectedEditItem<0){setEditStatus("Select a box first.",true);return}
  const src=layout[selectedEditItem],max=allowedMaxFor(src.typeId);
  if(max!==null&&countType(layout,src.typeId)>=max){setEditStatus(`Maximum quantity (${max}) reached for this item.`,true);return}
  const type=boxById(src.typeId),gap=Math.max(0,state.fitTolerance||0);
  for(const p of candidatePlacementsFor(layout,type,[src.w,src.d,src.h],sz.W,sz.D,sz.H,usableObstacles(),gap)){
    p.label="";
    layout.push(p);selectedEditItem=layout.length-1;selectedGap=-1;setEditStatus((p.z||0)>0?"Duplicate stacked.":"Duplicate added.");refreshCurrentDetail();return;
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
  const snap=normalizeSnapStep(state.editSnapStep);
  const gap=Math.max(0,state.fitTolerance||0);
  p.x=clampSnappedValue(topDrag.origX+dx,gap,sz.W-p.w-gap,snap);
  p.y=clampSnappedValue(topDrag.origY+dy,gap,sz.D-p.d-gap,snap);
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
$("sharePlanBtn").addEventListener("click",async()=>{
  let url;
  try{url=currentShareUrl()}catch(e){alert(e.message||"Could not create a share link.");return}
  if(!url)return;
  if(url.length>SHARE_LINK_LIMIT){
    alert("This layout is too large for a reliable share link. Use Export to share the full JSON plan instead.");
    return;
  }
  const ok=await copyText(url),btn=$("sharePlanBtn"),old=btn.textContent;
  btn.textContent=ok?"Copied ✓":"Link ready";
  if(!ok)prompt("Copy this read-only share link:",url);
  setTimeout(()=>{btn.textContent=old},1400);
});

$("savePlanBtn").addEventListener("click",()=>{
  const layout=layouts[selectedLayout],s=storage();if(!layout||!s)return;
  const signature=planSignature(s.id,layout);
  const existing=state.savedPlans.find(p=>p.signature===signature);
  if(existing){
    state.savedPlans=state.savedPlans.filter(p=>p.id!==existing.id);
    comparePlanIds.delete(existing.id);
    if(state.chosenPlanIds?.[existing.storageId]===existing.id)delete state.chosenPlanIds[existing.storageId];
    normalizeInstallState(state);
  }else createSavedPlanForStorage(s,layout);
  localStorage.setItem(KEY,JSON.stringify(state));
  renderSavedPlans();updateSavePlanButton();
});
$("applyMatchingBtn").addEventListener("click",()=>{
  const layout=layouts[selectedLayout],source=storage();if(!layout||!source)return;
  const targets=eligiblePropagationTargets(source);if(!targets.length){updateApplyMatchingButton();return}

  const sourcePlan=createSavedPlanForStorage(source,layout);
  state.chosenPlanIds=state.chosenPlanIds||{};
  state.chosenPlanIds[source.id]=sourcePlan.id;

  for(const target of targets){
    const plan=createSavedPlanForStorage(target,layout,{
      name:`${target.name} · Matched layout`,
      note:`Applied from ${storageBreadcrumb(source)}`
    });
    state.chosenPlanIds[target.id]=plan.id;
  }

  normalizeInstallState(state);
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  renderSavedPlans();renderInstallDashboard();renderHomeProcurement();updateSavePlanButton();
  const btn=$("applyMatchingBtn"),count=targets.length;
  btn.textContent=`Applied to ${count} ✓`;
  setTimeout(updateApplyMatchingButton,1200);
});

$("receivePurchasesBtn").addEventListener("click",()=>{
  const received=receiveMarkedPurchases();
  if(!received)return;
  const btn=$("receivePurchasesBtn");
  btn.textContent=`Received ${received} ✓`;
  renderAll();
});
$("exportHomeShoppingBtn").addEventListener("click",()=>{
  const payload=homeShoppingExportPayload();
  if(!payload.chosenPlans.length)return;
  downloadJson("storage-fit-home-shopping.json",payload);
  const btn=$("exportHomeShoppingBtn"),old=btn.textContent;btn.textContent="Exported ✓";
  setTimeout(()=>{btn.textContent=old},1200);
});
$("comparePlansBtn").addEventListener("click",openCompareModal);
$("closeCompareModal").addEventListener("click",closeCompareModal);
$("compareBackdrop").addEventListener("click",closeCompareModal);
$("closeDetailModal").addEventListener("click",closeDetailModal);
$("detailBackdrop").addEventListener("click",closeDetailModal);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && compareModalOpen){ closeCompareModal(); return; }
  if(e.key==="Escape" && detailModalOpen){ closeDetailModal(); return; }
  if(!detailModalOpen||compareModalOpen) return;
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

$("roomSelect").addEventListener("change",()=>{
  state.selectedRoom=$("roomSelect").value;
  const firstFurniture=state.furniture.find(f=>f.roomId===state.selectedRoom);
  state.selectedFurniture=firstFurniture?.id||"";
  const firstStorage=state.storages.find(s=>s.furnitureId===state.selectedFurniture);
  state.selectedStorage=firstStorage?.id||"";editingStorage=firstStorage?.id||""
  localStorage.setItem(KEY,JSON.stringify(state));renderHierarchy();renderStorageList();renderStorageSelect();loadStorageEditor();renderObstacleEditor();renderDividerEditor();resetResults();
});
$("furnitureSelect").addEventListener("change",()=>{
  state.selectedFurniture=$("furnitureSelect").value;
  const f=furnitureById(state.selectedFurniture);if(f)state.selectedRoom=f.roomId;
  const firstStorage=state.storages.find(s=>s.furnitureId===state.selectedFurniture);
  state.selectedStorage=firstStorage?.id||"";editingStorage=firstStorage?.id||""
  localStorage.setItem(KEY,JSON.stringify(state));renderHierarchy();renderStorageList();renderStorageSelect();loadStorageEditor();renderObstacleEditor();renderDividerEditor();resetResults();
});
$("addRoom").addEventListener("click",()=>{
  const name=prompt("Room name","New room");if(name===null)return;
  const id=uid("room");state.rooms.push({id,name:name.trim()||"New room"});
  state.selectedRoom=id;state.selectedFurniture="";state.selectedStorage="";editingStorage="";
  localStorage.setItem(KEY,JSON.stringify(state));renderHierarchy();renderStorageList();renderStorageSelect();loadStorageEditor();renderObstacleEditor();renderDividerEditor();resetResults();
});
$("renameRoom").addEventListener("click",()=>{
  const room=roomById(state.selectedRoom);if(!room)return;
  const name=prompt("Room name",room.name);if(name===null)return;
  room.name=name.trim()||room.name;localStorage.setItem(KEY,JSON.stringify(state));renderAll();
});
$("deleteRoom").addEventListener("click",()=>{
  const room=roomById(state.selectedRoom);if(!room||state.rooms.length<=1)return;
  if(state.furniture.some(f=>f.roomId===room.id)){alert("Move or delete the furniture in this room first.");return}
  createRecoveryCheckpoint(`Before deleting room “${room.name}”`);
  state.rooms=state.rooms.filter(r=>r.id!==room.id);
  state.selectedRoom=state.rooms[0]?.id||"";state.selectedFurniture=state.furniture.find(f=>f.roomId===state.selectedRoom)?.id||"";
  localStorage.setItem(KEY,JSON.stringify(state));renderAll();
});
$("addFurniture").addEventListener("click",()=>{
  const room=roomById(state.selectedRoom);if(!room){alert("Add a room first.");return}
  const name=prompt("Furniture name","New furniture");if(name===null)return;
  const id=uid("furn");state.furniture.push({id,roomId:room.id,name:name.trim()||"New furniture"});
  state.selectedFurniture=id;state.selectedStorage="";editingStorage="";
  localStorage.setItem(KEY,JSON.stringify(state));renderHierarchy();renderStorageList();renderStorageSelect();loadStorageEditor();renderObstacleEditor();renderDividerEditor();resetResults();
});
$("renameFurniture").addEventListener("click",()=>{
  const furniture=furnitureById(state.selectedFurniture);if(!furniture)return;
  const name=prompt("Furniture name",furniture.name);if(name===null)return;
  furniture.name=name.trim()||furniture.name;localStorage.setItem(KEY,JSON.stringify(state));renderAll();
});
$("duplicateFurniture").addEventListener("click",()=>{
  const source=furnitureById(state.selectedFurniture);if(!source)return;
  const siblings=state.furniture.filter(f=>f.roomId===source.roomId).map(f=>f.name);
  const name=nextCopyName(source.name,siblings);
  const childStorages=state.storages.filter(s=>s.furnitureId===source.id);
  const clone=cloneFurnitureDefinition(source,childStorages,{roomId:source.roomId,name});
  state.furniture.push(clone.furniture);state.storages.push(...clone.storages);
  state.selectedRoom=clone.furniture.roomId;state.selectedFurniture=clone.furniture.id;
  state.selectedStorage=clone.storages[0]?.id||"";editingStorage=state.selectedStorage;
  localStorage.setItem(KEY,JSON.stringify(state));renderAll();
});
$("deleteFurniture").addEventListener("click",()=>{
  const furniture=furnitureById(state.selectedFurniture);if(!furniture||state.furniture.length<=1)return;
  if(state.storages.some(s=>s.furnitureId===furniture.id)){alert("Move or delete the storage spaces in this furniture first.");return}
  createRecoveryCheckpoint(`Before deleting furniture “${furniture.name}”`);
  state.furniture=state.furniture.filter(f=>f.id!==furniture.id);
  const next=state.furniture.find(f=>f.roomId===state.selectedRoom)||state.furniture[0]||null;
  state.selectedFurniture=next?.id||"";if(next)state.selectedRoom=next.roomId;
  localStorage.setItem(KEY,JSON.stringify(state));renderAll();
});

$("generateBtn").addEventListener("click",findLayouts);
$("storageSelect").addEventListener("change",()=>{state.selectedStorage=$("storageSelect").value;editingStorage=state.selectedStorage;if(state.selectedStorage)syncHierarchyToStorage(state.selectedStorage);save();renderHierarchy();renderStorageList();loadStorageEditor();renderObstacleEditor();renderDividerEditor();resetResults()});
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
  if(!state.selectedFurniture){alert("Add or select a piece of furniture first.");return}
  const id=uid("s");state.storages.push({id,name:"New storage",w:60,d:40,h:20,furnitureId:state.selectedFurniture,obstacles:[],dividers:[]});
  editingStorage=id;state.selectedStorage=id;save();renderAll();$("storageName").focus();$("storageName").select()
});
$("duplicateStorage").addEventListener("click",()=>{
  const source=state.storages.find(s=>s.id===editingStorage);if(!source)return;
  const siblings=state.storages.filter(s=>s.furnitureId===source.furnitureId).map(s=>s.name);
  const clone=cloneStorageDefinition(source,{name:nextCopyName(source.name,siblings)});
  state.storages.push(clone);editingStorage=clone.id;state.selectedStorage=clone.id;syncHierarchyToStorage(clone.id);
  localStorage.setItem(KEY,JSON.stringify(state));renderAll();
});
$("repeatStorage").addEventListener("click",()=>{
  const source=state.storages.find(s=>s.id===editingStorage);if(!source)return;
  const raw=prompt("How many additional copies?","3");if(raw===null)return;
  const count=Math.floor(Number(raw));
  if(!Number.isFinite(count)||count<1||count>20){alert("Enter a number from 1 to 20.");return}
  const existing=state.storages.filter(s=>s.furnitureId===source.furnitureId).map(s=>s.name);
  const clones=[];
  for(const proposed of repeatStorageNames(source.name,count)){
    const name=uniqueSiblingName(proposed,[...existing,...clones.map(s=>s.name)]);
    clones.push(cloneStorageDefinition(source,{name}));
  }
  state.storages.push(...clones);
  editingStorage=clones[0]?.id||source.id;state.selectedStorage=editingStorage;syncHierarchyToStorage(editingStorage);
  localStorage.setItem(KEY,JSON.stringify(state));renderAll();
});
$("addObstacle").addEventListener("click",()=>{
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  s.obstacles=s.obstacles||[];
  const n=s.obstacles.length+1;
  s.obstacles.push({id:uid("o"),name:`Blocked zone ${n}`,x:0,y:0,w:5,d:5,h:Math.min(s.h||5,5)});
  save();renderObstacleEditor();renderStorageList();renderSavedPlans();resetResults();
});
$("applyConstraintTemplate").addEventListener("click",()=>applyConstraintTemplate($("constraintTemplate").value));
function addDivider(orientation){
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  s.dividers=s.dividers||[];
  const span=orientation==="horizontal"?s.d:s.w;
  s.dividers.push({
    id:uid("d"),orientation,
    position:round6(span/2),
    thickness:Math.max(0.01,state.unit==="mm"?5:state.unit==="in"?0.2:0.5),
    h:s.h
  });
  save();renderDividerEditor();renderStorageList();renderSavedPlans();resetResults();
}
$("addVerticalDivider").addEventListener("click",()=>addDivider("vertical"));
$("addHorizontalDivider").addEventListener("click",()=>addDivider("horizontal"));



$("clearRecoveryBtn").addEventListener("click",clearRecoveryHistory);

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

    createRecoveryCheckpoint(`Before restoring backup “${file.name}”`);
    setBackupStatus("Backup validated. Recovery checkpoint created. Restoring…","good");
    restoreBackupState(candidate);
  }catch(err){
    setBackupStatus(`Restore failed: ${err?.message||"invalid backup file"}`,"warn");
  }
});

$("itemSearch").addEventListener("input",renderBoxList);

$("smartUrl").addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();$("smartImportBtn").click()}
});
$("smartImportBtn").addEventListener("click",async()=>{
  const raw=$("smartUrl").value.trim(),url=safeUrl(raw);
  if(!url){
    $("smartStatus").className="smartstatus warn";$("smartStatus").textContent="Paste a valid http(s) product URL first.";return;
  }
  pendingImport=null;
  $("smartImportBtn").disabled=true;$("smartImportBtn").textContent="Reading…";
  $("smartStatus").className="smartstatus";$("smartStatus").textContent="Reading product information…";
  $("smartPreview").className="smartpreview";$("smartPreview").innerHTML="";
  try{
    const {data,source}=await fetchSmartProduct(url);
    data.retailer=data.retailer||retailerName(url);
    renderImportPreview(data,source);
  }catch(e){
    clearPendingImport();
    $("smartStatus").className="smartstatus warn";
    $("smartStatus").textContent="Could not read this product automatically. You can still add it manually below.";
  }finally{
    $("smartImportBtn").disabled=false;$("smartImportBtn").textContent="Import";
  }
});

$("addBox").addEventListener("click",()=>{
  const id=uid("b");state.boxes.push({id,name:"New item",w:30,d:20,h:10,price:0,currency:"MAD",ownedQty:0,sku:"",url:"",image:"",retailer:"",uprightOnly:true,floorRotationLocked:false,frontPriority:false,canBeStacked:false,canSupportStack:false,maxStackLevel:null});state.selectedTypes[id]=false;state.itemLimits[id]=null;editingBox=id;save();renderAll();$("boxName").focus();$("boxName").select()
});
$("saveStorage").addEventListener("click",()=>{
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  s.name=$("storageName").value.trim()||"Storage";s.w=Math.max(0,Number($("sw").value)||0);s.d=Math.max(0,Number($("sd").value)||0);s.h=Math.max(0,Number($("sh").value)||0);
  s.furnitureId=$("storageFurniture").value||s.furnitureId||state.selectedFurniture;
  s.obstacles=s.obstacles||[];for(const o of s.obstacles){o.x=Math.min(o.x,s.w);o.y=Math.min(o.y,s.d);o.w=Math.min(o.w,Math.max(0,s.w-o.x));o.d=Math.min(o.d,Math.max(0,s.d-o.y));o.h=Math.min(o.h,s.h)}
  s.dividers=s.dividers||[];for(const d of s.dividers){
    d.position=Math.min(Math.max(0,d.position),d.orientation==="horizontal"?s.d:s.w);
    d.thickness=Math.max(0.01,d.thickness);d.h=Math.min(Math.max(0,d.h),s.h);
  }
  save();renderAll()
});
$("saveBox").addEventListener("click",()=>{
  const b=state.boxes.find(x=>x.id===editingBox);if(!b)return;
  b.name=$("boxName").value.trim()||"Item";b.w=Math.max(0,Number($("bw").value)||0);b.d=Math.max(0,Number($("bd").value)||0);b.h=Math.max(0,Number($("bh").value)||0);
  b.price=Math.max(0,Number($("boxPrice").value)||0);b.currency=($("boxCurrency").value.trim().toUpperCase().slice(0,6)||"MAD");b.ownedQty=Math.max(0,Math.min(999,Math.floor(Number($("boxOwnedQty").value)||0)));b.sku=$("boxSku").value.trim();b.url=$("boxUrl").value.trim();b.image=$("boxImage").value.trim();b.retailer=retailerName(b.url);
  b.uprightOnly=$("boxUprightOnly").checked;
  b.floorRotationLocked=$("boxFloorRotationLocked").checked;
  b.frontPriority=$("boxFrontPriority").checked;
  b.canBeStacked=$("boxCanBeStacked").checked;
  b.canSupportStack=$("boxCanSupportStack").checked;
  const rawLevel=$("boxMaxStackLevel").value.trim();
  b.maxStackLevel=b.canBeStacked&&rawLevel?Math.max(1,Math.min(9,Math.floor(Number(rawLevel)||1))):null;
  save();renderAll()
});
$("deleteStorage").addEventListener("click",()=>{
  if(!editingStorage)return;
  const deletingStorage=state.storages.find(s=>s.id===editingStorage);
  createRecoveryCheckpoint(`Before deleting storage “${deletingStorage?.name||"Storage"}”`);
  const removedPlanIds=new Set(state.savedPlans.filter(p=>p.storageId===editingStorage).map(p=>p.id));
  state.savedPlans=state.savedPlans.filter(p=>p.storageId!==editingStorage);
  comparePlanIds=new Set([...comparePlanIds].filter(id=>!removedPlanIds.has(id)));
  if(state.chosenPlanIds?.[editingStorage])delete state.chosenPlanIds[editingStorage];
  if(state.installedPlanIds?.[editingStorage])delete state.installedPlanIds[editingStorage];
  state.installOrder=(state.installOrder||[]).filter(id=>id!==editingStorage);
  state.storages=state.storages.filter(x=>x.id!==editingStorage);
  if(state.selectedStorage===editingStorage)state.selectedStorage=state.storages[0]?.id||"";
  editingStorage=state.selectedStorage||state.storages[0]?.id||"";
  if(state.selectedStorage)syncHierarchyToStorage(state.selectedStorage);
  save();renderAll()
});
$("deleteBox").addEventListener("click",()=>{
  if(!editingBox)return;
  const usedBySaved=state.savedPlans.some(p=>(p.layout||[]).some(q=>q.typeId===editingBox));
  if(usedBySaved){alert("This item is used by a saved plan. Remove or replace it in saved plans before deleting it.");return}
  const deletingItem=state.boxes.find(b=>b.id===editingBox);
  createRecoveryCheckpoint(`Before deleting item “${deletingItem?.name||"Item"}”`);
  state.boxes=state.boxes.filter(x=>x.id!==editingBox);delete state.selectedTypes[editingBox];delete state.itemLimits[editingBox];delete state.shoppingBought[editingBox];
  editingBox=state.boxes[0]?.id||"";save();renderAll()
});

if(new URLSearchParams(location.search).has("smoke-test")){
  window.StorageFitTest={
    parseDimensionString,
    parseLabeledDimensions,
    canonicalProductUrl,
    normalizedSku,
    retailerName,
    ikeaUrlInfo,
    normalizeProductDimensions,
    safeUrl,
    validateBackupState,
    normalizeChosenPlanSelections,
    normalizeShoppingBought,
    normalizeInstallState,
    computeInstallAllocation,
    repeatStorageNames,
    canonicalPlanLayout,
    labeledPlacements,
    itemPlanningSnapshot,
    itemPlanningSignature,
    validatePlanLayoutAgainst,
    planHealthFromData,
    normalizeRecoveryJournal,
    recoveryEntryMeta,
    defaultConstraintMeasure,
    constraintTemplateZones,
    dividerRectsForStorage,
    physicalObstaclesForStorage,
    storageStructureSignature,
    matchingSiblingStorages,
    cloneStorageDefinition,
    cloneFurnitureDefinition,
    nextCopyName,
    ensureHomeHierarchy,
    purchaseBreakdown,
    aggregateRequiredCounts,
    orientations,
    placementStackLevel,
    maxStackLevelAllows,
    accessPenalty,
    compareAccess,
    defaultEditSnapStep,
    normalizeSnapStep,
    snapValue,
    clampSnappedValue,
    mirrorLayoutGeometry,
    base64UrlEncodeUtf8,
    base64UrlDecodeUtf8,
    validateSharePayload,
    encodeSharePayload,
    decodeSharePayload,
    overlap3D,
    footprintContains
  };
}

renderAll();
})();
