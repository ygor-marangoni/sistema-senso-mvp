import { createVisualClock } from './visualClock'

// Renderização alternativa extraída de senso-demo.html; não usa WebGL.
export function createSensoFallback(container) {
let scenario='fall', elapsed=0, targetElapsed=0, simulationSpeed=1, animationActive=false, roomIndex=0, severity='normal', offline=false, visualClock=0, currentRunId=null;
const visualTime = createVisualClock()
let angle=.68,elev=.75,zoom=1,drag=null;
const colors={normal:'#278563',analysis:'#ad7b2c',attention:'#ad7b2c',critical:'#b8463e',response:'#277e86'};
const current=()=>[0,'',roomIndex,severity];
const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','Maquete ilustrativa da residência. Use as setas para girar.');Object.assign(canvas.style,{width:'100%',height:'100%',display:'block',touchAction:'none'});container.appendChild(canvas);
const rooms=[{name:'Sala',x:-2.7,z:2.0},{name:'Cozinha',x:2.7,z:2.0},{name:'Quarto',x:-2.7,z:-2.1},{name:'Banheiro',x:2.7,z:-2.1}];
// Keep the sensor pucks on unobstructed floor patches in the four rooms.
const sensors=[[-.42,3.65],[4.9,2.25],[-.55,-2.85],[.4,-2.1]];
const shapes=[];function add(kind,x,y,z,w,h,d,c,opts={}){const s={kind,x,y,z,w,h,d,c,...opts};shapes.push(s);return s}const B=(...a)=>add('box',...a), E=(...a)=>add('ellipsoid',...a), C=(...a)=>add('cylinder',...a);
const wood='#c59e77', oak='#dfc4a4', cream='#f8f5ed', wallColor='#f8f7f1', sage='#9aaa91', teal='#56877e', dark='#324b53';
B(0,-.31,0,10.65,.36,8.65,'#87998e',{floor:true});B(0,-.06,0,10.44,.15,8.44,'#f4f1e7',{floor:true});
for(const r of rooms){B(r.x,0,r.z,5.04,.075,3.94,r===rooms[2]||r===rooms[0]?'#d9bd98':'#dddcd3',{floor:true});}
// Hardwood plank seams and porcelain tiles.
for(let side of [0,1])for(let z=0;z<4;z+=.42){let zz=side? -z-.12:z+.12;B(-2.63,.043,zz,4.98,.006,.013,'#b69b7b',{floor:true});for(let x=-4.6+(Math.round(z/.42)%2)*.8;x<-0.3;x+=1.6)B(x,.044,zz+.21,.012,.006,.40,'#b69b7b',{floor:true})}
for(let x=.55;x<5;x+=.66)B(x,.043,0,.012,.006,7.9,'#c4c8be',{floor:true});for(let z=-3.65;z<4;z+=.66)B(2.63,.044,z,4.98,.006,.012,'#c4c8be',{floor:true});
function wall(x,z,w,d,h=1.6){B(x,h/2+.04,z,w,h,d,wallColor);B(x,h+.065,z,w+.018,.05,d+.018,'#e2e4db');B(x,.11,z,w+.015,.14,d+.015,'#d2d2c7')}
// Open living / kitchen, doorway gaps into rear rooms. Cutaway front edge.
wall(0,-4.1,10.35,.14,1.65);wall(-5.2,0,.14,8.15,.68);wall(5.2,0,.14,8.15,.64);wall(-2.52,4.1,5.31,.14,.24);wall(3.25,4.1,3.85,.14,.24);wall(-3.15,0,3.9,.14,1.08);wall(3.15,0,3.9,.14,1.08);wall(0,-2.1,.14,3.92,1.18);
// Windows with glass panels and mullions.
function windowBack(x,w){B(x,1.02,-4.00,w,.86,.035,'#a2c2c6');B(x,1.02,-3.975,.045,.86,.038,'#f9faf6');B(x,1.02,-3.975,w,.047,.04,'#f9faf6');B(x,.575,-3.96,w+.13,.09,.13,'#f9faf6');B(x,1.49,-3.96,w+.13,.07,.09,'#f9faf6');for(const a of [-1,1])B(x+a*w/2,1.02,-3.97,.06,.88,.065,'#f9faf6')}
windowBack(-2.8,2.5);windowBack(2.65,1.8);
// Living room: woven rug, upholstered rounded furniture, media console.
B(-3.07,.06,2.27,3.12,.04,2.88,'#bdc6b5');for(let z=.95;z<3.7;z+=.16)B(-3.07,.084,z,3.05,.003,.009,'#aab7a5');
B(-4.04,.29,2.43,1.21,.48,2.55,'#a6a890');E(-4.05,.56,2.43,1.24,.42,2.55,sage);B(-4.53,.76,2.43,.28,.77,2.6,'#92967f');E(-4.52,1.06,2.43,.31,.28,2.55,'#a0a58d');for(let z of [1.24,3.62]){B(-4.02,.68,z,1.28,.48,.31,'#a1a58b');E(-4.02,.94,z,1.28,.24,.32,'#aeb299')}
for(let z of [1.83,2.68,3.14]){E(-3.93,.61,z,.99,.22,.75,'#c3c5af');E(-4.29,.89,z,.29,.63,.73,'#b0b49d')};E(-4.22,.93,1.53,.23,.48,.48,'#d9b790',{rotY:.2});E(-4.19,.94,3.31,.27,.48,.45,'#628d83');
function legs(x,z,w,d,h){for(let a of [-1,1])for(let b of [-1,1])C(x+a*w/2,h/2,z+b*d/2,.075,h,.075,'#95795f')}
legs(-2.38,2.45,.73,.92,.39);E(-2.38,.46,2.45,1.10,.15,1.40,wood);B(-2.45,.55,2.35,.35,.045,.25,'#f8f4e9',{rotY:.2});C(-2.18,.60,2.70,.19,.12,.19,'#75968a');
B(-1.5,.32,3.65,1.65,.49,.53,oak);B(-1.5,.61,3.65,1.7,.08,.57,wood);for(let x of [-2.0,-1.5,-1])B(x,.32,3.36,.39,.34,.025,'#e7ddc8');B(-1.50,.73,3.66,.45,.10,.21,dark);B(-1.50,1.09,3.71,1.34,.76,.06,'#273940');B(-1.50,1.09,3.67,1.23,.65,.014,'#44616a');
// Kitchen: cabinets, worktop, sink, stove, fridge, round dining table.
for(let x of [1.0,1.95,2.9,3.85]){B(x,.48,.48,.91,.85,.70,'#c8d4c8');B(x,.47,.85,.84,.76,.035,'#dfe7da');B(x,.74,.88,.36,.035,.035,'#7f9284');B(x,.94,.48,.98,.10,.77,'#eee9df')}
B(4.65,.48,1.38,.72,.85,1.04,'#c8d4c8');B(4.65,.94,1.38,.76,.10,1.12,'#eee9df');B(2.9,.999,.48,.58,.025,.43,'#9aafab');B(2.9,1.013,.48,.45,.01,.32,'#6f8886');C(2.9,1.16,.18,.05,.29,.05,'#839492');B(2.9,1.29,.30,.06,.055,.22,'#839492');B(1.95,.999,.48,.64,.025,.56,'#394a4c');for(let x of [1.78,2.13])for(let z of [.32,.63])C(x,1.02,z,.16,.02,.16,'#151f22');
B(4.55,.97,3.25,.86,1.8,.92,'#d9dfdb');B(4.55,1.52,2.77,.83,.67,.036,'#e8ede9');B(4.55,.61,2.77,.83,.99,.036,'#e8ede9');B(4.88,1.25,2.73,.045,.30,.045,'#899f99');B(4.88,.73,2.73,.045,.35,.045,'#899f99');
C(3.1,.40,2.62,.17,.70,.17,'#947659');C(3.1,.77,2.62,1.62,.11,1.62,wood);C(3.1,.865,2.62,.27,.12,.27,'#f8f5ec');E(3.1,.96,2.62,.19,.18,.19,'#6f977d');
for(let z of [1.57,3.68]){legs(3.1,z,.42,.40,.34);E(3.1,.43,z,.67,.19,.62,'#81a095');B(3.1,.72,z+(z>3?.25:-.25),.58,.55,.10,'#759187');E(3.1,1.02,z+(z>3?.25:-.25),.61,.13,.12,'#759187')}
// Bedroom: raised bed, linen, side tables, lamps and wardrobe.
B(-2.73,.25,-2.43,2.47,.36,2.84,wood);E(-2.73,.50,-2.43,2.43,.30,2.82,'#faf8f2');B(-2.73,.72,-3.79,2.55,1.03,.17,'#ae9074');E(-2.73,1.21,-3.79,2.55,.12,.19,'#b59a80');B(-2.73,.68,-1.96,2.39,.14,1.84,'#81a89e');E(-2.73,.71,-1.36,2.38,.21,.58,'#94b6a9');for(let x of [-3.28,-2.17])E(x,.71,-3.25,1.01,.24,.60,'#e9e3d7');
for(let x of [-4.42,-1.03]){B(x,.36,-3.4,.63,.63,.67,oak);B(x,.4,-3.05,.54,.21,.025,'#ebdfce');B(x,.4,-3.02,.21,.035,.035,'#9e896f');C(x,.74,-3.4,.24,.08,.24,'#8d9c8d');C(x,.94,-3.4,.055,.35,.055,'#a09479');E(x,1.16,-3.4,.40,.34,.40,'#ead9ac')}
B(-4.62,.86,-1.45,.76,1.64,1.95,'#deded1');for(let z of [-1.91,-1.00]){B(-4.20,.86,z,.035,1.52,.84,'#eae9df');B(-4.16,.84,z+.25,.04,.28,.045,'#8c9b90')}
// Bathroom: walk-in shower, vanity, toilet, bathmat.
B(4.1,.14,-2.7,1.72,.18,2.27,'#f7f9f3');B(4.1,.24,-2.7,1.62,.04,2.18,'#c6d8d2');B(4.95,1.04,-2.7,.035,1.55,2.15,'#a9c5c0');B(4.95,1.82,-2.7,.065,.05,2.17,'#7e9b97');C(4.62,1.4,-3.71,.045,.72,.045,'#8b9d97');C(4.53,1.77,-3.65,.25,.045,.25,'#889f99');
B(1.28,.50,-3.48,1.31,.84,.69,'#b5c7bd');B(1.28,.95,-3.48,1.37,.14,.75,'#faf8ef');E(1.28,1.04,-3.48,.81,.075,.46,'#a8c3bb');C(1.28,1.18,-3.75,.047,.23,.047,'#859c93');B(1.28,1.42,-3.98,1.13,.65,.035,'#a8c1c1');
B(2.43,.62,-3.67,.60,.70,.29,'#f9faf4');E(2.43,.33,-3.22,.67,.55,.77,'#fafaf3');E(2.43,.58,-3.14,.65,.10,.69,'#f1f5ee');E(2.43,.635,-3.14,.42,.023,.47,'#a8bbb5');B(2.86,.062,-1.72,.92,.03,.63,'#a9bcb1');
// A few plants and small objects make the home lived-in.
function plant(x,z,k=1){C(x,.19*k,z,.43*k,.34*k,.43*k,'#b1a18a');C(x,.365*k,z,.36*k,.045*k,.36*k,'#665f46');for(let i=0;i<6;i++){let a=i*Math.PI/3;E(x+Math.cos(a)*.17*k,.61*k+(i%2)*.11*k,z+Math.sin(a)*.17*k,.25*k,.47*k,.18*k,i%2?'#668a69':'#87a17d',{rotY:a})}}
plant(-4.68,3.82,.83);plant(4.60,-.65,.85);plant(-.60,-3.48,.65);
for(const [x,z] of sensors){B(x,.17,z,.40,.24,.30,'#f9faf6');E(x,.30,z,.22,.07,.17,'#a9cbbd')}
// Character: articulated stylized figure with independent head, torso, hands, legs, hair and glasses.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};const mix=(a,b,t)=>a+(b-a)*t;
function pathAt(t,pts){for(let i=1;i<pts.length;i++){if(t<=pts[i][0]){let k=smooth((t-pts[i-1][0])/(pts[i][0]-pts[i-1][0]));return [mix(pts[i-1][1],pts[i][1],k),mix(pts[i-1][2],pts[i][2],k)]}}return pts.at(-1).slice(1)}
function pose(){let t=elapsed,p,prev;const routes={fall:[[0,-1.15,2.12],[2.2,-.7,1.5],[5.5,.75,1.55],[7,1.25,1.55]],normal:[[0,-1.15,2.12],[5,1.25,1.55],[10,1.25,1.55],[13,-.55,.45],[15,-.58,-.86],[20,-1.0,-1.25]],idle:[[0,-1.15,2.12],[6,-1.0,1.4]],heat:[[0,1.25,1.55],[6,1.30,1.55]],offline:[[0,-1.15,2.12],[8,1.25,1.55]],routine:[[0,-.65,-1],[5,-.95,.65],[11,-1.15,2.12]]};p=pathAt(t,routes[scenario]);prev=pathAt(Math.max(0,t-.08),routes[scenario]);let moving=Math.hypot(p[0]-prev[0],p[1]-prev[1])>.0001;let yaw=moving?Math.atan2(p[0]-prev[0],p[1]-prev[1]):1.05;let fall=scenario==='fall'?smooth((t-7.1)/1.35):0;return {x:p[0],z:p[1],yaw:fall>0?1.22:yaw,fall,walking:moving&&fall===0,phase:t*9}}
function character(){const p=pose(),out=[],sin=Math.sin(p.phase),walk=p.walking?sin*.21:0,bob=p.walking?Math.abs(sin)*.028:0;const fall=p.fall,skin='#cda88c',hair='#e0e2dc',shirt='#759b98',pants='#677578',shoe='#48514f';
function world(x,y,z){let a=fall*Math.PI/2;let yy=y*Math.cos(a)+z*Math.sin(a),zz=-y*Math.sin(a)+z*Math.cos(a);return [p.x+x*Math.cos(p.yaw)+zz*Math.sin(p.yaw),.055+bob+yy+fall*.20,p.z-x*Math.sin(p.yaw)+zz*Math.cos(p.yaw)]}
function ell(x,y,z,w,h,d,c){let [X,Y,Z]=world(x,y,z);out.push({kind:'ellipsoid',x:X,y:Y,z:Z,w,h,d,c,rotY:p.yaw,rotX:-fall*Math.PI/2})}
function link(a,b,w,c){let A=world(...a),B=world(...b);out.push({kind:'link',x:(A[0]+B[0])/2,y:(A[1]+B[1])/2,z:(A[2]+B[2])/2,w,h:Math.hypot(...A.map((n,i)=>n-B[i]))+w*.4,d:w,c,a:A,b:B})}
ell(0,.80,0,.46,.49,.28,shirt);ell(0,.57,0,.40,.25,.27,pants);ell(0,1.09,0,.15,.22,.15,skin);ell(0,1.29,.025,.30,.36,.29,skin);ell(0,1.39,-.035,.33,.23,.30,hair);ell(-.105,1.30,-.095,.13,.24,.17,hair);ell(.105,1.30,-.095,.13,.24,.17,hair);ell(0,1.41,-.11,.23,.18,.19,hair);ell(0,1.27,.178,.052,.057,.046,skin);for(let s of [-1,1]){ell(s*.151,1.27,.015,.05,.09,.07,skin);ell(s*.07,1.32,.156,.09,.06,.025,'#5b6d6a');ell(s*.07,1.32,.17,.062,.04,.013,'#c0d1c6');ell(s*.07,1.32,.180,.022,.023,.009,'#43514c');let swing=s*walk;link([s*.13,.54,0],[s*.14,.29,swing*.5],.15,pants);link([s*.14,.29,swing*.5],[s*.14,.085,swing],.12,pants);ell(s*.14,.06,swing+.045,.17,.10,.25,shoe);let armZ=-swing*.8;link([s*.24,.98,0],[s*.28,.77,armZ*.4],.13,shirt);link([s*.28,.77,armZ*.4],[s*.27,.58,armZ],.11,skin);ell(s*.27,.55,armZ,.115,.14,.12,skin)}return out}

// Simulated human response. These figures are not readings of the resident.
function responders(){
 if(scenario!=='fall'||elapsed<21)return [];
 let out=[];
 for(let i=0;i<2;i++){
  let t=elapsed-i*.85, route=i===0?[[21,.55,4.47],[23,.55,3.25],[25,.48,2.4],[27,-.25,1.55]]:[[21,.96,4.55],[23,.96,3.28],[25,1.12,2.48],[27,1.65,2.05]],p=pathAt(t,route),prev=pathAt(Math.max(21,t-.08),route),walking=t>21&&t<27, kneel=smooth((t-27)/2.1),yaw=walking?Math.atan2(p[0]-prev[0],p[1]-prev[1]):i===0?1.73:-2.15;
  if(t<21)continue;
  let swing=walking?Math.sin(t*10)*.23:0,bob=walking?Math.abs(Math.sin(t*10))*.028:0,skin=i===0?'#bd987f':'#a77d61',uniform='#244b6b',vest='#dc8a37',pants='#263d4e';
  const W=(x,y,z)=>[p[0]+x*Math.cos(yaw)+z*Math.sin(yaw),.055+bob+y,p[1]-x*Math.sin(yaw)+z*Math.cos(yaw)];
  function shape(kind,x,y,z,w,h,d,c,rx=0){let a=W(x,y,z);out.push({kind,x:a[0],y:a[1],z:a[2],w,h,d,c,rotY:yaw,rotX:rx})}
  const el=(...a)=>shape('ellipsoid',...a),box=(...a)=>shape('box',...a);
  function limb(a,b,w,c){let A=W(...a),B=W(...b);out.push({kind:'link',x:(A[0]+B[0])/2,y:(A[1]+B[1])/2,z:(A[2]+B[2])/2,w,h:Math.hypot(...A.map((n,j)=>n-B[j]))+w*.34,d:w,c,a:A,b:B})}
  let hip=.56-.30*kneel,torso=.83-.34*kneel,head=1.31-.39*kneel,lean=.14*kneel;
  el(0,hip,0,.42,.24,.28,pants);el(0,torso,lean,.46,.50,.31,uniform,-.22*kneel);
  box(0,torso+.02,lean+.153,.34,.10,.035,vest);box(0,torso+.02,lean-.153,.34,.10,.035,vest);box(0,torso+.02,lean+.177,.25,.025,.01,'#e7e7cc');box(-.14,torso+.14,lean+.15,.055,.06,.025,'#f1f4ee');
  el(0,head-.18,lean,.15,.16,.15,skin);el(0,head,lean,.30,.34,.28,skin);el(0,head+.12,lean-.03,.32,.18,.29,'#33434a');
  for(let a of [-1,1]){
    let knee=[a*.14,.30-.22*kneel,a*swing*.45+.20*kneel],foot=[a*.15,.065,a*swing-.24*kneel];
    limb([a*.13,hip,0],knee,.16,pants);limb(knee,foot,.13,pants);el(foot[0],foot[1],foot[2]+.035,.18,.10,.25,'#25363b');
    let shoulder=[a*.24,torso+.15,lean],elbow=[a*.28,torso-.07,lean-a*swing*.35+.14*kneel],hand=[a*.22,torso-.24+.04*kneel,lean-a*swing*.65+.31*kneel];
    limb(shoulder,elbow,.135,uniform);limb(elbow,hand,.105,skin);el(...hand,.11,.13,.11,'#d7e5e2');
  }
  // A compact medical bag, carried in and then placed beside the responder.
  let by=mix(.40,.17,kneel),bx=.39,bz=mix(.03,-.20,kneel);box(bx,by,bz,.30,.31,.25,'#b54940');box(bx,by+.172,bz,.15,.038,.055,'#34454a');box(bx,by,bz+.128,.13,.04,.012,'#f4f6ee');box(bx,by,bz+.13,.04,.13,.012,'#f4f6ee');
 }
 return out;
}

let ctx;const geoCache={};const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),sub=(a,b)=>a.map((n,i)=>n-b[i]),norm=a=>{let m=Math.hypot(...a)||1;return a.map(v=>v/m)};
function geometry(kind){kind=kind==='link'?'ellipsoid':kind;if(geoCache[kind])return geoCache[kind];let v=[],f=[];if(kind==='box'){v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,.5,.5],[-.5,.5,.5]];f=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]}else if(kind==='cylinder'){let n=12;for(let y of [-.5,.5])for(let j=0;j<n;j++){let a=j*2*Math.PI/n;v.push([.5*Math.cos(a),y,.5*Math.sin(a)])}f.push(Array.from({length:n},(_,j)=>j),Array.from({length:n},(_,j)=>n+j));for(let j=0;j<n;j++)f.push([j,(j+1)%n,(j+1)%n+n,j+n])}else{let n=12,m=8;for(let i=0;i<=m;i++){let p=Math.PI*i/m;for(let j=0;j<n;j++){let a=j*2*Math.PI/n;v.push([.5*Math.sin(p)*Math.cos(a),.5*Math.cos(p),.5*Math.sin(p)*Math.sin(a)])}}for(let i=0;i<m;i++)for(let j=0;j<n;j++){let k=i*n+j,l=i*n+(j+1)%n;f.push([k,l,l+n,k+n])}}return geoCache[kind]={v,f}}
function transform(s){let axis=s.kind==='link'?norm(sub(s.b,s.a)):null,xx=axis?norm(cross(Math.abs(axis[2])>.95?[1,0,0]:[0,0,1],axis)):null,zz=axis?cross(xx,axis):null;const cy=Math.cos(s.rotY||0),sy=Math.sin(s.rotY||0),cx=Math.cos(s.rotX||0),sx=Math.sin(s.rotX||0);return p=>{let [a,b,c]=[p[0]*s.w,p[1]*s.h,p[2]*s.d];if(axis)return [s.x+xx[0]*a+axis[0]*b+zz[0]*c,s.y+xx[1]*a+axis[1]*b+zz[1]*c,s.z+xx[2]*a+axis[2]*b+zz[2]*c];let y=b*cx-c*sx,z=b*sx+c*cx;return [s.x+a*cy+z*sy,s.y+y,s.z-a*sy+z*cy]}}
function build(s){let g=geometry(s.kind),tr=transform(s),v=g.v.map(tr);return g.f.flatMap(f=>{let p=f.map(i=>v[i]),n=norm(cross(sub(p[1],p[0]),sub(p[2],p[0])));if(Math.hypot(...n)<.1)n=norm(cross(sub(p[2],p[0]),sub(p.at(-1),p[0])));let mid=p.reduce((a,b)=>a.map((n,i)=>n+b[i]/p.length),[0,0,0]);if(dot(n,sub(mid,[s.x,s.y,s.z]))<0)n=n.map(x=>-x);let q=[p];if(s.kind==='box'&&!s.floor&&p.length===4){let u=Math.ceil(Math.hypot(...sub(p[1],p[0]))/.35),v=Math.ceil(Math.hypot(...sub(p[3],p[0]))/.35);if(u*v>1){q=[];const at=(a,b)=>p[0].map((x,i)=>x+(p[1][i]-x)*a+(p[3][i]-x)*b);for(let i=0;i<u;i++)for(let j=0;j<v;j++)q.push([at(i/u,j/v),at((i+1)/u,j/v),at((i+1)/u,(j+1)/v),at(i/u,(j+1)/v)])}}return q.map(p=>({p,n,mid:p.reduce((a,b)=>a.map((n,i)=>n+b[i]/p.length),[0,0,0]),c:s.c,floor:!!s.floor}))})}
const staticFaces=shapes.flatMap(build),light=norm([-3,7,5]);function shade(c,k){let n=parseInt(c.slice(1),16);return '#'+[n>>16,n>>8&255,n&255].map(v=>Math.round(Math.min(255,Math.max(0,v*k))).toString(16).padStart(2,'0')).join('')}
function sizeCanvas(c){let w=c.clientWidth,h=c.clientHeight,d=Math.min(devicePixelRatio||1,1.25);if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d)}return[w,h,d]}
let rasterCache=null,frameBuffer=null,frameDepth=null,frameImage=null;
function drawFallback(){if(!ctx)ctx=canvas.getContext('2d');elapsed=visualTime.tick(performance.now());let [w,h,d]=sizeCanvas(canvas);if(!w||!h)return;ctx.setTransform(d,0,0,d,0,0);const s=Math.min(w/15,h/11.7)*zoom,ox=w*.5,oy=h*.53,ca=Math.cos(angle),sa=Math.sin(angle),ce=Math.cos(elev),se=Math.sin(elev),view=[sa*ce,se,ca*ce];function proj(p){let [x,y,z]=p;return[ox+(x*ca-z*sa)*s,oy+((x*sa+z*ca)*se-y*ce)*s,dot(p,view)]}
const W=canvas.width,H=canvas.height,key=[W,H,angle,elev,zoom].join(':');
function raster(faces,buf,depth){for(let f of faces){if(dot(f.n,view)<.001)continue;let ps=f.p.map(p=>{let a=proj(p);return[a[0]*d,a[1]*d,a[2]]});let hex=parseInt(shade(f.c,.78+.24*Math.max(0,dot(f.n,light))).slice(1),16),R=hex>>16,G=hex>>8&255,B=hex&255;for(let k=1;k+1<ps.length;k++){let a=ps[0],b=ps[k],c=ps[k+1],det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-7)continue;let xmin=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){let px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/det,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/det,t=1-u-v;if(u<-.0001||v<-.0001||t<-.0001)continue;let z=u*a[2]+v*b[2]+t*c[2],i=y*W+x;if(z<depth[i])continue;depth[i]=z;let j=i*4;buf[j]=R;buf[j+1]=G;buf[j+2]=B;buf[j+3]=255}}}}
if(!rasterCache||rasterCache.key!==key){let buf=new Uint8ClampedArray(W*H*4),depth=new Float32Array(W*H);depth.fill(-Infinity);raster(staticFaces,buf,depth);rasterCache={key,buf,depth}}if(!frameBuffer||frameBuffer.length!==rasterCache.buf.length||frameImage.width!==W||frameImage.height!==H){frameBuffer=new Uint8ClampedArray(rasterCache.buf.length);frameDepth=new Float32Array(rasterCache.depth.length);frameImage=new ImageData(frameBuffer,W,H)}frameBuffer.set(rasterCache.buf);frameDepth.set(rasterCache.depth);raster([...character(),...responders()].flatMap(build),frameBuffer,frameDepth);ctx.putImageData(frameImage,0,0);
const ev=current(),co=colors[ev[3]];for(let i=0;i<sensors.length;i++){let [x,z]=sensors[i],p=proj([x,.38,z]),off=offline&&i===1,col=off?'#ad7b2c':i===ev[2]&&ev[3]!=='normal'?co:'#278563';if(!off)for(let n=0;n<2;n++){let r=6+(visualClock*11+n*11)%22;ctx.globalAlpha=.34*(1-r/35);ctx.strokeStyle=col;ctx.lineWidth=1.1;ctx.beginPath();ctx.ellipse(p[0],p[1],r,r*.6,0,0,7);ctx.stroke()}ctx.globalAlpha=1;ctx.fillStyle=col;ctx.beginPath();ctx.arc(p[0],p[1],4.2,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke()}
// Only the relevant room is labeled, avoiding visual noise.
let r=rooms[ev[2]],q=proj([r.x,2.05,r.z]),txt=r.name;ctx.font='600 12px Segoe UI, Arial';let tw=ctx.measureText(txt).width+22;ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(q[0]-tw/2,q[1]-10,tw,25,7);ctx.fill();ctx.fillStyle=co;ctx.textAlign='center';ctx.fillText(txt,q[0],q[1]+6);}
let frame=0, disposed=false
function redraw(){ if(!disposed && !frame) frame=requestAnimationFrame(()=>{frame=0;if(!disposed)drawFallback()}) }
const observer=new ResizeObserver(redraw);observer.observe(container)
function pointerDown(e){drag={x:e.clientX,y:e.clientY,a:angle,b:elev};canvas.setPointerCapture(e.pointerId)}
function pointerMove(e){if(drag){angle=drag.a+(e.clientX-drag.x)*.007;elev=Math.max(.30,Math.min(1.54,drag.b+(e.clientY-drag.y)*.005));redraw()}}
function pointerUp(){drag=null}
function wheel(e){e.preventDefault();zoom=Math.max(.72,Math.min(1.7,zoom-e.deltaY*.001));redraw()}
function key(e){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();angle+=(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)*.13;elev=Math.max(.3,Math.min(1.54,elev+(e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0)*.1));redraw()}}
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key)
redraw()
return {
 update(state){const nextScenario=['fall','normal','idle','heat','offline','routine'].includes(state.scenario)?state.scenario:'fall',nextElapsed=Math.max(0,state.elapsed||0),nextRoom=Math.max(0,Math.min(3,state.roomIndex??0)),nextSeverity=colors[state.severity]?state.severity:'normal',nextOffline=!!state.offline,nextClock=state.visualClock??nextElapsed,nextRunning=!!state.running,nextSpeed=Math.max(.5,Math.min(2,state.speed||1)),scenarioChanged=nextScenario!==scenario;if(!scenarioChanged&&state.runId===currentRunId&&nextElapsed===targetElapsed&&nextRoom===roomIndex&&nextSeverity===severity&&nextOffline===offline&&nextClock===visualClock&&nextRunning===animationActive&&nextSpeed===simulationSpeed)return;currentRunId=state.runId;scenario=nextScenario;targetElapsed=nextElapsed;roomIndex=nextRoom;severity=nextSeverity;offline=nextOffline;visualClock=nextClock;animationActive=nextRunning;simulationSpeed=nextSpeed;visualTime.update({runId:state.runId,scenario:nextScenario,elapsed:nextElapsed,running:nextRunning,speed:nextSpeed});redraw()},
 resetCamera(){angle=.68;elev=.75;zoom=1;redraw()},
 topView(){elev=1.54;redraw()},
 dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);canvas.remove();rasterCache=null;frameBuffer=null;frameDepth=null;frameImage=null}
}
}
