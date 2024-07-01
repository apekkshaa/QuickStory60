const express = require('express');
const router = express.Router();
const userModel = require('./users');
const postModel = require('./posts');
const passport = require('passport');
const upload = require("./multer");

const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));

/* home page. */
router.get('/', function (req, res, next) {
  console.log('GET /');
  res.render('index', { title: 'Express' });
});

router.get('/login', function (req, res, next) {
  console.log('GET / login');
  console.log(req.flash("error"));
  res.render('login', { error: res.locals.error });
});

router.get('/feed', function (req, res, next) {
  console.log('GET / feed');
  res.render('feed');
});

router.post('/upload', isAuthenticated, upload.single("file"), async function (req, res, next) {
  console.log('post / upload');
  if (!req.file) {
    return res.status(404).send("no files were given");
  }
  const user = await userModel.findById(req.session.passport.user)
  const post = await postModel.create({
    image: req.file.filename,
    imageText: req.body.filecaption,
    user: user._id
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

router.get('/profile', isAuthenticated, async function (req, res, next) {
  console.log('GET /profile');
  const user = await userModel.findById(req.session.passport.user).populate("posts");
  console.log(user);
  res.render('profile', { user });
});

router.post("/register", function (req, res, next) {
  console.log('POST /register');
  const { username, email, fullname } = req.body;
  const userData = new userModel({ username, email, fullname });

  userModel.register(userData, req.body.password).then(function (user) {
    passport.authenticate("local")(req, res, function () {
      console.log('Authentication successful');
      console.log('User authenticated after registration:', req.isAuthenticated());
      res.redirect("/profile");
    });
  }).catch(function (err) {
    console.log('Error during registration:', err);
    res.redirect('/');
  });
});

router.post("/login", passport.authenticate("local", {
  successRedirect: "/profile",
  failureRedirect: "/login",
  failureFlash: true
}), function (req, res) {
  console.log('POST /login');
});

router.get("/logout", function (req, res) {
  console.log('GET /logout');
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/login');
  }
}

/*function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}*/

/*
router.get('/alluserposts', async function (req, res, next) {
  let user = await userModel
    .findOne({ _id: "667ade26593b1a760f505afc" })
    .populate('posts')
  res.send(user);
});
 
router.get('/createuser', async function (req, res, next) {
  try {
 
    const existingUser = await userModel.findOne({
      username: "apeksha"
    });
    if (existingUser) {
      return res.status(400).send({ error: 'User with this username already exists' });
    }
 
    let createduser = await userModel.create({
      username: "apeksha ",
      password: "apeksha ",
      posts: [],
      email: "apeksharajput05503@gmail.com ",
      fullname: "apeksha rajput "
    });
 
    res.send(createduser);
  } catch (error) {
    next(error);
  }
});
 
router.get('/createpost', async function (req, res, next) {
  let createdpost = await postModel.create({
    postText: "hello everyone again",
    user: '667ade26593b1a760f505afc'
  });
 
  let user = await userModel.findOne({ _id: "667ade26593b1a760f505afc" });
  user.posts.push(createdpost._id);
  await user.save();
  res.send("done");
});
*/
module.exports = router;
