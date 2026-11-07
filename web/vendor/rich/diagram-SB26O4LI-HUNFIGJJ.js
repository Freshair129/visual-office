import{a as F}from"./chunk-VZ2XWHW5.js";import{a as D}from"./chunk-ZFYAGDGU.js";import"./chunk-FJPJGPZV.js";import"./chunk-4ITSRRPR.js";import"./chunk-TLTEXIME.js";import"./chunk-2BZXBSWF.js";import"./chunk-6PJMBUDE.js";import"./chunk-5A7AF2RH.js";import"./chunk-UBCLGFDX.js";import"./chunk-DP2VUZ6D.js";import"./chunk-MZTN2Q3B.js";import"./chunk-XKAG5BK2.js";import"./chunk-HQTMRTBN.js";import"./chunk-ICHVVOEX.js";import"./chunk-CDXRV7CG.js";import"./chunk-YXJJXKXT.js";import"./chunk-YGXLTMZQ.js";import"./chunk-6M2T6EN4.js";import{a as E}from"./chunk-QYTIXGQK.js";import{p as y}from"./chunk-M3AFWGK6.js";import"./chunk-UKQETAB3.js";import{B as b,P as L,U as T,V as S,W as k,X as O,Y as R,Z as I,_,o as A,q as M}from"./chunk-VCO4YYVS.js";import{b as C}from"./chunk-UF6SHU3I.js";import{a as i}from"./chunk-UPPDABHK.js";import"./chunk-I7AUKTXE.js";var x={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},w=32,P={axes:[],curves:[],options:x},g=structuredClone(P),U=M.radar,X=i(()=>y({...U,...b().radar}),"getConfig"),z=i(()=>g.axes,"getAxes"),K=i(()=>g.curves,"getCurves"),N=i(()=>g.options,"getOptions"),Y=i(r=>{g.axes=r.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),Z=i(r=>{g.curves=r.map(t=>({name:t.name,label:t.label??t.name,entries:q(t.entries)}))},"setCurves"),q=i(r=>{if(r[0].axis==null)return r.map(e=>e.value);let t=z();if(t.length===0)throw new Error("Axes must be populated before curves for reference entries");return t.map(e=>{let a=r.find(n=>n.axis?.$refText===e.name);if(a===void 0)throw new Error("Missing entry for axis "+e.label);return a.value})},"computeCurveEntries"),J=i(r=>{let t=r.reduce((e,a)=>(e[a.name]=a,e),{});g.options={showLegend:t.showLegend?.value??x.showLegend,ticks:t.ticks?.value??x.ticks,max:t.max?.value??x.max,min:t.min?.value??x.min,graticule:t.graticule?.value??x.graticule},g.options.ticks>w&&(C.warn(`Radar diagram ticks (${g.options.ticks}) exceeds maximum allowed (${w}). Using ${w} instead.`),g.options.ticks=w)},"setOptions"),Q=i(()=>{T(),g=structuredClone(P)},"clear"),$={getAxes:z,getCurves:K,getOptions:N,setAxes:Y,setCurves:Z,setOptions:J,getConfig:X,clear:Q,setAccTitle:S,getAccTitle:k,setDiagramTitle:I,getDiagramTitle:_,getAccDescription:R,setAccDescription:O},tt=i(r=>{F(r,$);let{axes:t,curves:e,options:a}=r;$.setAxes(t),$.setCurves(e),$.setOptions(a)},"populate"),et={parse:i(async r=>{let t=await D("radar",r);C.debug(t),tt(t)},"parse")},rt=i((r,t,e,a)=>{let n=a.db,l=n.getAxes(),c=n.getCurves(),o=n.getOptions(),s=n.getConfig(),d=n.getDiagramTitle(),m=E(t),p=at(m,s),u=o.max??Math.max(...c.map(f=>Math.max(...f.entries))),h=o.min,v=Math.min(s.width,s.height)/2;nt(p,l,v,o.ticks,o.graticule),ot(p,l,v,s),G(p,l,c,h,u,o.graticule,s),V(p,c,o.showLegend,s),p.append("text").attr("class","radarTitle").text(d).attr("x",0).attr("y",-s.height/2-s.marginTop)},"draw"),at=i((r,t)=>{let e=t.width+t.marginLeft+t.marginRight,a=t.height+t.marginTop+t.marginBottom,n={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return L(r,a,e,t.useMaxWidth??!0),r.attr("viewBox",`0 0 ${e} ${a}`).attr("overflow","visible"),r.append("g").attr("transform",`translate(${n.x}, ${n.y})`)},"drawFrame"),nt=i((r,t,e,a,n)=>{if(n==="circle")for(let l=0;l<a;l++){let c=e*(l+1)/a;r.append("circle").attr("r",c).attr("class","radarGraticule")}else if(n==="polygon"){let l=t.length;for(let c=0;c<a;c++){let o=e*(c+1)/a,s=t.map((d,m)=>{let p=2*m*Math.PI/l-Math.PI/2,u=o*Math.cos(p),h=o*Math.sin(p);return`${u},${h}`}).join(" ");r.append("polygon").attr("points",s).attr("class","radarGraticule")}}},"drawGraticule"),ot=i((r,t,e,a)=>{let n=t.length;for(let l=0;l<n;l++){let c=t[l].label,o=2*l*Math.PI/n-Math.PI/2,s=Math.cos(o),d=Math.sin(o);r.append("line").attr("x1",0).attr("y1",0).attr("x2",e*a.axisScaleFactor*s).attr("y2",e*a.axisScaleFactor*d).attr("class","radarAxisLine");let m=s>.01?"start":s<-.01?"end":"middle",p=d>.01?"hanging":d<-.01?"auto":"central",u=4;r.append("text").text(c).attr("x",e*a.axisLabelFactor*s+u*s).attr("y",e*a.axisLabelFactor*d+u*d).attr("text-anchor",m).attr("dominant-baseline",p).attr("class","radarAxisLabel")}},"drawAxes");function G(r,t,e,a,n,l,c){let o=t.length,s=Math.min(c.width,c.height)/2;e.forEach((d,m)=>{if(d.entries.length!==o)return;let p=d.entries.map((u,h)=>{let v=2*Math.PI*h/o-Math.PI/2,f=B(u,a,n,s),H=f*Math.cos(v),j=f*Math.sin(v);return{x:H,y:j}});l==="circle"?r.append("path").attr("d",W(p,c.curveTension)).attr("class",`radarCurve-${m}`):l==="polygon"&&r.append("polygon").attr("points",p.map(u=>`${u.x},${u.y}`).join(" ")).attr("class",`radarCurve-${m}`)})}i(G,"drawCurves");function B(r,t,e,a){let n=Math.min(Math.max(r,t),e);return a*(n-t)/(e-t)}i(B,"relativeRadius");function W(r,t){let e=r.length,a=`M${r[0].x},${r[0].y}`;for(let n=0;n<e;n++){let l=r[(n-1+e)%e],c=r[n],o=r[(n+1)%e],s=r[(n+2)%e],d={x:c.x+(o.x-l.x)*t,y:c.y+(o.y-l.y)*t},m={x:o.x-(s.x-c.x)*t,y:o.y-(s.y-c.y)*t};a+=` C${d.x},${d.y} ${m.x},${m.y} ${o.x},${o.y}`}return`${a} Z`}i(W,"closedRoundCurve");function V(r,t,e,a){if(!e)return;let n=(a.width/2+a.marginRight)*3/4,l=-(a.height/2+a.marginTop)*3/4,c=20;t.forEach((o,s)=>{let d=r.append("g").attr("transform",`translate(${n}, ${l+s*c})`);d.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${s}`),d.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(o.label)})}i(V,"drawLegend");var st={draw:rt},it=i((r,t)=>{let e="";for(let a=0;a<r.THEME_COLOR_LIMIT;a++){let n=r[`cScale${a}`];e+=`
		.radarCurve-${a} {
			color: ${n};
			fill: ${n};
			fill-opacity: ${t.curveOpacity};
			stroke: ${n};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${a} {
			fill: ${n};
			fill-opacity: ${t.curveOpacity};
			stroke: ${n};
		}
		`}return e},"genIndexStyles"),lt=i(r=>{let t=A(),e=b(),a=y(t,e.themeVariables),n=y(a.radar,r);return{themeVariables:a,radarOptions:n}},"buildRadarStyleOptions"),ct=i(({radar:r}={})=>{let{themeVariables:t,radarOptions:e}=lt(r);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${e.axisColor};
		stroke-width: ${e.axisStrokeWidth};
	}
	.radarAxisLabel {
		font-size: ${e.axisLabelFontSize}px;
		color: ${e.axisColor};
	}
	.radarGraticule {
		fill: ${e.graticuleColor};
		fill-opacity: ${e.graticuleOpacity};
		stroke: ${e.graticuleColor};
		stroke-width: ${e.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${e.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${it(t,e)}
	`},"styles"),Et={parser:et,db:$,renderer:st,styles:ct};export{Et as diagram};
