var express = require('express');
const { body, cookie, validationResult, param} = require('express-validator');
var router = express.Router();
var query = require('./mysql-helper');
var shajs = require('sha.js');
const crypto = require('crypto');
var nodemailer = require('nodemailer');
var uuid = require('uuid');


var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'beansplanner@gmail.com',
        pass: 'U@56Elh9DSQS'
    }
});

router.post('/register', [
    body('email').trim()
        .notEmpty().withMessage("Email cannot be empty.")
        .isEmail().withMessage("Email must be a valid email address.")
        .normalizeEmail()
        .escape(),
    body('username').trim()
        .notEmpty().withMessage('Username cannot be empty.')
        .not().matches(/[^\w-]+/g).withMessage("Username can contain only letters, numbers, '-' and '_'.")
        .escape(),
    body('password').trim()
        .isLength({ min: 8 }).withMessage('Password must be longer than 8 characters.')
        .matches(/[$-/:-?{}-~!"^_`\[\]]/).withMessage('Password must contain a symbol.')
        .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
        .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
        .matches(/\d/).withMessage('Password must contain a digit.')
        .escape(),
    body('fullname').trim()
        .escape()
], async function (req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false, errors: errors.array()

        });
    }

    const { username, email, password, fullname } = req.body;
    try {
        const results = await query(`SELECT email, username FROM users WHERE email = "${email}" OR username = "${username}"`);
        //Login info not available
        if (results.length > 0) {
            const usernameTaken = results.filter(row => row.username === username).length;
            const emailTaken = results.filter(row => row.email === email).length;
            if (emailTaken || usernameTaken) {
                const errorStr = `${emailTaken ? "Email" : ""}${emailTaken && usernameTaken ? " and " : ""}${usernameTaken ? "Username" : ""} already in use.`
                res.status(422).json({
                    success: false, errors: [{
                        "value": "",
                        "msg": errorStr,
                        "param": `${emailTaken ? "email" : ""}${emailTaken && usernameTaken ? ", " : ""}${usernameTaken ? "username" : ""}`,
                        "location": "body"
                    }]
                });
            }
        }
        //Login info available
        else {
            //Hash password
            const salt = makesalt(16);
            const hash = shajs('sha256').update(password + salt).digest('hex');
            const token = uuid.v4();

            try {
                const insertionResults = await query(`INSERT INTO users (username,${fullname ? " fullname," : ""} email, password_hash, password_salt, verif_token) VALUES ("${username}",${fullname ? `"${fullname}", ` : ""} "${email}", "${hash}", "${salt}", "${token}")`)
                req.session.userId = insertionResults.insertId;

                // Send confirmation email
                var mailOptions = {
                    from: 'beansplanner@gmail.com',
                    to: email,
                    subject: 'Email Confirmation',
                    html: `<div>
                                <h1>Please confirm your email address by clicking on the button below</h1>
                                http://planner.filthycasualgames.ca/api/email_confirmation/${token}
                            </div>`
                };

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
                res.status(201).json({ success: true });
            }
            catch (error) {
                res.status(500).json({
                    success: false, errors: [{
                        "value": "",
                        "msg": "Could not create user.",
                        "param": "",
                        "location": ""
                    }]
                })
            }
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false, errors: [{
                "value": "",
                "msg": "Unknown server error.",
                "param": "",
                "location": ""
            }]
        })
    }
});

router.post('/login', [
    body('emailusername').trim()
        .notEmpty().withMessage("Email/Username cannot be empty.")
        .escape(),
    body('password').trim()
        .notEmpty().withMessage("Password cannot be empty.")
        .escape()
], async function (req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false, errors: errors.array()

        });
    }

    const { emailusername, password } = req.body;
    try {
        const results = await query(`SELECT id, password_salt, password_hash FROM users WHERE email = "${emailusername}" OR username = "${emailusername}"`);
        if (results.length > 0) {
            const user = results[0];
            const hash = shajs('sha256').update(password + user.password_salt).digest('hex');
            if (hash === user.password_hash) {
                req.session.userId = user.id;
                res.status(200).json({ success: true });
            }
            else {
                res.status(401).json({
                    success: false, errors: [{
                        "value": "",
                        "msg": "Invalid credentials",
                        "param": "username,password",
                        "location": "body"
                    }]
                });
            }
        }
        else {
            res.status(401).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Invalid credentials",
                    "param": "username,password",
                    "location": "body"
                }]
            });
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false, errors: [{
                "value": "",
                "msg": "Unknown server error.",
                "param": "",
                "location": ""
            }]
        })
    }
})

