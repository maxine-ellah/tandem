var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var path = require('path')
var bcrypt = require('bcrypt-node')
var Knex = require('knex')
var passport = require('passport')
var FacebookStrategy = require('passport-facebook').Strategy
var cookie = require('cookie-parser')
var port = process.env.PORT || 3000
var toTitleCase = require('to-title-case')
var moment = require('moment')
moment().format();

var knexConfig = require('./knexfile')
var env = process.env.NODE_ENV || 'development'
var knex = Knex(knexConfig[env])

if (env == 'development') {
  var dotenv = require('dotenv')
  dotenv.load()
}

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'hbs')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(require('cookie-parser')())
app.use(require('express-session')({ secret: 'abandoned  birds', resave: true, saveUninitialized: true }))
app.use(passport.initialize())
app.use(passport.session())


function search(origin, destination){
	var searchObject = {origin: origin}
	if(destination){
		searchObject.destination = destination
	}
	return knex('listings').where(searchObject).innerJoin('users', 'listings.userID', '=', 'users.userID')
}

function singleListing(listingID){ // check if needed
	return knex('listings').where({listingID: listingID}).innerJoin('users', 'listings.userID', '=', 'users.userID')
}

function displayListingUserCommentData (listingID){
	return knex('listings').where({'listings.listingID': listingID}).
	leftOuterJoin('comments', 'comments.listingID', '=', 'listings.listingID').
	rightOuterJoin('users', 'users.userID', '=', 'listings.userID').
	select('*')
}

function prettifyDates(array) {
	return array.map(function(listing){
		listing.departureTime = moment(listing.departureTime, 'hhmm').format("HH:mm a")
		listing.departureDate = moment(listing.departureDate).format('dddd, Do MMMM YYYY')
		return listing
	})
}

function prettifyListingDate (listing) {
    listing.departureTime = moment(listing.departureTime, 'hhmm').format("HH:mm a")
    listing.departureDate = moment(listing.departureDate).format('dddd, Do MMMM YYYY')
    return listing
}

app.get('/', function(req, res){
	res.render('main', { layout: '_layout' })
})

app.get('/howItWorks', function(req,res){
	res.render('howItWorks', {layout: '_layout'})
})

app.get('/currentListings', function(req, res){
  console.log('currentListings get route')
	var origin = toTitleCase(req.query.origin)
	var destination = toTitleCase(req.query.destination)
	search(origin, destination)
	.then(function(listings){
		res.render('./currentListings/currentListings', {layout: '_layout' , listing: prettifyDates(listings)})
	})
})

//============Create a Listing================
//
app.get('/createListing', function (req, res) {
	res.render('createListing', {layout: '_layout'})
})
//heidi is working here
app.post('/createListing', function (req, res) {
	// check out req.session.userId ,
	// if it's present then use it, otherwise redirect this persion to login?
  var listing = req.body
  var testingUserID = 2
  knex('listings').insert({
    origin: listing.origin,
    destination: listing.destination,
    departureDate: listing.departureDate,
    departureTime: listing.departureTime,
    description: listing.description,
    userID: testingUserID})
  .then(function (data) {
    res.render('listingConfirm', {data: prettifyListingDate(listing), layout: '_layout'})
  })
  .catch(function (error) {
    console.log("error", error)
  })
})

app.post('/main', function(req, res) {
	var originFromMain = req.body.origin
	var destinationFromMain = req.body.destination
	search(originFromMain, destinationFromMain)
	.then(function(data) {
		res.redirect('/currentListings?origin=' + originFromMain + '&destination='  + destinationFromMain)
	})
})

app.get('/singleListing', function(req, res) {
  var listingID = req.query.listingID
  displayListingUserCommentData(listingID)
  .then(function(data) {
    data[0].listingID = listingID
    data = prettifyDates(data)
    res.json(data)
  })
  .catch(function(error){res.status(418); console.log(error)})
})

app.post('/listings/:id/comment', function(req, res){
  var comment = req.body.comment
  var listingID = req.params.id
  knex('comments')
    .insert({comment: comment, listingID: listingID })
    .then(function(){
      return displayListingUserCommentData(listingID)
    })
    .then(function(data){
      res.send(data)
    })
})

