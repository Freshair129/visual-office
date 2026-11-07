// Standalone asset review embedded without navigating away from a floor draft.
export class CharacterLabDialog{
  constructor(host){
    this.dialog=host.ownerDocument.createElement('dialog');
    this.dialog.className='hy-character-dialog';
    this.dialog.setAttribute('aria-label','Character Lab · ทดลองโมเดล');
    this.dialog.innerHTML='<div class="hy-character-dialog-head"><strong>Character Lab · ทดลองโมเดล</strong><button type="button">ปิด · กลับแบบร่างเดิม</button></div>';
    this.dialog.querySelector('button').onclick=()=>this.close();
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    this.dialog.addEventListener('close',()=>this.release());
    host.append(this.dialog);
  }
  open(){
    if(this.disposed||this.dialog.open)return;
    const frame=this.dialog.ownerDocument.createElement('iframe');
    frame.title='Character Lab · Zuri และน้องวางใจ';
    frame.src='./character-lab.html';
    this.dialog.append(frame);this.dialog.showModal();
  }
  release(){this.dialog.querySelector('iframe')?.remove();}
  close(){this.release();if(this.dialog.open)this.dialog.close();}
  dispose(){this.close();this.disposed=true;this.dialog.remove();}
}
