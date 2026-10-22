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
};
