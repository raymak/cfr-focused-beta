"use strict";

class Cats extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      r("p", {}, "I love cats")
    );
  }
}


module.exports = Cats;
