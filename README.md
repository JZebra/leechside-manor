# Leechside Manor

*Paris, 1828–1832. Broussais orders thirty leeches for every patient, France buys them by the tens of
millions, and you are his house physician at the Val-de-Grâce.*

A frantic, darkly funny time-management game in the Overcooked mould, made for **Ludum Dare 60
("Old Tech")** by John Shen, using Claude AI.

Bleed each soldier just enough — into the green — then bandage the bites. Carry out the
fainted, salt the fed leeches so they can be used again, keep the hungry ones out of the drain, and
don't run over the fed ones on the floor. Three years, three shifts — and then the cholera comes.
Sign the register if your takings make the top ten.

## The three years

| Year | Ward | What happens |
|---|---|---|
| **1828** | Salle Saint-Côme, 5 beds | The craze at its height: plenty of leeches. Anemic men at noon; at three the stove is brought up and chilled men come in from the frost (warm them with a hot-water bottle before any leech will take) |
| **1831** | Salle Saint-Louis, 7 beds | Cholera in Hungary slows the leech shipments. Orderlies in the aisles, runaway leeches, Sarlandière's bdellometer at 12:30, drummer boys and nervous conscripts at three |
| **1832** | Salle Saint-Louis | The cholera in Paris: no deliveries at all, and the cold, blue men are cholera patients |

The years follow the real history: France imported about 34 million leeches in 1827 and some
57 million in 1832; cholera reached Hungary in July 1831 and Paris in spring 1832, where Broussais's
bleeding failed and leeching began its long decline.

## Playing together

Press **P** on the title page. Up to four doctors share the **Grande Salle**: twelve beds, and one
jar, one cupboard, one stove, one salt bucket and one bdellometer between you. Each doctor keeps
his own coat colour; you can run into each other (both down on the flagstones), and the takings
are shared — Broussais's verdict goes to the whole ward, and the report credits each doctor.

- **Quick match** puts you in any public room with space (or opens one).
- **A private game** gives you a four-letter code to send your friends.
- **Join with a code** takes you into a friend's room.

In the room, the host chooses the year; the doors open three seconds after everyone is ready, and
after each day's report everyone comes back to the room. More doctors bring more patients and a
bigger jar.

## Controls

| Key | |
|---|---|
| WASD / arrows | walk (hold **Shift** to run — but every fed leech underfoot is a certain slip, and running into an orderly knocks you down) |
| E / Space | take, give, apply; hold to pump the bdellometer |
| Esc | pause |
| M | mute |
| P / L / C (title page) | play together / leaderboard / credits |
| Esc (playing together) | leave the game (it carries on without you) |

## Running it

```bash
npm install
npm run dev        # http://localhost:5180
```

Testing a later year: `http://localhost:5180/?day=3&stage=epidemic&notes=0` (see [CLAUDE.md](CLAUDE.md) for all
the debug flags).

```bash
npm run server     # the multiplayer server, locally (http://localhost:8787)
npm run bots -- ABCD 3   # three bot doctors into room ABCD ("match" for quick match)
```

The dev build finds the local server by itself.

```bash
npm test           # the ward's rules, headless (Vitest)
npm run sim        # bots play every year through the real model (balance)
npm run zip        # leechside-manor-itch.zip, ready for an itch.io HTML upload
```

### Publishing the multiplayer server

The server is a Cloudflare Worker with Durable Objects (`server/`), and runs on Cloudflare's free
plan. Once, with your own Cloudflare account:

```bash
npx wrangler login
npm run server:deploy    # prints the address: https://leechside-manor.<you>.workers.dev
```

Then build the game with that address, so the itch.io copy knows where to find it:

```bash
VITE_SERVER=https://leechside-manor.<you>.workers.dev npm run zip
```

A build without `VITE_SERVER` plays alone as before, and Play together says multiplayer isn't set up.

Built with Phaser 3, TypeScript and Vite. All rules live in a pure model (`src/model/`) with no
Phaser in it; every number is in `src/config.ts`; every sprite is drawn procedurally into a
palette-locked pixel buffer (`src/art/`).

## Credits

- **Music:** "Ancient Rite" and "Vanishing", Kevin MacLeod (incompetech.com). Licensed under Creative
  Commons: By Attribution 4.0 License — http://creativecommons.org/licenses/by/4.0/
- **Sound effects (CC0):** Kenney (RPG Audio, Impact Sounds), bart, EZduzziteh, Independent.nu, sinny
  and TinyWorlds, via kenney.nl and OpenGameArt — details in [CREDITS.md](CREDITS.md)
- **Title plate:** the death of the emperor Galerius, eaten by worms. Boccaccio, *Des cas des nobles
  hommes et femmes*, Paris, 3rd quarter of the 15th century. BnF, Français 127, f. 258r.
  Source gallica.bnf.fr / BnF
- **Type:** IM Fell English (Igino Marini) and EB Garamond (Georg Duffner, Octavio Pardo), SIL Open
  Font License

## License

The **code** is MIT-licensed ([LICENSE](LICENSE)). The **assets** keep their own terms: the music is
CC BY 4.0 (credit Kevin MacLeod), the sound effects are CC0, the fonts are SIL OFL, and the title
plate is a BnF reproduction for **non-commercial** reuse with the credit "Source gallica.bnf.fr /
BnF" — so the game itself must stay free unless that image is licensed or replaced.
