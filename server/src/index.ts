import app from "./app";
import { getPort } from "./lib/config";

const port = getPort(3000);

export default {
  port,
  fetch: app.fetch,
};
