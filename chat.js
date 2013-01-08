var express = require('express'); // Loads Express Module
var http = require('http'); // Loads HTTP Module
var io = require('socket.io'); // Loads socket IO Module - For communicating clients using webservice
var crypto = require('crypto'); // Loads crypto Module - For Encryption
var path = require('path'); // Loads path Module
var partials = require('express-partials'); // Loads Express Partials - To Use default "Layout".
var port = process.env.PORT || 3000;
//var MemoryStore = express.session.MemoryStore;

var db;
var app = express();
var httpServer = http.createServer(app);
var socket = io.listen(httpServer);


var profileInfo = {};

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  //app.use(app.router);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.cookieParser());
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


var mongo = require('mongodb');

var mongoUri = process.env.MONGOLAB_URI || 
  process.env.MONGOHQ_URL || 
  'mongodb://localhost:27017/test';
  
var ObjectID = mongo.ObjectID;

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
/*var server = new Server('yogen:welcome@ds047387.mongolab.com', 47387, {auto_reconnect: true});
db = new Db('heroku_app10771813', server);
 
db.open(function(err, db) {
    if(!err) {
        console.log("Connected to 'heroku_app10771813' database");
        db.collection('chatusers', {safe:true}, function(err, collection) {
            if (err) {
                console.log("The 'chatusers' collection doesn't exist.");
            }
        });
    }
});
*/

var server = new Server('mongodb://yogen:welcome1@ds047387.mongolab.com:47387/heroku_app10771813');
db = new Db('heroku_app10771813', server);

db.open(function(err, db) {
    if(!err) {
        console.log("Connected to 'heroku_app10771813' database");
        db.collection('chatusers', {safe:true}, function(err, collection) {
            if (err) {
                console.log("The 'chatusers' collection doesn't exist.");
            }
        });
    }
});

/*mongo.Db.connect(mongoUri, function (err, db) {
  db = db;
  db.collection('chatusers', function(er, collection) {
  	if (err) {
    	console.log("The 'chatusers' collection doesn't exist.");
    }
  });
});
*/
app.use(partials());

app.get('/', function(req, res) {
	res.clearCookie('userCookie');
	res.render('index.ejs', {title: 'Chat-Login'});
});

app.get('/register', function(req, res) { 
	res.render('reg.ejs', {title: 'Chat-Register'});
});

app.post('/reg_success', function(req, res) {
	var full_name = req.body.full_name;
	var pass =  req.body.pass;
	var repass =  req.body.repass;
	var email = req.body.email;
	if(full_name && email) {
		db.collection('chatusers', function(err, collection) { 
			collection.findOne({'email': email}, {safe: true}, function(err, item){
				if(!item || !item._id) {
					if(pass === repass) {
						var record = [
							{
								fullname: full_name,
								email: email,
								password: crypto.createHash('md5').update(pass).digest("hex")
							}
						];
						
						console.log("Inserting Record: ");
						console.log(record);
						db.collection('chatusers', function(err, collection) { 
							collection.insert(record, {safe:true}, function(err, result){});
						});
						
						res.render('reg_success.ejs', {
							title: 'Chat-Registration Success',
							fullName: full_name,
							email: email,
						});
					}
					else {
						res.status(404).render('error.ejs', {
							title: 'Chat-Error',
							msg: 'Passwords did not match. Please Try Again...',
							url: '/register'
						});
					}
				}
				else {
					res.status(404).render('error.ejs', {
						title: 'Chat-Error',
						msg: 'Your record already Exists! Please Signin with your credentials...',
						url: '/'
					});				
				}
				
			});
		});
	}
	else {
		res.status(404).render('error.ejs', {
			title: 'Chat-Error',
			msg: 'Please Enter Full Name and/or Email!',
			url: '/register'
		});
	}
});

app.get('/reg_success', function(req, res) {
	res.redirect('/');
	
});

app.get('/enter_chat', function(req, res) {
	var userCookie = req.cookies.userCookie;
	if(userCookie) {
		var objId = new ObjectID(userCookie);
		db.collection('chatusers', function(err, collection) {
			collection.findOne({_id: objId}, function(err, item){
				res.render('enter_chat.ejs', {
					title: 'Enter Chat',
					username: item.fullname
				});
			});
		});
	}
	else {
		res.status(404).render('error.ejs', {
			title: 'Chat-Error',
			msg: 'You are not logged in... Please login....',
			url: '/'
		});
	}
});

