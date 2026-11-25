/** What `bundle.js` puts on the window. */
interface Window {
  House: {
    start(): void;
    theme(name: "light" | "dark" | "auto", from?: Element): void;
    morph(change: () => void, kind?: string): unknown;
    openSheet(dialog: HTMLDialogElement): (after?: () => void) => void;
    openMenu(menu: HTMLElement, button: HTMLElement): void;
    glideTo(marker: HTMLElement, row?: HTMLElement): void;
    meter(bar: HTMLElement, value: number): void;
    edge(el?: HTMLElement): void;
    leave(el: HTMLElement): void;
  };
}
