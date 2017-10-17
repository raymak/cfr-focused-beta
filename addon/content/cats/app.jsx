import Cats from "./cats.jsx";

"use strict";

/* global React ReactDOM require content addMessageListener sendAsyncMessage */

const self = {
  port: {
    on(header, handle) {
      addMessageListener(header, {
        receiveMessage(message) {
          if (message.name === header)
            handle(message.data);
        },
      });
    },
    emit(header, data) {
      sendAsyncMessage(header, data);
    },
  },
};

const sanitizeHtml = (m) => { return m; }; // disabling the sanitization. not needed. only text from the code is sent.

class App extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <Cats />
    );
  }
}

function load(data) {
  const document = content.document; // eslint-disable-line no-global-assign, no-native-reassign

  ReactDOM.render(
    React.createElement(App),
    document.getElementById("app"),
  );
}

self.port.on("FocusedCFR::load", (data) => {
  content.addEventListener("load", () => load(data));
});

self.port.emit("panel-ready");
