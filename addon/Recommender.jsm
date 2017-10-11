  /* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Storage", "resource://focused-cfr-shield-study/Storage.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Doorhanger", "resource://focused-cfr-shield-study/Doorhanger.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "NotificationBar", "resource://focused-cfr-shield-study/NotificationBar.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Preferences", "resource://gre/modules/Preferences.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Bookmarks", "resource://gre/modules/Bookmarks.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow", "resource:///modules/RecentWindow.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "AddonManager", "resource://gre/modules/AddonManager.jsm");

const bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                      .getService(Components.interfaces.nsINavBookmarksService);

let notificationBar;
let doorhanger;

const AMAZON_AFFILIATIONS = [
  "www.amazon.com",
  "www.amazon.ca",
  "www.amazon.co.uk",
  "www.audible.com",
  "www.audible.ca",
  "www.audible.co.uk",
];

const PAGE_VISIT_GAP_MINUTES = 15;
const NOTIFICATION_GAP_MINUTES = 24 * 60;
const MAX_NUMBER_OF_NOTIFICATIONS = 3;

const NOTIFICATION_GAP_PREF = "extensions.focused_cfr_study.notification_gap_minutes";
const MAX_NUMBER_OF_NOTIFICATIONS_PREF = "extensions.focused_cfr_study.max_number_of_notifications";
const INIT_PREF = "extensions.focused_cfr_study.initialized";
const POCKET_BOOKMARK_COUNT_PREF = "extensions.focused_cfr_study.pocket_bookmark_count_threshold";
const AMAZON_COUNT_PREF = "extensions.focused_cfr_study.amazon_count_threshold";
const PAGE_VISIT_GAP_PREF = "extensions.focused_cfr_study.page_visit_gap_minutes";
const DEBUG_MODE_PREF = "extensions.focused_cfr_study.debug_mode";

const POCKET_BOOKMARK_COUNT_TRHESHOLD = 20;
const AMAZON_VISIT_THRESHOLD = 3;

const AMAZON_LINK = "www.amazon.com/gp/BIT/ref=bit_v2_BDFF1?tagbase=mozilla1";
const AMAZON_ADDON_ID = "abb@amazon.com";

this.EXPORTED_SYMBOLS = ["Recommender"];

const log = function(...args) {
  if (!Preferences.get(DEBUG_MODE_PREF)) return;
  console.log(...args);
};

let bookmarkObserver;
let currentId;
let windowListener;
let addonListener;

const recipes = {
  "amazon-assistant": {
    id: "amazon-assistant",
    message: {
      text: `Instant product matches while you shop across the web with Amazon Assistant`,
      link: {
        text: "Amazon Assistant",
        url: `${AMAZON_LINK}`,
      },
    },
    primaryButton: {
      label: `Add to Firefox`,
      url: `${AMAZON_LINK}`,
    },
    icon: {
      url: "resource://focused-cfr-shield-study-content/images/amazon-assistant.png",
      alt: "Amazon Assistant logo",
    },
  },
  "mobile-promo": {
    id: "mobile-promo",
    message: {
      text: `Your Firefox account meets your phone. They fall in love. Get Firefox on your phone now.`,
      link: {},
    },
    primaryButton: {
      label: "Make a match",
      url: `https://www.mozilla.org/en-US/firefox/mobile-download/desktop/`,
    },
    icon: {
      url: "resource://focused-cfr-shield-study-content/images/mobile-promo.png",
      alt: "Firefox Mobile logo",
    },
  },
  "pocket": {
    id: "pocket",
    message: {
      text: "Pocket lets you save for later articles, videos, or pretty much anything!",
      link: {
        text: "Pocket",
        url: "https://getpocket.com/firefox/",
      },
    },
    primaryButton: {
      label: "Try it Now",
      url: "http://www.getpocket.com/firefox_tryitnow",
    },
    icon: {
      url: "resource://focused-cfr-shield-study-content/images/pocket.png",
      alt: "Pocket Logo",
    },
  },
};

function getMostRecentBrowserWindow() {
  return RecentWindow.getMostRecentBrowserWindow({
    private: false,
    allowPopups: false,
  });
}

class Recommender {
  constructor(telemetry, variation) {
    this.telemetry = telemetry;
    this.variation = variation.name;
    this.variationUi = variation.ui;
    this.variationAmazon = variation.amazon;
  }

  test() {
    // currentId = "pocket";
    // (new Doorhanger(recipes[currentId], this.presentationMessageListener.bind(this))).present();
    setInterval(() => Utils.printStorage(), 10000);
  }

  async start() {
    const isFirstRun = !(await Storage.has("general"));
    if (isFirstRun)
      await this.firstRun();

    Utils.printStorage();

    await this.listenForMobilePromoTrigger();
    await this.listenForPageViews();
    await this.listenForBookmarks();
    await this.listenForAddonInstalls();

    await this.reportSummary();
  }

  async firstRun() {
    log("first run");

    await this.initRecommendations();
    await this.initLogs();

    await Storage.set("general", {
      started: true,
      lastNotification: (new Date(0)).getTime(),
    });

    log("setting prefs");

    Preferences.set(NOTIFICATION_GAP_PREF, NOTIFICATION_GAP_MINUTES);
    Preferences.set(MAX_NUMBER_OF_NOTIFICATIONS_PREF, MAX_NUMBER_OF_NOTIFICATIONS);
    Preferences.set(POCKET_BOOKMARK_COUNT_PREF, POCKET_BOOKMARK_COUNT_TRHESHOLD);
    if (this.variationAmazon === "high")
      Preferences.set(AMAZON_COUNT_PREF, AMAZON_VISIT_THRESHOLD);
    else
      Preferences.set(AMAZON_COUNT_PREF, AMAZON_VISIT_THRESHOLD * 2);
    Preferences.set(PAGE_VISIT_GAP_PREF, PAGE_VISIT_GAP_MINUTES);
    Preferences.set(DEBUG_MODE_PREF, false);

    Preferences.set(INIT_PREF, true);

    this.checkForAmazonPreuse();
  }

  async reportSummary() {
    const logs = await Storage.get("logs");
    let data = {
      "message_type": "summary_log",
      "variation": this.variation,
      "variation_ui": this.variationUi,
      "variation_amazon": this.variationAmazon,
    };

    data = Object.assign({}, data, logs);
    log(`summary report`, data);
    this.telemetry(data);
  }

  async reportEvent(id, event) {
    const data = {
      "message_type": "event",
      "variation": this.variation,
      "variation_ui": this.variationUi,
      "variation_amazon": this.variationAmazon,
      "id": id,
      "event": event,
    };
    log(`event report:`, data);
    this.telemetry(data);
  }

  async reportNotificationResult(result) {
    const recomm = await Storage.get(`recomms.${currentId}`);

    const data = {
      "message_type": "notification_result",
      "variation": this.variation,
      "variation_ui": this.variationUi,
      "variation_amazon": this.variationAmazon,
      "count": String(recomm.presentation.count),
      "status": recomm.status,
      "id": currentId,
      "result": result,
    };

    log("notification result: ", data);

    Utils.printStorage();
    this.telemetry(data);
  }

  async updateLog(attribute, value) {
    const obj = {};
    obj[attribute] = String(value);
    return Storage.update("logs", obj);
  }

  async updateLogWithId(id, attribute, value) {
    return this.updateLog(`${id}_${attribute}`, value);
  }

  async initLogs() {
    const logs = {
      "amazon_delivered": "false",
      "amazon_action": "false",
      "amazon_close": "false",
      "amazon_dismiss": "false",
      "amazon_nevershow": "false",
      "amazon_timeout": "false",
      "mobile-promo_delivered": "false",
      "mobile-promo_action": "false",
      "mobile-promo_close": "false",
      "mobile-promo_dismiss": "false",
      "mobile-promo_nevershow": "false",
      "mobile-promo_timeout": "false",
      "pocket_delivered": "false",
      "pocket_action": "false",
      "pocket_close": "false",
      "pocket_dismiss": "false",
      "pocket_nevershow": "false",
      "pocket_timeout": "false",
    };

    await Storage.set("logs", logs);
  }

  async initRecommendations() {
    const mobilePromo = {
      id: "mobile-promo",
      status: "waiting",
      presentation: {
        count: 0,
        never: false,
      },
    };

    const amazonAssistant = {
      id: "amazon-assistant",
      status: "waiting",
      presentation: {
        count: 0,
        never: false,
      },
      trigger: {
        visitCount: 0,
        lastVisit: (new Date(0)).getTime(),
      },
    };

    const pocket = {
      id: "pocket",
      status: "waiting",
      presentation: {
        count: 0,
        never: false,
      },
    };

    const recomms = {ids: ["mobile-promo", "amazon-assistant", "pocket"]};
    await Storage.set("recomms", recomms);
    await Storage.set("recomms.mobile-promo", mobilePromo);
    await Storage.set("recomms.amazon-assistant", amazonAssistant);
    await Storage.set("recomms.pocket", pocket);
  }

  async checkForAmazonPreuse() {
    const addon = await AddonManager.getAddonByID(AMAZON_ADDON_ID);

    if (!addon) {
      log(`no Amazon preuse`);
      return;
    }

    // preuse
    const recomm = await Storage.get("recomms.amazon-assistant");
    recomm.status = "preused";
    log("amazon preused");
    this.reportEvent("amazon-assistant", "preused");
    await Storage.update("recomms.amazon-assistant", recomm);
  }

  listenForAddonInstalls() {

    const that = this;

    addonListener = {
      async onInstalled(addon) {
        if (addon.id === AMAZON_ADDON_ID) {
          log("Amazon addon installed");

          that.reportEvent("amazon-assistant", "addon_install");

          const recomm = await Storage.get("recomms.amazon-assistant");

          if (recomm.status === "waiting" || recomm.status === "queued") {
            recomm.status = "preused";
            log("amazon preused");
            that.reportEvent("amazon-assistant", "preused");
          } else {
            recomm.status = "postused";
            log("amazon postused");
            that.reportEvent("amazon-assistant", "postused");
          }

          await Storage.update("recomms.amazon-assistant", recomm);
        }
      },
    };

    AddonManager.addAddonListener(addonListener);
  }

  async checkForAmazonVisit(hostname) {
    if (!AMAZON_AFFILIATIONS.includes(hostname)) return;

    const data = await Storage.get("recomms.amazon-assistant");

    if (Date.now() - data.trigger.lastVisit < Preferences.get(PAGE_VISIT_GAP_PREF) * 60 * 1000) {
      log(`not counted as a new amazon visit, last visit: ${(Date.now() - data.trigger.lastVisit) / (1000)} seconds ago`);
      return;
    }

    log("amazon assistant visit");

    data.trigger.lastVisit = Date.now();
    data.trigger.visitCount += 1;

    log(`visit count: ${data.trigger.visitCount}`);

    await Storage.update("recomms.amazon-assistant", data);

    if (data.trigger.visitCount >= Preferences.get(AMAZON_COUNT_PREF)) {
      await this.queueRecommendation("amazon-assistant");
    }

    await this.presentRecommendation("amazon-assistant");
  }

  async listenForBookmarks() {

    const that = this;
    async function checkThreshold() {
      const bookmarkCount = (await Bookmarks.getRecent(100)).length;
      that.reportEvent("bookmark-count", `${bookmarkCount}`);
      log(`bookmark count: ${bookmarkCount}`);
      const threshold = Preferences.get(POCKET_BOOKMARK_COUNT_PREF);
      if (bookmarkCount > threshold) {
        await that.queueRecommendation("pocket");
      }
    }

    await checkThreshold();

    bookmarkObserver = {
      onItemAdded: (aItemId, aParentId, aIndex, aItemType, aURI, aTitle,
                    aDateAdded, aGuid, aParentGuid) => {
        log("bookmark added");

        checkThreshold().then(() => this.presentRecommendation("pocket"));
      },
      onItemRemoved() {},

      QueryInterface: XPCOMUtils.generateQI(Ci.nsINavBookmarkObserver),

      onBeginUpdateBatch() {},
      onEndUpdateBatch() {},
      onItemChanged() {},
      onItemVisited() {},
      onItemMoved() {},
    };

    bmsvc.addObserver(bookmarkObserver, false);
  }

  listenForPageViews() {

    const that = this;

    const progressListener = {
      QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
        "nsISupportsWeakReference"]),

      onStateChange(aWebProgress, aRequest, aFlag, aStatus) {
      },

      onLocationChange(aProgress, aRequest, aURI) {
        // This fires when the location bar changes; that is load event is confirmed
        // or when the user switches tabs. If you use myListener for more than one tab/window,
        // use aProgress.DOMWindow to obtain the tab/window which triggered the change.
        log("location change");
        let hostname;

        try {
          hostname = aURI.host;
        } catch (e) {
          return;
        }

        that.checkForAmazonVisit(hostname);
      },

      // For definitions of the remaining functions see related documentation
      onProgressChange(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) {},
      onStatusChange(aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange(aWebProgress, aRequest, aState) {},
    };

    // current windows
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    while (windowEnumerator.hasMoreElements()) {
      const window = windowEnumerator.getNext();
      window.gBrowser.addProgressListener(progressListener);
    }


    // new windows
    windowListener = {
      onWindowTitleChange() { },
      onOpenWindow(xulWindow) {
        // xulWindow is of type nsIXULWindow, we want an nsIDOMWindow
        // see https://dxr.mozilla.org/mozilla-central/rev/53477d584130945864c4491632f88da437353356/browser/base/content/test/general/browser_fullscreen-window-open.js#316
        // for how to change XUL into DOM

        const domWindow = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);

        // we need to use a listener function so that it's injected
        // once the window is loaded / ready
        const onWindowOpen = () => {
          log("window opened");

          domWindow.removeEventListener("load", onWindowOpen);

          if (domWindow.document.documentElement.getAttribute("windowtype") !== "navigator:browser") return;

          // add progress listener
          domWindow.gBrowser.addProgressListener(progressListener);
        };

        domWindow.addEventListener("load", onWindowOpen, true);
      },
      onCloseWindow() { },
    };
    Services.wm.addListener(windowListener);
  }

  async listenForMobilePromoTrigger() {

    const that = this;

    async function checkPrefs() {

      log(`checking prefs for mobile promo`);

      const desktopClients = Preferences.get("services.sync.clients.devices.desktop", 0);
      const mobileClients = Preferences.get("services.sync.clients.devices.mobile", 0);

      log(`desktop clients: ${desktopClients}`);
      log(`mobile clients: ${mobileClients}`);

      if (mobileClients > 0) return null;

      if (desktopClients > 0 && mobileClients === 0)
        return that.queueRecommendation("mobile-promo");

      return null;
    }

    Preferences.observe("services.sync.clients.devices.desktop", checkPrefs);
    Preferences.observe("services.sync.clients.devices.mobile", checkPrefs);

    setTimeout(() => this.presentRecommendation("mobile-promo"), 10 * 60 * 1000);

    return checkPrefs();
  }

  async action(id) {
    await Storage.update(`recomms.${id}`, {status: `action`});
    log(`${id} status changed to action`);
    this.reportEvent(id, "action");
  }

  async queueRecommendation(id) {
    log(`trying to queue recommendation ${id}`);

    const recomm = await Storage.get(`recomms.${id}`);
    if (recomm.status !== "waiting") return;

    log(`queueing recommendation ${id}`);
    recomm.status = "queued";

    await Storage.update(`recomms.${id}`, recomm);

    this.reportEvent(id, "queued");
  }

  async presentRecommendation(id) {

    log(`trying to present recommendation ${id}`);

    const recomm = await Storage.get(`recomms.${id}`);
    const general = await Storage.get("general");

    log(recomm);

    if (recomm.status === "waiting" || recomm.status === "action" || recomm.status === "preused" || recomm.status === "postused") return;
    if (recomm.presentation.count >= Preferences.get(MAX_NUMBER_OF_NOTIFICATIONS_PREF)) {
      log(`max number of notifications delivered for ${id}`);
      return;
    }
    if (Date.now() - general.lastNotification < Preferences.get(NOTIFICATION_GAP_PREF) * 60 * 1000) {
      log(`notification gap not enough for delivery`);
      return;
    }
    if (recomm.presentation.never) {
      log(`user has disabled further notification delivery for ${id}`);
      return;
    }
    if (this.variation === "control") return;

    log(`presenting recommendation ${id}`);

    // present
    const recommRecipe = recipes[id];
    currentId = id;

    if (this.variationUi === "doorhanger") {
      doorhanger = new Doorhanger(recommRecipe, this.presentationMessageListener.bind(this));
      doorhanger.present();
    }

    if (this.variationUi === "bar") {
      notificationBar = new NotificationBar(recommRecipe, this.presentationMessageListener.bind(this));
      notificationBar.present();
    }

    recomm.status = "presented";
    recomm.presentation.count += 1;

    await Storage.update("general", {lastNotification: Date.now()});

    await this.updateLogWithId(id, "delivered", "true");

    await Storage.update(`recomms.${id}`, recomm);

    this.reportEvent(id, "presented");
    this.reportSummary();
  }

  async neverShow(id) {
    const recomm = await Storage.get(`recomms.${id}`);
    recomm.presentation.never = true;
    await Storage.update(`recomms.${id}`, recomm);
    this.reportEvent(id, "nevershow");
  }

  async presentationMessageListener(message) {
    log("message received from presentation");

    switch (message.name) {
      case "FocusedCFR::openUrl":
        getMostRecentBrowserWindow().gBrowser.loadOneTab(message.data, {
          inBackground: false,
        });
        break;
      case "FocusedCFR::dismiss":
        await this.updateLogWithId(currentId, "dismiss", "true");
        if (message.data === true) {
          await this.updateLogWithId(currentId, "nevershow", "true");
          await this.neverShow(currentId);
        }
        await this.reportSummary();
        await this.reportNotificationResult("dismiss");
        break;

      case "FocusedCFR::timeout":
        await this.updateLogWithId(currentId, "timeout", "true");
        if (message.data === true) {
          await this.updateLogWithId(currentId, "nevershow", "true");
          await this.neverShow(currentId);
        }
        await this.reportSummary();
        await this.reportNotificationResult("timeout");
        break;


      case "FocusedCFR::action":
        await this.updateLogWithId(currentId, "action", "true");
        await this.action(currentId);
        await this.reportSummary();
        await this.reportNotificationResult("action");
        break;

      case "FocusedCFR::close":
        await this.updateLogWithId(currentId, "close", "true");
        if (message.data === true) {
          await this.updateLogWithId(currentId, "nevershow", "true");
          await this.neverShow(currentId);
        }
        await this.reportSummary();
        await this.reportNotificationResult("close");
        break;
    }
  }

  shutdown() {
    bmsvc.removeObserver(bookmarkObserver);
    if (doorhanger) {
      doorhanger.shutdown();
    }
    if (notificationBar) {
      notificationBar.shutdown();
    }
    if (windowListener) {
      Services.wm.removeListener(windowListener);
    }
    if (addonListener) {
      AddonManager.removeAddonListener(addonListener);
    }

    Cu.unload("resource://focused-cfr-shield-study/Doorhanger.jsm");
    Cu.unload("resource://focused-cfr-shield-study/NotificationBar.jsm");
    Cu.unload("resource://focused-cfr-shield-study/Storage.jsm");
  }
}

const Utils = {
  async printStorage() {
    return Storage.getAll().then((...args) => { log("Storage contents: ", ...args); });
  },
};
