/**
 * A cross-island singleton: module-level state two separate client entrypoints both import.
 *
 * This is the module that makes the bundling strategy observable. `counter.tsx` writes to it and
 * `total.tsx` reads from it, and they are *different* browser entrypoints. If each were compiled on
 * its own, each would get a private copy — the counter would bump its copy, the total would read
 * its own, and the page would show a total that never moves.
 *
 * It works because every island is compiled as one graph, so this module is emitted once into a
 * chunk they share. Nothing here is anchored on `globalThis`; it is a plain module-level instance,
 * which is the whole point.
 */

type Listener = () => void;

/** Click total, shared by every island on the page. */
class ClickStore {
  #total = 0;
  #listeners = new Set<Listener>();

  /** How many times any counter has been clicked. */
  get total(): number {
    return this.#total;
  }

  /** Records clicks and notifies subscribers. */
  bump(by = 1): void {
    this.#total += by;
    for (const listener of this.#listeners) listener();
  }

  /**
   * Subscribes to changes.
   *
   * @param listener Called after every {@link bump}
   * @returns A function that unsubscribes
   */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

export const clicks: ClickStore = new ClickStore();
