// Dependency-free QR Code encoder (ISO/IEC 18004), byte mode only, after
// Project Nayuki's reference design. encode() returns a module matrix and
// svg() draws it. Used for drawer labels that open a shared plan.
(root => {
const ECL = {L:{ordinal:0,format:1},M:{ordinal:1,format:0},Q:{ordinal:2,format:3},H:{ordinal:3,format:2}};
// Indexed [ordinal][version]; version 0 is unused.
const ECC_CODEWORDS_PER_BLOCK = [
  [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
];
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
];

function rawDataModules(ver){
  let result=(16*ver+128)*ver+64;
  if(ver>=2){
    const numAlign=Math.floor(ver/7)+2;
    result-=(25*numAlign-10)*numAlign-55;
    if(ver>=7)result-=36;
  }
  return result;
}
function dataCodewords(ver,ecl){
  return Math.floor(rawDataModules(ver)/8)-ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver]*NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
}
function utf8(text){return Array.from(new TextEncoder().encode(String(text)))}
function bit(value,i){return ((value>>>i)&1)!==0}

// Reed–Solomon over GF(2^8) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1.
function gfMultiply(x,y){
  let z=0;
  for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}
  return z;
}
function rsDivisor(degree){
  const result=new Array(degree).fill(0);result[degree-1]=1;
  let root=1;
  for(let i=0;i<degree;i++){
    for(let j=0;j<result.length;j++){
      result[j]=gfMultiply(result[j],root);
      if(j+1<result.length)result[j]^=result[j+1];
    }
    root=gfMultiply(root,0x02);
  }
  return result;
}
function rsRemainder(data,divisor){
  const result=divisor.map(()=>0);
  for(const b of data){
    const factor=b^result.shift();result.push(0);
    divisor.forEach((coef,i)=>{result[i]^=gfMultiply(coef,factor)});
  }
  return result;
}

function alignmentPositions(ver,size){
  if(ver===1)return [];
  const numAlign=Math.floor(ver/7)+2;
  const step=ver===32?26:Math.ceil((ver*4+4)/(numAlign*2-2))*2;
  const result=[6];
  for(let pos=size-7;result.length<numAlign;pos-=step)result.splice(1,0,pos);
  return result;
}

function build(ver,ecl,codewords,mask){
  const size=ver*4+17;
  const modules=Array.from({length:size},()=>new Array(size).fill(false));
  const fixed=Array.from({length:size},()=>new Array(size).fill(false));
  const set=(x,y,dark)=>{modules[y][x]=dark;fixed[y][x]=true};

  for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]]){
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
      const x=cx+dx,y=cy+dy,dist=Math.max(Math.abs(dx),Math.abs(dy));
      if(x>=0&&x<size&&y>=0&&y<size)set(x,y,dist!==2&&dist!==4);
    }
  }
  const align=alignmentPositions(ver,size),last=align.length-1;
  align.forEach((ay,i)=>align.forEach((ax,j)=>{
    if((i===0&&j===0)||(i===0&&j===last)||(i===last&&j===0))return;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  }));
  const drawFormat=m=>{
    const data=ecl.format<<3|m;
    let rem=data;
    for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
    const bits=(data<<10|rem)^0x5412;
    for(let i=0;i<=5;i++)set(8,i,bit(bits,i));
    set(8,7,bit(bits,6));set(8,8,bit(bits,7));set(7,8,bit(bits,8));
    for(let i=9;i<15;i++)set(14-i,8,bit(bits,i));
    for(let i=0;i<8;i++)set(size-1-i,8,bit(bits,i));
    for(let i=8;i<15;i++)set(8,size-15+i,bit(bits,i));
    set(8,size-8,true);
  };
  drawFormat(0);
  if(ver>=7){
    let rem=ver;
    for(let i=0;i<12;i++)rem=(rem<<1)^((rem>>>11)*0x1F25);
    const bits=ver<<12|rem;
    for(let i=0;i<18;i++){
      const a=size-11+i%3,b=Math.floor(i/3);
      set(a,b,bit(bits,i));set(b,a,bit(bits,i));
    }
  }

  // Codewords run in two-module columns from the bottom right, zigzagging up and down.
  let i=0;
  for(let right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<size;vert++){
      for(let j=0;j<2;j++){
        const x=right-j,upward=((right+1)&2)===0,y=upward?size-1-vert:vert;
        if(!fixed[y][x]&&i<codewords.length*8){modules[y][x]=bit(codewords[i>>>3],7-(i&7));i++}
      }
    }
  }

  const applyMask=m=>{
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      if(fixed[y][x])continue;
      const invert=[
        (x+y)%2===0,y%2===0,x%3===0,(x+y)%3===0,
        (Math.floor(x/3)+Math.floor(y/2))%2===0,x*y%2+x*y%3===0,
        (x*y%2+x*y%3)%2===0,((x+y)%2+x*y%3)%2===0
      ][m];
      if(invert)modules[y][x]=!modules[y][x];
    }
  };
  let chosen=mask;
  if(chosen<0){
    let best=Infinity;
    for(let m=0;m<8;m++){
      applyMask(m);drawFormat(m);
      const score=penalty(modules);
      if(score<best){best=score;chosen=m}
      applyMask(m);
    }
  }
  applyMask(chosen);drawFormat(chosen);
  return {size,modules,mask:chosen};
}

