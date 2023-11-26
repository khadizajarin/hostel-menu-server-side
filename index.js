const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lzj0eku.mongodb.net/?retryWrites=true&w=majority`;

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

    const mealCollection = client.db('hostelPro').collection('meals');
    const usersCollection = client.db('hostelPro').collection('users');



     // jwt related api
     app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

     // use verify admin after verifyToken
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }



       //CRUB operation for meals
       app.get('/meals', async(req, res) => {
        const cursor = mealCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      })

      app.get('/meals/:id', async(req, res) => {
        const id = parseInt(req.params.id);
        const query = {_id : id}
        const result = await mealCollection.findOne(query);
        res.send(result);
      }) 

      app.get('/meals/:id/reviews', async (req, res) => {
        const id = parseInt(req.params.id);
        const query = { _id: id };
        const meal = await mealCollection.findOne(query);
      
        if (!meal) {
          return res.status(404).json({ error: 'Meal not found' });
        }

        const result = meal.reviews || []; 
        res.send({ meal, result });
      });

      app.post('/meals/:id/reviews', async (req, res) => {
        const id = parseInt(req.params.id);
        const query = { _id: id };
        const meal = await mealCollection.findOne(query);
      
        if (!meal) {
          return res.status(404).json({ error: 'Meal not found' });
        }
      
        const reviewData = req.body; 
        meal.reviews = meal.reviews || [];
        meal.reviews.push(reviewData);
 
        await mealCollection.updateOne(query, { $set: { reviews: meal.reviews } });
      
        res.status(200).json({ message: 'Review added successfully!', meal: meal });
      });
      
      

      //user CRUB OPERATIONS
      app.post ('/users', async(req, res) => {
        const newUser = req.body;
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
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
    res.send('I believe that hard work pays off');
})

app.listen(port , () => {
    console.log(`job seeker server is running on port ${port}`);
})
