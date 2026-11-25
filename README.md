# Jira Description Replace All

A browser extension (Chrome / Edge, Manifest V3) that replaces every occurrence of a value in the Jira description you are editing. You review the result and click **Save** in Jira yourself.

## How to use

1. Open a Jira issue and click the description to start editing it.
2. Click the extension, then enter **Find** and **Replace with**.
3. Click **Preview** to see the matches, or **Replace all** to change them in the editor.
4. Review the description and click **Save** in Jira. Press **Ctrl+Z** in the editor, or **Cancel**, to undo.

## Features

- **Edits only the open editor.** It makes no API calls and saves nothing. Saving stays your decision in Jira.
- **Match options** (collapsible, remembered): Match case, Whole word (Unicode-aware), and Regex. In Regex mode the replacement can use `$1`, `$<name>`, `$&` and `$$`. Otherwise it is inserted literally.
- **Preview** shows the number of matches and up to 5 highlighted excerpts before anything changes.
- **Formatting is kept.** Each match is selected and the new text is typed over it, the same way you would by hand. Bold, links and lists stay as they are, and mentions are never touched. A match that's only partly formatted is replaced too.
- **Link URLs are replaced too**, including smart links: the link address changes, not only its text.
- Matches never span two paragraphs or list items.
- Works with the Jira Cloud editor, the Jira Server / Data Center rich text editor, and the plain-text (wiki markup) editor.
- Styled like Daily Timekeeper (learntime.net palette, light and dark themes).

## Permissions

Only `activeTab` and `scripting`. Chrome shows no install warning.

When you click the extension, Chrome gives it temporary access to the current tab only. It injects `core.js`, which finds the open editor and replaces the text. It has no access to other tabs, sends no network requests and collects no data. Your match options are saved in the popup's own `localStorage`.

## How the editor is chosen

1. The editor that has the cursor, if any. You can click inside the description first to make sure.
2. Otherwise, the editor inside an element whose id, class, test id or label mentions "description".
3. Otherwise, the only editor on the page.

If several editors are open and none of these rules decides, the popup asks you to click inside the description first.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Limitations

- The description must be open for editing. The popup explains this when no editor is found.
- Each replacement is typed into the editor separately, so undoing everything with Ctrl+Z may take one press per match. **Cancel** in Jira discards all changes at once.
- The popup closes when you click the page. That's expected: the replacement is already done, and you can go straight to Save.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest |
| `core.js` | Finds the open editor and replaces text in it (rich text editors and textareas). Injected into the tab. |
| `popup.html/css/js` | Popup UI |
| `icons/` | Extension icons |
| `STORE_LISTING.md` | Chrome Web Store listing text |
| `test/core.test.js` | String logic tests: `node --test test/core.test.js` |
| `test/editor.test.html` | Editor tests against a real ProseMirror editor (the engine behind Jira Cloud's editor), a plain contenteditable and a textarea. Open it in Chrome or Edge; it loads ProseMirror from esm.sh. |
