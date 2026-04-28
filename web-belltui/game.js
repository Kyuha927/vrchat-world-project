const cv=document.getElementById('c'),cx=cv.getContext('2d');
function rs(){cv.width=innerWidth;cv.height=innerHeight} addEventListener('resize',rs);rs();
const K={};addEventListener('keydown',e=>{K[e.code]=1;e.preventDefault()});addEventListener('keyup',e=>{K[e.code]=0});
let ac,amb;
function ia(){const AC=window.AudioContext||window.webkitAudioContext;ac=new AC()}
function snd(f,d,t='square',v=.06,when=0){if(!ac)return;const now=ac.currentTime+when,o=ac.createOscillator(),g=ac.createGain();o.type=t;o.frequency.value=f;g.gain.setValueAtTime(v,now);g.gain.exponentialRampToValueAtTime(.001,now+d);o.connect(g);g.connect(ac.destination);o.start(now);o.stop(now+d)}
function noise(d=.18,v=.04,when=0){if(!ac)return;const sr=ac.sampleRate,b=ac.createBuffer(1,sr*d,sr),data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const src=ac.createBufferSource(),g=ac.createGain(),bp=ac.createBiquadFilter();src.buffer=b;bp.type='bandpass';bp.frequency.value=900;bp.Q.value=3;g.gain.setValueAtTime(v,ac.currentTime+when);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+when+d);src.connect(bp);bp.connect(g);g.connect(ac.destination);src.start(ac.currentTime+when)}
function startAmb(){if(!ac||amb)return;const g=ac.createGain(),f=ac.createBiquadFilter(),o1=ac.createOscillator(),o2=ac.createOscillator();o1.type='sawtooth';o2.type='sine';o1.frequency.value=55;o2.frequency.value=82;f.type='lowpass';f.frequency.value=360;g.gain.value=.018;o1.connect(f);o2.connect(f);f.connect(g);g.connect(ac.destination);o1.start();o2.start();amb={g,o1,o2}}
function neighborSnd(tr){const map={slow:[[280,.12,'triangle'],[220,.18,'sine',.05,.08]],fast:[[130,.08,'sawtooth'],[95,.08,'sawtooth',.07,.07]],far:[[520,.05,'square'],[740,.05,'square',.06,.08],[380,.08,'square',.05,.16]],ghost:[[640,.28,'sine',.035],[480,.36,'sine',.028,.08]],alarm:[[880,.08,'square'],[990,.08,'square',.06,.1],[880,.08,'square',.06,.2]],alert:[[320,.1,'sawtooth'],[640,.1,'sawtooth',.055,.12]],stun:[[660,.09,'triangle'],[880,.12,'triangle',.05,.1]],throw:[[180,.08,'square'],[120,.12,'square',.06,.08]]};(map[tr]||[[300,.12,'square']]).forEach(n=>snd(n[0],n[1],n[2],n[3]||.06,n[4]||0));if(tr==='fast'||tr==='throw')noise(.12,.035,.04)}

