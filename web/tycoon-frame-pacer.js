// `0` uses the display's native cadence. `30` limits expensive scene renders.
// Simulation advances by elapsed rendered time, not by a fixed frame count.
export class FramePacer {
  constructor(rate=0){this.setRate(rate);}
  setRate(rate){if(rate!==0&&rate!==30)throw Error('Unsupported frame rate');this.rate=rate;this.last=null;this.next=null;}
  sample(time){
    if(!Number.isFinite(time))return null;
    if(this.last===null||time<this.last){this.last=time;this.next=this.rate?time+1000/this.rate:null;return 0;}
    // Rounded callback timestamps can fall just below an exact 1000/30 deadline.
    if(this.rate&&time+.5<this.next)return null;
    const dt=Math.min(.1,Math.max(0,(time-this.last)/1000));this.last=time;
    if(this.rate){const interval=1000/this.rate;this.next=time-this.next>interval*2?time+interval:this.next+interval;}
    return dt;
  }
}
