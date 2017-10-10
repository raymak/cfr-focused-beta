'use strict';

/* global browser */


class Message {
  static on(header, handle){
    browser.runtime.onMessage.addListener(function(message, sender, sendResponse){
      if (message.header == header)
        handle(message.data);
    })
  }
  static emit(header, data){
    browser.runtime.sendMessage({header, data});
  }
}

Message.on('storage', function storageTransaction(data){
  let action = data.action;
  let args = data.args;

  storage.local[action](...args);
});