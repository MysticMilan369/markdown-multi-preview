import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

// ========== MARKDOWN HEADING PARSER ==========

interface MarkdownHeading {
  text: string;
  level: number;
  id: string;
  children: MarkdownHeading[];
}

// Function to generate slug/id from heading text
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Function to parse headings from markdown text
function parseHeadings(markdownText: string): MarkdownHeading[] {
  const lines = markdownText.split("\n");
  const flatHeadings: MarkdownHeading[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/;
  const slugCounts: Map<string, number> = new Map();

  for (const line of lines) {
    const match = line.match(headingRegex);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      let slug = generateSlug(text);

      // Handle duplicate slugs
      const count = slugCounts.get(slug) || 0;
      if (count > 0) {
        slug = `${slug}-${count}`;
      }
      slugCounts.set(generateSlug(text), count + 1);

      flatHeadings.push({
        text,
        level,
        id: slug,
        children: [],
      });
    }
  }

  return buildHierarchy(flatHeadings);
}

// Build hierarchical structure from flat headings
function buildHierarchy(flatHeadings: MarkdownHeading[]): MarkdownHeading[] {
  const root: MarkdownHeading[] = [];
  const stack: MarkdownHeading[] = [];

  for (const heading of flatHeadings) {
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(heading);
    } else {
      stack[stack.length - 1].children.push(heading);
    }

    stack.push(heading);
  }

  return root;
}

// Generate TOC HTML recursively
function generateTocHtml(
  headings: MarkdownHeading[],
  depth: number = 0
): string {
  if (headings.length === 0) {
    return "";
  }

  let html = '<ul class="toc-list">';
  for (const heading of headings) {
    const hasChildren = heading.children.length > 0;
    const itemClass = hasChildren ? "toc-item has-children" : "toc-item";

    html += `<li class="${itemClass}">`;
    if (hasChildren) {
      html += `<span class="toc-toggle" data-expanded="true">▼</span>`;
    }
    html += `<a href="#${heading.id}" class="toc-link" data-level="${heading.level}">${heading.text}</a>`;
    if (hasChildren) {
      html += generateTocHtml(heading.children, depth + 1);
    }
    html += "</li>";
  }
  html += "</ul>";
  return html;
}

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

// Add IDs to headings for anchor links
const defaultHeadingRender =
  md.renderer.rules.heading_open ||
  function (tokens: any[], idx: number, options: any, env: any, self: any) {
    return self.renderToken(tokens, idx, options);
  };

const slugCounts = new Map<string, number>();

md.renderer.rules.heading_open = function (
  tokens: any[],
  idx: number,
  options: any,
  env: any,
  self: any
) {
  const token = tokens[idx];
  const nextToken = tokens[idx + 1];

  if (nextToken && nextToken.type === "inline" && nextToken.content) {
    const text = nextToken.content;
    let slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    // Handle duplicate slugs
    const baseSlug = slug;
    const count = slugCounts.get(baseSlug) || 0;
    if (count > 0) {
      slug = `${baseSlug}-${count}`;
    }
    slugCounts.set(baseSlug, count + 1);

    token.attrSet("id", slug);
  }

  return defaultHeadingRender(tokens, idx, options, env, self);
};

// Reset slug counts before each render
function resetSlugCounts() {
  slugCounts.clear();
}

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

  // Reset slug counts before rendering
  resetSlugCounts();

  const htmlContent = md.render(markdownContent);

  // Parse headings for TOC
  const headings = parseHeadings(markdownContent);
  const tocHtml = generateTocHtml(headings);

  // Get font size from configuration
  const config = vscode.workspace.getConfiguration("markdownMultiPreview");
  const fontSize = config.get<number>("fontSize", 16);
  const tocPosition = config.get<string>("tocPosition", "right");

  panel.webview.html = getWebviewContent(
    htmlContent,
    tocHtml,
    fontSize,
    tocPosition
  );
}

