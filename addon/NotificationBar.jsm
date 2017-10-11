  /* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

const DEBUG_MODE_PREF = "extensions.focused_cfr_debug_mode";

const log = function(...args) {
  if (!Preferences.get(DEBUG_MODE_PREF)) return;
  console.log(...args);
};

XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow", "resource:///modules/RecentWindow.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Preferences", "resource://gre/modules/Preferences.jsm");

const MESSAGES = [
  "FocusedCFR::log",
  "FocusedCFR::openUrl",
  "FocusedCFR::dismiss",
  "FocusedCFR::close",
  "FocusedCFR::action",
  "FocusedCFR::timeout",
];

this.EXPORTED_SYMBOLS = ["NotificationBar"];

// Due to bug 1051238 frame scripts are cached forever, so we can't update them
// as a restartless add-on. The Math.random() is the work around for this.
const FRAME_SCRIPT = (
  `resource://focused-cfr-shield-study-content/notificationbar/notificationBar.js?${Math.random()}`
);

function getMostRecentBrowserWindow() {
  return RecentWindow.getMostRecentBrowserWindow({
    private: false,
    allowPopups: false,
  });
}


class NotificationBar {
  constructor(recommRecipe, messageListenerCallback) {
    this.recommRecipe = recommRecipe;
    this.messageListenerCallback = messageListenerCallback;
  }

  present() {
    log("presenting notification bar");
    this.show(getMostRecentBrowserWindow());
  }

  show(win) {
    let box = win.document.getElementById("focused-cfr-notificationbar-box");

    if (box !== null) {
      this.killNotification();
    }

    box = win.document.createElement("hbox");
    box.setAttribute("id", "focused-cfr-notificationbar-box");
    box.style.height = "56px";

    const embeddedBrowser = win.document.createElement("browser");
    embeddedBrowser.setAttribute("id", "focused-cfr-notificationbar");
    embeddedBrowser.setAttribute("src", "resource://focused-cfr-shield-study-content/notificationbar/notificationBar.html");
    embeddedBrowser.setAttribute("type", "content");
    embeddedBrowser.setAttribute("disableglobalhistory", "true");
    embeddedBrowser.setAttribute("flex", "1");

    box.appendChild(embeddedBrowser);
    const content = win.document.getElementById("appcontent");
    content.insertBefore(box, content.childNodes[0]);

    // seems that messageManager only available when browser is attached
    embeddedBrowser.messageManager.loadFrameScript(FRAME_SCRIPT, false);

    for (const m of MESSAGES) {
      embeddedBrowser.messageManager.addMessageListener(m, this);
    }

    embeddedBrowser.messageManager.sendAsyncMessage("FocusedCFR::load", this.recommRecipe);
  }

  killNotification() {
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    log("killing notification");

    while (windowEnumerator.hasMoreElements()) {
      const win = windowEnumerator.getNext();
      const box = win.document.getElementById("focused-cfr-notificationbar-box");
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
        this.killNotification();
        this.messageListenerCallback(message);
        break;

      case "FocusedCFR::action":
        this.killNotification();
        this.messageListenerCallback(message);
        break;

      case "FocusedCFR::close":
        this.killNotification();
        this.messageListenerCallback(message);
        break;

      case "FocusedCFR::timeout":
        this.killNotification();
        this.messageListenerCallback(message);
        break;

      default:
        this.messageListenerCallback(message);

    }
  }

  shutdown() {
    this.killNotification();
  }
}
