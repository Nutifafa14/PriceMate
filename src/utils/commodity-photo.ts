/**
 * Real, properly-licensed commodity photos from Wikimedia Commons — see
 * assets/commodities/ATTRIBUTION.json for the source/license/artist of
 * every file, and data/scripts/06_fetch_commodity_photos.py for how they
 * were sourced. Metro requires static, literal `require()` calls (no
 * dynamic paths), hence the explicit map below rather than building a path
 * from the commodity name at runtime.
 */
const COMMODITY_PHOTOS: Record<string, number> = {
  Cassava: require("../../assets/commodities/cassava.jpg"),
  Cowpeas: require("../../assets/commodities/cowpeas.jpg"),
  "Cowpeas (white)": require("../../assets/commodities/cowpeas-white.jpg"),
  Eggplants: require("../../assets/commodities/eggplants.jpg"),
  Eggs: require("../../assets/commodities/eggs.jpg"),
  "Fish (mackerel, fresh)": require("../../assets/commodities/fish-mackerel-fresh.jpg"),
  Gari: require("../../assets/commodities/gari.jpg"),
  Maize: require("../../assets/commodities/maize.jpg"),
  "Maize (yellow)": require("../../assets/commodities/maize-yellow.jpg"),
  "Meat (chicken)": require("../../assets/commodities/meat-chicken.jpg"),
  "Meat (chicken, local)": require("../../assets/commodities/meat-chicken-local.jpg"),
  Millet: require("../../assets/commodities/millet.jpg"),
  Onions: require("../../assets/commodities/onions.jpg"),
  "Peppers (dried)": require("../../assets/commodities/peppers-dried.jpg"),
  "Peppers (fresh)": require("../../assets/commodities/peppers-fresh.jpg"),
  "Plantains (apem)": require("../../assets/commodities/plantains-apem.jpg"),
  "Plantains (apentu)": require("../../assets/commodities/plantains-apentu.jpg"),
  "Rice (imported)": require("../../assets/commodities/rice-imported.jpg"),
  "Rice (local)": require("../../assets/commodities/rice-local.jpg"),
  "Rice (paddy)": require("../../assets/commodities/rice-paddy.jpg"),
  Sorghum: require("../../assets/commodities/sorghum.jpg"),
  Soybeans: require("../../assets/commodities/soybeans.jpg"),
  "Tomatoes (local)": require("../../assets/commodities/tomatoes-local.jpg"),
  "Tomatoes (navrongo)": require("../../assets/commodities/tomatoes-navrongo.jpg"),
  Yam: require("../../assets/commodities/yam.jpg"),
  "Yam (puna)": require("../../assets/commodities/yam-puna.jpg"),
};

/** Returns the bundled photo for a commodity, or undefined if none exists — callers must fall back to the category icon in that case. */
export function commodityPhoto(commodityName: string): number | undefined {
  return COMMODITY_PHOTOS[commodityName];
}
