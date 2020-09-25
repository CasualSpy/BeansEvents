const mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'event_planner',
    password: 'supersecretpassword',
    database: 'event_planner'
});

async function query(query, values) {
    return new Promise((resolve, reject) => {
        connection.query(query, values, (error, results) => {
            if (error)
                reject(error);
            else
                resolve(results);
        })
    })
}

module.exports = query;
