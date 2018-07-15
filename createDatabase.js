require('dotenv').config();

var mysql = require('promise-mysql');
var connection;

mysql.createConnection({
    host     : process.env.MYSQL_HOST,
    user     : process.env.MYSQL_USER,
    password : process.env.MYSQL_PASSWORD,

}).then(conn => {
    connection = conn;
    return connection.query('CREATE DATABASE IF NOT EXISTS ' + process.env.MYSQL_DATABASE + ' CHARACTER SET utf8 COLLATE utf8_general_ci');

}).then(rows => {
    return connection.query('USE ' + process.env.MYSQL_DATABASE);

}).then(rows => {
    let sql = ' \
      CREATE TABLE `users` ( \
        `id` int(11) NOT NULL AUTO_INCREMENT, \
        `uid` varchar(255) NOT NULL, \
        `pass` varchar(255) NOT NULL, \
        `token` varchar(30) DEFAULT NULL, \
        `ttl_token` timestamp NULL DEFAULT NULL, \
        PRIMARY KEY (`id`), \
        UNIQUE KEY `uid` (`uid`), \
        UNIQUE KEY `token` (`token`) \
      ); \
    ';
    return connection.query(sql);

}).then(rows => {
    let sql = ' \
      CREATE TABLE `balance` ( \
        `user_id` int(11) NOT NULL, \
        `balance` int(11) NOT NULL DEFAULT \'0\', \
        UNIQUE KEY `user_id` (`user_id`), \
        CONSTRAINT `balance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) \
      ); \
    ';
    return connection.query(sql);

}).then(rows => {
    let sql = ' \
      CREATE TABLE `transfer` ( \
        `from_user_id` int(11) NOT NULL, \
        `to_user_id` int(11) NOT NULL, \
        `max` int(11) NOT NULL DEFAULT \'0\', \
        `amount` int(11) NOT NULL DEFAULT \'0\', \
        UNIQUE KEY `from_user_id_to_user_id` (`from_user_id`,`to_user_id`), \
        KEY `to_user_id` (`to_user_id`), \
        CONSTRAINT `transfer_ibfk_1` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`), \
        CONSTRAINT `transfer_ibfk_2` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) \
      ); \
    ';
    return connection.query(sql);

}).then(rows => {
    connection.end();
    console.log('all done');
    process.exit(1);

}).catch(error => {
    console.error(error.message);
    try {
      connection.end();  
    } catch(e){}
    process.exit(1);
});
