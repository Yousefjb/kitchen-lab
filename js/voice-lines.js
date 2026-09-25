// Every line the game can say out loud. tools/make-voice.mjs imports this to
// know which voice clips to make, and the game uses it to match text to clips.
import { KITCHENS } from './kitchens.js';
import { PHRASES, FAIL_REACTIONS } from '../data/phrases.js';
import { CUSTOMERS } from '../data/customers.js';

// "Bear wants" / "Bunny wants": the start of a customer's order.
export const customerAsk = c => `${c.name} ${c.f ? 'تريد' : 'يريد'}`;

// Text for the speech engine: drop emoji and symbols it would read out loud.
export const speakable = s => String(s)
  .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, '')
  .replace(/[…]+/g, '، ')
  .replace(/[+=↺↻▶]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Every distinct piece of speech the game can use, in every kitchen.
export function voiceParts() {
  const out = new Set(Object.values(PHRASES));
  for (const k of Object.values(KITCHENS)) {
    Object.values(k.text).forEach(t => out.add(t));
    for (const it of Object.values(k.items)) { out.add(it.name); out.add(it.desc); }
  }
  CUSTOMERS.forEach(c => out.add(customerAsk(c)));
  FAIL_REACTIONS.forEach(r => out.add(r.text));
  return [...new Set([...out].map(speakable).filter(Boolean))];
}
