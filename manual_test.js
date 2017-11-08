/* eslint-env node */

/* This file is a helper script that will install the extension from the .xpi
 * file and setup useful preferences for debugging. This is the same setup
 * that the automated Selenium-Webdriver/Mocha tests run, except in this case
 * we can manually interact with the browser.
 * NOTE: If changes are made, they will not be reflected in the browser upon
 * reloading, as the .xpi file has not been recreated.
 */

console.log("Starting up firefox");
const utils = require("./test/utils");
const firefox = require("selenium-webdriver/firefox");
const webdriver = require("selenium-webdriver");
const Key = webdriver.Key;
const By = webdriver.By;

const Context = firefox.Context;

(async() => {
  try {
    const driver = await utils.promiseSetupDriver();

    console.log("Starting up firefox");

    // install the addon
    await utils.installAddon(driver);
    console.log("Load temporary addon.");


    // navigate to about:config and get study prefs
    driver.setContext(Context.CONTENT);
    // await driver.get("about:config");
    // const aboutConfigTextbox = driver.findElement(By.id("textbox"));
    // const findStudyPrefs = "cfr";
    // await aboutConfigTextbox.sendKeys(findStudyPrefs);
    // await aboutConfigTextbox.sendKeys(Key.RETURN);
    await driver.get("http://www.amazon.com");

    driver.setContext(Context.CHROME);

  } catch (e) {
    console.error(e); // eslint-disable-line no-console
  }
})();
