'use strict';
/* Variable Naming Convention Checker - compiler-design mini project.
   Pipeline: source -> tokenize -> extractVariables -> validate -> symbol table -> diagnostics.
   Input is only ever treated as text. No eval, no code execution. */

const KEYWORDS = new Set(('int float double char void long short unsigned signed if else for while do switch case break continue return class public private protected static const new delete try catch throw true false null this namespace using struct enum union typedef sizeof volatile extern register auto inline virtual final abstract interface package import boolean byte extends implements instanceof synchronized transient native super assert default goto friend template typename operator constexpr nullptr bool').split(' '));
const TYPES = new Set(['int','float','double','char','long','short','boolean','bool','String','string','byte','void','unsigned','signed','size_t','auto']);
const TYPE_NAMES = new Set(['String','string','size_t']);
const MODIFIERS = new Set(['static','const','final','public','private','protected','volatile','extern','register','constexpr','inline','transient','synchronized','abstract']);
const CONVENTIONS = ['camelCase','snake_case','PascalCase','UPPER_SNAKE_CASE','lowercase'];
const MAX_LEN = 30;

const TESTS = [
  ['Test 1: int studentName;  (camelCase)', 'int studentName;'],
  ['Test 2: int student_name;  (snake_case)', 'int student_name;'],
  ['Test 3: int 2student;  (digit first)', 'int 2student;'],
  ['Test 4: int class;  (keyword)', 'int class;'],
  ['Test 5: int student-name;  (hyphen)', 'int student-name;'],
  ['Test 6: duplicate age', 'int age;\nfloat age;'],
  ['Test 7: int x;  (too short)', 'int x;'],
  ['Test 8: int StudentName;  (PascalCase)', 'int StudentName;'],
  ['Test 9: int STUDENT_NAME;  (UPPER_SNAKE_CASE)', 'int STUDENT_NAME;'],
  ['Test 10: int studentName = 21;  (initialised)', 'int studentName = 21;'],
  ['Error recovery', 'int validName;\nint 2invalid;\nint anotherValid;']
];
const SAMPLE = [
  '// Sample input for the Variable Naming Convention Checker',
  'int studentName;', 'float total_marks;', 'char grade;', 'int 2student;', 'int class;',
  'int studentName;', 'int student-name;', 'int student@name;', 'int student name;', 'int x;',
  'int StudentName;', 'int MAX_SIZE = 100;', 'double salary = 50000.5;',
  'String firstName = "Junaid";', 'int a, b, c;'
].join('\n');

const state = { variables: [], filter: 'all' };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Lexical analysis ---------- */
function isKeyword(word) { return KEYWORDS.has(word); }
function isIdentifier(word) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(word); }

function tokenize(code) {
  const tokens = [];
  const n = code.length;
  const ops3 = ['<<=', '>>=', '...'];
  const ops2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '->', '::'];
  let i = 0, line = 1, lineStart = 0;
  while (i < n) {
    const c = code[i];
    if (c === '\n') { line++; i++; lineStart = i; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
    const s = i, sl = line, sc = i - lineStart + 1;
    const push = (type, extra) => tokens.push(Object.assign({ type, lexeme: code.slice(s, i), line: sl, col: sc, start: s, end: i }, extra));
    if (c === '/' && code[i + 1] === '/') {
      while (i < n && code[i] !== '\n') i++;
      push('COMMENT'); continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      i += 2; let closed = false;
      while (i < n) {
        if (code[i] === '*' && code[i + 1] === '/') { i += 2; closed = true; break; }
        if (code[i] === '\n') { line++; lineStart = i + 1; }
        i++;
      }
      push('COMMENT', closed ? {} : { error: 'Unterminated block comment' }); continue;
    }
    if (c === '"' || c === "'") {
      i++; let closed = false;
      while (i < n && code[i] !== '\n') {
        if (code[i] === '\\' && i + 1 < n && code[i + 1] !== '\n') { i += 2; continue; }
        if (code[i] === c) { i++; closed = true; break; }
        i++;
      }
      push('STRING', closed ? {} : { error: 'Unterminated string literal' }); continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      while (i < n && /[A-Za-z0-9_]/.test(code[i])) i++;
      const w = code.slice(s, i);
      push(isKeyword(w) ? 'KEYWORD' : TYPE_NAMES.has(w) ? 'TYPE' : 'IDENTIFIER'); continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(code[i + 1] || ''))) {
      while (i < n && /[0-9]/.test(code[i])) i++;
      if (code[i] === '.' && /[0-9]/.test(code[i + 1] || '')) { i++; while (i < n && /[0-9]/.test(code[i])) i++; }
      while (i < n && /[A-Za-z0-9_]/.test(code[i])) i++;
      const w = code.slice(s, i);
      if (/^(\d*\.?\d+|\d+\.)[fFlLuU]*$/.test(w) || /^0[xX][0-9a-fA-F]+$/.test(w)) push('NUMBER');
      else push('IDENTIFIER', { bad: true }); // e.g. 2student: lexeme starts with a digit
      continue;
    }
    const three = code.substr(i, 3), two = code.substr(i, 2);
    if (ops3.includes(three)) { i += 3; push('OPERATOR'); continue; }
    if (ops2.includes(two)) { i += 2; push('OPERATOR'); continue; }
    if ('+-*/%=<>!&|^~?:.'.includes(c)) { i++; push('OPERATOR'); continue; }
    if (';,(){}[]'.includes(c)) { i++; push('SEPARATOR'); continue; }
    i++; push('UNKNOWN');
  }
  return tokens;
}

