import { describe, it, expect } from 'vitest';
import { Book, ceiling, TICKET, BOARD_SIZE } from '../src/net/board';
import { CONFIG } from '../src/config';

const T0 = Date.parse('2026-11-18T12:00:00Z');
const after = (day: number) => T0 + CONFIG.days[day].realSeconds * 1000; // a whole day later

// A day worked and signed: start, then sign once the day could have been worked.
function signed(book: Book, day: number, money: number, name = 'Sangrado', id = `t${Math.random()}`) {
  book.start(day, 'someone', id, T0);
  return book.sign(id, name, money, after(day));
}

describe('the online register', () => {
  it('no day earns more than every man who comes in, bled just right', () => {
    expect(CONFIG.days.map((_, d) => ceiling(d))).toEqual([180, 240, 228]);
  });

  it('signs a day worked: the place, the server’s own verdict and date, the name cleaned', () => {
    const book = new Book();
    const r = signed(book, 0, 120, '  <Dr. Sangrado>!! ');
    expect(r).toEqual({ place: 0, entry: { name: 'Dr. Sangrado', money: 120, verdict: 'APPROVED', date: '2026-11-18' } });
    expect(signed(book, 0, 70)).toMatchObject({ place: 1, entry: { verdict: 'NOTED' } });
    expect(signed(book, 0, 120)).toMatchObject({ place: 1 }); // a tie goes below
    expect(book.board().years['1828'].map((e) => e.money)).toEqual([120, 120, 70]);
    expect(signed(book, 0, 0)).toMatchObject({ place: -1 }); // no takings, no place
    expect(signed(book, 0, 30, '')).toMatchObject({ entry: { name: 'Anonymous', verdict: 'REPRIMAND' } });
  });

  it('keeps ten for each year', () => {
    const book = new Book();
    for (let i = 1; i <= 12; i++) signed(book, 1, i * 10);
    const list = book.board().years['1831'];
    expect(list).toHaveLength(BOARD_SIZE);
    expect(list[0].money).toBe(120);
    expect(signed(book, 1, 25)).toMatchObject({ place: -1 });
    expect(book.board().years['1828']).toEqual([]);
  });

  it('refuses takings no day could earn', () => {
    const book = new Book();
    expect(signed(book, 0, 181)).toEqual({ error: 'money' });
    expect(signed(book, 1, 240)).toMatchObject({ place: 0 });
    expect(signed(book, 2, 12.5)).toEqual({ error: 'money' });
    expect(signed(book, 2, Number.NaN)).toEqual({ error: 'money' });
  });

  it('a ticket is good once, for one day, and not before the day could have been worked', () => {
    const book = new Book();
    expect(book.start(3, 'a', 'x', T0)).toBeNull(); // no fourth year
    expect(book.start(0.5, 'a', 'x', T0)).toBeNull();
    book.start(0, 'a', 'early', T0);
    expect(book.sign('early', 'n', 50, T0 + 60_000)).toEqual({ error: 'early' });
    expect(book.sign('early', 'n', 50, after(0))).toEqual({ error: 'ticket' }); // spent on the refusal
    book.start(0, 'a', 'once', T0);
    expect(book.sign('once', 'n', 50, after(0) - TICKET.slack * 1000)).toMatchObject({ place: 0 }); // the network's slack
    expect(book.sign('once', 'n', 50, after(0))).toEqual({ error: 'ticket' });
    expect(book.sign('made-up', 'n', 50, after(0))).toEqual({ error: 'ticket' });
  });

  it('tickets go stale, and one address holds only a few', () => {
    const book = new Book();
    book.start(0, 'a', 'stale', T0);
    expect(book.sign('stale', 'n', 50, T0 + TICKET.life * 1000 + 1)).toEqual({ error: 'ticket' });
    for (let i = 0; i <= TICKET.perPlayer; i++) book.start(1, 'a', `a${i}`, T0 + i);
    book.start(1, 'b', 'b0', T0);
    expect(book.state.tickets.filter((t) => t.who === 'a').map((t) => t.id)).toEqual(['a1', 'a2', 'a3']); // the oldest dropped
    expect(book.sign('a0', 'n', 50, after(1))).toEqual({ error: 'ticket' });
    expect(book.sign('b0', 'n', 50, after(1))).toMatchObject({ place: 0 }); // someone else's is untouched
  });

  it('never holds more than so many tickets in all', () => {
    const book = new Book();
    for (let i = 0; i < TICKET.total + 20; i++) book.start(0, `who${i}`, `t${i}`, T0);
    expect(book.state.tickets).toHaveLength(TICKET.total);
    expect(book.state.tickets[0].id).toBe('t20');
  });

  it('the admin strikes out an entry; the book survives being stored and read back', () => {
    const book = new Book();
    signed(book, 2, 90, 'Rude');
    signed(book, 2, 60, 'Fine');
    expect(book.remove(1832, 5)).toBeNull();
    expect(book.remove(1999, 0)).toBeNull();
    expect(book.remove(1832, 0)).toMatchObject({ name: 'Rude' });
    const again = new Book(JSON.parse(JSON.stringify(book.state)));
    expect(again.board().years['1832'].map((e) => e.name)).toEqual(['Fine']);
    expect(new Book(null).board().years['1828']).toEqual([]);
    expect(new Book({ years: { '1828': [{ junk: true }] } as never }).board().years['1828']).toEqual([]);
  });
});
