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
const CAPACITY_SEARCH_LIMIT = 25000;
const CAPACITY_COPY_LIMIT = 40;
const INSTALL_ORDER_SEARCH_LIMIT = 60000;
const STOCK_UNLOCK_SEARCH_LIMIT = 12000;
const STOCK_UNLOCK_ITEM_LIMIT = 30;
const STOCK_UNLOCK_BUNDLE_ITEM_LIMIT = 8;
const STOCK_UNLOCK_BUNDLE_UNIT_LIMIT = 4;
const STOCK_UNLOCK_BUNDLE_SCENARIO_LIMIT = 350;

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
let itemFitModalOpen = false;
let fitAuditModalOpen = false;
let planFamilyModalOpen = false;
let comparePlanIds = new Set();
let pendingImport = null;
let capacityLayoutContext = null;
let savedPlanSourceContext = null;
let installUnlockAnalysisCache = null;

state.itemLimits = state.itemLimits || {};
state.fitTolerance = Math.max(0, Number(state.fitTolerance)||0);
state.editSnapStep = Math.max(0.01, Number(state.editSnapStep)||defaultEditSnapStep(state.unit));
state.editShowGrid = state.editShowGrid !== false;
state.enableStacking = !!state.enableStacking;
state.optimizeGoal = ["fill","compartments","simple","balanced","cost","access"].includes(state.optimizeGoal)?state.optimizeGoal:"fill";
state.savedPlans = Array.isArray(state.savedPlans)?state.savedPlans:[];
normalizeOwnedDistributionSessions(state);
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
  s.measuredAt=typeof s.measuredAt==="string"?s.measuredAt:"";
  s.measurementSignature=typeof s.measurementSignature==="string"?s.measurementSignature:"";
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
    unit:"cm",clearance:0.5,fitTolerance:0,editSnapStep:0.5,editShowGrid:true,uprightOnly:true,enableStacking:false,clearanceEnabled:false,optimizeGoal:"fill",savedPlans:[],chosenPlanIds:{},shoppingBought:{},installedPlanIds:{},installOrder:[],ownedDistributionSessions:{},
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
          unit:old.unit||"cm",clearance:old.clearance??0.5,fitTolerance:old.fitTolerance??0,editSnapStep:old.editSnapStep??defaultEditSnapStep(old.unit||"cm"),editShowGrid:old.editShowGrid!==false,uprightOnly:old.uprightOnly!==false,enableStacking:!!old.enableStacking,optimizeGoal:old.optimizeGoal||"fill",savedPlans:Array.isArray(old.savedPlans)?old.savedPlans:[],chosenPlanIds:old.chosenPlanIds&&typeof old.chosenPlanIds==="object"?old.chosenPlanIds:{},chosenPlanId:old.chosenPlanId||null,shoppingBought:old.shoppingBought&&typeof old.shoppingBought==="object"?old.shoppingBought:{},installedPlanIds:old.installedPlanIds&&typeof old.installedPlanIds==="object"?old.installedPlanIds:{},installOrder:Array.isArray(old.installOrder)?old.installOrder:[],ownedDistributionSessions:old.ownedDistributionSessions&&typeof old.ownedDistributionSessions==="object"?old.ownedDistributionSessions:{},
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
function normalizeOwnedDistributionSessions(target){
  const raw=target.ownedDistributionSessions;
  target.ownedDistributionSessions=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const itemIds=new Set((target.boxes||[]).map(b=>b.id));
  for(const [itemId,session] of Object.entries(target.ownedDistributionSessions)){
    if(!itemIds.has(itemId)||!session||typeof session!=="object"||session.itemId!==itemId||!Array.isArray(session.allocations)){
      delete target.ownedDistributionSessions[itemId];continue;
    }
    session.id=String(session.id||uid("dist"));
    session.createdAt=String(session.createdAt||new Date().toISOString());
    session.fingerprint=String(session.fingerprint||"");
    session.requested=Math.max(0,Math.floor(Number(session.requested)||0));
    session.assigned=Math.max(0,Math.floor(Number(session.assigned)||0));
    session.remaining=Math.max(0,Math.floor(Number(session.remaining)||0));
    session.provenMinimumSpaces=!!session.provenMinimumSpaces;
    session.usedBounded=!!session.usedBounded;
    session.boundedCandidates=Math.max(0,Math.floor(Number(session.boundedCandidates)||0));
    session.skipped=Array.isArray(session.skipped)?session.skipped:[];
    session.allocations=session.allocations.filter(a=>a&&a.storageId&&a.result&&Array.isArray(a.result.layout)).map(a=>{
      const available=a.result.layout.length;
      return {
        ...a,
        id:String(a.id||uid("alloc")),
        assigned:Math.min(available,Math.max(0,Math.floor(Number(a.assigned)||0))),
        capacity:Math.min(available,Math.max(0,Math.floor(Number(a.capacity)||0))),
        exact:!!a.exact,
        status:["pending","opened","done"].includes(a.status)?a.status:"pending"
      };
    }).filter(a=>a.assigned>0);
    session.assigned=session.allocations.reduce((sum,a)=>sum+a.assigned,0);
    session.remaining=Math.max(0,session.requested-session.assigned);
    if(session.remaining>0)session.provenMinimumSpaces=false;
  }
  return target.ownedDistributionSessions;
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
function storageStructureCopyTargets(source,options={}){
  if(!source)return {eligible:[],matchingFresh:[],protected:[]};
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const savedPlans=Array.isArray(options.savedPlans)?options.savedPlans:state.savedPlans;
  const chosenPlanIds=options.chosenPlanIds||state.chosenPlanIds||{};
  const installedPlanIds=options.installedPlanIds||state.installedPlanIds||{};
  const sourceSignature=storageStructureSignature(source);
  const eligible=[],matchingFresh=[],protected=[];
  for(const target of storages||[]){
    if(!target||target.id===source.id||target.furnitureId!==source.furnitureId)continue;
    const hasWork=(savedPlans||[]).some(plan=>plan.storageId===target.id)||!!chosenPlanIds[target.id]||!!installedPlanIds[target.id];
    if(hasWork){protected.push(target);continue}
    if(storageStructureSignature(target)===sourceSignature)matchingFresh.push(target);
    else eligible.push(target);
  }
  return {eligible,matchingFresh,protected};
}
function copyStorageStructureData(source,target,{idFactory=uid}={}){
  if(!source||!target)return null;
  return cloneStorageDefinition(source,{
    id:target.id,
    furnitureId:target.furnitureId,
    name:target.name,
    idFactory
  });
}
function syncHierarchyToStorage(storageId){
  const s=state.storages.find(x=>x.id===storageId);if(!s)return;
  const f=furnitureById(s.furnitureId);if(!f)return;
  state.selectedFurniture=f.id;state.selectedRoom=f.roomId;
}
function save(){
  state.unit=$("unit").value; state.uprightOnly=$("uprightOnly").checked; state.enableStacking=$("enableStacking").checked; state.optimizeGoal=$("optimizeGoal").value;
  state.clearanceEnabled=$("clearanceEnabled").checked; state.clearance=Math.max(0,Number($("clearance").value)||0); state.fitTolerance=Math.max(0,Number($("fitTolerance").value)||0);
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderStorageMeasurementStatus();
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


function fitLookupSettings(){
  return {
    clearanceEnabled:!!state.clearanceEnabled,
    clearance:Math.max(0,Number(state.clearance)||0),
    fitTolerance:Math.max(0,Number(state.fitTolerance)||0),
    uprightOnly:state.uprightOnly!==false,
    enableStacking:!!state.enableStacking
  };
}
function closeItemFitModal(){
  itemFitModalOpen=false;
  $("itemFitModal").classList.remove("open");
  $("itemFitModal").setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}
function closeFitAuditModal(){
  fitAuditModalOpen=false;
  $("fitAuditModal").classList.remove("open");
  $("fitAuditModal").setAttribute("aria-hidden","true");
  if(!detailModalOpen&&!compareModalOpen&&!itemFitModalOpen&&!planFamilyModalOpen)document.body.classList.remove("modal-open");
}
function openCapacityPacking(storageId,result){
  const S=state.storages.find(s=>s.id===storageId);
  if(!S||!result||!Array.isArray(result.layout)||!result.layout.length)return false;
  state.selectedStorage=S.id;editingStorage=S.id;syncHierarchyToStorage(S.id);
  if(typeof result.stackingEnabled==="boolean")state.enableStacking=result.stackingEnabled;
  else if(layoutUsesStacking(result.layout))state.enableStacking=true;
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  closeItemFitModal();renderAll();
  layouts=[result.layout.map(p=>({...p}))];selectedLayout=0;selectedGap=-1;currentGaps=[];galleryWasCapped=false;
  editMode=false;selectedEditItem=-1;editOriginalLayout=null;editHistory={entries:[],index:-1};topDrag=null;
  detailView="top";
  capacityLayoutContext={
    exact:!!result.exact,count:result.count,storageId:S.id,mode:result.mode||"floor",
    floorCount:Number.isFinite(result.floorCount)?result.floorCount:result.count,
    stackedCount:Number.isFinite(result.stackedCount)?result.stackedCount:0,
    stackSummary:result.stackSummary||null,
    packingPurpose:result.packingPurpose||"capacity",
    sourceCapacity:Number(result.sourceCapacity)||result.count,
    sourceExact:typeof result.sourceExact==="boolean"?result.sourceExact:!!result.exact
  };
  const c=state.clearanceEnabled?Math.max(0,state.clearance||0):0,W=S.w-2*c,D=S.d-2*c,H=S.h-2*c;
  renderDetail(W,D,H);openDetailModal();
  return true;
}
function openCompatibleStorage(storageId){
  const S=state.storages.find(s=>s.id===storageId);if(!S)return;
  state.selectedStorage=S.id;editingStorage=S.id;syncHierarchyToStorage(S.id);
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  closeItemFitModal();renderAll();
  $("storageSelect")?.scrollIntoView({behavior:"smooth",block:"center"});
}

function maxAdditionalFloorCopiesInPlan(item,plan,liveStorage,options={}){
  if(!item||!plan||!liveStorage)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0};
  const settings=plan.settings||{clearanceEnabled:false,clearance:0,fitTolerance:0,uprightOnly:true};
  const clearance=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  const W=(Number(liveStorage.w)||0)-2*clearance,D=(Number(liveStorage.d)||0)-2*clearance,H=(Number(liveStorage.h)||0)-2*clearance;
  const nodeLimit=Math.max(100,Math.floor(Number(options.nodeLimit)||CAPACITY_SEARCH_LIMIT));
  const copyLimit=Math.max(1,Math.floor(Number(options.copyLimit)||CAPACITY_COPY_LIMIT));
  if(W<=0||D<=0||H<=0)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,W,D,H};
  const fixedLayout=plan.layout||[],physical=usableObstaclesFor(liveStorage,clearance);
  const fixedFloor=fixedLayout.filter(p=>(Number(p.z)||0)<=1e-9).map(p=>({...p,kind:"occupied"}));
  const searchObstacles=[...physical,...fixedFloor];
  const oris=orientations(item,settings.uprightOnly!==false).filter(o=>o[0]+2*gap<=W+1e-9&&o[1]+2*gap<=D+1e-9&&o[2]<=H+1e-9);
  if(!oris.length)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,W,D,H};
  const minArea=Math.min(...oris.map(o=>o[0]*o[1])),freeArea=freeFloorArea(W,D,searchObstacles);
  const areaUpper=Math.max(0,Math.floor((freeArea+1e-9)/Math.max(1e-9,minArea))),target=Math.min(copyLimit,areaUpper);
  let best=[],nodes=0,truncated=false,capped=false;
  const visited=new Set();

  const validAdded=(p,added)=>floorPlacementValid(p,[...fixedLayout,...added],W,D,H,physical,gap);
  for(const o of oris){
    const added=[];
    while(added.length<target){
      let next=null;
      for(const [x,y] of candidatePointsFor(added,searchObstacles,o[0],o[1],gap)){
        const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]};
        if(validAdded(p,added)){next=p;break}
      }
      if(!next)break;
      added.push(next);
    }
    if(added.length>best.length)best=added.map(p=>({...p}));
  }

  function recurse(added){
    nodes++;
    if(nodes>nodeLimit){truncated=true;return}
    if(added.length>best.length)best=added.map(p=>({...p}));
    if(added.length>=target){
      if(areaUpper>copyLimit)capped=true;
      return;
    }
    const remainingArea=Math.max(0,freeArea-occupiedArea(added));
    if(added.length+Math.floor((remainingArea+1e-9)/Math.max(1e-9,minArea))<=best.length)return;
    const sig=canonicalLayout(added);
    if(visited.has(sig))return;
    visited.add(sig);
    for(const o of oris){
      for(const [x,y] of candidatePointsFor(added,searchObstacles,o[0],o[1],gap)){
        const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]};
        if(!validAdded(p,added))continue;
        recurse([...added,p]);
        if(truncated||capped)return;
      }
    }
  }
  recurse([]);
  return {count:best.length,layout:best,exact:!truncated&&!capped,truncated,capped,nodes,W,D,H};
}

function packingStackSummary(additions=[],fixedLayout=[],itemLookup=boxById){
  const proposed=(additions||[]).map(p=>({...p}));
  const fixed=(fixedLayout||[]).map(p=>({...p}));
  const combined=[...fixed,...proposed];
  const levels=new Map(),roots=new Set();
  let floorCount=0,stackedCount=0,maxLevel=1,invalid=0;
  for(const p of proposed){
    const z=Number(p.z)||0;
    const level=z<=1e-9?1:placementStackLevelLookup(p,combined,itemLookup);
    if(!isFinite(level)){invalid++;continue}
    levels.set(level,(levels.get(level)||0)+1);
    maxLevel=Math.max(maxLevel,level);
    if(level===1){floorCount++;continue}
    stackedCount++;
    let current=p,base=null,guard=0;
    while((Number(current.z)||0)>1e-9&&guard++<combined.length+1){
      base=supportingBaseForLookup(current,combined,itemLookup);
      if(!base)break;
      current=base;
    }
    if(base||((Number(current.z)||0)<=1e-9)){
      const idx=combined.indexOf(current);
      roots.add(idx>=0?"i:"+idx:["g",current.typeId,round6(current.x),round6(current.y),round6(current.z||0),round6(current.w),round6(current.d),round6(current.h)].join("|"));
    }
  }
  const levelCounts=[...levels.entries()].sort((a,b)=>a[0]-b[0]).map(([level,count])=>({level,count}));
  return {floorCount,stackedCount,maxLevel,stackCount:roots.size,levelCounts,invalid};
}
function packingStackSummaryText(summary){
  if(!summary||!summary.stackedCount)return "";
  const stacks=summary.stackCount+" stack"+(summary.stackCount===1?"":"s");
  const tallest="tallest level "+summary.maxLevel;
  const layers=summary.levelCounts.map(x=>"L"+x.level+":"+x.count).join(" / ");
  return stacks+" · "+tallest+(layers?" · "+layers:"");
}

function maxAdditionalCopiesInPlan(item,plan,liveStorage,options={}){
  const stackingEnabled=!!(plan&&(plan.stacking ?? layoutUsesStacking(plan.layout||[])));
  if(!stackingEnabled||!item?.canBeStacked){
    const floor=maxAdditionalFloorCopiesInPlan(item,plan,liveStorage,options);
    return {...floor,mode:"floor",floorCount:floor.count,stackedCount:0,stackSummary:packingStackSummary(floor.layout||[],[],id=>id===item?.id?item:null)};
  }
  if(!item||!plan||!liveStorage)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,mode:"3d",floorCount:0,stackedCount:0};
  const settings=plan.settings||{clearanceEnabled:false,clearance:0,fitTolerance:0,uprightOnly:true};
  const clearance=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  const W=(Number(liveStorage.w)||0)-2*clearance,D=(Number(liveStorage.d)||0)-2*clearance,H=(Number(liveStorage.h)||0)-2*clearance;
  const nodeLimit=Math.max(100,Math.floor(Number(options.nodeLimit)||CAPACITY_SEARCH_LIMIT));
  const copyLimit=Math.max(1,Math.floor(Number(options.copyLimit)||CAPACITY_COPY_LIMIT));
  if(W<=0||D<=0||H<=0)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,mode:"3d",floorCount:0,stackedCount:0,W,D,H};
  const fixedLayout=(plan.layout||[]).map(p=>({...p}));
  const physical=usableObstaclesFor(liveStorage,clearance);
  const oris=orientations(item,settings.uprightOnly!==false).filter(o=>o[0]+2*gap<=W+1e-9&&o[1]+2*gap<=D+1e-9&&o[2]<=H+1e-9);
  if(!oris.length)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,mode:"3d",floorCount:0,stackedCount:0,W,D,H};
  const itemVolume=Math.max(1e-9,(Number(item.w)||0)*(Number(item.d)||0)*(Number(item.h)||0));
  const freeVolume=Math.max(0,usableVolume(W,D,H,physical)-occupiedVolume(fixedLayout));
  const volumeUpper=Math.max(0,Math.floor((freeVolume+1e-9)/itemVolume));
  if(!volumeUpper)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,mode:"3d",floorCount:0,stackedCount:0,W,D,H};
  const target=Math.min(copyLimit,volumeUpper);
  const lookup=typeof options.itemLookup==="function"?options.itemLookup:boxById;
  const ruleLookup=id=>id===item.id?item:lookup(id);
  let best=[],nodes=0,truncated=false,capped=false,provenOptimal=false;
  const visited=new Set();

  function candidatePlacements(added){
    const current=[...fixedLayout,...added],out=[],seen=new Set();
    const push=p=>{
      const key=[p.typeId,round6(p.x),round6(p.y),round6(p.z||0),round6(p.w),round6(p.d),round6(p.h)].join("|");
      if(seen.has(key))return;
      if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9||(p.z||0)<0||(p.z||0)+p.h>H+1e-9)return;
      if(physical.some(o=>overlap3D(p,o,gap)))return;
      if(current.some(q=>overlap3D(p,q,gap)))return;
      if((Number(p.z)||0)>1e-9){
        if(!item.canBeStacked)return;
        if(!supportingBaseForLookup(p,current,ruleLookup))return;
        const level=placementStackLevelLookup(p,current,ruleLookup);
        if(!isFinite(level)||(item.maxStackLevel&&level>item.maxStackLevel))return;
      }
      seen.add(key);out.push(p);
    };

    const floorPlaced=current.filter(p=>(Number(p.z)||0)<=1e-9);
    for(const o of oris){
      for(const [x,y] of candidatePointsFor(floorPlaced,physical,o[0],o[1],gap)){
        push({typeId:item.id,name:item.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]});
      }
    }

    for(const base of current){
      const baseRule=ruleLookup(base.typeId);
      if(!baseRule?.canSupportStack)continue;
      const z=round6((Number(base.z)||0)+Number(base.h||0));
      for(const o of oris){
        if(z+o[2]>H+1e-9||o[0]>base.w+1e-9||o[1]>base.d+1e-9)continue;
        const xs=new Set([round6(base.x),round6(base.x+base.w-o[0])]);
        const ys=new Set([round6(base.y),round6(base.y+base.d-o[1])]);
        for(const q of current){
          if(Math.abs((Number(q.z)||0)-z)>1e-9)continue;
          if(q.x>=base.x-1e-9&&q.y>=base.y-1e-9&&q.x+q.w<=base.x+base.w+1e-9&&q.y+q.d<=base.y+base.d+1e-9){
            xs.add(round6(q.x+q.w+gap));ys.add(round6(q.y+q.d+gap));
            xs.add(round6(q.x-o[0]-gap));ys.add(round6(q.y-o[1]-gap));
          }
        }
        for(const y of ys)for(const x of xs){
          const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z,w:o[0],d:o[1],h:o[2]};
          if(footprintContains(base,p))push(p);
        }
      }
    }
    return out;
  }

  function remember(added){
    if(added.length>best.length)best=added.map(p=>({...p}));
    if(best.length>=volumeUpper)provenOptimal=true;
    if(best.length>=copyLimit&&volumeUpper>copyLimit)capped=true;
  }

  let greedy=[];
  while(greedy.length<target){
    const next=candidatePlacements(greedy)[0];
    if(!next)break;
    greedy=[...greedy,next];
  }
  remember(greedy);

  function recurse(added){
    if(truncated||provenOptimal||capped)return;
    nodes++;
    if(nodes>nodeLimit){truncated=true;return}
    remember(added);
    if(provenOptimal||capped)return;
    const remainingVolume=Math.max(0,freeVolume-occupiedVolume(added));
    const upper=added.length+Math.floor((remainingVolume+1e-9)/itemVolume);
    if(upper<=best.length)return;
    const sig=canonicalLayout(added);
    if(visited.has(sig))return;
    visited.add(sig);
    const candidates=candidatePlacements(added);
    for(const p of candidates){
      recurse([...added,p]);
      if(truncated||provenOptimal||capped)return;
    }
  }
  recurse([]);
  const floorCount=best.filter(p=>(Number(p.z)||0)<=1e-9).length;
  const stackedCount=best.length-floorCount;
  const stackSummary=packingStackSummary(best,fixedLayout,ruleLookup);
  return {
    count:best.length,layout:best,exact:provenOptimal||(!truncated&&!capped),truncated,capped,nodes,
    mode:"3d",floorCount,stackedCount,W,D,H,volumeUpper,stackSummary
  };
}

function ownedPackingFromCapacity(unallocatedOwned,result){
  const available=Math.max(0,Math.floor(Number(unallocatedOwned)||0));
  const source=Array.isArray(result?.layout)?result.layout:[];
  const count=Math.min(available,source.length);
  return {available,capacity:source.length,count,layout:source.slice(0,count).map(p=>({...p}))};
}

function ownedCapacityResult(unallocatedOwned,result,item){
  const owned=ownedPackingFromCapacity(unallocatedOwned,result);
  if(!owned.count)return null;
  const layout=owned.layout;
  const floorCount=layout.filter(p=>(Number(p.z)||0)<=1e-9).length;
  const stackedCount=layout.length-floorCount;
  const lookup=id=>id===item?.id?item:null;
  return {
    ...result,
    count:owned.count,
    layout,
    exact:false,
    floorCount,
    stackedCount,
    stackSummary:packingStackSummary(layout,[],lookup),
    packingPurpose:"owned",
    sourceCapacity:Number(result?.count)||owned.capacity,
    sourceExact:!!result?.exact,
    ownedAvailable:owned.available
  };
}

function ownedDistributionCandidate(item,S,settings,chosenPlan,match={},options={}){
  if(!item||!S)return null;
  const copyLimit=Math.max(1,Math.min(CAPACITY_COPY_LIMIT,Math.floor(Number(options.copyLimit)||CAPACITY_COPY_LIMIT)));
  const nodeLimit=Math.max(100,Math.min(CAPACITY_SEARCH_LIMIT,Math.floor(Number(options.nodeLimit)||CAPACITY_SEARCH_LIMIT)));
  const tightness=Number.isFinite(Number(match?.freeAfter))?Number(match.freeAfter):Number.POSITIVE_INFINITY;
  const storagePath=options.storagePath||S.name||"Storage";
  if(chosenPlan){
    const healthStatus=options.planStatus||planHealth(chosenPlan).status;
    if(healthStatus!=="current"){
      return {
        storageId:S.id,storageName:S.name||"Storage",storagePath,source:"chosen",planId:chosenPlan.id,
        planName:chosenPlan.name||"Chosen plan",capacity:0,exact:false,tightness,skipped:true,
        skipReason:healthStatus==="review"?"chosen plan needs review":"chosen plan is invalid"
      };
    }
    const result=maxAdditionalCopiesInPlan(item,chosenPlan,S,{
      nodeLimit,copyLimit,itemLookup:options.itemLookup||boxById
    });
    return {
      storageId:S.id,storageName:S.name||"Storage",storagePath,source:"chosen",planId:chosenPlan.id,
      planName:chosenPlan.name||"Chosen plan",capacity:Array.isArray(result.layout)?result.layout.length:0,
      exact:!!result.exact,tightness,result,skipped:false
    };
  }
  const result=maxCopiesInStorage(item,S,settings,{nodeLimit,copyLimit,itemLookup:options.itemLookup});
  return {
    storageId:S.id,storageName:S.name||"Storage",storagePath,source:"empty",planId:null,planName:"",
    capacity:Array.isArray(result.layout)?result.layout.length:0,exact:!!result.exact,tightness,result,skipped:false
  };
}
function ownedDistributionPlan(unallocatedOwned,candidates=[]){
  const requested=Math.max(0,Math.floor(Number(unallocatedOwned)||0));
  const skipped=(candidates||[]).filter(c=>c?.skipped);
  const ready=(candidates||[]).filter(c=>c&&!c.skipped&&Math.max(0,Math.floor(Number(c.capacity)||0))>0)
    .map(c=>({...c,capacity:Math.max(0,Math.floor(Number(c.capacity)||0))}))
    .sort((a,b)=>b.capacity-a.capacity||a.tightness-b.tightness||(b.exact?1:0)-(a.exact?1:0)||String(a.storagePath||a.storageName||a.storageId).localeCompare(String(b.storagePath||b.storageName||b.storageId)));
  let remaining=requested;
  const allocations=[];
  for(const candidate of ready){
    if(remaining<=0)break;
    const assigned=Math.min(remaining,candidate.capacity);
    if(!assigned)continue;
    allocations.push({...candidate,assigned});
    remaining-=assigned;
  }
  const assigned=requested-remaining;
  return {
    requested,assigned,remaining,spaceCount:allocations.length,allocations,skipped,
    totalSafeCapacity:ready.reduce((sum,c)=>sum+c.capacity,0),
    boundedCandidates:ready.filter(c=>!c.exact).length,
    usedBounded:allocations.some(c=>!c.exact),
    provenMinimumSpaces:remaining===0&&(allocations.length<=1||ready.every(c=>c.exact))
  };
}
function ownedDistributionSummaryText(plan){
  if(!plan||!plan.requested)return "No unallocated owned stock to distribute.";
  const spaces=plan.spaceCount+" space"+(plan.spaceCount===1?"":"s");
  let text=plan.remaining===0
    ? (plan.provenMinimumSpaces
      ? plan.assigned+" owned copies fit in a minimum of "+spaces+"."
      : plan.assigned+" owned copies are assigned across "+spaces+" using the safe capacity found.")
    : plan.assigned+" of "+plan.requested+" owned copies are assigned across "+spaces+"; "+plan.remaining+" remain unassigned.";
  if(plan.usedBounded||plan.boundedCandidates)text+=" Some capacity results are lower bounds, so a tighter distribution may exist.";
  if(plan.skipped?.length)text+=" "+plan.skipped.length+" storage space"+(plan.skipped.length===1?" was":"s were")+" skipped because the chosen plan needs review.";
  return text;
}

function ownedDistributionFingerprint(item,settings,unallocatedOwned,options={}){
  if(!item)return "";
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const plans=Array.isArray(options.plans)?options.plans:state.savedPlans;
  const chosenPlanIds=options.chosenPlanIds&&typeof options.chosenPlanIds==="object"?options.chosenPlanIds:state.chosenPlanIds;
  const statusLookup=typeof options.planStatusLookup==="function"
    ? options.planStatusLookup
    : plan=>planHealth(plan).status;
  const itemLookup=typeof options.itemLookup==="function"?options.itemLookup:boxById;
  const settingsSig=[
    !!settings?.clearanceEnabled,round6(Number(settings?.clearance)||0),
    round6(Number(settings?.fitTolerance)||0),settings?.uprightOnly!==false,!!settings?.enableStacking
  ];
  const storageSig=(storages||[]).map(S=>{
    const planId=chosenPlanIds?.[S.id]||"";
    const plan=planId?plans.find(p=>p.id===planId&&p.storageId===S.id):null;
    const planItemRules=plan?[...new Set((plan.layout||[]).map(p=>p.typeId))].sort().map(id=>[id,itemPlanningSignature(itemLookup(id))]):[];
    const planSig=plan?[
      plan.id,
      planSignature(plan.storageId,plan.layout||[]),
      JSON.stringify(plan.settings||null),
      plan.stacking ?? layoutUsesStacking(plan.layout||[]),
      statusLookup(plan),
      planItemRules
    ]:null;
    return [S.id,storageStructureSignature(S),planSig];
  }).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([
    item.id,itemPlanningSignature(item),Math.max(0,Math.floor(Number(unallocatedOwned)||0)),
    settingsSig,storageSig
  ]);
}
function createOwnedDistributionSession(item,plan,fingerprint){
  if(!item||!plan)return null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const requested=Math.max(0,Math.floor(Number(plan.requested)||0));
  const allocations=(plan.allocations||[]).map(a=>{
    const result=clone(a.result);
    const available=Array.isArray(result?.layout)?result.layout.length:0;
    const assigned=Math.min(available,Math.max(0,Math.floor(Number(a.assigned)||0)));
    const capacity=Math.min(available,Math.max(0,Math.floor(Number(a.capacity)||0)));
    return {
      id:uid("alloc"),storageId:a.storageId,storagePath:a.storagePath,source:a.source,planId:a.planId||null,
      planName:a.planName||"",assigned,capacity,exact:!!a.exact,tightness:a.tightness,
      status:"pending",result
    };
  }).filter(a=>a.assigned>0);
  const assigned=allocations.reduce((sum,a)=>sum+a.assigned,0);
  const remaining=Math.max(0,requested-assigned);
  return {
    id:uid("dist"),itemId:item.id,itemName:item.name||"Item",createdAt:new Date().toISOString(),
    fingerprint:String(fingerprint||""),requested,assigned,remaining,
    provenMinimumSpaces:!!plan.provenMinimumSpaces&&remaining===0,usedBounded:!!plan.usedBounded,
    boundedCandidates:Math.max(0,Math.floor(Number(plan.boundedCandidates)||0)),
    skipped:(plan.skipped||[]).map(x=>({storageId:x.storageId,storagePath:x.storagePath,skipReason:x.skipReason})),
    allocations
  };
}
function ownedDistributionAllocationSignature(allocation){
  if(!allocation)return "";
  const assigned=Math.max(0,Math.floor(Number(allocation.assigned)||0));
  const source=allocation.source||"empty";
  const planId=source==="chosen"?String(allocation.planId||""):"";
  const layout=(allocation.result?.layout||[]).slice(0,assigned).map(p=>[
    p.typeId||"",round6(Number(p.x)||0),round6(Number(p.y)||0),round6(Number(p.z)||0),
    round6(Number(p.w)||0),round6(Number(p.d)||0),round6(Number(p.h)||0)
  ]);
  return JSON.stringify([String(allocation.storageId||""),source,planId,assigned,layout]);
}
function rebaseOwnedDistributionSession(item,plan,fingerprint,previous=null){
  const session=createOwnedDistributionSession(item,plan,fingerprint);
  if(!session)return {session:null,carriedAllocations:0,carriedCopies:0,resetAllocations:0};
  if(!previous)return {session,carriedAllocations:0,carriedCopies:0,resetAllocations:0};
  const buckets=new Map();
  let previousProgress=0;
  for(const allocation of previous.allocations||[]){
    if(!["opened","done"].includes(allocation.status))continue;
    previousProgress++;
    const signature=ownedDistributionAllocationSignature(allocation);
    if(!signature)continue;
    if(!buckets.has(signature))buckets.set(signature,[]);
    buckets.get(signature).push(allocation);
  }
  let carriedAllocations=0,carriedCopies=0;
  for(const allocation of session.allocations||[]){
    const signature=ownedDistributionAllocationSignature(allocation);
    const bucket=buckets.get(signature);
    const prior=bucket?.shift();
    if(!prior)continue;
    allocation.status=prior.status;
    if(prior.updatedAt)allocation.updatedAt=prior.updatedAt;
    carriedAllocations++;
    carriedCopies+=Math.max(0,Math.floor(Number(allocation.assigned)||0));
  }
  session.createdAt=String(previous.createdAt||session.createdAt);
  session.recalculatedAt=new Date().toISOString();
  session.previousSessionId=String(previous.id||"");
  session.carriedProgress={allocations:carriedAllocations,copies:carriedCopies};
  return {
    session,carriedAllocations,carriedCopies,
    resetAllocations:Math.max(0,previousProgress-carriedAllocations)
  };
}
function ownedDistributionSessionPlan(session){
  if(!session)return null;
  return {
    requested:Math.max(0,Math.floor(Number(session.requested)||0)),
    assigned:Math.max(0,Math.floor(Number(session.assigned)||0)),
    remaining:Math.max(0,Math.floor(Number(session.remaining)||0)),
    spaceCount:Array.isArray(session.allocations)?session.allocations.length:0,
    allocations:Array.isArray(session.allocations)?session.allocations:[],
    skipped:Array.isArray(session.skipped)?session.skipped:[],
    usedBounded:!!session.usedBounded,
    boundedCandidates:Math.max(0,Math.floor(Number(session.boundedCandidates)||0)),
    provenMinimumSpaces:!!session.provenMinimumSpaces
  };
}
function ownedDistributionSessionProgress(session){
  const allocations=Array.isArray(session?.allocations)?session.allocations:[];
  const progress={pending:0,opened:0,done:0,pendingCopies:0,openedCopies:0,doneCopies:0,total:allocations.length,totalCopies:0};
  for(const a of allocations){
    const status=["pending","opened","done"].includes(a.status)?a.status:"pending";
    const copies=Math.max(0,Math.floor(Number(a.assigned)||0));
    progress[status]++;progress[status+"Copies"]+=copies;progress.totalCopies+=copies;
  }
  return progress;
}
function setOwnedDistributionAllocationStatus(session,allocationId,status){
  if(!session||!["pending","opened","done"].includes(status))return false;
  const allocation=(session.allocations||[]).find(a=>a.id===allocationId);
  if(!allocation)return false;
  allocation.status=status;
  allocation.updatedAt=new Date().toISOString();
  return true;
}
function ownedDistributionSessionIsStale(session,fingerprint){
  return !session||!session.fingerprint||session.fingerprint!==String(fingerprint||"");
}
function ownedDistributionSessionSummaryText(session,stale=false){
  if(!session)return "";
  const base=ownedDistributionSummaryText(ownedDistributionSessionPlan(session));
  const p=ownedDistributionSessionProgress(session);
  const progress=p.total
    ? " Progress: "+p.done+" done · "+p.opened+" opened · "+p.pending+" pending."
    : "";
  return (stale?"Out of date — recalculate remaining work before opening allocations. ":"")+base+progress;
}

function ownedDistributionWorkRows(sessions=state.ownedDistributionSessions,options={}){
  const boxes=Array.isArray(options.boxes)?options.boxes:state.boxes;
  const settings=options.settings||fitLookupSettings();
  const stockLookup=typeof options.stockLookup==="function"?options.stockLookup:stockStatusForItem;
  const fingerprintLookup=typeof options.fingerprintLookup==="function"
    ?options.fingerprintLookup
    :(item,unallocatedOwned)=>ownedDistributionFingerprint(item,settings,unallocatedOwned,options.fingerprintOptions||{});
  const rows=[];
  for(const [itemId,session] of Object.entries(sessions||{})){
    const item=boxes.find(b=>b.id===itemId);if(!item||!session)continue;
    const stock=stockLookup(item)||{};
    const unallocatedOwned=Math.max(0,Math.floor(Number(stock.unallocatedOwned)||0));
    const fingerprint=fingerprintLookup(item,unallocatedOwned);
    const stale=ownedDistributionSessionIsStale(session,fingerprint);
    const progress=ownedDistributionSessionProgress(session);
    const complete=progress.total>0&&progress.done===progress.total;
    const status=stale?"stale":complete?"done":progress.opened?"opened":"pending";
    rows.push({itemId,item,session,unallocatedOwned,fingerprint,stale,progress,complete,status});
  }
  const rank={stale:0,opened:1,pending:2,done:3};
  rows.sort((a,b)=>(rank[a.status]??9)-(rank[b.status]??9)
    ||(Date.parse(b.session.createdAt)||0)-(Date.parse(a.session.createdAt)||0)
    ||String(a.item.name||a.itemId).localeCompare(String(b.item.name||b.itemId)));
  return rows;
}
function ownedDistributionWorkSummary(rows=[]){
  const summary={
    sessions:rows.length,staleSessions:0,completeSessions:0,
    allocations:0,doneAllocations:0,openedAllocations:0,pendingAllocations:0,
    assignedCopies:0,doneCopies:0
  };
  for(const row of rows){
    const p=row.progress||ownedDistributionSessionProgress(row.session);
    if(row.stale)summary.staleSessions++;
    if(row.complete&&!row.stale)summary.completeSessions++;
    summary.allocations+=p.total||0;
    summary.doneAllocations+=p.done||0;
    summary.openedAllocations+=p.opened||0;
    summary.pendingAllocations+=p.pending||0;
    summary.assignedCopies+=p.totalCopies||0;
    summary.doneCopies+=p.doneCopies||0;
  }
  return summary;
}
function resumeOwnedDistributionWork(itemId){
  const item=boxById(itemId);if(!item)return false;
  editingBox=item.id;
  if($("itemSearch"))$("itemSearch").value="";
  renderBoxList();loadBoxEditor();openItemFitModal();
  return true;
}