/* ---------- Variable extraction (token based) ---------- */
const OPEN = ['(', '[', '{'], CLOSE = [')', ']', '}'];

function matchDeclStart(t, i) {
  const prev = t[i - 1];
  if (prev && ['new', '.', '::', '->'].includes(prev.lexeme)) return null;
  let j = i;
  while (j < t.length && MODIFIERS.has(t[j].lexeme)) j++;
  const first = j;
  let type;
  while (j < t.length && TYPES.has(t[j].lexeme)) j++;
  if (j > first) {
    type = t.slice(first, j).map(x => x.lexeme).join(' ');
  } else if (t[j] && t[j].type === 'IDENTIFIER' && !t[j].bad && t[j + 1] &&
             (t[j + 1].type === 'IDENTIFIER' || t[j + 1].type === 'KEYWORD') &&
             t[j + 1].line === t[j].line && t[j + 2] && [';', '=', ','].includes(t[j + 2].lexeme)) {
    type = t[j].lexeme; j++; // user-defined type, e.g. Student s;
  } else return null;
  const nxt = t[j];
  if (!nxt || [')', '>', ','].includes(nxt.lexeme) || nxt.line !== t[j - 1].line) return null;
  return { next: j, type };
}

function extractVariables(tokens, code) {
  const t = tokens.filter(x => x.type !== 'COMMENT');
  const vars = [], stack = [0];
  let blocks = 0, i = 0;
  while (i < t.length) {
    const tk = t[i];
    if (tk.lexeme === '{') { stack.push(++blocks); i++; continue; }
    if (tk.lexeme === '}') { if (stack.length > 1) stack.pop(); i++; continue; }
    const d = matchDeclStart(t, i);
    if (!d) { i++; continue; }
    const scope = stack.length === 1 ? 'global' : 'local#' + stack[stack.length - 1];
    let j = d.next, depth = 0, seenEq = false, isFunc = false;
    const body = [];
    for (; j < t.length; j++) {
      const x = t[j], lx = x.lexeme;
      if (depth === 0) {
        if (lx === ';' || lx === ')' || lx === '}') break;
        if (lx === '{' && !seenEq) break;
        const p = t[j - 1];
        if (x.line !== p.line && p.lexeme !== ',' && p.lexeme !== '=') break; // missing ';' recovery
        if (lx === '(' && !seenEq) { isFunc = true; break; }
        if (lx === '=') seenEq = true;
        if (lx === ',') seenEq = false;
      }
      if (OPEN.includes(lx)) depth++;
      else if (CLOSE.includes(lx) && depth > 0) depth--;
      body.push(x);
    }
    if (isFunc) { // function declaration/definition: skip its parameter list
      let p = 0;
      while (j < t.length) {
        if (t[j].lexeme === '(') p++;
        else if (t[j].lexeme === ')' && --p === 0) { j++; break; }
        j++;
      }
      i = j; continue;
    }
    const segs = [[]]; let dd = 0;
    for (const x of body) {
      if (dd === 0 && x.lexeme === ',') { segs.push([]); continue; }
      if (OPEN.includes(x.lexeme)) dd++; else if (CLOSE.includes(x.lexeme)) dd--;
      segs[segs.length - 1].push(x);
    }
    for (const seg of segs) {
      let eq = seg.findIndex(x => x.lexeme === '=');
      if (eq < 0) eq = seg.length;
      let nameToks = seg.slice(0, eq);
      const valToks = seg.slice(eq + 1);
      while (nameToks.length && (nameToks[0].lexeme === '*' || nameToks[0].lexeme === '&')) nameToks = nameToks.slice(1);
      const br = nameToks.findIndex(x => x.lexeme === '[');
      if (br >= 0) nameToks = nameToks.slice(0, br);
      const anchor = nameToks[0] || seg[0] || tk;
      vars.push({
        name: nameToks.length ? code.slice(nameToks[0].start, nameToks[nameToks.length - 1].end) : '',
        type: d.type,
        value: valToks.length ? code.slice(valToks[0].start, valToks[valToks.length - 1].end) : null,
        line: anchor.line, col: anchor.col, scope,
        errors: [], warnings: [], duplicate: false, convention: '', conventionOk: false
      });
    }
    i = j;
  }
  return vars;
}