const NB=[
{name:'할머니',em:'👵',col:'#8B4513',spd:1.2,rng:180,del:90,angEm:'🤬',trait:'slow'},
{name:'근육맨',em:'💪',col:'#B22222',spd:3.5,rng:200,del:50,angEm:'😡',trait:'fast'},
{name:'강아지집',em:'🐕',col:'#DAA520',spd:2.8,rng:350,del:40,angEm:'🐕‍🦺',trait:'far'},
{name:'유령',em:'👻',col:'#4a4a8a',spd:2,rng:250,del:120,angEm:'👻',trait:'ghost'},
{name:'아줌마',em:'👩',col:'#C71585',spd:2.2,rng:220,del:70,angEm:'🗣️',trait:'alarm'},
{name:'경비원',em:'👮',col:'#1a3a6a',spd:3,rng:300,del:60,angEm:'🚨',trait:'alert'},
{name:'고양이집',em:'🐱',col:'#FF8C00',spd:1,rng:120,del:100,angEm:'😾',trait:'stun'},
{name:'잠옷아저씨',em:'😴',col:'#556B2F',spd:1.5,rng:150,del:140,angEm:'🩴',trait:'throw'},
];
const GOOD_DEEDS=[
{em:'🐱',name:'길고양이 밥주기',desc:'고양이에게 밥을 줬다!',reduce:1},
{em:'📦',name:'택배 배달',desc:'택배를 문 앞에 놓아줬다!',reduce:1},
{em:'🔧',name:'가로등 수리',desc:'깜빡이는 가로등을 고쳤다!',reduce:1},
{em:'👵',name:'할머니 도움',desc:'짐을 들어드렸다! 사탕 획득',reduce:2},
];
const FLOOR_THEMES=[
{name:'지하 B1',col:'#0d0d1f',doorCol:'#2a2020',light:.3,drones:0},
{name:'서민 1F',col:'#111130',doorCol:'#3a2820',light:.6,drones:0},
{name:'서민 2F',col:'#131335',doorCol:'#3a2820',light:.7,drones:1},
{name:'중산층 3F',col:'#151540',doorCol:'#4a3830',light:.8,drones:1},
{name:'중산층 4F',col:'#171745',doorCol:'#4a3830',light:.85,drones:2},
{name:'고급 5F',col:'#1a1a50',doorCol:'#5a4840',light:.9,drones:2},
];
const NEON_SIGNS=[
{txt:'PC방',col:'#00d4ff',w:58},{txt:'치킨',col:'#ffd166',w:56},{txt:'빌런조합',col:'#E94560',w:92},
{txt:'24시 라면',col:'#7FFF7F',w:86},{txt:'사이버분식',col:'#A855F7',w:96},{txt:'고양이카페',col:'#ff8c00',w:96}
];

let G=null;
class Game{
constructor(){
this.score=0;this.combo=0;this.maxC=0;this.lives=3;this.fl=0;this.t=0;
this.state='play';this.cT=0;this.shake=0;this.notoriety=0;this.goodCount=0;
this.p={x:100,y:0,vx:0,sp:4.5,dsp:9,dash:0,face:1,af:0,ring:0,stunT:0};
this.floors=[];this.parts=[];this.cam=0;this.alerts=[];this.goodEvts=[];this.popups=[];
this.invuln=0;this.freeze=null;this.transition=null;
this.rain=Array.from({length:120},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,l:8+Math.random()*18,spd:6+Math.random()*8,a:.18+Math.random()*.22}));
for(let f=0;f<6;f++){
  const nd=5+f,sp=Math.max(130,(cv.width-160)/nd),doors=[];
  for(let d=0;d<nd;d++){
    const nb={...NB[Math.floor(Math.random()*NB.length)]};
    doors.push({x:100+d*sp,st:'closed',tm:0,sc:false,nb,nx:0,
      del:Math.max(25,nb.del-f*10),cSpd:nb.spd+f*.2,det:nb.rng+f*8});
  }
  const hs=[];for(let i=1;i<nd;i+=2)hs.push({x:100+i*sp-sp/2,w:36});hs.push({x:30,w:36});
  // Good deed events
  const ge=[];if(Math.random()>.4){const gd=GOOD_DEEDS[Math.floor(Math.random()*GOOD_DEEDS.length)];
    ge.push({...gd,x:100+Math.floor(Math.random()*nd)*sp+sp/2,done:false});}
  const signs=[];for(let s=0;s<3;s++){const sg=NEON_SIGNS[(f+s*2+Math.floor(Math.random()*NEON_SIGNS.length))%NEON_SIGNS.length];
    signs.push({...sg,x:80+s*260+Math.random()*80,y:-96-Math.random()*28,phase:Math.random()*10});}
  this.floors.push({doors,hs,ge,drones:[],signs});
  // Drones
  const th=FLOOR_THEMES[f];
  for(let i=0;i<th.drones;i++)this.floors[f].drones.push({x:200+i*300,dir:1,spd:1.5+f*.3});
}
this.upY();
}
fy(f){return cv.height-70-f*110}
upY(){this.p.y=this.fy(this.fl)}
fw(){const d=this.floors[this.fl].doors;return d.length?d[d.length-1].x+130:cv.width}
notorietyLevel(){return Math.min(4,Math.floor(this.notoriety/6))}
tickFx(){
this.rain.forEach(r=>{r.x-=2.4;r.y+=r.spd;if(r.y>cv.height+30||r.x<-30){r.x=Math.random()*cv.width+40;r.y=-30;r.spd=6+Math.random()*8}});
this.popups=this.popups.filter(p=>{p.y-=.8;p.life--;return p.life>0});
if(this.invuln>0)this.invuln--;
if(this.transition){this.transition.t--;if(this.transition.t<=0)this.transition=null}
}
changeFloor(dir){this.fl+=dir;this.upY();this.transition={t:34,dir};snd(1046,.08,'sine',.07);snd(1568,.16,'triangle',.05,.09);this.addP(this.p.x,this.p.y-8,'#00d4ff',10)}
scoreDitch(d,x,y){if(d.sc)return;d.sc=1;this.combo++;if(this.combo>this.maxC)this.maxC=this.combo;const pts=100*this.combo;this.score+=pts;this.popups.push({x,y,txt:'+'+pts+(this.combo>1?' COMBO':''),life:52,col:this.combo>1?'#ffd166':'#7FFF7F'});if(this.combo>1)snd(1200,.06,'sine',.06);this.addP(x,y,'#7FFF7F',6)}
goodFreeze(ge){this.freeze={t:42,em:ge.em,title:ge.name,desc:ge.desc};this.shake=3;snd(523,.15,'sine',.08);snd(659,.15,'sine',.06,.08)}

