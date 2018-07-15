/*
cервис REST API (json in/out), авторизация с использованием bearer токена.

Возможность настраивать разрешенные CORS домены через ENV переменную 
CORS_DOMAINS
База данных MySQL (библиотека по выбору)
Авторизация по bearer токену: токен действителен 1 минуту, продлевать 
при каждом запросе.
У каждого пользователя есть неотрицательный целочисленный balance (монеты),
методы для работы с ним должны работать атомарно (double spending не 
должен быть возможен)
*/

require('dotenv').config();
const express = require('express');
const bearerToken = require('express-bearer-token');
const bodyParser = require('body-parser')
const cors = require('cors');

const getSqlConnection = require('./databaseConnection');
const User = require("./userModel");

var app = express();

// --------------- cors ----------------------
var corsOptionsDelegate = {origin: false};
if (process.env.CORS_DOMAINS) {
	var whitelist = process.env.CORS_DOMAINS.split(',').map(item => item.trim());

	var corsOptionsDelegate = function (req, callback) {
	  var corsOptions;
	  if (whitelist.indexOf(req.header('Origin')) !== -1) {
	    corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
	  } else {
	    corsOptions = { origin: false } // disable CORS for this request
	  }
	  callback(null, corsOptions) // callback expects two parameters: error and options
	}
}

app.use(cors(corsOptionsDelegate));
// ---------------------------------------------

app.use(bearerToken());

// For each request, parse request body into a JavaScript object where header Content-Type is application/json
app.use(bodyParser.json());


// Проверка токена
app.use(function (req, res, next) {
	let skip_urls = ['/login', '/register'];
	if (skip_urls.indexOf(req.originalUrl) != -1) {
		next();
		return;
	}

	if (!req.token) {
		res.status(403).send(JSON.stringify({'status': false, 'error' : 'header Bearer token is empty!'}));
		return;
	}

	(new User(getSqlConnection)).get_id(req.token, result => {
		if (!result.status) {
			res.send(JSON.stringify(result));
			return;
		}

		req.user = {'id': result.id, 'uid': result.uid};
		next();
		return;
	});
  
});


app.get('/', function (req, res) {
	let msg = '\
	REST API (post json in/out), methods: <hr>\
	login(id, password) - возвращает токен по id (произвольная строка) и password <hr>\
	register(id, password) - регистрирует пользователя (id / password) и авторизует, возвращает токен, по умолчанию balance = 0 <hr>\
	get_id - вернуть id <hr>\
	deposit(amount) - принимает неотрицательный целочисленный amount и добавляет к balance <hr>\
	withdraw(amount) - принимает неотрицательный целочисленный amount и отнимает от balance, ошибка в случае если amount > balance <hr>\
	allow(other_id, max_amount) - разрешить пользователю other_id снимать со моего balance монеты в суммарном объеме не превышающем (max_amount), повторные запросы allow перезаписывают указанное раннее значение <hr>\
	transfer(other_id, amount) - забрать у other_id amount монет в свою пользу, other_id должен через метод allow позволить совершать данную операцию, max_amount должен быть уменьшен на amount <hr>\
	';
	res.send(msg);
});


//login(id, password) - возвращает токен по id (произвольная строка) и password
app.post('/login', (req, res) => {
	if (!req.body.id || !req.body.password) {
		res.send(JSON.stringify({'status': false, 'error' : 'id and password must not empty!'}));
		return;
	}

	(new User(getSqlConnection)).login(req.body.id, req.body.password, result => {
		console.info('login user:' + req.body.id);
		res.send(JSON.stringify(result));
	});
});



//register(id, password) - регистрирует пользователя (id / password) и авторизует, возвращает токен, по умолчанию balance = 0
app.post('/register', (req, res) => {
	if (!req.body.id || !req.body.password) {
		res.send(JSON.stringify({'status': false, 'error' : 'id and password must not empty!'}));
		return;
	}

	if (req.body.id.toString().length > 255) {
		res.send(JSON.stringify({'status': false, 'error' : 'id more 255 characters'}));
		return;
	}

	if (req.body.password.toString().length > 255) {
		res.send(JSON.stringify({'status': false, 'error' : 'id more 255 characters'}));
		return;
	}

	(new User(getSqlConnection)).register(req.body.id, req.body.password, result => {
		console.info('register new user:' + req.body.id);
		res.send(JSON.stringify(result));
	});
});



//get_id - вернуть id
app.post('/get_id', (req, res) => {
	console.info('get id user:' + req.body.uid);
	res.send(JSON.stringify({'status': true, 'id' : req.user.uid}));
});



//deposit(amount) - принимает неотрицательный целочисленный amount и добавляет к balance
//withdraw(amount) - принимает неотрицательный целочисленный amount и отнимает от balance, ошибка в случае если amount > balance
app.post(['/deposit','/withdraw'] , (req, res) => {
	let amount = parseInt(req.body.amount);
	if (!amount || amount <= 0) {
		res.send(JSON.stringify({'status': false, 'error' : 'amount must be > 0'}));
		return;
	}

	if (req.originalUrl === '/withdraw') {
		amount = -1 * amount;
	}

	(new User(getSqlConnection)).deposit(req.user.id, amount, result => {
		console.info('deposit/withdraw user:' + req.user.uid + ', amount:' + amount + ', result:' + JSON.stringify(result));
		res.send(JSON.stringify(result));
	});
});



//allow(other_id, max_amount) - разрешить пользователю other_id снимать со моего balance монеты в суммарном объеме не превышающем (max_amount), повторные запросы allow перезаписывают указанное раннее значение
app.post('/allow', (req, res) => {
	let amount = parseInt(req.body.amount);
	if (!amount || amount <= 0) {
		res.send(JSON.stringify({'status': false, 'error' : 'amount must be > 0'}));
		return;
	}
	if (!req.body.other_id) {
		res.send(JSON.stringify({'status': false, 'error' : 'must be other_id'}));
		return;
	}

	(new User(getSqlConnection)).allow(req.user.id, req.body.other_id, amount, result => {
		console.info('allow user:' + req.user.uid + ', amount:' + amount + ', other_id:' + req.body.other_id + ', result:' + JSON.stringify(result));
		res.send(JSON.stringify(result));
	});
});



//transfer(other_id, amount) - забрать у other_id amount монет в свою пользу, other_id должен через метод allow позволить совершать данную операцию, max_amount должен быть уменьшен на amount
app.post('/transfer', (req, res) => {
	let amount = parseInt(req.body.amount);
	if (!amount || amount <= 0) {
		res.send(JSON.stringify({'status': false, 'error' : 'amount must be > 0'}));
		return;
	}
	if (!req.body.other_id) {
		res.send(JSON.stringify({'status': false, 'error' : 'must be other_id'}));
		return;
	}

	(new User(getSqlConnection)).transfer(req.user.id, req.body.other_id, amount, result => {
		console.info('transfer user:' + req.user.uid + ', amount:' + amount + ', other_id:' + req.body.other_id + ', result:' + JSON.stringify(result));
		res.send(JSON.stringify(result));
	});
});


// 404
app.use((req, res, next) => {
	console.error('not found');
	res.status(404).send(
		JSON.stringify({
			'status' : false, 
			'error'  : 'not found'
   		})
	);
});

// 500
app.use((err, req, res, next) => {
	console.error(err.message);
	res.status(err.status || 500).send(
		JSON.stringify({
			'status' : false,
   			'error'  : err.message
   		})
   	);
});


app.listen(3000, () => console.log('app listening on port 3000'));