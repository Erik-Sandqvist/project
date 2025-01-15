//--------------
// Global Definitions
//--------------

// Admin credentials
const adminName = "erik";
//const adminPassword = 
const adminPassword =
  "$2b$12$YRDhDifbYeg3sVWfvtg9X.v9DpchlakY4b8EQrzYYI69jh0IrUp3q";

//--------------
// App Setup and Middleware
//--------------

// Import required modules
const express = require("express");
const path = require("path");
const port = 8080;
const app = express();

// Handlebars setup for templating
const { engine } = require("express-handlebars");
const handlebars = require("handlebars");

// Session management with SQLite store
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

// Database connection setup
const sqlite3 = require("sqlite3");
const dbFile = path.join(__dirname, "mydatabase.db");
const db = new sqlite3.Database(dbFile);

// Profile picture handling with Multer and file system (fs)
const multer = require("multer"); // Middleware for handling file uploads
const fs = require("fs"); // File system module for reading/writing files

// Bcrypt for password hashing
const bcrypt = require("bcrypt");
const saltRounds = 12;

//--------------
// Helper Registration
//--------------
handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
  return arg1 == arg2 ? options.fn(this) : options.inverse(this);
});

const hbs = require("handlebars");
hbs.registerHelper("eq", function (a, b) {
  return a === b;
});

// Handlebars engine setup with custom helpers
app.engine(
  "handlebars",
  engine({
    helpers: {
      eq(a, b) {
        return a == b;
      },
    },
  })
);
app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));

//--------------
// Middleware Configuration
//--------------

// Middleware to parse URL-encoded data from forms (POST request bodies)
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS, images) from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Session setup and configuration using SQLite store
app.use(
  session({
    store: new SQLiteStore({ db: "session-db.db" }), // Store sessions in SQLite database
    saveUninitialized: false, // Don't save uninitialized sessions
    resave: false, // Don't resave sessions unless they've changed
    secret: "This1234@verysecret4u2see%", // Session secret for signing cookies (ensure this is kept secure)
  })
);

// Middleware to attach the session to response locals (to make session data available in templates)
app.use(function (req, res, next) {
  console.log("Session passed to response locals...");
  res.locals.session = req.session;
  next();
});
//--------------
//Routes
//--------------
app.get("/", function (req, res) {
  // First, get all the projects
  db.all("SELECT * FROM projects", (error, listOfProjects) => {
    if (error) {
      console.log("ERROR: ", error);
      return res
        .status(500)
        .send("An error occurred while retrieving projects.");
    } else {
      // Store the project data
      const model = {
        isLoggedIn: req.session.isLoggedIn,
        name: req.session.name,
        isAdmin: req.session.isAdmin,
        projects: listOfProjects,
      };

      // query the posts table
      const query = `
      SELECT posts.message, users.username 
      FROM posts 
      JOIN users ON posts.user_id = users.id
    `;
      db.all(query, (error, posts) => {
        if (error) {
          console.log("Error retrieving posts:", error);
          return res
            .status(500)
            .send("An error occurred while retrieving posts.");
        } else {
          // Add the posts to the model object
          model.posts = posts;

          // Render the home page with the combined data
          console.log("---> Home model: ", JSON.stringify(model));
          res.render("home.handlebars", model);
        }
      });
    }
  });
});

app.get("/about", function (req, res) {
  res.render("cv.handlebars");
});

app.get("/contact", function (req, res) {
  res.render("contact.handlebars");
});

app.get("/login", function (req, res) {
  res.render("login.handlebars");
});

app.get("/profile", (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  res.render("profile.handlebars");
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Error while destroing the session: ", err);
    } else {
      console.log("Logged out...");
      res.redirect("/");
    }
  });
});

app.get("/project-new", function (req, res) {
  res.render("project-new.handlebars");
});

