# Change Log

All notable changes to the "markdown-multi-preview" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.3] - 2026-01-09

### Added

- **Sticky/Fixed TOC sidebar**: TOC now stays visible while scrolling through long documents
- **Theme-aware scrollbars**: Scrollbars automatically match light/dark theme

### Changed

- **Independent scroll areas**: TOC and content now scroll independently

### Fixed

- TOC now properly collapses to zero width when hidden (no longer takes space)
- Scrollbars now display light colors on light theme instead of dark

## [0.0.2] - 2026-01-09

### Added

- **Resizable TOC sidebar**: Drag the edge to resize width (180px - 450px), double-click to reset to default
- **Persistent TOC width**: Width preference saved to localStorage across sessions

### Changed

- **Improved light theme syntax highlighting**: Better contrast colors for code blocks (GitHub-inspired palette)
- **Better blockquote styling**: Light blue background in light theme for improved readability
- **Responsive TOC header**: Controls now wrap to multiple lines when TOC width is minimized

### Fixed

- Light theme code blocks now have proper light background instead of dark
- Blockquotes display correctly in light theme

## [0.0.1] - 2026-01-08

### Added

- Multiple independent preview panels - open as many previews as you need
- Live preview updates on text changes
- VS Code theme integration
- Syntax highlighting for 190+ languages using highlight.js
- Configurable font size (10-32px)
- Keyboard shortcut support (`Ctrl+Alt+V` / `Cmd+Alt+V`)
- Table of Contents (TOC) sidebar with:
  - Toggle visibility (hamburger menu)
  - Left/right positioning
  - Expand/collapse all sections
  - Font size adjustment (+/−)
  - Light/dark theme toggle
  - Click-to-navigate smooth scrolling
  - Persistent preferences via localStorage
