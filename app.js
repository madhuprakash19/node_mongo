const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const findOrCreate = require("mongoose-findorcreate");
const mongoose = require("mongoose");
var ObjectId = require('mongodb').ObjectId;
var session = require('express-session');
//continue to login user evn after restarting server
var MongoDbStore = require('connect-mongo');
const methodOverride = require("method-override");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

// require('medium-editor/dist/css/medium-editor.css');
// require('medium-editor/dist/css/themes/default.css');

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(methodOverride("_method"));

app.use(
    session({
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoDbStore.create({
            mongoUrl: process.env.ATLAS_URI
        })
    })
);

app.use(passport.initialize());

//--------Use Passport to deal with sessions--------
app.use(passport.session());

//---------DB connection---------
mongoose.connect(process.env.ATLAS_URI);
// mongoose.set("useCreateIndex", true);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
    console.log("connected");
});


const postSchema = new mongoose.Schema({
    title: String,
    company: String,
    company_position: String,
    startdate: String,
    salary: String,
    rounds: String,
    content: String,
    markdown: String,
    account: String,
    email: String,
    authorId: String,
    timestamp: String,
    likes: Number,
});

const Post = mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema({
    userHandle: String,
    email: String,
    password: String,
    branch: String,
    name: String,
    USN: String,
    current_sem: String,
    posts: [String],
    likedPosts: [String],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

app.get("/signin", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/");
    }
    else {
        res.render("signin", { authenticated: req.isAuthenticated() });
    }
});

app.get("/signup", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/");
    }
    else {
        res.render("signup", { authenticated: req.isAuthenticated() });
    }
});

app.post("/signup", (req, res) => {
    User.register(
        {
            username: req.body.username, userHandle: req.body.userhandle,
            branch: req.body.branch, name: req.body.name, USN: req.body.usn,
            current_sem: req.body.sem
        },
        req.body.password,
        (err, user) => {
            if (err) {
                // console.log(err);
                res.send(err);
            } else {
                passport.authenticate("local")(req, res, () => {
                    res.redirect("/signin");
                });
            }
        }
    );
});

app.post("/signin", (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });

    req.login(user, (err) => {
        if (err) {
            console.log(err);
            res.send("Incorrect email or password");
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/");
            });
        }
    });
});


app.get('/logout', function (req, res, next) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/signin');
    });
});

app.get("/", (req, res) => {
    Post.find((err, posts) => {
        posts.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        if (req.isAuthenticated()) {
            User.findById(req.user.id, (err, foundUser) => {
                if (err) {
                    console.log(err);
                    res.send("There was an error. Please try again.");
                } else {
                    res.render("home", {
                        newPost: posts,
                        authenticated: req.isAuthenticated(),
                        userLikedPosts: foundUser.likedPosts,
                    });
                }
            });
        } else {
            res.render("home", {
                newPost: posts,
                authenticated: req.isAuthenticated(),
                userLikedPosts: null,
            });
        }
    });
});


app.get("/compose", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("compose", { authenticated: req.isAuthenticated() });
    } else {
        res.send("Please login to write a post.");
    }
});

app.post("/compose", (req, res) => {
    User.findById(req.user.id, (err, foundUser) => {
        if (err) {
            console.log(err);
            res.send("Please log in to post.");
        } else {
            const today = new Date();
            const dateTime =
                today.getFullYear() +
                "-" +
                (today.getMonth() + 1) +
                "-" +
                today.getDate() +
                " " +
                today.getHours() +
                ":" +
                today.getMinutes() +
                ":" +
                today.getSeconds();

            const post = new Post({
                title: req.body.postTitle,
                company: req.body.company,
                company_position: req.body.position,
                salary: req.body.salary,
                startdate: req.body.startdate,
                rounds: req.body.rounds,
                content: req.body.postBody,
                markdown: req.body.postMarkdown,
                account: foundUser.userHandle,
                email: foundUser.username,
                authorId: req.user.id,
                timestamp: dateTime,
                likes: 0,
            });

            post.save();

            foundUser.posts.push(post._id);

            foundUser.save(() => {
                res.redirect("/");
            });
        }
    });
});

app.get("/yourpost", (req, res) => {
    if (req.isAuthenticated()) {
        User.findById(req.user.id, (err, foundUser) => {
        var query = { authorId: req.user.id };
        db.collection("posts").find(query).toArray(function (err, result) {
            if (err) throw err;
            res.render("yourpost", {
                userPost: result,
                userName: foundUser.userHandle,
                authenticated: req.isAuthenticated()
            })
        });
    }) }else {
        res.send("login to see");
    }
});

app.get("/otherpost/:id", (req, res) => {
    if (req.isAuthenticated()) {
        User.findById(req.params.id, (err, foundUser) => {
        var query = { authorId: req.params.id };
        db.collection("posts").find(query).toArray(function (err, result) {
            if (err) throw err;
            res.render("otherpost", {
                userPost: result,
                userName: foundUser.userHandle,
                branch: foundUser.branch,
                usn:foundUser.USN,
                sem : foundUser.current_sem,
                authenticated: req.isAuthenticated()
            })
        });
    }) 
}
else {
        res.send("login to see");
    }
});


