"use strict";

let window;
let document;
let recipe;

addMessageListener('FocusedCFR::load', {
  receiveMessage: function(message) {
    window = content;
    document = content.document;

    let data = message.data;
    recipe = {
      notificationBar: {
        icon: data.icon,
        message: data.message,
        primaryButton: {
          label: data.primaryButton.label,
          color: '', // e.g. '#53bf28'
          icon: {
            url: '' // e.g. 'plus-sign.svg'
          },
          url: data.primaryButton.url
        },
        secondaryButton: {
          label: 'Not Now',
          dropdownOptions: [
            {
              id: 'dont-show',
              label: "Don't show me this again" 
            }
          ]
        },
        starRating: {
          url: '', // e.g. 'fourStars.png'
          // specify where in notificationBar this element should be included
          location: '' // acceptable values: 'left', 'middle', 'right'
        },
        link: {
          text: '', // e.g. 'Learn More' or '361 reviews'
          url: '', // e.g. 'https://addons.mozilla.org/en-US/firefox/addon/amazon-browser-bar/' or 'https://addons.mozilla.org/en-US/firefox/addon/amazon-browser-bar/reviews/'
          location: '' // acceptable values: 'middle', 'right'
        },
        checkbox: {
          label: '' // e.g. "Don't ask me again"
        },
        additionalInfo: {
          text: '' // e.g. '408,835 users' or '361 reviews'
        }
      }
    }
    notificationBar.init();
  }
});

sendAsyncMessage('FocusedCFR::log', 'frame script loaded');

/**const recipe = {
  
  notificationBar: {
    // DEFAULT ELEMENTS:
    // to remove from UI, replace string value with ''.
    icon: {
      // Firefox Add-on logo: https://addons.cdn.mozilla.net/static/img/addon-icons/default-32.png
      url: 'resource://focused-cfr-shield-study-content/images/amazon-assistant.png',
      alt: 'Amazon Assistant logo'
    },
    message: {
      text: 'Try the Amazon Assistant Add-on for Firefox!',
      // If a substring of message.text is a link, include message.link.
      link: {
        text: 'Amazon Assistant',
        url: 'https://addons.mozilla.org/en-US/firefox/addon/amazon-browser-bar/'
      }
    },
    primaryButton: {
      label: 'Add to Firefox',
      color: '', // e.g. '#53bf28'
      icon: {
        url: '' // e.g. 'plus-sign.svg'
      }
    },
    secondaryButton: {
      label: 'Not Now',
      // Add as many or as few options as needed
      dropdownOptions: [
        {
          id: 'dont-show',
          label: "Don't show me this again" 
        }
      ]
    },    
    // OPTIONAL ELEMENTS
    starRating: {
      url: '', // e.g. 'fourStars.png'
      // specify where in notificationBar this element should be included
      location: '' // acceptable values: 'left', 'middle', 'right'
    },
    link: {
      text: '', // e.g. 'Learn More' or '361 reviews'
      url: '', // e.g. 'https://addons.mozilla.org/en-US/firefox/addon/amazon-browser-bar/' or 'https://addons.mozilla.org/en-US/firefox/addon/amazon-browser-bar/reviews/'
      location: '' // acceptable values: 'middle', 'right'
    },
    checkbox: {
      label: '' // e.g. "Don't ask me again"
    },
    additionalInfo: {
      text: '' // e.g. '408,835 users' or '361 reviews'
    }
  }
};  **/ 

