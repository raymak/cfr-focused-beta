"use strict";

/* global React ReactDOM require */

/**
 * Shorthand for creating elements (to avoid using a JSX preprocessor)
 */
const r = React.createElement;

const Cats = require("./addon/lib/cats.js");

ReactDOM.render(
  r(Cats),
  document.getElementById("app"),
);
