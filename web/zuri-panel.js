import {domainFloors} from './domain-office.js';
import {ZuriConnector, normalizeZuriOrigin, safeZuriBusinessesUrl, safeZuriLoginUrl} from './zuri-connector.js';

const STATE_COPY = Object.freeze({
  READY: 'อ่านข้อมูลได้', EMPTY: 'ยังไม่มีรายการ', AUTH_REQUIRED: 'ต้องลงชื่อเข้าใช้',
  FORBIDDEN: 'ไม่มีสิทธิ์อ่าน', RESERVED: 'Zuri สำรองพื้นที่นี้',
  UNAVAILABLE: 'ยังไม่พร้อม', ERROR: 'อ่านไม่สำเร็จ', LOADING: 'กำลังอ่านข้อมูล', NO_BUSINESS: 'ยังไม่มี Business',
});

const text = (value, limit = 180) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
const node = (tag, className = '', value = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== '') element.textContent = value;
  return element;
};

function asState(value) {
  const state = String(value || '').toUpperCase();
  if (['READY', 'EMPTY', 'AUTH_REQUIRED', 'FORBIDDEN', 'RESERVED', 'UNAVAILABLE', 'ERROR'].includes(state)) return state;
  return 'ERROR';
}

function normalizeDomainResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.state !== 'string' || !Array.isArray(value.records)) {
    return {state: 'ERROR', records: [], count: 0, agent: {state: 'UNAVAILABLE', reason: 'Unsupported response from Zuri.'}};
  }
  const state = asState(value.state);
  const source = value.source && typeof value.source === 'object' ? {
    path: text(value.source.path || '', 120),
    status: Number.isFinite(Number(value.source.status)) ? Number(value.source.status) : undefined,
  } : undefined;
  const common = {
    domain: text(value.domain || '', 64), state, checkedAt: text(value.checkedAt || '', 40), source,
    agent: {state: 'UNAVAILABLE', reason: agentUnavailableReason(value.agent)},
  };
  if (['ERROR', 'UNAVAILABLE', 'AUTH_REQUIRED', 'FORBIDDEN', 'RESERVED'].includes(state)) {
    return {...common, records: [], count: 0};
  }
  const records = value.records.filter(item => item && typeof item === 'object' && !Array.isArray(item)
    && (typeof item.id === 'string' || typeof item.label === 'string')).slice(0, 100).map(item => ({
      id: text(item.id || '', 128), label: text(item.label || item.id || 'รายการ', 110), status: text(item.status || '', 48),
    }));
  const count = Number(value.displayedCount ?? (value.countKind === 'DISPLAYED' ? value.count : NaN));
  return {
    ...common,
    records,
    count: Number.isInteger(count) && count >= 0 ? count : records.length,
    displayedCount: Number.isInteger(count) && count >= 0 ? count : records.length,
    countKind: 'DISPLAYED',
    truncated: value.truncated === true,
    moreAvailable: value.moreAvailable === true,
  };
}

function stateForError(error) {
  if (error?.status === 401) return 'AUTH_REQUIRED';
  if (error?.status === 403) return 'FORBIDDEN';
  if (error?.status === 501 || error?.status === 503) return 'UNAVAILABLE';
  return 'ERROR';
}

function displayPrimitive(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (['string', 'number', 'boolean'].includes(typeof value)) return text(value, 120);
  return '—';
}

function agentUnavailableReason(agent) {
  const reason = String(agent?.reason || '');
  if (!reason || reason === 'NATIVE_AGENT_DISPATCH_UNAVAILABLE' || reason === 'Native Zuri agent execution is unavailable.') {
    return 'Zuri ยังไม่มี API สำหรับสั่ง agent ประจำแผนก';
  }
  return text(reason, 160);
}

function businessRows(scope) {
  const activeId = scope?.shell?.activeBusinessId || scope?.activeBusinessId || '';
  const rows = Array.isArray(scope?.businesses) ? scope.businesses : [];
  return {
    activeId: String(activeId),
    businesses: rows.filter(item => item && typeof item.id === 'string').map(item => ({
      id: item.id,
      name: text(item.name || item.code || item.id, 100),
      code: text(item.code, 60),
    })),
  };
}

function projectionLines(result, kind) {
  if (!result || typeof result !== 'object') return ['ได้รับผลลัพธ์จาก Zuri'];
  const projection = result.response && typeof result.response === 'object' ? result.response : result;
  if (kind === 'growth') {
    const answer = projection.answer && typeof projection.answer === 'object' ? projection.answer : {};
    const sections = Array.isArray(answer.sections) ? answer.sections : [];
    const lines = [
      `ผลอ่านอย่างเดียว · ${text(projection.intentType || 'ไม่จัดประเภท', 48)} · ${text(result.state || projection.state || 'UNKNOWN', 24)}`,
      ...sections.slice(0, 3).map(section => {
        const label = text(section?.title || section?.key || 'หัวข้อ', 48);
        const part = section?.count !== undefined && section?.count !== null
          ? `${displayPrimitive(section.count)} รายการ`
          : displayPrimitive(section?.value);
        const state = section?.state ? ` · ${text(section.state, 24)}` : '';
        return `${label} · ${part}${state}`;
      }),
    ];
    if (!sections.length) lines.push('ยังไม่มีค่าที่วัดได้สำหรับคำถามนี้');
    if (Array.isArray(projection.sources)) lines.push(`แหล่งข้อมูลประกอบ ${projection.sources.length} แหล่ง`);
    return lines;
  }
  const results = projection.results;
  const lines = [`การค้นความรู้ตามสิทธิ์ · ${text(result.state || 'UNKNOWN', 32)}`];
  if (!Array.isArray(results)) return [...lines, 'รูปแบบผลลัพธ์จาก Zuri ไม่ครบ'];
  if (results.length) {
    lines.push(...results.slice(0, 3).map((item, index) => {
      const citation = text(item?.citationId || `ผล ${index + 1}`, 64);
      const source = text(item?.sourceId || '', 48);
      const excerpt = text(item?.text || '', 170);
      return `${citation}${source ? ` · ${source}` : ''}${excerpt ? ` — ${excerpt}` : ''}`;
    }));
  } else if (result.state === 'EMPTY') {
    lines.push('ไม่พบรายการที่ตรงกับคำค้นนี้');
  } else {
    lines.push('Zuri ยังไม่มีผลการค้นที่ยืนยันได้');
  }
  return lines;
}

