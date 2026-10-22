/* cMusic — rotas do backend */
import { jsonGet } from "./utils.js";

export const API = "";

export const search = (q) => jsonGet(`${API}/api/search?q=${encodeURIComponent(q)}`);
export const exploreHome = () => jsonGet(`${API}/api/explore/home`);
export const related = (videoId) => jsonGet(`${API}/api/related/${videoId}`);
export const album = (id) => jsonGet(`${API}/api/album/${id}`);
export const resolveStream = (videoId) => jsonGet(`${API}/api/stream/${videoId}`);
