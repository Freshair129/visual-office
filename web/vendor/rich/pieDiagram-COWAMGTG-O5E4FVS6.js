import{a as ot}from"./chunk-VZ2XWHW5.js";import{a as nt}from"./chunk-ZFYAGDGU.js";import"./chunk-FJPJGPZV.js";import"./chunk-4ITSRRPR.js";import"./chunk-TLTEXIME.js";import"./chunk-2BZXBSWF.js";import"./chunk-6PJMBUDE.js";import"./chunk-5A7AF2RH.js";import"./chunk-UBCLGFDX.js";import"./chunk-DP2VUZ6D.js";import"./chunk-MZTN2Q3B.js";import"./chunk-XKAG5BK2.js";import"./chunk-HQTMRTBN.js";import"./chunk-ICHVVOEX.js";import"./chunk-CDXRV7CG.js";import"./chunk-YXJJXKXT.js";import"./chunk-YGXLTMZQ.js";import"./chunk-6M2T6EN4.js";import{a as at}from"./chunk-QYTIXGQK.js";import{o as rt,p as it}from"./chunk-M3AFWGK6.js";import"./chunk-UKQETAB3.js";import{$ as et,P as Z,U as j,V as q,W as J,X as K,Y as Q,Z as Y,_ as tt,q as X}from"./chunk-VCO4YYVS.js";import{F as R,I as V,b as T,m as U}from"./chunk-UF6SHU3I.js";import{a as l}from"./chunk-UPPDABHK.js";import"./chunk-I7AUKTXE.js";var lt=X.pie,L={sections:new Map,showData:!1,config:lt},b=L.sections,W=L.showData,St=structuredClone(lt),xt=l(()=>structuredClone(St),"getConfig"),wt=l(()=>{b=new Map,W=L.showData,j()},"clear"),Ct=l(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);b.has(t)||(b.set(t,a),T.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),$t=l(()=>b,"getSections"),Dt=l(t=>{W=t},"setShowData"),yt=l(()=>W,"getShowData"),st={getConfig:xt,clear:wt,setDiagramTitle:Y,getDiagramTitle:tt,setAccTitle:q,getAccTitle:J,setAccDescription:K,getAccDescription:Q,addSection:Ct,getSections:$t,setShowData:Dt,getShowData:yt},Tt=l((t,a)=>{ot(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),bt={parse:l(async t=>{let a=await nt("pie",t);T.debug(a),Tt(a,st)},"parse")},At=l(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),_t=At,kt=l(t=>{let a=[...t.values()].reduce((n,u)=>n+u,0),F=[...t.entries()].map(([n,u])=>({label:n,value:u})).filter(n=>n.value/a*100>=1);return V().value(n=>n.value).sort(null)(F)},"createPieArcs"),zt=l((t,a,F,H)=>{T.debug(`rendering pie chart
`+t);let n=H.db,u=et(),h=it(n.getConfig(),u.pie),M=40,i=18,c=4,S=450,x=S,A=at(a),$=A.append("g");$.attr("transform","translate("+x/2+","+S/2+")");let{themeVariables:o}=u,[O]=rt(o.pieOuterStrokeWidth);O??=2;let ct=h.legendPosition,P=h.textPosition,dt=h.donutHole>0&&h.donutHole<=.9?h.donutHole:0,m=Math.min(x,S)/2-M,pt=R().innerRadius(dt*m).outerRadius(m),gt=R().innerRadius(m*P).outerRadius(m*P),w=$.append("g");w.append("circle").attr("cx",0).attr("cy",0).attr("r",m+O/2).attr("class","pieOuterCircle");let D=n.getSections(),ht=kt(D),mt=[o.pie1,o.pie2,o.pie3,o.pie4,o.pie5,o.pie6,o.pie7,o.pie8,o.pie9,o.pie10,o.pie11,o.pie12],_=0;D.forEach(e=>{_+=e});let G=ht.filter(e=>(e.data.value/_*100).toFixed(0)!=="0"),k=U(mt).domain([...D.keys()]);w.selectAll("mySlices").data(G).enter().append("path").attr("d",pt).attr("fill",e=>k(e.data.label)).attr("class",e=>{let r="pieCircle";return h.highlightSlice==="hover"?r+=" highlightedOnHover":h.highlightSlice===e.data.label&&(r+=" highlighted"),r}),w.selectAll("mySlices").data(G).enter().append("text").text(e=>(e.data.value/_*100).toFixed(0)+"%").attr("transform",e=>"translate("+gt.centroid(e)+")").style("text-anchor","middle").attr("class","slice");let ft=$.append("text").text(n.getDiagramTitle()).attr("x",0).attr("y",-(S-50)/2).attr("class","pieTitleText"),C=[...D.entries()].map(([e,r])=>({label:e,value:r})),f=$.selectAll(".legend").data(C).enter().append("g").attr("class","legend");f.append("rect").attr("width",i).attr("height",i).style("fill",e=>k(e.label)).style("stroke",e=>k(e.label)),f.append("text").attr("x",i+c).attr("y",i-c).text(e=>n.getShowData()?`${e.label} [${e.value}]`:e.label);let v=Math.max(...f.selectAll("text").nodes().map(e=>e?.getBoundingClientRect().width??0)),y=S,z=x+M,s=i+c,E=C.length*s;switch(ct){case"center":f.attr("transform",(e,r)=>{let d=s*C.length/2,p=-v/2-(i+c),g=r*s-d;return"translate("+p+","+g+")"});break;case"top":y+=E,f.attr("transform",(e,r)=>{let d=m,p=-v/2-(i+c),g=r*s-d;return`translate(${p}, ${g})`}),w.attr("transform",()=>`translate(0, ${E+s})`);break;case"bottom":y+=E,f.attr("transform",(e,r)=>{let d=-m-s,p=-v/2-(i+c),g=r*s-d;return"translate("+p+","+g+")"});break;case"left":z+=i+c+v,f.attr("transform",(e,r)=>{let d=s*C.length/2,p=-m-(i+c),g=r*s-d;return"translate("+p+","+g+")"}),w.attr("transform",()=>`translate(${v+i+c}, 0)`);break;default:z+=i+c+v,f.attr("transform",(e,r)=>{let d=s*C.length/2,p=12*i,g=r*s-d;return"translate("+p+","+g+")"});break}let B=ft.node()?.getBoundingClientRect().width??0,ut=x/2-B/2,vt=x/2+B/2,N=Math.min(0,ut),I=Math.max(z,vt)-N;A.attr("viewBox",`${N} 0 ${I} ${y}`),Z(A,y,I,h.useMaxWidth)},"draw"),Et={draw:zt},re={parser:bt,db:st,renderer:Et,styles:_t};export{re as diagram};
