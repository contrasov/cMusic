/* cMusic — rotas do backend */
import { jsonGet } from "./utils.js";

export const API = "";

export const search = (q, { songs = 20, albums = 10, playlists = 10 } = {}) => {
  const p = new URLSearchParams({ q, songs_lim: songs, albums_lim: albums, playlists_lim: playlists });
  return jsonGet(`${API}/api/search?${p}`);
};
export const exploreHome = () => jsonGet(`${API}/api/explore/home`);
export const related = (videoId, limit = 20) => jsonGet(`${API}/api/related/${videoId}?limit=${limit}`);
export const album = (id) => jsonGet(`${API}/api/album/${id}`);
export const resolveStream = (videoId) => jsonGet(`${API}/api/stream/${videoId}`);
