"use strict";
const el = id => document.getElementById(id);
const game = el("game"), result = el("result"), board = el("board");
const ctx = board.getContext("2d"), W = board.width, H = board.height;
const fruit = ["🫐","🍑","🟠","🍊","🍎","🍑","🍈","🎃"];
const colors = ["#6279de","#923882","#ed7028","#ff9b22","#e74a45","#ff9d9f","#b7d764","#f68623"];
const sizes = [13,17,22,27,33,41,50,62];
const atlas = [["470cf.png",[658.18,-20,-180.61,877.58]],["470cf.png",[382.39,-179.37,-62.68,574.6]],["470cf.png",[381.05,-5.53,-237.41,531.94]],["470cf.png",[326.13,-244.48,-42.64,484.28]],["470cf.png",[291.94,-312.87,-24.73,423.39]],["470cf.png",[317.54,-97.97,-179.24,489.19]],["470cf.png",[246.82,-167.05,-124.09,411.36]],["54635.png",null],["bff02.png",[671.97,-101.34,-124.24,1190.6]],["bff02.png",[434.8,-259.06,-58.97,821.3]],["bff02.png",[291.78,-296.57,-22.52,556.11]],["bff02.png",[245.03,-346.31,-13.64,452.55]],["bff02.png",[245.03,-8.5,-130.5,452.55]],["bff02.png",[245.03,-119.37,-132.41,452.55]],["bff02.png",[245.03,-232.47,-136.44,452.55]],["bff02.png",[245.03,-345.11,-137.39,452.55]]];
const images = new Map();
for (const [file] of atlas) {
  if (images.has(file)) continue;
  const image = new Image();
  image.src = "assets/" + file;
  images.set(file, image);
}
let bodies, effects, aim, next, score, deadline, last, frame, dropAt;
let running = false;
const pick = () => Math.floor(Math.random() * 4);
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
function sprite(index, x, y, w, h) {
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
function paintFruit(type,x,y,r) {
  if (sprite(type,x-r,y-r,2*r,2*r)) return;
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
  bodies = []; effects = []; aim = W/2; next = pick(); score = 0;
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
  bodies.push({type,x,y,r:sizes[type],vx:0,vy:0,angle:0,spin:0});
}
function drop() {
  const now = performance.now();
  if (!running || now >= deadline || now < dropAt) return;
  const r = sizes[next], x = clamp(aim,r,W-r);
  if (bodies.some(b => Math.hypot(b.x-x,b.y-r) < b.r+r)) {
    finish("과일이 가득 찼어요");
    return;
  }
  add(next,x,r);
  next = pick();
  dropAt = now + 340;
}
function constrain(b) {
  if (b.x < b.r || b.x > W-b.r) b.vx *= -.42;
  if (b.y > H-b.r) {
    b.y = H-b.r;
    b.vy = Math.min(0,-b.vy*.12);

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

    b.spin *= Math.exp(-dt*1.5);
    constrain(b);
    const onFloor=b.y >= H-b.r-1;
    const roll=(b.x-previousX)/b.r;
    b.angle += roll + (onFloor ? 0 : b.spin*dt);
    if (onFloor) b.spin=0;
  }
  for (let pass=0;pass<4;pass++) {
    for (let i=0;i<bodies.length;i++) {
      for (let j=i+1;j<bodies.length;j++) {
        const a=bodies[i], b=bodies[j], dx=b.x-a.x, dy=b.y-a.y;
        const distance=Math.hypot(dx,dy), overlap=a.r+b.r-distance;
        if (overlap < 0) continue;
        if (a.type===b.type) {
          const x=(a.x+b.x)/2, y=(a.y+b.y)/2;
          effects.push({x,y,born:now});
          score += 10*(a.type+1);
          el("score").textContent = score + "점";
          bodies.splice(j,1);
          bodies.splice(i,1);
          if (a.type<7) add(a.type+1,x,y);
          i--;
          break;
        }
        const nx=distance ? dx/distance : 1, ny=distance ? dy/distance : 0;
        a.x-=nx*overlap/2; a.y-=ny*overlap/2;
        b.x+=nx*overlap/2; b.y+=ny*overlap/2;
        const speed=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if (speed<0) {
          const tangent=(b.vx-a.vx)*(-ny)+(b.vy-a.vy)*nx;
          const friction=clamp(tangent*.16,speed*.24,-speed*.24);
          a.vx-=ny*friction; a.vy+=nx*friction;
          b.vx+=ny*friction; b.vy-=nx*friction;
          a.spin+=friction/a.r; b.spin+=friction/b.r;
          const side=clamp(-speed*.85,0,240)*(nx || 1);
          a.vx-=side; a.vy+=ny*speed*.64;
          b.vx+=side; b.vy-=ny*speed*.64;
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
  last=now;
  ctx.clearRect(0,0,W,H);
  const r=sizes[next], x=clamp(aim,r,W-r);
  ctx.strokeStyle="#ffffff70";
  ctx.setLineDash([4,6]);
  ctx.beginPath(); ctx.moveTo(x,r); ctx.lineTo(x,H); ctx.stroke();
  ctx.setLineDash([]);
  for (const b of bodies) drawFruit(b.type,b.x,b.y,b.r,b.angle);
  drawFruit(next,x,r,r);
  effects=effects.filter(effect => now-effect.born<400);
  for (const effect of effects) {
    const index=Math.floor((now-effect.born)/50);
    if (!sprite(8+index,effect.x-48,effect.y-48,96,96)) {
    ctx.fillStyle="rgba(255,236,156,"+(1-index/8)+")";
    for (let i=0;i<8;i++) {
      const angle=i*Math.PI/4, d=7+index*5;
      ctx.beginPath();
      ctx.arc(effect.x+Math.cos(angle)*d,effect.y+Math.sin(angle)*d,5-index*.4,0,Math.PI*2);
      ctx.fill();
    }
    }
    const progress=(now-effect.born)/400;
    ctx.save();
    ctx.globalAlpha=Math.min(1,(1-progress)*3);
    ctx.font="900 24px system-ui";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.lineJoin="round";
    ctx.lineWidth=4;
    ctx.strokeStyle="#51290f";
    ctx.fillStyle="#ffdf66";
    const labelX=clamp(effect.x,42,W-42);
    const labelY=Math.max(16,effect.y-23-progress*27);
    ctx.strokeText("GOOD!",labelX,labelY);
    ctx.fillText("GOOD!",labelX,labelY);
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