function calculateOwnedDistributionSession(item,settings,unallocatedOwned,previous=null,matches=null){
  if(!item)return {session:null,carriedAllocations:0,carriedCopies:0,resetAllocations:0};
  const requested=Math.max(0,Math.floor(Number(unallocatedOwned)||0));
  if(!requested)return {session:null,carriedAllocations:0,carriedCopies:0,resetAllocations:0};
  const compatible=Array.isArray(matches)?matches:compatibleStoragesForItem(item,state.storages,settings);
  if(!compatible.length)return {session:null,carriedAllocations:0,carriedCopies:0,resetAllocations:0};
  const chosenByStorage=new Map(chosenPlans().map(plan=>[plan.storageId,plan]));
  const copyLimit=Math.max(1,Math.min(CAPACITY_COPY_LIMIT,requested));
  const candidates=compatible.map(match=>{
    const S=state.storages.find(s=>s.id===match.storageId);if(!S)return null;
    const chosen=chosenByStorage.get(S.id)||null;
    return ownedDistributionCandidate(item,S,settings,chosen,match,{
      copyLimit,
      nodeLimit:Math.min(CAPACITY_SEARCH_LIMIT,12000),
      storagePath:storageBreadcrumb(S)
    });
  }).filter(Boolean);
  const plan=ownedDistributionPlan(requested,candidates);
  const fingerprint=ownedDistributionFingerprint(item,settings,requested);
  return rebaseOwnedDistributionSession(item,plan,fingerprint,previous);
}
function ownedDistributionAppliedPlanSpec(item,allocation,options={}){
  if(!item||!allocation)return null;
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const plans=Array.isArray(options.plans)?options.plans:state.savedPlans;
  const itemLookup=typeof options.itemLookup==="function"?options.itemLookup:boxById;
  const S=storages.find(s=>s.id===allocation.storageId);if(!S)return null;
  const assigned=Math.max(0,Math.floor(Number(allocation.assigned)||0));
  if(!assigned)return null;
  const clone=v=>JSON.parse(JSON.stringify(v));
  let layout=[],derivedFrom=null,settings=null,goal=options.goal||state.optimizeGoal,stacking=false;
  if(allocation.source==="chosen"){
    const sourcePlan=plans.find(p=>p.id===allocation.planId&&p.storageId===allocation.storageId);if(!sourcePlan)return null;
    const owned=ownedPackingFromCapacity(assigned,allocation.result);
    if(owned.layout.length!==assigned)return null;
    layout=(sourcePlan.layout||[]).map(q=>({...q}));
    layout.push(...owned.layout.map(p=>extraItemAddition(item,p)).filter(Boolean));
    derivedFrom=savedPlanSourceSnapshot(sourcePlan);
    settings=clone(sourcePlan.settings||options.settings||capturePlanSettings());
    goal=sourcePlan.goal||goal;
    stacking=sourcePlan.stacking ?? layoutUsesStacking(layout);
  }else{
    const owned=ownedCapacityResult(assigned,allocation.result,item);
    if(!owned||owned.layout.length!==assigned)return null;
    layout=owned.layout.map(q=>({...q}));
    settings=clone(options.settings||capturePlanSettings());
    stacking=typeof owned.stackingEnabled==="boolean"?owned.stackingEnabled:layoutUsesStacking(layout);
  }
  const draft={storageId:S.id,settings,stacking,layout};
  const validity=validatePlanLayoutAgainst(draft,S,itemLookup);
  if(!validity.valid)return {valid:false,reasons:validity.reasons,storage:S,layout,derivedFrom,settings,goal,stacking};
  return {valid:true,reasons:[],storage:S,layout,derivedFrom,settings,goal,stacking};
}
function ownedDistributionBatchApplySpecs(item,session,options={}){
  const allocations=Array.isArray(session?.allocations)?session.allocations:[];
  const specs=[],errors=[],seenStorage=new Set();
  let assignedCopies=0;
  for(const allocation of allocations){
    const storageId=String(allocation?.storageId||"");
    if(!storageId){errors.push({allocationId:allocation?.id||"",storageId:"",reason:"missing storage"});continue}
    if(seenStorage.has(storageId)){errors.push({allocationId:allocation?.id||"",storageId,reason:"duplicate storage"});continue}
    seenStorage.add(storageId);
    const spec=ownedDistributionAppliedPlanSpec(item,allocation,options);
    if(!spec?.valid){
      errors.push({allocationId:allocation?.id||"",storageId,reasons:spec?.reasons||[],reason:spec?"invalid layout":"missing source"});
      continue;
    }
    const assigned=Math.max(0,Math.floor(Number(allocation.assigned)||0));
    assignedCopies+=assigned;
    specs.push({allocation,spec,assigned});
  }
  return {
    valid:allocations.length>0&&errors.length===0&&specs.length===allocations.length,
    allocationCount:allocations.length,assignedCopies,specs,errors
  };
}
function ownedDistributionAllocationView(allocation,stale=false){
  const status=["pending","opened","done"].includes(allocation?.status)?allocation.status:"pending";
  const assigned=Math.max(0,Math.floor(Number(allocation?.assigned)||0));
  return {
    status,
    statusLabel:status==="done"?"Done":status==="opened"?"Opened":"Pending",
    sourceLabel:allocation?.source==="chosen"
      ?"Chosen plan · "+(allocation.planName||"Chosen plan")
      :"Unplanned space · owned-capacity packing",
    certaintyLabel:allocation?.exact?"exact capacity":"safe lower-bound capacity",
    openLabel:"Open "+assigned+" here",
    doneLabel:status==="done"?"Undo done":"Mark done",
    applyLabel:"Apply to project",
    disabled:!!stale
  };
}
function persistOwnedDistributionSession(itemId,session){
  if(!itemId)return false;
  state.ownedDistributionSessions=state.ownedDistributionSessions||{};
  if(session)state.ownedDistributionSessions[itemId]=session;else delete state.ownedDistributionSessions[itemId];
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderDistributionWorkDashboard();
  return true;
}
function currentOwnedDistributionWorkRow(itemId){
  return ownedDistributionWorkRows().find(row=>row.itemId===itemId)||null;
}
function applyOwnedDistributionAllocation(itemId,allocationId){
  const row=currentOwnedDistributionWorkRow(itemId);if(!row||row.stale)return {ok:false,reason:"stale"};
  const allocation=(row.session.allocations||[]).find(a=>a.id===allocationId);if(!allocation)return {ok:false,reason:"missing"};
  const spec=ownedDistributionAppliedPlanSpec(row.item,allocation);if(!spec?.valid)return {ok:false,reason:"invalid",reasons:spec?.reasons||[]};
  const plan=createSavedPlanForStorage(spec.storage,spec.layout,{
    note:"Applied from owned-stock distribution",
    derivedFrom:spec.derivedFrom,
    settings:spec.settings,
    goal:spec.goal,
    stacking:spec.stacking
  });
  if(!choosePlan(plan.id))return {ok:false,reason:"choose"};
  const settings=fitLookupSettings();
  const remaining=stockStatusForItem(row.item).unallocatedOwned;
  const rebased=calculateOwnedDistributionSession(row.item,settings,remaining,row.session);
  state.ownedDistributionSessions=state.ownedDistributionSessions||{};
  if(rebased.session)state.ownedDistributionSessions[itemId]=rebased.session;
  else delete state.ownedDistributionSessions[itemId];
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  return {ok:true,planId:plan.id,storageId:plan.storageId,remaining,sessionClosed:!rebased.session,carriedAllocations:rebased.carriedAllocations||0,resetAllocations:rebased.resetAllocations||0};
}
function applyAllOwnedDistributionAllocations(itemId){
  const row=currentOwnedDistributionWorkRow(itemId);if(!row||row.stale)return {ok:false,reason:"stale"};
  const batch=ownedDistributionBatchApplySpecs(row.item,row.session);
  if(!batch.valid)return {ok:false,reason:"invalid",errors:batch.errors,allocationCount:batch.allocationCount};
  if(batch.assignedCopies>row.unallocatedOwned)return {ok:false,reason:"stock",assignedCopies:batch.assignedCopies,unallocatedOwned:row.unallocatedOwned};
  createRecoveryCheckpoint("Before applying distribution for "+(row.item.name||"Item"));
  const planIds=[];
  for(const entry of batch.specs){
    const spec=entry.spec;
    const plan=createSavedPlanForStorage(spec.storage,spec.layout,{
      note:"Applied from owned-stock distribution",
      derivedFrom:spec.derivedFrom,
      settings:spec.settings,
      goal:spec.goal,
      stacking:spec.stacking
    });
    if(!choosePlan(plan.id))return {ok:false,reason:"choose",planIds};
    planIds.push(plan.id);
  }
  const settings=fitLookupSettings();
  const remaining=stockStatusForItem(row.item).unallocatedOwned;
  const rebased=calculateOwnedDistributionSession(row.item,settings,remaining,row.session);
  state.ownedDistributionSessions=state.ownedDistributionSessions||{};
  if(rebased.session)state.ownedDistributionSessions[itemId]=rebased.session;
  else delete state.ownedDistributionSessions[itemId];
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();
  return {
    ok:true,planIds,allocationCount:batch.allocationCount,assignedCopies:batch.assignedCopies,remaining,
    sessionClosed:!rebased.session,carriedAllocations:rebased.carriedAllocations||0,resetAllocations:rebased.resetAllocations||0
  };
}
function toggleOwnedDistributionAllocationDone(itemId,allocationId){
  const row=currentOwnedDistributionWorkRow(itemId);if(!row||row.stale)return false;
  const allocation=(row.session.allocations||[]).find(a=>a.id===allocationId);if(!allocation)return false;
  setOwnedDistributionAllocationStatus(row.session,allocation.id,allocation.status==="done"?"pending":"done");
  persistOwnedDistributionSession(itemId,row.session);
  return true;
}
function openOwnedDistributionAllocation(itemId,allocationId){
  const row=currentOwnedDistributionWorkRow(itemId);if(!row||row.stale)return false;
  const allocation=(row.session.allocations||[]).find(a=>a.id===allocationId);if(!allocation)return false;
  if(allocation.status!=="done")setOwnedDistributionAllocationStatus(row.session,allocation.id,"opened");
  persistOwnedDistributionSession(itemId,row.session);
  if(allocation.source==="chosen"){
    const owned=ownedPackingFromCapacity(allocation.assigned,allocation.result);
    return owned.layout.length?openSavedPlanWithExtraItems(allocation.planId,row.item.id,owned.layout):false;
  }
  const owned=ownedCapacityResult(allocation.assigned,allocation.result,row.item);
  return owned?openCapacityPacking(allocation.storageId,owned):false;
}

function stackedExtraItemPlacementInPlan(item,plan,liveStorage,itemLookup=boxById){
  if(!item||!plan||!liveStorage||!item.canBeStacked)return null;
  const stackingEnabled=plan.stacking ?? layoutUsesStacking(plan.layout||[]);
  if(!stackingEnabled)return null;
  const settings=plan.settings||{clearanceEnabled:false,clearance:0,fitTolerance:0,uprightOnly:true};
  const clearance=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  const W=(Number(liveStorage.w)||0)-2*clearance,D=(Number(liveStorage.d)||0)-2*clearance,H=(Number(liveStorage.h)||0)-2*clearance;
  if(W<=0||D<=0||H<=0)return null;
  const layout=plan.layout||[],obstacles=usableObstaclesFor(liveStorage,clearance);
  const oris=orientations(item,settings.uprightOnly!==false);
  for(const base of layout){
    const baseRule=itemLookup(base.typeId);
    if(!baseRule?.canSupportStack)continue;
    const z=round6((Number(base.z)||0)+Number(base.h||0));
    for(const o of oris){
      if(z+o[2]>H+1e-9||o[0]>base.w+1e-9||o[1]>base.d+1e-9)continue;
      const xs=new Set([round6(base.x),round6(base.x+base.w-o[0])]);
      const ys=new Set([round6(base.y),round6(base.y+base.d-o[1])]);
      for(const q of layout){
        if(Math.abs((Number(q.z)||0)-z)>1e-9)continue;
        if(q.x>=base.x-1e-9&&q.y>=base.y-1e-9&&q.x+q.w<=base.x+base.w+1e-9&&q.y+q.d<=base.y+base.d+1e-9){
          xs.add(round6(q.x+q.w+gap));ys.add(round6(q.y+q.d+gap));
          xs.add(round6(q.x-o[0]-gap));ys.add(round6(q.y-o[1]-gap));
        }
      }
      for(const y of ys)for(const x of xs){
        const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z,w:o[0],d:o[1],h:o[2]};
        if(!footprintContains(base,p))continue;
        if(p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9)continue;
        if(obstacles.some(o=>overlap3D(p,o,gap)))continue;
        if(layout.some(q=>overlap3D(p,q,gap)))continue;
        if(!supportingBaseForLookup(p,layout,itemLookup))continue;
        const level=placementStackLevelLookup(p,layout,itemLookup);
        if(item.maxStackLevel&&level>item.maxStackLevel)continue;
        return {
          ...p,W,D,H,clearance,fitTolerance:gap,placementKind:"stacked",stackLevel:level,
          remainingFloor:Math.max(0,freeFloorArea(W,D,obstacles)-occupiedArea(layout))
        };
      }
    }
  }
  return null;
}
function extraItemPlacementInPlan(item,plan,liveStorage,itemLookup=boxById){
  if(!item||!plan||!liveStorage)return null;
  const settings=plan.settings||{clearanceEnabled:false,clearance:0,fitTolerance:0,uprightOnly:true};
  const clearance=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  const W=(Number(liveStorage.w)||0)-2*clearance,D=(Number(liveStorage.d)||0)-2*clearance,H=(Number(liveStorage.h)||0)-2*clearance;
  if(W<=0||D<=0||H<=0)return null;
  const layout=plan.layout||[],obstacles=usableObstaclesFor(liveStorage,clearance);
  const floorPlaced=layout.filter(p=>(Number(p.z)||0)<=1e-9);
  for(const o of orientations(item,settings.uprightOnly!==false)){
    for(const point of candidatePointsFor(floorPlaced,obstacles,o[0],o[1],gap)){
      const x=point[0],y=point[1];
      const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]};
      if(!floorPlacementValid(p,layout,W,D,H,obstacles,gap))continue;
      return {
        ...p,W,D,H,clearance,fitTolerance:gap,placementKind:"floor",stackLevel:1,
        remainingFloor:Math.max(0,freeFloorArea(W,D,obstacles)-occupiedArea(layout)-o[0]*o[1])
      };
    }
  }
  return stackedExtraItemPlacementInPlan(item,plan,liveStorage,itemLookup);
}
function itemPlanRoomRows(item,savedPlans,storages,chosenPlanIds={},installedPlanIds={},isPlanUsable=()=>true){
  const storageMap=new Map((storages||[]).map(s=>[s.id,s]));
  return (savedPlans||[]).map(plan=>{
    if(!isPlanUsable(plan))return null;
    const S=storageMap.get(plan.storageId),placement=extraItemPlacementInPlan(item,plan,S);
    if(!placement)return null;
    const storageId=plan.storageId||"";
    return {
      planId:plan.id,planName:plan.name||"Saved plan",storageId,
      storagePath:plan.storagePath||plan.storageName||(S&&S.name)||"Storage",
      chosen:chosenPlanIds&&chosenPlanIds[storageId]===plan.id,
      installed:installedPlanIds&&installedPlanIds[storageId]===plan.id,
      placement
    };
  }).filter(Boolean).sort((a,b)=>
    Number(b.installed)-Number(a.installed) ||
    Number(b.chosen)-Number(a.chosen) ||
    a.placement.remainingFloor-b.placement.remainingFloor ||
    a.storagePath.localeCompare(b.storagePath) ||
    a.planName.localeCompare(b.planName)
  );
}
function extraItemAddition(item,placement){
  if(!item||!placement)return null;
  return {
    typeId:item.id,name:item.name,x:Number(placement.x)||0,y:Number(placement.y)||0,z:Number(placement.z)||0,
    w:Number(placement.w)||item.w,d:Number(placement.d)||item.d,h:Number(placement.h)||item.h,label:""
  };
}
function openSavedPlanWithExtraItems(planId,itemId,placements){
  const plan=state.savedPlans.find(p=>p.id===planId),item=boxById(itemId),source=Array.isArray(placements)?placements:[];
  if(!plan||!item||!source.length)return false;
  openSavedPlan(planId);
  const layout=selectedManualLayout(),sz=currentUsableSize();if(!layout||!sz)return false;
  const additions=source.map(placement=>extraItemAddition(item,placement)).filter(Boolean);
  const trial=cloneLayoutSnapshot(layout);
  for(const p of additions){
    trial.push(p);
    if(!editItemValid(trial,trial.length-1,sz.W,sz.D))return false;
  }
  editMode=true;
  editOriginalLayout=cloneLayoutSnapshot(layout);
  resetEditHistory(editOriginalLayout);
  layout.push(...additions);selectedEditItem=layout.length-additions.length;selectedGap=-1;topDrag=null;detailView="top";
  recordEditHistory(additions.length===1?"Add organizer":"Add organizer packing");
  const stackedAdded=additions.filter(p=>(Number(p.z)||0)>1e-9).length;
  setEditStatus(additions.length===1
    ? item.name+(stackedAdded?" added to a valid stack position.":" added to free floor space.")+" Adjust it if needed, then save to create a new plan."
    : additions.length+" copies of "+item.name+" added"+(stackedAdded?" · "+stackedAdded+" stacked":"")+" in one packing. Adjust them if needed, then save to create a new plan.");
  refreshCurrentDetail();openDetailModal();
  return true;
}
function openSavedPlanWithExtraItem(planId,itemId,placement){
  return openSavedPlanWithExtraItems(planId,itemId,placement?[placement]:[]);
}
function setItemFitDistributionVisible(visible){
  const btn=$("itemFitDistributionBtn"),bar=btn?.closest(".fitdistributionbar"),el=$("itemFitDistribution");
  if(bar)bar.style.display=visible?"flex":"none";
  if(!visible&&el)el.innerHTML="";
}
function openItemPlanRoomModal(){
  save();setItemFitDistributionVisible(false);
  const item=boxById(editingBox);if(!item)return;
  const currentPlans=state.savedPlans.filter(plan=>planHealth(plan).status==="current");
  const rows=itemPlanRoomRows(item,currentPlans,state.storages,state.chosenPlanIds,state.installedPlanIds);
  $("itemFitTitle").textContent="Which saved plans have room for "+item.name+"?";
  $("itemFitSubtitle").textContent=fmt(item.w)+" × "+fmt(item.d)+" × "+fmt(item.h)+" "+state.unit+" · one additional floor or stacked copy";
  const skipped=state.savedPlans.length-currentPlans.length,stock=stockStatusForItem(item),unallocatedOwned=stock.unallocatedOwned;
  const stockNote=unallocatedOwned?unallocatedOwned+" owned cop"+(unallocatedOwned===1?"y is":"ies are")+" currently unallocated.":"No owned copies are currently unallocated.";
  const stackedRows=rows.filter(row=>row.placement.placementKind==="stacked").length;
  $("itemFitSummary").textContent=rows.length
    ? rows.length+" current saved plan"+(rows.length===1?" has":"s have")+" room for one more copy"+(stackedRows?" · "+stackedRows+" via stacking":"")+". "+stockNote+" Add copy opens the suggested placement; Calculate extras searches additional floor and legal stack positions."
    : "No current saved plan has valid floor space or a legal stack position for one more copy. "+stockNote+" "+(skipped?skipped+" stale or invalid plan"+(skipped===1?" was":"s were")+" skipped.":"");
  $("itemFitList").innerHTML=rows.length?rows.map(row=>{
    const p=row.placement;
    const badges=[row.installed?'<span class="usagebadge installed">Installed</span>':"",row.chosen?'<span class="usagebadge chosen">Chosen</span>':""].filter(Boolean).join("");
    const placementText=p.placementKind==="stacked"
      ?"stack level "+p.stackLevel+" · X "+fmt(p.x)+", Y "+fmt(p.y)+", Z "+fmt(p.z)
      :"floor · X "+fmt(p.x)+", Y "+fmt(p.y);
    return '<div class="fitmatch"><div><div class="fitmatchtitle">'+esc(row.planName)+" "+badges+'</div><div class="fitmatchmeta">'+esc(row.storagePath)+" · suggested "+placementText+" · "+fmt(p.w)+" × "+fmt(p.d)+" × "+fmt(p.h)+" "+esc(state.unit)+'</div><div class="fitcapacity" data-plan-extra-capacity="'+row.planId+'">Additional capacity not calculated yet.</div></div><div class="fitmatchactions"><button class="btn soft" type="button" data-plan-capacity-btn="'+row.planId+'">Calculate extras</button><button class="btn soft" type="button" data-add-owned-packing="'+row.planId+'" disabled>'+(unallocatedOwned?"Add owned":"No unallocated stock")+'</button><button class="btn soft" type="button" data-add-plan-packing="'+row.planId+'" disabled>Add packing</button><button class="btn soft" type="button" data-add-plan-copy="'+row.planId+'">Add copy</button><button class="btn soft" type="button" data-open-room-plan="'+row.planId+'">Open plan</button></div></div>';
  }).join(""):'<div class="empty">Try another organizer, or edit a saved plan to free floor space or create a legal stack position.</div>';
  const byPlan=new Map(rows.map(row=>[row.planId,row])),capacityResults=new Map();
  $("itemFitList").querySelectorAll("[data-plan-capacity-btn]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=byPlan.get(btn.dataset.planCapacityBtn),plan=state.savedPlans.find(p=>p.id===btn.dataset.planCapacityBtn),S=plan&&state.storages.find(s=>s.id===plan.storageId);
    const out=$("itemFitList").querySelector('[data-plan-extra-capacity="'+btn.dataset.planCapacityBtn+'"]');
    if(!row||!plan||!S||!out)return;
    btn.disabled=true;btn.textContent="Calculating…";
    const result=maxAdditionalCopiesInPlan(item,plan,S);
    capacityResults.set(plan.id,result);
    const noun=result.count===1?"copy":"copies";
    const mix=result.stackedCount
      ? " · "+result.floorCount+" floor + "+result.stackedCount+" stacked"
      : " · "+result.floorCount+" floor";
    out.textContent=result.exact
      ? result.count+" additional "+noun+" maximum"+mix
      : "At least "+result.count+" additional "+noun+" fit"+mix+" · search capped for responsiveness";
    const structure=packingStackSummaryText(result.stackSummary);
    if(structure)out.textContent+=" · "+structure;
    const owned=ownedPackingFromCapacity(unallocatedOwned,result);
    if(owned.count)out.textContent+=" · "+owned.count+" can use unallocated owned stock";
    const ownedBtn=$("itemFitList").querySelector('[data-add-owned-packing="'+plan.id+'"]');
    if(ownedBtn){ownedBtn.disabled=!owned.count;ownedBtn.textContent=owned.count?"Add "+owned.count+" owned":(unallocatedOwned?"No room for owned":"No unallocated stock")}
    const addBtn=$("itemFitList").querySelector('[data-add-plan-packing="'+plan.id+'"]');
    if(addBtn)addBtn.disabled=!result.layout.length;
    btn.textContent="Recalculate";btn.disabled=false;
  }));
  $("itemFitList").querySelectorAll("[data-add-owned-packing]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=byPlan.get(btn.dataset.addOwnedPacking),result=capacityResults.get(btn.dataset.addOwnedPacking);
    const owned=ownedPackingFromCapacity(unallocatedOwned,result);
    if(!row||!owned.count)return;
    const itemId=item.id;closeItemFitModal();openSavedPlanWithExtraItems(row.planId,itemId,owned.layout);
  }));
  $("itemFitList").querySelectorAll("[data-add-plan-packing]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=byPlan.get(btn.dataset.addPlanPacking),result=capacityResults.get(btn.dataset.addPlanPacking);
    if(!row||!result||!result.layout.length)return;
    const itemId=item.id;closeItemFitModal();openSavedPlanWithExtraItems(row.planId,itemId,result.layout);
  }));
  $("itemFitList").querySelectorAll("[data-add-plan-copy]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=byPlan.get(btn.dataset.addPlanCopy);if(!row)return;
    const itemId=item.id;closeItemFitModal();openSavedPlanWithExtraItem(row.planId,itemId,row.placement);
  }));
  $("itemFitList").querySelectorAll("[data-open-room-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    closeItemFitModal();openSavedPlan(btn.dataset.openRoomPlan);
  }));
  itemFitModalOpen=true;
  $("itemFitModal").classList.add("open");
  $("itemFitModal").setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function itemPlanUsageRows(itemId,savedPlans,chosenPlanIds={},installedPlanIds={}){
  return (savedPlans||[]).map(plan=>{
    const count=(plan.layout||[]).filter(p=>p.typeId===itemId).length;
    if(!count)return null;
    const storageId=plan.storageId||"";
    return {
      planId:plan.id,planName:plan.name||"Saved plan",storageId,
      storagePath:plan.storagePath||plan.storageName||"Storage",
      count,
      chosen:chosenPlanIds?.[storageId]===plan.id,
      installed:installedPlanIds?.[storageId]===plan.id,
      savedAt:plan.savedAt||""
    };
  }).filter(Boolean).sort((a,b)=>
    Number(b.installed)-Number(a.installed) ||
    Number(b.chosen)-Number(a.chosen) ||
    b.count-a.count ||
    a.storagePath.localeCompare(b.storagePath) ||
    a.planName.localeCompare(b.planName)
  );
}
function usageEditTarget(layout,itemId){
  const matches=(layout||[]).map((p,index)=>p?.typeId===itemId?{index,p}:null).filter(Boolean);
  if(!matches.length)return null;
  matches.sort((a,b)=>(Number(a.p.z)||0)-(Number(b.p.z)||0)||(Number(a.p.y)||0)-(Number(b.p.y)||0)||(Number(a.p.x)||0)-(Number(b.p.x)||0)||a.index-b.index);
  return {index:matches[0].index,count:matches.length};
}
function openSavedPlanForItem(planId,itemId){
  const plan=state.savedPlans.find(p=>p.id===planId);if(!plan)return false;
  const target=usageEditTarget(plan.layout,itemId);if(!target)return false;
  openSavedPlan(planId);
  const layout=selectedManualLayout();if(!layout||target.index>=layout.length)return false;
  editMode=true;
  editOriginalLayout=cloneLayoutSnapshot(layout);
  resetEditHistory(editOriginalLayout);
  selectedEditItem=target.index;selectedGap=-1;topDrag=null;detailView="top";
  setEditStatus(`Selected ${boxById(itemId)?.name||"organizer"} copy 1 of ${target.count}. Use Replace organizer or any other edit control.`);
  refreshCurrentDetail();openDetailModal();
  return true;
}

