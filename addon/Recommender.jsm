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
XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow","resource:///modules/RecentWindow.jsm");

let bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                      .getService(Components.interfaces.nsINavBookmarksService);

const AMAZON_AFFILIATIONS = [
                              "www.amazon.com",
                              "www.amazon.ca",
                              "www.amazon.co.uk",
                              "www.audible.com",
                              "www.audible.ca",
                              "www.audible.co.uk"
                            ];

const PAGE_VISIT_GAP_MINUTES = 15;
const NOTIFICATION_GAP_MINUTES = 1;
const MAX_NUMBER_OF_NOTIFICATIONS = 3;

const NOTIFICATION_GAP_PREF = "extensions.focused_cfr_study.notification_gap_minutes";
const MAX_NUMBER_OF_NOTIFICATIONS_PREF = "extensions.focused_cfr_study.max_number_of_notifications";
const INIT_PREF = "extensions.focused_cfr_study.initialized";
const POCKET_BOOKMARK_COUNT_PREF = "extensions.focused_cfr_study.pocket_bookmark_count_threshold";

const POCKET_BOOKMARK_COUNT_TRHESHOLD = 15;

const AMAZON_LINK = "www.amazon.com/gp/BIT/ref=bit_v2_BDFF1?tagbase=mozilla1";

this.EXPORTED_SYMBOLS = ["Recommender"];

const log = console.log; // Temporary

let bookmarkObserver;
let currentId;

const recipes = {
  "amazon-assistant": {
    message: {
      text: `Instant product matches while you shop across the web with Amazon Assistant`,
      link: {
        text: 'Amazon Assistant',
        url: `${AMAZON_LINK}`
      }
    },
    primaryButton: {
      label: `Add to Firefox`,
      url: `${AMAZON_LINK}`
    },
    icon: {
      url: "resource://focused-cfr-shield-study-content/images/amazon-assistant.png",
      alt: "Amazon Assistant logo"
    }
  },
  "mobile-promo": {
    message: {
      text:`Your Firefox account meets your phone. They fall in love. Get Firefox on your phone now.`,
      link: {}
    },
    primaryButton: {
      label: 'Make a match',
      url: `https://www.mozilla.org/en-US/firefox/mobile-download/desktop/`
    },
    icon: {
      url: "resource://focused-cfr-shield-study-content/images/mobile-promo.png",
      alt: "Firefox Mobile logo"
    }
  },
  "pocket": {
    message: {
      text: "You might like Pocket, which lets you save for later articles, videos, or pretty much anything!",
      link: {
        text: "Pocket",
        url: "https://getpocket.com/firefox/"
      }
    },
    primaryButton: {
      label: "Try it Now",
      url: "http://www.getpocket.com/firefox_tryitnow"
    },
    icon: {
      url: "resource://focused-cfr-shield-study-content/images/pocket.png",
      alt: "Pocket Logo"
    }
  }
}

function getMostRecentBrowserWindow() {
  return RecentWindow.getMostRecentBrowserWindow({
    private: false,
    allowPopups: false,
  });
}

class Recommender {
  constructor(telemetry, variation) {
    log("hello");
    log("variation", variation);
    this.test();
    this.telemetry = telemetry;
    this.variation = variation.name;
    this.variationUi = variation.ui;
    this.variationAmazon = variation.amazon;
  }

  test() {
    (new NotificationBar(recipes['mobile-promo'], this.presentationMessageListener.bind(this))).present();


  }

  async start() {
    if (Preferences.get(INIT_PREF)) return; // not first run

    let isFirstRun = !(await Storage.has("general"));
    if (isFirstRun)
      await this.firstRun();

    Utils.printStorage();
    await this.listenForMobilePromoTrigger();
    await this.listenForPageViews();
    await this.listenForBookmarks();

    await this.reportSummary();
  }

  async firstRun() {
    log('first run');

    await this.initRecommendations();
    await this.initLogs();

    await Storage.set("general", {
      started: true,
      lastNotification: (new Date(0)).getTime()
    });

    log('setting prefs');

    Preferences.set(NOTIFICATION_GAP_PREF, NOTIFICATION_GAP_MINUTES);
    Preferences.set(MAX_NUMBER_OF_NOTIFICATIONS_PREF, MAX_NUMBER_OF_NOTIFICATIONS);
    Preferences.set(POCKET_BOOKMARK_COUNT_PREF, POCKET_BOOKMARK_COUNT_TRHESHOLD);
    Preferences.set(INIT_PREF, true);
  }

  async reportSummary() {
    let logs = await Storage.get("logs");
    let data = {
      "message_type": "summary_log",
      "variation": this.variation,
      "variation_ui": this.variationUi,
      "variation_amazon": this.variationAmazon
    }

    data = Object.assign({}, data, logs);
    console.log(data);
    this.telemetry(data);
  }

  async updateLog(attribute, value) {
    return Storage.update("logs", {attribute: String(value)});
  }

  async updateLogWithId(id, attribute, value) {
    return updateLog(`${id}_${attribute}`, value);
  }

  async initLogs() {
    let logs = {
      "amazon_delivered": "false",
      "amazon_action": "false",
      "amazon_close": "false",
      "amazon_dismiss": "false",
      "mobile-promo_delivered": "false",
      "mobile-promo_action": "false",
      "mobile-promo_close": "false",
      "mobile-promo_dismiss": "false",
      "pocket_delivered": "false",
      "pocket_action": "false",
      "pocket_close": "false",
      "pocket_dismiss": "false"
    }

    Storage.set("logs", logs);
  }