app.post('/moreCurrentListings', function(req, res) {
	var origin = toTitleCase(req.body.origin)
	var destination = toTitleCase(req.body.destination)
	search(origin, destination)
	.then(function(listings) {
		res.json(prettifyDates(listings))
	})
})

// ===============Create a profile==========================

app.get('/profile', function(req, res){
	var testUserID = 2
	knex('users'). where({userID: testUserID})
	.then(function(data){
		res.render('profile', {layout: '_layout'})
	})
})

app.post('/profile', function (req, res) {
	var profile = req.body
	knex('users').where({userID: 2}).update({age: profile.age, gender: profile.gender, driverLicenceDuration: profile.driverLicenceDuration, aboutMe: profile.aboutMe})
	.then (function(data){
		res.render('profileConfirm', {layout: '_layout'})
	})
})

app.post('/createListing', function (req, res) {
  knex('listings').insert(req.body)
  .then(function (data) {
    res.render('listingConfirm', {layout: '_layout'})
  })
  .catch(function (error) {
    console.log("error", error)
  })
})



app.post('/moreCurrentListings', function(req, res) {
  var origin = toTitleCase(req.body.origin)
  var destination = toTitleCase(req.body.destination)
  search(origin, destination)
  .then(function(listings) {
    res.json("data", prettifyDates(listings))
  })
})

//===================Ride Confirmation====================


app.post('/liftConfirm', function (req, res){
	var listingID = req.body.listingID
		return displayListingUserCommentData(listingID)
		.then(function(rideInfo) {
		 res.json(prettifyDates(rideInfo))
	})
})

//===== sessions need to be implemented to be fully functional ======

app.post('/liftEnjoy', function(req, res) {
	var description = req.body.description
	var listingID = req.body.listingID
	console.log("listingID: ",listingID)
	knex('ride_requests').insert({listingID:listingID, description:description})
	.then (function()  {
		knex('listings').where({listingID: listingID}).update({ride_requested: true})
	})
	.then (function(data){
		res.json(data)
	})
})


//===================Authorisation Code===================

app.get('/signup', function (req, res) {
  res.render('register', {layout: '_layout'})
})

app.get('/signin', function (req, res) {
  res.render('login', {layout: '_layout'})
})

app.post('/signup', function (req, res) {
  var hash = bcrypt.hashSync( req.body.password)
  knex('users').insert({ email: req.body.email, hashedPassword: hash })
  .then(function(data){
    res.redirect('/')
  })
  .catch(function(error){
    console.log("error:", error)
    res.send('Error, please refresh the page and try again')
  })
})

app.post ('/login', function(req,res) {
  knex('users').where({email: req.body.email})
  .then (function(data){
    var hashedLogin = data[0].hashedPassword
    if  (bcrypt.compareSync(req.body.password, hashedLogin)) {
      res.redirect('/')
    }
  })

  .catch (function (error) {
    console.log("error:", error)
    res.sendStatus(403)
  })
})

// //============== OAuth =====================

app.get('/auth/facebook', passport.authenticate('facebook'))

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
    function (req, res) {
      res.redirect('/')
    }
  )

passport.use(new FacebookStrategy ({
	clientID: process.env.FACEBOOK_CLIENT_ID,
	clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
	callbackURL: "http://localhost:3000/auth/facebook/callback"
},
function (accessToken, refreshToken, profile, callback) {
	knex('users').select('*').where({
		facebookID: profile.id
	}).then(function (resp) {
		if (resp.length === 0) {
			var user = {
				facebookID: profile.id,
				name: profile.displayName
			}

			// //============== set user in session ===================
			//Set user in session
			knex('users').insert(user).then(function (resp) {
				callback(null, user)
			})
		} else {
			callback(null, resp[0])
		}
	})
}
))

passport.serializeUser(function(user, callback) {
	callback(null, user)
})
passport.deserializeUser(function(obj, callback) {
	callback(null, obj)
})

//============== Auth Ends ============================

app.listen(port, function () {
	console.log('catching a lift on ' + port  + ' !!')
})

module.exports = app;