app.get("/projects", function (req, res) {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if no page is provided
  const limit = 3; // Number of projects to display per page
  const offset = (page - 1) * limit; // Calculate the offset for SQL query

  // First, get the total number of projects to calculate total pages
  db.get("SELECT COUNT(*) AS total FROM projects", (error, result) => {
    if (error) {
      console.log("ERROR: ", error);
      return res
        .status(500)
        .send("An error occurred while retrieving projects.");
    }

    const totalProjects = result.total;
    const totalPages = Math.ceil(totalProjects / limit); // Calculate total pages

    // Now, retrieve the projects for the current page
    db.all(
      "SELECT * FROM projects LIMIT ? OFFSET ?",
      [limit, offset],
      (error, listOfProjects) => {
        if (error) {
          console.log("ERROR: ", error);
          return res
            .status(500)
            .send("An error occurred while retrieving projects.");
        }

        // Create an array of page numbers
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }

        // Prepare model to pass to Handlebars
        const model = {
          projects: listOfProjects,
          currentPage: page,
          totalPages: totalPages,
          hasNextPage: page < totalPages, // True if there is a next page
          hasPreviousPage: page > 1, // True if there is a previous page
          nextPage: page + 1, // Calculate the next page number
          previousPage: page - 1, // Calculate the previous page number
          pages: pages, // Add the pages array for pagination
        };

        // Render the 'projects' view with the pagination data
        res.render("projects.handlebars", model);
      }
    );
  });
});

//Show one project
app.get("/project/:projectid", function (req, res) {
  console.log(
    "Project route parameter projectid: " + JSON.stringify(req.params.projectid)
  );

  db.all(
    // Modify the query to fetch sid as well
    "SELECT projects.*, skills.sname, project_skills.sid FROM project_skills INNER JOIN projects ON project_skills.pid = projects.pid INNER JOIN skills ON project_skills.sid = skills.sid WHERE projects.pid = ?;",
    [req.params.projectid],
    (error, projectDetails) => {
      if (error) {
        console.log("Error: ", error);
      } else {
        const model = {
          project: projectDetails[0], // Assuming only one project per ID
          skills: projectDetails, // Includes both sname and sid for each skill
        };
        res.render("project.handlebars", model);
      }
    }
  );
});

