# Markdown Multi Preview

Preview multiple Markdown files simultaneously in independent webview panels. Each time you trigger the preview command, a **new independent panel** is created instead of reusing an existing one.

## Features

- 🔄 **Multiple Independent Previews**: Open as many preview panels as you need for different Markdown files
- ⚡ **Live Updates**: Preview automatically updates as you type
- 🎨 **VS Code Theme Integration**: Preview respects your current VS Code color theme
- 🎯 **Syntax Highlighting**: Beautiful code syntax highlighting for 190+ languages
- ⌨️ **Keyboard Shortcut**: Quick access with `Ctrl+Alt+V` (or `Cmd+Alt+V` on macOS)
- 📏 **Configurable Font Size**: Adjust preview font size to your preference

## Usage

1. Open a Markdown file (`.md`)
2. Use one of these methods to open a preview:
   - Press `Ctrl+Alt+V` (Windows/Linux) or `Cmd+Alt+V` (macOS)
   - Open the Command Palette (`Ctrl+Shift+P`) and run `Markdown Multi Preview: Open Preview`
3. Edit your Markdown file - the preview updates live!
4. Open additional previews for other Markdown files as needed

## Extension Settings

| Setting                         | Default | Description                                       |
| ------------------------------- | ------- | ------------------------------------------------- |
| `markdownMultiPreview.fontSize` | `16`    | Font size for the Markdown preview (10-32 pixels) |

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

### Build from Source

```bash
# Clone the repository
git clone https://github.com/mysticmilan369/markdown-multi-preview.git
cd markdown-multi-preview

# Install dependencies
npm install

# Build
npm run compile

# Package as VSIX
npm install -g @vscode/vsce
vsce package

# Install
code --install-extension markdown-multi-preview-0.0.1.vsix
```

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode (auto-rebuild on changes)
npm run watch

# Run extension in development
# Press F5 in VS Code to launch Extension Development Host
```

## Requirements

No additional requirements. The extension works out of the box.

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial release:

- Multiple independent preview panels
- Live preview updates on text changes
- VS Code theme integration
- Syntax highlighting for 190+ languages
- Configurable font size
- Keyboard shortcut support (Ctrl+Alt+V)

---

## License

MIT

**Enjoy!**
