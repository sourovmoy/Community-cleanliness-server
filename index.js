const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const contributionCollection = database.collection("contribution");

    //issues api

    app.get("/issues", async (req, res) => {
      const email = req.query.email;
      const category = req.query.category;
      const status = req.query.status;
      const { search } = req.query;

      const query = {};
      if (email) {
        query.email = email;
      }
      if (category) {
        query.category = category;
      }
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }
      if (status) {
        query.status = status;
      }

      const cursor = issuesCollection.find(query);
      const issues = await cursor.toArray();
      res.send(issues);
    });

    app.get("/issues/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const results = await issuesCollection.findOne(query);
      res.send(results);
    });

    app.get("/recent-issues", async (req, res) => {
      const cursor = issuesCollection.find().sort({ date: -1 }).limit(6);
      const results = await cursor.toArray();
      res.send(results);
    });

    app.post("/issues", async (req, res) => {
      const issue = req.body;
      const results = await issuesCollection.insertOne(issue);
      res.send(results);
    });

    app.patch("/issues/:id", async (req, res) => {
      const id = req.params.id;
      const updateIssue = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: updateIssue.title,
          category: updateIssue.category,
          description: updateIssue.description,
          image: updateIssue.image,
          amount: updateIssue.amount,
          status: updateIssue.status,
          date: updateIssue.date,
        },
      };
      const option = {};
      const results = await issuesCollection.updateOne(
        query,
        updateDoc,
        option
      );
      res.send(results);
    });

    app.delete("/issues/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const results = await issuesCollection.deleteOne(query);
      res.send(results);
    });

    // contribution
    app.post("/contribution", async (req, res) => {
      const contribution = req.body;
      const results = await contributionCollection.insertOne(contribution);
      res.send(results);
    });

    app.get("/issues/contribution/:issueId", async (req, res) => {
      const id = req.params.issueId;
      const query = { issue: id };
      const cursor = contributionCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });

    app.get("/contribution", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = contributionCollection.find(query);
      const results = await cursor.toArray();
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