//Delete project
app.get("/project/delete/:projid", function (req, res) {
  console.log(
    "Project route parameter projid: " + JSON.stringify(req.params.projid)
  );
  if (req.session.isAdmin) {
    db.run(
      "DELETE FROM projects where pid=?",
      [req.params.projid],
      (error, theProject) => {
        if (error) {
          console.log("ERROR: ", error);
        } else {
          console.log(
            "The project " + req.params.projid + "has been delted..."
          );
          res.redirect("/projects");
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

//Modify project
app.get("/project/modify/:projid", function (req, res) {
  const id = req.params.projid;
  db.get("SELECT * FROM projects WHERE pid=?", [id], (error, theProject) => {
    if (error) {
      console.log("ERROR ", error);
      res.redirect("projects");
    } else {
      model = { project: theProject };
      res.render("project-new.handlebars", model);
    }
  });
});
//Modify project
app.post("/project/modify/:projid", function (req, res) {
  const id = req.params.projid;
  const name = req.body.projname;
  const year = req.body.projyear;
  const desc = req.body.projdesc;
  const type = req.body.projtype;
  const dev = req.body.projdev;
  const url = req.body.projurl;

  db.run(
    "UPDATE projects SET pname = ?, pyear = ?, pdesc = ?, ptype = ?, pdev = ?, pimageurl = ? WHERE pid = ?",
    [name, year, desc, type, dev, url, id],
    (error) => {
      if (error) {
        console.log("ERROR: ", error.message);
        res.redirect("/projects");
      } else {
        console.log("Project updated successfully!");
        res.redirect("/projects");
      }
    }
  );
});

// create new project from the data sent in the form
app.post("/project/new", function (req, res) {
  const name = req.body.projname;
  const year = req.body.projyear;
  const desc = req.body.projdesc;
  const type = req.body.projtype;
  const dev = req.body.projdev;
  const url = req.body.projurl;

  db.run(
    "INSERT INTO projects (pname, pyear, pdesc, ptype, pdev, pimageurl) VALUES (?, ?, ?, ?, ?, ?)",
    [name, year, desc, type, dev, url],
    (error) => {
      if (error) {
        console.log("ERROR: ", error.message);
        res.redirect("/projects");
      } else {
        console.log("Line added into the projects table!");
        res.redirect("/projects");
      }
    }
  );
});

app.get("/skills", function (req, res) {
  db.all("SELECT * FROM skills", (error, listofskills) => {
    if (error) {
      console.log("ERROR: ", error);
    } else {
      model = { skills: listofskills };
      res.render("skills.handlebars", model);
    }
  });
});

app.get("/posts", (req, res) => {
  const query = `
    SELECT posts.message, users.username 
    FROM posts 
    JOIN users ON posts.user_id = users.id
  `;
  db.all(query, (error, posts) => {
    if (error) {
      console.log("Error retrieving posts:", error);
      return res.status(500).send("An error occurred while retrieving posts.");
    } else {
      const model = {
        isLoggedIn: req.session.isLoggedIn,
        posts: posts,
      };
      res.render("posts.handlebars", model);
    }
  });
});

app.get("/users", (req, res) => {
  if (!req.session.isLoggedIn || !req.session.isAdmin) {
    return res.status(403).send("You must be an admin to view this page.");
  }

  db.all("SELECT * FROM users", (error, users) => {
    if (error) {
      console.log("Error fetching users:", error);
      return res.status(500).send("An error occurred while retrieving users.");
    }

    const model = {
      users: users,
    };
    res.render("users.handlebars", model);
  });
});
app.get("/users/delete/:userId", (req, res) => {
  if (!req.session.isLoggedIn || !req.session.isAdmin) {
    return res.status(403).send("You must be an admin to perform this action.");
  }

  const userId = req.params.userId;

  db.run("DELETE FROM users WHERE id = ?", [userId], (error) => {
    if (error) {
      console.log("Error deleting user:", error);
      return res.status(500).send("An error occurred while deleting the user.");
    }

    console.log(`User with ID ${userId} deleted.`);
    res.redirect("/users");
  });
});
app.get("/users/edit/:userId", (req, res) => {
  if (!req.session.isLoggedIn || !req.session.isAdmin) {
    return res.status(403).send("You must be an admin to view this page.");
  }

  const userId = req.params.userId;

  db.get("SELECT * FROM users WHERE id = ?", [userId], (error, user) => {
    if (error) {
      console.log("Error fetching user:", error);
      return res
        .status(500)
        .send("An error occurred while retrieving the user.");
    }

    const model = {
      user: user,
    };
    res.render("edit-user.handlebars", model);
  });
});
app.post("/users/edit/:userId", (req, res) => {
  if (!req.session.isLoggedIn || !req.session.isAdmin) {
    return res.status(403).send("You must be an admin to perform this action.");
  }

  const userId = req.params.userId;
  const { username, name, age, isAdmin } = req.body;

  db.run(
    "UPDATE users SET username = ?, name = ?, age = ?, isAdmin = ? WHERE id = ?",
    [username, name, age, isAdmin === "on" ? 1 : 0, userId],
    (error) => {
      if (error) {
        console.log("Error updating user:", error);
        return res
          .status(500)
          .send("An error occurred while updating the user.");
      }

      console.log(`User with ID ${userId} updated.`);
      res.redirect("/users");
    }
  );
});

//-------------
//End of routs
//-------------

//Add posts
app.post("/posts", (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.status(403).send("You must be logged in to post a message.");
  }

  const message = req.body.message;
  const userId = req.session.userId; // Vi antar att userId är sparat i sessionen

  if (!message) {
    return res.status(400).send("Message cannot be empty.");
  }

  db.run(
    "INSERT INTO posts (message, user_id) VALUES (?, ?)",
    [message, userId],
    (error) => {
      if (error) {
        console.log("Error inserting post:", error);
        return res
          .status(500)
          .send("An error occurred while posting the message.");
      } else {
        res.redirect("/posts");
      }
    }
  );
});

app.get("/register", function (req, res) {
  res.render("register.handlebars");
});

app.post("/register", function (req, res) {
  const { username, password, name, age } = req.body;

  // Logga mottagna värden
  console.log("Received registration data:", { username, password, name, age });

  if (!username || !password || !name || !age) {
    return res.status(400).render("register.handlebars", {
      error: "All fields are required.",
    });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.log("Database error on user check:", err);
      return res.status(500).render("register.handlebars", {
        error: "An error occurred. Please try again.",
      });
    }

    if (user) {
      return res
        .status(400)
        .render("register.handlebars", { error: "Username already exists." });
    }

    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
      if (err) {
        console.log("Error hashing password:", err);
        return res.status(500).render("register.handlebars", {
          error: "An error occurred. Please try again.",
        });
      }

      db.run(
        "INSERT INTO users (username, password, name, age, isAdmin) VALUES (?, ?, ?, ?, false)",
        [username, hashedPassword, name, age],
        (err) => {
          if (err) {
            console.log("Database error on insert:", err);
            return res.status(500).render("register.handlebars", {
              error: "An error occurred. Please try again.",
            });
          }

          return res.render("login.handlebars", {
            message: "Registration successful! You can now log in.",
          });
        }
      );
    });
  });
});

//Get data to login
const hashedPassword =
  " $2b$12$YRDhDifbYeg3sVWfvtg9X.v9DpchlakY4b8EQrzYYI69jh0IrUp3q";

app.post("/login", (req, res) => {
  const { username, password, action } = req.body;

  if (!username || !password) {
    const model = { error: "", message: "Username and password are required" };
    return res.status(400).render("login.handlebars", model);
  }

  if (action === "Login") {
    db.get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      (err, user) => {
        if (err) {
          return res.status(500).render("login.handlebars", {
            error: "An error occurred. Please try again.",
          });
        }
        if (!user) {
          return res.status(400).render("login.handlebars", {
            error: "Invalid username or password.",
          });
        }

        bcrypt.compare(password, user.password, (err, result) => {
          if (err || !result) {
            return res.status(400).render("login.handlebars", {
              error: "Invalid username or password.",
            });
          }

          // Save info in the session
          req.session.isLoggedIn = true;
          req.session.name = username;
          req.session.isAdmin = user.isAdmin;
          req.session.userId = user.id;
          req.session.profilePic = user.profilePic;
          res.redirect("/");
        });
      }
    );
  }
});

