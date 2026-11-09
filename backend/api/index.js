// Vercel serverless entry: the whole Express app runs as one function.
// `npm run build` compiles TypeScript to dist/ before functions are bundled.
import { createApp } from "../dist/src/app.js";

export default createApp();
