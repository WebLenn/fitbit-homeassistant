
import * as fs from "fs";
import * as messaging from "messaging";

import { me } from "appbit";
import { gettext } from "i18n";
import { settingsType, settingsFile } from "../common/constants";
import { sendData } from "../common/utils";

import document from "document";

let Available = false;
const EntityList = document.getElementById("entityList");
const AddressText = document.getElementById("addressText");
AddressText.text = gettext("unavailable");

// Load settings
let settings = loadSettings();
let deadbolt = true;
let deadboltInterval = 8000; // This has to be the time to open the lock + the time to close it again

// Register for the unload event
me.onunload = saveSettings;

// List of {id: "", name: "", state: ""}
let Entities = [];
const NextStates = {
    on: "turn_off",
    off: "turn_on",
    open: "close_cover",
    opening: "close_cover",
    closing: "open_cover",
    closed: "open_cover",
    unlocked: "lock",
    locked: "unlock",
    locking: "unlock",
    unlock: "unlock", // Allow to unlock when state was not updated
}
}

// Update list data
function setupList(list, data) {
    list.delegate = {
        getTileInfo: function(index) {
            return {
                type: "item-pool",
                name: data[index].name,
                state: data[index].state,
                index: index
            };
        },
        configureTile: function(tile, info) {
            if (info.type === "item-pool") {
                tile.getElementById("itemText").text = `${info.name}`;
                tile.getElementById("itemState").text = `${gettext(info.state)}`;
                let touch = tile.getElementById("itemTouch");
                touch.onclick = () => sendData({key: "change", entity: Entities[info.index].id, state: NextStates[info.state]});
            }
        }
    };
    list.length = data.length;
}

// Received message
messaging.peerSocket.onmessage = (evt) => {
    console.log(`Received: ${JSON.stringify(evt)}`);
    if (evt.data.key === "clear") {
        Entities = [];
        settings.entities = [];
    }
    else if (evt.data.key === "add") {
        Entities.push({id: evt.data.id, name: evt.data.name, state: evt.data.state});
        settings.entities.push({name: evt.data.id});
        setupList(EntityList, Entities);
    }
    else if (evt.data.key === "change") {
        Entities.forEach((entity, index) => {
            if (entity.id === evt.data.id) {
                //DEBUG console.log(`Updated: ${evt.data.id} to ${evt.data.state}`);
                Entities[index].state = evt.data.state;
                setupList(EntityList, Entities);

                // If the request was to the doorlock entity and the state is unlock, update the state to locking after deadbolt interval ( assuming there is a deadbolt feature )
                if (evt.data.id === "lock.doorlock" && evt.data.state === "unlock" && deadbolt) {
                    setTimeout(() => {
                        Entities[index].state = "locking";
                        setupList(EntityList, Entities);
                    }, deadboltInterval);
                }
            }
        })
    }
    else if (evt.data.key === "api") {
        if (evt.data.value === "ok") {
            Available = true;
            AddressText.text = evt.data.name;
        }
        else {
            Available = false;
            AddressText.text = evt.data.value;
        }
    }
    else if (evt.data.key === "url") {
        settings.url = evt.data.value;
        sendData({key: "url", value: settings.url});
    }
    else if (evt.data.key === "port") {
        settings.port = evt.data.value;
        sendData({key: "port", value: settings.port});
    }
    else if (evt.data.key === "token") {
        settings.token = evt.data.value;
        sendData({key: "token", value: settings.token});
    }
    else if (evt.data.key === "force") {
        settings.force = evt.data.value;
        sendData({key: "force", value: settings.force});
    }
}

// Message socket opens
messaging.peerSocket.onopen = () => {
    console.log("Socket open");
    sendData({key: "url", value: settings.url});
    sendData({key: "port", value: settings.port});
    sendData({key: "token", value: settings.token});
    sendData({key: "entities", value: settings.entities});
    sendData({key: "force", value: settings.force});
};

// Message socket closes
messaging.peerSocket.onclose = () => {
    console.log("Socket closed");
};

// Load settings
function loadSettings() {
    try {
        return fs.readFileSync(settingsFile, settingsType);
    }
    catch (ex) {
        console.error("Error loading settings");
        // Default values
        return {
            url: "localhost",
            port: "8123",
            token: "",
            force: true
            entities: [
                {name: "lock.doorlock"},
                {name: "light.bedroom"},
                {name: "media_player.bedroom_tv"},
            ]
        };
    }
}

// Save settings
function saveSettings() {
    fs.writeFileSync(settingsFile, settings, settingsType);
}