update(){
if(this.state==='over')return;
this.tickFx();
if(this.freeze){this.freeze.t--;this.t++;if(this.freeze.t<=0)this.freeze=null;this.upHUD();return}
if(this.state==='caught'){this.cT--;this.shake=this.cT*.3;if(this.cT<=0){this.lives--;
  if(this.lives<=0){this.state='over';this.showOver();return}
  this.state='play';this.combo=0;this.floors[this.fl].doors.forEach(d=>{if(d.st==='angry'||d.st==='open'){d.st='closed';d.tm=0;d.sc=false}});
  this.p.x=100;this.p.stunT=0;this.invuln=120;}return;}
if(this.p.stunT>0){this.p.stunT--;this.t++;return;}
this.t++;const p=this.p;
// Move
p.dash=K.ShiftLeft||K.ShiftRight;const sp=p.dash?p.dsp:p.sp;let mv=0;
if(K.ArrowLeft||K.KeyA){p.vx=-sp;p.face=-1;mv=1}
else if(K.ArrowRight||K.KeyD){p.vx=sp;p.face=1;mv=1}
else p.vx*=.7;
p.x+=p.vx;p.x=Math.max(20,Math.min(p.x,this.fw()));if(mv)p.af+=.25;
// Floor
if((K.ArrowUp||K.KeyW)&&this.fl<5){K.ArrowUp=K.KeyW=0;this.changeFloor(1)}
if((K.ArrowDown||K.KeyS)&&this.fl>0){K.ArrowDown=K.KeyS=0;this.changeFloor(-1)}
const fl=this.floors[this.fl];
// Bell
if(K.Space){K.Space=0;const nd=fl.doors.find(d=>Math.abs(d.x-p.x)<40&&d.st==='closed');
  if(nd){nd.st='ring';nd.tm=nd.del;p.ring=15;snd(880,.1,'sine',.1);setTimeout(()=>snd(1100,.08,'sine',.08),80);
    this.notoriety=Math.min(30,this.notoriety+1);this.addP(nd.x+25,p.y-15,'#E94560',5);}}
if(p.ring>0)p.ring--;
// Good deed
if(K.KeyF){K.KeyF=0;const ge=fl.ge.find(g=>!g.done&&Math.abs(g.x-p.x)<35);
  if(ge){ge.done=true;this.goodCount++;this.notoriety=Math.max(0,this.notoriety-ge.reduce);
    this.goodFreeze(ge);this.toast(ge.em+' '+ge.desc,'good');
    this.addP(ge.x,p.y-20,'#00d4ff',8);if(ge.name==='할머니 도움')this.lives=Math.min(5,this.lives+1);}}
const hid=fl.hs.some(s=>Math.abs(s.x-p.x)<s.w/2);
// Doors
fl.doors.forEach(d=>{
  if(d.st==='ring'){d.tm--;if(d.tm<=0){d.st='open';d.tm=120;d.nx=d.x;neighborSnd(d.nb.trait);
    if(d.nb.trait==='alarm'){fl.doors.forEach(o=>{if(o!==d&&o.st==='closed'&&Math.abs(o.x-d.x)<180){o.st='ring';o.tm=Math.max(15,o.del-30)}});this.toast('🗣️ 옆집도 깨움!','bad')}
    if(d.nb.trait==='alert'&&this.fl<5){const uf=this.floors[this.fl+1].doors;const r=uf[Math.floor(Math.random()*uf.length)];if(r&&r.st==='closed'){r.st='ring';r.tm=35}this.toast('🚨 윗층에 무전!','bad')}
  }}
  else if(d.st==='open'){d.tm--;const dist=p.x-d.nx;
    if(!hid&&Math.abs(dist)<d.det){d.st='angry';if(d.nb.trait==='stun'){p.stunT=35;this.toast('🐱 귀여워서 멈칫!','good')}}
    if(d.tm<=0){this.scoreDitch(d,d.x+25,this.fy(this.fl)-30);d.st='closed';d.tm=0}}
  else if(d.st==='angry'){const dist=p.x-d.nx;d.nx+=Math.sign(dist)*d.cSpd*1.4;
    if(d.nb.trait==='throw'&&this.t%25===0&&Math.abs(d.nx-p.x)<140&&Math.abs(d.nx-p.x)>35)
      this.parts.push({x:d.nx,y:this.fy(this.fl),vx:Math.sign(dist)*6,vy:-1.5,life:28,color:'#8B4513',size:5,proj:1});
    if(Math.abs(d.nx-p.x)<20){this.caught();return}
    if(Math.abs(d.nx-d.x)>300){d.st='closed';d.tm=0;this.scoreDitch(d,d.x+25,this.fy(this.fl)-30)}}
});
// Drones
const nl=this.notorietyLevel();
fl.drones.forEach(dr=>{dr.x+=dr.dir*dr.spd;if(dr.x>this.fw()-50||dr.x<80)dr.dir*=-1;
  if(nl>=2&&!hid&&Math.abs(dr.x-p.x)<60){this.toast('🤖 드론에 탐지!','bad');this.caught()}});
// Projectile
this.parts.forEach(pt=>{if(pt.proj&&Math.abs(pt.x-p.x)<16&&Math.abs(pt.y-p.y)<28){pt.life=0;this.caught()}});
this.cam+=(p.x-cv.width/3-this.cam)*.08;
if(p.dash&&mv)this.parts.push({x:p.x-p.face*8,y:p.y+10,vx:-p.face*2,vy:-1,life:10,color:'#A855F7',size:3});
this.parts=this.parts.filter(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.life--;pt.size*=.94;return pt.life>0});
this.shake*=.9;this.upHUD();
}

