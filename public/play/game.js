/* Jeremy's World — deterministic presentation choreography over one continuous map.
 * Right/Space advances one beat. The fixed-step simulation completes every action
 * before the next reveal. Left retraces the same map and restores earlier events.
 */
(function(){
'use strict';
const canvas=document.getElementById('screen');
const r=new JeremyRenderer(canvas), C=JeremyColors;
const el=id=>document.getElementById(id);
const STEPS=[
 {x:54,w:1,kind:'title',cam:0,say:"Super Jeremy Bro's. Press Start."},
 {x:54,w:1,kind:'level',cam:0,wait:1.8,say:'World 1-1. Jeremy times 3.'},
 {x:54,w:1,kind:'start',cam:0,say:'World 1. Press Right Arrow or Space to advance.'},
 {x:184,w:1,kind:'name',wait:1.9,say:'My name is Jeremy.'},
 {x:648,w:2,kind:'passport',say:'Passport Control: Where are you from? Press Next to answer.'},
 {x:648,w:2,kind:'indonesia',wait:1.5,say:'I am from Indonesia.'},
 {x:992,w:2,kind:'japan',say:'I have also lived in Japan.'},
 {x:1288,w:2,kind:'malaysia',say:'I have also lived in Malaysia.'},
 {x:1574,w:2,kind:'china',say:'I have also lived in China.'},
 {x:1792,w:2,kind:'stamps',cam:1552,say:'I have visited many other countries, with more journeys still ahead.'},
 {x:1968,w:3,kind:'college',cam:1872,say:'After college?'},
 {x:2100,w:3,kind:'work',cam:1872,wait:.4,say:'Back to work.'},
 {x:2260,w:3,kind:'masters',cam:1872,wait:.4,say:"Master's."},
 {x:2752,w:4,kind:'pipe',cam:2592,say:'What English skill do I want to improve? Press Next to discover it.'},
 {x:2888,y:216,w:4,kind:'ielts',say:'IELTS: 7.5.'},
 {x:2992,y:200,w:4,cam:2776,kind:'writing',say:'Writing: 6.5.'},
 {x:3264,w:4,kind:'improve',wait:.7,say:'In English, I want to improve my writing.'},
 {x:3450,w:5,kind:'boss',cam:3424,wait:.7,say:'My heroes. Jeremy waits while a boss blocks the bridge.'},
 {x:3450,w:5,kind:'rommel',cam:3424,wait:3.2,say:'Erwin Rommel — General of WW2 (Desert Fox).'},
 {x:3450,w:5,kind:'jobs',cam:3424,wait:3.2,say:'Steve Jobs — Co-founder of Apple.'},
 {x:3450,w:5,kind:'pep',cam:3424,wait:3.2,say:'Josep “Pep” Guardiola — Legendary football coach.'},
 {x:3450,w:5,kind:'battle',cam:3424,wait:13.8,say:'Rommel, Jobs and Pep each dodge the fire, then stomp Bowser and bounce away. Three stomps defeat him. Jeremy stays behind.'},
 {x:4112,w:6,kind:'celebrate',cam:3864,wait:1.4,say:'The heroes have disappeared. Jeremy runs forward alone and celebrates.'},
 {x:4112,w:6,kind:'stories',cam:3864,wait:1.2,say:'These are my stories...'},
 {x:4112,w:6,kind:'question',cam:3864,wait:1,say:'What about you?'},
 {x:4112,w:6,kind:'end',cam:3864,say:'Your turn. Press Start to play again.'}
];
const I=Object.fromEntries(STEPS.map((step,index)=>[step.kind,index]));
const bossDodges=new Set();
const COINS=[[290,216],[316,216],[372,161],[403,184],[860,216],[1114,216],[1440,216],[1790,216],[2060,166],[2230,165],[2394,152],[2844,161],[2945,146],[3048,156],[3150,176],[3288,216]];
const state={coins:new Set(),stage:0,world:1,cam:0,clock:0,age:0,muted:true,phase:'hold',busy:false,queued:false,route:[],routeTime:0,blockBump:0,pipeTime:0,wipe:0,runFrame:0,justArrived:false,area:'overworld',machine:null,machinePending:null,backQueued:false,bossHits:new Set()};
const player={x:54,y:232,pose:'idle',facing:1,jumpTime:0,skin:'jeremy',visible:true};
let audio=null,masterGain=null,audioUnlocked=false,lastTime=0,accumulator=0,soundMark='';
let musicTheme='',musicPending=false,musicBlocked=false;
const soundtrack=el('music');soundtrack.volume=.14;
const victory=el('victory');victory.volume=.22;
const pipeSound=el('pipe-sound');pipeSound.volume=.3;
function playPipe(){soundtrack.pause();victory.pause();if(state.muted||!audioUnlocked||document.hidden)return;pipeSound.currentTime=0;pipeSound.play().catch(()=>{});}
let endingMusic=false;
try{state.muted=localStorage.getItem('jeremy-sound')!=='on';}catch{}
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function ensureAudio(){if(!audioUnlocked)return false;try{if(!audio||audio.state==='closed'){audio=new (window.AudioContext||window.webkitAudioContext)();masterGain=audio.createGain();masterGain.connect(audio.destination);}masterGain.gain.setValueAtTime(state.muted||document.hidden?0:.38,audio.currentTime);if(audio.state==='suspended')audio.resume().catch(()=>{});return true;}catch{return false;}}
function unlockAudio(){audioUnlocked=true;musicBlocked=false;ensureAudio();musicUpdate();}
function tone(kind){if(state.muted||!audioUnlocked)return;try{if(!ensureAudio())return;const notes={step:[[160,.035]],jump:[[220,.055],[330,.055],[440,.06]],coin:[[988,.07],[1319,.13]],stamp:[[100,.06],[70,.09]],pipe:[[330,.06],[247,.06],[165,.09]],hero:[[392,.065],[523,.065],[784,.14]],lever:[[120,.05],[240,.05],[80,.08]],break:[[70,.035]],win:[[523,.09],[659,.09],[784,.09],[1047,.2]]}[kind]||[];let offset=0;for(const [f,d]of notes){const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='square';oscillator.frequency.setValueAtTime(f,audio.currentTime+offset);gain.gain.setValueAtTime(.028,audio.currentTime+offset);gain.gain.setValueAtTime(.015,audio.currentTime+offset+d*.7);gain.gain.setValueAtTime(0,audio.currentTime+offset+d);oscillator.connect(gain);gain.connect(masterGain);oscillator.start(audio.currentTime+offset);oscillator.stop(audio.currentTime+offset+d+.015);offset+=d;}}catch{/* Sound is optional; presentation never depends on audio support. */}}
function musicUpdate(){
 musicTheme=state.stage===I.title?'title':state.stage>=I.celebrate?'ending':state.stage>=I.boss?'boss':state.area==='dungeon'?'dungeon':'overworld';
 const ending=musicTheme==='ending';
 if(ending!==endingMusic){soundtrack.pause();victory.pause();victory.currentTime=0;endingMusic=ending;musicBlocked=false;}
 const track=ending?victory:soundtrack;
 const inPipe=['machine','pipe','reversePipe'].includes(state.phase);
 if(!inPipe||state.muted||document.hidden)pipeSound.pause();
 if(inPipe){soundtrack.pause();victory.pause();return;}
 if(state.muted||!audioUnlocked||document.hidden||state.stage===I.level){soundtrack.pause();victory.pause();return;}
 if(track.paused&&!track.ended&&!musicPending&&!musicBlocked){
  musicPending=true;
  track.play().catch(error=>{if(error.name!=='AbortError')musicBlocked=true;}).finally(()=>{musicPending=false;});
 }
}
function once(key,kind){if(soundMark!==key){soundMark=key;tone(kind);}}
function announce(){el('announcement').textContent=STEPS[state.stage].say;el('screen').setAttribute('aria-label',STEPS[state.stage].say+' Use Right Arrow or Space for next, Left Arrow for back.');}
function arrive(){state.phase='reveal';state.age=0;state.justArrived=true;player.pose='idle';player.y=STEPS[state.stage].y||232;player.skin='jeremy';player.visible=true;state.world=STEPS[state.stage].w;state.busy=!!STEPS[state.stage].wait;if([I.passport,I.pipe].includes(state.stage))state.queued=false;announce();}
function makeRoute(points){state.route=[];let from={x:player.x,y:player.y};for(const p of points){const to={x:p[0],y:p[1]??232};const duration=Math.max(.18,Math.abs(to.x-from.x)/(p[3]||115));state.route.push({from:{...from},to,duration,arc:p[2]||0});from=to;}state.routeTime=0;state.phase='travel';state.busy=true;}
function next(){unlockAudio();if(state.stage===I.end){restart();return;}if(state.stage===I.level)return;if(state.busy){if(![I.passport,I.pipe].includes(state.stage)){state.queued=true;state.backQueued=false;}return;}startStage(state.stage+1);}
function back(){if(state.stage===I.title)return;if(state.phase==='machine'){state.backQueued=true;state.queued=false;return;}if(state.stage<=I.start){restart();return;}state.queued=false;startStage(state.stage-1,true);}
function restart(){state.coins.clear();state.bossHits.clear();state.stage=I.title;state.world=1;state.area='overworld';state.cam=0;state.age=0;state.phase='hold';state.busy=false;state.queued=false;state.backQueued=false;state.wipe=0;state.blockBump=0;state.machine=null;state.machinePending=null;state.pipePending=false;player.x=54;player.y=232;player.pose='idle';player.skin='jeremy';player.visible=true;player.jumpTime=0;musicTheme='';announce();}
function startStage(index,reverse=false){
 if(index<0||index>=STEPS.length)return;
 bossDodges.clear();
 const old=state.stage;state.stage=index;state.age=0;state.justArrived=false;state.queued=false;state.backQueued=false;state.blockBump=0;state.wipe=0;state.pipeTime=0;state.pipePending=false;state.machinePending=null;state.machine=null;soundMark='';state.bossHits.clear();player.jumpTime=0;player.skin='jeremy';player.visible=true;state.reverse=reverse;
 const s=STEPS[index];
 if(reverse){
  const points=[];
  if(old>=I.pipe&&index===I.masters){state.phase='reversePipe';state.busy=true;playPipe();return;}
  if(old===I.masters&&index===I.work)points.push([2180,232,72],[2100,232,0]);
  else if(old===I.work&&index===I.college)points.push([2020,232,72],[1968,232,0]);
  else if(old===I.passport&&index===I.name)points.push([424,232,0],[340,232,70],[184,232,0]);
  else if(old===I.improve&&index===I.writing)points.push([3190,232,0],[3096,216,60],[2992,200,60]);
  else if(old===I.writing&&index===I.ielts)points.push([2888,216,62]);
  else if(old===I.ielts&&index===I.pipe)points.push([2784,232,66],[2752,232,0]);
  else if(old===I.celebrate&&index===I.battle)points.push([3888,232,0,220],[3824,216,32],[3576,216,0,220],[3500,232,25],[3450,232,0]);
  else points.push([s.x,s.y||232,0,220]);
  makeRoute(points);return;
 }
 if(s.kind==='pipe'){makeRoute([[2368,232,0],[2412,184,64]]);state.pipePending=true;return;}
 if(s.kind==='work'||s.kind==='masters'){
  const x=s.kind==='work'?2052:2212;makeRoute([[x-32,232,0],[x,192,52]]);
  state.machinePending={x,top:192,form:s.kind==='work'?'jeremyWork':'jeremyGraduate',t:0};return;
 }
 if(index===I.passport)makeRoute([[340,232,0],[424,232,70],[648,232,0]]);
 else if(index===I.ielts)makeRoute([[2784,232,0],[2888,216,70]]);
 else if(index===I.writing)makeRoute([[2992,200,70]]);
 else if(index===I.improve)makeRoute([[3096,216,70],[3192,232,64],[3264,232,0]]);
 else if(index===I.celebrate)makeRoute([[3530,232,0],[3576,216,30],[3824,216,0],[3880,232,24],[4112,232,0]]);
 else if(Math.abs(s.x-player.x)>1)makeRoute([[s.x,s.y||232,0]]);
 else arrive();
}
function manualJump(){if(state.stage<=I.level||state.stage===I.end)return;if(state.phase==='hold'||(state.phase==='reveal'&&!state.busy)){if(!player.jumpTime){player.jumpTime=.72;tone('jump');}}}
function travel(dt){const seg=state.route[0];if(!seg){if(state.machinePending){state.machine=state.machinePending;state.machinePending=null;state.phase='machine';playPipe();}else if(state.pipePending){state.pipePending=false;state.phase='pipe';state.pipeTime=0;playPipe();}else arrive();return;}state.routeTime+=dt;const t=clamp(state.routeTime/seg.duration,0,1);player.x=seg.from.x+(seg.to.x-seg.from.x)*t;player.y=seg.from.y+(seg.to.y-seg.from.y)*t-Math.sin(Math.PI*t)*seg.arc;player.facing=seg.to.x<seg.from.x?-1:1;player.pose=seg.arc?'jump':(Math.floor(state.clock*9)%2?'walk1':'walk2');if(seg.arc&&state.routeTime<=dt*1.5)tone('jump');if(t>=1){player.x=seg.to.x;player.y=seg.to.y;state.route.shift();state.routeTime=0;}}
function pipeUpdate(dt){state.pipeTime+=dt;const t=state.pipeTime;if(t<.6){player.y=184+t*48;player.pose='idle';}else if(t<1.05){state.wipe=(t-.6)/.45;}else if(t<1.25){state.wipe=1;state.area='dungeon';player.x=2644;player.y=220;state.cam=2544;state.world=4;}else if(t<1.7){state.wipe=1-(t-1.25)/.45;}else if(t<2.35){player.y=220-(t-1.7)*28/.65;}else{state.wipe=0;makeRoute([[2714,232,48],[2752,232,0]]);}}
function machineUpdate(dt){
 const m=state.machine,previous=m.t;m.t+=dt;const t=m.t;player.x=m.x;player.pose='idle';
 for(const at of [1.05,3.5,4.55])if(previous<at&&t>=at)playPipe();
 if(t<.65){player.skin='jeremy';player.visible=true;player.y=m.top+28*t/.65;}
 else if(t<1.05){player.visible=false;player.y=m.top+28;}
 else if(t<1.7){player.skin=m.form;player.visible=true;player.y=m.top+28*(1-(t-1.05)/.65);}
 else if(t<3.5){player.skin=m.form;player.y=m.top;}
 else if(t<4.15){player.y=m.top+28*(t-3.5)/.65;}
 else if(t<4.55){player.visible=false;player.y=m.top+28;}
 else if(t<5.2){player.skin='jeremy';player.visible=true;player.y=m.top+28*(1-(t-4.55)/.65);}
 else if(t<5.45){player.y=m.top;}
 else{player.skin='jeremy';player.visible=true;state.machine=null;makeRoute([[STEPS[state.stage].x,232,42]]);}
}
function update(dt){
 state.clock+=dt;state.runFrame=Math.floor(state.clock*9)%2;
 if(state.phase==='travel')travel(dt);
 else if(state.phase==='machine')machineUpdate(dt);
 else if(state.phase==='pipe')pipeUpdate(dt);
 else if(state.phase==='reversePipe'){
  state.pipeTime+=dt;state.wipe=state.pipeTime<.35?state.pipeTime/.35:1-(state.pipeTime-.35)/.4;
  if(state.pipeTime>=.35){player.x=2260;player.y=232;state.cam=1872;state.area='overworld';state.world=3;}
  if(state.pipeTime>=.75){state.wipe=0;arrive();}
 }else{
  const previous=state.age;state.age+=dt;const kind=STEPS[state.stage].kind;
  if(kind==='level'&&state.age>=1.8){startStage(I.start);return;}
  if(kind==='name'){
   if(state.age<.8){player.y=232-Math.sin(clamp(state.age/.8,0,1)*Math.PI)*27;player.pose='jump';}else{player.y=232;player.pose='idle';}
   state.blockBump=state.age>.32&&state.age<.65?Math.sin((state.age-.32)/.33*Math.PI)*5:0;
   if(state.age>.34)once('name','coin');
  }
  if(kind==='indonesia'){player.pose='passport';if(state.age>.2)once('passport','stamp');}
  if(['rommel','jobs','pep'].includes(kind)&&state.age>.55)once(kind,'hero');
  if(kind==='battle'){
   const fire=bossEncounter().fire;
   if(fire){const h=heroBattlePosition(fire.hero,state.age);if(Math.abs(fire.x-(h.x+8))<6&&h.y<fire.y-5)bossDodges.add(fire.hero);}
   for(let i=0;i<3;i++){const contact=3.05+i*4.2;if(previous<contact&&state.age>=contact&&!state.bossHits.has(i)){
    const h=heroBattlePosition(i,contact);
    if(bossDodges.has(i)&&h.x+16>3744&&h.x<3808&&Math.abs(h.y-152)<.01){state.bossHits.add(i);tone('lever');}
   }}
   if(previous<12.65&&state.age>=12.65)tone('stamp');
  }
  if(kind==='celebrate'){
   if(state.age<.95){player.y=232-Math.sin(Math.PI*state.age/.95)*48;player.pose='jump';}else{player.y=232;player.pose='idle';}
  }
  if(state.age>=(STEPS[state.stage].wait||0)){state.busy=false;state.phase='hold';}
  if(player.jumpTime){player.jumpTime=Math.max(0,player.jumpTime-dt);player.y=(STEPS[state.stage].y||232)-Math.sin(player.jumpTime/.72*Math.PI)*43;player.pose=player.jumpTime?'jump':'idle';}
  if(!state.busy&&state.backQueued){state.backQueued=false;back();}
  else if(!state.busy&&state.queued){state.queued=false;next();}
 }
 if(!['pipe','reversePipe'].includes(state.phase)){
  let desired=STEPS[state.stage].cam??player.x-168;
  if(state.stage===I.celebrate&&state.phase==='travel')desired=clamp(player.x-220,3424,3864);
  if(state.phase==='travel'&&[I.college,I.work,I.masters].includes(state.stage))desired=clamp(player.x-140,Math.min(state.cam,1872),1872);
  desired=clamp(desired,state.area==='dungeon'?2544:0,state.area==='dungeon'?3864:2032);
  state.cam+=clamp(desired-state.cam,-210*dt,210*dt);
  if(Math.abs(desired-state.cam)<.05)state.cam=desired;
 }
 if(state.phase==='travel')state.world=state.area==='overworld'?(player.x<530?1:player.x<1830?2:3):(player.x<3370?4:player.x<3990?5:6);
 if(state.stage>I.start)for(let i=0;i<COINS.length;i++){const[cx,cy]=COINS[i];if(!state.coins.has(i)&&Math.abs(player.x+8-cx-4)<14&&player.y>=cy-10&&player.y-24<=cy){state.coins.add(i);tone('coin');}}
 musicUpdate(dt);el('back').disabled=state.stage===I.title;
}
function ready(){return state.phase==='hold'||state.phase==='reveal';}
function caption(lines,y=85,scale=2,color=C.white){for(let i=0;i<lines.length;i++)r.text(lines[i],256,y+i*(7*scale+8),scale,color,'center',true);}
function worldText(lines,x,y,scale=1,color=C.white){lines.forEach((line,i)=>r.text(line,r.wx(x),y+i*(scale*7+6),scale,color,'center',true));}
function drawCoins(){for(let i=0;i<COINS.length;i++){const [x,y]=COINS[i];if(!state.coins.has(i)&&x-state.cam>-16&&x-state.cam<512)r.sprite('coin',r.wx(x),y,Math.floor(state.clock*6)%3===0?'spin':'idle');}}
function drawPlane(){
 if(state.stage<I.japan||state.stage>I.stamps||state.area!=='overworld')return;
 const x=r.wx(930+(state.clock*20)%950);r.rect(x,103,24,3,C.white);r.rect(x+12,97,4,15,C.white);r.rect(x+2,100,4,5,C.white);r.rect(x+21,105,3,2,C.white);
 for(let j=0;j<4;j++)r.rect(x-8-j*10,104,4,1,C.white);
 if(state.stage===I.stamps&&ready()){
  caption(['I HAVE VISITED MANY OTHER COUNTRIES.'],75,1);
  ['VISITED','EXPLORED','NEXT?'].forEach((label,j)=>{const sx=r.wx(1712+j*100);r.rect(sx,126,76,32,C.cream);r.rect(sx+2,128,72,28,j===2?C.gold:C.red);r.rect(sx+4,130,68,24,C.cream);r.text(label,sx+38,138,1,C.brown,'center');});
  r.text('MORE JOURNEYS AHEAD',r.wx(1848),174,1,C.white,'center',true);
 }
}
function drawName(){if(state.stage!==I.name||!ready())return;const a=state.age;if(a<.36)return;const t=clamp((a-.36)/.5,0,1);const bounce=t===1&&a<1.4?Math.abs(Math.sin((a-.86)*10))*3:0;r.text('JEREMY',r.wx(192),161-41*t-bounce,3,C.gold,'center',true);if(a>1.1)r.dialogue(['MY NAME IS JEREMY.'],94,64,324,2);}
function drawPassport(){
 if(!ready())return;
 if(state.stage===I.passport){r.dialogue(['WHERE ARE YOU FROM?'],96,78,320,2);r.text('NEXT TO ANSWER',256,120,1,C.gold,'center',true);return;}
 if(state.stage!==I.indonesia)return;
 r.sprite('passport',r.wx(player.x)+12,213,'idle');r.flag(609,151-Math.min(18,state.age*36),'id');
 const x=r.wx(581),pulse=state.age<.3?2:0;r.rect(x,62-pulse,168,32,C.white);r.rect(x+2,64-pulse,164,28,C.sky);r.text('INDONESIA',x+84,70-pulse,3,C.white,'center');
 if(state.age>.35)r.dialogue(['I AM FROM INDONESIA.'],72,103,336,2);
}
function drawCollege(){
 if(state.stage<I.college||state.stage>I.pipe||state.area!=='overworld')return;
 if(state.phase==='machine'){
  const t=state.machine.t;if(t>=1.7&&t<4.15){r.dialogue([state.stage===I.work?'BACK TO WORK.':"MASTER'S."],120,99,272,2);r.text(state.stage===I.work?'7 YEARS OF WORK':"A MASTER'S DEGREE",256,143,1,C.white,'center',true);}
 }
}
function drawWriting(){
 if(state.area!=='dungeon'||state.world!==4)return;
 if(state.stage===I.pipe&&ready()){r.dialogue(['WHAT ENGLISH SKILL','DO I WANT TO IMPROVE?'],60,62,392,2);r.text('NEXT TO DISCOVER',256,127,1,C.gold,'center');}
 if((state.stage===I.ielts&&ready())||state.stage===I.writing){r.text('IELTS: 7.5',r.wx(2860),83,2,C.white,'center',true);}
 if(state.stage===I.writing&&ready())r.text('WRITING: 6.5',r.wx(3040),111,2,C.gold,'center',true);
 if(state.stage===I.improve&&ready())r.dialogue(['IN ENGLISH, I WANT','TO IMPROVE MY WRITING.'],56,65,400,2);
 for(const x of [2928,3134]){const y=222-Math.abs(Math.sin(state.clock*1.65+x))*46;r.rect(r.wx(x)+2,y,4,10,C.lava);r.rect(r.wx(x),y+3,8,6,C.gold);r.rect(r.wx(x)+3,y+4,2,4,C.cream);}
}
const heroKeys=['rommel','jobs','pep'];
const heroNames=['ERWIN ROMMEL','STEVE JOBS','JOSEP "PEP" GUARDIOLA'];
const heroWords=['GENERAL OF WW2 (DESERT FOX)','CO-FOUNDER OF APPLE','LEGENDARY FOOTBALL COACH'];
function heroBattlePosition(i,age){
 const t=age-i*4.2,start=3616-i*24,walk=state.runFrame?'walk1':'walk2';
 if(t<0)return{x:start,y:216,pose:'idle'};
 if(t<.45)return{x:start+(3656-start)*t/.45,y:216,pose:walk};
 // Fire is already in flight for .3 seconds before the hero reacts.
 if(t>=1.2&&t<1.92)return{x:3656,y:216-Math.sin((t-1.2)/.72*Math.PI)*48,pose:'jump'};
 if(t>=2&&t<2.3)return{x:3656+48*(t-2)/.3,y:216,pose:walk};
 if(t>=2.3&&t<=3.05){const u=clamp((t-2.3)/.75,0,1);return{x:3704+64*u,y:216-64*u-Math.sin(Math.PI*u)*56,pose:'jump'};}
 if(t>3.05&&t<3.75){const u=(t-3.05)/.7;return{x:3768+76*u,y:152+64*u-Math.sin(Math.PI*u)*76,pose:'jump'};}
 if(t>=3.75){const u=clamp((t-3.75)/.4,0,1),x=3844+(3910-i*20-3844)*u;return{x,y:x<3856?216:232,pose:u<1?walk:'idle'};}
 return{x:3656,y:216,pose:'idle'};
}
function bossEncounter(){
 if(state.stage!==I.battle||!ready())return{fire:null,preparing:false,flipped:false};
 const t=state.age,i=Math.min(2,Math.floor(t/4.2)),local=t-i*4.2,defeated=state.bossHits.size===3;
 const elapsed=local-.9,x=3738-elapsed*150;
 const fire=!defeated&&elapsed>=0&&x>=3630?{x,y:171+36*clamp((3738-x)/74,0,1),hero:i}:null;
 return{fire,preparing:!defeated&&local>=.45&&local<1.08,flipped:defeated&&t>=11.63};
}
function heroPosition(i){
 const arrival=I.rommel+i,start=3500-i*12,end=3616-i*24;
 if(state.stage<arrival||state.stage>=I.celebrate)return null;
 if(state.stage===arrival){
  if(!ready())return null;const a=state.age;if(a<.48)return null;
  if(a<1.12){const p=(a-.48)/.64;return{x:start,y:70+162*p*p,pose:'jump'};}
  const t=clamp((a-1.12)/1.05,0,1),x=start+(end-start)*t,j=clamp((x-3520)/56,0,1);
  return{x,y:(x<3552?232:216)-Math.sin(j*Math.PI)*18,pose:j>0&&j<1?'jump':t<1?(state.runFrame?'walk1':'walk2'):'idle'};
 }
 if(state.stage===I.battle){if(state.age>13.25||(state.age>12.95&&Math.floor(state.age*12)%2))return null;return heroBattlePosition(i,state.age);}
 return{x:end,y:216,pose:'idle'};
}
function drawBridge(){if(state.area!=='dungeon'||state.cam<3000)return;for(let i=0;i<19;i++){const x=r.wx(3552+i*16);r.rect(x,216,15,8,C.brown);r.rect(x,216,15,2,C.cream);r.rect(x+2,221,11,1,C.brick);}}
function drawBoss(){
 if(state.area!=='dungeon'||state.cam<3100||state.stage>I.battle||(state.stage===I.battle&&state.reverse&&state.phase==='travel'))return;
 const battle=state.stage===I.battle,encounter=bossEncounter();let x=3744+(battle?0:Math.floor(state.clock*.8)%3-1),y=216,pose='idle';
 if(battle){
  const since=state.age-(3.05+(state.bossHits.size-1)*4.2);
  if(state.bossHits.size&&since<.32){x+=6+(Math.floor(since*25)%2?2:-2);r.text('*',r.wx(3776),133,2,C.gold,'center');}
  if(state.bossHits.size===3){const fall=Math.max(0,state.age-11.45);y+=190*fall*fall-95*fall;x+=Math.min(18,fall*20);}
  if(state.age>12.65)return;
 }
 r.ctx.save();r.ctx.beginPath();r.ctx.rect(0,45,512,219);r.ctx.clip();
 if(encounter.flipped){r.ctx.translate(0,Math.round(2*y-64));r.ctx.scale(1,-1);}
 r.sprite('boss',r.wx(x),y,pose,true,2);r.ctx.restore();
 if(encounter.preparing){r.rect(r.wx(x),y-53,13,7,C.black);r.rect(r.wx(x)+3,y-53,3,2,C.cream);r.rect(r.wx(x)+8,y-48,3,2,C.cream);}
 if(encounter.fire){const f=encounter.fire,fx=r.wx(f.x),fy=Math.round(f.y),flicker=Math.floor(state.clock*12)%2;
  r.rect(fx-7,fy-3,14,6,C.red);r.rect(fx-4,fy-4,9,8,C.gold);r.rect(fx-3,fy-2,5,4,C.cream);r.rect(fx+7,fy-2+flicker*2,6,3,C.lava);
 }
}
function drawHeroes(){if(state.area!=='dungeon'||state.stage<I.rommel||state.stage>=I.celebrate)return;for(let i=0;i<3;i++){const p=heroPosition(i);if(p)r.sprite(heroKeys[i],r.wx(p.x),p.y,p.pose);}}
function drawHeroCaption(){if(state.stage<I.rommel||state.stage>I.pep||!ready()||state.age>3.05)return;const i=state.stage-I.rommel;caption([heroNames[i]],69,i===2?2:3,C.gold);r.text(heroWords[i],256,104,1,C.white,'center');}
function drawEnding(){
 if(state.stage<I.celebrate)return;
 if(state.stage===I.stories&&ready())caption(['THESE ARE MY STORIES...'],101,2);
 if(state.stage===I.question&&ready()){caption(['THESE ARE MY STORIES...'],82,1);caption(['WHAT ABOUT YOU?'],111,3,C.gold);}
 if(state.stage===I.end){const a=state.age;if(a<.5){const w=Math.ceil(a/.5*256/8)*8;r.rect(0,45,w,219,'#000');r.rect(512-w,45,w,219,'#000');}else{r.rect(0,0,512,264,'#000');r.text('YOUR TURN',256,89,4,C.white,'center');if(Math.floor(state.clock*1.6)%2===0)r.text('PRESS START',256,146,2,C.gold,'center');r.sprite('jeremy',248,214,'idle');r.text('SPACE / ENTER',256,239,1,C.stone,'center');}}
}
function draw(){
 const kind=STEPS[state.stage].kind;
 const view={...state,kind,nameRevealed:state.stage>I.name||(state.stage===I.name&&ready()&&state.age>.36),checkpointOpen:state.stage>=I.japan,locations:{my:state.stage>=I.malaysia,jp:state.stage>=I.japan,cn:state.stage>=I.china}};
 if(kind==='level'){r.time=state.clock;r.rect(0,0,512,288,'#000');r.text('WORLD 1-1',256,88,3,C.white,'center');r.sprite('jeremy',168,159,'idle');r.text('JEREMY × 3',274,141,2,C.white,'center');r.footer(view);return;}
 r.scenery(view);
 if(kind==='title'){
  r.rect(0,0,512,264,'#a4acfc');
  r.cloud(20,17);r.cloud(454,9);r.cloud(69,155);
  r.hill(-18,232,116);r.hill(308,232,84);r.bush(222,232);r.bush(253,232);r.bush(465,232);
  r.ground(0,512);r.block(443,52);r.block(224,151);
  for(let j=0;j<5;j++){if(j%2)r.block(390+j*16,153);else r.brick(390+j*16,153);}
  // A bolted orange title sign, with tall cream bitmap letters and a hard black shadow.
  r.rect(97,17,320,112,C.black);r.rect(96,16,320,112,'#e45c10');
  r.rect(96,16,320,2,C.cream);r.rect(96,16,2,112,C.cream);
  for(const x of [100,408])for(const y of [21,120]){r.rect(x,y,3,3,C.black);r.rect(x,y,2,2,C.cream);}
  r.ctx.save();r.ctx.translate(0,30);r.ctx.scale(1,2);
  r.text('SUPER',117,2,3,C.black);r.text('SUPER',114,0,3,C.cream);r.ctx.restore();
  r.ctx.save();r.ctx.translate(0,77);r.ctx.scale(1,1.5);
  r.text("JEREMY BRO'S",259,2,4,C.black,'center');r.text("JEREMY BRO'S",256,0,4,C.cream,'center');r.ctx.restore();
  if(Math.floor(state.clock*1.5)%2===0)r.text('PRESS START',256,190,2,C.white,'center',true);
  r.sprite('jeremy',162,232,'idle');r.footer(view);return;
 }
 drawCoins();drawPlane();drawBridge();drawCollege();drawBoss();drawHeroes();
 if(player.visible&&(state.stage!==I.end||state.age<.5)){
  const clipping=state.phase==='machine'||state.phase==='pipe';
  if(clipping){r.ctx.save();r.ctx.beginPath();r.ctx.rect(0,44,512,(state.machine?state.machine.top:state.area==='overworld'?184:192)-44);r.ctx.clip();}
  r.sprite(player.skin,r.wx(player.x),player.y,player.pose,player.facing<0);
  if(clipping)r.ctx.restore();
 }
 if(state.phase==='machine')r.pipe(state.machine.x-12,state.machine.top);
 if(state.phase==='pipe')r.pipe(state.area==='overworld'?2400:2632,state.area==='overworld'?184:192);
 drawName();drawPassport();drawWriting();
 if([I.malaysia,I.japan,I.china].includes(state.stage)&&ready()){caption(['I HAVE ALSO LIVED IN...'],78,1);r.text(kind,256,96,2,C.white,'center',true);}
 if(state.stage===I.boss&&ready())caption(['MY HEROES'],77,3);
 drawHeroCaption();r.hud(view);drawEnding();
 if(state.wipe){const w=Math.ceil(clamp(state.wipe,0,1)*256/8)*8;r.rect(0,0,w,264,'#000');r.rect(512-w,0,w,264,'#000');}
 r.footer(view);if(state.queued||state.backQueued)r.text(state.backQueued?'BACK QUEUED':'NEXT QUEUED',256,252,1,C.gold,'center',true);
}
function toggleSound(){state.muted=!state.muted;unlockAudio();el('sound').textContent=state.muted?'UNMUTE':'MUTE';el('sound').setAttribute('aria-pressed',String(!state.muted));el('sound').setAttribute('aria-label',(state.muted?'Unmute':'Mute')+' music and sound (M)');try{localStorage.setItem('jeremy-sound',state.muted?'off':'on');}catch{}if(!state.muted)tone('coin');}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{el('announcement').textContent='Use your browser fullscreen control to fill the projector.';}}
el('next').addEventListener('click',next);el('back').addEventListener('click',back);el('jump').addEventListener('click',manualJump);el('sound').addEventListener('click',toggleSound);el('full').addEventListener('click',fullscreen);
window.addEventListener('keydown',event=>{const key=event.key;if(['ArrowRight','ArrowLeft','ArrowUp',' ','Enter','m','M','f','F'].includes(key)){if(event.target?.tagName==='BUTTON'&&(key===' '||key==='Enter'))return;event.preventDefault();if(event.repeat)return;if(key==='ArrowRight'||key===' '||key==='Enter')next();if(key==='ArrowLeft')back();if(key==='ArrowUp')manualJump();if(key.toLowerCase()==='m')toggleSound();if(key.toLowerCase()==='f')fullscreen();}});
document.addEventListener('visibilitychange',()=>{lastTime=0;accumulator=0;musicUpdate();if(audio)ensureAudio();});
window.addEventListener('pagehide',()=>{soundtrack.pause();victory.pause();pipeSound.pause();if(audio)audio.close().catch(()=>{});});
function frame(now){if(!lastTime)lastTime=now;accumulator+=Math.min((now-lastTime)/1000,.1);lastTime=now;while(accumulator>=1/60){update(1/60);accumulator-=1/60;}draw();requestAnimationFrame(frame);}
/* Small control surface also used by the offline simulation checks. */
window.JeremyGame=Object.freeze({next,back,jump:manualJump,restart,getState:()=>({stage:state.stage,world:state.world,phase:state.phase,busy:state.busy,queued:state.queued,backQueued:state.backQueued,age:state.age,camera:state.cam,area:state.area,wipe:state.wipe,machine:state.machine?{...state.machine}:null,player:{...player},heroes:heroKeys.map((_,i)=>heroPosition(i)),encounter:bossEncounter(),bossHits:state.bossHits.size,coins:state.coins.size,muted:state.muted,musicTheme,kind:STEPS[state.stage].kind}),steps:STEPS.map(({kind,say})=>({kind,say}))});
el('sound').textContent=state.muted?'UNMUTE':'MUTE';el('sound').setAttribute('aria-label',(state.muted?'Unmute':'Mute')+' music and sound (M)');el('sound').setAttribute('aria-pressed',String(!state.muted));canvas.tabIndex=0;canvas.focus({preventScroll:true});announce();requestAnimationFrame(frame);
})();
