let request = require('ajax-request');
let Promise = require("bluebird");

function randomString() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

let count_users = 100;
let users = [];
let registers = [];
for (var i = count_users - 1; i >= 0; i--) {
	let user = {'id' : randomString(), 'password' : randomString()};
	users.push(user);
	registers.push(post('register', user));
};


Promise.all(registers).then(results => {
	console.log('------------- registers');
	console.log(results);
	let logins = [];
	for (var i = count_users - 1; i >= 0; i--) {
		logins.push(post('login', users[i]));
	};



	Promise.all(logins).then(results => {
		console.log('------------- logins');
		console.log(results);
		let tokens = [];
		let deposit = [];
		for (var i = results.length - 1; i >= 0; i--) {
			token = JSON.parse(results[i])['token'];
			tokens.push(token);
			deposit.push(post('deposit', {'amount': getRandomArbitrary(1, 100)}, token));
		}

		Promise.all(deposit).then(results => {
			console.log('------------- deposit');
			console.log(results);
			let withdraw = [];
			for (var i = results.length - 1; i >= 0; i--) {
				withdraw.push(post('withdraw', {'amount': getRandomArbitrary(1, 100)}, token));
			}


			Promise.all(withdraw).then(results => {
				console.log('------------- withdraw');
				console.log(results);

				let allows = [];
				for (var i = tokens.length - 1; i >= 0; i--) {
					for (var j = users.length - 1; j >= 0; j--) {
						allows.push(post('allow', {'amount': getRandomArbitrary(1, 150), 'other_id' : users[j].id}, tokens[i]));
					}
				}



				Promise.all(allows).then(results => {
					console.log('------------- allows');
					console.log(results);

					let transfer = [];
					for (var i = tokens.length - 1; i >= 0; i--) {
						for (var j = users.length - 1; j >= 0; j--) {
							transfer.push(post('transfer', {'amount': getRandomArbitrary(1, 150), 'other_id' : users[j].id}, tokens[i]));
						}
					}



					Promise.all(transfer).then(results => {
						console.log('------------- transfer');
						console.log(results);

					});
				});
			});
		});
	});
});


function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function post(action, data, Bearer) {
  return new Promise(function(resolve, reject) {
  	let headers = (Bearer) ? {'Authorization': 'Bearer ' + Bearer} : {};
	request.post({
			url: 'http://localhost:3000/' + action,
			data: data,
			headers: headers
		},
		function(err, res, body) {
			resolve(body);
		}
	);
  });

}

//request.post({
//		url: 'http://localhost:3000/register',
//		data: {
//			'id' : Math.random().toString(36).substring(2, 15),
//			'password' : 'muda13ff'
//		},
//		headers: {
//			'Origin' : 'http://localhost'
//		}
//	},
//	function(err, res, body) {
//		console.log(body);
//	}
//);

/*
request.post({
		url: 'http://localhost:3000/login',
		data: {
			'id' : 'Chang123',
			'password' : 'muda13ff'
		},
		headers: {
			'Origin' : 'http://localhost'
		}
	},
	function(err, res, body) {
		let token = JSON.parse(body)['token'];
		request.post({
				url: 'http://localhost:3000/transfer',
				data: {
					'amount' : 99,
					'other_id' : 'Chang12'
				},
				headers: {
					'Origin' : 'http://localhost',
					'Authorization': 'Bearer ' + token
				}
			},
			function(err, res, body) {
				console.log(body);
			}
		);
	}
);
*/
//request.post({
//		url: 'http://localhost:3000/get_id',
//		data: {
//		},
//		headers: {
//			'Origin' : 'http://localhost',
//			'Authorization': 'Bearer hsu79omwwubpaf2vhamjq'
//		}
//	},
//	function(err, res, body) {
//		console.log(body);
//	}
//);

//console.log(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
//console.log(Math.random().toString(36).substring(2, 15) + (new Date()).getMilliseconds().toString(36));
