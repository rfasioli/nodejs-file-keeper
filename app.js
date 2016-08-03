var express = require('express');
var multer = require('multer');
var bodyParser = require('body-parser');
var path = require('path');
var mongodb = require('mongodb');
var streamBuffers = require('stream-buffers');
var Grid = require('gridfs-stream');

var gfs = null;
var MongoClient = mongodb.MongoClient;
var dbinstance = null;
var uri = 'mongodb://localhost:27017/';
var dbname = 'FileKeeper';
var bucketName = 'fsTest';

var app = new express();
app.use(bodyParser.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// index.js continued
app.get('/fs/upload', function(req, res){
  res.render('upload');
});

app.post('/fs/upload', multer({
	inMemory: true
}).single('upl'), function (req, res) {
	var total = 0;

	var myReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({ frequency: 0.1 , chunkSize: 104857600 })
	  .on('close', function() {console.log("myReadableStreamBuffer - close");})
	  .on('data', function(chunk) {
		  total += chunk.length;
		  console.log("myReadableStreamBuffer - data [" + chunk.length + "] received: [" + total + " of " + req.file.buffer.length + "]");		  
		})
	  .on('error', function(error) {console.log("myReadableStreamBuffer - error [" + error + "]");})
	  .on('readable', function() {console.log("myReadableStreamBuffer - readable");});
	  
	myReadableStreamBuffer.put(req.file.buffer);
	myReadableStreamBuffer.stop();	
	
	var writestream = gfs.createWriteStream({filename: req.file.originalname, metadata: req.body.title, root: bucketName })
	  .on('close', function(data){
		res.end(JSON.stringify(data))
	  })
	  .on('error', function(err){
		console.dir(err); 
		res.sendStatus(500);
	  });
	  
	myReadableStreamBuffer.pipe(writestream);
});

app.route('/fs/download/:file').get(function (req, res) {
var readstream = gfs.createReadStream({_id: req.params.file, root: bucketName })
	  .on('error', function(err){
		console.dir(err); 
		res.sendStatus(404);
	  });
  readstream.pipe(res);
});

app.route('/fs/exist/:file').get(function (req, res) {
  gfs.exist({_id: req.params.file, root: bucketName }, function (err, found) {
	if (err) return res.sendStatus(500);
	var resp = {'exist': found};
	res.end(JSON.stringify(resp));
  });
});

app.route('/fs/meta/:file').get(function (req, res) {
  gfs.findOne({_id: req.params.file, root: bucketName }, function (err, file) {
	if (err) return res.sendStatus(500);
	res.end(JSON.stringify(file));
  });
});

app.route('/fs/remove/:file').get(function (req, res) {
  gfs.remove({_id: req.params.file, root: bucketName }, function (err) {
	if (err) return res.sendStatus(500);
	return res.sendStatus(200);
  });
});

app.route('/fs/list').get(function (req, res) {
  // var cache = [];
  dbinstance.collection(bucketName + '.files')
    .find({}, {filename: 1})
	.toArray(function(err,files){
		if (err) return res.sendStatus(500);
		res.end(JSON.stringify(files));
  });
});

// Connect to the db
MongoClient.connect(uri+dbname, function(err, db) {
	if(err) return console.dir(err);
	dbinstance = db;
	console.log("Conectou no banco de dados");
	gfs = Grid(db, mongodb);
	var port = 3000;
	app.listen( port, function(){ console.log('listening on port '+port); } );
});


