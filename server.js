const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const { google } = require("googleapis");

var totBaz = 33;
var countCell = 34;
var user = {
    1850517018397889: {
        bazRow: "G",
        totRow: "E",
        mealRow: "A"
    },
    1374322656003629: {
        bazRow: "K",
        totRow: "I",
        mealRow: "B"
    },
    2187424434614399: {
        bazRow: "O",
        totRow: "M",
        mealRow: "C"
    }
}

let privateKey = require("./credentials.json");

let jwtClient = new google.auth.JWT(
    privateKey.client_email,
    null,
    privateKey.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
);

jwtClient.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
        return;
    } else {
        console.log("Successfully connected!");
    }
});


const
    express = require("express"),
    bodyParser = require("body-parser"),
    XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest,
    app = express().use(bodyParser.json());

const request = require("request");

app.listen(process.env.PORT || 1337, () => console.log("Listening..."));

app.get('/hook', function (request, response) {
    let VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    let mode = request.query["hub.mode"];
    let token = request.query["hub.verify_token"];
    let challenge = request.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            response.status(200).send(challenge);

        } else {
            response.sendStatus(403);
        }
    }
});

app.post('/hook', function (request, response) {
    let body = request.body;

    if (body.object === "page") {
        body.entry.forEach(function (entry) {
            let webhook_event = entry.messaging[0];
            let sender_psid = webhook_event.sender.id;
            
            // console.log(webhook_event); callSendAPI(sender_psid, {text: "Server is down. Check back later"}); return; //debug mode

            if (webhook_event.message && webhook_event.message.text) {
                handleMessage(sender_psid, webhook_event.message.text);

            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback.payload);
            }
        });

        response.status(200).send("EVENT_RECEIVED");

    } else {
        response.sendStatus(404);
    }
});

app.get('/cron', function (request, response) {
    Object.keys(user).forEach(function(k){
        copyTo(k);
    });
  
    response.sendStatus(200);
});

function handleMessage(sender_psid, received_message) {
    var txt = "Hello " + getName(sender_psid) + ", Select an option from below";
    var val = received_message.split(" ");
    
    let response;

    if (received_message.toLowerCase().search("thank") !== -1) {
        response = {
            text: "It has been a pleasure to help you <3 <3"
        };

        callSendAPI(sender_psid, response);

    } else if (!isNaN(val[0])) {
        if (parseInt(val[0]) > 3) {
            writeBazarData(sender_psid, received_message, val);

        } else {
            let values = [[val[0]]];
            let range = getSheetThisMonth() + user[sender_psid]["mealRow"] + (new Date().getDate() + 1);
            writeData(sender_psid, values, range, "Meal record");
        }
      
    } else if (val[0].toLowerCase() == "rent" && !isNaN(val[1])) {
        let cell = "P36";
        let value = [[val[1]]];
      
        let range = getSheetPrevMonth() + cell;
        writeData(sender_psid, value, range, "Rent record");
      
        let response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": "Hello, your rents are updated. Don't forget to check!",
                    "buttons": [
                        {
                            "type": "postback",
                            "title": "Bazar cost",
                            "payload": "bazar"
                        },
                        {
                            "type": "postback",
                            "title": "Total meal cost",
                            "payload": "meal"
                        },
                        {
                            "type": "postback",
                            "title": "Total to pay",
                            "payload": "total"
                        }
                    ]
                }
            }
        }
      
        Object.keys(user).forEach(function(k){
            if (k != sender_psid) {
                callSendAPI(k, response);
            }
        });
               
    }  else if (val[0].toLowerCase() == "inform") {      
        let response = {
            "text": getName(sender_psid) + " says, " + received_message.substring(received_message.indexOf(" ") + 1)
        }
      
        Object.keys(user).forEach(function(k){
            if (k != sender_psid) {
                callSendAPI(k, response);
            } else {                
                callSendAPI(k, {"text": "Sent!"});
            }
        });
      
    }  else {
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": txt,
                    "buttons": [
                        {
                            "type": "postback",
                            "title": "Bazar cost",
                            "payload": "bazar"
                        },
                        {
                            "type": "postback",
                            "title": "Total meal cost",
                            "payload": "meal"
                        },
                        {
                            "type": "postback",
                            "title": "Total to pay",
                            "payload": "total"
                        }
                    ]
                }
            }
        }

        callSendAPI(sender_psid, response);
    }
}

