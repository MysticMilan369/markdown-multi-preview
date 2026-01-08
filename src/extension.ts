import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

// Initialize markdown-it renderer with highlight.js syntax highlighting
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        }).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      } catch (__) {
        // Fall through to default
      }
    }
    // Use auto-detection for unknown languages or plain code
    try {
      const highlighted = hljs.highlightAuto(str).value;
      return `<pre><code class="hljs">${highlighted}</code></pre>`;
    } catch (__) {
      return `<pre><code class="hljs">${escapeHtml(str)}</code></pre>`;
    }
  },
});

// Helper function to escape HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Array to keep track of all active preview panels
const activePanels: vscode.WebviewPanel[] = [];

// Map to track which panel is associated with which document
const panelDocumentMap = new Map<vscode.WebviewPanel, vscode.Uri>();

export function activate(context: vscode.ExtensionContext) {
  console.log("Markdown Multi Preview is now active!");

  // Register the command to open a new preview panel
  const disposable = vscode.commands.registerCommand(
    "markdown-multi-preview.openPreview",
    () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage(
          "No active editor found. Please open a Markdown file."
        );
        return;
      }

      const document = editor.document;

      if (document.languageId !== "markdown") {
        vscode.window.showWarningMessage(
          "The active file is not a Markdown file."
        );
        return;
      }

      // Create a new independent webview panel
      createPreviewPanel(document, context);
    }
  );

  // Listen for text document changes to update previews live
  const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    const changedDocument = event.document;

    // Update all panels that are showing this document
    for (const panel of activePanels) {
      const panelUri = panelDocumentMap.get(panel);
      if (panelUri && panelUri.toString() === changedDocument.uri.toString()) {
        updatePanelContent(panel, changedDocument);
      }
    }
  });

  // Listen for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("markdownMultiPreview.fontSize")) {
        // Update all panels when font size changes
        for (const panel of activePanels) {
          const uri = panelDocumentMap.get(panel);
          if (uri) {
            const doc = vscode.workspace.textDocuments.find(
              (d) => d.uri.toString() === uri.toString()
            );
            if (doc) {
              updatePanelContent(panel, doc);
            }
          }
        }
      }
    }
  );

  context.subscriptions.push(
    disposable,
    changeDisposable,
    configChangeDisposable
  );
}

