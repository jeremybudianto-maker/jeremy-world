/* Exercise the existing fixed-step game, renderer and input handlers without a browser. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let nextFrame,now=100,rects=0,game,rendered=[],notes=0,masterVolume=0,bossDraws=0;
const events={},nodes=new Map();
const ctx={fillRect(...a){if(!a.every(Number.isFinite))throw Error('Non-finite drawing coordinates');rects++;},drawImage(img,x,y,w,h){assert.equal(img.src,'assets/bowser.png');assert.equal(w,64);assert.equal(h,64);bossDraws++;},translate(){},scale(){},save(){},restore(){},beginPath(){},rect(){},clip(){}};
function node(id){if(!nodes.has(id))nodes.set(id,{id,tagName:'DIV',textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){events[id+':'+k]=v;},getContext(){return ctx;},focus(){}});return nodes.get(id);}
const document={hidden:false,getElementById:node,querySelector:s=>node(s.slice(1)),addEventListener(k,v){events['document:'+k]=v;},documentElement:{requestFullscreen(){document.fullscreenElement=this;return Promise.resolve();}},exitFullscreen(){document.fullscreenElement=null;return Promise.resolve();}};
class FakeAudio {
 constructor(){this.state='running';this.currentTime=0;this.destination={};}
 createGain(){return {gain:{setValueAtTime(v){masterVolume=v;}},connect(){}};}
 createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},start(){notes++;},stop(){}};}
 resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
const window={AudioContext:FakeAudio,addEventListener(k,v){events['window:'+k]=v;}};
const music=node('music');Object.assign(music,{paused:true,play(){this.paused=false;return {catch(){return {finally(fn){fn();}}}};},pause(){this.paused=true;}});
const pipeSound=node('pipe-sound');Object.assign(pipeSound,{paused:true,plays:0,currentTime:0,play(){this.paused=false;this.plays++;return {catch(){}};},pause(){this.paused=true;}});
const victory=node('victory');Object.assign(victory,{paused:true,ended:false,plays:0,currentTime:0,play(){this.paused=false;this.plays++;return {catch(){return {finally(fn){fn();}}}};},pause(){this.paused=true;}});
class FakeImage {constructor(){this.complete=true;this.naturalWidth=500;}}
const sandbox={window,document,Image:FakeImage,console,localStorage:{getItem(){return null;},setItem(){}},requestAnimationFrame(cb){nextFrame=cb;},Math,Object,String,Number};
vm.createContext(sandbox);
for(const file of ['font','sprites','renderer','game']){vm.runInContext(fs.readFileSync('public/play/'+file+'.js','utf8'),sandbox,{filename:file+'.js'});Object.assign(sandbox,window);}
game=window.JeremyGame;
const R=window.JeremyRenderer.prototype;
const realText=R.text;R.text=function(value,...args){rendered.push(String(value).toUpperCase());return realText.call(this,value,...args);};
for(const name of ['wall','lava','torch']){const real=R[name];R[name]=function(...args){assert.equal(game.getState().area,'dungeon','Dungeon objects never render outside');return real.apply(this,args);};}
const realBrick=R.brick;R.brick=function(x,y,...args){const worldX=x+this.cam;assert(!(worldX>3553&&worldX<3854&&y>=224),'No continuous floor is drawn beneath the suspended bridge');return realBrick.call(this,x,y,...args);};
const realDialogue=R.dialogue;R.dialogue=function(lines,x,y,width,scale){for(const line of lines)assert((line.length*6-1)*scale<=width-18,'Dialogue fits inside its box');return realDialogue.call(this,lines,x,y,width,scale);};
function tick(n=1,check){for(let i=0;i<n;i++){rendered=[];now+=1000/60;nextFrame(now);if(check)check(game.getState());}}
function settle(check){for(let i=0;i<1500;i++){tick(1,check);const s=game.getState();if(!s.busy&&s.phase==='hold'){tick(30,check);return;}}throw Error('Did not settle: '+JSON.stringify(game.getState()));}
function advanceTo(kind){while(game.getState().kind!==kind){game.next();settle();}}
function key(k,repeat=false){events['window:keydown']({key:k,repeat,preventDefault(){}});}
tick(60);assert.equal(game.getState().kind,'title');assert(rendered.includes("JEREMY BRO'S"));
key('m');tick(60);assert.equal(music.paused,false,'MP3 plays after an audio gesture');assert.equal(music.volume,.14);assert.equal(game.getState().musicTheme,'title');
key('m');const silent=notes;tick(80);assert.equal(notes,silent,'Mute stops both music and new sound effects');assert.equal(masterVolume,0);
assert.equal(music.paused,true,'Mute pauses the supplied MP3');
key('m');game.next();tick(60);assert.equal(game.getState().kind,'level');assert(rendered.includes('WORLD 1-1'));assert(rendered.includes('JEREMY × 3'));
game.next();tick(55);assert.equal(game.getState().kind,'start','The level card completes before the first level opens');settle();
const summaries=[],forms=[];
for(let i=3;i<game.steps.length;i++){
 const expected=game.steps[i].kind;game.next();
 if(['passport','pipe'].includes(expected))game.next(); // An early queued click must not answer a question.
 let hiddenNormal=false,costumeSeen=false,hiddenCostume=false,normalReturned=false,previousSkin='jeremy',previousVisible=true,previousY=232;
 const jumped=[false,false,false],passedUnder=[false,false,false],waited=[false,false,false];let lastHits=0,flipped=false;
 settle(s=>{
  assert(Number.isFinite(s.camera));assert(Number.isFinite(s.player.y));
  if(s.area==='overworld')assert(s.camera<=2032.01);else assert(s.camera>=2543.99);
  if(s.phase==='machine'){
   assert.equal(music.paused,true,'Music pauses during pipe transformations');assert(pipeSound.plays>0,'Supplied pipe recording plays');
   if(s.player.skin!==previousSkin)assert(!previousVisible||previousY-24>=192,'Costume changes happen entirely inside the pipe');
   if(!s.player.visible&&s.player.skin==='jeremy')hiddenNormal=true;
   if(s.player.skin!=='jeremy'&&s.player.y<=193){assert(hiddenNormal);costumeSeen=true;}
   if(!s.player.visible&&s.player.skin!=='jeremy')hiddenCostume=true;
   if(hiddenCostume&&s.player.skin==='jeremy'&&s.player.visible)normalReturned=true;
  }else assert.equal(s.player.skin,'jeremy','Jeremy wears his normal outfit outside a transformation');
  previousSkin=s.player.skin;previousVisible=s.player.visible;previousY=s.player.y;
  if(expected==='battle'){
   assert.equal(s.player.x,3450,'Jeremy does not fight');
   s.heroes.forEach((h,j)=>{if(h&&h.x>3650&&h.y<180)jumped[j]=true;});
   const f=s.encounter.fire;
   if(f){const h=s.heroes[f.hero];if(f.x>3710){assert.equal(h.pose,'idle','Hero waits after the fire launches');waited[f.hero]=true;}if(Math.abs(f.x-(h.x+8))<6){assert(h.y<f.y-5,'Fire passes below the airborne hero');passedUnder[f.hero]=true;}}
   if(s.bossHits>lastHits){assert.equal(s.bossHits,lastHits+1);assert(passedUnder[lastHits]);const h=s.heroes[lastHits];assert(h.x>3744&&h.x<3808&&Math.abs(h.y-152)<8,'Hit registers at the head stomp after dodging');lastHits=s.bossHits;}
   if(s.age<3.05)assert.equal(s.bossHits,0,'Dodging alone awards no hit');
   if(s.bossHits===3)assert.equal(f,null,'Defeated Bowser cannot fire');
   if(s.encounter.flipped)flipped=true;
  }
 });
 const s=game.getState();assert.equal(s.kind,expected);assert.equal(s.stage,i);
 if(['work','masters'].includes(expected)){assert.equal(music.paused,false,'Music resumes after exiting');assert.equal(pipeSound.paused,true);assert(!rendered.some(t=>t.includes('I HAVE BEEN WORKING')||t.includes('FOR THE PAST 7 YEARS')||t.includes('I WANT TO PURSUE')),'Post-pipe statements removed');}
 if(['work','masters'].includes(expected)){assert(hiddenNormal&&costumeSeen&&hiddenCostume&&normalReturned,'Both full disappear/emerge cycles finish');forms.push(expected);}
 if(['passport','pipe'].includes(expected)){
  tick(540);assert.equal(game.getState().kind,expected,'Questions wait indefinitely for a fresh command');
  assert(!rendered.some(t=>expected==='passport'?t.includes('INDONESIA'):t.includes('WRITING')||t.includes('IELTS')),'The answer is not revealed early');
 }
 if(expected==='battle'){assert(jumped.every(Boolean)&&passedUnder.every(Boolean)&&waited.every(Boolean),'All three heroes dodge late');assert(flipped,'Bowser flips after the third hit');assert.equal(s.bossHits,3);tick(180);assert.equal(game.getState().bossHits,3,'No duplicate hits');assert(s.heroes.every(h=>h===null),'The allies disappear before Jeremy advances');}
 if(expected==='celebrate')assert(s.heroes.every(h=>h===null));
 summaries.push(expected);
}
assert.equal(game.getState().kind,'end');assert.equal(game.getState().musicTheme,'ending');
assert(bossDraws>0,'The supplied Bowser image renders in the boss encounter');
assert.equal(music.paused,true,'Overworld music stops for the ending');assert.equal(victory.plays,1,'Victory plays once across ending beats');
document.hidden=true;events['document:visibilitychange']();assert.equal(victory.paused,true);
document.hidden=false;events['document:visibilitychange']();assert.equal(victory.paused,false);
key('m');assert.equal(victory.paused,true);key('m');assert.equal(victory.paused,false);
victory.ended=true;victory.paused=true;const victoryPlays=victory.plays;tick(120);assert.equal(victory.plays,victoryPlays,'Completed victory track does not loop');
assert.match(fs.readFileSync('public/play/index.html','utf8'),/src="assets\/mario-theme.mp3" loop/);
for(let i=game.steps.length-2;i>=3;i--){game.back();settle();assert.equal(game.getState().stage,i,'Every story beat is reversible');}
game.back();assert.equal(game.getState().kind,'start');settle();
// Rewind during a transformation waits for the normal outfit to return.
game.restart();advanceTo('college');game.next();while(game.getState().phase!=='machine')tick();tick(130);assert.equal(game.getState().player.skin,'jeremyWork');
game.back();assert(game.getState().backQueued);settle();assert.equal(game.getState().kind,'college');assert.equal(game.getState().player.skin,'jeremy');
// Rewind a pipe before and after the scene switch.
advanceTo('masters');game.next();tick(10);game.back();settle();assert.equal(game.getState().kind,'masters');assert.equal(game.getState().player.x,2260);assert.equal(game.getState().area,'overworld');
game.next();while(game.getState().area!=='dungeon')tick();game.back();settle();assert.equal(game.getState().area,'overworld');assert.equal(game.getState().player.x,2260);
const before=game.getState().stage;key('ArrowRight',true);assert.equal(game.getState().stage,before);
game.restart();game.next();settle();game.jump();tick(12);assert(game.getState().player.y<232);tick(80);assert.equal(game.getState().player.y,232);
console.log(JSON.stringify({passed:true,storyBeats:game.steps.length,costumeCycles:forms,manualQuestionGates:true,dungeonIsolation:true,threeHeroStomps:true,noFloorBelowBridge:true,endingAlone:true,musicAndMute:true,forwardAndBack:true,finiteDrawCalls:rects,sequence:summaries},null,2));
