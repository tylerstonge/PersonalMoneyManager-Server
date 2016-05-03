var http = require("http");
var fs = require("fs");
var dispatcher = require('httpdispatcher');


var file = "pmm.db";
var exists = fs.existsSync(file);

if (!exists) {
	console.log("creating database file.");
	fs.openSync(file, "w");
}


var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(file);
const PORT = 8080;

/**
 * Create the database
 */
db.serialize(function() {
	if(!exists) {
		db.run("CREATE TABLE users ( id integer primary key asc, userid integer not null, totalratio float not null)");
	}
});

/**
 * Dispatcher method to determine which url is being requested.
 */
function handleRequest(req, res) {
	try {
		console.log(req.url);
		dispatcher.dispatch(req, res);
	} catch(err) {
		console.log(err);
	}
}

/**
 * Main page is requested, send them a cool message
 */
dispatcher.onGet("/", function(req, res) {
	res.writeHead(200, {'Content-Type': 'application/json'});
	res.end("PersonalMoneyManager API");
});

/**
 * Main POST call to get all ratio's from user
 *
 * userid - id number unqiue to one user
 * totalratio - the ratio of purchases  / household size
 */
dispatcher.onPost("/", function(req, res) {
	// get the data passed from request
	var data = JSON.parse(req.body);
	
	// assure all required fields are set and valid
	if (data.userid != null && data.totalratio != null) {
		console.log("userid:" + data.userid + ";totalratio:" + data.totalratio); 
	}	
	
	db.serialize(function() {
		db.run("INSERT OR REPLACE INTO users (id, userid, totalratio) VALUES ((SELECT id FROM users WHERE userid = ?), ?, ?)", data.userid, data.userid, data.totalratio); 
	});
	res.writeHead(200, {'Content-Type': 'application/json'});	
	res.end(req.body);
});

var generateId = function() {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	var userid = '';
	var length = 64;
	for (var i = length; i > 0; i--) {
		userid += chars[Math.round(Math.random() * (chars.length - 1))];
	}
	return userid;
}

/**
 * Generate a userid for a new user, this will uniquely identify them in our database. 
 * If generation fails, userid will return null.
 */
dispatcher.onPost("/newuser", function(req, res) {
	db.serialize(function() {
		db.all("SELECT userid FROM users", function(err, rows) {
			res.writeHead(200, {'Content-Type': 'application/json'});
			var userid = generateId();
			if (rows != null) {
				for (var i = 0; i < rows.length; i++) {
					if (rows[i].userid == userid) {
						res.end(JSON.stringify({"userid": null}));
						return;
					}	
				}	
			}
			res.end(JSON.stringify({"userid": userid}));
		});
	});
});

/**
 * Calculate and recieve the ratio of overall purchases of users
 *
 * totalratio - the ratio of purchases / household size
 */
dispatcher.onPost("/gimme/totalratio", function(req, res) {
	db.serialize(function() {
		db.all("SELECT totalratio FROM users", function(err, rows) {
			var data = {
				"totalratio": 0
			}

			for (var i = 0; i < rows.length; i++) {
				data.totalratio += rows[i].totalratio;
			}

			data.totalratio = data.totalratio / rows.length;
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(data));
		});
	});
});

/**
 * Accept user input and store it in database
 */
dispatcher.onPost("/update/totalratio", function(req, res) {
	var data = JSON.parseBody(req.body);
	db.serialize(function() {
		db.all("INSERT OR REPLACE INTO users (id, userid, totalratio) VALUES ((SELECT id FROM users WHERE userid=?), ?, ?)", data.userid, data.userid, data.totalratio);
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end("");
	});
});

var server = http.createServer(handleRequest);
server.listen(PORT, function() {
	console.log("server listening on: http://localhost:%s", PORT);
});
