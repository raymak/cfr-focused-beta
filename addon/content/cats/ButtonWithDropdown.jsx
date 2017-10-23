import DropdownMenu from './DropdownMenu.jsx';

class ButtonWithDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dropdownOpen: false,
    }
  }

  render() {
    const dropdownItems = [
      <li
        key="1"
        className="dropdown-item"
      >
        Number 1
      </li>,
      <li
        key="2"
        className="dropdown-item"
      >
        Number 2
      </li>,
      <li
        key="3"
        className="dropdown-item"
      >
        Number 3
      </li>
    ];

    return (
      <div className="secondary-button-wrapper">
        <button
          id="secondary-button"
          className="button secondary-button"
          onClick={ () => this.props.buttonClicked() }
        >
          Button
        </button>
        {/* Note: You cannot have a <ul> element (i.e. block element) nested inside a <button> (i.e. inline element)*/}
        <div
          id="secondary-button-show-dropdown"
          className={ dropdownItems ? "button dropdown-icon-wrapper" : "button hidden dropdown-icon-wrapper" }
          onClick={ () => {
            this.setState({ dropdownOpen: !this.state.dropdownOpen })
            // TODO bdanforth: pass click event back up for telemetry
          }}
        >
          <DropdownMenu
            dropdownOpen={ this.state.dropdownOpen }>
            { dropdownItems }
          </DropdownMenu>
        </div>
      </div>
    );
  }
}

export default ButtonWithDropdown;