/* ---------- Naming rules ---------- */
function detectNamingConvention(name) {
  if (/^[A-Za-z0-9]+(-[A-Za-z0-9]+)+$/.test(name)) return 'kebab-case';
  if (!isIdentifier(name)) return 'Invalid';
  const s = name.replace(/^_+|_+$/g, '');
  if (!s) return 'Unknown';
  if (s.length > 1 && /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(s)) return 'UPPER_SNAKE_CASE';
  if (/^[a-z][a-z0-9]*$/.test(s)) return 'lowercase';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(s)) return 'snake_case';
  if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(s)) return 'camelCase';
  if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(s)) return 'PascalCase';
  return 'Mixed';
}

function validateIdentifier(name) {
  const errors = [];
  if (!name || !name.trim()) return { valid: false, errors: ['Variable name is missing (empty identifier).'] };
  if (/\s/.test(name)) errors.push(`Identifier '${name}' cannot contain spaces.`);
  if (name.includes('-')) errors.push(`Identifier '${name}' contains '-'. Hyphens are not allowed in C/C++/Java identifiers (kebab-case is invalid).`);
  const specials = [...new Set(name.match(/[^A-Za-z0-9_\s-]/g) || [])];
  if (specials.length) errors.push(`Identifier '${name}' contains invalid special character(s): ${specials.join(' ')}`);
  if (/^[0-9]/.test(name)) errors.push(`Identifier '${name}' cannot begin with a digit.`);
  if (isKeyword(name)) errors.push(`'${name}' is a reserved keyword and cannot be used as a variable name.`);
  if (!errors.length && !isIdentifier(name)) errors.push(`'${name}' is not a valid identifier.`);
  return { valid: errors.length === 0, errors };
}

function checkNamingConvention(name, expected) {
  const detected = detectNamingConvention(name);
  let ok = detected === expected;
  if (detected === 'lowercase' && ['camelCase', 'snake_case', 'lowercase'].includes(expected)) ok = true;
  return { ok, detected, expected };
}

function styleWarnings(name) {
  const w = [];
  if (name.length === 1) w.push(`Variable '${name}' is too short (single character).`);
  if (name.length > MAX_LEN) w.push(`Variable '${name}' is very long (${name.length} characters, limit ${MAX_LEN}).`);
  if (/^_/.test(name)) w.push(`Variable '${name}' has a leading underscore (reserved by some compilers).`);
  if (/_$/.test(name)) w.push(`Variable '${name}' has a trailing underscore.`);
  if (/__/.test(name)) w.push(`Variable '${name}' contains excessive (consecutive) underscores.`);
  if (/[Il1]{3,}|[O0]{3,}|^[lIO]$/.test(name)) w.push(`Variable '${name}' uses confusing look-alike characters (I, l, 1, O, 0).`);
  return w;
}

function evaluateVariable(v, expected) {
  v.errors = validateIdentifier(v.name).errors;
  v.warnings = [];
  v.convention = detectNamingConvention(v.name);
  v.conventionOk = false;
  if (!v.errors.length) {
    const c = checkNamingConvention(v.name, expected);
    v.conventionOk = c.ok;
    if (!c.ok) v.warnings.push(`'${v.name}' is ${c.detected} but the selected convention is ${expected}.`);
    v.warnings.push(...styleWarnings(v.name));
  }
}

