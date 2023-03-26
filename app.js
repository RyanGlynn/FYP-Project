require ('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

// https://www.passportjs.org/packages/passport-google-oauth20/



const homeStartingContent = "Welcome to our Diabetes community, a place where individuals with diabetes and those who care about them can come together to learn, share, and support each other. Our website is dedicated to providing a platform where users can create posts and exchange information on various diabetes topics such as lifestyle, nutrition, medication, and more. Our goal is to empower individuals with diabetes to take control of their health and improve their quality of life. Join us today and become a part of our community where you can connect with others, share your experiences, and learn from each other.";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));


/*
Secret:
This is the secret used to sign the session ID cookie.

Resave:
Forces the session to be saved back to the session store, even if the session was never modified during the request.

saveUninitialized:
Forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.
Choosing false is useful for implementing login sessions, reducing server storage usage, or complying with laws that require permission before setting a cookie.
Choosing false will also help with race conditions where a client makes multiple parallel requests without a session.
*/

app.use(session({
  secret: "A Secret used with express session.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://Ryan:NUIMFYPMONGODB123@cluster0.jliv6lz.mongodb.net/?retryWrites=true&w=majority", {useNewUrlParser: true});
mongoose.set('strictQuery', false);

// Posts saved in mongo and displayed on Home page.

// Mongoose Schemas.
const postSchema = {
  title: String,
  content: String
};

const userSchema = new mongoose.Schema ({
  email: String,
  password: String
});

// This plugin will hash and salt the passwords.
userSchema.plugin(passportLocalMongoose);

userSchema.plugin(findOrCreate);


const Post = mongoose.model("Post", postSchema);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/FYP"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){

  Post.find({}, function(err, posts){
    res.render("home", {
      startingContent: homeStartingContent,
      posts: posts
      });
  });
});

//https://www.passportjs.org/packages/passport-google-oauth20/

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);
app.get("/auth/google/FYP",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to home.
    res.redirect("/");
  });

app.get("/contact", function(req, res){
  res.render("contact", {contactContent: contactContent});
});

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/create_post", function(req, res){
  if (req.isAuthenticated()) {
    res.render("create_post");
  } else {
    res.redirect("/login");
  }
});

app.post("/create_post", function(req, res){
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody
  });

  post.save(function(err){
    if (!err){
        res.redirect("/");
    }
  });
});


// Issue: Couldn't post to /register. Code below was in the incorrect place, inside a curly bracket.
app.post("/register", function(req, res){
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err){
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/");
      })
    }
  })
});

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
      res.redirect("/");
      })
    }
  })
});

// Issues with logout using passport-local-mongoose. Cannot post /logout.
// Solution: Since version 0.6.0 (which was released only a few days ago by the time of writing this), req.logout is asynchronous. This is part of a larger change that averts session fixation attacks.
// https://stackoverflow.com/questions/72336177/error-reqlogout-requires-a-callback-function

app.get('/logout', function(req, res) {
  req.logout(function(err){
    if(err){
      return next(err);
    }
    res.redirect("/");
  });
});


app.get("/posts/:postId", function(req, res){

  const requestedPostId = req.params.postId;

  Post.findOne({_id: requestedPostId}, function(err, post){
    res.render("post", {
      title: post.title,
      content: post.content
    });
  });
});

// https://www.youtube.com/watch?v=9_lKMTXVk64 - Video for fuzzy search with EJS and Mongoose
app.get("/search", function(req, res){
  if(req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Post.find({title: regex}, function(err, posts){
           if(err){
               console.log(err);
           } else {
              res.render("home", {
               startingContent: homeStartingContent,
               posts: posts
               });
           }
        });
    } else {
        Post.find({}, function(err, posts){
             res.render("home", {
              startingContent: homeStartingContent,
              posts: posts
              });
        });
    }
});

// https://stackoverflow.com/questions/38421664/fuzzy-searching-with-mongodb
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