//<--Some code to save the profilepicture was inspierd by https://stackoverflow.com/questions/71587539/how-to-add-user-profile-picture-in-schema -->
// Saving files (profilepicture)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "public/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, req.session.name + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

app.post("/upload-profile-pic", upload.single("profilePic"), (req, res) => {
  if (!req.session.isLoggedIn) {
    return res
      .status(403)
      .send("You must be logged in to upload a profile picture.");
  }

  const profilePicPath = `/uploads/${req.file.filename}`;

  // Update the users profile picture
  db.run(
    "UPDATE users SET profilePic = ? WHERE username = ?",
    [profilePicPath, req.session.name],
    (err) => {
      if (err) {
        return res
          .status(500)
          .send("An error occurred while saving the profile picture.");
      }

      // Uppdatera sessionen med den nya profilbilden
      req.session.profilePic = profilePicPath;

      res.redirect("/profile");
    }
  );
});
//posts
function initTablePosts(mydb) {
  mydb.run(
    `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    (error) => {
      if (error) {
        console.log("Error creating posts table:", error);
      } else {
        console.log("Posts table created successfully.");
      }
    }
  );
}

// Initialize the users table and insert data
function initUsersTable(mydb) {
  mydb.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, password TEXT NOT NULL, isAdmin BOOLEAN NOT NULL, profilePic TEXT, name TEXT, age INT)",
    (error) => {
      if (error) {
        console.log("Error creating users table:", error);
      } else {
        console.log("Users table created successfully.");
      }
    }
  );
}

// Initialize the projects table and insert data
function initTableProjects(mydb) {
  const projects = [];

  // create table projects at startup
  mydb.run(
    "CREATE TABLE projects (pid INTEGER PRIMARY KEY AUTOINCREMENT, pname TEXT NOT NULL, pdesc TEXT NOT NULL, ptype TEXT NOT NULL, pyear TEXT NOT NULL, pdev TEXT NOT NULL, pimageurl TEXT NOT NULL)",
    (error) => {
      if (error) {
        console.log("ERROR: ", error); // error: display it in the terminal
      } else {
        console.log("---> Table projects created!"); // no error, the table has been created

        // inserts projects
        projects.forEach((oneProject) => {
          mydb.run(
            "INSERT INTO projects (pid, pname, pdesc, ptype, pyear, pdev, pimageurl) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              oneProject.name,
              oneProject.desc,
              oneProject.type,
              oneProject.year,
              oneProject.dev,
              oneProject.imageurl,
            ],
            (error) => {
              if (error) {
                console.log("ERROR: ", error);
              } else {
                console.log("Line added into the projects table!");
              }
            }
          );
        });
      }
    }
  );
}

// Initialize the skills table and insert data
function initTableSkills(mydb) {
  const skills = [
    {
      id: 1,
      name: "HTML",
      type: "Programming language for websites",
      desc: "Making websites",
      level: "5",
    },
    {
      id: 2,
      name: "CSS",
      type: "Programming language to style websites",
      desc: "Making websites",
      level: "5",
    },
    {
      id: 3,
      name: "JavaScript",
      type: "Programming language to make websites more intreactive",
      desc: "Making websites",
      level: "5",
    },
    {
      id: 4,
      name: "JavaScript with node.js",
      type: "Programming language",
      desc: "Making dynamic websites",
      level: "2",
    },
    {
      id: 5,
      name: "c#",
      type: "Programming language used in many situations",
      desc: "Proggraming",
      level: "3",
    },
    {
      id: 6,
      name: ".net",
      type: "Programming language used in backend to websites",
      desc: "Proggraming",
      level: "2",
    },
    {
      id: 7,
      name: "Pgotoshop",
      type: "A program used to create and edit picturs",
      desc: "Creating",
      level: "4",
    },
  ];
  // create table skills at startup
  mydb.run(
    "CREATE TABLE skills (sid INTEGER PRIMARY KEY AUTOINCREMENT, sname TEXT NOT NULL, sdesc TEXT NOT NULL, stype TEXT NOT NULL, slevel INT)",
    (error) => {
      if (error) {
        console.log("ERROR: ", error); // error: display it in the terminal
      } else {
        console.log("---> Table projects created!"); // no error, the table has been created

        // inserts skills
        skills.forEach((oneSkill) => {
          db.run(
            "INSERT INTO skills (sid, sname, sdesc, stype, slevel) VALUES (?, ?, ?, ?, ?)",
            [
              oneSkill.id,
              oneSkill.name,
              oneSkill.desc,
              oneSkill.type,
              oneSkill.level,
            ],
            (error) => {
              if (error) {
                console.log("ERROR: ", error);
              } else {
                console.log("Line added into the skills table!");
              }
            }
          );
        });
      }
    }
  );
}
//-------------
//404 not found
//-------------
app.use(function (req, res) {
  res.status(404).render("404.handlebars");
});
//-------------
//500 ERROR
//-------------
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).render("500");
});

//-------
//Listen
//-------
app.listen(port, function () {
  console.log(
    "Server up and running, listening on port " + `${port}` + "... :)"
  );
  initTableSkills(db);
  initTableProjects(db);
  initUsersTable(db);
  initTablePosts(db);
});
