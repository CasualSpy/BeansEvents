var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var shajs = require('sha.js');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'event_planner',
    password: 'supersecretpassword',
    database: 'event_planner'
});

/* GET users listing. */
router.get('/', function(req, res, next) {
    connection.query("SELECT * FROM users", function(error, results, fields) {
        res.json(results)
    })
});

router.post('/signup', function(req, res){
    const {username, password, fullname} = req.body;
    if (username && password){
        const salt = makesalt(16);
        const hash = shajs('sha256').update(password+salt).digest('hex');
        connection.query(`INSERT INTO users (username,${fullname ? " fullname," : ""} password_hash, password_salt) VALUES ("${username}",${fullname ? '" ' + fullname + '",' : ""} "${hash}", "${salt}")`, function (error, results, fields) {
            if (!error){
                res.json({username});
            }
            else {
                res.json({error: error.sqlMessage})
            }
        });
    }
})

function makesalt(length) {
       var result           = '';
       var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}();.<>\'\\';
       var charactersLength = characters.length;
    for ( var i = 0; i < length; i++  ) {
              result += characters.charAt(Math.floor(Math.random() * charactersLength));

    }
       return result;

}

module.exports = router;