function checkDuplicates(variables) {
  const seen = new Map();
  variables.forEach(v => {
    if (!v.name) return;
    const key = v.scope + '|' + v.name;
    if (seen.has(key)) {
      const first = seen.get(key);
      v.duplicate = true; v.firstLine = first.line;
      v.errors.push(`Duplicate declaration of '${v.name}'. First declared at line ${first.line}, redeclared at line ${v.line}.`);
    } else seen.set(key, v);
  });
}

function checkConsistency(variables) {
  const ok = variables.filter(v => !v.errors.length && ['camelCase', 'snake_case', 'PascalCase'].includes(v.convention));
  const counts = {};
  ok.forEach(v => { counts[v.convention] = (counts[v.convention] || 0) + 1; });
  const keys = Object.keys(counts);
  if (keys.length < 2) return;
  const major = keys.sort((a, b) => counts[b] - counts[a])[0];
  ok.forEach(v => {
    if (v.convention !== major) v.warnings.push(`Inconsistent naming: '${v.name}' uses ${v.convention} while most variables use ${major}.`);
  });
}

/* ---------- Symbol table, diagnostics, statistics ---------- */
function varStatus(v) { return v.errors.length ? (v.duplicate ? 'Duplicate' : 'Invalid') : 'Valid'; }

function generateSymbolTable(variables) {
  return variables.filter(v => v.name).map(v => ({
    name: v.name, type: v.type, scope: v.scope, line: v.line, convention: v.convention, status: varStatus(v)
  }));
}

function generateDiagnostics(results) {
  const d = [];
  results.tokens.forEach(t => { if (t.error) d.push({ level: 'ERROR', line: t.line, message: `${t.error} (column ${t.col}).` }); });
  results.variables.forEach(v => {
    v.errors.forEach(m => d.push({ level: 'ERROR', line: v.line, message: m }));
    v.warnings.forEach(m => d.push({ level: 'WARNING', line: v.line, message: m }));
    if (!v.errors.length) {
      d.push({ level: 'SUCCESS', line: v.line, message: v.conventionOk
        ? `'${v.name}' follows ${v.convention} convention.`
        : `'${v.name}' is a valid identifier written in ${v.convention}.` });
    }
    if (v.value !== null && v.name) d.push({ level: 'INFO', line: v.line, message: `'${v.name}' (${v.type}) is initialised with ${v.value}.` });
  });
  if (!results.variables.length) d.push({ level: 'INFO', line: 0, message: results.tokens.length ? 'No variable declarations were found in the input.' : 'Enter or load some code, then click Analyze Code.' });
  return d.map((x, k) => Object.assign(x, { k })).sort((a, b) => (a.line - b.line) || (a.k - b.k));
}

function calculateStatistics(results) {
  const vs = results.variables, tk = results.tokens;
  return {
    tokens: tk.length,
    identifiers: tk.filter(t => t.type === 'IDENTIFIER').length,
    keywords: tk.filter(t => t.type === 'KEYWORD' || t.type === 'TYPE').length,
    variables: vs.length,
    valid: vs.filter(v => !v.errors.length).length,
    invalid: vs.filter(v => v.errors.length).length,
    warnings: vs.reduce((a, v) => a + v.warnings.length, 0),
    duplicates: vs.filter(v => v.duplicate).length,
    errors: results.diagnostics.filter(x => x.level === 'ERROR').length
  };
}

