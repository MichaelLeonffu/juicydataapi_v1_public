var 	express 		= require('express')
var 	app				= express()
const	path 			= require('path')
var		port 			= process.env.PORT || 3000

var 	morgan 			= require('morgan')
var 	bodyParser 		= require('body-parser')

var 	MongoClient		= require('mongodb').MongoClient
var 	configDB 		= require('./config/database.js')

app.use(morgan('dev')) // log every request to the console
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

MongoClient.connect(configDB.url, function(err,client){
	if(err){
		console.log(err)
		return
	}
	require('./api/api')(app, client.db('JuicyData'))
})

app.listen(port)
console.log('Server started on port ' + port)
