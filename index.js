const express = require("express");
const cors = require("cors");
require("dotenv").config();
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.yh8mwoi.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("server is running");
});

async function run() {
  try {
    // await client.connect();

    const database = client.db("Community-cleanliness");
    const issuesCollection = database.collection("issues");
    const userCollection = database.collection("users");

    //issues api

    app.get("/issues", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = issuesCollection.find(query);
      const issues = await cursor.toArray();
      res.send(issues);
    });

    app.post("/issues", async (req, res) => {
      const issue = req.body;
      const results = await issuesCollection.insertOne(issue);
      res.send(results);
    });

    //users api
    app.post("/user", async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await userCollection.findOne(query);
      if (!existingUser) {
        const results = await userCollection.insertOne(user);
        res.send(results);
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("port is running at", port);
});
