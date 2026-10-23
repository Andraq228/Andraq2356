export const LAB_STORAGE_KEY = 'student-labs-v1';

export const STATUS_OPTIONS = [
  { value: 'in-progress', label: 'В работе' },
  { value: 'submitted', label: 'Сдано' },
  { value: 'review', label: 'На проверке' },
];

export const DEMO_LABS = [
  { id: 'lab-01', number: 1, subject: 'Программирование', title: 'Основы алгоритмизации', description: 'Блок-схемы, ветвления и первые алгоритмы на Python.', tags: ['Python', 'алгоритмы'], status: 'submitted', fileName: 'lab-01-algorithms.pdf', fileType: 'application/pdf', fileSize: 2400000, fileUrl: null, submittedAt: '2026-10-18T09:30:00.000Z', updatedAt: '2026-10-18T09:30:00.000Z', isDemo: true },
  { id: 'lab-02', number: 2, subject: 'Базы данных', title: 'Реляционная модель и SQL-запросы', description: 'Проектирование таблиц и выборки с несколькими условиями.', tags: ['SQL', 'PostgreSQL'], status: 'review', fileName: 'lab-02-database.docx', fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileSize: 1800000, fileUrl: null, submittedAt: '2026-10-20T14:12:00.000Z', updatedAt: '2026-10-21T11:05:00.000Z', isDemo: true },
  { id: 'lab-03', number: 3, subject: 'Компьютерные сети', title: 'Маршрутизация в локальной сети', description: 'Адресация, таблицы маршрутизации и диагностика соединения.', tags: ['Cisco', 'TCP/IP'], status: 'in-progress', fileName: 'lab-03-networking.pdf', fileType: 'application/pdf', fileSize: 3700000, fileUrl: null, submittedAt: null, updatedAt: '2026-10-22T16:40:00.000Z', isDemo: true },
  { id: 'lab-04', number: 4, subject: 'Web-разработка', title: 'Адаптивный интерфейс студенческого портала', description: 'Семантическая разметка, CSS Grid и интерактивные состояния.', tags: ['HTML', 'CSS', 'JavaScript'], status: 'submitted', fileName: 'lab-04-web.zip', fileType: 'application/zip', fileSize: 5600000, fileUrl: null, submittedAt: '2026-10-15T08:20:00.000Z', updatedAt: '2026-10-15T08:20:00.000Z', isDemo: true },
  { id: 'lab-05', number: 5, subject: 'Математика', title: 'Численные методы и погрешности', description: 'Сравнение методов вычислений и оценка точности результата.', tags: ['числа', 'исследование'], status: 'in-progress', fileName: 'lab-05-methods.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 860000, fileUrl: null, submittedAt: null, updatedAt: '2026-10-12T13:05:00.000Z', isDemo: true },
];

export const SUBJECTS = [...new Set(DEMO_LABS.map((lab) => lab.subject))];

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Размер неизвестен';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatLabDate(value, locale = 'ru-RU') {
  if (!value) return 'Ещё не сдавалась';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата неизвестна';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function statusLabel(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function filterLabs(labs, options = {}) {
  const { query = '', subject = 'all', status = 'all', sort = 'newest' } = options;
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const result = (Array.isArray(labs) ? labs : []).filter((lab) => {
    if (!lab || typeof lab !== 'object') return false;
    const haystack = [lab.title, lab.subject, lab.description, ...(Array.isArray(lab.tags) ? lab.tags : [])].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU');
    return (!normalizedQuery || haystack.includes(normalizedQuery)) && (subject === 'all' || lab.subject === subject) && (status === 'all' || lab.status === status);
  });
  return result.sort((a, b) => {
    if (sort === 'oldest') return dateValue(a.updatedAt) - dateValue(b.updatedAt);
    if (sort === 'name') return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'ru');
    if (sort === 'number') return (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER);
    return dateValue(b.updatedAt) - dateValue(a.updatedAt);
  });
}

function dateValue(value) {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function makeLabFromFile(file, fields = {}) {
  if (!file) throw new TypeError('Для лабораторной нужен файл.');
  const now = new Date().toISOString();
  return { id: fields.id ?? `lab-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`, number: Number(fields.number) || undefined, subject: String(fields.subject ?? 'Без дисциплины').trim(), title: String(fields.title ?? file.name.replace(/\.[^/.]+$/, '')).trim(), description: String(fields.description ?? '').trim(), tags: Array.isArray(fields.tags) ? fields.tags : [], status: fields.status ?? 'in-progress', fileName: file.name, fileType: file.type || 'application/octet-stream', fileSize: file.size, fileUrl: fields.fileUrl ?? null, submittedAt: fields.status === 'submitted' ? now : null, updatedAt: now, isDemo: false };
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Не удалось прочитать файл.')));
    reader.readAsDataURL(file);
  });
}

export class LabStore {
  constructor(storage = getBrowserStorage(), key = LAB_STORAGE_KEY) { this.storage = storage; this.key = key; }
  list() {
    if (!this.storage) return [...DEMO_LABS];
    try {
      const value = JSON.parse(this.storage.getItem(this.key) ?? 'null');
      if (!Array.isArray(value)) return [...DEMO_LABS];
      const labs = value.filter((lab) => lab && typeof lab === 'object' && typeof lab.id === 'string');
      return value.length > 0 && labs.length === 0 ? [...DEMO_LABS] : labs;
    } catch {
      return [...DEMO_LABS];
    }
  }
  save(labs) {
    if (!this.storage) return labs;
    try {
      this.storage.setItem(this.key, JSON.stringify(labs));
    } catch (error) {
      const storageError = new Error('Не удалось сохранить лабораторные в хранилище браузера.');
      storageError.cause = error;
      throw storageError;
    }
    return labs;
  }
  add(lab) { return this.save([lab, ...this.list()]); }
  async addFile(file, fields = {}) {
    const lab = makeLabFromFile(file, fields);
    lab.fileUrl = await readFileAsDataUrl(file);
    return this.add(lab);
  }
  remove(id) { return this.save(this.list().filter((lab) => lab.id !== id)); }
  reset() { return this.save([...DEMO_LABS]); }
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
