/* cMusic — estado mutável da aplicação */
export const state = {
  queue: [],
  current: -1,
  shuffle: false,
  shuffleBag: [],
  repeat: "off", // off | all | one
  seeking: false,
  loadingId: null,
  lastPlayed: localStorage.getItem("cmusic_last") || null,
  collectionsCache: null,
  currentViewData: [],
  searchCache: null,
  searchTab: "songs",
  searchQ: "",
  searchLimits: { songs: 20, albums: 10, playlists: 10 }, // limites ativos de "carregar mais"
  relatedLimit: 20,
  relatedCache: null,
  /* mix infinito: quando passa da metade, a fila se auto-completa */
  infiniteMix: localStorage.getItem("cmusic_infinite") !== "off",
  fillSeeds: new Set(), // videoIds já usados como semente do autofill
};