caught(){if(this.invuln>0||this.state==='caught')return;this.state='caught';this.cT=45;this.shake=8;snd(200,.3,'sawtooth',.08);noise(.22,.05);this.addP(this.p.x,this.p.y-12,'#F33',10)}
addP(x,y,c,n){for(let i=0;i<n;i++)this.parts.push({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*5-2,life:16+Math.random()*10,color:c,size:2.5+Math.random()*3})}
toast(msg,type){const d=document.createElement('div');d.className='alert '+type;d.textContent=msg;document.getElementById('alerts').appendChild(d);setTimeout(()=>d.remove(),2000)}

draw(){
const W=cv.width,H=cv.height;cx.save();
cx.imageSmoothingEnabled=false;
if(this.shake>.3)cx.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);
// BG
const th=FLOOR_THEMES[this.fl];
drawSprite(cx,this.fl===0?'bg_basement':'bg_neon_city_v2',0,0,W,H);
cx.globalAlpha=.72;cx.fillStyle=th.col;cx.fillRect(0,0,W,H);cx.globalAlpha=1;
// Scanlines
cx.fillStyle='rgba(0,0,0,0.06)';for(let y=0;y<H;y+=3)cx.fillRect(0,y,W,1);
// Neon glow top
const gr=cx.createLinearGradient(0,0,0,80);gr.addColorStop(0,'rgba(233,69,96,.08)');gr.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=gr;cx.fillRect(0,0,W,80);
// Rain
cx.strokeStyle='rgba(140,220,255,.22)';cx.lineWidth=1;
this.rain.forEach(r=>{cx.globalAlpha=r.a;cx.beginPath();cx.moveTo(r.x,r.y);cx.lineTo(r.x-5,r.y+r.l);cx.stroke()});cx.globalAlpha=1;

