const express = require('express');
const router = express.Router();
const userModel = require('./users');
const postModel = require('./posts');
const passport = require('passport');
const { uploadVideo, uploadImage } = require("./multer");
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

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

router.get('/feed', isAuthenticated, async function (req, res, next) {
  console.log('GET /feed');
  try {
    const allPosts = await postModel.find().populate('user');
    const shuffledPosts = allPosts.sort(() => Math.random() - 0.5);
    res.render('feed', { posts: shuffledPosts });
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/upload', isAuthenticated, uploadVideo.single("file"), async function (req, res, next) {
  console.log('post / upload');
  try {
    if (!req.file) {
      throw new Error('No file selected for upload.');
    }

    const user = await userModel.findById(req.session.passport.user);
    const post = await postModel.create({
      image: req.file.filename,
      imageText: req.body.filecaption,
      user: user._id
    });
    user.posts.push(post._id);
    await user.save();
    res.json({ message: 'Post created successfully!' });
  } catch (err) {
    console.error('Error during file upload:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/profile', isAuthenticated, async function (req, res, next) {
  console.log('GET /profile');
  const user = await userModel.findById(req.session.passport.user).populate("posts");
  console.log(user);
  res.render('profile', { user });
});

// POST edit post
router.post('/posts/:id/edit', isAuthenticated, async function (req, res, next) {
  try {
    const postId = req.params.id;
    const { imageText } = req.body;

    // Find the post by ID
    const post = await postModel.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    // Update the post
    post.imageText = imageText;
    await post.save();

    res.json({ message: 'Post updated successfully' });
  } catch (err) {
    console.error('Error updating post:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST delete post
router.delete('/posts/:id/delete', isAuthenticated, async function (req, res, next) {
  try {
    const postId = req.params.id;

    // Find the post by ID and delete it
    await postModel.findByIdAndDelete(postId);

    // Remove post reference from user's posts array
    const user = await userModel.findById(req.session.passport.user);
    user.posts = user.posts.filter(id => id.toString() !== postId);
    await user.save();

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/fileupload', isAuthenticated, uploadImage.single("picture"), async function (req, res, next) {
  console.log('GET /fileupload');
  try {
    if (!req.file) {
      throw new Error('No file selected for upload.');
    }
    const user = await userModel.findById(req.session.passport.user);
    user.profileimage = req.file.filename;
    await user.save();
    res.redirect("/profile");
  } catch (err) {
    console.error('Error during file upload:', err);
    req.flash('error', err.message);
    res.redirect("/profile");
  }
});

router.post("/register", function (req, res, next) {
  console.log('POST /register');
  const { username, email, fullname } = req.body;
  const userData = new userModel({ username, email, fullname });

  userModel.register(userData, req.body.password).then(function (user) {
    passport.authenticate("local")(req, res, function () {
      console.log('Authentication successful');
      console.log('User authenticated after registration:', req.isAuthenticated());
      res.redirect("/feed");
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

// Forgot Password Route
router.post('/forgot', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      req.flash('error', 'No account with that email address exists.');
      return res.redirect('/');
    }

    // Generate a token and set expiration
    const token = require('crypto').randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Send the email
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'apeksharajput05503@gmail.com', // Replace with your email
        pass: 'grvf khvx jkys jlwh'   // Replace with your email password
      }
    });

    const mailOptions = {
      to: user.email,
      from: 'apeksharajput05503@gmail.com',
      subject: 'QuickStory60 Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
                         Please click on the following link, or paste this into your browser to complete the process:\n\n
                         http://${req.headers.host}/reset/${token}\n\n
                         If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    await transporter.sendMail(mailOptions);

    req.flash('success', `An email has been sent to ${user.email} with further instructions.`);
    res.redirect('/');
  } catch (error) {
    console.error('Error processing forgot password request:', error);
    req.flash('error', 'Error processing your request.');
    res.redirect('/');
  }
});

// Route to show the reset password page
router.get('/reset/:token', async (req, res) => {
  try {
    const user = await userModel.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/');
    }

    res.render('reset', { token: req.params.token });
  } catch (error) {
    console.error('Error finding user for password reset:', error);
    req.flash('error', 'Error finding user for password reset.');
    res.redirect('/');
  }
});


// Route to handle the reset password form submission
router.post('/reset/:token', async (req, res) => {
  try {
    const user = await userModel.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/');
    }

    if (req.body.password === req.body.confirmPassword) {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();

      req.flash('success', 'Your password has been successfully reset.');
      res.redirect('/login');
    } else {
      req.flash('error', 'Passwords do not match.');
      res.redirect('back');
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    req.flash('error', 'Error resetting your password.');
    res.redirect('/');
  }
});

module.exports = router;