function handlePostback(sender_psid, received_message) {
    let txt;

    if (received_message === "bazar") {
        var range = getSheetThisMonth() + (user[sender_psid]["bazRow"] + totBaz);
        getData(sender_psid, range);

    } else if (received_message === "meal") {
        var range = getSheetThisMonth() + (user[sender_psid]["mealRow"] + 36);
        getData(sender_psid, range);
      
    } else if (received_message === "total") {        
        var range = getSheetPrevMonth() + (user[sender_psid]["totRow"] + 36);
        getData(sender_psid, range);
      
    }
}

function callSendAPI(sender_psid, response) {
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }

    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body

    }, (err, res, body) => {
        if (!err) {
            console.log("Message sent to " + getName(sender_psid))
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

function callSendMultiple(response) {
    Object.keys(user).forEach(function(k){
        callSendAPI(k, response);
    });
}

function getName(sender_psid) {
    var url = "https://graph.facebook.com/"
        + sender_psid
        + "?fields=first_name&access_token="
        + PAGE_ACCESS_TOKEN;

    var Httpreq = new XMLHttpRequest();
    Httpreq.open("GET", url, false);
    Httpreq.send(null);
    return JSON.parse(Httpreq.responseText).first_name;
}

function getData(sender_psid, range) {
    const sheets = google.sheets({
        version: 'v4',
        auth: jwtClient
    });

    sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET,
        range: range

    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        const value = rows[0][0];

        var response = {
            text: value
        };

        callSendAPI(sender_psid, response);
    });
}

function writeData(sender_psid, values, range, msg) {

    const sheets = google.sheets({
        version: 'v4',
        auth: jwtClient
    });

    const resource = { values };

    sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET,
        range: range,
        valueInputOption: "USER_ENTERED",
        resource: resource
        
    }, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            var response = { text: msg + " saved :*" };
            callSendAPI(sender_psid, response);
        }
    });
}

function copyTo(sender_psid) {

    let rangeFrom = getSheetThisMonth()
                + user[sender_psid]["mealRow"]
                + (getDate().getDate() - 1) + ":"
                + user[sender_psid]["mealRow"]
                + (getDate().getDate());
  
    let rangeTo = getSheetThisMonth() + user[sender_psid]["mealRow"] + (getDate().getDate());
    
    const sheets = google.sheets({
        version: 'v4',
        auth: jwtClient
    });

    sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET,
        range: rangeFrom

    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
      
        if (rows != undefined && rows.length == 1) {
            var values = [[rows[0][0]]];
            writeData(sender_psid, values, rangeTo, "Based on your yesterday's meal, today's meal is");
        }
    });
}

function writeBazarData(sender_psid, received_message, val) {

    const sheets = google.sheets({
        version: 'v4',
        auth: jwtClient
    });

    var countDataCell = getSheetThisMonth() + user[sender_psid]["bazRow"] + countCell;
    sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET,
        range: countDataCell

    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);

        const rows = res.data.values;
        var bazCount = rows[0][0];

        let values;
        let range;
        if (val.length == 1) {
            values = [[val[0]]];

            range = getSheetThisMonth()
                + user[sender_psid]["bazRow"]
                + bazCount;
        } else {
            values = [[received_message.substring(received_message.indexOf(" ") + 1), "", val[0]]];

            range = getSheetThisMonth()
                + user[sender_psid]["bazRow"]
                + bazCount + ":"
                + user[sender_psid]["totRow"]
                + bazCount;
        }

        writeData(sender_psid, values, range, "Bazar record");
    })
}

function getSheetName(date) {
    return date.toLocaleString('en-us', { month: 'short' }) + " '" + date.getFullYear().toString().substr(2, 2) + "!";
}

function getSheetThisMonth() {
    return getSheetName(getDate());
}

function getSheetPrevMonth() {
    var date = getDate();
    date.setMonth(date.getMonth() - 1);
    return getSheetName(date);
}

function getDate() {
    var date = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
    return new Date(date);
}