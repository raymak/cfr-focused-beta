"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "IndexedDB", "resource://gre/modules/IndexedDB.jsm");

this.EXPORTED_SYMBOLS = ["Storage"];

const DB_NAME = "recommender-study";
const DB_OPTIONS = {
  version: 1,
  storage: "persistent",
};

/**
 * Cache the database connection so that it is shared among multiple operations.
 */
let databasePromise;
async function getDatabase() {
  if (!databasePromise) {
    databasePromise = IndexedDB.open(DB_NAME, DB_OPTIONS, (db) => {
      db.createObjectStore(DB_NAME);
    });
  }
  return databasePromise;
}

/**
 * Get a transaction for interacting with the store.
 *
 * NOTE: Methods on the store returned by this function MUST be called
 * synchronously, otherwise the transaction with the store will expire.
 * This is why the helper takes a database as an argument; if we fetched the
 * database in the helper directly, the helper would be async and the
 * transaction would expire before methods on the store were called.
 */
function getStore(db) {
  return db.objectStore(DB_NAME, "readwrite");
}

const Storage = {
  async clear() {
    const db = await getDatabase();
    await getStore(db).clear();
  },

  async close() {
    if (databasePromise) {
      const promise = databasePromise;
      databasePromise = null;
      const db = await promise;
      await db.close();
    }
  },

  async has(key) {
    const db = await getDatabase();
    const value = await getStore(db).get(key);
    return !!value;
  },

  async get(key) {
    const db = await getDatabase();
    const value = await getStore(db).get(key);
    if (!value) {
      throw new Error(`Could not find a key named ${key}.`);
    }

    return value;
  },

  async set(key, value) {
    const db = await getDatabase();

    return getStore(db).put(value, key);
  },

  async create(key, value) {
    const db = await getDatabase();
    if (await getStore(db).get(key)) {
      throw new Error(
        `Cannot create value with key ${key}: a value exists with that key already.`,
      );
    }

    return getStore(db).add(value, key);
  },

  // data must be an object
  async update(key, data) {
    const db = await getDatabase();
    const savedData = await getStore(db).get(key);
    if (!savedData) {
      throw new Error(`Cannot update data ${key}: could not find data.`);
    }

    return getStore(db).put(Object.assign({}, savedData, data), key);
  },

  async getAllValues() {
    const db = await getDatabase();
    const values = await getStore(db).getAll();
    return values;
  },

  // gets all key-value pairs in the {key1: value1, key2, value2, ...} form.
  async getAll() {
    const keys = await this.getAllKeys();

    const pairs = {};

    for (const k of keys) {
      pairs[k] = await this.get(k);
    }

    return pairs;
  },

  async getAllKeys() {
    const db = await getDatabase();
    const keys = await getStore(db).getAllKeys();

    return keys;
  },
};
