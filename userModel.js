let Promise = require("bluebird");
let bcrypt = require('bcrypt-nodejs');
let customError = require('./customError');

class User {

    constructor(getSqlConnection) {
        this.getSqlConnection = getSqlConnection;
    }


    _catchError(error, connection, next) {
        if (connection.state !== 'disconnected') {
            connection.query('ROLLBACK;');
        }
        if (!(error instanceof customError)) {
            console.error(error);
            next({'status' : false, 'err' : 'app error'});
            return;
        }

        next({'status' : false, 'err' : error.message});
    }


    allow(user_id, other_uid, amount, next) {
        Promise.using(this.getSqlConnection(), connection => {

            let other_id = 0;
            connection.query('START TRANSACTION;').then(result => {
                return connection.query('SELECT id FROM users WHERE uid = ?;', [other_uid]);

            }).then(result => {

                if (!result.length) {
                    throw new customError('other id not found');
                }

                other_id = result[0].id;

                if (user_id == other_id) {
                    throw new customError('other id is you id. not allowed');
                }

                return connection.query('SELECT from_user_id, to_user_id FROM transfer WHERE from_user_id = ? AND to_user_id = ? FOR UPDATE;', [user_id, other_id]);

            }).then(result => {

                if (!result.length) {
                    return connection.query('INSERT INTO transfer(from_user_id, to_user_id, max) VALUES (?, ?, ?);', [user_id, other_id, amount]);
                } else {
                    return connection.query('UPDATE transfer SET max = ? WHERE from_user_id = ? AND to_user_id = ?;', [amount, user_id, other_id]);
                }

            }).then(result => {
                return connection.query('COMMIT;');

            }).then(result => {
                next({'status' : true});

            }).catch(error => this._catchError(error, connection, next));
        });
    }



    transfer(user_id, other_uid, amount, next) {
        Promise.using(this.getSqlConnection(), connection => {

            let other_id = 0;
            connection.query('START TRANSACTION;').then(result => {
                return connection.query('SELECT id FROM users WHERE uid = ?;', [other_uid]);

            }).then(result => {
                if (!result.length) {
                    throw new customError('other id not found');
                }

                other_id = result[0].id;

                if (user_id == other_id) {
                    throw new customError('other id is you id. not allowed');
                }

                return connection.query('SELECT * FROM transfer WHERE from_user_id = ? AND to_user_id = ? FOR UPDATE;', [other_id, user_id]);

            }).then(result => {
                if (!result.length) {
                    throw new customError('not allowed');
                }

                if (result[0].amount + amount > result[0].max) {
                    throw new customError('exceeded maximum');
                }

                return connection.query('SELECT user_id, balance FROM balance WHERE user_id IN (?) FOR UPDATE;', [[user_id, other_id]]);

            }).then(result => {
                result.forEach((item, i, arr) => {
                  if (item.user_id == other_id) {
                    if (item.balance - amount < 0) {
                        throw new customError('insufficient funds');
                    }
                    return false;
                  }
                });

                return connection.query('UPDATE balance SET balance = balance - ? WHERE user_id = ?;', [amount, other_id]);

            }).then(result => {
                return connection.query('UPDATE balance SET balance = balance + ? WHERE user_id = ?;', [amount, user_id]);

            }).then(result => {
                return connection.query('UPDATE transfer SET amount = amount + ? WHERE from_user_id = ? AND to_user_id = ?;', [amount, other_id, user_id]);

            }).then(result => {
                return connection.query('COMMIT;');

            }).then(result => {
                next({'status' : true});

            }).catch(error => this._catchError(error, connection, next));
        });
    }



    deposit(user_id, amount, next) {
        Promise.using(this.getSqlConnection(), connection => {
            connection.query('START TRANSACTION;').then(result => {
                return connection.query('SELECT balance FROM balance WHERE user_id = ? FOR UPDATE;', [user_id]);

            }).then(result => {
                let current_balance = parseInt(result[0].balance);
                // проверка на withdraw
                if ((current_balance + amount) < 0) {
                    throw new customError('insufficient funds');
                }
                return connection.query('UPDATE balance SET balance = balance + ? WHERE user_id = ?;', [amount, user_id]);

            }).then(result => {
                return connection.query('COMMIT;');

            }).then(result => {
                next({'status' : true});

            }).catch(error => this._catchError(error, connection, next));
        });
    }


    get_id(bearer, next) {
        Promise.using(this.getSqlConnection(), connection => {
            let user = {};

            connection.query('SELECT id, uid FROM users WHERE token = ? AND ttl_token > NOW() LIMIT 1;', [bearer]).then(result => {
                if (!result.length) {
                    throw new customError('token not found');
                }

                user.id = parseInt(result[0].id);
                user.uid = result[0].uid;

                return connection.query('UPDATE users SET ttl_token = DATE_ADD(NOW(), INTERVAL 1 MINUTE) WHERE id = ?;', [user.id]);
            }).then(result => {
                next({'status' : true, 'id' :  user.id, 'uid': user.uid});
                return;
            }).catch(error => this._catchError(error, connection, next));
        });
    }


    login(id, password, next) {
        Promise.using(this.getSqlConnection(), connection => {
            let token = false;
            connection.query('SELECT * FROM users WHERE uid = ? LIMIT 1;', [id]).then(result => {
                
                if (!result.length) {
                    throw new customError('id not found');
                }

                if (!bcrypt.compareSync(password, result[0].pass)) {
                    throw new customError('wrong password');
                }

                token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                return connection.query('UPDATE users SET token = ?, ttl_token = DATE_ADD(NOW(), INTERVAL 1 MINUTE) WHERE id = ?;', [token, result[0].id]);
                
            }).then(result => {
                next({'status' : true, 'token' : token});
                return;
            }).catch(error => {
                if (!(error instanceof customError) && error.errno == 1062) {
                    this._catchError(new customError('try now'), connection, next);
                } else {
                    this._catchError(error, connection, next);
                }
            });
        });
    }


    register(id, password, next) {
        let hash = bcrypt.hashSync(password);
        Promise.using(this.getSqlConnection(), connection => {
            connection.query('START TRANSACTION;').then(result => {
                return connection.query('INSERT INTO users (uid, pass) VALUES (?, ?);', [id, hash]);
            }).then(result => {
                return connection.query('INSERT INTO balance (user_id) VALUES (?);', [result.insertId]);
            }).then(result => {
                return connection.query('COMMIT;');
            }).then(result => {
                this.login(id, password, next);
                return;
            }).catch(error => {
                if (!(error instanceof customError) && error.errno == 1062) {
                    this._catchError(new customError('dublicate id'), connection, next);
                } else {
                    this._catchError(error, connection, next);
                }
            });
        });
    }

}

module.exports = User;