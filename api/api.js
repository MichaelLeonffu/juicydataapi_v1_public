//api by Michael Leonffu
module.exports = function(app, db, ObjectId) {
//require('./module')(app) This is the example; template IF THERE ARE MORE APIs

app.get('/api', function(req, res) {
	res.send('api home')
})

app.get('/api/version', (req, res) =>{
	res.send('v1.0-beta')
})

//Add a GET for /api/events/read; replace current api with /api/event/read.
//Events to get events while event to get one eventOut

app.get('/api/events/read', (req, res) =>{
	db.collection('eventOut').findOne(
		{
			_id: req.query.eventId
		},
		function(err, eventDoc){
			if(err){
				console.log(err)
				res.status(500).send(err)
				return
			}
			if(eventDoc){
				//Return a document if found
				res.json(eventDoc)
			}else{
				//If no event is returned
				res.status(400).send('Event not found')
			}
		}
	)
})

app.get('/api/predict', (req, res) =>{

	const algorithms = require('./algorithms/algorithms')

	// req.query = {
	// 	eventId: 'abc',
	// 	algorithm: 'abc',
	// 	alliance1team1: 123,
	// 	alliance1team2: 123,
	// 	alliance2team1: 123,
	// 	alliance2team2: 123
	// }

	// res = {
	// 	prediction: {		//REQUIRED?
	// 		winner: 'abc',	//Alliance1 or Alliance2
	// 		chance: .123,	//Chance this is winner in 00.00%	-1 if no value
	// 		alliance1: {
	// 			score: .123	//predicted score
	// 		},
	// 		alliance2: {
	// 			score: .123
	// 		}
	// 	},
	// 	model: [	//For every match given
	// 		{
	// 			matchNumber: 123,
	// 			prediction: 'abc',	//red or blue
	// 			blueScore: 123,
	// 			redScore: 123,
	// 			certainty: .123		//as 00.00%; -1 if no value
	// 		}
	// 	]
	// }

	console.log(req.query)

	db.collection('events').aggregate([
		{$match: {
			_id: String(req.query.eventId)
		}},
		{$lookup:{
			from: 'matchData',
			let: {eventToaEventKey: '$_id'},
			pipeline: [
				{$match:{$expr:
					{$eq: ['$_id.toaEventKey', '$$eventToaEventKey']}
				}},
				{$project:{
					_id: 0,
					matchNumber: '$_id.matchInformation.matchNumber',
					teams: '$_id.matchInformation.teams',
					winner: '$resultInformation.winner',
					score: '$resultInformation.score'
				}}
			],
			as: 'matchData'
		}},
		{$lookup:{
			from: 'gameData',
			let: {eventToaEventKey: '$_id'},
			pipeline: [
				{$match:{$expr:
					{$eq: ['$_id.toaEventKey', '$$eventToaEventKey']}
				}},
				{$project:{
					_id: 0,
					matchNumber: '$_id.matchInformation.matchNumber',
					teams: '_id.matchInformation.teams',
					gameInformation: '$gameInformation'
				}}
			],
			as: 'gameData'
		}},
		{$project:{
			metaData: {
				toaEventKey: '$_id',
				matches: 101
			},
			data: {
				matchData: '$matchData',
				gameData: '$gameData'
			}
		}}
	], cursorHandle)

	function cursorHandle(err, cursor){
		if(err){
			console.log(err)
			return
		}
		cursor.toArray(predict)
	}

	function predict(err, eventsDocs){
		if(err){
			console.log(err)
			res.status(500).send(err)
			return
		}
		if(eventsDocs){
			//Document is found, running algorithms
			res.json(algorithms.algorithmLoader('simpleOPR',eventsDocs[0],{
				alliance1: {
					team1: Number(req.query.alliance1team1),
					team2: Number(req.query.alliance1team2)
				},
				alliance2: {
					team1: Number(req.query.alliance2team1),
					team2: Number(req.query.alliance2team2)
				},
			}))
		}else{
			//If no document is found then
			res.status(400).send('Events not found')
		}
	}
})

app.get('/api/teams/read', (req, res) =>{

	// res = {
	// 	teamName: 'abc',
	// 	current: {
	// 		eventInformation: eventInformation:{
	// 			date: ISODate(), //ISO Date of when it occured;
	// 			eventName: 'abc',
	// 			locationName: 'abc',	//Same as the name in the locations collection
	// 			locationID: ObjectId(), //ID of the location in the 'locations' collection
	// 			teamsList:[123, 123, 123],
	// 			season: 'Y1Y2', //for relic recovery 2017-2018 the season is '1718'
	// 		},
	// 		ranking: {},	//Just like the eventOut schema
	// 		matchHistory: [{}],	//Array of all the matchHisotrys from evenOut schema
	// 		averageScore: {}
	// 	},
	// 	old: []	//Schema is just like current expect its an Array for all events that are given
	// }

	//$eq: req.query.teamNumber

	db.collection('events').aggregate([
		{$match:{
			'eventInformation.teamsList': {$elemMatch:{
				$eq: Number(req.query.teamNumber)
			}}
		}},
		{$sort:{
			'eventInformation.date': -1
		}},
		{$lookup:{
			from:'eventOut',
			let: {eventToaEventKey: '$_id'},
			pipeline: [
				{$match:{$expr:
					{$eq: ['$_id', '$$eventToaEventKey']}
				}},
				{$unwind: '$ranking'},
				{$match:{
					'ranking.teamNumber': Number(req.query.teamNumber)
				}},
				{$unwind: '$averageScores'},
				{$match:{
					'averageScores.teamNumber': Number(req.query.teamNumber)
				}},
				{$unwind: '$matchHistory'},
				{$group:{
					_id: '$matchHistory.matchNumber',
					eventOut: {$push:'$$ROOT'}
				}},
				{$project:{
					red: {$arrayElemAt:['$eventOut',0]},
					blue: {$arrayElemAt:['$eventOut',1]}
				}},
				{$match:{$expr:{
					$or: [
						{$eq: ['$red.matchHistory.team1.teamNumber', Number(req.query.teamNumber)]},
						{$eq: ['$red.matchHistory.team2.teamNumber', Number(req.query.teamNumber)]},
						{$eq: ['$blue.matchHistory.team1.teamNumber', Number(req.query.teamNumber)]},
						{$eq: ['$blue.matchHistory.team2.teamNumber', Number(req.query.teamNumber)]}
					]
				}}},
				{$project:{
					_id: '$red._id',
					lastUpdated: '$red.lastUpdated',
					eventInformation: '$red.eventInformation',
					ranking: '$red.ranking',
					matchHistory: {
						red: '$red.matchHistory',
						blue: '$blue.matchHistory'
					},
					averageScores: '$red.averageScores'
				}},
				{$sort:{
					'matchHistory.red.matchNumber': 1
				}},
				{$group:{
					_id:{
						_id: '$_id',
						lastUpdated: '$lastUpdated',
						ranking: '$ranking',
						averageScore: '$averageScores'
					},
					matchHistory: {$push: '$matchHistory'}
				}}
			],
			as:'eventOut'
		}},
		{$unwind:'$eventOut'},
		{$group:{
			_id: 'Anna Li',
			events: {$push:{
				_id: '$_id',
				eventInformation: '$eventInformation',
				lastUpdated: '$eventOut._id.lastUpdated',
				ranking: '$eventOut._id.ranking',
				matchHistory: '$eventOut.matchHistory',
				averageScore: '$eventOut._id.averageScore'
			}}
		}},
		{$facet:{
			current:[
				{$project:{
					_id: 0,
					event: {$arrayElemAt:['$events',0]}
				}}
			],
			old:[
				{$project:{
					_id: 0,
					event: {$slice:[
						'$events',{$multiply:[{$subtract:[{$size:'$events'},1]},-1]}
					]}
				}}
			]
		}},
		{$lookup:{
			from:'teams',
			pipeline: [
				{$match:{$expr:
					{$eq: ['$_id', Number(req.query.teamNumber)]}
				}}
			],
			as:'teamInformation'
		}},
		{$unwind:'$teamInformation'},
		{$project:{
			teamName: {$arrayElemAt: [{$split: ['$teamInformation.team_name_short', ', Team #']},0]},
			teamNumber: Number(req.query.teamNumber),
			current: {$arrayElemAt:['$current.event',0]},
			old: {$arrayElemAt:['$old.event',0]}
		}}
		// {$addFields:{
		// 	teamName: {$arrayElemAt: [{$split: ['$teamInformation.team_name_short', ', Team #']},0]},
		// 	teamNumber: Number(req.query.teamNumber)
		// }}
	], cursorHandle)

	function cursorHandle(err, cursor){
		if(err){
			console.log(err)
			return
		}
		cursor.toArray(calcHandle)
	}
	
	function calcHandle(err, teamsDocs){
		if(err){
			console.log(err)
			res.status(500).send(err)
			return
		}

		if(teamsDocs){
			//If there is a document
			res.json(teamsDocs[0])
		}else{
			//If no documents are returned
			res.status(400).send('Events not found')
		}
	}
})

app.post('/api/data/uploadSchedule', (req, res) =>{

	// res = {
	// 	{
	// 		_id: 'abc', //toaEventKey
	// 		schedule:[ //Aray of JSON
	// 			{
	// 				matchNumber: 123, //Match Number
	// 				teams:{
	// 					red1: {
	// 						teamNumber: 123,
	// 						surrogate: false //True if this team was surrogate
	// 					},
	// 					red2: {
	// 						teamNumber: 123,
	// 						surrogate: false
	// 					},
	// 					blue1: {
	// 						teamNumber: 123,
	// 						surrogate: false
	// 					},
	// 					blue2: {
	// 						teamNumber: 123,
	// 						surrogate: false
	// 					}
	// 				}
	// 			}
	// 		]
	// 	}
	// }

	console.log(req.body)
	console.log("post body")

	//$eq: req.query.teamNumber
	db.collection('schedules').save(req.body, {w:1}, function(err, result){
		if(err)
			console.log(err)

		console.log(result)

		//if no error?
		res.status(200).send("Got It")
	})

	// res.status(200).send("Got It")

})

app.post('/api/data/uploadSync', (req, res) =>{

	// req = {
	// 	gameData: [
	// 		{
	// 			_id:{
	// 				toaEventKey: 'abc',
	// 				matchInformation:{
	// 					matchNumber: 123,
	// 					robotAlliance: 'abc', //blue or red; with lower case
	// 					teams: [123, 123]
	// 				}
	// 			}
	// 			gameInformation:{	//CHECK IF ALL THSES TYPES ARE CORRECT AND ALSO HAVE COFRRECT MEANING!
	// 				auto:{
	// 					jewel: 123,
	// 					glyphs: 123,
	// 					keys: 123,
	// 					park: 123
	// 				},
	// 				driver:{
	// 					glyphs: 123,
	// 					rows: 123,
	// 					columns: 123,
	// 					cypher: 123
	// 				},
	// 				end:{
	// 					relic1: 123,	//Amount of relics in that zone
	// 					relic2: 123,
	// 					relic3: 123,
	// 					relicsUp: 123,	//Amount of relects standing up
	// 					balanced: 123	//How many robots are balanced
	// 				}
	// 			}
	// 		}
	// 	],
	// 	matchData: [
	// 		{
	// 			_id:{
	// 				toaEventKey: 'abc',
	// 				matchInformation:{
	// 					matchNumber: 123,
	// 					teams: {
	// 						red1: 123,
	// 						red2: 123,
	// 						blue1: 123,
	// 						blue2: 123
	// 					}
	// 				}
	// 			},
	// 			resultInformation:{
	// 				winner: 'abc', //'blue', 'red', 'tie'
	// 				score:{
	// 					auto:{
	// 						red: 123, //red alliance autonomous score
	// 						blue: 123 //blue alliance autonomous score
	// 					},
	// 					driver:{
	// 						red: 123, //red alliance tele-op score
	// 						blue: 123 //blue alliance tele-op score
	// 					},
	// 					end:{
	// 						red: 123, //red alliance end-game score
	// 						blue: 123 //blue alliance end-game score
	// 					},
	// 					total:{
	// 						red: 123, //red alliance total score
	// 						blue: 123 //blue alliance total score
	// 					},
	// 					penalty:{
	// 						red: 123, //red alliance penalty score
	// 						blue: 123 //blue alliance penalty score
	// 					},
	// 					final:{
	// 						red: 123, //red alliance final score
	// 						blue: 123 //blue alliance final score
	// 					}
	// 				}
	// 			}
	// 		}
	// 	]
	// }

	console.log(req.body.gameData)

	var theEventToaEventKey = getToaKey()

	saveGameDataInOrder(req.body.gameData)

	function saveGameDataInOrder(arrayOfGameData){
		if(arrayOfGameData.length <= 0){
			//no data? or done
			saveMatchDataInOrder(req.body.matchData)
		}else{
			db.collection('gameData').save(arrayOfGameData[0], {w:1}, function(err, result){
				if(err){
					console.log("error gameData")
					console.log(err)
				}else{
					console.log("no error gameData")
				}
				arrayOfGameData.shift()	//remove first element
				saveGameDataInOrder(arrayOfGameData)
			})
		}
	}

	function saveMatchDataInOrder(arrayOfMatchData){
		if(arrayOfMatchData.length <= 0){
			//no data? or done
			finalStep()
		}else{
			db.collection('matchData').save(arrayOfMatchData[0], {w:1}, function(err, result){
				if(err){
					console.log("error matchData")
					console.log(err)
				}else{
					console.log("no error matchData")
				}
				arrayOfMatchData.shift()	//remove first element
				saveMatchDataInOrder(arrayOfMatchData)
			})
		}
	}

	function getToaKey(){//using req body
		var eventToaEventKey = ""
		if(req.body.matchData.length != 0){
			var eventToaEventKey = req.body.matchData[0]._id.toaEventKey
		}else if(req.body.gameData.length != 0){
			var eventToaEventKey = req.body.gameData[0]._id.toaEventKey
		}else{
			console.log("CANNOT GET TOAEVENTKEY LOL RIP!")
			//Throws excpetion here
		}
		console.log(eventToaEventKey)

		return eventToaEventKey
	}

	function finalStep(){
		var orangeFarm = require('./orangeFarm/orangeFarm') // load our routes and pass in our app

		orangeFarm({db:db, ObjectId:ObjectId}, "1718-CAL-GAMES", function(farmReport){
			console.log('farmReport:', farmReport, 'At:', new Date())
			//this is good
			res.status(200).send("Got It Good")
			//but when is it bad?
		})
	}

})

}
