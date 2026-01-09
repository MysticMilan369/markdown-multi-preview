# Markdown Multi Preview

Preview multiple Markdown files simultaneously in independent webview panels. Each time you trigger the preview command, a **new independent panel** is created instead of reusing an existing one.

## Features

- 🔄 **Multiple Independent Previews**: Open as many preview panels as you need for different Markdown files
- ⚡ **Live Updates**: Preview automatically updates as you type
- 🎨 **VS Code Theme Integration**: Preview respects your current VS Code color theme
- 🎯 **Syntax Highlighting**: Beautiful code syntax highlighting for 190+ languages with optimized colors for both light and dark themes
- ⌨️ **Keyboard Shortcut**: Quick access with `Ctrl+Alt+V` (or `Cmd+Alt+V` on macOS)
- 📏 **Configurable Font Size**: Adjust preview font size with +/− buttons
- 🌳 **Table of Contents (TOC)**: Built-in expandable/collapsible TOC sidebar in the preview panel
  - Toggle visibility with hamburger menu button (completely hides when collapsed)
  - **Resizable width**: Drag the edge to resize (180px - 450px), double-click to reset
  - **Fixed/Sticky position**: TOC stays visible while scrolling through long documents
  - Position on left or right side
  - Click headings to smooth-scroll navigate
  - Single button to expand/collapse all sections
  - Wraps controls to multiple lines when space is limited
- 🌓 **Light/Dark Theme Toggle**: Switch between light and dark themes within the preview
- 🎨 **Theme-aware Scrollbars**: Scrollbars automatically match the current theme (light/dark)
- 💾 **Persistent Preferences**: All settings (TOC position, width, theme, font size, expanded state) are saved across sessions

## Quick Start for Marketplace Users

If you've installed this extension from the VS Code Marketplace, here's how to get started:

1. **Open a Markdown file** (`.md`) in VS Code
2. **Make sure the file is active** in the editor (i.e., the cursor is focused in the file)
3. **Press `Ctrl + Alt + V`** (Windows/Linux) or **`Cmd + Alt + V`** (macOS) to open the preview
   > This works similarly to `Ctrl + Shift + V`, which opens the built-in Markdown preview, but creates independent panels!
4. **Use the Table of Contents** in the preview panel sidebar to navigate through headings

## Usage

### Opening Preview

1. Open a Markdown file (`.md`)
2. Use one of these methods to open a preview:
   - Press `Ctrl+Alt+V` (Windows/Linux) or `Cmd+Alt+V` (macOS)
   - Open the Command Palette (`Ctrl+Shift+P`) and run `Markdown Multi Preview: Open Preview`
3. Edit your Markdown file - the preview updates live!
4. Open additional previews for other Markdown files as needed

### Using the Table of Contents (TOC)

The preview panel includes a built-in Table of Contents sidebar:

1. **Toggle visibility**: Click the ☰ hamburger menu button (appears when TOC is hidden) or the ✕ button to hide
2. **Resize width**: Drag the edge of the TOC to resize it (min: 180px, max: 450px). Double-click the edge to reset to default width (280px)
3. **Navigate**: Click any heading to smooth-scroll to that section
4. **Expand/Collapse**: Click the ▼/▲ toggle button to expand or collapse all sections
5. **Position**: Click ◀ or ▶ buttons in the footer to move TOC to left or right side
6. **Font Size**: Use the − and + buttons in the header to adjust preview font size
7. **Theme**: Click the 🌙/☀️ button in the footer to toggle between dark and light themes
8. **Preferences are saved**: All your preferences (visibility, width, position, theme, font size, expanded state) persist across sessions

## Extension Settings

| Setting                            | Default | Description                                       |
| ---------------------------------- | ------- | ------------------------------------------------- |
| `markdownMultiPreview.fontSize`    | `16`    | Font size for the Markdown preview (10-32 pixels) |
| `markdownMultiPreview.tocPosition` | `right` | Default position of the TOC sidebar (left/right)  |

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for **"Markdown Multi Preview"**
4. Click **Install**

### From VSIX File (Local Installation)

```bash
# Option 1: Using command line
code --install-extension markdown-multi-preview-0.0.1.vsix

# Option 2: In VS Code
# Press Ctrl+Shift+P → "Extensions: Install from VSIX..." → Select the .vsix file
```

## Development (For Contributors)

If you're cloning this repository to contribute or customize the extension:

### Prerequisites

- Node.js (v16 or higher)
- npm
- VS Code

### Setup

```bash
# Clone the repository
git clone https://github.com/mysticmilan369/markdown-multi-preview.git
cd markdown-multi-preview

# Install dependencies
npm install

# Compile the extension
npm run compile

# Watch mode (auto-rebuild on changes)
npm run watch
```

### Running in Development Mode

1. Open the project folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new VS Code window, open any `.md` file
4. Press `Ctrl+Alt+V` to test the preview
5. Check the Markdown Outline in the sidebar

### Building for Distribution

```bash
# Install vsce if you haven't already
npm install -g @vscode/vsce

# Package as VSIX
vsce package

# Install locally for testing
code --install-extension markdown-multi-preview-0.0.1.vsix
```

### Project Structure

```
markdown-multi-preview/
├── src/
│   ├── extension.ts      # Main extension code
│   └── test/             # Test files
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript config
├── esbuild.js            # Build configuration
└── README.md             # This file
```

## Requirements

No additional requirements. The extension works out of the box.

## Known Issues

None at this time.

## Release Notes

### 0.0.2

New features:

- **Resizable TOC sidebar**: Drag the edge to resize width (180px - 450px), double-click to reset
- **Improved light theme**: Better contrast syntax highlighting colors for code blocks
- **Responsive header**: TOC header controls wrap to multiple lines when width is small
- **Better blockquote styling**: Light blue background in light theme for better readability
- **Persistent TOC width**: Width preference saved across sessions

### 0.0.1

Initial release:

- Multiple independent preview panels
- Live preview updates on text changes
- VS Code theme integration
- Syntax highlighting for 190+ languages
- Configurable font size
- Keyboard shortcut support (Ctrl+Alt+V)
- Table of Contents sidebar with toggle, positioning, expand/collapse, and theme switching

---

## License

MIT

**Enjoy!**