/* ---------- Rendering ---------- */
function renderTokens(tokens) {
  $('tokenBody').innerHTML = tokens.length ? tokens.map(t => {
    const label = ['NUMBER', 'STRING', 'COMMENT'].includes(t.type) ? t.type : t.lexeme;
    const lex = t.lexeme.length > 40 ? t.lexeme.slice(0, 40) + '...' : t.lexeme;
    return `<tr><td class="mono">${esc(label)}</td><td class="mono">${esc(lex)}</td><td><span class="badge b-tok">${t.bad ? 'IDENTIFIER (invalid)' : t.type}</span></td><td>${t.line}</td><td>${t.col}</td></tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">No tokens yet.</td></tr>';
}

function statusBadges(v) {
  let h = v.errors.length
    ? (v.duplicate ? '<span class="badge b-duplicate">DUPLICATE</span>' : '<span class="badge b-invalid">INVALID</span>')
    : '<span class="badge b-valid">VALID</span>';
  if (v.warnings.length) h += `<span class="badge b-warning">${v.warnings.length} WARNING${v.warnings.length > 1 ? 'S' : ''}</span>`;
  return h;
}

function renderVariables(variables) {
  const q = $('searchBox').value.trim().toLowerCase(), expected = $('convSelect').value;
  const rows = variables.filter(v => {
    if (q && !(v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q))) return false;
    switch (state.filter) {
      case 'valid': return !v.errors.length;
      case 'invalid': return v.errors.length > 0;
      case 'warning': return v.warnings.length > 0;
      case 'duplicate': return v.duplicate;
      default: return true;
    }
  });
  $('varBody').innerHTML = rows.length ? rows.map(v => {
    const tip = esc(v.errors.concat(v.warnings).join(' | '));
    return `<tr title="${tip}"><td>${v.line}</td><td class="mono">${esc(v.name || '(missing)')}</td><td class="mono">${esc(v.type)}</td><td class="mono">${v.value === null ? '-' : esc(v.value)}</td><td>${esc(v.convention)}</td><td>${esc(expected)}</td><td>${statusBadges(v)}</td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty">No variables match the current filter.</td></tr>';
}

function renderSymbolTable(table) {
  $('symBody').innerHTML = table.length ? table.map(r =>
    `<tr><td class="mono">${esc(r.name)}</td><td class="mono">${esc(r.type)}</td><td>${esc(r.scope)}</td><td>${r.line}</td><td>${esc(r.convention)}</td><td><span class="badge b-${r.status === 'Valid' ? 'valid' : 'invalid'}">${r.status}</span></td></tr>`
  ).join('') : '<tr><td colspan="6" class="empty">Symbol table is empty.</td></tr>';
}

function renderDiagnostics(diags) {
  $('diagList').innerHTML = diags.map(x =>
    `<li class="d-${x.level}"><span class="badge b-${x.level}">${x.level}</span>${esc(x.message)}${x.line ? `<small>line ${x.line}</small>` : ''}</li>`
  ).join('');
}

function renderStats(s) {
  const map = { sTotalVars: s.variables, sValid: s.valid, sInvalid: s.invalid, sWarn: s.warnings, sDup: s.duplicates,
                sTokens: s.tokens, sIdent: s.identifiers, sKeywords: s.keywords, sErrors: s.errors };
  Object.keys(map).forEach(id => { $(id).textContent = map[id]; });
}

/* ---------- Controller ---------- */
function analyzeCode() {
  const code = $('codeInput').value, expected = $('convSelect').value;
  const tokens = tokenize(code);
  const variables = extractVariables(tokens, code);
  variables.forEach(v => evaluateVariable(v, expected));
  checkDuplicates(variables);
  checkConsistency(variables);
  const symbolTable = generateSymbolTable(variables);
  const results = { tokens, variables };
  results.diagnostics = generateDiagnostics(results);
  state.variables = variables;
  renderTokens(tokens);
  renderVariables(variables);
  renderSymbolTable(symbolTable);
  renderDiagnostics(results.diagnostics);
  renderStats(calculateStatistics(results));
}

function updateGutter() {
  const ed = $('codeInput'), n = ed.value.split('\n').length;
  $('gutter').textContent = Array.from({ length: n }, (_, k) => k + 1).join('\n');
  $('gutter').scrollTop = ed.scrollTop;
}

function setCode(text) { $('codeInput').value = text; updateGutter(); analyzeCode(); }

document.addEventListener('DOMContentLoaded', () => {
  TESTS.forEach((t, k) => { const o = document.createElement('option'); o.value = k; o.textContent = t[0]; $('testSelect').appendChild(o); });
  $('btnAnalyze').addEventListener('click', analyzeCode);
  $('btnSample').addEventListener('click', () => setCode(SAMPLE));
  $('btnClear').addEventListener('click', () => { $('testSelect').value = ''; setCode(''); });
  $('convSelect').addEventListener('change', analyzeCode);
  $('testSelect').addEventListener('change', e => { if (e.target.value !== '') setCode(TESTS[+e.target.value][1]); });
  $('searchBox').addEventListener('input', () => renderVariables(state.variables));
  $('filters').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.filter = b.dataset.filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === b));
    renderVariables(state.variables);
  });
  $('codeInput').addEventListener('input', updateGutter);
  $('codeInput').addEventListener('scroll', () => { $('gutter').scrollTop = $('codeInput').scrollTop; });
  $('codeInput').addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') analyzeCode(); });
  setCode(SAMPLE);
});
