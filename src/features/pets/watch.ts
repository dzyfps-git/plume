import { onPets } from "../../live/store";
import { change } from "../../store";
import { hear } from "./logic";

/** Keeps what the game says of your pets. */
export function followPets() {
  onPets((said) =>
    change((s) => {
      Object.assign(s.pets, hear(s.pets, said));
      if (said.what === "all") s.pets.told = Date.now();
    }, true),
  );
}
