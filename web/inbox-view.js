const STALE_AFTER_MS = 30_000;
const actionableStatus = new Set(['error', 'waiting', 'revision', 'review']);

const cleanText = value => typeof value === 'string' ? value.trim() : '';
const bySeverity = { error: 0, waiting: 1, revision: 2, review: 3 };
const timestamp = value => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : 0; };
const previewText = value => cleanText(value).slice(0, 220);

function reviewFor(reviews, jobId) {
  if (reviews instanceof Map) return reviews.get(jobId) || null;
  return reviews && typeof reviews === 'object' ? reviews[jobId] || null : null;
}

function isAccepted(review) {
  if (!review || typeof review !== 'object') return false;
  if (review.accepted === true || review.isAccepted === true || review.acceptedAt) return true;
  const labels = [review.reviewStatus, review.status, review.state, review.decision, review.outcome]
    .filter(value => typeof value === 'string')
    .map(value => value.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return labels.some(value => ['accepted', 'approved', 'accepted_by_user', 'approved_by_user'].includes(value));
}

function reviewNeedsChanges(review) {
  if (!review || typeof review !== 'object') return false;
  if (review.needsChanges === true || review.revisionRequested === true) return true;
  const labels = [review.reviewStatus, review.status, review.state, review.decision, review.outcome]
    .filter(value => typeof value === 'string')
    .map(value => value.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return labels.some(value => ['needs_revision', 'revision_requested', 'changes_requested', 'rejected'].includes(value));
}

function readableTime(value) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return '';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}

function connectionState(connectionStatus, lastSync, now) {
  const status = cleanText(connectionStatus).toLowerCase();
  if (!status || status === 'demo') return null;
  const parsed = Date.parse(lastSync || '');
  const age = Number.isFinite(parsed) ? now - parsed : Infinity;
  const stale = ['offline', 'stale', 'error', 'failed'].includes(status)
    || (['live', 'connecting', 'retrying'].includes(status) && age > STALE_AFTER_MS);
  if (!stale) return null;
  const label = readableTime(lastSync);
  const detail = label
    ? `สถานะล่าสุดจาก T3 คือ ${label} ข้อมูลในรายการอาจเปลี่ยนไปแล้ว`
    : status === 'connecting' || status === 'retrying'
      ? 'ยังไม่มีข้อมูลซิงก์ล่าสุด ตรวจการเชื่อมต่อ T3 ก่อนใช้สถานะในรายการ'
      : 'ยังไม่มีการซิงก์สถานะล่าสุดจาก T3 รายการด้านล่างอาจไม่เป็นปัจจุบัน';
  return { id: 'connection:stale', title: 'การเชื่อมต่อ T3 ไม่เป็นปัจจุบัน', detail, status };
}

function makeJobItem(job, reviews, agents) {
  if (!job || typeof job.id !== 'string' || !job.id) return null;
  if (job.status === 'cancelled') return null;
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const failed = steps.find(step => step?.status === 'error');
  const waiting = steps.find(step => step?.status === 'waiting');
  const review = reviewFor(reviews, job.id);
  const title = cleanText(job.title) || 'งานไม่มีชื่อ';
  const agentName = step => {
    const profile = agents.find(agent => agent?.id === step?.agentId);
    return cleanText(profile?.name || step?.name || step?.agentId) || 'ทีม';
  };
  const stepText = step => previewText(step?.result) || previewText(job.runnerError) || '';

  if (job.status === 'error' || job.runnerError || failed) {
    const source = failed || steps.find(step => step?.status === 'error') || null;
    const name = source ? agentName(source) : '';
    return {
      id: `job:${job.id}`,
      jobId: job.id,
      type: 'error',
      title: `มีข้อผิดพลาด · ${title}`,
      detail: stepText(source) || cleanText(job.runnerError) || (name ? `${name} ทำงานไม่สำเร็จ ตรวจรายละเอียดก่อนทำต่อ` : 'งานหยุดด้วยข้อผิดพลาด ตรวจรายละเอียดก่อนทำต่อ'),
      threadId: source?.threadId || null,
      threadName: name || null,
      createdAt: job.updatedAt || job.createdAt || ''
    };
  }

  if (job.status === 'waiting' || waiting) {
    const source = waiting || steps.find(step => step?.status === 'waiting') || null;
    const name = source ? agentName(source) : '';
    return {
      id: `job:${job.id}`,
      jobId: job.id,
      type: 'waiting',
      title: `รอข้อมูล · ${title}`,
      detail: source ? `รอ ${name} ใน T3 · เปิดงานหรือบทสนทนาต้นทางเพื่อตรวจสิ่งที่รอ` : 'งานกำลังรอข้อมูลจาก T3 · เปิดรายละเอียดงานเพื่อตรวจสอบ',
      threadId: source?.threadId || null,
      threadName: name || null,
      createdAt: job.updatedAt || job.createdAt || ''
    };
  }

  if (job.status === 'done' && !isAccepted(review)) {
    const needsChanges = reviewNeedsChanges(review);
    return {
      id: `job:${job.id}`,
      jobId: job.id,
      type: needsChanges ? 'revision' : 'review',
      title: `${needsChanges ? 'ต้องแก้ไขผล' : 'พร้อมตรวจผล'} · ${title}`,
      detail: needsChanges ? 'มีคำขอแก้ไขที่ยังไม่ปิด เปิดงานเพื่อดูรายละเอียดและผลล่าสุด' : 'Agent ทำงานเสร็จแล้ว รอคุณตรวจผลและตัดสินใจรับงาน',
      threadId: null,
      threadName: null,
      createdAt: job.updatedAt || job.createdAt || ''
    };
  }
  return null;
}

function deriveItems(jobs, reviews, agents) {
  const seen = new Set();
  const items = [];
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const item = makeJobItem(job, reviews, agents);
    if (!item || seen.has(item.id) || !actionableStatus.has(item.type)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items.sort((a, b) => bySeverity[a.type] - bySeverity[b.type] || timestamp(b.createdAt) - timestamp(a.createdAt));
}

export class InboxView {
  constructor(root, { onOpenWork = () => {}, onOpenChat = () => {}, onOpenConnection = null, onCreateTask = () => {}, onCount = () => {}, toast = () => {} } = {}) {
    this.root = root;
    this.doc = root.ownerDocument || globalThis.document;
    this.onOpenWork = onOpenWork;
    this.onOpenChat = onOpenChat;
    this.onOpenConnection = onOpenConnection;
    this.onCreateTask = onCreateTask;
    this.onCount = onCount;
    this.toast = toast;
    this.items = [];
    this.count = 0;
    this.signature = '';
    this.connection = null;
    this.#renderShell();
    this.#bindEvents();
  }

  getCount() { return this.count; }

  update({ jobs = [], agents = [], reviews = {}, connectionStatus = '', lastSync = null } = {}) {
    this.items = deriveItems(jobs, reviews, Array.isArray(agents) ? agents : []);
    this.connection = connectionState(connectionStatus, lastSync, Date.now());
    const signature = JSON.stringify({ items: this.items, connection: this.connection });
    if (signature === this.signature) return;

    const active = this.root.contains(this.doc.activeElement) ? this.doc.activeElement : null;
    const focusKey = active?.dataset?.inboxAction
      ? `${active.dataset.inboxAction}:${active.dataset.jobId || active.dataset.threadId || ''}`
      : active?.dataset?.inboxConnectionAction === 'true' ? 'connection:'
      : active?.dataset?.inboxCreateTask === 'true' ? 'create-task:' : '';
    this.signature = signature;
    this.#renderItems();
    this.count = this.items.length + (this.connection ? 1 : 0);
    this.onCount(this.count);
    if (focusKey) {
      const [action, id] = focusKey.split(':');
      const selector = action === 'create-task'
        ? '[data-inbox-create-task="true"]'
        : action === 'connection'
          ? '[data-inbox-connection-action="true"]'
        : `[data-inbox-action="${action}"][data-${action === 'chat' ? 'thread' : 'job'}-id="${this.#escapeSelector(id)}"]`;
      this.root.querySelector(selector)?.focus();
    }
  }

  #renderShell() {
    this.root.innerHTML = `
      <div class="inbox-view">
        <header class="inbox-heading">
          <p class="inbox-eyebrow">NEEDS YOUR ATTENTION</p>
          <div class="inbox-heading-row">
            <div>
              <h1 id="inbox-page-title">กล่องแจ้งเตือน</h1>
              <p>รายการที่ยังต้องตอบ ตรวจผล หรือแก้ไขจากงานจริงใน workspace</p>
            </div>
            <span class="inbox-count" aria-label="รายการที่ต้องจัดการ"><strong id="inbox-count-value">0</strong><span>รายการ</span></span>
          </div>
        </header>
        <div class="inbox-connection" id="inbox-connection" hidden></div>
        <div class="inbox-list" id="inbox-list" aria-live="polite" aria-relevant="additions removals"></div>
      </div>`;
  }

  #bindEvents() {
    this.root.addEventListener('click', event => {
      const create = event.target.closest('[data-inbox-create-task="true"]');
      if (create && this.root.contains(create)) {
        this.onCreateTask();
        return;
      }
      const connection = event.target.closest('[data-inbox-connection-action="true"]');
      if (connection && this.root.contains(connection)) {
        this.onOpenConnection?.();
        return;
      }
      const button = event.target.closest('[data-inbox-action]');
      if (!button || !this.root.contains(button)) return;
      if (button.dataset.inboxAction === 'work') this.onOpenWork(button.dataset.jobId);
      if (button.dataset.inboxAction === 'chat') this.onOpenChat(button.dataset.threadId, button.dataset.threadName || 'ทีม');
    });
  }

  #renderItems() {
    const list = this.root.querySelector('#inbox-list');
    const connection = this.root.querySelector('#inbox-connection');
    const count = this.root.querySelector('#inbox-count-value');
    const doc = this.doc;
    count.textContent = String(this.items.length + (this.connection ? 1 : 0));

    connection.hidden = !this.connection;
    connection.replaceChildren();
    if (this.connection) {
      const mark = doc.createElement('span');
      mark.className = 'inbox-connection-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '!';
      const copy = doc.createElement('div');
      const title = doc.createElement('strong');
      title.textContent = this.connection.title;
      const detail = doc.createElement('p');
      detail.textContent = this.connection.detail;
      copy.append(title, detail);
      connection.append(mark, copy);
      if (typeof this.onOpenConnection === 'function') {
        const action = doc.createElement('button');
        action.type = 'button';
        action.className = 'inbox-button inbox-button-secondary inbox-connection-action';
        action.dataset.inboxConnectionAction = 'true';
        action.textContent = 'ตรวจการเชื่อมต่อ';
        connection.append(action);
      }
    }

    list.replaceChildren();
    if (!this.items.length) {
      const empty = doc.createElement('section');
      empty.className = 'inbox-empty';
      const mark = doc.createElement('span');
      mark.className = 'inbox-empty-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '✓';
      const title = doc.createElement('h2');
      title.textContent = this.connection ? 'ไม่มีงานที่ต้องจัดการจากข้อมูลล่าสุด' : 'ตอนนี้ไม่มีรายการที่ต้องจัดการ';
      const description = doc.createElement('p');
      description.textContent = this.connection
        ? 'กล่องนี้จะแสดงงานที่รอข้อมูล มีข้อผิดพลาด หรือเสร็จแล้วแต่ยังไม่ตรวจรับ'
        : 'เมื่อมีงานรอข้อมูล เกิดข้อผิดพลาด หรือพร้อมให้ตรวจผล รายการจะปรากฏที่นี่และเปิดกลับไปยังงานต้นทางได้';
      const action = doc.createElement('button');
      action.type = 'button';
      action.className = 'inbox-button inbox-button-primary';
      action.dataset.inboxCreateTask = 'true';
      action.textContent = 'สร้างงานใหม่';
      empty.append(mark, title, description, action);
      list.append(empty);
      return;
    }

    const group = doc.createElement('div');
    group.className = 'inbox-items';
    for (const item of this.items) group.append(this.#itemElement(item));
    list.append(group);
    const footer = doc.createElement('p');
    footer.className = 'inbox-provenance';
    footer.textContent = 'รายการนี้อิงสถานะงานล่าสุด และจะหายไปเมื่อสถานะต้นทางเปลี่ยน ไม่มีการบันทึกสถานะอ่านข้ามอุปกรณ์';
    list.append(footer);
  }

  #itemElement(item) {
    const doc = this.doc;
    const card = doc.createElement('article');
    card.className = `inbox-item is-${item.type}`;
    card.dataset.itemId = item.id;
    const mark = doc.createElement('span');
    mark.className = 'inbox-item-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = item.type === 'error' ? '!' : item.type === 'waiting' ? '…' : item.type === 'revision' ? '↺' : '✓';
    const body = doc.createElement('div');
    body.className = 'inbox-item-copy';
    const heading = doc.createElement('h2');
    heading.textContent = item.title;
    const detail = doc.createElement('p');
    detail.textContent = item.detail;
    body.append(heading, detail);
    const actions = doc.createElement('div');
    actions.className = 'inbox-item-actions';
    const work = doc.createElement('button');
    work.type = 'button';
    work.className = 'inbox-button inbox-button-primary';
    work.dataset.inboxAction = 'work';
    work.dataset.jobId = item.jobId;
    work.textContent = item.type === 'review' ? 'ตรวจผล' : item.type === 'revision' ? 'ดูคำขอแก้ไข' : 'เปิดงาน';
    actions.append(work);
    if (item.threadId) {
      const chat = doc.createElement('button');
      chat.type = 'button';
      chat.className = 'inbox-button inbox-button-secondary';
      chat.dataset.inboxAction = 'chat';
      chat.dataset.threadId = item.threadId;
      chat.dataset.threadName = item.threadName || 'ทีม';
      chat.textContent = `เปิดแชท · ${item.threadName || 'ทีม'}`;
      actions.append(chat);
    }
    card.append(mark, body, actions);
    return card;
  }

  #escapeSelector(value) {
    return String(value).replace(/["\\]/g, '\\$&');
  }
}

export { STALE_AFTER_MS, deriveItems, isAccepted };
