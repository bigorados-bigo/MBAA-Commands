# Change Log

All notable changes to the MBAA Extension Pack will be documented in this file.

## [0.0.3] - 2025-10-15

### Added
- **Real-time duplicate ID detection** for all MBAA file types
- **Smart vector file validation** with section-aware duplicate checking
- **Section header validation** (prevents duplicate `[Sample_000]`, `[BoundList_001]`, etc.)
- **Simple vector row validation** (`0  900 0 -70 0` format duplicate detection)
- **TypeScript diagnostic provider** with VS Code Problems panel integration
- **Professional error messages** with line number references

### Enhanced
- **Vector file support** expanded to handle all section types
- **Per-bit binary flag coloring** implemented and working
- **Language configuration** improved with better folding and bracket support

## [0.0.2] - 2025-10-10

### Added
- **SeList file support** (`*_SeList.txt`) with syntax highlighting
- **Vector file support** (`vector.txt`, `VectorList.txt`, `VectorSample.txt`)
- **Per-bit binary flag visualization** with individual colors
- **Enhanced language configuration** for better editing experience

## [0.0.1] - 2025-10-10

### Added
- Initial release with basic **command file syntax highlighting** (`*_c.txt`)
- **Per-bit binary flag coloring** for two 8-bit flagsets
- **Custom color themes** (MBAA Poster variants)
- **Basic TextMate grammar** for MBAA command tables