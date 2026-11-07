const MAX_CONTEXT_LENGTH = 6000;

const contextTemplate = [
  'ธุรกิจ / สินค้า:',
  'กลุ่มเป้าหมาย:',
  'จุดยืนของแบรนด์และน้ำเสียง:',
  'เป้าหมายที่พบบ่อย:',
  'ข้อจำกัดหรือสิ่งที่ควรหลีกเลี่ยง:',
  'แหล่งข้อมูลที่อนุญาตให้ใช้อ้างอิง:'
].join('\n');

const isDemoMode = value => typeof value === 'function' ? Boolean(value()) : Boolean(value);

export class KnowledgeView {
  constructor(root, { toast = () => {}, onContextChange = () => {}, isDemo = false, autoLoad = true } = {}) {
    this.root = root;
    this.doc = root.ownerDocument || globalThis.document;
    this.toast = toast;
    this.onContextChange = onContextChange;
    this.isDemo = isDemo;this.autoLoad=autoLoad;
    this.savedContext = '';
    this.draft = '';
    this.remoteContext = null;
    this.dirty = false;
    this.saving = false;
    this.message = '';
    this.messageKind = '';
    this.versions = [];
    this.usage = { retainedVersionCount: 0, retainedBytes: 0, versionLimit: 20, retainedByteLimit: 100 * 1024 * 1024 };
    this.libraryMessage = '';
    this.libraryKind = '';
    this.libraryLoading = false;
    this.libraryLoaded = false;
    this.libraryBusy = false;
    this.uploadIds = new Map();
    this.#renderShell();
    this.#bindEvents();
    this.#renderState();
    if (autoLoad && !isDemoMode(this.isDemo)) void this.#loadLibrary();
  }

  update({ context = '', active = this.autoLoad } = {}) {
    const incoming = isDemoMode(this.isDemo)?'':typeof context === 'string' ? context : typeof context?.context === 'string' ? context.context : '';
    if(isDemoMode(this.isDemo)){this.versions=[];this.libraryLoaded=false;}
    this.savedContext = incoming;

    const input = this.root.querySelector('#knowledge-context-input');
    if (!this.dirty && !this.saving) {
      this.draft = incoming;
      this.remoteContext = null;
      if (input && input.value !== incoming) input.value = incoming;
      if (this.messageKind === 'save') this.message = '';
    } else {
      // A poll may report a newer saved value while the user's local draft stays intact.
      this.remoteContext = incoming !== this.savedContextAtEdit ? incoming : null;
    }

    this.#renderState();
    if (active && !isDemoMode(this.isDemo) && !this.libraryLoaded && !this.libraryLoading) void this.#loadLibrary();
  }

