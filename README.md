# buddy-reroll

Reroll your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `/buddy` companion to any species, rarity, eye, hat, and shiny combination.

<img width="1390" height="1010" alt="CleanShot 2026-04-02 at 19 53 02@2x" src="https://github.com/user-attachments/assets/0786f4b8-35e2-4433-90af-25a0d9ebe1a9" />

<p align="center" width="100%">
<video src="https://github.com/user-attachments/assets/5de52c98-ce3c-428f-bd2d-7f208e1a6d38" width="80%" controls></video>
</p>


## Install

```bash
bun install -g buddy-reroll
```

## Usage

```bash
# Interactive mode (recommended)
buddy-reroll

# Non-interactive
buddy-reroll --species dragon --rarity legendary --eye ✦ --hat propeller --shiny

# Partial spec (unspecified fields are left random)
buddy-reroll --species cat --rarity epic

# Show current companion
buddy-reroll --current

# Restore original binary
buddy-reroll --restore
```

## Options

| Flag | Values |
|---|---|
| `--species` | duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk |
| `--rarity` | common, uncommon, rare, epic, legendary |
| `--eye` | `·` `✦` `×` `◉` `@` `°` |
| `--hat` | none, crown, tophat, propeller, halo, wizard, beanie, tinyduck |
| `--shiny` | `--shiny` / `--no-shiny` |

## Requirements

- [Bun](https://bun.sh) (uses `Bun.hash()` to match Claude Code's internal hashing)
- Claude Code

## License

MIT