router.post('/logout', function (req, res) {
    req.session.destroy(err => {
        res.clearCookie('sid');
        if (err)
            res.status(401).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "No session found.",
                    "param": "",
                    "location": "cookies"
                }]
            });
        else
            res.status(201).json({ success: true });
    })
})

router.post('/confirmation', [
    body("token").trim()
        .notEmpty().withMessage("Token cannot be empty.")
        .escape()
], async function (req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false, errors: errors.array()
        });
    }

    const { token } = req.body;
    try {
        const results = await connection.query(`UPDATE users SET active = 1 WHERE verif_token = "${token}"`);
        res.status(201).json({ success: true });
    }
    catch (error) {
        console.log(error)
        res.status(500).json({
            success: false, errors: [{
                "value": "",
                "msg": "Unknown server error.",
                "param": "",
                "location": ""
            }]
        })
    }
});

router.post('/resend_email', async function (req, res) {
    const user = req.session.userId;
    if (user){
        try {
            const results = await query(`SELECT email, verif_token FROM users WHERE id = ${user}`);
            const email = results[0].email;
            const token = results[0].verif_token;
            var mailOptions = {
                from: 'beansplanner@gmail.com',
                to: email,
                subject: 'Email Confirmation',
                html: `<div>
                            <h1>Please confirm your email address by clicking on the button below</h1>
                            http://localhost:3000/email_confirmation/${token}
                        </div>`
            };

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
            res.status(201).json({success: true})
        }
        catch (error) {
            console.log(error);
            res.status(500).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Unknown server error.",
                    "param": "",
                    "location": ""
                }]
            })
        }
    }
    else res.status(401).json({success:false, errors:[{
        "value": "",
        "msg": "User is not logged in.",
        "param": "",
        "location": ""
    }]})
})

router.get('/user/:username', [
    param('username').trim()
    .notEmpty().withMessage("Username cannot be empty.")
    .escape()
], async function (req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false, errors: errors.array()

        });
    }

    const username = req.params.username;
    try {
        const results = await query(`SELECT u.username, u.fullname, r.id AS event_id, r.title, r.location, r.start_time FROM users u LEFT JOIN (SELECT e.id, e.title, e.location, e.start_time, e.is_private, r.user_id FROM events e INNER JOIN responses r ON r.event_id = e.id) r ON r.user_id = u.id WHERE u.username = "${username}" AND (r.is_private = FALSE OR r.is_private IS NULL);`);
        if (results.length > 0) {
            const {username, fullname} = results[0];
            const events = results.map(r => ({event_id: r.event_id, title: r.title, location: r.location, start_time: r.start_time}));
            res.status(200).json({success:true, username, fullname, events: (events[0].event_id ? events : [])});
        }
        else res.status(404).json({
            success: false, errors: [{
                "value": username,
                "msg": "User not found.",
                "param": "username",
                "location": "params"
            }]
        })
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false, errors: [{
                "value": "",
                "msg": "Unknown server error.",
                "param": "",
                "location": ""
            }]
        })
    }
})

router.get('/details', async function (req, res) {
    const user = req.session.userId;
    if (user) {
        try {
            const results = await query(`SELECT username, fullname FROM users WHERE id = ${user}`);
                const { username, fullname } = results[0];
                res.status(200).json({success:true, username, fullname});
        }
        catch (error) {
            console.log(error);
            res.status(500).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Unknown server error.",
                    "param": "",
                    "location": ""
                }]
            })
        }
    }
    else {
        res.status(401).json({success: false, errors: [{
            "value": "",
            "msg": "User is not logged in.",
            "param": "",
            "location": ""
        }]})
    }
})

function makesalt(length) {
    return crypto.randomBytes(128).toString('base64');
}
module.exports = router;
