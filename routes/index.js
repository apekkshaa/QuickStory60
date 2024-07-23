const express = require('express');
const router = express.Router();
const userModel = require('./users');
const postModel = require('./posts');
const passport = require('passport');
const { uploadVideo, uploadImage } = require("./multer");
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));

/* home page. */
router.get('/', function (req, res, next) {
  console.log('GET landing page');
  res.render('index', { title: 'Express' });
});

router.get('/signup', function (req, res, next) {
  res.render('signup');
});

router.get('/login', function (req, res, next) {
  console.log('GET / login');
  console.log(req.flash("error"));
  res.render('login', { error: res.locals.error });
});

// routes/index.js
router.get('/search', async (req, res) => {
  const username = req.query.username;

  try {
    const user = await userModel.findOne({ username: username });

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/feed');
    }

    res.redirect(`/profile/${user._id}`);
  } catch (err) {
    console.error('Error during search:', err);
    req.flash('error', 'An error occurred during the search');
    res.redirect('/feed');
  }
});

// routes/index.js
router.get('/profile/:id', isAuthenticated, async function (req, res, next) {
  console.log('GET /profile/:id');
  try {
    const userId = req.params.id;
    const user = await userModel.findById(userId).populate('posts');

    if (!user) {
      return res.status(404).send('User not found');
    }

    const loggedInUser = req.user; // Get the logged-in user
    const isOwnProfile = loggedInUser._id.equals(userId);
    const isProfilePrivate = user.profileVisibility === 'private';

    if (isProfilePrivate && !isOwnProfile) {
      // If profile is private and the logged-in user is not the owner
      res.render('privateProfile', { user, loggedInUser });
    } else {
      // Render the public profile
      res.render('profile', { user, loggedInUser });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Route to view another user's profile
router.get('/profile/:username', async (req, res) => {
  try {
    const loggedInUser = req.user;
    const user = await userModel.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).send('User not found');
    }

    const isOwnProfile = loggedInUser.username === user.username;

    res.render('profile', { user, isOwnProfile });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Route to toggle profile visibility
router.post('/toggle-visibility', async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await userModel.findById(userId);
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/profile');
    }
    user.profileVisibility = user.profileVisibility === 'public' ? 'private' : 'public';
    await user.save();
    req.flash('success', 'Profile visibility updated.');
    res.redirect('/profile');
  } catch (err) {
    req.flash('error', 'Could not update profile visibility.');
    res.redirect('/profile');
  }
});


// Update feed route to filter posts based on profile visibility
router.get('/feed', async (req, res) => {
  try {
    const posts = await postModel.find({}).populate('user').exec();
    const visiblePosts = posts.filter(post => post.user.profileVisibility === 'public');
    res.render('feed', { posts: visiblePosts });
  } catch (err) {
    req.flash('error', 'Something went wrong.');
    res.redirect('/');
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

// Route to view the logged-in user's profile
router.get('/profile', isAuthenticated, async function (req, res, next) {
  console.log('GET /profile');
  try {
    const user = await userModel.findById(req.user._id).populate('posts');
    res.render('profile', { user, loggedInUser: req.user });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).send('Server Error');
  }
});

// Get a specific post
router.get('/posts/:id', isAuthenticated, async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json(post);
  } catch (err) {
    console.error('Error fetching post:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a post
router.delete('/posts/:id', isAuthenticated, async (req, res) => {
  try {
    const post = await postModel.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to handle caption update
router.post('/update-caption/:id', isAuthenticated, async (req, res) => {
  const postId = req.params.id;
  const newCaption = req.body.caption;

  try {
    const post = await postModel.findById(postId);
    if (!post) {
      return res.status(404).send({ message: 'Post not found' });
    }

    post.imageText = newCaption; // Assuming 'imageText' is the field for captions
    await post.save();

    res.status(200).send({ message: 'Caption updated successfully' });
  } catch (error) {
    console.error('Error updating caption:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Route to get the like count and user like status for a specific post
router.put('/posts/:id', isAuthenticated, async (req, res) => {
  try {
    const post = await postModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json(post);
  } catch (err) {
    console.error('Error updating post:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/posts/:id/likes', isAuthenticated, async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const userId = req.user._id;
    const hasLiked = post.likes.includes(userId);
    res.json({ likeCount: post.likeCount, hasLiked });
  } catch (err) {
    console.error('Error fetching like status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route to like/unlike a post
router.post('/posts/:id/like', isAuthenticated, async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) {
      return res.status(404).send('Post not found');
    }

    // Ensure likes is defined
    post.likes = post.likes || [];

    const userId = req.user._id;
    const hasLiked = post.likes.includes(userId);

    if (hasLiked) {
      // Unlike the post
      post.likes = post.likes.filter(id => !id.equals(userId));
      post.likeCount -= 1;
    } else {
      // Like the post
      post.likes.push(userId);
      post.likeCount += 1;
    }

    await post.save();
    res.json({ likeCount: post.likeCount, hasLiked: !hasLiked });
  } catch (err) {
    console.error('Error updating like status:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/fileupload', isAuthenticated, uploadImage.single("picture"), async function (req, res, next) {
  console.log('post /fileupload');
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
    res.redirect('/signup');
  });
});

router.post("/login", passport.authenticate("local", {
  successRedirect: "/feed",
  failureRedirect: "/login",
  failureFlash: true
}), function (req, res) {
  console.log('POST /login');
});

router.get("/logout", function (req, res) {
  console.log('GET /logout');
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
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
      return res.redirect('/login');
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
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n
      Please click on the following link, or paste this into your browser to complete the process:\n
      http://${req.headers.host}/reset/${token}\n\
      If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    await transporter.sendMail(mailOptions);

    req.flash('success', `An email has been sent to ${user.email} with further instructions.`);
    res.redirect('/login');
  } catch (error) {
    console.error('Error processing forgot password request:', error);
    req.flash('error', 'Error processing your request.');
    res.redirect('/login');
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
      return res.redirect('/login');
    }

    res.render('reset', { token: req.params.token });
  } catch (error) {
    console.error('Error finding user for password reset:', error);
    req.flash('error', 'Error finding user for password reset.');
    res.redirect('/login');
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
      return res.redirect('/login');
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
    res.redirect('/login');
  }
});

module.exports = router;