app.post("/like", (req, res) => {
    const liked = req.body.liked;
    const postId = req.body.postId;

    if (req.isAuthenticated()) {
        User.findById(req.user.id, (err, foundUser) => {
            if (err) {
                console.log(err);
                res.send("There was an error. Please try again.");
            } else {
                if (liked === "true") {
                    foundUser.likedPosts.push(postId);
                    foundUser.save();
                    Post.findById(postId, (err, foundPost) => {
                        if (err) {
                            console.log(err);
                            res.send("There was an error");
                        } else {
                            foundPost.likes++;
                            foundPost.save();
                        }
                    });
                    res.redirect("/");
                } else {
                    foundUser.likedPosts.splice(foundUser.likedPosts.indexOf(postId), 1);
                    foundUser.save();
                    Post.findById(postId, (err, foundPost) => {
                        if (err) {
                            console.log(err);
                            res.send("There was an error");
                        } else {
                            foundPost.likes--;
                            foundPost.save();
                        }
                    });
                    res.redirect("/");
                }
            }
        });
    }
});


app.get("/test/:testId", (req, res) => {
    const id = req.params.testId;
    // console.log(id);
    if (req.isAuthenticated()) {
        db.collection("posts").find({ _id: ObjectId(id) }).toArray(function (err, result) {
            if (err) throw err;
            console.log(result[0]);
            res.render("test", {
                userPost: result[0],
                userName: req.user.userName,
                authenticated: req.isAuthenticated()
            })
        });
    } else {
        res.send("login to see");
    }
});

app.post("/update", (req, res) => {
    pid = req.body.postid;
    // console.log(pid)
    var myquery = { _id: ObjectId(pid) };
    var newvalues = {
        $set: {
            title: req.body.postTitle,
            company: req.body.company,
            company_position: req.body.position,
            salary: req.body.salary,
            startdate: req.body.startdate,
            rounds: req.body.rounds,
            content: req.body.postBody,
            markdown: req.body.postMarkdown,
        }
    };
    db.collection("posts").updateOne(myquery, newvalues, function (err, res) {
        if (err) throw err;

    });
    res.redirect("/yourpost");
});


app.get("/delete/:id", (req, res) => {
    const id = req.params.id;
    res.render("delete", { pid: id ,authenticated: req.isAuthenticated()})
});

app.post("/delete", (req, res) => {
    pid = req.body.postid;
    var myquery = { _id: ObjectId(pid) };
    db.collection("posts").deleteOne(myquery, function (err, obj) {
        if (err) throw err;
    });
    res.redirect("/yourpost");
});

app.get("/posts/:postId", (req, res) => {
    const requestedPostId = req.params.postId;
    Post.findById(requestedPostId, (err, foundPost) => {
        if (err) {
            console.log(err);
            res.send("There was an error retrieving the post.");
        } else {
            if (foundPost) {
                if (req.isAuthenticated()) {
                    User.findById(req.user.id, (err, foundMyself) => {
                        if (err) {
                            console.log(err);
                            res.send("Please login to see this post");
                        } else {
                            if (foundMyself) {
                                if (
                                    JSON.stringify(foundMyself._id) ===
                                    JSON.stringify(foundPost.authorId)
                                ) {
                                    res.render("post", {
                                        id: foundPost._id,
                                        authorId: foundPost.authorId,
                                        title: foundPost.title,
                                        company:foundPost.company,
                                        company_position:foundPost.company_position,
                                        salary:foundPost.salary,
                                        rounds:foundPost.rounds,
                                        author: foundPost.account,
                                        content: foundPost.content,
                                        markdown: foundPost.markdown,
                                        time:foundPost.timestamp,
                                        visitor: false,
                                        authenticated: req.isAuthenticated(),
                                    });
                                } else {
                                    res.render("post", {
                                        id: foundPost._id,
                                        authorId: foundPost.authorId,
                                        title: foundPost.title,
                                        company:foundPost.company,
                                        company_position:foundPost.company_position,
                                        salary:foundPost.salary,
                                        rounds:foundPost.rounds,
                                        author: foundPost.account,
                                        content: foundPost.content,
                                        markdown: foundPost.markdown,
                                        time:foundPost.timestamp,
                                        visitor: true,
                                        authenticated: req.isAuthenticated(),
                                    });
                                }
                            } else {
                                res.send("Please login to see this post");
                            }
                        }
                    });
                } else {
                    res.render("post", {
                        id: foundPost._id,
                        authorId: foundPost.authorId,
                        title: foundPost.title,
                        company:foundPost.company,
                        company_position:foundPost.company_position,
                        salary:foundPost.salary,
                        rounds:foundPost.rounds,
                        author: foundPost.account,
                        content: foundPost.content,
                        markdown: foundPost.markdown,
                        time:foundPost.timestamp,
                        visitor: true,
                        authenticated: req.isAuthenticated(),
                    });
                }
            }
        }
    });
});

app.get("/contact", (req, res) => {
    res.render("contact", { authenticated: req.isAuthenticated() });
});

app.get("/about", (req, res) => {
    res.render("about", { authenticated: req.isAuthenticated() });
});

let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}

app.listen(port, function () {
    console.log("Server has started successfully");
});