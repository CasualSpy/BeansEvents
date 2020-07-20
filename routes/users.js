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
        if (!validateEmail(email))
            return res.json({success:false, error: "Invalid email."});
        if (!validateUsername(username))
            return res.json({success: false, error: "Username can contain only letters, numbers, '-' and '_'."});
        //Check login info available
        connection.query(`SELECT email, username FROM users WHERE email = "${email}" OR username = "${username}"`, (error, results) => {
            if (!error){
                //Not available
                if (results.length > 0)
                {
                    const usernameTaken = results.filter(row => row.username === username).length;
                    const emailTaken = results.filter(row => row.email === email).length;
                    if (emailTaken || usernameTaken){
                        const errorStr = `${emailTaken ? "Email" : ""}${emailTaken && usernameTaken ? " and " : ""}${usernameTaken ? "Username" : ""} already in use.`
                        res.json({success: false, error: errorStr})
                    }
                }
                //Available
                else {
                    //Password validation
                    let errors = [];
                    error8Chars = "Password must contain at least 8 characters.";
                    errorDigit = "Password must contain at least 1 digit.";
                    errorLower = "Password must contain at least one lowercase character.";
                    errorUpper = "Password must contain at least one uppercase character.";
                    errorSymbol = "Password must contain at least one symbol.";

                    if (!contains8Chars(password))
                        errors.push(error8Chars);
                    if (!containsDigit(password))
                        errors.push(errorDigit);
                    if (!containsLower(password))
                        errors.push(errorLower);
                    if (!containsUpper(password))
                        errors.push(errorUpper);
                    if (!containsSymbol(password))
                        errors.push(errorSymbol);

                    if (errors.length > 0){
                        const errorStr = errors.slice(1).reduce((acc, cur) => acc + "\n" + cur, errors[0]);
                        res.json({success: false, error: errorStr});
                    }
                    else {
                        //Hash password
                        const salt = makesalt(16);
                        const hash = shajs('sha256').update(password+salt).digest('hex');

                        connection.query(`INSERT INTO users (username,${fullname ? " fullname," : ""} email, password_hash, password_salt) VALUES ("${username}",${fullname ? `"${fullname}", ` : ""} "${email}", "${hash}", "${salt}")`, function (error, results, fields) {
                            if (!error){
                                req.session.userId =  results.insertId;
                                res.json({success: true});
                            }
                            else {
                                res.json({success: false, error: "Could not create user."})
                            }
                        });
                    }
                }
            }
        });
    }
    else
        return res.json({success: false, error: 'Your request must include username, email and password.'});
})

router.post('/login', function(req, res) {
    const { email, password } = req.body;
    if (email && password){
        connection.query(`SELECT * FROM users WHERE email = "${email}" OR username = "${email}"`, (error, results, fields) => {
            if (!error) {
                if(results.length > 0){
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
            }
            else {
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
const validateEmail = (email) => {
    const re = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g
    return re.test(email);
}

const validateUsername = (email) => {
    return !/[^\w-]+/g.test(email);
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
