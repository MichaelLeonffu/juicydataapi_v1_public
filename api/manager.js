//manager by Michael Leonffu

// This is the main script that'll run all the other scripts. This is what you'd call manager.js
// This script checks what to do (which events to update) and how to do them.
// This will also be a hub

var MongoClient = require('mongodb').MongoClient
var configDB = require('./../config/database')
var ObjectId = require('mongodb').ObjectID
//var apiKey = require('./../config/apiKey')

module.exports = {}

// Find these at theorangealliance.org
var eventKeys = [
	'1718-CASD-SCHS3', //testing
	

	// '1617-CASD-GAUS', //testing
	// //'1718-CASD-TUR', //Bad events
	// //'1718-CASD-GAUS',
	// //'1718-CASD-EUCL',

	// '1718-FIM-CMP1',	//team 5386
	// '1718-FIM-MARY',
	// '1718-FIM-GLBR',

	// '1718-FIM-CMP2',

	// '1718-OH-AUS'	//Highest scoreing 593
]
var matchAndGameData = require('./orangeFarm/matchAndGameData.js')
var locationsAndEventsAndSchedules = require('./orangeFarm/locationsAndEventsAndSchedules.js')
var initializeMatchData = require('./orangeFarm/initializeMatchData.js')

function manager(){
	matchAndGameData(eventKeys, function() {
		MongoClient.connect(configDB.url, function(err,client){
			var db = client.db('JuicyData')
			if(err){
				console.log(err)
				return
			}else{

				var orangeFarm = require('./orangeFarm/orangeFarm') // load our routes and pass in our app
				var orchardList = eventKeys

				for (var i = 0; i < orchardList.length; i++) {
					//orchardList[i]
					orangeFarm({db:db, ObjectId:ObjectId}, orchardList[i], function(farmReport){
						console.log('farmReport:', farmReport, 'At:', new Date())
					})
				}
			}
		})
	})
	setTimeout(manager, 240000)
}

if (process.argv[2] === 'init') {
	locationsAndEventsAndSchedules(eventKeys, function() {
		initializeMatchData(eventKeys, function() {
			process.exit()
		})
	})
} else {
	manager()
}
