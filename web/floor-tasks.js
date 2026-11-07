import {STALE_AFTER_MS} from './inbox-view.js';

const SOURCE = 'T3';
const ACTIVE_STATUSES = new Map([
  ['running', 'กำลังทำ'],
  ['pending', 'รอดำเนินการ'],
  ['queued', 'รอคิว'],
  ['waiting', 'รอข้อมูล'],
  ['blocked', 'ติดขัด'],
  ['review', 'รอตรวจ'],
]);
const MAX_ITEMS = 100;
const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 160;
let nextDialogId = 1;

function text(value, limit) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
}

function unavailable(message, checkedAt, source = SOURCE) {
  return {
    state: 'UNAVAILABLE', source, items: [], message,
    ...(checkedAt ? {checkedAt} : {}),
  };
}

function empty(message, checkedAt, source = SOURCE) {
  return {
    state: 'EMPTY', source, items: [], message,
    ...(checkedAt ? {checkedAt} : {}),
  };
}

export function projectFloorTasks(floorKey, options = {}) {
  const input = options && typeof options === 'object' ? options : {};
  const {jobs = [], connectionStatus, lastSync, mode = 'live'} = input;
  const source=input.source==='Synthetic'?'Synthetic':SOURCE;
  const missing=message=>unavailable(message,checkedAt,source);
  const syncText = text(lastSync, 64);
  const syncTime = syncText ? Date.parse(syncText) : NaN;
  const age = Date.now() - syncTime;
  const checkedAt = Number.isFinite(syncTime) ? new Date(syncTime).toISOString() : undefined;

  if (mode !== 'live' || connectionStatus !== 'live') {
    return missing(`ยังดูงานของชั้นนี้ไม่ได้ เพราะแหล่งข้อมูล ${source} ยังไม่พร้อม`);
  }
  if (!Number.isFinite(syncTime) || age < 0 || age > STALE_AFTER_MS) {
    return missing(`ยังตรวจสอบงานของชั้นนี้ไม่ได้ เพราะข้อมูลจาก ${source} ไม่สดแล้ว`);
  }
  if (typeof floorKey !== 'string' || !floorKey) {
    return missing('ยังระบุขอบเขตชั้นของงานไม่ได้');
  }
  if (!Array.isArray(jobs)) {
    return missing(`ยังอ่านรายการงานจาก ${source} ไม่ได้`);
  }

  const records = jobs.filter(job => job && typeof job === 'object' && !Array.isArray(job));
  const matchesFloor = job => job.domainKey === floorKey || job.domain === floorKey;
  const hasFloorScope = job => [job.domainKey, job.domain]
    .some(value => typeof value === 'string' && value.trim().length > 0);
  const scoped = records.filter(matchesFloor);
  if (!scoped.length && records.some(job => !hasFloorScope(job))) {
    return missing(`ยังระบุชั้นของงานไม่ได้ เพราะ ${source} ยังไม่มีข้อมูลจับคู่งานกับชั้น`);
  }

  const items = [];
  const seen = new Set();
  for (const job of scoped) {
    const id = text(job.id, MAX_ID_LENGTH);
    const title = text(job.title, MAX_TITLE_LENGTH);
    const statusKey = text(job.status, 32).toLowerCase();
    const status = ACTIVE_STATUSES.get(statusKey);
    if (!id || !title || !status || seen.has(id)) continue;
    seen.add(id);
    items.push({id, title, status});
    if (items.length === MAX_ITEMS) break;
  }

  if (!items.length) return empty('ยังไม่มีงานที่กำลังทำหรือรอของชั้นนี้', checkedAt, source);
  return {
    state: 'READY', source, items,
    message: 'งานที่กำลังทำหรือรอของชั้นนี้', checkedAt,
  };
}

