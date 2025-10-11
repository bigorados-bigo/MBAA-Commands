
# MBAA Commands (`*_c.txt`) — VS Code Syntax

Syntax highlighting + scopes for **Melty Blood Actress Again** command tables (`*_c.txt`).
Includes per-section colors (ID, command, two flagsets, pattern ID, meter, variables) and per-bit scopes **A..H** (Flagset 1) and **I..P** (Flagset 2). Optional hover tooltips decode each bit.

## Features

- Automatic language mode for files matching `*_c.txt`.
- Command column accepts wide inputs: `236A`, `6+C`, `0V9`, `V+D`, `A+B+C+D`, `41236C`, etc.
- Two 8-bit flagsets captured **bit-by-bit** for custom coloring:
  - `constant.numeric.binary.flagset1.bit.a.mbaa … .h`
  - `constant.numeric.binary.flagset2.bit.i.mbaa … .p`
- Section scopes for theme rules:
  - `constant.numeric.id.mbaa`, `constant.language.motion.mbaa`,
    `constant.numeric.pattern-id.mbaa`, `constant.numeric.meter.mbaa`,
    `variable.other.assist.mbaa`, `variable.other.projectile.mbaa`,
    `variable.other.dash.mbaa`.

## Usage

![Bits Guide](https://github.com/bigorados-bigo/MBAA-Commands/blob/main/HanteiBits.png?raw=true)


Open any `_c.txt`. Status bar should show **MBAA Commands**.
To force associate:

```json
"files.associations": { "*_c.txt": "mbaa-cmd" }
```