// Mask penalty rules N1–N4.
function penalty(modules){
  const size=modules.length;
  let result=0;
  const addHistory=(run,history)=>{if(history[0]===0)run+=size;history.pop();history.unshift(run)};
  const countPatterns=h=>{
    const n=h[1],core=n>0&&h[2]===n&&h[3]===n*3&&h[4]===n&&h[5]===n;
    return (core&&h[0]>=n*4&&h[6]>=n?1:0)+(core&&h[6]>=n*4&&h[0]>=n?1:0);
  };
  const terminate=(color,run,history)=>{
    if(color){addHistory(run,history);run=0}
    addHistory(run+size,history);
    return countPatterns(history);
  };
  for(const read of [(a,b)=>modules[a][b],(a,b)=>modules[b][a]]){
    for(let a=0;a<size;a++){
      let color=false,run=0;const history=[0,0,0,0,0,0,0];
      for(let b=0;b<size;b++){
        if(read(a,b)===color){run++;if(run===5)result+=3;else if(run>5)result++}
        else{addHistory(run,history);if(!color)result+=countPatterns(history)*40;color=read(a,b);run=1}
      }
      result+=terminate(color,run,history)*40;
    }
  }
  let dark=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    if(modules[y][x])dark++;
    if(y<size-1&&x<size-1){
      const c=modules[y][x];
      if(c===modules[y][x+1]&&c===modules[y+1][x]&&c===modules[y+1][x+1])result+=3;
    }
  }
  const total=size*size;
  return result+(Math.ceil(Math.abs(dark*20-total*10)/total)-1)*10;
}

// Smallest symbol that holds the text at the given error-correction level, or null.
function encode(text,options={}){
  const ecl=ECL[options.ecc||"M"]||ECL.M,bytes=utf8(text);
  const mask=Number.isInteger(options.mask)&&options.mask>=0&&options.mask<8?options.mask:-1;
  let ver=Math.max(1,options.minVersion||1),capacity=0;
  for(;ver<=40;ver++){
    capacity=dataCodewords(ver,ecl)*8;
    if(4+(ver<10?8:16)+bytes.length*8<=capacity)break;
  }
  if(ver>40)return null;
  const bits=[];
  const push=(value,length)=>{for(let i=length-1;i>=0;i--)bits.push((value>>>i)&1)};
  push(0b0100,4);push(bytes.length,ver<10?8:16);
  bytes.forEach(b=>push(b,8));
  push(0,Math.min(4,capacity-bits.length));
  push(0,(8-bits.length%8)%8);
  for(let pad=0xEC;bits.length<capacity;pad^=0xEC^0x11)push(pad,8);
  const data=[];
  for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((v,b)=>v<<1|b,0));

  const blocks=NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver],eccLen=ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
  const raw=Math.floor(rawDataModules(ver)/8),shortBlocks=blocks-raw%blocks,shortLen=Math.floor(raw/blocks);
  const divisor=rsDivisor(eccLen),split=[];
  for(let i=0,k=0;i<blocks;i++){
    const dat=data.slice(k,k+shortLen-eccLen+(i<shortBlocks?0:1));k+=dat.length;
    const block=dat.concat(rsRemainder(dat,divisor));
    if(i<shortBlocks)block.splice(shortLen-eccLen,0,0);
    split.push(block);
  }
  const codewords=[];
  for(let i=0;i<split[0].length;i++)split.forEach((block,j)=>{if(i!==shortLen-eccLen||j>=shortBlocks)codewords.push(block[i])});

  const symbol=build(ver,ecl,codewords,mask);
  return {version:ver,ecc:options.ecc||"M",...symbol};
}

// SVG with a light quiet zone; dark modules are one path, so it prints crisply at any size.
function svg(qr,options={}){
  const margin=options.margin??4,n=qr.size+margin*2;
  let d="";
  qr.modules.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)d+=`M${x+margin} ${y+margin}h1v1h-1z`}));
  const label=options.label?` aria-label="${String(options.label).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}"`:"";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img"${label}><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

root.StorageFitQR={encode,svg};
})(typeof window!=="undefined"?window:globalThis);
