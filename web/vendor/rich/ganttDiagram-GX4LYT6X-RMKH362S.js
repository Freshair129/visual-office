import{q as De}from"./chunk-M3AFWGK6.js";import{a as _e}from"./chunk-UKQETAB3.js";import{$ as ct,O as ke,P as ye,U as ge,V as pe,W as ve,X as Te,Y as be,Z as xe,_ as we}from"./chunk-VCO4YYVS.js";import{A as Wt,B as Pt,C as me,a as $t,b as K,d as ee,e as se,f as ie,g as re,h as vt,i as ne,n as ae,o as Yt,p as Lt,q as At,r as Ft,s as Ot,t as oe,u as ce,v as le,w as ue,x as de,y as fe,z as he}from"./chunk-UF6SHU3I.js";import{a as o,c as pt,e as nt}from"./chunk-UPPDABHK.js";import"./chunk-I7AUKTXE.js";var Ve=pt({"../../node_modules/.pnpm/dayjs@1.11.21/node_modules/dayjs/plugin/isoWeek.js"(t,s){"use strict";(function(i,e){typeof t=="object"&&typeof s<"u"?s.exports=e():typeof define=="function"&&define.amd?define(e):(i=typeof globalThis<"u"?globalThis:i||self).dayjs_plugin_isoWeek=e()})(t,(function(){"use strict";var i="day";return function(e,a,g){var p=o(function(F){return F.add(4-F.isoWeekday(),i)},"a"),x=a.prototype;x.isoWeekYear=function(){return p(this).year()},x.isoWeek=function(F){if(!this.$utils().u(F))return this.add(7*(F-this.isoWeek()),i);var w,O,$,j,R=p(this),z=(w=this.isoWeekYear(),O=this.$u,$=(O?g.utc:g)().year(w).startOf("year"),j=4-$.isoWeekday(),$.isoWeekday()>4&&(j+=7),$.add(j,i));return R.diff(z,"week")+1},x.isoWeekday=function(F){return this.$utils().u(F)?this.day()||7:this.day(this.day()%7?F:F-7)};var Y=x.startOf;x.startOf=function(F,w){var O=this.$utils(),$=!!O.u(w)||w;return O.p(F)==="isoweek"?$?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):Y.bind(this)(F,w)}}}))}}),ze=pt({"../../node_modules/.pnpm/dayjs@1.11.21/node_modules/dayjs/plugin/customParseFormat.js"(t,s){"use strict";(function(i,e){typeof t=="object"&&typeof s<"u"?s.exports=e():typeof define=="function"&&define.amd?define(e):(i=typeof globalThis<"u"?globalThis:i||self).dayjs_plugin_customParseFormat=e()})(t,(function(){"use strict";var i={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},e=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,a=/\d/,g=/\d\d/,p=/\d\d?/,x=/\d*[^-_:/,()\s\d]+/,Y={},F=o(function(k){return(k=+k)+(k>68?1900:2e3)},"a"),w=o(function(k){return function(C){this[k]=+C}},"f"),O=[/[+-]\d\d:?(\d\d)?|Z/,function(k){(this.zone||(this.zone={})).offset=(function(C){if(!C||C==="Z")return 0;var P=C.match(/([+-]|\d\d)/g),L=60*P[1]+(+P[2]||0);return L===0?0:P[0]==="+"?-L:L})(k)}],$=o(function(k){var C=Y[k];return C&&(C.indexOf?C:C.s.concat(C.f))},"u"),j=o(function(k,C){var P,L=Y.meridiem;if(L){for(var U=1;U<=24;U+=1)if(k.indexOf(L(U,0,C))>-1){P=U>12;break}}else P=k===(C?"pm":"PM");return P},"d"),R={A:[x,function(k){this.afternoon=j(k,!1)}],a:[x,function(k){this.afternoon=j(k,!0)}],Q:[a,function(k){this.month=3*(k-1)+1}],S:[a,function(k){this.milliseconds=100*+k}],SS:[g,function(k){this.milliseconds=10*+k}],SSS:[/\d{3}/,function(k){this.milliseconds=+k}],s:[p,w("seconds")],ss:[p,w("seconds")],m:[p,w("minutes")],mm:[p,w("minutes")],H:[p,w("hours")],h:[p,w("hours")],HH:[p,w("hours")],hh:[p,w("hours")],D:[p,w("day")],DD:[g,w("day")],Do:[x,function(k){var C=Y.ordinal,P=k.match(/\d+/);if(this.day=P[0],C)for(var L=1;L<=31;L+=1)C(L).replace(/\[|\]/g,"")===k&&(this.day=L)}],w:[p,w("week")],ww:[g,w("week")],M:[p,w("month")],MM:[g,w("month")],MMM:[x,function(k){var C=$("months"),P=($("monthsShort")||C.map((function(L){return L.slice(0,3)}))).indexOf(k)+1;if(P<1)throw new Error;this.month=P%12||P}],MMMM:[x,function(k){var C=$("months").indexOf(k)+1;if(C<1)throw new Error;this.month=C%12||C}],Y:[/[+-]?\d+/,w("year")],YY:[g,function(k){this.year=F(k)}],YYYY:[/\d{4}/,w("year")],Z:O,ZZ:O};function z(k){var C,P;C=k,P=Y&&Y.formats;for(var L=(k=C.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,(function(m,T,v){var y=v&&v.toUpperCase();return T||P[v]||i[v]||P[y].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,(function(n,d,f){return d||f.slice(1)}))}))).match(e),U=L.length,G=0;G<U;G+=1){var I=L[G],b=R[I],h=b&&b[0],E=b&&b[1];L[G]=E?{regex:h,parser:E}:I.replace(/^\[|\]$/g,"")}return function(m){for(var T={},v=0,y=0;v<U;v+=1){var n=L[v];if(typeof n=="string")y+=n.length;else{var d=n.regex,f=n.parser,u=m.slice(y),_=d.exec(u)[0];f.call(T,_),m=m.replace(_,"")}}return(function(r){var S=r.afternoon;if(S!==void 0){var c=r.hours;S?c<12&&(r.hours+=12):c===12&&(r.hours=0),delete r.afternoon}})(T),T}}return o(z,"l"),function(k,C,P){P.p.customParseFormat=!0,k&&k.parseTwoDigitYear&&(F=k.parseTwoDigitYear);var L=C.prototype,U=L.parse;L.parse=function(G){var I=G.date,b=G.utc,h=G.args;this.$u=b;var E=h[1];if(typeof E=="string"){var m=h[2]===!0,T=h[3]===!0,v=m||T,y=h[2];T&&(y=h[2]),Y=this.$locale(),!m&&y&&(Y=P.Ls[y]),this.$d=(function(u,_,r,S){try{if(["x","X"].indexOf(_)>-1)return new Date((_==="X"?1e3:1)*u);var c=z(_)(u),B=c.year,l=c.month,D=c.day,M=c.hours,V=c.minutes,N=c.seconds,A=c.milliseconds,W=c.zone,rt=c.week,et=new Date,yt=D||(B||l?1:et.getDate()),gt=B||et.getFullYear(),at=0;B&&!l||(at=l>0?l-1:et.getMonth());var H,ot=M||0,J=V||0,X=N||0,xt=A||0;return W?new Date(Date.UTC(gt,at,yt,ot,J,X,xt+60*W.offset*1e3)):r?new Date(Date.UTC(gt,at,yt,ot,J,X,xt)):(H=new Date(gt,at,yt,ot,J,X,xt),rt&&(H=S(H).week(rt).toDate()),H)}catch{return new Date("")}})(I,E,b,P),this.init(),y&&y!==!0&&(this.$L=this.locale(y).$L),v&&I!=this.format(E)&&(this.$d=new Date("")),Y={}}else if(E instanceof Array)for(var n=E.length,d=1;d<=n;d+=1){h[1]=E[d-1];var f=P.apply(this,h);if(f.isValid()){this.$d=f.$d,this.$L=f.$L,this.init();break}d===n&&(this.$d=new Date(""))}else U.call(this,G)}}}))}}),Ne=pt({"../../node_modules/.pnpm/dayjs@1.11.21/node_modules/dayjs/plugin/advancedFormat.js"(t,s){"use strict";(function(i,e){typeof t=="object"&&typeof s<"u"?s.exports=e():typeof define=="function"&&define.amd?define(e):(i=typeof globalThis<"u"?globalThis:i||self).dayjs_plugin_advancedFormat=e()})(t,(function(){"use strict";return function(i,e){var a=e.prototype,g=a.format;a.format=function(p){var x=this,Y=this.$locale();if(!this.isValid())return g.bind(this)(p);var F=this.$utils(),w=(p||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,(function(O){switch(O){case"Q":return Math.ceil((x.$M+1)/3);case"Do":return Y.ordinal(x.$D);case"gggg":return x.weekYear();case"GGGG":return x.isoWeekYear();case"wo":return Y.ordinal(x.week(),"W");case"w":case"ww":return F.s(x.week(),O==="w"?1:2,"0");case"W":case"WW":return F.s(x.isoWeek(),O==="W"?1:2,"0");case"k":case"kk":return F.s(String(x.$H===0?24:x.$H),O==="k"?1:2,"0");case"X":return Math.floor(x.$d.getTime()/1e3);case"x":return x.$d.getTime();case"z":return"["+x.offsetName()+"]";case"zzz":return"["+x.offsetName("long")+"]";default:return O}}));return g.bind(this)(w)}}}))}}),Re=pt({"../../node_modules/.pnpm/dayjs@1.11.21/node_modules/dayjs/plugin/duration.js"(t,s){"use strict";(function(i,e){typeof t=="object"&&typeof s<"u"?s.exports=e():typeof define=="function"&&define.amd?define(e):(i=typeof globalThis<"u"?globalThis:i||self).dayjs_plugin_duration=e()})(t,(function(){"use strict";var i,e,a=1e3,g=6e4,p=36e5,x=864e5,Y=31536e6,F=2628e6,w=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,O=/\[([^\]]+)]|YYYY|YY|Y|M{1,2}|D{1,2}|H{1,2}|m{1,2}|s{1,2}|SSS/g,$={years:Y,months:F,days:x,hours:p,minutes:g,seconds:a,milliseconds:1,weeks:6048e5},j=o(function(I){return I instanceof U},"c"),R=o(function(I,b,h){return new U(I,h,b.$l)},"f"),z=o(function(I){return e.p(I)+"s"},"m"),k=o(function(I){return I<0},"l"),C=o(function(I){return k(I)?Math.ceil(I):Math.floor(I)},"$"),P=o(function(I){return Math.abs(I)},"y"),L=o(function(I,b){return I?k(I)?{negative:!0,format:""+P(I)+b}:{negative:!1,format:""+I+b}:{negative:!1,format:""}},"v"),U=(function(){function I(h,E,m){var T=this;if(this.$d={},this.$l=m,h===void 0&&(this.$ms=0,this.parseFromMilliseconds()),E)return R(h*$[z(E)],this);if(typeof h=="number")return this.$ms=h,this.parseFromMilliseconds(),this;if(typeof h=="object")return Object.keys(h).forEach((function(n){T.$d[z(n)]=h[n]})),this.calMilliseconds(),this;if(typeof h=="string"){var v=h.match(w);if(v){var y=v.slice(2).map((function(n){return n!=null?Number(n):0}));return this.$d.years=y[0],this.$d.months=y[1],this.$d.weeks=y[2],this.$d.days=y[3],this.$d.hours=y[4],this.$d.minutes=y[5],this.$d.seconds=y[6],this.calMilliseconds(),this}}return this}o(I,"l");var b=I.prototype;return b.calMilliseconds=function(){var h=this;this.$ms=Object.keys(this.$d).reduce((function(E,m){return E+(h.$d[m]||0)*$[m]}),0)},b.parseFromMilliseconds=function(){var h=this.$ms;this.$d.years=C(h/Y),h%=Y,this.$d.months=C(h/F),h%=F,this.$d.days=C(h/x),h%=x,this.$d.hours=C(h/p),h%=p,this.$d.minutes=C(h/g),h%=g,this.$d.seconds=C(h/a),h%=a,this.$d.milliseconds=h},b.toISOString=function(){var h=L(this.$d.years,"Y"),E=L(this.$d.months,"M"),m=+this.$d.days||0;this.$d.weeks&&(m+=7*this.$d.weeks);var T=L(m,"D"),v=L(this.$d.hours,"H"),y=L(this.$d.minutes,"M"),n=this.$d.seconds||0;this.$d.milliseconds&&(n+=this.$d.milliseconds/1e3,n=Math.round(1e3*n)/1e3);var d=L(n,"S"),f=h.negative||E.negative||T.negative||v.negative||y.negative||d.negative,u=v.format||y.format||d.format?"T":"",_=(f?"-":"")+"P"+h.format+E.format+T.format+u+v.format+y.format+d.format;return _==="P"||_==="-P"?"P0D":_},b.toJSON=function(){return this.toISOString()},b.format=function(h){var E=h||"YYYY-MM-DDTHH:mm:ss",m={Y:this.$d.years,YY:e.s(this.$d.years,2,"0"),YYYY:e.s(this.$d.years,4,"0"),M:this.$d.months,MM:e.s(this.$d.months,2,"0"),D:this.$d.days,DD:e.s(this.$d.days,2,"0"),H:this.$d.hours,HH:e.s(this.$d.hours,2,"0"),m:this.$d.minutes,mm:e.s(this.$d.minutes,2,"0"),s:this.$d.seconds,ss:e.s(this.$d.seconds,2,"0"),SSS:e.s(this.$d.milliseconds,3,"0")};return E.replace(O,(function(T,v){return v||String(m[T])}))},b.as=function(h){return this.$ms/$[z(h)]},b.get=function(h){var E=this.$ms,m=z(h);return m==="milliseconds"?E%=1e3:E=m==="weeks"?C(E/$[m]):this.$d[m],E||0},b.add=function(h,E,m){var T;return T=E?h*$[z(E)]:j(h)?h.$ms:R(h,this).$ms,R(this.$ms+T*(m?-1:1),this)},b.subtract=function(h,E){return this.add(h,E,!0)},b.locale=function(h){var E=this.clone();return E.$l=h,E},b.clone=function(){return R(this.$ms,this)},b.humanize=function(h){return i().add(this.$ms,"ms").locale(this.$l).fromNow(!h)},b.valueOf=function(){return this.asMilliseconds()},b.milliseconds=function(){return this.get("milliseconds")},b.asMilliseconds=function(){return this.as("milliseconds")},b.seconds=function(){return this.get("seconds")},b.asSeconds=function(){return this.as("seconds")},b.minutes=function(){return this.get("minutes")},b.asMinutes=function(){return this.as("minutes")},b.hours=function(){return this.get("hours")},b.asHours=function(){return this.as("hours")},b.days=function(){return this.get("days")},b.asDays=function(){return this.as("days")},b.weeks=function(){return this.get("weeks")},b.asWeeks=function(){return this.as("weeks")},b.months=function(){return this.get("months")},b.asMonths=function(){return this.as("months")},b.years=function(){return this.get("years")},b.asYears=function(){return this.as("years")},I})(),G=o(function(I,b,h){return I.add(b.years()*h,"y").add(b.months()*h,"M").add(b.days()*h,"d").add(b.hours()*h,"h").add(b.minutes()*h,"m").add(b.seconds()*h,"s").add(b.milliseconds()*h,"ms")},"p");return function(I,b,h){i=h,e=h().$utils(),h.duration=function(T,v){var y=h.locale();return R(T,{$l:y},v)},h.isDuration=j;var E=b.prototype.add,m=b.prototype.subtract;b.prototype.add=function(T,v){return j(T)?G(this,T,1):E.bind(this)(T,v)},b.prototype.subtract=function(T,v){return j(T)?G(this,T,-1):m.bind(this)(T,v)}}}))}}),zt=(function(){var t=o(function(y,n,d,f){for(d=d||{},f=y.length;f--;d[y[f]]=n);return d},"o"),s=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],i=[1,26],e=[1,27],a=[1,28],g=[1,29],p=[1,30],x=[1,31],Y=[1,32],F=[1,33],w=[1,34],O=[1,9],$=[1,10],j=[1,11],R=[1,12],z=[1,13],k=[1,14],C=[1,15],P=[1,16],L=[1,19],U=[1,20],G=[1,21],I=[1,22],b=[1,23],h=[1,25],E=[1,35],m={trace:o(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:o(function(n,d,f,u,_,r,S){var c=r.length-1;switch(_){case 1:return r[c-1];case 2:this.$=[];break;case 3:r[c-1].push(r[c]),this.$=r[c-1];break;case 4:case 5:this.$=r[c];break;case 6:case 7:this.$=[];break;case 8:u.setWeekday("monday");break;case 9:u.setWeekday("tuesday");break;case 10:u.setWeekday("wednesday");break;case 11:u.setWeekday("thursday");break;case 12:u.setWeekday("friday");break;case 13:u.setWeekday("saturday");break;case 14:u.setWeekday("sunday");break;case 15:u.setWeekend("friday");break;case 16:u.setWeekend("saturday");break;case 17:u.setDateFormat(r[c].substr(11)),this.$=r[c].substr(11);break;case 18:u.enableInclusiveEndDates(),this.$=r[c].substr(18);break;case 19:u.TopAxis(),this.$=r[c].substr(8);break;case 20:u.setAxisFormat(r[c].substr(11)),this.$=r[c].substr(11);break;case 21:u.setTickInterval(r[c].substr(13)),this.$=r[c].substr(13);break;case 22:u.setExcludes(r[c].substr(9)),this.$=r[c].substr(9);break;case 23:u.setIncludes(r[c].substr(9)),this.$=r[c].substr(9);break;case 24:u.setTodayMarker(r[c].substr(12)),this.$=r[c].substr(12);break;case 27:u.setDiagramTitle(r[c].substr(6)),this.$=r[c].substr(6);break;case 28:this.$=r[c].trim(),u.setAccTitle(this.$);break;case 29:case 30:this.$=r[c].trim(),u.setAccDescription(this.$);break;case 31:u.addSection(r[c].substr(8)),this.$=r[c].substr(8);break;case 33:u.addTask(r[c-1],r[c]),this.$="task";break;case 34:this.$=r[c-1],u.setClickEvent(r[c-1],r[c],null);break;case 35:this.$=r[c-2],u.setClickEvent(r[c-2],r[c-1],r[c]);break;case 36:this.$=r[c-2],u.setClickEvent(r[c-2],r[c-1],null),u.setLink(r[c-2],r[c]);break;case 37:this.$=r[c-3],u.setClickEvent(r[c-3],r[c-2],r[c-1]),u.setLink(r[c-3],r[c]);break;case 38:this.$=r[c-2],u.setClickEvent(r[c-2],r[c],null),u.setLink(r[c-2],r[c-1]);break;case 39:this.$=r[c-3],u.setClickEvent(r[c-3],r[c-1],r[c]),u.setLink(r[c-3],r[c-2]);break;case 40:this.$=r[c-1],u.setLink(r[c-1],r[c]);break;case 41:case 47:this.$=r[c-1]+" "+r[c];break;case 42:case 43:case 45:this.$=r[c-2]+" "+r[c-1]+" "+r[c];break;case 44:case 46:this.$=r[c-3]+" "+r[c-2]+" "+r[c-1]+" "+r[c];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(s,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:i,13:e,14:a,15:g,16:p,17:x,18:Y,19:18,20:F,21:w,22:O,23:$,24:j,25:R,26:z,27:k,28:C,29:P,30:L,31:U,33:G,35:I,36:b,37:24,38:h,40:E},t(s,[2,7],{1:[2,1]}),t(s,[2,3]),{9:36,11:17,12:i,13:e,14:a,15:g,16:p,17:x,18:Y,19:18,20:F,21:w,22:O,23:$,24:j,25:R,26:z,27:k,28:C,29:P,30:L,31:U,33:G,35:I,36:b,37:24,38:h,40:E},t(s,[2,5]),t(s,[2,6]),t(s,[2,17]),t(s,[2,18]),t(s,[2,19]),t(s,[2,20]),t(s,[2,21]),t(s,[2,22]),t(s,[2,23]),t(s,[2,24]),t(s,[2,25]),t(s,[2,26]),t(s,[2,27]),{32:[1,37]},{34:[1,38]},t(s,[2,30]),t(s,[2,31]),t(s,[2,32]),{39:[1,39]},t(s,[2,8]),t(s,[2,9]),t(s,[2,10]),t(s,[2,11]),t(s,[2,12]),t(s,[2,13]),t(s,[2,14]),t(s,[2,15]),t(s,[2,16]),{41:[1,40],43:[1,41]},t(s,[2,4]),t(s,[2,28]),t(s,[2,29]),t(s,[2,33]),t(s,[2,34],{42:[1,42],43:[1,43]}),t(s,[2,40],{41:[1,44]}),t(s,[2,35],{43:[1,45]}),t(s,[2,36]),t(s,[2,38],{42:[1,46]}),t(s,[2,37]),t(s,[2,39])],defaultActions:{},parseError:o(function(n,d){if(d.recoverable)this.trace(n);else{var f=new Error(n);throw f.hash=d,f}},"parseError"),parse:o(function(n){var d=this,f=[0],u=[],_=[null],r=[],S=this.table,c="",B=0,l=0,D=0,M=2,V=1,N=r.slice.call(arguments,1),A=Object.create(this.lexer),W={yy:{}};for(var rt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,rt)&&(W.yy[rt]=this.yy[rt]);A.setInput(n,W.yy),W.yy.lexer=A,W.yy.parser=this,typeof A.yylloc>"u"&&(A.yylloc={});var et=A.yylloc;r.push(et);var yt=A.options&&A.options.ranges;typeof W.yy.parseError=="function"?this.parseError=W.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function gt(Z){f.length=f.length-2*Z,_.length=_.length-Z,r.length=r.length-Z}o(gt,"popStack");function at(){var Z;return Z=u.pop()||A.lex()||V,typeof Z!="number"&&(Z instanceof Array&&(u=Z,Z=u.pop()),Z=d.symbols_[Z]||Z),Z}o(at,"lex");for(var H,ot,J,X,xt,wt,ut={},_t,st,te,Dt;;){if(J=f[f.length-1],this.defaultActions[J]?X=this.defaultActions[J]:((H===null||typeof H>"u")&&(H=at()),X=S[J]&&S[J][H]),typeof X>"u"||!X.length||!X[0]){var It="";Dt=[];for(_t in S[J])this.terminals_[_t]&&_t>M&&Dt.push("'"+this.terminals_[_t]+"'");A.showPosition?It="Parse error on line "+(B+1)+`:
`+A.showPosition()+`
Expecting `+Dt.join(", ")+", got '"+(this.terminals_[H]||H)+"'":It="Parse error on line "+(B+1)+": Unexpected "+(H==V?"end of input":"'"+(this.terminals_[H]||H)+"'"),this.parseError(It,{text:A.match,token:this.terminals_[H]||H,line:A.yylineno,loc:et,expected:Dt})}if(X[0]instanceof Array&&X.length>1)throw new Error("Parse Error: multiple actions possible at state: "+J+", token: "+H);switch(X[0]){case 1:f.push(H),_.push(A.yytext),r.push(A.yylloc),f.push(X[1]),H=null,ot?(H=ot,ot=null):(l=A.yyleng,c=A.yytext,B=A.yylineno,et=A.yylloc,D>0&&D--);break;case 2:if(st=this.productions_[X[1]][1],ut.$=_[_.length-st],ut._$={first_line:r[r.length-(st||1)].first_line,last_line:r[r.length-1].last_line,first_column:r[r.length-(st||1)].first_column,last_column:r[r.length-1].last_column},yt&&(ut._$.range=[r[r.length-(st||1)].range[0],r[r.length-1].range[1]]),wt=this.performAction.apply(ut,[c,l,B,W.yy,X[1],_,r].concat(N)),typeof wt<"u")return wt;st&&(f=f.slice(0,-1*st*2),_=_.slice(0,-1*st),r=r.slice(0,-1*st)),f.push(this.productions_[X[1]][0]),_.push(ut.$),r.push(ut._$),te=S[f[f.length-2]][f[f.length-1]],f.push(te);break;case 3:return!0}}return!0},"parse")},T=(function(){var y={EOF:1,parseError:o(function(d,f){if(this.yy.parser)this.yy.parser.parseError(d,f);else throw new Error(d)},"parseError"),setInput:o(function(n,d){return this.yy=d||this.yy||{},this._input=n,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:o(function(){var n=this._input[0];this.yytext+=n,this.yyleng++,this.offset++,this.match+=n,this.matched+=n;var d=n.match(/(?:\r\n?|\n).*/g);return d?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),n},"input"),unput:o(function(n){var d=n.length,f=n.split(/(?:\r\n?|\n)/g);this._input=n+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-d),this.offset-=d;var u=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),f.length-1&&(this.yylineno-=f.length-1);var _=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:f?(f.length===u.length?this.yylloc.first_column:0)+u[u.length-f.length].length-f[0].length:this.yylloc.first_column-d},this.options.ranges&&(this.yylloc.range=[_[0],_[0]+this.yyleng-d]),this.yyleng=this.yytext.length,this},"unput"),more:o(function(){return this._more=!0,this},"more"),reject:o(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:o(function(n){this.unput(this.match.slice(n))},"less"),pastInput:o(function(){var n=this.matched.substr(0,this.matched.length-this.match.length);return(n.length>20?"...":"")+n.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:o(function(){var n=this.match;return n.length<20&&(n+=this._input.substr(0,20-n.length)),(n.substr(0,20)+(n.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:o(function(){var n=this.pastInput(),d=new Array(n.length+1).join("-");return n+this.upcomingInput()+`
`+d+"^"},"showPosition"),test_match:o(function(n,d){var f,u,_;if(this.options.backtrack_lexer&&(_={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(_.yylloc.range=this.yylloc.range.slice(0))),u=n[0].match(/(?:\r\n?|\n).*/g),u&&(this.yylineno+=u.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:u?u[u.length-1].length-u[u.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+n[0].length},this.yytext+=n[0],this.match+=n[0],this.matches=n,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(n[0].length),this.matched+=n[0],f=this.performAction.call(this,this.yy,this,d,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),f)return f;if(this._backtrack){for(var r in _)this[r]=_[r];return!1}return!1},"test_match"),next:o(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var n,d,f,u;this._more||(this.yytext="",this.match="");for(var _=this._currentRules(),r=0;r<_.length;r++)if(f=this._input.match(this.rules[_[r]]),f&&(!d||f[0].length>d[0].length)){if(d=f,u=r,this.options.backtrack_lexer){if(n=this.test_match(f,_[r]),n!==!1)return n;if(this._backtrack){d=!1;continue}else return!1}else if(!this.options.flex)break}return d?(n=this.test_match(d,_[u]),n!==!1?n:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:o(function(){var d=this.next();return d||this.lex()},"lex"),begin:o(function(d){this.conditionStack.push(d)},"begin"),popState:o(function(){var d=this.conditionStack.length-1;return d>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:o(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:o(function(d){return d=this.conditionStack.length-1-Math.abs(d||0),d>=0?this.conditionStack[d]:"INITIAL"},"topState"),pushState:o(function(d){this.begin(d)},"pushState"),stateStackSize:o(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:o(function(d,f,u,_){var r=_;switch(u){case 0:return this.begin("open_directive"),"open_directive";break;case 1:return this.begin("acc_title"),31;break;case 2:return this.popState(),"acc_title_value";break;case 3:return this.begin("acc_descr"),33;break;case 4:return this.popState(),"acc_descr_value";break;case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return y})();m.lexer=T;function v(){this.yy={}}return o(v,"Parser"),v.prototype=m,m.Parser=v,new v})();zt.parser=zt;var je=zt,Be=nt(_e(),1),Q=nt($t(),1),He=nt(Ve(),1),Ge=nt(ze(),1),qe=nt(Ne(),1);Q.default.extend(He.default);Q.default.extend(Ge.default);Q.default.extend(qe.default);var Se={friday:5,saturday:6},tt="",Bt="",Ht=void 0,Gt="",ht=[],mt=[],qt=new Map,Ut=[],Mt=[],kt="",Xt="",Ee=["active","done","crit","milestone","vert"],Zt=[],dt="",bt=!1,Qt=!1,Jt="sunday",Et="saturday",Nt=0,Ue=o(function(){Ut=[],Mt=[],kt="",Zt=[],St=0,jt=void 0,Ct=void 0,q=[],tt="",Bt="",Xt="",Ht=void 0,Gt="",ht=[],mt=[],bt=!1,Qt=!1,Nt=0,qt=new Map,dt="",ge(),Jt="sunday",Et="saturday"},"clear"),Xe=o(function(t){dt=t},"setDiagramId"),Ze=o(function(t){Bt=t},"setAxisFormat"),Qe=o(function(){return Bt},"getAxisFormat"),Je=o(function(t){Ht=t},"setTickInterval"),Ke=o(function(){return Ht},"getTickInterval"),ts=o(function(t){Gt=t},"setTodayMarker"),es=o(function(){return Gt},"getTodayMarker"),ss=o(function(t){tt=t},"setDateFormat"),is=o(function(){bt=!0},"enableInclusiveEndDates"),rs=o(function(){return bt},"endDatesAreInclusive"),ns=o(function(){Qt=!0},"enableTopAxis"),as=o(function(){return Qt},"topAxisEnabled"),os=o(function(t){Xt=t},"setDisplayMode"),cs=o(function(){return Xt},"getDisplayMode"),ls=o(function(){return tt},"getDateFormat"),Ie=o((t,s)=>{let i=s.toLowerCase().split(/[\s,]+/).filter(e=>e!=="");return[...new Set([...t,...i])]},"mergeTokens"),us=o(function(t){ht=Ie(ht,t)},"setIncludes"),ds=o(function(){return ht},"getIncludes"),fs=o(function(t){mt=Ie(mt,t)},"setExcludes"),hs=o(function(){return mt},"getExcludes"),ms=o(function(){return qt},"getLinks"),ks=o(function(t){kt=t,Ut.push(t)},"addSection"),ys=o(function(){return Ut},"getSections"),gs=o(function(){let t=Ce(),s=10,i=0;for(;!t&&i<s;)t=Ce(),i++;return Mt=q,Mt},"getTasks"),$e=o(function(t,s,i,e){let a=t.format(s.trim()),g=t.format("YYYY-MM-DD");return e.includes(a)||e.includes(g)?!1:i.includes("weekends")&&(t.isoWeekday()===Se[Et]||t.isoWeekday()===Se[Et]+1)||i.includes(t.format("dddd").toLowerCase())?!0:i.includes(a)||i.includes(g)},"isInvalidDate"),ps=o(function(t){Jt=t},"setWeekday"),vs=o(function(){return Jt},"getWeekday"),Ts=o(function(t){Et=t},"setWeekend"),Ye=o(function(t,s,i,e){if(!i.length||t.manualEndTime)return;let a;t.startTime instanceof Date?a=(0,Q.default)(t.startTime):a=(0,Q.default)(t.startTime,s,!0),a=a.add(1,"d");let g;t.endTime instanceof Date?g=(0,Q.default)(t.endTime):g=(0,Q.default)(t.endTime,s,!0);let[p,x]=bs(a,g,s,i,e);t.endTime=p.toDate(),t.renderEndTime=x},"checkTaskDates"),bs=o(function(t,s,i,e,a){let g=!1,p=null,x=s.add(1e4,"d");for(;t<=s;){if(g||(p=s.toDate()),g=$e(t,i,e,a),g&&(s=s.add(1,"d"),s>x))throw new Error("Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.");t=t.add(1,"d")}return[s,p]},"fixTaskDates"),Le=o(function(t,s){K.warn(`Gantt: the "${t}" statement references unknown task id(s): ${s.join(", ")}. Make sure the referenced tasks exist and declare an id. Milestones need both an id and a duration, e.g. "Milestone :milestone, m1, 2023-01-01, 0d".`)},"warnAboutUnknownTaskIds"),Rt=o(function(t,s,i){if(i=i.trim(),o(x=>{let Y=x.trim();return Y==="x"||Y==="X"},"isTimestampFormat")(s)&&/^\d+$/.test(i))return new Date(Number(i));let g=/^after\s+(?<ids>[\d\w- ]+)/.exec(i);if(g!==null){let x=null,Y=[],F=g.groups.ids.split(" ").filter(O=>O!=="");for(let O of F){let $=lt(O);if($===void 0){Y.push(O);continue}(!x||$.endTime>x.endTime)&&(x=$)}if(Y.length>0&&Le("after",Y),x)return x.endTime;let w=new Date;return w.setHours(0,0,0,0),w}let p=(0,Q.default)(i,s.trim(),!0);if(p.isValid())return p.toDate();{K.debug("Invalid date:"+i),K.debug("With date format:"+s.trim());let x=new Date(i);if(x===void 0||isNaN(x.getTime())||x.getFullYear()<-1e4||x.getFullYear()>1e4)throw new Error("Invalid date:"+i);return x}},"getStartDate"),Ae=o(function(t){let s=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return s!==null?[Number.parseFloat(s[1]),s[2]]:[NaN,"ms"]},"parseDuration"),Fe=o(function(t,s,i,e=!1){i=i.trim();let g=/^until\s+(?<ids>[\d\w- ]+)/.exec(i);if(g!==null){let w=null,O=[],$=g.groups.ids.split(" ").filter(R=>R!=="");for(let R of $){let z=lt(R);if(z===void 0){O.push(R);continue}(!w||z.startTime<w.startTime)&&(w=z)}if(O.length>0&&Le("until",O),w)return w.startTime;let j=new Date;return j.setHours(0,0,0,0),j}let p=(0,Q.default)(i,s.trim(),!0);if(p.isValid())return e&&(p=p.add(1,"d")),p.toDate();let x=(0,Q.default)(t),[Y,F]=Ae(i);if(Number.isNaN(Y))K.warn(`Gantt: "${i}" is neither a valid date for the "${s.trim()}" date format nor a valid duration (e.g. "3d"), so it is ignored and the task gets a zero duration. Milestones need a duration too, e.g. "Milestone :milestone, m1, 2023-01-01, 0d".`);else{let w=x.add(Y,F);w.isValid()&&(x=w)}return x.toDate()},"getEndDate"),St=0,ft=o(function(t){return t===void 0?(St=St+1,"task"+St):t},"parseId"),xs=o(function(t,s){let i;s.substr(0,1)===":"?i=s.substr(1,s.length):i=s;let e=i.split(","),a={};Kt(e,a,Ee);for(let p=0;p<e.length;p++)e[p]=e[p].trim();let g="";switch(e.length){case 1:a.id=ft(),a.startTime=t.endTime,g=e[0];break;case 2:a.id=ft(),a.startTime=Rt(void 0,tt,e[0]),g=e[1];break;case 3:a.id=ft(e[0]),a.startTime=Rt(void 0,tt,e[1]),g=e[2];break;default:}return g&&(a.endTime=Fe(a.startTime,tt,g,bt),a.manualEndTime=(0,Q.default)(g,"YYYY-MM-DD",!0).isValid(),Ye(a,tt,mt,ht)),a},"compileData"),ws=o(function(t,s){let i;s.substr(0,1)===":"?i=s.substr(1,s.length):i=s;let e=i.split(","),a={};Kt(e,a,Ee);for(let g=0;g<e.length;g++)e[g]=e[g].trim();switch(e.length){case 1:a.id=ft(),a.startTime={type:"prevTaskEnd",id:t},a.endTime={data:e[0]};break;case 2:a.id=ft(),a.startTime={type:"getStartDate",startData:e[0]},a.endTime={data:e[1]};break;case 3:a.id=ft(e[0]),a.startTime={type:"getStartDate",startData:e[1]},a.endTime={data:e[2]};break;default:}return a},"parseData"),jt,Ct,q=[],Oe={},_s=o(function(t,s){let i={section:kt,type:kt,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:s},task:t,classes:[]},e=ws(Ct,s);i.raw.startTime=e.startTime,i.raw.endTime=e.endTime,i.id=e.id,i.prevTaskId=Ct,i.active=e.active,i.done=e.done,i.crit=e.crit,i.milestone=e.milestone,i.vert=e.vert,i.vert?i.order=-1:(i.order=Nt,Nt++);let a=q.push(i);Ct=i.id,Oe[i.id]=a-1},"addTask"),lt=o(function(t){let s=Oe[t];return q[s]},"findTaskById"),Ds=o(function(t,s){let i={section:kt,type:kt,description:t,task:t,classes:[]},e=xs(jt,s);i.startTime=e.startTime,i.endTime=e.endTime,i.id=e.id,i.active=e.active,i.done=e.done,i.crit=e.crit,i.milestone=e.milestone,i.vert=e.vert,jt=i,Mt.push(i)},"addTaskOrg"),Ce=o(function(){let t=o(function(i){let e=q[i],a="";switch(q[i].raw.startTime.type){case"prevTaskEnd":{let g=lt(e.prevTaskId);e.startTime=g.endTime;break}case"getStartDate":a=Rt(void 0,tt,q[i].raw.startTime.startData),a&&(q[i].startTime=a);break}return q[i].startTime&&(q[i].endTime=Fe(q[i].startTime,tt,q[i].raw.endTime.data,bt),q[i].endTime&&(q[i].processed=!0,q[i].manualEndTime=(0,Q.default)(q[i].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),Ye(q[i],tt,mt,ht))),q[i].processed},"compileTask"),s=!0;for(let[i,e]of q.entries())t(i),s=s&&e.processed;return s},"compileTasks"),Ss=o(function(t,s){let i=s;ct().securityLevel!=="loose"&&(i=(0,Be.sanitizeUrl)(s)),t.split(",").forEach(function(e){lt(e)!==void 0&&(Pe(e,()=>{window.open(i,"_self")}),qt.set(e,i))}),We(t,"clickable")},"setLink"),We=o(function(t,s){t.split(",").forEach(function(i){let e=lt(i);e!==void 0&&e.classes.push(s)})},"setClass"),Cs=o(function(t,s,i){if(ct().securityLevel!=="loose"||s===void 0)return;let e=[];if(typeof i=="string"){e=i.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let g=0;g<e.length;g++){let p=e[g].trim();p.startsWith('"')&&p.endsWith('"')&&(p=p.substr(1,p.length-2)),e[g]=p}}e.length===0&&e.push(t),lt(t)!==void 0&&Pe(t,()=>{De.runFunc(s,...e)})},"setClickFun"),Pe=o(function(t,s){Zt.push(function(){let i=dt?`${dt}-${t}`:t,e=document.querySelector(`[id="${i}"]`);e!==null&&e.addEventListener("click",function(){s()})},function(){let i=dt?`${dt}-${t}`:t,e=document.querySelector(`[id="${i}-text"]`);e!==null&&e.addEventListener("click",function(){s()})})},"pushFun"),Ms=o(function(t,s,i){t.split(",").forEach(function(e){Cs(e,s,i)}),We(t,"clickable")},"setClickEvent"),Es=o(function(t){Zt.forEach(function(s){s(t)})},"bindFunctions"),Is={getConfig:o(()=>ct().gantt,"getConfig"),clear:Ue,setDateFormat:ss,getDateFormat:ls,enableInclusiveEndDates:is,endDatesAreInclusive:rs,enableTopAxis:ns,topAxisEnabled:as,setAxisFormat:Ze,getAxisFormat:Qe,setTickInterval:Je,getTickInterval:Ke,setTodayMarker:ts,getTodayMarker:es,setAccTitle:pe,getAccTitle:ve,setDiagramTitle:xe,getDiagramTitle:we,setDiagramId:Xe,setDisplayMode:os,getDisplayMode:cs,setAccDescription:Te,getAccDescription:be,addSection:ks,getSections:ys,getTasks:gs,addTask:_s,findTaskById:lt,addTaskOrg:Ds,setIncludes:us,getIncludes:ds,setExcludes:fs,getExcludes:hs,setClickEvent:Ms,setLink:Ss,getLinks:ms,bindFunctions:Es,parseDuration:Ae,isInvalidDate:$e,setWeekday:ps,getWeekday:vs,setWeekend:Ts};function Kt(t,s,i){let e=!0;for(;e;)e=!1,i.forEach(function(a){let g="^\\s*"+a+"\\s*$",p=new RegExp(g);t[0].match(p)&&(s[a]=!0,t.shift(1),e=!0)})}o(Kt,"getTaskTags");var Tt=nt($t(),1),$s=nt(Re(),1);Tt.default.extend($s.default);var Ys=o(function(){K.debug("Something is calling, setConf, remove the call")},"setConf"),Me={monday:ce,tuesday:le,wednesday:ue,thursday:de,friday:fe,saturday:he,sunday:oe},Ls=o((t,s)=>{let i=[...t].map(()=>-1/0),e=[...t].sort((g,p)=>g.startTime-p.startTime||g.order-p.order),a=0;for(let g of e)for(let p=0;p<i.length;p++)if(g.startTime>=i[p]){i[p]=g.endTime,g.order=p+s,p>a&&(a=p);break}return a},"getMaxIntersections"),it,Vt=1e4,As=o(function(t,s,i,e){let a=ct().gantt;e.db.setDiagramId(s);let g=ct().securityLevel,p;g==="sandbox"&&(p=vt("#i"+s));let x=g==="sandbox"?vt(p.nodes()[0].contentDocument.body):vt("body"),Y=g==="sandbox"?p.nodes()[0].contentDocument:document,F=Y.getElementById(s);it=F.parentElement.offsetWidth,it===void 0&&(it=1200),a.useWidth!==void 0&&(it=a.useWidth);let w=e.db.getTasks(),O=w.filter(m=>!m.vert),$=[];for(let m of O)$.push(m.type);$=E($);let j={},R=2*a.topPadding;if(e.db.getDisplayMode()==="compact"||a.displayMode==="compact"){let m={};for(let v of O)m[v.section]===void 0?m[v.section]=[v]:m[v.section].push(v);let T=0;for(let v of Object.keys(m)){let y=Ls(m[v],T)+1;T+=y,R+=y*(a.barHeight+a.barGap),j[v]=y}}else{R+=O.length*(a.barHeight+a.barGap);for(let m of $)j[m]=O.filter(T=>T.type===m).length}F.setAttribute("viewBox","0 0 "+it+" "+R);let z=x.select(`[id="${s}"]`),k=me().domain([se(w,function(m){return m.startTime}),ee(w,function(m){return m.endTime})]).rangeRound([0,it-a.leftPadding-a.rightPadding]);function C(m,T){let v=m.startTime,y=T.startTime,n=0;return v>y?n=1:v<y&&(n=-1),n}o(C,"taskCompare"),w.sort(C),P(w,it,R),ye(z,R,it,a.useMaxWidth),z.append("text").text(e.db.getDiagramTitle()).attr("x",it/2).attr("y",a.titleTopMargin).attr("class","titleText");function P(m,T,v){let y=a.barHeight,n=y+a.barGap,d=a.topPadding,f=a.leftPadding,u=ae().domain([0,$.length]).range(["#00B9FA","#F95002"]).interpolate(ne);U(n,d,f,T,v,m,e.db.getExcludes(),e.db.getIncludes()),I(f,d,T,v),L(m,n,d,f,y,u,T,v),b(n,d,f,y,u),h(f,d,T,v)}o(P,"makeGantt");function L(m,T,v,y,n,d,f){m.sort((l,D)=>l.vert===D.vert?0:l.vert?1:-1);let u=m.filter(l=>!l.vert),r=[...new Set(u.map(l=>l.order))].map(l=>u.find(D=>D.order===l));z.append("g").selectAll("rect").data(r).enter().append("rect").attr("x",0).attr("y",function(l,D){return D=l.order,D*T+v-2}).attr("width",function(){return f-a.rightPadding/2}).attr("height",T).attr("class",function(l){for(let[D,M]of $.entries())if(l.type===M)return"section section"+D%a.numberSectionStyles;return"section section0"}).enter();let S=z.append("g").selectAll("rect").data(m).enter(),c=e.db.getLinks();if(S.append("rect").attr("id",function(l){return s+"-"+l.id}).attr("rx",3).attr("ry",3).attr("x",function(l){return l.milestone?k(l.startTime)+y+.5*(k(l.endTime)-k(l.startTime))-.5*n:k(l.startTime)+y}).attr("y",function(l,D){return D=l.order,l.vert?a.gridLineStartPadding:D*T+v}).attr("width",function(l){return l.milestone?n:l.vert?.08*n:k(l.renderEndTime||l.endTime)-k(l.startTime)}).attr("height",function(l){return l.vert?u.length*(a.barHeight+a.barGap)+a.barHeight*2:n}).attr("transform-origin",function(l,D){return D=l.order,(k(l.startTime)+y+.5*(k(l.endTime)-k(l.startTime))).toString()+"px "+(D*T+v+.5*n).toString()+"px"}).attr("class",function(l){let D="task",M="";l.classes.length>0&&(M=l.classes.join(" "));let V=0;for(let[A,W]of $.entries())l.type===W&&(V=A%a.numberSectionStyles);let N="";return l.active?l.crit?N+=" activeCrit":N=" active":l.done?l.crit?N=" doneCrit":N=" done":l.crit&&(N+=" crit"),N.length===0&&(N=" task"),l.milestone&&(N=" milestone "+N),l.vert&&(N=" vert "+N),N+=V,N+=" "+M,D+N}),S.append("text").attr("id",function(l){return s+"-"+l.id+"-text"}).text(function(l){return l.task}).attr("font-size",a.fontSize).attr("x",function(l){let D=k(l.startTime),M=k(l.renderEndTime||l.endTime);if(l.milestone&&(D+=.5*(k(l.endTime)-k(l.startTime))-.5*n,M=D+n),l.vert)return k(l.startTime)+y;let V=this.getBBox().width;return V>M-D?M+V+1.5*a.leftPadding>f?D+y-5:M+y+5:(M-D)/2+D+y}).attr("y",function(l,D){return l.vert?a.gridLineStartPadding+u.length*(a.barHeight+a.barGap)+60:(D=l.order,D*T+a.barHeight/2+(a.fontSize/2-2)+v)}).attr("text-height",n).attr("class",function(l){let D=k(l.startTime),M=k(l.endTime);l.milestone&&(M=D+n);let V=this.getBBox().width,N="";l.classes.length>0&&(N=l.classes.join(" "));let A=0;for(let[rt,et]of $.entries())l.type===et&&(A=rt%a.numberSectionStyles);let W="";return l.active&&(l.crit?W="activeCritText"+A:W="activeText"+A),l.done?l.crit?W=W+" doneCritText"+A:W=W+" doneText"+A:l.crit&&(W=W+" critText"+A),l.milestone&&(W+=" milestoneText"),l.vert&&(W+=" vertText"),V>M-D?M+V+1.5*a.leftPadding>f?N+" taskTextOutsideLeft taskTextOutside"+A+" "+W:N+" taskTextOutsideRight taskTextOutside"+A+" "+W+" width-"+V:N+" taskText taskText"+A+" "+W+" width-"+V}),ct().securityLevel==="sandbox"){let l;l=vt("#i"+s);let D=l.nodes()[0].contentDocument;S.filter(function(M){return c.has(M.id)}).each(function(M){var V=D.querySelector("#"+CSS.escape(s+"-"+M.id)),N=D.querySelector("#"+CSS.escape(s+"-"+M.id+"-text"));let A=V.parentNode;var W=D.createElement("a");W.setAttribute("xlink:href",c.get(M.id)),W.setAttribute("target","_top"),A.appendChild(W),W.appendChild(V),W.appendChild(N)})}}o(L,"drawRects");function U(m,T,v,y,n,d,f,u){if(f.length===0&&u.length===0)return;let _,r;for(let{startTime:M,endTime:V}of d)(_===void 0||M<_)&&(_=M),(r===void 0||V>r)&&(r=V);if(!_||!r)return;if((0,Tt.default)(r).diff((0,Tt.default)(_),"year")>5){K.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}let S=e.db.getDateFormat(),c=[],B=null,l=(0,Tt.default)(_);for(;l.valueOf()<=r;)e.db.isInvalidDate(l,S,f,u)?B?B.end=l:B={start:l,end:l}:B&&(c.push(B),B=null),l=l.add(1,"d");z.append("g").selectAll("rect").data(c).enter().append("rect").attr("id",M=>s+"-exclude-"+M.start.format("YYYY-MM-DD")).attr("x",M=>k(M.start.startOf("day"))+v).attr("y",a.gridLineStartPadding).attr("width",M=>k(M.end.endOf("day"))-k(M.start.startOf("day"))).attr("height",n-T-a.gridLineStartPadding).attr("transform-origin",function(M,V){return(k(M.start)+v+.5*(k(M.end)-k(M.start))).toString()+"px "+(V*m+.5*n).toString()+"px"}).attr("class","exclude-range")}o(U,"drawExcludeDays");function G(m,T,v,y){if(v<=0||m>T)return 1/0;let n=T-m,d=Tt.default.duration({[y??"day"]:v}).asMilliseconds();return d<=0?1/0:Math.ceil(n/d)}o(G,"getEstimatedTickCount");function I(m,T,v,y){let n=e.db.getDateFormat(),d=e.db.getAxisFormat(),f;d?f=d:n==="D"?f="%d":f=a.axisFormat??"%Y-%m-%d";let u=re(k).tickSize(-y+T+a.gridLineStartPadding).tickFormat(Pt(f)),r=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(e.db.getTickInterval()||a.tickInterval);if(r!==null){let S=parseInt(r[1],10);if(isNaN(S)||S<=0)K.warn(`Invalid tick interval value: "${r[1]}". Skipping custom tick interval.`);else{let c=r[2],B=e.db.getWeekday()||a.weekday,l=k.domain(),D=l[0],M=l[1],V=G(D,M,S,c);if(V>Vt)K.warn(`The tick interval "${S}${c}" would generate ${V} ticks, which exceeds the maximum allowed (${Vt}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(c){case"millisecond":u.ticks(Yt.every(S));break;case"second":u.ticks(Lt.every(S));break;case"minute":u.ticks(At.every(S));break;case"hour":u.ticks(Ft.every(S));break;case"day":u.ticks(Ot.every(S));break;case"week":u.ticks(Me[B].every(S));break;case"month":u.ticks(Wt.every(S));break}}}if(z.append("g").attr("class","grid").attr("transform","translate("+m+", "+(y-50)+")").call(u).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),e.db.topAxisEnabled()||a.topAxis){let S=ie(k).tickSize(-y+T+a.gridLineStartPadding).tickFormat(Pt(f));if(r!==null){let c=parseInt(r[1],10);if(isNaN(c)||c<=0)K.warn(`Invalid tick interval value: "${r[1]}". Skipping custom tick interval.`);else{let B=r[2],l=e.db.getWeekday()||a.weekday,D=k.domain(),M=D[0],V=D[1];if(G(M,V,c,B)<=Vt)switch(B){case"millisecond":S.ticks(Yt.every(c));break;case"second":S.ticks(Lt.every(c));break;case"minute":S.ticks(At.every(c));break;case"hour":S.ticks(Ft.every(c));break;case"day":S.ticks(Ot.every(c));break;case"week":S.ticks(Me[l].every(c));break;case"month":S.ticks(Wt.every(c));break}}}z.append("g").attr("class","grid").attr("transform","translate("+m+", "+T+")").call(S).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}o(I,"makeGrid");function b(m,T){let v=0,y=Object.keys(j).map(n=>[n,j[n]]);z.append("g").selectAll("text").data(y).enter().append(function(n){let d=n[0].split(ke.lineBreakRegex),f=-(d.length-1)/2,u=Y.createElementNS("http://www.w3.org/2000/svg","text");u.setAttribute("dy",f+"em");for(let[_,r]of d.entries()){let S=Y.createElementNS("http://www.w3.org/2000/svg","tspan");S.setAttribute("alignment-baseline","central"),S.setAttribute("x","10"),_>0&&S.setAttribute("dy","1em"),S.textContent=r,u.appendChild(S)}return u}).attr("x",10).attr("y",function(n,d){if(d>0)for(let f=0;f<d;f++)return v+=y[d-1][1],n[1]*m/2+v*m+T;else return n[1]*m/2+T}).attr("font-size",a.sectionFontSize).attr("class",function(n){for(let[d,f]of $.entries())if(n[0]===f)return"sectionTitle sectionTitle"+d%a.numberSectionStyles;return"sectionTitle"})}o(b,"vertLabels");function h(m,T,v,y){let n=e.db.getTodayMarker();if(n==="off")return;let d=z.append("g").attr("class","today"),f=new Date,u=d.append("line");u.attr("x1",k(f)+m).attr("x2",k(f)+m).attr("y1",a.titleTopMargin).attr("y2",y-a.titleTopMargin).attr("class","today"),n!==""&&u.attr("style",n.replace(/,/g,";"))}o(h,"drawToday");function E(m){let T={},v=[];for(let y=0,n=m.length;y<n;++y)Object.prototype.hasOwnProperty.call(T,m[y])||(T[m[y]]=!0,v.push(m[y]));return v}o(E,"checkUnique")},"draw"),Fs={setConf:Ys,draw:As},Os=o(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done task text displayed outside the bar sits against the diagram background,
     not against the done-task bar, so it must use the outside/contrast color. */
  .doneText0.taskTextOutsideLeft,
  .doneText0.taskTextOutsideRight,
  .doneText1.taskTextOutsideLeft,
  .doneText1.taskTextOutsideRight,
  .doneText2.taskTextOutsideLeft,
  .doneText2.taskTextOutsideRight,
  .doneText3.taskTextOutsideLeft,
  .doneText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done-crit task text outside the bar \u2014 same reasoning as doneText above. */
  .doneCritText0.taskTextOutsideLeft,
  .doneCritText0.taskTextOutsideRight,
  .doneCritText1.taskTextOutsideLeft,
  .doneCritText1.taskTextOutsideRight,
  .doneCritText2.taskTextOutsideLeft,
  .doneCritText2.taskTextOutsideRight,
  .doneCritText3.taskTextOutsideLeft,
  .doneCritText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles"),Ws=Os,js={parser:je,db:Is,renderer:Fs,styles:Ws};export{js as diagram};
