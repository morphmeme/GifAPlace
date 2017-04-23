YELP_ID = "{YELP ID}";
YELP_SECRET = "{YELP SECRET}";

var http = require("http"),
    express = require("express"),
    bodyParser = require("body-parser"),
	yelp = require("yelp-fusion"),
	watson = require("watson-developer-cloud"),
	giphy = require("giphy-api")("dc6zaTOxFJmzC");

var tone_analyzer = watson.tone_analyzer({
  username: '{Watson Username}',
password: '{Watson Password}',
  version: 'v3',
  version_date: '2016-05-19'
});

var app = express();
app.use(bodyParser.urlencoded({ extended: true })); 


function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function saveBusinesses(businesses, phone) {
	//returns names of businesses
	var result = [];
	//response.jsonBody.businesses[0].name
	for (var i = 0; i < businesses.length; i++) {
		instances[phone].savedBusinesses[businesses[i].name] = [businesses[i].id, businesses[i]["location"]["address1"]];
		result.push(businesses[i].name);
	}
	return result;
}

function deleteDotDotDot(text)
{
	return text.slice(0, text.length - 3)
}

function findGreatestEmotion(emotions) {
	var greatestEmotionSoFarValue = 0;
	var greatestEmotionSoFar = "";
	for (var i = 0; i < emotions.length; i++) {
		if (emotions[i]["score"] > greatestEmotionSoFarValue) {
			greatestEmotionSoFarValue = emotions[i]["score"];
			greatestEmotionSoFar = emotions[i]["tone_name"];
		}
	}
	return greatestEmotionSoFar;
}

var instances = {}

