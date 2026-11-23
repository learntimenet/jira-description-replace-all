// Popup UI. Works on the description editor open in the active tab (see core.js):
// it only changes the editor's text, and the user saves in Jira as usual.
const $ = (id) => document.getElementById(id);
const OPTIONS = { caseSensitive: 'Case', wholeWord: 'Word', regex: 'Regex' };

let tab;

async function inTab(args) {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['core.js'] });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (a) => globalThis.JiraReplaceCore.run(a),
    args: [args],
  });
  if (!result) throw new Error('No response from the page. Reload it and try again.');
  if (result.error) throw new Error(result.error);
  return result;
}

function showView(name) {
  for (const v of ['loading', 'none', 'main']) $(`view-${v}`).hidden = v !== name;
}

function options() {
  return Object.fromEntries(Object.keys(OPTIONS).map((id) => [id, $(id).checked]));
}

function renderOptionsSummary() {
  const on = Object.entries(OPTIONS).filter(([id]) => $(id).checked).map(([, label]) => label);
  $('options-summary').textContent = on.join(' · ');
}

/** kind: '' | 'ok' | 'warn' | 'bad' */
function show(kind, pill, text, snippets = []) {
  $('result').hidden = false;
  $('result').className = `card result ${kind}`;
  $('result-pill').className = `pill ${kind}`;
  $('result-pill').textContent = pill;
  $('message').textContent = text;
  $('snippets').replaceChildren(...snippets.map((s) => {
    const li = document.createElement('li');
    const mark = document.createElement('mark');
    mark.textContent = s.match;
    li.append(s.before, mark, s.after);
    return li;
  }));
}

function busy(on) {
  for (const b of document.querySelectorAll('button')) b.disabled = on;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 'es'}`;
}

async function runAction(action) {
  const find = $('find').value;
  if (!find) {
    $('find').focus();
    return show('bad', 'Missing value', 'Enter a value to find.');
  }
  busy(true);
  try {
    const r = await inTab({ action, find, replace: $('replace').value, options: options() });
    if (!r.count) {
      show('', 'No matches', `“${find}” was not found in the description.`);
    } else if (action === 'preview') {
      show('ok', plural(r.count, 'match'),
        `Replace all will change ${r.count === 1 ? 'this occurrence' : `these ${r.count} occurrences`}${r.count > r.snippets.length ? ` (first ${r.snippets.length} shown)` : ''}.`,
        r.snippets);
    } else {
      const partial = r.replaced < r.count ? ` (${r.count - r.replaced} could not be changed)` : '';
      show(r.replaced ? 'ok' : 'warn', `${r.replaced} replaced`,
        `Replaced ${plural(r.replaced, 'match')}${partial}. Review the description, then click Save in Jira. Press Ctrl+Z in the editor to undo.`);
    }
  } catch (e) {
    show('bad', 'Error', e.message);
  } finally {
    busy(false);
  }
}

async function init() {
  const saved = JSON.parse(localStorage.getItem('options') || '{}');
  for (const id of Object.keys(OPTIONS)) {
    $(id).checked = !!saved[id];
    $(id).addEventListener('change', () => {
      renderOptionsSummary();
      localStorage.setItem('options', JSON.stringify(options()));
    });
  }
  renderOptionsSummary();

  $('form').addEventListener('submit', (e) => { e.preventDefault(); runAction('apply'); });
  $('preview').addEventListener('click', () => runAction('preview'));

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const d = await inTab({ action: 'detect' });
    $('issue-key').textContent = d.key || 'Description';
    $('issue-host').textContent = `${d.kind} · ${d.host}`;
    showView('main');
    $('find').focus();
  } catch (e) {
    // Browser pages (chrome://, the Web Store) can't be scripted: just show the steps.
    $('none-text').textContent = /Cannot access|cannot be scripted|chrome:|edge:/i.test(e.message) ? '' : e.message;
    showView('none');
  }
}

init();