export class ZuriPanel {
  constructor(world, {connector = new ZuriConnector(), onConnectionState = () => {}} = {}) {
    this.world = world;
    this.connector = connector;
    this.onConnectionState = onConnectionState;
    this.enabled = false;
    this.status = null;
    this.scope = null;
    this.businesses = [];
    this.businessId = '';
    this.hasVerifiedRead = false;
    this.currentDomain = null;
    this.domainResults = new Map();
    this.sweepResults = new Map();
    this.sweepRunning = false;
    this.sweepComplete = false;
    this.contextRevision = 0;
    this.domainController = null;
    this.sweepController = null;
    this.commandController = null;
    this.floorVisible = false;
    this.interval = null;
    this.floorView = this.createFloorView();
    this.dialog = this.createDialog();
    this.world.append(this.dialog);
    this.bindDialog();
    this.ready = this.initialize();
  }

  createFloorView() {
    const section = node('section', 'zuri-floor-panel');
    section.hidden = true;
    section.setAttribute('aria-label', 'ข้อมูลและคำสั่งจริงจาก Zuri');
    return section;
  }

  createDialog() {
    const dialog = node('dialog', 'zuri-connect-dialog');
    dialog.setAttribute('aria-labelledby', 'zuri-connect-title');
    const heading = node('header', 'zuri-connect-heading');
    const titleWrap = node('div');
    titleWrap.append(node('span', 'zuri-eyebrow', 'ZURI CONNECTION'), node('h2', '', 'เชื่อมต่อข้อมูล Zuri'));
    titleWrap.querySelector('h2').id = 'zuri-connect-title';
    const close = node('button', 'zuri-icon-close', 'ปิด');
    close.type = 'button'; close.setAttribute('aria-label', 'ปิดหน้าต่างเชื่อมต่อ');
    close.dataset.zuriClose = '';
    heading.append(titleWrap, close);

    const status = node('p', 'zuri-connection-status');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const login = node('a', 'zuri-login-link', 'ลงชื่อเข้าใช้ Zuri');
    login.target = '_blank'; login.rel = 'noopener noreferrer'; login.referrerPolicy = 'no-referrer';
    login.hidden = true;
    const target = node('p', 'zuri-target-note', 'ปลายทางจากตัวเชื่อมที่ตั้งค่าไว้ · ยังไม่ทราบจนกว่าจะตรวจการเชื่อมต่อ');
    const businessLabel = node('label', 'zuri-business-label', 'Business ที่เลือก');
    const business = node('select', 'zuri-business-select');
    business.setAttribute('aria-label', 'เลือก Business สำหรับอ่านข้อมูล Zuri');
    businessLabel.append(business);
    const actions = node('div', 'zuri-connection-actions');
    const refresh = node('button', 'zuri-button secondary', 'ตรวจการเชื่อมต่อ');
    refresh.type = 'button'; refresh.dataset.zuriAction = 'refresh-scope';
    const runAll = node('button', 'zuri-button primary', 'ตรวจอ่านทั้ง 14 ชั้น');
    runAll.type = 'button'; runAll.dataset.zuriAction = 'run-all';
    const download = node('button', 'zuri-button secondary', 'ดาวน์โหลดรายงาน');
    download.type = 'button'; download.dataset.zuriAction = 'download'; download.disabled = true;
    actions.append(refresh, runAll, download);
    const sweepStatus = node('p', 'zuri-sweep-status');
    sweepStatus.setAttribute('role', 'status');
    const checks = node('div', 'zuri-domain-checks');
    checks.setAttribute('aria-label', 'ผลอ่านรายโดเมน');
    dialog.append(heading, status, login, target, businessLabel, actions, sweepStatus, checks);
    dialog._zuri = {status, login, business, refresh, runAll, download, sweepStatus, checks, target};
    return dialog;
  }