const cm=Math.max(0,this.cam);cx.save();cx.translate(-cm,0);
for(let f=0;f<6;f++){
  const fy=this.fy(f),fl=this.floors[f],ft=FLOOR_THEMES[f];
  // Floor line with neon
  cx.fillStyle=f===this.fl?'#1e1e50':'#14142e';cx.fillRect(0,fy+48,this.fw()+160,3);
  if(f===this.fl){cx.fillStyle='rgba(233,69,96,.15)';cx.fillRect(0,fy+48,this.fw()+160,2)}
  // Floor label
  cx.fillStyle='#335';cx.font='11px Outfit';cx.fillText(ft.name,6,fy+16);
  // Flickering lights
  if(f===this.fl){for(let lx=80;lx<this.fw();lx+=200){
    const flicker=Math.random()>.05?ft.light:ft.light*.3;
    cx.fillStyle=`rgba(200,220,255,${flicker*.12})`;cx.fillRect(lx-30,fy-60,60,108);
    cx.fillStyle='#556';cx.fillRect(lx-8,fy-62,16,4);}}
  fl.signs.forEach(s=>this.drawSign(s,fy));
  // Hide spots
  fl.hs.forEach(s=>{drawSprite(cx,'hiding_spot',s.x-24,fy-10,48,58)});
  // Good deed events
  fl.ge.forEach(g=>{if(!g.done){const sk=GOOD_DEED_SPRITE_MAP[g.em];
    if(sk)drawSprite(cx,sk,g.x-18,fy-26,36,36);else{cx.font='20px serif';cx.fillText(g.em,g.x-10,fy+8)}
    if(f===this.fl&&Math.abs(g.x-this.p.x)<35){cx.fillStyle='rgba(0,212,255,.7)';cx.font='10px Outfit';cx.fillText('[F] '+g.name,g.x-30,fy-20)}}});
  // Doors
  fl.doors.forEach(d=>{
    drawSprite(cx,d.st==='open'||d.st==='angry'?'door_open':'door_closed',d.x-3,fy-38,52,84);
    if(d.st==='open'||d.st==='angry')this.drawNPC(d,fy)
    // Neighbor tag
    cx.fillStyle='rgba(255,255,255,.12)';cx.font='9px Outfit';cx.fillText(d.nb.em+d.nb.name,d.x,fy-40);
    // Bell glow
    const gl=d.st==='ring'?Math.sin(this.t*.5)*.5+.5:0;
    cx.fillStyle=d.st==='ring'?`rgba(233,69,96,${.5+gl*.5})`:'#444';cx.beginPath();cx.arc(d.x+50,fy-16,3.5,0,Math.PI*2);cx.fill();
    if(d.st==='ring'){cx.strokeStyle=`rgba(233,69,96,${gl*.4})`;cx.lineWidth=1.2;cx.beginPath();cx.arc(d.x+50,fy-16,7+gl*4,0,Math.PI*2);cx.stroke()}
    if(d.sc&&d.st==='closed'){cx.fillStyle='rgba(100,255,100,.3)';cx.font='14px Outfit';cx.fillText('✓',d.x+16,fy-8)}
  });
  // Drones
  if(this.notorietyLevel()>=1)fl.drones.forEach(dr=>{
    drawSprite(cx,'patrol_drone',dr.x-14,fy-64,28,20,dr.dir<0);
    cx.strokeStyle='rgba(168,85,247,.3)';cx.setLineDash([2,3]);cx.beginPath();cx.moveTo(dr.x,fy-44);cx.lineTo(dr.x,fy+48);cx.stroke();cx.setLineDash([]);
    cx.fillStyle='#A855F7';cx.font='8px Outfit';cx.fillText('DRONE',dr.x-14,fy-58)});
}
// Player
if(this.invuln>0&&Math.floor(this.invuln/6)%2===0){cx.globalAlpha=.35;this.drawP();cx.globalAlpha=1}else this.drawP();
// Particles
this.parts.forEach(pt=>{cx.globalAlpha=pt.life/22;cx.fillStyle=pt.color;cx.beginPath();cx.arc(pt.x,pt.y,pt.size,0,Math.PI*2);cx.fill()});cx.globalAlpha=1;
// Score popups
this.popups.forEach(p=>{cx.globalAlpha=Math.min(1,p.life/18);cx.fillStyle=p.col;cx.font='bold 16px Press Start 2P, monospace';cx.textAlign='center';cx.shadowColor=p.col;cx.shadowBlur=12;cx.fillText(p.txt,p.x,p.y);cx.shadowBlur=0;cx.textAlign='start'});cx.globalAlpha=1;
cx.restore();
// Notoriety bar
const nl=this.notorietyLevel();const stars='★'.repeat(nl+1)+'☆'.repeat(4-nl);
const nNames=['장난꾸러기','골칫덩이','지명수배','도시의 적','공공의 적'];
cx.fillStyle='rgba(15,15,42,.85)';cx.fillRect(W-210,H-36,200,28);
cx.fillStyle=nl>=3?'#E94560':nl>=2?'#A855F7':'#666';cx.font='bold 11px Outfit';
cx.fillText('⚡'+stars+' '+nNames[nl],W-204,H-18);
// Caught/stun overlay
if(this.state==='caught'){cx.fillStyle=`rgba(255,0,0,${this.cT/140})`;cx.fillRect(0,0,W,H);cx.fillStyle='#fff';cx.font='bold 28px Outfit';cx.textAlign='center';cx.fillText('😱 잡혔다!',W/2,H/2);cx.textAlign='start'}
if(this.p.stunT>0){cx.fillStyle='rgba(255,200,255,.12)';cx.fillRect(0,0,W,H);cx.fillStyle='#fff';cx.font='bold 20px Outfit';cx.textAlign='center';cx.fillText('🐱 귀여워...!',W/2,H/2);cx.textAlign='start'}
if(this.freeze){cx.fillStyle='rgba(0,10,24,.62)';cx.fillRect(0,0,W,H);cx.strokeStyle='rgba(0,212,255,.8)';cx.lineWidth=3;cx.strokeRect(W/2-170,H/2-58,340,116);cx.fillStyle='#fff';cx.font='34px serif';cx.textAlign='center';cx.fillText(this.freeze.em,W/2,H/2-18);cx.fillStyle='#00d4ff';cx.font='bold 20px Outfit';cx.fillText(this.freeze.title,W/2,H/2+14);cx.fillStyle='#dff';cx.font='14px Outfit';cx.fillText(this.freeze.desc,W/2,H/2+38);cx.textAlign='start'}
if(this.transition){const k=this.transition.t/34,w=W*k;cx.fillStyle='rgba(0,212,255,.18)';cx.fillRect(0,0,w,H);cx.fillRect(W-w,0,w,H);cx.fillStyle='rgba(10,10,26,.62)';cx.fillRect(0,0,w*.55,H);cx.fillRect(W-w*.55,0,w*.55,H);cx.fillStyle='#fff';cx.font='bold 18px Outfit';cx.textAlign='center';cx.fillText('ELEVATOR '+FLOOR_THEMES[this.fl].name,W/2,H/2);cx.textAlign='start'}
cx.restore();
}
drawSign(s,fy){const blink=(Math.sin(this.t*.08+s.phase)+1)/2,ok=Math.random()>.04,a=ok?(.52+blink*.42):.18,x=s.x,y=fy+s.y;
cx.save();cx.globalAlpha=a;cx.shadowColor=s.col;cx.shadowBlur=16;cx.fillStyle='rgba(5,5,18,.8)';cx.fillRect(x,y,s.w,26);cx.strokeStyle=s.col;cx.lineWidth=1.4;cx.strokeRect(x,y,s.w,26);cx.fillStyle=s.col;cx.font='bold 14px Outfit';cx.textAlign='center';cx.fillText(s.txt,x+s.w/2,y+18);cx.restore();cx.textAlign='start'}
drawP(){const p=this.p,b=Math.sin(p.af)*2.5,x=p.x,y=p.y;
cx.fillStyle='rgba(0,0,0,.2)';cx.beginPath();cx.ellipse(x,y+46,11,3,0,0,Math.PI*2);cx.fill();
const moving=Math.abs(p.vx)>.5,flip=p.face<0,px=x-24,py=y+b-24;
if(this.state==='caught')drawSprite(cx,'choroki_swing',px,py,48,48,flip);
else if(p.ring>0)drawSprite(cx,'choroki_bell',px,py,48,48,flip);
else if(moving)drawSpriteFrame(cx,'choroki_run_v2',Math.floor(p.af)%4,4,px,py,48,48,flip);
else drawSprite(cx,'choroki_idle',px,py,48,48,flip);
if(p.dash){cx.strokeStyle='#A855F7';cx.lineWidth=1.2;cx.setLineDash([3,3]);cx.beginPath();cx.moveTo(x-p.face*14,y+20);cx.lineTo(x-p.face*30,y+20);cx.stroke();cx.setLineDash([])}}
drawNPC(d,fy){const nx=d.nx,nb=d.nb;
if(nb.trait==='ghost')cx.globalAlpha=.5;
drawSprite(cx,NEIGHBOR_SPRITE_MAP[nb.trait],nx-20,fy-36,40,48,nx<this.p.x);
cx.globalAlpha=1;cx.font='12px Outfit';cx.fillText(d.st==='angry'?nb.angEm:'❓',nx-6,fy-22)}

