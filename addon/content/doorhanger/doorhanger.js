/*! This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

let window;
let document;
let recipe;

/*global sanitizeHtml */
/*exported capitalize, changeBodySize */
// shims to use jetpack messaging
const self = {
  port: {
    on: function(header, handle){
      addMessageListener(header, {
      	receiveMessage: function(message){
      		console.log(message);
	        if (message.name == header)
	          handle(message.data);
	 	}	
      });
    },
    emit: function(header, data){
      sendAsyncMessage(header, data);
    }
  }
}

const sanitizeHtml = (m)=>{return m} // disabling the sanitization. not needed. only text from the code is sent.

self.port.on("FocusedCFR::load", (data)=>{
	content.addEventListener('load', () => load(data));
});

function load(data){

  window = content;
  document = content.document;
  console.log(data);

  let title = data.title;
  let primButtonLabel = data.primaryButton.label;
  let secButtonLabel = 'Not Now';
  let iconSrc = data.icon.url;

  document.getElementById("icon").src = iconSrc;
  document.getElementById("icon").setAttribute("alt", data.icon.alt);

  let textboxEle = document.getElementById("textbox");

  if (data.message.link.text) {
      const messageParts = data.message.text.split(data.message.link.text);
      textboxEle.innerHTML = `${messageParts[0]} <a class='external-link' data-url="${data.message.link.url}" href="${data.message.link.url}">${data.message.link.text}</a> ${messageParts[1]}`;
    } else {
      textboxEle.textContent = data.message.text;
    }

  document.getElementById("header").textContent = title;  
  document.getElementById("prim-button").textContent = primButtonLabel;
  document.getElementById("prim-button").classList.add('external-link');
  document.getElementById("prim-button").dataset.url = data.primaryButton.url;
  document.getElementById("sec-button").textContent = secButtonLabel;
  if (!primButtonLabel)
    document.getElementById("prim-button").classList.add('disabled');
  if (!secButtonLabel)
    document.getElementById("sec-button").classList.add('disabled');


  //setting the callback
  document.getElementById("sec-button").addEventListener("click", secButtonClick);
  document.getElementById("prim-button").addEventListener("click", primButtonClick);
  document.getElementById("close-button").addEventListener("click", closeButtonClick);

  document.body.addEventListener("mouseenter", mouseEnter);
  document.body.addEventListener("mouseleave", mouseLeave);

  document.getElementById("info-page").addEventListener("click", infoClick);

  registerExternalLinks();

  // self.port.emit("doorhanger loaded");

  // updatePanelSize();

}

function registerExternalLinks(){
    for (let ele of document.getElementsByClassName('external-link')){
      ele.addEventListener('click', (e)=>{
        sendAsyncMessage('FocusedCFR::openUrl', ele.dataset.url);
        e.preventDefault();
      });
    }
  }

function infoClick(e){
  self.port.emit("infoPage");
}

function caClick(e){
  if (document.getElementById("recommcontainer").classList.contains("invisible"))
    return;
}

function caMouseEnter(e){
  if (document.getElementById("recommcontainer").classList.contains("invisible"))
    return;
}

function mouseEnter(e){
  self.port.emit("mouseenter");
}

function mouseLeave(e){
  self.port.emit("mouseleave");

  if (document.getElementById("recommcontainer").classList.contains("invisible"))
    return;
}

function capitalize(string){
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function secButtonClick(){
  sendAsyncMessage("FocusedCFR::dismiss");
}

function primButtonClick(){
  self.port.emit("FocusedCFR::action");
}

function closeButtonClick(){
  self.port.emit("FocusedCFR::close");
}

function changeBodySize(panelSize){
  document.body.style.width = (panelSize.width - 2).toString() + "px";
  document.body.style.height = (panelSize.height - 3).toString() + "px";
}

function updatePanelSize(width, height){
  self.port.emit("resize", {height: height || Number(getComputedStyle(document.body).height.slice(0,-2)),
    width: width || Number(getComputedStyle(document.body).width.slice(0,-2))});
}


self.port.emit('panel-ready');