  bindDialog() {
    const ui = this.dialog._zuri;
    this.dialog.querySelector('[data-zuri-close]').onclick = () => this.dialog.close();
    this.dialog.onclick = event => {
      if (event.target !== this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.dialog.close();
    };
    ui.business.onchange = () => this.selectBusiness(ui.business.value);
    ui.refresh.onclick = () => { void this.refreshConnection(); };
    ui.runAll.onclick = () => { void this.runAllReadChecks(); };
    ui.download.onclick = () => this.downloadReport();
  }

  async initialize() {
    try {
      this.status = await this.connector.getStatus();
      this.targetOrigin = normalizeZuriOrigin(this.status?.target);
      this.enabled = this.status?.enabled === true && Boolean(this.targetOrigin);
      if (!this.enabled) {
        this.publishConnectionState(this.status?.enabled === false ? 'DISABLED' : 'UNAVAILABLE');
        return false;
      }
      this.publishConnectionState('CHECKING');
      await this.loadScope();
      this.publishConnectionState(this.businessId ? 'READY' : 'NO_BUSINESS');
      return true;
    } catch (error) {
      const state = stateForError(error);
      this.enabled = this.status?.enabled === true && Boolean(this.targetOrigin);
      this.publishConnectionState(this.enabled ? state : 'UNAVAILABLE');
      return this.enabled;
    } finally {
      this.updateConnectionDialog();
      if (this.currentDomain) this.showFloor(this.currentDomain, this.floorVisible);
    }
  }

  publishConnectionState(state) {
    const selected = this.businesses.find(item => item.id === this.businessId);
    this.connectionState = String(state || 'UNAVAILABLE').toUpperCase();
    this.onConnectionState({enabled: this.enabled, state: this.connectionState, businessName: selected?.name || '', hasVerifiedRead: this.hasVerifiedRead});
    this.updateConnectionDialog();
  }

  async loadScope({signal} = {}) {
    const scope = await this.connector.getScope({signal});
    const parsed = businessRows(scope);
    const priorBusinessId = this.businessId;
    this.scope = scope;
    this.businesses = parsed.businesses;
    const stored = this.readStoredBusinessId();
    const preferred = [this.businessId, stored, parsed.activeId].find(id => parsed.businesses.some(item => item.id === id));
    this.businessId = preferred || (parsed.businesses.length === 1 ? parsed.businesses[0].id : '');
    if (this.businessId !== priorBusinessId) this.hasVerifiedRead = false;
    this.writeStoredBusinessId(this.businessId);
    this.updateConnectionDialog();
    this.publishConnectionState(this.businessId ? 'READY' : 'NO_BUSINESS');
    return scope;
  }

  readStoredBusinessId() {
    try { return globalThis.localStorage?.getItem('zuri-office-business-id') || ''; } catch { return ''; }
  }

  writeStoredBusinessId(id) {
    try {
      if (id) globalThis.localStorage?.setItem('zuri-office-business-id', id);
      else globalThis.localStorage?.removeItem('zuri-office-business-id');
    } catch { /* storage may be unavailable in private or embedded browser contexts */ }
  }

  async refreshConnection() {
    const ui = this.dialog._zuri;
    ui.refresh.disabled = true;
    ui.status.textContent = 'กำลังตรวจสถานะและสิทธิ์ของผู้ใช้…';
    try {
      const status = await this.connector.getStatus();
      const previousOrigin = this.targetOrigin || '';
      this.status = status;
      this.targetOrigin = normalizeZuriOrigin(status?.target);
      if (this.targetOrigin !== previousOrigin) this.hasVerifiedRead = false;
      this.enabled = status?.enabled === true && Boolean(this.targetOrigin);
      if (!this.enabled) {
        this.clearPrivateData();
        const state = status?.enabled === false ? 'DISABLED' : 'UNAVAILABLE';
        this.publishConnectionState(state);
        ui.status.textContent = state === 'DISABLED' ? 'ตัวเชื่อมต่อ Zuri ปิดอยู่ · ใช้ตัวเชื่อมต่อเดิมของ Visual Office ได้' : 'ปลายทาง Zuri ไม่อยู่ในรายการที่อนุญาต';
        return false;
      }
      await this.loadScope();
      ui.status.textContent = this.businessId ? 'เชื่อมต่อผ่าน proxy ในเครื่อง · ใช้สิทธิ์ของบัญชีที่ลงชื่อเข้าใช้ Zuri' : 'บัญชีนี้ยังไม่มี Business ที่เลือกได้';
      if (this.currentDomain) this.showFloor(this.currentDomain, this.floorVisible);
      return true;
    } catch (error) {
      this.applyFailure(error);
      ui.status.textContent = this.stateMessage(stateForError(error));
      return false;
    } finally {
      ui.refresh.disabled = false;
      this.updateConnectionDialog();
    }
  }

  async openConnection() {
    await this.ready;
    if (!this.enabled) return false;
    if (!this.dialog.open) this.dialog.showModal();
    await this.refreshConnection();
    return true;
  }

  selectBusiness(businessId) {
    const selected = this.businesses.find(item => item.id === businessId);
    if (!selected || selected.id === this.businessId) return;
    this.contextRevision++;
    this.domainController?.abort(); this.domainController = null;
    this.sweepController?.abort(); this.sweepController = null;
    this.commandController?.abort(); this.commandController = null;
    this.activeSweepId = null;
    this.businessId = selected.id;
    this.hasVerifiedRead = false;
    this.writeStoredBusinessId(this.businessId);
    this.domainResults.clear(); this.sweepResults.clear();
    this.sweepComplete = false; this.sweepRunning = false;
    this.clearCommandFields('เลือก Business แล้วส่งคำถามใหม่');
    this.renderSweepRows();
    this.publishConnectionState('READY');
    this.updateConnectionDialog();
    if (this.currentDomain) this.syncCurrentDomain();
  }

  showFloor(domain, visible = true) {
    const changed = this.currentDomain?.key !== domain?.key || this.floorVisible !== visible;
    if (changed) {
      this.contextRevision++;
      this.domainController?.abort(); this.domainController = null;
      this.commandController?.abort(); this.commandController = null;
    }
    this.clearTimer();
    this.stopFloorVisibility();
    this.domainController?.abort(); this.domainController = null;
    this.currentDomain = domain || null;
    this.floorVisible = Boolean(domain && visible);
    this.floorView.hidden = !this.enabled || !visible || !domain;
    if (!domain || !visible || !this.enabled) return;
    this.renderFloorShell(domain);
    const doc = this.world.ownerDocument;
    this.floorVisibilityChange = (initial = false) => {
      this.clearTimer();
      if (doc.hidden || !this.floorVisible || !this.enabled) return;
      if (initial === true || !this.dialog.open) void this.syncCurrentDomain();
      this.interval = globalThis.setInterval?.(() => { if (!doc.hidden && !this.dialog.open) void this.syncCurrentDomain(); }, 30000) || null;
    };
    doc.addEventListener('visibilitychange', this.floorVisibilityChange);
    this.floorVisibilityChange(true);
  }

  hideFloor() {
    this.contextRevision++;
    this.clearTimer();
    this.stopFloorVisibility();
    this.domainController?.abort(); this.domainController = null;
    this.commandController?.abort(); this.commandController = null;
    this.currentDomain = null;
    this.floorVisible = false;
    this.floorView.hidden = true;
  }

  clearTimer() {
    if (this.interval !== null) globalThis.clearInterval?.(this.interval);
    this.interval = null;
  }

  stopFloorVisibility() {
    if (this.floorVisibilityChange) this.world.ownerDocument.removeEventListener('visibilitychange', this.floorVisibilityChange);
    this.floorVisibilityChange = null;
  }

  renderFloorShell(domain) {
    const section = this.floorView;
    section.replaceChildren();
    const head = node('header', 'zuri-floor-heading');
    const heading = node('div');
    heading.append(node('span', 'zuri-eyebrow', 'ZURI · ข้อมูลอ่านอย่างเดียว'), node('h2', '', `ข้อมูลจาก ${domain.label}`));
    const state = node('span', 'zuri-state-badge', STATE_COPY.LOADING);
    state.dataset.zuriCurrentState = '';
    head.append(heading, state);
    const businessLine = node('p', 'zuri-business-current');
    businessLine.dataset.zuriBusiness = '';
    const records = node('div', 'zuri-record-list');
    records.dataset.zuriRecords = '';
    records.setAttribute('aria-live', 'polite');
    const footer = node('div', 'zuri-floor-footer');
    const agent = node('p', 'zuri-agent-unavailable');
    agent.dataset.zuriAgent = '';
    const source = node('p', 'zuri-source-meta');
    source.dataset.zuriSource = '';
    footer.append(agent, source);
    const actions = node('div', 'zuri-floor-actions');
    const refresh = node('button', 'zuri-button secondary', 'รีเฟรชข้อมูล');
    refresh.type = 'button'; refresh.dataset.zuriAction = 'refresh-floor';
    refresh.onclick = () => { void this.syncCurrentDomain(); };
    const connect = node('button', 'zuri-button quiet', 'เลือก Business / เชื่อมต่อ');
    connect.type = 'button'; connect.dataset.zuriAction = 'open-connection';
    connect.onclick = () => { void this.openConnection(); };
    const open = node('a', 'zuri-button quiet', 'เปิดโดเมนใน Zuri');
    open.target = '_blank'; open.rel = 'noopener noreferrer'; open.referrerPolicy = 'no-referrer';
    open.dataset.zuriDomainLink = '';
    actions.append(refresh, connect, open);
    const login = node('a', 'zuri-login-link compact', 'ลงชื่อเข้าใช้ Zuri');
    login.target = '_blank'; login.rel = 'noopener noreferrer'; login.referrerPolicy = 'no-referrer'; login.hidden = true;
    const commands = node('div', 'zuri-command-area');
    const linkHint = node('p', 'zuri-business-link-hint');
    linkHint.dataset.zuriBusinessLinkHint = '';
    linkHint.hidden = true;
    if (domain.key === 'growth') this.appendGrowthCommand(commands);
    else if (domain.key === 'knowledge') this.appendKnowledgeCommand(commands);
    else commands.append(node('p', 'zuri-command-note', 'ยังไม่มีคำสั่งอ่านข้อมูลสำหรับชั้นนี้'));
    section.append(head, businessLine, records, footer, actions, linkHint, login, commands);
    this.updateFloorContent();
  }

  appendGrowthCommand(host) {
    const section = node('section', 'zuri-command-card');
    section.append(node('span', 'zuri-command-kicker', 'ASK MARKETING'), node('p', 'zuri-command-note', 'สรุปแคมเปญจากข้อมูลธุรกิจ · อ่านอย่างเดียว'));
    const form = node('form', 'zuri-command-form');
    const input = node('input', 'zuri-command-input');
    input.type = 'text'; input.name = 'question'; input.required = true; input.maxLength = 240;
    input.placeholder = 'ถามเรื่องแคมเปญหรือยอดขาย'; input.setAttribute('aria-label', 'คำถามสำหรับ Ask Marketing');
    const submit = node('button', 'zuri-button primary', 'อ่านผล'); submit.type = 'submit';
    form.append(input, submit);
    const result = node('div', 'zuri-command-result'); result.setAttribute('aria-live', 'polite'); result.dataset.zuriCommandResult = 'growth';
    form.onsubmit = event => { event.preventDefault(); void this.runCommand('growth', input, submit, result); };
    section.append(form, result); host.append(section);
  }

  appendKnowledgeCommand(host) {
    const section = node('section', 'zuri-command-card');
    section.append(node('span', 'zuri-command-kicker', 'KNOWLEDGE SEARCH'), node('p', 'zuri-command-note', 'ค้นแหล่งความรู้ตามสิทธิ์ · อ่านอย่างเดียว'));
    const form = node('form', 'zuri-command-form');
    const input = node('input', 'zuri-command-input');
    input.type = 'search'; input.name = 'query'; input.required = true; input.maxLength = 500;
    input.placeholder = 'ค้นข้อมูลความรู้'; input.setAttribute('aria-label', 'คำค้นหาความรู้');
    const submit = node('button', 'zuri-button primary', 'ค้นหา'); submit.type = 'submit';
    form.append(input, submit);
    const result = node('div', 'zuri-command-result'); result.setAttribute('aria-live', 'polite'); result.dataset.zuriCommandResult = 'knowledge';
    form.onsubmit = event => { event.preventDefault(); void this.runCommand('knowledge', input, submit, result); };
    section.append(form, result); host.append(section);
  }

  async syncCurrentDomain() {
    const domain = this.currentDomain;
    if (!this.enabled || !domain || !this.businessId || this.floorView.hidden) {
      this.updateFloorContent();
      return null;
    }
    this.domainController?.abort();
    const controller = new AbortController();
    this.domainController = controller;
    const businessId = this.businessId;
    const revision = this.contextRevision;
    const key = domain.key;
    this.floorView.querySelector('[data-zuri-action="refresh-floor"]').disabled = true;
    this.domainResults.set(key, {state: 'LOADING', records: [], count: 0});
    this.updateFloorContent();
    try {
      const result = await this.connector.getDomain(key, businessId, {signal: controller.signal});
      if (controller.signal.aborted || revision !== this.contextRevision || this.currentDomain?.key !== key || this.businessId !== businessId) return null;
      const normalized = normalizeDomainResult(result);
      this.domainResults.set(key, normalized);
      if (['READY', 'EMPTY'].includes(normalized.state) && normalized.source?.status === 200) {
        this.hasVerifiedRead = true;
        this.publishConnectionState('READY');
      }
      this.updateFloorContent();
      return normalized;
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') return null;
      if (revision !== this.contextRevision || this.currentDomain?.key !== key || this.businessId !== businessId) return null;
      this.applyFailure(error, key);
      return null;
    } finally {
      if (this.domainController === controller) this.domainController = null;
      if (this.currentDomain?.key === key) {
        const refresh = this.floorView.querySelector('[data-zuri-action="refresh-floor"]');
        if (refresh) refresh.disabled = false;
      }
    }
  }

  async runCommand(kind, input, submit, resultNode) {
    const businessId = this.businessId;
    const domain = this.currentDomain;
    const query = text(input.value, kind === 'growth' ? 240 : 500);
    if (!this.enabled || !businessId || !domain || (kind === 'growth' ? domain.key !== 'growth' : domain.key !== 'knowledge') || !query) return;
    submit.disabled = true;
    input.disabled = true;
    resultNode.replaceChildren(node('p', 'zuri-command-feedback', 'กำลังอ่านข้อมูลจาก Zuri…'));
    const controller = new AbortController();
    this.commandController?.abort();
    this.commandController = controller;
    const revision = this.contextRevision;
    try {
      const result = kind === 'growth'
        ? await this.connector.askGrowth(businessId, query, {signal: controller.signal})
        : await this.connector.searchKnowledge(businessId, query, {signal: controller.signal});
      if (revision !== this.contextRevision || this.businessId !== businessId || this.currentDomain?.key !== domain.key) return;
      const lines = projectionLines(result, kind);
      const heading = node('strong', 'zuri-command-result-title', kind === 'growth' ? 'Ask Marketing · projection' : 'Knowledge · search result');
      const list = node('ul', 'zuri-command-result-list');
      lines.slice(0, kind === 'growth' ? 5 : 6).forEach(line => list.append(node('li', '', line)));
      resultNode.replaceChildren(heading, list);
    } catch (error) {
      if (error?.name === 'AbortError' || revision !== this.contextRevision) return;
      const state = stateForError(error);
      if (state === 'AUTH_REQUIRED') this.clearPrivateData();
      resultNode.replaceChildren(node('p', 'zuri-command-feedback', this.stateMessage(state)));
      this.toggleLoginLinks(state === 'AUTH_REQUIRED');
    } finally {
      input.disabled = false;
      submit.disabled = false;
      if (this.commandController === controller) this.commandController = null;
    }
  }

  updateFloorContent() {
    if (!this.currentDomain || !this.floorView.isConnected) return;
    const domain = this.currentDomain;
    const result = this.domainResults.get(domain.key);
    const business = this.businesses.find(item => item.id === this.businessId);
    const state = result ? asState(result.state) : this.businessId ? 'LOADING' : 'NO_BUSINESS';
    const badge = this.floorView.querySelector('[data-zuri-current-state]');
    if (badge) { badge.textContent = this.stateMessage(state); badge.dataset.state = state.toLowerCase(); }
    const businessLine = this.floorView.querySelector('[data-zuri-business]');
    if (businessLine) businessLine.textContent = business ? `Business · ${business.name}` : 'เลือก Business เพื่ออ่านข้อมูลตามสิทธิ์ของคุณ';
    const recordsNode = this.floorView.querySelector('[data-zuri-records]');
    if (recordsNode) this.renderRecords(recordsNode, result, state);
    const agent = this.floorView.querySelector('[data-zuri-agent]');
    if (agent) {
      const reason = agentUnavailableReason(result?.agent);
      agent.textContent = `Zuri Agent · UNAVAILABLE — ${reason}`;
    }
    const source = this.floorView.querySelector('[data-zuri-source]');
    if (source) {
      const sourceStatus = Number(result?.source?.status);
      const checkedAt = text(result?.checkedAt || '', 40);
      source.textContent = result?.source?.status !== undefined
        ? `อ่านต้นทางแล้ว${Number.isFinite(sourceStatus) ? ` · HTTP ${sourceStatus}` : ''}${checkedAt ? ` · ${checkedAt}` : ''}`
        : 'ข้อมูลต้นทางจะปรากฏเมื่ออ่านสำเร็จ';
    }
    const connect = this.floorView.querySelector('[data-zuri-action="open-connection"]');
    if (connect) connect.hidden = Boolean(this.businessId);
    const link = this.floorView.querySelector('[data-zuri-domain-link]');
    if (link) {
      const origin = this.targetOrigin;
      const businessesUrl = safeZuriBusinessesUrl(origin);
      if (businessesUrl) link.href = businessesUrl;
      else link.removeAttribute('href');
      link.hidden = !this.businessId || !businessesUrl;
      link.textContent = 'เปิด Zuri เพื่อเลือกธุรกิจ';
    }
    const linkHint = this.floorView.querySelector('[data-zuri-business-link-hint]');
    if (linkHint) {
      linkHint.hidden = !this.businessId;
      linkHint.textContent = business
        ? `เลือก “${business.name}” ใน Visual Office · ตรวจว่าบริบทเดียวกันถูกเลือกใน Zuri ด้วย`
        : 'เลือก Business ใน Visual Office แล้วตรวจบริบทอีกครั้งใน Zuri';
    }
    const refresh = this.floorView.querySelector('[data-zuri-action="refresh-floor"]');
    if (refresh) refresh.disabled = !this.businessId || state === 'LOADING';
    this.toggleLoginLinks(state === 'AUTH_REQUIRED');
    this.updateCommandAvailability();
  }

  renderRecords(host, result, state) {
    const previousKey = host.dataset.signature || '';
    const records = Array.isArray(result?.records) ? result.records : [];
    const signature = JSON.stringify([state, result?.count, records.map(item => [item?.id, item?.label, item?.status])]);
    if (signature === previousKey) return;
    host.dataset.signature = signature;
    host.replaceChildren();
    if (state === 'LOADING') { host.append(node('p', 'zuri-empty-state', 'กำลังอ่านข้อมูลจริงของ Business นี้…')); return; }
    if (state === 'AUTH_REQUIRED') { host.append(node('p', 'zuri-empty-state', 'ต้องลงชื่อเข้าใช้ก่อนจึงจะแสดงข้อมูลส่วนตัว')); return; }
    if (state === 'NO_BUSINESS') { host.append(node('p', 'zuri-empty-state', 'เปิดการเชื่อมต่อแล้วเลือก Business ที่คุณมีสิทธิ์เข้าถึง')); return; }
    if (state === 'FORBIDDEN') { host.append(node('p', 'zuri-empty-state', 'บัญชีนี้ไม่มีสิทธิ์อ่านโดเมนที่เลือก')); return; }
    if (state === 'RESERVED') { host.append(node('p', 'zuri-empty-state', 'โดเมนนี้ยังถูกสำรองไว้และไม่มีข้อมูลที่เปิดอ่านได้')); return; }
    if (state === 'UNAVAILABLE' || state === 'ERROR') { host.append(node('p', 'zuri-empty-state', this.stateMessage(state))); return; }
    if (!records.length) { host.append(node('p', 'zuri-empty-state', 'ยังไม่มีรายการใน Business นี้')); return; }
    const count = records.slice(0, 8).length;
    const caption = node('p', 'zuri-record-count', `แสดง ${count} รายการ`);
    const list = node('ul', 'zuri-record-items');
    records.slice(0, 8).forEach(record => {
      const item = node('li', 'zuri-record-item');
      const label = text(record?.label || record?.id || 'รายการ', 110);
      const status = text(record?.status, 48);
      item.append(node('span', 'zuri-record-label', label));
      if (status) item.append(node('span', 'zuri-record-status', status));
      list.append(item);
    });
    host.append(caption, list);
    if (records.length > 8) host.append(node('p', 'zuri-record-more', `แสดง 8 รายการ · ยังมีรายการเพิ่มเติม`));
    else if (result?.truncated || result?.moreAvailable) host.append(node('p', 'zuri-record-more', 'รายการที่แสดงถูกจำกัด · ยังมีรายการเพิ่มเติม'));
  }

  updateCommandAvailability() {
    for (const form of this.floorView.querySelectorAll('.zuri-command-form')) {
      const input = form.querySelector('input');
      const submit = form.querySelector('button[type="submit"]');
      if (input && !input.disabled) submit.disabled = !this.enabled || !this.businessId;
    }
  }

  clearCommandFields(message) {
    for (const form of this.floorView.querySelectorAll('.zuri-command-form')) {
      const input = form.querySelector('input');
      if (input) { input.value = ''; input.disabled = false; }
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !this.enabled || !this.businessId;
    }
    for (const result of this.floorView.querySelectorAll('.zuri-command-result')) {
      result.replaceChildren(node('p', 'zuri-command-feedback', message));
    }
  }

  async runAllReadChecks() {
    if (!this.enabled || !this.businessId || this.sweepRunning) return;
    this.sweepController?.abort();
    const controller = new AbortController();
    this.sweepController = controller;
    const businessId = this.businessId;
    const revision = this.contextRevision;
    const runId = `${Date.now()}-${Math.random()}`;
    this.activeSweepId = runId;
    this.sweepRunning = true;
    this.sweepComplete = false;
    this.sweepResults = new Map(domainFloors.map(domain => [domain.key, {state: 'LOADING', records: [], count: 0}]));
    this.renderSweepRows();
    const ui = this.dialog._zuri;
    ui.runAll.disabled = true;
    ui.download.disabled = true;
    ui.sweepStatus.textContent = 'กำลังตรวจอ่านตามลำดับ · ไม่ส่งคำสั่งแก้ไขข้อมูล';
    for (const domain of domainFloors) {
      if (controller.signal.aborted || this.activeSweepId !== runId || revision !== this.contextRevision || businessId !== this.businessId) break;
      try {
        const result = await this.connector.getDomain(domain.key, businessId, {signal: controller.signal});
        if (controller.signal.aborted || this.activeSweepId !== runId || revision !== this.contextRevision) break;
        const normalized = normalizeDomainResult(result);
        this.sweepResults.set(domain.key, normalized);
        if (this.currentDomain?.key === domain.key) this.domainResults.set(domain.key, normalized);
        if (['READY', 'EMPTY'].includes(normalized.state) && normalized.source?.status === 200 && !this.hasVerifiedRead) {
          this.hasVerifiedRead = true;
          this.publishConnectionState('READY');
        }
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) break;
        const state = stateForError(error);
        this.sweepResults.set(domain.key, {state, checkedAt: new Date().toISOString(), records: [], count: 0, source: {status: error?.status || undefined}, agent: {state: 'UNAVAILABLE', reason: 'Zuri ยังไม่มี API สำหรับสั่ง agent ประจำแผนก'}});
        if (state === 'AUTH_REQUIRED') {
          this.clearPrivateData({preserveSweep: true});
          for (const pending of domainFloors.slice(domainFloors.indexOf(domain) + 1)) {
            this.sweepResults.set(pending.key, {state: 'AUTH_REQUIRED', checkedAt: '', records: [], count: 0, agent: {state: 'UNAVAILABLE', reason: 'Sign in is required.'}});
          }
          this.renderSweepRows();
          break;
        }
      }
      this.renderSweepRow(domain.key);
      if (this.currentDomain?.key === domain.key) this.updateFloorContent();
      ui.sweepStatus.textContent = `ตรวจแล้ว ${this.sweepResults.size} จาก ${domainFloors.length} ชั้น`;
    }
    if (this.sweepController === controller) this.sweepController = null;
    if (this.activeSweepId === runId) {
      this.sweepRunning = false;
      this.sweepComplete = true;
      ui.runAll.disabled = !this.businessId;
      ui.download.disabled = this.sweepResults.size === 0;
      const checked = [...this.sweepResults.values()].filter(item => item.state !== 'LOADING').length;
      ui.sweepStatus.textContent = controller.signal.aborted
        ? 'หยุดการตรวจเมื่อ Business เปลี่ยนหรือหน้าต่างปิด'
        : `ตรวจครบ ${checked} จาก ${domainFloors.length} ชั้น · รายงานดาวน์โหลดมีเฉพาะสถานะและจำนวนรายการ`;
    }
    this.updateFloorContent();
  }