upHUD(){document.getElementById('hs').textContent=this.score;document.getElementById('hc').textContent=this.combo;
document.getElementById('hl').textContent=this.lives;document.getElementById('hf').textContent=FLOOR_THEMES[this.fl].name;
document.getElementById('hn').textContent=this.notoriety;document.getElementById('hg').textContent=this.goodCount}
showOver(){const nl=this.notorietyLevel();
const endings=['"또 왔네 저 애" — 동네 허당 빌런','"또 왔네 저 애" — 동네 허당 빌런','지명수배... 하지만 미움받진 않았다','도시가 당신을 두려워한다','공공의 적 1호. 쓸쓸한 빌런의 최후'];
document.getElementById('fscore').textContent=this.score;
document.getElementById('fdetail').textContent=`콤보 ${this.maxC} | 선행 ${this.goodCount}회`;
document.getElementById('fending').textContent=this.goodCount>=5&&nl<=1?'🌟 선행 엔딩: 빌런인 줄 알았더니 동네 히어로!':endings[nl];
document.getElementById('over').style.display='flex';document.getElementById('hud').classList.add('hid')}
}
let isMulti=false;
function go(){if(!ac)ia();startAmb();document.getElementById('title').classList.add('hid');
document.getElementById('multi-lobby').style.display='none';document.getElementById('multi-lobby').classList.add('hid');
document.getElementById('over').style.display='none';
document.getElementById('hud').classList.remove('hid');G=new Game();G.upHUD();
if(isMulti)startMultiSync()}
function lp(){if(G&&G.state!=='over'){G.update();if(isMulti&&G.state==='play')sendHostState()}if(G)G.draw();requestAnimationFrame(lp)}
loadSprites(()=>{document.getElementById('loading').classList.add('hid');document.getElementById('title').classList.remove('hid')});
lp();