function openItemUsageModal(){
  save();setItemFitDistributionVisible(false);
  const item=boxById(editingBox);if(!item)return;
  const rows=itemPlanUsageRows(item.id,state.savedPlans,state.chosenPlanIds,state.installedPlanIds);
  const totalCopies=rows.reduce((sum,row)=>sum+row.count,0);
  const chosenCount=rows.filter(row=>row.chosen).length,installedCount=rows.filter(row=>row.installed).length;
  $("itemFitTitle").textContent=`Where is ${item.name} used?`;
  $("itemFitSubtitle").textContent=`${fmt(item.w)} × ${fmt(item.d)} × ${fmt(item.h)} ${state.unit} · saved-plan usage`;
  $("itemFitSummary").textContent=rows.length
    ? `${totalCopies} cop${totalCopies===1?"y":"ies"} across ${rows.length} saved plan${rows.length===1?"":"s"}${chosenCount?` · ${chosenCount} chosen`:""}${installedCount?` · ${installedCount} installed`:""}. Edit layout selects the first affected placement; saving edits creates a new saved plan and leaves this original unchanged.`
    : "This organizer is not used by any saved plan yet.";
  $("itemFitList").innerHTML=rows.length?rows.map(row=>{
    const badges=[row.installed?'<span class="usagebadge installed">Installed</span>':"",row.chosen?'<span class="usagebadge chosen">Chosen</span>':""].filter(Boolean).join("");
    return `<div class="fitmatch">
      <div><div class="fitmatchtitle">${esc(row.planName)} ${badges}</div>
      <div class="fitmatchmeta">${esc(row.storagePath)} · ${row.count} cop${row.count===1?"y":"ies"} of this organizer</div></div>
      <div class="fitmatchactions"><button class="btn soft" type="button" data-edit-usage-plan="${row.planId}">Edit layout</button><button class="btn soft" type="button" data-open-usage-plan="${row.planId}">Open plan</button></div>
    </div>`;
  }).join(""):'<div class="empty">Save a layout containing this organizer and it will appear here.</div>';
  $("itemFitList").querySelectorAll("[data-edit-usage-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    const itemId=item.id;closeItemFitModal();openSavedPlanForItem(btn.dataset.editUsagePlan,itemId);
  }));
  $("itemFitList").querySelectorAll("[data-open-usage-plan]").forEach(btn=>btn.addEventListener("click",()=>{
    closeItemFitModal();openSavedPlan(btn.dataset.openUsagePlan);
  }));
  itemFitModalOpen=true;
  $("itemFitModal").classList.add("open");
  $("itemFitModal").setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function openItemFitModal(){
  save();setItemFitDistributionVisible(true);
  const item=boxById(editingBox);if(!item)return;
  const settings=fitLookupSettings(),matches=compatibleStoragesForItem(item,state.storages,settings),failures=fitFailuresForItem(item,state.storages,settings);
  const settingBits=[
    settings.clearanceEnabled?`${fmt(settings.clearance)} ${state.unit} wall clearance`:"no wall clearance",
    settings.fitTolerance>0?`${fmt(settings.fitTolerance)} ${state.unit} fit tolerance`:"no fit tolerance",
    settings.uprightOnly?"all items forced upright":"item orientation rules",
    settings.enableStacking?"stacking enabled":"stacking off"
  ];
  $("itemFitTitle").textContent=`Where can ${item.name} fit?`;
  $("itemFitSubtitle").textContent=`${fmt(item.w)} × ${fmt(item.d)} × ${fmt(item.h)} ${state.unit} · ${settingBits.join(" · ")}`;
  const stock=stockStatusForItem(item),unallocatedOwned=stock.unallocatedOwned;
  const ownedNote=unallocatedOwned?`${unallocatedOwned} owned cop${unallocatedOwned===1?"y is":"ies are"} currently unallocated.`:"No owned copies are currently unallocated.";
  $("itemFitSummary").textContent=matches.length
    ? `${matches.length} of ${state.storages.length} storage space${state.storages.length===1?"":"s"} can fit one copy. ${failures.length?failures.length+" non-match"+(failures.length===1?" is":"es are")+" explained below. ":""}${ownedNote} Tightest compatible spaces are shown first. This checks storage geometry only, not occupancy inside a saved layout.`
    : `No storage space can fit one copy with the current geometry and fit settings. ${failures.length?failures.length+" near-miss explanation"+(failures.length===1?" is":"s are")+" shown below. ":""}${ownedNote} This checks storage geometry only, not occupancy inside a saved layout.`;
  const distributionBtn=$("itemFitDistributionBtn"),distributionStatus=$("itemFitDistributionStatus"),distributionEl=$("itemFitDistribution");
  const distributionFingerprint=ownedDistributionFingerprint(item,settings,unallocatedOwned);
  const renderDistributionSession=session=>{
    const stale=!!session&&ownedDistributionSessionIsStale(session,distributionFingerprint);
    if(!session){
      distributionBtn.disabled=!unallocatedOwned||!matches.length;
      distributionBtn.textContent=unallocatedOwned?`Plan ${unallocatedOwned} owned`:"No unallocated stock";
      distributionStatus.textContent=unallocatedOwned?"Uses chosen-plan remaining capacity where present; unplanned spaces use empty-space capacity.":"";
      distributionEl.innerHTML="";
      return;
    }
    distributionBtn.disabled=false;
    distributionBtn.textContent=unallocatedOwned?"Recalculate remaining":"Finish distribution";
    distributionStatus.textContent=ownedDistributionSessionSummaryText(session,stale);
    const batchCount=(session.allocations||[]).length;
    const batchBar=batchCount>1?'<div class="fitdistributionbulk"><div><strong>Apply the full distribution</strong><div class="small">Prevalidates every destination before changing the project.</div></div><button class="btn primary" type="button" data-session-apply-all '+(stale?"disabled":"")+'>Apply all '+batchCount+' spaces</button></div>':"";
    distributionEl.innerHTML=batchBar+((session.allocations||[]).length?session.allocations.map(allocation=>{
      const view=ownedDistributionAllocationView(allocation,stale);
      return '<div class="fitdistributioncard '+esc(view.status)+(stale?" stale":"")+'"><div><div class="fitdistributiontitle">'+allocation.assigned+' owned → '+esc(allocation.storagePath)+' <span class="distributionstatus '+esc(view.status)+'">'+view.statusLabel+'</span></div><div class="fitdistributionmeta">'+esc(view.sourceLabel)+' · '+allocation.capacity+' '+esc(view.certaintyLabel)+(stale?" · out of date":"")+'</div></div><div class="fitmatchactions"><button class="btn soft" type="button" data-session-open="'+allocation.id+'" '+(view.disabled?"disabled":"")+'>'+view.openLabel+'</button><button class="btn primary" type="button" data-session-apply="'+allocation.id+'" '+(view.disabled?"disabled":"")+'>'+view.applyLabel+'</button><button class="btn soft" type="button" data-session-done="'+allocation.id+'" '+(view.disabled?"disabled":"")+'>'+view.doneLabel+'</button></div></div>';
    }).join(""):'<div class="fitfindersummary">No safe allocation was stored in this distribution session.</div>');
    if(session.skipped?.length){
      distributionEl.innerHTML+='<div class="fitfindersummary">'+session.skipped.map(x=>esc(x.storagePath)+": "+esc(x.skipReason)).join(" · ")+'</div>';
    }
    distributionEl.querySelectorAll("[data-session-done]").forEach(btn=>btn.addEventListener("click",()=>{
      if(stale)return;
      if(toggleOwnedDistributionAllocationDone(item.id,btn.dataset.sessionDone)){
        renderDistributionSession(state.ownedDistributionSessions?.[item.id]||null);
      }
    }));
    distributionEl.querySelectorAll("[data-session-open]").forEach(btn=>btn.addEventListener("click",()=>{
      if(stale)return;
      openOwnedDistributionAllocation(item.id,btn.dataset.sessionOpen);
    }));
    distributionEl.querySelectorAll("[data-session-apply]").forEach(btn=>btn.addEventListener("click",()=>{
      if(stale)return;
      const result=applyOwnedDistributionAllocation(item.id,btn.dataset.sessionApply);
      if(!result.ok){alert(result.reasons?.[0]||"This allocation could not be applied safely.");return}
      closeItemFitModal();renderAll();
    }));
    distributionEl.querySelectorAll("[data-session-apply-all]").forEach(btn=>btn.addEventListener("click",()=>{
      if(stale)return;
      const count=(session.allocations||[]).length;
      if(!confirm("Apply all "+count+" distribution destinations to the project? This saves and chooses each plan, and may clear Installed status where a physical layout changes."))return;
      const result=applyAllOwnedDistributionAllocations(item.id);
      if(!result.ok){
        const first=result.errors?.[0];
        alert(first?.reasons?.[0]||"The full distribution could not be applied safely.");
        return;
      }
      closeItemFitModal();renderAll();
    }));
  };
  renderDistributionSession(state.ownedDistributionSessions?.[item.id]||null);
  const capacityResults=new Map();
  const matchHtml=matches.length?matches.map(match=>{
    const S=state.storages.find(s=>s.id===match.storageId),blocked=(S?.obstacles||[]).length,dividers=(S?.dividers||[]).length;
    const constraints=[blocked?`${blocked} blocked zone${blocked===1?"":"s"}`:"",dividers?`${dividers} divider${dividers===1?"":"s"}`:""].filter(Boolean).join(" · ");
    return `<div class="fitmatch">
      <div><div class="fitmatchtitle">${esc(S?storageBreadcrumb(S):match.storageName)}</div>
      <div class="fitmatchmeta">Usable ${fmt(match.W)} × ${fmt(match.D)} × ${fmt(match.H)} ${esc(state.unit)} · fits as ${fmt(match.w)} × ${fmt(match.d)} × ${fmt(match.h)}${constraints?` · ${esc(constraints)}`:""}</div>
      <div class="fitmargin"><strong>Fit margin ${fmt(match.tightestMargin)} ${esc(state.unit)}</strong> · limiting ${esc(match.tightestAxis)} · spare W ${fmt(match.widthMargin)} / D ${fmt(match.depthMargin)} / H ${fmt(match.heightMargin)} ${esc(state.unit)}</div>
      <div class="fitcapacity" data-fit-capacity="${match.storageId}">Capacity not calculated yet.</div></div>
      <div class="fitmatchactions"><button class="btn soft" type="button" data-fit-capacity-btn="${match.storageId}">Calculate capacity</button><button class="btn soft" type="button" data-open-owned-capacity="${match.storageId}" disabled>${unallocatedOwned?"Open owned":"No unallocated stock"}</button><button class="btn soft" type="button" data-open-capacity-layout="${match.storageId}" disabled>Open packing</button><button class="btn soft" type="button" data-open-fit-storage="${match.storageId}">Open space</button></div>
    </div>`;
  }).join(""):'<div class="empty">No compatible space with the current settings.</div>';
  const failureHtml=failures.length?`<details class="fitfailures" ${matches.length?"":"open"}><summary>Why ${failures.length} other space${failures.length===1?" doesn't":"s don't"} fit</summary><div class="fitfailurelist">${failures.map(failure=>{
    const S=state.storages.find(s=>s.id===failure.storageId);
    const path=esc(S?storageBreadcrumb(S):failure.storageName);
    const remedies=S?fitRemediesForFailure(item,S,settings):[];
    const remedyHtml=remedies.length?`<div class="fitremedies"><strong>Would fit if:</strong>${remedies.map(remedy=>`<span>${esc(fitRemedyText(remedy,state.unit))}</span>`).join("")}<small>Simulation only. Only reduce measurement buffers or change orientation/constraints when the physical item and furniture make that safe.</small></div>`:"";
    if(failure.reason==="constraints"){
      const blockers=[failure.blockedCount?`${failure.blockedCount} blocked zone${failure.blockedCount===1?"":"s"}`:"",failure.dividerCount?`${failure.dividerCount} divider${failure.dividerCount===1?"":"s"}`:""].filter(Boolean).join(" · ");
      return `<div class="fitfailure"><div><div class="fitmatchtitle">${path}</div><div class="fitfailurewhy"><strong>Dimensions fit, but no valid floor position remains.</strong>${blockers?` ${esc(blockers)} block the allowed placement.`:" Current geometry rules block the allowed placement."}</div><div class="fitfailuremeta">Usable ${fmt(failure.W)} × ${fmt(failure.D)} × ${fmt(failure.H)} ${esc(state.unit)} · allowed orientation ${fmt(failure.w)} × ${fmt(failure.d)} × ${fmt(failure.h)}</div>${remedyHtml}</div><button class="btn soft" type="button" data-open-fit-storage="${failure.storageId}">Open space</button></div>`;
    }
    const shortfalls=[
      failure.widthDeficit>1e-9?`W +${fmt(failure.widthDeficit)}`:"",
      failure.depthDeficit>1e-9?`D +${fmt(failure.depthDeficit)}`:"",
      failure.heightDeficit>1e-9?`H +${fmt(failure.heightDeficit)}`:""
    ].filter(Boolean).join(" / ");
    return `<div class="fitfailure"><div><div class="fitmatchtitle">${path}</div><div class="fitfailurewhy"><strong>Short by ${esc(shortfalls||"current fit allowance")} ${esc(state.unit)}</strong> in the closest allowed orientation.</div><div class="fitfailuremeta">Usable ${fmt(failure.W)} × ${fmt(failure.D)} × ${fmt(failure.H)} ${esc(state.unit)} · closest orientation ${fmt(failure.w)} × ${fmt(failure.d)} × ${fmt(failure.h)} · includes current fit tolerance</div>${remedyHtml}</div><button class="btn soft" type="button" data-open-fit-storage="${failure.storageId}">Open space</button></div>`;
  }).join("")}</div></details>`:"";
  $("itemFitList").innerHTML=matchHtml+failureHtml;
  $("itemFitList").querySelectorAll("[data-fit-capacity-btn]").forEach(btn=>btn.addEventListener("click",()=>{
    const storageId=btn.dataset.fitCapacityBtn,S=state.storages.find(s=>s.id===storageId),out=$("itemFitList").querySelector(`[data-fit-capacity="${storageId}"]`);
    if(!S||!out)return;
    btn.disabled=true;btn.textContent="Calculating…";
    const result=maxCopiesInStorage(item,S,settings);
    capacityResults.set(storageId,result);
    const mix=result.stackedCount
      ? `${result.floorCount} floor + ${result.stackedCount} stacked`
      : `${result.floorCount} floor`;
    out.textContent=result.exact
      ? `${result.count} maximum · ${mix}`
      : `At least ${result.count} fit · ${mix} · search capped`;
    const structure=packingStackSummaryText(result.stackSummary);
    if(structure)out.textContent+=` · ${structure}`;
    out.textContent+=result.exact?" · open the packing to inspect, edit or save it":" · open the best packing found before the search cap";
    const ownedResult=ownedCapacityResult(unallocatedOwned,result,item);
    if(ownedResult)out.textContent+=` · ${ownedResult.count} can use unallocated owned stock`;
    const ownedBtn=$("itemFitList").querySelector(`[data-open-owned-capacity="${storageId}"]`);
    if(ownedBtn){ownedBtn.disabled=!ownedResult;ownedBtn.textContent=ownedResult?`Open ${ownedResult.count} owned`:(unallocatedOwned?"No capacity for owned":"No unallocated stock")}
    const openBtn=$("itemFitList").querySelector(`[data-open-capacity-layout="${storageId}"]`);
    if(openBtn)openBtn.disabled=!result.layout.length;
    btn.textContent=result.exact?"Recalculate":"Try again";btn.disabled=false;
  }));
  distributionBtn.onclick=()=>{
    const previous=state.ownedDistributionSessions?.[item.id]||null;
    if(!previous&&(!unallocatedOwned||!matches.length))return;
    if(previous&&!unallocatedOwned){
      persistOwnedDistributionSession(item.id,null);
      renderDistributionSession(null);
      distributionStatus.textContent="All owned copies are now committed to active chosen plans. The remaining distribution work session was closed.";
      return;
    }
    distributionBtn.disabled=true;distributionBtn.textContent="Planning…";
    distributionStatus.textContent=previous?"Recalculating safe remaining work…":"Calculating safe capacity across compatible spaces…";
    const rebased=calculateOwnedDistributionSession(item,settings,unallocatedOwned,previous,matches);
    persistOwnedDistributionSession(item.id,rebased.session);renderDistributionSession(rebased.session);
    if(previous&&(rebased.carriedAllocations||rebased.resetAllocations)){
      distributionStatus.textContent+=" Recalculation preserved "+rebased.carriedAllocations+" unchanged progress item"+(rebased.carriedAllocations===1?"":"s")+
        (rebased.resetAllocations?" and reset "+rebased.resetAllocations+" changed item"+(rebased.resetAllocations===1?"":"s")+".":".");
    }
  };
  $("itemFitList").querySelectorAll("[data-open-owned-capacity]").forEach(btn=>btn.addEventListener("click",()=>{
    const result=capacityResults.get(btn.dataset.openOwnedCapacity),owned=ownedCapacityResult(unallocatedOwned,result,item);
    if(owned)openCapacityPacking(btn.dataset.openOwnedCapacity,owned);
  }));
  $("itemFitList").querySelectorAll("[data-open-capacity-layout]").forEach(btn=>btn.addEventListener("click",()=>{
    const result=capacityResults.get(btn.dataset.openCapacityLayout);
    if(result)openCapacityPacking(btn.dataset.openCapacityLayout,result);
  }));
  $("itemFitList").querySelectorAll("[data-open-fit-storage]").forEach(btn=>btn.addEventListener("click",()=>openCompatibleStorage(btn.dataset.openFitStorage)));
  itemFitModalOpen=true;
  $("itemFitModal").classList.add("open");
  $("itemFitModal").setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function openFitAuditModal(){
  save();
  const settings=fitLookupSettings(),audit=projectFitAudit(state.boxes,state.storages,settings);
  const settingBits=[
    settings.clearanceEnabled?`${fmt(settings.clearance)} ${state.unit} wall clearance`:"no wall clearance",
    settings.fitTolerance>0?`${fmt(settings.fitTolerance)} ${state.unit} fit tolerance`:"no fit tolerance",
    settings.uprightOnly?"all items forced upright":"item orientation rules"
  ];
  $("fitAuditSubtitle").textContent=`${audit.totals.items} organizer${audit.totals.items===1?"":"s"} × ${audit.totals.storages} storage space${audit.totals.storages===1?"":"s"} · ${settingBits.join(" · ")}`;

  const roomSelect=$("fitAuditRoom"),search=$("fitAuditSearch"),focus=$("fitAuditFocus"),clear=$("fitAuditClear");
  const roomsWithStorage=(state.rooms||[]).map(room=>{
    const storageIds=state.storages.filter(S=>projectStorageContext(S.id).room?.id===room.id).map(S=>S.id);
    return storageIds.length?{id:room.id,name:room.name||"Room",storageIds}:null;
  }).filter(Boolean);
  roomSelect.innerHTML='<option value="">All rooms</option>'+roomsWithStorage.map(room=>`<option value="${room.id}">${esc(room.name)} · ${room.storageIds.length}</option>`).join("");
  search.value="";roomSelect.value="";focus.value="all";

  const storageById=new Map(state.storages.map(S=>[S.id,S]));
  const renderAuditView=()=>{
    const room=roomsWithStorage.find(row=>row.id===roomSelect.value)||null;
    const scopeView=projectFitAuditView(audit,{
      query:search.value,
      storageIds:room?room.storageIds:null,
      focus:"all"
    });
    const view=projectFitAuditView(audit,{
      query:search.value,
      storageIds:room?room.storageIds:null,
      focus:focus.value
    });
    const insights=projectFitAuditInsights(scopeView);
    const scope=room?` in ${room.name}`:"";
    $("fitAuditSummary").textContent=view.totals.pairs
      ? `${view.totals.fitPairs} of ${view.totals.pairs} visible organizer-space pairs fit now${scope}. ${view.totals.nearPairs} have actionable simulated remedies. ${view.totals.missPairs} are hard misses under the current geometry and handling rules.`
      : `No organizer-space pairs match the current audit filters${scope}.`;
    $("fitAuditFilterMeta").textContent=`Showing ${view.totals.items} organizer${view.totals.items===1?"":"s"} × ${view.totals.storages} storage space${view.totals.storages===1?"":"s"} · ${view.totals.pairs} pair${view.totals.pairs===1?"":"s"}`;

    const broadest=insights.broadest;
    const constrained=insights.fewestFits;
    $("fitAuditInsights").innerHTML=scopeView.totals.pairs?`
      <article class="fitauditinsight">
        <span>Fits most visible spaces</span>
        <strong>${broadest?esc(broadest.itemName):"—"}</strong>
        <small>${broadest?`${broadest.fitCount}/${scopeView.totals.storages} fit · ${broadest.nearCount} near`:"No organizers"}</small>
        ${broadest?`<button class="btn soft" type="button" data-audit-insight-item="${broadest.itemId}">Find spaces</button>`:""}
      </article>
      <article class="fitauditinsight">
        <span>Fewest current fits</span>
        <strong>${constrained?esc(storageById.get(constrained.id)?storageBreadcrumb(storageById.get(constrained.id)):constrained.name):"—"}</strong>
        <small>${constrained?`${constrained.fitCount}/${scopeView.totals.items} organizers fit · ${constrained.nearCount} near`:"No storage spaces"}</small>
        ${constrained?`<button class="btn soft" type="button" data-audit-insight-storage="${constrained.id}">Open space</button>`:""}
      </article>
      <article class="fitauditinsight">
        <span>No current fit</span>
        <strong>${insights.noFitItems}</strong>
        <small>organizer${insights.noFitItems===1?"":"s"} with zero fits in the visible storage scope</small>
        <button class="btn soft" type="button" data-audit-insight-focus="no-fit" ${insights.noFitItems?"":"disabled"}>Show</button>
      </article>
      <article class="fitauditinsight">
        <span>Near-miss opportunities</span>
        <strong>${insights.nearItems}</strong>
        <small>organizer${insights.nearItems===1?"":"s"} with at least one simulated remedy</small>
        <button class="btn soft" type="button" data-audit-insight-focus="near" ${insights.nearItems?"":"disabled"}>Show</button>
      </article>`
      :'<div class="fitauditinsightempty">No insight data for the current room/search scope.</div>';

    const head=`<thead><tr><th class="fitaudititemcol">Organizer</th>${view.storages.map(col=>{
      const S=storageById.get(col.id);
      return `<th title="${esc(S?storageBreadcrumb(S):col.name)}"><span>${esc(col.name)}</span><small>${esc(S?projectStorageContext(S.id).roomName||"":"")}</small></th>`;
    }).join("")}</tr></thead>`;
    const body=`<tbody>${view.rows.map(row=>`<tr><th class="fitaudititemcol"><div class="fitaudititem"><strong>${esc(row.itemName)}</strong><small>${fmt(row.w)} × ${fmt(row.d)} × ${fmt(row.h)} ${esc(state.unit)} · ${row.fitCount} fit · ${row.nearCount} near · ${row.missCount} miss</small><button class="btn soft" type="button" data-audit-item="${row.itemId}">Find spaces</button></div></th>${row.cells.map(cell=>{
      if(cell.status==="fit"){
        return `<td><button class="fitauditcell fit" type="button" data-audit-storage="${cell.storageId}" title="Open storage"><strong>Fits</strong><span>${fmt(cell.fit.tightestMargin)} ${esc(state.unit)} margin</span><small>limiting ${esc(cell.fit.tightestAxis)}</small></button></td>`;
      }
      if(cell.status==="near"){
        const remedy=cell.remedies[0],text=fitRemedyText(remedy,state.unit);
        return `<td><button class="fitauditcell near" type="button" data-audit-storage="${cell.storageId}" title="Open storage"><strong>Near miss</strong><span>${esc(text)}</span><small>${cell.remedies.length} simulated fix${cell.remedies.length===1?"":"es"}</small></button></td>`;
      }
      const failure=cell.failure;
      let detail="Current rules prevent a fit";
      if(failure?.reason==="constraints")detail="Blocked by modeled geometry";
      else if(failure){
        const parts=[
          failure.widthDeficit>1e-9?`W +${fmt(failure.widthDeficit)}`:"",
          failure.depthDeficit>1e-9?`D +${fmt(failure.depthDeficit)}`:"",
          failure.heightDeficit>1e-9?`H +${fmt(failure.heightDeficit)}`:""
        ].filter(Boolean);
        if(parts.length)detail=parts.join(" / ")+" "+state.unit;
      }
      return `<td><button class="fitauditcell miss" type="button" data-audit-storage="${cell.storageId}" title="Open storage"><strong>Doesn't fit</strong><span>${esc(detail)}</span><small>open space to review</small></button></td>`;
    }).join("")}</tr>`).join("")}</tbody>`;
    $("fitAuditTable").innerHTML=view.rows.length&&view.storages.length?head+body:'<tbody><tr><td class="empty">Nothing matches these audit filters.</td></tr></tbody>';

    $("fitAuditTable").querySelectorAll("[data-audit-item]").forEach(btn=>btn.addEventListener("click",()=>{
      const item=boxById(btn.dataset.auditItem);if(!item)return;
      closeFitAuditModal();editingBox=item.id;
      if($("itemSearch"))$("itemSearch").value="";
      renderBoxList();loadBoxEditor();openItemFitModal();
    }));
    $("fitAuditTable").querySelectorAll("[data-audit-storage]").forEach(btn=>btn.addEventListener("click",()=>{
      const storageId=btn.dataset.auditStorage;closeFitAuditModal();openCompatibleStorage(storageId);
    }));
    $("fitAuditInsights").querySelectorAll("[data-audit-insight-item]").forEach(btn=>btn.addEventListener("click",()=>{
      const item=boxById(btn.dataset.auditInsightItem);if(!item)return;
      closeFitAuditModal();editingBox=item.id;
      if($("itemSearch"))$("itemSearch").value="";
      renderBoxList();loadBoxEditor();openItemFitModal();
    }));
    $("fitAuditInsights").querySelectorAll("[data-audit-insight-storage]").forEach(btn=>btn.addEventListener("click",()=>{
      closeFitAuditModal();openCompatibleStorage(btn.dataset.auditInsightStorage);
    }));
    $("fitAuditInsights").querySelectorAll("[data-audit-insight-focus]").forEach(btn=>btn.addEventListener("click",()=>{
      focus.value=btn.dataset.auditInsightFocus||"all";renderAuditView();
    }));
  };

  search.oninput=renderAuditView;
  roomSelect.onchange=renderAuditView;
  focus.onchange=renderAuditView;
  clear.onclick=()=>{
    search.value="";roomSelect.value="";focus.value="all";renderAuditView();search.focus();
  };
  renderAuditView();

  fitAuditModalOpen=true;
  $("fitAuditModal").classList.add("open");
  $("fitAuditModal").setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
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
  if(candidate.ownedDistributionSessions!=null&&(typeof candidate.ownedDistributionSessions!=="object"||Array.isArray(candidate.ownedDistributionSessions)))return "Owned distribution sessions are malformed.";
  for(const [itemId,session] of Object.entries(candidate.ownedDistributionSessions||{})){
    if(!session||typeof session!=="object"||session.itemId!==itemId||!Array.isArray(session.allocations))return "An owned distribution session is malformed.";
    for(const allocation of session.allocations){
      if(!allocation||typeof allocation!=="object"||!allocation.storageId||!["pending","opened","done"].includes(allocation.status||"pending"))return "An owned distribution allocation is malformed.";
      if(!allocation.result||!Array.isArray(allocation.result.layout))return "An owned distribution allocation has no packing layout.";
      const available=allocation.result.layout.length,assigned=Math.max(0,Math.floor(Number(allocation.assigned)||0)),capacity=Math.max(0,Math.floor(Number(allocation.capacity)||0));
      if(assigned>available||capacity>available)return "An owned distribution allocation exceeds its stored packing geometry.";
    }
  }
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
    if(s.measuredAt!=null&&typeof s.measuredAt!=="string")return `Storage “${s.name||s.id}” has invalid measurement verification metadata.`;
    if(s.measurementSignature!=null&&typeof s.measurementSignature!=="string")return `Storage “${s.name||s.id}” has invalid measurement verification metadata.`;
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

function projectStorageContext(storageId,options={}){
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const rooms=Array.isArray(options.rooms)?options.rooms:state.rooms;
  const storage=storages.find(s=>s.id===storageId)||null;
  const furnishing=storage?furniture.find(f=>f.id===storage.furnitureId)||null:null;
  const room=furnishing?rooms.find(r=>r.id===furnishing.roomId)||null:null;
  const storageName=String(storage?.name||"Storage");
  const furnitureName=String(furnishing?.name||"");
  const roomName=String(room?.name||"");
  const path=[roomName,furnitureName,storageName].filter(Boolean).join(" → ")||storageName;
  return {storageId:String(storageId||""),storage,room,furniture:furnishing,roomName,furnitureName,storageName,path,sortKey:path.toLocaleLowerCase()};
}
function prioritizedInstallOrderForRoom(roomId,options={}){
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const entryIds=new Set(entries.map(entry=>entry.storageId));
  const baseOrder=[],seen=new Set();
  const requestedOrder=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  for(const id of requestedOrder){if(entryIds.has(id)&&!seen.has(id)){seen.add(id);baseOrder.push(id)}}
  for(const entry of entries){if(!seen.has(entry.storageId)){seen.add(entry.storageId);baseOrder.push(entry.storageId)}}
  const roomFurnitureIds=new Set(furniture.filter(item=>item.roomId===roomId).map(item=>item.id));
  const roomStorageIds=new Set(storages.filter(storage=>roomFurnitureIds.has(storage.furnitureId)).map(storage=>storage.id));
  const activeIds=new Set(entries.filter(entry=>entry.status==="ready"||entry.status==="waiting").map(entry=>entry.storageId));
  const roomActive=baseOrder.filter(id=>activeIds.has(id)&&roomStorageIds.has(id));
  const otherActive=baseOrder.filter(id=>activeIds.has(id)&&!roomStorageIds.has(id));
  if(!roomActive.length)return {order:baseOrder,changed:false,movedIds:[],activeCount:activeIds.size};
  const reorderedActive=[...roomActive,...otherActive];
  let activeIndex=0;
  const order=baseOrder.map(id=>activeIds.has(id)?reorderedActive[activeIndex++]:id);
  const changed=order.some((id,index)=>id!==baseOrder[index]);
  return {order,changed,movedIds:roomActive,activeCount:activeIds.size};
}
function installOrderImpact(proposedOrder,options={}){
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const rooms=Array.isArray(options.rooms)?options.rooms:state.rooms;
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const entryIds=new Set(entries.map(entry=>entry.storageId));
  const baseOrder=[],baseSeen=new Set();
  const requestedBase=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  for(const id of requestedBase){if(entryIds.has(id)&&!baseSeen.has(id)){baseSeen.add(id);baseOrder.push(id)}}
  for(const entry of entries){if(!baseSeen.has(entry.storageId)){baseSeen.add(entry.storageId);baseOrder.push(entry.storageId)}}
  const order=[],seen=new Set();
  for(const id of proposedOrder||[]){if(entryIds.has(id)&&!seen.has(id)){seen.add(id);order.push(id)}}
  for(const id of baseOrder){if(!seen.has(id)){seen.add(id);order.push(id)}}
  const changed=order.some((id,index)=>id!==baseOrder[index]);
  if(!changed)return {changed:false,order:baseOrder,gainedReady:[],lostReady:[],transitions:[]};
  const plans=Array.isArray(options.plans)?options.plans:entries.filter(entry=>entry.status!=="stale"&&entry.plan).map(entry=>entry.plan);
  const ownedById=options.ownedById&&typeof options.ownedById==="object"
    ?options.ownedById:Object.fromEntries(state.boxes.map(item=>[item.id,item.ownedQty||0]));
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const before=new Map(entries.map(entry=>[entry.storageId,entry.status]));
  const after=computeInstallAllocation(plans,ownedById,installedPlanIds,order);
  const transitions=[];
  for(const entry of after.entries){
    const from=before.get(entry.storageId),to=entry.status;
    if(from===to||!((from==="ready"||from==="waiting")&&(to==="ready"||to==="waiting")))continue;
    const context=projectStorageContext(entry.storageId,{furniture,storages,rooms});
    transitions.push({storageId:entry.storageId,from,to,path:context.path,roomId:context.room?.id||""});
  }
  const gainedReady=transitions.filter(item=>item.from==="waiting"&&item.to==="ready");
  const lostReady=transitions.filter(item=>item.from==="ready"&&item.to==="waiting");
  return {changed:true,order,gainedReady,lostReady,transitions};
}
function installOrderMoveImpact(storageId,delta,options={}){
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const entryIds=new Set(entries.map(entry=>entry.storageId));
  const order=[],seen=new Set();
  const requested=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  for(const id of requested){if(entryIds.has(id)&&!seen.has(id)){seen.add(id);order.push(id)}}
  for(const entry of entries){if(!seen.has(entry.storageId)){seen.add(entry.storageId);order.push(entry.storageId)}}
  const i=order.indexOf(storageId),j=i+delta;
  if(i<0||j<0||j>=order.length)return {changed:false,order,gainedReady:[],lostReady:[],transitions:[]};
  [order[i],order[j]]=[order[j],order[i]];
  return installOrderImpact(order,{...options,install,installOrder:requested});
}
function suggestInstallOrder(options={}){
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const entryIds=new Set(entries.map(entry=>entry.storageId));
  const baseOrder=[],seen=new Set();
  const requested=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  for(const id of requested){if(entryIds.has(id)&&!seen.has(id)){seen.add(id);baseOrder.push(id)}}
  for(const entry of entries){if(!seen.has(entry.storageId)){seen.add(entry.storageId);baseOrder.push(entry.storageId)}}
  const activeEntries=entries.filter(entry=>entry.status==="ready"||entry.status==="waiting");
  const activeIds=baseOrder.filter(id=>activeEntries.some(entry=>entry.storageId===id));
  const currentReady=activeEntries.filter(entry=>entry.status==="ready").length;
  if(activeIds.length<2||!activeEntries.some(entry=>entry.status==="waiting")){
    return {improved:false,exact:true,nodes:0,currentReady,bestReady:currentReady,order:baseOrder,gainedReady:[],lostReady:[],transitions:[]};
  }
  const planByStorage=new Map(entries.filter(entry=>entry.plan).map(entry=>[entry.storageId,entry.plan]));
  const plans=Array.isArray(options.plans)?options.plans:entries.filter(entry=>entry.status!=="stale"&&entry.plan).map(entry=>entry.plan);
  const ownedById=options.ownedById&&typeof options.ownedById==="object"
    ?options.ownedById:Object.fromEntries(state.boxes.map(item=>[item.id,item.ownedQty||0]));
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const available={};
  for(const [id,qty] of Object.entries(ownedById||{}))available[id]=Math.max(0,Math.floor(Number(qty)||0));
  for(const entry of entries){
    if(entry.status!=="installed"||!entry.plan)continue;
    for(const [id,qty] of Object.entries(layoutCounts(entry.plan.layout||[])))available[id]=Math.max(0,(available[id]||0)-qty);
  }
  const candidates=activeIds.map((storageId,index)=>{
    const plan=planByStorage.get(storageId),req=layoutCounts(plan?.layout||[]);
    const total=Object.values(req).reduce((sum,qty)=>sum+qty,0);
    const scarcity=Object.entries(req).reduce((sum,[id,qty])=>sum+qty/Math.max(1,available[id]||0),0);
    return {storageId,index,req,total,scarcity};
  });
  const currentReadyIds=new Set(activeEntries.filter(entry=>entry.status==="ready").map(entry=>entry.storageId));
  let bestIds=new Set(currentReadyIds),bestCount=currentReady,bestOverlap=currentReady;
  const consider=ids=>{
    const set=ids instanceof Set?ids:new Set(ids),count=set.size,overlap=[...set].filter(id=>currentReadyIds.has(id)).length;
    if(count>bestCount||(count===bestCount&&overlap>bestOverlap)){bestIds=new Set(set);bestCount=count;bestOverlap=overlap}
  };
  const greedy=ordered=>{
    const remaining={...available},selected=[];
    for(const candidate of ordered){
      const fits=Object.entries(candidate.req).every(([id,qty])=>(remaining[id]||0)>=qty);
      if(!fits)continue;
      for(const [id,qty] of Object.entries(candidate.req))remaining[id]=(remaining[id]||0)-qty;
      selected.push(candidate.storageId);
    }
    consider(selected);
  };
  greedy(candidates);
  greedy(candidates.slice().sort((a,b)=>a.total-b.total||a.scarcity-b.scarcity||a.index-b.index));
  greedy(candidates.slice().sort((a,b)=>a.scarcity-b.scarcity||a.total-b.total||a.index-b.index));
  greedy(candidates.slice().sort((a,b)=>Object.keys(a.req).length-Object.keys(b.req).length||a.total-b.total||a.index-b.index));

  const searchCandidates=candidates.slice().sort((a,b)=>a.scarcity-b.scarcity||a.total-b.total||a.index-b.index);
  const resourceIds=[...new Set(searchCandidates.flatMap(candidate=>Object.keys(candidate.req)))].sort();
  const reqVectors=searchCandidates.map(candidate=>resourceIds.map(id=>candidate.req[id]||0));
  const startRemaining=resourceIds.map(id=>available[id]||0);
  const nodeLimit=Math.max(1,Math.floor(Number(options.nodeLimit)||INSTALL_ORDER_SEARCH_LIMIT));
  let nodes=0,truncated=false;
  const memo=new Map(),selected=[];
  const dfs=(index,remaining)=>{
    if(++nodes>nodeLimit){truncated=true;return}
    if(selected.length+(searchCandidates.length-index)<bestCount)return;
    if(index>=searchCandidates.length){consider(selected);return}
    const key=index+"|"+remaining.join(",");
    const seenCount=memo.get(key);
    if(seenCount!=null&&seenCount>=selected.length)return;
    memo.set(key,selected.length);
    const req=reqVectors[index];
    let fits=true;
    for(let i=0;i<req.length;i++)if(req[i]>remaining[i]){fits=false;break}
    if(fits){
      selected.push(searchCandidates[index].storageId);
      dfs(index+1,remaining.map((qty,i)=>qty-req[i]));
      selected.pop();
      if(truncated&&nodes>nodeLimit)return;
    }
    dfs(index+1,remaining);
  };
  dfs(0,startRemaining);

  const selectedFirst=activeIds.filter(id=>bestIds.has(id)),rest=activeIds.filter(id=>!bestIds.has(id));
  const reorderedActive=[...selectedFirst,...rest];
  let activeIndex=0;
  const order=baseOrder.map(id=>activeIds.includes(id)?reorderedActive[activeIndex++]:id);
  const impact=installOrderImpact(order,{...options,install,installOrder:baseOrder,plans,ownedById,installedPlanIds});
  const bestReady=currentReady+impact.gainedReady.length-impact.lostReady.length;
  return {
    improved:bestReady>currentReady,exact:!truncated,nodes,currentReady,bestReady,order:impact.order,
    gainedReady:impact.gainedReady,lostReady:impact.lostReady,transitions:impact.transitions
  };
}
function installAllocationSnapshot(ownedById,options={}){
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const plans=Array.isArray(options.plans)?options.plans:entries.filter(entry=>entry.status!=="stale"&&entry.plan).map(entry=>entry.plan);
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const requestedOrder=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  const base=computeInstallAllocation(plans,ownedById,installedPlanIds,requestedOrder);
  const byStorage=new Map(base.entries.map(entry=>[entry.storageId,entry]));
  for(const entry of entries){if(entry.status==="stale")byStorage.set(entry.storageId,entry)}
  const order=[],seen=new Set();
  for(const id of requestedOrder){if(byStorage.has(id)&&!seen.has(id)){seen.add(id);order.push(id)}}
  for(const entry of entries){if(byStorage.has(entry.storageId)&&!seen.has(entry.storageId)){seen.add(entry.storageId);order.push(entry.storageId)}}
  for(const plan of plans){if(byStorage.has(plan.storageId)&&!seen.has(plan.storageId)){seen.add(plan.storageId);order.push(plan.storageId)}}
  return {entries:order.map(id=>byStorage.get(id)).filter(Boolean),remainingOwned:base.remainingOwned};
}
function installScenarioTransitions(beforeAllocation,afterAllocation,options={}){
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const rooms=Array.isArray(options.rooms)?options.rooms:state.rooms;
  const beforeEntries=Array.isArray(beforeAllocation?.entries)?beforeAllocation.entries:[];
  const afterEntries=Array.isArray(afterAllocation?.entries)?afterAllocation.entries:[];
  const before=new Map(beforeEntries.map(entry=>[entry.storageId,entry.status]));
  const after=new Map(afterEntries.map(entry=>[entry.storageId,entry.status]));
  const ids=[],seen=new Set();
  for(const entry of afterEntries){if(!seen.has(entry.storageId)){seen.add(entry.storageId);ids.push(entry.storageId)}}
  for(const entry of beforeEntries){if(!seen.has(entry.storageId)){seen.add(entry.storageId);ids.push(entry.storageId)}}
  const transitions=[];
  for(const storageId of ids){
    const from=before.get(storageId),to=after.get(storageId);
    if(from===to||!((from==="ready"||from==="waiting")&&(to==="ready"||to==="waiting")))continue;
    const context=projectStorageContext(storageId,{furniture,storages,rooms});
    transitions.push({storageId,from,to,path:context.path,roomId:context.room?.id||""});
  }
  return {
    transitions,
    gainedReady:transitions.filter(item=>item.from==="waiting"&&item.to==="ready"),
    lostReady:transitions.filter(item=>item.from==="ready"&&item.to==="waiting")
  };
}
function stockUnlockAnalysis(options={}){
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const plans=Array.isArray(options.plans)?options.plans:entries.filter(entry=>entry.status!=="stale"&&entry.plan).map(entry=>entry.plan);
  const ownedById=options.ownedById&&typeof options.ownedById==="object"
    ?{...options.ownedById}:Object.fromEntries(state.boxes.map(item=>[item.id,item.ownedQty||0]));
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const installOrder=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  const baseline=suggestInstallOrder({
    ...options,install,plans,ownedById,installedPlanIds,installOrder,
    nodeLimit:Math.max(1,Math.floor(Number(options.baselineNodeLimit)||INSTALL_ORDER_SEARCH_LIMIT))
  });
  const baselineBest=baseline.bestReady;
  const baselineAllocation=computeInstallAllocation(plans,ownedById,installedPlanIds,baseline.order);
  const requirements=aggregateRequiredCounts(plans);
  const itemLookup=typeof options.itemLookup==="function"?options.itemLookup:boxById;
  const purchaseRows=Array.isArray(options.purchaseRows)?options.purchaseRows:projectProcurement(plans).rows;
  const purchaseById=new Map(purchaseRows.map(row=>[row.id,row]));
  const scarce=Object.entries(requirements).map(([id,qty])=>({
    id,required:qty,owned:Math.max(0,Math.floor(Number(ownedById[id])||0)),item:itemLookup(id)
  })).filter(row=>row.required>row.owned)
    .sort((a,b)=>(a.required-a.owned)-(b.required-b.owned)||String(a.item?.name||a.id).localeCompare(String(b.item?.name||b.id)));
  const itemLimit=Math.max(1,Math.floor(Number(options.itemLimit)||STOCK_UNLOCK_ITEM_LIMIT));
  const candidates=scarce.slice(0,itemLimit),candidateCapped=scarce.length>candidates.length;
  const nodeLimit=Math.max(1,Math.floor(Number(options.nodeLimit)||STOCK_UNLOCK_SEARCH_LIMIT));
  const rows=[];
  let allExact=baseline.exact;
  for(const candidate of candidates){
    const hypotheticalOwned={...ownedById,[candidate.id]:candidate.owned+1};
    const hypotheticalInstall=installAllocationSnapshot(hypotheticalOwned,{install,plans,installedPlanIds,installOrder});
    const suggestion=suggestInstallOrder({
      ...options,install:hypotheticalInstall,plans,ownedById:hypotheticalOwned,installedPlanIds,installOrder,nodeLimit
    });
    allExact=allExact&&suggestion.exact;
    if(suggestion.bestReady<=baselineBest)continue;
    const candidateAllocation=computeInstallAllocation(plans,hypotheticalOwned,installedPlanIds,suggestion.order);
    const impact=installScenarioTransitions(baselineAllocation,candidateAllocation,options);
    const purchase=purchaseById.get(candidate.id),item=candidate.item;
    rows.push({
      id:candidate.id,name:item?.name||purchase?.name||"Deleted item",sku:item?.sku||purchase?.sku||"",
      bestReady:suggestion.bestReady,gain:suggestion.bestReady-baselineBest,exact:baseline.exact&&suggestion.exact,
      candidateSearchExact:suggestion.exact,boughtQty:Math.max(0,Math.floor(Number(purchase?.boughtQty)||0)),
      remainingQty:Math.max(0,Math.floor(Number(purchase?.remainingQty)||0)),url:safeUrl(item?.url||purchase?.url),
      order:suggestion.order,gainedReady:impact.gainedReady,lostReady:impact.lostReady,transitions:impact.transitions
    });
  }
  rows.sort((a,b)=>b.gain-a.gain||Number(b.boughtQty>0)-Number(a.boughtQty>0)||a.name.localeCompare(b.name));

  let bundle=null,bundleScenarios=0,bundleTruncated=false,bundleAllExact=baseline.exact;
  const bundleItemLimit=Math.max(1,Math.floor(Number(options.bundleItemLimit)||STOCK_UNLOCK_BUNDLE_ITEM_LIMIT));
  const bundleCandidates=scarce.slice(0,bundleItemLimit).map(row=>({...row,maxAdd:Math.max(0,row.required-row.owned)}));
  const bundleCandidateCapped=scarce.length>bundleCandidates.length;
  const bundleUnitLimit=Math.max(2,Math.floor(Number(options.bundleUnitLimit)||STOCK_UNLOCK_BUNDLE_UNIT_LIMIT));
  const bundleScenarioLimit=Math.max(1,Math.floor(Number(options.bundleScenarioLimit)||STOCK_UNLOCK_BUNDLE_SCENARIO_LIMIT));
  if(!rows.length&&bundleCandidates.length&&baselineBest<entries.filter(entry=>entry.status==="ready"||entry.status==="waiting").length){
    const additions=Array(bundleCandidates.length).fill(0);
    const evaluateBundle=totalUnits=>{
      if(bundleScenarios>=bundleScenarioLimit){bundleTruncated=true;return}
      bundleScenarios++;
      const hypotheticalOwned={...ownedById};
      const parts=[];
      for(let i=0;i<additions.length;i++){
        const qty=additions[i];if(!qty)continue;
        const candidate=bundleCandidates[i],purchase=purchaseById.get(candidate.id);
        hypotheticalOwned[candidate.id]=(hypotheticalOwned[candidate.id]||0)+qty;
        parts.push({
          id:candidate.id,qty,name:candidate.item?.name||purchase?.name||"Deleted item",
          boughtQty:Math.max(0,Math.floor(Number(purchase?.boughtQty)||0)),
          remainingQty:Math.max(0,Math.floor(Number(purchase?.remainingQty)||0))
        });
      }
      const hypotheticalInstall=installAllocationSnapshot(hypotheticalOwned,{install,plans,installedPlanIds,installOrder});
      const suggestion=suggestInstallOrder({
        ...options,install:hypotheticalInstall,plans,ownedById:hypotheticalOwned,installedPlanIds,installOrder,nodeLimit
      });
      bundleAllExact=bundleAllExact&&suggestion.exact;
      if(suggestion.bestReady<=baselineBest)return;
      const candidateAllocation=computeInstallAllocation(plans,hypotheticalOwned,installedPlanIds,suggestion.order);
      const impact=installScenarioTransitions(baselineAllocation,candidateAllocation,options);
      const candidate={
        totalUnits,parts,bestReady:suggestion.bestReady,gain:suggestion.bestReady-baselineBest,
        exact:baseline.exact&&suggestion.exact,order:suggestion.order,
        gainedReady:impact.gainedReady,lostReady:impact.lostReady,transitions:impact.transitions
      };
      const partKey=parts.map(part=>part.id+":"+part.qty).join("|");
      const currentKey=bundle?.parts?.map(part=>part.id+":"+part.qty).join("|")||"";
      if(!bundle||candidate.gain>bundle.gain||
        (candidate.gain===bundle.gain&&parts.length<bundle.parts.length)||
        (candidate.gain===bundle.gain&&parts.length===bundle.parts.length&&partKey.localeCompare(currentKey)<0))bundle=candidate;
    };
    const enumerate=(index,remaining,totalUnits)=>{
      if(bundleTruncated)return;
      if(index===bundleCandidates.length){
        if(remaining===0)evaluateBundle(totalUnits);
        return;
      }
      const max=Math.min(bundleCandidates[index].maxAdd,remaining);
      for(let qty=0;qty<=max;qty++){
        additions[index]=qty;
        enumerate(index+1,remaining-qty,totalUnits);
        if(bundleTruncated)break;
      }
      additions[index]=0;
    };
    for(let totalUnits=2;totalUnits<=bundleUnitLimit;totalUnits++){
      const before=bundle;
      enumerate(0,totalUnits,totalUnits);
      if(bundle&&bundle!==before)break;
      if(bundleTruncated)break;
    }
  }
  return {
    baselineReady:baselineBest,baselineExact:baseline.exact,rows,allExact,candidateCapped,
    analyzedCandidates:candidates.length,totalCandidates:scarce.length,
    bundle,bundleScenarios,bundleTruncated,bundleAllExact,bundleCandidateCapped,
    bundleAnalyzedCandidates:bundleCandidates.length,bundleUnitLimit
  };
}
function purchasedArrivalAnalysis(options={}){
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const plans=Array.isArray(options.plans)?options.plans:entries.filter(entry=>entry.status!=="stale"&&entry.plan).map(entry=>entry.plan);
  const ownedById=options.ownedById&&typeof options.ownedById==="object"
    ?{...options.ownedById}:Object.fromEntries(state.boxes.map(item=>[item.id,item.ownedQty||0]));
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const installOrder=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  const purchaseRows=Array.isArray(options.purchaseRows)?options.purchaseRows:projectProcurement(plans).rows;
  const itemLookup=typeof options.itemLookup==="function"?options.itemLookup:boxById;
  const purchased=purchaseRows.map(row=>{
    const requestedQty=Math.max(0,Math.floor(Number(row.boughtQty)||0));
    const receipt=purchaseReceiptResult(ownedById[row.id],requestedQty,requestedQty);
    return {
      id:row.id,
      name:row.name||itemLookup(row.id)?.name||"Deleted item",
      requestedQty,qty:receipt.received,blockedQty:Math.max(0,requestedQty-receipt.received),
      ownedQty:receipt.ownedQty
    };
  }).filter(row=>row.requestedQty>0);
  const boughtUnits=purchased.reduce((sum,row)=>sum+row.requestedQty,0);
  const receivableUnits=purchased.reduce((sum,row)=>sum+row.qty,0);
  const blockedUnits=Math.max(0,boughtUnits-receivableUnits);
  const beforeReady=entries.filter(entry=>entry.status==="ready").length;
  if(!boughtUnits){
    return {
      boughtUnits:0,receivableUnits:0,blockedUnits:0,purchased:[],beforeReady,afterReady:beforeReady,arrivalGain:0,
      gainedReady:[],lostReady:[],bestReady:beforeReady,optimizationGain:0,
      optimizationExact:true,optimizedGainedReady:[],optimizedLostReady:[],optimizedOrder:installOrder
    };
  }
  if(!receivableUnits){
    return {
      boughtUnits,receivableUnits:0,blockedUnits,purchased,beforeReady,afterReady:beforeReady,arrivalGain:0,
      gainedReady:[],lostReady:[],bestReady:beforeReady,optimizationGain:0,
      optimizationExact:true,optimizedGainedReady:[],optimizedLostReady:[],optimizedOrder:installOrder
    };
  }
  const hypotheticalOwned={...ownedById};
  for(const row of purchased){if(row.qty>0)hypotheticalOwned[row.id]=row.ownedQty}
  const afterCurrent=installAllocationSnapshot(hypotheticalOwned,{install,plans,installedPlanIds,installOrder});
  const currentImpact=installScenarioTransitions(install,afterCurrent,options);
  const afterReady=afterCurrent.entries.filter(entry=>entry.status==="ready").length;
  const suggestion=suggestInstallOrder({
    ...options,install:afterCurrent,plans,ownedById:hypotheticalOwned,installedPlanIds,installOrder,
    nodeLimit:Math.max(1,Math.floor(Number(options.nodeLimit)||INSTALL_ORDER_SEARCH_LIMIT))
  });
  const optimized=installAllocationSnapshot(hypotheticalOwned,{
    install:afterCurrent,plans,installedPlanIds,installOrder:suggestion.order
  });
  const optimizedImpact=installScenarioTransitions(afterCurrent,optimized,options);
  return {
    boughtUnits,receivableUnits,blockedUnits,purchased,beforeReady,afterReady,arrivalGain:afterReady-beforeReady,
    gainedReady:currentImpact.gainedReady,lostReady:currentImpact.lostReady,
    bestReady:suggestion.bestReady,optimizationGain:Math.max(0,suggestion.bestReady-afterReady),
    optimizationExact:suggestion.exact,optimizedGainedReady:optimizedImpact.gainedReady,
    optimizedLostReady:optimizedImpact.lostReady,optimizedOrder:suggestion.order
  };
}
function installUnlockFingerprint(){
  const install=currentInstallAllocation();
  return JSON.stringify({
    chosen:state.chosenPlanIds||{},installed:state.installedPlanIds||{},order:state.installOrder||[],
    owned:state.boxes.map(item=>[item.id,item.ownedQty||0]),bought:state.shoppingBought||{},
    plans:chosenPlans().map(plan=>[plan.id,plan.signature||planSignature(plan.storageId,plan.layout||[])]),
    install:install.entries.map(entry=>[entry.storageId,entry.status,(entry.missing||[]).map(x=>[x.id,x.qty])])
  });
}
function roomInstallPriorityImpact(roomId,options={}){
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const install=options.install||currentInstallAllocation();
  const priority=prioritizedInstallOrderForRoom(roomId,{furniture,storages,install,installOrder:options.installOrder});
  if(!priority.changed)return {changed:false,order:priority.order,gainedReady:[],lostReady:[],transitions:[]};
  return installOrderImpact(priority.order,{...options,furniture,storages,install});
}
function projectRoomProgress(options={}){
  const rooms=Array.isArray(options.rooms)?options.rooms:state.rooms;
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const savedPlans=Array.isArray(options.savedPlans)?options.savedPlans:state.savedPlans;
  const chosen=Array.isArray(options.chosen)?options.chosen:chosenPlans();
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const install=options.install||currentInstallAllocation();
  const healthLookup=typeof options.planHealthLookup==="function"?options.planHealthLookup:planHealth;
  const items=Array.isArray(options.items)?options.items:state.boxes;
  const itemName=id=>items.find(item=>item.id===id)?.name||"Deleted item";
  const chosenByStorage=new Map(chosen.map(plan=>[plan.storageId,plan]));
  const installByStorage=new Map((install.entries||[]).map(entry=>[entry.storageId,entry]));
  const furnitureByStorageRoom=new Map(furniture.map(item=>[item.id,item.roomId]));
  const currentSavedByStorage=new Map();
  for(const plan of savedPlans||[]){
    if(healthLookup(plan).status!=="current"||currentSavedByStorage.has(plan.storageId))continue;
    currentSavedByStorage.set(plan.storageId,plan);
  }
  const statusPriority={review:0,choose:1,plan:2,ready:3,waiting:4,chosen:5,installed:6};
  const storageRows=storages.map(storage=>{
    const chosenPlan=chosenByStorage.get(storage.id)||null;
    const installedPlanId=installedPlanIds?.[storage.id]||"";
    const installed=!!chosenPlan&&installedPlanId===chosenPlan.id;
    const health=chosenPlan?healthLookup(chosenPlan):null;
    const installEntry=installByStorage.get(storage.id)||null;
    const currentSavedPlan=currentSavedByStorage.get(storage.id)||null;
    const currentPlan=installed||!!currentSavedPlan;
    let status="plan";
    if(installed)status="installed";
    else if(chosenPlan&&health?.status!=="current")status="review";
    else if(installEntry?.status==="ready")status="ready";
    else if(installEntry?.status==="waiting")status="waiting";
    else if(chosenPlan)status="chosen";
    else if(currentPlan)status="choose";
    const context=projectStorageContext(storage.id,{rooms,furniture,storages}),path=context.path;
    const missing=(installEntry?.missing||[]).map(x=>({id:x.id,name:itemName(x.id),qty:Math.max(0,Math.floor(Number(x.qty)||0))})).filter(x=>x.qty>0);
    let action={kind:"plan-space",targetId:storage.id,label:"Plan"};
    if(status==="review"){
      action={kind:health?.status==="invalid"?"repair-plan":"review-plan",targetId:chosenPlan?.id||"",label:health?.status==="invalid"?"Repair":"Revalidate"};
    }else if(status==="choose"){
      action={kind:"choose-plan",targetId:currentSavedPlan?.id||"",label:"Choose plan"};
    }else if(status==="ready"){
      action={kind:"install-ready",targetId:storage.id,label:"Install"};
    }else if(status==="waiting"){
      action={kind:"room-shopping",targetId:missing[0]?.id||"",label:"View blocker"};
    }else if(status==="chosen"){
      action={kind:"open-plan",targetId:chosenPlan?.id||"",label:"Open plan"};
    }else if(status==="installed"){
      action={kind:"install-ready",targetId:storage.id,label:"View installed"};
    }
    return {
      storageId:storage.id,storage,path,roomId:furnitureByStorageRoom.get(storage.furnitureId)||"",status,currentPlan,chosen:!!chosenPlan,installed,
      healthStatus:health?.status||"",chosenPlanId:chosenPlan?.id||"",currentSavedPlanId:currentSavedPlan?.id||"",missing,action,
      displayPath:[context.furnitureName,context.storageName].filter(Boolean).join(" → ")||context.storageName
    };
  });
  const roomRows=rooms.map(room=>{
    const rows=storageRows.filter(row=>row.roomId===room.id);
    const count=status=>rows.filter(row=>row.status===status).length;
    const ordered=rows.slice().sort((a,b)=>(statusPriority[a.status]??99)-(statusPriority[b.status]??99)||a.path.localeCompare(b.path));
    const total=rows.length,installed=count("installed"),review=count("review"),choose=count("choose"),plan=count("plan"),ready=count("ready"),waiting=count("waiting"),chosenOnly=count("chosen");
    const currentPlans=rows.filter(row=>row.currentPlan).length,chosenCount=rows.filter(row=>row.chosen).length;
    const blockers=rows.filter(row=>row.status==="waiting").flatMap(row=>
      (row.missing||[]).map(missing=>({
        storageId:row.storageId,storagePath:row.path,id:missing.id,name:itemName(missing.id),qty:missing.qty
      }))
    ).sort((a,b)=>a.storagePath.localeCompare(b.storagePath)||a.name.localeCompare(b.name));
    const complete=total>0&&installed===total;
    const installPriority=prioritizedInstallOrderForRoom(room.id,{furniture,storages,install});
    const priorityImpact=waiting>0&&installPriority.changed?roomInstallPriorityImpact(room.id,{rooms,furniture,storages,install,installedPlanIds}):null;
    return {
      roomId:room.id,roomName:room.name||"Room",total,currentPlans,chosen:chosenCount,installed,review,choose,plan,ready,waiting,chosenOnly,complete,
      progressPct:total?Math.round(installed/total*100):0,
      nextStorageId:ordered.find(row=>row.status!=="installed")?.storageId||ordered[0]?.storageId||"",
      storageIds:rows.map(row=>row.storageId),
      spaces:ordered,
      blockers,blockedStorages:new Set(blockers.map(item=>item.storageId)).size,
      canPrioritizeInstall:waiting>0&&installPriority.changed,
      priorityStorageCount:installPriority.movedIds.length,
      priorityImpact,
      tone:complete?"good":review?"warn":waiting?"waiting":""
    };
  });
  const totals={
    rooms:rooms.length,storages:storageRows.length,
    currentPlans:storageRows.filter(row=>row.currentPlan).length,
    chosen:storageRows.filter(row=>row.chosen).length,
    installed:storageRows.filter(row=>row.installed).length,
    review:storageRows.filter(row=>row.status==="review").length
  };
  return {rooms:roomRows,storages:storageRows,totals};
}
function measurementWorksheetData(options={}){
  const rooms=Array.isArray(options.rooms)?options.rooms:state.rooms;
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const unit=String(options.unit||state.unit||"cm");
  const roomRows=(rooms||[]).map(room=>{
    const furnitureRows=(furniture||[]).filter(item=>item.roomId===room.id).map(item=>{
      const spaces=(storages||[]).filter(storage=>storage.furnitureId===item.id).map(storage=>({
        storageId:storage.id,
        storageName:storage.name||"Storage",
        width:Number(storage.w)||0,
        depth:Number(storage.d)||0,
        height:Number(storage.h)||0,
        blockedZones:Array.isArray(storage.obstacles)?storage.obstacles.length:0,
        dividers:Array.isArray(storage.dividers)?storage.dividers.length:0,
        measurement:storageMeasurementStatus(storage,unit)
      }));
      return {furnitureId:item.id,furnitureName:item.name||"Furniture",spaces};
    }).filter(item=>item.spaces.length);
    return {roomId:room.id,roomName:room.name||"Room",furniture:furnitureRows};
  }).filter(room=>room.furniture.length);
  return {
    unit,
    rooms:roomRows,
    storageCount:roomRows.reduce((sum,room)=>sum+room.furniture.reduce((inner,item)=>inner+item.spaces.length,0),0)
  };
}
function projectChecklistData(options={}){
  const progress=options.progress||projectRoomProgress();
  const procurement=options.procurement||projectProcurement();
  const statusLabels={plan:"Plan",choose:"Choose",review:"Review",waiting:"Waiting",ready:"Ready",chosen:"Chosen",installed:"Installed"};
  const rooms=(progress.rooms||[]).filter(room=>room.total>0).map(room=>({
    roomId:room.roomId,roomName:room.roomName,total:room.total,currentPlans:room.currentPlans,chosen:room.chosen,installed:room.installed,
    spaces:(room.spaces||[]).map(space=>{
      const statusLabel=space.status==="review"?(space.healthStatus==="invalid"?"Repair":"Review"):(statusLabels[space.status]||space.status||"Plan");
      return {
        storageId:space.storageId,
        displayPath:space.displayPath||space.path||"",
        status:space.status||"plan",
        statusLabel,
        nextAction:space.action?.label||statusLabel,
        missing:(space.missing||[]).map(item=>({id:item.id,name:item.name||"Item",qty:Math.max(0,Math.floor(Number(item.qty)||0))})).filter(item=>item.qty>0)
      };
    })
  }));
  const shopping=(procurement.rows||[]).map(row=>({
    id:row.id,name:row.name||"Item",
    need:Math.max(0,Math.floor(Number(row.buyQty)||0)),
    purchased:Math.max(0,Math.floor(Number(row.boughtQty)||0)),
    left:Math.max(0,Math.floor(Number(row.remainingQty)||0)),
    storageCount:Math.max(0,Math.floor(Number(row.storageCount)||0))
  })).filter(row=>row.need>0);
  return {
    totals:{
      rooms:rooms.length,
      storages:Math.max(0,Math.floor(Number(progress.totals?.storages)||0)),
      currentPlans:Math.max(0,Math.floor(Number(progress.totals?.currentPlans)||0)),
      chosen:Math.max(0,Math.floor(Number(progress.totals?.chosen)||0)),
      installed:Math.max(0,Math.floor(Number(progress.totals?.installed)||0)),
      review:Math.max(0,Math.floor(Number(progress.totals?.review)||0))
    },
    rooms,
    shopping,
    purchaseUnits:Math.max(0,Math.floor(Number(procurement.purchaseUnits)||0)),
    boughtUnits:Math.max(0,Math.floor(Number(procurement.boughtUnits)||0)),
    remainingUnits:Math.max(0,Math.floor(Number(procurement.remainingUnits)||0)),
    remainingText:projectRemainingText(procurement)
  };
}
function focusProjectRoom(roomId){
  const progress=projectRoomProgress(),row=progress.rooms.find(item=>item.roomId===roomId);if(!row)return false;
  if(row.nextStorageId){openCompatibleStorage(row.nextStorageId);return true}
  const firstFurniture=state.furniture.find(item=>item.roomId===roomId);
  state.selectedRoom=roomId;state.selectedFurniture=firstFurniture?.id||"";
  localStorage.setItem(KEY,JSON.stringify(state));renderHierarchy();renderStorageList();
  document.querySelector(".sidebar")?.scrollIntoView({behavior:"smooth",block:"start"});
  return true;
}
function focusShoppingItem(itemId){
  const target=itemId?document.querySelector(`[data-home-shop-item="${itemId}"]`):null;
  if(target){target.scrollIntoView({behavior:"smooth",block:"center"});target.classList.add("roomshoppingfocus");setTimeout(()=>target.classList.remove("roomshoppingfocus"),1400);return true}
  return scrollProjectSection("homeProcurementSection");
}
function focusRoomInventoryBlockers(roomId){
  const row=projectRoomProgress().rooms.find(item=>item.roomId===roomId);if(!row||!row.blockers.length)return false;
  return focusShoppingItem(row.blockers[0].id);
}
function prioritizeRoomInstall(roomId){
  const allocation=currentInstallAllocation(),impact=roomInstallPriorityImpact(roomId,{install:allocation});
  if(!impact.changed)return false;
  const room=roomById(roomId),name=room?.name||"this room";
  const gains=impact.gainedReady.length
    ?"Would become Ready:\n"+impact.gainedReady.map(item=>"• "+item.path).join("\n")
    :"No waiting spaces become Ready with the current owned stock.";
  const losses=impact.lostReady.length
    ?"Would become Waiting:\n"+impact.lostReady.map(item=>"• "+item.path).join("\n")
    :"No currently Ready spaces would become Waiting.";
  if(!confirm(`Prioritize ${name} in the install order?\n\n${gains}\n\n${losses}\n\nPlans, owned quantities, purchased quantities, and Installed status will not change.`))return false;
  state.installOrder=impact.order;
  localStorage.setItem(KEY,JSON.stringify(state));
  renderInstallDashboard();
  renderRoomProgressOverview();
  return true;
}
function runRoomStorageAction(space){
  if(!space?.action)return false;
  if(space.action.kind==="room-shopping")return focusShoppingItem(space.action.targetId);
  if(space.action.kind==="open-plan"){openSavedPlan(space.action.targetId);return true}
  return runProjectNextAction(space.action);
}
function renderRoomProgressOverview(){
  const sec=$("roomProgressSection"),list=$("roomProgressList"),summary=$("roomProgressSummary");if(!sec||!list||!summary)return;
  const progress=projectRoomProgress(),rows=progress.rooms.filter(row=>row.total>0);
  if(!rows.length){sec.style.display="none";list.innerHTML="";summary.textContent="";return}
  sec.style.display="block";
  summary.textContent=progress.totals.installed+"/"+progress.totals.storages+" installed · "+progress.totals.chosen+" chosen · "+progress.totals.currentPlans+" current plans";
  list.innerHTML=rows.map(row=>{
    const chips=[
      row.review?`<span class="roomprogresschip warn">${row.review} review</span>`:"",
      row.plan?`<span class="roomprogresschip">${row.plan} plan</span>`:"",
      row.choose?`<span class="roomprogresschip">${row.choose} choose</span>`:"",
      row.waiting?`<span class="roomprogresschip">${row.waiting} waiting</span>`:"",
      row.ready?`<span class="roomprogresschip good">${row.ready} ready</span>`:"",
      row.chosenOnly?`<span class="roomprogresschip">${row.chosenOnly} chosen</span>`:"",
      row.installed?`<span class="roomprogresschip installed">${row.installed} installed</span>`:""
    ].filter(Boolean).join("");
    const blockers=row.blockers.length
      ?`<div class="roomprogressblockers"><strong>Current install blockers:</strong> ${row.blockers.slice(0,3).map(item=>esc(item.storagePath.split(" → ").slice(-1)[0])+" — "+esc(item.name)+" ×"+item.qty).join(" · ")}${row.blockers.length>3?` · +${row.blockers.length-3} more`:""}</div>`:"";
    const blockerButton=row.blockers.length?`<button class="btn soft" type="button" data-room-shopping="${row.roomId}">Shopping / receiving</button>`:"";
    const priorityButton=row.canPrioritizeInstall?`<button class="btn soft" type="button" data-room-prioritize="${row.roomId}">Prioritize room</button>`:"";
    const priorityPreview=row.canPrioritizeInstall&&row.priorityImpact
      ?`<div class="roomprioritypreview"><strong>Priority preview:</strong> ${row.priorityImpact.gainedReady.length?`+${row.priorityImpact.gainedReady.length} Ready`:"no new Ready"}${row.priorityImpact.lostReady.length?` · ${row.priorityImpact.lostReady.length} other space${row.priorityImpact.lostReady.length===1?"":"s"} would wait`:" · no Ready space displaced"}</div>`:"";
    const queue=`<details class="roomstoragequeue"><summary>Show all ${row.total} storage space${row.total===1?"":"s"}</summary><div class="roomstoragelist">${row.spaces.map((space,spaceIndex)=>{
      const missing=space.status==="waiting"&&space.missing.length
        ?`<div class="roomstoragemissing">${space.missing.map(item=>esc(item.name)+" ×"+item.qty).join(" · ")}</div>`:"";
      return `<div class="roomstoragerow"><div><div class="roomstoragetitle">${esc(space.displayPath)}</div><div class="roomstoragestatus ${space.status}">${esc(space.status==="review"?(space.healthStatus==="invalid"?"Repair":"Review"):space.status)}</div>${missing}</div><button class="btn soft" type="button" data-room-space="${row.roomId}:${spaceIndex}">${esc(space.action.label)}</button></div>`;
    }).join("")}</div></details>`;
    return `<div class="roomprogresscard ${row.tone}"><div><div class="roomprogresstitle">${esc(row.roomName)}</div><div class="roomprogressmeta">${row.currentPlans}/${row.total} current plans · ${row.chosen}/${row.total} chosen · ${row.installed}/${row.total} installed</div><div class="progressbar"><span style="width:${row.progressPct}%"></span></div><div class="roomprogresschips">${chips}</div>${blockers}${row.canPrioritizeInstall?`<div class="roomprioritynote">Install order controls which unfinished spaces reserve shared owned inventory first.</div>`:""}${priorityPreview}</div><div class="roomprogressactions"><button class="btn soft" type="button" data-room-progress="${row.roomId}">Focus room</button>${priorityButton}${blockerButton}</div>${queue}</div>`;
  }).join("");
  list.querySelectorAll("[data-room-progress]").forEach(btn=>btn.addEventListener("click",()=>focusProjectRoom(btn.dataset.roomProgress)));
  list.querySelectorAll("[data-room-shopping]").forEach(btn=>btn.addEventListener("click",()=>focusRoomInventoryBlockers(btn.dataset.roomShopping)));
  list.querySelectorAll("[data-room-prioritize]").forEach(btn=>btn.addEventListener("click",()=>prioritizeRoomInstall(btn.dataset.roomPrioritize)));
  list.querySelectorAll("[data-room-space]").forEach(btn=>btn.addEventListener("click",()=>{
    const [roomId,indexText]=btn.dataset.roomSpace.split(":"),room=progress.rooms.find(item=>item.roomId===roomId),space=room?.spaces?.[Number(indexText)];
    if(space)runRoomStorageAction(space);
  }));
}
function projectDistributionTarget(row){
  const allocation=(row?.session?.allocations||[])[0];
  const path=String(allocation?.storagePath||"");
  const itemName=String(row?.item?.name||"Organizer");
  return {path:path?itemName+" → "+path:itemName,sortKey:(path+" "+itemName).toLocaleLowerCase()};
}
function projectNextActions(options={}){
  const storages=Array.isArray(options.storages)?options.storages:state.storages;
  const furniture=Array.isArray(options.furniture)?options.furniture:state.furniture;
  const rooms=Array.isArray(options.rooms)?options.rooms:state.rooms;
  const savedPlans=Array.isArray(options.savedPlans)?options.savedPlans:state.savedPlans;
  const chosen=Array.isArray(options.chosen)?options.chosen:chosenPlans();
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const distributionRows=Array.isArray(options.distributionRows)?options.distributionRows:ownedDistributionWorkRows();
  const procurement=options.procurement||projectProcurement(chosen);
  const install=options.install||currentInstallAllocation();
  const healthLookup=typeof options.planHealthLookup==="function"?options.planHealthLookup:planHealth;
  const actions=[];
  const context=storageId=>projectStorageContext(storageId,{storages,furniture,rooms});
  const byStoragePath=(a,b)=>context(a.storageId).sortKey.localeCompare(context(b.storageId).sortKey)||String(a.name||"").localeCompare(String(b.name||""));
  const withPath=(detail,path)=>path?detail+" First: "+path+".":detail;
  const push=(priority,kind,title,detail,label,targetId="",tone="",targetPath="",targets=[])=>actions.push({priority,kind,title,detail,label,targetId,tone,targetPath,targets:Array.isArray(targets)?targets:[]});

  const chosenHealth=chosen.filter(plan=>installedPlanIds?.[plan.storageId]!==plan.id).map(plan=>({plan,health:healthLookup(plan)}));
  const invalidChosen=chosenHealth.filter(x=>x.health.status==="invalid").map(x=>x.plan).sort(byStoragePath);
  if(invalidChosen.length){
    const targets=invalidChosen.map(plan=>{const path=context(plan.storageId).path;return {targetId:plan.id,targetPath:path,label:path}});
    const first=targets[0];
    push(10,"repair-plan",
      "Repair "+invalidChosen.length+" invalid chosen plan"+(invalidChosen.length===1?"":"s"),
      withPath("The saved layout is no longer valid and must be rebuilt, replaced, or unchosen before reliable execution.",first.targetPath),
      "Go to first plan",first.targetId,"warn",first.targetPath,targets);
  }

  const reviewChosen=chosenHealth.filter(x=>x.health.status==="review").map(x=>x.plan).sort(byStoragePath);
  if(reviewChosen.length){
    const targets=reviewChosen.map(plan=>{const path=context(plan.storageId).path;return {targetId:plan.id,targetPath:path,label:path}});
    const first=targets[0];
    push(11,"review-plan",
      "Revalidate "+reviewChosen.length+" chosen plan"+(reviewChosen.length===1?"":"s"),
      withPath("The layout still fits, but storage or organizer inputs changed and need acknowledgement.",first.targetPath),
      "Go to revalidate",first.targetId,"warn",first.targetPath,targets);
  }

  const staleDistribution=distributionRows.filter(row=>row.stale).slice().sort((a,b)=>projectDistributionTarget(a).sortKey.localeCompare(projectDistributionTarget(b).sortKey));
  if(staleDistribution.length){
    const targets=staleDistribution.map(row=>{const target=projectDistributionTarget(row);return {targetId:row.itemId,targetPath:target.path,label:target.path}});
    const first=targets[0];
    push(20,"recalculate-distribution",
      "Recalculate "+staleDistribution.length+" distribution session"+(staleDistribution.length===1?"":"s"),
      withPath("Stored allocation work is out of date with the current stock, plans, or storage geometry.",first.targetPath),
      "Recalculate first",first.targetId,"warn",first.targetPath,targets);
  }

  const activeDistribution=distributionRows.filter(row=>!row.stale&&!row.complete).slice().sort((a,b)=>projectDistributionTarget(a).sortKey.localeCompare(projectDistributionTarget(b).sortKey));
  if(activeDistribution.length){
    const targets=activeDistribution.map(row=>{const target=projectDistributionTarget(row);return {targetId:row.itemId,targetPath:target.path,label:target.path}});
    const first=targets[0];
    push(30,"continue-distribution",
      "Continue "+activeDistribution.length+" distribution session"+(activeDistribution.length===1?"":"s"),
      withPath("Owned-stock allocation work is ready to continue or apply to the project.",first.targetPath),
      "Resume first",first.targetId,"",first.targetPath,targets);
  }

  const chosenStorageIds=new Set(chosen.map(plan=>plan.storageId));
  const currentSavedByStorage=new Map();
  for(const plan of savedPlans){
    if(chosenStorageIds.has(plan.storageId)||healthLookup(plan).status!=="current")continue;
    if(!currentSavedByStorage.has(plan.storageId))currentSavedByStorage.set(plan.storageId,plan);
  }
  const chooseable=storages.filter(storage=>!chosenStorageIds.has(storage.id)&&currentSavedByStorage.has(storage.id)).sort((a,b)=>context(a.id).sortKey.localeCompare(context(b.id).sortKey));
  if(chooseable.length){
    const targets=chooseable.map(storage=>{const plan=currentSavedByStorage.get(storage.id),path=context(storage.id).path;return {targetId:plan?.id||"",targetPath:path,label:path}});
    const first=targets[0];
    push(40,"choose-plan",
      "Choose a plan for "+chooseable.length+" storage space"+(chooseable.length===1?"":"s"),
      withPath("Current saved options exist, but no project plan has been chosen for these spaces.",first.targetPath),
      "Review first options",first.targetId,"",first.targetPath,targets);
  }

  const needsPlanning=storages.filter(storage=>!chosenStorageIds.has(storage.id)&&!currentSavedByStorage.has(storage.id)).sort((a,b)=>context(a.id).sortKey.localeCompare(context(b.id).sortKey));
  if(needsPlanning.length){
    const targets=needsPlanning.map(storage=>{const path=context(storage.id).path;return {targetId:storage.id,targetPath:path,label:path}});
    const first=targets[0];
    push(50,"plan-space",
      "Plan "+needsPlanning.length+" storage space"+(needsPlanning.length===1?"":"s"),
      withPath("These spaces do not yet have a current saved plan that can be chosen.",first.targetPath),
      "Plan next space",first.targetId,"",first.targetPath,targets);
  }

  if((procurement.boughtUnits||0)>0)push(60,"receive-purchases",
    "Receive "+procurement.boughtUnits+" purchased organizer"+(procurement.boughtUnits===1?"":"s"),
    "They are marked purchased but are not part of owned inventory until you receive them.",
    "Open shopping list","","");

  if((procurement.remainingUnits||0)>0)push(70,"shopping",
    "Buy "+procurement.remainingUnits+" organizer"+(procurement.remainingUnits===1?"":"s"),
    "Chosen plans still need inventory before every space can be installed.",
    "Open shopping list","","");

  const readyInstall=(install.entries||[]).filter(entry=>entry.status==="ready").slice().sort((a,b)=>context(a.storageId).sortKey.localeCompare(context(b.storageId).sortKey));
  if(readyInstall.length){
    const targets=readyInstall.map(entry=>{const path=context(entry.storageId).path;return {targetId:entry.storageId,targetPath:path,label:path}});
    const first=targets[0];
    push(80,"install-ready",
      "Install "+readyInstall.length+" ready storage space"+(readyInstall.length===1?"":"s"),
      withPath("These chosen plans can be installed now with the owned inventory currently available.",first.targetPath),
      "Open install queue",first.targetId,"good",first.targetPath,targets);
  }

  if(!storages.length)push(90,"add-storage","Add your first storage space","Create a drawer, shelf, cupboard, or other space before planning layouts.","Add storage","","");
  const installedCount=storages.filter(storage=>installedPlanIds?.[storage.id]).length;
  const complete=storages.length>0&&installedCount===storages.length&&actions.length===0;
  if(complete)push(100,"complete","Project complete","Every storage space has an installed chosen plan.","","", "good");
  actions.sort((a,b)=>a.priority-b.priority||a.title.localeCompare(b.title));
  return {actions,complete,installedCount,storageCount:storages.length};
}
function scrollProjectSection(id){
  const el=$(id);if(!el||el.style.display==="none")return false;
  el.scrollIntoView({behavior:"smooth",block:"start"});return true;
}
function focusSavedPlanCard(planId,preferRevalidate=false){
  if(!planId)return false;
  const selector=preferRevalidate?`[data-revalidate-plan="${planId}"]`:`[data-open-plan="${planId}"]`;
  const target=document.querySelector(selector)||document.querySelector(`[data-open-plan="${planId}"]`);
  const card=target?.closest(".savedcard");
  if(!card)return scrollProjectSection("savedPlansSection");
  card.scrollIntoView({behavior:"smooth",block:"center"});
  return true;
}
function runProjectNextAction(action){
  if(!action)return false;
  if(action.kind==="review-plan")return focusSavedPlanCard(action.targetId,true);
  if(action.kind==="repair-plan")return focusSavedPlanCard(action.targetId,false);
  if(action.kind==="recalculate-distribution"||action.kind==="continue-distribution")return resumeOwnedDistributionWork(action.targetId);
  if(action.kind==="choose-plan"){
    const btn=document.querySelector(`[data-choose-plan="${action.targetId}"]`);
    const card=btn?.closest(".savedcard");
    if(card){card.scrollIntoView({behavior:"smooth",block:"center"});return true}
    return scrollProjectSection("savedPlansSection");
  }
  if(action.kind==="plan-space"){openCompatibleStorage(action.targetId);return true}
  if(action.kind==="receive-purchases"||action.kind==="shopping")return scrollProjectSection("homeProcurementSection");
  if(action.kind==="install-ready"){
    const card=document.querySelector(`[data-install-card="${action.targetId}"]`);
    if(card){card.scrollIntoView({behavior:"smooth",block:"center"});return true}
    return scrollProjectSection("installDashboardSection");
  }
  if(action.kind==="add-storage"){ $("addStorage")?.click();return true }
  return false;
}
function renderProjectNextActions(){
  const sec=$("projectNextSection"),list=$("projectNextList"),summary=$("projectNextSummary"),printBtn=$("printProjectChecklistBtn"),measureBtn=$("printMeasurementWorksheetBtn");if(!sec||!list||!summary)return;
  const result=projectNextActions(),actions=result.actions;
  sec.style.display="block";
  if(printBtn)printBtn.disabled=!state.storages.length;
  if(measureBtn)measureBtn.disabled=!state.storages.length;
  summary.textContent=result.complete?"Project complete":actions.length+" next action"+(actions.length===1?"":"s");
  list.innerHTML=actions.map((action,index)=>{
    const targets=Array.isArray(action.targets)?action.targets:[];
    const drilldown=targets.length>1
      ?'<details class="nextactiontargets"><summary>Show all '+targets.length+' targets</summary><div class="nextactiontargetlist">'+targets.map((target,targetIndex)=>
        '<div class="nextactiontarget"><span>'+esc(target.label||target.targetPath||"Target")+'</span><button class="btn soft" type="button" data-project-next-target="'+index+':'+targetIndex+'">Open</button></div>'
      ).join("")+'</div></details>'
      :"";
    return '<div class="nextactioncard '+esc(action.tone||"")+'"><div><div class="nextactiontitle">'+esc(action.title)+'</div>'+
      (action.targetPath?'<div class="nextactionpath">'+esc(action.targetPath)+'</div>':"")+
      '<div class="nextactiondetail">'+esc(action.detail)+'</div></div>'+
      (action.label?'<button class="btn '+(index===0?"primary":"soft")+'" type="button" data-project-next="'+index+'">'+esc(action.label)+'</button>':'<span class="nextactiondone">✓</span>')+
      drilldown+'</div>';
  }).join("");
  list.querySelectorAll("[data-project-next]").forEach(btn=>btn.addEventListener("click",()=>runProjectNextAction(actions[Number(btn.dataset.projectNext)])));
  list.querySelectorAll("[data-project-next-target]").forEach(btn=>btn.addEventListener("click",()=>{
    const [actionIndex,targetIndex]=btn.dataset.projectNextTarget.split(":").map(Number);
    const action=actions[actionIndex],target=action?.targets?.[targetIndex];if(!action||!target)return;
    runProjectNextAction({...action,targetId:target.targetId,targetPath:target.targetPath});
  }));
}
function renderAll(){
  $("unit").value=state.unit||"cm";$("optimizeGoal").value=state.optimizeGoal||"fill";$("uprightOnly").checked=state.uprightOnly!==false;$("enableStacking").checked=!!state.enableStacking;
  $("clearanceEnabled").checked=!!state.clearanceEnabled;$("clearance").value=state.clearance??0.5;$("fitTolerance").value=state.fitTolerance??0;
  $("clearanceField").style.display=state.clearanceEnabled?"block":"none";
  renderHierarchy();renderStorageList();renderBoxList();renderStorageSelect();renderItemPicker();loadStorageEditor();renderObstacleEditor();renderDividerEditor();loadBoxEditor();renderSavedPlans();renderInstallDashboard();renderDistributionWorkDashboard();renderHomeProcurement();renderProjectNextActions();renderRoomProgressOverview();renderBackupStats();renderRecoveryHistory();resetResults();
}
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

  const progress=projectRoomProgress(),statusById=new Map(progress.storages.map(row=>[row.storageId,row])),allCount=progress.totals.storages;
  $("homeProgress").textContent=allCount?`${progress.totals.currentPlans}/${allCount} current plans · ${progress.totals.installed} installed`:"No storage yet";

  const currentSpaces=state.storages.filter(s=>s.furnitureId===state.selectedFurniture);
  if(!currentSpaces.some(s=>s.id===editingStorage))editingStorage=currentSpaces[0]?.id||"";
  const currentRows=currentSpaces.map(s=>statusById.get(s.id)).filter(Boolean);
  const currentPlanned=currentRows.filter(row=>row.currentPlan).length,currentInstalled=currentRows.filter(row=>row.installed).length,currentReview=currentRows.filter(row=>row.status==="review").length;
  const pct=currentSpaces.length?Math.round(currentInstalled/currentSpaces.length*100):0;
  $("furnitureProgress").innerHTML=currentSpaces.length
    ? `${currentPlanned} of ${currentSpaces.length} current plans · ${currentInstalled} installed${currentReview?` · ${currentReview} need review`:""}.<div class="progressbar"><span style="width:${pct}%"></span></div>`
    : "No storage spaces in this furniture yet.";

  $("deleteRoom").disabled=state.rooms.length<=1;
  $("deleteFurniture").disabled=state.furniture.length<=1;
  renderRoomProgressOverview();
}
function renderStorageList(){
  updateStorageStructureCopyButton();
  const el=$("storageList"),filtered=state.storages.filter(s=>s.furnitureId===state.selectedFurniture);
  if(!filtered.length){el.innerHTML='<div class="empty">No storage spaces in this furniture yet.</div>';return}
  const progress=projectRoomProgress(),statusById=new Map(progress.storages.map(row=>[row.storageId,row]));
  el.innerHTML=filtered.map(s=>{const project=statusById.get(s.id),review=project?.status==="review",planned=!!project?.currentPlan,measurement=storageMeasurementStatus(s);return `<div class="listitem ${s.id===editingStorage?"active":""}" data-s="${s.id}">
    <div><div class="listname">${esc(s.name)}</div><div class="dims">${fmt(s.w)} × ${fmt(s.d)} × ${fmt(s.h)} ${esc(state.unit)}${s.obstacles?.length?` · ${s.obstacles.length} blocked`:""}${s.dividers?.length?` · ${s.dividers.length} divider${s.dividers.length===1?"":"s"}`:""}<div class="crumb">${review?"saved plan needs review":planned?"current saved plan available":"not planned yet"} · ${measurement.status==="current"?"measured":measurement.status==="stale"?"measurement needs recheck":"not measured"}</div></div></div>
    ${s.id===state.selectedStorage?'<span class="badge">selected</span>':review?'<span class="badge">review</span>':measurement.status==="stale"?'<span class="badge">recheck</span>':measurement.status==="current"?'<span class="badge">measured</span>':planned?'<span class="badge">planned</span>':""}</div>`}).join("");
  el.querySelectorAll("[data-s]").forEach(n=>n.addEventListener("click",()=>{
    editingStorage=n.dataset.s;state.selectedStorage=n.dataset.s;syncHierarchyToStorage(n.dataset.s);
    localStorage.setItem(KEY,JSON.stringify(state));
    renderHierarchy();renderStorageSelect();loadStorageEditor();renderObstacleEditor();renderDividerEditor();renderStorageList();resetResults();
  }));
}
function itemStockStatus(itemId,ownedQty,plans,isPlanIncluded=()=>true){
  const owned=Math.max(0,Math.floor(Number(ownedQty)||0));
  let required=0,planCount=0;
  for(const plan of plans||[]){
    if(!isPlanIncluded(plan))continue;
    const qty=(plan.layout||[]).filter(p=>p.typeId===itemId).length;
    if(!qty)continue;
    required+=qty;planCount++;
  }
  const committedOwned=Math.min(owned,required);
  return {
    owned,required,planCount,committedOwned,
    unallocatedOwned:Math.max(0,owned-required),
    shortage:Math.max(0,required-owned)
  };
}
function activeChosenPlansForStock(){
  return chosenPlans().filter(plan=>
    state.installedPlanIds?.[plan.storageId]===plan.id || planHealth(plan).status==="current"
  );
}
function stockStatusForItem(item){
  if(!item)return itemStockStatus("",0,[]);
  return itemStockStatus(item.id,item.ownedQty,activeChosenPlansForStock());
}
function stockStatusInline(item){
  const s=stockStatusForItem(item);
  if(s.shortage>0)return ` · ${s.shortage} short`;
  if(s.unallocatedOwned>0)return ` · ${s.unallocatedOwned} unallocated`;
  if(s.required>0&&s.owned>0)return " · all owned committed";
  return "";
}
function renderBoxStockSummary(){
  const el=$("boxStockSummary");if(!el)return;
  const item=state.boxes.find(b=>b.id===editingBox);
  if(!item){el.innerHTML='<span class="small">Select an item to see owned-stock commitments.</span>';return}
  const s=stockStatusForItem(item);
  if(!s.required){
    el.className="stocksummary";
    el.innerHTML=`<strong>${s.owned} owned</strong><span>No copies are committed to active chosen plans${s.owned?` · ${s.unallocatedOwned} unallocated`:""}.</span>`;
    return;
  }
  el.className="stocksummary "+(s.shortage?"warn":s.unallocatedOwned?"good":"");
  el.innerHTML=s.shortage
    ? `<strong>${s.owned} owned · ${s.required} required</strong><span>${s.shortage} more needed across ${s.planCount} chosen storage${s.planCount===1?"":"s"}.</span>`
    : `<strong>${s.owned} owned · ${s.committedOwned} committed</strong><span>${s.unallocatedOwned} unallocated across ${s.planCount} chosen storage${s.planCount===1?"":"s"}.</span>`;
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
    <div class="itemmain">${safeUrl(b.image)?`<img class="itemthumb" src="${esc(safeUrl(b.image))}" alt="">`:""}<div><div class="listname">${esc(b.name)}${b.retailer?`<span class="retailerbadge">${esc(b.retailer)}</span>`:""}</div><div class="dims">${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${esc(state.unit)}${b.price>0?` · ${esc(money(b.price,b.currency))}`:""}${b.sku?` · ${esc(b.sku)}`:""}${b.ownedQty?` · own ${b.ownedQty}`:""}${esc(stockStatusInline(b))}${esc(itemRuleText(b))}</div></div></div>
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
      <span><span class="listname">${esc(b.name)}</span><span class="dims" style="display:block">${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${esc(state.unit)}${b.ownedQty?` · own ${b.ownedQty}`:""}${esc(stockStatusInline(b))}${esc(itemRuleText(b))}</span></span>
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
function updateStorageStructureCopyButton(){
  const btn=$("copyStorageStructure");if(!btn)return;
  const source=state.storages.find(x=>x.id===editingStorage);
  if(!source){btn.disabled=true;btn.textContent="Copy saved structure…";btn.title="Select a storage space first.";return}
  const targets=storageStructureCopyTargets(source);
  btn.disabled=targets.eligible.length===0;
  btn.textContent=targets.eligible.length
    ? `Copy saved structure to ${targets.eligible.length}`
    : "Copy saved structure…";
  const notes=[];
  if(targets.matchingFresh.length)notes.push(`${targets.matchingFresh.length} fresh sibling${targets.matchingFresh.length===1?" already matches":"s already match"}`);
  if(targets.protected.length)notes.push(`${targets.protected.length} sibling${targets.protected.length===1?" is":"s are"} protected by saved/chosen/installed work`);
  btn.title=targets.eligible.length
    ? `Copy dimensions, blocked zones and dividers to ${targets.eligible.length} fresh sibling${targets.eligible.length===1?"":"s"}. ${notes.join(" · ")}`.trim()
    : (notes.join(" · ")||"No fresh sibling storage needs this structure.");
}
function renderStorageMeasurementStatus(){
  const wrap=$("storageMeasurementStatus"),label=$("storageMeasurementLabel"),detail=$("storageMeasurementDetail"),btn=$("toggleStorageMeasured");
  if(!wrap||!label||!detail||!btn)return;
  const s=state.storages.find(x=>x.id===editingStorage);
  if(!s){wrap.className="measurementverify";label.textContent="Not measured";detail.textContent="Select a storage space first.";btn.disabled=true;btn.textContent="Mark measured";return}
  const status=storageMeasurementStatus(s);
  wrap.className="measurementverify "+status.status;
  label.textContent=status.label;
  if(status.status==="unverified"){
    detail.textContent="Mark this after physically checking the usable inside space and constraints.";
    btn.textContent="Mark measured";
  }else{
    const when=new Date(status.measuredAt),time=Number.isFinite(when.getTime())?when.toLocaleString():"an earlier time";
    detail.textContent=status.status==="current"
      ?`Verified ${time}. Current dimensions and constraints still match.`
      :`Geometry changed since ${time}. Re-measure before trusting fit results.`;
    btn.textContent=status.status==="current"?"Clear measured":"Reconfirm measured";
  }
  btn.disabled=false;
}
function loadStorageEditor(){
  const s=state.storages.find(x=>x.id===editingStorage);
  $("storageName").value=s?.name||"";$("sw").value=s?.w??"";$("sd").value=s?.d??"";$("sh").value=s?.h??"";
  if(s&&$("storageFurniture"))$("storageFurniture").value=s.furnitureId||state.selectedFurniture;
  updateStorageStructureCopyButton();renderStorageMeasurementStatus();
}
function defaultConstraintMeasure(unit=state.unit){
  return unit==="mm"?10:unit==="in"?0.4:1;
}
function mirrorStorageConstraintsData(S,axis){
  if(!S||!["x","y"].includes(axis))return null;
  const W=Math.max(0,Number(S.w)||0),D=Math.max(0,Number(S.d)||0);
  if(W<=0||D<=0)return null;
  const obstacles=(S.obstacles||[]).map(o=>{
    const next={...o};
    if(axis==="x")next.x=round6(Math.max(0,W-(Number(o.x)||0)-(Number(o.w)||0)));
    else next.y=round6(Math.max(0,D-(Number(o.y)||0)-(Number(o.d)||0)));
    return next;
  });
  const dividers=(S.dividers||[]).map(d=>{
    const next={...d},position=Number(d.position)||0;
    if(axis==="x"&&d.orientation==="vertical")next.position=round6(Math.max(0,Math.min(W,W-position)));
    if(axis==="y"&&d.orientation==="horizontal")next.position=round6(Math.max(0,Math.min(D,D-position)));
    return next;
  });
  return {obstacles,dividers};
}
function applyStorageConstraintMirror(axis){
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return false;
  if(!(s.obstacles?.length||s.dividers?.length)){alert("Add a blocked zone or divider first.");return false}
  const mirrored=mirrorStorageConstraintsData(s,axis);if(!mirrored)return false;
  createRecoveryCheckpoint(`Before mirroring constraints in “${s.name}”`);
  s.obstacles=mirrored.obstacles;s.dividers=mirrored.dividers;
  save();renderObstacleEditor();renderDividerEditor();renderStorageList();renderSavedPlans();resetResults();
  return true;
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
  $("findItemFits").disabled=!b;
  $("findItemPlanRoom").disabled=!b;
  $("showItemUsage").disabled=!b;
  $("boxName").value=b?.name||"";$("bw").value=b?.w??"";$("bd").value=b?.d??"";$("bh").value=b?.h??"";
  $("boxPrice").value=b?.price||"";$("boxCurrency").value=b?.currency||"MAD";$("boxOwnedQty").value=b?.ownedQty??0;$("boxSku").value=b?.sku||"";$("boxUrl").value=b?.url||"";$("boxImage").value=b?.image||"";
  $("boxUprightOnly").checked=b?.uprightOnly!==false;
  $("boxFloorRotationLocked").checked=!!b?.floorRotationLocked;
  $("boxFrontPriority").checked=!!b?.frontPriority;
  $("boxCanBeStacked").checked=!!b?.canBeStacked;
  $("boxCanSupportStack").checked=!!b?.canSupportStack;
  $("boxMaxStackLevel").value=b?.maxStackLevel??"";
  syncStackRuleControls();
  renderBoxStockSummary();
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
function dimensionAxisToken(token){
  const normalized=normalizedDimensionLabel(token);
  if(normalized==="w"||["width","largeur","breite","ancho","larghezza","breedte"].includes(normalized))return "w";
  if(normalized==="d"||normalized==="l"||["depth","length","profondeur","longueur","tiefe","lange","profundidad","largo","longitud","fondo","profondita","lunghezza","diepte","lengte"].includes(normalized))return "d";
  if(normalized==="h"||["height","hauteur","hohe","altura","alto","altezza","hoogte"].includes(normalized))return "h";
  return "";
}
function dimensionOrderFromText(text){
  const normalized=normalizedDimensionLabel(String(text||"").replace(/×/g," x "));
  const token="(?:width|depth|height|length|largeur|profondeur|hauteur|longueur|breite|tiefe|hohe|lange|ancho|profundidad|altura|alto|largo|longitud|fondo|larghezza|profondita|altezza|lunghezza|breedte|diepte|hoogte|lengte|w|d|h|l)";
  const re=new RegExp(`\\b(${token})\\s+(?:x|by)\\s+(${token})\\s+(?:x|by)\\s+(${token})\\b`,"i");
  const m=normalized.match(re);if(!m)return null;
  const order=[dimensionAxisToken(m[1]),dimensionAxisToken(m[2]),dimensionAxisToken(m[3])];
  return new Set(order).size===3&&order.includes("w")&&order.includes("d")&&order.includes("h")?order:null;
}
function reorderProductDimensions(values,order){
  if(!Array.isArray(values)||values.length!==3||!Array.isArray(order)||order.length!==3)return values;
  const byAxis={};
  order.forEach((axis,index)=>{byAxis[axis]=values[index]});
  return byAxis.w>0&&byAxis.d>0&&byAxis.h>0?[byAxis.w,byAxis.d,byAxis.h]:values;
}
function parseDimensionString(str,orderHint=""){
  const s=String(str||"").replace(/×/g,"x");
  const m=s.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|")\b/i);
  if(!m)return null;
  const dims=normalizeProductDimensions([m[1],m[2],m[3]],m[4]);if(!dims)return null;
  const index=m.index??0,context=s.slice(Math.max(0,index-180),Math.min(s.length,index+m[0].length+180));
  const order=dimensionOrderFromText(orderHint)||dimensionOrderFromText(context);
  return reorderProductDimensions(dims,order);
}
function parseQuickDimensions(str,defaultUnit=state.unit){
  const raw=String(str||"").trim();if(!raw)return null;
  const labeled=parseLabeledDimensions(raw);if(labeled)return labeled;
  const direct=parseDimensionString(raw);if(direct)return direct;
  const unit=["mm","cm","m","in"].includes(String(defaultUnit||"").toLowerCase())?String(defaultUnit).toLowerCase():"cm";
  const triplet=/(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?)(?!\s*(?:mm|cm|m|in|inches?|\"))/i;
  if(!triplet.test(raw))return null;
  return parseDimensionString(raw.replace(triplet,match=>match+" "+unit));
}
function parseLabeledDimensions(str){
  const s=String(str||"")
    .replace(/\u00a0/g," ")
    .replace(/\*\*/g,"")
    .replace(/\s+/g," ");

  function findAll(label){
    const re=new RegExp(`\\b${label}\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m|in|")\\b`,"gi");
    return [...s.matchAll(re)].map(m=>({
      value:m[1],unit:m[2],
      index:m.index??0,end:(m.index??0)+m[0].length
    }));
  }

  const widths=findAll("(?:Width|Largeur|Breite|Ancho|Larghezza)");
  const depths=findAll("(?:Depth|Profondeur|Tiefe|Profundidad|Fondo|Profondità)");
  const heights=findAll("(?:Height|Hauteur|Höhe|Altura|Alto|Altezza)");
  if(!widths.length||!depths.length||!heights.length)return null;

  let best=null;
  for(const w of widths)for(const d of depths)for(const h of heights){
    const start=Math.min(w.index,d.index,h.index),end=Math.max(w.end,d.end,h.end);
    const span=end-start;
    if(!best||span<best.span||(span===best.span&&start<best.start))best={w,d,h,span,start};
  }
  if(!best)return null;
  const wc=normalizeProductDimensions([best.w.value,1,1],best.w.unit)?.[0];
  const dc=normalizeProductDimensions([best.d.value,1,1],best.d.unit)?.[0];
  const hc=normalizeProductDimensions([best.h.value,1,1],best.h.unit)?.[0];
  if(!(wc>0&&dc>0&&hc>0))return null;
  return [wc,dc,hc];
}
function parseReaderDimensions(markdown,title=""){
  const txt=String(markdown||"");
  const sections=[];
  let current={heading:"",lines:[]};
  for(const line of txt.split(/\r?\n/)){
    const heading=line.match(/^#{1,6}\s+(.+?)\s*$/);
    if(heading){
      if(current.heading||current.lines.length)sections.push(current);
      current={heading:heading[1].trim(),lines:[]};
    }else current.lines.push(line);
  }
  if(current.heading||current.lines.length)sections.push(current);

  const measurementHeading=/(?:measurements?|product\s+(?:dimensions?|measurements?)|dimensions?(?:\s+du\s+produit)?|mesures?|abmessungen|maße|medidas|misure|size)/i;
  const packageHeading=/(?:package|packaging|parcel|colis|emballage|paket|verpackung|paquete|embalaje|imballaggio)/i;
  for(const section of sections){
    if(!measurementHeading.test(section.heading)||packageHeading.test(section.heading))continue;
    const body=section.lines.join("\n").slice(0,6000);
    const dims=parseLabeledDimensions(body)||parseDimensionString(`${section.heading}\n${body}`);
    if(dims)return dims;
  }
  return parseLabeledDimensions(txt.slice(0,20000))
    || parseDimensionString(`${title}\n${txt.slice(0,20000)}`);
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
function schemaDimensionUnit(value,fallback="cm"){
  const raw=String(value||fallback).trim().toLowerCase();
  if(raw==="mmt"||raw==="mm"||raw.includes("millimet"))return "mm";
  if(raw==="cmt"||raw==="cm"||raw.includes("centimet"))return "cm";
  if(raw==="mtr"||raw==="m"||raw==="meter"||raw==="metre")return "m";
  if(raw==="inh"||raw==="in"||raw==='"'||raw.includes("inch"))return "in";
  return fallback;
}
function schemaDimensionDeclaredUnit(value){
  if(!value||typeof value!=="object")return "";
  return value.unitCode||value.unitText||"";
}
function schemaDimensionValue(value,fallbackUnit="cm"){
  if(value==null)return null;
  let raw=value,unit=fallbackUnit;
  if(typeof value==="object"){
    raw=value.value??value.maxValue??value.minValue??value.name??null;
    unit=value.unitCode??value.unitText??fallbackUnit;
  }
  if(raw==null)return null;
  if(typeof raw==="string"){
    const m=raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|inch|inches|")?$/i);
    if(m){raw=m[1];if(m[2])unit=m[2]}
  }
  const number=Number(String(raw).replace(",","."));
  if(!Number.isFinite(number)||number<=0)return null;
  return normalizeProductDimensions([number,1,1],schemaDimensionUnit(unit,fallbackUnit))?.[0]??null;
}
function normalizedDimensionLabel(name){
  return String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/ß/g,"ss").replace(/[^a-z]+/g," ").trim();
}
function schemaDimensionAxis(name){
  const normalized=normalizedDimensionLabel(name).replace(/^product\s+/,"");
  if(["width","largeur","breite","ancho","larghezza"].includes(normalized))return "w";
  if(["depth","profondeur","tiefe","profundidad","fondo","profondita"].includes(normalized))return "d";
  if(["height","hauteur","hohe","altura","alto","altezza"].includes(normalized))return "h";
  return "";
}
function schemaCompositeDimensionLabel(name){
  const normalized=normalizedDimensionLabel(String(name||"").replace(/×/g," x "));
  if(/(?:package|packaging|parcel|colis|emballage|paket|verpackung|paquete|embalaje|imballaggio)/.test(normalized))return false;
  const bare=normalized.replace(/^product\s+/,"");
  const bases=[
    "dimensions","dimension","measurements","measurement","size",
    "dimensions du produit","mesures","abmessungen","masse",
    "dimensiones","medidas","dimensioni","misure","afmetingen","dimensoes","matt"
  ];
  if(bases.includes(bare))return true;
  const order=dimensionOrderFromText(name);if(!order)return false;
  return bases.some(base=>{
    if(!bare.startsWith(base+" "))return false;
    const suffix=bare.slice(base.length).trim();
    const cleaned=suffix.replace(/\b(?:width|depth|height|length|largeur|profondeur|hauteur|longueur|breite|tiefe|hohe|lange|ancho|profundidad|altura|alto|largo|longitud|fondo|larghezza|profondita|altezza|lunghezza|breedte|diepte|hoogte|lengte|w|d|h|l|x|by)\b/g,"").replace(/\s+/g," ").trim();
    return !cleaned;
  });
}
function schemaCompositeDimensions(value,fallbackUnit="cm",orderHint=""){
  if(value==null)return null;
  let raw=value,unit=fallbackUnit,embeddedHint="";
  if(typeof value==="object"){
    raw=value.value??value.maxValue??value.minValue??value.name??null;
    unit=value.unitCode??value.unitText??fallbackUnit;
    embeddedHint=[value.name,value.propertyID].filter(Boolean).join(" ");
  }
  if(raw==null)return null;
  let text=String(raw).trim().replace(/\binches?\b/gi,"in");
  if(!/(?:mm|cm|\bm\b|in|")\s*$/i.test(text))text=`${text} ${schemaDimensionUnit(unit,fallbackUnit)}`;
  return parseDimensionString(text,[orderHint,embeddedHint].filter(Boolean).join(" "));
}
function schemaProductDimensions(product){
  if(!product||typeof product!=="object")return null;
  const fallbackUnit=schemaDimensionDeclaredUnit(product.width)||schemaDimensionDeclaredUnit(product.depth)||schemaDimensionDeclaredUnit(product.height)||"cm";
  const values={
    w:schemaDimensionValue(product.width,fallbackUnit),
    d:schemaDimensionValue(product.depth,fallbackUnit),
    h:schemaDimensionValue(product.height,fallbackUnit)
  };
  const props=Array.isArray(product.additionalProperty)?product.additionalProperty:(product.additionalProperty?[product.additionalProperty]:[]);
  for(const prop of props){
    if(!prop||typeof prop!=="object")continue;
    const axis=schemaDimensionAxis(prop.name||prop.propertyID||"");
    if(axis&&!values[axis])values[axis]=schemaDimensionValue(prop,fallbackUnit);
  }
  if(values.w>0&&values.d>0&&values.h>0)return [values.w,values.d,values.h];

  const directComposite=schemaCompositeDimensions(product.size||product.dimensions||null,fallbackUnit);
  if(directComposite)return directComposite;
  for(const prop of props){
    if(!prop||typeof prop!=="object"||!schemaCompositeDimensionLabel(prop.name||prop.propertyID||""))continue;
    const label=prop.name||prop.propertyID||"";
    const dims=schemaCompositeDimensions(prop,fallbackUnit,label);
    if(dims)return dims;
  }
  return null;
}
function parseLocalizedPrice(value){
  if(typeof value==="number")return Number.isFinite(value)&&value>0?value:0;
  let s=String(value??"").trim().replace(/[\u00a0\u202f]/g," ");
  if(!s)return 0;
  s=s.replace(/[^\d.,'’\s]/g,"").replace(/[\s'’]/g,"");
  if(!/\d/.test(s))return 0;
  const normalizeWithDecimal=(decimalSep,groupSep)=>{
    let normalized=s;
    if(groupSep)normalized=normalized.split(groupSep).join("");
    const last=normalized.lastIndexOf(decimalSep);
    if(last<0)return normalized;
    normalized=normalized.slice(0,last).split(decimalSep).join("")+"."+normalized.slice(last+1);
    return normalized;
  };
  const commas=(s.match(/,/g)||[]).length,dots=(s.match(/\./g)||[]).length;
  let normalized=s;
  if(commas&&dots){
    const decimal=s.lastIndexOf(",")>s.lastIndexOf(".")?",":".";
    normalized=normalizeWithDecimal(decimal,decimal===","?".":",");
  }else if(commas||dots){
    const sep=commas?",":".",count=commas||dots;
    const last=s.lastIndexOf(sep),after=s.length-last-1;
    if(count>1){
      normalized=(after===1||after===2)?normalizeWithDecimal(sep,""):s.split(sep).join("");
    }else if(after===1||after===2){
      normalized=s.slice(0,last)+"."+s.slice(last+1);
    }else if(after===3){
      normalized=s.slice(0,last)+s.slice(last+1);
    }else{
      normalized=s.slice(0,last)+"."+s.slice(last+1);
    }
  }
  const number=Number(normalized);
  return Number.isFinite(number)&&number>0?number:0;
}
function normalizedCurrency(token){
  const raw=String(token||"").trim().toUpperCase();
  if(raw==="DH"||raw==="DHS"||raw==="MAD")return "MAD";
  if(raw==="€"||raw==="EUR")return "EUR";
  if(raw==="$"||raw==="USD")return "USD";
  return raw.slice(0,6);
}
function schemaOfferPrice(offers){
  const list=Array.isArray(offers)?offers:[offers];
  for(const offer of list){
    if(!offer||typeof offer!=="object")continue;
    const specs=Array.isArray(offer.priceSpecification)?offer.priceSpecification:[offer.priceSpecification].filter(Boolean);
    const candidates=[
      {value:offer.price,currency:offer.priceCurrency},
      {value:offer.lowPrice,currency:offer.priceCurrency},
      {value:offer.highPrice,currency:offer.priceCurrency},
      ...specs.flatMap(spec=>[
        {value:spec?.price,currency:spec?.priceCurrency||offer.priceCurrency},
        {value:spec?.minPrice,currency:spec?.priceCurrency||offer.priceCurrency},
        {value:spec?.maxPrice,currency:spec?.priceCurrency||offer.priceCurrency}
      ])
    ];
    for(const candidate of candidates){
      const price=parseLocalizedPrice(candidate.value);
      if(price>0)return {price,currency:normalizedCurrency(candidate.currency)};
    }
  }
  return {price:0,currency:""};
}
function parseReaderPrice(text){
  const currency="(?:DH|DHS|MAD|EUR|USD|€|\\$)";
  for(const line of String(text||"").slice(0,6000).split(/\r?\n/)){
    const suffix=new RegExp("(\\d[\\d\\s\\u00a0\\u202f.,'’]*?)\\s*("+currency+")(?![A-Za-z])","i").exec(line);
    if(suffix){
      const price=parseLocalizedPrice(suffix[1]);
      if(price>0)return {price,currency:normalizedCurrency(suffix[2])};
    }
    const prefix=new RegExp("("+currency+")\\s*(\\d[\\d\\s\\u00a0\\u202f.,'’]*\\d|\\d)","i").exec(line);
    if(prefix){
      const price=parseLocalizedPrice(prefix[2]);
      if(price>0)return {price,currency:normalizedCurrency(prefix[1])};
    }
  }
  return {price:0,currency:""};
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
    const offerPrice=schemaOfferPrice(product.offers);
    if(offerPrice.price>0){out.price=offerPrice.price;out.currency=offerPrice.currency}
    const image=Array.isArray(product.image)?product.image[0]:product.image;
    if(typeof image==="string")out.image=image;
    const dims=schemaProductDimensions(product);
    if(dims)[out.w,out.d,out.h]=dims;
  }
  out.name=out.name||doc.querySelector('meta[property="og:title"]')?.content||doc.querySelector("h1")?.textContent?.trim()||doc.title||"";
  out.image=out.image||doc.querySelector('meta[property="og:image"]')?.content||"";
  if(!out.price){
    out.price=parseLocalizedPrice(doc.querySelector('meta[property="product:price:amount"]')?.content);
    out.currency=out.currency||normalizedCurrency(doc.querySelector('meta[property="product:price:currency"]')?.content);
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
  const dims=parseReaderDimensions(txt,title);
  if(dims)[out.w,out.d,out.h]=dims;
  const sku=(txt.match(/\b(\d{3})\.(\d{3})\.(\d{2})\b/)||txt.match(/\b(\d{3})\s(\d{3})\s(\d{2})\b/));
  out.sku=sku?`${sku[1]}.${sku[2]}.${sku[3]}`:(info.sku||"");
  const readerPrice=parseReaderPrice(txt);
  if(readerPrice.price>0){out.price=readerPrice.price;out.currency=readerPrice.currency}
  const img=(txt.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)||[])[1];
  if(img)out.image=img;
  return out;
}
function mergeProductInfo(base,extra){
  const out={...base};
  for(const k of ["name","sku","currency","image"]){if(!out[k]&&extra[k])out[k]=extra[k]}
  for(const k of ["w","d","h"]){if(!(Number(out[k])>0)&&Number(extra[k])>0)out[k]=Number(extra[k])}
  if(!(parseLocalizedPrice(out.price)>0)&&parseLocalizedPrice(extra.price)>0)out.price=parseLocalizedPrice(extra.price);
  out.url=out.url||extra.url||"";
  return out;
}
function inferredProductInfo(url){
  const info=ikeaUrlInfo(url);
  return {url,name:info.name||"",sku:info.sku||"",price:0,currency:"MAD",image:"",retailer:retailerName(url)};
}
function productNeedsDimensionEnrichment(p){
  return !(Number(p?.w)>0&&Number(p?.d)>0&&Number(p?.h)>0);
}
function shouldUseProductReader(directOk,p){
  return !directOk||productNeedsDimensionEnrichment(p);
}
async function fetchSmartProduct(url){
  let data=inferredProductInfo(url),source="URL",directOk=false;
  try{
    const r=await fetch(url,{headers:{"Accept":"text/html,application/xhtml+xml"}});
    if(r.ok){
      data=mergeProductInfo(data,parseHtmlProduct(await r.text(),url));
      source="product page";directOk=true;
    }
  }catch(e){}
  if(shouldUseProductReader(directOk,data)){
    try{
      const reader=`https://r.jina.ai/${url}`;
      const r=await fetch(reader,{headers:{"Accept":"text/plain"}});
      if(r.ok){
        const beforeDims=[data.w,data.d,data.h].map(Number);
        data=mergeProductInfo(data,parseReaderProduct(await r.text(),url));
        const enriched=beforeDims.some((v,i)=>!(v>0)&&Number([data.w,data.d,data.h][i])>0);
        source=directOk?(enriched?"product page + public reader":"product page"):"public reader";
      }
    }catch(e2){}
  }
  return {data,source};
}
function productCompleteness(p){
  const keys=["name","w","d","h","price","sku"];
  return keys.filter(k=>k==="price"?parseLocalizedPrice(p[k])>0:!!p[k]).length;
}
function importedFields(p){
  return {
    name:String(p?.name||"").trim(),
    w:Number(p?.w)||0,d:Number(p?.d)||0,h:Number(p?.h)||0,
    price:parseLocalizedPrice(p?.price),
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
function printablePlacementLabels(layout,itemLookup=boxById){
  return (layout||[]).map((p,index)=>{
    const purpose=placementLabel(p);if(!purpose)return null;
    const item=itemLookup(p.typeId);
    return {
      index:index+1,purpose,itemName:item?.name||p.typeId,
      w:Number(p.w)||0,d:Number(p.d)||0,h:Number(p.h)||0,z:Number(p.z)||0
    };
  }).filter(Boolean);
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
function buildLabelPrintSheet(){
  const layout=layouts[selectedLayout],s=storage();if(!layout||!s)return false;
  const labels=printablePlacementLabels(layout);if(!labels.length)return false;
  $("printSheet").innerHTML=`<div class="labelsheet">
    <div class="labelsheethead"><h1>${esc(s.name)} — Organizer labels</h1><div class="printmeta">${labels.length} label${labels.length===1?"":"s"} · ${esc(state.unit)}</div></div>
    <div class="labelgrid">${labels.map(x=>`<article class="labelcard">
      <div class="labelpurpose">${esc(x.purpose)}</div>
      <div class="labelitem">${esc(x.itemName)}</div>
      <div class="labelmeta">Placement #${x.index} · ${fmt(x.w)} × ${fmt(x.d)} × ${fmt(x.h)} ${esc(state.unit)}${x.z>0?` · stacked at z ${fmt(x.z)} ${esc(state.unit)}`:""}</div>
      <div class="labelstorage">${esc(s.name)}</div>
    </article>`).join("")}</div>
  </div>`;
  return true;
}

function buildMeasurementWorksheetPrintSheet(){
  const data=measurementWorksheetData();if(!data.storageCount)return false;
  const roomHtml=data.rooms.map(room=>`<section class="measureroom">
    <h2>${esc(room.roomName)}</h2>
    ${room.furniture.map(item=>`<section class="measurefurniture">
      <div class="measurefurniturehead"><strong>${esc(item.furnitureName)}</strong><span>${item.spaces.length} storage space${item.spaces.length===1?"":"s"}</span></div>
      <table class="measuretable"><thead><tr><th>Storage space</th><th>Saved W × D × H</th><th>Measured W</th><th>Measured D</th><th>Measured H</th><th>Constraints / notes</th></tr></thead><tbody>
        ${item.spaces.map(space=>`<tr>
          <td><strong>${esc(space.storageName)}</strong></td>
          <td>${fmt(space.width)} × ${fmt(space.depth)} × ${fmt(space.height)} ${esc(data.unit)}</td>
          <td class="measureblank"></td><td class="measureblank"></td><td class="measureblank"></td>
          <td class="measurenotes"><strong>${space.measurement.status==="current"?"Measured":space.measurement.status==="stale"?"Needs recheck":"Not measured"}</strong><br>${space.blockedZones||space.dividers?`${space.blockedZones} blocked · ${space.dividers} divider${space.dividers===1?"":"s"}<br>`:""}<span>________________________</span></td>
        </tr>`).join("")}
      </tbody></table>
    </section>`).join("")}
  </section>`).join("");
  $("printSheet").innerHTML=`<div class="measurementsheet">
    <h1>Storage Fit — Measurement worksheet</h1>
    <div class="printmeta">${data.storageCount} storage space${data.storageCount===1?"":"s"} · project unit: ${esc(data.unit)} · use the narrowest usable inside dimensions</div>
    <div class="measurementtips"><strong>Measure before planning:</strong> record usable inside width, depth and height. Note rails, hinges, lips, tracks, posts, dividers, sloped backs, or any obstruction that reduces usable space.</div>
    ${roomHtml}
  </div>`;
  return true;
}

function buildProjectChecklistPrintSheet(){
  const data=projectChecklistData();if(!data.totals.storages)return false;
  const roomHtml=data.rooms.map(room=>`<section class="projectcheckroom">
    <div class="projectcheckroomhead"><h2>${esc(room.roomName)}</h2><span>${room.installed}/${room.total} installed · ${room.chosen}/${room.total} chosen · ${room.currentPlans}/${room.total} current plans</span></div>
    <table class="projectchecktable"><thead><tr><th></th><th>Storage space</th><th>Status</th><th>Next step</th><th>Blocker</th></tr></thead><tbody>
      ${room.spaces.map(space=>`<tr><td class="projectcheckmark">${space.status==="installed"?"✓":"☐"}</td><td><strong>${esc(space.displayPath)}</strong></td><td><span class="projectcheckstatus ${esc(space.status)}">${esc(space.statusLabel)}</span></td><td>${esc(space.nextAction)}</td><td>${space.missing.length?space.missing.map(item=>esc(item.name)+" ×"+item.qty).join(" · "):"—"}</td></tr>`).join("")}
    </tbody></table>
  </section>`).join("");
  const shoppingHtml=data.shopping.length
    ?`<table class="projectchecktable projectcheckshopping"><thead><tr><th>Organizer</th><th>Need</th><th>Purchased</th><th>Left</th><th>Storage spaces</th></tr></thead><tbody>${data.shopping.map(row=>`<tr><td><strong>${esc(row.name)}</strong></td><td class="num">${row.need}</td><td class="num">${row.purchased}</td><td class="num">${row.left}</td><td class="num">${row.storageCount}</td></tr>`).join("")}</tbody></table>`
    :`<div class="projectcheckempty">Nothing to buy for the current usable chosen plans.</div>`;
  $("printSheet").innerHTML=`<div class="projectchecksheet">
    <h1>Storage Fit — Project checklist</h1>
    <div class="printmeta">Generated ${esc(new Date().toLocaleString())} · ${esc(data.remainingText)}</div>
    <div class="projectchecksummary">
      <div><strong>${data.totals.installed}/${data.totals.storages}</strong><span>installed</span></div>
      <div><strong>${data.totals.chosen}/${data.totals.storages}</strong><span>chosen</span></div>
      <div><strong>${data.totals.currentPlans}/${data.totals.storages}</strong><span>current plans</span></div>
      <div><strong>${data.remainingUnits}</strong><span>units left to source</span></div>
    </div>
    <h2>Room checklist</h2>
    ${roomHtml}
    <section class="projectcheckshoppingsection"><h2>Shopping / receiving</h2><div class="printmeta">${data.boughtUnits} purchased · ${data.remainingUnits} left to source</div>${shoppingHtml}</section>
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
function storageMeasurementSignature(s,unit=state.unit){
  if(!s)return "";
  const scale=unitScale(unit,"cm"),n=value=>Math.round((Number(value)||0)*scale*100)/100;
  const obstacles=(s.obstacles||[]).map(o=>[
    n(o.x),n(o.y),n(o.w),n(o.d),n(o.h)
  ]).sort((a,b)=>a.join("|").localeCompare(b.join("|")));
  const dividers=(s.dividers||[]).map(d=>[
    d.orientation==="horizontal"?"h":"v",n(d.position),n(d.thickness),n(d.h)
  ]).sort((a,b)=>a.join("|").localeCompare(b.join("|")));
  return JSON.stringify([n(s.w),n(s.d),n(s.h),obstacles,dividers]);
}
function storageMeasurementStatus(s,unit=state.unit){
  const measuredAt=String(s?.measuredAt||""),signature=String(s?.measurementSignature||"");
  if(!measuredAt||!signature)return {status:"unverified",label:"Not measured",measuredAt:""};
  const current=storageMeasurementSignature(s,unit)===signature;
  return {status:current?"current":"stale",label:current?"Measured":"Needs recheck",measuredAt};
}
function markStorageMeasured(s,unit=state.unit,now=new Date()){
  if(!s)return null;
  const date=now instanceof Date?now:new Date(now);
  s.measuredAt=Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString();
  s.measurementSignature=storageMeasurementSignature(s,unit);
  return storageMeasurementStatus(s,unit);
}
function clearStorageMeasured(s){
  if(!s)return null;
  s.measuredAt="";s.measurementSignature="";
  return storageMeasurementStatus(s);
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
function savedPlanSourceSnapshot(plan){
  if(!plan)return null;
  return {
    planId:String(plan.planId||plan.id||""),
    name:String(plan.name||"").trim().slice(0,120),
    savedAt:String(plan.savedAt||""),
    storageId:String(plan.storageId||"")
  };
}
function planLineageMetadata(source){
  const s=savedPlanSourceSnapshot(source);
  if(!s||!s.planId)return {};
  return {
    derivedFromPlanId:s.planId,
    derivedFromName:s.name||"Saved plan",
    derivedFromSavedAt:s.savedAt||""
  };
}
function planLineageInfo(plan,plans=[]){
  const id=String(plan?.derivedFromPlanId||"");
  const snapshot=String(plan?.derivedFromName||"").trim();
  if(!id&&!snapshot)return null;
  const source=(plans||[]).find(p=>p.id===id);
  const name=String(source?.name||snapshot||"Previous saved plan").trim();
  return {
    planId:id,
    name,
    sourceExists:!!source,
    label:"Based on "+name+(id&&!source?" · source removed":"")
  };
}
function planFamilyInfo(planId,plans=[]){
  const all=plans||[],current=all.find(p=>p.id===planId);
  if(!current)return null;
  const lineage=planLineageInfo(current,all);
  const parent=lineage?.planId
    ? (all.find(p=>p.id===lineage.planId)||{id:lineage.planId,name:lineage.name,removed:true,storageId:current.storageId})
    : null;
  const children=all.filter(p=>p.derivedFromPlanId===current.id)
    .slice()
    .sort((a,b)=>String(a.savedAt||"").localeCompare(String(b.savedAt||""))||String(a.name||"").localeCompare(String(b.name||"")));
  return {current,parent,children,visibleCount:1+(parent?1:0)+children.length};
}
function placementDeltaDetails(before=[],after=[]){
  const a=(before||[]).map((p,index)=>({p,index,matched:false,status:"removed",partnerIndex:null,moved:false,reoriented:false,relabeled:false}));
  const b=(after||[]).map((p,index)=>({p,index,matched:false,status:"added",partnerIndex:null,moved:false,reoriented:false,relabeled:false}));
  const eps=1e-6;
  const num=v=>Number(v)||0;
  const label=p=>String(p?.label||"").trim();
  const exactKey=p=>JSON.stringify([
    p?.typeId||"",round6(num(p?.x)),round6(num(p?.y)),round6(num(p?.z)),
    round6(num(p?.w)),round6(num(p?.d)),round6(num(p?.h)),label(p)
  ]);
  const sameNum=(x,y)=>Math.abs(num(x)-num(y))<=eps;
  const queues=new Map();
  for(const row of b){
    const key=exactKey(row.p);
    if(!queues.has(key))queues.set(key,[]);
    queues.get(key).push(row);
  }
  for(const row of a){
    const q=queues.get(exactKey(row.p));
    const match=q?.find(x=>!x.matched);
    if(!match)continue;
    row.matched=true;match.matched=true;
    row.status="unchanged";match.status="unchanged";
    row.partnerIndex=match.index;match.partnerIndex=row.index;
  }

  const types=new Set([
    ...a.filter(x=>!x.matched).map(x=>x.p?.typeId||""),
    ...b.filter(x=>!x.matched).map(x=>x.p?.typeId||"")
  ]);
  for(const typeId of types){
    const aa=a.filter(x=>!x.matched&&(x.p?.typeId||"")===typeId);
    const bb=b.filter(x=>!x.matched&&(x.p?.typeId||"")===typeId);
    const candidates=[];
    for(const left of aa)for(const right of bb){
      const pos=Math.abs(num(left.p.x)-num(right.p.x))+Math.abs(num(left.p.y)-num(right.p.y))+Math.abs(num(left.p.z)-num(right.p.z));
      const dims=Math.abs(num(left.p.w)-num(right.p.w))+Math.abs(num(left.p.d)-num(right.p.d))+Math.abs(num(left.p.h)-num(right.p.h));
      const labelPenalty=label(left.p)===label(right.p)?0:0.25;
      candidates.push({left,right,score:pos+dims*2+labelPenalty});
    }
    candidates.sort((x,y)=>x.score-y.score||x.left.index-y.left.index||x.right.index-y.right.index);
    for(const pair of candidates){
      if(pair.left.matched||pair.right.matched)continue;
      pair.left.matched=true;pair.right.matched=true;
      const moved=!sameNum(pair.left.p.x,pair.right.p.x)||!sameNum(pair.left.p.y,pair.right.p.y)||!sameNum(pair.left.p.z,pair.right.p.z);
      const reoriented=!sameNum(pair.left.p.w,pair.right.p.w)||!sameNum(pair.left.p.d,pair.right.p.d)||!sameNum(pair.left.p.h,pair.right.p.h);
      const relabeled=label(pair.left.p)!==label(pair.right.p);
      pair.left.status=pair.right.status=(moved||reoriented||relabeled)?"modified":"unchanged";
      pair.left.partnerIndex=pair.right.index;pair.right.partnerIndex=pair.left.index;
      pair.left.moved=pair.right.moved=moved;
      pair.left.reoriented=pair.right.reoriented=reoriented;
      pair.left.relabeled=pair.right.relabeled=relabeled;
    }
  }
  return {before:a,after:b};
}
function placementDeltaSummary(before=[],after=[]){
  const details=placementDeltaDetails(before,after);
  const a=details.before,b=details.after;
  const unchanged=a.filter(x=>x.status==="unchanged").length;
  const changed=a.filter(x=>x.status==="modified").length;
  const removed=a.filter(x=>x.status==="removed").length;
  const added=b.filter(x=>x.status==="added").length;
  const moved=a.filter(x=>x.status==="modified"&&x.moved).length;
  const reoriented=a.filter(x=>x.status==="modified"&&x.reoriented).length;
  const relabeled=a.filter(x=>x.status==="modified"&&x.relabeled).length;
  return {
    beforeCount:a.length,afterCount:b.length,unchanged,changed,added,removed,moved,reoriented,relabeled,
    quantityDelta:b.length-a.length
  };
}
function planPreviewSnapshot(plan){
  if(!plan)return null;
  const live=state.storages.find(s=>s.id===plan.storageId);
  const s=plan.storageSnapshot||live;
  if(!s)return null;
  const settings=plan.settings||{clearanceEnabled:false,clearance:0,unit:state.unit};
  const clearance=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const W=Math.max(0,(Number(s.w)||0)-2*clearance),D=Math.max(0,(Number(s.d)||0)-2*clearance);
  if(W<=0||D<=0)return null;
  return {storage:s,settings,clearance,W,D,obstacles:usableObstaclesFor(s,clearance),unit:settings.unit||state.unit};
}
function savedPlanTopPreview(plan,annotations=[],width=360,height=220){
  const snap=planPreviewSnapshot(plan);if(!snap)return '<div class="revisionpreviewempty">Preview unavailable</div>';
  const g=topGeometry(snap.W,snap.D,width,height);
  const annotationMap=new Map((annotations||[]).map(a=>[a.index,a]));
  const obstacleRects=snap.obstacles.map((o,index)=>{
    const divider=o.kind==="divider",stroke=divider?"#416b8e":"#b23c3c";
    return '<rect x="'+(g.ox+o.x*g.scale)+'" y="'+(g.oy+o.y*g.scale)+'" width="'+(o.w*g.scale)+'" height="'+(o.d*g.scale)+'" fill="'+stroke+'" fill-opacity="'+(divider?".20":".10")+'" stroke="'+stroke+'" stroke-width="1.3" '+(divider?'':'stroke-dasharray="5 4"')+'/>';
  }).join("");
  const rects=(plan.layout||[]).map((p,index)=>{
    const a=annotationMap.get(index),status=a?.status||"unchanged";
    const stroke=status==="removed"?"#b23c3c":status==="added"?"#166c45":status==="modified"?"#a66000":colorFor(p.typeId);
    const dash=status==="removed"?' stroke-dasharray="6 4"':"";
    const fillOpacity=status==="unchanged"?".18":".30";
    const title=placementLabel(p)||p.name||boxById(p.typeId)?.name||p.typeId||("Item "+(index+1));
    return '<g><rect x="'+(g.ox+(Number(p.x)||0)*g.scale)+'" y="'+(g.oy+(Number(p.y)||0)*g.scale)+'" width="'+((Number(p.w)||0)*g.scale)+'" height="'+((Number(p.d)||0)*g.scale)+'" rx="3" fill="'+stroke+'" fill-opacity="'+fillOpacity+'" stroke="'+stroke+'" stroke-width="'+(status==="unchanged"?"1.4":"2.5")+'"'+dash+'/><title>'+esc(title)+'</title></g>';
  }).join("");
  return '<svg class="revisionpreviewsvg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Saved plan top view"><rect x="'+g.ox+'" y="'+g.oy+'" width="'+(snap.W*g.scale)+'" height="'+(snap.D*g.scale)+'" fill="#fff" stroke="#222" stroke-width="2"/>'+obstacleRects+rects+'</svg>';
}
function revisionDeltaInfo(basePlan,revisionPlan){
  if(!basePlan||basePlan.removed||!revisionPlan)return null;
  const placements=placementDeltaSummary(basePlan.layout||[],revisionPlan.layout||[]);
  const a=planMetrics(basePlan),b=planMetrics(revisionPlan);
  const pa=purchaseCostProfile(basePlan.layout||[]),pb=purchaseCostProfile(revisionPlan.layout||[]);
  const costDelta=pa.singleCurrency&&pa.singleCurrency===pb.singleCurrency&&pa.knownTotal!==null&&pb.knownTotal!==null
    ? {currency:pa.singleCurrency,value:pb.knownTotal-pa.knownTotal}
    : null;
  return {
    placements,
    utilizationDelta:b.utilizationPct-a.utilizationPct,
    purchaseUnitsDelta:pb.purchaseUnits-pa.purchaseUnits,
    costDelta
  };
}
function revisionDeltaText(delta){
  if(!delta)return "";
  const p=delta.placements,parts=[];
  if(p.added)parts.push("+"+p.added+" added");
  if(p.removed)parts.push("-"+p.removed+" removed");
  if(p.moved)parts.push(p.moved+" moved");
  if(p.reoriented)parts.push(p.reoriented+" reoriented");
  if(p.relabeled)parts.push(p.relabeled+" relabeled");
  if(!parts.length)parts.push("same placements");
  const util=(delta.utilizationDelta>=0?"+":"")+delta.utilizationDelta.toFixed(1)+" pp utilization";
  const buy=delta.purchaseUnitsDelta===0?"same units to buy":(delta.purchaseUnitsDelta>0?"+":"")+delta.purchaseUnitsDelta+" units to buy";
  const cost=delta.costDelta&&Math.abs(delta.costDelta.value)>1e-9
    ? " · "+(delta.costDelta.value>0?"+":"")+money(delta.costDelta.value,delta.costDelta.currency)
    : "";
  return parts.join(" · ")+" · "+util+" · "+buy+cost;
}
function createSavedPlanForStorage(target,layout,{name=null,note="",derivedFrom=null,settings=null,goal=null,stacking=null}={}){
  const signature=planSignature(target.id,layout);
  const existing=state.savedPlans.find(p=>p.signature===signature);
  if(existing)return existing;
  const sameStorage=state.savedPlans.filter(p=>p.storageId===target.id).length+1;
  const savedSettings=settings?JSON.parse(JSON.stringify(settings)):capturePlanSettings();
  const plan={
    id:uid("plan"),
    name:name||`${target.name} · Plan ${sameStorage}`,
    note,
    storageId:target.id,
    storageName:target.name,
    storagePath:storageBreadcrumb(target),
    storageSnapshot:captureStorageSnapshot(target),
    itemSnapshots:capturePlanItems(layout),
    settings:savedSettings,
    savedAt:new Date().toISOString(),
    validatedAt:new Date().toISOString(),
    goal:goal||state.optimizeGoal,
    stacking:stacking==null?state.enableStacking:!!stacking,
    signature,
    ...planLineageMetadata(derivedFrom),
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
function physicalPlanEquivalent(a,b){
  if(!a||!b||a.storageId!==b.storageId)return false;
  const delta=placementDeltaSummary(a.layout||[],b.layout||[]);
  return delta.added===0&&delta.removed===0&&delta.moved===0&&delta.reoriented===0;
}
function carryInstalledPlanForward(targetState,impact){
  if(!impact?.preservesInstalled)return false;
  targetState.installedPlanIds=targetState.installedPlanIds&&typeof targetState.installedPlanIds==="object"?targetState.installedPlanIds:{};
  targetState.installedPlanIds[impact.storageId]=impact.planId;
  return true;
}
function planChoiceImpact(planId,targetState=state){
  const plans=targetState.savedPlans||[],plan=plans.find(p=>p.id===planId);if(!plan)return null;
  const previousChosenId=targetState.chosenPlanIds?.[plan.storageId]||"";
  const previousInstalledId=targetState.installedPlanIds?.[plan.storageId]||"";
  const installedPlan=previousInstalledId?plans.find(p=>p.id===previousInstalledId&&p.storageId===plan.storageId):null;
  const switchingInstalled=!!previousInstalledId&&previousInstalledId!==plan.id;
  const preservesInstalled=switchingInstalled&&physicalPlanEquivalent(installedPlan,plan);
  return {
    planId:plan.id,
    storageId:plan.storageId,
    alreadyChosen:previousChosenId===plan.id,
    previousChosenId,
    previousInstalledId,
    preservesInstalled,
    clearsInstalled:switchingInstalled&&!preservesInstalled
  };
}
function choosePlan(planId){
  const plan=state.savedPlans.find(p=>p.id===planId);if(!plan)return false;
  state.chosenPlanIds=state.chosenPlanIds||{};
  if(state.chosenPlanIds[plan.storageId]===plan.id)return true;
  const health=planHealth(plan);
  if(health.status!=="current"){
    alert(health.status==="review"
      ?"Review and revalidate this plan before choosing it."
      :"This plan is no longer valid with the current storage/items. Open it and rebuild or edit it first.");
    return false;
  }
  const impact=planChoiceImpact(planId);
  state.chosenPlanIds[plan.storageId]=plan.id;
  carryInstalledPlanForward(state,impact);
  normalizeInstallState(state);return true;
}
function toggleChosenPlan(planId){
  const plan=state.savedPlans.find(p=>p.id===planId);if(!plan)return false;
  state.chosenPlanIds=state.chosenPlanIds||{};
  if(state.chosenPlanIds[plan.storageId]===plan.id){
    delete state.chosenPlanIds[plan.storageId];
    normalizeInstallState(state);return true;
  }
  return choosePlan(planId);
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
  const allocation=currentInstallAllocation();
  const impact=installOrderMoveImpact(storageId,delta,{install:allocation,installOrder:state.installOrder});
  if(!impact.changed)return false;
  if(impact.transitions.length){
    const gains=impact.gainedReady.length
      ?"Would become Ready:\n"+impact.gainedReady.map(item=>"• "+item.path).join("\n")
      :"No waiting spaces would become Ready.";
    const losses=impact.lostReady.length
      ?"Would become Waiting:\n"+impact.lostReady.map(item=>"• "+item.path).join("\n")
      :"No currently Ready spaces would become Waiting.";
    if(!confirm(`Change install order?\n\n${gains}\n\n${losses}\n\nThis only changes which unfinished spaces reserve shared owned inventory first.`))return false;
  }
  state.installOrder=impact.order;
  localStorage.setItem(KEY,JSON.stringify(state));renderInstallDashboard();
  return true;
}
function findMoreReadyInstallOrder(){
  normalizeInstallState(state);
  const allocation=currentInstallAllocation(),suggestion=suggestInstallOrder({install:allocation,installOrder:state.installOrder});
  if(!suggestion.improved){
    alert(suggestion.exact
      ?`Current order already yields ${suggestion.currentReady} Ready space${suggestion.currentReady===1?"":"s"}. No install order can make more spaces Ready with the current owned stock.`
      :`No better order was found before the search cap. The current order still yields ${suggestion.currentReady} Ready space${suggestion.currentReady===1?"":"s"}.`);
    return false;
  }
  const gains=suggestion.gainedReady.length
    ?"Would become Ready:\n"+suggestion.gainedReady.map(item=>"• "+item.path).join("\n")
    :"No additional waiting spaces would become Ready.";
  const losses=suggestion.lostReady.length
    ?"Would become Waiting:\n"+suggestion.lostReady.map(item=>"• "+item.path).join("\n")
    :"No currently Ready spaces would become Waiting.";
  const searchNote=suggestion.exact
    ?"Search completed for the current unfinished install plans."
    :"Search hit its responsiveness cap; this is the best better order found so far.";
  if(!confirm(`Use a better install order?\n\nReady now: ${suggestion.currentReady} → ${suggestion.bestReady}\n${searchNote}\n\n${gains}\n\n${losses}\n\nOnly install order will change.`))return false;
  state.installOrder=suggestion.order;
  localStorage.setItem(KEY,JSON.stringify(state));renderInstallDashboard();
  return true;
}
function installUnlockImpactHtml(result){
  const gained=Array.isArray(result?.gainedReady)?result.gainedReady:[];
  const lost=Array.isArray(result?.lostReady)?result.lostReady:[];
  if(!gained.length&&!lost.length)return "";
  const gainedHtml=gained.length
    ?`<div class="installunlockimpactgroup"><strong>Would become Ready</strong>${gained.map(item=>`<span>${esc(item.path)}</span>`).join("")}</div>`
    :`<div class="installunlockimpactgroup"><strong>No additional space becomes Ready</strong></div>`;
  const lostHtml=lost.length
    ?`<div class="installunlockimpactgroup warn"><strong>Would become Waiting</strong>${lost.map(item=>`<span>${esc(item.path)}</span>`).join("")}</div>`
    :`<div class="installunlockimpactgroup"><strong>No baseline-Ready space is displaced</strong></div>`;
  return `<details class="installunlockimpact"><summary>Show impact · ${gained.length} become Ready${lost.length?` · ${lost.length} displaced`:""}</summary><div class="installunlockimpactbody"><div class="installunlockimpactnote">Compared with the best allocation possible using current owned stock.</div>${gainedHtml}${lostHtml}</div></details>`;
}
function renderInstallUnlockAnalysis(){
  const panel=$("installUnlockPanel"),summary=$("installUnlockSummary"),list=$("installUnlockList");
  if(!panel||!summary||!list)return;
  if(installUnlockAnalysisCache?.fingerprint!==installUnlockFingerprint())installUnlockAnalysisCache=null;
  const analysis=installUnlockAnalysisCache?.analysis;
  if(!analysis){panel.style.display="none";summary.textContent="";list.innerHTML="";return}
  panel.style.display="block";
  const searchNote=analysis.baselineExact&&analysis.allExact?"exact analysis":"bounded analysis";
  const capNote=analysis.candidateCapped?` · first ${analysis.analyzedCandidates} of ${analysis.totalCandidates} scarce organizer types checked`:"";
  summary.textContent=`${analysis.baselineReady} Ready at best with current stock · ${searchNote}${capNote}`;
  if(!analysis.rows.length){
    if(analysis.bundle){
      const bundleExact=analysis.bundle.exact&&analysis.bundleAllExact&&!analysis.bundleTruncated&&!analysis.bundleCandidateCapped;
      const parts=analysis.bundle.parts.map(part=>`+${part.qty} ${esc(part.name)}`).join(" · ");
      const purchase=analysis.bundle.parts.map(part=>{
        if(part.boughtQty>0)return `<span class="unlockbadge bought">${esc(part.name)} purchased ×${part.boughtQty}</span>`;
        if(part.remainingQty>0)return `<span class="unlockbadge">${esc(part.name)} to source ×${part.remainingQty}</span>`;
        return "";
      }).filter(Boolean).join(" ");
      const scopeNote=analysis.bundleCandidateCapped
        ?`first ${analysis.bundleAnalyzedCandidates} of ${analysis.totalCandidates} scarce types`
        :`all ${analysis.bundleAnalyzedCandidates} scarce types`;
      list.innerHTML=`<div class="installunlockbundle"><div><div class="installunlocktitle">${bundleExact?"Smallest unlock bundle":"Smallest bundle found"}: ${parts} <span class="unlockgain">+${analysis.bundle.gain} Ready</span></div><div class="installunlockmeta">Best Ready count: ${analysis.baselineReady} → ${analysis.bundle.bestReady} · ${bundleExact?"exact":"bounded"} search · ${scopeNote} · ${analysis.bundleScenarios} bundle scenarios checked ${purchase}</div>${installUnlockImpactHtml(analysis.bundle)}</div><div class="installunlockbundleactions">${analysis.bundle.parts.map(part=>`<button class="btn soft" type="button" data-unlock-shopping="${part.id}">${esc(part.name)} · Shopping / receiving</button>`).join("")}</div></div>`;
      list.querySelectorAll("[data-unlock-shopping]").forEach(btn=>btn.addEventListener("click",()=>focusShoppingItem(btn.dataset.unlockShopping)));
      return;
    }
    const bounded=analysis.bundleTruncated||analysis.bundleCandidateCapped||!analysis.bundleAllExact;
    list.innerHTML=`<div class="empty">${bounded
      ?`No unlock bundle was found in the bounded search up to +${analysis.bundleUnitLimit} units.`
      :`No stock addition up to +${analysis.bundleUnitLimit} units increases the maximum Ready count.`}</div>`;
    return;
  }
  list.innerHTML=analysis.rows.slice(0,8).map(row=>{
    const purchase=row.boughtQty>0
      ?`<span class="unlockbadge bought">Already purchased ×${row.boughtQty}</span>`
      :row.remainingQty>0?`<span class="unlockbadge">Still to source ×${row.remainingQty}</span>`:"";
    const exact=row.exact?"exact":"bounded";
    return `<div class="installunlockrow" data-unlock-item="${row.id}"><div><div class="installunlocktitle">+1 ${esc(row.name)} <span class="unlockgain">+${row.gain} Ready</span></div><div class="installunlockmeta">Best Ready count: ${analysis.baselineReady} → ${row.bestReady} · ${exact} search ${purchase}</div>${installUnlockImpactHtml(row)}</div><button class="btn soft" type="button" data-unlock-shopping="${row.id}">Shopping / receiving</button></div>`;
  }).join("");
  list.querySelectorAll("[data-unlock-shopping]").forEach(btn=>btn.addEventListener("click",()=>focusShoppingItem(btn.dataset.unlockShopping)));
}
function analyzeInstallStockUnlocks(){
  normalizeInstallState(state);
  const allocation=currentInstallAllocation();
  const analysis=stockUnlockAnalysis({install:allocation,installOrder:state.installOrder});
  installUnlockAnalysisCache={fingerprint:installUnlockFingerprint(),analysis};
  renderInstallUnlockAnalysis();
  return analysis;
}
function renderInstallDashboard(){
  const sec=$("installDashboardSection");if(!sec)return;
  normalizeInstallState(state);
  const allocation=currentInstallAllocation(),entries=allocation.entries;
  if(!entries.length){
    sec.style.display="none";$("installQueue").innerHTML="";renderProjectNextActions();renderRoomProgressOverview();return;
  }
  sec.style.display="block";
  const installed=entries.filter(e=>e.status==="installed").length;
  const ready=entries.filter(e=>e.status==="ready").length;
  const waiting=entries.filter(e=>e.status==="waiting").length;
  const stale=entries.filter(e=>e.status==="stale").length;
  $("installProgressText").textContent=`${installed}/${entries.length} installed`;
  const findMoreReadyBtn=$("findMoreReadyBtn");
  if(findMoreReadyBtn){findMoreReadyBtn.disabled=waiting===0||ready+waiting<2;findMoreReadyBtn.onclick=findMoreReadyInstallOrder}
  const analyzeUnlocksBtn=$("analyzeUnlocksBtn");
  if(analyzeUnlocksBtn){analyzeUnlocksBtn.disabled=waiting===0;analyzeUnlocksBtn.onclick=analyzeInstallStockUnlocks}
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
    return `<div class="installcard ${entry.status}" data-install-card="${entry.storageId}">
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
        <button class="btn soft" type="button" data-install-up="${entry.storageId}" title="Move earlier in install order" ${index===0?"disabled":""}>↑</button>
        <button class="btn soft" type="button" data-install-down="${entry.storageId}" title="Move later in install order" ${index===entries.length-1?"disabled":""}>↓</button>
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
  renderProjectNextActions();renderRoomProgressOverview();renderInstallUnlockAnalysis();
  $("installQueue").querySelectorAll("[data-install-undo]").forEach(btn=>btn.addEventListener("click",()=>{
    delete state.installedPlanIds[btn.dataset.installUndo];
    localStorage.setItem(KEY,JSON.stringify(state));renderInstallDashboard();renderHomeProcurement();
  }));
}

function renderDistributionWorkDashboard(){
  const sec=$("distributionWorkSection");if(!sec)return;
  const rows=ownedDistributionWorkRows();
  const list=$("distributionWorkList");
  if(!rows.length){
    sec.style.display="none";
    if(list)list.innerHTML="";
    renderProjectNextActions();return;
  }
  sec.style.display="block";
  const summary=ownedDistributionWorkSummary(rows);
  $("distributionWorkProgress").textContent=summary.doneAllocations+"/"+summary.allocations+" allocations done";
  $("distributionWorkSummary").innerHTML=
    '<div class="installstat"><div class="k">Sessions</div><div class="v">'+summary.sessions+'</div></div>'+
    '<div class="installstat"><div class="k">Allocations</div><div class="v">'+summary.doneAllocations+'/'+summary.allocations+'</div><div class="small">done</div></div>'+
    '<div class="installstat"><div class="k">Owned copies</div><div class="v">'+summary.doneCopies+'/'+summary.assignedCopies+'</div><div class="small">done</div></div>'+
    '<div class="installstat"><div class="k">Out of date</div><div class="v">'+summary.staleSessions+'</div></div>'+
    '<div class="installstat"><div class="k">Complete</div><div class="v">'+summary.completeSessions+'</div></div>';
  list.innerHTML=rows.map(row=>{
    const p=row.progress,session=row.session;
    const statusLabel=row.status==="stale"?"Out of date":row.status==="done"?"Complete":row.status==="opened"?"In progress":"Not started";
    const actionLabel=row.status==="stale"?"Review & recalculate":row.status==="done"?"Review":"Resume";
    const spaces=(session.allocations||[]).length;
    const remaining=Math.max(0,Math.floor(Number(session.remaining)||0));
    const meta=session.assigned+" of "+session.requested+" owned copies assigned across "+spaces+" space"+(spaces===1?"":"s")+
      " · "+p.done+" done · "+p.opened+" opened · "+p.pending+" pending"+
      (remaining?" · "+remaining+" unassigned":"");
    const note=row.stale
      ?'<div class="installmissing">Inputs changed since this plan was calculated. Resume it to recalculate before opening allocations.</div>'
      :'';
    const allocations=(session.allocations||[]).map(allocation=>{
      const view=ownedDistributionAllocationView(allocation,row.stale);
      return '<div class="distributionworkallocation '+view.status+(row.stale?" stale":"")+'"><div><div class="fitdistributiontitle">'+allocation.assigned+' owned → '+esc(allocation.storagePath)+' <span class="distributionstatus '+view.status+'">'+view.statusLabel+'</span></div><div class="fitdistributionmeta">'+esc(view.sourceLabel)+' · '+allocation.capacity+' '+esc(view.certaintyLabel)+(row.stale?" · out of date":"")+'</div></div><div class="fitmatchactions"><button class="btn soft" type="button" data-distribution-allocation-open="'+allocation.id+'" data-distribution-item="'+row.itemId+'" '+(view.disabled?"disabled":"")+'>'+view.openLabel+'</button><button class="btn primary" type="button" data-distribution-allocation-apply="'+allocation.id+'" data-distribution-item="'+row.itemId+'" '+(view.disabled?"disabled":"")+'>'+view.applyLabel+'</button><button class="btn soft" type="button" data-distribution-allocation-done="'+allocation.id+'" data-distribution-item="'+row.itemId+'" '+(view.disabled?"disabled":"")+'>'+view.doneLabel+'</button></div></div>';
    }).join("");
    return '<div class="distributionworkcard '+row.status+'"><div><div class="installtitle">'+esc(row.item.name||"Item")+
      ' <span class="distributionworkstatus '+row.status+'">'+statusLabel+'</span></div><div class="installmeta">'+esc(meta)+
      '</div>'+note+'</div><div class="installactions"><button class="btn primary" type="button" data-distribution-resume="'+row.itemId+'">'+actionLabel+
      '</button>'+((session.allocations||[]).length>1?'<button class="btn primary" type="button" data-distribution-apply-all="'+row.itemId+'" '+(row.stale?"disabled":"")+'>Apply all '+session.allocations.length+'</button>':"")+
      '<button class="btn soft" type="button" data-distribution-clear="'+row.itemId+'">Clear session</button></div><div class="distributionworkallocations">'+allocations+'</div></div>';
  }).join("");
  list.querySelectorAll("[data-distribution-resume]").forEach(btn=>btn.addEventListener("click",()=>resumeOwnedDistributionWork(btn.dataset.distributionResume)));
  list.querySelectorAll("[data-distribution-allocation-open]").forEach(btn=>btn.addEventListener("click",()=>{
    openOwnedDistributionAllocation(btn.dataset.distributionItem,btn.dataset.distributionAllocationOpen);
  }));
  list.querySelectorAll("[data-distribution-allocation-apply]").forEach(btn=>btn.addEventListener("click",()=>{
    const result=applyOwnedDistributionAllocation(btn.dataset.distributionItem,btn.dataset.distributionAllocationApply);
    if(!result.ok){alert(result.reasons?.[0]||"This allocation could not be applied safely.");return}
    renderAll();
  }));
  list.querySelectorAll("[data-distribution-apply-all]").forEach(btn=>btn.addEventListener("click",()=>{
    const itemId=btn.dataset.distributionApplyAll,row=ownedDistributionWorkRows().find(x=>x.itemId===itemId);
    if(!row||row.stale)return;
    const count=(row.session.allocations||[]).length;
    if(!confirm("Apply all "+count+" distribution destinations to the project? This saves and chooses each plan, and may clear Installed status where a physical layout changes."))return;
    const result=applyAllOwnedDistributionAllocations(itemId);
    if(!result.ok){
      const first=result.errors?.[0];
      alert(first?.reasons?.[0]||"The full distribution could not be applied safely.");
      return;
    }
    renderAll();
  }));
  list.querySelectorAll("[data-distribution-allocation-done]").forEach(btn=>btn.addEventListener("click",()=>{
    toggleOwnedDistributionAllocationDone(btn.dataset.distributionItem,btn.dataset.distributionAllocationDone);
  }));
  renderProjectNextActions();
  list.querySelectorAll("[data-distribution-clear]").forEach(btn=>btn.addEventListener("click",()=>{
    const itemId=btn.dataset.distributionClear,row=ownedDistributionWorkRows().find(x=>x.itemId===itemId);
    if(!row)return;
    if(!confirm('Clear the distribution work session for "'+(row.item.name||"this item")+'"? This removes workflow progress only; it does not change inventory or saved plans.'))return;
    delete state.ownedDistributionSessions[itemId];
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderDistributionWorkDashboard();
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
  localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderHomeProcurement();renderInstallUnlockAnalysis();
}
function clampPurchaseReceiptQuantity(boughtQty,value){
  const bought=Math.max(0,Math.floor(Number(boughtQty)||0));
  if(!bought)return 0;
  return Math.max(1,Math.min(bought,Math.floor(Number(value)||1)));
}
function purchaseReceiptResult(ownedQty,boughtQty,requestedQty=boughtQty){
  const owned=Math.max(0,Math.min(999,Math.floor(Number(ownedQty)||0)));
  const bought=Math.max(0,Math.floor(Number(boughtQty)||0));
  const requested=Math.max(0,Math.floor(Number(requestedQty)||0));
  const received=Math.min(bought,requested,Math.max(0,999-owned));
  return {ownedQty:owned+received,boughtQty:bought-received,received};
}
function clampDeliveryReceiptQuantity(boughtQty,value){
  const bought=Math.max(0,Math.floor(Number(boughtQty)||0));
  return Math.max(0,Math.min(bought,Math.floor(Number(value)||0)));
}
function normalizeDeliveryReceiptSelection(purchaseRows,selections={}){
  const selected=[];
  for(const row of purchaseRows||[]){
    const requested=clampDeliveryReceiptQuantity(row.boughtQty,selections?.[row.id]);
    if(requested>0)selected.push({id:row.id,name:row.name||"Item",boughtQty:Math.max(0,Math.floor(Number(row.boughtQty)||0)),requested});
  }
  return selected;
}
function purchasedDeliveryImpact(selections={},options={}){
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const plans=Array.isArray(options.plans)?options.plans:entries.filter(entry=>entry.status!=="stale"&&entry.plan).map(entry=>entry.plan);
  const ownedById=options.ownedById&&typeof options.ownedById==="object"
    ?{...options.ownedById}:Object.fromEntries(state.boxes.map(item=>[item.id,item.ownedQty||0]));
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const installOrder=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  const purchaseRows=Array.isArray(options.purchaseRows)?options.purchaseRows:projectProcurement(plans).rows;
  const selected=normalizeDeliveryReceiptSelection(purchaseRows,selections);
  const beforeReady=entries.filter(entry=>entry.status==="ready").length;
  const hypotheticalOwned={...ownedById},received=[];
  for(const row of selected){
    const result=purchaseReceiptResult(hypotheticalOwned[row.id],row.boughtQty,row.requested);
    if(!result.received)continue;
    hypotheticalOwned[row.id]=result.ownedQty;
    received.push({...row,qty:result.received});
  }
  const totalUnits=received.reduce((sum,row)=>sum+row.qty,0);
  if(!totalUnits){
    return {totalUnits:0,selected:[],beforeReady,afterReady:beforeReady,readyDelta:0,gainedReady:[],lostReady:[],transitions:[]};
  }
  const after=installAllocationSnapshot(hypotheticalOwned,{install,plans,installedPlanIds,installOrder});
  const impact=installScenarioTransitions(install,after,options);
  const afterReady=after.entries.filter(entry=>entry.status==="ready").length;
  return {
    totalUnits,selected:received,beforeReady,afterReady,readyDelta:afterReady-beforeReady,
    gainedReady:impact.gainedReady,lostReady:impact.lostReady,transitions:impact.transitions
  };
}
function purchasedReceiptImpact(itemId,requestedQty=1,options={}){
  const install=options.install||currentInstallAllocation();
  const entries=Array.isArray(install?.entries)?install.entries:[];
  const plans=Array.isArray(options.plans)?options.plans:entries.filter(entry=>entry.status!=="stale"&&entry.plan).map(entry=>entry.plan);
  const ownedById=options.ownedById&&typeof options.ownedById==="object"
    ?{...options.ownedById}:Object.fromEntries(state.boxes.map(item=>[item.id,item.ownedQty||0]));
  const installedPlanIds=options.installedPlanIds&&typeof options.installedPlanIds==="object"?options.installedPlanIds:state.installedPlanIds;
  const installOrder=Array.isArray(options.installOrder)?options.installOrder:entries.map(entry=>entry.storageId);
  const purchaseRows=Array.isArray(options.purchaseRows)?options.purchaseRows:projectProcurement(plans).rows;
  const row=purchaseRows.find(item=>item.id===itemId);
  const available=Math.max(0,Math.floor(Number(row?.boughtQty)||0));
  const receipt=purchaseReceiptResult(ownedById[itemId],available,requestedQty);
  const qty=receipt.received;
  const beforeReady=entries.filter(entry=>entry.status==="ready").length;
  if(!qty)return {itemId,qty:0,available,beforeReady,afterReady:beforeReady,readyDelta:0,gainedReady:[],lostReady:[],transitions:[]};
  const hypotheticalOwned={...ownedById,[itemId]:receipt.ownedQty};
  const after=installAllocationSnapshot(hypotheticalOwned,{install,plans,installedPlanIds,installOrder});
  const impact=installScenarioTransitions(install,after,options);
  const afterReady=after.entries.filter(entry=>entry.status==="ready").length;
  return {
    itemId,qty,available,beforeReady,afterReady,readyDelta:afterReady-beforeReady,
    gainedReady:impact.gainedReady,lostReady:impact.lostReady,transitions:impact.transitions
  };
}
function receivePurchasedItem(itemId,requestedQty=null,options={}){
  const persist=options.persist!==false,checkpoint=options.checkpoint??persist;
  const row=projectProcurement().rows.find(r=>r.id===itemId);
  const item=boxById(itemId);
  if(!row||!item||row.boughtQty<=0)return 0;
  const requested=requestedQty==null?row.boughtQty:requestedQty;
  const result=purchaseReceiptResult(item.ownedQty,row.boughtQty,requested);
  if(!result.received)return 0;
  if(checkpoint)createRecoveryCheckpoint(`Before receiving ${result.received} × ${item.name||row.name||"item"}`);
  item.ownedQty=result.ownedQty;
  state.shoppingBought=state.shoppingBought||{};
  if(result.boughtQty>0)state.shoppingBought[itemId]=result.boughtQty;
  else delete state.shoppingBought[itemId];
  if(persist){
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderInstallUnlockAnalysis();
  }
  return result.received;
}
function purchaseArrivalTransitionHtml(title,rows,warn=false){
  if(!rows?.length)return "";
  return `<div class="purchasearrivalgroup${warn?" warn":""}"><strong>${title}</strong>${rows.map(item=>`<span>${esc(item.path)}</span>`).join("")}</div>`;
}
function receiptImpactDeltaText(impact){
  if(impact.readyDelta>0)return `+${impact.readyDelta} Ready`;
  if(impact.readyDelta<0)return `${impact.readyDelta} Ready`;
  return "same Ready count";
}
function receiptImpactScenarioHtml(label,impact){
  const changes=purchaseArrivalTransitionHtml("Would become Ready",impact.gainedReady)+
    purchaseArrivalTransitionHtml("Would become Waiting",impact.lostReady,true);
  return `<div class="receiptimpactscenario"><div class="receiptimpacttitle"><strong>${label}</strong><span>${impact.beforeReady} → ${impact.afterReady} Ready · ${receiptImpactDeltaText(impact)}</span></div>${changes||'<div class="purchasearrivalquiet">No chosen storage changes readiness under the current queue.</div>'}</div>`;
}
function purchaseReceiptImpactHtml(row,options={},selectedQty=1){
  if(!row?.boughtQty)return "";
  const selected=clampPurchaseReceiptQuantity(row.boughtQty,selectedQty);
  const selectedImpact=purchasedReceiptImpact(row.id,selected,options);
  const all=row.boughtQty>1&&selected!==row.boughtQty?purchasedReceiptImpact(row.id,row.boughtQty,options):null;
  return `<details class="receiptimpact"><summary>Preview receipt impact</summary><div class="receiptimpactbody">${receiptImpactScenarioHtml(`Receive ×${selected}`,selectedImpact)}${all?receiptImpactScenarioHtml(`Receive all ×${row.boughtQty}`,all):""}<div class="purchasearrivalquiet">Preview only. Change the receipt quantity above to test a different partial delivery.</div></div></details>`;
}
function syncReceiptQuantityControl(input,row,options={}){
  if(!input||!row?.boughtQty)return 0;
  const qty=clampPurchaseReceiptQuantity(row.boughtQty,input.value);
  input.value=qty;
  const card=input.closest("[data-home-shop-item]");
  const button=card?.querySelector("[data-receive-selected]");
  if(button)button.textContent=`Receive ×${qty}`;
  const preview=card?.querySelector("[data-receipt-impact]");
  if(preview){
    const wasOpen=!!preview.querySelector("details")?.open;
    preview.innerHTML=purchaseReceiptImpactHtml(row,options,qty);
    if(wasOpen){
      const details=preview.querySelector("details");if(details)details.open=true;
    }
  }
  return qty;
}
function deliveryImpactHtml(impact){
  if(!impact.totalUnits)return '<div class="purchasearrivalquiet">Enter quantities for the organizer types that arrived in this delivery.</div>';
  const items=impact.selected.map(row=>`${esc(row.name)} ×${row.qty}`).join(" · ");
  const changes=purchaseArrivalTransitionHtml("Would become Ready",impact.gainedReady)+
    purchaseArrivalTransitionHtml("Would become Waiting",impact.lostReady,true);
  return `<div class="deliverybatchimpacthead"><strong>${impact.totalUnits} organizer${impact.totalUnits===1?"":"s"} selected</strong><span>${impact.beforeReady} → ${impact.afterReady} Ready · ${receiptImpactDeltaText(impact)}</span></div><div class="purchasearrivalitems"><strong>Receiving:</strong> ${items}</div>${changes||'<div class="purchasearrivalquiet">No chosen storage changes readiness under the current install queue.</div>'}`;
}
function readDeliveryBatchSelection(panel){
  const selections={};
  panel?.querySelectorAll("[data-delivery-qty]").forEach(input=>{selections[input.dataset.deliveryQty]=input.value});
  return selections;
}
function renderDeliveryBatch(summary=projectProcurement()){
  const panel=$("deliveryBatchPanel");if(!panel)return;
  const purchasedRows=(summary?.rows||[]).filter(row=>row.boughtQty>0);
  if(purchasedRows.length<2){panel.style.display="none";panel.innerHTML="";return}
  panel.style.display="block";
  panel.innerHTML=`<details><summary>Receive a mixed delivery</summary><div class="deliverybatchbody"><div class="purchasearrivalquiet">Enter only the quantities physically present in this delivery. Nothing changes until you press Receive selected delivery.</div><div class="deliverybatchrows">${purchasedRows.map(row=>`<label class="deliverybatchrow"><span><strong>${esc(row.name)}</strong><small>Purchased ×${row.boughtQty}</small></span><input type="number" min="0" max="${row.boughtQty}" step="1" value="0" inputmode="numeric" data-delivery-qty="${row.id}" aria-label="Quantity of ${esc(row.name)} in this delivery"></label>`).join("")}</div><div class="deliverybatchimpact" data-delivery-impact></div><div class="deliverybatchactions"><button class="btn soft" type="button" data-delivery-clear>Clear</button><button class="btn primary" type="button" data-delivery-receive disabled>Receive selected delivery</button></div></div></details>`;
  const install=currentInstallAllocation(),options={purchaseRows:summary.rows,install};
  const sync=()=>{
    panel.querySelectorAll("[data-delivery-qty]").forEach(input=>{
      const row=purchasedRows.find(item=>item.id===input.dataset.deliveryQty);
      if(row&&input.value!=="")input.value=clampDeliveryReceiptQuantity(row.boughtQty,input.value);
    });
    const impact=purchasedDeliveryImpact(readDeliveryBatchSelection(panel),options);
    const impactEl=panel.querySelector("[data-delivery-impact]");if(impactEl)impactEl.innerHTML=deliveryImpactHtml(impact);
    const receive=panel.querySelector("[data-delivery-receive]");
    if(receive){receive.disabled=!impact.totalUnits;receive.textContent=impact.totalUnits?`Receive ${impact.totalUnits} selected`:"Receive selected delivery"}
    return impact;
  };
  panel.querySelectorAll("[data-delivery-qty]").forEach(input=>{
    input.addEventListener("input",()=>{if(input.value!=="")sync()});
    input.addEventListener("change",sync);
  });
  panel.querySelector("[data-delivery-clear]")?.addEventListener("click",()=>{
    panel.querySelectorAll("[data-delivery-qty]").forEach(input=>{input.value=0});sync();
  });
  panel.querySelector("[data-delivery-receive]")?.addEventListener("click",()=>{
    const impact=sync();if(!impact.totalUnits)return;
    createRecoveryCheckpoint(`Before receiving mixed delivery · ${impact.totalUnits} organizer${impact.totalUnits===1?"":"s"}`);
    let received=0;
    for(const row of impact.selected)received+=receivePurchasedItem(row.id,row.qty,{persist:false,checkpoint:false});
    if(received){
      localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderInstallUnlockAnalysis();renderAll();
    }
  });
  sync();
}
function renderPurchaseArrivalPreview(summary=projectProcurement()){
  const panel=$("purchaseArrivalPreview");if(!panel)return;
  if(!summary?.boughtUnits){panel.style.display="none";panel.innerHTML="";return}
  const analysis=purchasedArrivalAnalysis({purchaseRows:summary.rows});
  const arriving=analysis.purchased.map(row=>`${esc(row.name)} ×${row.requestedQty}${row.blockedQty?` (receivable ×${row.qty})`:""}`).join(" · ");
  const blockedNote=analysis.blockedUnits
    ?`<div class="purchasearrivalquiet"><strong>${analysis.blockedUnits} purchased organizer${analysis.blockedUnits===1?" is":"s are"} not receivable</strong> because owned inventory is already at the 999-unit safety cap for those item types.</div>`
    :"";
  const delta=analysis.afterReady-analysis.beforeReady;
  const deltaText=delta>0?`+${delta} Ready`:delta<0?`${delta} Ready`:"same Ready count";
  const currentChanges=purchaseArrivalTransitionHtml("Would become Ready",analysis.gainedReady)+
    purchaseArrivalTransitionHtml("Would become Waiting",analysis.lostReady,true);
  const currentDetail=currentChanges||'<div class="purchasearrivalquiet">No chosen storage changes readiness with the current queue order.</div>';
  const optimize=analysis.optimizationGain>0
    ?`<div class="purchasearrivalopt"><strong>Reorder opportunity after receipt: +${analysis.optimizationGain} more Ready</strong><div>Best after arrival: ${analysis.bestReady} Ready · ${analysis.optimizationExact?"exact":"bounded"} order search.</div>${purchaseArrivalTransitionHtml("Would become Ready after reordering",analysis.optimizedGainedReady)}${purchaseArrivalTransitionHtml("Would become Waiting after reordering",analysis.optimizedLostReady,true)}<div class="purchasearrivalquiet">Receiving does not change install order automatically; use Find more Ready afterward if you want the better allocation.</div></div>`
    :`<div class="purchasearrivalquiet">Current queue already reaches the best Ready count found after these arrivals${analysis.optimizationExact?".":" in the bounded order search."}</div>`;
  panel.style.display="block";
  panel.innerHTML=`<div class="purchasearrivalhead"><strong>When purchases arrive</strong><span>${analysis.boughtUnits} purchased organizer${analysis.boughtUnits===1?"":"s"} · ${analysis.receivableUnits} receivable</span></div><div class="purchasearrivalmeta">Current queue: ${analysis.beforeReady} → ${analysis.afterReady} Ready · ${deltaText}. Earlier waiting plans can start reserving shared stock once their missing items arrive.</div><div class="purchasearrivalitems"><strong>Arriving:</strong> ${arriving}</div>${blockedNote}<details><summary>Show arrival impact</summary><div class="purchasearrivalbody">${currentDetail}${optimize}</div></details>`;
}
function renderHomeProcurement(){
  renderBoxStockSummary();renderBoxList();renderItemPicker();
  const sec=$("homeProcurementSection");if(!sec)return;
  const summary=projectProcurement();
  if(!summary.plans.length){
    sec.style.display="none";$("homeProcurementList").innerHTML="";
    $("receivePurchasesBtn").disabled=true;
    renderPurchaseArrivalPreview(summary);renderDeliveryBatch(summary);
    renderProjectNextActions();return;
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
  renderPurchaseArrivalPreview(summary);
  renderDeliveryBatch(summary);
  const receiptImpactOptions={purchaseRows:summary.rows,install:currentInstallAllocation()};

  $("homeProcurementList").innerHTML=summary.rows.map(r=>`<div class="homeshoprow" data-home-shop-item="${r.id}">
    <div><div class="shopname">${esc(r.name)}</div><div class="shopsub">${r.sku?esc(r.sku)+" · ":""}used in ${r.storageCount} storage${r.storageCount===1?"":"s"}</div></div>
    <div class="shopnum">Use ×${r.qty}</div>
    <div class="shopnum">Own ×${r.ownedUsed}</div>
    <div class="shopnum">Need ×${r.buyQty}</div>
    <div class="purchasecontrol">
      ${r.buyQty?`<button class="btn soft" type="button" data-bought-dec="${r.id}" aria-label="Decrease purchased quantity">−</button><span class="purchasecount">${r.boughtQty}</span><button class="btn soft" type="button" data-bought-inc="${r.id}" aria-label="Increase purchased quantity">+</button>`:'<span class="purchasecount">✓</span>'}
    </div>
    <div class="shopnum"><strong>Left ×${r.remainingQty}</strong></div>
    <div class="shopnum shopsubtotal">${r.remainingQty&&r.price>0?money(r.remainingSubtotal,r.currency):r.remainingQty?"—":"✓"}</div>
    <div class="shopaction">${r.remainingQty&&r.url?`<a class="shoplink" href="${esc(r.url)}" target="_blank" rel="noopener">Product ↗</a>`:""}${r.buyQty&&r.boughtQty!==r.buyQty?` <button class="btn soft" type="button" data-bought-all="${r.id}">All bought</button>`:""}${r.boughtQty?` <span class="receiptqty"><input type="number" min="1" max="${r.boughtQty}" step="1" value="1" inputmode="numeric" data-receive-qty="${r.id}" aria-label="Quantity of ${esc(r.name)} to receive"><button class="btn soft" type="button" data-receive-selected="${r.id}">Receive ×1</button></span>${r.boughtQty>1?` <button class="btn soft" type="button" data-receive-all="${r.id}">Receive all ×${r.boughtQty}</button>`:""}`:""}</div>
    ${r.boughtQty?`<div class="receiptimpactcell" data-receipt-impact="${r.id}">${purchaseReceiptImpactHtml(r,receiptImpactOptions,1)}</div>`:""}
  </div>`).join("") || '<div class="empty">No items in the chosen plans.</div>';

  $("homeProcurementList").querySelectorAll("[data-bought-dec]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=projectProcurement().rows.find(r=>r.id===btn.dataset.boughtDec);if(row)setShoppingBought(row.id,row.boughtQty-1);
  }));
  $("homeProcurementList").querySelectorAll("[data-bought-inc]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=projectProcurement().rows.find(r=>r.id===btn.dataset.boughtInc);if(row)setShoppingBought(row.id,row.boughtQty+1);
  }));
  renderProjectNextActions();
  $("homeProcurementList").querySelectorAll("[data-bought-all]").forEach(btn=>btn.addEventListener("click",()=>{
    const row=projectProcurement().rows.find(r=>r.id===btn.dataset.boughtAll);if(row)setShoppingBought(row.id,row.buyQty);
  }));
  $("homeProcurementList").querySelectorAll("[data-receive-qty]").forEach(input=>{
    const row=summary.rows.find(r=>r.id===input.dataset.receiveQty);if(!row)return;
    const sync=()=>syncReceiptQuantityControl(input,row,receiptImpactOptions);
    input.addEventListener("input",()=>{if(input.value!=="")sync()});
    input.addEventListener("change",sync);
  });
  $("homeProcurementList").querySelectorAll("[data-receive-selected]").forEach(btn=>btn.addEventListener("click",()=>{
    const card=btn.closest("[data-home-shop-item]"),input=card?.querySelector("[data-receive-qty]");
    const row=summary.rows.find(r=>r.id===btn.dataset.receiveSelected);if(!row||!input)return;
    const qty=syncReceiptQuantityControl(input,row,receiptImpactOptions);
    if(qty&&receivePurchasedItem(row.id,qty))renderAll();
  }));
  $("homeProcurementList").querySelectorAll("[data-receive-all]").forEach(btn=>btn.addEventListener("click",()=>{
    if(receivePurchasedItem(btn.dataset.receiveAll))renderAll();
  }));
}
function receiveMarkedPurchases(){
  const rows=projectProcurement().rows.filter(row=>row.boughtQty>0);
  if(!rows.length)return 0;
  createRecoveryCheckpoint(`Before receiving all purchases · ${rows.reduce((sum,row)=>sum+row.boughtQty,0)} organizer${rows.reduce((sum,row)=>sum+row.boughtQty,0)===1?"":"s"}`);
  let received=0;
  for(const row of rows)received+=receivePurchasedItem(row.id,null,{persist:false,checkpoint:false});
  if(received){
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderInstallUnlockAnalysis();
  }
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
function closePlanFamilyModal(){
  planFamilyModalOpen=false;
  $("planFamilyModal").classList.remove("open");
  $("planFamilyModal").setAttribute("aria-hidden","true");
  if(!detailModalOpen&&!compareModalOpen&&!itemFitModalOpen)document.body.classList.remove("modal-open");
}
function planFamilyRow(plan,role,currentId,basePlan=null){
  if(plan?.removed){
    return '<div class="fitmatch"><div><div class="fitmatchtitle">'+esc(plan.name||"Previous saved plan")+' <span class="usagebadge">Parent removed</span></div><div class="fitmatchmeta">The immediate parent is no longer saved. This name comes from the child plan\'s lineage snapshot.</div></div></div>';
  }
  const m=planMetrics(plan),health=planHealth(plan),chosen=isPlanChosen(plan),impact=planChoiceImpact(plan.id);
  const delta=revisionDeltaInfo(basePlan,plan),deltaText=revisionDeltaText(delta);
  const badges=[
    role==="parent"?'<span class="usagebadge">Parent</span>':"",
    role==="current"?'<span class="usagebadge chosen">Current</span>':"",
    role==="revision"?'<span class="usagebadge">Revision</span>':"",
    chosen?'<span class="usagebadge chosen">Chosen</span>':"",
    health.status!=="current"?'<span class="usagebadge">'+esc(health.status==="review"?"Review":"Invalid")+'</span>':""
  ].filter(Boolean).join("");
  const chooseLabel=chosen?"Chosen ✓":impact?.clearsInstalled?"Choose · re-install":impact?.preservesInstalled?"Choose · keep installed":role==="revision"?"Choose revision":role==="parent"?"Choose parent":"Choose";
  const installNote=impact?.clearsInstalled?" · switching will clear Installed":impact?.preservesInstalled?" · physical layout unchanged · Installed stays":"";
  return '<div class="fitmatch"><div><div class="fitmatchtitle">'+esc(plan.name||"Saved plan")+' '+badges+'</div><div class="fitmatchmeta">'+esc(m.storagePath)+' · '+m.itemCount+' item'+(m.itemCount===1?'':'s')+' · '+m.utilizationPct.toFixed(1)+'% '+esc(m.utilizationKind)+installNote+'</div>'+(deltaText?'<div class="revisiondelta"><strong>Δ vs parent</strong> · '+esc(deltaText)+'</div>':"")+'<div data-family-review-slot="'+plan.id+'"></div></div><div class="fitmatchactions">'+(basePlan?'<button class="btn soft" type="button" data-family-review="'+plan.id+'">Review changes</button>':"")+'<button class="btn '+(chosen?"primary":"soft")+'" type="button" data-family-choose="'+plan.id+'" '+(chosen||health.status!=="current"?"disabled":"")+'>'+chooseLabel+'</button><button class="btn soft" type="button" data-family-open="'+plan.id+'">'+(plan.id===currentId?'Open current':'Open')+'</button></div></div>';
}
function openPlanFamilyModal(planId){
  const family=planFamilyInfo(planId,state.savedPlans);if(!family)return;
  $("planFamilyTitle").textContent="Plan family · "+(family.current.name||"Saved plan");
  $("planFamilySubtitle").textContent="Immediate parent and direct revisions";
  const parentText=family.parent?(family.parent.removed?"1 removed parent":"1 parent"):"root plan";
  $("planFamilySummary").textContent=parentText+" · "+family.children.length+" direct revision"+(family.children.length===1?"":"s")+" · "+family.visibleCount+" visible family member"+(family.visibleCount===1?"":"s")+".";
  const rows=[];
  if(family.parent)rows.push(planFamilyRow(family.parent,"parent",family.current.id));
  rows.push(planFamilyRow(family.current,"current",family.current.id,family.parent&&!family.parent.removed?family.parent:null));
  for(const child of family.children)rows.push(planFamilyRow(child,"revision",family.current.id,family.current));
  $("planFamilyList").innerHTML=rows.join("");
  $("planFamilyList").querySelectorAll("[data-family-review]").forEach(btn=>btn.addEventListener("click",()=>{
    const revision=state.savedPlans.find(p=>p.id===btn.dataset.familyReview);
    const parent=revision&&state.savedPlans.find(p=>p.id===revision.derivedFromPlanId);
    const slot=$("planFamilyList").querySelector('[data-family-review-slot="'+btn.dataset.familyReview+'"]');
    if(!revision||!parent||!slot)return;
    if(slot.dataset.open==="true"){slot.innerHTML="";slot.dataset.open="false";btn.textContent="Review changes";return}
    const details=placementDeltaDetails(parent.layout||[],revision.layout||[]);
    const delta=revisionDeltaInfo(parent,revision);
    slot.innerHTML='<div class="revisionreview"><div class="revisionreviewsummary">'+esc(revisionDeltaText(delta))+'</div><div class="revisionpreviewgrid"><div class="revisionpreviewcard"><div class="revisionpreviewtitle">'+esc(parent.name||"Parent")+' <span>parent</span></div>'+savedPlanTopPreview(parent,details.before)+'</div><div class="revisionpreviewcard"><div class="revisionpreviewtitle">'+esc(revision.name||"Revision")+' <span>revision</span></div>'+savedPlanTopPreview(revision,details.after)+'</div></div><div class="revisionlegend"><span class="removed">Removed</span><span class="modified">Modified</span><span class="added">Added</span><span>Unchanged</span></div></div>';
    slot.dataset.open="true";btn.textContent="Hide changes";
  }));
  $("planFamilyList").querySelectorAll("[data-family-choose]").forEach(btn=>btn.addEventListener("click",()=>{
    const planId=btn.dataset.familyChoose,impact=planChoiceImpact(planId);
    if(!impact||impact.alreadyChosen)return;
    if(impact.clearsInstalled&&!confirm("This storage is marked Installed with a different plan. Choosing this revision will mark it as pending installation again. Continue?"))return;
    if(!toggleChosenPlan(planId))return;
    localStorage.setItem(KEY,JSON.stringify(state));renderBackupStats();renderSavedPlans();renderInstallDashboard();renderHomeProcurement();openPlanFamilyModal(planId);
  }));
  $("planFamilyList").querySelectorAll("[data-family-open]").forEach(btn=>btn.addEventListener("click",()=>{
    closePlanFamilyModal();openSavedPlan(btn.dataset.familyOpen);
  }));
  planFamilyModalOpen=true;
  $("planFamilyModal").classList.add("open");
  $("planFamilyModal").setAttribute("aria-hidden","false");
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
    const chosen=isPlanChosen(plan),health=planHealth(plan),lineage=planLineageInfo(plan,state.savedPlans);
    return `<article class="comparecard ${chosen?"chosen":""}">
      <div class="comparetitle">${esc(plan.name)}${chosen?'<span class="chosenbadge">Chosen</span>':""}${health.status!=="current"?`<span class="planhealth ${health.status}">${health.status==="review"?"Review":"Invalid"}</span>`:""}</div>
      <div class="comparestorage">${esc(m.storagePath)} · ${esc(goalLabel(plan.goal))}</div>
      ${lineage?`<div class="planlineage">${esc(lineage.label)}</div>`:""}
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
  capacityLayoutContext=null;
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
  savedPlanSourceContext=savedPlanSourceSnapshot(plan);
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
    const chosen=isPlanChosen(p),selected=comparePlanIds.has(p.id),health=planHealth(p),lineage=planLineageInfo(p,state.savedPlans),family=planFamilyInfo(p.id,state.savedPlans);
    return `<div class="savedcard ${chosen?"chosen":""} ${health.status!=="current"?health.status:""}">
      <div class="savedhead">
        <div>
          <div class="savedname">${esc(p.name)}${chosen?'<span class="chosenbadge">Chosen</span>':""}${health.status!=="current"?`<span class="planhealth ${health.status}">${health.status==="review"?"Review":"Invalid"}</span>`:""}</div>
          <div class="savedmeta">${esc(m.storagePath)} · ${m.itemCount} item${m.itemCount===1?"":"s"} · ${m.utilizationPct.toFixed(1)}% ${esc(m.utilizationKind)}</div>
          ${lineage?`<div class="planlineage">${esc(lineage.label)}</div>`:""}
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
        ${family&&family.visibleCount>1?`<button class="btn soft" type="button" data-plan-family="${p.id}">Family (${family.visibleCount})</button>`:""}
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
  el.querySelectorAll("[data-plan-family]").forEach(btn=>btn.addEventListener("click",()=>openPlanFamilyModal(btn.dataset.planFamily)));
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
  capacityLayoutContext=null;
  savedPlanSourceContext=null;
  layouts=[];selectedLayout=0;currentGaps=[];selectedGap=-1;galleryWasCapped=false;closeDetailModal();closeCompareModal();closePlanFamilyModal();
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



function floorPlacementValid(p,placed,W,D,H,obstacles,gap){
  const z=Number(p.z)||0;
  if(z>1e-9||p.x<gap-1e-9||p.y<gap-1e-9||p.x+p.w+gap>W+1e-9||p.y+p.d+gap>D+1e-9||p.h>H+1e-9)return false;
  if(obstacles.some(o=>overlap3D(p,o,gap)))return false;
  if(placed.some(q=>overlap3D(p,q,gap)))return false;
  return true;
}
function maxFloorCopiesInStorage(item,S,settings={},options={}){
  if(!item||!S)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0};
  const c=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const W=Math.max(0,(Number(S.w)||0)-2*c),D=Math.max(0,(Number(S.d)||0)-2*c),H=Math.max(0,(Number(S.h)||0)-2*c);
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  const nodeLimit=Math.max(100,Math.floor(Number(options.nodeLimit)||CAPACITY_SEARCH_LIMIT));
  const copyLimit=Math.max(1,Math.floor(Number(options.copyLimit)||CAPACITY_COPY_LIMIT));
  if(W<=0||D<=0||H<=0)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,W,D,H};
  const obstacles=usableObstaclesFor(S,c),forceUpright=settings.uprightOnly!==false;
  const oris=orientations(item,forceUpright).filter(o=>o[0]+2*gap<=W+1e-9&&o[1]+2*gap<=D+1e-9&&o[2]<=H+1e-9);
  if(!oris.length)return {count:0,layout:[],exact:true,truncated:false,capped:false,nodes:0,W,D,H};
  const minArea=Math.min(...oris.map(o=>o[0]*o[1])),freeArea=freeFloorArea(W,D,obstacles);
  const areaUpper=Math.max(0,Math.floor((freeArea+1e-9)/Math.max(1e-9,minArea)));
  const target=Math.min(copyLimit,areaUpper);
  let best=[],nodes=0,truncated=false,capped=false;
  const visited=new Set();

  // Seed the search with a fast deterministic packing so pruning starts from
  // a useful lower bound instead of zero.
  for(const o of oris){
    const placed=[];
    while(placed.length<target){
      let next=null;
      for(const [x,y] of candidatePointsFor(placed,obstacles,o[0],o[1],gap)){
        const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]};
        if(floorPlacementValid(p,placed,W,D,H,obstacles,gap)){next=p;break}
      }
      if(!next)break;
      placed.push(next);
    }
    if(placed.length>best.length)best=placed.map(p=>({...p}));
  }

  function recurse(placed){
    nodes++;
    if(nodes>nodeLimit){truncated=true;return}
    if(placed.length>best.length)best=placed.map(p=>({...p}));
    if(placed.length>=target){
      if(areaUpper>copyLimit)capped=true;
      return;
    }
    const remainingArea=Math.max(0,freeArea-occupiedArea(placed));
    if(placed.length+Math.floor((remainingArea+1e-9)/Math.max(1e-9,minArea))<=best.length)return;
    const sig=canonicalLayout(placed);
    if(visited.has(sig))return;
    visited.add(sig);

    for(const o of oris){
      for(const [x,y] of candidatePointsFor(placed,obstacles,o[0],o[1],gap)){
        const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]};
        if(!floorPlacementValid(p,placed,W,D,H,obstacles,gap))continue;
        recurse([...placed,p]);
        if(truncated||capped)return;
      }
    }
  }
  recurse([]);
  return {count:best.length,layout:best,exact:!truncated&&!capped,truncated,capped,nodes,W,D,H};
}

function maxCopiesInStorage(item,S,settings={},options={}){
  const stackingEnabled=!!settings.enableStacking&&!!item?.canBeStacked&&!!item?.canSupportStack;
  if(!stackingEnabled){
    const floor=maxFloorCopiesInStorage(item,S,settings,options);
    return {...floor,mode:"floor",floorCount:floor.count,stackedCount:0,stackingEnabled:!!settings.enableStacking,stackSummary:packingStackSummary(floor.layout||[],[],id=>id===item?.id?item:null)};
  }
  const plan={id:"capacity:"+String(S?.id||""),storageId:S?.id||"",stacking:true,settings:{clearanceEnabled:!!settings.clearanceEnabled,clearance:Math.max(0,Number(settings.clearance)||0),fitTolerance:Math.max(0,Number(settings.fitTolerance)||0),uprightOnly:settings.uprightOnly!==false},layout:[]};
  const lookup=typeof options.itemLookup==="function"?options.itemLookup:(id=>id===item.id?item:null);
  const result=maxAdditionalCopiesInPlan(item,plan,S,{...options,itemLookup:lookup});
  return {...result,mode:"3d",stackingEnabled:true};
}

function fitDimensionMargins(w,d,h,W,D,H,gap=0){
  const g=Math.max(0,Number(gap)||0);
  const widthMargin=Math.max(0,(Number(W)||0)-(Number(w)||0)-2*g);
  const depthMargin=Math.max(0,(Number(D)||0)-(Number(d)||0)-2*g);
  const heightMargin=Math.max(0,(Number(H)||0)-(Number(h)||0));
  const ranked=[
    {axis:"width",margin:widthMargin},
    {axis:"depth",margin:depthMargin},
    {axis:"height",margin:heightMargin}
  ].sort((a,b)=>a.margin-b.margin||a.axis.localeCompare(b.axis));
  return {
    widthMargin,depthMargin,heightMargin,
    tightestMargin:ranked[0].margin,tightestAxis:ranked[0].axis,
    totalMargin:widthMargin+depthMargin+heightMargin
  };
}
function fitDimensionDeficits(w,d,h,W,D,H,gap=0){
  const g=Math.max(0,Number(gap)||0);
  const widthDeficit=Math.max(0,(Number(w)||0)+2*g-(Number(W)||0));
  const depthDeficit=Math.max(0,(Number(d)||0)+2*g-(Number(D)||0));
  const heightDeficit=Math.max(0,(Number(h)||0)-(Number(H)||0));
  const ranked=[
    {axis:"width",deficit:widthDeficit},
    {axis:"depth",deficit:depthDeficit},
    {axis:"height",deficit:heightDeficit}
  ].sort((a,b)=>b.deficit-a.deficit||a.axis.localeCompare(b.axis));
  return {
    widthDeficit,depthDeficit,heightDeficit,
    maxDeficit:ranked[0].deficit,primaryAxis:ranked[0].axis,
    totalDeficit:widthDeficit+depthDeficit+heightDeficit
  };
}
function itemFitInStorage(item,S,settings={}){
  if(!item||!S)return null;
  const c=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const W=Math.max(0,(Number(S.w)||0)-2*c),D=Math.max(0,(Number(S.d)||0)-2*c),H=Math.max(0,(Number(S.h)||0)-2*c);
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  if(W<=0||D<=0||H<=0)return null;
  const obstacles=usableObstaclesFor(S,c),forceUpright=settings.uprightOnly!==false;
  let best=null;
  for(const o of orientations(item,forceUpright)){
    let placement=null;
    for(const [x,y] of candidatePointsFor([],obstacles,o[0],o[1],gap)){
      const p={typeId:item.id,name:item.name,x:round6(x),y:round6(y),z:0,w:o[0],d:o[1],h:o[2]};
      if(validPlacement(p,[],item,W,D,H,obstacles,gap)){placement=p;break}
    }
    if(!placement)continue;
    const margins=fitDimensionMargins(o[0],o[1],o[2],W,D,H,gap);
    const freeAfter=Math.max(0,usableVolume(W,D,H,obstacles)-o[0]*o[1]*o[2]);
    const candidate={x:placement.x,y:placement.y,w:placement.w,d:placement.d,h:placement.h,W,D,H,clearance:c,fitTolerance:gap,freeAfter,...margins};
    if(!best||candidate.tightestMargin>best.tightestMargin+1e-9||
      (Math.abs(candidate.tightestMargin-best.tightestMargin)<=1e-9&&candidate.totalMargin>best.totalMargin+1e-9)){
      best=candidate;
    }
  }
  return best;
}
function compatibleStoragesForItem(item,storages,settings={}){
  return (storages||[]).map(S=>{
    const fit=itemFitInStorage(item,S,settings);
    return fit?{storageId:S.id,storageName:S.name||"Storage",...fit}:null;
  }).filter(Boolean).sort((a,b)=>a.tightestMargin-b.tightestMargin||a.totalMargin-b.totalMargin||a.freeAfter-b.freeAfter||a.storageName.localeCompare(b.storageName));
}
function fitFailureInStorage(item,S,settings={}){
  if(!item||!S||itemFitInStorage(item,S,settings))return null;
  const c=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  const W=Math.max(0,(Number(S.w)||0)-2*c),D=Math.max(0,(Number(S.d)||0)-2*c),H=Math.max(0,(Number(S.h)||0)-2*c);
  const gap=Math.max(0,Number(settings.fitTolerance)||0),forceUpright=settings.uprightOnly!==false;
  let closest=null,dimensionallyFits=null;
  for(const o of orientations(item,forceUpright)){
    const deficits=fitDimensionDeficits(o[0],o[1],o[2],W,D,H,gap);
    const candidate={w:o[0],d:o[1],h:o[2],...deficits};
    if(deficits.maxDeficit<=1e-9){
      const margins=fitDimensionMargins(o[0],o[1],o[2],W,D,H,gap);
      if(!dimensionallyFits||margins.tightestMargin>dimensionallyFits.tightestMargin+1e-9){
        dimensionallyFits={...candidate,...margins};
      }
      continue;
    }
    if(!closest||candidate.maxDeficit<closest.maxDeficit-1e-9||
      (Math.abs(candidate.maxDeficit-closest.maxDeficit)<=1e-9&&candidate.totalDeficit<closest.totalDeficit-1e-9)){
      closest=candidate;
    }
  }
  const blockedCount=(S.obstacles||[]).length,dividerCount=(S.dividers||[]).length;
  if(dimensionallyFits){
    return {
      storageId:S.id,storageName:S.name||"Storage",reason:"constraints",
      W,D,H,clearance:c,fitTolerance:gap,blockedCount,dividerCount,
      w:dimensionallyFits.w,d:dimensionallyFits.d,h:dimensionallyFits.h,
      maxDeficit:0,totalDeficit:0
    };
  }
  return {
    storageId:S.id,storageName:S.name||"Storage",reason:"dimensions",
    W,D,H,clearance:c,fitTolerance:gap,blockedCount,dividerCount,
    ...(closest||{w:Number(item.w)||0,d:Number(item.d)||0,h:Number(item.h)||0,...fitDimensionDeficits(item.w,item.d,item.h,W,D,H,gap)})
  };
}
function fitFailuresForItem(item,storages,settings={}){
  return (storages||[]).map(S=>fitFailureInStorage(item,S,settings)).filter(Boolean).sort((a,b)=>{
    const ar=a.reason==="constraints"?0:a.maxDeficit,br=b.reason==="constraints"?0:b.maxDeficit;
    return ar-br||a.totalDeficit-b.totalDeficit||a.storageName.localeCompare(b.storageName);
  });
}

function maxFittingRemedyValue(item,S,settings,key,current){
  const upper=Math.max(0,Number(current)||0);
  const withValue=value=>key==="clearance"
    ?{...settings,clearanceEnabled:value>0,clearance:value}
    :{...settings,[key]:value};
  if(!itemFitInStorage(item,S,withValue(0)))return null;
  let lo=0,hi=upper;
  for(let i=0;i<24;i++){
    const mid=(lo+hi)/2;
    if(itemFitInStorage(item,S,withValue(mid)))lo=mid;else hi=mid;
  }
  return round6(lo);
}
function fitRemediesForFailure(item,S,settings={}){
  if(!item||!S||itemFitInStorage(item,S,settings))return [];
  const remedies=[];
  const gap=Math.max(0,Number(settings.fitTolerance)||0);
  if(gap>0){
    const value=maxFittingRemedyValue(item,S,settings,"fitTolerance",gap);
    if(value!==null&&value<gap-1e-6)remedies.push({kind:"fitTolerance",value,current:gap});
  }
  const clearance=settings.clearanceEnabled?Math.max(0,Number(settings.clearance)||0):0;
  if(clearance>0){
    const value=maxFittingRemedyValue(item,S,settings,"clearance",clearance);
    if(value!==null&&value<clearance-1e-6)remedies.push({kind:"clearance",value,current:clearance});
  }
  if(item.floorRotationLocked){
    const unlocked={...item,floorRotationLocked:false};
    if(itemFitInStorage(unlocked,S,settings))remedies.push({kind:"floorRotation"});
  }
  if(settings.uprightOnly!==false||item.uprightOnly!==false){
    const tippingItem={...item,uprightOnly:false};
    const tippingSettings={...settings,uprightOnly:false};
    if(itemFitInStorage(tippingItem,S,tippingSettings))remedies.push({kind:"tipping"});
  }
  let singleConstraintFix=false;
  for(const obstacle of S.obstacles||[]){
    const candidate={...S,obstacles:(S.obstacles||[]).filter(o=>o!==obstacle)};
    if(itemFitInStorage(item,candidate,settings)){
      remedies.push({kind:"constraint",constraintType:"blocked zone",label:obstacle.name||"Blocked zone"});
      singleConstraintFix=true;
    }
  }
  for(const divider of S.dividers||[]){
    const candidate={...S,dividers:(S.dividers||[]).filter(d=>d!==divider)};
    if(itemFitInStorage(item,candidate,settings)){
      remedies.push({kind:"constraint",constraintType:"divider",label:divider.name||"Divider"});
      singleConstraintFix=true;
    }
  }
  if(!singleConstraintFix&&((S.obstacles||[]).length||(S.dividers||[]).length)){
    const clearConstraints={...S,obstacles:[],dividers:[]};
    if(itemFitInStorage(item,clearConstraints,settings))remedies.push({kind:"constraints"});
  }
  return remedies;
}
function fitRemedyText(remedy,unit){
  if(remedy.kind==="fitTolerance")return `Fit tolerance is ≤ ${fmt(remedy.value)} ${unit} (currently ${fmt(remedy.current)} ${unit})`;
  if(remedy.kind==="clearance")return `Wall clearance is ≤ ${fmt(remedy.value)} ${unit} (currently ${fmt(remedy.current)} ${unit})`;
  if(remedy.kind==="floorRotation")return "90° floor rotation is allowed for this organizer";
  if(remedy.kind==="tipping")return "this organizer is allowed to tip onto another face";
  if(remedy.kind==="constraint")return `modeled ${remedy.constraintType} “${remedy.label}” is removed or corrected`;
  if(remedy.kind==="constraints")return "the modeled blocked zones/dividers are corrected";
  return "";
}
function projectFitAudit(items,storages,settings={}){
  const storageRows=(storages||[]).map(S=>({id:S.id,name:S.name||"Storage"}));
  const totals={pairs:0,fitPairs:0,nearPairs:0,missPairs:0,items:(items||[]).length,storages:storageRows.length};
  const rows=(items||[]).map(item=>{
    let fitCount=0,nearCount=0,missCount=0;
    const cells=storageRows.map(storageRow=>{
      const S=(storages||[]).find(x=>x.id===storageRow.id);
      const fit=itemFitInStorage(item,S,settings);
      totals.pairs++;
      if(fit){
        fitCount++;totals.fitPairs++;
        return {storageId:storageRow.id,status:"fit",fit};
      }
      const failure=fitFailureInStorage(item,S,settings);
      const remedies=fitRemediesForFailure(item,S,settings);
      if(remedies.length){
        nearCount++;totals.nearPairs++;
        return {storageId:storageRow.id,status:"near",failure,remedies};
      }
      missCount++;totals.missPairs++;
      return {storageId:storageRow.id,status:"miss",failure,remedies:[]};
    });
    return {
      itemId:item.id,itemName:item.name||"Item",
      w:Number(item.w)||0,d:Number(item.d)||0,h:Number(item.h)||0,
      fitCount,nearCount,missCount,cells
    };
  });
  return {storages:storageRows,rows,totals};
}
function projectFitAuditView(audit,options={}){
  const query=String(options.query||"").trim().toLowerCase();
  const focus=["all","no-fit","near","miss"].includes(options.focus)?options.focus:"all";
  const restrictStorages=Array.isArray(options.storageIds);
  const allowed=restrictStorages?new Set(options.storageIds.map(String)):null;
  const storageIndexes=[];
  (audit?.storages||[]).forEach((storage,index)=>{
    if(!restrictStorages||allowed.has(String(storage.id)))storageIndexes.push(index);
  });
  const storages=storageIndexes.map(index=>audit.storages[index]);
  const rows=(audit?.rows||[]).map(row=>{
    const cells=storageIndexes.map(index=>row.cells?.[index]).filter(Boolean);
    const fitCount=cells.filter(cell=>cell.status==="fit").length;
    const nearCount=cells.filter(cell=>cell.status==="near").length;
    const missCount=cells.filter(cell=>cell.status==="miss").length;
    return {...row,cells,fitCount,nearCount,missCount};
  }).filter(row=>{
    if(!row.cells.length)return false;
    if(query&&!String(row.itemName||"").toLowerCase().includes(query))return false;
    if(focus==="no-fit")return row.fitCount===0;
    if(focus==="near")return row.nearCount>0;
    if(focus==="miss")return row.missCount>0;
    return true;
  });
  const totals={pairs:0,fitPairs:0,nearPairs:0,missPairs:0,items:rows.length,storages:storages.length};
  for(const row of rows){
    for(const cell of row.cells){
      totals.pairs++;
      if(cell.status==="fit")totals.fitPairs++;
      else if(cell.status==="near")totals.nearPairs++;
      else if(cell.status==="miss")totals.missPairs++;
    }
  }
  return {storages,rows,totals,focus,query};
}
function projectFitAuditInsights(view){
  const rows=Array.isArray(view?.rows)?view.rows:[];
  const storages=Array.isArray(view?.storages)?view.storages:[];
  const broadest=rows.length?[...rows].sort((a,b)=>
    b.fitCount-a.fitCount ||
    b.nearCount-a.nearCount ||
    a.missCount-b.missCount ||
    String(a.itemName||"").localeCompare(String(b.itemName||""))
  )[0]:null;
  const storageStats=storages.map((storage,index)=>{
    let fitCount=0,nearCount=0,missCount=0;
    for(const row of rows){
      const status=row.cells?.[index]?.status;
      if(status==="fit")fitCount++;
      else if(status==="near")nearCount++;
      else if(status==="miss")missCount++;
    }
    return {...storage,fitCount,nearCount,missCount};
  });
  const fewestFits=storageStats.length?[...storageStats].sort((a,b)=>
    a.fitCount-b.fitCount ||
    a.nearCount-b.nearCount ||
    b.missCount-a.missCount ||
    String(a.name||"").localeCompare(String(b.name||""))
  )[0]:null;
  return {
    broadest,
    fewestFits,
    noFitItems:rows.filter(row=>row.fitCount===0).length,
    nearItems:rows.filter(row=>row.nearCount>0).length,
    hardMissItems:rows.filter(row=>row.missCount>0).length,
    allFitItems:storages.length?rows.filter(row=>row.fitCount===storages.length).length:0,
    storageStats
  };
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
  capacityLayoutContext=null;
  savedPlanSourceContext=null;
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
  $("detailTitle").textContent=capacityLayoutContext?"Capacity packing":`Layout ${selectedLayout+1}`;
  updateModalNav();updateSavePlanButton();
  const stackedCount=layout.filter(p=>(p.z||0)>1e-9).length;
  const capacityNote=capacityLayoutContext
    ? (capacityLayoutContext.packingPurpose==="owned"
      ? `Owned-stock packing: ${capacityLayoutContext.count} of ${capacityLayoutContext.sourceExact?capacityLayoutContext.sourceCapacity+" capacity":"at least "+capacityLayoutContext.sourceCapacity+" found"}. `
      : (capacityLayoutContext.mode==="3d"
      ? (capacityLayoutContext.exact
        ? `Exact 3D maximum: ${capacityLayoutContext.count} (${capacityLayoutContext.floorCount} floor${capacityLayoutContext.stackedCount?` + ${capacityLayoutContext.stackedCount} stacked`:""}). `
        : `Best 3D packing found before search cap: ${capacityLayoutContext.count} (${capacityLayoutContext.floorCount} floor${capacityLayoutContext.stackedCount?` + ${capacityLayoutContext.stackedCount} stacked`:""}). `)
      : (capacityLayoutContext.exact?`Exact floor maximum: ${capacityLayoutContext.count}. `:`Best packing found before search cap: ${capacityLayoutContext.count}. `)))
    : "";
  const capacityStructure=capacityLayoutContext?packingStackSummaryText(capacityLayoutContext.stackSummary):"";
  $("detailSubtitle").textContent=`${capacityNote}${capacityStructure?capacityStructure+" · ":""}${(utilization(layout,W,D,H)*100).toFixed(1)}% ${utilizationNoun(layout)} utilization · ${layout.length} item${layout.length===1?"":"s"}${stackedCount?` · ${stackedCount} stacked`:""}.`;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===detailView));
  $("reset3d").disabled=detailView!=="iso";
  const printableLabels=printablePlacementLabels(layout);
  $("printLabelsBtn").disabled=printableLabels.length===0;
  $("printLabelsBtn").title=printableLabels.length?`Print ${printableLabels.length} organizer label${printableLabels.length===1?"":"s"}`:"Add purpose labels to placements first";
  $("editLayoutBtn").textContent=editMode?"Editing":"Edit layout";
  $("editBar").classList.toggle("active",editMode);
  const labelInput=$("placementLabel"),selectedPlacement=selectedEditItem>=0?layout[selectedEditItem]:null;
  labelInput.disabled=!editMode||!selectedPlacement;
  labelInput.value=selectedPlacement?placementLabel(selectedPlacement):"";
  labelInput.placeholder=selectedPlacement?"e.g. Socks":"Select a box, e.g. Socks";
  const coordStep=String(round6(normalizeSnapStep(state.editSnapStep))),coords=[
    ["placementX","x",W-selectedPlacement?.w],
    ["placementY","y",D-selectedPlacement?.d],
    ["placementZ","z",H-selectedPlacement?.h]
  ];
  for(const [id,key,max] of coords){
    const input=$(id);input.disabled=!editMode||!selectedPlacement;
    input.step=coordStep;input.min="0";
    input.max=selectedPlacement?String(round6(Math.max(0,max))):"";
    input.value=selectedPlacement?String(round6(Number(selectedPlacement[key])||0)):"";
  }
  $("placementCoordUnit").textContent=state.unit;
  const alignSelect=$("alignPlacementSelect"),alignButton=$("alignPlacementBtn");
  alignSelect.disabled=!editMode||!selectedPlacement;
  if(!selectedPlacement)alignSelect.value="";
  alignButton.disabled=!editMode||!selectedPlacement||!alignSelect.value;
  $("editSnapStep").value=String(round6(normalizeSnapStep(state.editSnapStep)));
  $("editSnapUnit").textContent=state.unit;
  $("editShowGrid").checked=state.editShowGrid!==false;
  updateEditHistoryControls();
  updateReplacementControl(selectedPlacement);
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
    const wasEditing=editMode;
    selectedEditItem=idx;editMode=true;editOriginalLayout=editOriginalLayout||layout.slice(0,-1).map(q=>({...q}));
    if(!wasEditing||editHistory.index<0)resetEditHistory(editOriginalLayout);
    recordEditHistory("Add item");
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
function replacementOrientationCandidates(source,target,forceUpright=state.uprightOnly){
  if(!source||!target)return [];
  return orientations(target,forceUpright).map(o=>({
    w:o[0],d:o[1],h:o[2],
    score:Math.abs(o[0]-source.w)+Math.abs(o[1]-source.d)+Math.abs(o[2]-source.h)
  })).sort((a,b)=>a.score-b.score||a.w*b.d-b.w*a.d);
}
function replacementPlacementCandidates(layout,index,target,W,D,H){
  if(!Array.isArray(layout)||index<0||index>=layout.length||!target)return [];
  const source=layout[index],others=layout.filter((_,i)=>i!==index),gap=Math.max(0,state.fitTolerance||0),obstacles=usableObstacles();
  const candidates=[],seen=new Set();
  const add=q=>{
    const candidate={...q,typeId:target.id,name:target.name,label:placementLabel(source)};
    const key=[round6(candidate.x),round6(candidate.y),round6(candidate.z||0),round6(candidate.w),round6(candidate.d),round6(candidate.h)].join("|");
    if(seen.has(key))return;
    const trial=cloneLayoutSnapshot(layout);trial[index]=candidate;
    if(!editItemValid(trial,index,W,D))return;
    seen.add(key);candidates.push(candidate);
  };
  const oris=replacementOrientationCandidates(source,target);
  for(const o of oris)add({x:source.x,y:source.y,z:Number(source.z)||0,w:o.w,d:o.d,h:o.h});
  for(const o of oris){
    for(const q of candidatePlacementsFor(others,target,[o.w,o.d,o.h],W,D,H,obstacles,gap))add(q);
  }
  return candidates.sort((a,b)=>{
    const asame=Math.abs(a.x-source.x)<1e-9&&Math.abs(a.y-source.y)<1e-9&&Math.abs((a.z||0)-(source.z||0))<1e-9?0:1;
    const bsame=Math.abs(b.x-source.x)<1e-9&&Math.abs(b.y-source.y)<1e-9&&Math.abs((b.z||0)-(source.z||0))<1e-9?0:1;
    if(asame!==bsame)return asame-bsame;
    const ad=Math.abs(a.x-source.x)+Math.abs(a.y-source.y)+2*Math.abs((a.z||0)-(source.z||0));
    const bd=Math.abs(b.x-source.x)+Math.abs(b.y-source.y)+2*Math.abs((b.z||0)-(source.z||0));
    if(ad!==bd)return ad-bd;
    return Math.abs(a.w-source.w)+Math.abs(a.d-source.d)+Math.abs(a.h-source.h)
      -Math.abs(b.w-source.w)-Math.abs(b.d-source.d)-Math.abs(b.h-source.h);
  });
}
function updateReplacementControl(selectedPlacement){
  const select=$("replaceItemSelect"),button=$("replaceItemBtn");if(!select||!button)return;
  const old=select.value;
  if(!editMode||!selectedPlacement){
    select.innerHTML='<option value="">Select a box first</option>';select.disabled=true;button.disabled=true;return;
  }
  const layout=selectedManualLayout();
  const options=state.boxes.filter(b=>b.id!==selectedPlacement.typeId).map(b=>{
    const max=allowedMaxFor(b.id),reached=max!==null&&countType(layout,b.id)>=max;
    return `<option value="${esc(b.id)}" ${reached?"disabled":""}>${esc(b.name)} · ${fmt(b.w)} × ${fmt(b.d)} × ${fmt(b.h)} ${esc(state.unit)}${reached?" · max reached":""}</option>`;
  }).join("");
  select.innerHTML='<option value="">Choose replacement…</option>'+options;
  select.disabled=!options;
  if(old&&[...select.options].some(o=>o.value===old&&!o.disabled))select.value=old;
  button.disabled=!select.value;
}
function replaceSelectedOrganizer(targetId){
  const layout=selectedManualLayout(),sz=currentUsableSize(),source=layout?.[selectedEditItem],target=boxById(targetId);
  if(!editMode||!layout||!sz||!source||!target){setEditStatus("Select a box and replacement organizer first.",true);return false}
  if(source.typeId===target.id)return false;
  const max=allowedMaxFor(target.id);
  if(max!==null&&countType(layout,target.id)>=max){setEditStatus(`Maximum quantity (${max}) reached for ${target.name}.`,true);return false}
  const candidates=replacementPlacementCandidates(layout,selectedEditItem,target,sz.W,sz.D,sz.H);
  if(!candidates.length){setEditStatus(`${target.name} cannot replace this placement without breaking fit or support rules.`,true);return false}
  const old={...source},next=candidates[0],moved=Math.abs(next.x-old.x)>1e-9||Math.abs(next.y-old.y)>1e-9||Math.abs((next.z||0)-(old.z||0))>1e-9;
  layout[selectedEditItem]=next;selectedGap=-1;updateSavePlanButton();recordEditHistory("Replace organizer");
  setEditStatus(moved?`Replaced with ${target.name} and moved to the nearest valid position.`:`Replaced with ${target.name} in the same position.`);
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
  selectedGap=-1;updateSavePlanButton();recordEditHistory(axis==="x"?"Mirror left ↔ right":"Mirror front ↔ back");
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
function placementCoordinateCandidate(source,axis,value){
  const n=Number(value);
  if(!source||!["x","y","z"].includes(axis)||!Number.isFinite(n))return null;
  return {...source,[axis]:round6(n)};
}
function alignmentPlacementCandidate(source,alignment,W,D,gap=0){
  if(!source||!["left","center-x","right","front","center-y","back"].includes(alignment))return null;
  const width=Number(W),depth=Number(D),g=Math.max(0,Number(gap)||0);
  if(!Number.isFinite(width)||!Number.isFinite(depth)||width<=0||depth<=0)return null;
  const out={...source};
  if(alignment==="left")out.x=g;
  else if(alignment==="center-x")out.x=(width-(Number(source.w)||0))/2;
  else if(alignment==="right")out.x=width-(Number(source.w)||0)-g;
  else if(alignment==="front")out.y=g;
  else if(alignment==="center-y")out.y=(depth-(Number(source.d)||0))/2;
  else if(alignment==="back")out.y=depth-(Number(source.d)||0)-g;
  out.x=round6(Number(out.x)||0);out.y=round6(Number(out.y)||0);
  return out;
}
function applyPlacementAlignment(alignment){
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz||selectedEditItem<0)return false;
  const gap=Math.max(0,state.fitTolerance||0),candidate=alignmentPlacementCandidate(layout[selectedEditItem],alignment,sz.W,sz.D,gap);
  if(!candidate){setEditStatus("Choose a valid alignment.",true);return false}
  const trial=cloneLayoutSnapshot(layout);trial[selectedEditItem]=candidate;
  if(!editItemValid(trial,selectedEditItem,sz.W,sz.D)){
    setEditStatus("Alignment rejected: collision, bounds, or stack support.",true);refreshCurrentDetail();return false;
  }
  const current=layout[selectedEditItem];
  if(Math.abs(candidate.x-current.x)<=1e-9&&Math.abs(candidate.y-current.y)<=1e-9){setEditStatus("Already aligned.");refreshCurrentDetail();return true}
  layouts[selectedLayout]=trial;selectedGap=-1;updateSavePlanButton();recordEditHistory("Align item");
  const names={"left":"Left","center-x":"Horizontal center","right":"Right","front":"Front","center-y":"Depth center","back":"Back"};
  setEditStatus(`Aligned: ${names[alignment]}.`);refreshCurrentDetail();return true;
}
function applyPlacementCoordinate(axis,value){
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz||selectedEditItem<0)return false;
  const current=layout[selectedEditItem],candidate=placementCoordinateCandidate(current,axis,value);
  if(!candidate){setEditStatus("Enter a valid coordinate.",true);refreshCurrentDetail();return false}
  if(Math.abs((Number(candidate[axis])||0)-(Number(current[axis])||0))<=1e-9){refreshCurrentDetail();return true}
  const trial=cloneLayoutSnapshot(layout);trial[selectedEditItem]=candidate;
  if(!editItemValid(trial,selectedEditItem,sz.W,sz.D)){
    setEditStatus("Coordinate rejected: collision, bounds, or stack support.",true);refreshCurrentDetail();return false;
  }
  layouts[selectedLayout]=trial;selectedGap=-1;updateSavePlanButton();
  recordEditHistory(`Set ${axis.toUpperCase()} coordinate`);
  setEditStatus(`${axis.toUpperCase()} = ${fmt(candidate[axis])} ${state.unit}.`);
  refreshCurrentDetail();return true;
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
      selectedGap=-1;updateSavePlanButton();recordEditHistory(target==="stack"?"Stack item":"Move item to floor");
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
  selectedGap=-1;updateSavePlanButton();recordEditHistory("Nudge item");setEditStatus(`Moved to ${fmt(p.x)}, ${fmt(p.y)} ${state.unit}.`);refreshCurrentDetail();return true;
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
    resetEditHistory(editOriginalLayout);
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
$("placementLabel").addEventListener("change",()=>recordEditHistory("Edit label"));
$("placementLabel").addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();$("placementLabel").blur()}
});
for(const [id,axis] of [["placementX","x"],["placementY","y"],["placementZ","z"]]){
  $(id).addEventListener("change",()=>applyPlacementCoordinate(axis,$(id).value));
  $(id).addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$(id).blur()}});
}
$("alignPlacementSelect").addEventListener("change",()=>{$("alignPlacementBtn").disabled=!editMode||selectedEditItem<0||!$("alignPlacementSelect").value});
$("alignPlacementBtn").addEventListener("click",()=>applyPlacementAlignment($("alignPlacementSelect").value));
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
$("undoEdit").addEventListener("click",()=>moveEditHistory(-1));
$("redoEdit").addEventListener("click",()=>moveEditHistory(1));
$("replaceItemSelect").addEventListener("change",()=>{$("replaceItemBtn").disabled=!$("replaceItemSelect").value});
$("replaceItemBtn").addEventListener("click",()=>replaceSelectedOrganizer($("replaceItemSelect").value));

document.addEventListener("keydown",e=>{
  if(!editMode)return;
  const interactive=e.target?.closest?.("input,textarea,select,button"),key=String(e.key||"").toLowerCase(),mod=e.metaKey||e.ctrlKey;
  if(!interactive&&mod&&key==="z"){
    e.preventDefault();moveEditHistory(e.shiftKey?1:-1);return;
  }
  if(!interactive&&mod&&key==="y"){
    e.preventDefault();moveEditHistory(1);return;
  }
  if(interactive||detailView!=="top"||selectedEditItem<0)return;
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
  editMode=false;selectedEditItem=-1;editOriginalLayout=null;editHistory={entries:[],index:-1};updateEditHistoryControls();
  setEditStatus("Layout saved locally in this proposal.");
  refreshCurrentDetail();
});

$("resetEdit").addEventListener("click",()=>{
  if(!editMode||!editOriginalLayout)return;
  layouts[selectedLayout]=editOriginalLayout.map(p=>({...p}));
  selectedEditItem=-1;selectedGap=-1;recordEditHistory("Reset proposal");setEditStatus("Proposal restored.");refreshCurrentDetail();
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
  }else {selectedGap=-1;recordEditHistory("Rotate item");setEditStatus("Rotated.");}
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
  selectedEditItem=-1;selectedGap=-1;recordEditHistory("Remove item");setEditStatus("Item removed.");refreshCurrentDetail();
});

