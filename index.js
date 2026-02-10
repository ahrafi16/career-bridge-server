const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// middleware
app.use(cors({
    origin: ['https://career-bridge-23cd9.web.app'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Mongo URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rinnvkt.mongodb.net/?appName=Cluster0`;

// Mongo client (NO connect)
const client = new MongoClient(uri);
const jobsCollection = client.db('careerBridge').collection('jobs');
const applicationCollection = client.db('careerBridge').collection('applications');

// logger
const logger = (req, res, next) => {
    console.log('inside logger middleware');
    next();
};

// verify token
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    });
};

// home route
app.get('/', (req, res) => {
    res.send('CareerBridge server is running!');
});

// JWT route
app.post('/jwt', async (req, res) => {
    const userData = req.body;
    const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
        expiresIn: '1d'
    });

    res.cookie('token', token, {
        httpOnly: true,
        secure: false
    });

    res.send({ success: true });
});

// all jobs
app.get('/jobs', async (req, res) => {
    const email = req.query.email;
    const query = email ? { hr_email: email } : {};
    const result = await jobsCollection.find(query).toArray();
    res.send(result);
});

// jobs with application count
app.get('/jobs/applications', async (req, res) => {
    const email = req.query.email;
    const query = { hr_email: email };
    const jobs = await jobsCollection.find(query).toArray();

    for (const job of jobs) {
        const count = await applicationCollection.countDocuments({ jobId: job._id.toString() });
        job.application_count = count;
    }

    res.send(jobs);
});

// single job
app.get('/jobs/:id', async (req, res) => {
    const id = req.params.id;
    const result = await jobsCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
});

// add job
app.post('/jobs', async (req, res) => {
    const result = await jobsCollection.insertOne(req.body);
    res.send(result);
});

// applications by applicant (protected)
app.get('/applications', logger, verifyToken, async (req, res) => {
    const email = req.query.email;

    if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
    }

    const applications = await applicationCollection.find({ applicant: email }).toArray();

    for (const appItem of applications) {
        const job = await jobsCollection.findOne({ _id: new ObjectId(appItem.jobId) });
        if (job) {
            appItem.company = job.company;
            appItem.title = job.title;
            appItem.company_logo = job.company_logo;
            appItem.category = job.category;
            appItem.status = job.status;
            appItem.applicationDeadline = job.applicationDeadline;
        }
    }

    res.send(applications);
});

// applications for a job
app.get('/applications/jobs/:job_id', async (req, res) => {
    const result = await applicationCollection.find({ jobId: req.params.job_id }).toArray();
    res.send(result);
});

// add application
app.post('/applications', async (req, res) => {
    const result = await applicationCollection.insertOne(req.body);
    res.send(result);
});

// update application status
app.patch('/applications/:id', async (req, res) => {
    const id = req.params.id;
    const result = await applicationCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: req.body.status } }
    );
    res.send(result);
});

module.exports = app;
