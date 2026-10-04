// Dependency-free 3D view shared by the planner and the read-only share viewer.
// Pure functions: a scene and a camera go in, SVG markup comes out.
//
// World axes match the planner: x runs left to right, y runs from the inside
// front edge to the back, z points up. The camera is orthographic. Azimuth 0
// looks at the storage from the front; a positive azimuth moves the viewer
// round to its right-hand side. Elevation is the height of the viewer above
// the horizon. The projection is not mirrored, so left stays on the left.
(root => {
const DEFAULT_CAMERA={azimuth:0.6,elevation:0.55};
const MIN_ELEVATION=10*Math.PI/180,MAX_ELEVATION=80*Math.PI/180;
const EPS=1e-6;

function defaultCamera(){return {...DEFAULT_CAMERA}}
function clampCamera(camera){
  const azimuth=Number(camera?.azimuth),elevation=Number(camera?.elevation);
  return {
    azimuth:Number.isFinite(azimuth)?Math.atan2(Math.sin(azimuth),Math.cos(azimuth)):DEFAULT_CAMERA.azimuth,
    elevation:Math.max(MIN_ELEVATION,Math.min(MAX_ELEVATION,Number.isFinite(elevation)?elevation:DEFAULT_CAMERA.elevation))
  };
}
function basis(camera){
  const a=Number(camera?.azimuth)||0,e=Number(camera?.elevation)||0;
  return {sa:Math.sin(a),ca:Math.cos(a),se:Math.sin(e),ce:Math.cos(e)};
}
// Unscaled screen position, centred on the middle of the floor; y grows downwards.
function project(camera,size,x,y,z){
  const b=basis(camera),dx=x-size.W/2,dy=y-size.D/2;
  return [b.ca*dx+b.sa*dy,b.se*(b.sa*dx-b.ca*dy)-b.ce*z];
}
// Distance towards the viewer: larger is nearer.
function depth(camera,size,x,y,z){
  const b=basis(camera),dx=x-size.W/2,dy=y-size.D/2;
  return b.ce*(b.sa*dx-b.ca*dy)+b.se*z;
}
// Which vertical faces point at the viewer: x is 1 for the right-hand faces,
// -1 for the left-hand ones; y is 1 for the back faces, -1 for the front ones.
function visibleSides(camera){
  const b=basis(camera);
  return {x:Math.abs(b.sa)<EPS?0:(b.sa>0?1:-1),y:Math.abs(b.ca)<EPS?0:(b.ca>0?-1:1)};
}
function extent(b){
  const z=Number(b.z)||0;
  return {x0:b.x,x1:b.x+b.w,y0:b.y,y1:b.y+b.d,z0:z,z1:z+b.h};
}
// Back-to-front painting order for axis-aligned boxes. One box must be painted
// before another when it lies wholly on the far side of it along some axis;
// when two boxes are each "behind" the other on different axes, neither can
// hide the other, so that pair imposes no order.
function drawOrder(boxes,camera){
  const sides=visibleSides(camera),n=boxes.length,spans=boxes.map(extent);
  const size={W:0,D:0};
  const centre=spans.map(s=>depth(camera,size,(s.x0+s.x1)/2,(s.y0+s.y1)/2,(s.z0+s.z1)/2));
  const behind=(a,b)=>
    (sides.x>0&&a.x1<=b.x0+EPS)||(sides.x<0&&a.x0>=b.x1-EPS)||
    (sides.y>0&&a.y1<=b.y0+EPS)||(sides.y<0&&a.y0>=b.y1-EPS)||
    a.z1<=b.z0+EPS;
  const after=spans.map(()=>[]),waiting=new Array(n).fill(0);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const ij=behind(spans[i],spans[j]),ji=behind(spans[j],spans[i]);
    if(ij&&!ji){after[i].push(j);waiting[j]++}
    else if(ji&&!ij){after[j].push(i);waiting[i]++}
  }
  const order=[],done=new Array(n).fill(false);
  const farther=(i,pick)=>pick<0||centre[i]<centre[pick]-EPS||(Math.abs(centre[i]-centre[pick])<=EPS&&i<pick);
  while(order.length<n){
    let pick=-1;
    for(let i=0;i<n;i++)if(!done[i]&&waiting[i]===0&&farther(i,pick))pick=i;
    // A cycle cannot be painted correctly; release its farthest box and carry on.
    if(pick<0)for(let i=0;i<n;i++)if(!done[i]&&farther(i,pick))pick=i;
    done[pick]=true;order.push(pick);
    for(const j of after[pick])waiting[j]--;
  }
  return order;
}
// Order in which boxes can physically go in: supports before what they carry,
// and the back of each level before its front.
function assemblyOrder(boxes){
  return boxes.map((b,i)=>i).sort((i,j)=>{
    const a=boxes[i],b=boxes[j];
    return (Number(a.z)||0)-(Number(b.z)||0)||b.y-a.y||a.x-b.x||i-j;
  });
}
function assemblyFrame(count,elapsedMs,stepMs){
  const step=Math.max(1,stepMs),elapsed=Math.max(0,elapsedMs);
  if(elapsed>=count*step)return {shown:count,progress:0,done:true};
  const shown=Math.floor(elapsed/step);
  return {shown,progress:(elapsed-shown*step)/step,done:false};
}

function parseHex(color){
  const m=/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color||"").trim());
  if(!m)return [136,146,154];
  const hex=m[1].length===3?m[1].replace(/./g,c=>c+c):m[1];
  return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
}
// amount > 0 mixes towards white, amount < 0 towards black.
function tint(color,amount){
  const target=amount>=0?255:0,t=Math.min(1,Math.abs(amount));
  return "#"+parseHex(color).map(c=>Math.round(c+(target-c)*t).toString(16).padStart(2,"0")).join("");
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmt(n){return String(Math.round(Number(n)*10)/10)}
function points(pts){return pts.map(p=>`${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ")}
function poly(pts,attrs){return `<polygon points="${points(pts)}" ${attrs}/>`}

// The three faces of a box that face the viewer, sides first and top last.
function facesOf(b,P,sides){
  const s=extent(b),faces=[];
  if(sides.x){const x=sides.x>0?s.x1:s.x0;faces.push({axis:"x",pts:[P(x,s.y0,s.z0),P(x,s.y1,s.z0),P(x,s.y1,s.z1),P(x,s.y0,s.z1)]})}
  if(sides.y){const y=sides.y>0?s.y1:s.y0;faces.push({axis:"y",pts:[P(s.x0,y,s.z0),P(s.x1,y,s.z0),P(s.x1,y,s.z1),P(s.x0,y,s.z1)]})}
  faces.push({axis:"z",pts:[P(s.x0,s.y0,s.z1),P(s.x1,s.y0,s.z1),P(s.x1,s.y1,s.z1),P(s.x0,s.y1,s.z1)]});
  return faces;
}
// Light comes from the viewer's upper left: tops are brightest and a side face
// darkens the more it turns towards the right of the screen.
function faceLightness(axis,sides,b){
  if(axis==="z")return 0.62;
  return 0.4-0.12*(axis==="x"?b.ca*sides.x:b.sa*sides.y);
}
function boxMarkup(entry,faces,sides,b){
  const color=entry.box.color,stroke=tint(color,-0.28);
  const shapes=faces.map(f=>poly(f.pts,`fill="${tint(color,faceLightness(f.axis,sides,b))}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"`)).join("");
  return `<g data-box="${entry.index}"${entry.progress<1?` opacity="${Math.min(1,entry.progress*1.6).toFixed(3)}"`:""}>${shapes}</g>`;
}
// Horizontal extent of a convex polygon at screen height y.
function chordAt(pts,y){
  const xs=[];
  pts.forEach((a,i)=>{
    const c=pts[(i+1)%pts.length];
    if((a[1]-y)*(c[1]-y)<=0&&Math.abs(a[1]-c[1])>EPS)xs.push(a[0]+(y-a[1])/(c[1]-a[1])*(c[0]-a[0]));
  });
  return xs.length>=2?[Math.min(...xs),Math.max(...xs)]:null;
}
function insideConvex(pt,pts){
  let sign=0;
  for(let i=0;i<pts.length;i++){
    const a=pts[i],c=pts[(i+1)%pts.length];
    const cross=(c[0]-a[0])*(pt[1]-a[1])-(c[1]-a[1])*(pt[0]-a[0]);
    if(Math.abs(cross)<EPS)continue;
    if(sign&&(cross>0)!==(sign>0))return false;
    sign=cross>0?1:-1;
  }
  return sign!==0;
}
// A box is named across the middle of its top face, shortened to fit. The name
// is left out when a nearer box hides that spot, rather than drawn half-covered.
const NAME_CHAR_PX=6.6,CAPTION_CHAR_PX=6.9;
function labelPlacement(top,text,nearer){
  const cy=(top[0][1]+top[1][1]+top[2][1]+top[3][1])/4,chord=chordAt(top,cy);
  if(!text||!chord)return null;
  const room=Math.floor((chord[1]-chord[0])/NAME_CHAR_PX);
  if(room<3)return null;
  const shown=text.length>room?text.slice(0,room-1)+"…":text;
  const cx=(chord[0]+chord[1])/2,reach=shown.length*NAME_CHAR_PX/2;
  if([cx-reach,cx,cx+reach].some(x=>nearer.some(face=>insideConvex([x,cy],face))))return null;
  return {x:cx,y:cy,text:shown,left:cx-reach-2,right:cx+reach+2,top:cy-8,bottom:cy+8};
}
function labelMarkup(l){
  return `<text x="${l.x.toFixed(2)}" y="${l.y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#1d1d1b" stroke="#fff" stroke-width="3" stroke-opacity=".7" paint-order="stroke" pointer-events="none">${esc(l.text)}</text>`;
}
const overlaps=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
function obstacleMarkup(entry,faces){
  const divider=entry.box.kind==="divider",color=divider?"#416b8e":"#b23c3c";
  const opacity={x:divider?.3:.16,y:divider?.36:.2,z:divider?.44:.26};
  const shapes=faces.map(f=>poly(f.pts,`fill="${color}" fill-opacity="${opacity[f.axis]}" stroke="${color}" stroke-width="1.1"${divider?"":' stroke-dasharray="5 4"'}`)).join("");
  return `<g data-obstacle="${entry.index}">${shapes}</g>`;
}
// Boxes still to be shown during assembly playback: placed ones as they are,
// the arriving one dropping in from above.
function revealedBoxes(boxes,reveal,H){
  if(!reveal)return boxes.map((box,index)=>({box,index,progress:1}));
  const out=[];
  reveal.order.forEach((index,rank)=>{
    const box=boxes[index];if(!box)return;
    if(rank<reveal.shown)out.push({box,index,progress:1});
    else if(rank===reveal.shown&&reveal.progress>0){
      const t=Math.min(1,reveal.progress),settle=1-Math.pow(1-t,3);
      out.push({box:{...box,z:(Number(box.z)||0)+(1-settle)*H*0.9},index,progress:t});
    }
  });
  return out;
}

// Picture size for a container: never wider than the container, so names and
// captions keep their size on phones, and a little taller there to fill the space.
function viewSize(containerWidth){
  const width=Math.round(Math.max(300,Math.min(760,Number(containerWidth)||760)));
  return {width,height:Math.round(width*(width<560?0.8:0.566))};
}
// A caption hangs off an anchor point, pushed away from the middle of the floor by a
// fixed number of pixels. Its box is in pixels relative to the scaled anchor.
function captionBox(anchor,centre,text,push){
  const dx=anchor[0]-centre[0],dy=anchor[1]-centre[1],len=Math.hypot(dx,dy)||1;
  const align=Math.abs(dx)<len*0.35?"middle":dx>0?"start":"end",w=text.length*CAPTION_CHAR_PX;
  const ox=dx/len*push,oy=dy/len*push;
  const left=align==="start"?ox:align==="end"?ox-w:ox-w/2;
  return {anchor,text,align,ox,oy,left,right:left+w,top:oy-8,bottom:oy+8};
}
// Largest scale at which the storage outline and its captions fit the picture.
function fitScale(outline,captions,width,height,margin){
  const extent=s=>{
    const xs=outline.map(p=>p[0]*s),ys=outline.map(p=>p[1]*s);
    for(const c of captions){xs.push(c.anchor[0]*s+c.left,c.anchor[0]*s+c.right);ys.push(c.anchor[1]*s+c.top,c.anchor[1]*s+c.bottom)}
    return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
  };
  const fits=s=>{const e=extent(s);return e.maxX-e.minX<=width-2*margin&&e.maxY-e.minY<=height-2*margin};
  let lo=0,hi=1;
  while(fits(hi)&&hi<1e6)hi*=2;
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid}
  return {scale:lo,extent:extent(lo)};
}

function render(scene,camera,options={}){
  const width=options.width||760,height=options.height||430;
  const W=scene.W,D=scene.D,H=scene.H,size={W,D,H},unit=scene.unit||"";
  const cam=clampCamera(camera),b=basis(cam),sides=visibleSides(cam);
  const raw=(x,y,z)=>project(cam,size,x,y,z);
  const outline=[[0,0,0],[W,0,0],[W,D,0],[0,D,0],[0,0,H],[W,0,H],[W,D,H],[0,D,H]].map(c=>raw(...c));

  const farX=sides.x>0?0:W,farY=sides.y>0?0:D,nearX=W-farX,nearY=D-farY;
  const centreRaw=raw(W/2,D/2,0),sideX=sides.x?nearX:W;
  const postX=raw(nearX,farY,H/2)[0]>=raw(farX,nearY,H/2)[0]?[nearX,farY]:[farX,nearY];
  // Seen from behind, the front edge runs along the foot of the far wall, so its caption moves up to that wall's rim.
  const captions=[
    captionBox(raw(W/2,0,sides.y>0?H:0),centreRaw,`Front · ${fmt(W)} ${unit}`.trim(),16),
    captionBox(raw(sideX,D/2,0),centreRaw,`${fmt(D)} ${unit}`.trim(),16),
    captionBox(raw(postX[0],postX[1],H/2),centreRaw,`${fmt(H)} ${unit}`.trim(),12)
  ];
  const {scale,extent}=fitScale(outline,captions,width,height,8);
  const tx=(width-(extent.minX+extent.maxX))/2,ty=(height-(extent.minY+extent.maxY))/2;
  const P=(x,y,z)=>{const p=raw(x,y,z);return [p[0]*scale+tx,p[1]*scale+ty]};

  const wall='fill="#ecece6" stroke="#b9bab3" stroke-width="1.2" stroke-linejoin="round"';
  const shell=poly([P(0,0,0),P(W,0,0),P(W,D,0),P(0,D,0)],'fill="#ffffff" stroke="#222" stroke-width="2" stroke-linejoin="round"')
    +(sides.x?poly([P(farX,0,0),P(farX,D,0),P(farX,D,H),P(farX,0,H)],wall):"")
    +(sides.y?poly([P(0,farY,0),P(W,farY,0),P(W,farY,H),P(0,farY,H)],wall):"");

  const solids=[
    ...(scene.obstacles||[]).map((o,index)=>({box:{...o,z:0},index,obstacle:true,progress:1})),
    ...revealedBoxes(scene.boxes||[],options.reveal,H)
  ];
  const drawn=drawOrder(solids.map(s=>s.box),cam).map(i=>({entry:solids[i],faces:facesOf(solids[i].box,P,sides)}));
  const body=drawn.map(d=>d.entry.obstacle?obstacleMarkup(d.entry,d.faces):boxMarkup(d.entry,d.faces,sides,b)).join("");
  // Names are placed nearest first; a farther name that would collide with one already placed is left out.
  const placed=[];
  for(let k=drawn.length-1;k>=0;k--){
    const d=drawn[k];
    if(d.entry.obstacle||d.entry.progress<1)continue;
    const nearer=drawn.slice(k+1).filter(n=>!n.entry.obstacle).flatMap(n=>n.faces.map(f=>f.pts));
    const label=labelPlacement(d.faces[d.faces.length-1].pts,String(d.entry.box.label||""),nearer);
    if(label&&!placed.some(other=>overlaps(label,other)))placed.push(label);
  }
  const labels=placed.reverse().map(labelMarkup).join("");

  // The open rim and the near corner posts stay as faint lines over the contents.
  const line=(p,q)=>`<line x1="${p[0].toFixed(2)}" y1="${p[1].toFixed(2)}" x2="${q[0].toFixed(2)}" y2="${q[1].toFixed(2)}" stroke="#222" stroke-opacity=".3" stroke-width="1.2"/>`;
  const rim=[[0,0],[W,0],[W,D],[0,D]].map((c,i,all)=>line(P(c[0],c[1],H),P(all[(i+1)%4][0],all[(i+1)%4][1],H))).join("");
  const posts=[[nearX,nearY],[nearX,farY],[farX,nearY]].map(c=>line(P(c[0],c[1],0),P(c[0],c[1],H))).join("");

  const captionMarkup=captions.map(c=>`<text x="${(c.anchor[0]*scale+tx+c.ox).toFixed(2)}" y="${(c.anchor[1]*scale+ty+c.oy).toFixed(2)}" text-anchor="${c.align}" dominant-baseline="central" font-size="11" font-weight="700" fill="#6f716b" pointer-events="none">${esc(c.text)}</text>`).join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Interactive 3D view">${shell}${body}${rim}${posts}${labels}${captionMarkup}</svg>`;
}

root.StorageFit3D={viewSize,defaultCamera,clampCamera,project,depth,visibleSides,drawOrder,assemblyOrder,assemblyFrame,tint,render};
})(typeof window!=="undefined"?window:globalThis);
