const count=n=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
export function contextDisplay(capabilities,stale=false){
 const c=capabilities?.context;const valid=Number.isSafeInteger(c?.usedTokens)&&c.usedTokens>=0;
 const maximum=Number.isSafeInteger(c?.maxTokens)&&c.maxTokens>0?c.maxTokens:null;
 const percent=valid&&maximum?Math.round(c.usedTokens/maximum*1000)/10:null;
 return{model:capabilities?.model||'กำลังรอโมเดล',text:valid?'ctx '+(percent===null?count(c.usedTokens)+' tokens':percent+'% · '+count(c.usedTokens)+' / '+count(maximum))+(stale?' · ล่าสุด':''):'ctx · T3 ยังไม่รายงาน',percent,title:valid?'Context ที่ T3 รายงาน: '+c.usedTokens.toLocaleString()+(maximum?' / '+maximum.toLocaleString():'')+' tokens'+(c.updatedAt?' · '+c.updatedAt:''):'T3 ยังไม่ได้รายงานจำนวน tokens ของแชทนี้'};
}
