(() => {
const $=id=>document.getElementById(id);
const COLORS=["#8fb6d8","#d5a76f","#86b58b","#c597c8","#d98a8a","#9ea4ce"];
let payload=null,view="front",camera=StorageFit3D.defaultCamera(),drag=null;

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmt(n){return String(Math.round(Number(n)*100)/100)}
function decodeUtf8(value){
  const raw=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
  const padded=raw+"=".repeat((4-raw.length%4)%4),binary=atob(padded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function validate(p){
  if(!p||typeof p!=="object"||p.v!==1)return "Unsupported shared-plan format.";
  if(typeof p.n!=="string"||!p.n.trim()||p.n.length>160)return "The plan name is invalid.";
  if(!["cm","mm","in"].includes(p.u))return "The plan unit is invalid.";
  if(!Array.isArray(p.d)||p.d.length!==3||p.d.some(v=>!Number.isFinite(Number(v))||Number(v)<=0))return "The storage dimensions are invalid.";
  if(!Array.isArray(p.z)||p.z.length!==3||p.z.some(v=>!Number.isFinite(Number(v))||Number(v)<=0))return "The usable dimensions are invalid.";
  if(!Array.isArray(p.i)||p.i.length>100)return "The organizer list is invalid.";
  for(const row of p.i)if(!Array.isArray(row)||row.length<2||typeof row[0]!=="string"||typeof row[1]!=="string")return "An organizer definition is malformed.";
  const ids=new Set(p.i.map(x=>x[0]));
  if(!Array.isArray(p.o)||p.o.length>100)return "The physical constraints are invalid.";
  for(const row of p.o)if(!Array.isArray(row)||row.length!==6||![0,1].includes(row[0])||row.slice(1).some(v=>!Number.isFinite(Number(v))||Number(v)<0))return "A physical constraint is malformed.";
  if(!Array.isArray(p.p)||!p.p.length||p.p.length>500)return "The placement list is invalid.";
  for(const row of p.p)if(!Array.isArray(row)||row.length!==8||!ids.has(row[0])||row.slice(1,7).some(v=>!Number.isFinite(Number(v))||Number(v)<0)||typeof row[7]!=="string"||row[7].length>60)return "A placement is malformed.";
  return "";
}
// "#z=" links hold deflate-compressed JSON; older "#p=" links hold it uncompressed.
async function parse(){
  const hash=location.hash,form=hash.slice(0,3);
  if((form!=="#p="&&form!=="#z=")||hash.length<=3)return {error:"This link does not contain a shared Storage Fit plan."};
  if(form==="#z="&&typeof DecompressionStream!=="function")return {error:"This browser is too old to open compressed plan links. Update it and open the link again."};
  try{
    let json;
    if(form==="#p=")json=decodeUtf8(hash.slice(3));
    else{
      const raw=hash.slice(3).replace(/-/g,"+").replace(/_/g,"/"),binary=atob(raw+"=".repeat((4-raw.length%4)%4));
      const stream=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      json=await new Response(stream).text();
    }
    const parsed=JSON.parse(json),error=validate(parsed);
    return error?{error}:{payload:parsed};
  }catch(e){return {error:"This shared-plan link is damaged or incomplete."}}
}
function itemMap(){return new Map(payload.i.map((row,i)=>[row[0],{name:row[1],color:COLORS[i%COLORS.length]}]))}
function placements(){return payload.p.map(r=>({id:r[0],x:+r[1],y:+r[2],z:+r[3],w:+r[4],d:+r[5],h:+r[6],label:r[7]}))}
function obstacles(){return payload.o.map(r=>({kind:r[0]?"divider":"blocked",x:+r[1],y:+r[2],w:+r[3],d:+r[4],h:+r[5]}))}
function geom(W,D,width=760,height=430){const pad=24,scale=Math.min((width-2*pad)/W,(height-2*pad)/D);return {scale,ox:(width-W*scale)/2,oy:(height-D*scale)/2}}
function svgTop(){
  const [W,D]=payload.z,g=geom(W,D),map=itemMap(),obs=obstacles();
  const physical=obs.map((o,i)=>{
    const c=o.kind==="divider"?"#416b8e":"#b23c3c",opacity=o.kind==="divider"?".28":".12";
    return `<rect x="${g.ox+o.x*g.scale}" y="${g.oy+o.y*g.scale}" width="${o.w*g.scale}" height="${o.d*g.scale}" fill="${c}" fill-opacity="${opacity}" stroke="${c}" stroke-width="1.6" ${o.kind==="blocked"?'stroke-dasharray="5 4"':""}/>`;
  }).join("");
  const boxes=placements().sort((a,b)=>a.z-b.z).map(p=>{
    const item=map.get(p.id),name=p.label||item.name,stack=p.z>1e-9?` ↑${fmt(p.z)}${payload.u}`:"";
    return `<g><rect x="${g.ox+p.x*g.scale}" y="${g.oy+p.y*g.scale}" width="${p.w*g.scale}" height="${p.d*g.scale}" rx="3" fill="${item.color}" fill-opacity=".42" stroke="${item.color}" stroke-width="1.8"/><text x="${g.ox+(p.x+p.w/2)*g.scale}" y="${g.oy+(p.y+p.d/2)*g.scale}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#222">${esc(String(name).slice(0,18))}${esc(stack)}</text></g>`;
  }).join("");
  return `<svg class="preview" viewBox="0 0 760 430" role="img" aria-label="Top view"><rect x="${g.ox}" y="${g.oy}" width="${W*g.scale}" height="${D*g.scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${physical}${boxes}</svg>`;
}
function svgFront(){
  const [W,,H]=payload.z,width=760,height=430,pad=24,scale=Math.min((width-2*pad)/W,(height-2*pad)/H),ox=(width-W*scale)/2,oy=(height-H*scale)/2,map=itemMap();
  const obs=obstacles().map(o=>`<rect x="${ox+o.x*scale}" y="${oy+(H-o.h)*scale}" width="${o.w*scale}" height="${o.h*scale}" fill="${o.kind==="divider"?"#416b8e":"#b23c3c"}" fill-opacity=".16" stroke="${o.kind==="divider"?"#416b8e":"#b23c3c"}" ${o.kind==="blocked"?'stroke-dasharray="5 4"':""}/>`).join("");
  const boxes=placements().sort((a,b)=>a.z-b.z).map(p=>{const item=map.get(p.id);return `<g><rect x="${ox+p.x*scale}" y="${oy+(H-p.z-p.h)*scale}" width="${p.w*scale}" height="${p.h*scale}" rx="3" fill="${item.color}" fill-opacity=".42" stroke="${item.color}" stroke-width="1.8"/><text x="${ox+(p.x+p.w/2)*scale}" y="${oy+(H-p.z-p.h/2)*scale}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#222">${esc(String(p.label||item.name).slice(0,18))}</text></g>`}).join("");
  return `<svg class="preview" viewBox="0 0 ${width} ${height}" role="img" aria-label="Front view"><rect x="${ox}" y="${oy}" width="${W*scale}" height="${H*scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${obs}${boxes}</svg>`;
}
function svgSide(){
  const [,D,H]=payload.z,width=760,height=430,pad=24,scale=Math.min((width-2*pad)/D,(height-2*pad)/H),ox=(width-D*scale)/2,oy=(height-H*scale)/2,map=itemMap();
  const obs=obstacles().map(o=>`<rect x="${ox+o.y*scale}" y="${oy+(H-o.h)*scale}" width="${o.d*scale}" height="${o.h*scale}" fill="${o.kind==="divider"?"#416b8e":"#b23c3c"}" fill-opacity=".16" stroke="${o.kind==="divider"?"#416b8e":"#b23c3c"}" ${o.kind==="blocked"?'stroke-dasharray="5 4"':""}/>`).join("");
  const boxes=placements().sort((a,b)=>a.z-b.z).map(p=>{const item=map.get(p.id);return `<g><rect x="${ox+p.y*scale}" y="${oy+(H-p.z-p.h)*scale}" width="${p.d*scale}" height="${p.h*scale}" rx="3" fill="${item.color}" fill-opacity=".42" stroke="${item.color}" stroke-width="1.8"/><text x="${ox+(p.y+p.d/2)*scale}" y="${oy+(H-p.z-p.h/2)*scale}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#222">${esc(String(p.label||item.name).slice(0,18))}</text></g>`}).join("");
  return `<svg class="preview" viewBox="0 0 ${width} ${height}" role="img" aria-label="Side view"><rect x="${ox}" y="${oy}" width="${D*scale}" height="${H*scale}" fill="#fff" stroke="#222" stroke-width="2.5"/>${obs}${boxes}</svg>`;
}
function svgIso(){
  const [W,D,H]=payload.z,map=itemMap();
  return StorageFit3D.render({
    W,D,H,unit:payload.u,
    boxes:placements().map(p=>({x:p.x,y:p.y,z:p.z,w:p.w,d:p.d,h:p.h,color:map.get(p.id).color,label:p.label||map.get(p.id).name})),
    obstacles:obstacles()
  },camera,StorageFit3D.viewSize($("shareViz").clientWidth&&$("shareViz").clientWidth-16));
}
function renderViz(){
  document.querySelectorAll("[data-share-view]").forEach(b=>b.classList.toggle("active",b.dataset.shareView===view));
  $("shareViz").classList.toggle("is-3d",view==="iso");
  $("shareReset3d").disabled=view!=="iso";
  $("shareViz").innerHTML=view==="top"?svgTop():view==="side"?svgSide():view==="iso"?svgIso():svgFront();
}
function render(){
  $("shareTitle").textContent=payload.n;
  $("shareMeta").textContent=`${fmt(payload.d[0])} × ${fmt(payload.d[1])} × ${fmt(payload.d[2])} ${payload.u} · ${payload.g||"Shared layout"}`;
  const itemCount=payload.p.length,stacked=payload.p.filter(p=>Number(p[3])>1e-9).length;
  $("shareStats").innerHTML=[
    ["Storage",`${fmt(payload.d[0])} × ${fmt(payload.d[1])} × ${fmt(payload.d[2])} ${payload.u}`],
    ["Usable",`${fmt(payload.z[0])} × ${fmt(payload.z[1])} × ${fmt(payload.z[2])} ${payload.u}`],
    ["Utilization",`${Number(payload.r||0).toFixed(1)}% ${payload.q||""}`],
    ["Organizers",`${itemCount}${stacked?` · ${stacked} stacked`:""}`]
  ].map(x=>`<div class="card sharestat"><div class="small">${esc(x[0])}</div><strong>${esc(x[1])}</strong></div>`).join("");
  const map=itemMap(),counts={};
  for(const p of placements())counts[p.id]=(counts[p.id]||0)+1;
  $("shareItems").innerHTML=Object.entries(counts).map(([id,n])=>`<div class="shareitem"><i style="background:${map.get(id).color}"></i><span><strong>${esc(map.get(id).name)}</strong><small>×${n}</small></span></div>`).join("");
  const labeled=placements().map((p,index)=>({p,index})).filter(x=>x.p.label);
  $("shareContents").innerHTML=labeled.length?labeled.map(x=>`<div class="placementlabelrow"><span class="n">${x.index+1}</span><div><strong>${esc(x.p.label)}</strong><span>${esc(map.get(x.p.id).name)}</span></div></div>`).join(""):'<div class="empty">No purpose labels were added to this plan.</div>';
  renderViz();
}
async function copyCurrent(){
  const btn=$("copySharedLink"),old=btn.textContent;
  try{await navigator.clipboard.writeText(location.href);btn.textContent="Copied ✓"}catch(e){prompt("Copy this share link:",location.href)}
  setTimeout(()=>btn.textContent=old,1200);
}

parse().then(result=>{
if(result.error){
  $("shareError").hidden=false;$("shareErrorText").textContent=result.error;
}else{
  payload=result.payload;$("shareViewer").hidden=false;render();
  document.querySelectorAll("[data-share-view]").forEach(btn=>btn.addEventListener("click",()=>{view=btn.dataset.shareView;renderViz()}));
  $("copySharedLink").addEventListener("click",copyCurrent);
  // Same drag-to-turn behaviour as the planner's 3D view.
  const viz=$("shareViz");
  viz.addEventListener("pointerdown",e=>{
    if(view!=="iso")return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,azimuth:camera.azimuth,elevation:camera.elevation};
    try{viz.setPointerCapture(e.pointerId)}catch(err){}
    viz.classList.add("dragging");e.preventDefault();
  });
  viz.addEventListener("pointermove",e=>{
    if(!drag||e.pointerId!==drag.id||view!=="iso")return;
    camera=StorageFit3D.clampCamera({azimuth:drag.azimuth-(e.clientX-drag.x)*0.012,elevation:drag.elevation+(e.clientY-drag.y)*0.009});
    renderViz();e.preventDefault();
  });
  const stopDrag=e=>{
    if(!drag||(e&&e.pointerId!==drag.id))return;
    drag=null;viz.classList.remove("dragging");
  };
  viz.addEventListener("pointerup",stopDrag);
  viz.addEventListener("pointercancel",stopDrag);
  viz.addEventListener("lostpointercapture",stopDrag);
  $("shareReset3d").addEventListener("click",()=>{camera=StorageFit3D.defaultCamera();renderViz()});
  window.addEventListener("resize",()=>{if(view==="iso"&&!drag)renderViz()});
}
});
if("serviceWorker" in navigator&&window.top===window&&location.protocol!=="file:"){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
})();
