/* eslint-disable */
/**
 * Phòng thay đồ 3D (prototype v2): giá treo áo, mỗi cầu thủ một áo, ánh đèn theo hạng thẻ.
 * Ngày thi đấu: áo sáng = đã vote đi, tối = nghỉ, đung đưa = chưa trả lời; áo của tôi đã vote đi được lấy xuống.
 * JS thuần (giống intro-engine.js); three.js r128 + bloom (tuỳ chọn) được truyền vào khi mở.
 */
export function lkScene(THREE,canvas,PL,o){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const N=PL.length,reduce=o.reduce,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);},eio=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});const PR=Math.min(devicePixelRatio||1,2);renderer.setPixelRatio(PR);renderer.outputEncoding=THREE.sRGBEncoding;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const BG=0x070b14,scene=new THREE.Scene();scene.fog=new THREE.Fog(new THREE.Color(BG).convertSRGBToLinear(),6,14);
  const camera=new THREE.PerspectiveCamera(38,1,.1,50);
  let composer=null,bloom=null;const BLOOM=.38;
  const X=o.post||{};
  try{if(X.EffectComposer&&X.RenderPass&&X.ShaderPass&&X.UnrealBloomPass&&X.GammaCorrectionShader){composer=new X.EffectComposer(renderer);composer.addPass(new X.RenderPass(scene,camera));bloom=new X.UnrealBloomPass(new THREE.Vector2(256,256),BLOOM,.7,.82);composer.addPass(bloom);composer.addPass(new X.ShaderPass(X.GammaCorrectionShader));}}catch(e){composer=null;bloom=null;}
  scene.background=composer?new THREE.Color(BG).convertSRGBToLinear():new THREE.Color(BG);
  const AMB=.26,FILL=.26,SPOT=2.2,RIM=.26;
  const amb=new THREE.AmbientLight(0x6f86c8,AMB);scene.add(amb);const fill=new THREE.DirectionalLight(0xbfd4ff,FILL);fill.position.set(-3,2,4);scene.add(fill);
  const spot=new THREE.SpotLight(0xfff1e0,SPOT,14,.48,.65,1.2);spot.position.set(0,4.2,3.2);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.0005;scene.add(spot);scene.add(spot.target);
  const rim=new THREE.PointLight(0x22d3ee,RIM,4,1.6);rim.position.set(0,.5,-.9);scene.add(rim);
  const ACC={silver:new THREE.Color(0xcfe3ff),gold:new THREE.Color(0xf5c84b),dd:new THREE.Color(0xd4ff3a)};
  const mk=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return new THREE.CanvasTexture(c);};
  const radialTex=mk(256,256,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.42)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,w);});
  const stripTex=mk(8,64,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.5,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
  const beamTex=mk(256,512,(g,w,h)=>{const hz=g.createLinearGradient(0,0,w,0);hz.addColorStop(0,'rgba(255,255,255,0)');hz.addColorStop(.5,'rgba(255,255,255,1)');hz.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=hz;g.beginPath();g.moveTo(w*.42,0);g.lineTo(w*.58,0);g.lineTo(w,h);g.lineTo(0,h);g.closePath();g.fill();
    g.globalCompositeOperation='destination-in';const vt=g.createLinearGradient(0,0,0,h);vt.addColorStop(0,'rgba(0,0,0,1)');vt.addColorStop(.75,'rgba(0,0,0,.35)');vt.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=vt;g.fillRect(0,0,w,h);});
  const glowMat=(map,color,opacity)=>new THREE.MeshBasicMaterial({map,color,opacity,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  /* phòng */
  const wallTex=(()=>{const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d');g.fillStyle='#0f1626';g.fillRect(0,0,1024,512);
    for(let i=0;i<16;i++){const x=i*64,gr=g.createLinearGradient(x,0,x+64,0);gr.addColorStop(0,'#18233a');gr.addColorStop(1,'#101829');g.fillStyle=gr;g.fillRect(x+2,20,60,470);g.fillStyle='#080d18';for(let k=0;k<5;k++)g.fillRect(x+16,48+k*9,32,3);g.fillStyle='#2c3d5c';g.fillRect(x+50,250,4,30);}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=THREE.RepeatWrapping;t.repeat.set(2,1);return t;})();
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(40,6.5),new THREE.MeshStandardMaterial({map:wallTex,color:0x6a78a6,roughness:.8,metalness:.2}));wall.position.set(0,.6,-1.6);wall.receiveShadow=true;scene.add(wall);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,10),new THREE.MeshStandardMaterial({color:0x0c1220,roughness:.42,metalness:.35}));floor.rotation.x=-Math.PI/2;floor.position.set(0,-1.55,1);floor.receiveShadow=true;scene.add(floor);
  const bench=new THREE.Mesh(new THREE.BoxGeometry(40,.12,.5),new THREE.MeshStandardMaterial({color:0x34281f,roughness:.7}));bench.position.set(0,-1.12,-1.2);bench.receiveShadow=true;scene.add(bench);
  const RAIL_Y=1.13,V=(x,y,z)=>new THREE.Vector3(x,y,z),straight=(y,z,rr,rs)=>new THREE.TubeGeometry(new THREE.LineCurve3(V(-20,y,z),V(20,y,z)),1,rr,rs,false);
  const rail=new THREE.Mesh(straight(RAIL_Y,0,.025,10),new THREE.MeshStandardMaterial({color:0xb9c0c9,metalness:.9,roughness:.25}));scene.add(rail);
  const ledCore=new THREE.MeshStandardMaterial({color:0x0a1420,emissive:0xc4f6ff,emissiveIntensity:1,roughness:.4}),ledHalo=glowMat(stripTex,0x22d3ee,.2);
  [[2.12,-1.56,.028,.62],[-1.2,-.94,.022,.42]].forEach(([y,z,t,hh])=>{const core=new THREE.Mesh(straight(y,z,t*.5,6),ledCore);scene.add(core);const h2=new THREE.Mesh(new THREE.PlaneGeometry(40,hh),ledHalo);h2.position.set(0,y,z+.02);scene.add(h2);});
  const floorGlow=new THREE.Mesh(new THREE.PlaneGeometry(5,3),glowMat(radialTex,0x22d3ee,.08));floorGlow.rotation.x=-Math.PI/2;floorGlow.position.set(0,-1.54,.2);scene.add(floorGlow);
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),glowMat(radialTex,0x22d3ee,.13));halo.position.set(0,.15,-.4);scene.add(halo);
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(2.6,4.6),glowMat(beamTex,0xdff6ff,.06));beam.position.set(0,1.1,.25);scene.add(beam);
  /* khung neon lục giác sau áo đang chọn + vệt năng lượng xoắn khi mở thẻ */
  const hexCurve=R=>{const pts=[];for(let q=0;q<6;q++){const a0=(30+60*q)*Math.PI/180,a1=(30+60*(q+1))*Math.PI/180,A=V(Math.cos(a0)*R,Math.sin(a0)*R,0),B=V(Math.cos(a1)*R,Math.sin(a1)*R,0);pts.push(A.clone().lerp(B,.08),A.clone().lerp(B,.92));}return new THREE.CatmullRomCurve3(pts,true,'catmullrom',.12);};
  const neonMat=new THREE.MeshStandardMaterial({color:0x05080f,emissive:0x22d3ee,emissiveIntensity:1.3,roughness:.35,metalness:.2,fog:false});
  const neon=new THREE.Group();neon.position.set(0,.05,-.78);scene.add(neon);
  const hexIn=new THREE.Mesh(new THREE.TubeGeometry(hexCurve(1.3),72,.02,6,true),neonMat),hexOut=new THREE.Mesh(new THREE.TubeGeometry(hexCurve(1.52),72,.009,5,true),neonMat);neon.add(hexIn);neon.add(hexOut);
  class Helix extends THREE.Curve{constructor(ph){super();this.ph=ph;}getPoint(t,o){o=o||new THREE.Vector3();const a=t*Math.PI*5+this.ph,rr=1.04-.28*t;return o.set(Math.cos(a)*rr,-1.45+t*3.1,Math.sin(a)*rr);}}
  const H_SEG=110,H_RAD=4,trailMat=new THREE.MeshStandardMaterial({color:0x05080f,emissive:0xfff0c0,emissiveIntensity:1.8,roughness:.3,fog:false});
  const trails=new THREE.Group();trails.visible=false;scene.add(trails);
  const trailGeos=[0,Math.PI].map(ph=>{const g=new THREE.TubeGeometry(new Helix(ph),H_SEG,.014,H_RAD,false);trails.add(new THREE.Mesh(g,trailMat));return g;});
  const DUST=150,dPos=new Float32Array(DUST*3),dSpd=new Float32Array(DUST);for(let i=0;i<DUST;i++){dPos[i*3]=(Math.random()-.5)*7;dPos[i*3+1]=-1.4+Math.random()*4;dPos[i*3+2]=-1.2+Math.random()*3.4;dSpd[i]=.03+Math.random()*.07;}
  const dGeo=new THREE.BufferGeometry();dGeo.setAttribute('position',new THREE.BufferAttribute(dPos,3));
  const dust=new THREE.Points(dGeo,new THREE.PointsMaterial({map:radialTex,color:0xaeeaff,size:.045,sizeAttenuation:true,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));if(!reduce)scene.add(dust);
  const DUSTC=new THREE.Color(0xaeeaff),FLYC=new THREE.Color(0xd4ff3a);
  /* áo */
  const shape=new THREE.Shape();shape.moveTo(-.2,.9);shape.lineTo(-.56,.82);shape.lineTo(-.86,.56);shape.lineTo(-.7,.3);shape.lineTo(-.5,.44);shape.lineTo(-.5,-.86);shape.quadraticCurveTo(0,-.92,.5,-.86);shape.lineTo(.5,.44);shape.lineTo(.7,.3);shape.lineTo(.86,.56);shape.lineTo(.56,.82);shape.lineTo(.2,.9);shape.quadraticCurveTo(0,.84,-.2,.9);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2,curveSegments:10});geo.translate(0,0,-.03);
  (()=>{const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+.89)/1.78,(p.getY(i)+.95)/1.88);uv.needsUpdate=true;})();
  const TW=512,TH=Math.round(512*1.88/1.78),toPx=(x,y)=>[(x+.89)/1.78*TW,(1-(y+.95)/1.88)*TH];
  const kit=p=>p.line===0?{base:'#1f8a5b',dark:'#145c3d',trim:'#f2d24b',ink:'#0d1a14'}:{base:'#f4c61f',dark:'#b98a07',trim:'#151a22',ink:'#151a22'};
  const TEAM=String(o.team||'').toUpperCase();
  function shirtTex(p){const c=document.createElement('canvas');c.width=TW;c.height=TH;const g=c.getContext('2d'),k=kit(p);
    const gr=g.createLinearGradient(0,0,TW,0);gr.addColorStop(0,k.dark);gr.addColorStop(.18,k.base);gr.addColorStop(.82,k.base);gr.addColorStop(1,k.dark);g.fillStyle=gr;g.fillRect(0,0,TW,TH);
    g.globalAlpha=.07;g.fillStyle='#000';for(let x=0;x<TW;x+=18)g.fillRect(x,0,9,TH);g.globalAlpha=1;
    g.strokeStyle=k.trim;g.lineWidth=10;g.beginPath();let [ax,ay]=toPx(-.2,.9),[cx,cy]=toPx(0,.84),[bx,by]=toPx(.2,.9);g.moveTo(ax,ay);g.quadraticCurveTo(cx,cy,bx,by);g.stroke();
    g.lineWidth=12;[[-.86,.56,-.7,.3],[.86,.56,.7,.3]].forEach(s=>{const [x1,y1]=toPx(s[0],s[1]),[x2,y2]=toPx(s[2],s[3]);g.beginPath();g.moveTo(x1+(s[0]<0?6:-6),y1);g.lineTo(x2+(s[0]<0?6:-6),y2);g.stroke();});
    if(p.cap){/* băng đội trưởng trên tay áo */const [x1,y1]=toPx(.74,.62),[x2,y2]=toPx(.6,.38);g.strokeStyle='#10151c';g.lineWidth=30;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();g.fillStyle='#f2d24b';g.font='700 26px "Barlow Condensed","Arial Narrow",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('C',(x1+x2)/2,(y1+y2)/2);}
    g.fillStyle=k.ink;g.textAlign='center';g.textBaseline='alphabetic';g.font='700 44px "Barlow Condensed","Arial Narrow",sans-serif';if(g.letterSpacing!==undefined)g.letterSpacing='6px';g.fillText(p.short.slice(0,14),TW/2,TH*.25);if(g.letterSpacing!==undefined)g.letterSpacing='0px';
    g.font='700 250px "Barlow Condensed","Arial Narrow",sans-serif';g.lineWidth=6;g.strokeStyle=p.line===0?k.trim:'rgba(255,255,255,.55)';g.strokeText(String(p.n??''),TW/2,TH*.67);g.fillText(String(p.n??''),TW/2,TH*.67);
    g.globalAlpha=.6;g.font='600 20px "Barlow Condensed",sans-serif';g.fillText(TEAM,TW/2,TH*.86);g.globalAlpha=1;
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
  const tagTex=p=>{const t=mk(512,200,(g,w,h)=>{g.fillStyle='#0b111d';g.fillRect(0,0,w,h);g.strokeStyle='#f5c84b';g.lineWidth=6;g.setLineDash([18,12]);g.strokeRect(8,8,w-16,h-16);g.setLineDash([]);g.textAlign='center';g.fillStyle='#f5c84b';g.font='700 40px "Barlow Condensed","Arial Narrow",sans-serif';g.fillText('CHỜ DUYỆT',w/2,72);g.fillStyle='#eaf2ff';g.font='700 62px "Barlow Condensed","Arial Narrow",sans-serif';g.fillText(p.short.slice(0,12),w/2,150);});t.encoding=THREE.sRGBEncoding;return t;};
  const hangerMat=new THREE.MeshStandardMaterial({color:0x2b2116,roughness:.6}),hookMat=new THREE.MeshStandardMaterial({color:0xc9ced6,metalness:.9,roughness:.3});
  const bowGeo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-.52,-.31,-.01),V(-.26,-.2,-.01),V(0,-.115,-.01),V(.26,-.2,-.01),V(.52,-.31,-.01)],false,'catmullrom',.35),14,.019,5,false);
  const hookPts=[V(0,-.115,-.01),V(0,-.06,0),V(0,-.01,0)];[-45,0,45,90,135,180,215].forEach(d=>{const a=d*Math.PI/180;hookPts.push(V(0,.06+Math.sin(a)*.07,Math.cos(a)*.07));});
  const hookGeo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hookPts),22,.011,5,false);
  const collarGeo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-.21,.9,0),V(-.11,.862,.05),V(0,.845,.058),V(.11,.862,.05),V(.21,.9,0),V(.11,.9,-.05),V(0,.895,-.058),V(-.11,.9,-.05)],true),24,.02,5,true);
  const trimMats={},trimMat=hex=>trimMats[hex]||(trimMats[hex]=new THREE.MeshStandardMaterial({color:new THREE.Color(hex),roughness:.7}));
  const shirts=PL.map((p,i)=>{const grp=new THREE.Group(),pivot=new THREE.Group();pivot.position.y=RAIL_Y;let front=null,mesh=null;
    if(p.pending){mesh=new THREE.Mesh(new THREE.PlaneGeometry(.92,.36),new THREE.MeshBasicMaterial({map:tagTex(p),fog:false}));mesh.position.set(0,-.52,.02);mesh.userData.index=i;pivot.add(mesh);}
    else{front=new THREE.MeshStandardMaterial({map:shirtTex(p),roughness:.78,metalness:0});const side=new THREE.MeshStandardMaterial({color:new THREE.Color(kit(p).dark),roughness:.8});mesh=new THREE.Mesh(geo,[front,side]);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.index=i;mesh.position.y=-RAIL_Y+.02;pivot.add(mesh);}
    const hook=new THREE.Mesh(hookGeo,hookMat),bow=new THREE.Mesh(bowGeo,hangerMat);bow.castShadow=true;const parts=[hook,bow];
    if(!p.pending){const collar=new THREE.Mesh(collarGeo,trimMat(kit(p).trim));collar.position.y=mesh.position.y;parts.push(collar);}
    parts.forEach(mm=>{mm.userData.index=i;pivot.add(mm);});grp.add(pivot);
    grp.userData={front,pivot,mesh,lum:1,taken:0,drop:p.isNew&&!reduce?1:0};scene.add(grp);return grp;});
  if(document.fonts&&document.fonts.load)Promise.race([document.fonts.load('700 250px "Barlow Condensed"'),new Promise(r=>setTimeout(r,2000))]).then(()=>{if(dead)return;shirts.forEach((s,i)=>{const u=s.userData;if(!u.front)return;const old=u.front.map;u.front.map=shirtTex(PL[i]);u.front.needsUpdate=true;old.dispose();});}).catch(()=>{});
  /* trạng thái ngày thi đấu: đi = sáng, nghỉ = tối, chưa trả lời = đung đưa; áo của tôi đã vote đi = được lấy xuống */
  const want=p=>!o.matchday||p.pending?{lum:1,taken:0,swing:.008}:p.att==='di'?{lum:1,taken:p.me?1:0,swing:.008}:p.att==='nghi'?{lum:.16,taken:0,swing:.004}:{lum:.62,taken:0,swing:.055};
  let scroll=0,target=0,focus=-1,rev=-1,revFired=false,dead=false,raf=0;const REV_D=2.3;
  const spread=a=>a<1?a*1.32:1.32+(a-1)*.36;const camBase=new THREE.Vector3(),camLook=new THREE.Vector3();let px=0,py=0,pxT=0,pyT=0;
  function layout(dt,now){const k=reduce?1:Math.min(1,dt*7);scroll+=(target-scroll)*k;
    let dim=0,bell=0,spin=0,bk=0,flash=0,punch=0;
    if(rev>=0){rev+=dt;const T=rev;dim=smooth(0,.35,T)*(1-smooth(1.3,1.9,T));bell=smooth(0,.9,T)*(1-smooth(1.5,2.25,T));spin=eio(clamp((T-.3)/1.05,0,1))*Math.PI*2;bk=smooth(.2,.7,T)*(1-smooth(1.5,2.2,T));punch=smooth(1.2,1.38,T)*(1-smooth(1.5,2.2,T));flash=T<1.3?0:Math.max(0,1-(T-1.3)/.55)*.5;
      if(!revFired&&T>=1.55){revFired=true;o.onPulse();o.onReveal(PL[focus]);}if(T>=REV_D)rev=-1;}
    shirts.forEach((s,i)=>{const d=i-scroll,a=Math.abs(d),sg=Math.sign(d),near=Math.min(a,1),u=s.userData,w=want(PL[i]);
      u.taken+=(w.taken-u.taken)*Math.min(1,dt*5);if(u.drop>0)u.drop=Math.max(0,u.drop-dt*.9);const dr=u.drop>0?Math.pow(u.drop,2)*2.6-Math.sin((1-u.drop)*9)*.06*u.drop:0;
      s.position.x=sg*spread(a);s.position.z=(1-near)*.55+u.taken*.5*(1-near);s.position.y=dr-u.taken*.26*(1-near);
      u.pivot.rotation.y=-sg*near*1.22+(i===focus?spin:0);u.pivot.rotation.x=-u.taken*.16*(1-near);u.pivot.rotation.z=reduce?0:Math.sin(now/(w.swing>.03?420:900)+i)*w.swing*(1-near*.5);
      s.scale.setScalar((1-near*.06)*(i===focus?1+punch*.05:1));
      if(u.front){u.lum+=(w.lum-u.lum)*Math.min(1,dt*5);u.front.color.setScalar(u.lum);}});
    const f=clamp(Math.round(scroll),0,N-1);if(f!==focus){focus=f;o.showPlayer(f);}
    const fx=shirts[f].position.x,fz=shirts[f].position.z;spot.target.position.set(fx,0,fz);spot.position.x=fx;
    const accent=ACC[PL[f].tier]||ACC.silver;rim.color.lerp(accent,k);halo.material.color.lerp(accent,k);beam.material.color.lerp(accent,k*.5);floorGlow.material.color.lerp(accent,k);
    const isDD=PL[f].tier==='dd'&&!PL[f].pending;dust.material.color.lerp(isDD?FLYC:DUSTC,k);dust.material.size+=((isDD?.085:.045)-dust.material.size)*k;
    rim.position.x=fx;halo.position.x=fx;beam.position.x=fx;floorGlow.position.x=fx;
    amb.intensity=AMB*(1-.8*dim);fill.intensity=FILL*(1-.85*dim);spot.intensity=SPOT*(1-.7*dim)+1.1*punch;rim.intensity=RIM+2.2*bk+(isDD?.5:0);
    const br=reduce?0:Math.sin(now/1400)*.04;halo.material.opacity=.13+br*.5+.5*bk;halo.scale.setScalar(1+.25*bk);beam.material.opacity=.06+.5*bk;beam.scale.x=1-.35*bk+.5*punch;ledCore.emissiveIntensity=1-.65*dim;ledHalo.opacity=.2*(1-.6*dim);floorGlow.material.opacity=.08+.2*bk;
    if(bloom)bloom.strength=BLOOM+.55*punch;
    neonMat.emissive.lerp(accent,k);neonMat.emissiveIntensity=1.15+br*3+1.5*bk+.8*punch;neon.position.x=fx;neon.scale.setScalar(1+.07*punch-.04*bk);if(!reduce)hexOut.rotation.z+=dt*(.1+2.6*bk);
    if(rev>=0){const hd=clamp((rev-.25)/1.05,0,1)*1.35,a=Math.max(0,Math.floor((hd-.35)*H_SEG)),b=Math.min(H_SEG,Math.floor(hd*H_SEG));trails.visible=b>a;trails.position.set(fx,0,fz);trails.rotation.y=rev*1.6;trailGeos.forEach(g=>g.setDrawRange(a*H_RAD*6,(b-a)*H_RAD*6));}else if(trails.visible)trails.visible=false;
    o.flashEl.style.opacity=flash;
    px+=(pxT-px)*Math.min(1,dt*3);py+=(pyT-py)*Math.min(1,dt*3);camera.position.set(camBase.x+px*.22,camBase.y+py*.1,camBase.z-bell*.95);camera.lookAt(camLook.x+px*.05,camLook.y+bell*.08,camLook.z);
    if(!reduce){for(let i=0;i<DUST;i++){let y=dPos[i*3+1]+dSpd[i]*dt*(1+3*bk);if(y>2.6)y=-1.4;dPos[i*3+1]=y;dPos[i*3]+=Math.sin(now/2300+i)*dt*.02;}dGeo.attributes.position.needsUpdate=true;dust.material.opacity=(isDD?.8:.45)+.4*bk;}}
  const go=i=>{const t=clamp(Math.round(i),0,N-1);if(t!==focus&&rev>=0)rev=-1;target=t;};
  const startReveal=()=>{const p=PL[focus];if(!o.onPick(p))return;if(reduce){o.onReveal(p);return;}rev=0;revFired=false;};
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();let down=null,lastX=0,lastT=0,vel=0;const pps=()=>Math.max(70,canvas.clientWidth*.13);
  const onDown=e=>{down={x:e.clientX,moved:false};lastX=e.clientX;lastT=performance.now();vel=0;try{canvas.setPointerCapture(e.pointerId);}catch(_){}};
  const onMove=e=>{if(e.pointerType==='mouse'&&!reduce){pxT=(e.clientX/innerWidth)*2-1;pyT=-((e.clientY/innerHeight)*2-1);}if(!down)return;const dx=e.clientX-lastX,now=performance.now();
    if(Math.abs(e.clientX-down.x)>6){down.moved=true;canvas.classList.add('dragging');if(rev>=0)rev=-1;}if(down.moved){target=clamp(target-dx/pps(),-.4,N-.6);vel=-dx/pps()/Math.max(1,now-lastT)*16;}lastX=e.clientX;lastT=now;};
  const pick=e=>{const r=canvas.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);const hits=ray.intersectObjects(shirts,true);if(!hits.length)return;const i=hits[0].object.userData.index;if(i===focus&&Math.abs(target-i)<.01){if(rev<0)startReveal();}else go(i);};
  const onUp=e=>{if(!down)return;canvas.classList.remove('dragging');if(!down.moved)pick(e);else go(target+vel*6);down=null;};
  const onCancel=()=>{if(down){go(target);down=null;canvas.classList.remove('dragging');}};const onLeave=()=>{pxT=0;pyT=0;};let wheelT=0;
  const onWheel=e=>{e.preventDefault();if(rev>=0)rev=-1;const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;target=clamp(target+d*.006,-.4,N-.6);clearTimeout(wheelT);wheelT=setTimeout(()=>go(target),140);};
  canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('wheel',onWheel,{passive:false});
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);if(composer){composer.setPixelRatio(PR);composer.setSize(w,h);}camera.aspect=w/h;const sh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lk-sheet-h'))||300;
    if(w<=820){const frac=sh/h;camera.fov=44;camBase.set(0,.3,camera.aspect<.7?7.4:5.6);camLook.set(0,-.1-frac*1.7,0);}else{const off=w>1100?.9:.7;camera.fov=38;camBase.set(off,.3,5.5);camLook.set(off,-.12,0);}camera.updateProjectionMatrix();}
  addEventListener('resize',resize);
  let prev=performance.now();const frame=now=>{if(dead)return;const dt=Math.min(.05,(now-prev)/1000);prev=now;layout(dt,now);if(composer)composer.render();else renderer.render(scene,camera);raf=requestAnimationFrame(frame);};
  return {start(i){target=scroll=i;resize();raf=requestAnimationFrame(frame);},go,step:d=>go(target+d),focus:()=>Math.max(0,focus),states(){},resize,
    destroy(){dead=true;cancelAnimationFrame(raf);removeEventListener('resize',resize);clearTimeout(wheelT);try{scene.traverse(x=>{if(x.geometry)x.geometry.dispose();const ms=x.material?(Array.isArray(x.material)?x.material:[x.material]):[];ms.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});});if(composer){composer.renderTarget1.dispose();composer.renderTarget2.dispose();}if(bloom&&bloom.dispose)bloom.dispose();renderer.dispose();renderer.forceContextLoss();}catch(_){}}};
}