  renderSweepRows() {
    const host = this.dialog._zuri.checks;
    host.replaceChildren();
    for (const domain of domainFloors) {
      const row = node('div', 'zuri-check-row'); row.dataset.zuriCheckKey = domain.key;
      row.append(node('span', 'zuri-check-floor', `${String(domain.number).padStart(2, '0')} · ${domain.thai}`), node('span', 'zuri-check-state', 'รอตรวจ'));
      host.append(row);
    }
    for (const domain of domainFloors) this.renderSweepRow(domain.key);
  }

  renderSweepRow(key) {
    const row = this.dialog._zuri.checks.querySelector(`[data-zuri-check-key="${key}"]`);
    const result = this.sweepResults.get(key);
    if (!row || !result) return;
    const state = asState(result.state);
    const count = Number(result.count ?? result.records?.length ?? 0);
    row.querySelector('.zuri-check-state').textContent = `${this.stateMessage(state)}${Number.isFinite(count) ? ` · แสดง ${count}` : ''}`;
    row.querySelector('.zuri-check-state').dataset.state = state.toLowerCase();
  }

  sanitizedReport() {
    const business = this.businesses.find(item => item.id === this.businessId);
    const domains = domainFloors.map(domain => {
      const result = this.sweepResults.get(domain.key) || {};
      return {
        floor: domain.number,
        domain: domain.key,
        state: asState(result.state),
        checkedAt: text(result.checkedAt || '', 40) || null,
        sourceStatus: Number.isFinite(Number(result?.source?.status)) ? Number(result.source.status) : null,
        displayedCount: Math.max(0, Number(result.displayedCount ?? result.count ?? result.records?.length ?? 0) || 0),
        countKind: 'DISPLAYED',
        truncated: result.truncated === true || result.moreAvailable === true,
        agent: 'UNAVAILABLE',
      };
    });
    return {
      schemaVersion: 'zuri-office-read-report/v1',
      target: this.targetOrigin || '',
      business: business ? {name: business.name} : null,
      generatedAt: new Date().toISOString(),
      checks: domains,
    };
  }