const notificationBar = {

  init() {
    this.addListeners();
  },

  addListeners() {
    window.addEventListener('load', () => {
      this.createNotificationBar();
      this.closeIconEle.addEventListener('click', () => {
        this.closeNotificationBar();
      });
      this.secondaryButtonShowDropdownEle.addEventListener('click', () => {
        this.toggleDropdownMenu();
      });

      // primary button
      this.primaryButtonEle.classList.add('external-link');
      this.primaryButtonEle.dataset.url = recipe.notificationBar.primaryButton.url;
      this.registerExternalLinks();
      this.primaryButtonEle.addEventListener('click', ()=>{
        sendAsyncMessage('FocusedCFR::action');
      });

      // secondary button
      this.secondaryButtonEle.addEventListener('click', ()=>{
        sendAsyncMessage('FocusedCFR::dismiss');
      });

      // close button
      this.closeIconEle.addEventListener('click', ()=>{
        sendAsyncMessage('FocusedCFR::close');
      });
    });
  },

  registerExternalLinks(){
    for (let ele of document.getElementsByClassName('external-link')){
      ele.addEventListener('click', (e)=>{
        sendAsyncMessage('FocusedCFR::openUrl', ele.dataset.url);
        e.preventDefault();
      });
    }
  },

  createNotificationBar() {
    this.getElements();
    this.addDropdownMenuElements();
    this.addContent();
  },

  closeNotificationBar() {
    this.notificationBarEle.classList.add('hidden');
  },

  toggleDropdownMenu() {
    this.dropdownMenuEle.classList.toggle('hidden');
  },

  getElements() {
    this.notificationBarEle = document.getElementById('notification-bar');
    this.iconEle = document.getElementById('icon');
    this.ratingLeftEle = document.getElementById('rating-left');
    this.messageEle = document.getElementById('message');
    this.linkMiddleEle = document.getElementById('link-middle');
    this.ratingMiddleEle = document.getElementById('rating-middle');
    this.primaryButtonEle = document.getElementById('primary-button');
    this.secondaryButtonEle = document.getElementById('secondary-button');
    this.secondaryButtonShowDropdownEle = document.getElementById('secondary-button-show-dropdown');
    this.dropdownMenuEle = document.getElementById('dropdown-menu');
    this.checkboxEle = document.getElementById('checkbox');
    this.ratingRightEle = document.getElementById('rating-right');
    this.additionalInfoEle = document.getElementById('additional-info');
    this.checkboxLabelEle = document.getElementById('checkbox-label');
    this.closeIconEle = document.getElementById('close-icon');
    this.linkRightEle = document.getElementById('link-right');
  },

  addDropdownMenuElements() {
    recipe.notificationBar.secondaryButton.dropdownOptions.forEach((item) => {
      const menuItem = document.createElement('li');
      menuItem.setAttribute('id', item.id);
      menuItem.classList.add('dropdown-item');
      this.dropdownMenuEle.appendChild(menuItem);
    });
  },

  addContent() {
    if (recipe.notificationBar.icon.url) {
      this.addImageContent();
    } else {
      this.iconEle.style.display = 'none';
    }

    if (recipe.notificationBar.starRating.url) {
      switch (recipe.notificationBar.starRating.location) {
        case 'left':
          this.addRatingLeftContent();
          break;
        case 'middle':
          this.addRatingMiddleContent();
          break;
        case 'right':
          this.addRatingRightContent();
          break;
        default:
          this.addRatingLeftContent();
          break;
      }
    } else {
      this.ratingLeftEle.style.display = 'none';
      this.ratingMiddleEle.style.display = 'none';
      this.ratingRightEle.style.display = 'none';
    }
    if (recipe.notificationBar.primaryButton.color) {
      this.primaryButtonEle.style.backgroundColor = recipe.notificationBar.primaryButton.color;
    }
    // TODO: pass icon url from recipe to CSS
    if (recipe.notificationBar.primaryButton.icon.url) {
      this.primaryButtonEle.classList.add("show-icon");
    } else {
      this.primaryButtonEle.classList.remove("show-icon");
    }
    if (recipe.notificationBar.primaryButton.label) {
      this.addPrimaryButtonContent();
    } else {
      this.primaryButtonEle.style.display = 'none';
    }
    if (recipe.notificationBar.secondaryButton.label) {
      this.addSecondaryButtonContent();
    } else {
      this.secondaryButtonEle.style.display = 'none';
      this.secondaryButtonShowDropdownEle.style.display = 'none';
    }
    if (recipe.notificationBar.message.text) {
      this.addMessageContent();
    } else {
      this.messageEle.style.display ='none';
    }
    if (recipe.notificationBar.link.text) {
      switch (recipe.notificationBar.link.location) {
        case 'middle':
          this.addLinkMiddleContent();
          break;
        case 'right':
          this.addLinkRightContent();
          break;
        default:
          // invalid value passed, defaulting to middle
          this.addLinkMiddleContent();
          break;
      }
    } else {
      this.linkMiddleEle.style.display = 'none';
      this.linkRightEle.style.display = 'none';
    }
    if (recipe.notificationBar.secondaryButton.dropdownOptions) {
      this.addDropdownMenuContent();
    } else {
      this.dropdownMenuEle.style.display = 'none';
    }
    if (recipe.notificationBar.checkbox.label) {
      this.addCheckboxContent();
    } else {
      this.checkboxEle.style.display = 'none';
      this.checkboxLabelEle.style.display = 'none';
    }
  },

  addImageContent() {
    this.iconEle.src = recipe.notificationBar.icon.url;
    this.iconEle.alt = recipe.notificationBar.icon.alt;
  },

  addRatingLeftContent() {
    this.ratingLeftEle.src = recipe.notificationBar.starRating.url;
  },

  addPrimaryButtonContent() {
    this.primaryButtonEle.textContent = recipe.notificationBar.primaryButton.label;
  },

  addSecondaryButtonContent() {
    this.secondaryButtonEle.textContent = recipe.notificationBar.secondaryButton.label;
  },

  addMessageContent() {
    if (recipe.notificationBar.message.link.text) {
      const messageParts = recipe.notificationBar.message.text.split(recipe.notificationBar.message.link.text);
      this.messageEle.innerHTML = `${messageParts[0]} <a class='external-link' data-url="${recipe.notificationBar.message.link.url}" href="${recipe.notificationBar.message.link.url}">${recipe.notificationBar.message.link.text}</a> ${messageParts[1]}`;
    } else {
      this.messageEle.textContent = recipe.notificationBar.message.text;
    }
  },

  addRatingMiddleContent() {
    this.ratingMiddleEle.src = recipe.notificationBar.starRating.url;
  },

  addLinkMiddleContent() {
    this.linkMiddleEle.textContent = recipe.notificationBar.link.text;
    this.linkMiddleEle.href = recipe.notificationBar.link.url;
  },

  addDropdownMenuContent() {
    const numDropdownMenuItems = recipe.notificationBar.secondaryButton.dropdownOptions.length;
    const dropdownMenuItemEles = this.dropdownMenuEle.children;
    for (let i = 0; i < numDropdownMenuItems; i++) {
      dropdownMenuItemEles[i].textContent = recipe.notificationBar.secondaryButton.dropdownOptions[i].label;
    }
  },

  addRatingRightContent() {
    this.ratingRightEle.src = recipe.notificationBar.starRating.url;
  },

  addCheckboxContent() {
    this.checkboxLabelEle.textContent = recipe.notificationBar.checkbox.label;
  },

  addLinkRightContent() {
    this.linkRightEle.textContent = recipe.notificationBar.link.text;
    this.linkRightEle.href = recipe.notificationBar.link.url;
  }
};