function getWebviewContent(
  renderedHtml: string,
  tocHtml: string,
  fontSize: number,
  tocPosition: string
): string {
  const isLeft = tocPosition === "left";

  return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Markdown Preview</title>
	<style>
		:root {
			--preview-font-size: ${fontSize}px;
			--toc-width: 280px;
			--toc-min-width: 180px;
			--toc-max-width: 450px;
		}
		
		* {
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			font-size: var(--preview-font-size);
			line-height: 1.6;
			margin: 0;
			padding: 0;
			color: var(--vscode-editor-foreground);
			background-color: var(--vscode-editor-background);
		}
		
		/* ===== MAIN LAYOUT ===== */
		html, body {
			height: 100%;
			overflow: hidden;
		}
		
		.main-container {
			display: flex;
			flex-direction: ${isLeft ? "row" : "row-reverse"};
			height: 100vh;
			overflow: hidden;
		}
		
		.main-container.toc-hidden .toc-sidebar {
			width: 0 !important;
			min-width: 0 !important;
			max-width: 0 !important;
			padding: 0 !important;
			border: none !important;
			opacity: 0;
			pointer-events: none;
			overflow: hidden;
		}
		
		.main-container.toc-hidden .content-area {
			max-width: 100%;
		}
		
		/* ===== TOC SIDEBAR ===== */
		.toc-sidebar {
			width: var(--toc-width);
			min-width: var(--toc-min-width);
			max-width: var(--toc-max-width);
			background-color: var(--vscode-sideBar-background, #252526);
			border-${
        isLeft ? "right" : "left"
      }: 1px solid var(--vscode-panel-border, #3c3c3c);
			padding: 12px;
			overflow-y: auto;
			overflow-x: hidden;
			height: 100vh;
			display: flex;
			flex-direction: column;
			position: relative;
			flex-shrink: 0;
		}
		
		/* ===== TOC RESIZE HANDLE ===== */
		.toc-resize-handle {
			position: absolute;
			top: 0;
			${isLeft ? "right" : "left"}: 0;
			width: 6px;
			height: 100%;
			cursor: ${isLeft ? "ew-resize" : "ew-resize"};
			background: transparent;
			transition: background-color 0.2s ease;
			z-index: 10;
		}
		
		.toc-resize-handle:hover,
		.toc-resize-handle.resizing {
			background-color: var(--vscode-focusBorder, #007fd4);
		}
		
		.toc-sidebar.resizing {
			user-select: none;
			transition: none;
		}
		
		.toc-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 8px;
			padding-bottom: 8px;
			border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
			flex-shrink: 0;
			flex-wrap: wrap;
			gap: 6px;
		}
		
		.toc-title {
			font-size: 0.85em;
			font-weight: 600;
			color: var(--vscode-sideBarTitle-foreground, #bbbbbb);
			text-transform: uppercase;
			letter-spacing: 0.5px;
			white-space: nowrap;
		}
		
		.toc-controls {
			display: flex;
			gap: 4px;
			align-items: center;
			flex-wrap: wrap;
		}
		
		.toc-content {
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
		}
		
		.toc-footer {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-top: 12px;
			padding-top: 8px;
			border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
			flex-shrink: 0;
			gap: 8px;
		}
		
		.toc-btn {
			background: transparent;
			border: none;
			color: var(--vscode-icon-foreground, #c5c5c5);
			cursor: pointer;
			padding: 4px 6px;
			border-radius: 3px;
			font-size: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		
		.toc-btn:hover {
			background-color: var(--vscode-toolbar-hoverBackground, #5a5d5e50);
		}
		
		.toc-btn svg {
			width: 16px;
			height: 16px;
			fill: currentColor;
		}
		
		/* ===== FONT SIZE CONTROLS ===== */
		.font-size-controls {
			display: flex;
			align-items: center;
			gap: 4px;
			background: var(--vscode-input-background, #3c3c3c);
			border-radius: 4px;
			padding: 2px 6px;
		}
		
		.font-size-controls span {
			font-size: 11px;
			color: var(--vscode-input-foreground, #cccccc);
			min-width: 28px;
			text-align: center;
		}
		
		.font-btn {
			background: transparent;
			border: none;
			color: var(--vscode-input-foreground, #cccccc);
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 14px;
			font-weight: bold;
			line-height: 1;
		}
		
		.font-btn:hover {
			background-color: var(--vscode-toolbar-hoverBackground, #5a5d5e50);
		}
		
		/* ===== THEME TOGGLE ===== */
		.theme-toggle {
			background: transparent;
			border: none;
			color: var(--vscode-icon-foreground, #c5c5c5);
			cursor: pointer;
			padding: 4px 6px;
			border-radius: 3px;
			font-size: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		
		.theme-toggle:hover {
			background-color: var(--vscode-toolbar-hoverBackground, #5a5d5e50);
		}
		
		/* Light theme styles */
		body.light-theme {
			--vscode-editor-foreground: #333333;
			--vscode-editor-background: #ffffff;
			--vscode-sideBar-background: #f3f3f3;
			--vscode-panel-border: #e0e0e0;
			--vscode-sideBarTitle-foreground: #666666;
			--vscode-icon-foreground: #666666;
			--vscode-textLink-foreground: #0066cc;
			--vscode-list-hoverBackground: #e8e8e8;
			--vscode-input-background: #ffffff;
			--vscode-input-foreground: #333333;
			--vscode-button-background: #0066cc;
			--vscode-button-foreground: #ffffff;
			--vscode-descriptionForeground: #666666;
			--vscode-textCodeBlock-background: rgba(0, 0, 0, 0.05);
			--vscode-editor-selectionBackground: rgba(0, 102, 204, 0.1);
			--vscode-textBlockQuote-border: #0066cc;
			--vscode-textBlockQuote-background: rgba(0, 102, 204, 0.05);
		}
		
		body.light-theme pre {
			background-color: #f6f8fa !important;
			border: 1px solid #e1e4e8;
		}
		
		body.light-theme pre code {
			background-color: transparent !important;
		}
		
		body.light-theme code {
			background-color: rgba(27, 31, 35, 0.05);
			color: #24292e;
		}
		
		body.light-theme blockquote {
			background-color: rgba(0, 102, 204, 0.05);
			border-radius: 4px;
		}
		
		body.light-theme blockquote code,
		body.light-theme blockquote pre {
			background-color: rgba(27, 31, 35, 0.08) !important;
		}
		
		body.light-theme .hljs {
			color: #24292e;
			background: transparent;
		}
		
		body.light-theme .hljs-comment,
		body.light-theme .hljs-quote,
		body.light-theme .hljs-shebang {
			color: #6a737d;
			font-style: italic;
		}
		
		body.light-theme .hljs-keyword,
		body.light-theme .hljs-selector-tag,
		body.light-theme .hljs-reserved {
			color: #d73a49;
		}
		
		body.light-theme .hljs-literal,
		body.light-theme .hljs-constant {
			color: #005cc5;
		}
		
		body.light-theme .hljs-string,
		body.light-theme .hljs-doctag,
		body.light-theme .hljs-regexp {
			color: #032f62;
		}
		
		body.light-theme .hljs-number {
			color: #005cc5;
		}
		
		body.light-theme .hljs-title,
		body.light-theme .hljs-title.function_,
		body.light-theme .hljs-function .hljs-title {
			color: #6f42c1;
		}
		
		body.light-theme .hljs-type,
		body.light-theme .hljs-built_in,
		body.light-theme .hljs-builtin-name,
		body.light-theme .hljs-class .hljs-title,
		body.light-theme .hljs-title.class_ {
			color: #6f42c1;
		}
		
		body.light-theme .hljs-variable,
		body.light-theme .hljs-template-variable,
		body.light-theme .hljs-params {
			color: #e36209;
		}
		
		body.light-theme .hljs-property,
		body.light-theme .hljs-attr,
		body.light-theme .hljs-attribute {
			color: #005cc5;
		}
		
		body.light-theme .hljs-meta,
		body.light-theme .hljs-decorator {
			color: #6f42c1;
		}
		
		body.light-theme .hljs-name,
		body.light-theme .hljs-tag {
			color: #22863a;
		}
		
		body.light-theme .hljs-selector-class,
		body.light-theme .hljs-selector-id {
			color: #6f42c1;
		}
		
		body.light-theme .hljs-symbol,
		body.light-theme .hljs-bullet,
		body.light-theme .hljs-link {
			color: #005cc5;
		}
		
		body.light-theme .hljs-deletion {
			color: #b31d28;
			background-color: #ffeef0;
		}
		
		body.light-theme .hljs-addition {
			color: #22863a;
			background-color: #e6ffed;
		}
		
		body.light-theme .hljs-operator,
		body.light-theme .hljs-punctuation {
			color: #24292e;
		}
		
		body.light-theme .hljs-section {
			color: #005cc5;
			font-weight: bold;
		}
		
		body.light-theme .hljs-emphasis {
			font-style: italic;
		}
		
		body.light-theme .hljs-strong {
			font-weight: bold;
		}

		/* ===== SCROLLBAR STYLING (Dark Theme) ===== */
		::-webkit-scrollbar {
			width: 10px;
			height: 10px;
		}
		
		::-webkit-scrollbar-track {
			background: var(--vscode-editor-background, #1e1e1e);
		}
		
		::-webkit-scrollbar-thumb {
			background: #5a5a5a;
			border-radius: 5px;
		}
		
		::-webkit-scrollbar-thumb:hover {
			background: #6e6e6e;
		}
		
		::-webkit-scrollbar-corner {
			background: var(--vscode-editor-background, #1e1e1e);
		}
		
		/* ===== SCROLLBAR STYLING (Light Theme) ===== */
		body.light-theme,
		body.light-theme *,
		.light-theme ::-webkit-scrollbar-track,
		.light-theme *::-webkit-scrollbar-track {
			scrollbar-color: #c1c1c1 #f5f5f5;
		}
		
		body.light-theme ::-webkit-scrollbar-track,
		body.light-theme *::-webkit-scrollbar-track {
			background: #f5f5f5 !important;
		}
		
		body.light-theme ::-webkit-scrollbar-thumb,
		body.light-theme *::-webkit-scrollbar-thumb {
			background: #c1c1c1 !important;
			border-radius: 5px;
		}
		
		body.light-theme ::-webkit-scrollbar-thumb:hover,
		body.light-theme *::-webkit-scrollbar-thumb:hover {
			background: #a8a8a8 !important;
		}
		
		body.light-theme ::-webkit-scrollbar-corner,
		body.light-theme *::-webkit-scrollbar-corner {
			background: #f5f5f5 !important;
		}

		/* ===== TOC LIST ===== */
		.toc-list {
			list-style: none;
			padding: 0;
			margin: 0;
		}
		
		.toc-list .toc-list {
			padding-left: 16px;
			margin-top: 4px;
			overflow: hidden;
			transition: max-height 0.3s ease;
		}
		
		.toc-item {
			margin: 2px 0;
		}
		
		.toc-item.collapsed > .toc-list {
			max-height: 0;
		}
		
		.toc-item:not(.collapsed) > .toc-list {
			max-height: 2000px;
		}
		
		.toc-toggle {
			display: inline-block;
			width: 16px;
			font-size: 10px;
			cursor: pointer;
			color: var(--vscode-icon-foreground, #c5c5c5);
			user-select: none;
			transition: transform 0.2s ease;
		}
		
		.toc-item.collapsed > .toc-toggle {
			transform: rotate(-90deg);
		}
		
		.toc-link {
			color: var(--vscode-textLink-foreground, #3794ff);
			text-decoration: none;
			font-size: 0.8em;
			display: inline;
			padding: 2px 4px;
			border-radius: 3px;
			transition: background-color 0.15s ease;
			word-wrap: break-word;
			word-break: break-word;
			line-height: 1.4;
		}
		
		.toc-link:hover {
			background-color: var(--vscode-list-hoverBackground, #2a2d2e);
			text-decoration: none;
		}
		
		.toc-link[data-level="1"] {
			font-weight: 600;
			color: var(--vscode-editor-foreground);
		}
		
		.toc-link[data-level="2"] {
			font-weight: 500;
		}
		
		/* ===== FLOATING TOGGLE BUTTON ===== */
		.toc-floating-toggle {
			position: fixed;
			top: 12px;
			${isLeft ? "left" : "right"}: 12px;
			z-index: 1000;
			background-color: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #ffffff);
			border: none;
			border-radius: 6px;
			padding: 8px 10px;
			cursor: pointer;
			align-items: center;
			justify-content: center;
			box-shadow: 0 2px 8px rgba(0,0,0,0.4);
			transition: background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
			display: flex;
		}
		
		.toc-floating-toggle:hover {
			background-color: var(--vscode-button-hoverBackground, #1177bb);
			transform: scale(1.05);
		}
		
		.toc-floating-toggle svg {
			width: 22px;
			height: 22px;
			fill: currentColor;
		}
		
		/* Hide hamburger when TOC is visible */
		.toc-floating-toggle.hidden {
			opacity: 0;
			pointer-events: none;
		}
		
		/* ===== POSITION SWITCHER ===== */
		.position-switcher {
			display: flex;
			gap: 2px;
			background: var(--vscode-input-background, #3c3c3c);
			border-radius: 4px;
			padding: 2px;
		}
		
		.position-btn {
			background: transparent;
			border: none;
			color: var(--vscode-input-foreground, #cccccc);
			cursor: pointer;
			padding: 4px 8px;
			border-radius: 3px;
			font-size: 11px;
			transition: background-color 0.15s ease;
		}
		
		.position-btn:hover {
			background-color: var(--vscode-toolbar-hoverBackground, #5a5d5e50);
		}
		
		.position-btn.active {
			background-color: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #ffffff);
		}
		
		/* ===== CONTENT AREA ===== */
		.content-area {
			flex: 1;
			padding: 20px 40px;
			max-width: 900px;
			margin: 0 auto;
			overflow-y: auto;
			height: 100vh;
		}
		
		/* ===== MARKDOWN CONTENT STYLES ===== */
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
		
		/* Scroll margin for headings */
		h1[id], h2[id], h3[id], h4[id], h5[id], h6[id] {
			scroll-margin-top: 20px;
		}
	</style>
</head>
<body>
	<button class="toc-floating-toggle hidden" id="tocFloatingToggle" onclick="toggleToc()" title="Toggle table of contents">
		<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
	</button>
	
	<div class="main-container" id="mainContainer">
		<aside class="toc-sidebar" id="tocSidebar">
			<div class="toc-resize-handle" id="tocResizeHandle"></div>
			<div class="toc-header">
				<span class="toc-title">Contents</span>
				<div class="toc-controls">
					<div class="font-size-controls">
						<button class="font-btn" onclick="decreaseFontSize()" title="Decrease font size">−</button>
						<span id="fontSizeDisplay">${fontSize}px</span>
						<button class="font-btn" onclick="increaseFontSize()" title="Increase font size">+</button>
					</div>
					<button class="toc-btn" onclick="toggleExpandCollapse()" title="Expand/Collapse all" id="expandCollapseBtn">
						<svg viewBox="0 0 16 16" id="expandCollapseIcon"><path d="M3 4l5 5 5-5 1 1-6 6-6-6z"/></svg>
					</button>
					<button class="toc-btn" onclick="toggleToc()" title="Hide TOC">
						<svg viewBox="0 0 16 16"><path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/></svg>
					</button>
				</div>
			</div>
			<nav class="toc-content">
				${tocHtml}
			</nav>
			<div class="toc-footer">
				<button class="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark theme" id="themeToggle">🌙</button>
				<div class="position-switcher">
					<button class="position-btn ${
            isLeft ? "active" : ""
          }" onclick="setPosition('left')" title="TOC on left">◀</button>
					<button class="position-btn ${
            !isLeft ? "active" : ""
          }" onclick="setPosition('right')" title="TOC on right">▶</button>
				</div>
			</div>
		</aside>
		
		<main class="content-area" id="contentArea">
			${renderedHtml}
		</main>
	</div>
	
	<script>
		let currentFontSize = ${fontSize};
		let isExpanded = true;
		let isDarkTheme = true;
		
		// Toggle TOC visibility
		function toggleToc() {
			const container = document.getElementById('mainContainer');
			const floatingBtn = document.getElementById('tocFloatingToggle');
			const isHidden = container.classList.toggle('toc-hidden');
			
			// Show hamburger when TOC is hidden, hide it when TOC is visible
			if (isHidden) {
				floatingBtn.classList.remove('hidden');
			} else {
				floatingBtn.classList.add('hidden');
			}
			
			localStorage.setItem('tocHidden', isHidden);
		}
		
		// Font size controls
		function increaseFontSize() {
			if (currentFontSize < 32) {
				currentFontSize += 2;
				updateFontSize();
			}
		}
		
		function decreaseFontSize() {
			if (currentFontSize > 10) {
				currentFontSize -= 2;
				updateFontSize();
			}
		}
		
		function updateFontSize() {
			document.documentElement.style.setProperty('--preview-font-size', currentFontSize + 'px');
			document.getElementById('fontSizeDisplay').textContent = currentFontSize + 'px';
			localStorage.setItem('previewFontSize', currentFontSize);
		}
		
		// Theme toggle
		function toggleTheme() {
			isDarkTheme = !isDarkTheme;
			document.body.classList.toggle('light-theme', !isDarkTheme);
			document.getElementById('themeToggle').textContent = isDarkTheme ? '🌙' : '☀️';
			localStorage.setItem('previewTheme', isDarkTheme ? 'dark' : 'light');
		}
		
		// Single expand/collapse toggle
		function toggleExpandCollapse() {
			const items = document.querySelectorAll('.toc-item.has-children');
			const icon = document.getElementById('expandCollapseIcon');
			
			if (isExpanded) {
				items.forEach(item => item.classList.add('collapsed'));
				icon.innerHTML = '<path d="M3 12l5-5 5 5 1-1-6-6-6 6z"/>';
			} else {
				items.forEach(item => item.classList.remove('collapsed'));
				icon.innerHTML = '<path d="M3 4l5 5 5-5 1 1-6 6-6-6z"/>';
			}
			isExpanded = !isExpanded;
			localStorage.setItem('tocExpanded', isExpanded);
		}
		
		// Set TOC position (left or right)
		function setPosition(pos) {
			localStorage.setItem('tocPosition', pos);
			
			document.querySelectorAll('.position-btn').forEach(btn => {
				btn.classList.remove('active');
			});
			event.target.classList.add('active');
			
			const container = document.getElementById('mainContainer');
			const sidebar = document.getElementById('tocSidebar');
			const floatingBtn = document.querySelector('.toc-floating-toggle');
			
			if (pos === 'left') {
				container.style.flexDirection = 'row';
				sidebar.style.borderRight = '1px solid var(--vscode-panel-border, #3c3c3c)';
				sidebar.style.borderLeft = 'none';
				floatingBtn.style.left = '12px';
				floatingBtn.style.right = 'auto';
			} else {
				container.style.flexDirection = 'row-reverse';
				sidebar.style.borderLeft = '1px solid var(--vscode-panel-border, #3c3c3c)';
				sidebar.style.borderRight = 'none';
				floatingBtn.style.right = '12px';
				floatingBtn.style.left = 'auto';
			}
		}
		
		// Toggle individual TOC item
		document.querySelectorAll('.toc-toggle').forEach(toggle => {
			toggle.addEventListener('click', function(e) {
				e.stopPropagation();
				const item = this.closest('.toc-item');
				item.classList.toggle('collapsed');
			});
		});
		
		// Smooth scroll to heading
		document.querySelectorAll('.toc-link').forEach(link => {
			link.addEventListener('click', function(e) {
				e.preventDefault();
				const targetId = this.getAttribute('href').substring(1);
				const target = document.getElementById(targetId);
				if (target) {
					target.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		});
		
		// ===== TOC RESIZE FUNCTIONALITY =====
		(function() {
			const sidebar = document.getElementById('tocSidebar');
			const handle = document.getElementById('tocResizeHandle');
			let isResizing = false;
			let startX, startWidth;
			const isLeft = '${tocPosition}' === 'left';
			
			// Restore saved width
			const savedWidth = localStorage.getItem('tocWidth');
			if (savedWidth) {
				const width = parseInt(savedWidth);
				sidebar.style.width = width + 'px';
				document.documentElement.style.setProperty('--toc-width', width + 'px');
			}
			
			handle.addEventListener('mousedown', function(e) {
				isResizing = true;
				startX = e.clientX;
				startWidth = sidebar.offsetWidth;
				sidebar.classList.add('resizing');
				handle.classList.add('resizing');
				document.body.style.cursor = 'ew-resize';
				document.body.style.userSelect = 'none';
				e.preventDefault();
			});
			
			document.addEventListener('mousemove', function(e) {
				if (!isResizing) return;
				
				let newWidth;
				if (isLeft) {
					newWidth = startWidth + (e.clientX - startX);
				} else {
					newWidth = startWidth - (e.clientX - startX);
				}
				
				// Respect min/max constraints
				const minWidth = 180;
				const maxWidth = 450;
				newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
				
				sidebar.style.width = newWidth + 'px';
				document.documentElement.style.setProperty('--toc-width', newWidth + 'px');
			});
			
			document.addEventListener('mouseup', function() {
				if (isResizing) {
					isResizing = false;
					sidebar.classList.remove('resizing');
					handle.classList.remove('resizing');
					document.body.style.cursor = '';
					document.body.style.userSelect = '';
					
					// Save width to localStorage
					localStorage.setItem('tocWidth', sidebar.offsetWidth);
				}
			});
			
			// Double-click to reset width
			handle.addEventListener('dblclick', function() {
				sidebar.style.width = '280px';
				document.documentElement.style.setProperty('--toc-width', '280px');
				localStorage.setItem('tocWidth', '280');
			});
		})();
		
		// Restore preferences from localStorage
		(function() {
			const tocHidden = localStorage.getItem('tocHidden') === 'true';
			const floatingBtn = document.getElementById('tocFloatingToggle');
			
			if (tocHidden) {
				document.getElementById('mainContainer').classList.add('toc-hidden');
				floatingBtn.classList.remove('hidden');
			} else {
				floatingBtn.classList.add('hidden');
			}
			
			const savedPosition = localStorage.getItem('tocPosition');
			if (savedPosition) {
				setPosition(savedPosition);
			}
			
			const savedFontSize = localStorage.getItem('previewFontSize');
			if (savedFontSize) {
				currentFontSize = parseInt(savedFontSize);
				updateFontSize();
			}
			
			const savedTheme = localStorage.getItem('previewTheme');
			if (savedTheme === 'light') {
				isDarkTheme = false;
				document.body.classList.add('light-theme');
				document.getElementById('themeToggle').textContent = '☀️';
			}
			
			const savedExpanded = localStorage.getItem('tocExpanded');
			if (savedExpanded === 'false') {
				isExpanded = true;
				toggleExpandCollapse();
			}
		})();
	</script>
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
