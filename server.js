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

db.serialize(function() {
	if(!exists) {
		db.run("CREATE TABLE users ( id integer primary key asc, userid integer not null, totalratio float not null)");
	}
});

const PORT = 8080;

function handleRequest(req, res) {
	try {
		console.log(req.url);
		dispatcher.dispatch(req, res);
	} catch(err) {
		console.log(err);
	}
}

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

/**
 * Calculate and recieve the ratio of overall purchases of users
 *
 * totalratio - the ratio of purchases / household size
 */
dispatcher.onPost("/gimme/totalratio", function(req, res) {
	var respond = function(data) {
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(data));
	}

	db.serialize(function() {
		db.all("SELECT totalratio FROM users", function(err, rows) {
			var data = {
				"totalratio": 0
			}

			for (var i = 0; i < rows.length; i++) {
				data.totalratio += rows[i].totalratio;
			}

			console.log("Total is: " + data.totalratio);
			data.totalratio = data.totalratio / rows.length;
			respond(data);
		});
	});
});

var server = http.createServer(handleRequest);

server.listen(PORT, function() {
	console.log("server listening on : http://localhost:%s", PORT);
});
