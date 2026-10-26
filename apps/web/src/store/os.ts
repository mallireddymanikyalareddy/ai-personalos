import { PersonalOS } from "@personalos/core";

let instance: PersonalOS | null = null;

export function getOS(): PersonalOS {
  if (!instance) {
    instance = new PersonalOS();
    instance.seedGamificationCatalog();
  }
  return instance;
}