/*
var location = null;
var foundLocation = false;
var done = false;
var first = true;
var savedBusinesses = {};
var business = [];
var currentBusiness = null;
*/
app.post('/sms', function(req, res) {
    var twilio = require('twilio');
    var twiml = new twilio.TwimlResponse();
	var client = twilio('{TWILIO SID}', '{TWILIO TOKEN}');
	if (!(req.body.From in instances))
	{
		instances[req.body.From] = {location: null, foundLocation: false, done: false, first: true, savedBusinesses: {}, business: [], currentBusiness: null}
	}
	if (instances[req.body.From].first)
	{
		twiml.message("Gif A Place!, a tool that helps you find places that match your interests through gifs! Please enter your address to continue");
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(twiml.toString());
		instances[req.body.From].first = false;
	}
	else if (isNumeric(req.body.Body[0])) {
		instances[req.body.From].location = req.body.Body;
		var location = instances[req.body.From][location];
		instances[req.body.From].location = req.body.Body;
		twiml.message("Location saved! Enter the type of location you would like or enter a specific business?");
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(twiml.toString());
	}
	else if (instances[req.body.From].foundLocation && req.body.Body.toLowerCase() === "research")
	{
		twiml.message("Enter the type of food you would like or enter a specific business?")
		instances[req.body.From].done = false;
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(twiml.toString());
	}
	else if (instances[req.body.From].foundLocation && req.body.Body.toLowerCase() === "more")
	{
		var currentBusiness = instances[req.body.From].currentBusiness;
		twiml.message(instances[req.body.From].savedBusinesses[currentBusiness][1] + "\n" + "I hope you enjoy your experience! If you change your mind, you can always search again!")
		instances[req.body.From].foundLocation = false;
		instances[req.body.From].done = false;
		instances[req.body.From].location = null;
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(twiml.toString());
	}
	else if (instances[req.body.From].foundLocation && req.body.Body.toLowerCase() === "next")
	{
		if (!(instances[req.body.From].business)) {
			twiml.message("No more businesses left :-(")
			instances[req.body.From].foundLocation = false;
			instances[req.body.From].done = false;
			res.writeHead(200, {'Content-Type': 'text/xml'});
			res.end(twiml.toString());
		}
		else {
			instances[req.body.From].business.shift();
			var currentBusiness = instances[req.body.From].currentBusiness;
			delete instances[req.body.From].savedBusinesses.currentBusiness;
			currentBusiness = instances[req.body.From].business[0];
			var businessID = instances[req.body.From].savedBusinesses[currentBusiness][0];
			yelpClient.reviews(businessID).then(function(response) {
				var review1 = deleteDotDotDot(response.jsonBody.reviews[0].text);
				var review2 = deleteDotDotDot(response.jsonBody.reviews[1].text);
				var review3 = deleteDotDotDot(response.jsonBody.reviews[2].text);
				var concatReviews = review1 + " " + review2 + " " + review3;
				instances[req.body.From].foundLocation = true;
				tone_analyzer.tone({ text: concatReviews },
					function(err, tone) {
						if (err) {
							console.log(err);
						}
						else {
							var toneList = tone["document_tone"]["tone_categories"][0]["tones"];
							var tone = findGreatestEmotion(toneList);
							giphy.translate(tone).then(function(response) {
								var gif = response["data"]["images"]["downsized"]["url"];
								var fromNumber = req.body.From;
								var toNumber = req.body.To;
								twiml.message(currentBusiness + "\n" + "Type next to see another place. Type more for more information. Type research to search again" + " " + gif);
								res.writeHead(200, {'Content-Type': 'text/xml'});
								res.end(twiml.toString());
							}).catch(function (e) {
								console.log(e);
							});
						}
				});
					
			}).catch(function (e) {
				console.log(e);
			});
		}
	}
	else if (instances[req.body.From].location && !(instances[req.body.From].done))
	{
		instances[req.body.From].done = true;
		var yelpToken = yelp.accessToken(YELP_ID, YELP_SECRET).then(function(response) {
			yelpClient = yelp.client(response.jsonBody.access_token);
		}).catch(function(e) {
			console.log(e);
		}).then(function () {
			yelpClient.search({
				term: req.body.Body,
				location: instances[req.body.From].location
			}).then(function(response) {
				instances[req.body.From].business = saveBusinesses(response.jsonBody.businesses, req.body.From);
				instances[req.body.From].currentBusiness = instances[req.body.From].business[0];
				var currentBusiness = instances[req.body.From].currentBusiness;
				var businessID = instances[req.body.From].savedBusinesses[currentBusiness][0];
				yelpClient.reviews(businessID).then(function(response) {
					var review1 = deleteDotDotDot(response.jsonBody.reviews[0].text);
					var review2 = deleteDotDotDot(response.jsonBody.reviews[1].text);
					var review3 = deleteDotDotDot(response.jsonBody.reviews[2].text);
					var concatReviews = review1 + " " + review2 + " " + review3;
					instances[req.body.From].foundLocation = true;
					tone_analyzer.tone({ text: concatReviews },
						function(err, tone) {
							if (err) {
							    console.log(err);
							}
							else {
								var toneList = tone["document_tone"]["tone_categories"][0]["tones"];
								var tone = findGreatestEmotion(toneList);
								giphy.translate(tone).then(function(response) {
									var gif = response["data"]["images"]["downsized"]["url"];
									var fromNumber = req.body.From;
									var toNumber = req.body.To;
									twiml.message(instances[req.body.From].business[0] + "\n" + "Type next to see another place. Type more for more information. Type research to search again" + " " + gif);
									res.writeHead(200, {'Content-Type': 'text/xml'});
									res.end(twiml.toString());
								}).catch(function (e) {
									console.log(e);
								});
							}
					});
					
				}).catch(function (e) {
					twiml.message("No reviews found. Try again http://media1.giphy.com/media/a9xhxAxaqOfQs/giphy.gif");
					res.writeHead(200, {'Content-Type': 'text/xml'});
					res.end(twiml.toString());
					instances[req.body.From].done = false;
					instances[req.body.From].foundLocation = false;
					console.log(e);
				});
			}).catch(function (e) {
				twiml.message("Invalid location. Please enter your location again http://media1.giphy.com/media/a9xhxAxaqOfQs/giphy.gif");
				res.writeHead(200, {'Content-Type': 'text/xml'});
				res.end(twiml.toString());
				instances[req.body.From].done = false;
				instances[req.body.From].location = null;
				instances[req.body.From].foundLocation = false;
				console.log(e);
			})
		});
	}
	else if (!(instances[req.body.From].location))
	{
		twiml.message("Please enter your location first https://media.giphy.com/media/6xgslyYQCyLa8/giphy.gif");
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(twiml.toString());
	}
	else
	{
		twiml.message("Error: Invalid Response https://media.giphy.com/media/6xgslyYQCyLa8/giphy.gif");
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(twiml.toString());
	}
	
});

http.createServer(app).listen(1337, function () {
    console.log("Express server listening on port 1337");
});