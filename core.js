// Find/replace inside the description editor that is open on the Jira page.
// Injected into the tab when the user clicks the extension; also loaded by the tests.
// Nothing is saved: the user reviews the change and clicks Save in Jira as usual.
(function () {
  const SEP = '\u0000'; // marks a block boundary or a non-editable node (mention, emoji, ...)
  const BLOCK = /^(P|DIV|LI|UL|OL|H[1-6]|PRE|BLOCKQUOTE|TABLE|TBODY|THEAD|TR|TD|TH|DL|DT|DD|HR|FIGURE|SECTION|ARTICLE)$/;

  // ---------- string helpers ----------

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Builds a global RegExp from the user's input and options. Throws on invalid input. */
  function buildRegex(find, { caseSensitive = false, wholeWord = false, regex = false } = {}) {
    if (!find) throw new Error('Enter a value to find.');
    const src = regex ? find : escapeRegex(find);
    const flags = 'g' + (caseSensitive ? '' : 'i');
    try {
      // Unicode-aware word boundaries so "é" or "ß" count as word characters.
      return new RegExp(wholeWord ? `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])` : src, flags + 'u');
    } catch {
      try {
        // Some valid non-unicode patterns (e.g. "\-") are rejected with the u flag.
        return new RegExp(wholeWord ? `(?<!\\w)(?:${src})(?!\\w)` : src, flags);
      } catch (e) {
        throw new Error(`Invalid regular expression: ${e.message}`);
      }
    }
  }

  /** Replacement text for one RegExp match. Regex mode expands $1, $<name>, $&, $`, $' and $$. */
  function replacementFor(m, replacement, regexMode) {
    if (!regexMode) return replacement;
    const groups = m.slice(1);
    return replacement.replace(/\$(\$|&|`|'|\d{1,2}|<([^>]*)>)/g, (tok, what, name) => {
      if (what === '$') return '$';
      if (what === '&') return m[0];
      if (what === '`') return m.input.slice(0, m.index);
      if (what === "'") return m.input.slice(m.index + m[0].length);
      if (name !== undefined) return m.groups ? (m.groups[name] ?? '') : tok;
      if (what.length === 2 && Number(what) > groups.length) {
        const n = Number(what[0]); // "$10" with one group means $1 followed by "0"
        return n >= 1 && n <= groups.length ? (groups[n - 1] ?? '') + what[1] : tok;
      }
      const n = Number(what);
      return n >= 1 && n <= groups.length ? (groups[n - 1] ?? '') : tok;
    });
  }

  /** Next usable match at or after `from`: non-empty and not crossing a block boundary. */
  function nextMatch(text, re, from) {
    re.lastIndex = from;
    let m;
    while ((m = re.exec(text))) {
      if (m[0] !== '' && !m[0].includes(SEP)) return m;
      re.lastIndex = m.index + 1;
    }
    return null;
  }

  function allMatches(text, re) {
    const out = [];
    for (let m = nextMatch(text, re, 0); m; m = nextMatch(text, re, m.index + m[0].length)) out.push(m);
    return out;
  }

  /** Replaces every usable match in a plain string. */
  function replaceInString(text, re, replacement, regexMode) {
    let out = '';
    let last = 0;
    const matches = allMatches(text, re);
    for (const m of matches) {
      out += text.slice(last, m.index) + replacementFor(m, replacement, regexMode);
      last = m.index + m[0].length;
    }
    return { text: out + text.slice(last), count: matches.length };
  }

  function snippets(text, matches, max = 5) {
    const clean = (s) => s.replaceAll(SEP, ' ');
    return matches.slice(0, max).map((m) => {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + m[0].length + 40);
      return {
        before: (start > 0 ? '…' : '') + clean(text.slice(start, m.index)).trimStart(),
        match: m[0],
        after: clean(text.slice(m.index + m[0].length, end)).trimEnd() + (end < text.length ? '…' : ''),
      };
    });
  }

  // ---------- rich text (contenteditable) ----------

  /** Text of an editable element plus a map back to its text nodes. */
  function collectText(root) {
    let text = '';
    const map = [];
    const sep = () => { if (text && !text.endsWith(SEP)) text += SEP; };
    (function walk(node) {
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          map.push({ node: c, start: text.length, data: c.data });
          text += c.data;
        } else if (c.nodeType === 1) {
          if (c.getAttribute('contenteditable') === 'false' || c.tagName === 'BR' || c.tagName === 'IMG') {
            sep();
            continue;
          }
          const block = BLOCK.test(c.tagName);
          if (block) sep();
          walk(c);
          if (block) sep();
        }
      }
    })(root);
    return { text, map };
  }

  function locate(map, index, isEnd) {
    for (const seg of map) {
      const end = seg.start + seg.data.length;
      if (isEnd ? index > seg.start && index <= end : index >= seg.start && index < end) {
        return [seg.node, index - seg.start];
      }
    }
    return null;
  }

  /** True if the text nodes covering [from, to) still hold the text they had when collected. */
  function isFresh(map, from, to) {
    for (const seg of map) {
      if (seg.start >= to) break;
      if (seg.start + seg.data.length <= from) continue;
      const k = Math.min(seg.data.length, to - seg.start);
      if (!seg.node.isConnected || seg.node.data.slice(0, k) !== seg.data.slice(0, k)) return false;
    }
    return true;
  }

  function select(doc, range) {
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Selects one match and types the replacement over it, the same way a user would.
   * Editors (ProseMirror on Jira Cloud, TinyMCE on Server/DC) update their own model
   * and undo history, so Ctrl+Z and Jira's Cancel still work.
   */
  function typeOver(root, map, m, text) {
    const doc = root.ownerDocument;
    const start = locate(map, m.index, false);
    const end = locate(map, m.index + m[0].length, true);
    if (!start || !end) return false;
    const range = doc.createRange();
    range.setStart(...start);
    range.setEnd(...end);
    select(doc, range);
    if (text ? doc.execCommand('insertText', false, text) : doc.execCommand('delete')) return true;
    // Fallback for editors that ignore execCommand: change the DOM and let the editor pick it up.
    range.deleteContents();
    if (text) range.insertNode(doc.createTextNode(text));
    root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  }

  /**
   * Reads the text once and replaces from the last match to the first: an edit never moves
   * the text before it, so earlier matches keep their position. The text is read again only
   * when the editor re-rendered a node an earlier match still needs.
   */
  function replaceInEditable(root, re, replacement, regexMode) {
    root.focus();
    let { text, map } = collectText(root);
    const matches = allMatches(text, re);
    let count = 0;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const rep = replacementFor(m, replacement, regexMode);
      if (rep === m[0]) { count++; continue; }
      if (!isFresh(map, m.index, m.index + m[0].length)) ({ map } = collectText(root));
      const node = locate(map, m.index, false)?.[0];
      const before = node?.data;
      if (!typeOver(root, map, m, rep)) break;
      if (node.isConnected && node.data === before) throw new Error('The editor did not accept the change.');
      count++;
    }
    root.ownerDocument.getSelection().collapseToEnd?.();
    return count;
  }

  // ---------- link URLs (href of links and smart links) ----------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /** Outermost non-editable element (smart link, card) holding `el` inside `root`, or null. */
  function cardOf(root, el) {
    let card = null;
    for (let n = el; n && n !== root; n = n.parentElement) {
      if (n.getAttribute('contenteditable') === 'false') card = n;
    }
    return card;
  }

  /** Links whose URL contains a match. One entry per link or smart link. */
  function linkTargets(root, re) {
    const out = [];
    const cards = new Set();
    for (const a of root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (!nextMatch(href, re, 0)) continue;
      const card = cardOf(root, a);
      if (card && cards.has(card)) continue;
      if (card) cards.add(card);
      out.push({ a, href, card });
    }
    return out;
  }

  const countHref = (root, href) => [...root.querySelectorAll('a[href]')].filter((a) => a.getAttribute('href') === href).length;

  function paste(target, html, plain) {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', plain);
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }

  /**
   * Changes the URL of each matching link. Link text is handled by replaceInEditable.
   * Tries, in order: the browser's createLink command, a paste of the new link (what the
   * editor does when the user pastes one), then setting the attribute. Each step is checked.
   */
  async function replaceInLinks(root, re, replacement, regexMode) {
    const doc = root.ownerDocument;
    let count = 0;
    for (const t of linkTargets(root, re)) {
      const newHref = replaceInString(t.href, re, replacement, regexMode).text;
      if (newHref === t.href) { count++; continue; }
      const before = countHref(root, t.href);
      const done = () => countHref(root, t.href) < before;
      const el = t.card || t.a;
      if (!el.isConnected) continue;
      const range = doc.createRange();
      if (t.card) {
        range.selectNode(t.card);
      } else {
        range.selectNodeContents(t.a);
        select(doc, range);
        doc.execCommand('createLink', false, newHref);
        await sleep(30);
        if (done()) { count++; continue; }
        if (!t.a.isConnected) continue;
        range.selectNode(t.a);
      }
      const label = t.card ? newHref : t.a.textContent;
      select(doc, range);
      await sleep(30); // let the editor read the new selection
      paste(el, `<a href="${escapeHtml(newHref)}">${escapeHtml(label)}</a>`, newHref);
      await sleep(50);
      if (done()) { count++; continue; }
      if (!t.card && t.a.isConnected) {
        t.a.setAttribute('href', newHref);
        root.dispatchEvent(new InputEvent('input', { bubbles: true }));
        await sleep(30);
        if (done()) count++;
      }
    }
    doc.getSelection().collapseToEnd?.();
    return count;
  }

  // ---------- plain text (textarea, e.g. wiki markup on Jira Server/DC) ----------

  function setTextareaValue(el, value) {
    el.focus();
    el.select();
    const doc = el.ownerDocument;
    const typed = value ? doc.execCommand('insertText', false, value) : doc.execCommand('delete');
    if (!typed || el.value !== value) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
      setter.call(el, value); // bypass React's value tracking so it sees the change
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    el.setSelectionRange(0, 0);
  }

  // ---------- finding the description editor ----------

  const isVisible = (el) => el.getClientRects().length > 0;
  const DESCRIPTION_HINT = '[data-testid*="description" i], [id*="description" i], [name*="description" i], [class*="description" i], [aria-label*="description" i]';

  function editorsIn(doc, out = []) {
    for (const el of doc.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""]')) {
      if (el.tagName === 'TEXTAREA' ? el.readOnly || el.disabled : el.parentElement?.closest('[contenteditable="true"], [contenteditable=""]')) continue;
      if (isVisible(el)) out.push({ el, frame: null });
    }
    for (const frame of doc.querySelectorAll('iframe')) {
      let inner;
      try { inner = frame.contentDocument; } catch { continue; } // cross-origin
      if (!inner?.body || !isVisible(frame)) continue;
      if (inner.designMode === 'on' || inner.body.isContentEditable) out.push({ el: inner.body, frame });
      else editorsIn(inner, out);
    }
    return out;
  }

  function deepActiveElement(doc) {
    let el = doc.activeElement;
    while (el?.tagName === 'IFRAME') {
      try { el = el.contentDocument.activeElement; } catch { break; }
    }
    return el;
  }

  /** The editor to work on: the focused one, else the one marked as description, else the only one. */
  function findEditor(doc = document) {
    const all = editorsIn(doc);
    if (!all.length) {
      throw new Error('No open editor found. Click the description in Jira to start editing it, then click the extension again.');
    }
    const active = deepActiveElement(doc);
    const focused = all.find(({ el }) => el === active || el.contains(active));
    if (focused) return focused;
    const described = all.filter(({ el, frame }) => (frame || el).closest(DESCRIPTION_HINT));
    if (described.length === 1) return described[0];
    if (all.length === 1) return all[0];
    throw new Error('Several editors are open. Click inside the description, then click the extension again.');
  }

  function editorKind({ el }) {
    return el.tagName === 'TEXTAREA' ? 'Text editor' : 'Rich text editor';
  }

  /** Issue key from the current Jira URL (/browse/KEY-1, ?selectedIssue=KEY-1, ...), for display only. */
  function detectIssueKey(href) {
    const url = new URL(href);
    const fromQuery = url.searchParams.get('selectedIssue');
    if (fromQuery) return fromQuery.toUpperCase();
    const m = url.pathname.match(/\/(?:browse|issues?)\/([A-Za-z][A-Za-z0-9_]*-\d+)/);
    return m ? m[1].toUpperCase() : null;
  }

  // ---------- entry point ----------

  /** Used by the popup. Never throws; returns { error } instead. */
  async function run({ action, find, replace = '', options = {} }) {
    try {
      const editor = findEditor(document);
      const info = { key: detectIssueKey(location.href), host: location.host, kind: editorKind(editor) };
      if (action === 'detect') return info;

      const re = buildRegex(find, options);
      const isText = editor.el.tagName === 'TEXTAREA';
      const text = isText ? editor.el.value : collectText(editor.el).text;
      const matches = allMatches(text, re);
      const links = isText ? [] : linkTargets(editor.el, re);
      const result = {
        ...info,
        count: matches.length + links.length,
        snippets: [
          ...snippets(text, matches),
          ...links.flatMap((l) => snippets(l.href, allMatches(l.href, re).slice(0, 1))),
        ].slice(0, 5),
      };
      if (action !== 'apply' || !result.count) return result;

      if (isText) {
        const r = replaceInString(text, re, replace, !!options.regex);
        setTextareaValue(editor.el, r.text);
        result.replaced = r.count;
      } else {
        result.replaced = replaceInEditable(editor.el, re, replace, !!options.regex)
          + await replaceInLinks(editor.el, re, replace, !!options.regex);
      }
      return result;
    } catch (e) {
      return { error: e.message || String(e) };
    }
  }

  const exported = { SEP, buildRegex, replacementFor, replaceInString, allMatches, collectText, replaceInEditable, linkTargets, replaceInLinks, findEditor, detectIssueKey, run };
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else globalThis.JiraReplaceCore = exported;
})();
