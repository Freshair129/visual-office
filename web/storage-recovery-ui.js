export class StorageRecoveryUI {
  constructor(root, {fileName, onRecovered = () => {}, onMessage = () => {}} = {}) {
    this.root = root;this.fileName = fileName;this.onRecovered = onRecovered;this.onMessage = onMessage;
    const doc = root.ownerDocument;
    this.panel = doc.createElement('section');this.panel.className = 'office-storage-recovery';this.panel.hidden = true;
    this.panel.innerHTML = '<p data-storage-recovery-status role="status"></p><button type="button" data-storage-backup>ดาวน์โหลดข้อมูลสำรอง</button> <button type="button" data-storage-remove disabled>นำรายการที่อ่านไม่ได้ออก…</button>';
    this.dialog = doc.createElement('dialog');this.dialog.className = 'office-storage-recovery-dialog';
    this.dialog.innerHTML = '<h2 data-storage-recovery-title>ยืนยันการนำข้อมูลที่อ่านไม่ได้ออก</h2><p data-storage-recovery-details></p><button type="button" data-storage-confirm>ยืนยันนำออก</button> <button type="button" data-storage-cancel autofocus>เก็บข้อมูลไว้ก่อน</button>';
    root.append(this.panel, this.dialog);
    this.status = this.panel.querySelector('[data-storage-recovery-status]');
    this.removeButton = this.panel.querySelector('[data-storage-remove]');
    this.details = this.dialog.querySelector('[data-storage-recovery-details]');
    this.panel.querySelector('[data-storage-backup]').onclick = () => this.exportBackup();
    this.removeButton.onclick = () => { if (this.backupReady && this.canDiscard) this.dialog.showModal(); };
    this.dialog.querySelector('[data-storage-cancel]').onclick = () => this.dialog.close();
    this.dialog.querySelector('[data-storage-confirm]').onclick = () => this.confirmRemoval();
  }
  show(issue, discard) {
    if ((!issue?.recoverable&&!issue?.backupOnly) || typeof issue.rawText !== 'string' || typeof discard !== 'function') { this.hide();return false; }
    this.issue = issue;this.discard = discard;this.backupReady = false;this.canDiscard=issue.recoverable===true&&!issue.backupOnly;this.panel.hidden = false;
    this.removeButton.hidden = !this.canDiscard;this.removeButton.disabled = true;
    const envelope=issue.kind==='envelope';
    this.status.textContent=envelope
      ? this.canDiscard?'JSON ของคลังอ่านไม่ได้ · ดาวน์โหลดไฟล์สำรองก่อน แล้วจึงยืนยันนำคลังทั้งหมดออกได้':'JSON อ่านได้แต่โครงสร้างหรือเวอร์ชันไม่รองรับ · ดาวน์โหลดไฟล์สำรองได้ และระบบจะเก็บคลังเดิมไว้'
      : this.canDiscard?`ข้อมูล${issue.label||'รายการนี้'}อ่านไม่ได้ · ดาวน์โหลดไฟล์สำรองก่อน แล้วจึงยืนยันนำเฉพาะรายการนี้ออกได้`:`ไม่สามารถยืนยันรายการซ้ำที่ยังอ่านได้ · ดาวน์โหลดไฟล์สำรองเพื่อตรวจสอบ; ระบบจะเก็บข้อมูลเดิมไว้`;
    this.panel.querySelector('[data-storage-remove]').textContent=envelope?'นำคลังที่อ่านไม่ได้ออก…':`นำ${issue.label||'รายการที่อ่านไม่ได้'}ออก…`;
    this.dialog.querySelector('[data-storage-recovery-title]').textContent=envelope
      ? this.canDiscard?'ยืนยันนำคลังที่อ่านไม่ได้ออกทั้งหมด':'คลังเวอร์ชันที่ไม่รองรับ'
      : this.canDiscard?`ยืนยันนำ${issue.label||'รายการที่อ่านไม่ได้'}ออก`:'ตรวจสอบสำเนารายการ';
    this.dialog.setAttribute('aria-label', this.dialog.querySelector('[data-storage-recovery-title]').textContent);
    this.details.textContent=envelope
      ? this.canDiscard?'การยืนยันจะนำ storage key ของคลังออกทั้งหมด รวมถึงรายการอื่นที่อาจยังอ่านได้ไม่ครบ':'ไฟล์ JSON parse ได้แต่โครงสร้างหรือเวอร์ชันไม่รองรับ · จะไม่มีตัวเลือกลบ และจะเก็บคลังเดิมไว้'
      : this.canDiscard?'การยืนยันจะนำเฉพาะรายการที่อ่านไม่ได้ออก ข้อมูลรายการอื่นจะคงเดิม':'ระบบจะไม่ลบสำเนารายการที่ยังอ่านได้';
    this.dialog.querySelector('[data-storage-confirm]').hidden=!this.canDiscard;
    return true;
  }
  exportBackup() {
    if (!this.issue) return false;
    try {
      const win = this.root.ownerDocument.defaultView, blob = new win.Blob([this.issue.rawText], {type: 'application/json'});
      const url = win.URL.createObjectURL(blob), anchor = this.root.ownerDocument.createElement('a');
      anchor.href = url;anchor.download = this.fileName;anchor.click();win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
      this.backupReady = true;this.removeButton.disabled = !this.canDiscard;
      this.status.textContent = !this.canDiscard
        ? 'ดาวน์โหลดไฟล์สำรองแล้ว · เก็บข้อมูลเดิมไว้เพราะไม่มีรายการที่ยืนยันลบได้'
        : this.issue.kind==='envelope'?'ดาวน์โหลดไฟล์สำรองแล้ว · ตรวจสอบก่อนยืนยันนำคลังทั้งหมดออก':'ดาวน์โหลดไฟล์สำรองแล้ว · ตรวจสอบก่อนยืนยันนำเฉพาะรายการที่อ่านไม่ได้ออก';
      return true;
    } catch {
      this.status.textContent = 'ส่งออกข้อมูลสำรองไม่ได้ · ข้อมูลเดิมยังอยู่';
      return false;
    }
  }
  confirmRemoval() {
    if (!this.issue || !this.backupReady || !this.canDiscard) return false;
    const issue=this.issue,discard=this.discard;
    this.dialog.close();
    const finish=removed=>{
      if(this.issue!==issue)return false;
      if (!removed) {
        this.status.textContent = 'นำข้อมูลออกไม่ได้ · ข้อมูลเดิมยังอยู่ กรุณาโหลดคลังใหม่แล้วลองอีกครั้ง';
        this.backupReady = false;this.removeButton.disabled = true;
        this.onMessage('กู้คืนไม่สำเร็จ · ไม่มีการนำข้อมูลออก');
        return false;
      }
      this.hide();this.onRecovered(issue);return true;
    };
    const failed=()=>{
      this.status.textContent = 'นำข้อมูลที่อ่านไม่ได้ออกไม่สำเร็จ · ไฟล์สำรองและข้อมูลเดิมยังอยู่';
      this.onMessage('กู้คืนไม่สำเร็จ · ไฟล์สำรองและข้อมูลเดิมยังอยู่');
      return false;
    };
    try {
      const result=discard(issue);
      return result&&typeof result.then==='function'?result.then(finish,failed):finish(result);
    } catch {return failed();}
  }
  hide() {
    this.issue = null;this.discard = null;this.backupReady = false;this.canDiscard=false;this.panel.hidden = true;
    this.removeButton.disabled = true;this.removeButton.hidden=true;
    this.dialog.querySelector('[data-storage-confirm]').hidden=true;
    if (this.dialog.open) this.dialog.close();
  }
  dispose() { this.hide();this.panel.remove();this.dialog.remove(); }
}
