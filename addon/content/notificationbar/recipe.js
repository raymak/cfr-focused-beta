/*
* Shield study recipe based on notificationBar UI treatments for
* Contextual Feature Recommendation - Amazon Assistant
*
* Ultimately: Accept HTML as values and sanitize.
*/
const recipe = {
  
  notificationBar: {
    // DEFAULT ELEMENTS:
    // to remove from UI, replace string value with ''.
    icon: {
      // Firefox Add-on logo: https://addons.cdn.mozilla.net/static/img/addon-icons/default-32.png
      url: 'https://mobileapkworld.com/wp-content/uploads/2017/05/com.amazon.aa.png',
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
}; 