// === Multiplayer Host Functions ===
async function showMultiLobby(){
  document.getElementById('title').classList.add('hid');
  document.getElementById('multi-lobby').style.display='flex';
  document.getElementById('multi-lobby').classList.remove('hid');
  try{
    await NET.connect();
    NET.setName('쵸로키');
    const res=await NET.createRoom();
    if(!res.ok){alert('방 생성 실패');return}
    document.getElementById('room-code-display').textContent=res.code;
    document.getElementById('fan-link').textContent=location.origin+'/fan.html?code='+res.code;
    isMulti=true;
    // Listen for fan joins
    NET.socket.on('fanJoined',(data)=>{
      document.getElementById('fan-counter').textContent=data.count;
      updateFanList(data.snapshot);
      if(data.count>=1)document.getElementById('btn-host-start').disabled=false;
    });
    NET.socket.on('fanLeft',(data)=>{
      document.getElementById('fan-counter').textContent=data.count;
      updateFanList(data.snapshot);
    });
    NET.socket.on('fanReadyUpdate',(snapshot)=>{updateFanList(snapshot)});
    NET.socket.on('gameEvent',(evt)=>{handleMultiEvent(evt)});
  }catch(e){alert('서버 연결 실패: '+e.message)}
}
function updateFanList(snapshot){
  const el=document.getElementById('fan-names');
  el.innerHTML=snapshot.fans.map(f=>
    `<span style="color:${f.ready?'#39FF14':'#889'}">${f.neighborType.emoji}${f.name}${f.ready?' ✓':''}</span>`
  ).join(' · ');
}
function hostStartGame(){
  if(!NET.socket)return;
  NET.socket.emit('hostStart');
  showCharSelect();
}
function leaveMulti(){
  isMulti=false;
  if(NET.socket)NET.leaveRoom();
  NET.disconnect();
  document.getElementById('multi-lobby').style.display='none';
  document.getElementById('multi-lobby').classList.add('hid');
  document.getElementById('title').classList.remove('hid');
}
let syncTimer=null;
function startMultiSync(){
  if(syncTimer)clearInterval(syncTimer);
  syncTimer=setInterval(()=>{if(G&&isMulti)sendHostState()},50);
}
function sendHostState(){
  if(!G||!NET.socket)return;
  NET.sendInput({
    x:G.p.x,y:G.p.y,fl:G.fl,face:G.p.face,vx:G.p.vx,af:G.p.af,
    score:G.score,combo:G.combo,lives:G.lives,ring:G.p.ring,
    dash:G.p.dash,notoriety:G.notoriety,goodCount:G.goodCount,state:G.state,
  });
}
// Override bell ring to also notify server
const _origBell=Game.prototype.update;
const _wrapUpdate=Game.prototype.update;
Game.prototype.update=function(){
  const prevDoors=isMulti?this.floors[this.fl].doors.map(d=>d.st):null;
  _wrapUpdate.call(this);
  if(isMulti&&prevDoors){
    this.floors[this.fl].doors.forEach((d,i)=>{
      if(prevDoors[i]==='closed'&&d.st==='ring'){
        NET.socket.emit('bellRung',{floor:this.fl,doorIdx:i});
      }
    });
  }
};
function handleMultiEvent(evt){
  if(!G)return;
  if(evt.type==='fanOpenDoor'){
    const fl=G.floors[evt.floor];
    if(fl&&fl.doors[evt.doorIdx]){
      const d=fl.doors[evt.doorIdx];
      if(d.st==='ring'){d.st='open';d.tm=180;d.nx=d.x;neighborSnd(evt.neighborType.trait)}
    }
    G.toast(`${evt.fanName}(${evt.neighborType.emoji})이 문을 열었다!`,'bad');
  }
  if(evt.type==='fanChase'){
    const fl=G.floors[evt.floor];
    if(fl&&fl.doors[evt.doorIdx]){
      const d=fl.doors[evt.doorIdx];
      d.st='angry';d.cSpd=evt.speed*1.5;
    }
  }
  if(evt.type==='fanTrap'){
    G.toast(`${evt.fanName}이 함정을 설치했다! 🪤`,'bad');
    G.addP(G.p.x,G.p.y-20,'#A855F7',8);
  }
  if(evt.type==='fanReaction'){
    G.popups.push({x:G.p.x+Math.random()*80-40,y:G.p.y-60-Math.random()*40,txt:evt.emoji,life:40,col:'#fff'});
  }
  if(evt.type==='catchSuccess'){
    G.toast(`${evt.fanName}에게 잡혔다! (${evt.total}번째)`,'bad');
  }
}