$("duplicateItem").addEventListener("click",()=>{
  const layout=selectedManualLayout(),sz=currentUsableSize();
  if(!editMode||!layout||!sz||selectedEditItem<0){setEditStatus("Select a box first.",true);return}
  const src=layout[selectedEditItem],max=allowedMaxFor(src.typeId);
  if(max!==null&&countType(layout,src.typeId)>=max){setEditStatus(`Maximum quantity (${max}) reached for this item.`,true);return}
  const type=boxById(src.typeId),gap=Math.max(0,state.fitTolerance||0);
  for(const p of candidatePlacementsFor(layout,type,[src.w,src.d,src.h],sz.W,sz.D,sz.H,usableObstacles(),gap)){
    p.label="";
    layout.push(p);selectedEditItem=layout.length-1;selectedGap=-1;recordEditHistory("Duplicate item");setEditStatus((p.z||0)>0?"Duplicate stacked.":"Duplicate added.");refreshCurrentDetail();return;
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
  }else {selectedGap=-1;recordEditHistory("Move item");setEditStatus("Position updated.");}
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


$("printMeasurementWorksheetBtn").addEventListener("click",()=>{
  if(!buildMeasurementWorksheetPrintSheet()){alert("Add at least one storage space before printing a measurement worksheet.");return}
  window.print();
});
$("printProjectChecklistBtn").addEventListener("click",()=>{
  if(!buildProjectChecklistPrintSheet()){alert("Add at least one storage space before printing a project checklist.");return}
  window.print();
});
$("printPlanBtn").addEventListener("click",()=>{
  if(!buildPrintSheet())return;
  window.print();
});
$("printLabelsBtn").addEventListener("click",()=>{
  if(!buildLabelPrintSheet()){alert("Add a purpose label to at least one placement first.");return}
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
    if(savedPlanSourceContext?.planId===existing.id)savedPlanSourceContext=null;
  }else{
    const source=savedPlanSourceContext?.storageId===s.id?savedPlanSourceContext:null;
    const created=createSavedPlanForStorage(s,layout,{derivedFrom:source});
    savedPlanSourceContext=savedPlanSourceSnapshot(created);
  }
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
$("findItemFits").addEventListener("click",openItemFitModal);
$("fitAuditBtn").addEventListener("click",openFitAuditModal);
$("findItemPlanRoom").addEventListener("click",openItemPlanRoomModal);
$("showItemUsage").addEventListener("click",openItemUsageModal);
$("closeItemFitModal").addEventListener("click",closeItemFitModal);
$("itemFitBackdrop").addEventListener("click",closeItemFitModal);
$("closeFitAuditModal").addEventListener("click",closeFitAuditModal);
$("fitAuditBackdrop").addEventListener("click",closeFitAuditModal);
$("comparePlansBtn").addEventListener("click",openCompareModal);
$("closePlanFamilyModal").addEventListener("click",closePlanFamilyModal);
$("planFamilyBackdrop").addEventListener("click",closePlanFamilyModal);
$("closeCompareModal").addEventListener("click",closeCompareModal);
$("compareBackdrop").addEventListener("click",closeCompareModal);
$("closeDetailModal").addEventListener("click",closeDetailModal);
$("detailBackdrop").addEventListener("click",closeDetailModal);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && fitAuditModalOpen){ closeFitAuditModal(); return; }
  if(e.key==="Escape" && itemFitModalOpen){ closeItemFitModal(); return; }
  if(e.key==="Escape" && planFamilyModalOpen){ closePlanFamilyModal(); return; }
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

function pasteDimensionsIntoFields(fieldIds,subject){
  const unit=state.unit||"cm";
  const raw=prompt(`Paste ${subject} dimensions.\n\nExamples:\n81 × 40 × 47 cm\nDimensions (L × W × H): 76 × 38 × 30 cm\nWidth 38 cm · Depth 76 cm · Height 30 cm\n\nIf no unit is included, ${unit} is assumed.`);
  if(raw===null)return false;
  const dims=parseQuickDimensions(raw,unit);
  if(!dims){alert("Could not find three usable dimensions. Include three positive measurements, optionally with units or an explicit axis order.");return false}
  fieldIds.forEach((id,index)=>{
    const el=$(id);if(!el)return;
    el.value=String(round6(dims[index]));
    el.classList.add("autofill");setTimeout(()=>el.classList.remove("autofill"),750);
  });
  return true;
}
$("pasteStorageDimensions").addEventListener("click",()=>{
  const ok=pasteDimensionsIntoFields(["sw","sd","sh"],"storage");if(!ok)return;
  const btn=$("pasteStorageDimensions"),old=btn.textContent;btn.textContent="Filled ✓";setTimeout(()=>{btn.textContent=old},1200);
});
$("toggleStorageMeasured").addEventListener("click",()=>{
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  const status=storageMeasurementStatus(s);
  if(status.status==="current"){
    clearStorageMeasured(s);save();renderStorageMeasurementStatus();renderStorageList();return;
  }
  const visible=[Number($("sw").value)||0,Number($("sd").value)||0,Number($("sh").value)||0];
  const saved=[Number(s.w)||0,Number(s.d)||0,Number(s.h)||0];
  if(visible.some((value,index)=>Math.abs(value-saved[index])>1e-9)){
    alert("Save the visible Width, Depth and Height first, then mark the saved storage as measured.");
    return;
  }
  markStorageMeasured(s);save();renderStorageMeasurementStatus();renderStorageList();
});
$("pasteBoxDimensions").addEventListener("click",()=>{
  const ok=pasteDimensionsIntoFields(["bw","bd","bh"],"organizer");if(!ok)return;
  const btn=$("pasteBoxDimensions"),old=btn.textContent;btn.textContent="Filled ✓";setTimeout(()=>{btn.textContent=old},1200);
});

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
$("copyStorageStructure").addEventListener("click",()=>{
  const source=state.storages.find(s=>s.id===editingStorage);if(!source)return;
  const visibleDimensions=[
    Number($("sw").value)||0,
    Number($("sd").value)||0,
    Number($("sh").value)||0
  ];
  const savedDimensions=[Number(source.w)||0,Number(source.d)||0,Number(source.h)||0];
  if(visibleDimensions.some((value,index)=>Math.abs(value-savedDimensions[index])>1e-9)){
    alert("Save this storage first so the copied dimensions match what you see.");
    return;
  }
  const targets=storageStructureCopyTargets(source);
  if(!targets.eligible.length){updateStorageStructureCopyButton();return}
  const targetNames=targets.eligible.map(target=>`• ${storageBreadcrumb(target)}`).join("\n");
  const protectedNote=targets.protected.length
    ? `\n\n${targets.protected.length} sibling${targets.protected.length===1?" is":"s are"} protected because saved/chosen/installed work exists and will not be changed.`
    :"";
  const matchingNote=targets.matchingFresh.length
    ? `\n\n${targets.matchingFresh.length} fresh sibling${targets.matchingFresh.length===1?" already matches":"s already match"} and will be left alone.`
    :"";
  const ok=confirm(
    `Copy the saved structure from “${source.name}” to ${targets.eligible.length} fresh sibling${targets.eligible.length===1?"":"s"}?\n\n`+
    `This replaces their width, depth, height, blocked zones and dividers. Names and locations stay unchanged.\n\n${targetNames}${matchingNote}${protectedNote}`
  );
  if(!ok)return;
  createRecoveryCheckpoint(`Before copying storage structure from “${source.name}”`);
  const byId=new Map(targets.eligible.map(target=>[target.id,copyStorageStructureData(source,target)]));
  state.storages=state.storages.map(target=>byId.get(target.id)||target);
  save();renderAll();
  const btn=$("copyStorageStructure"),count=targets.eligible.length;
  btn.textContent=`Copied to ${count} ✓`;
  setTimeout(updateStorageStructureCopyButton,1200);
});
$("addObstacle").addEventListener("click",()=>{
  const s=state.storages.find(x=>x.id===editingStorage);if(!s)return;
  s.obstacles=s.obstacles||[];
  const n=s.obstacles.length+1;
  s.obstacles.push({id:uid("o"),name:`Blocked zone ${n}`,x:0,y:0,w:5,d:5,h:Math.min(s.h||5,5)});
  save();renderObstacleEditor();renderStorageList();renderSavedPlans();resetResults();
});
$("applyConstraintTemplate").addEventListener("click",()=>applyConstraintTemplate($("constraintTemplate").value));
$("mirrorStorageConstraintsX").addEventListener("click",()=>applyStorageConstraintMirror("x"));
$("mirrorStorageConstraintsY").addEventListener("click",()=>applyStorageConstraintMirror("y"));
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
  if(usedBySaved){alert("This item is used by a saved plan. Use “Used in plans” to open the affected plans, then remove or replace it before deleting.");return}
  const deletingItem=state.boxes.find(b=>b.id===editingBox);
  createRecoveryCheckpoint(`Before deleting item “${deletingItem?.name||"Item"}”`);
  state.boxes=state.boxes.filter(x=>x.id!==editingBox);delete state.selectedTypes[editingBox];delete state.itemLimits[editingBox];delete state.shoppingBought[editingBox];delete state.ownedDistributionSessions?.[editingBox];
  editingBox=state.boxes[0]?.id||"";save();renderAll()
});