  downloadReport() {
    if (!this.sweepResults.size || typeof Blob !== 'function' || !globalThis.URL?.createObjectURL) return;
    const blob = new Blob([JSON.stringify(this.sanitizedReport(), null, 2)], {type: 'application/json'});
    const href = globalThis.URL.createObjectURL(blob);
    const link = node('a');
    link.href = href; link.download = 'zuri-office-read-report.json'; link.hidden = true;
    this.dialog.append(link); link.click(); link.remove(); globalThis.URL.revokeObjectURL(href);
  }

  applyFailure(error, domainKey = this.currentDomain?.key) {
    const state = stateForError(error);
    if (state === 'AUTH_REQUIRED') this.clearPrivateData();
    if (domainKey) this.domainResults.set(domainKey, {state, records: [], count: 0, checkedAt: new Date().toISOString(), agent: {state: 'UNAVAILABLE', reason: state === 'AUTH_REQUIRED' ? 'Sign in is required.' : 'Zuri ยังไม่มี API สำหรับสั่ง agent ประจำแผนก'}});
    this.publishConnectionState(state.toLowerCase());
    this.updateFloorContent();
    this.dialog._zuri.status.textContent = this.stateMessage(state);
    this.dialog._zuri.login.hidden = state !== 'AUTH_REQUIRED';
  }