function createPreviewPanel(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext
): vscode.WebviewPanel {
  const fileName =
    document.fileName.split("/").pop() ||
    document.fileName.split("\\").pop() ||
    "Markdown";

  // Create a new webview panel in the active column (same tab area)
  const panel = vscode.window.createWebviewPanel(
    "markdownMultiPreview",
    `Preview: ${fileName}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  // Add to active panels array
  activePanels.push(panel);
  panelDocumentMap.set(panel, document.uri);

  // Set initial content
  updatePanelContent(panel, document);

  // Handle panel disposal
  panel.onDidDispose(
    () => {
      const index = activePanels.indexOf(panel);
      if (index > -1) {
        activePanels.splice(index, 1);
      }
      panelDocumentMap.delete(panel);
    },
    null,
    context.subscriptions
  );

  return panel;
}

function updatePanelContent(
  panel: vscode.WebviewPanel,
  document: vscode.TextDocument
): void {
  const markdownContent = document.getText();
  const htmlContent = md.render(markdownContent);

  // Get font size from configuration
  const config = vscode.workspace.getConfiguration("markdownMultiPreview");
  const fontSize = config.get<number>("fontSize", 16);

  panel.webview.html = getWebviewContent(htmlContent, fontSize);
}

function getWebviewContent(renderedHtml: string, fontSize: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Markdown Preview</title>
	<style>
		:root {
			--preview-font-size: ${fontSize}px;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			font-size: var(--preview-font-size);
			line-height: 1.6;
			padding: 20px 26px;
			max-width: 900px;
			margin: 0 auto;
			color: var(--vscode-editor-foreground);
			background-color: var(--vscode-editor-background);
		}
		
		/* Line hover indicator for all block elements */
		h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, table, pre {
			position: relative;
			border-left: 3px solid transparent;
			padding-left: 12px;
			margin-left: -15px;
		}
		
		h1:hover, h2:hover, h3:hover, h4:hover, h5:hover, h6:hover,
		p:hover, ul:hover, ol:hover, blockquote:hover, table:hover, pre:hover {
			border-left-color: var(--vscode-textLink-foreground, #3794ff);
		}
		
		h1, h2, h3, h4, h5, h6 {
			margin-top: 1em;
			margin-bottom: 0.3em;
			font-weight: 700;
			line-height: 1.3;
		}
		h1 { font-size: 1.75em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.25em; }
		h2 { font-size: 1.35em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.2em; }
		h3 { font-size: 1.15em; }
		h4 { font-size: 1.05em; }
		h5 { font-size: 1em; }
		h6 { font-size: 0.95em; color: var(--vscode-descriptionForeground); }
		p { margin: 0.6em 0; }
		
		/* Inline code */
		code {
			background-color: var(--vscode-textCodeBlock-background, rgba(110, 118, 129, 0.4));
			padding: 0.2em 0.4em;
			border-radius: 3px;
			font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
			font-size: 0.85em;
		}
		
		/* Code block container - VS Code dark */
		pre {
			background-color: #1a1a1a;
			padding: 14px 16px;
			overflow: auto;
			border-radius: 4px;
			margin: 0.7em 0;
		}
		
		pre code {
			background-color: transparent;
			padding: 0;
			font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
			font-size: 0.88em;
			line-height: 1.5;
			display: block;
		}
		
		/* Highlight.js VS Code Dark+ Theme - Enhanced for all major languages */
		.hljs {
			color: #d4d4d4;
		}
		
		/* ===== COMMENTS ===== */
		/* Green italic - works for all languages */
		.hljs-comment,
		.hljs-quote,
		.hljs-shebang {
			color: #6a9955;
			font-style: italic;
		}
		
		/* ===== KEYWORDS ===== */
		/* Blue - if, for, while, def, class, import, return, async, await, etc. */
		.hljs-keyword,
		.hljs-selector-tag,
		.hljs-reserved {
			color: #569cd6;
		}
		
		/* ===== CONSTANTS & LITERALS ===== */
		/* Blue - True, False, None, null, undefined, NaN, Infinity */
		.hljs-literal,
		.hljs-constant {
			color: #569cd6;
		}
		
		/* ===== TYPES & CLASSES ===== */
		/* Teal - int, str, list, dict, Array, Object, Promise, etc. */
		.hljs-type,
		.hljs-built_in,
		.hljs-builtin-name,
		.hljs-class .hljs-title,
		.hljs-title.class_,
		.hljs-title.class_.inherited__ {
			color: #4ec9b0;
		}
		
		/* ===== NUMBERS ===== */
		/* Light green */
		.hljs-number {
			color: #b5cea8;
		}
		
		/* ===== STRINGS ===== */
		/* Orange - single, double, template strings, regex */
		.hljs-string,
		.hljs-doctag,
		.hljs-regexp,
		.hljs-template-tag,
		.hljs-subst {
			color: #ce9178;
		}
		
		/* ===== FUNCTIONS ===== */
		/* Yellow - function names, method names */
		.hljs-title,
		.hljs-title.function_,
		.hljs-function .hljs-title,
		.hljs-title.invoked__ {
			color: #dcdcaa;
		}
		
		/* ===== VARIABLES & PARAMETERS ===== */
		/* Light blue */
		.hljs-variable,
		.hljs-template-variable,
		.hljs-params,
		.hljs-variable.language_ {
			color: #9cdcfe;
		}
		
		/* ===== PROPERTIES & ATTRIBUTES ===== */
		/* Light blue - console, document, window, this, self */
		.hljs-property,
		.hljs-attr,
		.hljs-attribute {
			color: #9cdcfe;
		}
		
		/* ===== OPERATORS & PUNCTUATION ===== */
		.hljs-operator {
			color: #d4d4d4;
		}
		.hljs-punctuation {
			color: #d4d4d4;
		}
		
		/* ===== DECORATORS & META ===== */
		/* Purple - @decorator, @property, etc. */
		.hljs-meta,
		.hljs-decorator,
		.hljs-meta .hljs-keyword,
		.hljs-meta .hljs-string {
			color: #c586c0;
		}
		
		/* ===== HTML/XML/JSX TAGS ===== */
		.hljs-name,
		.hljs-tag {
			color: #569cd6;
		}
		.hljs-tag .hljs-attr {
			color: #9cdcfe;
		}
		.hljs-tag .hljs-string {
			color: #ce9178;
		}
		
		/* ===== CSS SPECIFIC ===== */
		.hljs-selector-class,
		.hljs-selector-id {
			color: #d7ba7d;
		}
		.hljs-selector-pseudo,
		.hljs-selector-attr {
			color: #d7ba7d;
		}
		
		/* ===== SQL SPECIFIC ===== */
		/* SQL keywords in uppercase convention */
		.language-sql .hljs-keyword {
			color: #569cd6;
		}
		.language-sql .hljs-built_in {
			color: #4ec9b0;
		}
		.language-sql .hljs-string {
			color: #ce9178;
		}
		
		/* ===== PYTHON SPECIFIC ===== */
		/* Self keyword */
		.language-python .hljs-variable.language_ {
			color: #569cd6;
		}
		/* Magic methods __init__, __str__ */
		.language-python .hljs-title.function_.magic_ {
			color: #dcdcaa;
		}
		
		/* ===== JAVASCRIPT/TYPESCRIPT SPECIFIC ===== */
		/* Console, document, window */
		.language-javascript .hljs-variable.language_,
		.language-typescript .hljs-variable.language_ {
			color: #9cdcfe;
		}
		/* Arrow functions */
		.language-javascript .hljs-function .hljs-params,
		.language-typescript .hljs-function .hljs-params {
			color: #9cdcfe;
		}
		
		/* ===== SYMBOLS & SPECIAL ===== */
		.hljs-symbol,
		.hljs-bullet,
		.hljs-link {
			color: #569cd6;
		}
		
		/* ===== DIFF HIGHLIGHTING ===== */
		.hljs-deletion {
			color: #ce9178;
			background-color: rgba(206, 145, 120, 0.15);
		}
		.hljs-addition {
			color: #b5cea8;
			background-color: rgba(181, 206, 168, 0.15);
		}
		
		/* ===== EMPHASIS ===== */
		.hljs-emphasis {
			font-style: italic;
		}
		.hljs-strong {
			font-weight: bold;
		}
		
		/* ===== SECTION HEADERS (for some langs) ===== */
		.hljs-section {
			color: #569cd6;
			font-weight: bold;
		}
		
		blockquote {
			margin: 0.6em 0;
			padding: 0 1em;
			color: var(--vscode-descriptionForeground);
			border-left: 4px solid var(--vscode-textBlockQuote-border, #007acc);
		}
		a {
			color: var(--vscode-textLink-foreground);
			text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
		ul, ol {
			padding-left: 2em;
			margin: 0.6em 0;
		}
		li { margin: 0.2em 0; }
		table {
			border-collapse: collapse;
			width: 100%;
			margin: 0.8em 0;
		}
		th, td {
			border: 1px solid var(--vscode-panel-border);
			padding: 6px 10px;
			text-align: left;
		}
		th {
			background-color: var(--vscode-editor-selectionBackground);
			font-weight: 600;
		}
		img {
			max-width: 100%;
			height: auto;
		}
		hr {
			border: none;
			border-top: 1px solid var(--vscode-panel-border);
			margin: 1.2em 0;
		}
		/* Strong and emphasis in text */
		strong, b {
			font-weight: 600;
			color: var(--vscode-editor-foreground);
		}
		em, i {
			font-style: italic;
		}
	</style>
</head>
<body>
	${renderedHtml}
</body>
</html>`;
}

export function deactivate() {
  // Dispose all active panels on deactivation
  for (const panel of activePanels) {
    panel.dispose();
  }
  activePanels.length = 0;
  panelDocumentMap.clear();
}
