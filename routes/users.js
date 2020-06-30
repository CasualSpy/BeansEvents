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

router.post('/register', function(req, res){
    const {username, email, password, fullname} = req.body;
    if (username && email && password){
        //Check login info available
        if (checkEmailTaken(email))
            return res.json({success: false, error: "Email already taken."});
        if (checkUsernameTaken(username))
            return res.json({success: false, error: "Username already taken."});

        //Password validation
        let errors = [];
        error8Chars = "Password must contain at least 8 characters.";
        errorDigit = "Password must contain at least 1 digit.";
        errorLower = "Password must contain at least one lowercase character.";
        errorUpper = "Password must contain at least one uppercase character.";

        if (!contains8Chars(password))
            errors.push(error8Chars);
        if (!containsDigit(password))
            errors.push(errorDigit);
        if (!containsLower(password))
            errors.push(errorLower);
        if (!containsUpper(password))
            errors.push(errorUpper);

        if (errors.length > 0){
            const errorStr = errors.slice(1).reduce((acc, cur) => acc + "\n" + cur, errors[0]);
            return res.json({success: false, error: errorStr});
        }


        //Hash password
        const salt = makesalt(16);
        const hash = shajs('sha256').update(password+salt).digest('hex');

        connection.query(`INSERT INTO users (username,${fullname ? " fullname," : ""} email, password_hash, password_salt) VALUES ("${username}",${fullname ? `"${fullname}", ` : ""} "${email}", "${hash}", "${salt}")`, function (error, results, fields) {
            if (!error){
                //Get new user's id to return
                connection.query(`SELECT id FROM users WHERE email = "${email}"`, (error, results, fields) => {
                    if (!error && results.length > 0) {
                        req.session.userId =  results[0].id;
                        res.json({success: true});
                    }
                    else
                        res.json({success: false, error: "Could not retrieve created user."});
                })
            }
            else {
                res.json({success: false, error: "Could not create user."})
            }
        });
    }
    else
        return res.json({success: false, error: 'Your request must include username, email AND password.'});
})

router.post('/login', function(req, res) {
    const { email, password } = req.body;
    if (email && password){
        connection.query(`SELECT * FROM users WHERE email = "${email}"`, (error, results, fields) => {
            if (!error && results.length > 0) {
                const user = results[0];
                const hash = shajs('sha256').update(password+user.password_salt).digest('hex');
                console.log(hash)
                if (hash === user.password_hash){
                    req.session.userId = user.id;
                    res.json({success: true});
                }
                else
                    res.json({success: false, error: "Invalid password."});
            }
            else {
                console.log("Creating new user:", error);
                res.json({success: false, error: "Invalid login"});
            }
        });
    }
    else
        return res.json({success:false, error: "You must provide both email and password."});
})

router.post('/logout', function(req, res) {
    req.session.destroy(err => {
        if (err)
            return res.json({success: false, error: "Could not logout. Please login to logout."});
        res.clearCookie('sid');
        res.json({success: true});
    })
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

//Helper functions
const checkEmailTaken = (email) => {
    connection.query(`SELECT COUNT(id) FROM users WHERE email = "${email}"`, (error, results) => {
        if (!error)
            return results.length > 0;
        return true;
    })
}
const checkUsernameTaken = (username) => {
    connection.query(`SELECT COUNT(id) FROM users WHERE username = "${username}"`, (error, results) => {
        if (!error)
            return results.length > 0;
        return true;
    })
}

const contains8Chars = password => {
    return password.length >= 8;
}

const containsSymbol = password => {
    return /[$-/:-?{-~!"^_`\[\]]/g.test(password);
}

const containsUpper = password => {
    return /[A-Z]/g.test(password);
}

const containsLower = password => {
    return /[a-z]/g.test(password);
}

const containsDigit = password => {
    return /\d/g.test(password);
}

module.exports = router;
