"use strict";
const el = id => document.getElementById(id);
const game = el("game"), result = el("result"), board = el("board");
const ctx = board.getContext("2d"), W = board.width, H = board.height;
const fruit = ["🫐","🍑","🟠","🍊","🍎","🍑","🍈","🎃"];
const colors = ["#6279de","#923882","#ed7028","#ff9b22","#e74a45","#ff9d9f","#b7d764","#f68623"];
const warningLine = 86;
const overflowLimit = 1300;
const dropCooldown = 300;
const sizes = [13,17,22,27,33,41,50,62].map(radius => radius * 1.3);
const atlas = [["470cf.png",[658.18,-20,-180.61,877.58]],["470cf.png",[382.39,-179.37,-62.68,574.6]],["470cf.png",[381.05,-5.53,-237.41,531.94]],["470cf.png",[326.13,-244.48,-42.64,484.28]],["470cf.png",[291.94,-312.87,-24.73,423.39]],["470cf.png",[317.54,-97.97,-179.24,489.19]],["470cf.png",[246.82,-167.05,-124.09,411.36]],["54635.png",null],["bff02.png",[671.97,-101.34,-124.24,1190.6]],["bff02.png",[434.8,-259.06,-58.97,821.3]],["bff02.png",[291.78,-296.57,-22.52,556.11]],["bff02.png",[245.03,-346.31,-13.64,452.55]],["bff02.png",[245.03,-8.5,-130.5,452.55]],["bff02.png",[245.03,-119.37,-132.41,452.55]],["bff02.png",[245.03,-232.47,-136.44,452.55]],["bff02.png",[245.03,-345.11,-137.39,452.55]]];
const images = new Map();
for (const [file] of atlas) {
  if (images.has(file)) continue;
  const image = new Image();
  image.src = "assets/" + file;
  images.set(file, image);
}
let bodies, effects, aim, next, upcoming, score, deadline, last, frame, dropAt;
let running = false;
let dropId = 0;
let overflowSince=new Map();
const pick = () => Math.floor(Math.random() * 4);
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
function sprite(index, x, y, w, h, ctx=board.getContext("2d")) {
  const [file, crop] = atlas[index];
  const image = images.get(file);
  if (!image.naturalWidth) return false;
  if (!crop) {
    ctx.drawImage(image, x, y, w, h);
    return true;
  }
  const [height, left, top, width] = crop;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x,y,w,h);
  ctx.clip();
  ctx.drawImage(image,x + left*w/100,y + top*h/100,width*w/100,height*h/100);
  ctx.restore();
  return true;
}
function paintFruit(type,x,y,r,ctx=board.getContext("2d")) {
  const width=type===6 ? r*1.56 : r*2;
  const height=type===6 ? r*2.12 : r*2;
  if (sprite(type,x-width/2,y+r-height,width,height,ctx)) return;
  const shade = ctx.createRadialGradient(x-r*.35,y-r*.45,1,x,y,r);
  shade.addColorStop(0,"#fff0c9");
  shade.addColorStop(.35,colors[type]);
  shade.addColorStop(1,"#38203a");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fill();
  if (type !== 1 && type !== 2) {
    ctx.font = r + "px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fruit[type],x,y);
  }
}
function drawFruit(type,x,y,r,angle=0) {
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(angle);
  paintFruit(type,0,0,r);
  ctx.restore();
}
function start() {
  if (result.open) result.close();
  if (!game.open) game.showModal();
  cancelAnimationFrame(frame);
  overflowSince.clear();
  dropId = 0;
  bodies = []; effects = []; aim = W/2; next = pick(); upcoming = pick(); drawUpcoming(); score = 0;
  last = performance.now(); deadline = last + 60000; dropAt = last;
  running = true;
  el("score").textContent = "0점";
  board.focus();
  tick(last);
}
function stop() {
  running = false;
  cancelAnimationFrame(frame);
}
function finish(message) {
  stop();
  el("summary").textContent = message + " · " + score + "점";
  result.showModal();
}
function closeGame() {
  stop();
  if (result.open) result.close();
  if (game.open) game.close();
}
function add(type,x,y) {
  bodies.push({type,x,y,r:sizes[type],vx:0,vy:0,angle:0,mass:(sizes[type]/sizes[0])**2});
}
function drop() {
  const now = performance.now();
  if (!running || now >= deadline || now < dropAt) return;
  const r = sizes[next], x = clamp(aim,r,W-r);
  if (bodies.some(b => Math.hypot(b.x-x,b.y-r) < b.r+r)) {
    return;
  }
  add(next,x,r);
  Object.assign(bodies.at(-1), { dropId: ++dropId, chain: 0 });
  next = upcoming;
  upcoming = pick();
  drawUpcoming();
  dropAt = now + dropCooldown;
}
function constrain(b) {
  if (b.x < b.r || b.x > W-b.r) b.vx *= -.42;
  if (b.y > H-b.r) {
    b.y = H-b.r;
    b.vy = b.vy > 45 ? -b.vy*.12 : 0;

  }
  b.x = clamp(b.x,b.r,W-b.r);
}
function step(dt,now) {
  for (const b of bodies) {
    const previousX=b.x;
    b.vy += 850*dt;
    b.x += b.vx*dt;
    b.y += b.vy*dt;
    b.vx *= Math.exp(-dt*(b.y >= H-b.r-1 ? 3.5 : .4));


    constrain(b);

    const roll=(b.x-previousX)/b.r;
    b.angle += roll;

  }
  for (let pass=0;pass<4;pass++) {
    for (let i=0;i<bodies.length;i++) {
      for (let j=i+1;j<bodies.length;j++) {
        const a=bodies[i], b=bodies[j], dx=b.x-a.x, dy=b.y-a.y;
        const distance=Math.hypot(dx,dy), overlap=a.r+b.r-distance;
        if (overlap < 0) continue;
        if (a.type===b.type) {
          const x=(a.x+b.x)/2, y=(a.y+b.y)/2;
          const origin = (a.dropId ?? 0) === (b.dropId ?? 0)
            ? ((a.chain ?? 0) >= (b.chain ?? 0) ? a : b)
            : ((a.dropId ?? 0) > (b.dropId ?? 0) ? a : b);
          const chain = (origin.chain ?? 0) + 1;
          const multiplier = chain >= 3 ? 2 : chain === 2 ? 1.5 : 1;
          effects.push({x,y,born:now,chain,multiplier});
          score += 10*(a.type+1)*multiplier;
          el("score").textContent = score + "점";
          bodies.splice(j,1);
          bodies.splice(i,1);
          add(Math.min(a.type+1,7),x,y);
          Object.assign(bodies.at(-1), { dropId: origin.dropId, chain });
          i--;
          break;
        }
        const nx=distance ? dx/distance : 1, ny=distance ? dy/distance : 0;
        const totalMass=a.mass+b.mass;
        const shareA=b.mass/totalMass, shareB=a.mass/totalMass;
        const correction=Math.max(0,overlap-.2)*.8;
        const moveA=clamp(a.x-nx*correction*shareA,a.r,W-a.r)-a.x;
        const moveB=clamp(b.x+nx*correction*shareB,b.r,W-b.r)-b.x;
        a.angle+=moveA/a.r; b.angle+=moveB/b.r;
        a.x+=moveA; a.y-=ny*correction*shareA;
        b.x+=moveB; b.y+=ny*correction*shareB;
        const speed=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if (speed<0) {
          const hardImpact=speed < -45 && pass===0;
          const side=hardImpact ? Math.min(-speed*1.7,480)*(nx || 1) : -speed*nx;
          const vertical=ny*speed*(hardImpact ? 1.28 : 1);
          a.vx-=side*shareA; a.vy+=vertical*shareA;
          b.vx+=side*shareB; b.vy-=vertical*shareB;
        }
      }
    }
    for (const b of bodies) constrain(b);
  }
}
function tick(now) {
  if (!running) return;
  const seconds = Math.max(0,Math.ceil((deadline-now)/1000));
  el("time").textContent = Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
  if (seconds===0) { finish("시간이 다 됐어요"); return; }
  const dt=Math.min(.04,(now-last)/1000);
  for (let i=0;i<3;i++) step(dt/3,now);
  const aboveLine=bodies.filter(b=>b.y-b.r<warningLine);
  overflowSince=new Map(aboveLine.map(b=>[b,overflowSince.get(b) ?? now]));
  const overflowing=aboveLine.length>0;
  if (aboveLine.some(b=>now-overflowSince.get(b)>=overflowLimit)) {
    finish("과일이 상단 점선을 넘었어요");
    return;
  }
  last=now;
  ctx.clearRect(0,0,W,H);
  if (overflowing) {
    ctx.fillStyle="#ff514533";
    ctx.fillRect(0,0,W,warningLine);
  }
  ctx.lineWidth=overflowing ? 3 : 1;
  ctx.strokeStyle=overflowing ? "#ff7665" : "#ffe9ad80";
  ctx.setLineDash([7,5]);
  ctx.beginPath(); ctx.moveTo(0,warningLine); ctx.lineTo(W,warningLine); ctx.stroke();
  ctx.lineWidth=1;
  const r=sizes[next], x=clamp(aim,r,W-r);
  const ready=now>=dropAt;
  ctx.strokeStyle=ready ? "#fff6cf" : "#ffffff35";
  ctx.setLineDash([4,6]);
  ctx.beginPath(); ctx.moveTo(x,r); ctx.lineTo(x,H); ctx.stroke();
  ctx.setLineDash([]);
  for (const b of bodies) drawFruit(b.type,b.x,b.y,b.r,b.angle);
  ctx.save();
  ctx.globalAlpha=ready ? 1 : .42;
  drawFruit(next,x,r,r);
  ctx.restore();
  if (overflowing) {
    const elapsed=now-Math.min(...overflowSince.values());
    ctx.save();
    ctx.strokeStyle="#ff7665";
    ctx.lineWidth=2;
    for (const fruit of aboveLine) {
      ctx.beginPath();
      ctx.arc(fruit.x,fruit.y,fruit.r,0,Math.PI*2);
      ctx.stroke();
    }
    ctx.fillStyle="#842e27";
    ctx.fillRect(48,warningLine+6,W-96,25);
    ctx.fillStyle="#fff4de";
    ctx.font="bold 15px system-ui";
    ctx.textAlign="center";
    ctx.fillText("상단선 초과 · 종료까지 "+((overflowLimit-elapsed)/1000).toFixed(1)+"초",W/2,warningLine+24);
    ctx.restore();
  }
  effects=effects.filter(effect => now-effect.born<700);
  for (const effect of effects) {
    const index=Math.floor((now-effect.born)/50);
    if (index<8 && !sprite(8+index,effect.x-48,effect.y-48,96,96)) {
    ctx.fillStyle="rgba(255,236,156,"+(1-index/8)+")";
    for (let i=0;i<8;i++) {
      const angle=i*Math.PI/4, d=7+index*5;
      ctx.beginPath();
      ctx.arc(effect.x+Math.cos(angle)*d,effect.y+Math.sin(angle)*d,5-index*.4,0,Math.PI*2);
      ctx.fill();
    }
    }
    const progress=(now-effect.born)/700;
    ctx.save();
    ctx.globalAlpha=Math.min(1,(1-progress)*3);
    ctx.font="900 24px system-ui";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.lineJoin="round";
    ctx.lineWidth=4;
    ctx.strokeStyle="#51290f";
    ctx.fillStyle="#ffdf66";
    const labelX=clamp(effect.x,65,W-65);
    const labelY=Math.max(16,effect.y-23-progress*27);
    ctx.strokeText("GOOD!",labelX,labelY);
    ctx.fillText("GOOD!",labelX,labelY);
    if (effect.chain>1) {
      const label=effect.chain+"연쇄 ×"+effect.multiplier;
      ctx.font="900 18px system-ui";
      ctx.strokeText(label,labelX,labelY+23);
      ctx.fillText(label,labelX,labelY+23);
    }
    ctx.restore();
  }
  frame=requestAnimationFrame(tick);
}
function point(event) {
  const rect=board.getBoundingClientRect();
  aim=(event.clientX-rect.left)*W/rect.width;
}
board.addEventListener("pointermove",point);
board.addEventListener("pointerup",event=>{ if(event.button===0){point(event);drop();} });
board.addEventListener("keydown",event=>{
  if (!["ArrowLeft","ArrowRight"," ","Enter"].includes(event.key)) return;
  event.preventDefault();
  if(event.key==="ArrowLeft") aim-=12;
  else if(event.key==="ArrowRight") aim+=12;
  else if(!event.repeat) drop();
  aim=clamp(aim,0,W);
});
el("launch").onclick=start;
el("again").onclick=start;
el("close").onclick=closeGame;
el("done").onclick=closeGame;
for (const dialog of [game,result]) dialog.addEventListener("cancel",event=>{
  event.preventDefault();
  closeGame();
});


const fruitNames=["블루베리","자두","감","오렌지","사과","복숭아","멜론","호박"];
fruitNames.forEach((name,type)=>{
  const item=document.createElement("li");
  item.setAttribute("aria-label",name);
  item.title=name;
  const icon=document.createElement("canvas");
  icon.width=icon.height=64;
  icon.setAttribute("aria-hidden","true");
  item.append(icon);
  el("fruit-order").append(item);
  const image=images.get(atlas[type][0]);
  const paint=()=>{ const context=icon.getContext("2d"); context.clearRect(0,0,64,64); paintFruit(type,32,32,30,context); };
  image.addEventListener("load",paint,{once:true});
  paint();
});

function drawUpcoming() {
  if (upcoming === undefined) return;
  const icon=el("upcoming-icon");
  const context=icon.getContext("2d");
  context.clearRect(0,0,64,64);
  paintFruit(upcoming,32,32,28,context);
  el("upcoming").setAttribute("aria-label","다음 과일 "+fruitNames[upcoming]);
}
for (const image of images.values()) image.addEventListener("load",drawUpcoming);