  async initRecommendations() {
    const mobilePromo = {
      id: "mobile-promo",
      status: "waiting",
      presentation: {
        count: 0,
        never: false
      },
    };

    const amazonAssistant = {
      id: "amazon-assistant",
      status: "waiting",
      presentation: {
        count: 0,
        never: false
      },
      trigger: {
        visitCount: 0,
        lastVisit: (new Date(0)).getTime(),
        never: false
      }
    }

    const pocket = {
      id: "pocket",
      status: "waiting",
      presentation: {
        count: 0
      }
    }

    const recomms = {ids: ["mobile-promo", "amazon-assistant", "pocket"]};
    await Storage.set("recomms", recomms);
    await Storage.set("recomms.mobile-promo", mobilePromo);
    await Storage.set("recomms.amazon-assistant", amazonAssistant);
    await Storage.set("recomms.pocket", pocket);
  }

  async checkForAmazonVisit(hostname) {
    if (!AMAZON_AFFILIATIONS.includes(hostname)) return;

    let data = await Storage.get("recomms.amazon-assistant");

    if (Date.now() - data.trigger.lastVisit < PAGE_VISIT_GAP_MINUTES * 60 * 1000) return;

    log('amazon assistant visit');

    data.trigger.lastVisit = Date.now();
    data.trigger.visitCount += 1;

    log(`visit count: ${data.trigger.visitCount}`);

    if (data.trigger.visitCount > 3)
      this.queueRecommendation('amazon-assistant');

    await Storage.update("recomms.amazon-assistant", data);

    await this.presentRecommendation('amazon-assistant');
  }

  async listenForBookmarks(){

    let that = this;
    async function checkThreshold(){
      let bookmarkCount = (await Bookmarks.getRecent(100)).length;
      log(`bookmark count: ${bookmarkCount}`);
      let threshold = Preferences.get(POCKET_BOOKMARK_COUNT_PREF);
      if (bookmarkCount > threshold){
        that.queueRecommendation('pocket');
      }
    }

    await checkThreshold();

    bookmarkObserver = {
      onItemAdded: (aItemId, aParentId, aIndex, aItemType, aURI, aTitle,
                    aDateAdded, aGuid, aParentGuid) => {
        console.log('bookmark added');

        checkThreshold().then(()=>this.presentRecommendation('pocket'));
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

    let that = this;

    const progressListener = {
      QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
                                     "nsISupportsWeakReference"]),

      onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {
      },

      onLocationChange: function(aProgress, aRequest, aURI) {
        // This fires when the location bar changes; that is load event is confirmed
        // or when the user switches tabs. If you use myListener for more than one tab/window,
        // use aProgress.DOMWindow to obtain the tab/window which triggered the change.
        log("location change");
        let hostname;

        try {
          hostname = aURI.host;
        }
        catch (e){
          return;
        }

        that.checkForAmazonVisit(hostname);
      },

      // For definitions of the remaining functions see related documentation
      onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) {},
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function(aWebProgress, aRequest, aState) {}
    }

    // current windows
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    while (windowEnumerator.hasMoreElements()) {
      const window = windowEnumerator.getNext();
      window.gBrowser.addProgressListener(progressListener);
    }


    // new windows
    const windowListener = {
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
          log('window opened');

          domWindow.removeEventListener("load", onWindowOpen);

          if (domWindow.document.documentElement.getAttribute("windowtype") != "navigator:browser") return;
          
          // add progress listener

          const STATE_START = Ci.nsIWebProgressListener.STATE_START;
          const STATE_STOP = Ci.nsIWebProgressListener.STATE_STOP;
          
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

    setTimeout(()=> this.presentRecommendation("mobile-promo"), 10 * 60 * 1000);

    return checkPrefs();
  }

  async queueRecommendation(id) {
    log(`trying to queue recommendation ${id}`);

    const recomm = await Storage.get(`recomms.${id}`);
    if (recomm.status != 'waiting') return;

    log(`queueing recommendation ${id}$`);
    await Storage.update(`recomms.${id}`, {status: `queued`});
  }

  async presentRecommendation(id) {

    log(`trying to present recommendation ${id}`);

    const recomm = await Storage.get(`recomms.${id}`);
    const general = await Storage.get("general");

    log(recomm);

    if (recomm.status == "waiting") return;
    if (recomm.presentation.count >= Preferences.get(MAX_NUMBER_OF_NOTIFICATIONS_PREF)) return;
    if (Date.now() - general.lastNotification < Preferences.get(NOTIFICATION_GAP_PREF) * 60 * 1000) return;
    if (recomm.presentation.never) return;
    if (this.variation == 'control') return;

    log(`presenting recommendation ${id}`);

    // present
    recommRecipe = recips[id];
    currentId = id;

    if (this.variationUi == 'doorhanger')
      new Doorhanger(recommRecipe, this.presentationMessageListener.bind(this));

    if (this.variationUi == 'bar')
      new NotificationBar(recommRecipe, this.presentationMessageListener.bind(this));

    recomm.status == "presented";
    recomm.presentation.count += 1;

    this.updateLogWithId(id, "delivered", "true");

    await Storage.update(`recomms.${id}`, recomm);

    this.reportSummary();
  }

  presentationMessageListener(message){
    log('message received from presentation');

    switch (message.name){
      case "FocusedCFR::openUrl":
        getMostRecentBrowserWindow().gBrowser.loadOneTab(message.data, {
          inBackground: false,
        });
        break;
      case "FocusedCFR::dismiss":
        this.updateLogWithId(currentId, "dismiss", "true");
        this.reportSummary();
        break;

      case "FocusedCFR::action":
        this.updateLogWithId(currentId, "action", "true");
        this.reportSummary();
        break;

      case "FocusedCFR::close":
        this.updateLogWithId(currentId, "close", "true");
        this.reportSummary();
        break;
    }
  }
}

const Utils = {
  async printStorage() {
    return Storage.getAll().then(log);
  },
};