function makeElement(document, tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function normalizeProjection(result) {
  const states = ['READY', 'EMPTY', 'UNAVAILABLE'];
  const validT3 = result && typeof result === 'object' && [SOURCE,'Synthetic'].includes(result.source) && states.includes(result.state);
  const validZuriUnavailable = result && typeof result === 'object'
    && result.source === 'Zuri' && result.state === 'UNAVAILABLE'
    && Array.isArray(result.items) && result.items.length === 0;
  if (!validT3 && !validZuriUnavailable) {
    return unavailable('ไม่สามารถยืนยันแหล่งข้อมูลของรายการงานได้', undefined, 'ยังไม่ยืนยัน');
  }
  const source = result.source;
  const checkedAt = text(result.checkedAt, 64);
  if (result.state === 'UNAVAILABLE') {
    return unavailable(text(result.message, 240) || 'ยังตรวจสอบงานของชั้นนี้ไม่ได้', checkedAt, source);
  }
  if (result.state === 'EMPTY') {
    return {...empty(text(result.message, 240) || 'ยังไม่มีงานที่กำลังทำหรือรอของชั้นนี้', checkedAt), source};
  }

  const items = [];
  const seen = new Set();
  if (Array.isArray(result.items)) {
    for (const item of result.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const id = text(item.id, MAX_ID_LENGTH);
      const title = text(item.title, MAX_TITLE_LENGTH);
      const status = text(item.status, 64);
      if (!id || !title || !status || seen.has(id)) continue;
      seen.add(id);
      items.push({id, title, status});
      if (items.length === MAX_ITEMS) break;
    }
  }
  if (!items.length) return empty('ยังไม่มีงานที่กำลังทำหรือรอของชั้นนี้', checkedAt, source);
  return {
    state: 'READY', source, items,
    message: text(result.message, 240) || 'งานที่กำลังทำหรือรอของชั้นนี้',
    ...(checkedAt ? {checkedAt} : {}),
  };
}

export function openFloorTasks(root, {floor = {}, getTasks, onOpenTask, onOpenWork} = {}) {
  const document = root?.ownerDocument;
  if (!root || !document?.createElement || typeof root.append !== 'function') {
    throw new TypeError('openFloorTasks requires a DOM root element');
  }

  const floorScope = floor && typeof floor === 'object' ? floor : {};
  const floorKey = typeof floorScope.key === 'string' ? floorScope.key : '';
  const floorLabel = text(floorScope.label, 120) || 'ชั้นนี้';
  const reserved = floorScope.reserved === true;
  // The board is removed rather than closed, and a removed modal does not hand
  // focus back on its own, so remember the control that opened it.
  const opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  const dialog = document.createElement('dialog');
  dialog.className = 'floor-tasks-dialog';
  dialog.setAttribute('aria-modal', 'true');
  const id = nextDialogId++;
  const titleId = `floor-tasks-title-${id}`;
  const hintId = `floor-tasks-hint-${id}`;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.setAttribute('aria-describedby', hintId);
  dialog.dataset.floorKey = floorKey;

  const heading = makeElement(document, 'h2', 'floor-tasks-title', `งานที่ทำอยู่ · ${floorLabel}`);
  heading.id = titleId;
  const hint = makeElement(document, 'p', 'floor-tasks-source', `ขอบเขต: ${floorLabel} · แหล่งข้อมูล: ยังไม่ยืนยัน`);
  hint.id = hintId;
  const status = makeElement(document, 'p', 'floor-tasks-message', 'กำลังโหลดงานของชั้นนี้…');
  status.setAttribute('role', 'status');
  const list = makeElement(document, 'ul', 'floor-tasks-list');
  const actions = makeElement(document, 'div', 'floor-tasks-actions');
  const refresh = makeElement(document, 'button', 'floor-tasks-refresh', 'ลองใหม่');
  refresh.type = 'button';
  refresh.dataset.refreshFloorTasks = '';
  const close = makeElement(document, 'button', 'floor-tasks-close', 'ปิด');
  close.type = 'button';
  if (!reserved) actions.append(refresh);
  if (!reserved && typeof onOpenWork === 'function') {
    const openWork = makeElement(document, 'button', 'floor-tasks-open-work', 'เปิดรายการงาน');
    openWork.type = 'button';
    openWork.dataset.openWork = '';
    openWork.addEventListener('click', () => {dispose();onOpenWork();});
    actions.append(openWork);
  }
  actions.append(close);
  dialog.append(heading, hint, status, list, actions);

  let disposed = false;
  let requestNumber = 0;
  const stillOwned = () => !disposed && dialog.parentNode === root && root.contains?.(dialog) !== false
    && (typeof floorScope.key === 'string' ? floorScope.key === floorKey : floorKey === '');
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    requestNumber++;
    const focusWasInside = dialog.contains(document.activeElement);
    dialog.remove();
    const active = document.activeElement;
    if (opener?.isConnected && typeof opener.focus === 'function'
      && (focusWasInside || !active || active === document.body)) opener.focus();
  };
  dialog.dispose = dispose;
  close.addEventListener('click', dispose);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    dispose();
  });
  dialog.addEventListener('close', dispose, {once: true});

  const renderUnavailable = message => {
    status.textContent = message;
    list.replaceChildren();
  };
  const refreshTasks = async () => {
    const currentRequest = ++requestNumber;
    if (reserved) {
      hint.textContent = `ขอบเขต: ${floorLabel} · รายชื่อชั้นของ Office · พื้นที่เตรียมการ`;
      renderUnavailable('พื้นที่เตรียมการ · แผนกนี้ยังไม่เปิดใช้งาน ไม่ได้อ่านรายการงาน');
      return;
    }
    status.textContent = 'กำลังโหลดงานของชั้นนี้…';
    list.replaceChildren();
    if (typeof getTasks !== 'function') {
      if (stillOwned() && currentRequest === requestNumber) renderUnavailable('ยังไม่มีแหล่งอ่านข้อมูลงานของชั้นนี้');
      return;
    }

    try {
      const result = await getTasks(floorKey);
      if (!stillOwned() || currentRequest !== requestNumber) return;
      const projection = normalizeProjection(result);
      hint.textContent = `ขอบเขต: ${floorLabel} · แหล่งข้อมูล: ${projection.source}`;
      status.textContent = projection.message;
      if (projection.state !== 'READY') return;

      for (const item of projection.items) {
        const row = makeElement(document, 'li', 'floor-task-row');
        const button = makeElement(document, 'button', 'floor-task-item');
        button.type = 'button';
        button.dataset.floorTaskId = item.id;
        button.append(
          makeElement(document, 'span', 'floor-task-item-title', item.title),
          makeElement(document, 'span', 'floor-task-item-status', item.status),
        );
        if (typeof onOpenTask === 'function') {
          button.addEventListener('click', () => {dispose();onOpenTask(item.id, item);});
        } else {
          button.disabled = true;
        }
        row.append(button);
        list.append(row);
      }
    } catch {
      if (!stillOwned() || currentRequest !== requestNumber) return;
      renderUnavailable('อ่านรายการงานของชั้นนี้ไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  };
  refresh.addEventListener('click', () => { void refreshTasks(); });

  root.append(dialog);
  if (typeof dialog.showModal === 'function') {
    try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
  } else {
    dialog.setAttribute('open', '');
  }
  void refreshTasks();
  return dialog;
}