  clearPrivateData({preserveSweep = false} = {}) {
    this.contextRevision++;
    this.domainController?.abort(); this.domainController = null;
    this.commandController?.abort(); this.commandController = null;
    if (!preserveSweep) { this.sweepController?.abort(); this.sweepController = null; }
    this.scope = null;
    this.businesses = [];
    this.businessId = '';
    this.hasVerifiedRead = false;
    this.writeStoredBusinessId('');
    this.domainResults.clear();
    if (!preserveSweep) this.sweepResults.clear();
    else {
      this.sweepResults = new Map([...this.sweepResults].map(([key, result]) => [key, {
        state: asState(result?.state), checkedAt: text(result?.checkedAt || '', 40),
        source: result?.source ? {status: Number.isFinite(Number(result.source.status)) ? Number(result.source.status) : undefined} : undefined,
        count: Math.max(0, Number(result?.displayedCount ?? result?.count ?? result?.records?.length ?? 0) || 0),
        displayedCount: Math.max(0, Number(result?.displayedCount ?? result?.count ?? result?.records?.length ?? 0) || 0),
        countKind: 'DISPLAYED', records: [],
        agent: {state: 'UNAVAILABLE', reason: 'Sign in is required.'},
      }]));
    }
    this.sweepComplete = false;
    this.clearCommandFields('ต้องลงชื่อเข้าใช้ก่อนส่งคำถาม');
    this.renderSweepRows();
    this.updateConnectionDialog();
    this.updateFloorContent();
    this.publishConnectionState('AUTH_REQUIRED');
  }

