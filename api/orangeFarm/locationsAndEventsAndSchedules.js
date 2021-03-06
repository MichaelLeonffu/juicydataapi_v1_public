var MongoClient = require('mongodb').MongoClient
var url = "mongodb://localhost:27017"

var apiKey = require('./../../config/apiKey.js')
var axios = require('axios')
var toaApi = axios.create({
	baseURL: 'http://theorangealliance.org/apiv2/',
	timeout: 10000,
	headers: {'X-Application-Origin': 'JuicyData', 'X-TOA-Key': apiKey}
})

var forceUpdate = true //Set to true to write to database even if data exists, 
						//and even if schedule is empty, but you still want the event.

var completedEvents = []

module.exports = getData

function getData(eventKeys, callback) {
	completedEvents = []
	MongoClient.connect(url, function(err, client) {
		var db = client.db('JuicyData')
		if (err) throw err

		let finishIfDone = function() {
			if (completedEvents.length === eventKeys.length) {
				//db.close()
				console.log('Done saving locations, events, and schedules!')
				callback()
			}
		}

		for (let eventKey of eventKeys) {
			db.collection('events').findOne({'_id': eventKey}, function(err, data) {
				if (err) throw err
				if (data && !forceUpdate) {
					console.log(eventKey + ' event already exists in the database. Skipping.')
					completedEvents.push(eventKey)
					finishIfDone()
				} else {
					toaApi.get('/event/' + eventKey).then(function(response) {
						let event = response.data[0]
						toaApi.get('/event/' + eventKey + '/teams').then(function(response) {
							let teams = response.data
							toaApi.get('/event/' + eventKey + '/matches/stations').then(function(response) {
								let stations = response.data
								if (stations.length === 0 && !forceUpdate) {
									console.log('No stations available from TOA for ' + eventKey + ' event!')
									completedEvents.push(eventKey)
									finishIfDone()
								} else {
									console.log('Writing ' + eventKey + ' event!')

									let insertEventAndSchedule = function(location) {
										// let eventInformation = {
										// 	toaEventKey: event.event_key,
										// 	date: event.start_date
										// }

										let teamsList = []
										for (let team of teams) {
											teamsList.push(Number(team.team_key))
										}

										let matchNumbers = []
										let teamsByMatch = {}
										let statusByMatch = {}
										for (let station of stations) {
											let matchNumber = station.match_name.split('Quals ')[1]
											if (matchNumber) {
												if (!teamsByMatch[matchNumber]) {
													teamsByMatch[matchNumber] = station.teams.split(',')
													statusByMatch[matchNumber] = station.station_status.split(',')
													matchNumbers.push(matchNumber)
												}
											}
										}

										let scheduledMatches = []
										for (let matchNumber of matchNumbers) {
											let matchTeams = teamsByMatch[matchNumber]
											let matchStatus = statusByMatch[matchNumber]
											scheduledMatches.push({
												matchNumber: Number(matchNumber),
												teams: {
													red1: {
														teamNumber: Number(matchTeams[0]),
														surrogate: Number(matchStatus[0]) === 0
													},
													red2: {
														teamNumber: Number(matchTeams[1]),
														surrogate: Number(matchStatus[1]) === 0
													},
													blue1: {
														teamNumber: Number(matchTeams[2]),
														surrogate: Number(matchStatus[2]) === 0
													},
													blue2: {
														teamNumber: Number(matchTeams[3]),
														surrogate: Number(matchStatus[3]) === 0
													}
												}
											})
										}

										db.collection('events').save({
											// _id: eventInformation,
											_id: event.event_key,
											eventInformation:{
												date: new Date(event.start_date),
												eventName: event.event_name,
												locationName: location ? location.name : null,
												locationID: location ? location._id : null,
												teamsList: teamsList,
												season: event.season_key
											}
										}, function(err) {
											if (err) throw err
											db.collection('schedules').save({
												// _id:{
												// 	eventInformation: eventInformation
												// },
												_id: event.event_key,
												schedule: scheduledMatches
											}, function(err) {
												if (err) throw err
												completedEvents.push(event.event_key)
												finishIfDone()
											})
										})
									}

									if (!event.venue) {
										console.log('TOA event ' + eventKey + ' does not have enough location information!')
										insertEventAndSchedule(null)
									} else {
										db.collection('locations').findOne({
											'name': event.venue,
											'address.city': event.city,
											'address.state': event.state_prov,
											'address.country': event.country
										}, function(err, data) {
											if (err) throw err
											if (data) {
												console.log('Location ' + event.venue + ' already exists in the database. Using it.')
												insertEventAndSchedule(data)
											} else {
												console.log('Writing location ' + event.venue + '!')
												let location = {
													name: event.venue,
													address: {
														city: event.city,
														state: event.state_prov,
														country: event.country
													}
												}
												db.collection('locations').save(location, function(err) {
													if (err) throw err
													insertEventAndSchedule(location)
												})
											}
										})
									}
								}
							})
						})
					})
				}
			})
		}
	})
}
