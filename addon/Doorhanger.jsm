  /* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow", "resource:///modules/RecentWindow.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Preferences", "resource://gre/modules/Preferences.jsm");

const DEBUG_MODE_PREF = "extensions.focused_cfr_debug_mode";

const log = function(...args) {
  if (!Preferences.get(DEBUG_MODE_PREF)) return;
  console.log(...args);
};

let panel;

const MESSAGES = [
  "FocusedCFR::log",
  "FocusedCFR::openUrl",
  "FocusedCFR::dismiss",
  "FocusedCFR::close",
  "FocusedCFR::action",
  "FocusedCFR::timeout",
  "FocusedCFR::resize"
];

this.EXPORTED_SYMBOLS = ["Doorhanger"];

// Due to bug 1051238 frame scripts are cached forever, so we can't update them
// as a restartless add-on. The Math.random() is the work around for this.
const FRAME_SCRIPT = (
  `resource://focused-cfr-shield-study-content/doorhanger/doorhanger.js?${Math.random()}`
);

function getMostRecentBrowserWindow() {
  return RecentWindow.getMostRecentBrowserWindow({
    private: false,
    allowPopups: false,
  });
}

class Doorhanger {
  constructor(recommRecipe, messageListenerCallback) {
    this.recommRecipe = recommRecipe;
    this.messageListenerCallback = messageListenerCallback;
  }

  present() {
    log("presenting doorhanger");
    this.show(getMostRecentBrowserWindow());
  }

  show(win) {
    panel = win.document.getElementById("focused-cfr-doorhanger-panel");

    const popAnchor = this.determineAnchorElement(win);

    if (panel !== null) {
      this.killNotification();
    }

    panel = win.document.createElement("panel");
    panel.setAttribute("id", "focused-cfr-doorhanger-panel");
    panel.setAttribute("class", "no-padding-panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautofocus", true);
    panel.setAttribute("noautohide", true);
    panel.setAttribute("level", "parent");

    if (Services.appinfo.OS === "Darwin"){
	    panel.style.height = "183px";
	    panel.style.width = "353px";
	  } else {
		  panel.style.height = "187px";
		  panel.style.width = "360px";
	  }

    const embeddedBrowser = win.document.createElement("browser");
    embeddedBrowser.setAttribute("id", "focused-cfr-doorhanger");
    embeddedBrowser.setAttribute("src", "resource://focused-cfr-shield-study-content/doorhanger/doorhanger.html");
    embeddedBrowser.setAttribute("type", "content");
    embeddedBrowser.setAttribute("disableglobalhistory", "true");
    embeddedBrowser.setAttribute("flex", "1");

    panel.appendChild(embeddedBrowser);
    win.document.getElementById("mainPopupSet").appendChild(panel);

    win.document.getAnonymousElementByAttribute(panel, "class", "panel-arrowcontent").setAttribute("style", "padding: 0px;");

    // seems that messageManager only available when browser is attached
    embeddedBrowser.messageManager.loadFrameScript(FRAME_SCRIPT, false);

    for (const m of MESSAGES) {
      embeddedBrowser.messageManager.addMessageListener(m, this);
    }

    panel.openPopup(popAnchor, "", 0, 0, false, false);

    embeddedBrowser.messageManager.sendAsyncMessage("FocusedCFR::load", this.recommRecipe);
  }

  // temporary workaround
  determineAnchorElement(win) {
    const id = this.recommRecipe.id;

    const burgerButton = win.document.getElementById("PanelUI-menu-button");
    let popAnchor = burgerButton;

    if (id === "pocket") {
      const pocketButton = win.document.getElementById("pocket-button-box");
      if (pocketButton && win.getComputedStyle(pocketButton).display !== "none") {
        popAnchor = pocketButton;
      }
    }

    if (id === "amazon-assistant") {
      const urlBar = win.document.getElementById("urlbar");
      if (urlBar) {
        popAnchor = urlBar;
      }
    }

    return popAnchor;
  }

  killNotification() {
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    log("killing notification");

    while (windowEnumerator.hasMoreElements()) {
      const win = windowEnumerator.getNext();
      const box = win.document.getElementById("focused-cfr-doorhanger-panel");
      if (box) {
        box.remove();
      }
    }
  }


  // makes sure all the async messages are received by Recommender.jsm first
  killNotificationWithDelay(delay) {
    setTimeout(this.killNotification, delay);
  }

  receiveMessage(message) {
    switch (message.name) {
      case "FocusedCFR::log":
        log(message.data);
        break;

      case "FocusedCFR::dismiss":
        this.killNotificationWithDelay(0);
        this.messageListenerCallback(message);
        break;

      case "FocusedCFR::action":
        this.killNotificationWithDelay(0);
        this.messageListenerCallback(message);
        break;

      case "FocusedCFR::close":
        this.killNotificationWithDelay(0);
        this.messageListenerCallback(message);
        break;

      case "FocusedCFR::timeout":
        this.killNotification();
        this.messageListenerCallback(message);
        break;

      case "FocusedCFR::resize":
        log('updating panel size to :', message.data);
        panel.sizeTo(message.data.width+3, message.data.height+21)

      default:
        this.messageListenerCallback(message);
    }
  }

  shutdown() {
    this.killNotification();
  }
}
