/* The world is a 512 x 288 framebuffer with a bundled user-provided boss image. */
(function(global){
'use strict';
const bowser=new Image();bowser.src='assets/bowser.png';
const C={sky:'#5c94fc',white:'#fcfcfc',black:'#101018',brick:'#c84c0c',light:'#fcbcb0',brown:'#7c2c00',gold:'#f8b800',cream:'#fce4a0',green:'#00a800',lime:'#b8f818',darkgreen:'#005800',stone:'#747474',darkstone:'#343434',lava:'#e43800',red:'#d82800',blue:'#0058f8'};
class Renderer {
 constructor(canvas){this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;this.cam=0;this.time=0;}
 rect(x,y,w,h,color){this.ctx.fillStyle=color;this.ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 text(value,x,y,s=1,color=C.white,align='left',shadow=false){const str=String(value).toUpperCase().replace(/[’‘]/g,"'");const width=(str.length*6-1)*s;if(align==='center')x-=width/2;if(align==='right')x-=width;if(shadow)this.text(str,x+1,y+1,s,C.black);this.ctx.fillStyle=color;[...str].forEach((char,i)=>{const rows=global.PixelFont[char]||global.PixelFont['?'];rows.forEach((row,dy)=>{for(let dx=0;dx<5;dx++)if(row[dx]==='1')this.ctx.fillRect(Math.round(x+i*6*s+dx*s),Math.round(y+dy*s),s,s);});});}
 sprite(name,x,foot,pose='idle',flip=false,scale=1){const asset=global.JeremySprites[name];if(!asset)return;if((pose==='idle'||pose==='passport')&&['jeremy','jeremyWork','jeremyGraduate','officer','rommel','jobs','pep','boss'].includes(name))foot-=Math.floor(this.time*3)%4===2?1:0;
  if(name==='boss'&&bowser.complete&&bowser.naturalWidth){
   const size=32*scale;this.ctx.save();this.ctx.translate(Math.round(x)+(flip?0:size),Math.round(foot-size));
   // The supplied image already faces left, unlike the fallback pixel grid.
   if(!flip)this.ctx.scale(-1,1);this.ctx.drawImage(bowser,0,0,size,size);this.ctx.restore();return;
  }
  const rows=asset.frames[pose]||asset.frames.idle||Object.values(asset.frames)[0];rows.forEach((row,y)=>{[...row].forEach((ch,dx)=>{if(ch!=='.')this.rect(x+(flip?asset.width-1-dx:dx)*scale,foot-asset.height*scale+y*scale,scale,scale,asset.palette[ch]);});});}
 wx(x){return Math.round(x-this.cam)}
 brick(x,y,dark=false){const a=dark?C.stone:C.brick,b=dark?C.darkstone:C.brown,c=dark?'#bcbcbc':C.light;this.rect(x,y,16,16,b);this.rect(x,y,15,7,a);this.rect(x+1,y+1,14,1,c);this.rect(x,y+8,7,7,a);this.rect(x+8,y+8,7,7,a);this.rect(x+1,y+9,5,1,c);this.rect(x+9,y+9,5,1,c);}
 ground(from,to,dark=false,top=232){for(let x=Math.floor(Math.max(from,this.cam-16)/16)*16;x<Math.min(to,this.cam+528);x+=16){for(let y=top;y<264;y+=16)this.brick(this.wx(x),y,dark);}}
 block(x,y,used=false,bump=0){x=this.wx(x);y-=bump;this.rect(x,y,16,16,C.black);this.rect(x+1,y+1,14,14,used?C.brown:C.gold);this.rect(x+2,y+2,12,1,used?C.brick:C.cream);if(!used)this.text('?',x+5,y+4,1,C.brown);for(const dx of [2,12])for(const dy of [2,12])this.rect(x+dx,y+dy,1,1,C.brown);}
 pipe(x,top=192){x=this.wx(x);this.rect(x+3,top+9,34,232-top-9,C.black);this.rect(x+5,top+10,30,232-top-10,C.green);this.rect(x+7,top+10,5,232-top-10,C.lime);this.rect(x+29,top+10,5,232-top-10,C.darkgreen);this.rect(x,top,40,11,C.black);this.rect(x+1,top+1,38,8,C.green);this.rect(x+3,top+1,7,8,C.lime);this.rect(x+31,top+1,6,8,C.darkgreen);}
 cloud(x,y){x=Math.round(x);this.rect(x+10,y,22,4,C.white);this.rect(x+5,y+4,34,5,C.white);this.rect(x,y+9,46,10,C.white);this.rect(x+5,y+19,36,3,C.white);this.rect(x+11,y+9,2,3,C.sky);this.rect(x+29,y+9,2,3,C.sky);}
 hill(x,y,w=100){const steps=Math.floor(w/16);for(let j=0;j<steps;j++){const inset=j*8;this.rect(x+inset,y-j*8,w-inset*2,8,C.darkgreen);}this.rect(x+w/2-9,y-20,2,7,C.black);this.rect(x+w/2+5,y-20,2,7,C.black);}
 bush(x,y){this.rect(x,y-9,52,9,C.green);this.rect(x+5,y-16,42,10,C.green);this.rect(x+14,y-21,19,10,C.green);for(let j=0;j<4;j++)this.rect(x+7+j*12,y-6,4,2,C.darkgreen);}
 sign(x,y,label,w){x=this.wx(x);w=w||label.length*6+12;this.rect(x+w/2-2,y+14,4,232-y-14,C.brown);this.rect(x-1,y-1,w+2,16,C.black);this.rect(x,y,w,14,C.cream);this.text(label,x+w/2,y+4,1,C.brown,'center');}
 flag(x,y,country){
  x=this.wx(x);if(x<-40||x>512)return;this.rect(x,y,2,50,C.white);
  for(let px=0;px<28;px++)for(let py=0;py<16;py++){
   let color=C.white;
   if(country==='id'&&py<8)color=C.red;
   if(country==='jp'&&Math.pow(px-14,2)+Math.pow(py-8,2)<20)color=C.red;
   if(country==='cn'){color=C.red;if((Math.abs(px-6)+Math.abs(py-5)<4)||([[12,2],[15,5],[15,9],[12,12]].some(([sx,sy])=>px===sx&&py===sy)))color=C.gold;}
   if(country==='my'){
    if(py<14&&py%2===0)color=C.red;
    if(px<14&&py<9){color=C.blue;if(Math.pow(px-5,2)+Math.pow(py-4,2)<11&&Math.pow(px-7,2)+Math.pow(py-3,2)>7)color=C.gold;if(px===10&&py>=2&&py<=6||py===4&&px>=8&&px<=12)color=C.gold;}
   }
   const wave=country==='id'?0:[0,1,1,0,-1,-1,0,0][(Math.floor(this.time*3)+Math.floor(px/4))%8];
   this.rect(x+2+px,y+py+wave,1,1,color);
  }
 }
 castle(x,y=152,dark=false){x=this.wx(x);const c=dark?C.stone:C.brick;for(let row=0;row<5;row++)for(let col=0;col<5;col++)this.brick(x+col*16,y+row*16,dark);for(let j=0;j<3;j++)this.rect(x+j*32,y-8,16,8,c);this.rect(x+28,y+44,24,36,C.black);this.rect(x+32,y+38,16,10,C.black);this.rect(x+12,y+18,8,13,C.black);this.rect(x+59,y+18,8,13,C.black);}
 checkpoint(open=false){const x=this.wx(684);this.rect(x,168,42,64,C.cream);this.rect(x-4,163,50,8,C.red);this.rect(x+7,180,28,25,C.black);this.rect(x+6,209,31,4,C.red);this.sprite('officer',x+13,205);this.rect(x+60,192,6,40,C.stone);if(open){this.rect(x+61,143,5,50,C.white);for(let j=0;j<4;j++)this.rect(x+61,144+j*12,5,6,C.red);}else{this.rect(x+60,191,65,5,C.white);for(let j=0;j<5;j++)this.rect(x+62+j*13,191,7,5,C.red);}this.sign(657,140,'PASSPORT CONTROL');}
 landmark(x,type){
  const worldX=x;x=this.wx(x);if(x<-160||x>530)return;
  if(type==='my'){
   for(const dx of [0,36]){this.rect(x+dx,155,16,77,'#bcbcbc');this.rect(x+dx+3,142,10,13,'#bcbcbc');this.rect(x+dx+7,129,2,13,C.white);for(let y=161;y<229;y+=8)this.rect(x+dx+3,y,10,3,'#3cbcfc');}
   this.rect(x+13,182,27,5,'#bcbcbc');
  }
  if(type==='jp'){
   this.rect(x+23,122,2,21,C.red);
   for(let j=0;j<12;j++){const w=5+j*3;this.rect(x+24-Math.floor(w/2),140+j*7,w,7,C.red);if(j%3===2)this.rect(x+24-Math.floor(w/2),140+j*7,w,3,C.white);}
   for(let j=0;j<5;j++)this.rect(x+20-j,201+j*6,8+j*2,6,C.sky);
   this.rect(x+10,168,29,5,C.white);this.rect(x+13,165,23,3,C.red);
   this.sakura(worldX+84);
  }
  if(type==='cn'){
   for(let j=0;j<13;j++){const w=11+j,offset=Math.floor(j/3),y=139+j*7;this.rect(x+18-offset,y,w,7,'#3cbcfc');this.rect(x+18-offset,y,3,7,'#bcbcbc');this.rect(x+23-offset+Math.floor(j/2),y,2,6,C.white);this.rect(x+19-offset,y+6,w-1,1,C.blue);}
   this.rect(x+22,134,5,5,C.white);
   this.sprite('panda',x+68,232,Math.floor(this.time*2)%2?'eat':'idle');
   this.rect(x+93,188,3,44,C.green);
   for(let j=0;j<4;j++){this.rect(x+91,191+j*9,7,2,C.lime);this.rect(x+94,187+j*9,8,2,C.green);}
  }
 }
 sakura(x){
  x=this.wx(x);this.rect(x,179,7,53,C.brown);this.rect(x-11,176,17,5,C.brown);this.rect(x+3,169,13,5,C.brown);
  for(const [dx,y,w,h]of [[-26,165,21,15],[-14,151,28,21],[9,159,24,20],[-9,172,27,16]]){this.rect(x+dx,y,w,h,'#f878f8');this.rect(x+dx+3,y+2,w-7,5,'#f8b8f8');}
  for(let j=0;j<9;j++){const fall=(Math.floor(this.time*10)+j*7)%58,drift=[0,2,4,2][(Math.floor(this.time*2)+j)%4];this.rect(x-24+j*7+drift,172+fall,3,2,'#f8b8f8');}
 }
 dialogue(lines,x=64,y=64,width=384,scale=2){
  const height=lines.length*(7*scale+6)+12;
  this.rect(x,y,width,height,C.white);this.rect(x+2,y+2,width-4,height-4,C.black);
  this.rect(x+4,y+4,width-8,1,C.white);this.rect(x+4,y+height-5,width-8,1,C.white);
  lines.forEach((line,i)=>this.text(line,x+width/2,y+9+i*(7*scale+6),scale,C.white,'center'));
 }
 lava(from,to){const left=Math.max(this.wx(from),0),right=Math.min(this.wx(to),512);if(right<0||left>512)return;this.rect(left,244,right-left,20,C.lava);this.rect(left,240,right-left,4,C.gold);for(let x=Math.floor(left/8)*8;x<right;x+=8){const up=(Math.floor(this.time*5)+Math.floor(x/8))%3;this.rect(x,238+up*2,5,3,C.cream);this.rect(x+4,252+up*2,4,2,C.gold);}}
 wall(){for(let x=Math.floor(this.cam/32)*32;x<this.cam+544;x+=32){if(x<2544)continue;for(let y=48;y<232;y+=16){if(x>=3552&&x<3856&&y>=200)continue;this.rect(this.wx(x)+(y%32?16:0),y,30,14,'#141424');this.rect(this.wx(x)+(y%32?16:0),y,30,1,'#242434');}}}
 torch(x,y){x=this.wx(x);this.rect(x+3,y+7,4,11,C.brown);const k=Math.floor(this.time*7)%2;this.rect(x+1,y+3,8,7,C.lava);this.rect(x+3,y-k*3,4,9,C.gold);this.rect(x+4,y+3,2,5,C.cream);}
 scenery(state){
  this.cam=state.cam;this.time=state.clock;const dungeon=state.area==='dungeon';
  this.rect(0,0,512,288,dungeon?C.black:C.sky);
  this.ctx.save();this.ctx.beginPath();this.ctx.rect(0,44,512,220);this.ctx.clip();
  if(dungeon){
   this.wall();this.ground(2544,2816,true);this.ground(3168,3552,true);this.ground(3856,4608,true);
   this.lava(2816,3168);this.lava(3552,3856);
   for(const [x,y]of [[2856,216],[2960,200],[3064,216]])for(let j=0;j<4;j++)this.brick(this.wx(x+j*16),y,true);
   for(let x=2600;x<4540;x+=176)this.torch(x,151);
   this.castle(3344,152,true);this.pipe(2632,192);
  }else{
   for(let i=-1;i<10;i++){const x=i*235-(this.cam*.12)%235;this.cloud(x,60+(i%3)*9);}
   for(let x=0;x<2530;x+=310){const sx=this.wx(x);if(sx>-130&&sx<512){this.hill(sx,232,112);this.bush(sx+130,232);}}
   this.ground(0,2544,false);this.castle(454);this.rect(this.wx(493),120,2,28,C.white);this.rect(this.wx(495),121,17,10,C.gold);
   for(const x of [168,200,216])this.brick(this.wx(x),167);
   this.block(184,167,state.nameRevealed,state.blockBump||0);this.pipe(362,190);this.checkpoint(state.checkpointOpen);
   for(const [code,x,flagX,label]of [['jp',1004,940,'JAPAN'],['my',1320,1260,'MALAYSIA'],['cn',1580,1520,'CHINA']]){
    if(state.locations[code]){this.landmark(x,code);this.flag(flagX,165,code);this.sign(flagX-4,215,label);}
   }
   this.sign(2070,71,'AFTER COLLEGE?',144);this.pipe(2040,192);this.pipe(2200,192);this.pipe(2400,184);this.sign(2400,149,'DOWN',40);
  }
  this.ctx.restore();
 }
 hud(state){this.rect(0,0,512,45,state.area==='dungeon'?C.black:C.sky);this.text(state.nameRevealed?'JEREMY':'PLAYER 01',20,12,1);this.text(String(Math.max(0,state.stage-2)*500).padStart(6,'0'),20,25,1);this.sprite('coin',176,33,'idle');this.text('X '+String(state.coins?.size||0).padStart(2,'0'),188,25,1);this.text('WORLD',303,12,1);this.text(state.world+'-1',308,25,1);this.text('STORY',441,12,1);this.text(String(state.world).padStart(2,'0')+' / 06',431,25,1);}
 footer(state){this.rect(0,264,512,24,'#000');this.rect(0,264,512,1,'#343434');this.text('< BACK',43,273,1,state.kind==='title'?C.stone:C.white,'center');this.text(['title','end'].includes(state.kind)?'START >':state.kind==='level'?'WAIT...':'NEXT >',133,273,1,C.gold,'center');this.text('^ JUMP',222,273,1,C.white,'center');this.text(state.muted?'UNMUTE':'MUTE',327,273,1,C.white,'center');this.text('FULLSCREEN',451,273,1,C.white,'center');}
}
global.JeremyRenderer=Renderer;global.JeremyColors=C;
})(window);
