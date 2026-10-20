# Leechside Manor

*Paris, 1828–1832. Broussais orders thirty leeches for every patient, France buys them by the tens of
millions, and you are his house physician at the Val-de-Grâce.*

A frantic, darkly funny time-management game in the Overcooked mould, made for **Ludum Dare 60
("Old Tech")** by John Shen, using Claude AI.

Bleed each soldier just enough — into the green — then press lint on the bites. Carry out the
fainted, salt the fed leeches so they can be used again, keep the hungry ones out of the drain, and
mind your footing: fed leeches are slippery. Three years, three shifts — and then the cholera comes.

## The three years

| Year | Ward | What happens |
|---|---|---|
| **1828** | Salle Saint-Côme, 5 beds | The craze at its height: plenty of leeches. Anaemic men at noon; at three the stove is brought up and chilled men come in from the frost (warm them with a hot-water bottle before any leech will take) |
| **1831** | Salle Saint-Louis, 7 beds | Cholera in Hungary slows the leech shipments. Orderlies in the aisles, runaway leeches, Sarlandière's bdellometer at 12:30, drummer boys and nervous conscripts at three |
| **1832** | Salle Saint-Louis | The cholera in Paris: no deliveries at all, and the cold, blue men are cholera patients |

The years follow the real history: France imported about 34 million leeches in 1827 and some
57 million in 1832; cholera reached Hungary in July 1831 and Paris in spring 1832, where Broussais's
bleeding failed and leeching began its long decline.

## Controls

| Key | |
|---|---|
| WASD / arrows | walk (hold **Shift** to run — but every fed leech underfoot is a certain slip, and running into an orderly knocks you down) |
| E / Space | take, give, apply; hold to pump the bdellometer |
| Esc | pause |
| M | mute |
| C (title page) | credits |

## Running it

```bash
npm install
npm run dev        # http://localhost:5180
```

Testing a later year: `http://localhost:5180/?day=3&stage=epidemic&notes=0` (see [CLAUDE.md](CLAUDE.md) for all
the debug flags).

```bash
npm test           # the ward's rules, headless (Vitest)
npm run sim        # bots play every year through the real model (balance)
npm run zip        # leechside-manor-itch.zip, ready for an itch.io HTML upload
```

Built with Phaser 3, TypeScript and Vite. All rules live in a pure model (`src/model/`) with no
Phaser in it; every number is in `src/config.ts`; every sprite is drawn procedurally into a
palette-locked pixel buffer (`src/art/`).

## Credits

- **Music:** "Ancient Rite" and "Vanishing", Kevin MacLeod (incompetech.com). Licensed under Creative
  Commons: By Attribution 4.0 License — http://creativecommons.org/licenses/by/4.0/
- **Sound effects (CC0):** Kenney (RPG Audio), Fantozzi, bart, EZduzziteh, Independent.nu, sinny and
  TinyWorlds, via kenney.nl and OpenGameArt — details in [CREDITS.md](CREDITS.md)
- **Title plate:** the death of the emperor Galerius, eaten by worms. Boccaccio, *Des cas des nobles
  hommes et femmes*, Paris, 3rd quarter of the 15th century. BnF, Français 127, f. 258r.
  Source gallica.bnf.fr / BnF
- **Type:** IM Fell English (Igino Marini) and EB Garamond (Georg Duffner, Octavio Pardo), SIL Open
  Font License

## Licence

The **code** is MIT-licensed ([LICENSE](LICENSE)). The **assets** keep their own terms: the music is
CC BY 4.0 (credit Kevin MacLeod), the sound effects are CC0, the fonts are SIL OFL, and the title
plate is a BnF reproduction for **non-commercial** reuse with the credit "Source gallica.bnf.fr /
BnF" — so the game itself must stay free unless that image is licensed or replaced.