  toggleLoginLinks(visible) {
    for (const link of this.world.querySelectorAll('.zuri-login-link.compact')) link.hidden = !visible;
    this.dialog._zuri.login.hidden = !visible;
  }

  updateConnectionDialog() {
    if (!this.dialog?._zuri) return;
    const ui = this.dialog._zuri;
    const existing = ui.business.value;
    const signature = this.businesses.map(item => `${item.id}:${item.name}`).join('|');
    if (ui.business.dataset.signature !== signature) {
      ui.business.dataset.signature = signature;
      ui.business.replaceChildren();
      if (!this.businesses.length) {
        const option = node('option', '', this.connectionState === 'AUTH_REQUIRED' ? 'ลงชื่อเข้าใช้เพื่อดู Business' : 'ยังไม่มี Business ที่เลือกได้');
        option.value = ''; ui.business.append(option);
      } else {
        const placeholder = node('option', '', 'เลือก Business');
        placeholder.value = ''; ui.business.append(placeholder);
        for (const business of this.businesses) {
          const option = node('option', '', business.code ? `${business.name} · ${business.code}` : business.name);
          option.value = business.id; ui.business.append(option);
        }
      }
    }
    ui.business.value = this.businesses.some(item => item.id === this.businessId) ? this.businessId : '';
    ui.business.disabled = !this.businesses.length || this.sweepRunning;
    ui.runAll.disabled = !this.enabled || !this.businessId || this.sweepRunning;
    const statusMessage = this.connectionState === 'AUTH_REQUIRED'
      ? 'ต้องลงชื่อเข้าใช้ Zuri ก่อนอ่านข้อมูลส่วนตัว'
      : this.connectionState === 'UNAVAILABLE'
        ? 'ยังติดต่อ Zuri ในเครื่องไม่ได้'
        : this.connectionState === 'DISABLED' || !this.enabled
          ? 'ตัวเชื่อมต่อ Zuri ปิดอยู่'
          : this.businessId
            ? `ใช้สิทธิ์ของบัญชีที่ลงชื่อเข้าใช้ · ${this.businesses.find(item => item.id === this.businessId)?.name || 'Business ที่เลือก'}`
            : 'เลือก Business หลังลงชื่อเข้าใช้เพื่อเริ่มอ่านข้อมูล';
    if (!ui.status.textContent || ui.status.textContent.startsWith('กำลัง')) ui.status.textContent = statusMessage;
    ui.login.hidden = this.connectionState !== 'AUTH_REQUIRED';
    const loginUrl = safeZuriLoginUrl(this.targetOrigin);
    if (loginUrl) ui.login.href = loginUrl;
    else ui.login.removeAttribute('href');
    const floorLogin = this.floorView.querySelector('.zuri-login-link.compact');
    if (floorLogin) {
      if (loginUrl) floorLogin.href = loginUrl;
      else floorLogin.removeAttribute('href');
    }
    ui.target.textContent = `ปลายทางที่อนุญาต · ${this.targetOrigin || 'ยังไม่ทราบ'}`;
    ui.download.disabled = !this.sweepResults.size || this.sweepRunning;
    if (existing && !ui.business.value && this.businesses.some(item => item.id === existing)) ui.business.value = existing;
  }

  stateMessage(state) { return STATE_COPY[state] || (state ? text(state, 60) : 'ยังไม่ทราบสถานะ'); }
}
