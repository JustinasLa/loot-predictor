// Entry point: mount the shell, then let each area wire its own controls.
import "@fontsource-variable/baloo-2";
import { mountShell } from "./ui/shell.js";
import { initChrome } from "./app/chrome.js";
import { initNavigation } from "./app/navigation.js";
import { initSession, startSession } from "./app/session.js";
import { initPredict } from "./app/predict.js";
import { initMarking } from "./app/marking.js";
import { initSaveMenu } from "./app/save-menu.js";
import { initFind } from "./app/find.js";
import { initXpPlanner } from "./app/xp-planner.js";
import { initSettings } from "./app/settings.js";
import { initHelp } from "./app/help.js";

mountShell(document.getElementById("app-root"));
initChrome();
initNavigation();
initSession();
initPredict();
initMarking();
initSaveMenu();
initFind();
initXpPlanner();
initSettings();
initHelp();
startSession();