if(new URLSearchParams(location.search).has("smoke-test")){
  window.StorageFitTest={
    parseDimensionString,
    parseQuickDimensions,
    dimensionOrderFromText,
    reorderProductDimensions,
    parseLabeledDimensions,
    parseReaderDimensions,
    schemaDimensionValue,
    schemaDimensionAxis,
    schemaCompositeDimensionLabel,
    schemaCompositeDimensions,
    schemaProductDimensions,
    parseLocalizedPrice,
    normalizedCurrency,
    schemaOfferPrice,
    parseReaderPrice,
    parseHtmlProduct,
    canonicalProductUrl,
    normalizedSku,
    retailerName,
    ikeaUrlInfo,
    normalizeProductDimensions,
    productNeedsDimensionEnrichment,
    shouldUseProductReader,
    parseReaderProduct,
    mergeProductInfo,
    safeUrl,
    validateBackupState,
    normalizeChosenPlanSelections,
    normalizeShoppingBought,
    normalizeInstallState,
    normalizeOwnedDistributionSessions,
    projectStorageContext,
    prioritizedInstallOrderForRoom,
    installOrderImpact,
    installOrderMoveImpact,
    suggestInstallOrder,
    installAllocationSnapshot,
    stockUnlockAnalysis,
    purchasedArrivalAnalysis,
    roomInstallPriorityImpact,
    projectRoomProgress,
    measurementWorksheetData,
    projectChecklistData,
    projectNextActions,
    computeInstallAllocation,
    repeatStorageNames,
    canonicalPlanLayout,
    labeledPlacements,
    printablePlacementLabels,
    itemPlanningSnapshot,
    itemPlanningSignature,
    validatePlanLayoutAgainst,
    planHealthFromData,
    normalizeRecoveryJournal,
    recoveryEntryMeta,
    defaultConstraintMeasure,
    mirrorStorageConstraintsData,
    fitDimensionMargins,
    fitDimensionDeficits,
    itemFitInStorage,
    fitFailureInStorage,
    fitFailuresForItem,
    fitRemediesForFailure,
    projectFitAudit,
    projectFitAuditView,
    projectFitAuditInsights,
    maxFloorCopiesInStorage,
    maxCopiesInStorage,
    openCapacityPacking,
    compatibleStoragesForItem,
    stackedExtraItemPlacementInPlan,
    extraItemPlacementInPlan,
    extraItemAddition,
    maxAdditionalFloorCopiesInPlan,
    maxAdditionalCopiesInPlan,
    packingStackSummary,
    packingStackSummaryText,
    ownedPackingFromCapacity,
    ownedCapacityResult,
    ownedDistributionCandidate,
    ownedDistributionPlan,
    ownedDistributionSummaryText,
    ownedDistributionFingerprint,
    createOwnedDistributionSession,
    ownedDistributionAllocationSignature,
    rebaseOwnedDistributionSession,
    calculateOwnedDistributionSession,
    ownedDistributionAppliedPlanSpec,
    ownedDistributionBatchApplySpecs,
    ownedDistributionSessionPlan,
    ownedDistributionSessionProgress,
    setOwnedDistributionAllocationStatus,
    ownedDistributionSessionIsStale,
    ownedDistributionSessionSummaryText,
    ownedDistributionWorkRows,
    ownedDistributionWorkSummary,
    resumeOwnedDistributionWork,
    ownedDistributionAllocationView,
    persistOwnedDistributionSession,
    toggleOwnedDistributionAllocationDone,
    applyOwnedDistributionAllocation,
    applyAllOwnedDistributionAllocations,
    openOwnedDistributionAllocation,
    setItemFitDistributionVisible,
    itemPlanRoomRows,
    openSavedPlanWithExtraItems,
    openSavedPlanWithExtraItem,
    itemPlanUsageRows,
    usageEditTarget,
    openSavedPlanForItem,
    constraintTemplateZones,
    dividerRectsForStorage,
    physicalObstaclesForStorage,
    storageStructureSignature,
    storageMeasurementSignature,
    storageMeasurementStatus,
    markStorageMeasured,
    clearStorageMeasured,
    matchingSiblingStorages,
    storageStructureCopyTargets,
    copyStorageStructureData,
    cloneStorageDefinition,
    cloneFurnitureDefinition,
    nextCopyName,
    ensureHomeHierarchy,
    purchaseBreakdown,
    clampPurchaseReceiptQuantity,
    clampDeliveryReceiptQuantity,
    normalizeDeliveryReceiptSelection,
    purchaseReceiptResult,
    purchasedReceiptImpact,
    purchasedDeliveryImpact,
    savedPlanSourceSnapshot,
    planLineageMetadata,
    planLineageInfo,
    planFamilyInfo,
    placementDeltaDetails,
    placementDeltaSummary,
    planPreviewSnapshot,
    savedPlanTopPreview,
    revisionDeltaInfo,
    revisionDeltaText,
    physicalPlanEquivalent,
    carryInstalledPlanForward,
    planChoiceImpact,
    choosePlan,
    itemStockStatus,
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
    placementCoordinateCandidate,
    alignmentPlacementCandidate,
    makeEditHistory,
    appendEditHistoryState,
    stepEditHistoryState,
    replacementOrientationCandidates,
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