  #renderShell() {
    this.root.innerHTML = `
      <div class="knowledge-view">
        <header class="knowledge-heading">
          <p class="knowledge-eyebrow">WORKSPACE KNOWLEDGE</p>
          <h1 id="knowledge-page-title">ความรู้ทีม</h1>
          <p class="knowledge-intro">จัดการบริบทธุรกิจที่ทีมใช้ประกอบงานใหม่ใน workspace นี้</p>
        </header>

        <section class="knowledge-card" aria-labelledby="knowledge-context-title">
          <div class="knowledge-card-heading">
            <div>
              <p class="knowledge-section-label">ข้อมูลที่ใช้ซ้ำ</p>
              <h2 id="knowledge-context-title">บริบทธุรกิจร่วม</h2>
            </div>
            <span class="knowledge-scope">WORKSPACE</span>
          </div>
          <p class="knowledge-description">ข้อมูลนี้จะถูกคัดลอกไปกับงานที่สร้างใหม่ เพื่อให้ทีมเข้าใจธุรกิจและข้อจำกัดของคุณได้ตรงกัน</p>

          <div class="knowledge-memory-note" role="note">
            <span class="knowledge-note-mark" aria-hidden="true">i</span>
            <p>การบันทึกมีผลกับงานที่สร้างใหม่เท่านั้น ไม่เพิ่มข้อมูลย้อนหลังให้แชทหรืองานเดิม และไม่เปลี่ยนความจำใน T3</p>
          </div>

          <label class="knowledge-field-label" for="knowledge-context-input">บริบทธุรกิจ</label>
          <textarea id="knowledge-context-input" rows="13" maxlength="${MAX_CONTEXT_LENGTH}" aria-describedby="knowledge-context-help knowledge-context-count" placeholder="เช่น ข้อมูลธุรกิจ กลุ่มเป้าหมาย หลักการใช้แบรนด์ และข้อจำกัดที่ทีมควรรู้"></textarea>
          <div class="knowledge-input-meta">
            <span id="knowledge-context-help">ใส่เฉพาะข้อมูลที่คุณยืนยันให้ใช้ซ้ำได้</span>
            <span id="knowledge-context-count" aria-live="polite">0 / ${MAX_CONTEXT_LENGTH}</span>
          </div>

          <details class="knowledge-template">
            <summary>ดูโครงร่างช่วยกรอก</summary>
            <div class="knowledge-template-body">
              <p>โครงร่างนี้มีหัวข้อว่างให้คุณเติมเอง ไม่มีข้อมูลแบรนด์หรือเอกสารที่ระบบเพิ่มให้อัตโนมัติ</p>
              <button class="knowledge-button knowledge-button-secondary" type="button" data-knowledge-action="template">แทรกโครงร่างในช่อง</button>
            </div>
          </details>

          <div class="knowledge-feedback" id="knowledge-feedback" role="status" aria-live="polite"></div>
          <div class="knowledge-actions">
            <button class="knowledge-button knowledge-button-secondary" type="button" data-knowledge-action="discard" hidden>ทิ้งฉบับร่าง</button>
            <button class="knowledge-button knowledge-button-primary" type="button" data-knowledge-action="save">บันทึกบริบททีม</button>
          </div>
        </section>

        <section class="knowledge-library" aria-labelledby="knowledge-library-title">
          <div class="knowledge-library-heading"><div><p class="knowledge-section-label">ไฟล์ส่วนตัวของ workspace</p><h2 id="knowledge-library-title">เอกสารความรู้ทีม</h2></div><button class="knowledge-button knowledge-button-secondary" type="button" data-knowledge-action="reload">โหลดรายการใหม่</button></div>
          <p class="knowledge-description">อัปโหลดไฟล์เพื่อเก็บเป็นฉบับที่รอตรวจทาน กดอนุมัติเฉพาะฉบับที่คุณตรวจแล้ว ไฟล์ฉบับใหม่ต้องอนุมัติใหม่ทุกครั้ง</p>
          <div class="knowledge-memory-note" role="note"><span class="knowledge-note-mark" aria-hidden="true">i</span><p>เมื่อเลือกไฟล์ให้กับงาน ระบบจะส่งไฟล์ต้นฉบับไปยัง T3 ให้ agent อ่าน แอปไม่ได้ดึงข้อความหรือตรวจสอบความถูกต้องของเนื้อหา การถอนอนุมัติมีผลกับงานใหม่ ส่วนงานเดิมไม่เปลี่ยน และสำเนาที่ส่งไป T3 อาจยังอยู่หลังลบไฟล์จาก workspace</p></div>
          <label class="knowledge-upload-label" for="knowledge-files">เพิ่มไฟล์ที่ต้องการตรวจทาน</label>
          <input id="knowledge-files" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.json">
          <p class="knowledge-library-limits">สูงสุด 8 MiB ต่อไฟล์ · 20 ฉบับที่เก็บอยู่ · 100 MiB ใน workspace · งานละ 5 ไฟล์และ 20 MiB</p>
          <p class="knowledge-library-usage" id="knowledge-library-usage"></p>
          <div class="knowledge-library-feedback" id="knowledge-library-feedback" role="status" aria-live="polite"></div>
          <div class="knowledge-version-list" id="knowledge-version-list"></div>
        </section>
      </div>`;
  }

  #bindEvents() {
    const input = this.root.querySelector('#knowledge-context-input');
    input.addEventListener('input', () => {
      this.draft = input.value;
      this.savedContextAtEdit ??= this.savedContext;
      this.dirty = this.draft !== this.savedContext;
      if (!this.dirty) {
        this.remoteContext = null;
        this.savedContextAtEdit = this.savedContext;
      }
      this.message = '';
      this.messageKind = '';
      this.#renderState();
    });

    this.root.addEventListener('click', event => {
      const button = event.target.closest('[data-knowledge-action]');
      if (!button || !this.root.contains(button)) return;
      if (button.disabled) return;
      const action = button.dataset.knowledgeAction;
      if (action === 'save') void this.#save();
      if (action === 'discard') this.#discardDraft();
      if (action === 'template') this.#insertTemplate();
      if (action === 'reload') void this.#loadLibrary(true);
      if (['approve','revoke','purge'].includes(action)) void this.#changeVersion(button.dataset.versionId, action);
    });
    this.root.querySelector('#knowledge-files').addEventListener('change', event => { void this.#uploadFiles(event.target.files); event.target.value = ''; });
  }

  #renderState() {
    const input = this.root.querySelector('#knowledge-context-input');
    const count = this.root.querySelector('#knowledge-context-count');
    const save = this.root.querySelector('[data-knowledge-action="save"]');
    const discard = this.root.querySelector('[data-knowledge-action="discard"]');
    const feedback = this.root.querySelector('#knowledge-feedback');
    if (!input || !count || !save || !discard || !feedback) return;

    if (!this.dirty && !this.saving && input.value !== this.draft) input.value = this.draft;
    count.textContent = `${input.value.length} / ${MAX_CONTEXT_LENGTH}`;
    save.disabled = this.saving || isDemoMode(this.isDemo) || !this.dirty || input.value.length > MAX_CONTEXT_LENGTH;
    save.textContent = this.saving ? 'กำลังบันทึก…' : 'บันทึกบริบททีม';
    discard.hidden = !this.dirty || this.saving;
    input.disabled = isDemoMode(this.isDemo);

    if (isDemoMode(this.isDemo)) {
      feedback.className = 'knowledge-feedback is-info';
      feedback.textContent = 'เชื่อมต่อ workspace จริงก่อน จึงจะบันทึกบริบททีมได้';
    } else if (this.remoteContext !== null && this.remoteContext !== this.savedContextAtEdit) {
      feedback.className = 'knowledge-feedback is-warning';
      feedback.textContent = 'ข้อมูลที่บันทึกไว้เปลี่ยนระหว่างที่คุณกำลังแก้ ฉบับร่างของคุณยังอยู่ ตรวจทานแล้วจึงกดบันทึก';
    } else {
      feedback.className = `knowledge-feedback${this.messageKind ? ` is-${this.messageKind}` : ''}`;
      feedback.textContent = this.message;
    }
    this.#renderLibrary();
  }

  async #loadLibrary(force = false) {
    if (this.libraryLoading || isDemoMode(this.isDemo) || this.libraryLoaded && !force) return;
    this.libraryLoading = true;
    this.libraryMessage = 'กำลังโหลดรายการไฟล์…';
    this.libraryKind = 'info';
    this.#renderLibrary();
    try {
      const response = await fetch('/api/knowledge', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if(isDemoMode(this.isDemo))return;
      if (!response.ok) throw new Error(data.error || `โหลดรายการไม่สำเร็จ (HTTP ${response.status})`);
      this.versions = Array.isArray(data.versions) ? data.versions : [];
      this.usage = data.usage || this.usage;
      this.libraryLoaded = true;
      this.libraryMessage = '';
      this.libraryKind = '';
    } catch (error) {
      this.libraryLoaded = true;
      this.libraryMessage = error?.message || 'โหลดรายการไม่สำเร็จ';
      this.libraryKind = 'error';
    } finally {
      this.libraryLoading = false;
      this.#renderLibrary();
    }
  }

  async #uploadFiles(fileList) {
    if (isDemoMode(this.isDemo) || this.libraryBusy || !fileList?.length) return;
    const files = [...fileList];
    const total = files.reduce((n, file) => n + file.size, 0);
    if (files.some(file => !/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt|md|json)$/i.test(file.name) || file.size < 1 || file.size > 8 * 1024 * 1024)) {
      this.libraryMessage = 'เลือกได้เฉพาะ PDF, Word, Excel, PowerPoint, CSV, TXT, Markdown หรือ JSON ขนาด 1 ไบต์ถึง 8 MiB ต่อไฟล์'; this.libraryKind = 'error'; this.#renderLibrary(); return;
    }
    const resumable = files.filter(file => this.versions.some(v => v.status === 'uploading' && v.name === file.name && v.sizeBytes === file.size));
    const newFiles = files.filter(file => !resumable.includes(file));
    if (this.usage.retainedVersionCount + newFiles.length > 20 || this.usage.retainedBytes + total - resumable.reduce((n,file) => n + file.size,0) > 100 * 1024 * 1024) {
      this.libraryMessage = 'ไฟล์ที่เลือกเกินพื้นที่คงเหลือของ workspace'; this.libraryKind = 'error'; this.#renderLibrary(); return;
    }
    this.libraryBusy = true; this.libraryMessage = 'กำลังบันทึกไฟล์เป็นฉบับรอตรวจทาน…'; this.libraryKind = 'info'; this.#renderLibrary();
    try {
      for (const file of files) {
        const key = `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
        const prior = this.uploadIds.get(key); if (prior?.done) continue;
        const fileId = prior?.id || crypto.randomUUID(); this.uploadIds.set(key, { id: fileId, done: false });
        const response = await fetch('/api/knowledge/files/' + fileId, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) }, body: file, signal: AbortSignal.timeout(60000) });
        const data = await response.json();
      if(isDemoMode(this.isDemo))return; if (!response.ok) throw new Error(data.error || `อัปโหลดไม่สำเร็จ (HTTP ${response.status})`);
        this.uploadIds.set(key, { id: fileId, done: true });
      }
      for (const file of files) this.uploadIds.delete(`${file.name}\u0000${file.size}\u0000${file.lastModified}`);
      this.libraryMessage = 'บันทึกไฟล์แล้ว กรุณาตรวจทานแต่ละฉบับและกดอนุมัติก่อนนำไปใช้กับงาน'; this.libraryKind = 'success';
      await this.#loadLibrary(true);
    } catch (error) {
      this.libraryMessage = error?.message || 'บันทึกไฟล์ไม่สำเร็จ'; this.libraryKind = 'error';
    } finally { this.libraryBusy = false; this.#renderLibrary(); }
  }

  async #changeVersion(id, action) {
    if (!id || this.libraryBusy || isDemoMode(this.isDemo)) return;
    if (action === 'purge' && !this.doc.defaultView.confirm('ลบไฟล์ต้นฉบับนี้ออกจาก workspace หรือไม่? สำเนาที่ส่งไป T3 อาจยังอยู่')) return;
    this.libraryBusy = true; this.libraryMessage = 'กำลังบันทึกการตัดสินใจ…'; this.libraryKind = 'info'; this.#renderLibrary();
    try {
      const response = await fetch(`/api/knowledge/versions/${id}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if(isDemoMode(this.isDemo))return; if (!response.ok) throw new Error(data.error || `บันทึกไม่สำเร็จ (HTTP ${response.status})`);
      this.libraryMessage = action === 'approve' ? 'อนุมัติเฉพาะไฟล์ฉบับนี้แล้ว' : action === 'revoke' ? 'ถอนอนุมัติแล้ว งานใหม่จะเลือกไฟล์ฉบับนี้ไม่ได้' : 'ลบไฟล์ต้นฉบับจาก workspace แล้ว'; this.libraryKind = 'success';
      await this.#loadLibrary(true);
    } catch (error) { this.libraryMessage = error?.message || 'บันทึกไม่สำเร็จ'; this.libraryKind = 'error'; }
    finally { this.libraryBusy = false; this.#renderLibrary(); }
  }

  #renderLibrary() {
    const list = this.root.querySelector('#knowledge-version-list'), feedback = this.root.querySelector('#knowledge-library-feedback'), usage = this.root.querySelector('#knowledge-library-usage');
    if (!list || !feedback || !usage) return;
    usage.textContent = `${this.usage.retainedVersionCount} / 20 ฉบับ · ${(this.usage.retainedBytes / 1024 / 1024).toFixed(2)} / 100 MiB`;
    const fileInput = this.root.querySelector('#knowledge-files'), reload = this.root.querySelector('[data-knowledge-action="reload"]');
    if (fileInput) fileInput.disabled = this.libraryBusy || isDemoMode(this.isDemo);
    if (reload) reload.disabled = this.libraryBusy || this.libraryLoading || isDemoMode(this.isDemo);
    feedback.className = `knowledge-library-feedback${this.libraryKind ? ` is-${this.libraryKind}` : ''}`;
    feedback.textContent = this.libraryMessage;
    const signature=JSON.stringify([this.versions,this.libraryBusy,this.libraryLoading,isDemoMode(this.isDemo)]);
    if(signature===this.librarySignature)return;this.librarySignature=signature;
    list.replaceChildren();
    if (!this.versions.length) { const empty = this.doc.createElement('p'); empty.className = 'knowledge-empty-note'; empty.textContent = 'ยังไม่มีไฟล์ในคลัง'; list.append(empty); return; }
    const statusNames = { uploading: 'กำลังบันทึก', pending: 'รอตรวจทาน', approved: 'อนุมัติแล้ว', revoked: 'ถอนอนุมัติ', purging: 'กำลังลบ', purged: 'ลบต้นฉบับแล้ว' };
    for (const version of [...this.versions].sort((a,b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))) {
      const row = this.doc.createElement('article'); row.className = `knowledge-version is-${version.status}`;
      const info = this.doc.createElement('div'), name = this.doc.createElement('strong'), meta = this.doc.createElement('p');
      name.textContent = version.name; meta.textContent = `${statusNames[version.status] || version.status} · ${(version.sizeBytes / 1024 / 1024).toFixed(2)} MiB · ${version.approvedAt ? 'อนุมัติ ' + new Date(version.approvedAt).toLocaleString() : 'ยังไม่อนุมัติ'}${version.status === 'uploading' ? ' · เลือกไฟล์เดิมอีกครั้งเพื่อดำเนินต่อ' : ''}`; info.append(name, meta); row.append(info);
      const actions = this.doc.createElement('div'); actions.className = 'knowledge-version-actions';
      const add = (action, label) => { const button = this.doc.createElement('button'); button.type='button'; button.className='knowledge-button knowledge-button-secondary'; button.dataset.knowledgeAction=action; button.dataset.versionId=version.id; button.disabled=this.libraryBusy; button.textContent=label; actions.append(button); };
      if (version.status === 'pending' || version.status === 'revoked') add('approve','อนุมัติฉบับนี้');
      if (version.status === 'approved') add('revoke','ถอนอนุมัติ');
      if (version.status === 'purging') add('purge','ลองลบต่อ');
      else if (!['uploading','purged'].includes(version.status)) add('purge','ลบต้นฉบับ');
      if (actions.childElementCount) row.append(actions);
      list.append(row);
    }
  }

  #insertTemplate() {
    if (isDemoMode(this.isDemo)) return;
    const input = this.root.querySelector('#knowledge-context-input');
    const prefix = input.value.trim() ? `${input.value.replace(/\s+$/, '')}\n\n` : '';
    const next = prefix + contextTemplate;
    if (next.length > MAX_CONTEXT_LENGTH) {
      this.message = 'พื้นที่เหลือไม่พอสำหรับโครงร่าง ลองย่อข้อความเดิมก่อน';
      this.messageKind = 'warning';
      this.#renderState();
      return;
    }
    input.value = next;
    this.draft = next;
    this.savedContextAtEdit ??= this.savedContext;
    this.dirty = this.draft !== this.savedContext;
    this.message = '';
    this.messageKind = '';
    this.#renderState();
    input.focus();
    input.setSelectionRange(next.length, next.length);
  }

  #discardDraft() {
    const input = this.root.querySelector('#knowledge-context-input');
    const next = this.remoteContext ?? this.savedContext;
    this.draft = next;
    this.savedContext = next;
    this.savedContextAtEdit = next;
    this.remoteContext = null;
    this.dirty = false;
    this.message = 'คืนค่าบริบทที่บันทึกไว้แล้ว';
    this.messageKind = 'info';
    input.value = next;
    this.#renderState();
  }

  async #save() {
    if (this.saving || isDemoMode(this.isDemo)) return;
    const input = this.root.querySelector('#knowledge-context-input');
    const submitted = input.value;
    if (submitted.length > MAX_CONTEXT_LENGTH) {
      this.message = `บริบทธุรกิจต้องไม่เกิน ${MAX_CONTEXT_LENGTH.toLocaleString('th-TH')} ตัวอักษร`;
      this.messageKind = 'error';
      this.#renderState();
      return;
    }

    this.saving = true;
    this.message = '';
    this.messageKind = '';
    this.#renderState();
    try {
      const response = await fetch('/api/team', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context: submitted.trim() })
      });
      if (!response.ok) {
        let detail = '';
        try { detail = (await response.json()).error || ''; } catch {}
        throw new Error(detail || `บันทึกไม่สำเร็จ (HTTP ${response.status})`);
      }
    } catch (error) {
      this.message = error?.message || 'บันทึกไม่สำเร็จ ลองอีกครั้ง';
      this.messageKind = 'error';
      this.saving = false;
      this.#renderState();
      return;
    }

    const saved = submitted.trim();
    this.savedContext = saved;
    this.savedContextAtEdit = saved;
    this.remoteContext = null;
    if (input.value === submitted) input.value = saved;
    this.draft = input.value;
    this.dirty = this.draft !== saved;
    this.message = 'บันทึกบริบททีมแล้ว ใช้กับงานที่สร้างใหม่';
    this.messageKind = 'success';
    try { this.toast('บันทึกบริบททีมแล้ว · มีผลกับงานใหม่'); } catch {}
    try { this.onContextChange(saved); } catch {}
    {
      this.saving = false;
      this.#renderState();
    }
  }
}

export { MAX_CONTEXT_LENGTH };
