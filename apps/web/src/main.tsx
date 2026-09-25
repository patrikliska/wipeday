import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installDebug } from "./debug";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/hud.css";

installDebug();

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

// Canvas text (floating numbers) needs the font ready before the first frame.
Promise.all([
  document.fonts.load('400 16px "Roboto Condensed"'),
  document.fonts.load('700 16px "Roboto Condensed"'),
])
  .catch(() => undefined)
  .finally(() => {
    createRoot(root).render(<App />);
  });
