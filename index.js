const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

async function run() {
  try {
    // await client.connect();

    const database = client.db("Community-cleanliness");
    const issuesCollection = database.collection("issues");
    const userCollection = database.collection("users");
    const contributionCollection = database.collection("contribution");
    const verifyAdmin = async (req, res, next) => {
      const email = req.tokenEmail;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      if (result?.role !== "admin") {
        return res.status(403).json({
          message: "Forbidden access",
        });
      }
      next();
    };

    //issues api

    app.get("/issues", async (req, res) => {
      const category = req.query.category;
      const status = req.query.status;
      const { search, skip = 0, limit = 12 } = req.query;

      const query = {};
      if (category) {
        query.category = category;
      }
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }
      if (status) {
        query.status = status;
      }

      const cursor = issuesCollection
        .find(query)
        .skip(Number(skip))
        .limit(Number(limit));
      const issues = await cursor.toArray();
      const issueCount = await issuesCollection.countDocuments();
      res.send({ issues, count: issueCount });
    });

    app.get("/my-issues", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
      const query = { email: email };
      const cursor = issuesCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });

    app.get("/issues/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const results = await issuesCollection.findOne(query);
      res.send(results);
    });

    app.get("/recent-issues", async (req, res) => {
      const cursor = issuesCollection.find().sort({ date: -1 }).limit(8);
      const results = await cursor.toArray();
      res.send(results);
    });

    app.post("/issues", async (req, res) => {
      const issue = req.body;
      const results = await issuesCollection.insertOne(issue);
      res.send(results);
    });

    app.patch("/issues/:id", verifyJWT, async (req, res) => {
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

    app.get("/user/overview", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
      const issuesQuery = { email: email };
      const issuesCount = await issuesCollection.countDocuments(issuesQuery);
      const contributionCount = await contributionCollection
        .find(issuesQuery)
        .project({ paid_amount: 1, title: 1 })
        .toArray();
      res.send({ issuesCount, contributionCount });
    });
    app.get("/admin/overview", verifyJWT, verifyAdmin, async (req, res) => {
      const totalIssues = await issuesCollection.countDocuments();
      const totalUser = await userCollection.countDocuments();
      const contributionCount = await contributionCollection.find().toArray();
      res.send({ totalIssues, totalUser, contributionCount });
    });
    app.get(
      "/admin/contributions",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const pipeline = [
          {
            $addFields: {
              issueId: { $toObjectId: "$issue" }, // convert contribution.issue to ObjectId
            },
          },
          {
            $group: {
              _id: "$issueId",
              totalAmount: { $sum: { $toInt: "$paid_amount" } },
            },
          },
          {
            $lookup: {
              from: "issues",
              localField: "_id",
              foreignField: "_id",
              as: "issueDetails",
            },
          },
          { $unwind: "$issueDetails" },
          {
            $project: {
              _id: 0,
              title: "$issueDetails.title",
              totalAmount: 1,
            },
          },
        ];
        const results = await contributionCollection
          .aggregate(pipeline)
          .toArray();
        res.send(results);
      }
    );

    app.get("/issues/contribution/:issueId", async (req, res) => {
      const id = req.params.issueId;
      const query = { issue: id };
      const cursor = contributionCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    });

    app.get("/contribution", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
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
      const role = "user";
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await userCollection.findOne(query);
      if (!existingUser) {
        const results = await userCollection.insertOne({ ...user, role });
        res.send(results);
      }
    });
    app.patch("/user/:email/update", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.updateOne(query, { $set: req.body });

      res.send(result);
    });

    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        res.status(200).json({
          role: user?.role || "user",
        });
      } catch (error) {
        res.status(400).json({
          message: "Failed to get user role",
          error: error.message,
        });
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
