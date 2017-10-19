class ButtonWithDropdown extends React.Component {

  render() {

    return (
      <ul
        id="dropdown-menu"
        className={ (this.props.dropdownOpen && this.props.children) ? "dropdown" : "dropdown hidden" }
      >
        { this.props.children }
      </ul>
    );
  }
}

export default ButtonWithDropdown;
