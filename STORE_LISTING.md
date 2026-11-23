# Chrome Web Store listing

## Store listing tab

**Name** (from manifest, max 75 chars)

```
Jira Description Replace All
```

> "Jira" is an Atlassian trademark. Store reviewers sometimes reject names that start with another company's brand. If that happens, rename the extension to `Description Replace All for Jira` in `manifest.json`. The disclaimer at the end of the description is there for the same reason.

**Summary** (from manifest `description`, max 132 chars)

```
Replace every occurrence of a value in the Jira description you're editing, with a preview. You review, then save.
```

**Category:** Workflow & Planning (or Developer Tools)

**Description** (plain text, paste as is)

```
Change a value everywhere in a Jira description in one click, instead of hunting through the editor for each occurrence.

Renamed a server, a URL, a version number or a person? Open the description editor, type what to find and what to replace it with, check the preview, and click Replace all. Then review the text and click Save in Jira as usual.

HOW IT WORKS
• Click the description in Jira to start editing it.
• Click the extension and enter the value to find and the new value. Leave the new value empty to remove the value instead.
• Preview shows how many matches there are, with highlighted excerpts, before anything changes.
• Replace all changes the text in the editor. Nothing is saved until you click Save in Jira.

MATCH OPTIONS
• Match case
• Whole word, which also works for accented and non-Latin letters
• Regular expressions, with $1 and $<name> group references in the replacement

SAFE BY DEFAULT
• You stay in control: review every change in the editor, then Save or Cancel.
• Ctrl+Z in the editor undoes the replacements.
• Formatting is kept. Bold, links and lists stay as they are, and mentions are never touched.
• Matches never span two paragraphs or list items.

WORKS WITH YOUR JIRA
• Jira Cloud and Jira Server / Data Center, in the rich text editor or the plain-text (wiki markup) editor.
• No login, API token or setup needed.
• Light and dark themes follow your system setting.

PRIVATE BY DESIGN
• No account, no tracking, no ads, no network requests.
• The extension only accesses the current tab, and only when you click it.
• Your match options stay in your browser.

Made by Learn Time. Not affiliated with or endorsed by Atlassian. Jira is a trademark of Atlassian.
```

## Privacy practices tab

**Single purpose**

```
Jira Description Replace All replaces every occurrence of a value in the Jira description editor open in the current tab. The user reviews the result and saves it in Jira.
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `activeTab` | When the user clicks the extension, gives temporary access to the current tab only, so the extension can find the open description editor and replace text in it. It has no access to any other tab or site. |
| `scripting` | Injects the extension's packaged script (`core.js`) into the current tab. The script finds the open editor, counts the matches for the preview, and types the replacement over each match. It sends no network requests. |

**Remote code:** No, I am not using remote code. All scripts are packaged with the extension.

**Data usage:** The extension does not collect or transmit any user data. It reads the description text only inside the user's tab, to find and replace matches, and nothing leaves the browser. Tick no data categories, then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** Optional, because no user data is collected. If you want one, a short page saying "Jira Description Replace All works only inside the Jira tab you click it on. It changes the text in the open description editor, sends no network requests, and does not collect, store or share any data. Your match options are saved only in your browser." is enough.

## Assets still needed

- Store icon: 128×128 PNG (`icons/icon128.png`)
- At least 1 screenshot, 1280×800 or 640×400. Good choices: the preview with highlighted matches next to an open description editor, and the result after Replace all.
- Optional small promo tile: 440×280