app.post('/enter_chat', function(req, res) {
	var username = req.body.user;
	var pass =  crypto.createHash('md5').update(req.body.password).digest("hex");
	db.collection('chatusers', function(err, collection) { 
		collection.findOne({ $and: [{'email': username}, {'password': pass}]}, function(err, item){
			if(item && item._id) {
				res.cookie('userCookie', item._id);
				res.render('enter_chat.ejs', {
					title: 'Enter Chat',
					username: item.fullname
				});
				profileInfo.fullname = item.fullname;
				profileInfo.email = item.email;
				
				socket.configure(function () { 
				  socket.set("transports", ["xhr-polling"]); 
				  socket.set("polling duration", 10); 
				});
							
				socket.on('connection', function(client) {
					var username = item.fullname, sendData;
						
					client.on('disconnect', function() {
						if(username) {
						sendData = username + ' Left';
						client.broadcast.emit('message', { data: sendData });
						}
					});
					client.on('emitData', function(msg) {
						if(!username) {
							username = msg.data;
							sendData = 'Welcome, ' + username + '!';
							client.emit('message', { data: sendData });
							sendData = username + ' connected';
							client.broadcast.emit('message', { data: sendData });
							//client.emit('clientData', {data: ('Welcome, ' + username + '!')});
							return;
						}
						if(msg.data) {
							sendData = username + ' said: ' + msg.data;
							client.broadcast.emit('message', { data: sendData }); //To broadcast other clients
							client.emit('message', { data: sendData }); //local client
						}
						//socket.broadcast.emit(username + ' said: ' + msg.data);
					});
				});
			}
			else {
				res.status(404).render('error.ejs', {
					title: 'Chat-Error',
					msg: 'Invalid Username/Password!',
					url: '/'
				});
			}
		});
	});
	
	
});

app.get('/update_profile', function(req, res) {
	var userCookie = req.cookies.userCookie;
	if(userCookie) {
		res.render('update_profile.ejs', {
			title: 'Chat-Update Profile',
			fullname: profileInfo.fullname,
			email: profileInfo.email
		});
	}
	else {
		res.status(404).render('error.ejs', {
			title: 'Chat-Error',
			msg: 'You are not logged in... Please login....',
			url: '/'
		});
	}
});

app.post('/update_success', function(req, res) {
	var full_name = req.body.full_name;
	var pass =  req.body.pass;
	var repass =  req.body.repass;
	var email = req.body.email;
	if(full_name && email) {
		var userCookie = req.cookies.userCookie;
		if(userCookie) {
			if(pass === repass) {
				var objId = new ObjectID(userCookie);
				if(!pass) {
					db.collection('chatusers', function(err, collection) {
						collection.update({ _id: objId }, {$set: { fullname: full_name, email: email }});
					});
				}
				else {
					var passCrypt = crypto.createHash('md5').update(pass).digest("hex");
					db.collection('chatusers', function(err, collection) { 
						collection.update({ _id: objId }, {$set: { fullname: full_name, email: email, password: passCrypt }});
					});
				}
				profileInfo.fullname = full_name;
				profileInfo.email = email;
				res.render('update_success.ejs', {
					title: 'Chat- Update Success',
					fullName: full_name,
					email: email
				});
			}
			else {
				res.status(404).render('error.ejs', {
					title: 'Chat-Error',
					msg: 'Passwords did not match. Please Try Again...',
					url: '/update_profile'
				});
			}
		}
		else {
			res.status(404).render('error.ejs', {
				title: 'Chat-Error',
				msg: 'You are not logged in... Please login....',
				url: '/'
			});
		}
	}
});

app.get('/forgot', function(req, res) { 
	res.render('forgot.ejs', {title: 'Chat- Forgot Password'});
});

app.get('/delete_profile', function(req, res) { 
	res.render('delete_profile.ejs', {title: 'Chat- Delete Profile'});
});

app.get('/delete_success', function(req, res) {
	var userCookie = req.cookies.userCookie;
	if(userCookie) {
		var objId = new ObjectID(userCookie);
		db.collection('chatusers', function(err, collection) {
			collection.remove({_id: objId}, function(err, item){		
			});
		});
		res.clearCookie('userCookie');
		res.render('delete_success.ejs', {title: 'Chat - Are you Sure?'});
	}
	else {
		res.status(404).render('error.ejs', {
			title: 'Chat-Error',
			msg: 'You are not logged in... Please login....',
			url: '/'
		});
	}
});

httpServer.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});