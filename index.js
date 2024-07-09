const express = require('express');
const path = require('path');
const createError = require('http-errors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
//const app = express();
const flash = require("connect-flash");
const bcrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;
const indexRouter = require('./routes/index');
const userModel = require('./routes/users');

const app = express();

//Connect to mongodb atlas
require('dotenv').config();
const uri = process.env.ATLAS_URI;
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB Atlas');
})
    .catch(err => {
        console.error('Connection error:', err);
    });


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(flash());
app.use(session({
    secret: 'hey hey hey',
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    userModel.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
});

// Middleware to make user available in templates
app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});

app.use('/', indexRouter);

app.use(function (req, res, next) {
    next(createError(404));
});

app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);
    res.render('error');
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;