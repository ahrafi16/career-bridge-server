const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 3000;

// middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
    console.log('inside the logger middleware');
    next();
}

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    console.log('cookie in the middleware', token);

    next();
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rinnvkt.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();



        // jobs api
        const jobsCollection = client.db('careerBridge').collection('jobs');
        const applicationCollection = client.db('careerBridge').collection('applications');

        // jwt token related api
        app.post('/jwt', async (req, res) => {
            const userData = req.body;
            const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
                expiresIn: '1d'
            })

            // set token in the cookies
            res.cookie('token', token, {
                httpOnly: true,
                secure: false
            })

            res.send({ success: true });
        })

        // all jobs api
        app.get('/jobs', async (req, res) => {

            const email = req.query.email;
            const query = {};
            if (email) {
                query.hr_email = email;
            }

            const cursor = jobsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/jobs/applications', async (req, res) => {
            const email = req.query.email;
            const query = { hr_email: email };
            const jobs = await jobsCollection.find(query).toArray();

            // should use aggregate to have optimum data fetching
            for (const job of jobs) {
                const applicationQuery = { jobId: job._id.toString() };
                const application_count = await applicationCollection.countDocuments(applicationQuery)
                job.application_count = application_count;
            }
            res.send(jobs);
        })

        // a single job api
        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollection.findOne(query);
            res.send(result)
        })

        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobsCollection.insertOne(newJob);
            res.send(result);
        })


        // job applications related APIs

        app.get('/applications', logger, verifyToken, async (req, res) => {
            const email = req.query.email;

            const query = {
                applicant: email
            }
            const result = await applicationCollection.find(query).toArray();

            // bad way to aggregate data 
            for (const application of result) {
                const jobId = application.jobId;
                const jobQuery = { _id: new ObjectId(jobId) };
                const job = await jobsCollection.findOne(jobQuery);
                application.company = job.company;
                application.title = job.title;
                application.company_logo = job.company_logo;
                application.category = job.category;
                application.status = job.status;
                application.applicationDeadline = job.applicationDeadline;
            }

            res.send(result);
        })

        app.get('/applications/jobs/:job_id', async (req, res) => {
            const job_id = req.params.job_id;
            const query = { jobId: job_id };
            const result = await applicationCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/applications', async (req, res) => {
            const application = req.body;
            const result = await applicationCollection.insertOne(application);
            res.send(result);
        })

        app.patch('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const updated = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await applicationCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('CareerBridge server is running!');
});

app.listen(port, () => {
    console.log(`Example app listening at port:${port}`);
});