import app from "./app.js";
import { getPort } from "./lib/config.js";

const port = getPort(3000);

export default {
  port,
  fetch: app.fetch,
};
