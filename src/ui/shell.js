// Assembles the static app markup from per-area partials so each workstream
// edits only its own file. `{{slot:name}}` markers resolve recursively, and
// `{{BASE}}` becomes the deployment base for local game art.
import shell from "./views/shell.html?raw";
import welcome from "./views/welcome.html?raw";
import demoBanner from "./views/demo-banner.html?raw";
import boxRail from "./views/box-rail.html?raw";
import boxHeader from "./views/box-header.html?raw";
import tabs from "./views/tabs.html?raw";
import nextPanel from "./views/next-panel.html?raw";
import history from "./views/history.html?raw";
import findPanel from "./views/find-panel.html?raw";
import xpPanel from "./views/xp-panel.html?raw";
import settingsSheet from "./views/settings-sheet.html?raw";
import settingsNext from "./views/settings-next.html?raw";
import settingsMarking from "./views/settings-marking.html?raw";
import settingsFind from "./views/settings-find.html?raw";
import settingsXp from "./views/settings-xp.html?raw";
import saveMenu from "./views/save-menu.html?raw";
import helpSheet from "./views/help-sheet.html?raw";

export const PARTIALS = {
  welcome,
  "demo-banner": demoBanner,
  "box-rail": boxRail,
  "box-header": boxHeader,
  tabs,
  "next-panel": nextPanel,
  history,
  "find-panel": findPanel,
  "xp-panel": xpPanel,
  "settings-sheet": settingsSheet,
  "settings-next": settingsNext,
  "settings-marking": settingsMarking,
  "settings-find": settingsFind,
  "settings-xp": settingsXp,
  "save-menu": saveMenu,
  "help-sheet": helpSheet,
};

const SLOT = /\{\{slot:([a-z-]+)\}\}/g;

function fill(template, partials, seen) {
  return template.replace(SLOT, (_, name) => {
    if (!Object.hasOwn(partials, name)) throw new Error(`Unknown shell slot: ${name}`);
    if (seen.includes(name)) throw new Error(`Recursive shell slot: ${name}`);
    return fill(partials[name], partials, [...seen, name]);
  });
}

export function shellMarkup(base = import.meta.env.BASE_URL, partials = PARTIALS, root = shell) {
  return fill(root, partials, []).replaceAll("{{BASE}}", base);
}

export function mountShell(root) {
  root.innerHTML = shellMarkup();
  return root;
}
