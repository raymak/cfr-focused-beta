# Focused Contextual Feature Recommender (CFR) Shield Study in Firefox beta

## Overview
This Firefox [Shield](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies) study proactively recommends three Firefox features (Amazon Assistant, Pocket, Firefox Mobile) to those users that are predicted to benefit from them. It also compares the effectiveness of the recommendations in various conditions including using a doorhanger or notification bar.

![Pocket recommenation (notification bar)](https://i.imgur.com/yqcuvwJ.png)

## Opting out of the study
To remove the study addon go to your Add-ons page (`about:addons` in the url bar), then go to the Extensions page and remove the addon named "Focused Contextual Feature Recommender Shield Study".

# Development 

## install
`npm install`
`npm run build`

at second shell/prompt, watch files for changes to rebuild
`npm run watch`


## in Firefox:
1. `about:debugging > [load temporary addon] > choose `dist/addon.xpi`
2. `tools > Web Developer > Browser Toolbox`
==

